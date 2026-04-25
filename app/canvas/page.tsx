"use client";

import { useState } from "react";

type Recommendation = {
  category?: string | null;
  city?: string | null;
  country?: string | null;
  event_name?: string | null;
  event_url?: string | null;
  event_date?: string | null;
  venue?: string | null;
  discovery_artist?: string | null;
  spotify_playlist_vibe?: string | null;
  reasoning?: string | null;
  flightURL?: string | null;
  image?: string | null;
};

type StoredResult = {
  user?: {
    name?: string | null;
    image?: string | null;
  };
  recommendations?: Recommendation[];
};

export default function CanvasPage() {
  const [result] = useState<StoredResult | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem("sonicWanderlustResult");
    return stored ? (JSON.parse(stored) as StoredResult) : null;
  });

  const recommendations = result?.recommendations || [];
  const user = result?.user;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user?.image && (
              <div
                role="img"
                aria-label={user.name || "User profile"}
                className="h-14 w-14 rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${user.image})` }}
              />
            )}
            <div>
              <p className="text-sm text-emerald-300">Sonic Wanderlust</p>
              <h1 className="text-3xl font-bold">
                {user?.name ? `${user.name}'s music trips` : "Music trips"}
              </h1>
            </div>
          </div>

          <button
            onClick={() => window.close()}
            className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          >
            Close
          </button>
        </header>

        {recommendations.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded border border-white/10 bg-white/5 p-8 text-center">
            <div>
              <h2 className="mb-2 text-2xl font-semibold">No recommendations yet</h2>
              <p className="text-neutral-300">
                Generate trips first, then open this canvas again.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {recommendations.map((rec, index) => (
              <article
                key={`${rec.event_name}-${index}`}
                className="overflow-hidden rounded-lg border border-white/10 bg-white text-neutral-950 shadow-2xl"
              >
                <div className="aspect-[4/3] bg-neutral-200">
                  {rec.image ? (
                    <div
                      role="img"
                      aria-label={rec.event_name || "Event"}
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${rec.image})` }}
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-emerald-100 px-6 text-center text-emerald-950">
                      <span className="text-2xl font-bold">
                        {rec.city}, {rec.country}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        {rec.category}
                      </p>
                      <h2 className="text-2xl font-bold leading-tight">
                        {rec.city}, {rec.country}
                      </h2>
                    </div>
                    <span className="rounded bg-neutral-950 px-2 py-1 text-xs text-white">
                      {rec.event_date}
                    </span>
                  </div>

                  <p className="mb-2 font-semibold">{rec.event_name}</p>
                  <p className="mb-4 text-sm text-neutral-600">
                    {rec.venue} · {rec.discovery_artist}
                  </p>

                  <div className="mb-4 rounded bg-neutral-100 p-3">
                    <p className="text-sm font-medium">{rec.spotify_playlist_vibe}</p>
                    <p className="mt-1 text-sm text-neutral-600">{rec.reasoning}</p>
                  </div>

                  <div className="flex gap-2">
                    {rec.event_url && (
                      <a
                        href={rec.event_url}
                        target="_blank"
                        className="flex-1 rounded bg-neutral-950 px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        Tickets
                      </a>
                    )}
                    {rec.flightURL && (
                      <a
                        href={rec.flightURL}
                        target="_blank"
                        className="flex-1 rounded bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        Flights
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
