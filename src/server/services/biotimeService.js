const axios = require("axios");
const logger = require("../utils/logger");

class BioTimeService {
  constructor() {
    this.token = null;
    this.lastProcessed = {}; // Track last action per user
    this.DUPLICATE_WINDOW = 120000; // 2 minutes
    this.MAX_TIME_DIFF = 300000; // 5 minutes
  }

  async getConfig(db) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM biotime_config ORDER BY id DESC LIMIT 1",
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  async getToken(db) {
    const config = await this.getConfig(db);
    if (!config) throw new Error("BioTime configuration not found");

    const url = `${config.ip_address}/jwt-api-token-auth/`;
    const params = { username: config.username, password: config.password };

    try {
      const response = await axios.post(url, params);
      if (response.data && response.data.token) {
        this.token = `JWT ${response.data.token}`;
        return this.token;
      }
      throw new Error("Invalid token response");
    } catch (error) {
      logger.error("Error fetching BioTime token:", error.message);
      throw error;
    }
  }

  async validateTransaction(transaction) {
    const now = new Date();
    const punchTime = new Date(transaction.punch_time);
    const timeDiff = Math.abs(now - punchTime);

    // Reject if timestamp is more than 5 minutes old or in future
    if (timeDiff > this.MAX_TIME_DIFF || punchTime > now) {
      logger.warn(`Invalid timestamp: ${transaction.punch_time}`);
      return false;
    }

    return true;
  }

  async getLatestTransaction(db) {
    if (!this.token) await this.getToken(db);
    const config = await this.getConfig(db);

    const url = `${config.ip_address}/iclock/api/transactions/`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: this.token },
        params: {
          limit: 1,
          ordering: "-punch_time",
        },
      });

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0];
      }
      return null;
    } catch (error) {
      logger.error("Error fetching latest transaction:", error);
      throw error;
    }
  }

  async getUserAttendanceState(db, userId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT id, check_out 
         FROM attendance 
         WHERE user_id = ? 
         ORDER BY check_in DESC 
         LIMIT 1`,
        [userId],
        (err, row) => {
          if (err) {
            logger.error("Error getting user state:", err);
            return resolve("checked-out");
          }
          resolve(row?.check_out ? "checked-out" : "checked-in");
        }
      );
    });
  }

  async processTransaction(db, transaction) {
    try {
      // Validate transaction time
      if (!(await this.validateTransaction(transaction))) {
        return null;
      }

      const userId = transaction.emp_code;
      const punchTime = new Date(transaction.punch_time);

      // Check for duplicate within time window
      if (
        this.lastProcessed[userId] &&
        punchTime - this.lastProcessed[userId].time < this.DUPLICATE_WINDOW
      ) {
        logger.warn(`Duplicate transaction blocked for user ${userId}`);
        return null;
      }

      // Get current state
      const currentState = await this.getUserAttendanceState(db, userId);
      const lastAction = this.lastProcessed[userId]?.action;

      // Prevent invalid state transitions
      if (lastAction === "check-in" && currentState === "checked-in") {
        logger.warn(`Double check-in prevented for ${userId}`);
        return null;
      }

      if (lastAction === "check-out" && currentState === "checked-out") {
        logger.warn(`Double check-out prevented for ${userId}`);
        return null;
      }

      let result = null;

      if (currentState === "checked-out") {
        result = await this.processCheckIn(db, userId, punchTime);
      } else {
        result = await this.processCheckOut(db, userId, punchTime);
      }

      if (result) {
        this.lastProcessed[userId] = {
          time: punchTime,
          action: result.action,
        };

        // Log successful transaction
        await this.logTransaction(db, {
          emp_code: userId,
          punch_time: punchTime.toISOString(),
          action: result.action,
          status: "success",
        });
      }

      return result;
    } catch (error) {
      logger.error("Error processing transaction:", error);
      throw error;
    }
  }

  async processCheckIn(db, userId, punchTime) {
    try {
      // Check grace period (2 minutes between check-out and check-in)
      const lastCheckOut = await new Promise((resolve) => {
        db.get(
          `SELECT check_out FROM attendance 
           WHERE user_id = ? 
           ORDER BY check_in DESC LIMIT 1`,
          [userId],
          (err, row) => resolve(row?.check_out ? new Date(row.check_out) : null)
        );
      });

      if (lastCheckOut) {
        const minutesSinceLast = (punchTime - lastCheckOut) / 60000;
        if (minutesSinceLast < 2) {
          logger.warn(
            `Check-in too soon after check-out: ${minutesSinceLast.toFixed(
              1
            )} minutes`
          );
          return null;
        }
      }

      // Create check-in record
      const recordId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO attendance (user_id, check_in, status) 
           VALUES (?, ?, ?)`,
          [userId, punchTime.toISOString(), "present"],
          function (err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      // Get user details for notifications
      const user = await new Promise((resolve) => {
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) =>
          resolve(row)
        );
      });

      if (user?.role === "student" && user.parent_phone) {
        await require("./smsService").sendSMS(
          user.parent_phone,
          `Dear parent,${
            user.name
          } has reached school at ${punchTime.toLocaleTimeString()}`
        );
      }

      return {
        action: "check-in",
        user,
        recordId,
      };
    } catch (error) {
      logger.error("Error processing check-in:", error);
      throw error;
    }
  }

  async processCheckOut(db, userId, punchTime) {
    try {
      // Find the latest check-in without check-out
      const record = await new Promise((resolve) => {
        db.get(
          `SELECT id FROM attendance 
           WHERE user_id = ? AND check_out IS NULL 
           ORDER BY check_in DESC LIMIT 1`,
          [userId],
          (err, row) => resolve(row)
        );
      });

      if (!record) {
        logger.warn(`No open check-in found for user ${userId}`);
        return null;
      }

      // Update with check-out time
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE attendance SET check_out = ? WHERE id = ?",
          [punchTime.toISOString(), record.id],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Get user details for notifications
      const user = await new Promise((resolve) => {
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) =>
          resolve(row)
        );
      });

      if (user?.role === "student" && user.parent_phone) {
        await require("./smsService").sendSMS(
          user.parent_phone,
          `Dear parent, ${
            user.name
          } has left school at ${punchTime.toLocaleTimeString()}`
        );
      }

      return {
        action: "check-out",
        user,
        recordId: record.id,
      };
    } catch (error) {
      logger.error("Error processing check-out:", error);
      throw error;
    }
  }

  async logTransaction(db, data) {
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO transaction_logs 
           (emp_code, punch_time, action, status, device_sn) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            data.emp_code,
            data.punch_time,
            data.action,
            data.status,
            data.device_sn || "unknown",
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });
    } catch (error) {
      logger.error("Error logging transaction:", error);
    }
  }

  async processLatestAttendance(db) {
    try {
      const transaction = await this.getLatestTransaction(db);
      if (!transaction) return null;

      return await this.processTransaction(db, transaction);
    } catch (error) {
      logger.error("Error in processLatestAttendance:", error);
      throw error;
    }
  }
}

module.exports = new BioTimeService();
