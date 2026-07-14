-- Add notificationSentAt to SlaClock to track when email was sent
-- Prevents duplicate notifications for same breach

ALTER TABLE "SlaClock" ADD COLUMN "notificationSentAt" TIMESTAMP(3);

-- Index for finding clocks that need email retry (breached but not notified)
CREATE INDEX "idx_sla_clock_notify_retry" ON "SlaClock"("orgId", "status")
  WHERE "status" = 'breached' AND "notificationSentAt" IS NULL;
