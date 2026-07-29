// ============================================================
// blockingHelpers.test.ts — vitest tests for number blacklist
// and keyword filter blocking helpers.
// ============================================================
// Run with: npx vitest run src/services/blockingHelpers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the real implementation — same code used by server.cjs and external-api.cjs.
const { attachBlockingHelpers } = require('./blockingHelpers.cjs') as {
  attachBlockingHelpers: (pool: MockPool) => MockPool;
};

// ─── Types for the mocked pool ───
type QueryMock = ((sql: string, params?: any[]) => Promise<{ rows: any[] }>) & ReturnType<typeof vi.fn>;

interface MockPool {
  query: QueryMock;
  checkNumberBlacklist: (destination: string, clientId?: string | null, supplierId?: string | null) => Promise<{ blocked: boolean; reason?: string }>;
  checkKeywordFilter: (message: string, clientId?: string | null, supplierId?: string | null) => Promise<{ blocked: boolean; reason?: string }>;
  checkBlockingRules: (destination: string, message: string, clientId?: string | null, supplierId?: string | null) => Promise<{ blocked: boolean; reason?: string }>;
}

// ─── Helper to create a fresh mock pool with real helpers attached ───
function makePool(): MockPool {
  const pool: MockPool = {
    query: vi.fn() as QueryMock,
    checkNumberBlacklist: undefined as any,
    checkKeywordFilter: undefined as any,
    checkBlockingRules: undefined as any,
  };
  // Attach the REAL implementation (same code used in production)
  return attachBlockingHelpers(pool);
}

// ============================================================
// checkNumberBlacklist
// ============================================================
describe('checkNumberBlacklist', () => {
  let pool: ReturnType<typeof makePool>;

  beforeEach(() => {
    pool = makePool();
  });

  it('returns { blocked: false } when no blacklist entries match', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await pool.checkNumberBlacklist('8801712345678');
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('blocks a matching global prefix (no client/supplier scope)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88017', client_id: null, supplier_id: null }],
    });
    const result = await pool.checkNumberBlacklist('8801712345678');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('88017');
    expect(result.reason).toContain('global');
  });

  it('blocks a matching prefix scoped to a specific client', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88013225', client_id: '42', supplier_id: null }],
    });
    const result = await pool.checkNumberBlacklist('88013225123456', '42');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('88013225');
    expect(result.reason).toContain('client #42');
  });

  it('blocks a matching prefix scoped to a specific supplier', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88071', client_id: null, supplier_id: '99' }],
    });
    const result = await pool.checkNumberBlacklist('8807105123456', null, '99');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('88071');
    expect(result.reason).toContain('supplier #99');
  });

  it('strips non-digit characters from destination before matching', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88017', client_id: null, supplier_id: null }],
    });
    const result = await pool.checkNumberBlacklist('+88-017-1234-5678');
    expect(result.blocked).toBe(true);
    // Verify the query received the sanitized digits
    const queryArgs = pool.query.mock.calls[0][1];
    expect(queryArgs[0]).toBe('8801712345678');
  });

  it('returns { blocked: false } for empty destination', async () => {
    const result = await pool.checkNumberBlacklist('');
    expect(result.blocked).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns { blocked: false } for null/undefined destination', async () => {
    const result1 = await pool.checkNumberBlacklist(null as any);
    expect(result1.blocked).toBe(false);

    const result2 = await pool.checkNumberBlacklist(undefined as any);
    expect(result2.blocked).toBe(false);
  });

  it('passes clientId and supplierId to the query', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await pool.checkNumberBlacklist('8801712345678', '5', '10');
    const queryArgs = pool.query.mock.calls[0][1];
    expect(queryArgs[0]).toBe('8801712345678');
    expect(queryArgs[1]).toBe('5');
    expect(queryArgs[2]).toBe('10');
  });

  it('blocks when destination exactly equals the blacklisted prefix', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88017', client_id: null, supplier_id: null }],
    });
    const result = await pool.checkNumberBlacklist('88017');
    expect(result.blocked).toBe(true);
  });

  it('soft-fails (allows) when the DB query throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection lost'));
    const result = await pool.checkNumberBlacklist('8801712345678');
    expect(result.blocked).toBe(false);
  });
});

