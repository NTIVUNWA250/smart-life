import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 12);

  const student = await prisma.user.upsert({
    where: { email: 'student@smartlife.rw' },
    update: {},
    create: { name: 'Aline Student', email: 'student@smartlife.rw', passwordHash: password, role: 'student' },
  });

  const parent = await prisma.user.upsert({
    where: { email: 'parent@smartlife.rw' },
    update: {},
    create: { name: 'Jean Parent', email: 'parent@smartlife.rw', passwordHash: password, role: 'approver' },
  });

  await prisma.user.upsert({
    where: { email: 'admin@smartlife.rw' },
    update: {},
    create: { name: 'System Admin', email: 'admin@smartlife.rw', passwordHash: password, role: 'admin' },
  });

  // Linked, accepted approver relationship
  await prisma.peerLink.upsert({
    where: { studentId_approverId: { studentId: student.id, approverId: parent.id } },
    update: { status: 'accepted', relationship: 'parent' },
    create: { studentId: student.id, approverId: parent.id, relationship: 'parent', status: 'accepted' },
  });

  // Some income + expenses this month (seed once; transactions have no natural key).
  if ((await prisma.transaction.count({ where: { userId: student.id } })) === 0) {
    await prisma.transaction.createMany({
      data: [
        { userId: student.id, type: 'income', amountRwf: 150_000, category: 'allowance' },
        { userId: student.id, type: 'expense', amountRwf: 20_000, category: 'food' },
        { userId: student.id, type: 'expense', amountRwf: 15_000, category: 'transport' },
      ],
    });
  }

  // A manually-created savings goal
  const existingManual = await prisma.goal.findFirst({
    where: { userId: student.id, title: 'Laptop fund' },
  });
  if (!existingManual) {
    const deadline = new Date();
    deadline.setUTCMonth(deadline.getUTCMonth() + 3);
    await prisma.goal.create({
      data: { userId: student.id, title: 'Laptop fund', targetRwf: 300_000, deadline },
    });
  }

  // Budget profile captured at onboarding (FR3): the 60% Solution model.
  const profile = await prisma.financeProfile.upsert({
    where: { userId: student.id },
    update: {},
    create: {
      userId: student.id,
      incomeRwf: 150_000,
      incomeFrequency: 'monthly',
      budgetModel: 'sixty_solution',
      expectedPct: 60,
      unexpectedPct: 10,
      savingsPct: 30,
    },
  });

  // Auto savings goal: save savings% of monthly income across a 12-month horizon.
  const monthlySavings = Math.floor((profile.incomeRwf * profile.savingsPct) / 100);
  const autoDeadline = new Date();
  autoDeadline.setUTCMonth(autoDeadline.getUTCMonth() + 12);
  const existingAuto = await prisma.goal.findFirst({
    where: { userId: student.id, isAuto: true },
  });
  if (existingAuto) {
    // Keep the auto goal in sync with the current budget on re-seed.
    await prisma.goal.update({
      where: { id: existingAuto.id },
      data: { targetRwf: monthlySavings * 12, deadline: autoDeadline },
    });
  } else {
    await prisma.goal.create({
      data: {
        userId: student.id,
        title: 'Auto savings plan',
        targetRwf: monthlySavings * 12,
        deadline: autoDeadline,
        isAuto: true,
      },
    });
  }

  // Screen-time policies
  await prisma.screenTimePolicy.upsert({
    where: { userId_appOrSite: { userId: student.id, appOrSite: 'instagram' } },
    update: {},
    create: { userId: student.id, appOrSite: 'instagram', dailyLimitMin: 60 },
  });

  console.log(
    `Seed complete. Login with student@smartlife.rw / password123` +
      ` (auto savings goal: RWF ${(monthlySavings * 12).toLocaleString('en-RW')})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
