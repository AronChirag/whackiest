
import express from "express";

import authenticateUser from "../middleware/auth.middleware.js";

import {
    createSubscription,
    getSubscriptions,
    updateSubscriptionStatus
} from "../controllers/subscription.controller.js";

const router = express.Router();

router.use(authenticateUser);

router.post("/", createSubscription);

router.get("/", getSubscriptions);

router.patch("/:id/status", updateSubscriptionStatus);

export default router;
