'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriorityStars } from '@/components/ui';
import { deriveStage } from '@/lib/stage-rules';

// Kanban = a TREIA vizualizare a pâlniei (drag & drop). Trăiește în pagina /palnie,
// nu mai e o pagină separată „Pipeline" — aceleași date, doar alt mod de afișare.
export interface KanbanClient {
  id: string; idLucrare: string; nume: string; localitate: string | null;
  suprafata: number | null; dataIntrare: string | null;
  t1: string | null; schitaStatus: string | null; preOfertat: string | null;
  ofertat: string | null; stadiu: string | null; stelutaCat: number; reminderText: string | null;
  nextStepDue?: string | null; nextStepText?: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
}

const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };
const nz = (v: any) => !!(v && String(v).trim());
// Pipeline-ul lui Radu: Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat
// (+ stări laterale: Amânat, Finalizat, Anulat). Drag-ul setează câmpurile etapei-țintă.
const COLS: Array<{ key: string; label: string; color: string; terminal?: boolean; patch: () => any }> = [
  { key: 'intrare',     label: 'Intrare',      color: 'var(--fg-faint)',  patch: () => ({ t1: '', t1Locked: false, schitaStatus: '', preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 't1',          label: 'T1',           color: '#6b8a9e',          patch: () => ({ t1: today(), t1Locked: true, schitaStatus: '', preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 'schita',      label: 'Schiță',       color: '#c98a2b',          patch: () => ({ schitaStatus: today(), preOfertat: '', ofertat: '', stadiu: '' }) },
  { key: 'preofertat',  label: 'Pre-ofertat',  color: '#e07a2e',          patch: () => ({ preOfertat: today(), ofertat: '', stadiu: '' }) },
  { key: 'ofertat',     label: 'Ofertat',      color: 'var(--ember)',     patch: () => ({ ofertat: today(), stadiu: '' }) },
  { key: 'amanat',      label: 'Amânat',       color: 'var(--warn)',      patch: () => ({ stadiu: 'Amanat' }) },           // păstrează datele de etapă
  { key: 'contractat',  label: 'Contractat',   color: 'var(--pine)',      terminal: true, patch: () => ({ stadiu: 'Contractat' }) },
  { key: 'finalizat',   label: 'Finalizat',    color: '#2f7d52',          terminal: true, patch: () => ({ stadiu: 'Finalizat' }) },
  { key: 'anulat',      label: 'Anulat',       color: 'var(--err)',       terminal: true, patch: () => ({ stadiu: 'Anulat' }) },
];
const stageOf = deriveStage; // sursă unică de adevăr (lib/stage-rules)
function parseRO(s: string | null): Date | null { const m = s && String(s).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
function ageDays(c: KanbanClient): number | null {
  const ref = parseRO(c.ofertat) || parseRO(c.preOfertat) || parseRO(c.schitaStatus) || (c.dataIntrare ? new Date(c.dataIntrare) : null);
  return ref ? Math.floor((Date.now() - ref.getTime()) / 86400000) : null;
}
function ageBadge(d: number | null): { c: string; t: string } | null {
  if (d == null || d <= 7) return null;
  if (d <= 14) return { c: '#c98a2b', t: d + 'z' };
  if (d <= 25) return { c: '#e07a2e', t: d + 'z' };
  return { c: 'var(--err)', t: d + 'z' };
}

interface Props {
  clienti: KanbanClient[];
  isManager: boolean;
  ownerFilter: string;
  onPatch: (id: string, patch: Record<string, any>) => void; // update optimist local (în pagina părinte)
  setMsg: (m: string) => void;
  reload: () => void;
}

export function KanbanBoard({ clienti, isManager, ownerFilter, onPatch, setMsg, reload }: Props) {
  const router = useRouter();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [closeModal, setCloseModal] = useState<{ id: string; colKey: string } | null>(null);
  const [nextStepModal, setNextStepModal] = useState<{ id: string; colKey: string } | null>(null);

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
    if (colKey === 'contractat' && cur && !nz(cur.ofertat)) patch.ofertat = today();
    onPatch(id, patch); // optimist
    setMsg(`⏳ Mut în „${col.label}"…`);
    const r = await fetch(`/api/clienti/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setMsg(`✅ Mutat în „${col.label}" (sincronizat în CRM)`);
    else { setMsg('❌ ' + (j.validationErrors?.length ? j.validationErrors.join(' ') : (j.error || 'Eroare la mutare'))); reload(); }
  }

  const byCol: Record<string, KanbanClient[]> = {};
  COLS.forEach(c => byCol[c.key] = []);
  clienti.forEach(c => byCol[stageOf(c)].push(c));
  // sortare în coloană: „rotting" (cele mai vechi în stadiu) sus → prioritate → suprafață
  COLS.forEach(col => byCol[col.key].sort((a, b) => {
    const ad = ageDays(a) ?? -1, bd = ageDays(b) ?? -1;
    if (bd !== ad) return bd - ad;
    if (b.stelutaCat !== a.stelutaCat) return b.stelutaCat - a.stelutaCat;
    return (b.suprafata || 0) - (a.suprafata || 0);
  }));
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <div className="flex gap-3 overflow-x-auto scroll-area pb-3 rise" style={{ minHeight: '60vh' }}>
        {COLS.map(col => {
          const cards = byCol[col.key];
          const mp = cards.reduce((s, c) => s + (c.suprafata || 0), 0);
          return (
            <div key={col.key}
                 onDragOver={e => { e.preventDefault(); setOver(col.key); }}
                 onDragLeave={() => setOver(o => o === col.key ? null : o)}
                 onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); setDrag(null); if (id && stageOf(clienti.find(c => c.id === id)!) !== col.key) requestMove(id, col.key); }}
                 className="flex-shrink-0 w-[270px] rounded-[var(--radius)] transition-colors"
                 style={{ background: over === col.key ? 'var(--ember-soft)' : 'var(--paper)', border: '1px solid var(--line)' }}>
              <div className="px-3 py-2.5 sticky top-0 z-10 rounded-t-[var(--radius)]" style={{ background: 'var(--card)', borderBottom: '2px solid ' + col.color }}>
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-[14px]" style={{ color: col.color }}>{col.label}</span>
                  <span className="pill pill-lucru !py-0.5 tabular">{cards.length}</span>
                </div>
                <div className="text-[10.5px] text-[var(--fg-faint)] tabular mt-0.5">{mp.toLocaleString('ro-RO')} mp{cards.length ? ' · ~' + Math.round(mp * 50).toLocaleString('ro-RO') + ' €' : ''}</div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto scroll-area" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                {cards.map(c => (
                  <div key={c.id} draggable
                       onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; setDrag(c.id); }}
                       onDragEnd={() => { setDrag(null); setOver(null); }}
                       onClick={() => router.push('/strategie/' + c.id)}
                       className="card p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--line-2)]"
                       style={{ opacity: drag === c.id ? 0.4 : 1, borderLeft: '3px solid ' + col.color }}
                       title="Trage pentru a schimba stadiul · click pentru fișă">
                    <div className="font-display font-semibold text-[13px] leading-tight">{c.nume || '(fără nume)'}</div>
                    <div className="text-[10.5px] text-[var(--fg-faint)] font-mono mt-0.5">
                      {c.localitate ? c.localitate + ' · ' : ''}{c.suprafata != null ? c.suprafata + ' mp' : ''} · #{c.idLucrare}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 gap-1" onClick={stop}>
                      <span title="Prioritate (live în CRM)"><PriorityStars value={c.stelutaCat} readOnly size={13} /></span>
                      <div className="flex items-center gap-1">
                        {!col.terminal && (() => { const b = ageBadge(ageDays(c)); return b ? <span className="text-[9px] font-bold tabular px-1 rounded" style={{ color: b.c, border: '1px solid ' + b.c }} title="Zile în stadiu (deal care îmbătrânește)">{b.t}</span> : null; })()}
                        {isManager && ownerFilter === 'all' && c.owner && <span className="pill pill-lucru !py-0 !px-1.5 !text-[9px]">{c.owner.name || c.owner.email}</span>}
                      </div>
                    </div>
                    {c.reminderText && <div className="text-[10.5px] text-[var(--fg-soft)] mt-1.5 pt-1.5 border-t border-[var(--line)] line-clamp-2">⏰ {c.reminderText}</div>}
                  </div>
                ))}
                {cards.length === 0 && <div className="text-center text-[11px] text-[var(--fg-faint)] py-6">— gol —</div>}
              </div>
            </div>
          );
        })}
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
    </>
  );
}

