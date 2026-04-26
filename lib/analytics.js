import { GoogleGenAI } from "@google/genai";
import { getDb, isMongoConfigured } from "./mongodb";

const EVENT_COLLECTION = "analytics_events";
const SESSION_COLLECTION = "user_sessions";
const USER_COLLECTION = "users";
const INSIGHTS_COLLECTION = "ai_insights";
const SNAPSHOT_COLLECTION = "recommendation_snapshots";
const ARTIST_STATS_COLLECTION = "recommendation_artist_stats";
const MAX_EVENT_PROPERTIES_BYTES = 3000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemma-4-31b-it";

export async function ensureAnalyticsIndexes() {
  if (!isMongoConfigured()) {
    return;
  }

  const db = await getDb();

  await Promise.all([
    db.collection(EVENT_COLLECTION).createIndexes([
      { key: { createdAt: -1 } },
      { key: { userKey: 1, createdAt: -1 } },
      { key: { sessionId: 1, createdAt: 1 } },
      { key: { type: 1, createdAt: -1 } },
      { key: { page: 1, createdAt: -1 } }
    ]),
    db.collection(SESSION_COLLECTION).createIndexes([
      { key: { sessionId: 1 }, unique: true },
      { key: { userKey: 1, startedAt: -1 } },
      { key: { lastSeenAt: -1 } }
    ]),
    db.collection(USER_COLLECTION).createIndexes([
      { key: { userKey: 1 }, unique: true },
      { key: { lastSeenAt: -1 } }
    ]),
    db.collection(INSIGHTS_COLLECTION).createIndexes([{ key: { createdAt: -1 } }]),
    db.collection(SNAPSHOT_COLLECTION).createIndexes([
      { key: { userKey: 1, createdAt: -1 } },
      { key: { "recommendations.event_id": 1 } }
    ]),
    db.collection(ARTIST_STATS_COLLECTION).createIndexes([
      { key: { userKey: 1, artist: 1 }, unique: true },
      { key: { artist: 1, impressions: -1 } },
      { key: { lastShownAt: -1 } }
    ])
  ]);
}

export function buildUserIdentity(session, anonymousId) {
  const email = session?.user?.email || null;
  const name = session?.user?.name || null;
  const image = session?.user?.image || null;
  const userKey = email ? `spotify:${email.toLowerCase()}` : `anonymous:${anonymousId || "unknown"}`;

  return {
    userKey,
    anonymousId: anonymousId || null,
    email,
    name,
    image,
    authenticated: Boolean(email || session?.accessToken)
  };
}

export async function trackAnalyticsEvent({ session, anonymousId, event, request }) {
  if (!isMongoConfigured()) {
    return { stored: false, reason: "mongo-not-configured" };
  }

  const type = sanitizeString(event?.type, 80);
  const sessionId = sanitizeString(event?.sessionId, 120);

  if (!type || !sessionId) {
    throw new Error("type and sessionId are required");
  }

  const now = new Date();
  const identity = buildUserIdentity(session, anonymousId);
  const page = sanitizeString(event?.page, 240) || "/";
  const durationMs = clampNumber(event?.durationMs, 0, 1000 * 60 * 60);
  const properties = sanitizeProperties(event?.properties);
  const userAgent = sanitizeString(request.headers.get("user-agent"), 500);
  const referrer = sanitizeString(request.headers.get("referer"), 500);

  const db = await getDb();
  const eventDoc = {
    type,
    page,
    sessionId,
    userKey: identity.userKey,
    anonymousId: identity.anonymousId,
    user: {
      email: identity.email,
      name: identity.name,
      image: identity.image,
      authenticated: identity.authenticated
    },
    durationMs,
    properties,
    context: {
      userAgent,
      referrer,
      locale: sanitizeString(event?.locale, 40),
      timezone: sanitizeString(event?.timezone, 80),
      viewport: sanitizeProperties(event?.viewport)
    },
    createdAt: now
  };

  await Promise.all([
    db.collection(EVENT_COLLECTION).insertOne(eventDoc),
    db.collection(SESSION_COLLECTION).updateOne(
      { sessionId },
      {
        $setOnInsert: {
          sessionId,
          userKey: identity.userKey,
          anonymousId: identity.anonymousId,
          startedAt: now
        },
        $set: {
          user: eventDoc.user,
          lastSeenAt: now,
          lastPage: page
        },
        $inc: {
          eventCount: 1,
          totalDurationMs: durationMs || 0,
          clickCount: type === "click" ? 1 : 0,
          pageViewCount: type === "page_view" ? 1 : 0
        },
        $addToSet: { pages: page }
      },
      { upsert: true }
    ),
    db.collection(USER_COLLECTION).updateOne(
      { userKey: identity.userKey },
      {
        $setOnInsert: {
          userKey: identity.userKey,
          anonymousId: identity.anonymousId,
          firstSeenAt: now
        },
        $set: {
          email: identity.email,
          name: identity.name,
          image: identity.image,
          authenticated: identity.authenticated,
          lastSeenAt: now
        },
        $inc: {
          eventCount: 1,
          totalDurationMs: durationMs || 0
        }
      },
      { upsert: true }
    )
  ]);

  return { stored: true };
}

