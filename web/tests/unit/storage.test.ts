import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localUploadPath, sniffImage, storageMode, uploadsDir } from "@/server/storage";

const T = "11111111-2222-3333-4444-555555555555";
const M = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("sniffImage", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("refuses anything else, whatever it claims to be", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("localUploadPath", () => {
  it("only ever resolves inside the uploads folder", () => {
    expect(localUploadPath(T, `${M}.webp`)).toBe(path.join(uploadsDir(), T, `${M}.webp`));
    for (const [teacher, file] of [
      ["..", `${M}.webp`],
      [T, "../../etc/passwd"],
      [T, `${M}.svg`],
      [T, `${M}.webp/../x`],
      ["not-a-uuid", `${M}.jpg`],
    ]) {
      expect(localUploadPath(teacher, file), `${teacher}/${file}`).toBeNull();
    }
  });
});

describe("storageMode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Cloudinary once configured, a local folder only when allowed, and otherwise nothing", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("LOCAL_UPLOADS", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(storageMode()).toBeNull();
    vi.stubEnv("LOCAL_UPLOADS", "1");
    expect(storageMode()).toBe("local");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "k");
    vi.stubEnv("CLOUDINARY_API_SECRET", "s");
    expect(storageMode()).toBe("cloudinary");
  });
});
