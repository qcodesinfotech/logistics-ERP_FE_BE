import React, { useRef, useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DynamicTableScrollProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  topBarClassName?: string;
  bottomBarClassName?: string;
}

export function DynamicTableScroll({
  children,
  className,
  containerClassName,
  topBarClassName,
  bottomBarClassName,
}: DynamicTableScrollProps) {
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Active source tracker to avoid infinite scroll loop
  const activeSourceRef = useRef<"table" | "top" | "bottom" | null>(null);
  const timeoutRef = useRef<any>(null);

  const updateScrollButtons = useCallback((sl: number, cw: number, sw: number) => {
    setCanScrollLeft(sl > 4);
    setCanScrollRight(sl + cw < sw - 4);
  }, []);

  const updateDimensions = useCallback(() => {
    if (!tableScrollRef.current) return;
    const sw = tableScrollRef.current.scrollWidth;
    const cw = tableScrollRef.current.clientWidth;
    const sl = tableScrollRef.current.scrollLeft;

    setScrollWidth(sw);
    setClientWidth(cw);
    setHasOverflow(sw > cw + 4);
    updateScrollButtons(sl, cw, sw);
  }, [updateScrollButtons]);

  useEffect(() => {
    updateDimensions();
    const el = tableScrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(el);

    // Observe table element if present
    const tableEl = el.querySelector("table");
    if (tableEl) {
      observer.observe(tableEl);
    }

    window.addEventListener("resize", updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [updateDimensions, children]);

  // Table scroll handler
  const handleTableScroll = () => {
    if (!tableScrollRef.current) return;
    const sl = tableScrollRef.current.scrollLeft;
    const cw = tableScrollRef.current.clientWidth;
    const sw = tableScrollRef.current.scrollWidth;
    updateScrollButtons(sl, cw, sw);

    if (activeSourceRef.current && activeSourceRef.current !== "table") return;
    activeSourceRef.current = "table";

    if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - sl) > 1) {
      topScrollRef.current.scrollLeft = sl;
    }
    if (bottomScrollRef.current && Math.abs(bottomScrollRef.current.scrollLeft - sl) > 1) {
      bottomScrollRef.current.scrollLeft = sl;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      activeSourceRef.current = null;
    }, 80);
  };

  // Top scroll handler
  const handleTopScroll = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    const sl = topScrollRef.current.scrollLeft;
    const cw = tableScrollRef.current.clientWidth;
    const sw = tableScrollRef.current.scrollWidth;
    updateScrollButtons(sl, cw, sw);

    if (activeSourceRef.current && activeSourceRef.current !== "top") return;
    activeSourceRef.current = "top";

    if (tableScrollRef.current && Math.abs(tableScrollRef.current.scrollLeft - sl) > 1) {
      tableScrollRef.current.scrollLeft = sl;
    }
    if (bottomScrollRef.current && Math.abs(bottomScrollRef.current.scrollLeft - sl) > 1) {
      bottomScrollRef.current.scrollLeft = sl;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      activeSourceRef.current = null;
    }, 80);
  };

  // Bottom scroll handler
  const handleBottomScroll = () => {
    if (!bottomScrollRef.current || !tableScrollRef.current) return;
    const sl = bottomScrollRef.current.scrollLeft;
    const cw = tableScrollRef.current.clientWidth;
    const sw = tableScrollRef.current.scrollWidth;
    updateScrollButtons(sl, cw, sw);

    if (activeSourceRef.current && activeSourceRef.current !== "bottom") return;
    activeSourceRef.current = "bottom";

    if (tableScrollRef.current && Math.abs(tableScrollRef.current.scrollLeft - sl) > 1) {
      tableScrollRef.current.scrollLeft = sl;
    }
    if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - sl) > 1) {
      topScrollRef.current.scrollLeft = sl;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      activeSourceRef.current = null;
    }, 80);
  };

  const scrollByAmount = (amount: number) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className={cn("relative w-full", containerClassName)}>
      {/* ===== TOP SCROLLBAR ===== */}
      {hasOverflow && (
        <div
          className={cn(
            "bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3 py-1 flex items-center gap-2 select-none text-xs",
            topBarClassName
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
            <ArrowLeftRight className="h-3 w-3 text-primary/70" />
            <span className="hidden sm:inline">Horizontal Scroll</span>
          </div>

          <button
            type="button"
            onClick={() => scrollByAmount(-300)}
            disabled={!canScrollLeft}
            className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs text-slate-700 dark:text-slate-200 flex-shrink-0"
            title="Scroll left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="flex-1 overflow-x-auto overflow-y-hidden custom-horizontal-scrollbar py-1"
          >
            <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
          </div>

          <button
            type="button"
            onClick={() => scrollByAmount(300)}
            disabled={!canScrollRight}
            className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs text-slate-700 dark:text-slate-200 flex-shrink-0"
            title="Scroll right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ===== MAIN TABLE CONTAINER ===== */}
      <div
        ref={tableScrollRef}
        onScroll={handleTableScroll}
        className={cn(
          "w-full overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          className
        )}
      >
        {children}
      </div>

      {/* ===== DYNAMIC STICKY BOTTOM SCROLLBAR ===== */}
      {hasOverflow && (
        <div
          className={cn(
            "sticky bottom-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center gap-2 shadow-md select-none rounded-b-xl",
            bottomBarClassName
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
            <ArrowLeftRight className="h-3 w-3 text-primary/70" />
            <span className="hidden sm:inline">Horizontal Scroll</span>
          </div>

          <button
            type="button"
            onClick={() => scrollByAmount(-300)}
            disabled={!canScrollLeft}
            className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs text-slate-700 dark:text-slate-200 flex-shrink-0"
            title="Scroll left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div
            ref={bottomScrollRef}
            onScroll={handleBottomScroll}
            className="flex-1 overflow-x-auto overflow-y-hidden custom-horizontal-scrollbar py-1"
          >
            <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
          </div>

          <button
            type="button"
            onClick={() => scrollByAmount(300)}
            disabled={!canScrollRight}
            className="h-6 w-6 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs text-slate-700 dark:text-slate-200 flex-shrink-0"
            title="Scroll right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
