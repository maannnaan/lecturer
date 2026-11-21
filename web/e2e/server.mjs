// Starts the app for the end-to-end tests: a fresh embedded database filled with the demo data,
// then the production server (build first with `npm run build`). The database is seeded before
// the server starts because only one process may open it at a time.
//
// Beside it runs a stand-in for bKash's Tokenized Checkout (v2, as developer.bka.sh describes it)
// on BKASH_PORT, so paying through bKash can be tested end to end without bKash: it knows one
// merchant account (demo-merchant / demo-password, app key demo-app-key, app secret
// demo-app-secret), and its checkout page has a "Pay" and a "Cancel" link back to the app.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:http";

const port = process.env.PORT ?? "3124";
const bkashPort = process.env.BKASH_PORT ?? "3125";
const env = {
  ...process.env,
  // Photos are stored on local disk for the tests (production uses Cloudinary).
  PGLITE_DIR: ".data/e2e",
  LOCAL_UPLOADS: "1",
  UPLOADS_DIR: ".data/e2e-uploads",
  // Paying through bKash: the stand-in below, and a key for sealing the teacher's bKash secrets.
  BKASH_BASE_URL: `http://localhost:${bkashPort}`,
  SECRETS_KEY: "e2e0".repeat(16),
};

rmSync(".data/e2e", { recursive: true, force: true });
rmSync(".data/e2e-uploads", { recursive: true, force: true });
execSync("npx tsx scripts/seed-demo.ts", { env, stdio: "inherit" });

/** The stand-in bKash's payments: amount, where to send the student back, and where each stands. */
const opened = new Map();
let counter = 0;
const json = (res, body) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const read = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const bkash = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${bkashPort}`);
  if (req.method === "GET" && url.pathname === "/checkout") {
    const id = url.searchParams.get("paymentId") ?? "";
    const payment = opened.get(id);
    if (!payment) return res.writeHead(404).end("no such payment");
    const back = (status) => escape(`${payment.callbackURL}?paymentID=${id}&status=${status}&signature=test`);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><title>bKash (test)</title><h1>bKash (test)</h1><p>BDT ${escape(payment.amount)}</p><a href="${back("success")}">Pay</a> <a href="${back("cancel")}">Cancel</a>`);
  }
  if (req.method !== "POST") return res.writeHead(404).end();
  const body = await read(req);
  const h = req.headers;
  if (url.pathname === "/auth/grant-token" || url.pathname === "/auth/refresh-token") {
    const right = h.username === "demo-merchant" && h.password === "demo-password" && body.app_key === "demo-app-key" && body.app_secret === "demo-app-secret";
    return json(res, right ? { statusCode: "0000", statusMessage: "Successful", id_token: `fake-token-${++counter}`, refresh_token: `fake-refresh-${counter}`, expires_in: 3600, token_type: "Bearer" } : { statusCode: "9999", statusMessage: "Invalid or unrecognized access credentials" });
  }
  if (!String(h.authorization ?? "").startsWith("fake-token-") || h["x-app-key"] !== "demo-app-key") return json(res, { externalCode: "2001", errorMessageEn: "Invalid App Key" });
  if (url.pathname === "/payment/create") {
    const id = `TR0011E2E${++counter}`;
    opened.set(id, { amount: body.amount, callbackURL: body.callbackURL, status: "Initiated", trxId: "" });
    return json(res, { paymentId: id, bkashURL: `http://localhost:${bkashPort}/checkout?paymentId=${id}`, transactionStatus: "Initiated", amount: body.amount, currency: "BDT", intent: "sale" });
  }
  const payment = opened.get(body.paymentId);
  if (!payment) return json(res, { externalCode: "2002", errorMessageEn: "Invalid Payment ID" });
  if (url.pathname === "/payment/execute") {
    if (payment.status === "Completed") return json(res, { externalCode: "2062", errorMessageEn: "The payment has already been completed" });
    payment.status = "Completed";
    payment.trxId = `E2E${counter}TRX`;
    return json(res, { paymentId: body.paymentId, trxId: payment.trxId, transactionStatus: "Completed", amount: payment.amount, currency: "BDT", intent: "sale" });
  }
  if (url.pathname === "/query/payment") return json(res, { paymentId: body.paymentId, trxId: payment.trxId, transactionStatus: payment.status, amount: payment.amount, currency: "BDT" });
  res.writeHead(404).end();
});
bkash.listen(Number(bkashPort));

const server = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit", shell: true });
const stop = () => {
  bkash.close();
  server.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  bkash.close();
  process.exit(code ?? 0);
});
