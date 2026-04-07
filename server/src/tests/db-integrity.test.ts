import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../core/db';
import { seedDatabase, teardownDatabase } from './seed.test';

describe('Database Integrity & Constraints', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it('should enforce Foreign Key constraints on sales', async () => {
    // Attempt to insert a sale for a non-existent boat
    try {
      await pool.query(
        'INSERT INTO sales (boat_id, buyer_id, fish_name, weight, rate, total) VALUES (?, ?, ?, ?, ?, ?)',
        [9999, 1, 'Sankara', 10, 100, 1000]
      );
      throw new Error('Should have failed');
    } catch (error: any) {
      expect(error.code).toBe('ER_NO_REFERENCED_ROW_2');
    }
  });

  it('should enforce NOT NULL constraints', async () => {
    try {
      await pool.query('INSERT INTO buyers (name, phone) VALUES (?, ?)', [null, '12345']);
      throw new Error('Should have failed');
    } catch (error: any) {
      expect(error.code).toBe('ER_BAD_NULL_ERROR');
    }
  });

  it('should verify cascade delete behavior', async () => {
    // Delete the test boat
    await pool.query('DELETE FROM boats WHERE id = 1');
    
    // Sales associated with boat 1 should be gone (if cascade is set)
    const [rows] = await pool.query('SELECT * FROM sales WHERE boat_id = 1');
    expect((rows as any).length).toBe(0);
  });
});
