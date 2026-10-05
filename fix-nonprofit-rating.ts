import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixNonprofitRating() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update The Nonprofit Grant rating to be within proper range (4.5-5.0)
    const updatedGrant = await db
      .update(grants)
      .set({ 
        rating: 4.8, // Changed from 5.1 to 4.8
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Fixed The Nonprofit Grant rating to 4.8");

    // Check all current grant ratings
    const allGrants = await db.select().from(grants);
    console.log("\nAll grant ratings:");
    allGrants.forEach(grant => {
      console.log(`- ${grant.title}: ${grant.rating}/5.0`);
    });

  } catch (error) {
    console.error("Error fixing nonprofit grant rating:", error);
  } finally {
    await sql.end();
  }
}

fixNonprofitRating();