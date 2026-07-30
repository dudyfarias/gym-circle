export const P0_6_MAX_CASES = 10;
export const P0_6_SANITY_CASES = 3;
export const MAX_SUPPORTED_CALLS = 30;

export function validateExecutionSafety({
  allowPaidRequests,
  approvedExecutionLimit,
  execute,
  hasExplicitCallCap,
  hasExplicitLimit,
  limit,
  maxCalls,
  providerId,
  subsetId,
  subsetExecutionAllowed,
}) {
  const errors = [];
  if (!execute) return errors;
  if (!allowPaidRequests) errors.push("Missing --allow-paid-requests");
  if (!providerId) errors.push("Missing --provider");
  if (subsetId !== "p0-6") errors.push("External execution requires --subset=p0-6");
  if (!hasExplicitLimit) errors.push("External execution requires an explicit --limit");
  if (!hasExplicitCallCap) errors.push("External execution requires an explicit --max-calls");
  if (![P0_6_SANITY_CASES, P0_6_MAX_CASES].includes(limit)) {
    errors.push("P0.6 execution limit must be exactly 3 or 10 cases");
  }
  if (maxCalls > MAX_SUPPORTED_CALLS) {
    errors.push(`P0.6 call cap cannot exceed ${MAX_SUPPORTED_CALLS}`);
  }
  if (limit > maxCalls) errors.push(`Requested limit ${limit} exceeds call cap ${maxCalls}`);
  if (!subsetExecutionAllowed) {
    errors.push("P0.6 subset execution is locked pending credentials and explicit approval");
  }
  if (limit > approvedExecutionLimit) {
    errors.push(
      `P0.6 execution limit ${limit} exceeds the currently approved limit ${approvedExecutionLimit}`,
    );
  }
  return errors;
}

export function createRequestBudget(maxCalls, fetchImplementation = globalThis.fetch) {
  let callsSent = 0;
  return {
    get callsSent() {
      return callsSent;
    },
    async request(...args) {
      if (callsSent >= maxCalls) {
        const error = new Error(`Request budget exhausted at ${maxCalls} calls`);
        error.name = "RequestBudgetExceededError";
        throw error;
      }
      callsSent += 1;
      return fetchImplementation(...args);
    },
  };
}

export function classifyProviderFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/HTTP\s+(\d{3})/i);
  const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return { failure_type: "timeout", http_status: httpStatus };
  }
  if (error?.name === "RequestBudgetExceededError") {
    return { failure_type: "call_cap_exceeded", http_status: httpStatus };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return { failure_type: "authentication_or_billing", http_status: httpStatus };
  }
  if (httpStatus === 429) {
    return { failure_type: "rate_limited", http_status: httpStatus };
  }
  if (httpStatus && httpStatus >= 500) {
    return { failure_type: "provider_unavailable", http_status: httpStatus };
  }
  return { failure_type: "request_failed", http_status: httpStatus };
}
