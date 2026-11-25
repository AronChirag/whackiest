
import pool from "../config/db.js";

const validCycles = [
    "weekly",
    "monthly",
    "quarterly",
    "yearly"
];

export const createSubscription = async (req, res) => {
    try {
        const {
            merchant,
            amount,
            billing_cycle,
            next_billing_date
        } = req.body;

        if (
            !merchant ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            !validCycles.includes(billing_cycle) ||
            !next_billing_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid subscription details"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO subscriptions
            (
                user_id,
                merchant,
                amount,
                billing_cycle,
                next_billing_date
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                req.user.id,
                merchant.trim(),
                Number(amount),
                billing_cycle,
                next_billing_date
            ]
        );

        res.status(201).json({
            success: true,
            message: "Subscription added",
            subscriptionId: result.insertId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not add subscription"
        });
    }
};

export const getSubscriptions = async (req, res) => {
    try {
        const [subscriptions] = await pool.execute(
            `SELECT *
             FROM subscriptions
             WHERE user_id = ?
             ORDER BY next_billing_date ASC`,
            [req.user.id]
        );

        res.json({
            success: true,
            subscriptions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not retrieve subscriptions"
        });
    }
};

export const updateSubscriptionStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!["active", "cancelled", "paused"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subscription status"
            });
        }

        const [result] = await pool.execute(
            `UPDATE subscriptions
             SET status = ?
             WHERE id = ? AND user_id = ?`,
            [
                status,
                req.params.id,
                req.user.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found"
            });
        }

        res.json({
            success: true,
            message: "Subscription status updated"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not update subscription"
        });
    }
};
