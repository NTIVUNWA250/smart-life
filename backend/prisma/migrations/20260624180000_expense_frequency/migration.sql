-- AlterTable: cadence the user states expected expenses in (display-only; the
-- budget itself stays percentage-based).
ALTER TABLE "FinanceProfile" ADD COLUMN "expenseFrequency" "Frequency" NOT NULL DEFAULT 'monthly';
