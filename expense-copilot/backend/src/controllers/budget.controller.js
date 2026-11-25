
import pool from "../config/db.js";

export const createBudget = async (req, res) => {
    try {
        const { category, monthly_limit, month_year } = req.body;

        if (
            !category ||
            !Number.isFinite(Number(monthly_limit)) ||
            Number(monthly_limit) <= 0 ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(month_year || "")
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid budget details"
            });
        }

        await pool.execute(
            `INSERT INTO budgets
            (user_id, category, monthly_limit, month_year)
            VALUES (?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE
            monthly_limit = VALUES(monthly_limit)`,
            [
                req.user.id,
                category.trim(),
                Number(monthly_limit),
                month_year
            ]
        );

        res.status(201).json({
            success: true,
            message: "Budget saved successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Could not save budget"
        });
    }
};

export const getBudgets = async (req, res) => {
    try {
        const [budgets] = await pool.execute(
            `SELECT
                b.id,
                b.category,
                b.monthly_limit,
                b.month_year,

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

             GROUP BY
                b.id,
                b.category,
                b.monthly_limit,
                b.month_year

             ORDER BY b.month_year DESC`,
            [req.user.id]
        );

        const results = budgets.map(item => {
            const limit = Number(item.monthly_limit);
            const spent = Number(item.spent);

            return {
                ...item,
                monthly_limit: limit,
                spent,
                remaining: limit - spent,
                percentage: Math.round(
                    (spent / limit) * 100
                )
            };
        });

        res.json({
            success: true,
            budgets: results
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Could not retrieve budgets"
        });
    }
};
