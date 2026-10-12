/**
 * Default document requirement checklists by matter type.
 * These are used when creating a new client to auto-generate DocumentRequirement rows.
 */

export interface ChecklistItem {
  label: string
  category: string
  isRequired: boolean
}

export const CHECKLIST_TEMPLATES: Record<string, ChecklistItem[]> = {
  // Property Lawyer
  'Sale Deed': [
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Previous Sale Deed', category: 'Property Deeds', isRequired: true },
    { label: 'Tax Receipt', category: 'Tax Receipts', isRequired: true },
    { label: '7/12 Extract', category: 'Property Deeds', isRequired: true },
  ],
  'Leave & License': [
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Property Ownership Proof', category: 'Property Deeds', isRequired: true },
    { label: 'Property Tax Receipt', category: 'Tax Receipts', isRequired: false },
  ],
  'Title Verification': [
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Title Documents', category: 'Property Deeds', isRequired: true },
    { label: 'Encumbrance Certificate', category: 'Property Deeds', isRequired: true },
  ],
  'Society Registration': [
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'Society Registration Form', category: 'Society Documents', isRequired: true },
    { label: 'Property Documents', category: 'Property Deeds', isRequired: false },
  ],
  'Gift Deed': [
    { label: 'Aadhaar Card (Donor)', category: 'ID Proofs', isRequired: true },
    { label: 'Aadhaar Card (Recipient)', category: 'ID Proofs', isRequired: true },
    { label: 'Property Ownership Proof', category: 'Property Deeds', isRequired: true },
    { label: 'Previous Sale Deed', category: 'Property Deeds', isRequired: false },
  ],

  // Litigation Lawyer
  Litigation: [
    { label: 'ID Proof (Aadhaar)', category: 'ID Proofs', isRequired: true },
    { label: 'Notice / Summons', category: 'Pleadings', isRequired: false },
    { label: 'Prior Court Orders', category: 'Court Orders', isRequired: false },
    { label: 'Vakalatnama', category: 'Pleadings', isRequired: true },
  ],

  // CA
  ITR: [
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'Form 16', category: 'Tax Returns', isRequired: true },
    { label: 'Bank Statement (All Accounts)', category: 'Bank Statements', isRequired: true },
  ],
  GST: [
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true },
    { label: 'GSTIN Certificate', category: 'GST Documents', isRequired: true },
    { label: 'Previous GST Returns', category: 'GST Documents', isRequired: false },
    { label: 'Bank Statement', category: 'Bank Statements', isRequired: true },
  ],
  Audit: [
    { label: 'PAN Card', category: 'ID Proofs', isRequired: true },
    { label: 'Bank Statements (All Accounts)', category: 'Bank Statements', isRequired: true },
    { label: 'Previous Year Returns', category: 'Tax Returns', isRequired: false },
    { label: 'Balance Sheet', category: 'Tax Returns', isRequired: true },
    { label: 'P&L Statement', category: 'Tax Returns', isRequired: true },
  ],

  // Default fallback
  default: [
    { label: 'ID Proof', category: 'ID Proofs', isRequired: true },
  ],
}

export function getChecklistTemplate(matterType: string): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[matterType] ?? CHECKLIST_TEMPLATES['default'] ?? []
}
