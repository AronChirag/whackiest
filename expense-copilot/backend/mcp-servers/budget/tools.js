
import * as z from "zod/v4";

export function registerBudgetTools(server, pool) {
  server.registerTool(
    "get_budgets",
    {
      description: "Read monthly budgets and spending for the authenticated user.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
      })
    },
    async ({ userId, month }) => {
      try {
        const selectedMonth = month || new Date().toISOString().slice(0, 7);

        const [rows] = await pool.execute(
          `SELECT
             b.id,
             b.category,
             b.monthly_limit,
             b.month_year,
             COALESCE(SUM(
               CASE WHEN t.transaction_type = 'debit'
               THEN t.amount ELSE 0 END
             ), 0) AS spent
           FROM budgets b
           LEFT JOIN transactions t
             ON t.user_id = b.user_id
             AND t.category = b.category
             AND DATE_FORMAT(t.transaction_date, '%Y-%m') = b.month_year
           WHERE b.user_id = ?
             AND b.month_year = ?
           GROUP BY b.id, b.category, b.monthly_limit, b.month_year
           ORDER BY b.category`,
          [userId, selectedMonth]
        );

        const budgets = rows.map((row) => {
          const limit = Number(row.monthly_limit);
          const spent = Number(row.spent);

          return {
            id: row.id,
            category: row.category,
            month: row.month_year,
            limit,
            spent,
            remaining: limit - spent,
            percentageUsed: limit > 0
              ? Number(((spent / limit) * 100).toFixed(2))
              : 0,
            exceeded: spent > limit
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              month: selectedMonth,
              budgets
            })
          }]
        };
      } catch (error) {
        console.error("get_budgets failed:", error.message);
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to retrieve budgets." }]
        };
      }
    }
  );

  server.registerTool(
    "get_budget_warnings",
    {
      description: "Find budget categories where spending exceeds the monthly limit.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
      })
    },
    async ({ userId, month }) => {
      try {
        const selectedMonth = month || new Date().toISOString().slice(0, 7);

        const [rows] = await pool.execute(
          `SELECT
             b.category,
             b.monthly_limit,
             COALESCE(SUM(
               CASE WHEN t.transaction_type = 'debit'
               THEN t.amount ELSE 0 END
             ), 0) AS spent
           FROM budgets b
           LEFT JOIN transactions t
             ON t.user_id = b.user_id
             AND t.category = b.category
             AND DATE_FORMAT(t.transaction_date, '%Y-%m') = b.month_year
           WHERE b.user_id = ?
             AND b.month_year = ?
           GROUP BY b.id, b.category, b.monthly_limit
           HAVING spent > b.monthly_limit`,
          [userId, selectedMonth]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              month: selectedMonth,
              warnings: rows.map((row) => ({
                category: row.category,
                limit: Number(row.monthly_limit),
                spent: Number(row.spent),
                exceededBy:
                  Number(row.spent) - Number(row.monthly_limit)
              }))
            })
          }]
        };
      } catch (error) {
        console.error("get_budget_warnings failed:", error.message);
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to calculate budget warnings." }]
        };
      }
    }
  );
}
