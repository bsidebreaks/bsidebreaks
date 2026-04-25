"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const { data: session } = useSession();

  const [dna, setDna] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🎧 Cargar ADN musical
  const loadDNA = async () => {
    setError(null);

    try {
      const res = await fetch("/api/spotify/top");
      const data = await res.json();
      setDna(data);
    } catch (err) {
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

      const data = await res.json();

      // 🔥 Manejo de errores backend
      if (!res.ok) {
        // error IA saturada
        if (data?.error?.includes("high demand") || data?.error?.includes("UNAVAILABLE")) {
          setError("AI is overloaded right now. Try again in a few seconds.");
        } else {
          setError(data?.error || "Unknown error from API");
        }
      } else {
        setResult(data);
      }

    } catch (err) {
      setError("Network error. Check connection.");
    }

    setLoading(false);
  };

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
                Musical DNA (RAW)
              </h2>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(dna, null, 2)}
              </pre>
            </div>
          )}

          {/* 🤖 RAW AI RESPONSE */}
          {result && (
            <div>
              <h2 className="text-xl font-semibold mb-2">
                AI Response (RAW)
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