const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { spawn } = require('child_process');
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// 1. Create Connection Pool (More stable)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 2. Clear Connection Test
db.getConnection((err, connection) => {
    if (err) {
        console.error('\x1b[31m%s\x1b[0m', '❌ DATABASE CONNECTION FAILED:');
        console.error(err.message);
        return;
    }
    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESSFULLY CONNECTED TO MYSQL (Pool Mode)');
    connection.release();
});

// 3. Robust Signup Route
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    console.log(`\x1b[36m[Signup Attempt]\x1b[0m User: ${username}, Email: ${email}`);

    // --- Backend Validation ---

    // 1. Username Validation (Alphabets only)
    const usernameRegex = /^[a-zA-Z]+$/;
    if (!username || !usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username must contain only alphabets (lowercase or uppercase, no spaces).' });
    }

    // 2. Email Validation (Basic regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address (e.g., user@example.com).' });
    }

    // 3. Password Strength Validation
    // Requires: Min 8 chars, 1 Uppercase, 1 Lowercase, 1 Number, 1 Special Char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be strong: at least 8 characters, including uppercase, lowercase, number, and any special character.' });
    }

    // --- End Validation ---

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';

        db.query(query, [username, email, hashedPassword], (err, result) => {
            if (err) {
                console.error('\x1b[31m%s\x1b[0m', '❌ SIGNUP DB ERROR:');
                console.error(err);

                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Username or Email already exists' });
                }
                return res.status(500).json({ error: 'Database failed: ' + err.message });
            }
            console.log('\x1b[32m%s\x1b[0m', `✅ User ${username} created successfully!`);
            res.status(201).json({ message: 'User registered successfully' });
        });
    } catch (error) {
        console.error('Bcrypt Error:', error);
        res.status(500).json({ error: 'Encryption failed' });
    }
});

// 4. Login Route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ?';

    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(401).json({ error: 'User not found' });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, username: user.username });
    });
});

// 5. Get Profile Details
app.get('/api/profile', authenticateToken, (req, res) => {
    const query = 'SELECT id, username, email FROM users WHERE id = ?';
    db.query(query, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(results[0]);
    });
});

// 6. Update Profile
app.post('/api/profile/update', authenticateToken, async (req, res) => {
    const { username, email, password } = req.body;
    const userId = req.user.id;

    let updateFields = [];
    let values = [];

    if (username) {
        if (!/^[a-zA-Z]+$/.test(username)) {
            return res.status(400).json({ error: 'Username must contain only alphabets.' });
        }
        updateFields.push('username = ?');
        values.push(username);
    }

    if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }
        updateFields.push('email = ?');
        values.push(email);
    }

    if (password) {
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)) {
            return res.status(400).json({ error: 'Password must be strong (8+ chars, Upper, Lower, Num, Special).' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update.' });
    }

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(userId);

    db.query(query, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Username or Email already taken.' });
            }
            return res.status(500).json({ error: 'Update failed: ' + err.message });
        }
        res.json({ message: 'Profile updated successfully!', username: username || req.user.username });
    });
});

// 7. Forgot Password - Request OTP & Send Email
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60000);

    const query = 'UPDATE users SET reset_otp = ?, reset_otp_expires = ? WHERE email = ?';
    db.query(query, [otp, expires, email], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Email not found' });

        // Email Content
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'CardioAI Password Reset OTP',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #00ff88;">Password Reset Request</h2>
                    <p>Your OTP for resetting your CardioAI password is:</p>
                    <h1 style="letter-spacing: 5px; color: #333;">${otp}</h1>
                    <p>This code is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('\x1b[31m%s\x1b[0m', '❌ EMAIL SEND FAILED:', error.message);
                console.log(`\x1b[33m[FALLBACK OTP]\x1b[0m for ${email}: \x1b[1m${otp}\x1b[0m (Check .env for email setup)`);
                return res.json({ message: 'OTP generated! (Email failed, check server console for fallback OTP)' });
            }
            console.log('\x1b[32m%s\x1b[0m', '✅ OTP EMAIL SENT to ' + email);
            res.json({ message: 'OTP sent successfully to your email!' });
        });
    });
});

// 8. Verify OTP Only
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const query = 'SELECT * FROM users WHERE email = ? AND reset_otp = ? AND reset_otp_expires > NOW()';
    db.query(query, [email, otp], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });
        res.json({ message: 'OTP verified! Now enter your new password.' });
    });
});

// 9. Reset Password - Final Step
app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const query = 'SELECT * FROM users WHERE email = ? AND reset_otp = ? AND reset_otp_expires > NOW()';
    db.query(query, [email, otp], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(newPassword)) {
            return res.status(400).json({ error: 'Password must be strong (8+ chars, Upper, Lower, Num, Special).' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updateQuery = 'UPDATE users SET password = ?, reset_otp = NULL, reset_otp_expires = NULL WHERE email = ?';

        db.query(updateQuery, [hashedPassword, email], (err, result) => {
            if (err) return res.status(500).json({ error: 'Update failed' });
            res.json({ message: 'Password reset successfully! You can now login.' });
        });
    });
});

// 10. Health Prediction Route
function runPrediction(data) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('py', ['predict.py']);
        let output = '';
        let errorOutput = '';

        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python stderr: ${errorOutput}`);
                reject(new Error(`Python process exited with code ${code}`));
                return;
            }
            try {
                resolve(JSON.parse(output));
            } catch (e) {
                reject(new Error(`Failed to parse python output: ${output}`));
            }
        });
    });
}

app.post('/api/predict', authenticateToken, upload.single('csv'), async (req, res) => {
    try {
        if (req.file) {
            const results = [];
            fs.createReadStream(req.file.path)
                .pipe(csv({ headers: false }))
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                    fs.unlinkSync(req.file.path);
                    try {
                        const prediction = await runPrediction(results);

                        let recommendation = '';
                        if (Array.isArray(prediction)) {
                            recommendation = `Processed ${results.length} rows. `;
                            recommendation += prediction.map((p, i) => {
                                const label = p.prediction === '0' ? 'Healthy' : 'Risk Detected';
                                return `Person ${i + 1}: ${label} (${(p.probability * 100).toFixed(1)}%). ${p.explanation || ''}`;
                            }).join(' ');
                        } else {
                            const label = prediction.prediction === '0' ? 'Healthy' : 'Risk Detected';
                            recommendation = `Analysis Result: ${label}. Confidence: ${(prediction.probability * 100).toFixed(1)}%. ${prediction.explanation || ''}`;
                        }

                        res.json({
                            risk: 'PROCESSED',
                            predictionData: prediction
                        });
                    } catch (err) {
                        console.error('Prediction Error:', err);
                        res.status(500).json({ error: 'Model Prediction Failed' });
                    }
                })
                .on('error', (err) => {
                    res.status(500).json({ error: 'CSV Processing Error' });
                });
        } else if (req.body.manualData) {
            const data = JSON.parse(req.body.manualData);
            try {
                const prediction = await runPrediction(data);
                res.json({
                    risk: prediction.is_risk ? 'RISK' : 'HEALTHY',
                    predictionData: prediction
                });
            } catch (err) {
                console.error('Prediction Error:', err);
                res.status(500).json({ error: 'Model Prediction Failed' });
            }
        } else {
            res.status(400).json({ error: 'No data provided.' });
        }
    } catch (err) {
        console.error('Outer Prediction Error:', err);
        res.status(500).json({ error: 'Error during analysis.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\x1b[34m%s\x1b[0m', ' Server running at http://localhost:' + PORT);
});