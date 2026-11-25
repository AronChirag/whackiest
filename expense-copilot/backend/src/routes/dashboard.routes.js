
import express from "express";

import authenticateUser from "../middleware/auth.middleware.js";

import {
    getDashboardSummary
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/summary", getDashboardSummary);

export default router;
