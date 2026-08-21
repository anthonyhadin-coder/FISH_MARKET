import mysql from 'mysql2/promise';

async function run() {
    const pool = mysql.createPool({
        uri: 'mysql://root:Hadin_2378@localhost:3306/fish_market'
    });
    
    try {
        const [rows]: any = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
        console.log(rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
