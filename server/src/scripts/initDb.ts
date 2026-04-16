import pool from '../config/db';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const initDb = async () => {
  let connection;
  try {
    console.log('Connecting to MySQL to create database if not exists...');
    
    // First connect without database to create it
    // Construct DATABASE_URL from individual parameters if not set
    if (!process.env.DATABASE_URL) {
      const dbHost = process.env.DB_HOST || 'localhost';
      const dbPort = process.env.DB_PORT || '3306';
      const dbUser = process.env.DB_USER || 'root';
      const dbPassword = process.env.DB_PASSWORD || '';
      const dbName = process.env.DB_NAME || 'fish_market';

      const encodedUser = encodeURIComponent(dbUser);
      const encodedPassword = encodeURIComponent(dbPassword);
      process.env.DATABASE_URL = `mysql://${encodedUser}:${encodedPassword}@${dbHost}:${dbPort}/${dbName}`;
    }

    const dbUrl = process.env.DATABASE_URL!;
    const parsedUrl = new URL(dbUrl);
    const dbName = parsedUrl.pathname.replace('/', '') || 'fish_market';
    // Remove the pathname (database name) to connect to mysql server generally
    const urlWithoutDb = dbUrl.replace(parsedUrl.pathname, '');
    
    connection = await mysql.createConnection(urlWithoutDb);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`\${dbName}\``);
    await connection.end();
    
    console.log('Database connected/created. Initializing tables...');

    // Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('agent', 'owner', 'buyer') DEFAULT 'agent',
        language VARCHAR(20) DEFAULT 'tamil',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Boats Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id INT,
        agent_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // Buyers Table (Must be created before sales because sales references buyers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        balance_due DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sales Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boat_id INT,
        agent_id INT,
        buyer_id INT,
        fish_name VARCHAR(100) NOT NULL,
        weight DECIMAL(10,2) NOT NULL,
        rate DECIMAL(10,2) NOT NULL,
        total DECIMAL(12,2) NOT NULL,
        buyer_name VARCHAR(100),
        amount_paid DECIMAL(12,2) DEFAULT 0,
        balance DECIMAL(12,2) DEFAULT 0,
        time TIME DEFAULT (CURRENT_TIME),
        date DATE DEFAULT (CURRENT_DATE),
        FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE SET NULL,
        INDEX idx_sales_date (date),
        INDEX idx_sales_agent_date (agent_id, date),
        INDEX idx_sales_boat_date (boat_id, date),
        INDEX idx_sales_buyer (buyer_id)
      );
    `);

    // Expenses Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boat_id INT,
        agent_id INT,
        expense_type ENUM('diesel', 'ice', 'van_rent', 'net_repair', 'food', 'other'),
        amount DECIMAL(10,2) NOT NULL,
        note TEXT,
        time TIME DEFAULT (CURRENT_TIME),
        date DATE DEFAULT (CURRENT_DATE),
        FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_expenses_date (date),
        INDEX idx_expenses_boat_date (boat_id, date)
      );
    `);

    // Boat Payments Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boat_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boat_id INT,
        agent_id INT,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        time TIME DEFAULT (CURRENT_TIME),
        date DATE DEFAULT (CURRENT_DATE),
        FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_boat_payments_date (date),
        INDEX idx_boat_payments_boat (boat_id, date)
      );
    `);

    // Buyer Transactions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyer_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        buyer_id INT,
        sale_id INT,
        amount_paid DECIMAL(12,2) NOT NULL,
        balance_remaining DECIMAL(12,2) NOT NULL,
        date DATE DEFAULT (CURRENT_DATE),
        FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
        INDEX idx_bt_buyer_date (buyer_id, date)
      );
    `);

    // Voice Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voice_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agent_id INT,
        transcript TEXT NOT NULL,
        parsed_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Staff Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50),
        joined_date DATE DEFAULT (CURRENT_DATE),
        active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Staff Salaries Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_salaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id INT,
        amount DECIMAL(12,2) NOT NULL,
        date DATE DEFAULT (CURRENT_DATE),
        note TEXT,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        INDEX idx_salaries_date (date)
      );
    `);

    // Shared Slips Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_slips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        boat_id INT NOT NULL,
        agent_id INT NOT NULL,
        owner_id INT NOT NULL,
        date DATE NOT NULL,
        slip_data JSON NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        status ENUM('sent', 'read') DEFAULT 'sent',
        FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_daily_slip (boat_id, date)
      );
    `);

    // Production Indexes
    console.log('Verifying/Adding indexes...');
    try {
      await pool.query(`CREATE INDEX idx_users_phone ON users(phone)`);
    } catch (e: any) { if (e.code !== 'ER_DUP_KEYNAME') console.error(e); }
    
    try {
      await pool.query(`CREATE INDEX idx_entries_created_at ON sales(created_at)`);
    } catch (e: any) { if (e.code !== 'ER_DUP_KEYNAME') console.error(e); }
    
    try {
      await pool.query(`CREATE INDEX idx_entries_boat_id ON sales(boat_id)`);
    } catch (e: any) { if (e.code !== 'ER_DUP_KEYNAME') console.error(e); }

    console.log('Tables created successfully.');

    if (process.env.NODE_ENV !== 'production') {
      // Seed dummy user
      const [rows]: any = await pool.query(`SELECT * FROM users WHERE phone = ?`, ['9876543210']);
      if (rows.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('password123', salt);
        const [result]: any = await pool.query(`
          INSERT INTO users (name, phone, password_hash, role, language)
          VALUES ('Ravi', '9876543210', ?, 'agent', 'tamil')
        `, [hash]);
        
        const agentId = result.insertId;
        console.log('Seed agent Ravi created with phone 9876543210 and password: password123');

        // Seed boats
        await pool.query(`INSERT INTO boats (name, agent_id) VALUES ('Sea King', ?)`, [agentId]);
        await pool.query(`INSERT INTO boats (name, agent_id) VALUES ('Ocean Star', ?)`, [agentId]);
        console.log('Seed boats created.');
      } else {
          console.log('Seed agent already exists.');
      }

      // Seed owner user
      const [ownerRows]: any = await pool.query(`SELECT * FROM users WHERE phone = ?`, ['1111111111']);
      if (ownerRows.length === 0) {
        const salt2 = await bcrypt.genSalt(10);
        const hash2 = await bcrypt.hash('owner123', salt2);
        await pool.query(`
          INSERT INTO users (name, phone, password_hash, role, language)
          VALUES ('Admin Owner', '1111111111', ?, 'owner', 'english')
        `, [hash2]);
        console.log('Seed owner created: phone=1111111111, password=owner123');
      } else {
          console.log('Seed owner already exists.');
      }
    } else {
        console.log('Skipping seed data in production environment.');
    }

  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

initDb();
