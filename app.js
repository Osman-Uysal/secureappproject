const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const helmet = require('helmet');
const csrf = require('csurf');
const bcrypt = require('bcrypt');
const app = express();

app.use(session({
    secret: require('crypto').randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, 
        httpOnly: true,
        sameSite: 'strict'
    }
}));

app.use(helmet({
    referrerPolicy: { policy: 'no-referrer-when-downgrade' }
}));

app.use(express.urlencoded({ extended: true })); 
app.use(express.static('public')); 

const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection); 


app.set('view engine', 'ejs');


// Database connection
const db = new sqlite3.Database('./database.sqlite');

// Create tables 
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        is_admin INTEGER DEFAULT 0
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    
    // Add admin user with hashed password
    db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            db.run("INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)", 
                  ['admin', hashedPassword]);
        }
    });
});

app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('CSRF Token Error:', {
            message: err.message,
            receivedToken: req.body._csrf,
            sessionToken: req.csrfToken(),
            sessionID: req.sessionID,
            cookies: req.cookies
        });
        return res.status(403).send('Invalid CSRF token');
    }
    next(err);
});

app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes 

// Home page with parameterized query
app.get('/', (req, res) => {
    const search = req.query.search || '';
    
    db.all(`SELECT posts.*, users.username 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE title LIKE ? 
            ORDER BY created_at DESC`, 
            [`%${search}%`], (err, posts) => {
        res.render('index', { 
            posts: posts || [], 
            user: req.session.user, 
            search,
            csrfToken: req.csrfToken() // Add CSRF token
        });
    });
});

// Login with parameterized query and bcrypt
app.get('/login', (req, res) => {
    const csrfToken = req.csrfToken();
    console.log('Generated CSRF Token:', csrfToken);
    res.render('login', { error: null, csrfToken });
});

app.post('/login', csrfProtection, async (req, res) => {
    console.log('Received CSRF Token:', req.body._csrf);
    console.log('Session CSRF Token:', req.csrfToken()); 

    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { 
                error: 'Invalid credentials', 
                csrfToken: req.csrfToken() 
            });
        }

        req.session.regenerate(() => {
            req.session.user = user;
            res.redirect('/');
        });
    });
});

// Registration with password hashing
app.get('/register', (req, res) => {
    res.render('register', { error: null, csrfToken: req.csrfToken() });
});

app.post('/register', csrfProtection, async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, 
          [username, hashedPassword], function(err) {
        if (err) {
            return res.render('register', { 
                error: 'Registration failed', 
                csrfToken: req.csrfToken() 
            });
        }
        res.redirect('/login');
    });
});

// Create post with CSRF
app.post('/posts', csrfProtection, (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { title, content } = req.body;
    db.run(`INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)`, 
          [title, content, req.session.user.id], (err) => {
        res.redirect('/');
    });
});

// Edit post with CSRF
app.get('/posts/:id/edit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    db.get(`SELECT * FROM posts WHERE id = ?`, [req.params.id], (err, post) => {
        if (!post) return res.redirect('/');
        
        res.render('edit', { 
            post, 
            csrfToken: req.csrfToken() 
        });
    });
});

// Update post with CSRF
app.post('/posts/:id', csrfProtection, (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { title, content } = req.body;
    db.run(`UPDATE posts SET title = ?, content = ? WHERE id = ?`, 
          [title, content, req.params.id], (err) => {
        res.redirect('/');
    });
});

// Delete post with CSRF
app.post('/posts/:id/delete', csrfProtection, (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    db.run(`DELETE FROM posts WHERE id = ?`, [req.params.id], (err) => {
        res.redirect('/');
    });
});

// Logout
app.post('/logout', csrfProtection, (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Users page (same but with CSRF)
app.get('/users', (req, res) => {
    if (!req.session.user?.is_admin) return res.redirect('/');
    
    db.all(`SELECT id, username, is_admin FROM users`, (err, users) => {
        res.render('users', { 
            users,
            csrfToken: req.csrfToken() 
        });
    });
});

app.listen(3001, () => {
    console.log('Secure movie app running on http://localhost:3001');
});