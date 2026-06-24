-- AlterTable: move FinanceProfile from a single expense amount + savings rate to
-- a percentage-based budget (expected / unexpected / savings) with a named model.
ALTER TABLE "FinanceProfile" ADD COLUMN "budgetModel" TEXT NOT NULL DEFAULT 'sixty_solution';
ALTER TABLE "FinanceProfile" ADD COLUMN "expectedPct" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "FinanceProfile" ADD COLUMN "unexpectedPct" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "FinanceProfile" ADD COLUMN "savingsPct" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "FinanceProfile" DROP COLUMN "expensesRwf";
ALTER TABLE "FinanceProfile" DROP COLUMN "expenseFrequency";
ALTER TABLE "FinanceProfile" DROP COLUMN "savingsRatePct";
