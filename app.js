const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const app = express();

// Insecure session configuration
app.use(session({
    secret: 'insecureSecret123',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Insecure database connection
const db = new sqlite3.Database('./database.sqlite');

// Create tables with vulnerabilities
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
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
    
    // Add admin user if not exists
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password, is_admin) VALUES ('admin', 'admin123', 1)");
        }
    });
});

// Routes with vulnerabilities

// Home page with SQL injection vulnerability
app.get('/', (req, res) => {
    const search = req.query.search || '';
    
    db.all(`SELECT posts.*, users.username 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE title LIKE '%${search}%' 
            ORDER BY created_at DESC`, (err, posts) => {
        res.render('index', { 
            posts: posts || [], 
            user: req.session.user, 
            search,
            xssDemo: req.query.xss || '' 
        });
    });
});

// Login with SQL injection
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`, 
    (err, user) => {
        if (user) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Invalid credentials' });
        }
    });
});

// Registration with no security
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    db.run(`INSERT INTO users (username, password) VALUES ('${username}', '${password}')`, 
    function(err) {
        if (err) {
            return res.render('register', { error: 'Registration failed' });
        }
        res.redirect('/login');
    });
});

// Create post with XSS vulnerability
app.post('/posts', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { title, content } = req.body;
    
    db.run(`INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)`, 
        [title, content, req.session.user.id], (err) => {
            res.redirect('/');
    });
});

// Edit post
app.get('/posts/:id/edit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    db.get(`SELECT * FROM posts WHERE id = ${req.params.id}`, (err, post) => {
        if (!post) return res.redirect('/');
        
        res.render('edit', { post });
    });
});

// Update post
app.post('/posts/:id', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { title, content } = req.body;
    
    db.run(`UPDATE posts SET title = '${title}', content = '${content}' WHERE id = ${req.params.id}`, 
    (err) => {
        res.redirect('/');
    });
});

// Delete post with insecure direct object reference
app.post('/posts/:id/delete', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    db.run(`DELETE FROM posts WHERE id = ${req.params.id}`, (err) => {
        res.redirect('/');
    });
});

// Sensitive data exposure example
app.get('/users', (req, res) => {
    if (!req.session.user?.is_admin) return res.redirect('/');
    
    db.all(`SELECT * FROM users`, (err, users) => {
        res.render('users', { users });
    });
});

// Logout routes
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

app.listen(3000, () => {
    console.log('Insecure Movie Review app running on http://localhost:3000');
});