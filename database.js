const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.DB_PATH || 'database.sqlite';

const db = new sqlite3.Database(path.resolve(__dirname, dbPath));

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS access_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id TEXT,
            name TEXT,
            timestamp TEXT,
            attendance_status TEXT,
            picture_url TEXT,
            raw_data TEXT,
            UNIQUE(person_id, timestamp)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    const defaultSettings = [
        ['official_time', '09:00'],
        ['color_ontime', '#10b981'],
        ['color_late', '#f59e0b'],
        ['color_absent', '#ef4444']
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    defaultSettings.forEach(setting => {
        stmt.run(setting);
    });
    stmt.finalize();
});

module.exports = db;
