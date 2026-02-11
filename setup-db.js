const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
});

console.log('--- Database Setup Script ---');

connection.connect((err) => {
    if (err) {
        console.error('❌ Error connecting to MySQL:', err.message);
        process.exit(1);
    }

    console.log('✅ Connected to MySQL.');

    // Create Database
    connection.query(`CREATE DATABASE IF NOT EXISTS healthcare_db`, (err) => {
        if (err) {
            console.error('❌ Error creating database:', err.message);
            process.exit(1);
        }
        console.log('✅ Database "healthcare_db" created or already exists.');

        // Use Database
        connection.query(`USE healthcare_db`, (err) => {
            if (err) {
                console.error('❌ Error selecting database:', err.message);
                process.exit(1);
            }

            // Create Table
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            connection.query(createTableQuery, (err) => {
                if (err) {
                    console.error('❌ Error creating users table:', err.message);
                    process.exit(1);
                }
                console.log('✅ Users table created or already exists.');
                console.log('\n🌟 ALL OK! You can now run "npm start".');
                connection.end();
                process.exit(0);
            });
        });
    });
});
