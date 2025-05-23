const express = require("express");
const router = express.Router();

// Get all attendance records with user details
router.get("/", (req, res) => {
  const { start_date, end_date, user_id } = req.query;

  let query = `
    SELECT a.*, u.name as user_name, u.role as user_role 
    FROM attendance a
    JOIN users u ON a.user_id = u.id
  `;

  const params = [];
  const conditions = [];

  if (start_date) {
    conditions.push("date(a.check_in) >= ?");
    params.push(start_date);
  }

  if (end_date) {
    conditions.push("date(a.check_in) <= ?");
    params.push(end_date);
  }

  if (user_id) {
    conditions.push("a.user_id = ?");
    params.push(user_id);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY a.check_in DESC";

  req.db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Calculate duration for each record
    const records = rows.map((row) => {
      const duration = row.check_out
        ? (new Date(row.check_out) - new Date(row.check_in)) / (1000 * 60 * 60)
        : null;

      return {
        ...row,
        duration: duration ? duration.toFixed(2) + "h" : null,
      };
    });

    res.json(records);
  });
});

// Manually check in a user
router.post("/checkin/:user_id", (req, res) => {
  const { user_id } = req.params;

  req.db.run(
    "INSERT INTO attendance (user_id, check_in, status) VALUES (?, ?, ?)",
    [user_id, new Date().toISOString(), "present"],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      // Get user details for SMS
      req.db.get("SELECT * FROM users WHERE id = ?", [user_id], (err, user) => {
        if (user.role === "student" && user.parent_phone) {
          require("../services/smsService").sendSMS(
            user.parent_phone,
            `Dear parent, ${
              user.name
            } has reached school at ${new Date().toLocaleTimeString()}`
          );
        }

        res.json({
          id: this.lastID,
          user_id,
          check_in: new Date().toISOString(),
          status: "present",
        });
      });
    }
  );
});

// Manually check out a user
router.post("/checkout/:user_id", (req, res) => {
  const { user_id } = req.params;

  // Find the latest check-in without check-out
  req.db.get(
    `SELECT id FROM attendance 
     WHERE user_id = ? AND check_out IS NULL 
     ORDER BY check_in DESC LIMIT 1`,
    [user_id],
    (err, row) => {
      if (err || !row) {
        return res.status(400).json({
          error: err ? err.message : "No active check-in found",
        });
      }

      req.db.run(
        "UPDATE attendance SET check_out = ? WHERE id = ?",
        [new Date().toISOString(), row.id],
        function (err) {
          if (err) {
            return res.status(400).json({ error: err.message });
          }

          // Get user details for SMS
          req.db.get(
            "SELECT * FROM users WHERE id = ?",
            [user_id],
            (err, user) => {
              if (user.role === "student" && user.parent_phone) {
                require("../services/smsService").sendSMS(
                  user.parent_phone,
                  `Dear parent, ${
                    user.name
                  } has left school at ${new Date().toLocaleTimeString()}`
                );
              }

              res.json({
                id: row.id,
                user_id,
                check_out: new Date().toISOString(),
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
