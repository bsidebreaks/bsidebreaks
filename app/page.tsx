"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

type JsonObject = Record<string, unknown>;

type SpotifyTopResponse = {
  musicalDNA: JsonObject;
};

type ApiResponse = JsonObject & {
  error?: string;
};

export default function Home() {
  const { data: session } = useSession();

  const [dna, setDna] = useState<JsonObject | null>(null);
  const [ticketmaster, setTicketmaster] = useState<JsonObject | null>(null);
  const [result, setResult] = useState<JsonObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🎧 Cargar ADN musical
  const loadDNA = async () => {
    setError(null);

    try {
      const res = await fetch("/api/spotify/top");
      const data = (await res.json()) as SpotifyTopResponse;
      setDna(data.musicalDNA);
      setTicketmaster(null);
    } catch {
      setError("Error loading Spotify data");
    }
  };

  // 🌍 Generar viajes
  const generateTrips = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          musicalDNA: dna
        })
      });

      const data = (await res.json()) as ApiResponse;

      // 🔥 Manejo de errores backend
      if (!res.ok) {
        setResult(data);

        // error IA saturada
        if (data?.error?.includes("high demand") || data?.error?.includes("UNAVAILABLE")) {
          setError("AI is overloaded right now. Try again in a few seconds.");
        } else {
          setError(data?.error || "Unknown error from API");
        }
      } else {
        setResult(data);
      }

    } catch {
      setError("Network error. Check connection.");
    }

    setLoading(false);
  };

  const aiTasteProfile = result?.tasteProfile as JsonObject | undefined;
  const aiTicketmasterEvents = result?.ticketmasterEventSearch as JsonObject | undefined;
  const aiRecommendations = result?.recommendations as unknown[] | undefined;

  return (
    <main className="min-h-screen p-8">

      <h1 className="text-3xl font-bold mb-6">
        Sonic Wanderlust 🌍
      </h1>

      {/* LOGIN */}
      {!session ? (
        <button
          onClick={() => signIn("spotify")}
          className="bg-green-600 text-white px-6 py-3 rounded-xl"
        >
          Login with Spotify
        </button>
      ) : (
        <>
          {/* ACTIONS */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={() => signOut()}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Logout
            </button>

            <button
              onClick={loadDNA}
              className="bg-black text-white px-4 py-2 rounded"
            >
              Load Music DNA
            </button>

            <button
              onClick={generateTrips}
              className="bg-blue-600 text-white px-4 py-2 rounded"
              disabled={!dna || loading}
            >
              Generate Trips
            </button>
          </div>

          {/* ⏳ LOADING */}
          {loading && (
            <p className="mb-4 text-blue-600 font-semibold">
              Loading AI recommendations...
            </p>
          )}

          {/* ❌ ERROR */}
          {error && (
            <p className="mb-4 text-red-600 font-semibold">
              {error}
            </p>
          )}

          {/* 🧠 RAW MUSICAL DNA */}
          {dna && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Spotify Musical DNA (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(dna, null, 2)}
              </pre>
            </div>
          )}

          {/* TICKETMASTER RAW RESPONSE */}
          {ticketmaster && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Ticketmaster Attractions (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(ticketmaster, null, 2)}
              </pre>
            </div>
          )}

          {/* 🤖 RAW AI RESPONSE */}
          {aiTasteProfile && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                AI Taste Profile (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(aiTasteProfile, null, 2)}
              </pre>
            </div>
          )}

          {aiTicketmasterEvents && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Ticketmaster Event Search (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(aiTicketmasterEvents, null, 2)}
              </pre>
            </div>
          )}

          {aiRecommendations && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Final Travel Recommendations (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(aiRecommendations, null, 2)}
              </pre>
            </div>
          )}

          {result && (
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Full Generate Trips Response (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}

    </main>
  );
}
