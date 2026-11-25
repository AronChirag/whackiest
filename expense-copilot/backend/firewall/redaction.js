
const SENSITIVE_KEYS = new Set([
  "email",
  "phone",
  "password",
  "password_hash",
  "account_number",
  "card_number",
  "pan",
  "aadhaar",
  "address",
  "reference_hash"
]);

function maskValue(value) {
  if (typeof value !== "string") {
    return "[REDACTED]";
  }

  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 1)}***@${domain}`;
  }

  if (value.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

export function redactSensitiveData(value) {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveData);
  }

  if (value && typeof value === "object") {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = maskValue(item);
      } else {
        result[key] = redactSensitiveData(item);
      }
    }

    return result;
  }

  return value;
}
