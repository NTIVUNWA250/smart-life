import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Integration tests for routing, auth middleware, validation, and error shape.
// These exercise paths that short-circuit BEFORE any database call (401s, zod
// 400s, 404s, /health), so they run without a live PostgreSQL.
let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://localhost:5432/smartlife_test?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
  process.env.FIELD_ENCRYPTION_KEY ??= 'a'.repeat(64);
  // Import after env is in place (modules read env at load time).
  const { createApp } = await import('../app.js');
  app = createApp();
}, 30_000);

describe('GET /health', () => {
  it('reports service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'smartlife-backend' });
  });
});

describe('routing', () => {
  it('returns a 404 with an error envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('auth middleware', () => {
  it('rejects protected routes without a bearer token (401)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('rejects a malformed/forged token (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('guards the admin and screen-time routers too', async () => {
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
    expect((await request(app).get('/api/v1/screentime/policies')).status).toBe(401);
  });
});

describe('request validation (zod)', () => {
  it('rejects signup with a missing/invalid body before touching the DB', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('rejects login with an empty body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
