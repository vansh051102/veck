import { prisma } from '@/lib/db'

interface NotificationPayload {
  leadId: string
  leadName: string
  assignedToId: string
  assignedToName: string
  department: string | null
  stage: string
  targetMinutes: number
  elapsedBusinessMinutes: number
  breachedByMinutes: number
  escalateToUserId: string
}

async function sendSLABreachEmail(payload: NotificationPayload) {
  // TODO: Phase 2 - Wire up email service (SendGrid, Resend, etc.)
  // For now, just log and store notification record
  console.log('[SLA BREACH] Email would be sent:', {
    to: payload.escalateToUserId,
    subject: `⚠️ SLA Breach: ${payload.leadName}`,
    lead: payload.leadName,
    breachedBy: `${(payload.breachedByMinutes / 60).toFixed(1)}h`,
    stage: payload.stage,
    department: payload.department,
  })

  // Store notification record for admin dashboard
  try {
    await prisma.notification.create({
      data: {
        userId: payload.escalateToUserId,
        type: 'sla_breach',
        title: `SLA Breach: ${payload.leadName}`,
        body: `Lead in ${payload.stage} stage breached SLA by ${(payload.breachedByMinutes / 60).toFixed(1)}h`,
        leadId: payload.leadId,
        read: false,
      },
    })
  } catch (err) {
    // Notification model may not exist yet (Phase 2 future)
    console.log('Notification model not yet implemented')
  }
}

async function sendSLAWarningEmail(payload: NotificationPayload & { percentUsed: number }) {
  // Send warning when 80%+ of target used (before breach)
  console.log('[SLA WARNING] Email would be sent:', {
    to: payload.assignedToId,
    subject: `⏰ SLA Warning: ${payload.leadName}`,
    percentUsed: payload.percentUsed,
  })
}

export { sendSLABreachEmail, sendSLAWarningEmail }
