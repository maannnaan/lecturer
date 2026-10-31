import { describe, expect, it } from "vitest";
import { parseChapter, parseCourse, parseNotice, parseTaka } from "@/lib/courses";
import { asciiDigits } from "@/lib/digits";
import { parseContact, parseHighlights, parseProfile, parseRoutine } from "@/lib/site";

describe("asciiDigits / parseTaka", () => {
  it("reads Bangla digits and separators the way people type prices", () => {
    expect(asciiDigits("৳১,২০০")).toBe("৳1,200");
    expect(parseTaka("১,২০০")).toBe(1200);
    expect(parseTaka("৳ 950")).toBe(950);
    expect(parseTaka("")).toBe(0);
    expect(parseTaka("12a")).toBeNull();
    expect(parseTaka("-5")).toBeNull();
  });
});

describe("parseProfile", () => {
  it("needs both names and keeps paragraphs in the about text", () => {
    const { account, site, errors } = parseProfile({ nameBn: " ", nameEn: "Tanvir", about: "one\r\ntwo\r\n\r\nthree" });
    expect(errors.nameBn).toBe("required");
    expect(account.nameEn).toBe("Tanvir");
    expect(site.about).toBe("one\ntwo\n\nthree");
  });

  it("refuses text longer than the limit", () => {
    expect(parseProfile({ nameBn: "a", nameEn: "b", tagline: "x".repeat(201) }).errors.tagline).toBe("tooLong");
  });
});

describe("parseHighlights", () => {
  it("drops blank slots and asks for both halves of a half-filled one", () => {
    const { site, errors } = parseHighlights({
      highlightValue: "৪২ জন জিপিএ-৫",
      highlightLabel: "এইচএসসি ২০২৫",
      stat0Value: "১২+",
      stat0Label: "বছরের শিক্ষকতা",
      stat2Value: "৩,২০০+",
    });
    expect(site.highlight).toEqual({ value: "৪২ জন জিপিএ-৫", label: "এইচএসসি ২০২৫" });
    expect(site.stats).toHaveLength(2);
    expect(errors).toEqual({ stat2Label: "incomplete" });
  });

  it("clears the highlight when both halves are empty", () => {
    expect(parseHighlights({}).site.highlight).toBeNull();
  });
});

describe("parseContact", () => {
  it("normalises numbers, lower-cases email and completes links", () => {
    const { site, errors } = parseContact({
      phone: "+880 1700-000000",
      whatsapp: "01700000000",
      email: "Tanvir@Example.com",
      facebook: "facebook.com/groups/physics",
      youtube: "https://youtu.be/abc",
    });
    expect(errors).toEqual({});
    expect(site.contact).toMatchObject({
      phone: "01700000000",
      email: "tanvir@example.com",
      facebook: "https://facebook.com/groups/physics",
      youtube: "https://youtu.be/abc",
    });
  });

  it("refuses a bad number, email, or a link to the wrong site", () => {
    const { errors } = parseContact({ phone: "123", email: "nope", facebook: "https://evil.example/fb", youtube: "javascript:alert(1)" });
    expect(errors).toEqual({ phone: "phone", email: "email", facebook: "url", youtube: "url" });
  });
});

describe("parseRoutine", () => {
  it("keeps named rows and flags a row without a batch", () => {
    const { site, errors } = parseRoutine({ batch0: "এইচএসসি ২০২৮ (ক)", days0: "শনি · সোম · বুধ", time0: "বিকেল ৪:০০", days3: "রবি" });
    expect(site.routine).toEqual([
      { batch: "এইচএসসি ২০২৮ (ক)", days: "শনি · সোম · বুধ", time: "বিকেল ৪:০০" },
      { batch: "", days: "রবি", time: "" },
    ]);
    expect(errors).toEqual({ batch3: "incomplete" });
  });
});

describe("parseCourse", () => {
  it("reads a paid monthly course", () => {
    const { course, errors } = parseCourse({
      title: "পদার্থবিজ্ঞান ১ম পত্র",
      level: "এইচএসসি",
      access: "paid",
      price: "১,২০০",
      pricePeriod: "monthly",
      icon: "atom",
      cover: "2",
      published: "on",
    });
    expect(errors).toEqual({});
    expect(course).toMatchObject({ access: "paid", price: 1200, icon: "atom", cover: 2, published: true });
  });

  it("needs a price for a paid course and drops it for any other", () => {
    expect(parseCourse({ title: "x", access: "paid", price: "0" }).errors.price).toBe("pricePositive");
    expect(parseCourse({ title: "x", access: "free", price: "500" }).course.price).toBe(0);
  });

  it("falls back to safe values for anything unexpected", () => {
    const { course, errors } = parseCourse({ title: "", icon: "<script>", cover: "9", access: "vip" });
    expect(errors.title).toBe("required");
    expect(course).toMatchObject({ icon: "book-open", cover: 1, access: "approval", published: false });
  });
});

describe("parseChapter", () => {
  it("accepts optional dates in order and refuses them reversed", () => {
    expect(parseChapter({ title: "ভেক্টর", startsOn: "2026-09-15", endsOn: "2026-09-30" }).errors).toEqual({});
    expect(parseChapter({ title: "ভেক্টর", startsOn: "2026-09-30", endsOn: "2026-09-15" }).errors.endsOn).toBe("dateOrder");
    expect(parseChapter({ title: "ভেক্টর", startsOn: "30/09/2026" }).errors.startsOn).toBe("invalid");
    expect(parseChapter({ title: "ভেক্টর", status: "weird" }).chapter.status).toBe("upcoming");
  });
});

describe("parseNotice", () => {
  it("needs a title", () => {
    expect(parseNotice({ title: "", body: "x" }).errors.title).toBe("required");
    expect(parseNotice({ title: "ক্লাস বন্ধ", pinned: "on" }).notice).toEqual({ title: "ক্লাস বন্ধ", body: "", pinned: true });
  });
});
