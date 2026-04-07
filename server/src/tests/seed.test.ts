import pool from '../core/db'; 

export const seedDatabase = async () => {
  // Clear existing data (Order matters for FK constraints)
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE buyer_transactions');
  await pool.query('TRUNCATE TABLE sales');
  await pool.query('TRUNCATE TABLE boats');
  await pool.query('TRUNCATE TABLE buyers');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // Insert Mock Data
  await pool.query(`
    INSERT INTO users (id, name, phone, password_hash, role) 
    VALUES (1, 'Test Agent', '9876543210', 'hashed_pass', 'agent')
  `);

  await pool.query(`
    INSERT INTO boats (id, name, agent_id)
    VALUES (1, 'Vessel A', 1)
  `);

  await pool.query(`
    INSERT INTO buyers (id, name, phone)
    VALUES (1, 'Anbu', '9876543210')
  `);
};

export const teardownDatabase = async () => {
  await pool.end();
};

export const factory = {
  createSale: async (data: any) => {
    const total = data.weight * data.rate;
    const [result] = await pool.query(
      'INSERT INTO sales (boat_id, buyer_id, fish_name, weight, rate, total) VALUES (?, ?, ?, ?, ?, ?)',
      [data.boatId, data.buyerId, data.fishName, data.weight, data.rate, total]
    );
    return (result as any).insertId;
  }
};
