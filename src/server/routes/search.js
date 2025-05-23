const express = require("express");
const router = express.Router();
const SearchService = require("../services/searchService");

const searchService = new SearchService(router.db);

router.get("/users", async (req, res) => {
  try {
    const results = await searchService.searchUsers(req.query.q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/attendance", async (req, res) => {
  try {
    const results = await searchService.searchAttendance(req.query.q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/advanced", async (req, res) => {
  try {
    const results = await searchService.advancedSearch(req.body);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
