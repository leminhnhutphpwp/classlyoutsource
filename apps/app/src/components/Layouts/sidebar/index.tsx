"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo, memo, useRef } from "react";
import { NAV_DATA } from "./data";
import { ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";
import { useMenuPermissions } from "@/lib/menu-permissions";

function SidebarComponent() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar, isExpanded } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { filterMenuSections } = useMenuPermissions();

  // Determine if sidebar content (logo, titles) should be visible
  const isContentVisible = isExpanded || isMobile;

  const [sidebarStyle, setSidebarStyle] = useState<React.CSSProperties>(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      return {
        backgroundColor: isDark
          ? '#1F2937'
          : 'var(--sidebar-bg, var(--color-primary))',
      };
    }
    return {};
  });
  const filteredNavData = useMemo(() => filterMenuSections(NAV_DATA), [filterMenuSections]);
  const currentBgRef = useRef<string>('');

  useEffect(() => {
    const updateSidebarStyle = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const newBg = isDark
        ? '#1F2937'
        : 'var(--sidebar-bg, var(--color-primary))';

      // Only update if background color actually changed
      if (currentBgRef.current !== newBg) {
        currentBgRef.current = newBg;
        setSidebarStyle({
          backgroundColor: newBg,
        });
      }
    };

    // Initialize ref
    const isDark = document.documentElement.classList.contains('dark');
    currentBgRef.current = isDark
      ? '#1F2937'
      : 'var(--sidebar-bg, var(--color-primary))';

    updateSidebarStyle();

    const observer = new MutationObserver(updateSidebarStyle);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const handleUpdate = () => updateSidebarStyle();
    window.addEventListener('mode-updated', handleUpdate);
    window.addEventListener('theme-colors-updated', handleUpdate);

    return () => {
      observer.disconnect();
      window.removeEventListener('mode-updated', handleUpdate);
      window.removeEventListener('theme-colors-updated', handleUpdate);
    };
  }, []);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev: string[]) => (prev.includes(title) ? [] : [title]));
  };

  const getBaseUrl = (url: string): string => {
    const [cleanPath] = url.split(/[?#]/);
    return cleanPath.replace(/\/(create|edit|take|enroll|confirm)$/, '');
  };

  // Mọi url có trong menu — dùng để quyết định "ai là khớp sâu nhất".
  const allMenuUrls = useMemo(() => {
    const urls: string[] = [];
    filteredNavData.forEach((section) =>
      section.items.forEach((item: any) => {
        if (item.url) urls.push(item.url);
        item.items?.forEach((sub: any) => sub.url && urls.push(sub.url));
      }),
    );
    return urls;
  }, [filteredNavData]);

  /**
   * Một mục là "trang hiện tại" khi url của nó khớp CHÍNH XÁC, hoặc là tiền tố của
   * đường dẫn hiện tại mà KHÔNG có mục nào khác khớp sâu hơn.
   *
   * Nếu chỉ dùng startsWith thuần, ở /organization/finance sẽ có 2 mục cùng sáng:
   * "Tổng quan" (/organization) và "Tài chính" (/organization/finance).
   */
  const isDeepestMatch = (href: string): boolean => {
    if (pathname === href) return true;
    if (href === "/" || !pathname.startsWith(href + "/")) return false;

    return !allMenuUrls.some(
      (url) =>
        url !== href &&
        url.length > href.length &&
        (pathname === url || pathname.startsWith(url + "/")),
    );
  };

  const isPathnameActive = (url: string): boolean => {
    if (pathname === url) return true;

    const baseUrl = getBaseUrl(url);

    if (pathname.startsWith(baseUrl + '/')) {
      const afterBase = pathname.slice(baseUrl.length + 1);
      if (afterBase === 'create' || afterBase === 'edit' || afterBase === 'take') {
        return false;
      }
      const dynamicRoutePattern = /^[\w-]+(\/(edit|view|enroll|confirm))?$/;
      return dynamicRoutePattern.test(afterBase);
    }

    return false;
  };

  useEffect(() => {
    filteredNavData.some((section) => {
      return section.items.some((item) => {
        if (item.items && item.items.length > 0) {
          return item.items.some((subItem) => {
            if (!subItem.url) return false;
            const baseUrl = getBaseUrl(subItem.url);
            if (pathname === subItem.url || (pathname.startsWith(baseUrl + '/') && pathname !== baseUrl + '/create')) {
              if (!expandedItems.includes(item.title)) {
                toggleExpanded(item.title);
              }
              return true;
            }
            return false;
          });
        }
        return false;
      });
    });
  }, [pathname, filteredNavData, expandedItems]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "border-r border-gray-200 transition-[width] duration-300 ease-in-out dark:border-gray-800 flex-shrink-0",
          isMobile
            ? "fixed bottom-0 top-0 z-50 overflow-hidden"
            : "sticky top-0 h-screen overflow-visible",
          isMobile
            ? (isOpen ? "w-full max-w-[290px]" : "w-0")
            : (isOpen
              ? (isExpanded ? "w-full max-w-[290px]" : "w-[70px]")
              : "w-0"),
        )}
        style={sidebarStyle}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className={cn(
          "flex h-full flex-col transition-all duration-300 ease-in-out",
          isMobile ? "pl-[25px] pr-[7px]" : isExpanded ? "pl-[25px] pr-[7px]" : "px-0 overflow-visible"
        )}>
          <div className={cn(
            "relative transition-all duration-300 ease-in-out bg-white dark:bg-white",
            isContentVisible ? "pt-2.5 pb-2 border-b border-gray-200 dark:border-gray-300 -mx-[25px] -mr-[7px] px-[25px] pr-[7px] rounded-b-lg shadow-[0_2px_8px_2px_rgba(0,0,0,0.008),0_1px_4px_1px_rgba(0,0,0,0.005)] dark:shadow-[0_2px_8px_2px_rgba(0,0,0,0.015),0_1px_4px_1px_rgba(0,0,0,0.008)]" : "pr-0 justify-center pt-2.5"
          )}>
            <Link
              href={"/"}
              onClick={() => isMobile && toggleSidebar()}
              className={cn(
                "px-0 py-1.5 sm:py-2 flex items-center justify-center w-full transition-all duration-300 ease-in-out"
              )}
            >
              {isContentVisible ? (
                <Logo size="sm" className="items-center text-center" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <div className={cn(
            "custom-scrollbar flex-1 transition-all duration-300 ease-in-out",
            isContentVisible ? "mt-3 sm:mt-4 pr-3 overflow-y-auto" : "mt-2 pr-0 overflow-y-auto overflow-x-visible relative"
          )}>
            {filteredNavData.map((section, sectionIndex) => (
              <div key={section.label} className={cn(
                "transition-all duration-300 ease-in-out",
                isContentVisible ? "mb-6" : "mb-0"
              )}>
                {!isContentVisible && sectionIndex > 0 && (
                  <div className="flex justify-center my-1">
                    <div className="w-8 h-px bg-gray-400/30 dark:bg-gray-600/30"></div>
                  </div>
                )}

                {isContentVisible && (
                  <h2 className={cn(
                    "text-sm font-medium [color:var(--sidebar-text,#FFFFFF)] dark:[color:var(--sidebar-text-dark,#FFFFFF)] transition-all duration-300 ease-in-out opacity-100 max-h-10 mb-5 block"
                  )}>
                    {section.label}
                  </h2>
                )}

                <nav role="navigation" aria-label={section.label}>
                  <ul className={cn(
                    "transition-all duration-300 ease-in-out",
                    isContentVisible ? "space-y-2" : "space-y-0 [&>li]:my-0 overflow-visible"
                  )}>
                    {section.items.map((item) => (
                      <li key={item.title} className={cn(
                        !isContentVisible && "mb-0 first:mt-0 overflow-visible"
                      )}>
                        {item.items && item.items.length > 0 ? (
                          <>
                            {!isContentVisible ? (
                              <MenuItem
                                isActive={item.items.some(({ url }) => {
                                  if (!url) return false;
                                  return isPathnameActive(url) || isPathnameActive(getBaseUrl(url));
                                })}
                                onClick={() => toggleExpanded(item.title)}
                                className={cn(
                                  "transition-all duration-300 ease-in-out",
                                  "justify-center px-0 py-2.5 m-0 h-[44px] leading-none w-full"
                                )}
                              >
                                {item.icon && (
                                  <item.icon
                                    className={cn(
                                      "shrink-0 transition-all duration-300 ease-in-out",
                                      "size-5"
                                    )}
                                    aria-hidden={true}
                                  />
                                )}

                                <span className={cn(
                                  "whitespace-nowrap transition-all duration-300 ease-in-out",
                                  "opacity-0 max-w-0 overflow-hidden"
                                )}>
                                  {item.title}
                                </span>

                                <ChevronUp
                                  className={cn(
                                    "ml-auto rotate-180 transition-all duration-300 ease-in-out",
                                    expandedItems.includes(item.title) && "rotate-0",
                                    "opacity-0 max-w-0 overflow-hidden"
                                  )}
                                  aria-hidden="true"
                                />
                              </MenuItem>
                            ) : (
                              <MenuItem
                                isActive={item.items.some(({ url }) => {
                                  if (!url) return false;
                                  return isPathnameActive(url) || isPathnameActive(getBaseUrl(url));
                                })}
                                onClick={() => toggleExpanded(item.title)}
                                className={cn(
                                  "transition-all duration-300 ease-in-out",
                                  "gap-3 py-3 px-3.5"
                                )}
                              >
                                {item.icon && (
                                  <item.icon
                                    className={cn(
                                      "shrink-0 transition-all duration-300 ease-in-out",
                                      isContentVisible ? "size-6" : "size-5"
                                    )}
                                    aria-hidden={true}
                                  />
                                )}

                                <span className={cn(
                                  "whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                                  "opacity-100 max-w-[200px]"
                                )} style={{ transitionDelay: '100ms' }}>
                                  {item.title}
                                </span>

                                <ChevronUp
                                  className={cn(
                                    "ml-auto rotate-180 transition-all duration-300 ease-in-out",
                                    expandedItems.includes(item.title) && "rotate-0",
                                    "opacity-100"
                                  )} style={{ transitionDelay: '100ms' }}
                                  aria-hidden="true"
                                />
                              </MenuItem>
                            )}

                            {expandedItems.includes(item.title) && isContentVisible && (
                              <ul
                                className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                role="menu"
                              >
                                {item.items.map((subItem) => {
                                  if (!subItem.url) return null;

                                  // Check if this is a list page (not create/edit/take)
                                  const baseUrl = getBaseUrl(subItem.url);
                                  const isListPage = !subItem.url.includes('/create') && !subItem.url.includes('/edit') && !subItem.url.includes('/take');
                                  const isCreatePage = subItem.url.includes('/create');

                                  let isActive = false;

                                  if (isCreatePage) {
                                    // Create page: only active on exact match
                                    isActive = pathname === subItem.url;
                                  } else if (isListPage) {
                                    // List page: active on exact match OR when viewing/editing an item
                                    isActive = isPathnameActive(subItem.url) || (pathname.startsWith(baseUrl + '/') && pathname !== baseUrl + '/create');
                                  } else {
                                    // Other pages (like /take): only exact match
                                    isActive = pathname === subItem.url;
                                  }

                                  return (
                                    <li key={subItem.title} role="none">
                                      <MenuItem
                                        as="link"
                                        href={subItem.url}
                                        isActive={isActive}
                                      >
                                        <span>{subItem.title}</span>
                                      </MenuItem>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </>
                        ) : (
                          (() => {
                            const href =
                              item.url || "/" + item.title.toLowerCase().split(" ").join("-");

                            // Special case: "Lịch học" menu should be active for both /calendar and /schedules
                            const isCalendarMenu = href === '/calendar';
                            const isActive = isCalendarMenu
                              ? pathname === '/calendar' || pathname === '/schedules' || pathname.startsWith('/calendar/') || pathname.startsWith('/schedules/')
                              : isDeepestMatch(href);

                            return !isContentVisible ? (
                              <MenuItem
                                className={cn(
                                  "transition-all duration-300 ease-in-out",
                                  "justify-center px-0 py-2.5 m-0 h-[44px] leading-none w-full"
                                )}
                                as="link"
                                href={href}
                                isActive={isActive}
                              >
                                {item.icon && (
                                  <item.icon
                                    className={cn(
                                      "shrink-0 transition-all duration-300 ease-in-out",
                                      "size-5"
                                    )}
                                    aria-hidden={true}
                                  />
                                )}

                                <span className={cn(
                                  "whitespace-nowrap transition-all duration-300 ease-in-out",
                                  "opacity-0 max-w-0 overflow-hidden"
                                )}>
                                  {item.title}
                                </span>
                              </MenuItem>
                            ) : (
                              <MenuItem
                                className={cn(
                                  "transition-all duration-300 ease-in-out",
                                  "gap-3 py-3 px-3.5"
                                )}
                                as="link"
                                href={href}
                                isActive={isActive}
                              >
                                {item.icon && (
                                  <item.icon
                                    className={cn(
                                      "shrink-0 transition-all duration-300 ease-in-out",
                                      "size-6"
                                    )}
                                    aria-hidden={true}
                                  />
                                )}

                                <span className={cn(
                                  "whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                                  "opacity-100 max-w-[200px]"
                                )} style={{ transitionDelay: '100ms' }}>
                                  {item.title}
                                </span>
                              </MenuItem>
                            );
                          })()
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ))}
          </div>

          {/* Version Info */}
          {isContentVisible && (
            <div className="mt-auto pt-2.5 pb-2 border-t border-gray-200 dark:border-gray-300 bg-white dark:bg-white -mx-[25px] -mr-[7px] px-[25px] pr-[7px] rounded-t-lg shadow-[0_-2px_8px_2px_rgba(0,0,0,0.008),0_-1px_4px_1px_rgba(0,0,0,0.005)] dark:shadow-[0_-2px_8px_2px_rgba(0,0,0,0.015),0_-1px_4px_1px_rgba(0,0,0,0.008)]">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-gray-600 dark:text-gray-600 text-left font-medium">
                  Phiên bản {process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500 text-left">
                  © {new Date().getFullYear()} Classly. All rights reserved.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export const Sidebar = memo(SidebarComponent);
