"use client";

import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { Image } from "@tiptap/extension-image";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { NodeSelection } from "@tiptap/pm/state";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Sigma,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  Underline,
} from "lucide-react";
import type { Dictionary } from "@/i18n";
import { type RichMode, type RichText, richFromField, richToDoc, richToField } from "@/lib/rich-text";
import { uploadImage } from "@/lib/shrink-image";
import { EquationDialog } from "./equation-dialog";
import { BlockMath, InlineMath, type MathEditRequest } from "./math";

export type EditorText = Dictionary["editor"];
export type UploadErrors = { type: string; size: string; unavailable: string };

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Pictures carry the id of the teacher's upload; one pasted from elsewhere has none and is left out. */
const UploadedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-media-id"),
        renderHTML: (attributes) => (attributes.mediaId ? { "data-media-id": attributes.mediaId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },
}).configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "rich-img" } });

function extensionsFor(mode: RichMode, dollars: boolean, onEdit: (request: MathEditRequest) => void) {
  const inline = mode === "inline";
  const base = [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      strike: false,
      link: false,
      ...(inline ? { bulletList: false, orderedList: false, listItem: false, listKeymap: false } : {}),
    }),
    Subscript,
    Superscript,
    InlineMath.configure({ onEdit, dollars }),
  ];
  if (inline) return base;
  return [...base, BlockMath.configure({ onEdit, dollars }), TableKit.configure({ table: { resizable: false } }), UploadedImage];
}

type Equation = { pos: number | null; latex: string; display: boolean };

/**
 * A rich text field: a toolbar (bold, italic, underline, subscript, superscript; in a "block"
 * field also lists, tables, pictures; always an equation button) over the text, which shows as
 * it will on the page. Posts with the form through a hidden input named `name`: the document as
 * JSON, or the field's old plain text until it is edited. `onChange` runs after every edit.
 */
