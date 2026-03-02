import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "";

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!MONGODB_URI) {
  // During build, we might not have the URI. Create a dummy promise that throws on actual use.
  clientPromise = Promise.reject(new Error('MONGODB_URI is not defined')) as unknown as Promise<MongoClient>;
} else {
  if (process.env.NODE_ENV === 'development') {
    const g = global as unknown as { _mongoClientPromise?: Promise<MongoClient> };
    if (!g._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI);
      g._mongoClientPromise = client.connect();
    }
    clientPromise = g._mongoClientPromise;
  } else {
    client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }
}

/**
 * Returns a database instance for a specific user or the main auth database.
 * @param dbName Optional name of the database. If not provided, returns the default 'tradelog_main' database.
 */
export async function getDb(dbName: string = 'tradelog_main') {
  const client = await clientPromise;
  return client.db(dbName);
}

/**
 * Helper to get the isolated database for a specific user.
 * Each user has their own database name stored in their account.
 */
export async function getUserDb(dbName: string) {
  if (!dbName) throw new Error('Database name is required for isolated access');
  const client = await clientPromise;
  return client.db(dbName);
}

export default clientPromise;

