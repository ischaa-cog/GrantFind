import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function normalizeAllRatings() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Normalize all ratings to proper 1-5 scale
    const updates = [
      { title: "Greatness Grant", rating: 5 },    // was 50
      { title: "Legacy Grant", rating: 5 },       // was 48  
      { title: "Biz Starter Grant", rating: 5 },  // was 52, now 5
      { title: "The Nonprofit Grant", rating: 5 } // was 51, now 5
    ];

    for (const update of updates) {
      await db
        .update(grants)
        .set({ 
          rating: update.rating,
          updatedAt: new Date()
        })
        .where(eq(grants.title, update.title));
      
      console.log(`Updated ${update.title} to rating ${update.rating}/5`);
    }

    // Verify all ratings are now proper
    const allGrants = await db.select().from(grants);
    console.log("\nFinal grant ratings (proper 1-5 scale):");
    allGrants.forEach(grant => {
      console.log(`- ${grant.title}: ${grant.rating}/5`);
    });

  } catch (error) {
    console.error("Error normalizing grant ratings:", error);
  } finally {
    await sql.end();
  }
}

normalizeAllRatings();