export async function recordRecommendationSnapshot({ session, musicalDNA, tasteProfile, recommendations }) {
  if (!isMongoConfigured()) {
    return;
  }

  const identity = buildUserIdentity(session, session?.user?.email || "server");
  const now = new Date();
  const db = await getDb();
  const normalizedRecommendations = Array.isArray(recommendations) ? recommendations : [];
  const artistStatsUpdates = buildRecommendationArtistStatUpdates(identity, normalizedRecommendations, now);

  await Promise.all([
    db.collection(SNAPSHOT_COLLECTION).insertOne({
      userKey: identity.userKey,
      user: {
        email: identity.email,
        name: identity.name,
        image: identity.image,
        authenticated: identity.authenticated
      },
      musicalDNA: sanitizeProperties({
        topArtists: musicalDNA?.topArtists,
        topGenres: musicalDNA?.topGenres,
        user: musicalDNA?.user
      }),
      tasteProfile: sanitizeProperties(tasteProfile),
      recommendations: sanitizeProperties(normalizedRecommendations),
      createdAt: now
    }),
    ...artistStatsUpdates.map((update) => db.collection(ARTIST_STATS_COLLECTION).updateOne(update.filter, update.update, { upsert: true })),
    db.collection(USER_COLLECTION).updateOne(
      { userKey: identity.userKey },
      {
        $setOnInsert: { userKey: identity.userKey, firstSeenAt: now },
        $set: {
          email: identity.email,
          name: identity.name,
          image: identity.image,
          lastRecommendationAt: now,
          lastSeenAt: now
        },
        $inc: { recommendationRuns: 1 }
      },
      { upsert: true }
    )
  ]);

  if (artistStatsUpdates.length) {
    console.info("RECOMMENDATION_ARTISTS_SAVED:", {
      userKey: identity.userKey,
      artists: artistStatsUpdates.map((update) => update.artist),
      count: artistStatsUpdates.length
    });
  }
}

function buildRecommendationArtistStatUpdates(identity, recommendations, now) {
  const artistMap = new Map();

  recommendations.forEach((recommendation) => {
    const artist = sanitizeString(recommendation?.discovery_artist, 160);

    if (!artist) {
      return;
    }

    const current = artistMap.get(artist) || {
      artist,
      eventIds: [],
      events: [],
      cities: [],
      countries: [],
      categories: []
    };

    if (recommendation.event_id) {
      current.eventIds.push(recommendation.event_id);
    }

    current.events.push({
      eventId: recommendation.event_id || null,
      eventName: recommendation.event_name || null,
      eventDate: recommendation.event_date || null,
      city: recommendation.city || null,
      country: recommendation.country || null,
      category: recommendation.category || null,
      eventUrl: recommendation.event_url || null,
      shownAt: now
    });

    current.cities.push(recommendation.city);
    current.countries.push(recommendation.country);
    current.categories.push(recommendation.category);
    artistMap.set(artist, current);
  });

  return Array.from(artistMap.values()).map((stat) => ({
    artist: stat.artist,
    filter: {
      userKey: identity.userKey,
      artist: stat.artist
    },
    update: {
      $setOnInsert: {
        userKey: identity.userKey,
        artist: stat.artist,
        firstShownAt: now
      },
      $set: {
        user: {
          email: identity.email,
          name: identity.name,
          image: identity.image,
          authenticated: identity.authenticated
        },
        lastShownAt: now,
        lastEvent: stat.events.at(-1)
      },
      $inc: {
        impressions: stat.events.length
      },
      $addToSet: {
        eventIds: { $each: stat.eventIds.filter(Boolean) },
        cities: { $each: stat.cities.filter(Boolean) },
        countries: { $each: stat.countries.filter(Boolean) },
        categories: { $each: stat.categories.filter(Boolean) },
        recentEvents: { $each: stat.events.slice(-3) }
      }
    }
  }));
}

