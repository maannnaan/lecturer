/** The platform's wordmark. Colours come from the surrounding theme. */
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true">
        L
      </span>
      <span className="logo-word">
        Lecturer<em>.bd</em>
      </span>
    </span>
  );
}

/** A teacher's monogram: the first letter of their Bangla name. */
export function initialOf(name: string): string {
  return [...name.trim()][0] ?? "?";
}
