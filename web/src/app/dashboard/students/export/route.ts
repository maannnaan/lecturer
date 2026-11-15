import { NextResponse } from "next/server";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { toCsv } from "@/lib/student-csv";
import { getCurrentTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { exportStudents } from "@/server/student-import";

/**
 * The signed-in teacher's students as a CSV file (Excel opens it with Bangla intact). Its columns
 * carry the headings the upload reads, so the file can be edited and uploaded again.
 */
export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const d = getDictionary(await getLocale());
  const t = d.dashboard.students;
  const rows = await exportStudents(await getDb(), teacher.id);
  const csv = toCsv([
    [t.name, t.phone, t.guardianName, t.guardianPhone, t.institution, t.classLevel, t.address, t.course, d.dashboard.requests.batch, d.dashboard.requests.roll, d.dashboard.requests.fee],
    ...rows.map(({ student, place }) => [
      student.name,
      student.phone,
      student.guardianName,
      student.guardianPhone,
      student.institution,
      student.classLevel,
      student.address,
      place?.courseTitle ?? "",
      place?.batchName ?? "",
      place?.roll ?? "",
      place ? place.fee : "",
    ]),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="students-${teacher.handle}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
