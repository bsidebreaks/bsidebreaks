import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { searchTicketmasterEventsForScenes } from "../../lib/spotify";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = process.env.GEMINI_MODEL || "gemma-4-31b-it";
const CATEGORIES = ["Budget Nomad", "Maverick", "Pure Experience"];

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

    const rawTasteProfile = await generateJson(buildTasteProfilePrompt(musicalDNA), 900);
    const tasteProfile = normalizeTasteProfile(rawTasteProfile);

    if (!Array.isArray(tasteProfile?.musicScenes) || !tasteProfile.musicScenes.length) {
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
    let events = ticketmasterEventSearch.events;

    if (!events.length) {
      const fallbackProfile = buildFallbackTasteProfile(musicalDNA, tasteProfile);
      const fallbackEventSearch = await searchTicketmasterEventsForScenes(
        fallbackProfile.musicScenes
      );

      events = fallbackEventSearch.events;
    }

    const recommendations = buildMainRecommendations(musicalDNA, tasteProfile, events);

    const response = {
      user: {
        name: musicalDNA.user?.name || null,
        image: musicalDNA.user?.image || null
      },
      recommendations
    };

    if (!recommendations.length) {
      response.debug = {
        tasteProfile,
        searchedEvents: events.length
      };
    }

    return Response.json(response);
  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

async function generateJson(prompt, maxOutputTokens) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    config: {
      temperature: 0.55,
      maxOutputTokens,
      responseMimeType: "application/json"
    }
  });

  const text = response.text || "";

  if (!text) {
    throw new Error("AI returned empty response");
  }

  return JSON.parse(text.replace(/```json|```/g, "").trim());
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
    musicScenes: musicScenes.slice(0, 4).map((scene) => ({
      scene: scene.scene || scene.name || scene.musicScene || "Unknown scene",
      city: scene.city || null,
      country: scene.country || null,
      countryCodes: normalizeList(
        scene.countryCodes || scene.country_codes || scene.countryCode || scene.country_code
      ).slice(0, 2),
      ticketmasterKeywords: normalizeList(
        scene.ticketmasterKeywords || scene.ticketmaster_keywords || scene.keywords
      ).slice(0, 2),
      reason: scene.reason || scene.matchReason || scene.match_reason || null,
      vibe: scene.vibe || scene.spotifyPlaylistVibe || scene.spotify_playlist_vibe || null,
      adventureLevel: scene.adventureLevel || scene.adventure_level || 3
    }))
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function buildFallbackTasteProfile(dna, tasteProfile) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists
        .map((artist) => (typeof artist === "string" ? artist : artist.name))
        .filter(Boolean)
    : [];

  const keywords = [
    ...artists.slice(0, 3),
    ...(tasteProfile.coreGenres || []).slice(0, 2),
    ...(tasteProfile.adjacentGenres || []).slice(0, 2),
    "punjabi",
    "bhangra",
    "bollywood"
  ].filter(Boolean);

  return {
    ...tasteProfile,
    musicScenes: keywords.slice(0, 6).map((keyword, index) => ({
      scene: `${keyword} live discovery`,
      city: null,
      country: null,
      countryCodes: [["CA"], ["US"], ["GB"], ["DE"], ["NL"], ["FR"]][index] || ["US"],
      ticketmasterKeywords: [keyword],
      reason: `Fallback search for ${keyword} events.`,
      vibe: `${keyword} live scene`,
      adventureLevel: 3 + (index % 3)
    }))
  };
}

function buildMainRecommendations(dna, tasteProfile, events) {
  const selected = selectDiverseEvents(events).slice(0, CATEGORIES.length);

  return selected.map((event, index) => {
    const scene = findSceneForEvent(tasteProfile.musicScenes, event);
    const city = event.venue?.city || scene?.city || null;
    const country = event.venue?.country || scene?.country || null;
    const discoveryArtist = event.artists?.[0]?.name || event.name;
    const destinationIata = getIataForCity(city);

    return {
      category: CATEGORIES[index],
      city,
      country,
      event_name: event.name,
      event_url: event.url,
      event_date: event.date,
      venue: event.venue?.name || null,
      discovery_artist: discoveryArtist,
      spotify_playlist_vibe:
        scene?.vibe ||
        buildVibeLabel(tasteProfile.coreGenres, tasteProfile.adjacentGenres),
      reasoning:
        scene?.reason ||
        `Matches your ${event.matchedKeyword || "music"} taste with a fresh live scene.`,
      flightURL: destinationIata ? buildFlightURL("bcn", destinationIata.toLowerCase()) : null,
      image: event.image || null
    };
  });
}

