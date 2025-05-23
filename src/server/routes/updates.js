const express = require("express");
const router = express.Router();
const UpdateService = require("../services/updateService");

const updateService = new UpdateService(router.db);

router.get("/check", async (req, res) => {
  try {
    const updateInfo = await updateService.checkForUpdates();
    res.json(updateInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/install", async (req, res) => {
  try {
    await updateService.downloadUpdate();
    res.json({ status: "Update process started" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
