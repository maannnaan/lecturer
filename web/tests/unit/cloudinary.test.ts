import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudinarySignature, uploadTicket } from "@/server/cloudinary";

describe("cloudinarySignature", () => {
  it("matches the worked example in Cloudinary's documentation", () => {
    const params = { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 };
    expect(cloudinarySignature(params, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("ignores parameter order and the parameters Cloudinary never signs", () => {
    const withExtras = { timestamp: 1, folder: "x", api_key: "k", file: "f", resource_type: "image", cloud_name: "c" };
    expect(cloudinarySignature(withExtras, "s")).toBe(cloudinarySignature({ folder: "x", timestamp: 1 }, "s"));
  });
});

describe("uploadTicket", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is unavailable until all three Cloudinary settings exist", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(uploadTicket("t1")).toBeNull();
  });

  it("signs an upload into the teacher's own folder", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
    vi.stubEnv("CLOUDINARY_API_KEY", "key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
    const ticket = uploadTicket("teacher-1", 1_700_000_000_000);
    expect(ticket).toMatchObject({ cloudName: "demo", apiKey: "key", folder: "lecturer/teacher-1", timestamp: 1_700_000_000 });
    expect(ticket?.signature).toBe(cloudinarySignature({ folder: "lecturer/teacher-1", timestamp: 1_700_000_000 }, "secret"));
  });
});
