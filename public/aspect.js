/* ============================================================================
   AMASS — Motor de personalizare „Aspect" (live theming engine)
   Încărcat BLOCANT în <head> → aplică preferințele salvate înainte de prima
   pictură (fără FOUC). Expune window.Aspect pentru panoul de setări.
   Tot ce reglează utilizatorul = design tokens scrise pe <html>.
   NOTĂ: culorile steluței de prioritate NU sunt personalizabile (limbaj comun).
   ========================================================================== */
(function () {
  const LS_KEY = 'amass.aspect.v2';

  /* ---- Fonturi disponibile (UI + titlu) ---- */
  const FONTS = {
    ui: {
      'Inter':        "'Inter', system-ui, sans-serif",
      'IBM Plex Sans':"'IBM Plex Sans', system-ui, sans-serif",
      'Source Sans 3':"'Source Sans 3', system-ui, sans-serif",
      'System':       "system-ui, -apple-system, sans-serif",
    },
    display: {
      'Montserrat':   "'Montserrat', sans-serif",
      'Sora':         "'Sora', sans-serif",
      'Space Grotesk':"'Space Grotesk', sans-serif",
      'Inter':        "'Inter', sans-serif",
    },
  };

  /* ---- Trepte ---- */
  const TEXT_STEPS   = [0.875, 1.0, 1.125, 1.25, 1.5];        // Mic→Maxim (WCAG 200%)
  const TEXT_LABELS  = ['Mic', 'Normal', 'Mare', 'Foarte mare', 'Maxim'];
  const RADIUS_STEPS = [0, 4, 8, 12, 16];                      // px (--r-md)
  const RADIUS_LABELS= ['Drept', 'Subtil', 'Moderat', 'Rotund', 'Foarte rotund'];

  /* ---- Stadii: meta + culori implicite (rampă rece→cald→succes) ---- */
  const STAGES = [
    { key: 'intrare',    label: 'Intrare',     light: '#64748B', dark: '#7C8AA0', warn: 2,  late: 4 },
    { key: 't1',         label: 'T1',          light: '#0EA5E9', dark: '#38BDF8', warn: 3,  late: 7 },
    { key: 'schita',     label: 'Schiță',      light: '#6366F1', dark: '#818CF8', warn: 5,  late: 10 },
    { key: 'preofertat', label: 'Pre-ofertat', light: '#8B5CF6', dark: '#A78BFA', warn: 6,  late: 12 },
    { key: 'ofertat',    label: 'Ofertat',     light: '#E8870E', dark: '#F59E0B', warn: 10, late: 20 },
    { key: 'contractat', label: 'Contractat',  light: '#15A34A', dark: '#22C55E', warn: 14, late: 28 },
  ];
  const TERMINAL = [
    { key: 'amanat',     label: 'Amânat',      light: '#A16207', dark: '#CA8A04', warn: 30, late: 60 },
    { key: 'finalizat',  label: 'Finalizat',   light: '#0D9488', dark: '#2DD4BF', warn: 999, late: 999 },
    { key: 'anulat',     label: 'Anulat',      light: '#94A3B8', dark: '#64748B', warn: 999, late: 999 },
  ];
  const ALL_STAGES = [...STAGES, ...TERMINAL];
  const STAGE_MAP = {}; ALL_STAGES.forEach(s => STAGE_MAP[s.key] = s);

  /* ---- Prioritate: 5 CULORI fixe (universale, NEpersonalizabile) ---- */
  const PRIORITIES = [
    { key: 'rosu',       label: 'Urgent',   color: '#E11D2A', rank: 4 },
    { key: 'portocaliu', label: 'Ridicată', color: '#F97316', rank: 3 },
    { key: 'albastru',   label: 'Normală',  color: '#2563EB', rank: 2 },
    { key: 'verde',      label: 'Scăzută',  color: '#16A34A', rank: 1 },
    { key: 'alb',        label: 'Nesetat',  color: '#FFFFFF', rank: 0, outline: true },
  ];
  const PRIORITY_MAP = {}; PRIORITIES.forEach(p => PRIORITY_MAP[p.key] = p);

  /* ---- Preset-uri de brand ---- */
  const PRESETS = [
    { id: 'amass',  name: 'AMASS Roșu', accent: '#CC0000' },
    { id: 'ember',  name: 'Cărămidă',   accent: '#B0413E' },
    { id: 'pine',   name: 'Pin',        accent: '#2F6B5E' },
    { id: 'cobalt', name: 'Cobalt',     accent: '#2456C4' },
    { id: 'plum',   name: 'Prună',      accent: '#7C3AED' },
    { id: 'slate',  name: 'Ardezie',    accent: '#475569' },
  ];

  const DEFAULTS = {
    mode: 'light',            // light | dark | system
    accent: '#CC0000',
    fontUi: 'Inter',
    fontDisplay: 'Montserrat',
    radius: 2,                // index în RADIUS_STEPS
    density: 'normal',        // compact | normal | comfortable
    textSize: 1,              // index în TEXT_STEPS
    stages: {},               // override-uri de culoare per stadiu {key: hex}
    preset: 'amass',
  };

  /* ---- Color math (WCAG) ---- */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function relLum([r, g, b]) {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const [R, G, B] = [f(r), f(g), f(b)];
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  function contrast(a, b) {
    const la = relLum(hexToRgb(a)), lb = relLum(hexToRgb(b));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function onColor(bg) { return contrast(bg, '#FFFFFF') >= contrast(bg, '#15181B') ? '#FFFFFF' : '#15181B'; }
  function rate(ratio) { return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA mare' : 'slab'; }

  function resolveMode(m) {
    if (m === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return m;
  }

  let state = load();

  function load() {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s) return { ...DEFAULTS, ...s, stages: { ...s.stages } }; }
    catch (e) {}
    return { ...DEFAULTS };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

  const subs = new Set();

  function apply() {
    const root = document.documentElement;
    const mode = resolveMode(state.mode);
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-density', state.density);

    // Accent + derivat
    root.style.setProperty('--accent', state.accent);
    root.style.setProperty('--on-accent', onColor(state.accent));

    // Text scale + radius
    root.style.setProperty('--text-scale', TEXT_STEPS[state.textSize]);
    const rb = RADIUS_STEPS[state.radius];
    root.style.setProperty('--r-md', rb + 'px');
    root.style.setProperty('--r-sm', Math.round(rb * 0.6) + 'px');
    root.style.setProperty('--r-lg', Math.round(rb * 1.6) + 'px');
    root.style.setProperty('--r-xs', Math.round(rb * 0.35) + 'px');

    // Fonturi
    root.style.setProperty('--font-ui', FONTS.ui[state.fontUi] || FONTS.ui['Inter']);
    root.style.setProperty('--font-display', FONTS.display[state.fontDisplay] || FONTS.display['Montserrat']);

    // Culori stadii (implicit din temă, override din state.stages)
    ALL_STAGES.forEach(s => {
      const custom = state.stages[s.key];
      root.style.setProperty('--st-' + s.key, custom || (mode === 'dark' ? s.dark : s.light));
    });

    subs.forEach(fn => fn(state));
  }

  // re-aplică la schimbarea temei sistemului
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.mode === 'system') apply(); });
  } catch (e) {}

  window.Aspect = {
    FONTS, TEXT_STEPS, TEXT_LABELS, RADIUS_STEPS, RADIUS_LABELS,
    STAGES, TERMINAL, ALL_STAGES, STAGE_MAP, PRIORITIES, PRIORITY_MAP, PRESETS, DEFAULTS,
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; save(); apply(); },
    setStage: (key, hex) => { state = { ...state, stages: { ...state.stages, [key]: hex } }; save(); apply(); },
    resetStage: (key) => { const st = { ...state.stages }; delete st[key]; state = { ...state, stages: st }; save(); apply(); },
    reset: () => { state = { ...DEFAULTS, stages: {} }; save(); apply(); },
    apply,
    contrast, onColor, rate, resolveMode,
    stageColor: (key) => state.stages[key] || (resolveMode(state.mode) === 'dark' ? STAGE_MAP[key].dark : STAGE_MAP[key].light),
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };

  apply(); // prima aplicare, înainte de body paint
})();
