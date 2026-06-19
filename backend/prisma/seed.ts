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

  // Some income + expenses this month
  await prisma.transaction.createMany({
    data: [
      { userId: student.id, type: 'income', amountRwf: 150_000, category: 'allowance' },
      { userId: student.id, type: 'expense', amountRwf: 20_000, category: 'food' },
      { userId: student.id, type: 'expense', amountRwf: 15_000, category: 'transport' },
    ],
  });

  // A savings goal
  const deadline = new Date();
  deadline.setUTCMonth(deadline.getUTCMonth() + 3);
  await prisma.goal.create({
    data: { userId: student.id, title: 'Laptop fund', targetRwf: 300_000, deadline },
  });

  // Screen-time policies
  await prisma.screenTimePolicy.upsert({
    where: { userId_appOrSite: { userId: student.id, appOrSite: 'instagram' } },
    update: {},
    create: { userId: student.id, appOrSite: 'instagram', dailyLimitMin: 60 },
  });

  console.log('Seed complete. Login with student@smartlife.rw / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
