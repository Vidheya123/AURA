const express = require("express");
const cors = require("cors");
require("dotenv").config();

const searchRoutes = require("./routes/searchRoutes");
const emailRoutes = require("./routes/emailRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "AURA backend is running"
    });
});

// Search routes
app.use("/api/search", searchRoutes);

// Email / authentication notification routes
app.use("/api/email", emailRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`AURA backend running on port ${PORT}`);
});