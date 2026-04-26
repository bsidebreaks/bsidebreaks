import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { searchTicketmasterEventsForScenes } from "../../lib/spotify";
import { GoogleGenAI } from "@google/genai";
import { recordRecommendationSnapshot } from "../../../lib/analytics";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const MODEL = process.env.GEMINI_MODEL || "gemma-4-31b-it";
const CATEGORIES = ["Budget Nomad", "Maverick", "Pure Experience"];
const AI_RETRY_DELAYS_MS = [500, 1200];
const AI_PROFILE_TIMEOUT_MS = 4000;
const tasteProfileCache = new Map();

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { musicalDNA, excludedEventIds = [], excludedArtistNames = [] } = body;
    const excludedEventIdSet = new Set(
      Array.isArray(excludedEventIds) ? excludedEventIds.filter(Boolean) : []
    );
    const excludedArtistSet = new Set(
      Array.isArray(excludedArtistNames)
        ? excludedArtistNames.map(normalizeSearchText).filter(Boolean)
        : []
    );

    if (!musicalDNA || !musicalDNA.topArtists?.length) {
      return Response.json({ error: "Invalid musical DNA" }, { status: 400 });
    }

    const rawTasteProfile = await generateTasteProfile(musicalDNA, {
      skipAi: excludedEventIdSet.size > 0
    });
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

    const fallbackProfile = buildFallbackTasteProfile(musicalDNA, tasteProfile);
    const searchScenes = [
      ...tasteProfile.musicScenes,
      ...fallbackProfile.musicScenes
    ];
    const ticketmasterEventSearch = await searchTicketmasterEventsForScenes(searchScenes);
    let events = ticketmasterEventSearch.events;

    if (events.length < CATEGORIES.length) {
      const fallbackEventSearch = await searchTicketmasterEventsForScenes(
        fallbackProfile.musicScenes
      );

      events = mergeEventsById(events, fallbackEventSearch.events);
    }

    const availableEvents = events.filter((event) => !excludedEventIdSet.has(event.id));
    const artistFilteredEvents = availableEvents.filter(
      (event) => !hasExcludedArtist(event, excludedArtistSet)
    );
    const recommendationEvents = artistFilteredEvents.length
      ? artistFilteredEvents
      : availableEvents.length
        ? availableEvents
        : events;

    const recommendations = buildMainRecommendations(
      musicalDNA,
      tasteProfile,
      recommendationEvents
    );

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

    recordRecommendationSnapshot({
      session,
      musicalDNA,
      tasteProfile,
      recommendations
    }).catch((error) => {
      console.warn("RECOMMENDATION_ANALYTICS_ERROR:", error?.message || error);
    });

    return Response.json(response);
  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

async function generateTasteProfile(musicalDNA, { skipAi = false } = {}) {
  const cacheKey = buildTasteProfileCacheKey(musicalDNA);
  const cachedProfile = cacheKey ? tasteProfileCache.get(cacheKey) : null;

  if (cachedProfile) {
    return cachedProfile;
  }

  if (skipAi) {
    return buildLocalTasteProfile(musicalDNA);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is missing. Using local taste profile fallback.");
    return buildLocalTasteProfile(musicalDNA);
  }

  try {
    const profile = await withTimeout(
      generateJson(buildTasteProfilePrompt(musicalDNA), 500),
      AI_PROFILE_TIMEOUT_MS,
      "AI taste profile timed out"
    );

    cacheTasteProfile(cacheKey, profile);

    return profile;
  } catch (error) {
    console.warn("AI taste profile failed. Using local fallback.", {
      status: getErrorStatus(error),
      message: error?.message
    });

    const profile = buildLocalTasteProfile(musicalDNA);
    cacheTasteProfile(cacheKey, profile);

    return profile;
  }
}