export async function getAnalyticsOverview() {
  if (!isMongoConfigured()) {
    return emptyOverview("MongoDB is not configured yet.");
  }

  try {
    const db = await getDb();
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

    const [
      totals,
      topPages,
      eventTypes,
      topClicks,
      sessions,
      recommendations,
      topRecommendedArtists,
      recentRecommendationLog,
      latestInsight
    ] = await Promise.all([
      db.collection(EVENT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since }, page: { $not: /^\/analisis/ } } },
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              users: { $addToSet: "$userKey" },
              sessions: { $addToSet: "$sessionId" },
              clicks: { $sum: { $cond: [{ $eq: ["$type", "click"] }, 1, 0] } },
              pageViews: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
              totalDurationMs: { $sum: "$durationMs" }
            }
          },
          {
            $project: {
              _id: 0,
              events: 1,
              users: { $size: "$users" },
              sessions: { $size: "$sessions" },
              clicks: 1,
              pageViews: 1,
              totalDurationMs: 1
            }
          }
        ])
        .toArray(),
      db.collection(EVENT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since }, type: "page_view", page: { $not: /^\/analisis/ } } },
          { $group: { _id: "$page", views: { $sum: 1 }, users: { $addToSet: "$userKey" } } },
          { $project: { _id: 0, page: "$_id", views: 1, users: { $size: "$users" } } },
          { $sort: { views: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      db.collection(EVENT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since }, page: { $not: /^\/analisis/ } } },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $project: { _id: 0, type: "$_id", count: 1 } },
          { $sort: { count: -1 } }
        ])
        .toArray(),
      db.collection(EVENT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since }, type: "click", page: { $not: /^\/analisis/ } } },
          {
            $group: {
              _id: {
                label: "$properties.label",
                href: "$properties.href",
                page: "$page"
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              label: "$_id.label",
              href: "$_id.href",
              page: "$_id.page",
              count: 1
            }
          },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      db.collection(EVENT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since }, page: { $not: /^\/analisis/ } } },
          { $sort: { createdAt: 1 } },
          {
            $group: {
              _id: "$sessionId",
              sessionId: { $last: "$sessionId" },
              userKey: { $last: "$userKey" },
              lastPage: { $last: "$page" },
              eventCount: { $sum: 1 },
              totalDurationMs: { $sum: "$durationMs" },
              clickCount: { $sum: { $cond: [{ $eq: ["$type", "click"] }, 1, 0] } },
              pageViewCount: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
              startedAt: { $min: "$createdAt" },
              lastSeenAt: { $max: "$createdAt" }
            }
          },
          { $project: { _id: 0 } },
          { $sort: { lastSeenAt: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      db.collection(SNAPSHOT_COLLECTION)
        .aggregate([
          { $unwind: "$recommendations" },
          {
            $group: {
              _id: {
                city: "$recommendations.city",
                country: "$recommendations.country",
                category: "$recommendations.category"
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              city: "$_id.city",
              country: "$_id.country",
              category: "$_id.category",
              count: 1
            }
          },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ])
        .toArray(),
      db.collection(ARTIST_STATS_COLLECTION)
        .find({}, { projection: { _id: 0, userKey: 1, artist: 1, impressions: 1, cities: 1, categories: 1, lastShownAt: 1, lastEvent: 1 } })
        .sort({ impressions: -1, lastShownAt: -1 })
        .limit(10)
        .toArray(),
      db.collection(SNAPSHOT_COLLECTION)
        .aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          { $unwind: "$recommendations" },
          {
            $project: {
              _id: 0,
              userKey: 1,
              userName: "$user.name",
              artist: "$recommendations.discovery_artist",
              eventName: "$recommendations.event_name",
              city: "$recommendations.city",
              country: "$recommendations.country",
              category: "$recommendations.category",
              createdAt: 1
            }
          },
          { $match: { artist: { $nin: [null, ""] } } },
          { $limit: 10 }
        ])
        .toArray(),
      db.collection(INSIGHTS_COLLECTION).findOne({}, { sort: { createdAt: -1 }, projection: { _id: 0 } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      totals: totals[0] || emptyOverview().totals,
      topPages,
      eventTypes,
      topClicks,
      sessions,
      recommendations,
      topRecommendedArtists,
      recentRecommendationLog,
      aiInsight: latestInsight?.insight || null
    };
  } catch (error) {
    console.warn("ANALYTICS_OVERVIEW_MONGO_ERROR:", describeMongoError(error));
    return emptyOverview(describeMongoError(error));
  }
}

