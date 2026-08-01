# Monrad Health & Safety — Mobile Usability Audit (follow-up)

**App path:** `D:\Cursor\practice`  
**Date:** 1 Aug 2026  
**Primary width:** 390px (iPhone-like)  
**Also considered:** 320 / 375 / 430 portrait; landscape noted separately; tablet/narrow desktop 640–1023  
**Prior baseline:** `MOBILE_UI_AUDIT.md` (24 Jul 2026)

**Method & limits**
- Full CSS review of mobile-relevant rules in `src/App.css` (overflow, `--tap-min`, `responsive-data-list`, equipment, archived-records, time-picker, forms, side menu, safe-area).
- Code review of equipment, records, forms, navigation, and interaction surfaces listed in the brief.
- **Live Playwright:** AuthView at **390×844** (screenshot `audit-auth-390.png` during session) — no horizontal overflow; Sign in ~51px / Sign up ~44px.
- **CSS probe (injected `App.css` markup at 390/320):** dashboard type sizes, modal close, footer, time picker, `.form-input` vs `.field__input`, overflow behaviour.
- **Authenticated field pages were not live-navigated** (auth blocks). Findings for post-login screens are **CSS / code analysis** unless marked Probe/Live.
- Browser MCP tabs were unavailable this session; Playwright was used instead.
- **No application code was changed** for this audit (report + build only).

**Evidence legend:** `Live` · `Probe` · `Code`

---

## 1. Executive summary

Since the July audit, the **largest equipment table failures are largely fixed**: register / defects / maintenance due / service history / compliance use `responsive-data-list` mobile cards plus desktop `data-table-scroll`; global `overflow-x: hidden` on `html`/`body`/`.app` is gone; SSSP mobile section pick uses a full-width select; 12-hour time picker meets 44px / 16px; archived records use card UI with proper delete modal; timesheet print path exists.

**What still hurts field use most:**
1. **`.form-input` has no CSS** — equipment/GM filters and several equipment modal fields render at ~21px height / ~13px font (`Probe`) → tiny taps + iOS input zoom.
2. **Equipment profile Pre-start history** is still a raw multi-column `.equipment-table` with no mobile cards / scroll wrapper (`Code`).
3. **Dashboard discoverability & readability** — Machines & Equipment still absent from dashboard cards; titles ~11px / overview labels ~8.8px at ≤390 (`Probe`).
4. **Chrome stack** — mobile header title + full-width Back + in-page `FormPageHeader` / page headers still burn viewport before first field.
5. **PWA safe-area incomplete** — sticky form actions use `safe-area-inset-bottom`, but `viewport-fit=cover` is missing and the mobile footer/drawer lack insets.

---

## 2. Status vs prior `MOBILE_UI_AUDIT.md`

| Prior ID | Topic | Status now |
|----------|--------|------------|
| **C1** | Equipment maintenance/compliance/profile tables unusable | **Mostly fixed** — register, defects, maintenance due, service history, compliance have mobile cards. **Remaining:** Equipment Profile **Pre-start history** table only. |
| **C2** | Global `overflow-x: hidden` clips tables | **Fixed** — `html`/`body`/`.app` no longer set `overflow-x: hidden` (`Probe`: overflow visible). |
| **H1** | Triple mobile chrome (menu title + header + Back) | **Open** |
| **H2** | Dashboard card titles / overview labels too small ≤390 | **Open** (`Probe`: 11.2px / 8.8px) |
| **H3** | Safety Overview below all nav cards | **Open** |
| **H4** | Machines & Equipment missing from dashboard | **Open** (drawer only) |
| **H5** | Equipment modal close &lt; 44px | **Open** (`Probe`: 26×26) |
| **H6** | Settings Delete no confirmation | **Open** |
| **H7** | Mobile footer lacks safe-area | **Open** |
| **H8** | Footer email `nowrap` + `break-all` conflict | **Open** |
| **M1** | SSSP horizontal section swipe | **Fixed** — mobile uses `.sssp-section-select`; nav buttons `display: none` under 1024 |
| **M2** | Sticky form-actions vs last fields / footer | **Partially mitigated** — `.job-form { padding-bottom: 5rem }`; footer/safe-area still imperfect |
| **M4** | Overview 4-col at 390 | **Improved** — 2-col under 480px; labels still tiny |
| **M5** | Dense filter toolbars | **Open** (worse with unstyled `.form-input`) |
| **M8** | No landscape rules | **Open** |
| **M9** | Help only on dashboard (`dashboardOnly`) | **Open** |
| Time picker / timesheet print / archive cards | (later work) | **Passed** in this pass |