// ============================================================
// checkKeywordFilter
// ============================================================
describe('checkKeywordFilter', () => {
  let pool: ReturnType<typeof makePool>;

  beforeEach(() => {
    pool = makePool();
  });

  // ─── substring matching ───
  describe('substring matching', () => {
    it('blocks message containing a substring keyword', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'substring', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('This is a Spam message!');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('spam');
      expect(result.reason).toContain('substring');
    });

    it('case-insensitive substring match', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'SPAM', match_mode: 'substring', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('this is spam content');
      expect(result.blocked).toBe(true);
    });

    it('allows message without a blocked keyword', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'substring', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('this is clean content');
      expect(result.blocked).toBe(false);
    });
  });

  // ─── whole-word matching ───
  describe('whole-word matching', () => {
    it('blocks a whole-word keyword surrounded by spaces', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('this is spam content');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('whole_word');
    });

    it('blocks whole-word at start of text', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('spam is bad');
      expect(result.blocked).toBe(true);
    });

    it('blocks whole-word at end of text', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('this is spam');
      expect(result.blocked).toBe(true);
    });

    it('does NOT block substring inside another word (whole-word mode)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('this is antispam content');
      expect(result.blocked).toBe(false);
    });

    it('blocks whole-word separated by punctuation (comma)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('hello,spam,world');
      expect(result.blocked).toBe(true);
    });

    it('blocks whole-word separated by punctuation (period)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'spam', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('hello.spam');
      expect(result.blocked).toBe(true);
    });
  });

  // ─── Unicode / Bengali ───
  describe('Unicode / Bengali text', () => {
    it('blocks Bengali whole-word separated by Bengali danda (।)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'স্প্যাম', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('হ্যালো।স্প্যাম।ওয়ার্ল্ড');
      expect(result.blocked).toBe(true);
    });

    it('blocks Bengali substring match', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'স্প্যাম', match_mode: 'substring', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('এটি একটি স্প্যাম মেসেজ');
      expect(result.blocked).toBe(true);
    });
  });

  // ─── scoping ───
  describe('scoping', () => {
    it('shows client scope in reason', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'badword', match_mode: 'substring', client_id: '7', supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('contains badword', '7');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('client #7');
    });

    it('shows supplier scope in reason', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'badword', match_mode: 'substring', client_id: null, supplier_id: '23' }],
      });
      const result = await pool.checkKeywordFilter('contains badword', null, '23');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('supplier #23');
    });

    it('shows global scope in reason', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'badword', match_mode: 'substring', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('contains badword');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('global');
    });
  });

  // ─── edge cases ───
  describe('edge cases', () => {
    it('returns { blocked: false } for empty message', async () => {
      const result = await pool.checkKeywordFilter('');
      expect(result.blocked).toBe(false);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('returns { blocked: false } for null/undefined message', async () => {
      const r1 = await pool.checkKeywordFilter(null as any);
      expect(r1.blocked).toBe(false);
      const r2 = await pool.checkKeywordFilter(undefined as any);
      expect(r2.blocked).toBe(false);
    });

    it('blocks on the FIRST matching keyword (multiple rules)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { keyword: 'first', match_mode: 'substring', client_id: null, supplier_id: null },
          { keyword: 'second', match_mode: 'substring', client_id: null, supplier_id: null },
        ],
      });
      const result = await pool.checkKeywordFilter('this contains first and second');
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('first');
    });

    it('passes message when no keyword matches from multiple rules', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { keyword: 'spam', match_mode: 'substring', client_id: null, supplier_id: null },
          { keyword: 'phish', match_mode: 'substring', client_id: null, supplier_id: null },
        ],
      });
      const result = await pool.checkKeywordFilter('clean content here');
      expect(result.blocked).toBe(false);
    });

    it('soft-fails (allows) when the DB query throws', async () => {
      pool.query.mockRejectedValueOnce(new Error('timeout'));
      const result = await pool.checkKeywordFilter('some message');
      expect(result.blocked).toBe(false);
    });

    it('handles regex-special characters in whole-word keywords (escapes them)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ keyword: 'a.b(c)', match_mode: 'whole_word', client_id: null, supplier_id: null }],
      });
      const result = await pool.checkKeywordFilter('the word a.b(c) is here');
      expect(result.blocked).toBe(true);
    });
  });
});

// ============================================================
// checkBlockingRules (combined check)
// ============================================================
describe('checkBlockingRules', () => {
  let pool: ReturnType<typeof makePool>;

  beforeEach(() => {
    pool = makePool();
  });

  it('returns { blocked: false } when neither blacklist nor keyword matches', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // number blacklist — no match
    pool.query.mockResolvedValueOnce({ rows: [] }); // keyword filter — no match
    const result = await pool.checkBlockingRules('8801712345678', 'clean message');
    expect(result.blocked).toBe(false);
  });

  it('blocks on number blacklist match first', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ prefix: '88017', client_id: null, supplier_id: null }],
    });
    const result = await pool.checkBlockingRules('8801712345678', 'clean message');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('blacklisted');
    // keyword filter should NOT have been called
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('blocks on keyword filter match when blacklist passes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // blacklist passes
    pool.query.mockResolvedValueOnce({
      rows: [{ keyword: 'spam', match_mode: 'substring', client_id: null, supplier_id: null }],
    });
    const result = await pool.checkBlockingRules('8801712345678', 'spam message');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('spam');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
