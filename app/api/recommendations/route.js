import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getMusicalDNA } from "../../lib/spotify";

// gemini-2.0-flash is EOL for new API keys; use 2.5+ — override via .env
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Not authorized" }, { status: 401 });
    }

    let musicalDNA;
    try {
      musicalDNA = await getMusicalDNA(session.accessToken);
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && e.status === 401) {
        return Response.json(
          { error: "Spotify access expired or was revoked" },
          { status: 401 }
        );
      }
      throw e;
    }

    if (!musicalDNA || !musicalDNA.topArtists?.length) {
      return Response.json({ error: "Invalid musical DNA" }, { status: 400 });
    }

    const prompt = buildPrompt(musicalDNA);

    // ⏱️ Timeout para evitar esperas largas
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let aiResponse;

    try {
      aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 600
            }
          })
        }
      );
    } catch (err) {
      if (err.name === "AbortError") {
        return Response.json(
          { error: "AI timeout, try again" },
          { status: 408 }
        );
      }
      throw err;
    }

    clearTimeout(timeout);

    const raw = await aiResponse.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      return Response.json(
        { error: "Invalid response from AI (check API key, model, network)" },
        { status: 500 }
      );
    }
    if (!aiResponse.ok) {
      const msg = data?.error?.message || data?.error || `AI request failed (${aiResponse.status})`;
      console.error("Gemini error", aiResponse.status, data);
      return Response.json({ error: String(msg) }, { status: 500 });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("No text from Gemini:", data);
      return Response.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // limpiar markdown tipo ```json
    const cleanText = text.replace(/```json|```/g, "").trim();
    if (!cleanText) {
      return Response.json({ error: "AI returned empty JSON" }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      console.error("Parse error:", cleanText);
      return Response.json({ error: "AI parsing error" }, { status: 500 });
    }

    if (!parsed?.recommendations || !Array.isArray(parsed.recommendations)) {
      return Response.json({ error: "Invalid AI format" }, { status: 500 });
    }

    // ✈️ Generar URLs de vuelos
    const originIata = "bcn"; // 🔥 luego lo hacemos dinámico

    parsed.recommendations = parsed.recommendations.map(rec => {
      const destinationIata = (rec.iata || "").toLowerCase();

      return {
        ...rec,
        flightURL: destinationIata
          ? buildFlightURL(originIata, destinationIata)
          : null
      };
    });

    return Response.json(parsed);

    return Response.json(parsed);
  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}


// ✈️ Generador de URL Skyscanner
function buildFlightURL(originIata, destinationIata) {
  return `https://www.skyscanner.es/transporte/vuelos/${originIata}/${destinationIata}/260425/260513/`;
}


// 🧠 Prompt
function buildPrompt(dna) {
  const artists = Array.isArray(dna?.topArtists) ? dna.topArtists : [];
  const tracks = Array.isArray(dna?.topTracks) ? dna.topTracks : [];
  const genres = Array.isArray(dna?.topGenres) ? dna.topGenres : [];
  const mood = dna?.mood ?? "unknown";
  return `
User musical profile:
- Top artists: ${artists.join(", ")}
- Top tracks: ${tracks.join(", ")}
- Genres: ${genres.join(", ")}
- Mood: ${mood}

IMPORTANT:
Return ONLY valid JSON.
NO explanations, NO text outside JSON.

FORMAT:

{
  "recommendations": [
    {
      "destination": "City, Country",
      "city": "City name only",
      "country": "Country name",
      "iata": "IATA airport code (e.g. CDG, DXB, YYZ)",
      "event_name": "Event or scene",
      "category": "Budget Nomad | Maverick | Pure Experience",
      "cost_index": 1-5,
      "spotify_playlist_vibe": "Music vibe",
      "reasoning": "Why it matches",
      "image_url": "https://…"
    }
  ]
}

RULES:
- Exactly 3 recommendations
- Each in a different country
- "iata" MUST be valid and major airport
- Prefer international airports
- Keep reasoning VERY short (max 10 words)
`;
}
