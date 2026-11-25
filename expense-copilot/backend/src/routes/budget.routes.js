
import express from "express";

import authenticateUser from "../middleware/auth.middleware.js";

import {
    createBudget,
    getBudgets
} from "../controllers/budget.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/", createBudget);

router.get("/", getBudgets);

export default router;
