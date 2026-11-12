import type { RichDoc } from "@/lib/rich-text";
import { Paragraphs } from "./paragraphs";
import { RichContent } from "./rich-content";

/**
 * A website text (the "about me", a course's description, a notice): as the editor wrote it, or
 * older plain text as paragraphs. Dollar signs in it are just dollar signs.
 */
export function SiteText({ rich, plain, className }: { rich: RichDoc | null | undefined; plain: string; className?: string }) {
  return rich ? <RichContent value={rich} dollars={false} className={className} /> : <Paragraphs text={plain} className={className} />;
}
