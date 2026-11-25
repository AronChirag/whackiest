
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import pool, { testDatabaseConnection } from "./config/db.js";
import {
    configureFirewall,
    initializeFirewall,
    isMcpEnabled,
    shutdownFirewall
} from "../firewall/index.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import copilotRoutes from "./routes/copilot.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import leaksRoutes from "./routes/leaks.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

dotenv.config();

const app = express();

app.use(helmet());

const allowedOrigins = new Set([
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174"
].filter(Boolean));

const isAllowedDevelopmentOrigin = (origin) => {
    if (process.env.NODE_ENV !== "development") {
        return false;
    }

    try {
        const url = new URL(origin);
        const port = Number(url.port);

        return url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname) &&
            port >= 5173 &&
            port <= 5199;
    } catch {
        return false;
    }
};

app.use(cors({
    origin: (origin, callback) => {
        if (
            !origin ||
            allowedOrigins.has(origin) ||
            isAllowedDevelopmentOrigin(origin)
        ) {
            return callback(null, true);
        }

        return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
}));

app.use(express.json({ limit: "1mb" }));

// Health check
app.use("/api/health", healthRoutes);

// Authentication
app.use("/api/auth", authRoutes);
app.use("/api/copilot", copilotRoutes);

// Financial APIs
app.use("/api/transactions", transactionRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/leaks", leaksRoutes);

app.use("/api/budgets", budgetRoutes);

app.use("/api/subscriptions", subscriptionRoutes);

// Default route
app.get("/", (req, res) => {
    res.json({
        name: "Expense Copilot API",
        version: "1.0.0",
        status: "Running"
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing");
        }

        await testDatabaseConnection();
        configureFirewall(pool);

        const integrations = {
            gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
            mcp: {
                enabled: isMcpEnabled(),
                connected: false,
                servers: [],
                tools: []
            }
        };

        if (integrations.mcp.enabled) {
            try {
                const status = await initializeFirewall();
                integrations.mcp.connected = true;
                integrations.mcp.servers = status.connectedServers;
                integrations.mcp.tools = status.registeredTools;
            } catch (error) {
                console.error("MCP initialization failed:", error.message);
                await shutdownFirewall();
            }
        }

        app.locals.integrations = integrations;

        const server = app.listen(PORT, () => {
            console.log("----------------------------------");
            console.log("EXPENSE COPILOT BACKEND");
            console.log("----------------------------------");
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Health: http://localhost:${PORT}/api/health`);
            console.log(
                `MCP: ${integrations.mcp.connected ? "connected" : "unavailable"}`
            );
            console.log(
                `Gemini: ${integrations.gemini.configured ? "configured" : "not configured"}`
            );
            console.log("----------------------------------");
        });

        const shutdown = () => {
            server.close(async () => {
                await shutdownFirewall();
                await pool.end();
                process.exit(0);
            });
        };

        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);

    } catch (error) {
        console.error("Startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
