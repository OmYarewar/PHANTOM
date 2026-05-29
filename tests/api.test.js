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

import { initDB, closeDB } from '../server/memory/store.js';

describe('API Routes', () => {
  const originalToken = process.env.API_TOKEN;

  beforeEach(() => {
    delete process.env.API_TOKEN;
    initDB(':memory:');
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
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Object);
  });

  it('GET /api/tools should return an array of tool definitions', async () => {
    const res = await request(app).get('/api/tools');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
  });

  it('GET /api/memory should return 200', async () => {
    const res = await request(app).get('/api/memory');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/conversations should create a conversation and return its id', async () => {
    const res = await request(app).post('/api/conversations').send({ title: 'Test Conv' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Test Conv');
  });

  it('GET /api/system/info should return 200', async () => {
    const res = await request(app).get('/api/system/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hostname');
    expect(res.body).toHaveProperty('platform');
  });
  it('DELETE /api/skills/:name should reject invalid skill names (path traversal)', async () => {
    const res1 = await request(app).delete('/api/skills/..%2Fsecret');
    expect(res1.status).toBe(404); // The router actually fails to match the route for ..%2Fsecret and goes to 404 handler, or the param is not matching.

    const res2 = await request(app).delete('/api/skills/%21%40%23%24');
    expect(res2.status).toBe(400);
  });

});