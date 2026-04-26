import "dotenv/config";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "bsidebreaks";

if (!uri) {
  throw new Error("MONGODB_URI is required");
}

const client = new MongoClient(uri);
const db = client.db(dbName);

await client.connect();

await Promise.all([
  db.collection("analytics_events").createIndexes([
    { key: { createdAt: -1 } },
    { key: { userKey: 1, createdAt: -1 } },
    { key: { sessionId: 1, createdAt: 1 } },
    { key: { type: 1, createdAt: -1 } },
    { key: { page: 1, createdAt: -1 } }
  ]),
  db.collection("user_sessions").createIndexes([
    { key: { sessionId: 1 }, unique: true },
    { key: { userKey: 1, startedAt: -1 } },
    { key: { lastSeenAt: -1 } }
  ]),
  db.collection("users").createIndexes([
    { key: { userKey: 1 }, unique: true },
    { key: { lastSeenAt: -1 } }
  ]),
  db.collection("ai_insights").createIndexes([{ key: { createdAt: -1 } }]),
  db.collection("recommendation_snapshots").createIndexes([
    { key: { userKey: 1, createdAt: -1 } },
    { key: { "recommendations.event_id": 1 } }
  ]),
  db.collection("recommendation_artist_stats").createIndexes([
    { key: { userKey: 1, artist: 1 }, unique: true },
    { key: { artist: 1, impressions: -1 } },
    { key: { lastShownAt: -1 } }
  ])
]);

await client.close();

console.log(`MongoDB indexes ready in database "${dbName}".`);
