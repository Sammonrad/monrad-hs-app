# Monrad Health & Safety — Mobile UI / Usability Audit

**App path:** `D:\Cursor\practice`  
**Primary test width:** 390px (iPhone-like)  
**Also considered:** 320px, 375px, 430px, mobile landscape  
**Date:** 24 Jul 2026  

**Method & limitations**
- Full read of `src/App.css` (tokens, mobile `@media (max-width: 640px)` / `390px`, shell, forms, equipment, SSSP, visitor, print).
- Layout/forms: `AppShell`, `MobileHeader`, `SideMenu`, `NavGroupList`, `PageContainer`, `PageHeader`, `FormGrid`, `DesktopSidebar`, `FormSection`, `FormField`, `FormActions`, `FormPageHeader`, `SegmentedChoice`, `ValidationMessage`, `FormFields`.
- Routes/cards/menus: `src/constants/navigation.js` + page sampling listed in §6.
- **Live browser:** Dev server at `http://localhost:5173/` (HTTP 200). Playwright screenshots of **AuthView** at **390×844** and **320×568** — no horizontal page overflow on login; inputs/buttons meet ~44px height. **Authenticated pages were not live-tested** (no demo credentials / auth blocks deeper navigation). Findings for post-login screens are marked **CSS analysis / likely at 390px** or **CSS probe (injected markup)** where a Playwright probe injected real `App.css` class markup to measure overflow/tap sizes.
- Browser MCP could not open tabs in this session; Playwright was used instead.
- No app source was modified for this audit (audit-only).

**Evidence legend:** `Live` = Playwright on real app · `Probe` = CSS-injected fragment metrics · `Code` = component/CSS/route review.

---

## 1. Executive summary

The mobile foundation is solid: `--tap-min: 44px`, form inputs forced to `font-size: 16px` under 640px (reduces iOS zoom), sticky submit bars with `safe-area-inset-bottom`, drawer overlay + body scroll lock, card-based patterns for visitors/actions/SSSP risks, and Staff Management card-stacking under 640px. Login at 390/320 looks clean and usable (`Live`).

The highest risks for field use are **wide tables that are not card-adapted** (equipment maintenance/compliance/profile history) combined with **global `overflow-x: hidden`**, which **clips** rather than scrolls content (`Probe` + `Code`). Secondary pain: **redundant mobile chrome** (hamburger header title + full `FormPageHeader` + full-width Back), **unreadably small dashboard type** at ≤390px, **missing Machines & Equipment on the main dashboard**, footer/PWA safe-area gaps, and **destructive Settings deletes without confirmation**.

---

## 2. Critical issues

### C1 — Equipment maintenance/compliance (and profile history) tables unusable on mobile
| Field | Detail |
|--------|--------|
| **Page / component** | `EquipmentView` (Maintenance due list incomplete; Service history; Compliance); `EquipmentProfileView` (pre-start history table) |
| **Width** | CSS analysis / Probe at **390px** and **320px** |
| **What is wrong** | Register/defects use `responsive-data-list` (desktop table hidden; mobile cards). Maintenance **due** block has `responsive-data-list__desktop` only — **no mobile cards**, so the due list is empty on phones. Service history and Compliance render raw `.equipment-table` with many columns. Probe measured `.equipment-table` extending to ~**669px** at 390px viewport. |
| **Why it matters** | Plant/compliance data is safety-critical; clipped or unreachable columns block site use. |
| **Recommended correction** | Mirror register/defects: mobile card list for due status, service history, compliance docs, and profile history; or wrap every multi-column table in `.data-table-scroll` with intentional horizontal scroll. Never leave desktop-only markup without a mobile counterpart. |
| **Likely files** | `src/pages/EquipmentView.jsx`, `src/pages/EquipmentProfileView.jsx`, `src/App.css` (`.equipment-table`, `.responsive-data-list*`) |
| **Severity** | **Critical** |
| **Evidence** | `Code` + `Probe` fragment D |

### C2 — Global `overflow-x: hidden` hides table overflow instead of allowing scroll
| Field | Detail |
|--------|--------|
| **Page / component** | `html`, `body`, `.app` |
| **Width** | CSS analysis / Probe — document `scrollWidth` stays equal to viewport while child tables overflow |
| **What is wrong** | `overflow-x: hidden` on `html`/`body`/`.app` (App.css ~L81–98) clips overflowing tables. Users cannot pan to see clipped columns. |
| **Why it matters** | Turns a scrollable table into permanently inaccessible content. |
| **Recommended correction** | Prefer overflow containment on specific sections; for data tables use an inner `.data-table-scroll { overflow-x: auto }` and avoid clipping ancestors. Audit other wide print/admin tables similarly. |
| **Likely files** | `src/App.css` |
| **Severity** | **Critical** |
| **Evidence** | `Code` + `Probe` |

