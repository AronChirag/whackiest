import express from "express";
import rateLimit from "express-rate-limit";

import { chatWithCopilot } from "../controllers/copilot.controller.js";
import authenticateUser from "../middleware/auth.middleware.js";

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many copilot requests. Please wait a minute and try again."
  }
});

router.post("/chat", authenticateUser, chatLimiter, chatWithCopilot);

export default router;
