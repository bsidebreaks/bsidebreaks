import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "bsidebreaks";

let clientPromise;

export async function getMongoClient() {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      retryWrites: true
    });

    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(dbName);
}

export function isMongoConfigured() {
  return Boolean(uri);
}
