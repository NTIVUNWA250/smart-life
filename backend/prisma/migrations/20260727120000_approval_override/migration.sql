-- AlterTable: a peer/parent approval grants one over-limit expense (FR6).
-- Unlike isBlocked this is never recomputed, so the override survives until used.
ALTER TABLE "SpendingLimit" ADD COLUMN "overridePending" BOOLEAN NOT NULL DEFAULT false;
