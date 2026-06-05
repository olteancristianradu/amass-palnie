/**
 * Auto-sync scheduler — rulează în procesul server (pornit din instrumentation.ts).
 * Cadență "Echilibrat": light (clienți noi) la ~90s, detalii (lot rotativ) la ~10min.
 * Single-flight per cont + backoff la erori (protejează contul gestcom).
 *
 * IMPORTANT: starea trăiește pe globalThis. instrumentation.ts și rutele API rulează în
 * INSTANȚE DE MODUL diferite în Next.js, dar în ACELAȘI proces Node → globalThis e partajat.
 *
 * LOCK PARTAJAT (audit 2026-06-02): concurența NU mai e ținută doar în AcctState (vizibilă
 * exclusiv scheduler-ului). Există un lock per-userId pe globalThis (Set busy) verificat ȘI
 * setat ȘI de scheduler ȘI de rutele manuale (/api/crm/sync-clienti, /api/crm/sync-detalii)
 * prin helper-ele isSyncing/acquireSync/releaseSync. Astfel un sync manual nu mai rulează în
 * paralel cu un ciclu auto pe ACELAȘI cont (evită SyncRun-uri RUNNING duplicate + cookie
 * gestcom reciproc invalidat).
 */
import { prisma } from './db';
import { syncNewClients, refreshDetailsBatch } from './sync-engine';

const LIGHT_MS = 90_000;     // verificare clienți noi
const DETAIL_MS = 600_000;   // refresh detalii (lot rotativ)
const TICK_MS = 30_000;      // cât de des verifică scheduler-ul ce e scadent
const BATCH = 40;            // clienți/ciclu de detalii (rotație → acoperire completă în ~90 min)
const BACKOFF_MS = 300_000;  // pauză după o eroare pe un cont (separat light / detail)

// Backoff separat light vs detail (audit 2026-06-02): o eroare globală pe lotul de detalii
// nu mai trebuie să blocheze 5 min și detectarea clienților noi (light).
interface AcctState { lastLightAt: number; lastDetailAt: number; lastError?: string; lightBackoffUntil: number; detailBackoffUntil: number; }

interface AutoSyncGlobal { started: boolean; state: Map<string, AcctState>; timer: ReturnType<typeof setInterval> | null; busy: Set<string>; }
function G(): AutoSyncGlobal {
  const g = globalThis as typeof globalThis & { __amassAutoSync?: AutoSyncGlobal };
  if (!g.__amassAutoSync) g.__amassAutoSync = { started: false, state: new Map(), timer: null, busy: new Set<string>() };
  // Migrare în caz de hot-reload peste o instanță veche fără `busy`.
  if (!g.__amassAutoSync.busy) g.__amassAutoSync.busy = new Set<string>();
  return g.__amassAutoSync;
}

function acct(uid: string): AcctState {
  const st = G().state;
  let s = st.get(uid);
  if (!s) { s = { lastLightAt: 0, lastDetailAt: 0, lightBackoffUntil: 0, detailBackoffUntil: 0 }; st.set(uid, s); }
  return s;
}

/* ───────────────────────── Lock partajat per-userId ─────────────────────────
 * Folosit de scheduler ȘI de rutele manuale ca single-flight pe cont. Un singur
 * sync (auto sau manual) per userId la un moment dat. Verifică isSyncing() înainte,
 * acquireSync() la start (întoarce false dacă e deja ocupat), releaseSync() în finally.
 */

/** True dacă există deja un sync (auto sau manual) în curs pentru acest cont. */
export function isSyncing(userId: string): boolean {
  return G().busy.has(userId);
}

/**
 * Încearcă să prindă lock-ul. Întoarce false dacă era deja ocupat.
 * P5: check + set sunt sincrone (fără await) → atomic în runtime-ul JS single-threaded.
 * Setăm busy ÎNAINTE de orice await ulterior din caller (tick face acquireSync direct
 * fără isSyncing() separat, eliminând fereastra de race dintre verificare și setare).
 */
