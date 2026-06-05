/* ============================================================================
   AMASS — Motor de personalizare „Aspect" (live theming engine)
   Încărcat BLOCANT în <head> → aplică preferințele salvate înainte de prima
   pictură (fără FOUC). Expune window.Aspect pentru panoul de setări.
   Tot ce reglează utilizatorul = design tokens scrise pe <html>.
   NOTĂ: culorile steluței de prioritate NU sunt personalizabile (limbaj comun).
   ========================================================================== */
(function () {
  const LS_BASE = 'amass.aspect.v2';
  // Namespace per-utilizator: cheia LS devine „amass.aspect.v2.{USER}".
  // USER se citește din 'amass.currentUser' (scris de app la login via Aspect.setUser).
  // LIMITARE: aspect.js e încărcat înainte de hidratarea React, deci ID-ul autentificat nu
  // e disponibil fiabil dintr-un cookie HttpOnly la acest moment (nu avem acces la el în JS).
  // Strategie conservatoare: la boot citim valoarea anterioară salvată de aceeași sesiune;
  // app-ul TREBUIE să cheme `Aspect.setUser(userId)` imediat după autentificare (sau la mount).
  // Dacă nu există, fallback la 'default' — toți userii neautentificați împart același slot.
  let USER = (function () { try { return localStorage.getItem('amass.currentUser') || 'default'; } catch (e) { return 'default'; } })();
  function lsKey() { return LS_BASE + '.' + USER; }

  /* ---- Fonturi disponibile (UI + titlu) ---- */
  const FONTS = {
    ui: {
      'San Francisco (Apple)': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      'Inter':        "'Inter', system-ui, sans-serif",
      'Roboto':       "'Roboto', system-ui, sans-serif",
      'Open Sans':    "'Open Sans', system-ui, sans-serif",
      'Lato':         "'Lato', system-ui, sans-serif",
      'Poppins':      "'Poppins', system-ui, sans-serif",
      'Montserrat':   "'Montserrat', system-ui, sans-serif",
      'Noto Sans':    "'Noto Sans', system-ui, sans-serif",
      'Nunito':       "'Nunito', system-ui, sans-serif",
      'Raleway':      "'Raleway', system-ui, sans-serif",
      'IBM Plex Sans':"'IBM Plex Sans', system-ui, sans-serif",
      'Source Sans 3':"'Source Sans 3', system-ui, sans-serif",
      'Work Sans':    "'Work Sans', system-ui, sans-serif",
      'Nunito Sans':  "'Nunito Sans', system-ui, sans-serif",
      'Atkinson (dislexie)': "'Atkinson Hyperlegible', system-ui, sans-serif",
      'System':       "system-ui, -apple-system, sans-serif",
    },
    display: {
      'San Francisco (Apple)': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      'Montserrat':   "'Montserrat', sans-serif",
      'Poppins':      "'Poppins', sans-serif",
      'Oswald':       "'Oswald', sans-serif",
      'Raleway':      "'Raleway', sans-serif",
      'Roboto':       "'Roboto', sans-serif",
      'Playfair Display': "'Playfair Display', serif",
      'Merriweather': "'Merriweather', serif",
      'Roboto Slab':  "'Roboto Slab', serif",
      'Sora':         "'Sora', sans-serif",
      'Space Grotesk':"'Space Grotesk', sans-serif",
      'Bricolage':    "'Bricolage Grotesque', sans-serif",
      'Fraunces':     "'Fraunces', serif",
      'Inter':        "'Inter', sans-serif",
      'System (SF/Segoe)': "system-ui, -apple-system, sans-serif",
    },
  };

  /* ---- Teme prestabilite (setează TOT aspectul dintr-un click) ---- */
  const THEMES = [
    { id: 'business', name: 'Business', tag: 'stil Salesforce / HubSpot',
      desc: 'Dens, corporativ, albastru — pentru lucru intens cu multe date.',
      s: { mode: 'light', accent: '#1A56C4', fontUi: 'IBM Plex Sans', fontDisplay: 'Sora', radius: 0, density: 'compact', background: 'grid', layoutSide: 'left', preset: 'custom' },
      sw: ['#1A56C4', '#EEF1F6', '#10243F'] },
    { id: 'standard', name: 'Standard AMASS', tag: 'cum e acum',
      desc: 'Echilibrat, roșul de brand AMASS — recomandat pentru majoritatea.',
      s: { mode: 'light', accent: '#CC0000', fontUi: 'Inter', fontDisplay: 'Montserrat', radius: 2, density: 'normal', background: 'none', layoutSide: 'left', preset: 'amass' },
      sw: ['#CC0000', '#FAFAF8', '#1A1D1F'] },
    { id: 'apple', name: 'Refined', tag: 'stil Apple',
      desc: 'Monocrom grafit, aerisit, rotunjit — font de sistem, mult spațiu alb.',
      s: { mode: 'light', accent: '#1D1D1F', fontUi: 'System (SF/Segoe)', fontDisplay: 'System (SF/Segoe)', radius: 4, density: 'comfortable', background: 'none', layoutSide: 'left', preset: 'custom' },
      sw: ['#1D1D1F', '#FFFFFF', '#86868B'] },
  ];

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
    { id: 'teal',   name: 'Teal',       accent: '#0D9488' },
    { id: 'ocean',  name: 'Ocean',      accent: '#0369A1' },
    { id: 'magenta',name: 'Magenta',    accent: '#BE185D' },
    { id: 'forest', name: 'Pădure',     accent: '#15803D' },
    { id: 'amber',  name: 'Chihlimbar', accent: '#B45309' },
    { id: 'indigo', name: 'Indigo',     accent: '#4338CA' },
  ];
  /* fundaluri personalizate */
  const BACKGROUNDS = [
    { id: 'none',   name: 'Implicit',  css: '' },
    { id: 'warm',   name: 'Cald',      css: 'radial-gradient(1200px 600px at 100% 0%, color-mix(in oklab, var(--accent) 8%, transparent), transparent)' },
    { id: 'mesh',   name: 'Mesh',      css: 'radial-gradient(900px 500px at 0% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent), radial-gradient(900px 500px at 100% 100%, color-mix(in oklab, #2563EB 8%, transparent), transparent)' },
    { id: 'dots',   name: 'Puncte',    css: 'radial-gradient(var(--border-strong) 1px, transparent 1px)', size: '18px 18px' },
    { id: 'grid',   name: 'Caroiaj',   css: 'linear-gradient(var(--border-faint) 1px, transparent 1px), linear-gradient(90deg, var(--border-faint) 1px, transparent 1px)', size: '24px 24px' },
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
    layoutSide: 'left',       // left | right — poziția meniului + barei de unelte
    background: 'none',       // fundal personalizat (preset)
    bgImage: '',              // fundal: imagine proprie (dataURL, opțional)
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
    try { const s = JSON.parse(localStorage.getItem(lsKey())); if (s) return { ...DEFAULTS, ...s, stages: { ...s.stages } }; }
    catch (e) {}
    return { ...DEFAULTS };
  }
  function save() {
    var payload = JSON.stringify(state);
    try {
      localStorage.setItem(lsKey(), payload);
      localStorage.setItem('amass.currentUser', USER);
    } catch (e) {
      // QuotaExceededError — cel mai probabil bgImage este prea mare.
      // Renunțăm la bgImage și reîncercăm ca celelalte setări să se salveze.
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn('[Aspect] localStorage quota depășit — bgImage eliminat, celelalte setări salvate.');
        try {
          var slim = Object.assign({}, state, { bgImage: '' });
          localStorage.setItem(lsKey(), JSON.stringify(slim));
          localStorage.setItem('amass.currentUser', USER);
        } catch (e2) { /* nici fără bgImage nu a mers — ignorăm silențios */ }
      }
    }
  }

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

    // Poziție layout (meniu + unelte stânga/dreapta)
    root.setAttribute('data-side', state.layoutSide || 'left');
    // Fundal personalizat (preset SAU imagine proprie)
    if (state.bgImage) {
      root.style.setProperty('--bg-pattern', 'linear-gradient(var(--bg-scrim), var(--bg-scrim)), url(' + state.bgImage + ')');
      root.style.setProperty('--bg-pattern-size', 'cover, cover');
    } else {
      const bg = BACKGROUNDS.find(b => b.id === state.background) || BACKGROUNDS[0];
      root.style.setProperty('--bg-pattern', bg.css || 'none');
      root.style.setProperty('--bg-pattern-size', bg.size || 'auto');
    }

    subs.forEach(fn => fn(state));
  }

  // re-aplică la schimbarea temei sistemului
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.mode === 'system') apply(); });
  } catch (e) {}

  window.Aspect = {
    FONTS, TEXT_STEPS, TEXT_LABELS, RADIUS_STEPS, RADIUS_LABELS,
    STAGES, TERMINAL, ALL_STAGES, STAGE_MAP, PRIORITIES, PRIORITY_MAP, PRESETS, BACKGROUNDS, DEFAULTS,
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; save(); apply(); },
    setStage: (key, hex) => { state = { ...state, stages: { ...state.stages, [key]: hex } }; save(); apply(); },
    setBgImage: (dataUrl) => { var ok = typeof dataUrl === 'string' && /^data:image\//.test(dataUrl); state = { ...state, bgImage: ok ? dataUrl : '', background: ok ? 'image' : 'none' }; save(); apply(); },
    resetStage: (key) => { const st = { ...state.stages }; delete st[key]; state = { ...state, stages: st }; save(); apply(); },
    reset: () => { state = { ...DEFAULTS, stages: {} }; save(); apply(); },
    THEMES,
    setTheme: (id) => { const t = THEMES.find(x => x.id === id); if (!t) return; state = { ...state, ...t.s, theme: id }; save(); apply(); },
    apply,
    contrast, onColor, rate, resolveMode,
    stageColor: (key) => state.stages[key] || (resolveMode(state.mode) === 'dark' ? STAGE_MAP[key].dark : STAGE_MAP[key].light),
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    // ---- Per-user: fiecare cont are propriul aspect (cheie LS dedicată) ----
    currentUser: () => USER,
    setUser: (u) => { USER = u || 'default'; state = load(); apply(); },
    // ---- Export / import preset de aspect (joc între agenți) ----
    exportJSON: () => JSON.stringify({ _amass_aspect: 1, user: USER, ...state }, null, 2),
    importJSON: (txt) => {
      try { const o = JSON.parse(txt); if (!o || typeof o !== 'object') return false;
        delete o._amass_aspect; delete o.user;
        // bgImage: acceptat DOAR ca data:image (anti-injecție CSS) sub ~1.5M (anti-overflow localStorage)
        // SAU ca '' (ștergere intenționată a fundalului).
        // String non-gol care NU e data:image → eliminăm cheia complet ca să nu suprascriem starea curentă.
        if ('bgImage' in o) {
          if (typeof o.bgImage === 'string' && o.bgImage !== '' && (o.bgImage.length > 1500000 || !/^data:image\//.test(o.bgImage))) {
            delete o.bgImage; // invalid → ignorăm cheia (nu resetăm la DEFAULTS)
          }
        }
        // Suprascriem DOAR cheile prezente explicit în JSON (nu resetăm câmpuri absente la DEFAULTS).
        // Cheile absente din `o` → se păstrează valoarea curentă din `state`.
        // Cheile prezente în `o` → suprascriu (inclusiv '' pentru bgImage = ștergere intenționată).
        const merged = {};
        Object.keys(DEFAULTS).forEach(k => { merged[k] = k in o ? o[k] : state[k]; });
        // MERGE culori stadii (nu înlocui) — importul unui preset fără `stages` NU șterge personalizările curente.
        merged.stages = { ...state.stages, ...(o.stages || {}) };
        state = merged; save(); apply(); return true;
      } catch (e) { return false; }
    },
  };

  apply(); // prima aplicare, înainte de body paint
})();
