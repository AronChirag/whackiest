
const MAX_ARGUMENT_DEPTH = 8;
const MAX_STRING_LENGTH = 5000;

function inspect(value, depth = 0) {
  if (depth > MAX_ARGUMENT_DEPTH) {
    return "Arguments are nested too deeply.";
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return "Argument contains an excessively long string.";
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = inspect(item, depth + 1);
      if (problem) return problem;
    }
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/__proto__|constructor|prototype/i.test(key)) {
        return "Suspicious object property detected.";
      }

      const problem = inspect(item, depth + 1);
      if (problem) return problem;
    }
  }

  return null;
}

export function runCanaryChecks(toolName, args) {
  if (typeof toolName !== "string" || !toolName.trim()) {
    return { safe: false, reason: "Invalid tool name." };
  }

  const problem = inspect(args);

  if (problem) {
    return { safe: false, reason: problem };
  }

  return { safe: true };
}
