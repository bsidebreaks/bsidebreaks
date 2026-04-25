import { cn } from "@/lib/utils";

export type Recommendation = {
  destination: string;
  event_name: string;
  category: string;
  cost_index: number;
  spotify_playlist_vibe: string;
  reasoning: string;
  image_url?: string;
};

export const FALLBACK_TRIP_IMAGE =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80";

export function isLikelyImageUrl(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("https://") && s.length < 2000;
}

export const tripPrimaryCta = cn(
  "h-12 w-full rounded-2xl text-[15px] font-semibold shadow-sm",
  "active:scale-[0.99] motion-safe:transition-transform"
);
