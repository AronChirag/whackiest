
import pool from "../config/db.js";

export const getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user.id;

        const [summary] = await pool.execute(
            `SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'credit'
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS total_income,

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'debit'
                            THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS total_expenses,

                COUNT(*) AS transaction_count

             FROM transactions

             WHERE user_id = ?
             AND YEAR(transaction_date) = YEAR(CURDATE())
             AND MONTH(transaction_date) = MONTH(CURDATE())`,
            [userId]
        );

        const [categories] = await pool.execute(
            `SELECT
                category,
                SUM(amount) AS total

             FROM transactions

             WHERE user_id = ?
             AND transaction_type = 'debit'
             AND YEAR(transaction_date) = YEAR(CURDATE())
             AND MONTH(transaction_date) = MONTH(CURDATE())

             GROUP BY category
             ORDER BY total DESC`,
            [userId]
        );

        const data = summary[0];

        const income = Number(data.total_income);
        const expenses = Number(data.total_expenses);

        res.json({
            success: true,

            summary: {
                totalIncome: income,
                totalExpenses: expenses,
                balance: income - expenses,
                transactionCount: data.transaction_count
            },

            categorySpending: categories,

            month: new Date().toISOString().slice(0, 7)
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Could not calculate dashboard summary"
        });
    }
};
