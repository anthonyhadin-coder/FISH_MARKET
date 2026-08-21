import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function run() {
    const pool = mysql.createPool({
        uri: 'mysql://root:Hadin_2378@localhost:3306/fish_market'
    });
    
    try {
        const [users]: any = await pool.query("SELECT id, phone, email, role FROM users WHERE role IN ('owner', 'agent') LIMIT 1");
        
        const plainPassword = 'Password123!';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        if (users.length > 0) {
            const user = users[0];
            await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, user.id]);
            console.log("Updated existing user password.");
            console.log("Phone/Username:", user.phone);
            console.log("Role:", user.role);
            console.log("Password:", plainPassword);
        } else {
            console.log("No user found. Creating one...");
            const phone = '9999999999';
            await pool.query(
                "INSERT INTO users (name, phone, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?)",
                ['Test Owner', phone, 'owner', hashedPassword, true]
            );
            console.log("Created new user.");
            console.log("Phone/Username:", phone);
            console.log("Role: owner");
            console.log("Password:", plainPassword);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
