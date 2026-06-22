-- AlterEnum: goal edits are a new kind of approval
ALTER TYPE "ApprovalKind" ADD VALUE 'goal_edit';

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('daily', 'monthly', 'yearly');

-- AlterTable: goal edit controls (FR3 once-a-month rule + auto-goal flag)
ALTER TABLE "Goal" ADD COLUMN "isAuto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Goal" ADD COLUMN "lastEditedAt" TIMESTAMP(3);

-- AlterTable: encrypted proposed-change payload for goal-edit approvals
ALTER TABLE "Approval" ADD COLUMN "proposedEnc" TEXT;

-- CreateTable
CREATE TABLE "FinanceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "incomeRwf" INTEGER NOT NULL,
    "incomeFrequency" "Frequency" NOT NULL DEFAULT 'monthly',
    "expensesRwf" INTEGER NOT NULL,
    "expenseFrequency" "Frequency" NOT NULL DEFAULT 'monthly',
    "savingsRatePct" INTEGER NOT NULL DEFAULT 50,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceProfile_userId_key" ON "FinanceProfile"("userId");

-- AddForeignKey
ALTER TABLE "FinanceProfile" ADD CONSTRAINT "FinanceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
