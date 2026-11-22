"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui";
import { cx } from "@/lib/utils";

/**
 * A horizontally scrolling row (category circles) with round arrow buttons on
 * the sides when there is more to see. Swipe, trackpad and keyboard
 * scrolling all work; the arrows are a mouse convenience.
 */
export function ScrollRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const scrollBy = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.8, behavior: "smooth" });

  const arrow =
    "bg-surface text-foreground border-border absolute top-[2.75rem] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-md md:inline-flex lg:top-[3.25rem]";

  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className={cx(
          "flex snap-x [scrollbar-width:none] gap-4 overflow-x-auto pb-1 md:gap-6 [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </ul>
      {!edges.start && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className={cx(arrow, "-left-3")}
        >
          <ChevronLeftIcon size={20} />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className={cx(arrow, "-right-3")}
        >
          <ChevronRightIcon size={20} />
        </button>
      )}
    </div>
  );
}