---

## 3. Build result

```
Set-Location D:\Cursor\practice; npm run build
```

| Item | Result |
|------|--------|
| Exit code | **0** (success) |
| Bundler | Vite 8.1.3 |
| Time | ~491ms transform/build |
| CSS | `dist/assets/index-fBY3ZX8m.css` — 117.82 kB (gzip 17.24 kB) |
| JS | `dist/assets/index-ButC-wJC.js` — 920.63 kB (gzip 225.61 kB) |
| Warning | Chunk &gt; 500 kB (code-split suggestion only) |
| PWA | `generateSW` — **20** precache entries (**2893.52 KiB**); wrote `dist/sw.js`, `dist/workbox-0bb07689.js` |
| SW registration | `src/main.jsx` — `registerSW({ immediate: true })` with `registerType: 'autoUpdate'` |

---

## 4. Remaining issues

### Critical

#### C1 — `.form-input` class is unstyled (equipment / GM filters & modal fields)
| Field | Detail |
|--------|--------|
| **Page / component** | `EquipmentView` toolbars; `EquipmentForms` / `EquipmentSelector`; `GeneralMeetingView` type filter |
| **Exact problem** | Controls use `className="form-input"` but **no `.form-input` rules exist** in `App.css`. Probe at 390px: height **~21px**, font **~13.3px**, narrow width. Contrast: `.field__input` is **44px / 16px / full width**. |
| **User impact** | Hard to tap with gloves; iOS may zoom on focus; filters look broken vs rest of app; equipment add/edit defect/service fields inconsistent inside modals. |
| **Reproduction** | 1) Open Machines & Equipment on phone/PWA. 2) Inspect Register search/filters — native tiny controls. Or CSS probe comparing `input.form-input` vs `input.field__input`. |
| **Priority** | **Critical** |
| **Recommended fix** | Alias `.form-input` to the same rules as `.field__input` / `select.field__input` (incl. `@media (max-width: 640px)` 16px), or replace classnames with `field__input`. Ensure full-width in toolbars. |
| **Likely files** | `src/App.css`; optionally `EquipmentView.jsx`, `EquipmentForms.jsx`, `EquipmentSelector.jsx`, `GeneralMeetingView.jsx` |
| **Evidence** | `Probe` + `Code` |

#### C2 — Equipment Profile Pre-start history still desktop table only
| Field | Detail |
|--------|--------|
| **Page / component** | `EquipmentProfileView` — Pre-start history section |
| **Exact problem** | Renders bare `<table className="equipment-table">` (Date / Operator / Result / Defects / Open). **Not** wrapped in `responsive-data-list` or `.data-table-scroll`. Other profile sections already use lists/cards. |
| **User impact** | On ~320–390px, columns crowd or force page-level horizontal scroll; “Open” action easy to miss; breaks the mobile pattern now used everywhere else in Equipment. |
| **Reproduction** | Open an asset with pre-start history → scroll to Pre-start history (CSS/code: lines ~613–644). |
| **Priority** | **Critical** (remaining slice of prior C1) |
| **Recommended fix** | Mirror register pattern: mobile cards + desktop table in `data-table-scroll`. |
| **Likely files** | `src/pages/EquipmentProfileView.jsx`, `src/App.css` |
| **Evidence** | `Code` |

---

### High

#### H1 — Triple vertical chrome on forms / nested pages
| Field | Detail |
|--------|--------|
| **Page / component** | `AppShell` / `MobileHeader` + `BackButton` + `FormPageHeader` / `.header` / equipment page header |
| **Exact problem** | Below 1024px, desktop `PageHeader` is hidden, but MobileHeader still shows `pageTitle`, and pages still render company/title/subtitle plus **full-width** `.back-btn` under 640px. |
| **User impact** | ~150–200px before first field on Job Start, Pre-Start, Timesheet, Visitor, SSSP, Equipment, etc. |
| **Reproduction** | Any form view at 390px: note hamburger title, Back bar, then FormPageHeader. |
| **Priority** | **High** |
| **Recommended fix** | One title source on mobile; compact inline Back; hide duplicate company/date. |
| **Likely files** | `AppShell.jsx`, `MobileHeader.jsx`, `FormPageHeader.jsx`, `BackButton.jsx`, `App.css`, form/equipment pages |
| **Evidence** | `Code` (prior H1 unchanged) |

