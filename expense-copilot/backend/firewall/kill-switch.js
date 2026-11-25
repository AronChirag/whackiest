
let enabled = process.env.MCP_ENABLED !== "false";

export function isMcpEnabled() {
  return enabled;
}

export function enableMcp() {
  enabled = true;
  return enabled;
}

export function disableMcp() {
  enabled = false;
  return enabled;
}

export function assertMcpEnabled() {
  if (!enabled) {
    const error = new Error("MCP execution is disabled by the kill switch.");
    error.statusCode = 503;
    throw error;
  }
}
