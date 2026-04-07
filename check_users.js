const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function checkUsers() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute('SELECT id, name, phone, role FROM users');
    console.log('--- USERS IN DATABASE ---');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error querying users:', err);
  } finally {
    await connection.end();
  }
}

checkUsers();