function buildTasteProfileCacheKey(musicalDNA) {
  const artists = Array.isArray(musicalDNA.topArtists)
    ? musicalDNA.topArtists
        .map((artist) => (typeof artist === "string" ? artist : artist.name))
        .filter(Boolean)
    : [];
  const genres = Array.isArray(musicalDNA.topGenres) ? musicalDNA.topGenres.filter(Boolean) : [];
  const userKey = musicalDNA.user?.profileUrl || musicalDNA.user?.name || "anonymous";

  return [userKey, ...artists.slice(0, 5), ...genres.slice(0, 5)].join("|");
}

function cacheTasteProfile(cacheKey, profile) {
  if (!cacheKey || !profile) {
    return;
  }

  tasteProfileCache.set(cacheKey, profile);

  if (tasteProfileCache.size > 50) {
    const oldestKey = tasteProfileCache.keys().next().value;
    tasteProfileCache.delete(oldestKey);
  }
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    })
  ]);
}

function mergeEventsById(...eventLists) {
  const eventsById = new Map();

  eventLists.flat().forEach((event) => {
    if (event?.id && !eventsById.has(event.id)) {
      eventsById.set(event.id, event);
    }
  });

  return Array.from(eventsById.values());
}

async function generateJson(prompt, maxOutputTokens) {
  let lastError;

  for (let attempt = 0; attempt <= AI_RETRY_DELAYS_MS.length; attempt += 1) {
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
    } catch (error) {
      lastError = error;

      if (!isRetryableAIError(error) || attempt === AI_RETRY_DELAYS_MS.length) {
        break;
      }

      await sleep(AI_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function isRetryableAIError(error) {
  const status = getErrorStatus(error);

  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function getErrorStatus(error) {
  return error?.status || error?.response?.status || error?.cause?.status || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLocalTasteProfile(dna) {
  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists
        .map((artist) => (typeof artist === "string" ? artist : artist.name))
        .filter(Boolean)
    : [];

  const genres = Array.isArray(dna.topGenres) ? dna.topGenres.filter(Boolean) : [];
  const relatedKeywords = getRelatedDiscoveryKeywords([...genres, ...artists].join(" "));
  const keywords = [...genres, ...artists, ...relatedKeywords].filter(Boolean);
  const primaryGenres = genres.length ? genres : artists.slice(0, 2);
  const fallbackKeywords = keywords.length ? keywords : ["live music", "indie", "electronic"];
  const markets = [
    { city: "London", country: "United Kingdom", countryCodes: ["GB"] },
    { city: "Toronto", country: "Canada", countryCodes: ["CA"] },
    { city: "New York", country: "United States", countryCodes: ["US"] },
    { city: "Berlin", country: "Germany", countryCodes: ["DE"] }
  ];

  return {
    coreGenres: primaryGenres.slice(0, 3),
    adjacentGenres: genres.slice(3, 6),
    musicScenes: markets.map((market, index) => {
      const keyword = fallbackKeywords[index % fallbackKeywords.length];

      return {
        scene: `${keyword} live scene`,
        ...market,
        ticketmasterKeywords: [keyword],
        reason: `Based on your Spotify taste around ${keyword}.`,
        vibe: `${keyword} discovery`,
        adventureLevel: 3 + (index % 3)
      };
    }),
    fallbackMusicScenes: buildLocalFallbackScenes(keywords, markets)
  };
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
  const fallbackMusicScenes =
    profile.fallbackMusicScenes ||
    profile.fallbackScenes ||
    profile.fallback_music_scenes ||
    profile.backupScenes ||
    profile.backup_scenes ||
    [];

  return {
    coreGenres: profile.coreGenres || profile.core_genres || [],
    adjacentGenres: profile.adjacentGenres || profile.adjacent_genres || [],
    musicScenes: normalizeMusicScenes(musicScenes).slice(0, 4),
    fallbackMusicScenes: normalizeMusicScenes(fallbackMusicScenes).slice(0, 8)
  };
}

function normalizeMusicScenes(scenes) {
  if (!Array.isArray(scenes)) {
    return [];
  }

  return scenes.map((scene) => ({
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
  }));
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function buildFallbackTasteProfile(dna, tasteProfile) {
  if (Array.isArray(tasteProfile.fallbackMusicScenes) && tasteProfile.fallbackMusicScenes.length) {
    return {
      ...tasteProfile,
      musicScenes: tasteProfile.fallbackMusicScenes
    };
  }

  const artists = Array.isArray(dna.topArtists)
    ? dna.topArtists
        .map((artist) => (typeof artist === "string" ? artist : artist.name))
        .filter(Boolean)
    : [];

  const keywords = [
    ...artists.slice(0, 3),
    ...(tasteProfile.coreGenres || []).slice(0, 2),
    ...(tasteProfile.adjacentGenres || []).slice(0, 2),
    ...getRelatedDiscoveryKeywords(
      [
        ...artists,
        ...(tasteProfile.coreGenres || []),
        ...(tasteProfile.adjacentGenres || [])
      ].join(" ")
    )
  ].filter(Boolean);
  const uniqueKeywords = [...new Set(keywords)];

  return {
    ...tasteProfile,
    musicScenes: buildLocalFallbackScenes(uniqueKeywords)
  };
}

function buildLocalFallbackScenes(keywords, markets = null) {
  const fallbackMarkets =
    markets ||
    [
      { city: null, country: null, countryCodes: ["CA"] },
      { city: null, country: null, countryCodes: ["US"] },
      { city: null, country: null, countryCodes: ["GB"] },
      { city: null, country: null, countryCodes: ["DE"] },
      { city: null, country: null, countryCodes: ["NL"] },
      { city: null, country: null, countryCodes: ["FR"] }
    ];

  return keywords.slice(0, 8).map((keyword, index) => {
    const market = fallbackMarkets[index % fallbackMarkets.length];

    return {
      scene: `${keyword} live discovery`,
      city: market.city || null,
      country: market.country || null,
      countryCodes: market.countryCodes || ["US"],
      ticketmasterKeywords: [keyword],
      reason: `Fallback search for ${keyword} events.`,
      vibe: `${keyword} live scene`,
      adventureLevel: 3 + (index % 3)
    };
  });
}

function getRelatedDiscoveryKeywords(genreText) {
  const text = normalizeSearchText(genreText);

  if (
    /(punjabi|bhangra|bollywood|desi|indian|hindi|diljit|karan aujla|yo yo honey singh|honey singh|shashwat sachdev|arijit|sidhu|ap dhillon)/.test(
      text
    )
  ) {
    return ["punjabi", "bhangra", "bollywood", "desi"];
  }

  if (/(reggaeton|latin|urbano|bachata|salsa)/.test(text)) {
    return ["latin", "reggaeton", "urbano"];
  }

  if (/(techno|house|edm|electronic|dance)/.test(text)) {
    return ["electronic", "techno", "house"];
  }

  if (/(rap|hip hop|trap|r&b|soul)/.test(text)) {
    return ["hip hop", "rap", "r&b", "soul"];
  }

  if (/(rock|metal|punk|alternative|indie)/.test(text)) {
    return ["indie", "alternative", "rock", "punk"];
  }

  return [];
}

function buildMainRecommendations(dna, tasteProfile, events) {
  const selected = selectBestProfileMatches(dna, tasteProfile, events).slice(
    0,
    CATEGORIES.length * 4
  );

  return dedupeEventsByDiscoveryArtist(selected).slice(0, CATEGORIES.length).map((event, index) => {
    const scene = findSceneForEvent(tasteProfile.musicScenes, event);
    const city = getEventCity(event, scene);
    const country = getEventCountry(event, scene);
    const discoveryArtist = event.artists?.[0]?.name || event.name;
    const destinationIata = getIataForCity(city);

    return {
      category: CATEGORIES[index],
      event_id: event.id,
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

function dedupeEventsByDiscoveryArtist(events) {
  const seenArtists = new Set();

  return events.filter((event) => {
    const artist = getEventDiscoveryArtist(event);
    const artistKey = normalizeSearchText(artist || event.name || event.id);

    if (!artistKey || seenArtists.has(artistKey)) {
      return false;
    }

    seenArtists.add(artistKey);
    return true;
  });
}

function hasExcludedArtist(event, excludedArtistSet) {
  if (!excludedArtistSet.size) {
    return false;
  }

  const artistNames = [
    getEventDiscoveryArtist(event),
    ...(event?.artists || []).map((artist) => artist?.name)
  ];

  return artistNames.some((artist) => excludedArtistSet.has(normalizeSearchText(artist)));
}

function getEventDiscoveryArtist(event) {
  return event?.artists?.[0]?.name || event?.name || null;
}

function selectBestProfileMatches(dna, tasteProfile, events) {
  const usableEvents = Array.isArray(events)
    ? events.filter((event) => event?.url && getEventCity(event) && getEventCountry(event))
    : [];

  return usableEvents
    .map((event, index) => ({
      event,
      index,
      score: scoreEventForProfile(event, dna, tasteProfile)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ event }) => event);
}

function scoreEventForProfile(event, dna, tasteProfile) {
  const topArtists = getArtistNames(dna.topArtists);
  const topGenres = Array.isArray(dna.topGenres) ? dna.topGenres.filter(Boolean) : [];
  const scene = findSceneForEvent(tasteProfile.musicScenes, event);
  const eventText = normalizeSearchText(
    [
      event.name,
      event.matchedKeyword,
      event.scene,
      event.artists?.map((artist) => artist.name).join(" "),
      event.artists?.map((artist) => artist.genre).join(" "),
      event.artists?.map((artist) => artist.subGenre).join(" ")
    ].join(" ")
  );
  let score = 0;

  topArtists.forEach((artist, index) => {
    const artistText = normalizeSearchText(artist);

    if (artistText && eventText.includes(artistText)) {
      score += 120 - index * 12;
    }
  });

  topGenres.forEach((genre, index) => {
    const genreText = normalizeSearchText(genre);

    if (genreText && eventText.includes(genreText)) {
      score += 55 - index * 5;
    }
  });

  (tasteProfile.coreGenres || []).forEach((genre, index) => {
    const genreText = normalizeSearchText(genre);

    if (genreText && eventText.includes(genreText)) {
      score += 40 - index * 4;
    }
  });

  if (scene) {
    const sceneIndex = (tasteProfile.musicScenes || []).findIndex(
      (musicScene) => musicScene.scene === scene.scene
    );

    score += Math.max(8, 35 - sceneIndex * 6);

    (scene.ticketmasterKeywords || []).forEach((keyword) => {
      const keywordText = normalizeSearchText(keyword);

      if (keywordText && eventText.includes(keywordText)) {
        score += 45;
      }
    });
  }

  if (event.artists?.length) {
    score += 8;
  }

  if (event.date) {
    score += 4;
  }

  return score;
}

function getArtistNames(artists) {
  return Array.isArray(artists)
    ? artists
        .map((artist) => (typeof artist === "string" ? artist : artist.name))
        .filter(Boolean)
    : [];
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getEventCity(event, scene = null) {
  return event?.venue?.city || event?.searchCity || scene?.city || null;
}

function getEventCountry(event, scene = null) {
  return event?.venue?.country || event?.searchCountry || scene?.country || null;
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
  ],
  "fallbackMusicScenes": [
    {
      "scene": "Punjabi live discovery",
      "city": null,
      "country": null,
      "countryCodes": ["CA"],
      "ticketmasterKeywords": ["punjabi"],
      "reason": "Broader fallback still grounded in the user's Punjabi pop taste.",
      "vibe": "Punjabi live discovery",
      "adventureLevel": 3
    }
  ]
}

Rules:
- Return 4 musicScenes.
- Return 6 fallbackMusicScenes.
- Each countryCodes array should contain 1 country code.
- Each ticketmasterKeywords array should contain 1 or 2 short keywords.
- Use likely Ticketmaster markets: GB, CA, US, DE, NL, FR, ES.
- fallbackMusicScenes must be broader than musicScenes but still directly inferred from the user's artists, tracks, and genres.
- Do not use generic fallback keywords like "pop", "indie", "festival", or "live music" unless they are clearly present in the user's Spotify data.
- No markdown.
`;
}
