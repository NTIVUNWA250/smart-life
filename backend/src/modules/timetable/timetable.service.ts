import type { Prisma, ScreenTargetKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/http-error.js';
import { normalizeTarget } from '../screentime/screentime.targets.js';
import {
  MIN_REMINDER_LEAD,
  MINUTES_PER_DAY,
  activeEntries,
  dueReminders,
  entriesOverlap,
  nextEntry,
  type Clock,
} from './timetable.schedule.js';

export interface AllowedTargetInput {
  appOrSite: string;
  kind: ScreenTargetKind;
  label?: string;
}

export interface TimetableInput {
  title: string;
  category?: string;
  notes?: string;
  daysOfWeek: number[];
  startMin: number;
  endMin: number;
  isolation?: boolean;
  reminderEnabled?: boolean;
  reminderLeadMin?: number;
  color?: string;
  allowedTargets?: AllowedTargetInput[];
}

type EntryWithTargets = Prisma.TimetableEntryGetPayload<{ include: { allowedTargets: true } }>;

const withTargets = { allowedTargets: true } as const;

function validate(input: TimetableInput): void {
  if (!input.title.trim()) throw badRequest('Activity title is required');

  const days = input.daysOfWeek;
  if (!days.length) throw badRequest('Pick at least one day of the week');
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw badRequest('Days of week must be 0 (Sun) to 6 (Sat)');
  }
  if (new Set(days).size !== days.length) throw badRequest('Duplicate days of week');

  if (!Number.isInteger(input.startMin) || input.startMin < 0 || input.startMin >= MINUTES_PER_DAY) {
    throw badRequest('Start time is out of range');
  }
  if (!Number.isInteger(input.endMin) || input.endMin <= input.startMin || input.endMin > MINUTES_PER_DAY) {
    throw badRequest('End time must be after the start time (activities can’t cross midnight)');
  }
  if (input.reminderLeadMin !== undefined && input.reminderLeadMin < MIN_REMINDER_LEAD) {
    throw badRequest(`Reminders must be at least ${MIN_REMINDER_LEAD} minutes before`);
  }
}

/** Rejects an entry that clashes with another of the user's entries. */
async function assertNoOverlap(userId: string, input: TimetableInput, excludeId?: string): Promise<void> {
  const others = await prisma.timetableEntry.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  const candidate = {
    id: excludeId ?? 'new',
    daysOfWeek: input.daysOfWeek,
    startMin: input.startMin,
    endMin: input.endMin,
    isolation: false,
    reminderEnabled: false,
    reminderLeadMin: 5,
  };
  const clash = others.find((o) => entriesOverlap(candidate, o));
  if (clash) throw badRequest(`This overlaps your activity “${clash.title}”`);
}

function targetCreateData(targets: AllowedTargetInput[] = []) {
  return targets.map((t) => {
    const n = normalizeTarget(t.kind, t.appOrSite, t.label);
    return { appOrSite: n.appOrSite, kind: n.kind, label: n.label };
  });
}

function toCreate(input: TimetableInput) {
  return {
    title: input.title.trim(),
    category: (input.category ?? 'other') as Prisma.TimetableEntryCreateInput['category'],
    notes: input.notes?.trim() || null,
    daysOfWeek: [...input.daysOfWeek].sort((a, b) => a - b),
    startMin: input.startMin,
    endMin: input.endMin,
    isolation: input.isolation ?? false,
    reminderEnabled: input.reminderEnabled ?? true,
    reminderLeadMin: input.reminderLeadMin ?? MIN_REMINDER_LEAD,
    color: input.color ?? null,
  };
}

export async function listEntries(userId: string): Promise<EntryWithTargets[]> {
  return prisma.timetableEntry.findMany({
    where: { userId },
    include: withTargets,
    orderBy: [{ startMin: 'asc' }],
  });
}

export async function createEntry(userId: string, input: TimetableInput): Promise<EntryWithTargets> {
  validate(input);
  await assertNoOverlap(userId, input);
  return prisma.timetableEntry.create({
    data: {
      userId,
      ...toCreate(input),
      allowedTargets: { create: targetCreateData(input.allowedTargets) },
    },
    include: withTargets,
  });
}

export async function updateEntry(
  userId: string,
  id: string,
  input: TimetableInput,
): Promise<EntryWithTargets> {
  validate(input);
  const existing = await prisma.timetableEntry.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Timetable entry not found');
  await assertNoOverlap(userId, input, id);

  // Replace the allowed-target set wholesale.
  return prisma.timetableEntry.update({
    where: { id },
    data: {
      ...toCreate(input),
      allowedTargets: { deleteMany: {}, create: targetCreateData(input.allowedTargets) },
    },
    include: withTargets,
  });
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  const existing = await prisma.timetableEntry.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Timetable entry not found');
  await prisma.timetableEntry.delete({ where: { id } });
}

export interface Agenda {
  now: Clock;
  active: EntryWithTargets[];
  next: EntryWithTargets | null;
  reminders: { entry: EntryWithTargets; startsInMin: number }[];
  isolation: { active: boolean; allowed: { appOrSite: string; kind: ScreenTargetKind; label: string | null }[] };
}

/** The live view: what's running now, what's next, due reminders, and the
 *  isolation allow-list (only these apps/sites are enabled during focus). */
export async function buildAgenda(userId: string, clock: Clock): Promise<Agenda> {
  const entries = await prisma.timetableEntry.findMany({ where: { userId }, include: withTargets });

  const active = activeEntries(entries, clock);
  const isolationEntries = active.filter((e) => e.isolation);
  const allowedMap = new Map<string, { appOrSite: string; kind: ScreenTargetKind; label: string | null }>();
  for (const e of isolationEntries) {
    for (const t of e.allowedTargets) allowedMap.set(t.appOrSite, t);
  }

  return {
    now: clock,
    active,
    next: nextEntry(entries, clock),
    reminders: dueReminders(entries, clock),
    isolation: { active: isolationEntries.length > 0, allowed: [...allowedMap.values()] },
  };
}
