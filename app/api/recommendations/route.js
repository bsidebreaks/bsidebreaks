import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { searchTicketmasterEventsForScenes } from "../../lib/spotify";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = process.env.GEMINI_MODEL || "gemma-4-31b-it";

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

    const rawTasteProfile = await generateJson(
      buildTasteProfilePrompt(musicalDNA),
      1600
    );
    const tasteProfile = normalizeTasteProfile(rawTasteProfile);

    if (!Array.isArray(tasteProfile?.musicScenes)) {
      return Response.json(
        {
          error: "Invalid taste profile format",
          rawTasteProfile
        },
        { status: 500 }
      );
    }

    const ticketmasterEventSearch = await searchTicketmasterEventsForScenes(
      tasteProfile.musicScenes
    );

    const finalResult = await generateJson(
      buildRecommendationPrompt(musicalDNA, tasteProfile, ticketmasterEventSearch),
      2200
    );

    if (!Array.isArray(finalResult?.recommendations)) {
      return Response.json({ error: "Invalid recommendation format" }, { status: 500 });
    }

    const originIata = "bcn";

    finalResult.recommendations = finalResult.recommendations.map((rec) => {
      const destinationIata = (rec.iata || "").toLowerCase();

      return {
        ...rec,
        flightURL: destinationIata
          ? buildFlightURL(originIata, destinationIata)
          : null
      };
    });

    return Response.json({
      tasteProfile,
      ticketmasterEventSearch,
      recommendations: finalResult.recommendations
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

async function generateJson(prompt, maxOutputTokens) {
  let text;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        temperature: 0.75,
        maxOutputTokens,
        responseMimeType: "application/json"
      }
    });

    text = response.text || "";
  } catch (error) {
    console.error("AI ERROR:", error);
    throw error;
  }

  if (!text) {
    throw new Error("AI returned empty response");
  }

  const cleanText = text
    .replace(/```json|```/g, "")
    .trim();

  return JSON.parse(cleanText);
}

function normalizeTasteProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return profile;
  }

  const musicScenes =
    profile.musicScenes ||
    profile.scenes ||
    profile.targetScenes ||
    profile.music_scenes ||
    [];

  return {
    coreGenres: profile.coreGenres || profile.core_genres || [],
    adjacentGenres: profile.adjacentGenres || profile.adjacent_genres || [],
    sceneKeywords: profile.sceneKeywords || profile.scene_keywords || [],
    musicScenes: musicScenes.map((scene) => ({
      scene: scene.scene || scene.name || scene.musicScene || "Unknown scene",
      city: scene.city || null,
      country: scene.country || null,
      countryCodes: scene.countryCodes || scene.country_codes || scene.countries || [],
      ticketmasterKeywords:
        scene.ticketmasterKeywords ||
        scene.ticketmaster_keywords ||
        scene.keywords ||
        [],
      reason: scene.reason || scene.matchReason || scene.match_reason || null,
      adventureLevel: scene.adventureLevel || scene.adventure_level || 3
    }))
  };
}

function buildFlightURL(originIata, destinationIata) {
  return `https://www.skyscanner.es/transporte/vuelos/${originIata}/${destinationIata}/260425/260513/`;
}

function buildTasteProfilePrompt(dna) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists.map((artist) => (typeof artist === "string" ? artist : artist.name))
    : [];

  const tracks = Array.isArray(dna.topTracks) ? dna.topTracks : [];
  const genres = Array.isArray(dna.topGenres) ? dna.topGenres : [];

  return `
You are building a music travel discovery app.

The user listens to:
- Top artists: ${artists.join(", ")}
- Top tracks: ${tracks.join(", ")}
- Spotify genres, may be empty: ${genres.join(", ")}
- Spotify user country: ${dna.user?.country || "unknown"}

Infer a discovery-oriented taste profile. Do NOT recommend the same exact artists only.
Expand into adjacent scenes, diaspora scenes, underground live scenes, and culturally related genres.
Do NOT invent Ticketmaster events. At this step you only create search instructions for Ticketmaster.

Return ONLY valid JSON with this exact shape:

{
  "coreGenres": ["genre"],
  "adjacentGenres": ["genre"],
  "sceneKeywords": ["keyword"],
  "musicScenes": [
    {
      "scene": "Scene name",
      "city": "City",
      "country": "Country",
      "countryCodes": ["GB", "CA"],
      "ticketmasterKeywords": ["punjabi", "bhangra"],
      "reason": "Short reason",
      "adventureLevel": 4
    }
  ]
}

Rules:
- Return 4 to 6 musicScenes.
- Each scene should point to countries where the live scene is plausible.
- Prefer scenes that are not obvious tourist choices.
- ticketmasterKeywords must be short search terms likely to match real Ticketmaster events.
- countryCodes must be ISO 3166-1 alpha-2 codes.
- The root object MUST contain "musicScenes".
- No markdown.
`;
}

function buildRecommendationPrompt(dna, tasteProfile, ticketmasterEventSearch) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists.map((artist) => (typeof artist === "string" ? artist : artist.name))
    : [];

  const eventCandidates = ticketmasterEventSearch.events.slice(0, 30);

  return `
You are a music travel curator.

User Spotify evidence:
- Top artists: ${artists.join(", ")}
- Top tracks: ${(dna.topTracks || []).join(", ")}
- Inferred core genres: ${(tasteProfile.coreGenres || []).join(", ")}
- Inferred adjacent genres: ${(tasteProfile.adjacentGenres || []).join(", ")}

Real Ticketmaster event candidates:
${JSON.stringify(eventCandidates, null, 2)}

Choose 3 travel recommendations from the real Ticketmaster events above.
Do not invent events, venues, artists, dates, cities, or URLs.
Prefer different countries when possible.
Make the picks feel discoverable: related to the user's taste, but not only their exact known artists.

Return ONLY valid JSON with this exact shape:

{
  "recommendations": [
    {
      "destination": "City, Country",
      "city": "City",
      "country": "Country",
      "iata": "Nearest major airport IATA",
      "event_id": "Ticketmaster event id",
      "event_name": "Ticketmaster event name",
      "event_url": "Ticketmaster event URL",
      "event_date": "YYYY-MM-DD",
      "venue": "Venue name",
      "discovery_artist": "Artist or event attraction",
      "category": "Budget Nomad | Maverick | Pure Experience",
      "cost_index": 1,
      "spotify_playlist_vibe": "Short vibe",
      "reasoning": "Max 18 words"
    }
  ]
}

Rules:
- EXACTLY 3 recommendations if at least 3 usable events exist.
- If fewer than 3 events exist, return as many as available.
- cost_index must be an integer from 1 to 5.
- No markdown.
`;
}
