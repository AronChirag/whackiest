
export const TOOL_POLICIES = Object.freeze({
  get_transactions: {
    server: "statements",
    permission: "read",
    approvalRequired: false
  },

  get_statement_summary: {
    server: "statements",
    permission: "read",
    approvalRequired: false
  },

  get_receipts: {
    server: "receipts",
    permission: "read",
    approvalRequired: false
  },

  get_unmatched_receipts: {
    server: "receipts",
    permission: "read",
    approvalRequired: false
  },

  get_budgets: {
    server: "budget",
    permission: "read",
    approvalRequired: false
  },

  get_budget_warnings: {
    server: "budget",
    permission: "read",
    approvalRequired: false
  }
});

export function getToolPolicy(toolName) {
  return TOOL_POLICIES[toolName] || null;
}

export function isToolAllowed(toolName) {
  return Boolean(getToolPolicy(toolName));
}
