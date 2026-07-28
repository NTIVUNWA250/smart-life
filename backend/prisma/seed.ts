import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { recomputeCurrentLimit } from '../src/modules/limits/limits.service.js';

dotenv.config();

const prisma = new PrismaClient();

/** A date `months` calendar months from now, in UTC. */
function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

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

  // A manually-created savings goal.
  //
  // The 24-month horizon is deliberate. The limit is
  // `income − max(savingsBucket, requiredGoalSavings)`, and the auto goal below
  // already claims the entire savings bucket (savings% × income, spread over 12
  // months). So every month this goal demands comes straight off the demo
  // student's spending limit: at 3 months it wanted 100,000 of a 150,000 income
  // and left a 5,000 limit, which looks like a broken app. At 24 months it asks
  // 12,500 and leaves ~92,500.
  //
  // The deadline is also re-synced on every seed, like the auto goal. Creating it
  // only when absent let it drift into the past, and `monthsUntil` floors at 1
  // month — so the whole remaining target fell due at once and the student was
  // permanently blocked.
  const manualDeadline = monthsFromNow(24);
  const existingManual = await prisma.goal.findFirst({
    where: { userId: student.id, title: 'Laptop fund' },
  });
  if (existingManual) {
    await prisma.goal.update({
      where: { id: existingManual.id },
      data: { deadline: manualDeadline },
    });
  } else {
    await prisma.goal.create({
      data: {
        userId: student.id,
        title: 'Laptop fund',
        targetRwf: 300_000,
        deadline: manualDeadline,
      },
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
  const autoDeadline = monthsFromNow(12);
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

  // Report the limit the seeded data actually produces, using the real engine
  // rather than a copy of its formula. A zero limit means the demo student is
  // blocked and every expense will 409 — which reads as a broken app, so it is
  // worth failing loudly here rather than discovering it in the UI.
  const limit = await recomputeCurrentLimit(student.id);
  const rwf = (n: number) => `RWF ${n.toLocaleString('en-RW')}`;

  console.log(`Seed complete. Login with student@smartlife.rw / password123`);
  console.log(`  auto savings goal : ${rwf(monthlySavings * 12)} over 12 months`);
  console.log(`  monthly limit     : ${rwf(limit.limitRwf)}${limit.isBlocked ? '  ** BLOCKED **' : ''}`);
  if (limit.limitRwf === 0) {
    console.warn(
      '\n  ⚠ The demo student has no spending room: active goals demand at least the\n' +
        '    whole income. Lengthen a goal deadline or lower a target.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