export function acquireSync(userId: string): boolean {
  const busy = G().busy;
  if (busy.has(userId)) return false;
  busy.add(userId); // setat sincron, înainte de orice await → nu există fereastră de race
  return true;
}

/** Eliberează lock-ul. Idempotent. */
export function releaseSync(userId: string): void {
  G().busy.delete(userId);
}

async function tick() {
  let creds: { userId: string }[] = [];
  try { creds = await prisma.crmCredentials.findMany({ where: { autoSync: true }, select: { userId: true } }); }
  catch { return; }
  const now = Date.now();
  for (const { userId } of creds) {
    const s = acct(userId);
    const dueLight = now - s.lastLightAt >= LIGHT_MS && now >= s.lightBackoffUntil;
    const dueDetail = now - s.lastDetailAt >= DETAIL_MS && now >= s.detailBackoffUntil;
    if (!dueLight && !dueDetail) continue;
    // Lock partajat: dacă un sync manual (sau alt tick) rulează deja pe acest cont, sărim.
    if (!acquireSync(userId)) continue;
    (async () => {
      // Backoff INDEPENDENT pe ramuri: o eroare de detail nu mai blochează light și invers.
      if (dueLight) {
        try {
          const r = await syncNewClients(userId); s.lastLightAt = Date.now();
          if (!r.ok) throw new Error(r.error);
          s.lightBackoffUntil = 0;
          if (now >= s.detailBackoffUntil) s.lastError = undefined;
        } catch (e) {
          s.lastError = e instanceof Error ? (e.message || String(e)) : String(e);
          s.lightBackoffUntil = Date.now() + BACKOFF_MS;
          console.error('[auto-sync] cont', userId, 'eroare LIGHT → backoff 5min:', s.lastError);
        }
      }
      if (dueDetail) {
        try {
          const r = await refreshDetailsBatch(userId, BATCH, 'AUTO_DETAIL'); s.lastDetailAt = Date.now();
          if (!r.ok) throw new Error(r.error);
          s.detailBackoffUntil = 0;
          if (now >= s.lightBackoffUntil) s.lastError = undefined;
        } catch (e) {
          s.lastError = e instanceof Error ? (e.message || String(e)) : String(e);
          s.detailBackoffUntil = Date.now() + BACKOFF_MS;
          console.error('[auto-sync] cont', userId, 'eroare DETAIL → backoff 5min:', s.lastError);
        }
      }
    })().finally(() => releaseSync(userId));
  }
}

export function startAutoSync() {
  const g = G();
  if (g.started) return;
  g.started = true;
  console.log('[auto-sync] pornit (light 90s / detalii 10min, lot ' + BATCH + ')');
  // Curăță SyncRun-uri rămase RUNNING după un crash/restart (audit 2026-06-01) — altfel rămân orfane.
  // P4: adăugat catch cu logging (anterior catch gol → eroare Prisma la startup era silențioasă).
  prisma.syncRun.updateMany({ where: { status: 'RUNNING' }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'întrerupt (restart server)' } }).catch((e: unknown) => { console.error('[auto-sync] cleanup SyncRun la pornire a eșuat:', e instanceof Error ? (e.message || e) : e); });
  setTimeout(() => { tick().catch(() => {}); g.timer = setInterval(() => tick().catch(() => {}), TICK_MS); }, 15_000);
}

/** Stare pentru badge/dashboard (în-memorie pe globalThis, per proces). */
export function getAutoSyncState(userId?: string) {
  const g = G();
  if (userId) {
    const s = g.state.get(userId);
    return {
      enabled: g.started,
      lastLightAt: s?.lastLightAt ? new Date(s.lastLightAt).toISOString() : null,
      lastDetailAt: s?.lastDetailAt ? new Date(s.lastDetailAt).toISOString() : null,
      inFlight: isSyncing(userId), lastError: s?.lastError || null,
      lightEverySec: LIGHT_MS / 1000, detailEverySec: DETAIL_MS / 1000
    };
  }
  return { enabled: g.started, accounts: g.state.size };
}
