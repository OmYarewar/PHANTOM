import { describe, it, expect } from 'vitest';
import { validateParams } from '../server/memory/store.js';

describe('validateParams()', () => {
  it('throws clear error on parameter count mismatch', () => {
    expect(() => validateParams('SELECT * FROM t WHERE a=? AND b=?', ['only_one']))
      .toThrow('SQL parameter mismatch');
  });

  it('passes when parameter count matches', () => {
    expect(() => validateParams('SELECT * FROM t WHERE a=? AND b=?', ['one', 'two']))
      .not.toThrow();
  });
});
