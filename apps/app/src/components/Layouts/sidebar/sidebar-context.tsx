"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { createContext, useContext, useEffect, useState } from "react";

type SidebarState = "expanded" | "collapsed";

type SidebarContextType = {
  state: SidebarState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  toggleExpand: () => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

export const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  defaultExpanded = true,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  defaultExpanded?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
      setIsExpanded(false);
    } else {
      setIsOpen(true);
      // Always expand sidebar when opened on desktop
      setIsExpanded(true);
    }
  }, [isMobile]);

  // Disable body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      // Save current overflow style
      const originalOverflow = document.body.style.overflow;
      // Disable scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore original overflow when sidebar closes
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobile, isOpen]);

  function toggleSidebar() {
    setIsOpen((prev) => !prev);
  }

  function toggleExpand() {
    setIsExpanded((prev) => !prev);
  }

  return (
    <SidebarContext.Provider
      value={{
        state: isExpanded ? "expanded" : "collapsed",
        isOpen,
        setIsOpen,
        isExpanded,
        setIsExpanded,
        toggleExpand,
        isMobile,
        toggleSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
