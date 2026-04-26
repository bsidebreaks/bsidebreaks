'use client';

import { useCallback, useEffect, useState } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type MusicalDNA = {
  topArtists?: Array<{ name?: string } | string>;
};

type Recommendation = {
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
};

type RecommendationResponse = {
  recommendations?: Recommendation[];
  error?: string;
};

function mapApiError(message?: string) {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('spotify session expired')) {
    return 'Your Spotify session expired. Please login again.';
  }
  return 'Could not generate trips right now. Please retry.';
}

function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query.trim()).replace(
    /%20/g,
    '+',
  )}`;
}

export default function GeneratePage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

  const generateTrips = useCallback(async () => {
    setLoading(true);
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
        body: JSON.stringify({ musicalDNA: dnaData.musicalDNA }),
      });

      const recsData = (await recsRes.json()) as RecommendationResponse;
      console.log('Recommendations API response', recsData);

      if (!recsRes.ok) {
        throw new Error(mapApiError(recsData.error));
      }

      setRecommendations((recsData.recommendations || []).slice(0, 3));
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? mapApiError(requestError.message)
          : 'Could not generate trips right now. Please retry.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

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
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const spotifyExpired = error
    ?.toLowerCase()
    .includes('spotify session expired');

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-4">
      <div className="flex w-full max-w flex-col items-center gap-8">
        <header className="w-full items-center">
        {(status === 'loading' || loading || recommendations.length == 0) ? (
           <p className="text-balance text-[2rem] font-semibold leading-snug tracking-tight text-white">Planning your trip..</p>
	) : (
           <p className="text-balance text-[2.25rem] font-bold leading-snug tracking-tight text-white">Come to {recommendations[0].country}!</p> )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Logout"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            <LogOut className="size-4" />
          </Button>
        </header>

        {(status === 'loading' || loading) && (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="size-10 animate-app-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Generating your 3 trips...
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Could not generate trips</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardFooter>
              {spotifyExpired ? (
                <Button
                  className="w-full"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
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
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No trips found</CardTitle>
              <CardDescription>
                We couldn&apos;t match any live events to your taste right now.
                Try again in a moment.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => void generateTrips()}>
                <RotateCcw className="size-4" />
                Try again
              </Button>
            </CardFooter>
          </Card>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="flex w-full flex-col items-center gap-6">
            <Carousel
              setApi={setApi}
              opts={{ align: 'start', loop: false }}
              className="w-full"
            >
              <CarouselContent>
                {recommendations.map((trip, index) => (
	          <>
                  <CarouselItem key={`${trip.event_name || 'trip'}-${index}`}>
                    <div className="grid grid-cols-3 gap-4 w-5/6">
            	      <SquircleCard
            	        content={recommendations[0].city}
            	      >
            	      </SquircleCard>
            	      <SquircleCard
            	        content={"We found you " + recommendations[0].discovery_artist}
            	      >
            	      </SquircleCard>
            	      <SquircleCard
            	        content={recommendations[0].reasoning}
            	      >
            	      </SquircleCard>
            	      <SquircleCard
            	        content={recommendations[0].venue}
            	      >
            	      </SquircleCard>
            	      <SquircleCard
            	        content={"They're playing live at " + recommendations[0].venue + " on " + recommendations[0].event_date}
            	      >
            	      </SquircleCard>
            	      <SquircleCard
            	        content={recommendations[0].flightURL ?? "There are no flights available at the moment :("}
            	      >
            	      </SquircleCard>
            	    </div>      		            
		  </CarouselItem>
		  </>
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
                  className={`h-2 rounded-full transition-all ${
                    current === index
                      ? 'w-6 bg-primary'
                      : 'w-2 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={() => void generateTrips()}
            >
              <RotateCcw className="size-4" />
              Generate again
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function SquircleCard({
  content,
}: {
    content: string;
}) {
  return (
    <>
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">{content}</CardTitle>
	</CardHeader>
      </Card>
    </>
  );
}

function TripCard({
  trip,
  index,
  total,
}: {
  trip: Recommendation;
  index: number;
  total: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const destination =
    trip.destination ||
    [trip.city, trip.country].filter(Boolean).join(', ') ||
    'Unknown destination';
  const eventName = trip.event_name || 'Live event recommendation';

  return (
    <>
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">
              {trip.category || 'Music Discovery'}
            </Badge>
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
          <CardContent className="space-y-4 text-sm">
            <p className="leading-relaxed text-muted-foreground">
              {trip.reasoning ||
                'Picked from your closest music scene match.'}
            </p>
            <div className="space-y-2.5 border-t pt-4">
              <InfoRow
                icon={<Calendar className="size-4" />}
                label={trip.event_date || 'Date TBD'}
              />
              <InfoRow
                icon={<MapPin className="size-4" />}
                label={trip.venue || 'Venue TBD'}
                href={
                  trip.venue ? googleMapsSearchUrl(trip.venue) : undefined
                }
              />
              <InfoRow
                icon={<Music className="size-4" />}
                label={trip.discovery_artist || 'Artist TBD'}
              />
              {trip.spotify_playlist_vibe && (
                <InfoRow
                  icon={<Sparkles className="size-4" />}
                  label={trip.spotify_playlist_vibe}
                />
              )}
            </div>
            <p className="text-xs font-medium text-primary/70">
              Tap for full details
            </p>
          </CardContent>
        </div>

        <CardFooter className="flex-col gap-2">
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

      <ShareSheet
        trip={trip}
        destination={destination}
        eventName={eventName}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
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
          <DialogDescription className="text-base">
            {eventName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-muted-foreground">
            {trip.reasoning ||
              'Picked from your closest music scene match.'}
          </p>

          <div className="space-y-2.5 border-t pt-4">
            <InfoRow
              icon={<Calendar className="size-4" />}
              label={trip.event_date || 'Date TBD'}
            />
            <InfoRow
              icon={<MapPin className="size-4" />}
              label={trip.venue || 'Venue TBD'}
              href={
                trip.venue ? googleMapsSearchUrl(trip.venue) : undefined
              }
            />
            <InfoRow
              icon={<Music className="size-4" />}
              label={trip.discovery_artist || 'Artist TBD'}
            />
            {trip.spotify_playlist_vibe && (
              <InfoRow
                icon={<Sparkles className="size-4" />}
                label={trip.spotify_playlist_vibe}
              />
            )}
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

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareBody
  )}`;
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
            <Button
              variant="outline"
              className="h-11 w-full justify-start gap-2"
              onClick={handleNativeShare}
            >
              <Share2 className="size-4 shrink-0" />
              Share via device
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full justify-start gap-2"
              onClick={handleCopy}
            >
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
            <Button
              asChild
              variant="outline"
              className="h-11 w-full justify-start gap-2"
            >
              <a href={twitterUrl} target="_blank" rel="noreferrer">
                <XIcon className="size-4 shrink-0" />
                Share on X
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full justify-start gap-2"
            >
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
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.243L4.8 22H2l7-7.99L2 2h6.94l4.32 5.71L18.244 2zm-2.38 18h1.84L7.27 4H5.32l10.54 16z" />
    </svg>
  );
}

function InfoRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
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
