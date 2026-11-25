
import * as z from "zod/v4";

const dateSchema = z.string().date();

const schemas = {
  get_transactions: z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    limit: z.number().int().min(1).max(100).default(20)
  }).strict(),

  get_statement_summary: z.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional()
  }).strict(),

  get_receipts: z.object({
    limit: z.number().int().min(1).max(100).default(20)
  }).strict(),

  get_unmatched_receipts: z.object({
    limit: z.number().int().min(1).max(100).default(20)
  }).strict(),

  get_budgets: z.object({
    month: z.string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
  }).strict(),

  get_budget_warnings: z.object({
    month: z.string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
  }).strict()
};

export function validateToolArguments(toolName, argumentsObject) {
  const schema = schemas[toolName];

  if (!schema) {
    return {
      success: false,
      error: "No validation schema exists for this tool."
    };
  }

  const result = schema.safeParse(argumentsObject || {});

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    };
  }

  return {
    success: true,
    data: result.data
  };
}
