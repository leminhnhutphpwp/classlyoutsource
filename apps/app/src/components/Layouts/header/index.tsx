"use client";

import { useState, useRef, useEffect } from "react";
import { SearchIcon } from "@/assets/icons";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { Notification } from "./notification";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import { SearchPopup } from "./search-popup";
import Tooltip from "@/components/Common/Tooltip";
import { Bars3Icon } from "@heroicons/react/24/outline";

export function Header() {
  const { toggleSidebar, toggleExpand, isExpanded, isMobile } = useSidebarContext();
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Handle search input focus and change
  const handleSearchFocus = () => {
    setShowSearchPopup(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchPopup(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSearchPopup(false);
      searchInputRef.current?.blur();
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSearchPopup && !target.closest('[data-search-container]') && !target.closest('[data-search-popup]')) {
        setShowSearchPopup(false);
      }
    };

    if (showSearchPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSearchPopup]);

  // Handle scroll to show/hide header on mobile
  useEffect(() => {
    if (!isMobile) {
      setIsHeaderVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header when at top
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      }
      // Hide header when scrolling down, show when scrolling up
      else if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsHeaderVisible(false);
      } else {
        // Scrolling up
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  return (
    <>
      <header className={`${isMobile ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-stroke bg-white px-3 py-3 shadow-1 dark:border-stroke-dark dark:bg-gray-dark sm:px-4 sm:py-3 md:px-5 md:py-3 2xl:px-10 transition-transform duration-300 ease-in-out ${isMobile && !isHeaderVisible ? '-translate-y-full' : ''}`}>
        <div className="flex items-center gap-2">
          {/* Mobile: Toggle open/close */}
          <Tooltip label="Mở/đóng Sidebar">
            <button
              onClick={toggleSidebar}
              className="rounded-lg border p-1.5 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] sm:p-2 lg:hidden"
              aria-label="Mở/đóng Sidebar"
            >
              <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="sr-only">Chuyển đổi Sidebar</span>
            </button>
          </Tooltip>

          {/* Desktop: Toggle expand/collapse */}
          {!isMobile && (
            <Tooltip label={isExpanded ? "Thu gọn" : "Mở rộng"}>
              <button
                onClick={toggleExpand}
                className="hidden rounded-lg border p-1.5 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] sm:p-2 lg:flex transition-all duration-200 hover:scale-105"
                aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300" />
                <span className="sr-only">{isExpanded ? "Thu gọn" : "Mở rộng"}</span>
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 md:gap-4">
          <div className="relative w-full max-w-[140px] sm:max-w-[250px] md:max-w-[300px]" data-search-container>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onKeyDown={handleSearchKeyDown}
              className="flex w-full items-center gap-2 rounded-full border bg-gray-2 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary sm:gap-3.5 sm:py-2.5 sm:pl-11 sm:pr-4 sm:text-base md:py-2.5 md:pl-[53px] md:pr-5"
            />

            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 sm:left-4 sm:h-5 sm:w-5 md:left-5" />
          </div>

          <ThemeToggleSwitch />

          <Notification />

          <div className="shrink-0">
            <UserInfo />
          </div>
        </div>
      </header>

      {showSearchPopup && (
        <SearchPopup
          query={searchQuery}
          onClose={() => {
            setShowSearchPopup(false);
            searchInputRef.current?.blur();
          }}
          onQueryChange={setSearchQuery}
        />
      )}
    </>
  );
}
