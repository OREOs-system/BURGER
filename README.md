# 🍔 BurgerStack — Burger Ordering System

A full-stack burger ordering web app built with **HTML, CSS, JS, Node.js, and MySQL**.

---

## 📁 Project Structure

```
burger-system/
├── server.js          ← Node.js + Express backend
├── package.json       ← Dependencies
├── database.sql       ← MySQL schema (run this first!)
└── public/
    ├── index.html     ← Main user app (login, menu, cart, orders)
    └── admin.html     ← Admin panel
```

---

## ⚙️ Setup Instructions

### 1. Install MySQL
Make sure MySQL is installed and running on your machine.

### 2. Create the Database
Open MySQL Workbench or your terminal and run:
```sql
SOURCE /path/to/burger-system/database.sql;
```
Or paste the contents of `database.sql` directly into your MySQL client.

### 3. Configure Database Password
Open `server.js` and update the MySQL password on line ~20:
```js
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'YOUR_MYSQL_PASSWORD_HERE',  ← change this
  database: 'burger_system',
  ...
});
```

### 4. Install Node.js Dependencies
```bash
cd burger-system
npm install
```

### 5. Start the Server
```bash
node server.js
```
You'll see:
```
✅ MySQL connected
🍔 Burger System running at http://localhost:3000
🔧 Admin panel at http://localhost:3000/admin
```

---

## 🌐 Access the App

| Page | URL |
|------|-----|
| User App | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |

---

## 👤 Admin Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin001` |

---

## 🍔 Features

### User Side
- **Sign Up / Log In** — Full authentication with bcrypt password hashing
- **Menu** — 10 Burgers + 5 Drinks with emoji icons, prices in ₱
- **Cart** — Add multiple items, adjust quantities, clear cart
- **Place Order** — Confirmation modal before placing
- **Transaction History** — View all past orders with live status
- **Settings** — Edit account info (name, email, contact, address)

### Admin Side
- **Admin Login** — Separate admin authentication
- **Order Dashboard** — Stats panel (total, pending, preparing, ready)
- **Filter Orders** — By status (All / Pending / To Prepare / Ready / Cancelled)
- **Accept Orders** → status changes to "To Prepare"
- **Mark Done** → status changes to "Ready to Claim"
- **Refuse/Cancel** → status changes to "Cancelled"
- All status changes are reflected **immediately** on the user's transaction page

---

## 🔐 Security Notes
- Passwords are hashed with **bcryptjs** (salt rounds: 10)
- Sessions are managed server-side via **express-session**
- Admin credentials are hardcoded (update in `server.js` for production)
- For production, use HTTPS and a proper session store (Redis, etc.)
