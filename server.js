const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = 'SHAMA_RADAR_VISION_SECURE_KEY_2026_!';
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        // Fallback default admin
        return [{
            id: "1",
            username: "shama786",
            password: "$2b$10$1T.P8647O51RcwsByEqgUORYLhh48r0eu.R/DzLlKv50mPRPIvpY.",
            role: "ADMIN",
            name: "Shama Admin",
            blocked: false,
            createdAt: "10/06/2026"
        }];
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('[-] Error saving users.json:', err.message);
    }
}

// Authentication middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = loadUsers();
        const user = users.find(u => u.id === decoded.id);
        if (!user || user.blocked) {
            return res.status(401).json({ success: false, message: 'Access denied. Account blocked or not found.' });
        }
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
    }
}

// Admin role check middleware
function adminOnly(req, res, next) {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    next();
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ==========================================
// AUTH ROUTING
// ==========================================

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'User ID and Password are required.' });
    }
    
    const users = loadUsers();
    const user = users.find(u => u.username === username.trim().toLowerCase());
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid User ID or Password.' });
    }
    
    if (user.blocked) {
        return res.status(403).json({ success: false, message: '🚫 Account blocked. Contact admin.' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid User ID or Password.' });
    }
    
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' } // Keep user logged in for 30 days
    );
    
    console.log(`[+] User authenticated successfully: ${user.username} (${user.role})`);
    res.json({
        success: true,
        token,
        user: { username: user.username, role: user.role, name: user.name }
    });
});

// Verify Token Route
app.get('/api/verify', authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});

// ==========================================
// ADMIN USER MANAGEMENT ROUTING
// ==========================================

// List users
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
    const users = loadUsers();
    res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        name: u.name,
        blocked: u.blocked,
        createdAt: u.createdAt
    })));
});

// Create user
app.post('/api/admin/add-user', authMiddleware, adminOnly, async (req, res) => {
    const { username, password, name } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required.' });
    }
    
    const users = loadUsers();
    if (users.find(u => u.username === username.trim().toLowerCase())) {
        return res.status(400).json({ success: false, message: 'User ID already exists.' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        username: username.trim().toLowerCase(),
        password: hashed,
        role: 'USER',
        name: name || username,
        blocked: false,
        createdAt: new Date().toLocaleDateString('en-GB')
    };
    
    users.push(newUser);
    saveUsers(users);
    console.log(`[ADMIN] User created: ${username}`);
    res.json({ success: true, message: `✅ User "${username}" created successfully!` });
});

// Block user
app.post('/api/admin/block-user', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'ADMIN') return res.status(400).json({ success: false, message: 'Cannot block Admin.' });
    
    user.blocked = true;
    saveUsers(users);
    console.log(`[ADMIN] User blocked: ${username}`);
    res.json({ success: true, message: `🚫 User "${username}" blocked successfully!` });
});

// Unblock user
app.post('/api/admin/unblock-user', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    user.blocked = false;
    saveUsers(users);
    console.log(`[ADMIN] User unblocked: ${username}`);
    res.json({ success: true, message: `✅ User "${username}" unblocked successfully!` });
});

// Delete user
app.post('/api/admin/delete-user', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.body;
    let users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'ADMIN') return res.status(400).json({ success: false, message: 'Cannot delete Admin.' });
    
    users = users.filter(u => u.username !== username);
    saveUsers(users);
    console.log(`[ADMIN] User deleted: ${username}`);
    res.json({ success: true, message: `🗑️ User "${username}" deleted successfully!` });
});

// Reset password for a user
app.post('/api/admin/change-password', authMiddleware, adminOnly, async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ success: false, message: 'Username and new password required.' });
    
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    user.password = await bcrypt.hash(newPassword, 10);
    saveUsers(users);
    res.json({ success: true, message: `✅ Password changed for "${username}"!` });
});

// Serve frontend SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('===================================================');
    console.log(`🚀 SHAMA ALPHA RADAR LOGIN PORTAL RUNNING ON PORT ${PORT}`);
    console.log(`👉 Visit: http://localhost:${PORT}`);
    console.log('===================================================');
});
