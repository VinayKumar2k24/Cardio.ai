const mysql = require('mysql2');
require('dotenv').config({ path: './.env' });

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

console.log('--- Database Connection Test ---');
console.log(`Attempting to connect to ${process.env.DB_HOST} as ${process.env.DB_USER}...`);

connection.connect((err) => {
    if (err) {
        console.error('❌ Connection Failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);

        if (err.code === 'ECONNREFUSED') {
            console.log('\n💡 Tip: Your MySQL server might not be running.');
            console.log('To start MySQL on Windows:');
            console.log('1. Press Win + R, type "services.msc" and press Enter.');
            console.log('2. Look for "MySQL" or "MySQL80" in the list.');
            console.log('3. Right-click it and select "Start".');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 Tip: Your username or password in .env is incorrect.');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.log(`\n💡 Tip: The database "${process.env.DB_NAME}" does not exist.`);
            console.log('Run the commands in schema.sql to create it.');
        }
        process.exit(1);
    } else {
        console.log('✅ Successfully connected to MySQL!');
        connection.end();
        process.exit(0);
    }
});
