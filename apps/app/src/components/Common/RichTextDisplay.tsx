import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import katex from 'katex';
// @ts-expect-error – katex/contrib/auto-render lacks typings
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import 'katex/dist/katex.min.css';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Add a hook to force target="_blank" and rel="noopener noreferrer" for all links
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });

    // Sanitize and set HTML manually to avoid React reconciliation conflicts
    const sanitized = DOMPurify.sanitize(content, {
      ADD_TAGS: ['math-field', 'span', 'iframe'], // Allow iframe for embedded videos if needed, but be careful
      ADD_ATTR: ['data-latex', 'data-display', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'], // Attributes for iframe
    });
    
    containerRef.current.innerHTML = sanitized;

    // Render Math from data-latex attributes (Tiptap Math Extension)
    const mathElements = containerRef.current.querySelectorAll('span[data-latex]');
    mathElements.forEach((element) => {
      const latex = element.getAttribute('data-latex');
      if (latex) {
        try {
          katex.render(latex, element as HTMLElement, {
            throwOnError: false,
            displayMode: element.getAttribute('data-display') === 'yes',
          });
        } catch (e) {
          console.error('KaTeX rendering error:', e);
        }
      }
    });

    // Optional: Render Math from text delimiters $$...$$ or $...$
    // This handles cases where math is stored as text delimiters
    try {
        renderMathInElement(containerRef.current, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
        });
    } catch (e) {
        console.error('Auto-render error:', e);
    }

  }, [content]);

  return (
    <div 
      ref={containerRef}
      className={`prose dark:prose-invert max-w-none ${className}`}
    />
  );
};

export default RichTextDisplay;
