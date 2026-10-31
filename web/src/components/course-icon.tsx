import {
  Atom,
  BookOpen,
  Calculator,
  Dna,
  FlaskConical,
  Globe,
  Languages,
  Leaf,
  type LucideIcon,
  type LucideProps,
  Magnet,
  PencilRuler,
  Sigma,
  Zap,
} from "lucide-react";
import type { CourseIcon } from "@/lib/courses";

const ICONS: Record<CourseIcon, LucideIcon> = {
  "book-open": BookOpen,
  atom: Atom,
  zap: Zap,
  magnet: Magnet,
  sigma: Sigma,
  calculator: Calculator,
  "flask-conical": FlaskConical,
  dna: Dna,
  leaf: Leaf,
  globe: Globe,
  languages: Languages,
  "pencil-ruler": PencilRuler,
};

/** The symbol on a course cover. Unknown names fall back to a book. */
export function CourseIconGlyph({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name as CourseIcon] ?? BookOpen;
  return <Icon aria-hidden="true" {...props} />;
}
