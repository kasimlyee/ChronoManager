const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");
const smsService = require("./services/smsService");

const app = express();

const attendancePoller = require("./services/attendancePoller");

// Middleware to attach db to request
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "../../public")));

// Database setup
const dbPath = path.join(__dirname, "../database/attendance.db");
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,  -- 'student', 'teacher', or 'staff'
      parent_phone TEXT,   -- Only for students
      card_number TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      check_in TIMESTAMP NOT NULL,
      check_out TIMESTAMP,
      status TEXT NOT NULL,  -- 'present', 'late', 'absent'
      sms_sent BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS biotime_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

  db.run(`CREATE TABLE IF NOT EXISTS update_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

  db.run(`CREATE TABLE IF NOT EXISTS transaction_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_code TEXT NOT NULL,
  punch_time TIMESTAMP NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  device_sn TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_transaction_logs_emp_code ON transaction_logs(emp_code);`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_transaction_logs_time ON transaction_logs(punch_time);`
  );
});

// Attach database to app
app.set("db", db);

// Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/biotime", require("./routes/biotime"));

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

attendancePoller.on("processed", (result) => {
  console.log(`Processed ${result.action} for ${result.user.name}`);
});

attendancePoller.on("error", (error) => {
  console.error("Polling error:", error.message);
});

// Start with 15 second interval
attendancePoller.initialize(db);
attendancePoller.start();

// Can dynamically adjust interval based on system load
function adjustPollingBasedOnLoad() {
  const load = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
  if (load > 0.8) {
    attendancePoller.updateInterval(30000); // Slow down under heavy load
  } else {
    attendancePoller.updateInterval(15000);
  }
}

setInterval(adjustPollingBasedOnLoad, 60000);

module.exports = app;
