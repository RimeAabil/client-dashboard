const database = require("../database");

// GET /requests
// Returns all requests


exports.getAllRequests = (req, res) => {

    const sql = "SELECT * FROM requests";

    database.all(sql, [], (err, rows) => {

        if (err) {

            return res.status(500).json({
                error: err.message
            });

        }

        res.status(200).json(rows);

    });

};

// POST /requests
// Create a new request


exports.createRequest = (req, res) => {

    const { client, title, description, category } = req.body;

    if (!client || !title) {

        return res.status(400).json({
            error: "Client and title are required."
        });

    }

    const sql = `
        INSERT INTO requests
        (client, title, description, category)
        VALUES (?, ?, ?, ?)
    `;

    database.run(

        sql,

        [client, title, description, category],

        function(err){

            if(err){

                return res.status(500).json({
                    error: err.message
                });

            }

            res.status(201).json({

                message:"Request created successfully.",

                id:this.lastID

            });

        }

    );

};


// PUT /requests/:id
// Update request status

exports.updateRequestStatus = (req, res) => {

    const { id } = req.params;
    const { status } = req.body;

    // Basic validation
    if (!status) {
        return res.status(400).json({
            error: "Status is required."
        });
    }

    const sql = `
        UPDATE requests
        SET status = ?
        WHERE id = ?
    `;

    database.run(sql, [status, id], function (err) {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        // this.changes tells us if a row was updated
        if (this.changes === 0) {
            return res.status(404).json({
                error: "Request not found."
            });
        }

        res.status(200).json({
            message: "Status updated successfully."
        });

    });
};