import type { ComponentProps } from "react";
import { renderTex } from "./math-text";
import { RichView } from "./rich-view";

/**
 * Rich text on a server-rendered page: <RichView> with its maths typeset by KaTeX on the server,
 * so students download no maths library.
 */
export function RichContent(props: Omit<ComponentProps<typeof RichView>, "math">) {
  return <RichView {...props} math={renderTex} />;
}