---

## 3. High-priority issues

### H1 — Triple vertical chrome on form/pages (menu title + page header + full-width Back)
| Field | Detail |
|--------|--------|
| **Page / component** | `AppShell` + `MobileHeader` + per-page `BackButton` + `FormPageHeader` / `.header` |
| **Width** | CSS analysis / likely at **390px** |
| **What is wrong** | Mobile header shows logo + `pageTitle`; each form also renders `FormPageHeader` (“Monrad Earthworx”, H1 title, subtitle, date) and a **full-width** `.back-btn` under `@media (max-width: 640px)`. Desktop correctly hides form headers (`App.css` ~L5725–5731) but mobile does not reduce duplication. |
| **Why it matters** | Burns ~150–200px before the first field; gloves/outdoor use needs content first. |
| **Recommended correction** | On mobile: keep Back + one title source (header **or** `FormPageHeader`); hide company/date duplicate; make Back inline (not 100% width) beside title. |
| **Likely files** | `AppShell.jsx`, `MobileHeader.jsx`, `FormPageHeader.jsx`, `BackButton.jsx`, `App.css` |
| **Severity** | **High** |
| **Evidence** | `Code` |

### H2 — Dashboard card titles and Safety Overview labels too small at ≤390px
| Field | Detail |
|--------|--------|
| **Page / component** | `Dashboard` — `.dashboard-card__title`, `.dashboard-overview__stat-label` |
| **Width** | Probe **390px**: card title **11.2px**; overview label **8.8px**. CSS `@media (max-width: 390px)` sets title `0.7rem`, overview labels `0.55rem`. |
| **What is wrong** | Site Safety cards (“Incident / Near Miss”, etc.) and overview chips (“Incident follow-up”) become hard to read in sunlight. |
| **Why it matters** | Primary navigation and safety counts must be glanceable. |
| **Recommended correction** | Floor card titles ≥14px / labels ≥11px at 390; allow 2-line titles; consider 2-col overview or fewer stats on small phones. |
| **Likely files** | `src/App.css` (~L4433–4575, ~L293–326), `Dashboard.jsx` |
| **Severity** | **High** |
| **Evidence** | `Probe` + `Code` |

### H3 — Safety Overview placed below all nav cards
| Field | Detail |
|--------|--------|
| **Page / component** | `Dashboard.jsx` — `.dashboard-overview` after `.dashboard__nav` |
| **Width** | CSS analysis / likely at **390px** |
| **What is wrong** | “Today’s site safety overview” (open/overdue/critical actions, today’s counts, warnings) sits **under** Site Safety / Planning / Daily grids. Warnings (including equipment) are easy to miss until scroll. |
| **Why it matters** | Overview is the decision surface for site start; burying it reduces compliance. |
| **Recommended correction** | Move overview (+ warnings) above card groups, or pin a compact alert strip under the greeting. |
| **Likely files** | `Dashboard.jsx` |
| **Severity** | **High** |
| **Evidence** | `Code` |

### H4 — Machines & Equipment missing from dashboard cards
| Field | Detail |
|--------|--------|
| **Page / component** | Navigation / Dashboard |
| **Width** | N/A (IA) — mobile users |
| **What is wrong** | `machines-equipment` is in `DESKTOP_SIDEBAR_GROUPS` / drawer only — **not** in `DASHBOARD_GROUPS` / `DASHBOARD_CARDS`. Staff must open the hamburger to reach plant register despite dashboard warnings deep-linking into it. |
| **Why it matters** | Extra discovery cost for a daily plant workflow. |
| **Recommended correction** | Add a main-dashboard card (Plant & Equipment group or Site Safety) matching drawer title. |
| **Likely files** | `src/constants/navigation.js`, `Dashboard.jsx` (`CARD_ICONS`) |
| **Severity** | **High** |
| **Evidence** | `Code` |

### H5 — Equipment modal close control below 44px tap target
| Field | Detail |
|--------|--------|
| **Page / component** | `.equipment-modal__close` — `EquipmentView` / `EquipmentProfileView` modals |
| **Width** | Probe **390px**: close control **~26×26px** |
| **What is wrong** | Absolute × button has no `min-width`/`min-height: var(--tap-min)`; easy to miss-tap; may conflict with first form fields. |
| **Why it matters** | Add/edit defect/equipment flows are frequent; dismiss must be reliable. |
| **Recommended correction** | 44×44 hit area; optional Cancel in footer; trap focus / lock body scroll while open (confirm overlay behavior). |
| **Likely files** | `App.css` (~L6146+), equipment page modals |
| **Severity** | **High** |
| **Evidence** | `Probe` + `Code` |

