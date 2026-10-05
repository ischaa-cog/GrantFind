import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixAllGrantRatings() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Fix Biz Starter Grant rating (currently 52, change to 5 = 5.0/5.0)
    await db
      .update(grants)
      .set({ 
        rating: 5, // 5.0/5.0
        updatedAt: new Date()
      })
      .where(eq(grants.title, "Biz Starter Grant"));

    // Fix The Nonprofit Grant rating (currently 48, change to 5 = 5.0/5.0)  
    await db
      .update(grants)
      .set({ 
        rating: 5, // 5.0/5.0
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"));

    console.log("Fixed all grant ratings to proper 1-5 scale");

    // Verify all ratings are now proper
    const allGrants = await db.select().from(grants);
    console.log("\nAll grant ratings (1-5 scale):");
    allGrants.forEach(grant => {
      console.log(`- ${grant.title}: ${grant.rating}/5`);
    });

  } catch (error) {
    console.error("Error fixing grant ratings:", error);
  } finally {
    await sql.end();
  }
}

fixAllGrantRatings();