#### H2 — Dashboard type still unreadably small at ≤390
| Field | Detail |
|--------|--------|
| **Page / component** | `Dashboard` — `.dashboard-card__title`, `.dashboard-overview__stat-label` |
| **Exact problem** | `@media (max-width: 390px)` still sets title `0.7rem` and overview label `0.55rem`. Probe: **11.2px** / **8.8px**. Stats grid improved to 2 columns under 480px, but type floor unchanged. |
| **User impact** | Hard to read outdoors; “Incident follow-up” and card titles fail glanceability. |
| **Reproduction** | CSS probe or DevTools ≤390 on Dashboard. |
| **Priority** | **High** |
| **Recommended fix** | Floor titles ≥14px, labels ≥11px; allow 2-line titles; keep 2-col stats. |
| **Likely files** | `src/App.css` (~4694–4826, overview block), `Dashboard.jsx` |
| **Evidence** | `Probe` + `Code` |

#### H3 — Safety Overview still below all dashboard cards
| Field | Detail |
|--------|--------|
| **Page / component** | `Dashboard.jsx` — `.dashboard-overview` after `.dashboard__nav` |
| **Exact problem** | Open/overdue/critical counts and equipment warnings (deep-link to Machines & Equipment) remain under Site Safety / Planning / Daily grids. |
| **User impact** | Warnings easy to miss at site start; extra scroll before decision data. |
| **Priority** | **High** |
| **Recommended fix** | Move overview (+ warnings) above card groups, or pin compact alert strip under greeting. |
| **Likely files** | `Dashboard.jsx` |
| **Evidence** | `Code` |

#### H4 — Machines & Equipment still not on main dashboard
| Field | Detail |
|--------|--------|
| **Page / component** | `navigation.js` / `Dashboard` |
| **Exact problem** | `machines-equipment` is in drawer `DESKTOP_SIDEBAR_GROUPS` / Plant & Equipment, **not** in `DASHBOARD_GROUPS` / `DASHBOARD_CARDS`. No `CARD_ICONS` entry. |
| **User impact** | Extra hamburger hop for daily plant work despite dashboard warnings linking into it. |
| **Priority** | **High** |
| **Recommended fix** | Add dashboard card (Site Safety or Plant group). |
| **Likely files** | `src/constants/navigation.js`, `Dashboard.jsx` |
| **Evidence** | `Code` |

#### H5 — Equipment modal × close still ~26×26
| Field | Detail |
|--------|--------|
| **Page / component** | `.equipment-modal__close` — `EquipmentView` / `EquipmentProfileView` |
| **Exact problem** | Absolute × with no `min-width`/`min-height: var(--tap-min)`. Probe: **26×26**. Footer Cancel buttons exist on forms but × remains the primary dismiss chrome. |
| **User impact** | Miss-taps closing defect/equipment modals on site. |
| **Priority** | **High** |
| **Recommended fix** | 44×44 hit area; confirm body scroll lock while open. |
| **Likely files** | `App.css` (~6577+), equipment page modals |
| **Evidence** | `Probe` + `Code` |

#### H6 — Settings Delete still has no confirmation
| Field | Detail |
|--------|--------|
| **Page / component** | `SettingsView` + `SettingsListItem` |
| **Exact problem** | `onDelete` fires immediately; Archived Records correctly uses `PermanentDeleteModal`. |
| **User impact** | Accidental wipe of operators/machines/sites breaks form combos. |
| **Priority** | **High** |
| **Recommended fix** | Confirm modal or undo; reuse archive delete pattern. |
| **Likely files** | `SettingsView.jsx`, `SettingsListItem.jsx` |
| **Evidence** | `Code` |

