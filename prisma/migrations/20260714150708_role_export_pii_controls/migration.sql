-- Per-role export controls: daily export cap and PII masking on exported CSVs.
ALTER TABLE "Role" ADD COLUMN "maxExportLimitDaily" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Role" ADD COLUMN "maskPiiData" BOOLEAN NOT NULL DEFAULT true;