### H6 — Settings Delete has no confirmation
| Field | Detail |
|--------|--------|
| **Page / component** | `SettingsView` + `SettingsListItem` |
| **Width** | CSS analysis / likely at **390px** |
| **What is wrong** | `onDelete` runs immediately (no `window.confirm`, unlike backup import, clear-all records, staff self-demotion). Red Delete is near list content. |
| **Why it matters** | Accidental wipe of operators/machines/sites breaks form combos on site. |
| **Recommended correction** | Confirm dialog or undo snackbar before delete. |
| **Likely files** | `SettingsView.jsx`, `SettingsListItem.jsx` |
| **Severity** | **High** |
| **Evidence** | `Code` |

### H7 — Mobile footer lacks safe-area padding (PWA / home-indicator)
| Field | Detail |
|--------|--------|
| **Page / component** | `.app-footer.app-footer--mobile` |
| **Width** | Probe / CSS — footer `padding-bottom` does **not** use `env(safe-area-inset-bottom)`; only `.form-actions` does |
| **What is wrong** | Account email + Sign out sit above home indicator without inset; sticky submit + footer can stack awkwardly above the gesture bar. |
| **Why it matters** | Sign-out / account targets become hard to hit on notched iPhones when installed to home screen. |
| **Recommended correction** | Add safe-area padding to `.app` bottom and/or `.app-footer--mobile`; ensure form pages leave clearance above sticky actions. |
| **Likely files** | `App.css`, `AppShell.jsx` |
| **Severity** | **High** |
| **Evidence** | `Probe` + `Code` |

### H8 — Footer email ellipsis fights `word-break: break-all`
| Field | Detail |
|--------|--------|
| **Page / component** | `.app-footer__email` |
| **Width** | CSS analysis / likely at **390px** (`font-size: 0.65rem` under 390px) |
| **What is wrong** | Rules set both `word-break: break-all` and `white-space: nowrap` + `text-overflow: ellipsis`. Long emails truncate unreadably at tiny size. |
| **Why it matters** | Users cannot verify which account is signed in. |
| **Recommended correction** | Allow 2-line wrap **or** keep ellipsis with `title={email}` (already present) and larger type; drop conflicting `break-all` with `nowrap`. |
| **Likely files** | `App.css` (~L624–633, ~L4594–4596), `AppShell.jsx` |
| **Severity** | **High** |
| **Evidence** | `Code` |

---

## 4. Medium-priority issues

### M1 — SSSP section nav requires horizontal swipe (easy to miss)
| Field | Detail |
|--------|--------|
| **Page / component** | `SsspEditorView` — `.sssp-section-nav` |
| **Width** | Probe **390/320**: section buttons extend past viewport; parent has `overflow-x: auto` |
| **What is wrong** | Many short (`min-width: 4.5rem`, `font-size: 0.68rem`) pills scroll sideways with weak affordance. |
| **Why it matters** | Incomplete SSSP sections if users never discover later tabs. |
| **Recommended correction** | Edge fades / “swipe for sections” hint; or mobile accordion/select for section; ensure each nav button ≥44px height (mostly OK). |
| **Likely files** | `App.css` (~L4958–4977), SSSP nav component |
| **Severity** | **Medium** |
| **Evidence** | `Probe` + `Code` |

### M2 — Sticky `.form-actions` can cover last fields / compete with footer
| Field | Detail |
|--------|--------|
| **Page / component** | `FormActions` on Job Start, Pre-Start, Toolbox, Incident, Timesheet, Visitor, GM, SSSP editor, etc. |
| **Width** | CSS analysis / likely at **390px** (`position: sticky; bottom: 0; z-index: 10`) |
| **What is wrong** | Sticky bar is intentional and has gradient + safe-area, but pages lack consistent `padding-bottom` under the form for the bar height + mobile footer. Focused inputs near bottom can sit under the bar / keyboard. |
| **Why it matters** | Submit and Cloud/Local hints may obscure validation or signature fields. |
| **Recommended correction** | Spacer equal to actions height; scroll-into-view on focus/error (partially exists via `scrollToFirstInvalid`); consider hiding footer on form views. |
| **Likely files** | `FormActions.jsx`, `App.css` (`.form-actions`), form views |
| **Severity** | **Medium** |
| **Evidence** | `Code` + `Probe` (sticky confirmed) |

