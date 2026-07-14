-- Create Notification model to track sent emails and in-app alerts

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slaClockId" TEXT,
  "leadId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Indexes for fast queries
CREATE INDEX "idx_notification_user_read" ON "Notification"("orgId", "userId", "read");
CREATE INDEX "idx_notification_sla_clock" ON "Notification"("slaClockId");
CREATE INDEX "idx_notification_lead" ON "Notification"("leadId");
CREATE INDEX "idx_notification_created" ON "Notification"("createdAt");
