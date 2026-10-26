"use client";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { TextStyle } from '@tiptap/extension-text-style';
import { useEffect, useState } from 'react';
import {
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  LinkIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem.mjs';
import MathInputDialog from './MathInputDialog';

// Custom FontSize extension - extends TextStyle
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize?.replace('px', '') || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}px`,
          };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize: (fontSize: string) => ({ chain }) => {
        // Use 'textStyle' as the mark name since FontSize extends TextStyle
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung...",
  label,
  error,
  required = false,
  disabled = false,
}: RichTextEditorProps) {
  const [fontSize, setFontSize] = useState('16');
  const [showMathInput, setShowMathInput] = useState(false);

  useEffect(() => {
    // Disable MathLive sounds globally to prevent 404 errors
    import("mathlive").then((m) => {
      m.MathfieldElement.soundsDirectory = null;
      m.MathfieldElement.keypressSound = null;
      m.MathfieldElement.plonkSound = null;
    });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      MathExtension.configure({
        evaluation: false,
      }),
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    editable: !disabled,
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 text-gray-900 dark:text-gray-100',
        'data-placeholder': placeholder,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className={`rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Toolbar */}
        <div className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Bold"
          >
            <BoldIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Italic"
          >
            <ItalicIcon className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Heading 3"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('paragraph') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Paragraph"
          >
            P
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Bullet List"
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Numbered List"
          >
            1.
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => {
              const url = window.prompt('Nhập URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-700' : ''
              }`}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive('link')}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Remove Link"
          >
            <LinkIcon className="h-4 w-4 rotate-45" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => setShowMathInput(true)}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Nhập công thức Toán/Hóa"
          >
            <CalculatorIcon className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <select
            value={fontSize}
            onChange={(e) => {
              const size = e.target.value;
              setFontSize(size);
              if (size && editor) {
                editor.chain().focus().setFontSize(size).run();
              } else if (editor) {
                editor.chain().focus().unsetFontSize().run();
              }
            }}
            className="w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary flex-shrink-0"
            title="Font Size"
          >
            <option value="">Default</option>
            <option value="10">10px</option>
            <option value="12">12px</option>
            <option value="14">14px</option>
            <option value="16">16px</option>
            <option value="18">18px</option>
            <option value="20">20px</option>
            <option value="24">24px</option>
            <option value="28">28px</option>
            <option value="32">32px</option>
            <option value="36">36px</option>
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs"
            title="Clear Formatting"
          >
            Clear
          </button>
        </div>
        {/* Editor Content */}
        <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .dark .ProseMirror p.is-editor-empty:first-child::before {
          color: #6b7280;
        }
        .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
        }
        .ProseMirror ol {
          list-style-type: decimal;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        .dark .ProseMirror a {
          color: #60a5fa;
        }
        .ProseMirror code {
          background-color: #f3f4f6;
          color: var(--primary-color, #EF4444);
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .dark .ProseMirror code {
          background-color: #1f2937;
          color: #fca5a5;
        }
        .ProseMirror strong {
          font-weight: 700;
        }
        .ProseMirror em {
          font-style: italic;
        }
      `}</style>

      {/* Math Input Dialog */}
      <MathInputDialog
        isOpen={showMathInput}
        onClose={() => setShowMathInput(false)}
        onInsert={(latex) => {
          if (editor && latex) {
            // Clean up any remaining placeholders just in case
            // Also clean empty superscripts/subscripts like ^{} or _{} which might be left over
            const cleanLatex = latex
              .replace(/\\placeholder\{.*?\}/g, '')
              .replace(/\^\{\}/g, '')
              .replace(/_\{\}/g, '');

            // If it's empty after cleaning, don't insert
            if (!cleanLatex.trim()) return;

            // Insert as a math node directly using insertContent with JSON
            // The node name for @aarkue/tiptap-math-extension is 'inlineMath'
            editor.chain().focus().insertContent({
              type: 'inlineMath',
              attrs: { latex: cleanLatex },
            }).run();
          }
        }}
      />
    </div>
  );
}

