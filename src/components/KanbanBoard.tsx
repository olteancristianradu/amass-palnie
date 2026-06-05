'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { PriorityStar, RotText } from '@/components/indicators';
import { AudioReminder } from '@/components/ui';
import { stelutaToPrio } from '@/lib/aspect-meta';
import { deriveStage } from '@/lib/stage-rules';
import { useT } from '@/lib/i18n';

// Kanban = a TREIA vizualizare a pâlniei (drag & drop). Trăiește în pagina /palnie,
// nu mai e o pagină separată „Pipeline" — aceleași date, doar alt mod de afișare.
export interface KanbanClient {
  id: string; idLucrare: string; nume: string; localitate: string | null;
  suprafata: number | null; dataIntrare: string | null;
  t1: string | null; schitaStatus: string | null; preOfertat: string | null;
  ofertat: string | null; stadiu: string | null; stelutaCat: number; reminderText: string | null;
  nextStepDue?: string | null; nextStepText?: string | null;
  hasAudio?: boolean; observatii?: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
}

const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const nz = (v: any) => !!(v && String(v).trim());
// Pipeline-ul lui Radu: Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat
// (+ stări laterale: Amânat, Finalizat, Anulat). Drag-ul setează câmpurile etapei-țintă.
const COLS: Array<{ key: string; label: string; color: string; terminal?: boolean; patch: () => any }> = [
  // FIX 2026-06-04 (paritate design C1): culorile coloanelor = tokenii de stadiu --st-* (rampa
  // rece→cald slate→sky→indigo→violet→amber→green), aceiași folosiți de StagePill în Carduri/Tabel/
  // Dashboard. Înainte erau hardcodate cu o rampă caldă (ofertat = var(--ember)/roșu de brand) →
  // inconsistent cu restul aplicației și cu designul (pa-kanban.jsx folosește var(--st-{stage})).
  { key: 'intrare',     label: 'Intrare',      color: 'var(--st-intrare)',     patch: () => ({ t1: '', t1Locked: false, schitaStatus: '', preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 't1',          label: 'T1',           color: 'var(--st-t1)',          patch: () => ({ t1: today(), t1Locked: true, schitaStatus: '', preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 'schita',      label: 'Schiță',       color: 'var(--st-schita)',      patch: () => ({ schitaStatus: today(), preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 'preofertat',  label: 'Pre-ofertat',  color: 'var(--st-preofertat)',  patch: () => ({ preOfertat: today(), ofertat: '', stadiu: '' }) },
  { key: 'ofertat',     label: 'Ofertat',      color: 'var(--st-ofertat)',     patch: () => ({ ofertat: today(), stadiu: '' }) },
  { key: 'amanat',      label: 'Amânat',       color: 'var(--st-amanat)',      patch: () => ({ stadiu: 'Amanat' }) },           // păstrează datele de etapă
  { key: 'contractat',  label: 'Contractat',   color: 'var(--st-contractat)',  terminal: true, patch: () => ({ stadiu: 'Contractat' }) },
  { key: 'finalizat',   label: 'Finalizat',    color: 'var(--st-finalizat)',   terminal: true, patch: () => ({ stadiu: 'Finalizat' }) },
  { key: 'anulat',      label: 'Anulat',       color: 'var(--st-anulat)',      terminal: true, patch: () => ({ stadiu: 'Anulat' }) },
];
const stageOf = deriveStage; // sursă unică de adevăr (lib/stage-rules)
// Motorul de teme e încărcat global (public/aspect.js → window.Aspect). Acces guardat
// identic cu src/app/aspect/page.tsx (citit înainte de implementare).
const A = () => (typeof window !== 'undefined' ? (window as any).Aspect : null);
// FEATURE A (paritate design pa-kanban.jsx): coloanele PRINCIPALE vizibile implicit;
// stadiile finale (Amânat / Finalizat / Anulat) sunt ascunse în spatele unui buton „Stadii finale".
const MAIN_KEYS = ['intrare', 't1', 'schita', 'preofertat', 'ofertat', 'contractat'];
function parseRO(s: string | null): Date | null { const m = s && String(s).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
function ageDays(c: KanbanClient): number | null {
  const ref = parseRO(c.ofertat) || parseRO(c.preOfertat) || parseRO(c.schitaStatus) || (c.dataIntrare ? new Date(c.dataIntrare) : null);
  return ref ? Math.floor((Date.now() - ref.getTime()) / 86400000) : null;
}

interface Props {
  clienti: KanbanClient[];
  isManager: boolean;
  ownerFilter: string;
  onPatch: (id: string, patch: Record<string, any>) => void; // update optimist local (în pagina părinte)
  setMsg: (m: string) => void;
  reload: () => void;
  sortKey?: string; // sortarea globală aleasă în panou (data-desc/asc, supr-*, prio-desc, nume-asc, etapa)
}

export function KanbanBoard({ clienti, isManager, ownerFilter, onPatch, setMsg, reload, sortKey }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [closeModal, setCloseModal] = useState<{ id: string; colKey: string } | null>(null);
  const [nextStepModal, setNextStepModal] = useState<{ id: string; colKey: string } | null>(null);
  // FEATURE A: dezvăluie stadiile finale; FEATURE B: ce coloană are popover-ul de culoare deschis.
  const [showTerminal, setShowTerminal] = useState(false);
  const [editColor, setEditColor] = useState<string | null>(null);
  // FEATURE C: meniul „mută în stadiu…" (poziție ancorată) pentru un card.
  const [moveFor, setMoveFor] = useState<{ id: string; x: number; y: number } | null>(null);
  // Re-randare la schimbarea culorilor de stadiu (window.Aspect.subscribe), ca în pagina /aspect.
  const [, force] = useState(0);
  useEffect(() => { const a = A(); return a ? a.subscribe(() => force(x => x + 1)) : undefined; }, []);

  // Închiderea (Contractat/Anulat) cere întâi motivul (win/loss);
  // mutarea în „Ofertat" cere pasul următor + scadența (cerință blocantă în stage-rules);
  // restul se mută direct.
  function requestMove(id: string, colKey: string) {
    if (colKey === 'contractat' || colKey === 'anulat') { setCloseModal({ id, colKey }); return; }
    if (colKey === 'ofertat') {
      const cur = clienti.find(c => c.id === id);
      if (!cur?.nextStepDue) { setNextStepModal({ id, colKey }); return; }
    }
    doMove(id, colKey, {});
  }
  async function doMove(id: string, colKey: string, extra: any) {
    const col = COLS.find(c => c.key === colKey)!;
    const patch: any = { ...col.patch(), ...extra };
    const cur = clienti.find(c => c.id === id);
    // FIX 2026-06-05 (DATA LOSS — mutare ÎNAPOI): patch-urile coloanelor timpurii pun explicit ''
    // pe câmpurile de dată ale etapelor ulterioare (ex. T1 → schitaStatus/preOfertat/ofertat = '').
    // La o mutare înapoi (din Schiță în T1) asta ștergea ireversibil datele etapelor deja
    // înregistrate. Invariant pe frontend: o mutare înapoi schimbă DOAR stadiul vizibil, fără a
    // pune null/'' peste câmpuri de dată non-empty. Mutarea înainte își păstrează comportamentul
    // legitim (setarea automată a datei etapei-țintă). Detectăm direcția prin ordinea COLS.
    const STAGE_DATE_FIELDS = ['t1', 'schitaStatus', 'preOfertat', 'ofertat'] as const;
    const curStage = cur ? stageOf(cur) : null;
    const fromIdx = curStage ? COLS.findIndex(c => c.key === curStage) : -1;
    const toIdx = COLS.findIndex(c => c.key === colKey);
    const isBackward = fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx;
    if (isBackward && cur) {
      // Nu rescrie peste câmpurile de dată deja completate: scoatem din patch orice cheie de etapă
      // pe care patch-ul ar goli-o (''), dar care are deja o valoare în clientul curent.
      for (const f of STAGE_DATE_FIELDS) {
        if (f in patch && !nz(patch[f]) && nz((cur as any)[f])) delete patch[f];
      }
    }
    if (colKey === 'contractat' && cur && !nz(cur.ofertat)) patch.ofertat = today();
    onPatch(id, patch); // optimist
    setMsg(`⏳ ${t('Mut în')} „${t(col.label)}"…`);
    const r = await fetch(`/api/clienti/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setMsg(`✅ ${t('Mutat în')} „${t(col.label)}" ${t('(sincronizat în CRM)')}`);
    else { setMsg('❌ ' + (j.validationErrors?.length ? j.validationErrors.join(' ') : (j.error || t('Eroare la mutare')))); reload(); }
  }

  const byCol: Record<string, KanbanClient[]> = {};
  COLS.forEach(c => byCol[c.key] = []);
  clienti.forEach(c => byCol[stageOf(c)].push(c));
  // sortare în coloană: RESPECTĂ sortarea GLOBALĂ din panou (inclusiv „dată intrare", care înainte nu se
  // aplica în kanban). Default / „etapa" = „rotting" (cele mai vechi în stadiu) sus → prioritate → suprafață.
  const parseD = (s: string | null) => (s ? new Date(s).getTime() : 0);
  COLS.forEach(col => byCol[col.key].sort((a, b) => {
    switch (sortKey) {
      case 'data-desc': return parseD(b.dataIntrare) - parseD(a.dataIntrare); // dată intrare: noi → vechi
      case 'data-asc':  return parseD(a.dataIntrare) - parseD(b.dataIntrare); // dată intrare: vechi → noi
      case 'supr-desc': return (b.suprafata || 0) - (a.suprafata || 0);
      case 'supr-asc':  return (a.suprafata || 0) - (b.suprafata || 0);
      case 'prio-desc': return (b.stelutaCat || 0) - (a.stelutaCat || 0);
      case 'nume-asc':  return (a.nume || '').localeCompare(b.nume || '', 'ro', { sensitivity: 'base' });
      default: {
        const ad = ageDays(a) ?? -1, bd = ageDays(b) ?? -1;
        if (bd !== ad) return bd - ad;
        if (b.stelutaCat !== a.stelutaCat) return b.stelutaCat - a.stelutaCat;
        return (b.suprafata || 0) - (a.suprafata || 0);
      }
    }
  }));
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // FEATURE A: implicit doar coloanele principale; stadiile finale apar la cerere.
  const visibleCols = showTerminal ? COLS : COLS.filter(c => MAIN_KEYS.includes(c.key));

  return (
    <>
      <div className="kanban-wrap scroll-thin rise">
        <div className="kanban">
          {visibleCols.map(col => {
            const cards = byCol[col.key];
            return (
              <section key={col.key}
                   onDragOver={e => { e.preventDefault(); setOver(col.key); }}
                   onDragLeave={() => setOver(o => o === col.key ? null : o)}
                   onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); setDrag(null); if (id && stageOf(clienti.find(c => c.id === id)!) !== col.key) requestMove(id, col.key); }}
                   className={'kcol' + (over === col.key ? ' is-over' : '')}
                   style={{ '--sc': col.color } as React.CSSProperties}>
                {/* Antet coloană (nume + count) — paritate pa-kanban.jsx: un singur text „{n} clienți" */}
                <header className="kcol__head">
                  <span className="kcol__bar" />
                  <div className="kcol__title">
                    <span className="kcol__name" style={{ color: col.color }}>{t(col.label)}</span>
                    {/* FEATURE B: editor de culoare per stadiu (window.Aspect) */}
                    <button className="kcol__edit" title={t('Editează culoarea stadiului')}
                      onClick={() => setEditColor(editColor === col.key ? null : col.key)}>
                      <Icon name="palette" size={13} />
                    </button>
                  </div>
                  <div className="kcol__stats">
                    <span className="kcol__count">{cards.length} {cards.length === 1 ? t('client') : t('clienți')}</span>
                  </div>
                  {editColor === col.key && <StageColorEdit stage={col.key} onClose={() => setEditColor(null)} />}
                </header>
                <div className="kcol__list scroll-thin">
                  {cards.map(c => (
                    <article key={c.id} draggable
                         onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDrag(c.id); }}
                         onDragEnd={() => { setDrag(null); setOver(null); }}
                         onClick={() => router.push('/strategie/' + c.id)}
                         className={'kc' + (drag === c.id ? ' is-dragging' : '')}
                         style={{ '--sc': col.color } as React.CSSProperties}
                         title={t('Trage pentru a schimba stadiul · click pentru fișă')}>
                      <span className="kc__handle" title={t('Trage')}><Icon name="grip" size={14} /></span>
                      <div className="kc__body">
                        <div className="kc__top">
                          <span className="kc__name">{c.nume || t('(fără nume)')}</span>
                          <span onClick={stop} title={t('Prioritate (live în CRM)')}><PriorityStar value={stelutaToPrio(c.stelutaCat)} size={16} /></span>
                        </div>
                        {/* Meta card — paritate pa-kanban.jsx: localitate (pin) + suprafață, necondiționat */}
                        <div className="kc__meta">
                          <span><Icon name="pin" size={11} />{c.localitate}</span>
                          <span className="mono">{c.suprafata} mp</span>
                        </div>
                        {/* Footer card — paritate pa-kanban.jsx: AudioReminder → RotText → buton mutare, necondiționat */}
                        <div className="kc__foot">
                          <span onClick={stop}><AudioReminder client={{ audio: !!c.hasAudio, obs: !!(c.observatii && String(c.observatii).trim()), reminder: c.reminderText, reminderWhen: null }} compact /></span>
                          <span style={{ marginLeft: 'auto' }}><RotText stage={col.key} days={ageDays(c) ?? 0} /></span>
                          {/* FEATURE C: mutare fără drag — trece prin ACEEAȘI poartă requestMove (modale win/loss + pas următor) */}
                          <button className="kc__move" title={t('Mută în stadiu…')}
                            onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMoveFor({ id: c.id, x: r.right, y: r.bottom }); }}>
                            <Icon name="swap" size={13} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {cards.length === 0 && <div className="kcol__empty">{t('— gol —')}</div>}
                </div>
              </section>
            );
          })}
          {/* FEATURE A: buton de dezvăluire a stadiilor finale (Amânat / Finalizat / Anulat) */}
          {!showTerminal && (
            <button className="kcol-add" onClick={() => setShowTerminal(true)} title={t('Arată Amânat / Finalizat / Anulat')}>
              <Icon name="chevR" size={16} /><span>{t('Stadii')}<br />{t('finale')}</span>
            </button>
          )}
        </div>
      </div>
      {closeModal && (
        <WinLossModal colKey={closeModal.colKey}
          onClose={() => setCloseModal(null)}
          onConfirm={(detail) => {
            const reason = closeModal.colKey === 'contractat' ? 'Won' : 'Lost';
            doMove(closeModal.id, closeModal.colKey, { closureReason: reason, closureReasonDetail: detail });
            setCloseModal(null);
          }} />
      )}
      {nextStepModal && (
        <NextStepModal
          onClose={() => setNextStepModal(null)}
          onConfirm={(text, due) => {
            doMove(nextStepModal.id, nextStepModal.colKey, { nextStepText: text, nextStepDue: due });
            setNextStepModal(null);
          }} />
      )}
      {/* FEATURE C: meniul „mută în stadiu…" — rutează prin requestMove (păstrează modalele win/loss + pas următor) */}
      {moveFor && clienti.some(c => c.id === moveFor.id) && (
        <MoveMenu current={stageOf(clienti.find(c => c.id === moveFor.id)!)} x={moveFor.x} y={moveFor.y}
          onPick={(key) => { const cur = clienti.find(c => c.id === moveFor.id); setMoveFor(null); if (cur && key !== stageOf(cur)) requestMove(moveFor.id, key); }}
          onClose={() => setMoveFor(null)} />
      )}
    </>
  );
}

const WON_REASONS = ['ROI clar', 'Buget aprobat', 'Urgență (sezon)', 'Recomandare', 'Preț competitiv', 'Altul'];
const LOST_REASONS = ['Preț prea mare', 'A ales concurența', 'Fără decizie / amânat', 'Fără urgență', 'Buget tăiat', 'Necontactabil', 'Altul'];

function WinLossModal({ colKey, onConfirm, onClose }: { colKey: string; onConfirm: (detail: string) => void; onClose: () => void }) {
  const { t } = useT();
  const won = colKey === 'contractat';
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const [sel, setSel] = useState(reasons[0]);
  const [free, setFree] = useState('');
  const canConfirm = sel !== 'Altul' || !!free.trim();
  const confirm = () => { if (canConfirm) onConfirm(sel === 'Altul' ? free.trim() : sel); };
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{won ? t('✅ Contractat — de ce a câștigat?') : t('❌ Anulat — de ce s-a pierdut?')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Motivul intră în raportul de win/loss (coaching).')}</p>
        <div className="space-y-1.5 mb-4">
          {reasons.map(r => (
            <label key={r} className={'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] border cursor-pointer text-[13px] ' + (sel === r ? 'border-[var(--ember)] bg-[var(--ember-soft)] font-semibold' : 'border-[var(--line-2)]')}>
              <input type="radio" name="reason" checked={sel === r} onChange={() => setSel(r)} />{t(r)}
            </label>
          ))}
          {sel === 'Altul' && (
            <textarea className="field w-full mt-1" rows={3} autoFocus value={free}
              onChange={e => setFree(e.target.value)} placeholder={won ? t('Scrie motivul concret al câștigului…') : t('Scrie motivul concret al pierderii…')} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={confirm} disabled={!canConfirm}
            className={'btn ' + (won ? 'btn-pine' : 'btn-primary') + (canConfirm ? '' : ' opacity-50 pointer-events-none')}>{t('Confirmă')}</button>
        </div>
      </div>
    </div>
  );
}

function NextStepModal({ onConfirm, onClose }: { onConfirm: (text: string, due: string) => void; onClose: () => void }) {
  const { t } = useT();
  const isoIn = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const [text, setText] = useState('');
  const [due, setDue] = useState(isoIn(3));
  const canConfirm = !!text.trim() && !!due;
  const confirm = () => { if (canConfirm) onConfirm(text.trim(), due); };
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{t('📤 Ofertat — care e pasul următor?')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Setează un follow-up clar ca oferta să nu rămână fără urmărire.')}</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[12px] text-[var(--fg-soft)] mb-1">{t('Pas următor')}</label>
            <textarea className="field w-full" rows={3} autoFocus value={text}
              onChange={e => setText(e.target.value)} placeholder={t('Ex: Sun pentru confirmarea ofertei și negociere preț')} />
          </div>
          <div>
            <label className="block text-[12px] text-[var(--fg-soft)] mb-1">{t('Scadența')}</label>
            <input type="date" className="field w-full" value={due} onChange={e => setDue(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={confirm} disabled={!canConfirm}
            className={'btn btn-primary' + (canConfirm ? '' : ' opacity-50 pointer-events-none')}>{t('Confirmă')}</button>
        </div>
      </div>
    </div>
  );
}

// FEATURE B (paritate design pa-kanban.jsx StageColorEdit): editor de culoare per stadiu.
// Scrie în motorul global window.Aspect (stageColor/setStage/resetStage), exact ca pagina /aspect;
// re-randarea board-ului vine din window.Aspect.subscribe (vezi useEffect din KanbanBoard).
const STAGE_SWATCHES = ['#64748B', '#0EA5E9', '#6366F1', '#8B5CF6', '#E8870E', '#15A34A', '#0D9488', '#A16207', '#DC2626', '#DB2777', '#0891B2', '#7C3AED'];
function StageColorEdit({ stage, onClose }: { stage: string; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const a = A();
  const cur: string = (a?.stageColor?.(stage)) || '#64748B';
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="stage-edit" ref={ref} onClick={e => e.stopPropagation()}>
      <div className="label" style={{ marginBottom: 6 }}>{t('Culoare stadiu')}</div>
      <div className="stage-edit__grid">
        {STAGE_SWATCHES.map(c => (
          <button key={c} className={'stage-edit__sw' + (c.toLowerCase() === cur.toLowerCase() ? ' is-on' : '')}
            style={{ background: c }} onClick={() => a?.setStage?.(stage, c)} />
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input type="color" className="stage-edit__picker" value={cur} onChange={e => a?.setStage?.(stage, e.target.value)} />
        <button className="btn btn-ghost btn-sm" onClick={() => a?.resetStage?.(stage)}>
          <Icon name="reset" size={13} />{t('Implicit')}
        </button>
      </div>
    </div>
  );
}

// FEATURE C (paritate design pa-kanban.jsx MoveMenu): listă de stadii, alternativă la drag.
// `onPick` rutează în KanbanBoard prin requestMove → aceleași porți (win/loss, pas următor).
function MoveMenu({ current, x, y, onPick, onClose }: { current: string; x: number; y: number; onPick: (key: string) => void; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]); // FIX 2026-06-05: onClose în deps — evită stale closure pe callback-ul de închidere
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 200 : 1000;
  return (
    <div className="pop-anchor" style={{ left: Math.min(x, maxX), top: y + 4 }}>
      <div className="move-menu" ref={ref}>
        <div className="label" style={{ padding: '4px 10px 6px' }}>{t('Mută în stadiu…')}</div>
        {COLS.map(s => (
          <button key={s.key} className={'move-menu__item' + (s.key === current ? ' is-cur' : '')}
            disabled={s.key === current} onClick={() => onPick(s.key)}>
            <span className="move-menu__dot" style={{ background: s.color }} />{t(s.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
