import "server-only";

// bKash Tokenized Checkout, version 2 (developer.bka.sh): getting and refreshing a token, then
// creating, executing and querying a payment. Each call is a POST with a 30-second limit, as
// bKash asks. `fetchFn` is there so tests can stand a fake bKash in for the real one.

/** bKash's test system, as its documentation gives it. */
export const BKASH_SANDBOX_URL = "https://tokenized.sandbox.bka.sh/v2/tokenized-checkout";
/**
 * The live system. bKash's public documentation doesn't print it (merchants get it on boarding);
 * this follows the sandbox's pattern, and BKASH_LIVE_URL overrides it.
 */
export const BKASH_LIVE_URL_DEFAULT = "https://tokenized.pay.bka.sh/v2/tokenized-checkout";

/** Where to reach bKash for an account in this mode. BKASH_BASE_URL (for the tests' fake bKash) overrides both. */
export function bkashBaseUrl(mode: "sandbox" | "live"): string {
  const override = process.env.BKASH_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  return mode === "live" ? (process.env.BKASH_LIVE_URL?.trim() || BKASH_LIVE_URL_DEFAULT).replace(/\/+$/, "") : BKASH_SANDBOX_URL;
}

export type BkashAccount = { baseUrl: string; username: string; password: string; appKey: string; appSecret: string };
export type FetchFn = typeof fetch;

/**
 * A bKash call that didn't succeed: bKash's own code and message (e.g. 2023 "Insufficient
 * Balance"), or `timeout` when no answer came in time (which doesn't mean it failed).
 */
export class BkashError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly timeout = false,
  ) {
    super(message);
    this.name = "BkashError";
  }
}

const TIMEOUT_MS = 30_000;

/** A POST to bKash, answered as JSON; bKash also answers refusals as JSON, so those come back too. */
async function post(fetchFn: FetchFn, url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new BkashError(timedOut ? "timeout" : "network", timedOut ? "bKash didn't answer in time" : "bKash couldn't be reached", timedOut);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new BkashError(String(res.status), `bKash answered ${res.status} without JSON`);
  }
}

const str = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** bKash's refusal, whichever form it came in: the token endpoints' statusCode, or the payment endpoints' externalCode. */
function refusal(json: Record<string, unknown>): BkashError {
  const code = str(json.externalCode) || str(json.statusCode) || str(json.errorCode) || "unknown";
  const message = str(json.errorMessageEn) || str(json.statusMessage) || str(json.errorMessage) || "bKash refused the request";
  return new BkashError(code, message);
}

export type BkashToken = { idToken: string; refreshToken: string; expiresIn: number };

function token(json: Record<string, unknown>): BkashToken {
  if (str(json.statusCode) !== "0000" || !str(json.id_token)) throw refusal(json);
  return { idToken: str(json.id_token), refreshToken: str(json.refresh_token), expiresIn: Number(json.expires_in) || 3600 };
}

/** A new token for the account. bKash allows two of these (with refreshes) an hour. */
export async function grantToken(account: BkashAccount, fetchFn: FetchFn = fetch): Promise<BkashToken> {
  const json = await post(fetchFn, `${account.baseUrl}/auth/grant-token`, { username: account.username, password: account.password }, { app_key: account.appKey, app_secret: account.appSecret });
  return token(json);
}

/** A fresh token from the refresh token (valid 30 days); counts against the same two an hour. */
export async function refreshToken(account: BkashAccount, refresh: string, fetchFn: FetchFn = fetch): Promise<BkashToken> {
  const json = await post(
    fetchFn,
    `${account.baseUrl}/auth/refresh-token`,
    { username: account.username, password: account.password },
    { app_key: account.appKey, app_secret: account.appSecret, refresh_token: refresh },
  );
  return token(json);
}

const paymentHeaders = (account: BkashAccount, idToken: string) => ({ authorization: idToken, "x-app-key": account.appKey });

/** "500.00": an amount as bKash takes it. */
export const bkashAmount = (taka: number) => taka.toFixed(2);

/**
 * Opens a payment of `amount` taka. bKash answers with its payment id and the page to send the
 * student to; after paying (or not) they come back to `callbackURL` with paymentID and status.
 */
export async function createPayment(
  account: BkashAccount,
  idToken: string,
  payment: { amount: number; invoice: string; payerReference: string; callbackURL: string },
  fetchFn: FetchFn = fetch,
): Promise<{ paymentId: string; bkashURL: string }> {
  const json = await post(fetchFn, `${account.baseUrl}/payment/create`, paymentHeaders(account, idToken), {
    payerReference: payment.payerReference,
    callbackURL: payment.callbackURL,
    amount: bkashAmount(payment.amount),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: payment.invoice,
  });
  const paymentId = str(json.paymentId) || str(json.paymentID);
  const bkashURL = str(json.bkashURL);
  if (!paymentId || !bkashURL) throw refusal(json);
  return { paymentId, bkashURL };
}

/** Where a payment stands at bKash: "Completed" once the money moved, "Initiated" if it never did. */
export type BkashPayment = { paymentId: string; trxId: string; transactionStatus: string; amount: number; currency: string };

function paymentOf(json: Record<string, unknown>): BkashPayment {
  const transactionStatus = str(json.transactionStatus);
  if (!transactionStatus) throw refusal(json);
  return {
    paymentId: str(json.paymentId) || str(json.paymentID),
    trxId: str(json.trxId) || str(json.trxID),
    transactionStatus,
    amount: Number(str(json.amount)) || 0,
    currency: str(json.currency),
  };
}

/** Completes a payment the student has confirmed: the only call that moves the money. Once per payment id. */
export async function executePayment(account: BkashAccount, idToken: string, paymentId: string, fetchFn: FetchFn = fetch): Promise<BkashPayment> {
  return paymentOf(await post(fetchFn, `${account.baseUrl}/payment/execute`, paymentHeaders(account, idToken), { paymentId }));
}

/** Where a payment stands, without changing it: what to ask when execute's answer didn't arrive. */
export async function queryPayment(account: BkashAccount, idToken: string, paymentId: string, fetchFn: FetchFn = fetch): Promise<BkashPayment> {
  return paymentOf(await post(fetchFn, `${account.baseUrl}/query/payment`, paymentHeaders(account, idToken), { paymentId }));
}