### M3 — Full-width dashboard cards: long status / visitor badge crowding
| Field | Detail |
|--------|--------|
| **Page / component** | Critical Risks, Visitor Sign-In, SSSP, H&S General Meeting cards |
| **Width** | CSS analysis / likely at **390px** (`.dashboard-card--full-width`, badges `white-space: nowrap`) |
| **What is wrong** | Row layout + visitor badge / GM status strings (`Last: … · Next due: … · Overdue · N open actions`) can wrap awkwardly or feel cramped beside icons. |
| **Why it matters** | Status is useful but can steal tap clarity / wrap into tiny type. |
| **Recommended correction** | Stack title then status on mobile; allow badge wrap; shorten GM copy. |
| **Likely files** | `Dashboard.jsx`, `App.css` (`.dashboard-card--full-width`, `.dashboard-card__gm-status`, `.dashboard-card__visitor-badge`) |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M4 — Safety Overview 4× grid with 7 stats
| Field | Detail |
|--------|--------|
| **Page / component** | `.dashboard-overview__stats` — `repeat(4, minmax(0, 1fr))` |
| **Width** | **390 / 375 / 320** |
| **What is wrong** | Seven chips → uneven last row; labels like “Incident follow-up” at ~8.8px. At 320 only slightly better if still 4-col. |
| **Why it matters** | Density without hierarchy. |
| **Recommended correction** | 2 columns under 400px, or horizontal scroll snap, or top-4 metrics + “more”. |
| **Likely files** | `App.css`, `Dashboard.jsx` |
| **Severity** | **Medium** |
| **Evidence** | `Code` + `Probe` |

### M5 — Equipment / GM filter toolbars: many controls wrapping
| Field | Detail |
|--------|--------|
| **Page / component** | `.equipment-toolbar`, `.gm-dashboard__filters`, records/admin filter panels |
| **Width** | CSS analysis / likely at **390px** |
| **What is wrong** | Multiple selects + date inputs + primary button wrap into tall stacks; pill tabs (`.equipment-tabs__btn`, `border-radius: 999px`) wrap to multiple rows. |
| **Why it matters** | Slow to reach the list; easy mis-tap between filters. |
| **Recommended correction** | Collapsible “Filters” disclosure; sticky primary CTA; ensure each control full-width ≥44px (partially done). |
| **Likely files** | `EquipmentView.jsx`, `GeneralMeetingView.jsx`, `App.css` |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M6 — Dual field systems (`FormField` vs legacy `.field` in `FormFields.jsx`)
| Field | Detail |
|--------|--------|
| **Page / component** | Shared forms vs Settings / Weekly / Admin filters |
| **Width** | CSS analysis / likely at **390px** |
| **What is wrong** | New forms use `FormField` + required `*` + inline `ValidationMessage`. Combo/date helpers still use `.field` without required markers / same error chrome. |
| **Why it matters** | Inconsistent required indication and error placement across the app. |
| **Recommended correction** | Migrate remaining pages to `FormField` or share error/required styles. |
| **Likely files** | `FormFields.jsx`, Settings/Weekly/Admin/Visitor mixed usage |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M7 — `window.confirm` / `alert` for destructive and validation UX
| Field | Detail |
|--------|--------|
| **Page / component** | Clear-all saved records, visitor sign-out, backup import, GM delete, archive equipment, Settings duplicates (`alert`) |
| **Width** | All mobile |
| **What is wrong** | Native dialogs are easy to miss-tap, not branded, and block the UI; inconsistent with in-app validation summaries. |
| **Why it matters** | Accidental confirm/cancel on gloves; poor accessibility. |
| **Recommended correction** | In-app modal with large Cancel / Confirm (destructive styled) and 44px targets. |
| **Likely files** | Multiple `src/pages/*.jsx` |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M8 — No landscape-specific layout rules
| Field | Detail |
|--------|--------|
| **Page / component** | Global |
| **Width** | Mobile landscape (e.g. 844×390) |
| **What is wrong** | No `@media (orientation: landscape)` rules. Short viewport + sticky actions + header + footer leaves little form room; `.app { max-width: 480px }` leaves empty side bands on wide landscape. |
| **Why it matters** | Tablets rotated / phones landscape common for reading Critical Risks / SSSP. |
| **Recommended correction** | Compact header in landscape; reduce sticky chrome; optionally widen content past 480 in landscape. |
| **Likely files** | `App.css` |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M9 — Help / App Setup only on dashboard (`dashboardOnly`)
| Field | Detail |
|--------|--------|
| **Page / component** | `help-app-setup` — `NAV_ITEMS.dashboardOnly: true` |
| **Width** | Navigation |
| **What is wrong** | Not in drawer groups; only Daily dashboard card. Users in other flows cannot reopen Help without returning to Dashboard. |
| **Why it matters** | PWA install help is needed when stuck mid-flow. |
| **Recommended correction** | Add Help under Setup & Admin in `DESKTOP_SIDEBAR_GROUPS` (keep dashboard card if desired). |
| **Likely files** | `navigation.js` |
| **Severity** | **Medium** |
| **Evidence** | `Code` |

