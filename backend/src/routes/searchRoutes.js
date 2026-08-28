const express = require("express");

const router = express.Router();

router.post("/", (req, res) => {
    const { query } = req.body;

    if (!query || query.trim() === "") {
        return res.status(400).json({
            success: false,
            message: "Search query is required"
        });
    }

    res.json({
        success: true,
        query: query,
        answer: `AURA received your search: "${query}"`,
        sources: []
    });
});

module.exports = router;