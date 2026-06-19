import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../lib/env.js';
import { sha256 } from '../../lib/crypto.js';
import { conflict, unauthorized } from '../../lib/http-error.js';
import type { SignupInput, LoginInput } from './auth.schemas.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isMinor: boolean;
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, isMinor: u.isMinor };
}

function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl as jwt.SignOptions['expiresIn'],
  });
}

function ttlToMs(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])$/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + ttlToMs(env.refreshTokenTtl)),
    },
  });
  return raw;
}

async function issueTokens(user: User): Promise<AuthTokens> {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

export async function signup(
  input: SignupInput,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? 'student',
      isMinor: input.isMinor ?? false,
    },
  });

  return { user: toPublicUser(user), tokens: await issueTokens(user) };
}

export async function login(
  input: LoginInput,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized('Invalid email or password');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');

  return { user: toPublicUser(user), tokens: await issueTokens(user) };
}

export async function refresh(rawRefreshToken: string): Promise<AuthTokens> {
  const tokenHash = sha256(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Invalid or expired refresh token');
  }

  // Rotate: revoke the used token, issue a fresh pair.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(stored.user);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = sha256(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
