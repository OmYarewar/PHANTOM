import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import apiRouter from './api.js';
import { initDB, closeDB } from '../memory/store.js';

let server;
let baseUrl;

describe('API Routes Integration', () => {
  before(async () => {
    initDB(':memory:');
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
    closeDB();
  });

  test('GET /api/tools should return list of available tools', async () => {
    const res = await fetch(`${baseUrl}/tools`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data), 'Tools should be an array');
    assert.ok(data.length > 0, 'Should have at least one tool');
    assert.ok(data[0].name, 'Tool should have a name');
  });

  test('Conversation CRUD operations', async () => {
    // Create
    let res = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Integration Test Conversation' })
    });
    assert.strictEqual(res.status, 200);
    const conv = await res.json();
    assert.strictEqual(conv.title, 'Integration Test Conversation');
    assert.ok(conv.id);

    const convId = conv.id;

    // Get
    res = await fetch(`${baseUrl}/conversations/${convId}`);
    assert.strictEqual(res.status, 200);
    const getConv = await res.json();
    assert.strictEqual(getConv.id, convId);

    // Update title
    res = await fetch(`${baseUrl}/conversations/${convId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' })
    });
    assert.strictEqual(res.status, 200);

    // Delete
    res = await fetch(`${baseUrl}/conversations/${convId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);

    // Get (should fail)
    res = await fetch(`${baseUrl}/conversations/${convId}`);
    assert.strictEqual(res.status, 404);
  });
});