#### H7 — PWA safe-area incomplete (viewport-fit + footer/drawer)
| Field | Detail |
|--------|--------|
| **Page / component** | `index.html` viewport; `.app-footer--mobile`; `.side-menu`; `.form-actions` |
| **Exact problem** | `.form-actions` uses `env(safe-area-inset-bottom)`, but `<meta name="viewport">` lacks `viewport-fit=cover`, so insets often stay **0** on iOS home-screen. Footer and side menu still have no safe-area padding. |
| **User impact** | Sign out / sticky Submit / drawer Close can sit under home indicator or notch on installed PWA. |
| **Reproduction** | Install to home screen on notched iPhone; open a form + scroll to footer. |
| **Priority** | **High** |
| **Recommended fix** | Add `viewport-fit=cover`; pad `.app` / `.app-footer--mobile` / `.side-menu` with safe-area env. |
| **Likely files** | `index.html`, `App.css`, `AppShell.jsx`, `SideMenu.jsx` |
| **Evidence** | `Code` + `Probe` (footer padding has no safe-area) |

#### H8 — Footer email still truncated / conflicting CSS
| Field | Detail |
|--------|--------|
| **Page / component** | `.app-footer__email` |
| **Exact problem** | Still `word-break: break-all` **and** `white-space: nowrap` + ellipsis; ≤390 font `0.65rem` (~10.4px). `title={email}` helps but is easy to miss. |
| **User impact** | Cannot verify signed-in account at a glance. |
| **Priority** | **High** |
| **Recommended fix** | Allow 2-line wrap **or** keep ellipsis only; drop conflicting `break-all`; bump type. |
| **Likely files** | `App.css`, `AppShell.jsx` |
| **Evidence** | `Probe` + `Code` |

#### H9 — Equipment / defects filter toolbars: many controls + unstyled inputs
| Field | Detail |
|--------|--------|
| **Page / component** | `.equipment-toolbar`, equipment tabs, GM filters |
| **Exact problem** | 5–6 selects + search + CTA wrap into a tall stack; combined with Critical C1 (tiny `.form-input`). Pill tabs wrap to multiple rows (OK height via `--tap-min`). |
| **User impact** | Slow to reach the list; mis-taps between filters. |
| **Priority** | **High** (elevated by C1) |
| **Recommended fix** | Fix `.form-input` first; then collapsible “Filters” disclosure; sticky primary CTA. |
| **Likely files** | `EquipmentView.jsx`, `GeneralMeetingView.jsx`, `App.css` |
| **Evidence** | `Code` + `Probe` |

---

### Medium

#### M1 — Sticky FormActions + mobile footer still compete
| Field | Detail |
|--------|--------|
| **Page / component** | `FormActions` on Job Start, Pre-Start, Toolbox, Incident, Timesheet, Visitor, GM, SSSP editor |
| **Exact problem** | Sticky bar + safe-area (when insets work) + always-visible mobile footer. `.job-form` has `padding-bottom: 5rem` (good), but Visitor/SSSP/Equipment layouts outside `.job-form` may still feel tight; SSSP sticky cluster can stack Print + Save + workflow CTAs. |
| **User impact** | Last fields / signatures sit under Submit; tall admin sticky stacks. |
| **Priority** | **Medium** |
| **Recommended fix** | Hide footer on form views; spacer tied to actions height; keep primary CTA singular where possible. |
| **Likely files** | `FormActions.jsx`, `App.css`, `AppShell.jsx`, form views |
| **Evidence** | `Code` |

#### M2 — Dual field systems (`FormField` / `.field__input` vs bare `.form-input` / legacy `.field`)
| Field | Detail |
|--------|--------|
| **Page / component** | Shared forms vs Equipment/Settings/Weekly/Admin filters |
| **Exact problem** | Modern forms use `FormField` + validation; equipment uses unstyled `form-input` + mixed `FormField`/`FormFields.jsx`. |
| **User impact** | Inconsistent required markers, tap size, and error chrome. |
| **Priority** | **Medium** (Critical where `form-input` is used) |
| **Recommended fix** | Standardise on `field__input` / `FormField`. |
| **Likely files** | Equipment forms/pages, Settings, Weekly, Admin |
| **Evidence** | `Code` |

#### M3 — Native `confirm` / `alert` for many destructive flows
| Field | Detail |
|--------|--------|
| **Page / component** | Clear-all records, visitor sign-out, GM delete, equipment archive (mixed), etc. |
| **Exact problem** | Native dialogs easy to miss-tap; Archived Records already has branded modals. |
| **User impact** | Accidental confirm/cancel with gloves. |
| **Priority** | **Medium** |
| **Recommended fix** | Extend `ArchiveRecordModal` / `PermanentDeleteModal` patterns. |
| **Likely files** | Multiple `src/pages/*.jsx` |
| **Evidence** | `Code` |

