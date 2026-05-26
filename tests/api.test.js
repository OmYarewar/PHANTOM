import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server/app.js';
import { initDB, closeDB } from '../server/memory/store.js';

describe('API Routes', () => {
  beforeEach(() => {
    initDB(':memory:');
  });

  afterEach(() => {
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
});
