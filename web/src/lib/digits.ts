const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Turns Bangla digits into ASCII ones, leaving everything else as it is: "৳১,২০০" → "৳1,200". */
export function asciiDigits(text: string): string {
  return [...text]
    .map((ch) => {
      const i = BANGLA_DIGITS.indexOf(ch);
      return i >= 0 ? String(i) : ch;
    })
    .join("");
}
