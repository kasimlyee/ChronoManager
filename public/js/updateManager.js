class UpdateManager {
  constructor() {
    this.updateModal = new bootstrap.Modal("#updateModal");
    this.checkForUpdates();
    setInterval(this.checkForUpdates.bind(this), 86400000); // Daily checks
  }

  async checkForUpdates() {
    try {
      const response = await fetch("/api/updates/check");
      const data = await response.json();

      if (data.updateAvailable) {
        this.showUpdateAvailable(data);
      }
    } catch (error) {
      console.error("Update check failed:", error);
    }
  }

  showUpdateAvailable(updateInfo) {
    document.getElementById("currentVersion").textContent =
      updateInfo.currentVersion;
    document.getElementById("latestVersion").textContent =
      updateInfo.latestVersion;
    document.getElementById("releaseNotes").innerHTML =
      updateInfo.releaseNotes.replace(/\n/g, "<br>");

    this.updateModal.show();
  }

  installUpdate() {
    fetch("/api/updates/install", { method: "POST" })
      .then((response) => response.json())
      .then((data) => {
        showAlert(
          "Update installation started. The app will restart when ready.",
          "info"
        );
      });
  }
}

// Initialize when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  window.updateManager = new UpdateManager();
});
