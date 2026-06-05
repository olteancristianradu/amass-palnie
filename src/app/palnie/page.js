"use strict";
'use client';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PalniePage;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var Layout_1 = require("@/components/Layout");
var ui_1 = require("@/components/ui");
var Icon_1 = require("@/components/Icon");
var indicators_1 = require("@/components/indicators");
var KanbanBoard_1 = require("@/components/KanbanBoard");
var i18n_1 = require("@/lib/i18n");
var aspect_meta_1 = require("@/lib/aspect-meta");
var STADII = ['', 'Anulat', 'Contractat', 'Amanat', 'Finalizat'];
var NEVOI = ['', 'Nevoie Acoperita', 'Tentativa', 'Nu il putem ajuta', 'Nevoie viitoare', 'Nevoie Acoperita in anumite conditii'];
// Etape (deriveStage) — cheie internă + etichetă afișată. Ordinea = pâlnia liniară.
var STAGE_OPTIONS = [
    { key: 'intrare', label: 'Intrare' },
    { key: 't1', label: 'T1' },
    { key: 'schita', label: 'Schiță' },
    { key: 'preofertat', label: 'Pre-ofertat' },
    { key: 'ofertat', label: 'Ofertat' },
    { key: 'amanat', label: 'Amânat' },
    { key: 'contractat', label: 'Contractat' },
    { key: 'finalizat', label: 'Finalizat' },
    { key: 'anulat', label: 'Anulat' },
];
var STAGE_ORDER = Object.fromEntries(STAGE_OPTIONS.map(function (s, i) { return [s.key, i]; }));
// Steluță (prioritate culoare) — index 0..4 (parity cu PriorityStars / stelutaCat).
var STELUTA_OPTIONS = ['Fără', 'Roșu', 'Portocaliu', 'Albastru', 'Verde'];
var SORT_OPTIONS = [
    { key: 'supr-desc', label: 'Suprafață ↓' },
    { key: 'supr-asc', label: 'Suprafață ↑' },
    { key: 'data-desc', label: 'Dată intrare ↓' },
    { key: 'data-asc', label: 'Dată intrare ↑' },
    { key: 'prio-desc', label: 'Prioritate (steluță) ↓' },
    { key: 'nume-asc', label: 'Nume A-Z' },
    { key: 'etapa', label: 'Etapă' },
];
var DEFAULT_FILTERS = { stage: '', stadiu: '', nevoia: '', steluta: '', varsta: 'all', audio: 'all', inCRM: 'all', mpMin: '', mpMax: '', dateFrom: '', dateTo: '', stageFrom: '', stageTo: '' };
// Înregistrare CRM: null sau true = client real (în CRM); doar false = creat manual în webapp.
var isInCRM = function (c) { return c.inCRM !== false; };
// Dată cu NUME DE LUNĂ (ex. „8 mai 2026"). Acceptă ISO (din DateTime) sau dd.mm.yyyy (text T1 din CRM).
function fmtDateRO(v) {
    if (!v)
        return '—';
    var d = null;
    var m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // dd.mm.yyyy (ex. T1)
    if (m)
        d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    else {
        var t = new Date(v);
        if (!Number.isNaN(t.getTime()))
            d = t;
    }
    if (!d)
        return String(v);
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}
// dd.mm.yyyy <-> yyyy-mm-dd (pentru <input type="date"> nativ; T1 din CRM vine ca dd.mm.yyyy).
function dateToISO(v) {
    if (!v)
        return '';
    var m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m)
        return "".concat(m[3], "-").concat(m[2].padStart(2, '0'), "-").concat(m[1].padStart(2, '0'));
    var t = new Date(v);
    if (!Number.isNaN(t.getTime()))
        return "".concat(t.getFullYear(), "-").concat(String(t.getMonth() + 1).padStart(2, '0'), "-").concat(String(t.getDate()).padStart(2, '0'));
    return '';
}
function isoToDateRO(iso) {
    var p = iso.split('-');
    return p.length === 3 ? "".concat(p[2], ".").concat(p[1], ".").concat(p[0]) : '';
}
// T1 auto = Data intrare + 1 zi (paritate cu handoff: window.DB iso(+1)), format dd.mm.yyyy.
function t1Auto(dataIntrare) {
    var iso = dateToISO(dataIntrare);
    if (!iso)
        return '';
    var d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime()))
        return '';
    d.setDate(d.getDate() + 1);
    return "".concat(String(d.getDate()).padStart(2, '0'), ".").concat(String(d.getMonth() + 1).padStart(2, '0'), ".").concat(d.getFullYear());
}
// Chip colors pe Nevoia (parity cu Palnie.js ~175-183): verde / gri / roșu / galben / portocaliu.
function nevoiaChip(v) {
    var s = (v || '').toLowerCase();
    if (s.includes('anumite conditii'))
        return { background: 'var(--warning-soft)', color: 'var(--warning)' }; // portocaliu
    if (s.includes('nevoie acoperita'))
        return { background: 'var(--success-soft)', color: 'var(--success)' }; // verde
    if (s.includes('nu il putem ajuta'))
        return { background: 'var(--danger-soft)', color: 'var(--danger)' }; // roșu
    if (s.includes('nevoie viitoare'))
        return { background: '#F6EFDC', color: '#8A6D1F' }; // galben
    if (s.includes('tentativa'))
        return { background: 'var(--surface-3)', color: 'var(--text-secondary)' }; // gri
    return {};
}
// Grup de filtre re-stilizat ca în design: etichetă + chips (.fgroup / .chip).
function FilterGroup(_a) {
    var label = _a.label, value = _a.value, options = _a.options, onChange = _a.onChange, dotFn = _a.dotFn;
    return (<div className="fgroup">
      <span className="label">{label}</span>
      <div className="fgroup__chips">
        {options.map(function (_a) {
            var k = _a[0], l = _a[1];
            return (<button key={k} className={'chip' + (value === k ? ' is-on' : '')} onClick={function () { return onChange(k); }}>
            {dotFn && dotFn(k) && <span className="chip__dot" style={{ background: dotFn(k) }}/>}{l}
          </button>);
        })}
      </div>
    </div>);
}
// Chip activ (în filterbar) cu buton de eliminare.
function Chip(_a) {
    var children = _a.children, dot = _a.dot, onRemove = _a.onRemove;
    var t = (0, i18n_1.useT)().t;
    return (<span className="chip is-on">
      {dot && <span className="chip__dot" style={{ background: dot }}/>}{children}
      <button className="chip__x" onClick={onRemove} title={t('Elimină filtrul')}><Icon_1.Icon name="x" size={12}/></button>
    </span>);
}
// Buton de etapă (toggle bifă) pentru cardurile-rând (.steptog).
function StepToggle(_a) {
    var label = _a.label, done = _a.done, onClick = _a.onClick;
    return (<button className={'steptog' + (done ? ' is-done' : '')} onClick={function (e) { e.stopPropagation(); onClick(); }} title={label}>
      <Icon_1.Icon name={done ? 'check' : 'clock'} size={12}/>{label}
    </button>);
}
// Celulă de dată editabilă (paritate handoff .datecell): afișează data cu NUME DE LUNĂ
// (ex. „8 mai 2026"); click → calendar nativ. `faint` = stil estompat (ex. T1 auto, nesetat manual).
function DateCell(_a) {
    var value = _a.value, onChange = _a.onChange, faint = _a.faint, title = _a.title;
    var t = (0, i18n_1.useT)().t;
    var ref = (0, react_1.useRef)(null);
    var open = function () {
        var el = ref.current;
        if (!el)
            return;
        if (el.showPicker) {
            try {
                el.showPicker();
                return;
            }
            catch (_a) { }
        }
        el.focus();
        el.click();
    };
    var iso = dateToISO(value);
    return (<span className={'datecell' + (faint ? ' is-faint' : '') + (!value ? ' is-empty' : '')} onClick={open} title={title || (value ? t('Click pentru a schimba data') : t('Click pentru a seta data'))}>
      <Icon_1.Icon name="clock" size={11}/>
      <span className="datecell__txt">{value ? fmtDateRO(value) : '—'}</span>
      <input ref={ref} type="date" className="datecell__native" value={iso} tabIndex={-1} onChange={function (e) { return onChange(e.target.value); }}/>
    </span>);
}
// Mini-buton info ⓘ (dreapta-sus a tabelului) → popover cu legenda celor 2 simboluri.
// Închide la click în afară (mousedown). Explicațiile stau sub trigger, nu permanent pe ecran.
function TableInfo() {
    var t = (0, i18n_1.useT)().t;
    var _a = (0, react_1.useState)(false), open = _a[0], setOpen = _a[1];
    var ref = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (!open)
            return;
        var h = function (e) { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', h);
        return function () { return document.removeEventListener('mousedown', h); };
    }, [open]);
    return (<span className="tbl-info" ref={ref}>
      <button className={'tbl-info__btn' + (open ? ' is-on' : '')} title={t('Legendă simboluri')} onClick={function () { return setOpen(function (o) { return !o; }); }} aria-label={t('Legendă simboluri')}>
        <Icon_1.Icon name="info" size={15}/>
      </button>
      {open && (<div className="tbl-info__pop">
          <div className="tbl-info__t">{t('Legendă simboluri')}</div>
          <div className="tbl-info__row">
            <span className="autodot__pulse"/>
            <span>{t('Punct albastru =')} <b>{t('completat automat')}</b> {t('(din Data intrare). Scrii peste → devine manual și nu se mai suprascrie.')}</span>
          </div>
          <div className="tbl-info__row">
            <span className="cnm__warn"><Icon_1.Icon name="alert" size={13}/></span>
            <span>{t('Triunghi roșu la nume = client')} <b>{t('fără înregistrare în CRM')}</b>.</span>
          </div>
        </div>)}
    </span>);
}
function PalniePage() {
    var _a;
    var router = (0, navigation_1.useRouter)();
    var t = (0, i18n_1.useT)().t;
    var _b = (0, react_1.useState)([]), clienti = _b[0], setClienti = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(null), sync = _d[0], setSync = _d[1];
    var _e = (0, react_1.useState)(null), lastSync = _e[0], setLastSync = _e[1];
    var _f = (0, react_1.useState)(null), autoSync = _f[0], setAutoSync = _f[1];
    var _g = (0, react_1.useState)(''), filter = _g[0], setFilter = _g[1];
    // Panou de filtre ample (colapsabil). `stadiuFilter` rămâne în obiectul `filters`.
    var _h = (0, react_1.useState)(DEFAULT_FILTERS), filters = _h[0], setFilters = _h[1];
    var _j = (0, react_1.useState)(false), filtersOpen = _j[0], setFiltersOpen = _j[1];
    var _k = (0, react_1.useState)('data-desc'), sortKey = _k[0], setSortKey = _k[1];
    var setF = function (k, v) { return setFilters(function (prev) {
        var _a;
        return (__assign(__assign({}, prev), (_a = {}, _a[k] = v, _a)));
    }); };
    var _l = (0, react_1.useState)(''), msg = _l[0], setMsg = _l[1];
    var _m = (0, react_1.useState)(false), isManager = _m[0], setIsManager = _m[1];
    var _o = (0, react_1.useState)('all'), ownerFilter = _o[0], setOwnerFilter = _o[1];
    var _p = (0, react_1.useState)([]), agentList = _p[0], setAgentList = _p[1];
    var _q = (0, react_1.useState)('cards'), view = _q[0], setView = _q[1];
    // Modal de motiv la închidere (Contractat/Anulat) — API-ul cere closureReason; fără el PATCH-ul dă 400.
    var _r = (0, react_1.useState)(null), closeModal = _r[0], setCloseModal = _r[1];
    // Modal „+ Client nou" (creare manuală, inCRM=false) — deschis din topbar.
    var _s = (0, react_1.useState)(false), newModal = _s[0], setNewModal = _s[1];
    (0, react_1.useEffect)(function () { var v = localStorage.getItem('amass-palnie-view'); if (v === 'tabel' || v === 'cards' || v === 'kanban')
        setView(v); }, []);
    var switchView = function (v) { setView(v); try {
        localStorage.setItem('amass-palnie-view', v);
    }
    catch (_a) { } };
    // Persistență filtre + sortare în localStorage (opțional, restaurat la mount).
    (0, react_1.useEffect)(function () {
        try {
            var raw = localStorage.getItem('amass-palnie-filters');
            if (raw) {
                var p = JSON.parse(raw);
                if (p && typeof p === 'object')
                    setFilters(__assign(__assign({}, DEFAULT_FILTERS), p));
            }
            var sk_1 = localStorage.getItem('amass-palnie-sort');
            if (sk_1 && SORT_OPTIONS.some(function (o) { return o.key === sk_1; }))
                setSortKey(sk_1);
        }
        catch (_a) { }
    }, []);
    (0, react_1.useEffect)(function () { try {
        localStorage.setItem('amass-palnie-filters', JSON.stringify(filters));
    }
    catch (_a) { } }, [filters]);
    (0, react_1.useEffect)(function () { try {
        localStorage.setItem('amass-palnie-sort', sortKey);
    }
    catch (_a) { } }, [sortKey]);
    // Update optimist local — folosit de Kanban (drag & drop) ca să reflecte mutarea instant.
    var patchLocal = function (id, patch) { return setClienti(function (prev) { return prev.map(function (c) { return c.id === id ? __assign(__assign({}, c), patch) : c; }); }); };
    // Token anti-race pentru load(): fiecare cerere primește un id; la întoarcere, dacă a pornit între
    // timp o cerere mai nouă (ex. managerul a comutat agentul), ignorăm rezultatul stale (nu mai facem setState).
    var loadToken = (0, react_1.useRef)(0);
    // Toast-ul dispare SINGUR: succes/info după 4s, eroare după 8s (înainte rămânea agățat după sync).
    (0, react_1.useEffect)(function () {
        if (!msg)
            return;
        var ms = msg.startsWith('❌') ? 8000 : 4000;
        var id = setTimeout(function () { return setMsg(''); }, ms);
        return function () { return clearTimeout(id); };
    }, [msg]);
    function load() {
        return __awaiter(this, arguments, void 0, function (silent) {
            var myToken, reqOwner, r, j, e_1;
            if (silent === void 0) { silent = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!silent)
                            setLoading(true);
                        myToken = ++loadToken.current;
                        reqOwner = ownerFilter;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        return [4 /*yield*/, fetch('/api/clienti?limit=5000&owner=' + reqOwner)];
                    case 2:
                        r = _a.sent();
                        // Sesiune expirată/invalidă → NU lăsa pagina goală; trimite la login.
                        if (r.status === 401) {
                            window.location.href = '/login';
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                    case 3:
                        j = _a.sent();
                        // ANTI-RACE: a pornit între timp o cerere mai nouă → ignorăm acest rezultat (nu suprapunem date stale).
                        if (myToken !== loadToken.current)
                            return [2 /*return*/];
                        if (r.ok && j.ok) {
                            setClienti(j.clienti);
                            setIsManager(j.isManager);
                        }
                        else if (!silent)
                            setMsg('❌ ' + (j.error || "".concat(t('Eroare server'), " (").concat(r.status, ")")));
                        return [3 /*break*/, 6];
                    case 4:
                        e_1 = _a.sent();
                        if (myToken !== loadToken.current)
                            return [2 /*return*/]; // eroarea unei cereri stale nu trebuie să afecteze UI-ul curent
                        if (!silent)
                            setMsg('❌ ' + ((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || t('Nu s-a putut încărca pâlnia')));
                        return [3 /*break*/, 6];
                    case 5:
                        // finally garantează că spinnerul „Se încarcă pâlnia…" nu rămâne agățat la o eroare/HTML neașteptat.
                        // Doar cererea cea mai nouă are voie să stingă spinnerul (o cerere stale nu trebuie să-l stingă prematur).
                        if (!silent && myToken === loadToken.current)
                            setLoading(false);
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    (0, react_1.useEffect)(function () { load(); }, [ownerFilter]);
    // Lista agenților (manager) + ultimul sync + starea auto-sync pentru badge.
    function loadMeta() {
        fetch('/api/dashboard?owner=all').then(function (r) { return r.json(); }).then(function (j) {
            if (j.ok) {
                if (j.isManager)
                    setAgentList(j.stats.agents || []);
                setLastSync((j.stats.recentSyncs || [])[0] || null);
                setAutoSync(j.autoSync || null);
            }
            else {
                // Răspuns ne-ok: NU pretindem succes pe badge — îl ducem într-o stare cunoscută (necunoscut),
                // ca să nu afișeze un status de sync stale/greșit.
                console.error('loadMeta: răspuns ne-ok de la /api/dashboard', j === null || j === void 0 ? void 0 : j.error);
                setLastSync(null);
                setAutoSync(null);
            }
        }).catch(function (e) {
            // FIX: nu mai înghițim eroarea (înainte badge-urile rămâneau pe valori vechi/greșite). Logăm și
            // lăsăm metadatele într-o stare cunoscută (necunoscut), nu pretindem succes.
            console.error('loadMeta: eroare la încărcarea metadatelor de sync', e);
            setLastSync(null);
            setAutoSync(null);
        });
    }
    (0, react_1.useEffect)(function () { loadMeta(); }, []);
    // Auto-refresh UI la ~30s (silent, fără spinner) — reflectă datele aduse de auto-sync în fundal.
    (0, react_1.useEffect)(function () {
        var t = setInterval(function () { if (!document.hidden) {
            load(true);
            loadMeta();
        } }, 30000);
        return function () { return clearInterval(t); };
    }, [ownerFilter]);
    function runSync(endpoint, label) {
        return __awaiter(this, void 0, void 0, function () {
            var r, j, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setSync({ type: label });
                        setMsg("\u23F3 ".concat(label, " ").concat(t('pornit… (nu închide tab-ul)')));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, fetch(endpoint, { method: 'POST' })];
                    case 2:
                        r = _a.sent();
                        return [4 /*yield*/, r.json()];
                    case 3:
                        j = _a.sent();
                        if (!j.ok) return [3 /*break*/, 5];
                        setMsg("\u2705 ".concat(label, ": ").concat(JSON.stringify(j).slice(0, 200)));
                        return [4 /*yield*/, load()];
                    case 4:
                        _a.sent();
                        loadMeta();
                        return [3 /*break*/, 6];
                    case 5:
                        setMsg('❌ ' + j.error);
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        e_2 = _a.sent();
                        setMsg('❌ ' + e_2.message);
                        return [3 /*break*/, 8];
                    case 8:
                        setSync(null);
                        return [2 /*return*/];
                }
            });
        });
    }
    // Creare client manual (inCRM=false) → POST /api/clienti. La succes: reîncarcă pâlnia și
    // navighează la fișa noului client (paritate cu fluxul „vezi fișa").
    function createClient(payload) {
        return __awaiter(this, void 0, void 0, function () {
            var r, j, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setMsg('⏳ ' + t('Creez clientul…'));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        return [4 /*yield*/, fetch('/api/clienti', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            })];
                    case 2:
                        r = _a.sent();
                        return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                    case 3:
                        j = _a.sent();
                        if (!(r.ok && j.ok)) return [3 /*break*/, 5];
                        setMsg('✅ ' + t('Client creat (⚠ fără înregistrare CRM)'));
                        setNewModal(false);
                        return [4 /*yield*/, load()];
                    case 4:
                        _a.sent();
                        if (j.id)
                            router.push('/strategie/' + j.id);
                        return [3 /*break*/, 6];
                    case 5:
                        setMsg('❌ ' + (j.error || "".concat(t('Eroare server'), " (").concat(r.status, ")")));
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        e_3 = _a.sent();
                        setMsg('❌ ' + ((e_3 === null || e_3 === void 0 ? void 0 : e_3.message) || t('Nu s-a putut crea clientul')));
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function setSteluta(clientId, idLucrare, cat) {
        return __awaiter(this, void 0, void 0, function () {
            var r, j;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setClienti(function (prev) { return prev.map(function (c) { return c.id === clientId ? __assign(__assign({}, c), { stelutaCat: cat }) : c; }); }); // optimist
                        setMsg('⏳ ' + t('Trimit steluța în CRM…'));
                        return [4 /*yield*/, fetch('/api/crm/steluta', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ clientId: clientId, idLucrare: idLucrare, cat: cat })
                            })];
                    case 1:
                        r = _a.sent();
                        return [4 /*yield*/, r.json()];
                    case 2:
                        j = _a.sent();
                        setMsg(j.ok ? '✅ ' + t('Prioritate setată în CRM') : '❌ ' + j.error);
                        if (!!j.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, load()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function updateInline(id, field, value) {
        return __awaiter(this, void 0, void 0, function () {
            var prev, prevVal, newVal, r, j;
            var _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        prev = clienti.find(function (c) { return c.id === id; });
                        prevVal = prev ? ((_b = prev[field]) !== null && _b !== void 0 ? _b : null) : null;
                        newVal = value || null;
                        setClienti(function (p) { return p.map(function (c) {
                            var _a;
                            return c.id === id ? __assign(__assign({}, c), (_a = {}, _a[field] = newVal, _a)) : c;
                        }); });
                        return [4 /*yield*/, fetch("/api/clienti/".concat(id), {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify((_a = {}, _a[field] = newVal, _a))
                            })];
                    case 1:
                        r = _d.sent();
                        if (!!r.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                    case 2:
                        j = _d.sent();
                        setMsg('❌ ' + (((_c = j.validationErrors) === null || _c === void 0 ? void 0 : _c.join(' ')) || j.error || t('Nu s-a putut salva')));
                        // Rollback DOAR dacă valoarea afișată e încă cea pe care AM setat-o noi. Dacă între timp a apărut o
                        // a doua editare (alt val) pe același câmp, NU o suprascriem cu valoarea veche (anti-pierdere afișaj).
                        setClienti(function (p) { return p.map(function (c) {
                            var _a;
                            return (c.id === id && c[field] === newVal) ? __assign(__assign({}, c), (_a = {}, _a[field] = prevVal, _a)) : c;
                        }); });
                        _d.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    // Update optimist cu MAI MULTE câmpuri într-un singur PATCH (ex. T1 + t1Locked, sau stadiu + nevoia).
    // Aceeași logică de rollback ca updateInline, dar pe tot setul de câmpuri modificate.
    function updateInlineMulti(id, patch) {
        return __awaiter(this, void 0, void 0, function () {
            var prev, prevVals, newVals, _i, _a, _b, k, v, r, j;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        prev = clienti.find(function (c) { return c.id === id; });
                        prevVals = {};
                        newVals = {};
                        for (_i = 0, _a = Object.entries(patch); _i < _a.length; _i++) {
                            _b = _a[_i], k = _b[0], v = _b[1];
                            prevVals[k] = prev ? ((_c = prev[k]) !== null && _c !== void 0 ? _c : null) : null;
                            newVals[k] = (typeof v === 'string') ? (v || null) : v;
                        }
                        setClienti(function (p) { return p.map(function (c) { return c.id === id ? __assign(__assign({}, c), newVals) : c; }); });
                        return [4 /*yield*/, fetch("/api/clienti/".concat(id), {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(newVals)
                            })];
                    case 1:
                        r = _e.sent();
                        if (!!r.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                    case 2:
                        j = _e.sent();
                        setMsg('❌ ' + (((_d = j.validationErrors) === null || _d === void 0 ? void 0 : _d.join(' ')) || j.error || t('Nu s-a putut salva')));
                        // Rollback COMPLET (toate câmpurile atinse), nu parțial — altfel pe un eșec cu mai multe câmpuri
                        // ar rămâne o stare hibridă coruptă. Atomic, doar dacă încă suntem în starea optimistă pe care AM
                        // setat-o noi (TOATE câmpurile încă au valorile optimiste): dacă între timp a apărut altă editare pe
                        // ORICARE câmp, nu rescriem nimic (anti-pierdere afișaj).
                        setClienti(function (p) { return p.map(function (c) {
                            if (c.id !== id)
                                return c;
                            var stillOurs = Object.keys(newVals).every(function (k) { return c[k] === newVals[k]; });
                            return stillOurs ? __assign(__assign({}, c), prevVals) : c;
                        }); });
                        _e.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    // T1: editare manuală din celulă (calendar). O dată introdusă manual → t1Locked=true (nu se mai
    // suprascrie de import/auto). Setăm ambele câmpuri într-un singur PATCH.
    var setT1Manual = function (id, iso) { return updateInlineMulti(id, { t1: iso ? isoToDateRO(iso) : '', t1Locked: true }); };
    // „↺ auto": revine la completarea automată (T1 = Data intrare + 1 zi, t1Locked=false).
    var setT1AutoRevert = function (id) {
        var c = clienti.find(function (x) { return x.id === id; });
        var auto = t1Auto(c === null || c === void 0 ? void 0 : c.dataIntrare);
        // ANTI-PIERDERE: dacă nu există dataIntrare, t1Auto e gol → NU șterge T1-ul existent; doar deblochează.
        updateInlineMulti(id, auto ? { t1: auto, t1Locked: false } : { t1Locked: false });
    };
    // Schimbarea Stadiu: 'Contractat'/'Anulat' = închidere → cere motiv (modal) și trimite
    // { stadiu, closureReason, closureReasonDetail } într-un singur PATCH; restul merg direct.
    function setStadiu(id, value) {
        if (value === 'Contractat' || value === 'Anulat') {
            setCloseModal({ id: id, stadiu: value });
            return;
        }
        // INVERS BUSINESS RULE: dacă plecăm din 'Anulat' (Anulat implică nevoia='Nu il putem ajuta'), iar nevoia
        // a rămas EXACT acea valoare implicată, o resetăm la gol în ACELAȘI PATCH — altfel rămâne contradicția
        // „nu mai e Anulat, dar tot 'Nu il putem ajuta'". Nu atingem nevoia setată manual la altceva.
        var c = clienti.find(function (x) { return x.id === id; });
        if ((c === null || c === void 0 ? void 0 : c.stadiu) === 'Anulat' && (c === null || c === void 0 ? void 0 : c.nevoia) === 'Nu il putem ajuta') {
            updateInlineMulti(id, { stadiu: value, nevoia: '' });
            return;
        }
        updateInline(id, 'stadiu', value);
    }
    function closeWithReason(id, stadiu, detail) {
        return __awaiter(this, void 0, void 0, function () {
            var prev, closureReason, body, r, j;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        prev = clienti.find(function (c) { return c.id === id; });
                        closureReason = stadiu === 'Contractat' ? 'Won' : 'Lost';
                        body = { stadiu: stadiu, closureReason: closureReason, closureReasonDetail: detail };
                        if (stadiu === 'Anulat')
                            body.nevoia = 'Nu il putem ajuta';
                        setClienti(function (p) { return p.map(function (c) { return c.id === id ? __assign(__assign(__assign({}, c), { stadiu: stadiu }), (stadiu === 'Anulat' ? { nevoia: 'Nu il putem ajuta' } : {})) : c; }); }); // optimist
                        setMsg("\u23F3 ".concat(stadiu === 'Contractat' ? t('Contractare') : t('Anulare'), " ").concat(t('în CRM…')));
                        return [4 /*yield*/, fetch("/api/clienti/".concat(id), {
                                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body)
                            })];
                    case 1:
                        r = _b.sent();
                        if (!r.ok) return [3 /*break*/, 2];
                        setMsg("\u2705 ".concat(t('Marcat'), " \u201E").concat(t(stadiu), "\" ").concat(t('(sincronizat în CRM)')));
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, r.json().catch(function () { return ({}); })];
                    case 3:
                        j = _b.sent();
                        setMsg('❌ ' + (((_a = j.validationErrors) === null || _a === void 0 ? void 0 : _a.join(' ')) || j.error || t('Nu s-a putut salva')));
                        setClienti(function (p) { return p.map(function (c) {
                            var _a, _b;
                            return (c.id === id && c.stadiu === stadiu)
                                ? __assign(__assign(__assign({}, c), { stadiu: prev ? ((_a = prev.stadiu) !== null && _a !== void 0 ? _a : null) : null }), (stadiu === 'Anulat' && c.nevoia === 'Nu il putem ajuta' ? { nevoia: prev ? ((_b = prev.nevoia) !== null && _b !== void 0 ? _b : null) : null } : {})) : c;
                        }); });
                        _b.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    // Helpers comparatori sortare.
    var mp = function (c) { return (c.suprafata == null ? null : Number(c.suprafata)); };
    var dt = function (c) { var t = c.dataIntrare ? new Date(c.dataIntrare).getTime() : NaN; return Number.isNaN(t) ? null : t; };
    // null-urile cad mereu la coadă, indiferent de direcție.
    var nullsLast = function (av, bv, body) {
        if (av == null && bv == null)
            return 0;
        if (av == null)
            return 1;
        if (bv == null)
            return -1;
        return body(av, bv);
    };
    var filtered = clienti
        .filter(function (c) {
        var _a, _b, _c, _d;
        // Etapă (deriveStage)
        if (filters.stage && (0, aspect_meta_1.deriveStage)(c) !== filters.stage)
            return false;
        // Stadiu (existent)
        if (filters.stadiu && ((_a = c.stadiu) !== null && _a !== void 0 ? _a : '') !== filters.stadiu)
            return false;
        // Nevoia
        if (filters.nevoia && ((_b = c.nevoia) !== null && _b !== void 0 ? _b : '') !== filters.nevoia)
            return false;
        // Steluță (prioritate culoare) — compar pe CHEIA de prioritate, nu pe categoria gestcom brută,
        // ca să prindă și cat 5 (tot „verde") sub opțiunea „Verde" (gestcom cat 4); identic cu punctele din UI.
        if (filters.steluta !== '' && (0, aspect_meta_1.stelutaToPrio)((_c = c.stelutaCat) !== null && _c !== void 0 ? _c : 0) !== (0, aspect_meta_1.stelutaToPrio)(Number(filters.steluta)))
            return false;
        // Vârstă (rotLevel pe etapă: proaspăt / atenție / întârziat)
        if (filters.varsta !== 'all' && (0, aspect_meta_1.rotLevel)((0, aspect_meta_1.deriveStage)(c), (0, aspect_meta_1.daysSince)(c.dataIntrare)) !== filters.varsta)
            return false;
        // Audio
        if (filters.audio === 'yes' && !c.hasAudio)
            return false;
        if (filters.audio === 'no' && c.hasAudio)
            return false;
        // Înregistrare CRM (null tratat ca „în CRM")
        if (filters.inCRM === 'yes' && !isInCRM(c))
            return false;
        if (filters.inCRM === 'no' && isInCRM(c))
            return false;
        // Suprafață min/max
        var supr = mp(c);
        if (filters.mpMin !== '') {
            if (supr == null || supr < Number(filters.mpMin))
                return false;
        }
        if (filters.mpMax !== '') {
            if (supr == null || supr > Number(filters.mpMax))
                return false;
        }
        // Dată intrare de la / până la (compar pe yyyy-mm-dd local)
        if (filters.dateFrom || filters.dateTo) {
            var t_1 = dt(c);
            if (t_1 == null)
                return false;
            var d = new Date(t_1);
            var iso = "".concat(d.getFullYear(), "-").concat(String(d.getMonth() + 1).padStart(2, '0'), "-").concat(String(d.getDate()).padStart(2, '0'));
            if (filters.dateFrom && iso < filters.dateFrom)
                return false;
            if (filters.dateTo && iso > filters.dateTo)
                return false;
        }
        // Perioadă schimbare stadiu — proxy: updatedAt (ultima modificare). Compar pe yyyy-mm-dd local.
        if (filters.stageFrom || filters.stageTo) {
            var u = c.updatedAt ? new Date(c.updatedAt) : null;
            if (!u || Number.isNaN(u.getTime()))
                return false;
            var iso = "".concat(u.getFullYear(), "-").concat(String(u.getMonth() + 1).padStart(2, '0'), "-").concat(String(u.getDate()).padStart(2, '0'));
            if (filters.stageFrom && iso < filters.stageFrom)
                return false;
            if (filters.stageTo && iso > filters.stageTo)
                return false;
        }
        // Search liber (păstrat)
        if (filter) {
            var q = filter.toLowerCase();
            if (!(c.nume + ' ' + ((_d = c.localitate) !== null && _d !== void 0 ? _d : '') + ' ' + c.idLucrare).toLowerCase().includes(q))
                return false;
        }
        return true;
    })
        .sort(function (a, b) {
        var _a, _b, _c, _d;
        switch (sortKey) {
            case 'supr-desc': return nullsLast(mp(a), mp(b), function (x, y) { return y - x; });
            case 'supr-asc': return nullsLast(mp(a), mp(b), function (x, y) { return x - y; });
            case 'data-desc': return nullsLast(dt(a), dt(b), function (x, y) { return y - x; });
            case 'data-asc': return nullsLast(dt(a), dt(b), function (x, y) { return x - y; });
            case 'prio-desc': return ((_a = b.stelutaCat) !== null && _a !== void 0 ? _a : 0) - ((_b = a.stelutaCat) !== null && _b !== void 0 ? _b : 0);
            case 'nume-asc': return (a.nume || '').localeCompare(b.nume || '', 'ro', { sensitivity: 'base' });
            case 'etapa': return ((_c = STAGE_ORDER[(0, aspect_meta_1.deriveStage)(a)]) !== null && _c !== void 0 ? _c : 99) - ((_d = STAGE_ORDER[(0, aspect_meta_1.deriveStage)(b)]) !== null && _d !== void 0 ? _d : 99);
            default: return 0;
        }
    });
    // Nr. de filtre active (pt. badge) — search-ul nu intră, are propriul input.
    var activeFilterCount = ((filters.stage ? 1 : 0) + (filters.stadiu ? 1 : 0) + (filters.nevoia ? 1 : 0) +
        (filters.steluta !== '' ? 1 : 0) + (filters.varsta !== 'all' ? 1 : 0) + (filters.audio !== 'all' ? 1 : 0) +
        (filters.inCRM !== 'all' ? 1 : 0) +
        (filters.mpMin !== '' || filters.mpMax !== '' ? 1 : 0) +
        (filters.dateFrom || filters.dateTo ? 1 : 0) +
        (filters.stageFrom || filters.stageTo ? 1 : 0));
    var resetFilters = function () { return setFilters(DEFAULT_FILTERS); };
    // Chips active (rezumat în filterbar) — fiecare cu un „clear" propriu.
    var activeChips = [
        filters.stage ? { k: 'stage', label: ((_a = aspect_meta_1.STAGE_MAP[filters.stage]) === null || _a === void 0 ? void 0 : _a.label) || filters.stage, dot: 'var(--st-' + filters.stage + ')', clear: function () { return setF('stage', ''); } } : null,
        filters.stadiu ? { k: 'stadiu', label: filters.stadiu, clear: function () { return setF('stadiu', ''); } } : null,
        filters.nevoia ? { k: 'nevoia', label: filters.nevoia, clear: function () { return setF('nevoia', ''); } } : null,
        filters.steluta !== '' ? { k: 'steluta', label: 'Prio: ' + (STELUTA_OPTIONS[Number(filters.steluta)] || filters.steluta), clear: function () { return setF('steluta', ''); } } : null,
        filters.varsta !== 'all' ? { k: 'varsta', label: 'Vârstă: ' + ({ fresh: 'Proaspete', warn: 'Atenție', late: 'Întârziate' }[filters.varsta] || filters.varsta), clear: function () { return setF('varsta', 'all'); } } : null,
        filters.audio !== 'all' ? { k: 'audio', label: filters.audio === 'yes' ? 'Cu audio' : 'Fără audio', clear: function () { return setF('audio', 'all'); } } : null,
        filters.inCRM !== 'all' ? { k: 'inCRM', label: filters.inCRM === 'yes' ? 'În CRM' : 'Fără CRM', clear: function () { return setF('inCRM', 'all'); } } : null,
        (filters.mpMin !== '' || filters.mpMax !== '') ? { k: 'mp', label: "mp ".concat(filters.mpMin || '0', "\u2013").concat(filters.mpMax || '∞'), clear: function () { return setFilters(function (p) { return (__assign(__assign({}, p), { mpMin: '', mpMax: '' })); }); } } : null,
        (filters.dateFrom || filters.dateTo) ? { k: 'date', label: "Intrare ".concat(filters.dateFrom || '…', "\u2192").concat(filters.dateTo || '…'), clear: function () { return setFilters(function (p) { return (__assign(__assign({}, p), { dateFrom: '', dateTo: '' })); }); } } : null,
        (filters.stageFrom || filters.stageTo) ? { k: 'stage-date', label: "Stadiu ".concat(filters.stageFrom || '…', "\u2192").concat(filters.stageTo || '…'), clear: function () { return setFilters(function (p) { return (__assign(__assign({}, p), { stageFrom: '', stageTo: '' })); }); } } : null,
    ].filter(Boolean);
    var pillClass = function (s) {
        var m = { Anulat: 'pill-anulat', Contractat: 'pill-contractat', Amanat: 'pill-amanat', Finalizat: 'pill-finalizat' };
        return m[s !== null && s !== void 0 ? s : ''] || 'pill-lucru';
    };
    var stop = function (e) { return e.stopPropagation(); };
    // Topbar (switcher + search + filtre) — pasat Layout-ului prin prop `topbar`, ca în design.
    // Ordinea handoff: switcher → spacer → search → buton Filtre (lipit de search) → Client nou.
    var topbar = (<>
      <div className="topbar__switch">
        <indicators_1.Segmented value={view} size="sm" onChange={function (v) { return switchView(v); }} options={[
            { value: 'cards', label: t('Carduri'), icon: 'cards' },
            { value: 'tabel', label: t('Tabel'), icon: 'table' },
            { value: 'kanban', label: t('Kanban'), icon: 'kanban' },
        ]}/>
      </div>
      <div className="topbar__sp"/>
      <div className="topbar__search">
        <Icon_1.Icon name="search" size={15}/>
        <input placeholder={t('Caută client, oraș, #id…')} value={filter} onChange={function (e) { return setFilter(e.target.value); }}/>
      </div>
      <button className={'btn btn-secondary btn-sm filter-toggle' + (filtersOpen ? ' is-on' : '')} onClick={function () { return setFiltersOpen(function (o) { return !o; }); }} aria-expanded={filtersOpen} title={t('Filtre ample (etapă, nevoie, suprafață, dată…)')}>
        <Icon_1.Icon name="filter" size={15}/><span className="filter-toggle__lbl">{t('Filtre')}</span>
        {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
      </button>
      <button className="btn btn-primary btn-sm" onClick={function () { return setNewModal(true); }} title={t('Adaugă un client manual (fără înregistrare CRM)')}>
        <Icon_1.Icon name="plus" size={14}/>{t('Client nou')}
      </button>
      <ui_1.SyncBadge last={lastSync} syncing={!!sync} auto={autoSync}/>
    </>);
    return (<Layout_1.Layout topbar={topbar} contentMod={view === 'kanban' ? 'content--kanban' : view === 'tabel' ? 'content--table' : undefined}>
      {/* FILTERBAR (rezumat) — apare DOAR când există filtre active (paritate handoff): chips + Curăță tot + contor */}
      {activeFilterCount > 0 && (<div className="filterbar">
          <div className="chips-row">
            {activeChips.map(function (c) { return <Chip key={c.k} dot={c.dot} onRemove={c.clear}>{c.label}</Chip>; })}
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('Curăță tot')}</button>
          </div>
          <span className="filterbar__count muted tabular">{filtered.length} {t('din')} {clienti.length}</span>
        </div>)}

      {/* PANOU FILTRE — colapsabil; chips (.fgroup) + inputuri numerice/dată + sincronizare */}
      {filtersOpen && (<div className="filter-panel">
          <FilterGroup label={t('Sortare')} value={sortKey} onChange={function (k) { return setSortKey(k); }} options={SORT_OPTIONS.map(function (o) { return [o.key, o.label]; })}/>
          <FilterGroup label={t('Etapă')} value={filters.stage || 'toate'} onChange={function (k) { return setF('stage', k === 'toate' ? '' : k); }} options={__spreadArray([['toate', t('Toate')]], STAGE_OPTIONS.map(function (s) { return [s.key, s.label]; }), true)} dotFn={function (k) { return k !== 'toate' ? 'var(--st-' + k + ')' : null; }}/>
          <FilterGroup label={t('Prioritate')} value={filters.steluta === '' ? 'toate' : filters.steluta} onChange={function (k) { return setF('steluta', k === 'toate' ? '' : k); }} options={__spreadArray([['toate', t('Toate')]], STELUTA_OPTIONS.map(function (s, i) { return [String(i), s]; }), true)} dotFn={function (k) {
                if (k === 'toate')
                    return null;
                var p = aspect_meta_1.PRIORITY_MAP[(0, aspect_meta_1.stelutaToPrio)(Number(k))];
                return p ? p.color : null;
            }}/>
          <FilterGroup label={t('Vârstă')} value={filters.varsta} onChange={function (k) { return setF('varsta', k); }} options={[['all', t('Toate')], ['fresh', t('Proaspete')], ['warn', t('Atenție')], ['late', t('Întârziate')]]}/>
          <FilterGroup label={t('Stadiu')} value={filters.stadiu || 'toate'} onChange={function (k) { return setF('stadiu', k === 'toate' ? '' : k); }} options={__spreadArray([['toate', t('Toate')]], STADII.filter(function (s) { return s; }).map(function (s) { return [s, s]; }), true)}/>
          <FilterGroup label={t('Nevoia')} value={filters.nevoia || 'toate'} onChange={function (k) { return setF('nevoia', k === 'toate' ? '' : k); }} options={__spreadArray([['toate', t('Orice nevoie')]], NEVOI.filter(function (n) { return n; }).map(function (n) { return [n, n]; }), true)}/>
          <FilterGroup label={t('Audio')} value={filters.audio} onChange={function (k) { return setF('audio', k); }} options={[['all', t('Toate')], ['yes', t('Cu audio')], ['no', t('Fără audio')]]}/>
          <FilterGroup label={t('Înregistrare CRM')} value={filters.inCRM} onChange={function (k) { return setF('inCRM', k); }} options={[['all', t('Toate')], ['yes', t('În CRM')], ['no', t('Fără CRM')]]}/>
          {isManager && (<FilterGroup label={t('Agent (echipă)')} value={ownerFilter} onChange={setOwnerFilter} options={__spreadArray([['all', t('👥 Echipa mea')]], agentList.map(function (a) { return [a.id, a.name]; }), true)}/>)}
          {/* Suprafață min/max */}
          <div className="fgroup">
            <span className="label">{t('Suprafață (mp)')}</span>
            <div className="flex items-center gap-1">
              <input type="number" min={0} inputMode="numeric" placeholder={t('min')} className="field w-full" value={filters.mpMin} onChange={function (e) { return setF('mpMin', e.target.value); }}/>
              <span className="muted">–</span>
              <input type="number" min={0} inputMode="numeric" placeholder={t('max')} className="field w-full" value={filters.mpMax} onChange={function (e) { return setF('mpMax', e.target.value); }}/>
            </div>
          </div>
          {/* Perioadă intrare de la / până la (pe dataIntrare) */}
          <div className="fgroup">
            <span className="label">{t('Perioadă intrare')}</span>
            <div className="flex items-center gap-1">
              <input type="date" className="field w-full" title={t('de la')} value={filters.dateFrom} onChange={function (e) { return setF('dateFrom', e.target.value); }}/>
              <span className="muted">–</span>
              <input type="date" className="field w-full" title={t('până la')} value={filters.dateTo} onChange={function (e) { return setF('dateTo', e.target.value); }}/>
            </div>
          </div>
          {/* Perioadă schimbare stadiu de la / până la (pe updatedAt — ultima schimbare) */}
          <div className="fgroup">
            <span className="label">{t('Perioadă schimbare stadiu')}</span>
            <div className="flex items-center gap-1">
              <input type="date" className="field w-full" title={t('de la')} value={filters.stageFrom} onChange={function (e) { return setF('stageFrom', e.target.value); }}/>
              <span className="muted">–</span>
              <input type="date" className="field w-full" title={t('până la')} value={filters.stageTo} onChange={function (e) { return setF('stageTo', e.target.value); }}/>
            </div>
          </div>
          {/* SINCRONIZARE CRM (auto-sync rulează oricum în fundal) */}
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <span className="label">{t('Sincronizare CRM')}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={function () { return runSync('/api/crm/sync-clienti', 'Sync clienți'); }} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Importă clienți noi din CRM')}><Icon_1.Icon name="refresh" size={13}/>{t('Clienți')}</button>
              <button onClick={function () { return runSync('/api/crm/sync-detalii', 'Sync detalii'); }} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Reîmprospătează detalii (steluțe, audio, suprafață, observații→strategie)')}><Icon_1.Icon name="refresh" size={13}/>{t('Detalii')}</button>
              <button onClick={function () { return runSync('/api/crm/sync-remindere', 'Sync remindere'); }} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Reîmprospătează ultimul reminder')}><Icon_1.Icon name="refresh" size={13}/>{t('Remindere')}</button>
              <span className="muted" style={{ fontSize: '.6875rem' }}>{t('(auto la 90s/10min în fundal)')}</span>
              <span className="topbar__sp"/>
              <button onClick={resetFilters} disabled={activeFilterCount === 0} className="btn btn-secondary btn-sm"><Icon_1.Icon name="reset" size={13}/>{t('Resetează filtrele')}</button>
              <button onClick={function () { return setFiltersOpen(false); }} className="btn btn-ghost btn-sm">{t('Închide')}</button>
            </div>
          </div>
        </div>)}

      {msg && <div className={'toast mb-4 whitespace-pre-wrap ' + (msg.startsWith('✅') ? 'toast--success' : msg.startsWith('❌') ? 'toast--error' : 'toast--info')}>{msg}</div>}

      {loading ? (<div className="empty-state">{t('Se încarcă pâlnia…')}</div>) : filtered.length === 0 ? (<div className="empty-state">
          {clienti.length === 0 ? t('Niciun client încă. Apasă „Sync clienți" pentru import din CRM.') : t('Niciun rezultat pentru filtrul curent.')}
        </div>) : view === 'tabel' ? (<div className="table-wrap card rise">
          <TableInfo />
          {(function () {
                var cnt = function (f) { return filtered.filter(function (c) { var v = f(c); return v != null && String(v).trim() !== ''; }).length; };
                var tot = { supr: cnt(function (c) { return c.suprafata; }), intrare: cnt(function (c) { return c.dataIntrare; }), t1: cnt(function (c) { return c.t1; }), nevoia: cnt(function (c) { return c.nevoia; }), schita: cnt(function (c) { return c.schitaStatus; }), preof: cnt(function (c) { return c.preOfertat; }), ofertat: cnt(function (c) { return c.ofertat; }), status: cnt(function (c) { return c.stadiu; }) };
                var faraCRM = filtered.filter(function (c) { return c.inCRM === false; }).length;
                // Celulă de dată editabilă (DateCell): calendar nativ, format cu nume de lună (paritate handoff).
                var dcell = function (c, k, v) { return (<td onClick={stop} className="cell-date">
                <DateCell value={v} onChange={function (iso) { return updateInline(c.id, k, iso ? isoToDateRO(iso) : ''); }}/>
              </td>); };
                // Total / etapă centrat: valoare mare deasupra etichetei mici (paritate .tcell handoff).
                var totCell = function (val, lbl, cls) { return (<td className={'tcell ' + (cls || '')}><span className="tcell__v mono">{val}</span><span className="tcell__l">{lbl}</span></td>); };
                return (<div className="tbl-scroll scroll-thin">
                <table className="tbl tbl--fisa">
                  <colgroup>
                    <col className="cg-name"/><col className="cg-mp"/><col className="cg-date"/><col className="cg-t1"/>
                    <col className="cg-nevoie"/><col className="cg-date"/><col className="cg-date"/><col className="cg-date"/>
                    <col className="cg-status"/><col className="cg-rem"/><col className="cg-obs"/>
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="tbl__sticky tbl__name">{t('Client')}</th>
                      <th className="num">{t('Suprafață')}</th>
                      <th>{t('Data Intrare')}</th>
                      <th>{t('T1')}</th>
                      <th className="col-nevoie">{t('Nevoia')}</th>
                      <th>{t('Schiță')}</th>
                      <th>{t('Pre-Ofertat')}</th>
                      <th>{t('Ofertat')}</th>
                      <th>{t('Status')}</th>
                      <th>{t('Reminder')}</th>
                      <th>{t('Observații Manager')}</th>
                    </tr>
                    <tr className="tbl__total">
                      <td className="tbl__sticky tbl__total-lbl">{t('Total / etapă')} <span className="tbl__total-n">({filtered.length})</span></td>
                      {totCell(tot.supr, t('suprafețe'), 'num')}
                      {totCell(tot.intrare, t('intrate'))}
                      {totCell(tot.t1, 'T1')}
                      {totCell(tot.nevoia, t('calific.'), 'col-nevoie')}
                      {totCell(tot.schita, t('schițe'))}
                      {totCell(tot.preof, t('pre-of.'))}
                      {totCell(tot.ofertat, t('oferte'))}
                      {totCell(tot.status, t('cu status'))}
                      {totCell(faraCRM, t('fără CRM'))}
                      <td></td>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(function (c) {
                        var _a, _b, _c;
                        return (<tr key={c.id} onClick={function () { return router.push('/strategie/' + c.id); }} className="cursor-pointer">
                        <td className="tbl__sticky tbl__name">
                          <div className="cnm">
                            <span onClick={stop}>
                              <indicators_1.PriorityStar value={(0, aspect_meta_1.stelutaToPrio)(c.stelutaCat)} size={15} onClick={function () { return setSteluta(c.id, c.idLucrare, (0, aspect_meta_1.prioToSteluta)((0, aspect_meta_1.stelutaToPrio)((c.stelutaCat + 1) % 5))); }}/>
                            </span>
                            {!c.hasAudio && <Icon_1.Icon name="alert" size={13} style={{ color: 'var(--warning)', flex: '0 0 13px' }}/>}
                            {/* ⚠ client fără înregistrare în CRM. Modelul webapp NU are câmp inCRM → tratăm ca TRUE (deci nu apare acum); logica e gata. */}
                            {c.inCRM === false && (<span className="cnm__warn" title={t('Fără înregistrare în CRM — de sincronizat')}><Icon_1.Icon name="alert" size={13}/></span>)}
                            {/* Numele preia culoarea STELEI doar dacă are steluță colorată; altfel rămâne neutru (din CSS). */}
                            <a href={"https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=".concat(c.idLucrare)} target="_blank" rel="noopener" onClick={stop} className="cnm__name" style={{ color: (c.stelutaCat > 0 && aspect_meta_1.PRIORITY_MAP[(0, aspect_meta_1.stelutaToPrio)(c.stelutaCat)]) ? aspect_meta_1.PRIORITY_MAP[(0, aspect_meta_1.stelutaToPrio)(c.stelutaCat)].color : undefined }}>{c.nume || t('(nume)')}</a>
                          </div>
                          <div className="cnm__sub mono">#{c.idLucrare} · ({c.categorie}{c.isDT ? 'DT' : ''}){c.localitate ? ' · ' + c.localitate : ''}{isManager && ownerFilter === 'all' && c.owner ? ' · ' + (c.owner.name || c.owner.email) : ''}</div>
                        </td>
                        <td className="num mono cell-mp">{c.suprafata != null ? <><b>{c.suprafata}</b> <span className="cell-mp__u">mp</span></> : ''}</td>
                        <td className="cell-date">
                          {/* Data intrare = read-only (din CRM); stilizată ca .datecell, format cu nume de lună. */}
                          <span className={'datecell' + (!c.dataIntrare ? ' is-empty' : '')} style={{ cursor: 'default' }} title={t('Data intrării (din CRM)')}>
                            <Icon_1.Icon name="clock" size={11}/>
                            <span className="datecell__txt">{c.dataIntrare ? fmtDateRO(c.dataIntrare) : '—'}</span>
                          </span>
                        </td>
                        <td onClick={stop}>
                          <div className="t1cell">
                            <DateCell value={c.t1} faint={!c.t1Locked} onChange={function (iso) { return setT1Manual(c.id, iso); }}/>
                            {c.t1 && (c.t1Locked
                                ? <button className="t1revert" title={t('Setat manual — apasă pentru a reveni la completarea automată (Data intrare + 1 zi)')} onClick={function () { return setT1AutoRevert(c.id); }}><Icon_1.Icon name="refresh" size={9}/> {t('auto')}</button>
                                : <span className="autodot" title={t('Completat automat din Data intrare (+1 zi). Scrie o dată ca să-l faci manual.')}><span className="autodot__pulse"/></span>)}
                          </div>
                        </td>
                        <td onClick={stop} className="col-nevoie">
                          <select className="cell-select" style={c.nevoia ? __assign(__assign({}, nevoiaChip(c.nevoia)), { fontWeight: 600 }) : undefined} value={(_a = c.nevoia) !== null && _a !== void 0 ? _a : ''} onChange={function (e) { return updateInline(c.id, 'nevoia', e.target.value); }}>
                            {NEVOI.map(function (n) { return <option key={n} value={n}>{n ? t(n) : '—'}</option>; })}
                          </select>
                        </td>
                        {dcell(c, 'schitaStatus', c.schitaStatus)}
                        {dcell(c, 'preOfertat', c.preOfertat)}
                        {dcell(c, 'ofertat', c.ofertat)}
                        <td onClick={stop}>
                          <select className={'cell-select status-sel ' + pillClass(c.stadiu)} value={(_b = c.stadiu) !== null && _b !== void 0 ? _b : ''} onChange={function (e) { return setStadiu(c.id, e.target.value); }}>
                            {STADII.map(function (s) { return <option key={s} value={s}>{s ? t(s) : t('în lucru')}</option>; })}
                          </select>
                        </td>
                        <td className="cell-rem">
                          {c.reminderText
                                ? <span className="rem-cell" title={c.reminderText}><Icon_1.Icon name="clock" size={11}/>{c.reminderText.slice(0, 120)}</span>
                                : <span className="muted">{t('— fără')}</span>}
                        </td>
                        <td onClick={stop} className="cell-obs">
                          <textarea className="cell-obs__ta" rows={2} defaultValue={(_c = c.notaManager) !== null && _c !== void 0 ? _c : ''} placeholder={t('Notă manager…')} title={t('Notă privată a managerului (separată de observații CRM)')} onBlur={function (e) { var _a; if ((e.target.value || '') !== ((_a = c.notaManager) !== null && _a !== void 0 ? _a : ''))
                            updateInline(c.id, 'notaManager', e.target.value); }}/>
                        </td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>);
            })()}
        </div>) : view === 'kanban' ? (<KanbanBoard_1.KanbanBoard clienti={filtered} isManager={isManager} ownerFilter={ownerFilter} onPatch={patchLocal} setMsg={setMsg} reload={function () { return load(); }}/>) : (<div className="funnel-list rise">
          {filtered.map(function (c) {
                var _a, _b;
                var prio = aspect_meta_1.PRIORITY_MAP[(0, aspect_meta_1.stelutaToPrio)(c.stelutaCat)];
                var stages = [
                    { k: 'schitaStatus', l: t('Schiță'), v: c.schitaStatus },
                    { k: 'preOfertat', l: t('Pre-of.'), v: c.preOfertat },
                    { k: 'ofertat', l: t('Ofertat'), v: c.ofertat }
                ];
                return (<article key={c.id} className="fr" style={{ '--rot': prio.color }} onClick={function () { return router.push('/strategie/' + c.id); }} title={t('Click oriunde → fișa de strategie')}>
                <span className="fr__band"/>
                <div className="fr__id">
                  <div className="fr__head">
                    <a href={"https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=".concat(c.idLucrare)} target="_blank" rel="noopener" onClick={stop} className="fr__name crm-link">
                      {c.nume || t('(nume lipsă)')}
                    </a>
                    {c.localitate && <span className="fr__city">· {c.localitate}</span>}
                  </div>
                  <div className="fr__sub mono">
                    ({c.categorie}{c.isDT ? 'DT' : ''}) #{c.idLucrare}
                    {c.suprafata != null && <> · {c.suprafata} mp</>}
                    {c.dataIntrare && <> · {new Date(c.dataIntrare).toLocaleDateString('ro-RO')}</>}
                  </div>
                  {c.reminderText
                        ? <div className="fr__rem"><Icon_1.Icon name="clock" size={12}/>{t('Reminder:')} {c.reminderText}</div>
                        : <div className="fr__rem fr__rem--none"><Icon_1.Icon name="clock" size={12}/>{t('Fără reminder')}</div>}
                </div>

                <div className="fr__ctl" onClick={stop}>
                  <div className="fr__steps">
                    {stages.map(function (s) {
                        var on = !!(s.v && s.v.trim());
                        return <StepToggle key={s.k} label={s.l} done={on} onClick={function () { return updateInline(c.id, s.k, on ? '' : todayRO()); }}/>;
                    })}
                  </div>
                  <select className="cell-select fr__nevoie" style={c.nevoia ? __assign(__assign({}, nevoiaChip(c.nevoia)), { fontWeight: 600 }) : undefined} value={(_a = c.nevoia) !== null && _a !== void 0 ? _a : ''} onChange={function (e) { return updateInline(c.id, 'nevoia', e.target.value); }}>
                    {NEVOI.map(function (n) { return <option key={n} value={n}>{n ? t(n) : t('Nevoia —')}</option>; })}
                  </select>
                  <select className={'cell-select status-sel ' + pillClass(c.stadiu)} value={(_b = c.stadiu) !== null && _b !== void 0 ? _b : ''} onChange={function (e) { return setStadiu(c.id, e.target.value); }}>
                    {STADII.map(function (s) { return <option key={s} value={s}>{s ? t(s) : t('în lucru')}</option>; })}
                  </select>
                  <indicators_1.PriorityStar value={(0, aspect_meta_1.stelutaToPrio)(c.stelutaCat)} withLabel size={16} onClick={function () { return setSteluta(c.id, c.idLucrare, (0, aspect_meta_1.prioToSteluta)((0, aspect_meta_1.stelutaToPrio)((c.stelutaCat + 1) % 5))); }}/>
                  <button className="btn btn-pine btn-sm fr__fisa" onClick={function (e) { stop(e); router.push('/strategie/' + c.id); }}>
                    {t('VEZI FIȘA')}<Icon_1.Icon name="arrowR" size={14}/>
                  </button>
                </div>
              </article>);
            })}
        </div>)}

      {closeModal && (<CloseReasonModal stadiu={closeModal.stadiu} onClose={function () { return setCloseModal(null); }} onConfirm={function (detail) { closeWithReason(closeModal.id, closeModal.stadiu, detail); setCloseModal(null); }}/>)}

      {newModal && (<NewClientModal onClose={function () { return setNewModal(false); }} onCreate={createClient}/>)}
    </Layout_1.Layout>);
}
var WON_REASONS = ['ROI clar', 'Buget aprobat', 'Urgență (sezon)', 'Recomandare', 'Preț competitiv', 'Altul'];
var LOST_REASONS = ['Preț prea mare', 'A ales concurența', 'Fără decizie / amânat', 'Fără urgență', 'Buget tăiat', 'Necontactabil', 'Altul'];
// Modal de motiv la închidere (Contractat = câștigat / Anulat = pierdut). Trimite un motiv real
// (la „Altul" cere text liber) → ajunge în closureReasonDetail pentru raportul de win/loss.
function CloseReasonModal(_a) {
    var stadiu = _a.stadiu, onConfirm = _a.onConfirm, onClose = _a.onClose;
    var t = (0, i18n_1.useT)().t;
    var won = stadiu === 'Contractat';
    var reasons = won ? WON_REASONS : LOST_REASONS;
    var _b = (0, react_1.useState)(reasons[0]), sel = _b[0], setSel = _b[1];
    var _c = (0, react_1.useState)(''), free = _c[0], setFree = _c[1];
    var detail = sel === 'Altul' ? free.trim() : sel;
    var blocked = sel === 'Altul' && !free.trim();
    return (<div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={function (e) { return e.stopPropagation(); }}>
        <h2 className="text-lg mb-1">{won ? t('✅ Contractat — de ce a câștigat?') : t('❌ Anulat — de ce s-a pierdut?')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Motivul intră în raportul de win/loss (coaching).')}</p>
        <div className="space-y-1.5 mb-3">
          {reasons.map(function (r) { return (<label key={r} className={'flex items-center gap-2 px-3 py-2 rounded-[var(--r-sm)] border cursor-pointer text-[13px] ' + (sel === r ? 'border-[var(--ember)] bg-[var(--ember-soft)] font-semibold' : 'border-[var(--border-strong)]')}>
              <input type="radio" name="closeReason" checked={sel === r} onChange={function () { return setSel(r); }}/>{t(r)}
            </label>); })}
        </div>
        {sel === 'Altul' && (<textarea className="field mb-4" rows={2} autoFocus placeholder={t('Scrie motivul concret…')} value={free} onChange={function (e) { return setFree(e.target.value); }}/>)}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={function () { return onConfirm(detail); }} disabled={blocked} className={'btn ' + (won ? 'btn-pine' : 'btn-primary')}>{t('Confirmă')}</button>
        </div>
      </div>
    </div>);
}
function todayRO() {
    var d = new Date();
    return "".concat(String(d.getDate()).padStart(2, '0'), ".").concat(String(d.getMonth() + 1).padStart(2, '0'), ".").concat(d.getFullYear());
}
// Modal „+ Client nou" — creare manuală a unui client (inCRM=false → ⚠ la nume). Doar Nume e
// obligatoriu; restul sunt opționale. idLucrare gol → backend-ul pune un placeholder unic ('MAN-…').
function NewClientModal(_a) {
    var onCreate = _a.onCreate, onClose = _a.onClose;
    var t = (0, i18n_1.useT)().t;
    var _b = (0, react_1.useState)(''), nume = _b[0], setNume = _b[1];
    var _c = (0, react_1.useState)(''), localitate = _c[0], setLocalitate = _c[1];
    var _d = (0, react_1.useState)(''), judet = _d[0], setJudet = _d[1];
    var _e = (0, react_1.useState)(''), telefon = _e[0], setTelefon = _e[1];
    var _f = (0, react_1.useState)(''), idLucrare = _f[0], setIdLucrare = _f[1];
    var _g = (0, react_1.useState)(''), suprafata = _g[0], setSuprafata = _g[1];
    var _h = (0, react_1.useState)(false), saving = _h[0], setSaving = _h[1];
    var blocked = !nume.trim() || saving;
    var submit = function () {
        if (blocked)
            return;
        setSaving(true);
        onCreate({ nume: nume.trim(), localitate: localitate, judet: judet, telefon: telefon, idLucrare: idLucrare, suprafata: suprafata });
    };
    return (<div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={function (e) { return e.stopPropagation(); }}>
        <h2 className="text-lg mb-1">{t('+ Client nou')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Creat manual în webapp — apare cu ⚠ (fără înregistrare CRM) până la sincronizare.')}</p>
        <div className="space-y-3 mb-4">
          <label className="block">
            <span className="label">{t('Nume *')}</span>
            <input className="field w-full" autoFocus value={nume} onChange={function (e) { return setNume(e.target.value); }} placeholder={t('Numele clientului')} onKeyDown={function (e) { if (e.key === 'Enter')
        submit(); }}/>
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">{t('Localitate')}</span>
              <input className="field w-full" value={localitate} onChange={function (e) { return setLocalitate(e.target.value); }} placeholder={t('Oraș/comună')}/>
            </label>
            <label className="block flex-1">
              <span className="label">{t('Județ')}</span>
              <input className="field w-full" value={judet} onChange={function (e) { return setJudet(e.target.value); }} placeholder={t('Județ')}/>
            </label>
          </div>
          <label className="block">
            <span className="label">{t('Telefon')}</span>
            <input className="field w-full" value={telefon} onChange={function (e) { return setTelefon(e.target.value); }} placeholder={t('Telefon')}/>
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">{t('idLucrare (opțional)')}</span>
              <input className="field w-full" value={idLucrare} onChange={function (e) { return setIdLucrare(e.target.value); }} placeholder={t('lasă gol → automat')}/>
            </label>
            <label className="block flex-1">
              <span className="label">{t('Suprafață (mp)')}</span>
              <input className="field w-full" type="number" min={0} inputMode="numeric" value={suprafata} onChange={function (e) { return setSuprafata(e.target.value); }} placeholder={t('mp')}/>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={submit} disabled={blocked} className="btn btn-pine">{t('Creează')}</button>
        </div>
      </div>
    </div>);
}
