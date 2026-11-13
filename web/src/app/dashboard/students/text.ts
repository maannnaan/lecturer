import "server-only";
import type { Dictionary } from "@/i18n";
import type { BatchWithCount } from "@/server/batches";
import type { BatchFormText, PlacementText, StudentFormText } from "./student-forms";

// The plain strings each client form needs, picked from the dictionary on the server (a
// dictionary section with a function in it can't be handed to the browser).

export function studentFormText(d: Dictionary): StudentFormText {
  const t = d.dashboard.students;
  return {
    name: t.name,
    phone: t.phone,
    guardianName: t.guardianName,
    guardianPhone: t.guardianPhone,
    institution: t.institution,
    classLevel: t.classLevel,
    address: t.address,
    note: t.note,
    noteHint: t.noteHint,
    create: t.create,
  };
}

export function placementText(d: Dictionary): PlacementText {
  const t = d.dashboard.requests;
  return { batch: t.batch, noBatch: t.noBatch, roll: t.roll, rollHint: t.rollHint, fee: t.fee, feeHint: t.feeHint };
}

export function batchFormText(d: Dictionary): BatchFormText {
  const t = d.dashboard.batches;
  return {
    course: t.course,
    name: t.name,
    namePlaceholder: t.namePlaceholder,
    schedule: t.schedule,
    schedulePlaceholder: t.schedulePlaceholder,
    capacity: t.capacity,
    capacityHint: t.capacityHint,
    open: t.open,
    create: t.create,
  };
}

/** A batch as a menu names it: "ক ব্যাচ · শনি-সোম-বুধ, বিকেল ৪টা". */
export function batchLabel(batch: Pick<BatchWithCount, "name" | "schedule">): string {
  return batch.schedule ? `${batch.name} · ${batch.schedule}` : batch.name;
}
