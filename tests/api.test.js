import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';

describe('API Auth Middleware', () => {
  const originalToken = process.env.API_TOKEN;

  beforeEach(() => {
    process.env.API_TOKEN = 'test-secret-token';
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.API_TOKEN;
    } else {
      process.env.API_TOKEN = originalToken;
    }
  });

  it('should return 401 when API_TOKEN is set but no token provided', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  it('should return 401 when API_TOKEN is set but wrong token provided', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('should allow access when API_TOKEN is set and correct token provided', async () => {
    // we just need it to bypass the auth middleware, returning 200 or whatever the route does
    // since initDB isn't called here, we might get 500, but we shouldn't get 401
    const res = await request(app).get('/api/system/info').set('Authorization', 'Bearer test-secret-token');
    expect(res.status).not.toBe(401);
  });
});

describe('Security Middlewares', () => {
  it('should include helmet security headers', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.headers['x-powered-by']).toBeUndefined(); // Helmet removes this by default
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN'); // Helmet sets this
    expect(res.headers['x-content-type-options']).toBe('nosniff'); // Helmet sets this
  });

  it('should enforce rate limiting on /api routes', async () => {
    const rateLimitIp = '192.168.1.2'; // Use a distinct IP for this test
    // Make 100 requests (the limit)
    for (let i = 0; i < 100; i++) {
      await request(app).get('/api/settings').set('X-Forwarded-For', rateLimitIp);
    }

    // The 101st request should be blocked by rate limit
    const res = await request(app).get('/api/settings').set('X-Forwarded-For', rateLimitIp);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests, please try again later.');
  });
});

import { initDB, closeDB } from '../server/memory/store.js';
import { v4 as uuidv4 } from 'uuid';

describe('API Routes', () => {
  const originalToken = process.env.API_TOKEN;
  let testIp;

  beforeEach(() => {
    delete process.env.API_TOKEN;
    initDB(':memory:');
    testIp = uuidv4();
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.API_TOKEN;
    } else {
      process.env.API_TOKEN = originalToken;
    }
    closeDB();
  });

  it('GET /api/settings should return 200 with valid JSON', async () => {
    const res = await request(app).get('/api/settings').set('X-Forwarded-For', testIp);
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Object);
  });

  it('GET /api/tools should return an array of tool definitions', async () => {
    const res = await request(app).get('/api/tools').set('X-Forwarded-For', testIp);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
  });

  it('GET /api/memory should return 200', async () => {
    const res = await request(app).get('/api/memory').set('X-Forwarded-For', testIp);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/conversations should create a conversation and return its id', async () => {
    const res = await request(app).post('/api/conversations').set('X-Forwarded-For', testIp).send({ title: 'Test Conv' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Test Conv');
  });

  it('GET /api/system/info should return 200', async () => {
    const res = await request(app).get('/api/system/info').set('X-Forwarded-For', testIp);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hostname');
    expect(res.body).toHaveProperty('platform');
  });
  it('DELETE /api/skills/:name should reject invalid skill names (path traversal)', async () => {
    const res1 = await request(app).delete('/api/skills/..%2Fsecret').set('X-Forwarded-For', testIp);
    expect(res1.status).toBe(404); // The router actually fails to match the route for ..%2Fsecret and goes to 404 handler, or the param is not matching.

    const res2 = await request(app).delete('/api/skills/%21%40%23%24').set('X-Forwarded-For', testIp);
    expect(res2.status).toBe(400);
  });

});