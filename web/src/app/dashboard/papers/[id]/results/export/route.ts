import { NextResponse } from "next/server";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { marksOf } from "@/lib/exams";
import { toCsv } from "@/lib/student-csv";
import { getCurrentTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { paperResultsView } from "@/server/paper-results";

/** A paper's merit list as a CSV file (Excel opens it with Bangla intact), for the signed-in teacher's own paper only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "signed-out" }, { status: 401 });
  const view = await paperResultsView(await getDb(), teacher.id, (await params).id);
  if (!view) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const r = getDictionary(await getLocale()).dashboard.papers.results;
  const csv = toCsv([
    [r.rank, r.roll, r.name, r.set, r.right, r.wrong, r.blank, r.doubled, r.mcq, r.written2, r.total],
    ...view.rows.map((row) => [
      row.rank,
      row.roll,
      row.name ?? "",
      row.setCode,
      row.correct,
      row.wrong,
      row.blank,
      row.doubled,
      marksOf(row.scoreHundredths),
      row.writtenHundredths === null ? "" : marksOf(row.writtenHundredths),
      marksOf(row.totalHundredths),
    ]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paper-${view.paper.number}-results.csv"`,
      "cache-control": "no-store",
    },
  });
}
