'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Music,
  Plane,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type MusicalDNA = {
  topArtists?: Array<{ name?: string } | string>;
};

type Recommendation = {
  event_id?: string;
  destination?: string;
  city?: string;
  country?: string;
  event_name?: string;
  event_date?: string;
  venue?: string;
  discovery_artist?: string;
  category?: string;
  spotify_playlist_vibe?: string;
  reasoning?: string;
  event_url?: string;
  flightURL?: string | null;
  location_photo?: string | null;
  image?: string | null;
};

type RecommendationResponse = {
  recommendations?: Recommendation[];
  error?: string;
};

const SEEN_EVENT_IDS_KEY = 'bsidebreaks.seenEventIds';

function mapApiError(message?: string) {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('spotify session expired')) {
    return 'Your Spotify session expired. Please login again.';
  }
  return 'Could not generate trips right now. Please retry.';
}

function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query.trim()).replace(/%20/g, '+')}`;
}

function heroImageUrl(t: Recommendation) {
  return (t.location_photo || t.image || '').trim() || null;
}

function readSeenEventIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const value = window.sessionStorage.getItem(SEEN_EVENT_IDS_KEY);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberSeenEventIds(recommendations: Recommendation[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextIds = [
    ...readSeenEventIds(),
    ...recommendations.map((recommendation) => recommendation.event_id).filter((id): id is string => Boolean(id)),
  ];
  const uniqueIds = [...new Set(nextIds)].slice(-60);

  window.sessionStorage.setItem(SEEN_EVENT_IDS_KEY, JSON.stringify(uniqueIds));
}

function readSeenEventIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const value = window.sessionStorage.getItem(SEEN_EVENT_IDS_KEY);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberSeenEventIds(recommendations: Recommendation[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextIds = [
    ...readSeenEventIds(),
    ...recommendations.map((recommendation) => recommendation.event_id).filter((id): id is string => Boolean(id)),
  ];
  const uniqueIds = [...new Set(nextIds)].slice(-60);

  window.sessionStorage.setItem(SEEN_EVENT_IDS_KEY, JSON.stringify(uniqueIds));
}

/** Resolves when the browser has fetched the image (avoids `background-image` painting black until decode). */
function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

const TRIP_GEN_STEP_MS = 10_000;
const LAST_STEP_INDEX = 3;
/** Last bar: rises slowly and never reaches 100% (asymptote below `FINAL_BAR_CAP`). */
const FINAL_BAR_ASYMPTOTE_MS = 28_000;
const FINAL_BAR_CAP = 97;

const TRIP_GEN_STEPS = [
  {
    shortLabel: 'Taste Discovery',
    caption: 'Scraping data about your listening habits and creating a taste profile.',
  },
  {
    shortLabel: 'Genre Matching',
    caption: 'Determining genres that match your taste and creating a genre profile.',
  },
  {
    shortLabel: 'Finding Events',
    caption: 'Searching for events that match your genre profile.',
  },
  {
    shortLabel: 'Tailoring matches',
    caption: 'Using Gemma to perfect the matches to your taste.',
  },
] as const;

function TripGenerationStepBars({ startedAt }: { startedAt: number | null }) {
  const monotonicValueRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

  useEffect(() => {
    monotonicValueRef.current = [0, 0, 0, 0];
  }, [startedAt]);

  const elapsedMs = startedAt != null ? Math.max(0, Date.now() - startedAt) : 0;
  const stepIndex = Math.min(TRIP_GEN_STEPS.length - 1, Math.floor(elapsedMs / TRIP_GEN_STEP_MS));
  const inStepT = (elapsedMs % TRIP_GEN_STEP_MS) / TRIP_GEN_STEP_MS;
  const elapsedOnFinalStep = Math.max(0, elapsedMs - LAST_STEP_INDEX * TRIP_GEN_STEP_MS);
  const step = TRIP_GEN_STEPS[stepIndex];
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="space-y-1.5 text-center">
        <p className="text-sm font-medium text-foreground">Tailoring your trips to your taste.</p>
        <p className="text-xs text-muted-foreground transition-[opacity,transform] duration-300" key={stepIndex}>
          <span className="text-foreground/90">
            Step {stepIndex + 1} of 4 · {step.shortLabel}
          </span>
          <span> — {step.caption}</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {TRIP_GEN_STEPS.map((step, i) => {
          let next: number;
          if (i < stepIndex) next = 100;
          else if (i > stepIndex) next = 0;
          else if (i === LAST_STEP_INDEX) {
            next = Math.round(FINAL_BAR_CAP * (1 - 1 / (1 + elapsedOnFinalStep / FINAL_BAR_ASYMPTOTE_MS)));
          } else {
            next = Math.min(100, Math.round(inStepT * 100));
          }
          const m = monotonicValueRef.current;
          let value: number;
          if (i > stepIndex) {
            value = 0;
          } else {
            m[i] = Math.max(m[i], next);
            value = m[i];
          }
          return (
            <div key={step.shortLabel} className="flex min-w-0 flex-col items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="w-full min-w-0 touch-manipulation text-left" aria-label={step.caption}>
                    <Progress value={value} className="h-2.5 w-full bg-muted/80" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-left max-w-[min(90vw,18rem)]">
                  {step.caption}
                </TooltipContent>
              </Tooltip>
              <span className="w-full truncate text-center text-[10px] font-medium text-muted-foreground" title={step.shortLabel}>
                {step.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [, setGenerationTick] = useState(0);
  const generationInFlightRef = useRef(0);
  const generationAnchorMsRef = useRef<number | null>(null);

  const generateTrips = useCallback(async () => {
    setLoading(true);
    generationInFlightRef.current += 1;
    if (generationAnchorMsRef.current == null) {
      const t = Date.now();
      generationAnchorMsRef.current = t;
      setGenerationStartedAt(t);
    } else {
      setGenerationStartedAt(generationAnchorMsRef.current);
    }
    setError(null);
    setRecommendations([]);

    try {
      const dnaRes = await fetch('/api/spotify/top');
      const dnaData = (await dnaRes.json()) as {
        musicalDNA?: MusicalDNA;
        error?: string;
      };

      if (!dnaRes.ok || !dnaData.musicalDNA) {
        throw new Error(dnaData.error || 'Could not load Spotify profile.');
      }

      const recsRes = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicalDNA: dnaData.musicalDNA,
          excludedEventIds: readSeenEventIds(),
        }),
      });

      const recsData = (await recsRes.json()) as RecommendationResponse;

      if (!recsRes.ok) {
        throw new Error(mapApiError(recsData.error));
      }

      const recs = (recsData.recommendations || []).slice(0, 3);
      const heroUrls = [...new Set(recs.map(heroImageUrl).filter((u): u is string => Boolean(u)))];
      if (heroUrls.length) {
        await Promise.all(heroUrls.map(preloadImage));
      }
      rememberSeenEventIds(recs);
      setCurrent(0);
      setRecommendations(recs);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? mapApiError(requestError.message) : 'Could not generate trips right now. Please retry.';
      setError(message);
    } finally {
      setLoading(false);
      generationInFlightRef.current = Math.max(0, generationInFlightRef.current - 1);
      if (generationInFlightRef.current === 0) {
        generationAnchorMsRef.current = null;
        setGenerationStartedAt(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading || generationStartedAt == null) return;
    const id = window.setInterval(() => {
      setGenerationTick((n) => n + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [loading, generationStartedAt]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
      return;
    }
    if (status === 'authenticated') {
      const timer = window.setTimeout(() => {
        void generateTrips();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [generateTrips, router, status]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    const timer = window.setTimeout(onSelect, 0);
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      window.clearTimeout(timer);
      api.off('select', onSelect);
    };
  }, [api]);

  const spotifyExpired = error?.toLowerCase().includes('spotify session expired');

  const showTrips = !loading && !error && recommendations.length > 0;
  const trip = showTrips ? recommendations[Math.min(current, recommendations.length - 1)] : undefined;
  const heroUrl = trip ? heroImageUrl(trip) : null;

  return (
    <main
      className={`relative flex min-h-svh w-full flex-col items-center overflow-x-hidden px-4 py-10 sm:py-14${
        showTrips && !heroUrl ? ' bg-zinc-950' : ''
      }`}
    >
      {showTrips && heroUrl && (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-zinc-950 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heroUrl})` }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-b from-black/65 via-black/35 to-black/88"
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <header className="flex w-full items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your trips</h1>
            <p className="text-sm text-muted-foreground text-olive-200">Picked from your Spotify taste</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white/80"
            aria-label="Logout"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        {status === 'loading' && (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="size-10 animate-app-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading session…</p>
            </CardContent>
          </Card>
        )}

        {status === 'authenticated' && loading && (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center justify-center gap-5 py-12">
              <TripGenerationStepBars startedAt={generationStartedAt} />
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="w-full border-zinc-800/90 bg-zinc-950 text-zinc-50 shadow-lg">
            <CardHeader>
              <CardTitle className="font-semibold text-white">Could not generate trips</CardTitle>
              <CardDescription className="text-zinc-400">{error}</CardDescription>
            </CardHeader>
            <CardFooter className="border-t border-zinc-800/80 bg-zinc-900/40">
              {spotifyExpired ? (
                <Button className="w-full" onClick={() => signOut({ callbackUrl: '/' })}>
                  <LogIn className="size-4" />
                  Reconnect Spotify
                </Button>
              ) : (
                <Button className="w-full" onClick={() => void generateTrips()}>
                  <RotateCcw className="size-4" />
                  Try again
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <Card className="w-full border-zinc-800/90 bg-zinc-950 text-zinc-50 shadow-lg">
            <CardHeader>
              <CardTitle className="font-semibold text-white">No trips found</CardTitle>
              <CardDescription className="text-zinc-400">
                We couldn&apos;t match any live events to your taste right now. Try again in a moment.
              </CardDescription>
            </CardHeader>
            <CardFooter className="border-t border-zinc-800/80 bg-zinc-900/40">
              <Button className="w-full" onClick={() => void generateTrips()}>
                <RotateCcw className="size-4" />
                Try again
              </Button>
            </CardFooter>
          </Card>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="flex w-full flex-col items-center gap-6">
            <Carousel setApi={setApi} opts={{ align: 'start', loop: false }} className="w-full">
              <CarouselContent>
                {recommendations.map((trip, index) => (
                  <CarouselItem key={`${trip.event_url ?? trip.event_name ?? 'trip'}-${index}`}>
                    <TripCard trip={trip} index={index} total={recommendations.length} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="flex items-center gap-2">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => api?.scrollTo(index)}
                  className={`h-2 rounded-full transition-all ${current === index ? 'w-6 bg-primary' : 'w-2 bg-white/50 hover:bg-white/70'}`}
                />
              ))}
            </div>

            <Button variant="outline" size="lg" className="rounded-full" onClick={() => void generateTrips()}>
              <RotateCcw className="size-4" />
              Generate again
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function TripCard({ trip, index, total }: { trip: Recommendation; index: number; total: number }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const destination = [trip.city, trip.country].filter(Boolean).join(', ') || 'Unknown destination';
  const eventName = trip.event_name || 'Live event recommendation';
  const coverUrl = heroImageUrl(trip);

  return (
    <>
      <Card className="w-full gap-0 overflow-hidden p-0">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="aspect-[16/10] w-full shrink-0 object-cover" loading="eager" decoding="async" />
        ) : (
          <div className="aspect-[16/10] w-full shrink-0 bg-muted" aria-hidden />
        )}

        <CardHeader className={cn('space-y-3 px-6', coverUrl ? 'pt-5' : 'pt-6')}>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{trip.category || 'Music Discovery'}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {index + 1} / {total}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Share trip"
                onClick={(event) => {
                  event.stopPropagation();
                  setShareOpen(true);
                }}
                className="size-8"
              >
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-2xl">{destination}</CardTitle>
          <CardDescription className="text-base">{eventName}</CardDescription>
        </CardHeader>

        <div
          tabIndex={0}
          onClick={() => setDetailsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailsOpen(true);
            }
          }}
          className="block w-full cursor-pointer text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View full trip details"
        >
          <CardContent className="space-y-4 px-6 text-sm">
            <p className="leading-relaxed text-muted-foreground">{trip.reasoning || 'Picked from your closest music scene match.'}</p>
            <div className="space-y-2.5 border-t pt-4">
              <InfoRow icon={<Calendar className="size-4" />} label={trip.event_date || 'Date TBD'} />
              <InfoRow
                icon={<MapPin className="size-4" />}
                label={trip.venue || 'Venue TBD'}
                href={trip.venue ? googleMapsSearchUrl(trip.venue) : undefined}
              />
              <InfoRow icon={<Music className="size-4" />} label={trip.discovery_artist || 'Artist TBD'} />
              {trip.spotify_playlist_vibe && <InfoRow icon={<Sparkles className="size-4" />} label={trip.spotify_playlist_vibe} />}
            </div>
            <p className="text-xs font-medium text-primary/70">Tap for full details</p>
          </CardContent>
        </div>

        <CardFooter className="flex-col gap-2 px-6 pb-6">
          {trip.event_url && (
            <Button asChild className="w-full">
              <a href={trip.event_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                View event
              </a>
            </Button>
          )}
          {trip.flightURL && (
            <Button asChild variant="outline" className="w-full">
              <a href={trip.flightURL} target="_blank" rel="noreferrer">
                <Plane className="size-4" />
                Find flights
              </a>
            </Button>
          )}
        </CardFooter>
      </Card>

      <TripDetailsDialog
        trip={trip}
        destination={destination}
        eventName={eventName}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <ShareSheet trip={trip} destination={destination} eventName={eventName} open={shareOpen} onOpenChange={setShareOpen} />
    </>
  );
}

