/** Shared navigation — single source for dashboard cards, sidebar, and mobile drawer. */

export const NAV_ITEMS = {
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    adminOnly: false,
  },
  'job-start': {
    id: 'job-start',
    title: 'Job Start',
    adminOnly: false,
    pageTitle: 'Job Start Checklist',
    pageDescription: 'Confirm site readiness before work begins',
    formView: true,
  },
  'pre-start': {
    id: 'pre-start',
    title: 'Pre-Start',
    adminOnly: false,
    pageTitle: 'Machine Pre-Start',
    pageDescription: 'Daily machine safety inspection',
    formView: true,
  },
  'machines-equipment': {
    id: 'machines-equipment',
    title: 'Machines & Equipment',
    adminOnly: false,
    pageTitle: 'Machines & Equipment',
    pageDescription: 'Plant register, defects, maintenance and compliance',
  },
  'equipment-profile': {
    id: 'equipment-profile',
    title: 'Equipment Profile',
    adminOnly: false,
    pageTitle: 'Equipment Profile',
    hideFromNav: true,
  },
  toolbox: {
    id: 'toolbox',
    title: 'Toolbox',
    adminOnly: false,
    pageTitle: 'Toolbox Meeting',
    pageDescription: 'Team safety briefing record',
    formView: true,
  },
  'general-meeting': {
    id: 'general-meeting',
    title: 'H&S General Meeting',
    adminOnly: false,
    pageTitle: 'H&S General Meeting',
    pageDescription: 'Formal health and safety meeting records',
  },
  incident: {
    id: 'incident',
    title: 'Incident',
    adminOnly: false,
    pageTitle: 'Incident / Near Miss',
    pageDescription: 'Report and record incidents',
    formView: true,
  },
  timesheet: {
    id: 'timesheet',
    title: 'Timesheet',
    adminOnly: false,
    pageTitle: 'Timesheet / Daily Work Record',
    formView: true,
  },
  'critical-risks': {
    id: 'critical-risks',
    title: 'Critical Risks',
    adminOnly: false,
    pageTitle: 'Critical Risks',
    pageDescription: 'Site reference — review before work begins',
  },
  'visitor-sign-in': {
    id: 'visitor-sign-in',
    title: 'Visitor Sign-In',
    adminOnly: false,
    pageTitle: 'Visitor Sign-In',
    pageDescription: 'Register visitors and manage on-site roll call',
  },
  sssp: {
    id: 'sssp',
    title: 'SSSP',
    adminOnly: false,
    pageTitle: 'Site-Specific Safety Plans',
    pageDescription: 'Planning & documentation — SSSP register',
  },
  'safety-alerts': {
    id: 'safety-alerts',
    title: 'Safety Alerts',
    adminOnly: false,
    pageTitle: 'Safety Alerts',
  },
  'records-dashboard': {
    id: 'records-dashboard',
    title: 'Records Dashboard',
    adminOnly: false,
    pageTitle: 'Records Dashboard',
  },
  'action-register': {
    id: 'action-register',
    title: 'Action Register',
    adminOnly: false,
    pageTitle: 'Action Register',
  },
  'admin-reports': {
    id: 'admin-reports',
    title: 'Admin Reports',
    adminOnly: true,
    pageTitle: 'Admin Reports',
  },
  'archived-records': {
    id: 'archived-records',
    title: 'Archived Records',
    adminOnly: true,
    pageTitle: 'Archived Records',
  },
  'weekly-timesheet-summary': {
    id: 'weekly-timesheet-summary',
    title: 'Weekly Summary',
    adminOnly: false,
    pageTitle: 'Weekly Timesheet Summary',
  },
  'staff-management': {
    id: 'staff-management',
    title: 'Staff Management',
    adminOnly: true,
    pageTitle: 'Staff Management',
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    adminOnly: false,
    pageTitle: 'Settings / Setup',
  },
  'backup-restore': {
    id: 'backup-restore',
    title: 'Backup / Restore',
    adminOnly: false,
    pageTitle: 'Backup / Restore',
  },
  'help-app-setup': {
    id: 'help-app-setup',
    title: 'Help / App Setup',
    adminOnly: false,
    pageTitle: 'Help / App Setup',
    dashboardOnly: true,
  },
  'sssp-editor': {
    id: 'sssp-editor',
    title: 'SSSP Editor',
    adminOnly: false,
    pageTitle: 'SSSP',
    hideFromNav: true,
  },
  'sssp-acknowledge': {
    id: 'sssp-acknowledge',
    title: 'SSSP Acknowledgement',
    adminOnly: false,
    pageTitle: 'SSSP Acknowledgement',
    hideFromNav: true,
  },
}

/** Desktop sidebar & mobile drawer groups (role-filtered). */
export const DESKTOP_SIDEBAR_GROUPS = [
  {
    id: 'daily-safety',
    title: 'Daily Safety',
    itemIds: [
      'dashboard',
      'job-start',
      'pre-start',
      'toolbox',
      'incident',
      'timesheet',
      'critical-risks',
      'visitor-sign-in',
    ],
  },
  {
    id: 'plant-equipment',
    title: 'Plant & Equipment',
    itemIds: ['machines-equipment'],
  },
  {
    id: 'planning-docs',
    title: 'Planning & Documentation',
    itemIds: ['sssp', 'general-meeting', 'safety-alerts'],
  },
  {
    id: 'records-actions',
    title: 'Records & Actions',
    itemIds: [
      'records-dashboard',
      'action-register',
      'admin-reports',
      'archived-records',
      'weekly-timesheet-summary',
    ],
  },
  {
    id: 'setup-admin',
    title: 'Setup & Admin',
    itemIds: ['staff-management', 'settings', 'backup-restore'],
  },
]

