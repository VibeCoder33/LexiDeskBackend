import 'dotenv/config'
import prisma from './lib/prisma'
import { logger } from './lib/logger'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { ClientStatus, VerificationStatus, Role } from './generated/prisma/enums'
import { Prisma } from './generated/prisma/client'

const DEV_PASSWORD = process.env.DEV_PASSWORD || 'LexiDesk@2024'

function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

interface SeedDoc {
  name: string
  status: VerificationStatus
  type?: string
  note?: string
  unreviewed?: boolean
}

interface SeedReq {
  label: string
  category: string
  isRequired: boolean
  doc: SeedDoc | null
}

interface SeedClient {
  name: string
  phone: string
  matterType: string
  status: ClientStatus
  details: Record<string, unknown>
  keyDateLabel?: string
  keyDateDays?: number
  isBilled?: boolean
  linkStatus: string
  reqs: SeedReq[]
}

interface SeedProfessional {
  name: string
  email: string
  mobile: string
  role: Role
  firmName: string
  firmAddress: string
  firmPhone: string
  notes: string[]
  clients: SeedClient[]
}

async function main() {
  logger.info('Starting LexiDesk Comprehensive Seed...')

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12)

  // 1. Super Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@lexidesk.dev'
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, isActive: true },
    create: {
      name: 'Super Admin',
      email: adminEmail,
      mobile: '+919999999999',
      passwordHash,
      role: Role.SUPER,
      isActive: true,
      firmName: 'LexiDesk HQ',
      firmAddress: 'Cyber City, Gurugram, India',
      firmPhone: '+919999999999',
    },
  })
  logger.info({ email: adminEmail }, 'Seeded Super Admin user')

  // 2. Demo Professional Users
  const professionals: SeedProfessional[] = [
    {
      name: 'Rasika Naik',
      email: 'property@lexidesk.dev',
      mobile: '+919876543001',
      role: Role.PROPERTY_LAWYER,
      firmName: 'Naik & Associates Legal',
      firmAddress: 'Shivajinagar, Pune, Maharashtra 411005',
      firmPhone: '+919876543001',
      notes: [
        'Need to follow up with Haveli Sub-Registrar Office regarding survey 45/2 document index.',
        'Call Suresh Kulkarni regarding original 7/12 extract verification before Friday.',
        'Review Baner redevelopment society resolution agreement.',
      ],
      clients: [
        {
          name: 'Suresh Kulkarni',
          phone: '+919822011111',
          matterType: 'Sale Deed',
          status: ClientStatus.ACTION_NEEDED,
          details: { propertyRef: 'Survey 45/2, Baner, Pune' },
          keyDateLabel: 'Sub-Registrar appointment',
          keyDateDays: 2, // This week!
          linkStatus: 'active',
          reqs: [
            { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true, doc: { name: 'kulkarni_aadhaar.pdf', status: VerificationStatus.VERIFIED, type: 'AADHAAR_CARD', unreviewed: true } },
            { label: 'PAN Card', category: 'ID Proofs', isRequired: true, doc: { name: 'kulkarni_pan.pdf', status: VerificationStatus.VERIFIED, type: 'PAN_CARD', unreviewed: false } },
            { label: 'Previous Sale Deed', category: 'Property Deeds', isRequired: true, doc: { name: 'previous_deed_1998.pdf', status: VerificationStatus.NEEDS_REVIEW, type: 'SALE_DEED', note: 'Stamp duty receipt page is faded and missing seal.' } },
            { label: '7/12 Extract', category: 'Property Deeds', isRequired: true, doc: null },
            { label: 'Property Tax Receipt', category: 'Tax Receipts', isRequired: true, doc: { name: 'pmc_tax_receipt_2023.pdf', status: VerificationStatus.VERIFIED, type: 'TAX_RECEIPT' } },
          ],
        },
        {
          name: 'Meera Deshmukh',
          phone: '+919822022222',
          matterType: 'Title Verification',
          status: ClientStatus.WAITING_ON_CLIENT,
          details: { propertyRef: 'Plot 18, Kothrud CTS 890' },
          keyDateLabel: 'Search report due',
          keyDateDays: 7, // Due within 14 days
          linkStatus: 'active',
          reqs: [
            { label: 'Title Search 30-Year Index II', category: 'Property Deeds', isRequired: true, doc: null },
            { label: 'Development Agreement', category: 'Property Deeds', isRequired: true, doc: null },
            { label: 'Aadhaar Card', category: 'ID Proofs', isRequired: true, doc: { name: 'meera_aadhaar.pdf', status: VerificationStatus.VERIFIED, type: 'AADHAAR_CARD' } },
          ],
        },
        {
          name: 'Rohit Joshi',
          phone: '+919822033333',
          matterType: 'Leave & License',
          status: ClientStatus.UP_TO_DATE,
          details: { propertyRef: 'Flat 402, Amanora Park Town, Hadapsar' },
          keyDateLabel: 'Execution date',
          keyDateDays: 10,
          linkStatus: 'active',
          reqs: [
            { label: 'Owner Aadhaar & PAN', category: 'ID Proofs', isRequired: true, doc: { name: 'owner_id.pdf', status: VerificationStatus.VERIFIED, type: 'AADHAAR_CARD' } },
            { label: 'Tenant Aadhaar & PAN', category: 'ID Proofs', isRequired: true, doc: { name: 'tenant_id.pdf', status: VerificationStatus.VERIFIED, type: 'AADHAAR_CARD' } },
            { label: 'Electricity Bill', category: 'Tax Receipts', isRequired: true, doc: { name: 'mseb_bill_june.pdf', status: VerificationStatus.VERIFIED, type: 'TAX_RECEIPT' } },
          ],
        },
        {
          name: 'Godrej Properties Ltd',
          phone: '+919822044444',
          matterType: 'Society Registration',
          status: ClientStatus.CLOSED,
          details: { propertyRef: 'Survey 112/1, Hinjawadi Phase 1' },
          keyDateLabel: 'Execution date',
          keyDateDays: -30,
          linkStatus: 'revoked',
          reqs: [
            { label: 'Society Bye-Laws', category: 'Society Documents', isRequired: true, doc: { name: 'byelaws_approved.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
          ],
        },
        {
          name: 'Nitin Pawar',
          phone: '+919822055555',
          matterType: 'Gift Deed',
          status: ClientStatus.WAITING_ON_CLIENT,
          details: { propertyRef: 'Row House 4, Wakad' },
          keyDateLabel: 'Sub-Registrar appointment',
          keyDateDays: 14,
          linkStatus: 'expired',
          reqs: [
            { label: 'Donor Aadhaar', category: 'ID Proofs', isRequired: true, doc: null },
            { label: 'Donee Aadhaar', category: 'ID Proofs', isRequired: true, doc: null },
            { label: 'Electricity Bill', category: 'Tax Receipts', isRequired: true, doc: null },
          ],
        },
      ],
    },
    {
      name: 'Arvind Sharma',
      email: 'litigation@lexidesk.dev',
      mobile: '+919876543002',
      role: Role.LITIGATION_LAWYER,
      firmName: 'Sharma Law Chambers',
      firmAddress: 'Civil Court Compound, Shivaji Nagar, Pune 411005',
      firmPhone: '+919876543002',
      notes: [
        'Prepare written submission for High Court review petition in M/s Apex Infra matter.',
        'File interim relief application before Vacation Bench.',
      ],
      clients: [
        {
          name: 'Rajesh Singhania',
          phone: '+919823011111',
          matterType: 'Commercial Suit',
          status: ClientStatus.ACTION_NEEDED,
          details: { jurisdiction: 'Bombay High Court (Commercial Div)', opposingParty: 'Zenith Logistics LLP' },
          keyDateLabel: 'Filing due',
          keyDateDays: 1, // Urgent filing due tomorrow!
          linkStatus: 'active',
          reqs: [
            { label: 'Supply Agreement Contract', category: 'Evidence', isRequired: true, doc: { name: 'supply_agreement.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT', unreviewed: true } },
            { label: 'Bank Statement of Unpaid Invoices', category: 'Evidence', isRequired: true, doc: { name: 'bank_statement_unpaid.pdf', status: VerificationStatus.NEEDS_REVIEW, type: 'DOCUMENT', note: 'Account number does not match registered corporate vendor.' } },
            { label: 'Board Resolution for Filing', category: 'Pleadings', isRequired: true, doc: null },
          ],
        },
        {
          name: 'Sunita Patil',
          phone: '+919823022222',
          matterType: 'Civil Revision Application',
          status: ClientStatus.WAITING_ON_CLIENT,
          details: { jurisdiction: 'District Court Pune', opposingParty: 'Municipal Corporation Pune' },
          keyDateLabel: 'Next hearing',
          keyDateDays: 4, // Hearing upcoming
          linkStatus: 'active',
          reqs: [
            { label: 'Certified Copy of Lower Court Order', category: 'Court Orders', isRequired: true, doc: null },
            { label: 'Notice Under Section 487', category: 'Pleadings', isRequired: true, doc: null },
          ],
        },
        {
          name: 'Apex Builders & Developers',
          phone: '+919823033333',
          matterType: 'Arbitration Petition',
          status: ClientStatus.UP_TO_DATE,
          details: { jurisdiction: 'Arbitral Tribunal Mumbai', opposingParty: 'Metro Rail Corp' },
          keyDateLabel: 'Next hearing',
          keyDateDays: 12,
          linkStatus: 'active',
          reqs: [
            { label: 'Arbitration Agreement Clause', category: 'Evidence', isRequired: true, doc: { name: 'arbitration_clause.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
            { label: 'Statement of Defense Copy', category: 'Pleadings', isRequired: true, doc: { name: 'statement_of_defense.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
          ],
        },
        {
          name: 'Kavita Verma',
          phone: '+919823044444',
          matterType: 'Special Civil Suit',
          status: ClientStatus.CLOSED,
          details: { jurisdiction: 'Civil Court Junior Div Pune', opposingParty: 'Kishore Verma' },
          keyDateLabel: 'Next hearing',
          keyDateDays: -15,
          linkStatus: 'revoked',
          reqs: [
            { label: 'Compromise Terms Consent Terms', category: 'Court Orders', isRequired: true, doc: { name: 'consent_terms_signed.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
          ],
        },
      ],
    },
    {
      name: 'Priya Mehta',
      email: 'ca@lexidesk.dev',
      mobile: '+919876543003',
      role: Role.CA,
      firmName: 'Mehta & Co. Chartered Accountants',
      firmAddress: 'Senapati Bapat Road, Pune 411016',
      firmPhone: '+919876543003',
      notes: [
        'Send tax computation drafts to all Individual ITR clients before the 31st deadline.',
        'File GSTR-9 annual return for Nova Electronics before month end.',
        'Audit queries response for Reliance Retail vendor compliance.',
      ],
      clients: [
        {
          name: 'Vikram Merchant',
          phone: '+919824011111',
          matterType: 'ITR',
          status: ClientStatus.ACTION_NEEDED,
          details: { entityType: 'Individual', pan: 'ABCDE1234F' },
          keyDateLabel: 'Filing deadline',
          keyDateDays: 2, // Impending tax deadline (<3 days -> urgent!)
          isBilled: false,
          linkStatus: 'active',
          reqs: [
            { label: 'Form 16 (Part A & B)', category: 'Tax Returns', isRequired: true, doc: { name: 'form16_2023_24.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT', unreviewed: true } },
            { label: 'Annual Information Statement (AIS)', category: 'Tax Returns', isRequired: true, doc: { name: 'ais_tis_download.pdf', status: VerificationStatus.NEEDS_REVIEW, type: 'DOCUMENT', note: 'Interest income does not tally with Savings Bank statement.' } },
            { label: 'Bank Statement (FY 2023-24)', category: 'Bank Statements', isRequired: true, doc: null },
            { label: 'PAN Card', category: 'ID Proofs', isRequired: true, doc: { name: 'merchant_pan.jpg', status: VerificationStatus.VERIFIED, type: 'PAN_CARD' } },
          ],
        },
        {
          name: 'Nova Electronics Pvt Ltd',
          phone: '+919824022222',
          matterType: 'GST',
          status: ClientStatus.WAITING_ON_CLIENT,
          details: { entityType: 'Pvt Ltd', pan: 'AAACN1234A', gstin: '27AAACN1234A1Z5' },
          keyDateLabel: 'GST return due',
          keyDateDays: 5,
          isBilled: false,
          linkStatus: 'active',
          reqs: [
            { label: 'Sales Register Excel / PDF', category: 'GST Documents', isRequired: true, doc: null },
            { label: 'Purchase Invoices (GSTR-2B)', category: 'GST Documents', isRequired: true, doc: null },
            { label: 'Electronic Cash Ledger Statement', category: 'Bank Statements', isRequired: true, doc: null },
          ],
        },
        {
          name: 'Zenith Healthcare Trust',
          phone: '+919824033333',
          matterType: 'Audit',
          status: ClientStatus.UP_TO_DATE,
          details: { entityType: 'Trust', pan: 'AAATZ5678B' },
          keyDateLabel: 'Audit due',
          keyDateDays: 20,
          isBilled: false, // Unbilled task!
          linkStatus: 'active',
          reqs: [
            { label: '12A & 80G Registration Order', category: 'ID Proofs', isRequired: true, doc: { name: '12a_order.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
            { label: 'Audited Balance Sheet Draft', category: 'Tax Returns', isRequired: true, doc: { name: 'balance_sheet.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
            { label: 'FCRA Return Copy', category: 'Tax Returns', isRequired: true, doc: { name: 'fcra_return.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
          ],
        },
        {
          name: 'Ketan Shah',
          phone: '+919824044444',
          matterType: 'ITR',
          status: ClientStatus.CLOSED,
          details: { entityType: 'Individual', pan: 'XYZPK9876M' },
          keyDateLabel: 'Filing deadline',
          keyDateDays: -40,
          isBilled: true,
          linkStatus: 'revoked',
          reqs: [
            { label: 'ITR-V Acknowledgement', category: 'Tax Returns', isRequired: true, doc: { name: 'itr_v_ack.pdf', status: VerificationStatus.VERIFIED, type: 'DOCUMENT' } },
          ],
        },
      ],
    },
  ]

  for (const prof of professionals) {
    const user = await prisma.user.upsert({
      where: { email: prof.email },
      update: {
        passwordHash,
        name: prof.name,
        role: prof.role,
        isActive: true,
        firmName: prof.firmName,
        firmAddress: prof.firmAddress,
        firmPhone: prof.firmPhone,
      },
      create: {
        name: prof.name,
        email: prof.email,
        mobile: prof.mobile,
        passwordHash,
        role: prof.role,
        isActive: true,
        firmName: prof.firmName,
        firmAddress: prof.firmAddress,
        firmPhone: prof.firmPhone,
      },
    })

    logger.info({ email: prof.email, role: prof.role }, 'Seeded professional user')

    // Seed Quick Notes
    for (const noteText of prof.notes) {
      const exists = await prisma.quickNote.findFirst({
        where: { ownerId: user.id, body: noteText },
      })
      if (!exists) {
        await prisma.quickNote.create({
          data: { ownerId: user.id, body: noteText },
        })
      }
    }

    // Seed Clients & Documents
    for (const clientData of prof.clients) {
      let client = await prisma.client.findFirst({
        where: { ownerId: user.id, name: clientData.name },
      })

      const now = new Date()
      const keyDate = clientData.keyDateDays !== undefined
        ? new Date(now.getTime() + clientData.keyDateDays * 24 * 60 * 60 * 1000)
        : null

      if (!client) {
        client = await prisma.client.create({
          data: {
            ownerId: user.id,
            name: clientData.name,
            phone: clientData.phone,
            matterType: clientData.matterType,
            status: clientData.status,
            details: clientData.details as unknown as Prisma.InputJsonValue,
            keyDate,
            keyDateLabel: clientData.keyDateLabel,
            isBilled: clientData.isBilled ?? false,
            scratchpad: `Private consultation notes for ${clientData.name}.\nClient communicated urgency for completion.`,
          },
        })
      } else {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            status: clientData.status,
            keyDate,
            keyDateLabel: clientData.keyDateLabel,
            isBilled: clientData.isBilled ?? false,
          },
        })
      }

      // Seed Magic Link
      const existingLink = await prisma.magicLink.findFirst({
        where: { clientId: client.id },
      })

      if (!existingLink) {
        const { tokenHash } = generateToken()
        let expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        let revokedAt: Date | null = null

        if (clientData.linkStatus === 'expired') {
          expiresAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        } else if (clientData.linkStatus === 'revoked') {
          revokedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
        }

        await prisma.magicLink.create({
          data: {
            clientId: client.id,
            tokenHash,
            expiresAt,
            revokedAt,
            lastUsedAt: new Date(),
          },
        })
      }

      // Seed Requirements and Documents
      for (let i = 0; i < clientData.reqs.length; i++) {
        const reqData = clientData.reqs[i]!
        let req = await prisma.documentRequirement.findFirst({
          where: { clientId: client.id, label: reqData.label },
        })

        if (!req) {
          req = await prisma.documentRequirement.create({
            data: {
              clientId: client.id,
              label: reqData.label,
              category: reqData.category,
              isRequired: reqData.isRequired,
              sortOrder: i,
            },
          })
        }

        if (reqData.doc) {
          const docName = reqData.doc.name
          const s3Key = `owners/${user.id}/clients/${client.id}/seed-${docName}`

          const existingDoc = await prisma.document.findFirst({
            where: { s3Key },
          })

          if (!existingDoc) {
            await prisma.document.create({
              data: {
                clientId: client.id,
                requirementId: req.id,
                ownerId: user.id,
                s3Key,
                fileName: docName,
                mimeType: docName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                sizeBytes: 1024 * 350, // 350 KB
                category: reqData.category,
                verification: reqData.doc.status,
                detectedType: reqData.doc.type ?? null,
                verificationNote: reqData.doc.note ?? null,
                reviewedAt: reqData.doc.unreviewed ? null : new Date(),
                uploadedAt: new Date(now.getTime() - (i + 1) * 3600 * 1000),
              },
            })
          }
        }
      }
    }
  }

  logger.info('LexiDesk Comprehensive Seed Completed Successfully!')
  logger.info(`Dev login password for all users: ${DEV_PASSWORD}`)
  logger.info('Demo logins:')
  logger.info('  - Property Lawyer: property@lexidesk.dev')
  logger.info('  - Litigation Lawyer: litigation@lexidesk.dev')
  logger.info('  - Chartered Accountant: ca@lexidesk.dev')
  logger.info('  - Super Admin: admin@lexidesk.dev')
}

main()
  .catch((err: Error) => {
    logger.error(err, 'Seed execution failed')
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
