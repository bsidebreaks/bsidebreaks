"use client";

import { SpotifyMark } from "@/components/icons/spotify-icon";
import { TripsCarousel } from "@/components/trips/trips-carousel";
import { TripDetailModal } from "@/components/trips/trip-detail-modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRecommendationFlow } from "@/hooks/use-recommendation-flow";
import { tripPrimaryCta } from "@/lib/trip-recommendation";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { signOut } from "next-auth/react";

export default function Home() {
  const {
    sessionPending,
    spotifyReady,
    hasSessionNoSpotify,
    authBusy,
    authError,
    loading,
    recommendations,
    error,
    recSlide,
    setRecSlide,
    setExpandedIndex,
    shareHint,
    runRecommendations,
    loginWithSpotify,
    shareTrip,
    openTrip,
  } = useRecommendationFlow();

  const hasTripCards = spotifyReady && recommendations.length > 0;
  const centerAuthBlock = !hasTripCards;

  return (
    <div
      className={cn(
        "mx-auto flex min-h-svh w-full max-w-sm flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]",
        hasTripCards ? "gap-6" : "gap-0"
      )}
    >
      {centerAuthBlock ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex w-full max-w-[min(100%,20rem)] flex-col items-center gap-6">
            <div className="space-y-2">
              <h1 className="text-balance text-[1.5rem] font-semibold leading-snug tracking-tight">
                Trips for your mixtape
              </h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                {spotifyReady
                  ? "Building trip ideas from your recent listens…"
                  : "Connect Spotify — we turn your taste into three trip ideas."}
              </p>
            </div>

            {!spotifyReady ? (
              <div className="flex w-full flex-col items-stretch gap-2">
                {hasSessionNoSpotify && (
                  <p
                    className="text-pretty text-sm text-muted-foreground"
                    role="status"
                  >
                    This session doesn’t have Spotify access. Sign in with
                    Spotify, or sign out to start over.
                  </p>
                )}
                <Button
                  type="button"
                  onClick={() => void loginWithSpotify()}
                  disabled={authBusy || sessionPending}
                  className={cn(
                    tripPrimaryCta,
                    "gap-2.5 border-0 bg-[#1DB954] text-white shadow-md shadow-emerald-950/15 hover:bg-[#1ed760] disabled:opacity-60"
                  )}
                >
                  {authBusy || sessionPending ? (
                    <>
                      <Spinner className="!size-5" />
                      {sessionPending ? "Checking your session…" : "Connecting…"}
                    </>
                  ) : (
                    <>
                      <SpotifyMark className="size-6 text-white" />
                      Login with Spotify
                    </>
                  )}
                </Button>
                {hasSessionNoSpotify && (
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="w-full py-1.5 text-center text-sm text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 active:opacity-70"
                  >
                    Sign out
                  </button>
                )}
                {authError && (
                  <p
                    className="text-pretty text-sm text-destructive"
                    role="alert"
                  >
                    {authError}
                  </p>
                )}
              </div>
            ) : (
              loading && (
                <div
                  className="flex h-12 w-full max-w-sm items-center justify-center gap-2.5 rounded-2xl border border-border/60 bg-muted/30 px-4 text-[15px] font-medium text-muted-foreground"
                  aria-live="polite"
                >
                  <Spinner className="!size-5 shrink-0" />
                  <span>Syncing your taste…</span>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h1 className="text-balance text-[1.5rem] font-semibold leading-snug tracking-tight">
            Trips for your mixtape
          </h1>
          <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Building trip ideas from your recent listens…
          </p>
        </div>
      )}

      {error && spotifyReady && (
        <div className="space-y-2">
          <p className="text-pretty text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void runRecommendations()}
            className="w-full rounded-2xl"
            disabled={loading}
          >
            Try again
          </Button>
        </div>
      )}

      {spotifyReady && (
        <div
          className={cn(
            "w-full",
            hasTripCards && "flex flex-col items-center"
          )}
        >
          <TripsCarousel
            recommendations={recommendations}
            recSlide={recSlide}
            onSlideChange={setRecSlide}
            onSelectTrip={setExpandedIndex}
          />
          {hasTripCards && (
            <div className="mt-7 flex w-full justify-center sm:mt-8">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runRecommendations()}
                disabled={loading}
                className="h-12 w-12 shrink-0 rounded-full sm:h-14 sm:w-14"
                title="Regenerate trip ideas"
                aria-label="Regenerate trip ideas"
              >
                {loading ? (
                  <Spinner className="!size-5 sm:!size-6" />
                ) : (
                  <RefreshCw
                    className="!size-6 sm:!size-7"
                    strokeWidth={2}
                  />
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {openTrip && (
        <TripDetailModal
          trip={openTrip}
          shareHint={shareHint}
          onClose={() => setExpandedIndex(null)}
          onShare={shareTrip}
        />
      )}

      {spotifyReady && (
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="mt-auto w-full py-2 text-center text-sm text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 active:opacity-70"
        >
          Sign out
        </button>
      )}
    </div>
  );
}