function selectDiverseEvents(events) {
  const usableEvents = Array.isArray(events)
    ? events.filter((event) => event?.venue?.city && event?.venue?.country && event?.url)
    : [];

  const selected = [];
  const usedCountries = new Set();
  const usedCities = new Set();

  usableEvents.forEach((event) => {
    const country = event.venue.country;
    const city = event.venue.city;

    if (selected.length < 3 && !usedCountries.has(country)) {
      selected.push(event);
      usedCountries.add(country);
      usedCities.add(city);
    }
  });

  usableEvents.forEach((event) => {
    const city = event.venue.city;

    if (selected.length < 3 && !usedCities.has(city)) {
      selected.push(event);
      usedCities.add(city);
    }
  });

  return selected;
}

function findSceneForEvent(scenes, event) {
  return scenes.find((scene) => {
    const keywords = scene.ticketmasterKeywords || [];

    return (
      scene.scene === event.scene ||
      keywords.some((keyword) => keyword === event.matchedKeyword)
    );
  });
}

function buildVibeLabel(coreGenres, adjacentGenres) {
  const genres = [...(coreGenres || []), ...(adjacentGenres || [])].slice(0, 2);
  return genres.length ? `${genres.join(" / ")} discovery` : "Music discovery trip";
}

function buildFlightURL(originIata, destinationIata) {
  return `https://www.skyscanner.es/transporte/vuelos/${originIata}/${destinationIata}/260425/260513/`;
}

function getIataForCity(city) {
  const cityToIata = {
    Amsterdam: "AMS",
    Barcelona: "BCN",
    Berlin: "BER",
    Birmingham: "BHX",
    Calgary: "YYC",
    Chicago: "ORD",
    Delhi: "DEL",
    Dubai: "DXB",
    Edmonton: "YEG",
    LasVegas: "LAS",
    "Las Vegas": "LAS",
    London: "LHR",
    Luton: "LTN",
    Manchester: "MAN",
    Montreal: "YUL",
    "New York": "JFK",
    Orlando: "MCO",
    Paris: "CDG",
    Rosemont: "ORD",
    Toronto: "YYZ",
    Vancouver: "YVR",
    Winnipeg: "YWG"
  };

  return cityToIata[city] || null;
}

function buildTasteProfilePrompt(dna) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists.map((artist) => (typeof artist === "string" ? artist : artist.name))
    : [];

  const tracks = Array.isArray(dna.topTracks) ? dna.topTracks : [];
  const genres = Array.isArray(dna.topGenres) ? dna.topGenres : [];

  return `
You create search instructions for Ticketmaster.

User listens to:
- Artists: ${artists.join(", ")}
- Tracks: ${tracks.join(", ")}
- Spotify genres: ${genres.join(", ") || "unknown"}
- User country: ${dna.user?.country || "unknown"}

Infer related music scenes, not the exact same artists. Focus on live music scenes that can produce real Ticketmaster events.

Return ONLY valid compact JSON:
{
  "coreGenres": ["Punjabi pop"],
  "adjacentGenres": ["UK Asian underground"],
  "musicScenes": [
    {
      "scene": "Punjabi diaspora club nights",
      "city": "Birmingham",
      "country": "United Kingdom",
      "countryCodes": ["GB"],
      "ticketmasterKeywords": ["punjabi", "bhangra"],
      "reason": "Related to Punjabi pop, but more local and exploratory.",
      "vibe": "Punjabi pop meets diaspora nightlife",
      "adventureLevel": 4
    }
  ]
}

Rules:
- Return 4 musicScenes.
- Each countryCodes array should contain 1 country code.
- Each ticketmasterKeywords array should contain 1 or 2 short keywords.
- Use likely Ticketmaster markets: GB, CA, US, DE, NL, FR, ES.
- No markdown.
`;
}
