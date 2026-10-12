/**
 * ROLE_CONFIG — single source of truth for role-specific configuration.
 * Adding a new profession = add one entry here.
 * Nothing else in the backend may contain if(role === ...) chains for
 * document categories or field definitions; they all read from this config.
 */

export interface FieldDefinition {
  name: string
  label?: string
  type?: string
  placeholder?: string
  required: boolean
  options?: readonly string[]
  pattern?: string
}

export interface RoleConfigItem {
  label: string
  matterTypes: readonly string[]
  createFields: readonly FieldDefinition[]
  keyDateLabels: readonly string[]
  documentCategories: readonly string[]
  metrics: readonly string[]
}

export const ROLE_CONFIG: Record<'PROPERTY_LAWYER' | 'LITIGATION_LAWYER' | 'CA', RoleConfigItem> = {
  PROPERTY_LAWYER: {
    label: 'Property Attorney',
    matterTypes: ['Sale Deed', 'Leave & License', 'Title Verification', 'Society Registration', 'Gift Deed'],
    createFields: [
      { name: 'propertyRef', label: 'Property Survey No. / Area', type: 'text', required: true },
    ],
    keyDateLabels: ['Sub-Registrar appointment', 'Search report due', 'Execution date'],
    documentCategories: ['ID Proofs', 'Property Deeds', 'Tax Receipts', 'Society Documents', 'Other'],
    metrics: ['pendingSaleDeeds', 'searchReportsDue', 'subRegistrarThisWeek'],
  },
  LITIGATION_LAWYER: {
    label: 'Litigation Lawyer',
    matterTypes: ['Litigation'],
    createFields: [
      { name: 'jurisdiction', label: 'Case Jurisdiction', placeholder: 'Pune District Court', required: true },
      { name: 'opposingParty', label: 'Opposing Party', required: true },
    ],
    keyDateLabels: ['Next hearing', 'Filing due'],
    documentCategories: ['ID Proofs', 'Pleadings', 'Evidence', 'Court Orders', 'Other'],
    metrics: ['upcomingHearings', 'urgentFilings', 'activeCases'],
  },
  CA: {
    label: 'Chartered Accountant',
    matterTypes: ['ITR', 'GST', 'Audit'],
    createFields: [
      { name: 'entityType', label: 'Entity Type', type: 'select', options: ['Individual', 'Pvt Ltd', 'Trust'], required: true },
      { name: 'pan', label: 'PAN', required: true, pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' },
      { name: 'gstin', label: 'GSTIN', required: false, pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$' },
    ],
    keyDateLabels: ['Filing deadline', 'GST return due', 'Audit due'],
    documentCategories: ['ID Proofs', 'Tax Returns', 'Bank Statements', 'GST Documents', 'Other'],
    metrics: ['impendingTaxDeadlines', 'pendingGstReturns', 'unbilledTasks'],
  },
}

export type RoleKey = keyof typeof ROLE_CONFIG
export type ProfessionalRole = RoleKey

export function isProfessionalRole(role: string): role is RoleKey {
  return role in ROLE_CONFIG
}

export function getRoleConfig(role: RoleKey): RoleConfigItem {
  return ROLE_CONFIG[role]
}
