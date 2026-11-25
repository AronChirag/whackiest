
export const TRUST_LEVELS = Object.freeze({
  VERIFIED: "verified",
  REVIEWED: "reviewed",
  UNTRUSTED: "untrusted",
  UNKNOWN: "unknown"
});

export function getTrustLevel(record) {
  if (!record || typeof record !== "object") {
    return TRUST_LEVELS.UNKNOWN;
  }

  if (record.trust_status === "verified") {
    return TRUST_LEVELS.VERIFIED;
  }

  if (record.trust_status === "reviewed") {
    return TRUST_LEVELS.REVIEWED;
  }

  if (record.trust_status === "untrusted") {
    return TRUST_LEVELS.UNTRUSTED;
  }

  return TRUST_LEVELS.UNKNOWN;
}

export function addTrustLabels(data, source) {
  if (Array.isArray(data)) {
    return data.map((item) => addTrustLabels(item, source));
  }

  if (!data || typeof data !== "object") {
    return data;
  }

  const trustLevel =
    source === "receipts"
      ? getTrustLevel(data)
      : TRUST_LEVELS.UNKNOWN;

  return {
    ...data,
    _security: {
      source,
      trustLevel,
      instructionsAreData: true
    }
  };
}
