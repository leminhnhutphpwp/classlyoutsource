"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type RichTextEditorType from "./RichTextEditor";

/**
 * Dynamically-loaded RichTextEditor.
 *
 * The real editor pulls in tiptap + mathlive + katex (hundreds of KB). Loading
 * it eagerly on every form route bloats those bundles, so this wrapper defers
 * the import until the component actually renders on the client.
 *
 * It re-exports the exact same props as the underlying editor, so it is a
 * drop-in replacement for `import RichTextEditor from ".../RichTextEditor"`.
 */
const RichTextEditor = dynamic(() => import("./RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
  ),
});

export type RichTextEditorProps = ComponentProps<typeof RichTextEditorType>;

export default RichTextEditor;
