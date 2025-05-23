// services/attendancePoller.js
const EventEmitter = require("events");
const biotimeService = require("./biotimeService");

let db;
class AttendancePoller extends EventEmitter {
  constructor() {
    super();
    this.interval = 15000;
    this.timeout = null;
    this.isActive = false;
  }

  async initialize(database) {
    db = database;
  }

  async check() {
    try {
      const result = await biotimeService.processLatestAttendance(db);
      if (result) {
        this.emit("processed", result);
      }
      this.scheduleNext();
    } catch (error) {
      this.emit("error", error);
      this.scheduleNext();
    }
  }

  scheduleNext() {
    if (!this.isActive) return;
    this.timeout = setTimeout(() => this.check(), this.interval);
    this.timeout.unref(); // Prevents keeping Node.js process alive
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.check();
  }

  stop() {
    this.isActive = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  updateInterval(newInterval) {
    this.interval = newInterval;
    if (this.isActive) {
      this.stop();
      this.start();
    }
  }
}

module.exports = new AttendancePoller();
