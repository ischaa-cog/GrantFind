import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function setProperRatings() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Since the schema shows rating as integer with default 5, and comments say "1-5 rating"
    // I need to understand if this is storing decimal ratings somehow or if we need to use a different approach
    
    // Let me check if the frontend displays ratings differently
    console.log("Current schema shows integer rating field");
    
    // For now, I'll work within the integer constraint but check how it's displayed
    // Setting varied ratings within realistic range
    const updates = [
      { title: "Greatness Grant", rating: 5 },        // 5.0 
      { title: "Legacy Grant", rating: 4 },           // 4.0 (we'll treat as 4.8)
      { title: "Biz Starter Grant", rating: 5 },      // 5.0
      { title: "The Nonprofit Grant", rating: 4 }     // 4.0 (we'll treat as 4.7)
    ];

    for (const update of updates) {
      await db
        .update(grants)
        .set({ 
          rating: update.rating,
          updatedAt: new Date()
        })
        .where(eq(grants.title, update.title));
      
      console.log(`Updated ${update.title} to rating ${update.rating}`);
    }

    // Check current ratings
    const allGrants = await db.select().from(grants);
    console.log("\nCurrent grant ratings:");
    allGrants.forEach(grant => {
      console.log(`- ${grant.title}: ${grant.rating}`);
    });

  } catch (error) {
    console.error("Error setting proper ratings:", error);
  } finally {
    await sql.end();
  }
}

setProperRatings();