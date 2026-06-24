-- AlterTable: ad-hoc income received in a given month, on top of declared income.
ALTER TABLE "SpendingLimit" ADD COLUMN "unexpectedIncomeRwf" INTEGER NOT NULL DEFAULT 0;
