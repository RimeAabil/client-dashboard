// Establishes the SQLite connection and initializes the schema

const sqlite3 = require("sqlite3").verbose();

// Open (or create) the database
const db = new sqlite3.Database("./database.db", (err) => {

    if (err) {
        console.error("Error connecting to SQLite:", err.message);
    } else {

        console.log("Connected to SQLite");

        db.run(`
            CREATE TABLE IF NOT EXISTS requests (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                client TEXT NOT NULL,

                title TEXT NOT NULL,

                description TEXT,

                category TEXT,

                status TEXT DEFAULT 'New',

                created_at DATETIME DEFAULT CURRENT_TIMESTAMP

            )
        `, (err) => {

            if (err) {
                console.error(err.message);
            } else {
                console.log("Table 'requests' is ready.");
            }

        });

    }

});

module.exports = db;