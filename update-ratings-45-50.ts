import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function updateRatings4550() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update ratings to be in 45-50 range (representing 4.5-5.0)
    const updates = [
      { title: "Greatness Grant", rating: 50 },        // 5.0/5
      { title: "Legacy Grant", rating: 48 },           // 4.8/5
      { title: "Biz Starter Grant", rating: 49 },      // 4.9/5
      { title: "The Nonprofit Grant", rating: 47 }     // 4.7/5
    ];

    for (const update of updates) {
      await db
        .update(grants)
        .set({ 
          rating: update.rating,
          updatedAt: new Date()
        })
        .where(eq(grants.title, update.title));
      
      const displayRating = update.rating / 10;
      console.log(`Updated ${update.title} to rating ${displayRating}/5.0 (stored as ${update.rating})`);
    }

    // Verify ratings
    const allGrants = await db.select().from(grants);
    console.log("\nFinal grant ratings (4.5-5.0 range):");
    allGrants.forEach(grant => {
      const displayRating = grant.rating / 10;
      console.log(`- ${grant.title}: ${displayRating}/5.0`);
    });

  } catch (error) {
    console.error("Error updating ratings:", error);
  } finally {
    await sql.end();
  }
}

updateRatings4550();