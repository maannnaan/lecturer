import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESERVED_HANDLES, handleProblem, normalizeHandle } from "@/lib/handles";

describe("handleProblem", () => {
  it("accepts ordinary teacher addresses", () => {
    for (const h of ["mr_x", "tanvir", "tanvir-physics", "abc", "a1b", "x".repeat(30)]) {
      expect(handleProblem(h), h).toBeNull();
    }
  });

  it("needs 3 to 30 characters", () => {
    expect(handleProblem("ab")).toBe("length");
    expect(handleProblem("x".repeat(31))).toBe("length");
  });

  it("allows only lowercase English letters, digits, _ and -", () => {
    for (const h of ["Tanvir", "mr x", "মিস্টার", "mr.x", "mr@x"]) expect(handleProblem(h), h).toBe("chars");
  });

  it("must start and end with a letter or digit", () => {
    for (const h of ["-mrx", "mrx_", "_ab"]) expect(handleProblem(h), h).toBe("edge");
  });

  it("refuses reserved words", () => {
    for (const h of ["admin", "dashboard", "login", "register", "api", "lecturer"]) {
      expect(handleProblem(h), h).toBe("reserved");
    }
  });

  it("normalises case and surrounding spaces", () => {
    expect(normalizeHandle("  Mr_X ")).toBe("mr_x");
  });
});

describe("RESERVED_HANDLES", () => {
  // A teacher's handle lives at the site root, so it must never shadow one of the app's own routes.
  it("covers every top-level route folder and public file", () => {
    const routes = readdirSync("src/app", { withFileTypes: true })
      .filter((e) => e.isDirectory() && !/^[[(_]/.test(e.name))
      .map((e) => e.name);
    const publicEntries = existsSync("public") ? readdirSync("public").map((name) => name.replace(/\..*$/, "")) : [];
    const missing = [...routes, ...publicEntries].filter((name) => !RESERVED_HANDLES.has(name));
    expect(missing).toEqual([]);
  });
});