/** @deprecated Use DESKTOP_SIDEBAR_GROUPS — kept for backward compatibility. */
export const SIDEBAR_GROUPS = [
  {
    id: 'records-actions',
    title: 'Records & Actions',
    cardIds: [
      'records-dashboard',
      'action-register',
      'admin-reports',
      'archived-records',
      'weekly-timesheet-summary',
    ],
  },
  {
    id: 'setup-admin',
    title: 'Setup & Admin',
    cardIds: ['staff-management', 'settings', 'backup-restore'],
  },
]

export const DASHBOARD_GROUPS = [
  {
    id: 'site-safety',
    title: 'Site Safety',
    cardIds: [
      'job-start',
      'pre-start',
      'toolbox',
      'incident',
      'critical-risks',
      'visitor-sign-in',
    ],
  },
  {
    id: 'planning-docs',
    title: 'Planning & Documentation',
    cardIds: ['sssp', 'general-meeting'],
  },
  {
    id: 'daily',
    title: 'Daily',
    cardIds: ['timesheet', 'safety-alerts', 'help-app-setup'],
  },
]

export const DASHBOARD_CARDS = [
  {
    id: 'job-start',
    title: 'Job Start',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'pre-start',
    title: 'Machine Pre-Start',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'toolbox',
    title: 'Toolbox Meeting',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'incident',
    title: 'Incident / Near Miss',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'critical-risks',
    title: 'Critical Risks',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
    fullWidth: true,
  },
  {
    id: 'visitor-sign-in',
    title: 'Visitor Sign-In',
    group: 'site-safety',
    placement: 'mainDashboard',
    available: true,
    fullWidth: true,
  },
  {
    id: 'sssp',
    title: 'SSSP',
    subtitle: 'Site-Specific Safety Plans',
    group: 'planning-docs',
    placement: 'mainDashboard',
    available: true,
    fullWidth: true,
  },
  {
    id: 'general-meeting',
    title: 'H&S General Meeting',
    subtitle: 'Formal H&S meeting records',
    group: 'planning-docs',
    placement: 'mainDashboard',
    available: true,
    fullWidth: true,
  },
  {
    id: 'action-register',
    title: 'Action Register',
    group: 'records-actions',
    placement: 'sidebar',
    available: true,
  },
  {
    id: 'safety-alerts',
    title: 'Safety Alerts',
    group: 'records-actions',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'records-dashboard',
    title: 'Records Dashboard',
    group: 'records-actions',
    placement: 'sidebar',
    available: true,
  },
  {
    id: 'timesheet',
    title: 'Timesheet',
    group: 'daily',
    placement: 'mainDashboard',
    available: true,
  },
  {
    id: 'weekly-timesheet-summary',
    title: 'Weekly Summary',
    group: 'records-actions',
    placement: 'sidebar',
    available: true,
  },
  {
    id: 'settings',
    title: 'Settings / Setup',
    group: 'setup-admin',
    placement: 'sidebar',
    available: true,
  },
  {
    id: 'staff-management',
    title: 'Staff Management',
    group: 'setup-admin',
    placement: 'sidebar',
    available: true,
    adminOnly: true,
  },
  {
    id: 'admin-reports',
    title: 'Admin Reports',
    group: 'records-actions',
    placement: 'sidebar',
    available: true,
    adminOnly: true,
  },
  {
    id: 'archived-records',
    title: 'Archived Records',
    group: 'records-actions',
    placement: 'sidebar',
    available: true,
    adminOnly: true,
  },
  {
    id: 'backup-restore',
    title: 'Backup / Restore',
    group: 'setup-admin',
    placement: 'sidebar',
    available: true,
  },
  {
    id: 'help-app-setup',
    title: 'Help / App Setup',
    group: 'daily',
    placement: 'mainDashboard',
    available: true,
  },
]

export const FORM_VIEW_IDS = new Set([
  'job-start',
  'pre-start',
  'toolbox',
  'incident',
  'timesheet',
  'critical-risks',
  'visitor-sign-in',
  'settings',
  'backup-restore',
  'help-app-setup',
])

export function getNavItem(id) {
  return NAV_ITEMS[id] ?? null
}

export function getPageMeta(viewId) {
  const item = getNavItem(viewId)
  if (!item) {
    return { title: 'Monrad Earthworx H&S', description: null, hideHeader: false }
  }
  return {
    title: item.pageTitle ?? item.title,
    description: item.pageDescription ?? null,
    hideHeader: viewId === 'dashboard',
    formView: Boolean(item.formView),
  }
}

export function getVisibleNavItems(isAdmin) {
  return Object.fromEntries(
    Object.values(NAV_ITEMS)
      .filter((item) => !item.hideFromNav && !item.dashboardOnly)
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item) => [item.id, item]),
  )
}

export function getNavGroups(isAdmin, groups = DESKTOP_SIDEBAR_GROUPS) {
  const itemsById = getVisibleNavItems(isAdmin)
  return groups
    .map((group) => ({
      ...group,
      items: group.itemIds.map((id) => itemsById[id]).filter(Boolean),
    }))
    .filter((group) => group.items.length > 0)
}
