import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixExactDeadlines() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update Biz Starter Grant deadline to August 13th at 11:59PM EST
    // EST is UTC-5, so 11:59PM EST on Aug 13 = 4:59AM UTC on Aug 14
    const bizStarterUpdate = await db
      .update(grants)
      .set({ 
        deadline: new Date("2025-08-14T04:59:59.000Z"),
        updatedAt: new Date()
      })
      .where(eq(grants.title, "Biz Starter Grant"))
      .returning();

    // Update The Nonprofit Grant deadline to August 18th at 11:59PM EST
    // EST is UTC-5, so 11:59PM EST on Aug 18 = 4:59AM UTC on Aug 19
    const nonprofitUpdate = await db
      .update(grants)
      .set({ 
        deadline: new Date("2025-08-19T04:59:59.000Z"),
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Updated deadlines:");
    console.log(`Biz Starter Grant: August 13th at 11:59PM EST (stored as ${bizStarterUpdate[0]?.deadline})`);
    console.log(`The Nonprofit Grant: August 18th at 11:59PM EST (stored as ${nonprofitUpdate[0]?.deadline})`);

    // Verify the updates
    const updatedGrants = await db.select().from(grants).where(eq(grants.title, "Biz Starter Grant"));
    const updatedNonprofit = await db.select().from(grants).where(eq(grants.title, "The Nonprofit Grant"));
    
    console.log("\nVerification:");
    console.log(`Biz Starter Grant deadline in DB: ${updatedGrants[0]?.deadline}`);
    console.log(`The Nonprofit Grant deadline in DB: ${updatedNonprofit[0]?.deadline}`);

  } catch (error) {
    console.error("Error updating deadlines:", error);
  } finally {
    await sql.end();
  }
}

fixExactDeadlines();