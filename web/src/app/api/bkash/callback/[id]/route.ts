import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { finishGatewayPayment } from "@/server/gateway";

/**
 * Where bKash sends a student back after its payment page, with `paymentID` and `status`
 * (success, failure or cancel) appended. The payment is settled here (executed only on success,
 * and only if it is this payment's own bKash payment), then the student goes to their own page:
 * their receipt list when it went through, back to paying when it didn't.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const query = request.nextUrl.searchParams;
  const result = await finishGatewayPayment(await getDb(), (await params).id, {
    paymentID: query.get("paymentID") ?? query.get("paymentId") ?? "",
    status: query.get("status") ?? "",
  });
  const home = result.handle ? `/${result.handle}` : "/";
  const again = `${home}/me/pay?${result.enrollmentId ? `e=${result.enrollmentId}&` : ""}bkash=`;
  const to = {
    paid: `${home}/me?paid=bkash`,
    unconfirmed: `${home}/me?paid=checking`,
    cancelled: `${again}cancelled`,
    failed: `${again}failed`,
    unknown: result.handle ? `${home}/me` : "/",
  }[result.outcome];
  return NextResponse.redirect(new URL(to, request.url), { status: 303, headers: { "cache-control": "no-store" } });
}
