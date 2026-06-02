/**
 * Sync engine — logica de sincronizare CRM, reutilizabilă din rutele HTTP ȘI din
 * scheduler-ul de auto-sync (lib/auto-sync.ts). Fără sesiune; primește userId.
 */
import { prisma } from './db';
import { fetchList, fetchDetail, fetchUltimulReminderDeschis } from './crm-client';
import { auditLog } from './audit';

const FINAL = ['Anulat', 'Contractat', 'Finalizat'];

function mapStadiu(situatie: string): string | null {
  return situatie === 'ANULATA' ? 'Anulat'
    : situatie === 'CONTRACTATA' ? 'Contractat'
    : situatie === 'FINALIZATA' ? 'Finalizat' : null;
}

/** Câmpurile de detaliu comune (din CRM detail) pentru upsert. */
function detailFields(d: any) {
  return {
    judet: d.judet, sursa: d.sursa, telefon: d.telefon, email: d.email,
    suprafata: typeof d.suprafata === 'number' ? d.suprafata : null,
    hasAudio: d.hasAudio, stelutaCat: d.stelutaCat,
    stadiu: mapStadiu(d.situatie),
    dataIntrare: d.dataIntrare ? new Date(d.dataIntrare) : null,
    observatii: d.observatii
  };
}

/**
 * LIGHT: detectează clienți NOI din CRM (fetchList) și îi inserează (detail doar pe cei noi).
 * Dacă nu sunt clienți noi → cost ~1 listă (ieftin). Potrivit pentru polling des.
 */
export async function syncNewClients(userId: string) {
  try {
    const allIds = await fetchList(userId);
    const existing = await prisma.client.findMany({ where: { ownerId: userId }, select: { idLucrare: true } });
    const have = new Set(existing.map(e => e.idLucrare));
    const fresh = allIds.filter(id => !have.has(id));
    // SyncRun se creează DOAR când chiar sunt clienți noi (altfel polling-ul des ar spama istoricul).
    if (fresh.length === 0) return { ok: true as const, totalCRM: allIds.length, added: 0 };
    const run = await prisma.syncRun.create({ data: { userId, type: 'CLIENTS_NEW', status: 'RUNNING', startedAt: new Date() } });
    let added = 0;
    for (const id of fresh) {
      try {
        const d = await fetchDetail(userId, id);
        const m = d.name.match(/^(.+?)\s*-\s*([^(]+?)\s*\((\d+)\)\s*(DT)?/i);
        const nume = m ? m[1].trim() : d.name;
        const localitate = m ? m[2].trim() : (d.localitate ?? '');
        const categorie = m ? parseInt(m[3], 10) : 2;
        const isDT = !!(m && m[4]);
        await prisma.client.upsert({
          where: { ownerId_idLucrare: { ownerId: userId, idLucrare: id } },
          create: { ownerId: userId, idLucrare: id, nume: nume || d.name, localitate: localitate || d.localitate, categorie, isDT, t1: d.t1 || null, lastDetailAt: new Date(), ...detailFields(d) },
          update: { lastDetailAt: new Date(), ...detailFields(d) }
        });
        added++;
      } catch (e: any) { console.error('syncNewClients id=' + id, e?.message); }
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), total: allIds.length, processed: added } });
    return { ok: true as const, totalCRM: allIds.length, added };
  } catch (e: any) {
    return { ok: false as const, error: e?.message };
  }
}

/**
 * Refresh detalii pe un LOT rotativ de clienți activi (cei mai vechi refreshed primii).
 * limit=0 → toți (folosit de sync manual). Altfel batch (folosit de auto-sync).
 */
export async function refreshDetailsBatch(userId: string, limit = 0, type = 'DETAILS') {
  const run = await prisma.syncRun.create({ data: { userId, type, status: 'RUNNING', startedAt: new Date() } });
  try {
    const clienti = await prisma.client.findMany({
      // FIX audit 2026-06-02: `NOT in` ignoră NULL în SQL → clienții activi (stadiu=null) NU erau niciodată refreshați.
      // Includem explicit stadiu=null (activi) + cei non-finali; excludem doar Anulat/Contractat/Finalizat.
      where: { ownerId: userId, OR: [{ stadiu: null }, { stadiu: { notIn: FINAL } }] },
      select: { id: true, idLucrare: true, t1Locked: true },
      orderBy: { lastDetailAt: 'asc' },  // SQLite pune NULL primul în ASC → clienții ne-refreshed încă au prioritate
      ...(limit > 0 ? { take: limit } : {})
    });
    let processed = 0, updated = 0, errors = 0;
    for (const c of clienti) {
      try {
        const d = await fetchDetail(userId, c.idLucrare);
        const reminderText = await fetchUltimulReminderDeschis(userId, c.idLucrare);
        await prisma.client.update({
          where: { id: c.id },
          data: {
            suprafata: typeof d.suprafata === 'number' ? d.suprafata : undefined,
            hasAudio: d.hasAudio, stelutaCat: d.stelutaCat,
            t1: c.t1Locked ? undefined : (d.t1 || undefined),
            // FIX audit 2026-06-02: NU suprascrie stadiul cu gol când situația din gestcom e goală (păstrează valoarea manuală).
            stadiu: mapStadiu(d.situatie) || undefined, reminderText, observatii: d.observatii,
            lastDetailAt: new Date()
          }
        });
        updated++;
      } catch (e: any) { errors++; console.error('refreshDetails id=' + c.idLucrare, e?.message); }
      processed++;
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), processed, total: clienti.length } });
    return { ok: true as const, processed, updated, errors, total: clienti.length };
  } catch (e: any) {
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: e?.message } });
    return { ok: false as const, error: e?.message };
  }
}

/** Refresh DOAR remindere (ieftin-ish) pe clienți activi. */
export async function refreshRemindere(userId: string) {
  const run = await prisma.syncRun.create({ data: { userId, type: 'REMINDERS', status: 'RUNNING', startedAt: new Date() } });
  try {
    const clienti = await prisma.client.findMany({ where: { ownerId: userId, NOT: { stadiu: { in: FINAL } } }, select: { id: true, idLucrare: true } });
    let processed = 0, withReminder = 0;
    for (const c of clienti) {
      try {
        const txt = await fetchUltimulReminderDeschis(userId, c.idLucrare);
        await prisma.client.update({ where: { id: c.id }, data: { reminderText: txt || null } });
        if (txt) withReminder++;
      } catch { /* skip */ }
      processed++;
    }
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), processed, total: clienti.length } });
    return { ok: true as const, processed, withReminder, total: clienti.length };
  } catch (e: any) {
    await prisma.syncRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: e?.message } });
    return { ok: false as const, error: e?.message };
  }
}
