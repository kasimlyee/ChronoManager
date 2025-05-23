use rusqlite::{Connection, Error, params};
use std::path::PathBuf;
use tauri::AppHandle;
use log::{info, error};

use crate::models::{AttendanceRecord, User};

const DB_NAME: &str = "chrono_manager.db";


pub fn init(app_handle: &AppHandle) -> Result<(), Error> {
    let app_dir = app_handle.path_resolver().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    let db_path = app_dir.join(DB_NAME);
    
    info!("Initializing database at: {:?}", db_path);
    
    let conn = Connection::open(db_path)?;
    
    // Create tables if they don't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            biotime_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            check_in TIMESTAMP NOT NULL,
            check_out TIMESTAMP,
            status TEXT NOT NULL,
            synced_with_biotime BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )",
        [],
    )?;
    
    info!("Database initialized successfully");
    Ok(())
}

    /// Adds a new user to the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - The database connection to use.
    /// * `user` - The user to add.
    ///
    /// # Errors
    ///
    /// If the database operation fails, an error is returned.
pub fn add_user(conn: &Connection, user: &User) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO users (name, email, role, biotime_id) VALUES (?1, ?2, ?3, ?4)",
        params![user.name, user.email, user.role, user.biotime_id],
    )?;
    Ok(())
}

    /// Retrieves a user by their email address.
    ///
    /// # Arguments
    ///
    /// * `conn` - The database connection to use.
    /// * `email` - The email address of the user to retrieve.
    ///
    /// # Returns
    ///
    /// * `Ok(User)` - The user with the specified email address.
    /// * `Err(Error)` - If the query fails.
pub fn get_user_by_email(conn: &Connection, email: &str) -> Result<User, Error> {
    conn.query_row(
        "SELECT id, name, email, role, biotime_id FROM users WHERE email = ?1",
        params![email],
        |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                role: row.get(3)?,
                biotime_id: row.get(4)?,
            })
        },
    )
}

    /// Adds a new attendance record to the database.
    ///
    /// # Arguments
    ///
    /// * `conn` - The database connection to use.
    /// * `record` - The record to add.
    ///
    /// # Errors
    ///
    /// If the database operation fails, an error is returned.
pub fn add_attendance_record(conn: &Connection, record: &AttendanceRecord) -> Result<(), Error> {
    conn.execute(
        "INSERT INTO attendance (user_id, check_in, check_out, status) VALUES (?1, ?2, ?3, ?4)",
        params![record.user_id, record.check_in, record.check_out, record.status],
    )?;
    Ok(())
}

/// Retrieves all attendance records for a specific user, ordered by check-in time in descending order.
/// 
/// # Arguments
/// 
/// * `conn` - A reference to the SQLite connection.
/// * `user_id` - The ID of the user whose attendance records are to be retrieved.
/// 
/// # Returns
/// 
/// * `Ok(Vec<AttendanceRecord>)` - A vector of `AttendanceRecord` structs if successful.
/// * `Err(Error)` - An error if the query fails.

pub fn get_attendance_records(conn: &Connection, user_id: i64) -> Result<Vec<AttendanceRecord>, Error> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, check_in, check_out, status, synced_with_biotime 
         FROM attendance 
         WHERE user_id = ?1 
         ORDER BY check_in DESC",
    )?;
    
    let records = stmt.query_map(params![user_id], |row| {
        Ok(AttendanceRecord {
            id: row.get(0)?,
            user_id: row.get(1)?,
            check_in: row.get(2)?,
            check_out: row.get(3)?,
            status: row.get(4)?,
            synced_with_biotime: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    
    Ok(records)
}