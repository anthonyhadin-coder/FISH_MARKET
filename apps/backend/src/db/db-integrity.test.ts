import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// This test suite requires a live MySQL database.
// It is skipped automatically when DB_HOST / DB_USER env vars are not set
// (e.g. in local dev without Docker, or in CI without a DB service).
const HAS_DB = Boolean(process.env.DB_HOST && process.env.DB_USER);

describe.skipIf(!HAS_DB)('Database Integrity & Constraints', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seedDatabase: () => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let teardownDatabase: () => Promise<any>;

  beforeAll(async () => {
    // Dynamic import so the DB pool is only instantiated when the suite actually runs
    const dbModule = await import('@fishmarket/database');
    const seedModule = await import('./seed');
    pool = dbModule.default;
    seedDatabase = seedModule.seedDatabase;
    teardownDatabase = seedModule.teardownDatabase;
    await seedDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('should enforce Foreign Key constraints on sales', async () => {
    try {
      await pool.query(
        'INSERT INTO sales (boat_id, buyer_id, fish_name, weight, rate, total) VALUES (?, ?, ?, ?, ?, ?)',
        [9999, 1, 'Sankara', 10, 100, 1000]
      );
      throw new Error('Should have failed');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe('ER_NO_REFERENCED_ROW_2');
    }
  });

  it('should enforce NOT NULL constraints', async () => {
    try {
      await pool.query('INSERT INTO buyers (name, phone) VALUES (?, ?)', [null, '12345']);
      throw new Error('Should have failed');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe('ER_BAD_NULL_ERROR');
    }
  });

  it('should verify cascade delete behavior', async () => {
    await pool.query('DELETE FROM boats WHERE id = 1');
    const [rows] = await pool.query('SELECT * FROM sales WHERE boat_id = 1');
    expect((rows as unknown[]).length).toBe(0);
  });
});
