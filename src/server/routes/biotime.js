const express = require("express");
const router = express.Router();
const biotimeService = require("../services/biotimeService");

// Get BioTime configuration
router.get("/config", (req, res) => {
  req.db.get(
    "SELECT * FROM biotime_config ORDER BY id DESC LIMIT 1",
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row || {});
    }
  );
});

// Update BioTime configuration
router.post("/config", (req, res) => {
  const { ip_address, username, password } = req.body;

  req.db.run(
    `INSERT INTO biotime_config (ip_address, username, password) 
     VALUES (?, ?, ?)`,
    [ip_address, username, password],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        ip_address,
        username,
      });
    }
  );
});

// Process latest attendance from BioTime
router.post("/process", async (req, res) => {
  try {
    const result = await biotimeService.processLatestAttendance(req.db);
    if (!result) {
      return res.json({ message: "No new attendance to process" });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