const WON_REASONS = ['ROI clar', 'Buget aprobat', 'Urgență (sezon)', 'Recomandare', 'Preț competitiv', 'Altul'];
const LOST_REASONS = ['Preț prea mare', 'A ales concurența', 'Fără decizie / amânat', 'Fără urgență', 'Buget tăiat', 'Necontactabil', 'Altul'];

function WinLossModal({ colKey, onConfirm, onClose }: { colKey: string; onConfirm: (detail: string) => void; onClose: () => void }) {
  const won = colKey === 'contractat';
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const [sel, setSel] = useState(reasons[0]);
  const [free, setFree] = useState('');
  const canConfirm = sel !== 'Altul' || !!free.trim();
  const confirm = () => { if (canConfirm) onConfirm(sel === 'Altul' ? free.trim() : sel); };
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{won ? '✅ Contractat — de ce a câștigat?' : '❌ Anulat — de ce s-a pierdut?'}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">Motivul intră în raportul de win/loss (coaching).</p>
        <div className="space-y-1.5 mb-4">
          {reasons.map(r => (
            <label key={r} className={'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] border cursor-pointer text-[13px] ' + (sel === r ? 'border-[var(--ember)] bg-[var(--ember-soft)] font-semibold' : 'border-[var(--line-2)]')}>
              <input type="radio" name="reason" checked={sel === r} onChange={() => setSel(r)} />{r}
            </label>
          ))}
          {sel === 'Altul' && (
            <textarea className="field w-full mt-1" rows={3} autoFocus value={free}
              onChange={e => setFree(e.target.value)} placeholder={won ? 'Scrie motivul concret al câștigului…' : 'Scrie motivul concret al pierderii…'} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">Anulează</button>
          <button onClick={confirm} disabled={!canConfirm}
            className={'btn ' + (won ? 'btn-pine' : 'btn-primary') + (canConfirm ? '' : ' opacity-50 pointer-events-none')}>Confirmă</button>
        </div>
      </div>
    </div>
  );
}

function NextStepModal({ onConfirm, onClose }: { onConfirm: (text: string, due: string) => void; onClose: () => void }) {
  const isoIn = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const [text, setText] = useState('');
  const [due, setDue] = useState(isoIn(3));
  const canConfirm = !!text.trim() && !!due;
  const confirm = () => { if (canConfirm) onConfirm(text.trim(), due); };
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">📤 Ofertat — care e pasul următor?</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">Setează un follow-up clar ca oferta să nu rămână fără urmărire.</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[12px] text-[var(--fg-soft)] mb-1">Pas următor</label>
            <textarea className="field w-full" rows={3} autoFocus value={text}
              onChange={e => setText(e.target.value)} placeholder="Ex: Sun pentru confirmarea ofertei și negociere preț" />
          </div>
          <div>
            <label className="block text-[12px] text-[var(--fg-soft)] mb-1">Scadența</label>
            <input type="date" className="field w-full" value={due} onChange={e => setDue(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">Anulează</button>
          <button onClick={confirm} disabled={!canConfirm}
            className={'btn btn-primary' + (canConfirm ? '' : ' opacity-50 pointer-events-none')}>Confirmă</button>
        </div>
      </div>
    </div>
  );
}
