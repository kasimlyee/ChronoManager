class SearchService {
  constructor(db) {
    this.db = db;
  }

  async searchUsers(query) {
    return new Promise((resolve) => {
      this.db.all(
        `
        SELECT u.*, 
          (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) as attendance_count
        FROM users u
        WHERE u.name LIKE ? OR u.email LIKE ? OR u.card_number LIKE ?
        ORDER BY u.name
        LIMIT 50
      `,
        [`%${query}%`, `%${query}%`, `%${query}%`],
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });
  }

  async searchAttendance(query) {
    return new Promise((resolve) => {
      this.db.all(
        `
        SELECT a.*, u.name as user_name, u.role as user_role
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE u.name LIKE ? OR 
              date(a.check_in) = date(?) OR
              a.status LIKE ?
        ORDER BY a.check_in DESC
        LIMIT 100
      `,
        [`%${query}%`, query, `%${query}%`],
        (err, rows) => {
          resolve(rows || []);
        }
      );
    });
  }

  async advancedSearch(filters) {
    let query = `SELECT a.*, u.name as user_name FROM attendance a JOIN users u ON a.user_id = u.id WHERE 1=1`;
    const params = [];

    if (filters.user_id) {
      query += ` AND a.user_id = ?`;
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      query += ` AND date(a.check_in) >= date(?)`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND date(a.check_in) <= date(?)`;
      params.push(filters.end_date);
    }

    if (filters.status) {
      query += ` AND a.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY a.check_in DESC LIMIT 200`;

    return new Promise((resolve) => {
      this.db.all(query, params, (err, rows) => {
        resolve(rows || []);
      });
    });
  }
}

module.exports = SearchService;
