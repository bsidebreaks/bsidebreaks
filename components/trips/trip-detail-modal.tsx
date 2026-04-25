"use client";

import { TripCoverImage } from "@/components/trips/trip-cover-image";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/trip-recommendation";
import { cn } from "@/lib/utils";
import { MapPin, Music2, Share2, X } from "lucide-react";

type ShareHint = "idle" | "copied" | "shared";

type TripDetailModalProps = {
  trip: Recommendation;
  shareHint: ShareHint;
  onClose: () => void;
  onShare: (trip: Recommendation) => void;
};

export function TripDetailModal({
  trip,
  shareHint,
  onClose,
  onShare,
}: TripDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close trip details"
      />
      <div
        className="relative z-10 flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border/80 bg-card shadow-2xl sm:max-h-[min(92dvh,56rem)] sm:max-w-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full shrink-0 bg-muted">
          <div className="relative aspect-[21/9] min-h-44 w-full sm:min-h-52 sm:aspect-[2/1]">
            <TripCoverImage
              key={trip.image_url}
              imageUrl={trip.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              priority
            />
          </div>
          <div className="absolute right-0 top-0 flex items-center gap-1 p-3.5 pl-4 sm:p-4 sm:pl-5">
            {shareHint !== "idle" && (
              <span
                className="mr-1 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
                aria-live="polite"
              >
                {shareHint === "copied" ? "Copied" : "Shared"}
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => void onShare(trip)}
              className="size-9 rounded-full border-0 bg-background/85 text-foreground shadow-md backdrop-blur-sm"
              aria-label="Share this trip"
            >
              <Share2 className="size-[1.1rem]" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onClose}
              className="size-9 rounded-full border-0 bg-background/85 text-foreground shadow-md backdrop-blur-sm"
              aria-label="Close"
            >
              <X className="size-[1.1rem]" strokeWidth={2} />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-8 sm:pb-8 sm:pt-7">
          <h2
            id="trip-detail-title"
            className="text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-[1.6rem]"
          >
            {trip.event_name}
          </h2>
          <p className="mt-3 flex items-start gap-2.5 text-base text-muted-foreground sm:text-lg">
            <MapPin
              className="mt-0.5 size-5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            {trip.destination}
          </p>
          <div className="mt-8 space-y-8 text-base leading-relaxed sm:mt-10 sm:space-y-9">
            <section>
              <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground sm:mb-3">
                Music match
              </h3>
              <p className="flex items-start gap-3 pl-0.5 sm:text-[1.05rem]">
                <Music2
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                {trip.spotify_playlist_vibe}
              </p>
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground sm:mb-3">
                Style & budget
              </h3>
              <p className="pl-0.5 sm:text-[1.05rem]">
                {trip.category} · cost index{" "}
                <span className="font-medium text-foreground">
                  {trip.cost_index}
                </span>{" "}
                of 5
              </p>
              <div
                className="mt-3.5 flex gap-1.5"
                role="img"
                aria-label={`Cost level ${trip.cost_index} of 5`}
              >
                {Array.from({ length: 5 }, (_, j) => (
                  <span
                    key={`cost-${j}`}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      j < trip.cost_index ? "bg-foreground/70" : "bg-border"
                    )}
                  />
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground sm:mb-3">
                Why this trip
              </h3>
              <p className="text-pretty pl-0.5 text-muted-foreground sm:text-[1.05rem]">
                {trip.reasoning}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