export function RichEditor({
  name,
  id: base = name,
  label,
  labelNote,
  hint,
  error,
  defaultValue,
  mode = "block",
  rows = 3,
  dollars = true,
  t,
  uploadErrors,
  onChange,
}: {
  name: string;
  /** Prefix of the field's element ids (its error, hint and picture picker); the name by default. */
  id?: string;
  label: string;
  labelNote?: string;
  hint?: string;
  error?: string;
  /** The saved value, or what a refused form posted (JSON or plain text). */
  defaultValue?: RichText;
  mode?: RichMode;
  rows?: number;
  /** Whether $…$ typed in the text becomes a formula, as in question text. */
  dollars?: boolean;
  t: EditorText;
  uploadErrors: UploadErrors;
  onChange?: () => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hidden = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [posted] = useState(() => (typeof defaultValue === "string" ? defaultValue : richToField(defaultValue)));
  const [start] = useState(() => richToDoc(typeof defaultValue === "string" ? richFromField(defaultValue) : defaultValue, { mode, dollars }));
  // The field the form posts. The editor writes the document into it as it changes. React must
  // not render it again: on a re-render React sets a hidden input's default value, and a hidden
  // input's value is its default, so the teacher's text would be lost. The same element each
  // time lets React skip it.
  const postedInput = useMemo(() => <input ref={hidden} type="hidden" name={name} defaultValue={posted} />, [name, posted]);
  const [equation, setEquation] = useState<Equation | null>(null);
  const [upload, setUpload] = useState<{ busy: boolean; failed: string | null }>({ busy: false, failed: null });
  // The latest onChange, for the editor's own update callback.
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  const extensions = useMemo(() => extensionsFor(mode, dollars, (request) => setEquation(request)), [mode, dollars, setEquation]);
  const editor = useEditor({
    extensions,
    content: start,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        class: "rich rich-input",
        style: `min-height: ${(rows * 1.75 + 1.4).toFixed(2)}em`,
      },
    },
    onUpdate: ({ editor: current }) => {
      if (hidden.current) hidden.current.value = current.isEmpty ? "" : JSON.stringify(current.getJSON());
      changed.current?.();
    },
  });

  // The field's error and hint, for screen readers, as on the other fields.
  const describedBy = [error && `${base}-error`, hint && `${base}-hint`].filter(Boolean).join(" ");
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      const dom = editor.view.dom;
      if (describedBy) dom.setAttribute("aria-describedby", describedBy);
      else dom.removeAttribute("aria-describedby");
      if (error) dom.setAttribute("aria-invalid", "true");
      else dom.removeAttribute("aria-invalid");
    } catch {
      // Not mounted yet: the next render sets them.
    }
  }, [editor, error, describedBy]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      const selection = current.state.selection;
      const math = selection instanceof NodeSelection && ["inlineMath", "blockMath"].includes(selection.node.type.name) ? selection : null;
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        underline: current.isActive("underline"),
        subscript: current.isActive("subscript"),
        superscript: current.isActive("superscript"),
        bulletList: current.isActive("bulletList"),
        orderedList: current.isActive("orderedList"),
        inTable: current.isActive("table"),
        math: math ? { pos: math.from, latex: String(math.node.attrs.latex ?? ""), display: math.node.type.name === "blockMath" } : null,
      };
    },
  });

  const run = (command: (editor: Editor) => void) => () => {
    if (editor) command(editor);
  };
  const tool = (key: string, labelText: string, icon: ReactNode, action: () => void, pressed?: boolean) => (
    <button
      key={key}
      type="button"
      className="rich-tool"
      aria-label={labelText}
      title={labelText}
      aria-pressed={pressed}
      disabled={!editor}
      // Keep the text's selection while the toolbar is clicked.
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  );
  const tableTool = (key: string, labelText: string, command: (editor: Editor) => void) => (
    <button key={key} type="button" className="rich-tool rich-tool-text" onMouseDown={(event) => event.preventDefault()} onClick={run(command)}>
      {labelText}
    </button>
  );

  async function addImage(picked: File) {
    setUpload({ busy: true, failed: null });
    const result = await uploadImage(picked);
    if ("error" in result) {
      setUpload({ busy: false, failed: uploadErrors[result.error as keyof UploadErrors] ?? t.uploadFailed });
    } else {
      editor?.chain().focus().insertContent({ type: "image", attrs: { src: result.url, mediaId: result.id, alt: "" } }).run();
      setUpload({ busy: false, failed: null });
    }
    if (file.current) file.current.value = "";
  }

  const block = mode === "block";
  return (
    <div className="field">
      <span className="field-label" id={labelId} onClick={() => editor?.commands.focus()}>
        {label}
        {labelNote && <span className="optional"> ({labelNote})</span>}
      </span>
      <div className={cx("rich-editor", error && "rich-editor-invalid")}>
        <div role="toolbar" aria-label={`${t.toolbar}: ${label}`} className="rich-toolbar">
          {tool("bold", t.bold, <Bold aria-hidden="true" />, run((e) => e.chain().focus().toggleBold().run()), state?.bold)}
          {tool("italic", t.italic, <Italic aria-hidden="true" />, run((e) => e.chain().focus().toggleItalic().run()), state?.italic)}
          {tool("underline", t.underline, <Underline aria-hidden="true" />, run((e) => e.chain().focus().toggleUnderline().run()), state?.underline)}
          {tool("sub", t.subscript, <SubscriptIcon aria-hidden="true" />, run((e) => e.chain().focus().toggleSubscript().run()), state?.subscript)}
          {tool("sup", t.superscript, <SuperscriptIcon aria-hidden="true" />, run((e) => e.chain().focus().toggleSuperscript().run()), state?.superscript)}
          {block && (
            <>
              <span className="rich-sep" aria-hidden="true" />
              {tool("ul", t.bulletList, <List aria-hidden="true" />, run((e) => e.chain().focus().toggleBulletList().run()), state?.bulletList)}
              {tool("ol", t.orderedList, <ListOrdered aria-hidden="true" />, run((e) => e.chain().focus().toggleOrderedList().run()), state?.orderedList)}
              <span className="rich-sep" aria-hidden="true" />
              {tool("table", t.table, <Table2 aria-hidden="true" />, run((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()))}
              <button
                type="button"
                className="rich-tool"
                aria-label={upload.busy ? t.uploading : t.image}
                title={upload.busy ? t.uploading : t.image}
                aria-busy={upload.busy || undefined}
                disabled={!editor || upload.busy}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => file.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
              </button>
            </>
          )}
          <span className="rich-sep" aria-hidden="true" />
          {tool(
            "equation",
            state?.math ? t.editEquation : t.equation,
            <Sigma aria-hidden="true" />,
            () => setEquation(state?.math ?? { pos: null, latex: "", display: false }),
            Boolean(state?.math),
          )}
          {block && state?.inTable && (
            <span className="rich-table-tools" role="group" aria-label={t.table}>
              {tableTool("row", t.addRow, (e) => e.chain().focus().addRowAfter().run())}
              {tableTool("col", t.addColumn, (e) => e.chain().focus().addColumnAfter().run())}
              {tableTool("delrow", t.deleteRow, (e) => e.chain().focus().deleteRow().run())}
              {tableTool("delcol", t.deleteColumn, (e) => e.chain().focus().deleteColumn().run())}
              {tableTool("deltable", t.deleteTable, (e) => e.chain().focus().deleteTable().run())}
            </span>
          )}
        </div>
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="rich rich-input" aria-hidden="true" style={{ minHeight: `${(rows * 1.75 + 1.4).toFixed(2)}em` }} />
        )}
      </div>
      {upload.failed && (
        <p className="field-error" role="alert">
          {upload.failed}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${base}-error`}>
          {error}
        </p>
      )}
      {hint && (
        <p className="field-hint" id={`${base}-hint`}>
          {hint}
        </p>
      )}
      {postedInput}
      {block && (
        <input
          ref={file}
          id={`${base}-image`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            if (picked) void addImage(picked);
          }}
        />
      )}
      {equation && (
        <EquationDialog
          initial={{ latex: equation.latex, display: equation.display, editing: equation.pos !== null }}
          allowDisplay={block}
          t={t}
          onClose={() => setEquation(null)}
          onSave={(latex, display) => {
            if (!editor) return;
            const chain = editor.chain().focus();
            if (equation.pos !== null) chain.setNodeSelection(equation.pos);
            chain.insertContent({ type: display ? "blockMath" : "inlineMath", attrs: { latex } }).run();
          }}
          onRemove={() => {
            if (editor && equation.pos !== null) editor.chain().focus().setNodeSelection(equation.pos).deleteSelection().run();
          }}
        />
      )}
    </div>
  );
}
