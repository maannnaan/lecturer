import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BKASH_SANDBOX_URL, BkashError, bkashAmount, bkashBaseUrl, createPayment, executePayment, grantToken, queryPayment } from "@/server/bkash";
import { openSecret, sealSecret, secretsKey } from "@/server/crypto";

describe("sealed secrets", () => {
  const key = randomBytes(32);

  it("open again with the same key", () => {
    const sealed = sealSecret("bKash-p@ss ১২৩", key);
    expect(sealed).not.toContain("p@ss");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(openSecret(sealed, key)).toBe("bKash-p@ss ১২৩");
    // Sealed twice, two different results: nothing to compare across rows.
    expect(sealSecret("same", key)).not.toBe(sealSecret("same", key));
  });

  it("don't open with another key, or once altered, or without a key", () => {
    const sealed = sealSecret("secret", key);
    expect(openSecret(sealed, randomBytes(32))).toBeNull();
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = `${data.slice(0, -2)}${data.endsWith("A") ? "B" : "A"}${data.slice(-1)}`;
    expect(openSecret([v, iv, tag, flipped].join("."), key)).toBeNull();
    expect(openSecret("not-sealed", key)).toBeNull();
    expect(openSecret(sealed, null)).toBeNull();
    expect(() => sealSecret("secret", null)).toThrow();
  });

  it("take the key as 32 bytes of hex or base64, and nothing else", () => {
    const bytes = randomBytes(32);
    expect(secretsKey(bytes.toString("hex"))).toEqual(bytes);
    expect(secretsKey(bytes.toString("base64"))).toEqual(bytes);
    expect(secretsKey(randomBytes(16).toString("hex"))).toBeNull();
    expect(secretsKey("")).toBeNull();
    expect(secretsKey(undefined)).toBeNull();
  });
});

/** A fetch that records what was asked and answers with `reply`. */
function recorder(reply: (path: string, body: Record<string, unknown>) => unknown) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url, headers: init?.headers as Record<string, string>, body });
    return new Response(JSON.stringify(reply(url.replace(BKASH_SANDBOX_URL, ""), body)), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchFn };
}

const account = { baseUrl: BKASH_SANDBOX_URL, username: "merchant", password: "pass", appKey: "app-key", appSecret: "app-secret" };

describe("the bKash client", () => {
  afterEach(() => {
    delete process.env.BKASH_BASE_URL;
  });

  it("asks for a token with the account's username and password, as bKash's v2 API wants", async () => {
    const { calls, fetchFn } = recorder(() => ({ statusCode: "0000", statusMessage: "Successful", id_token: "tok", refresh_token: "ref", expires_in: 3600, token_type: "Bearer" }));
    expect(await grantToken(account, fetchFn)).toEqual({ idToken: "tok", refreshToken: "ref", expiresIn: 3600 });
    expect(calls[0].url).toBe(`${BKASH_SANDBOX_URL}/auth/grant-token`);
    expect(calls[0].headers).toMatchObject({ username: "merchant", password: "pass", "content-type": "application/json" });
    expect(calls[0].body).toEqual({ app_key: "app-key", app_secret: "app-secret" });
  });

  it("says why bKash refused, in bKash's words", async () => {
    const { fetchFn } = recorder(() => ({ statusCode: "9999", statusMessage: "Invalid or unrecognized access credentials" }));
    await expect(grantToken(account, fetchFn)).rejects.toMatchObject({ code: "9999", message: "Invalid or unrecognized access credentials", timeout: false });
    const pay = recorder(() => ({ externalCode: "2007", errorMessageEn: "Invalid currency" }));
    await expect(createPayment(account, "tok", { amount: 500, invoice: "inv", payerReference: "01700000000", callbackURL: "https://x/cb" }, pay.fetchFn)).rejects.toMatchObject({ code: "2007" });
  });

  it("opens a payment for the amount in taka, with the token and app key", async () => {
    const { calls, fetchFn } = recorder(() => ({ paymentId: "TR0011", bkashURL: "https://sandbox.payment.bkash.com/?paymentId=TR0011", transactionStatus: "Initiated" }));
    const made = await createPayment(account, "tok", { amount: 1200, invoice: "a1b2", payerReference: "01900000001", callbackURL: "https://lecturer.example/api/bkash/callback/a1b2" }, fetchFn);
    expect(made).toEqual({ paymentId: "TR0011", bkashURL: "https://sandbox.payment.bkash.com/?paymentId=TR0011" });
    expect(calls[0].url).toBe(`${BKASH_SANDBOX_URL}/payment/create`);
    expect(calls[0].headers).toMatchObject({ authorization: "tok", "x-app-key": "app-key" });
    expect(calls[0].body).toEqual({
      payerReference: "01900000001",
      callbackURL: "https://lecturer.example/api/bkash/callback/a1b2",
      amount: "1200.00",
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: "a1b2",
    });
    expect(bkashAmount(5)).toBe("5.00");
  });

  it("executes and queries a payment, reading v2's names and the older ones alike", async () => {
    const done = recorder(() => ({ paymentId: "TR0011", trxId: "BFD90JRLST", transactionStatus: "Completed", amount: "1200.00", currency: "BDT" }));
    expect(await executePayment(account, "tok", "TR0011", done.fetchFn)).toEqual({ paymentId: "TR0011", trxId: "BFD90JRLST", transactionStatus: "Completed", amount: 1200, currency: "BDT" });
    expect(done.calls[0].body).toEqual({ paymentId: "TR0011" });
    const old = recorder(() => ({ paymentID: "TR0011", trxID: "X1", transactionStatus: "Initiated", amount: "1200", currency: "BDT" }));
    expect(await queryPayment(account, "tok", "TR0011", old.fetchFn)).toMatchObject({ paymentId: "TR0011", trxId: "X1", transactionStatus: "Initiated" });
    expect(old.calls[0].url).toBe(`${BKASH_SANDBOX_URL}/query/payment`);
    const refused = recorder(() => ({ externalCode: "2062", errorMessageEn: "The payment has already been completed" }));
    await expect(executePayment(account, "tok", "TR0011", refused.fetchFn)).rejects.toMatchObject({ code: "2062" });
  });

  it("tells a timeout from a refusal: no answer isn't a failure", async () => {
    const slow = (async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as typeof fetch;
    const error = await executePayment(account, "tok", "TR0011", slow).catch((e) => e);
    expect(error).toBeInstanceOf(BkashError);
    expect(error).toMatchObject({ code: "timeout", timeout: true });
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(queryPayment(account, "tok", "TR0011", down)).rejects.toMatchObject({ code: "network", timeout: false });
  });

  it("reaches the sandbox, the live system, or the tests' stand-in", () => {
    expect(bkashBaseUrl("sandbox")).toBe("https://tokenized.sandbox.bka.sh/v2/tokenized-checkout");
    expect(bkashBaseUrl("live")).toBe("https://tokenized.pay.bka.sh/v2/tokenized-checkout");
    process.env.BKASH_BASE_URL = "http://localhost:3125/";
    expect(bkashBaseUrl("live")).toBe("http://localhost:3125");
  });
});
