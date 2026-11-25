
import pool from "../config/db.js";

export const detectMoneyLeaks = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. POSSIBLE DUPLICATE PAYMENTS

        const [duplicates] = await pool.execute(
            `SELECT
                t1.id AS first_transaction_id,
                t2.id AS second_transaction_id,
                t1.merchant,
                t1.amount,
                t1.transaction_date AS first_date,
                t2.transaction_date AS second_date

             FROM transactions t1

             INNER JOIN transactions t2
                ON LOWER(TRIM(t1.merchant)) =
                   LOWER(TRIM(t2.merchant))

                AND t1.amount = t2.amount
                AND t1.transaction_type = 'debit'
                AND t2.transaction_type = 'debit'

                AND t1.id < t2.id

                AND t2.transaction_date BETWEEN
                    DATE_SUB(t1.transaction_date, INTERVAL 3 DAY)
                    AND DATE_ADD(t1.transaction_date, INTERVAL 3 DAY)

             WHERE t1.user_id = ?
             AND t2.user_id = ?

             ORDER BY t1.transaction_date DESC`,
            [userId, userId]
        );

        // 2. BUDGET EXCEEDED

        const [budgetLeaks] = await pool.execute(
            `SELECT
                b.category,
                b.monthly_limit,
                COALESCE(SUM(t.amount), 0) AS spent

             FROM budgets b

             LEFT JOIN transactions t
                ON t.user_id = b.user_id
                AND t.category = b.category
                AND t.transaction_type = 'debit'
                AND DATE_FORMAT(
                    t.transaction_date,
                    '%Y-%m'
                ) = b.month_year

             WHERE b.user_id = ?
             AND b.month_year = DATE_FORMAT(CURDATE(), '%Y-%m')

             GROUP BY b.id, b.category, b.monthly_limit

             HAVING spent > b.monthly_limit`,
            [userId]
        );

        // 3. UPCOMING SUBSCRIPTIONS

        const [upcomingSubscriptions] = await pool.execute(
            `SELECT
                id,
                merchant,
                amount,
                billing_cycle,
                next_billing_date

             FROM subscriptions

             WHERE user_id = ?
             AND status = 'active'

             AND next_billing_date BETWEEN
                 CURDATE()
                 AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)

             ORDER BY next_billing_date ASC`,
            [userId]
        );

        const leaks = [];

        duplicates.forEach(item => {
            leaks.push({
                type: "possible_duplicate",
                severity: "high",
                merchant: item.merchant,
                amount: Number(item.amount),
                transactionIds: [
                    item.first_transaction_id,
                    item.second_transaction_id
                ],
                description: "Possible duplicate payment detected"
            });
        });

        budgetLeaks.forEach(item => {
            leaks.push({
                type: "budget_exceeded",
                severity: "medium",
                category: item.category,
                budget: Number(item.monthly_limit),
                spent: Number(item.spent),
                excess: Number(item.spent) -
                        Number(item.monthly_limit),
                description: "Monthly budget exceeded"
            });
        });

        upcomingSubscriptions.forEach(item => {
            leaks.push({
                type: "upcoming_subscription",
                severity: "low",
                subscriptionId: item.id,
                merchant: item.merchant,
                amount: Number(item.amount),
                renewalDate: item.next_billing_date,
                description: "Upcoming subscription renewal"
            });
        });

        const potentialLeakAmount = leaks.reduce(
            (total, item) => {
                if (
                    item.type === "possible_duplicate" ||
                    item.type === "budget_exceeded"
                ) {
                    return total + (
                        item.type === "possible_duplicate"
                            ? item.amount
                            : item.excess
                    );
                }

                return total;
            },
            0
        );

        res.json({
            success: true,

            totalFindings: leaks.length,

            potentialLeakAmount,

            leaks
        });

    } catch (error) {
        console.error("Leak detection error:", error);

        res.status(500).json({
            success: false,
            message: "Could not detect money leaks"
        });
    }
};
