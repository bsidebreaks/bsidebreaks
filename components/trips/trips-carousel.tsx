"use client";

import { TripCoverImage } from "@/components/trips/trip-cover-image";
import type { Recommendation } from "@/lib/trip-recommendation";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef } from "react";

type TripsCarouselProps = {
  recommendations: Recommendation[];
  recSlide: number;
  onSlideChange: (index: number) => void;
  onSelectTrip: (index: number) => void;
};

const SCROLLER_HIDE = cn(
  "overflow-y-hidden overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none]",
  "[&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
);

function SlideCard({
  r,
  i,
  active,
  isPriorityImage,
  onSelectTrip,
}: {
  r: Recommendation;
  i: number;
  active: boolean;
  isPriorityImage: boolean;
  onSelectTrip: (index: number) => void;
}) {
  const pointer = useRef({ allowOpen: true, x: 0, y: 0 });

  return (
    <div
      className="w-full min-w-0 flex-[0_0_100%] snap-center"
      aria-hidden={!active}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(e) => {
          pointer.current = { allowOpen: true, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) return;
          if (Math.abs(e.movementX) > 6 || Math.abs(e.movementY) > 6) {
            pointer.current.allowOpen = false;
          }
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const s = pointer.current;
          if (
            Math.abs(e.clientX - s.x) > 10 ||
            Math.abs(e.clientY - s.y) > 10
          ) {
            s.allowOpen = false;
          }
          if (s.allowOpen) onSelectTrip(i);
        }}
        onPointerCancel={() => {
          pointer.current.allowOpen = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectTrip(i);
          }
        }}
        className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-label={`View details: ${r.event_name}`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-[3/2]">
          <TripCoverImage
            key={`${i}-${r.image_url ?? "x"}`}
            imageUrl={r.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            priority={isPriorityImage}
          />
        </div>
        <div className="space-y-3 px-5 py-4 text-[15px] leading-relaxed sm:px-6 sm:py-5">
          <div className="space-y-1.5">
            <p className="text-[1.1rem] font-semibold leading-tight sm:text-[1.15rem]">
              {r.event_name}
            </p>
            <p className="text-base text-muted-foreground">{r.destination}</p>
          </div>
          <p className="pt-0.5">
            <span className="text-muted-foreground">Vibe: </span>
            {r.spotify_playlist_vibe}
          </p>
          <p>
            <span className="text-muted-foreground">Style: </span>
            {r.category} · cost {r.cost_index}/5
          </p>
          <p className="line-clamp-4 text-[15px] leading-snug text-muted-foreground">
            {r.reasoning}
          </p>
          <p className="pt-1 text-xs text-muted-foreground/80">
            Tap for full details
          </p>
        </div>
      </div>
    </div>
  );
}

export function TripsCarousel({
  recommendations,
  recSlide,
  onSlideChange,
  onSelectTrip,
}: TripsCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const onSlideChangeRef = useRef(onSlideChange);
  const recSlideRef = useRef(recSlide);
  const rafId = useRef<number | null>(null);

  onSlideChangeRef.current = onSlideChange;
  recSlideRef.current = recSlide;

  const syncIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w < 1) return;
    const max = Math.max(0, recommendations.length - 1);
    const idx = Math.max(
      0,
      Math.min(max, Math.round(el.scrollLeft / w))
    );
    if (idx !== recSlideRef.current) {
      onSlideChangeRef.current(idx);
    }
  }, [recommendations.length]);

  const onScrollRaf = useCallback(() => {
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      syncIndexFromScroll();
    });
  }, [syncIndexFromScroll]);

  useEffect(
    () => () => {
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w < 1) return;
      const idx = recSlideRef.current;
      const target = Math.min(idx, recommendations.length - 1) * w;
      if (Math.abs(el.scrollLeft - target) > 1) {
        el.scrollTo({ left: target, behavior: "auto" });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [recommendations.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w < 1) return;
    const target = Math.min(recSlide, recommendations.length - 1) * w;
    if (Math.abs(el.scrollLeft - target) > 2) {
      el.scrollTo({ left: target, behavior: "auto" });
    }
  }, [recSlide, recommendations.length]);

  const goToIndex = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: i * w, behavior: "auto" });
    onSlideChange(i);
  };

  if (recommendations.length === 0) return null;

  return (
    <div
      className="w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label="Trip recommendations"
    >
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div
          ref={scrollerRef}
          onScroll={onScrollRaf}
          onScrollEnd={syncIndexFromScroll}
          className={cn(
            "flex w-full touch-pan-x snap-x snap-mandatory",
            SCROLLER_HIDE
          )}
          style={{ WebkitOverflowScrolling: "touch" as const }}
        >
          {recommendations.map((r, i) => (
            <SlideCard
              key={i}
              r={r}
              i={i}
              active={recSlide === i}
              isPriorityImage={i === 0}
              onSelectTrip={onSelectTrip}
            />
          ))}
        </div>
      </div>
      <div
        className="mt-5 flex justify-center gap-2.5 sm:mt-6"
        role="tablist"
        aria-label="Choose a recommendation"
      >
        {recommendations.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={recSlide === i}
            aria-label={`Trip ${i + 1} of ${recommendations.length}`}
            onClick={() => goToIndex(i)}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              recSlide === i
                ? "bg-foreground"
                : "bg-foreground/20 hover:bg-foreground/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}
