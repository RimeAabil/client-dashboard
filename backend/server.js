const express = require("express");
const cors = require("cors");

// Initialize the database
require("./database");

const requestRoutes = require("./routes/requestRoutes");

const app = express();

const PORT = 5000;

// Middleware

app.use(cors());

app.use(express.json());

// Test route

app.get("/", (req, res) => {

    res.json({

        message: "Backend is working"

    });

});

// Register all request routes

app.use("/requests", requestRoutes);

// Start server

app.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);

});