
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            success: true,
            message: "Expense Copilot backend is running!",
            database: "Connected",
            integrations: req.app.locals.integrations || {
                gemini: { configured: false },
                mcp: {
                    enabled: false,
                    connected: false,
                    servers: [],
                    tools: []
                }
            },
            timestamp: new Date()
        });

    } catch (error) {
        res.status(503).json({
            success: false,
            message: "Database connection unavailable"
        });
    }
});

export default router;