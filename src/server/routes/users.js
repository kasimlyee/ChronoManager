const express = require("express");
const router = express.Router();

// Get all users
router.get("/", (req, res) => {
  req.db.all("SELECT * FROM users ORDER BY name", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Create new user
router.post("/", (req, res) => {
  const { name, email, phone, role, parent_phone, card_number } = req.body;

  req.db.run(
    `INSERT INTO users (name, email, phone, role, parent_phone, card_number) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, phone, role, parent_phone, card_number],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        name,
        email,
        phone,
        role,
        parent_phone,
        card_number,
      });
    }
  );
});

// Update user
router.put("/:id", (req, res) => {
  const { name, email, phone, role, parent_phone, card_number } = req.body;

  req.db.run(
    `UPDATE users SET 
      name = ?, 
      email = ?, 
      phone = ?, 
      role = ?, 
      parent_phone = ?, 
      card_number = ? 
     WHERE id = ?`,
    [name, email, phone, role, parent_phone, card_number, req.params.id],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        id: req.params.id,
        name,
        email,
        phone,
        role,
        parent_phone,
        card_number,
      });
    }
  );
});

// Delete user
router.delete("/:id", (req, res) => {
  req.db.run("DELETE FROM users WHERE id = ?", req.params.id, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: "User deleted successfully" });
  });
});

// Get single user by ID
router.get("/:id", (req, res) => {
  req.db.get(
    "SELECT * FROM users WHERE id = ?",
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(row);
    }
  );
});

// Bulk
router.post("/bulk", (req, res) => {
  const users = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: "Invalid user data" });
  }

  req.db.serialize(() => {
    req.db.run("BEGIN TRANSACTION");

    const stmt = req.db.prepare(
      `INSERT INTO users (name, email, phone, role, parent_phone, card_number) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    users.forEach((user) => {
      stmt.run(
        user.name,
        user.email,
        user.phone,
        user.role,
        user.parent_phone,
        user.card_number
      );
    });

    stmt.finalize((err) => {
      if (err) {
        req.db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }

      req.db.run("COMMIT", (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Successfully added ${users.length} users` });
      });
    });
  });
});

//export
router.get("/export/csv", (req, res) => {
  req.db.all(
    `SELECT u.*, COUNT(a.id) as attendance_count, SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count FROM users u LEFT JOIN attendance a ON u.id = a.user_id GROUP BY u.id`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      //convert to CSV
      const header = Object.keys(rows[0] || {}).join(",");
      const csv = rows
        .map((row) =>
          Object.values(row)
            .map(
              (v) => `"${v !== null ? v.toString().replace(/"/g, '""') : ""}"`
            )
            .join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=users_exports.csv"
      );
      res.send(`${header}\n${csv}`);
    }
  );
});

// Add to existing users.js routes
router.get("/:id/export", (req, res) => {
  const userId = req.params.id;

  req.db.all(
    `
    SELECT 
      u.name, u.email, u.role,
      date(a.check_in) as date,
      time(a.check_in) as check_in,
      time(a.check_out) as check_out,
      a.status,
      CASE WHEN a.check_out IS NULL THEN NULL
           ELSE round((julianday(a.check_out) - julianday(a.check_in)) * 24, 2)
      END as hours
    FROM users u
    LEFT JOIN attendance a ON u.id = a.user_id
    WHERE u.id = ?
    ORDER BY a.check_in DESC
  `,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "No attendance records found" });
      }

      // Convert to CSV
      const header = Object.keys(rows[0]).join(",");
      const csv = rows
        .map((row) =>
          Object.values(row)
            .map(
              (v) => `"${v !== null ? v.toString().replace(/"/g, '""') : ""}"`
            )
            .join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=user_${userId}_attendance.csv`
      );
      res.send(`${header}\n${csv}`);
    }
  );
});
module.exports = router;
