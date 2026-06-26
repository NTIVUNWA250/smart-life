-- AlterTable: heavy monthly expense (rent) + weekend daily-allowance boost.
ALTER TABLE "FinanceProfile" ADD COLUMN "heavyExpenseRwf" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FinanceProfile" ADD COLUMN "heavyExpenseDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FinanceProfile" ADD COLUMN "weekendBoostPct" INTEGER NOT NULL DEFAULT 30;
