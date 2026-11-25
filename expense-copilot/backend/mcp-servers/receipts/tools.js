
import * as z from "zod/v4";

export function registerReceiptTools(server, pool) {
  server.registerTool(
    "get_receipts",
    {
      description: "Read receipts belonging to the authenticated user.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(20)
      })
    },
    async ({ userId, limit }) => {
      try {
        const [rows] = await pool.execute(
          `SELECT id, merchant, amount, receipt_date,
                  mime_type, trust_status, created_at
           FROM receipts
           WHERE user_id = ?
           ORDER BY receipt_date DESC, id DESC
           LIMIT ?`,
          [userId, limit]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: rows.length,
              receipts: rows
            })
          }]
        };
      } catch (error) {
        console.error("get_receipts failed:", error.message);
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to retrieve receipts." }]
        };
      }
    }
  );

  server.registerTool(
    "get_unmatched_receipts",
    {
      description: "Find receipts without a confirmed transaction match.",
      inputSchema: z.object({
        userId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(20)
      })
    },
    async ({ userId, limit }) => {
      try {
        const [rows] = await pool.execute(
          `SELECT r.id, r.merchant, r.amount, r.receipt_date,
                  r.trust_status
           FROM receipts r
           WHERE r.user_id = ?
             AND NOT EXISTS (
               SELECT 1
               FROM receipt_matches rm
               WHERE rm.receipt_id = r.id
                 AND rm.match_status = 'confirmed'
             )
           ORDER BY r.receipt_date DESC
           LIMIT ?`,
          [userId, limit]
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: rows.length,
              receipts: rows
            })
          }]
        };
      } catch (error) {
        console.error("get_unmatched_receipts failed:", error.message);
        return {
          isError: true,
          content: [{
            type: "text",
            text: "Unable to retrieve unmatched receipts."
          }]
        };
      }
    }
  );
}
