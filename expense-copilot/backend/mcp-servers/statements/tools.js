
import * as z from "zod/v4";

export function registerStatementTools(server, pool) {
  // Tool 1: Retrieve transactions belonging to one user.
  server.registerTool(
    "get_transactions",
    {
      description:
        "Read financial transactions for the authenticated user. Supports optional date filters and a result limit.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        startDate: z.string().date().optional(),
        endDate: z.string().date().optional(),
        limit: z.number().int().min(1).max(100).default(20)
      })
    },
    async ({ userId, startDate, endDate, limit }) => {
      try {
        const conditions = ["user_id = ?"];
        const values = [userId];

        if (startDate) {
          conditions.push("transaction_date >= ?");
          values.push(startDate);
        }

        if (endDate) {
          conditions.push("transaction_date <= ?");
          values.push(endDate);
        }

        values.push(limit);

        const sql = `
          SELECT
            id,
            merchant,
            amount,
            transaction_date,
            category,
            transaction_type,
            description
          FROM transactions
          WHERE ${conditions.join(" AND ")}
          ORDER BY transaction_date DESC, id DESC
          LIMIT ?
        `;

        const [rows] = await pool.execute(sql, values);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                count: rows.length,
                transactions: rows
              })
            }
          ]
        };
      } catch (error) {
        console.error("get_transactions failed:", error.message);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Unable to retrieve transactions."
            }
          ]
        };
      }
    }
  );

  // Tool 2: Calculate income, expenses and balance.
  server.registerTool(
    "get_statement_summary",
    {
      description:
        "Calculate total income, expenses, balance and transaction count for the authenticated user over an optional date range.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        startDate: z.string().date().optional(),
        endDate: z.string().date().optional()
      })
    },
    async ({ userId, startDate, endDate }) => {
      try {
        const conditions = ["user_id = ?"];
        const values = [userId];

        if (startDate) {
          conditions.push("transaction_date >= ?");
          values.push(startDate);
        }

        if (endDate) {
          conditions.push("transaction_date <= ?");
          values.push(endDate);
        }

        const sql = `
          SELECT
            COALESCE(
              SUM(
                CASE WHEN transaction_type = 'credit'
                THEN amount ELSE 0 END
              ), 0
            ) AS income,

            COALESCE(
              SUM(
                CASE WHEN transaction_type = 'debit'
                THEN amount ELSE 0 END
              ), 0
            ) AS expenses,

            COUNT(*) AS transactionCount

          FROM transactions
          WHERE ${conditions.join(" AND ")}
        `;

        const [rows] = await pool.execute(sql, values);
        const result = rows[0];

        const income = Number(result.income);
        const expenses = Number(result.expenses);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                summary: {
                  income,
                  expenses,
                  balance: income - expenses,
                  transactionCount: Number(result.transactionCount)
                }
              })
            }
          ]
        };
      } catch (error) {
        console.error("get_statement_summary failed:", error.message);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Unable to calculate statement summary."
            }
          ]
        };
      }
    }
  );
}