export function describeMongoError(error) {
  if (error?.code === 8000 || /bad auth|authentication failed/i.test(error?.message || "")) {
    return "MongoDB authentication failed. Check MONGODB_URI credentials, URL-encoded password, database user permissions, and restart the dev server after editing .env.local.";
  }

  if (/querySrv|ENOTFOUND|ETIMEOUT|ECONNREFUSED|ECONNRESET|socket|network/i.test(error?.message || "")) {
    return "MongoDB connection failed. Check Atlas network access/IP allowlist and the cluster host in MONGODB_URI.";
  }

  if (/SSL|TLS|ssl3_read_bytes|tlsv1 alert/i.test(error?.message || "")) {
    return "MongoDB SSL/TLS connection failed. Check the Atlas connection string, cluster status, and local network/SSL interception.";
  }

  return error?.message || "MongoDB analytics connection failed.";
}

export function isMongoConnectionError(error) {
  return Boolean(
    error?.code === 8000 ||
      /bad auth|authentication failed|querySrv|ENOTFOUND|ETIMEOUT|ECONNREFUSED|ECONNRESET|socket|network/i.test(error?.message || "")
  );
}

export async function generateAnalyticsInsight() {
  const overview = await getAnalyticsOverview();

  if (!isMongoConfigured() || !process.env.GEMINI_API_KEY || overview.aiInsight?.summary?.startsWith("MongoDB ")) {
    return {
      insight: localInsight(overview),
      stored: false
    };
  }

  const prompt = `
You are the analytics agent for B-Side Breaks, a Spotify + Skyscanner + Ticketmaster product.
Summarize user behavior for a marketing dashboard.

Data from the last ${overview.windowDays} days:
${JSON.stringify(overview, null, 2)}

Return compact JSON only:
{
  "summary": "1 executive sentence",
  "opportunities": ["concrete action", "concrete action", "concrete action"],
  "risks": ["risk or friction"],
  "partnerNotes": {
    "spotify": "reading for Spotify",
    "skyscanner": "reading for Skyscanner",
    "ticketmaster": "reading for Ticketmaster"
  }
}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.4,
      maxOutputTokens: 700,
      responseMimeType: "application/json"
    }
  });

  const insight = JSON.parse((response.text || "{}").replace(/```json|```/g, "").trim());
  const db = await getDb();

  await db.collection(INSIGHTS_COLLECTION).insertOne({
    insight,
    sourceWindowDays: overview.windowDays,
    createdAt: new Date()
  });

  return { insight, stored: true };
}

function emptyOverview(message = null) {
  return {
    generatedAt: new Date().toISOString(),
    windowDays: 30,
    totals: {
      events: 0,
      users: 0,
      sessions: 0,
      clicks: 0,
      pageViews: 0,
      totalDurationMs: 0
    },
    topPages: [],
    eventTypes: [],
    topClicks: [],
    sessions: [],
    recommendations: [],
    topRecommendedArtists: [],
    recentRecommendationLog: [],
    aiInsight: message ? { summary: message, opportunities: [], risks: [], partnerNotes: {} } : null
  };
}

function localInsight(overview) {
  const mostViewed = overview.topPages?.[0]?.page || "not enough data yet";
  const topClick = overview.topClicks?.[0]?.label || "no clicks yet";

  return {
    summary: `${overview.totals.events} product events have been tracked; the most viewed page is ${mostViewed}.`,
    opportunities: [
      `Optimize the highest-intent action: ${topClick}.`,
      "Compare ticket clicks vs flight clicks to measure Ticketmaster/Skyscanner balance.",
      "Segment upcoming recommendations by music scene and most repeated city."
    ],
    risks: overview.totals.events ? [] : ["There is not enough volume yet for reliable conclusions."],
    partnerNotes: {
      spotify: "Use artists and genres as segmentation signals.",
      skyscanner: "Measure conversion into flight search by destination.",
      ticketmaster: "Measure clicks and interest by recommended event."
    }
  };
}

function sanitizeString(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().slice(0, maxLength);
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(max, Math.max(min, number));
}

function sanitizeProperties(value) {
  if (value == null) {
    return {};
  }

  try {
    const json = JSON.stringify(value);
    if (json.length > MAX_EVENT_PROPERTIES_BYTES) {
      return {
        truncated: true,
        preview: json.slice(0, MAX_EVENT_PROPERTIES_BYTES)
      };
    }

    return JSON.parse(json);
  } catch {
    return {};
  }
}