#### M4 — No landscape-specific layout
| Field | Detail |
|--------|--------|
| **Page / component** | Global |
| **Exact problem** | No `@media (orientation: landscape)`. Short viewport + sticky actions + header + footer leaves little form room; `.app { max-width: 480px }` leaves side bands on wide landscape phones. |
| **User impact** | Awkward Critical Risks / SSSP / long forms when rotated. |
| **Priority** | **Medium** |
| **Recommended fix** | Compact header in landscape; optionally widen past 480. |
| **Likely files** | `App.css` |
| **Evidence** | `Code` |

#### M5 — Help / App Setup still `dashboardOnly`
| Field | Detail |
|--------|--------|
| **Page / component** | `help-app-setup` in `navigation.js` |
| **Exact problem** | Not in drawer groups; only Daily dashboard card. |
| **User impact** | PWA install help unavailable mid-flow without returning to Dashboard. |
| **Priority** | **Medium** |
| **Recommended fix** | Add under Setup & Admin in `DESKTOP_SIDEBAR_GROUPS`. |
| **Likely files** | `navigation.js` |
| **Evidence** | `Code` |

#### M6 — Dashboard full-width card status crowding (GM / Visitor / SSSP)
| Field | Detail |
|--------|--------|
| **Page / component** | GM / Visitor / SSSP dashboard cards |
| **Exact problem** | Long status strings / badges with `nowrap` can wrap awkwardly beside icons at 390. |
| **User impact** | Status useful but steals tap clarity. |
| **Priority** | **Medium** |
| **Recommended fix** | Stack title then status on mobile; shorten GM copy. |
| **Likely files** | `Dashboard.jsx`, `App.css` |
| **Evidence** | `Code` |

#### M7 — Records Dashboard dense filters + many summary chips
| Field | Detail |
|--------|--------|
| **Page / component** | `RecordsDashboardView` — `.safety-summary__grid`, `.records-search__*` |
| **Exact problem** | Many summary cells + search/type/date + toggles before results; result list itself is card-friendly (`search-result`). |
| **User impact** | Slow path to a specific record on phone. |
| **Priority** | **Medium** |
| **Recommended fix** | Collapse filters by default; keep summary to top 4–6 metrics on mobile. |
| **Likely files** | `RecordsDashboardView.jsx`, `App.css` |
| **Evidence** | `Code` |

#### M8 — Action Register filter pills + dense badge headers
| Field | Detail |
|--------|--------|
| **Page / component** | `ActionRegisterView` / `ActionCard` |
| **Exact problem** | Card list is correct for mobile; header badges wrap; filter pills OK (≥44px under 640). Manual add form uses legacy `.field`. |
| **User impact** | Busy cards; acceptable but noisy. |
| **Priority** | **Medium** → Low border |
| **Recommended fix** | Tighten badge set on small screens; keep complete CTA full-width (already). |
| **Likely files** | `ActionCard.jsx`, `App.css` |
| **Evidence** | `Code` |

#### M9 — Narrow desktop / tablet (640–1023): mobile shell + wide content
| Field | Detail |
|--------|--------|
| **Page / component** | App shell between mobile and desktop sidebar |
| **Exact problem** | Desktop sidebar only ≥1024. At 640–1023: hamburger + MobileHeader remain; `.app` widens to `48rem`; form duplicate headers still show; `responsive-data-list` still uses **mobile cards** until 1024 (good). |
| **User impact** | Small laptops / large phones landscape get “phone chrome” on a wider canvas — workable but inconsistent. |
| **Priority** | **Medium** |
| **Recommended fix** | Decide tablet breakpoint: either bring sidebar earlier (e.g. 900) or deliberately polish hamburger+wide content. |
| **Likely files** | `App.css` (640–1023 / 1024 blocks), shell components |
| **Evidence** | `Code` |

