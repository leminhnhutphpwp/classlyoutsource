"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Import MathfieldElement for typing
import type { MathfieldElement } from "mathlive";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Common/Button";

interface MathInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
  initialValue?: string;
}

export default function MathInputDialog({
  isOpen,
  onClose,
  onInsert,
  initialValue = "",
}: MathInputDialogProps) {
  const mfRef = useRef<MathfieldElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Dynamically load MathLive on client side
    import("mathlive").then((m) => {
      // Disable sounds to prevent 404 errors
      m.MathfieldElement.soundsDirectory = null;
      m.MathfieldElement.keypressSound = null;
      m.MathfieldElement.plonkSound = null;
      setIsClient(true);
    });
  }, []);

  // Sync initial value when ref is ready and focus
  useEffect(() => {
    if (isClient && mfRef.current) {
      // soundsDirectory is a static property, already set in the other useEffect
      if (initialValue) {
        mfRef.current.value = initialValue;
      }

      // Auto focus after a short delay to ensure modal transition is done
      setTimeout(() => {
        mfRef.current?.focus();

        // Listen to focus-out to re-focus if keyboard is open
        const handleFocusOut = (e: FocusEvent) => {
          // Check if relatedTarget is within the virtual keyboard or the mathfield itself
          const target = e.relatedTarget as HTMLElement;
          if (!target || (!target.closest('math-field') && !target.closest('.ML__keyboard'))) {
            // Optionally keep focus if intended, but better to let user navigate away if clicking outside
          }
        };
        mfRef.current?.addEventListener('focusout', handleFocusOut);
      }, 100);
    }
  }, [isClient, initialValue, isOpen]);

  const handleClose = useCallback(() => {
    // Hide virtual keyboard before closing
    if (mfRef.current) {
      mfRef.current.blur();
      // Force hide keyboard
      const mathVirtualKeyboard = window.mathVirtualKeyboard;
      if (mathVirtualKeyboard) {
        mathVirtualKeyboard.hide();
      }
    }
    onClose();
  }, [onClose]);

  // Handle outside click to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-4 sm:pt-20 bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --keyboard-zindex: 10000 !important;
          --keyboard-height: 280px !important;
        }
        /* Fix interaction issues with virtual keyboard */
        body > div.ML__keyboard {
           z-index: 2147483647 !important;
           position: fixed !important;
        }
        /* Ensure the virtual keyboard container is also on top if it exists differently in DOM */
        .ML__keyboard {
           z-index: 2147483647 !important;
        }
        
        /* Ensure modal content doesn't block clicks */
        math-field {
          z-index: 1;
          position: relative;
        }
        
        math-field::part(menu-toggle) {
          display: none; /* Hide default menu toggle for cleaner UI */
        }
        math-field::part(virtual-keyboard-toggle) {
          /* Custom styling for keyboard toggle if needed */
        }
        /* Make keyboard keys more compact */
        .ML__keyboard {
          --key-height: 40px !important;
        }
      `}} />
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header & Actions Compact Row */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Nhập công thức</span>
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => {
                // Ensure we get the latest clean value from the mathfield directly if possible
                if (mfRef.current) {
                  const cleanValue = mfRef.current.getValue('latex').replace(/\\placeholder\{.*?\}/g, '');
                  onInsert(cleanValue);
                } else {
                  onInsert(value);
                }
                handleClose();
              }}
            >
              Chèn
            </Button>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 bg-white dark:bg-gray-800">
          <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 shadow-inner">
            <math-field
              ref={mfRef}
              style={{
                width: "100%",
                fontSize: "1.25rem",
                padding: "4px",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                display: "block",
                minHeight: "48px",
              }}
              virtual-keyboard-mode="onfocus"
              onInput={(evt: React.SyntheticEvent<HTMLElement>) => {
                const target = evt.target as MathfieldElement;
                // Get value without placeholders
                const cleanValue = target.getValue('latex').replace(/\\placeholder\{.*?\}/g, '');
                setValue(cleanValue);
              }}
            >
            </math-field>
          </div>

          {/* Minimal Instruction */}
          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 flex justify-between items-center">
            <span>Hỗ trợ: Toán học, Hóa học (\ce)</span>
            <span>Bàn phím ảo sẽ hiện ở dưới</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
