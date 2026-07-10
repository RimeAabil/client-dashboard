const express = require("express");

const router = express.Router();

const controller = require("../controllers/requestController");

// Get all requests
router.get("/", controller.getAllRequests);

// Create a request
router.post("/", controller.createRequest);

// Update request status
router.put("/:id", controller.updateRequestStatus);

module.exports = router;