#### M10 — Equipment modal `max-height: 100vh` (not `dvh`) + no focus trap audit
| Field | Detail |
|--------|--------|
| **Page / component** | `.equipment-modal` |
| **Exact problem** | Uses `100vh` (mobile browser chrome can clip); overlay scrolls (good) but close target small (H5). |
| **User impact** | Bottom of long defect forms may feel clipped behind browser UI. |
| **Priority** | **Medium** |
| **Recommended fix** | Prefer `100dvh`; ensure padding for home indicator. |
| **Likely files** | `App.css` |
| **Evidence** | `Code` |

---

### Low

#### L1 — Dashboard icons shrink to ~16–17px ≤640/390
| **Priority** | **Low** | **Files** | `App.css` | **Evidence** | `Code` |

#### L2 — Cloud sync badges `0.6rem` on mobile
| **Priority** | **Low** | **Files** | `App.css` | **Evidence** | `Code` |

#### L3 — Side menu missing top/bottom safe-area
| **Priority** | **Low** (pairs with H7) | **Files** | `App.css`, `SideMenu.jsx` | **Evidence** | `Code` |

#### L4 — `btn--small` class used but undefined
| Field | Detail |
|--------|--------|
| **Exact problem** | Markup uses `btn--small` in Equipment/GM; no CSS definition. Harmless today because `.btn` already enforces `--tap-min`. |
| **Priority** | **Low** |
| **Recommended fix** | Remove dead class or define intentional compact style that **does not** go below 44px on touch. |
| **Likely files** | `App.css`, pages using `btn--small` |
| **Evidence** | `Code` |

#### L5 — Segmented Yes selected state still muted grey
| **Priority** | **Low** | **Evidence** | `Code` (prior L2) |

#### L6 — Auth header still reuses dashboard header styles
| **Priority** | **Low–Medium** | **Evidence** | `Live` + `Code` |

#### L7 — Landscape / print tables not mobile UX (expected)
| **Priority** | **Low** | Keep print DOM off-screen; triggers already mostly ≥44px. |

---

## 5. Area-by-area notes

### Equipment
- **Register / defects / maintenance due / service / compliance:** mobile cards + desktop scroll tables — **good** (prior C1 largely closed).
- **Filters / Add / Report:** blocked by **C1** unstyled `.form-input`.
- **Profile:** lists for defects/service/docs **good**; Pre-start history **C2**; many admin action buttons wrap with tap-min **OK**; modal close **H5**.
- **Documents tab:** card pattern present — **good**.

### Records
- **Records Dashboard:** card results — **good**; filter density **M7**; dual header chrome **H1**.
- **Archived Records (admin):** card list, View/Restore ≥44px, Permanent Delete uses modal — **good**. Delete button CSS shrinks padding but `.btn` keeps 44px height (`Probe`).
- **Action Register:** card-first — **good** (**M8** polish).
- **Weekly Timesheet Summary:** filter grid + full-width toolbar under 640 — **good**; print dedicated — **good**.
- **Incident / Timesheet / Visitor / GM histories:** saved-record / visitor cards / GM `responsive-data-list` — **good** patterns; not wide HTML tables on phone.

### Forms
- Core kit (`FormSection` / `FormField` / sticky `FormActions` / 16px inputs / validation) — **strong**.
- **TimePicker12Hour** via `TimeField` — **44px / 16px** (`Probe`) — **pass**.
- **SSSP editor:** mobile section `<select>` — **pass** (prior M1 fixed); sticky multi-CTA — **M1**.
- Equipment forms — undermined by **C1**.

### Navigation
- Side menu: 44px items, overlay, body scroll lock, admin filter — **good**.
- Help missing from drawer — **M5**.
- Equipment missing from dashboard — **H4**.
- Back behaviour generally present; desktop hides Back ≥1024 — OK.

### Interaction / PWA widths
- Portrait 320–430: foundation OK; watch C1/C2/H2.
- Landscape: no dedicated rules — **M4**.
- 640–1023: hamburger shell + wider `.app` — **M9**.

---

## 6. Passed mobile checks (this pass)

- Auth login at 390: no horizontal page overflow; Sign in/up ≥44px (`Live`).
- Global page overflow clipping via `overflow-x: hidden` removed (`Probe`).
- `--tap-min: 44px` still the design token; most `.btn`, filter pills (≤640), side menu items, sign-out honor it.
- Equipment register/defects/maintenance/service/compliance **mobile cards** present (`Code`).
- Desktop equipment tables wrapped in `.data-table-scroll` (`Code`).
- SSSP mobile section navigation via select (`Code`).
- Time picker 12h selects ≥44px / 16px (`Probe`).
- Archived Records card UI + permanent delete modal (`Code` + `Probe` height).
- Timesheet / weekly print areas separated from screen UI (`Code`).
- Visitor / Action / Weekly / Staff Management card or stacked patterns remain mobile-appropriate (`Code`).
- Critical Risks accordion + 44px summaries (`Code`, prior).
- `npm run build` succeeds with PWA SW generation (see §3).

