const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

console.log('--- Database Probe ---');

connection.connect((err) => {
    if (err) {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    }

    connection.query('DESCRIBE users', (err, results) => {
        if (err) {
            console.error('❌ Table "users" Error:', err.message);
            process.exit(1);
        }
        console.log('✅ Table "users" exists. Structure:');
        console.table(results);
        connection.end();
        process.exit(0);
    });
});