### M10 — Auth / blocked views use dashboard header chrome without menu
| Field | Detail |
|--------|--------|
| **Page / component** | `AuthView`, `AccessBlockedView` — `.dashboard__header` |
| **Width** | **Live 390 / 320** — looks fine; note CSS negative margins assume `.app` padding |
| **What is wrong** | Reuses dashboard header styles; works visually on login (`Live`) but couples auth layout to dashboard metrics (e.g. 480px header bleed rules). |
| **Why it matters** | Future dashboard header tweaks can regress login. |
| **Recommended correction** | Dedicated `.auth-header` classes sharing logo/tagline only. |
| **Likely files** | `AuthView.jsx`, `AccessBlockedView.jsx`, `App.css` |
| **Severity** | **Medium** |
| **Evidence** | `Live` + `Code` |

### M11 — System font stack (industrial brand elsewhere)
| Field | Detail |
|--------|--------|
| **Page / component** | `body` font-family |
| **Width** | All |
| **What is wrong** | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` — functional, not distinctive; fine for utility H&S but titles lack hierarchy vs logo. |
| **Why it matters** | Minor brand/readability polish, not blocking. |
| **Recommended correction** | Optional display font for titles only; keep system for body/forms (16px inputs stay). |
| **Likely files** | `App.css` |
| **Severity** | **Medium** (visual polish bordering Low) |
| **Evidence** | `Code` |

---

## 5. Minor polish issues

### L1 — Dashboard card icons shrink to 16–17px at ≤640/390
| Field | Detail |
|--------|--------|
| **Page / component** | `.dashboard-card__icon` |
| **Width** | ≤640 / ≤390 |
| **What is wrong** | Icons become hard to distinguish; Lucide size prop 18 overridden by CSS width/height. |
| **Why it matters** | Visual scanning weaker. |
| **Recommended correction** | Keep ≥20px icons; slightly taller cards if needed. |
| **Likely files** | `App.css` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L2 — Segmented Yes/No/N/A selected “Yes” uses grey, not strong success cue
| Field | Detail |
|--------|--------|
| **Page / component** | `SegmentedChoice` — `.segmented-choice__btn--yes--selected` |
| **Width** | CSS analysis / Probe OK for overflow |
| **What is wrong** | Yes selected = grey fill; No = red. Fine for caution, but Yes can look “inactive”. |
| **Why it matters** | Mild state ambiguity on long checklists. |
| **Recommended correction** | Subtle success border/background for Yes if brand allows. |
| **Likely files** | `App.css`, `SegmentedChoice.jsx` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L3 — Cloud sync badges very small on mobile (`0.6rem`)
| Field | Detail |
|--------|--------|
| **Page / component** | `.cloud-sync-status--small` under 640px |
| **Width** | ≤640 |
| **What is wrong** | Hard to read Local/Cloud/Pending on saved records. |
| **Why it matters** | Sync trust is important offline. |
| **Recommended correction** | ≥11px or icon + short text. |
| **Likely files** | `App.css` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L4 — `form-tabs` fixed 2-column grid
| Field | Detail |
|--------|--------|
| **Page / component** | `.form-tabs` |
| **Width** | 390 |
| **What is wrong** | Always `repeat(2, 1fr)`; odd tab counts leave a gap; long labels wrap. |
| **Why it matters** | Minor unevenness. |
| **Recommended correction** | `auto-fit` / scroll row for 3+ tabs. |
| **Likely files** | `App.css` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L5 — Side menu width `min(18rem, 88vw)` — fine, but no top safe-area
| Field | Detail |
|--------|--------|
| **Page / component** | `.side-menu` |
| **Width** | Notched phones |
| **What is wrong** | Drawer uses `100dvh` without `env(safe-area-inset-top)`. Close button may sit under status bar / notch. |
| **Why it matters** | Occasional hard-to-hit Close. |
| **Recommended correction** | Padding-top/bottom safe-area on `.side-menu`. |
| **Likely files** | `App.css`, `SideMenu.jsx` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L6 — Print areas / print tables not mobile UX (expected)
| Field | Detail |
|--------|--------|
| **Page / component** | `.print-area`, weekly/admin/SSSP/equipment print tables |
| **Width** | Screen mobile |
| **What is wrong** | Print layouts are desktop-oriented (OK for print). On-screen “Print / PDF” still useful. |
| **Why it matters** | Don’t try to use print DOM as mobile UI. |
| **Recommended correction** | Keep `display: none` on screen; ensure trigger buttons remain full-width ≥44px (already mostly true). |
| **Likely files** | Print components + `App.css` `@media print` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

### L7 — Cards use `box-shadow: none` / flat borders
| Field | Detail |
|--------|--------|
| **Page / component** | Theme tokens `--card-shadow: none` |
| **Width** | All |
| **What is wrong** | Flat industrial look; depth relies on 1px borders + red top accent — intentional but low separation on grey bg. |
| **Why it matters** | Polish only. |
| **Recommended correction** | Optional very light elevation on interactive cards only. |
| **Likely files** | `App.css` `:root` |
| **Severity** | **Low** |
| **Evidence** | `Code` |

---

## 6. Page-by-page findings

### Login — `AuthView` (**Live** 390 & 320)
- **Looks good:** Centered logo + tagline; white `.auth-card`; Email/Password labels bold; Sign in red full-width (~51px); Sign up secondary (~44px); no horizontal overflow; side gutters ~14px.
- **Issues:** Supabase-oriented subtitle may confuse non-technical staff (`Medium` copy). Header reuses `.dashboard__header` (`M10`). Auth blocked deeper audit.

### Pending / disabled — `AccessBlockedView` (`Code`)
- Same header pattern as auth; clear title/message; Sign out uses `.submit-btn` (large). Ensure message wraps on 320 (`likely OK`). No live screenshot.

### Dashboard (`Code` + Probe fragments A/B)
- Greeting + date compact — good.
- Site Safety 2-col grid; full-width Critical Risks / Visitor / SSSP / GM — structure good; type size / overview placement / missing Equipment — **H2, H3, H4, M3, M4, L1**.
- Safety Alerts badge count — good affordance when >0.
- Account/sign-out live in shell footer, not on dashboard body — OK if footer usable (**H7/H8**).
- Blank space: `.app` max-width 480 centers content on 430px phones — acceptable.

### Mobile side menu — `SideMenu` + `NavGroupList` (`Code` + Probe E)
- Overlay click closes; Escape closes; `body.style.overflow = hidden` while open; navigate closes drawer — **good**.
- Active state `.side-menu__item--active` red border/bg — good.
- Items `min-height: 44px` — good.
- Admin-only items filtered via `getNavGroups` — good.
- Help absent from drawer (`M9`). Safe-area (`L5`).

### Safety Alerts — `SafetyAlertsView` (`Code`)
- Card list with alert/clear variants; links `min-height: 3rem` under 640 — good.
- Empty/clear messaging patterns present in CSS (`.safety-alert-card--clear`) — verify empty copy in UI when live.

### Job Start / Pre-Start / Toolbox / Incident / Timesheet (`Code`)
- Shared pattern: Back + `FormPageHeader` + `FormSection` + sticky `FormActions` + validation summary + Saving… + cloud messaging — strong form system.
- Issues: **H1**, **M2**, checklist touch via `.item__label` min 44px under 640 — good.
- Timesheet: `inputMode="decimal"` / `type="number"` — good for numeric keyboard; Incident lacks similar where numeric — check fields if any (`Low`).
- Clear-all uses confirm — OK but native (`M7`).
- Pre-Start defect create confirm — OK.

### Critical Risks (`Code`)
- Accordion `details` with 44px summaries; stop-work blocks use Monrad red — excellent mobile reference UX.
- Still has redundant header chrome (**H1**).

### Visitor Sign-In (`Code`)
- Tabs + badge for on-site count; card lists for on-site/history (not tables) — **good**.
- Long form + sticky actions (`M2`); acknowledgements use large `.item__label` — good.
- Critical Risks jump button present — good navigation.

### H&S General Meeting (`Code`)
- Dashboard filters/tabs; history uses `responsive-data-list` mobile cards — good.
- Form uses `FormActions` draft/complete — good.
- Delete confirm native (`M7`). Long GM status on dashboard card (`M3`).

### SSSP dashboard / editor / acknowledgement / print (`Code` + Probe G)
- Dashboard: search + tabs + `.sssp-card` actions wrap — generally mobile-friendly.
- Editor: horizontal section nav (`M1`); sticky multi-button `FormActions` can stack many workflow buttons (Save Draft / Ready / Approve…) — tall sticky cluster on 390 (`Medium`→ border High for admins).
- Risk register: mobile cards default; desktop table at ≥1024 — **good**.
- Acknowledgement: simple form + warning/success — good.
- Print controls: buttons OK; print CSS separate.

### Machines & Equipment — dashboard / register / profile / defects / maintenance / compliance / forms (`Code` + Probe D/J)
- Register + defects: responsive cards — good.
- Maintenance due: **missing mobile list (C1)**; service history + compliance raw tables (**C1/C2**).
- Profile: action buttons wrap with tap-min; pre-start history raw table (**C1**).
- Modals: scrollable overlay — good; close target (**H5**).
- Stats 2×2 grid on mobile — good.

### Records Dashboard (`Code`)
- Search/filters stack; result cards expected — generally OK.
- Many toggles increase scroll (`M5`). Loading/error strings present in code.

### Action Register (`Code`)
- `ActionCard` list — mobile appropriate; complete/print actions; filters.
- Badge “N open” in drawer — good.
- Dense card headers with many badges — may wrap (`Low`).

### Admin Reports (`Code`)
- Admin-only gate; filter panel + grouped result **lists** (not wide HTML tables on screen) — better than equipment tables.
- Still heavy filter UI on phone (`M5`).

### Weekly Timesheet Summary (`Code`)
- Card/list week groups — good mobile pattern.
- Toolbar buttons full-width under 640 — good.
- Filters via ComboField legacy styles (`M6`).

### Staff Management (`Code`)
- Admin-only; under 640 table becomes stacked labeled blocks — **good intentional pattern**.
- Save `min-height: 44px`; self-demotion/disable confirms — good.
- Dense per-user editors still long on 320 — acceptable for admin.

### Settings (`Code`)
- Lists + Delete (**H6**); delete styled with red border — visible destructive but no confirm.
- Add forms use `.field` — OK.

### Backup / Restore (`Code`)
- Clear warnings; import confirm — good.
- Long success message may wrap heavily — OK.
- Uses `.header` not `FormPageHeader` — slight inconsistency (`Low`).

### Help / App Setup (`Code`)
- Readable sections; iPhone/Android install steps — good for PWA.
- Drawer omission (`M9`).

### Shell footer / account (`Code`)
- Always on mobile main app; hidden on desktop (≥1024).
- Issues **H7**, **H8**. Sign out meets tap-min.

---

## 7. Shared component inconsistencies

| Area | Observation |
|------|-------------|
| **Headers** | `MobileHeader` page title vs `FormPageHeader` / `.header` / desktop `PageHeader` — three systems; mobile shows two. |
| **Back** | Full-width under 640; desktop hidden in shell — asymmetric. |
| **Data lists** | `responsive-data-list` used well for equipment register/defects/GM history; **not** applied to maintenance/compliance/profile tables. |
| **Forms** | Modern `FormSection`/`FormField`/`FormActions`/`SegmentedChoice` vs legacy `FormFields.jsx` `.field`. |
| **Validation** | Summary + field errors on modern forms; Settings uses `alert` for duplicates. |
| **Destructive** | Mix of confirm / no confirm / red text buttons. |
| **Tabs** | `.form-tabs`, `.equipment-tabs`, `.visitor-sign-in__tabs`, `.sssp-dashboard__tabs`, `.gm-dashboard__tab` — similar but not identical spacing/radius (pills vs squares). |
| **Touch** | Most primary controls honor `--tap-min`; exceptions: `.equipment-modal__close`, some badge-only hits, tiny overview labels (not targets but related). |
| **Safe-area** | Present on `.form-actions` only; missing on footer/drawer/app padding. |
| **Overflow strategy** | Global hidden vs intentional section scroll — conflict on tables. |

---

## 8. Recommended fix order

1. **C1 + C2** — Mobile card (or scroll) patterns for all equipment tables; stop clipping overflow on data regions.  
2. **H5** — Modal close / dialog chrome tap targets + focus/scroll lock audit.  
3. **H1** — Collapse mobile form chrome (single title + compact Back).  
4. **H2 + H3 + M4** — Readable dashboard type; move Safety Overview up; simplify stats layout.  
5. **H4 + M9** — Dashboard card for Machines & Equipment; Help in drawer.  
6. **H6 + M7** — Confirm/undo for Settings deletes; replace native confirms with in-app dialogs over time.  
7. **H7 + H8 + L5** — Safe-area + readable account email.  
8. **M1 + M2** — SSSP nav affordance; form sticky clearance vs footer.  
9. **M5 + M6 + M8** — Filter UX, field system convergence, landscape pass.  
10. **Low** polish (icons, badges, Yes color, tabs, shadows).

---

## 9. Pages that already look good

- **Auth login** at 390/320 — spacing, brand, CTA hierarchy, no overflow (`Live`).
- **Critical Risks** — accordion, stop-work styling, 44px summaries (`Code`).
- **Visitor Sign-In** — tabbed card UX for on-site/history (`Code`).
- **Action Register / Weekly Summary / Admin Reports (on-screen lists)** — card/list-first, not desktop tables (`Code`).
- **SSSP risk register mobile cards** + status badges (`Code`).
- **Staff Management** mobile stacked table pattern (`Code`).
- **Side menu** — overlay dismiss, scroll lock, active state, 44px items (`Code`).
- **Core form kit** — `FormSection`, required markers, sticky submit + Saving…, 16px inputs under 640 (`Code`).
- **SegmentedChoice** — 44px options, error outline (`Code` + Probe I).
- **Help install instructions** — clear PWA steps (`Code`).

---

## 10. Suggested regression-test checklist

Use real device or DevTools; primary **390×844**; spot-check **320**, **375**, **430**, and **landscape**.

**Auth / access**
- [ ] Login at 390/320: no horizontal scroll; Sign in/up ≥44px; keyboard does not break layout.
- [ ] Pending and Disabled screens: message readable; Sign out tappable above home indicator.

**Shell / nav**
- [ ] Open drawer: body does not scroll; tap overlay closes; Escape closes; select item navigates and closes.
- [ ] Active item highlighted for current view.
- [ ] Admin-only items hidden for staff; visible for admin.
- [ ] Back from nested views (equipment profile, SSSP editor, acknowledge) returns expected parent — no trap.
- [ ] Footer email readable or `title` tooltip; Sign out ≥44px; safe-area on iPhone PWA.

**Dashboard**
- [ ] All cards open correct routes; full-width Critical Risks / Visitor / SSSP / GM usable with badges/status.
- [ ] Safety Overview visible without excessive scroll; warnings tappable to Equipment where linked.
- [ ] Machines & Equipment reachable in ≤2 taps (after fix).
- [ ] Card titles legible in outdoor brightness.

**Forms (Job Start, Pre-Start, Toolbox, Incident, Timesheet)**
- [ ] No horizontal scroll; date/time usable; numeric keyboards where expected.
- [ ] Required `*`; validation summary + field errors; values persist after failed submit.
- [ ] Sticky Submit shows Saving…; Cloud/Local messages readable; not covering signature permanently.
- [ ] Yes/No/N/A ≥44px; checkboxes/labels ≥44px.
- [ ] Clear-all confirm works; does not double-submit.

**Visitor / GM / Critical Risks**
- [ ] Tabs switch; on-site sign-out confirm; history cards open detail.
- [ ] GM filters + history cards; complete/draft sticky actions.
- [ ] Critical Risks accordions expand; content not clipped.

**SSSP**
- [ ] Dashboard tabs/search/cards; editor section nav reachable for all sections.
- [ ] Risk register editable on mobile cards; sticky workflow buttons usable.
- [ ] Acknowledgement success/warning; print triggers without breaking layout.

**Equipment**
- [ ] Register/defects cards; add/edit modal: close ≥44px; form scrollable; save errors visible.
- [ ] Maintenance due **visible** on mobile; service history & compliance fully readable (cards or inner scroll).
- [ ] Profile history readable; archive confirm.

**Records / Actions / Weekly / Admin / Staff / Settings / Backup / Help / Alerts**
- [ ] Filters usable; empty and loading states copy shown.
- [ ] Action complete/print; Staff stacked rows save; Settings delete confirm (after fix).
- [ ] Backup export/import confirm; Help readable; Alerts links navigate correctly.

**Overflow / PWA**
- [ ] No page-level horizontal scroll at 320–430.
- [ ] Wide data regions scroll **inside** a container, never clipped by `overflow-x: hidden` ancestors.
- [ ] Landscape: sticky submit + header leave a usable content band.

---

*End of audit. No application code was changed to produce this report.*
