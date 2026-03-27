require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { fetchLogs } = require('./hikvision');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/settings', (req, res) => {
    db.all(`SELECT key, value FROM settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json(settings);
    });
});

app.post('/api/settings', (req, res) => {
    const settings = req.body;
    const stmt = db.prepare(`UPDATE settings SET value = ? WHERE key = ?`);
    let completed = 0;
    const keys = Object.keys(settings);
    
    if (keys.length === 0) return res.json({ success: true });

    keys.forEach(key => {
        stmt.run(settings[key], key, function(err) {
            completed++;
            if (completed === keys.length) {
                res.json({ success: true });
            }
        });
    });
    stmt.finalize();
});

app.get('/api/logs', (req, res) => {
    let query = `SELECT * FROM access_logs`;
    const params = [];
    const conditions = [];

    if (req.query.name) {
        conditions.push(`name LIKE ?`);
        params.push(`%${req.query.name}%`);
    }

    if (req.query.startDate && req.query.endDate) {
        conditions.push(`timestamp >= ? AND timestamp <= ?`);
        params.push(req.query.startDate, req.query.endDate);
    } else if (req.query.date) {
        conditions.push(`timestamp LIKE ?`);
        params.push(`${req.query.date}%`);
    }

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY timestamp DESC LIMIT 500`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/sync', async (req, res) => {
    const { startDate, endDate } = req.body;
    const currentYear = new Date().getFullYear();
    const start = startDate || `${currentYear}-01-01T00:00:00-06:00`;
    const end = endDate || `${currentYear}-12-31T23:59:59-06:00`;

    try {
        console.log(`Syncing Hikvision data from ${start} to ${end}...`);
        const events = await fetchLogs(start, end);
        let inserted = 0;
        
        if (events.length === 0) {
            return res.json({ success: true, inserted: 0, message: "No new events found." });
        }

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO access_logs (person_id, name, timestamp, attendance_status, picture_url, raw_data)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            events.forEach(event => {
                const person_id = event.employeeNoString;
                const name = event.name;
                const time_str = event.time;
                const attendance_status = event.attendanceStatus;
                const picture_url = event.pictureURL;
                const raw_data = JSON.stringify(event);

                stmt.run(person_id, name, time_str, attendance_status, picture_url, raw_data, function(err) {
                    if (!err && this.changes > 0) inserted++;
                });
            });
            db.run("COMMIT", (err) => {
                stmt.finalize();
                res.json({ success: true, inserted, message: `Synced ${inserted} new records.` });
            });
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Checador Premium Backend running on http://localhost:${PORT}`);
});
