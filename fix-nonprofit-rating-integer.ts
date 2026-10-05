import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixNonprofitRatingInteger() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update The Nonprofit Grant rating to be within proper range (use integer scale 45-50 representing 4.5-5.0)
    const updatedGrant = await db
      .update(grants)
      .set({ 
        rating: 48, // Changed from 51 to 48 (representing 4.8)
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Fixed The Nonprofit Grant rating to 48 (4.8/5.0)");

    // Check all current grant ratings
    const allGrants = await db.select().from(grants);
    console.log("\nAll grant ratings (out of 50, representing x/5.0):");
    allGrants.forEach(grant => {
      const actualRating = grant.rating / 10; // Convert back to 5.0 scale
      console.log(`- ${grant.title}: ${actualRating}/5.0 (stored as ${grant.rating})`);
    });

  } catch (error) {
    console.error("Error fixing nonprofit grant rating:", error);
  } finally {
    await sql.end();
  }
}

fixNonprofitRatingInteger();