const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'burger-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Change to your MySQL password
  database: 'burger_system',
  waitForConnections: true,
  connectionLimit: 10
});

// Test DB connection
pool.getConnection()
  .then(conn => { console.log('✅ MySQL connected'); conn.release(); })
  .catch(err => console.error('❌ MySQL error:', err.message));

// ========================
// AUTH MIDDLEWARE
// ========================
function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ success: false, message: 'Not authenticated' });
}

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ success: false, message: 'Admin access required' });
}

// ========================
// USER AUTH ROUTES
// ========================
app.post('/api/signup', async (req, res) => {
  const { username, first_name, last_name, email, password, password_confirm, contact_number, address } = req.body;
  if (password !== password_confirm) return res.json({ success: false, message: 'Passwords do not match' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (username, first_name, last_name, email, password, contact_number, address) VALUES (?,?,?,?,?,?,?)',
      [username, first_name, last_name, email, hashed, contact_number, address]
    );
    res.json({ success: true, message: 'Account created successfully!' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.json({ success: false, message: 'Username or email already exists' });
    res.json({ success: false, message: 'Server error: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.json({ success: false, message: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.json({ success: false, message: 'Invalid username or password' });

    req.session.userId = rows[0].id;
    req.session.username = rows[0].username;
    res.json({ success: true, message: 'Login successful' });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, first_name, last_name, email, contact_number, address FROM users WHERE id = ?',
      [req.session.userId]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.json({ success: false });
  }
});

app.put('/api/me', requireLogin, async (req, res) => {
  const { first_name, last_name, email, contact_number, address } = req.body;
  try {
    await pool.execute(
      'UPDATE users SET first_name=?, last_name=?, email=?, contact_number=?, address=? WHERE id=?',
      [first_name, last_name, email, contact_number, address, req.session.userId]
    );
    res.json({ success: true, message: 'Profile updated!' });
  } catch (err) {
    res.json({ success: false, message: 'Update failed' });
  }
});

// ========================
// ORDER ROUTES
// ========================
app.post('/api/orders', requireLogin, async (req, res) => {
  const { items } = req.body;
  if (!items || !items.length) return res.json({ success: false, message: 'No items in order' });

  const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderResult] = await conn.execute(
      'INSERT INTO orders (user_id, total_amount) VALUES (?,?)',
      [req.session.userId, total]
    );
    const orderId = orderResult.insertId;
    for (const item of items) {
      await conn.execute(
        'INSERT INTO order_items (order_id, item_name, item_price, quantity) VALUES (?,?,?,?)',
        [orderId, item.name, item.price, item.quantity]
      );
    }
    await conn.commit();
    res.json({ success: true, message: 'Order placed!', orderId });
  } catch (err) {
    await conn.rollback();
    res.json({ success: false, message: 'Order failed' });
  } finally {
    conn.release();
  }
});

app.get('/api/orders/my', requireLogin, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );
    for (const order of orders) {
      const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }
    res.json({ success: true, orders });
  } catch (err) {
    res.json({ success: false });
  }
});

// ========================
// ADMIN ROUTES
// ========================
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin001') {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid admin credentials' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const [orders] = await pool.execute(`
      SELECT o.*, u.username, u.email, u.contact_number, u.address, u.first_name, u.last_name
      FROM orders o JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    for (const order of orders) {
      const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }
    res.json({ success: true, orders });
  } catch (err) {
    res.json({ success: false });
  }
});

app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['To Prepare', 'Ready to Claim', 'Cancelled'];
  if (!validStatuses.includes(status)) return res.json({ success: false, message: 'Invalid status' });

  try {
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`🍔 Burger System running at http://localhost:${PORT}`);
  console.log(`🔧 Admin panel at http://localhost:${PORT}/admin`);
});
