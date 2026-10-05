import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { userBusinesses } from "./shared/schema";

async function createUserBusinessesTable() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    console.log("Creating user_businesses table...");
    
    // Create the table manually with SQL
    await client`
      CREATE TABLE IF NOT EXISTS user_businesses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        subcategory TEXT,
        entity_type TEXT,
        year_established TEXT,
        zip_code TEXT,
        website TEXT,
        revenue TEXT,
        business_type TEXT NOT NULL,
        interests TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    console.log("✓ user_businesses table created successfully!");
    
    // Verify the table exists
    const result = await client`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_businesses'
    `;
    
    if (result.length > 0) {
      console.log("✓ Table verified in database");
    } else {
      console.log("✗ Table not found after creation");
    }
    
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await client.end();
  }
}

createUserBusinessesTable();