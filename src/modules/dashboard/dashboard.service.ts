import prisma from '../../lib/prisma'
import { RoleKey } from '../../config/roles'
import { ClientStatus, VerificationStatus } from '../../generated/prisma/client'

export interface DashboardMetric {
  key: string
  label: string
  value: number
  urgent?: boolean
}

export interface ActionRequiredItem {
  clientId: string
  name: string
  matterType: string
  newFiles: number
  needsReview: number
  lastUploadAt: string | null
}

export interface WaitingOnClientItem {
  clientId: string
  name: string
  matterType: string
  missingCount: number
  linkSentAt: string | null
  phone: string
  nudgeUrl: string
}

export interface DashboardResponse {
  role: RoleKey
  metrics: DashboardMetric[]
  actionRequired: ActionRequiredItem[]
  waitingOnClient: WaitingOnClientItem[]
}

export async function getDashboardData(
  userId: string,
  role: RoleKey
): Promise<DashboardResponse> {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Active clients query
  const clients = await prisma.client.findMany({
    where: { ownerId: userId },
    include: {
      requirements: {
        include: { documents: true },
      },
      documents: true,
      links: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, firmName: true },
  })

  // 1. Calculate Metrics by Role
  const metrics: DashboardMetric[] = []
  const activeClients = clients.filter((c) => c.status !== ClientStatus.CLOSED)

  if (role === 'PROPERTY_LAWYER') {
    // pendingSaleDeeds: matterType "Sale Deed" not CLOSED
    const pendingSaleDeeds = activeClients.filter(
      (c) => c.matterType.toLowerCase().includes('sale deed')
    ).length

    // searchReportsDue: keyDateLabel contains "Search report" within 14 days
    const fourteenDaysAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const searchReportsDue = activeClients.filter(
      (c) =>
        c.keyDateLabel?.toLowerCase().includes('search report') &&
        c.keyDate &&
        c.keyDate >= startOfToday &&
        c.keyDate <= fourteenDaysAhead
    ).length

    // subRegistrarThisWeek: Mon-Sun of current week
    const dayOfWeek = now.getDay()
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const mon = new Date(startOfToday.getTime() + diffToMon * 24 * 60 * 60 * 1000)
    const sun = new Date(mon.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

    const subRegistrarThisWeek = activeClients.filter(
      (c) =>
        c.keyDateLabel?.toLowerCase().includes('sub-registrar') &&
        c.keyDate &&
        c.keyDate >= mon &&
        c.keyDate <= sun
    ).length

    metrics.push(
      { key: 'pendingSaleDeeds', label: 'Pending Sale Deeds', value: pendingSaleDeeds },
      { key: 'searchReportsDue', label: 'Search Reports Due', value: searchReportsDue },
      { key: 'subRegistrarThisWeek', label: 'Sub-Registrar This Week', value: subRegistrarThisWeek }
    )
  } else if (role === 'LITIGATION_LAWYER') {
    // upcomingHearings: "Next hearing" >= today
    const upcomingHearings = activeClients.filter(
      (c) =>
        c.keyDateLabel?.toLowerCase().includes('hearing') &&
        c.keyDate &&
        c.keyDate >= startOfToday
    ).length

    // urgentFilings: "Filing due" within 3 days
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const urgentFilings = activeClients.filter(
      (c) =>
        c.keyDateLabel?.toLowerCase().includes('filing') &&
        c.keyDate &&
        c.keyDate >= startOfToday &&
        c.keyDate <= threeDaysAhead
    ).length

    // activeCases
    const activeCases = activeClients.length

    metrics.push(
      { key: 'upcomingHearings', label: 'Upcoming Court Hearings', value: upcomingHearings },
      { key: 'urgentFilings', label: 'Urgent Filings', value: urgentFilings, urgent: urgentFilings > 0 },
      { key: 'activeCases', label: 'Active Cases', value: activeCases }
    )
  } else if (role === 'CA') {
    // impendingTaxDeadlines: within 7 days, urgent if within 3 days
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const taxDeadlines = activeClients.filter(
      (c) => c.keyDate && c.keyDate >= startOfToday && c.keyDate <= sevenDaysAhead
    )
    const impendingTaxDeadlines = taxDeadlines.length
    const isUrgent = taxDeadlines.some((c) => c.keyDate! <= threeDaysAhead)

    // pendingGstReturns: matterType "GST" not UP_TO_DATE / CLOSED
    const pendingGstReturns = activeClients.filter(
      (c) =>
        c.matterType.toLowerCase().includes('gst') &&
        c.status !== ClientStatus.UP_TO_DATE
    ).length

    // unbilledTasks: isBilled = false and (CLOSED or UP_TO_DATE)
    const unbilledTasks = clients.filter(
      (c) =>
        !c.isBilled &&
        (c.status === ClientStatus.UP_TO_DATE || c.status === ClientStatus.CLOSED)
    ).length

    metrics.push(
      {
        key: 'impendingTaxDeadlines',
        label: 'Impending Tax Deadlines',
        value: impendingTaxDeadlines,
        urgent: isUrgent,
      },
      { key: 'pendingGstReturns', label: 'Pending GST Returns', value: pendingGstReturns },
      { key: 'unbilledTasks', label: 'Unbilled Tasks', value: unbilledTasks }
    )
  } else {
    // SUPER or default fallback
    metrics.push(
      { key: 'totalClients', label: 'Total Clients', value: clients.length },
      { key: 'activeWorkspaces', label: 'Active Workspaces', value: activeClients.length },
      { key: 'actionRequired', label: 'Action Required', value: clients.filter((c) => c.status === ClientStatus.ACTION_NEEDED).length }
    )
  }

  // 2. Action Required column
  const actionRequired: ActionRequiredItem[] = []
  for (const c of clients) {
    if (c.status === ClientStatus.CLOSED) continue
    const unreviewedDocs = c.documents.filter((d) => !d.reviewedAt)
    const needsReviewDocs = c.documents.filter((d) => d.verification === VerificationStatus.NEEDS_REVIEW)

    if (unreviewedDocs.length > 0 || needsReviewDocs.length > 0) {
      const sortedDocs = [...c.documents].sort(
        (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
      )
      actionRequired.push({
        clientId: c.id,
        name: c.name,
        matterType: c.matterType,
        newFiles: unreviewedDocs.length,
        needsReview: needsReviewDocs.length,
        lastUploadAt: sortedDocs[0] ? sortedDocs[0].uploadedAt.toISOString() : null,
      })
    }
  }

  // 3. Waiting on Client column
  const waitingOnClient: WaitingOnClientItem[] = []
  const firmTitle = user?.firmName || user?.name || 'Your Consultant'

  for (const c of clients) {
    if (c.status !== ClientStatus.WAITING_ON_CLIENT) continue
    const missingReqs = c.requirements.filter((r) => r.isRequired && r.documents.length === 0)
    const link = c.links[0]

    const cleanPhone = c.phone.replace(/[^0-9]/g, '')
    const nudgeMsg = `Hello ${c.name}, this is a gentle reminder from ${firmTitle} regarding your ${c.matterType} matter. Please upload your pending documents through your secure portal link.`
    const nudgeUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(nudgeMsg)}`

    waitingOnClient.push({
      clientId: c.id,
      name: c.name,
      matterType: c.matterType,
      missingCount: missingReqs.length,
      linkSentAt: link ? link.createdAt.toISOString() : null,
      phone: c.phone,
      nudgeUrl,
    })
  }

  return {
    role,
    metrics,
    actionRequired,
    waitingOnClient,
  }
}