function TripDetailsDialog({
  trip,
  destination,
  eventName,
  open,
  onOpenChange,
}: {
  trip: Recommendation;
  destination: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <Badge variant="secondary" className="self-start">
            {trip.category || 'Music Discovery'}
          </Badge>
          <DialogTitle className="pt-2 text-2xl">{destination}</DialogTitle>
          <DialogDescription className="text-base">{eventName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-muted-foreground">{trip.reasoning || 'Picked from your closest music scene match.'}</p>

          <div className="space-y-2.5 border-t pt-4">
            <InfoRow icon={<Calendar className="size-4" />} label={trip.event_date || 'Date TBD'} />
            <InfoRow
              icon={<MapPin className="size-4" />}
              label={trip.venue || 'Venue TBD'}
              href={trip.venue ? googleMapsSearchUrl(trip.venue) : undefined}
            />
            <InfoRow icon={<Music className="size-4" />} label={trip.discovery_artist || 'Artist TBD'} />
            {trip.spotify_playlist_vibe && <InfoRow icon={<Sparkles className="size-4" />} label={trip.spotify_playlist_vibe} />}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {trip.event_url && (
            <Button asChild className="w-full">
              <a href={trip.event_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                View event
              </a>
            </Button>
          )}
          {trip.flightURL && (
            <Button asChild variant="outline" className="w-full">
              <a href={trip.flightURL} target="_blank" rel="noreferrer">
                <Plane className="size-4" />
                Find flights
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareSheet({
  trip,
  destination,
  eventName,
  open,
  onOpenChange,
}: {
  trip: Recommendation;
  destination: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  const shareText = `Check out this trip: ${eventName} in ${destination}. Found via Spotify Trip Recommender.`;
  const shareUrl = trip.event_url || '';
  const shareBody = shareUrl ? `${shareText}\n${shareUrl}` : shareText;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !('share' in navigator)) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `${eventName} — ${destination}`,
        text: shareText,
        url: shareUrl || undefined,
      });
      onOpenChange(false);
    } catch {
      // user cancelled — no-op
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareBody)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareBody)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <div className="mx-auto w-full max-w-sm p-4 pb-8">
          <SheetHeader className="p-0 pr-10">
            <SheetTitle>Share trip</SheetTitle>
            <SheetDescription>
              {eventName} — {destination}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 grid gap-2">
            <Button variant="outline" className="h-11 w-full justify-start gap-2" onClick={handleNativeShare}>
              <Share2 className="size-4 shrink-0" />
              Share via device
            </Button>
            <Button variant="outline" className="h-11 w-full justify-start gap-2" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="size-4 shrink-0" />
                  Link copied
                </>
              ) : (
                <>
                  <Copy className="size-4 shrink-0" />
                  Copy link
                </>
              )}
            </Button>
            <Button asChild variant="outline" className="h-11 w-full justify-start gap-2">
              <a href={twitterUrl} target="_blank" rel="noreferrer">
                <XIcon className="size-4 shrink-0" />
                Share on X
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full justify-start gap-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4 shrink-0" />
                Share on WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.243L4.8 22H2l7-7.99L2 2h6.94l4.32 5.71L18.244 2zm-2.38 18h1.84L7.27 4H5.32l10.54 16z" />
    </svg>
  );
}

function InfoRow({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const text = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-sm text-primary underline-offset-2 hover:underline"
    >
      {label}
    </a>
  ) : (
    <span className="text-sm">{label}</span>
  );

  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="text-foreground/70">{icon}</span>
      {text}
    </div>
  );
}
