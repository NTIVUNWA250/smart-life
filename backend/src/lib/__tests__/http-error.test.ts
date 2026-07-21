import { describe, expect, it } from 'vitest';
import {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from '../http-error.js';

describe('http-error', () => {
  it('carries status, code and message', () => {
    const e = new HttpError(418, 'teapot', 'I am a teapot', { hint: 'x' });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(418);
    expect(e.code).toBe('teapot');
    expect(e.message).toBe('I am a teapot');
    expect(e.details).toEqual({ hint: 'x' });
  });

  it('helpers set the conventional status codes', () => {
    expect(badRequest('bad').status).toBe(400);
    expect(badRequest('bad').code).toBe('bad_request');
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    expect(conflict('dup').status).toBe(409);
  });

  it('helpers expose sensible default messages', () => {
    expect(unauthorized().message).toBe('Authentication required');
    expect(forbidden().message).toBe('Not allowed');
    expect(notFound().message).toBe('Not found');
  });
});
