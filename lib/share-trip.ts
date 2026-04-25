import type { Recommendation } from "@/lib/trip-recommendation";

function tripToText(r: Recommendation) {
  return [
    r.event_name,
    r.destination,
    "",
    `Vibe: ${r.spotify_playlist_vibe}`,
    `Style: ${r.category} · cost ${r.cost_index}/5`,
    "",
    r.reasoning,
  ].join("\n");
}

/** "none" = dismiss / failed, no toast */
export async function tryShareOrCopyTrip(
  r: Recommendation
): Promise<"shared" | "copied" | "none"> {
  const text = tripToText(r);
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({ title: r.event_name, text });
      return "shared";
    }
  } catch (e) {
    if (e && typeof e === "object" && (e as Error).name === "AbortError")
      return "none";
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* fallthrough */
  }
  return "none";
}
