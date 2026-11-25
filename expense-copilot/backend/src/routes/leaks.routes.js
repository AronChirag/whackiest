
import express from "express";

import authenticateUser from "../middleware/auth.middleware.js";

import {
    detectMoneyLeaks
} from "../controllers/leaks.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.get("/", detectMoneyLeaks);

export default router;
