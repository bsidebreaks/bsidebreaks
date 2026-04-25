import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { GoogleGenAI } from "@google/genai";

// 🔥 cliente AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { musicalDNA } = body;

    if (!musicalDNA || !musicalDNA.topArtists?.length) {
      return Response.json({ error: "Invalid musical DNA" }, { status: 400 });
    }

    const prompt = buildPrompt(musicalDNA);

    // 🤖 llamada a GEMMA (sin fetch, sin AbortController)
    let text;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          temperature: 0.8,
          maxOutputTokens: 700,
          responseMimeType: "application/json", // 🔥 evita JSON roto
        },
      });

      text = response.text || "";
    } catch (err) {
      console.error("AI ERROR:", err);
      return Response.json({ error: "AI request failed" }, { status: 500 });
    }

    if (!text) {
      return Response.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // 🧹 limpiar por si acaso
    const cleanText = text.replace(/```json|```/g, "").trim();

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
    const originIata = "bcn";

    parsed.recommendations = parsed.recommendations.map((rec) => {
      const destinationIata = (rec.iata || "").toLowerCase();

      return {
        ...rec,
        flightURL: destinationIata
          ? buildFlightURL(originIata, destinationIata)
          : null,
      };
    });

    return Response.json(parsed);

  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}


// ✈️ vuelos
function buildFlightURL(originIata, destinationIata) {
  return `https://www.skyscanner.es/transporte/vuelos/${originIata}/${destinationIata}/260425/260513/`;
}


// 🧠 prompt
function buildPrompt(dna) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists.map(a => (typeof a === "string" ? a : a.name))
    : [];

  return `
User musical profile:
- Top artists: ${artists.join(", ")}
- Top tracks: ${dna.topTracks.join(", ")}
- Genres: ${dna.topGenres.join(", ")}
- Mood: ${dna.mood}

CRITICAL:
Return ONLY valid JSON.
NO markdown.
NO explanations.
NO text outside JSON.

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
      "cost_index": 1,
      "spotify_playlist_vibe": "Music vibe",
      "reasoning": "Max 10 words"
    }
  ]
}

RULES:
- EXACTLY 3 recommendations
- Each in different country
- IATA must be real airport
- Prefer international airports
`;
}