---

## 7. Top 5 fixes (ordered)

1. **Style or replace `.form-input`** so equipment/GM controls match `.field__input` (44px / 16px / full width) — **C1**.
2. **Mobile cards (or scroll wrapper) for Equipment Profile Pre-start history** — **C2**.
3. **Dashboard: readable type + move Safety Overview up + add Machines & Equipment card** — **H2 + H3 + H4**.
4. **Collapse mobile chrome** (single title + compact Back) and **44px modal close** — **H1 + H5**.
5. **PWA safe-area**: `viewport-fit=cover` + footer/drawer insets; fix footer email wrapping — **H7 + H8** (bundle Settings delete confirm **H6** in same UX pass if capacity allows).

---

## 8. Pages that need no changes (for remaining mobile usability)

These are in good shape for installed PWA / narrow widths relative to current patterns; only shared shell issues (H1/H7) apply globally:

- **AuthView** (login layout)
- **Critical Risks**
- **Visitor Sign-In** (tabs + cards; aside shared chrome/sticky)
- **Action Register** (card list)
- **Weekly Timesheet Summary** (list/print separation)
- **Archived Records** (cards + delete modal)
- **Staff Management** (stacked rows ≤640)
- **Help / App Setup** content (drawer discoverability is nav IA, not page layout)
- **Safety Alerts** card links
- **SegmentedChoice** / core Job Start–style form kit (not Equipment filters)

---

## 9. PWA-cache vs CSS/layout

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| Old layout after deploy (tables still “missing”, old CSS) | Service worker precache (~2.9 MB, `autoUpdate` + `immediate`) serving previous `index-*.css` / JS | Wait for SW update, or Application → Unregister SW + hard reload; confirm new hashed assets in Network |
| Tiny equipment filters / 13px inputs | **CSS/layout bug today** — `.form-input` has no rules | Fix CSS/classnames (not a cache issue) |
| Modal × hard to tap | **CSS** — no tap-min on `.equipment-modal__close` | Fix CSS |
| Submit OK but Sign out under home indicator | **CSS + viewport meta** — missing `viewport-fit=cover` / footer insets | Fix `index.html` + CSS; if still wrong after deploy, then consider SW cache |
| Dashboard still tiny titles after “fix” | If code changed but phone unchanged → **PWA cache**; if code still has `0.7rem`/`0.55rem` → **layout** | Check built CSS content first |
| Landscape awkward | **No landscape CSS** | Layout work, not cache |

**Rule of thumb:** If DevTools “disable cache” / incognito shows the bug, it is **CSS/layout**. If only the installed PWA shows the old UI, it is **SW cache**.

---

## 10. Landscape (separate)

- No `@media (orientation: landscape)` rules.
- Expect short content band: MobileHeader + optional FormPageHeader + sticky FormActions + footer.
- `.app { max-width: 480px }` centres a phone column on wide landscape — readable but unused horizontal space.
- Prefer separate follow-up: compact chrome + optional widen; do not conflate with portrait critical fixes.

---

## 11. Suggested regression checklist (delta-focused)

- [ ] Equipment Register filters at 390: each control ≥44px, font 16px, no iOS zoom.
- [ ] Equipment Profile Pre-start history readable without horizontal page scroll (cards or inner scroll).
- [ ] Dashboard: Equipment reachable in ≤2 taps; card titles legible; overview visible without long scroll.
- [ ] Equipment modal Close ≥44×44.
- [ ] Installed iPhone PWA: sticky Submit and Sign out clear of home indicator.
- [ ] After deploy: SW updates to new CSS hash (or hard refresh once).
- [ ] Settings delete confirms before removing list items.
- [ ] Spot-check 320 / 375 / 430 portrait; note landscape separately.

---

*End of audit. No application source was modified to produce this report. Temporary Playwright probe artifacts may exist locally and are not part of the product.*
