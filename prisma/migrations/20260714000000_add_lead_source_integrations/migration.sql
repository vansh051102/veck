ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "indiamartWebhookSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "indiamartConfiguredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "tradeindiaWebhookSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "tradeindiaConfiguredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappVerifyToken" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappAppSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappConfiguredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "emailInboundSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "emailConfiguredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "justdialApiKey" TEXT,
  ADD COLUMN IF NOT EXISTS "justdialConfiguredBy" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Settings_indiamartWebhookSecret_key" ON "Settings"("indiamartWebhookSecret");
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_tradeindiaWebhookSecret_key" ON "Settings"("tradeindiaWebhookSecret");
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_whatsappPhoneNumberId_key" ON "Settings"("whatsappPhoneNumberId");
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_emailInboundSecret_key" ON "Settings"("emailInboundSecret");
