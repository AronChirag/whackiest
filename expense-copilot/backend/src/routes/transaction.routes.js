
import express from "express";

import authenticateUser from "../middleware/auth.middleware.js";

import {
    addTransaction,
    getTransactions,
    updateTransaction,
    deleteTransaction
} from "../controllers/transaction.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/", addTransaction);

router.get("/", getTransactions);

router.put("/:id", updateTransaction);

router.delete("/:id", deleteTransaction);

export default router;
