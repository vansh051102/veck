import { Resend } from 'resend'
import { prisma } from '@/lib/db'

// Initialize Resend (will be null if API key not set)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface BreachEmailPayload {
  orgId: string
  slaClockId: string
  leadId: string
  leadName: string
  assignedToId: string
  assignedToName: string
  managerEmail: string
  department: string | null
  stage: string
  targetMinutes: number
  elapsedBusinessMinutes: number
  breachedByMinutes: number
  slaRuleName?: string
}

interface WarningEmailPayload extends BreachEmailPayload {
  percentUsed: number
}

// Email templates
function generateBreachEmailHTML(payload: BreachEmailPayload): string {
  const targetHours = (payload.targetMinutes / 60).toFixed(1)
  const elapsedHours = (payload.elapsedBusinessMinutes / 60).toFixed(1)
  const breachedByHours = (payload.breachedByMinutes / 60).toFixed(1)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .body { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
        .metric { margin: 12px 0; font-size: 14px; }
        .metric-label { color: #666; }
        .metric-value { font-weight: 600; color: #dc2626; font-size: 16px; }
        .footer { margin-top: 20px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">⚠️ SLA Breach Alert</h2>
        </div>
        <div class="body">
          <p>Hi ${payload.assignedToName || 'there'},</p>
          <p>An SLA has been <strong>breached</strong> for the following lead:</p>

          <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #dc2626;">
            <div class="metric">
              <span class="metric-label">Lead:</span>
              <span class="metric-value">${payload.leadName}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Department:</span>
              <span>${payload.department || 'N/A'}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Current Stage:</span>
              <span>${payload.stage}</span>
            </div>
            <div class="metric">
              <span class="metric-label">SLA Target:</span>
              <span>${targetHours} hours</span>
            </div>
            <div class="metric">
              <span class="metric-label">Time Elapsed:</span>
              <span>${elapsedHours} hours</span>
            </div>
            <div class="metric">
              <span class="metric-label">Breached By:</span>
              <span class="metric-value">+${breachedByHours} hours</span>
            </div>
          </div>

          <p>Please take immediate action to address this breach. Review the lead details and determine next steps.</p>

          <div class="footer">
            <p>This is an automated alert from the VECK CRM SLA system. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateWarningEmailHTML(payload: WarningEmailPayload): string {
  const targetHours = (payload.targetMinutes / 60).toFixed(1)
  const elapsedHours = (payload.elapsedBusinessMinutes / 60).toFixed(1)
  const remainingHours = ((payload.targetMinutes - payload.elapsedBusinessMinutes) / 60).toFixed(1)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .body { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
        .metric { margin: 12px 0; font-size: 14px; }
        .metric-label { color: #666; }
        .metric-value { font-weight: 600; color: #f59e0b; font-size: 16px; }
        .footer { margin-top: 20px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">⏰ SLA Warning</h2>
        </div>
        <div class="body">
          <p>Hi ${payload.assignedToName || 'there'},</p>
          <p>You are approaching an SLA deadline for:</p>

          <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b;">
            <div class="metric">
              <span class="metric-label">Lead:</span>
              <span class="metric-value">${payload.leadName}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Department:</span>
              <span>${payload.department || 'N/A'}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Current Stage:</span>
              <span>${payload.stage}</span>
            </div>
            <div class="metric">
              <span class="metric-label">SLA Target:</span>
              <span>${targetHours} hours</span>
            </div>
            <div class="metric">
              <span class="metric-label">Time Elapsed:</span>
              <span>${elapsedHours} hours (${payload.percentUsed.toFixed(0)}% of target)</span>
            </div>
            <div class="metric">
              <span class="metric-label">Time Remaining:</span>
              <span class="metric-value">${remainingHours} hours</span>
            </div>
          </div>

          <p>Take action now to avoid an SLA breach. Prioritize this lead and complete the required task before time runs out.</p>

          <div class="footer">
            <p>This is an automated alert from the VECK CRM SLA system. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Send SLA breach email to manager/escalee
 * Handles all edge cases: no email, no user, email service failures, deduplication
 */
export async function sendSLABreachEmail(payload: BreachEmailPayload): Promise<{ success: boolean; reason?: string }> {
  try {
    // Edge case: no email provided
    if (!payload.managerEmail) {
      console.warn(`[SLA] Breach email skipped: manager has no email (slaClockId: ${payload.slaClockId})`)
      return { success: false, reason: 'manager_no_email' }
    }

    // Check for existing notification (deduplication)
    // Don't re-send if we already notified for this breach
    const existingNotif = await prisma.notification.findFirst({
      where: {
        slaClockId: payload.slaClockId,
        type: 'sla_breach',
      },
    })

    if (existingNotif) {
      console.log(`[SLA] Breach email skipped: already notified (slaClockId: ${payload.slaClockId})`)
      return { success: false, reason: 'already_notified' }
    }

    // Edge case: no Resend client (RESEND_API_KEY not set)
    if (!resend) {
      console.warn('[SLA] RESEND_API_KEY not set. Breach email not sent (logging only).')
      // For dev/testing, still log the email intent
      console.log(`[SLA-EMAIL] Would send: ${payload.managerEmail}`)
      return { success: false, reason: 'no_api_key' }
    }

    // Send email via Resend
    const result = await resend.emails.send({
      from: 'info@veck.in',
      to: payload.managerEmail,
      subject: `⚠️ SLA Breach: ${payload.leadName}`,
      html: generateBreachEmailHTML(payload),
    })

    if (result.error) {
      console.error(`[SLA] Email send failed: ${result.error.message}`)
      return { success: false, reason: 'email_service_failed' }
    }

    // Mark notification as sent
    await prisma.notification.create({
      data: {
        orgId: payload.orgId,
        userId: payload.assignedToId,
        slaClockId: payload.slaClockId,
        leadId: payload.leadId,
        type: 'sla_breach',
        title: `SLA Breach: ${payload.leadName}`,
        body: `Lead breached SLA by ${(payload.breachedByMinutes / 60).toFixed(1)}h in ${payload.stage} stage`,
        read: false,
      },
    })

    console.log(`[SLA] Breach email sent to ${payload.managerEmail} (slaClockId: ${payload.slaClockId})`)
    return { success: true }
  } catch (error) {
    console.error('[SLA] Unexpected error sending breach email:', error)
    return { success: false, reason: 'unexpected_error' }
  }
}

/**
 * Send SLA warning email when 80%+ of target time used
 * Alerts person BEFORE breach to enable proactive action
 */
export async function sendSLAWarningEmail(payload: WarningEmailPayload): Promise<{ success: boolean; reason?: string }> {
  try {
    // Only notify person assigned to lead (not escalee)
    const user = await prisma.user.findUnique({
      where: { id: payload.assignedToId },
      select: { email: true },
    })

    if (!user) {
      console.warn(`[SLA] Warning email skipped: user not found (userId: ${payload.assignedToId})`)
      return { success: false, reason: 'user_not_found' }
    }

    if (!user.email) {
      console.warn(`[SLA] Warning email skipped: user has no email (userId: ${payload.assignedToId})`)
      return { success: false, reason: 'user_no_email' }
    }

    // Check for duplicate warning in past 1 hour (avoid spam)
    const recentWarning = await prisma.notification.findFirst({
      where: {
        slaClockId: payload.slaClockId,
        type: 'sla_warning',
        createdAt: { gte: new Date(Date.now() - 3600000) }, // past 1 hour
      },
    })

    if (recentWarning) {
      console.log(`[SLA] Warning email skipped: already warned in past hour (slaClockId: ${payload.slaClockId})`)
      return { success: false, reason: 'already_warned_recently' }
    }

    // Check for Resend client
    if (!resend) {
      console.warn('[SLA] RESEND_API_KEY not set. Warning email not sent (logging only).')
      console.log(`[SLA-EMAIL-WARNING] Would send: ${user.email}`)
      return { success: false, reason: 'no_api_key' }
    }

    // Send email
    const result = await resend.emails.send({
      from: 'info@veck.in',
      to: user.email,
      subject: `⏰ SLA Warning: ${payload.leadName}`,
      html: generateWarningEmailHTML(payload),
    })

    if (result.error) {
      console.error(`[SLA] Warning email send failed: ${result.error.message}`)
      return { success: false, reason: 'email_service_failed' }
    }

    // Record warning notification
    await prisma.notification.create({
      data: {
        orgId: payload.orgId,
        userId: payload.assignedToId,
        slaClockId: payload.slaClockId,
        leadId: payload.leadId,
        type: 'sla_warning',
        title: `SLA Warning: ${payload.leadName}`,
        body: `${payload.percentUsed.toFixed(0)}% of SLA target used. Action required.`,
        read: false,
      },
    })

    console.log(`[SLA] Warning email sent to ${user.email} (slaClockId: ${payload.slaClockId})`)
    return { success: true }
  } catch (error) {
    console.error('[SLA] Unexpected error sending warning email:', error)
    return { success: false, reason: 'unexpected_error' }
  }
}
