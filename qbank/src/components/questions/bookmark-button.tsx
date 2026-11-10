"use client";

import { useMemo, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";

/* Bookmarks live in this browser only (there are no accounts yet). Reading and writing
   localStorage can throw in private windows or with storage blocked; then nothing is kept. */

const KEY = "qbank:bookmarks";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function useBookmark(id: string): [boolean, () => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const ids = useMemo(() => parse(raw), [raw]);
  const on = ids.includes(id);
  const toggle = () => {
    const next = on ? ids.filter((x) => x !== id) : [...ids, id];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return;
    }
    listeners.forEach((listener) => listener());
  };
  return [on, toggle];
}

export function BookmarkButton({ id }: { id: string }) {
  const [on, toggle] = useBookmark(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      className={cx(
        "inline-flex h-11 items-center gap-2 rounded-[10px] border px-4 font-semibold",
        on ? "border-accent bg-accent-soft text-accent" : "border-field bg-surface text-ink hover:bg-page",
      )}
    >
      {on && (
        <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
          <path d="M1 1h12v14l-6-4-6 4z" fill="currentColor" />
        </svg>
      )}
      {on ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
