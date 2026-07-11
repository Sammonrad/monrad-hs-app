import { isActiveEquipment } from '../constants/equipmentConfig.js'
import { isServiceOverdue, isServiceDueSoon } from './equipmentMaintenance.js'
import { isDocumentExpired, isDocumentExpiringSoon } from './equipmentCompliance.js'
import { getOpenDefects } from './storage/equipmentDefectStorage.js'

export function computeEquipmentStats({
  equipment = [],
  defectRecords = [],
  serviceRecords = [],
  documentRecords = [],
}) {
  const active = equipment.filter(isActiveEquipment)
  const openDefects = getOpenDefects(defectRecords)
  const criticalDefects = openDefects.filter((d) => d.severity === 'Critical')

  let servicesOverdue = 0
  let servicesDueSoon = 0
  active.forEach((item) => {
    if (isServiceOverdue(item)) servicesOverdue += 1
    else if (isServiceDueSoon(item)) servicesDueSoon += 1
  })

  let documentsExpired = 0
  let documentsExpiringSoon = 0
  documentRecords.forEach((doc) => {
    if (isDocumentExpired(doc)) documentsExpired += 1
    else if (isDocumentExpiringSoon(doc)) documentsExpiringSoon += 1
  })

  return {
    activeAssets: active.length,
    outOfService: active.filter((item) => item.operationalStatus === 'Out of Service').length,
    openDefects: openDefects.length,
    criticalDefects: criticalDefects.length,
    servicesOverdue,
    servicesDueSoon,
    documentsExpired,
    documentsExpiringSoon,
  }
}

export function getEquipmentDashboardWarnings(stats) {
  const warnings = []
  if (stats.criticalDefects > 0) {
    warnings.push({
      id: 'critical-defects',
      text: `${stats.criticalDefects} critical machine defect${stats.criticalDefects === 1 ? '' : 's'} require${stats.criticalDefects === 1 ? 's' : ''} attention`,
      tab: 'defects',
      severity: 'critical',
    })
  }
  if (stats.outOfService > 0) {
    warnings.push({
      id: 'out-of-service',
      text: `${stats.outOfService} machine${stats.outOfService === 1 ? '' : 's'} out of service`,
      tab: 'register',
      severity: 'warning',
    })
  }
  if (stats.servicesOverdue > 0) {
    warnings.push({
      id: 'services-overdue',
      text: `${stats.servicesOverdue} machine${stats.servicesOverdue === 1 ? '' : 's'} have overdue servicing`,
      tab: 'maintenance',
      severity: 'warning',
    })
  }
  if (stats.documentsExpired > 0) {
    warnings.push({
      id: 'docs-expired',
      text: `${stats.documentsExpired} compliance document${stats.documentsExpired === 1 ? ' has' : 's have'} expired`,
      tab: 'compliance',
      severity: 'warning',
    })
  }
  if (stats.documentsExpiringSoon > 0) {
    warnings.push({
      id: 'docs-expiring',
      text: `${stats.documentsExpiringSoon} compliance document${stats.documentsExpiringSoon === 1 ? '' : 's'} expiring soon`,
      tab: 'compliance',
      severity: 'subtle',
    })
  }
  return warnings
}

export function getPreStartEquipmentWarnings(equipment, defectRecords) {
  if (!equipment) return []
  const warnings = []
  const openCritical = getOpenDefects(defectRecords).some(
    (d) => d.equipmentId === equipment.cloudId && d.severity === 'Critical',
  )
  if (openCritical) {
    warnings.push('This machine has an open Critical defect.')
  }
  if (equipment.operationalStatus === 'Out of Service') {
    warnings.push('This machine is marked Out of Service.')
  }
  if (isServiceOverdue(equipment)) {
    warnings.push('Servicing for this machine is overdue.')
  }
  return warnings
}
