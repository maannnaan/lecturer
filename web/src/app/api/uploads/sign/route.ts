import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { uploadTicket } from "@/server/cloudinary";

/**
 * A signed ticket for one direct-to-Cloudinary image upload into the signed-in teacher's folder.
 * The API secret never leaves the server; the browser only gets this one-time signature.
 */
export async function POST() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const ticket = uploadTicket(teacher.id);
  if (!ticket) return NextResponse.json({ error: "Image uploads are not set up yet" }, { status: 503 });
  return NextResponse.json(ticket);
}
