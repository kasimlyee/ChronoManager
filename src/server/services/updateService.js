const axios = require("axios");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

class UpdateService {
  constructor(db) {
    this.db = db;
    this.updateConfig = {
      repo: "your-repo/chrono-manager",
      currentVersion: require("../../../package.json").version,
    };
  }

  async checkForUpdates() {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.updateConfig.repo}/releases/latest`
      );

      const latestVersion = response.data.tag_name.replace("v", "");
      return {
        updateAvailable: latestVersion > this.updateConfig.currentVersion,
        currentVersion: this.updateConfig.currentVersion,
        latestVersion,
        releaseNotes: response.data.body,
      };
    } catch (error) {
      console.error("Update check failed:", error);
      return { error: "Failed to check for updates" };
    }
  }

  async downloadUpdate() {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-downloaded", () => {
      this.logUpdate("Update downloaded, ready to install");
      this.db.run(`INSERT INTO system_logs (type, message) VALUES (?, ?)`, [
        "update",
        "Update downloaded and ready to install",
      ]);
    });
  }

  logUpdate(message) {
    const logPath = path.join(__dirname, "../../../logs/update.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  }
}

module.exports = UpdateService;
