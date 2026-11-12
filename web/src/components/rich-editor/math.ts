import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";

/** A formula the teacher clicked, to open in the equation box; `pos` is where it sits. */
export type MathEditRequest = { pos: number; latex: string; display: boolean };

type MathOptions = {
  onEdit: (request: MathEditRequest) => void;
  /** Whether $x^2$ typed in a line becomes a formula (question text; not a notice that mentions dollars). */
  dollars: boolean;
};

function typeset(dom: HTMLElement, latex: string, display: boolean) {
  try {
    katex.render(latex, dom, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml", trust: false });
  } catch {
    dom.textContent = latex;
  }
}

/**
 * A formula in the editor, kept as its LaTeX and typeset with KaTeX as the page will show it.
 * Clicking it opens the equation box. In a line, typing $x^2$ makes one as soon as the closing $
 * goes in (\$ stays a dollar sign).
 */
function mathNode(name: "inlineMath" | "blockMath", display: boolean) {
  return Node.create<MathOptions>({
    name,
    group: display ? "block" : "inline",
    inline: !display,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
      return { onEdit: () => undefined, dollars: true };
    },

    addAttributes() {
      return {
        latex: {
          default: "",
          parseHTML: (element) => element.getAttribute("data-latex") ?? "",
          renderHTML: (attributes) => ({ "data-latex": attributes.latex }),
        },
      };
    },

    parseHTML() {
      return [{ tag: `${display ? "div" : "span"}[data-math="${name}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [display ? "div" : "span", mergeAttributes(HTMLAttributes, { "data-math": name })];
    },

    addNodeView() {
      return ({ node, getPos }) => {
        const dom = document.createElement(display ? "div" : "span");
        dom.className = display ? "rich-math rich-math-block" : "rich-math";
        dom.contentEditable = "false";
        let latex = String(node.attrs.latex ?? "");
        typeset(dom, latex, display);
        dom.addEventListener("click", () => {
          const pos = getPos();
          if (typeof pos === "number") this.options.onEdit({ pos, latex, display });
        });
        return {
          dom,
          update: (updated) => {
            if (updated.type.name !== name) return false;
            const next = String(updated.attrs.latex ?? "");
            if (next !== latex) {
              latex = next;
              typeset(dom, latex, display);
            }
            return true;
          },
          ignoreMutation: () => true,
        };
      };
    },

    addInputRules() {
      if (display || !this.options.dollars) return [];
      return [
        new InputRule({
          find: /(^|[^\\$])\$([^$\n]+)\$$/,
          handler: ({ state, range, match }) => {
            const latex = match[2].trim();
            if (!latex) return null;
            state.tr.replaceWith(range.from + match[1].length, range.to, this.type.create({ latex }));
          },
        }),
      ];
    },
  });
}

export const InlineMath = mathNode("inlineMath", false);
export const BlockMath = mathNode("blockMath", true);
