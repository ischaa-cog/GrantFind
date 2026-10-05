import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function updateGrantDeadlines() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update Biz Starter Grant deadline to August 13th at 11:59PM EST
    const bizStarterUpdate = await db
      .update(grants)
      .set({ 
        deadline: new Date("2025-08-14T04:59:59Z"), // EST is UTC-5, so 11:59PM EST = 4:59AM UTC next day
        updatedAt: new Date()
      })
      .where(eq(grants.title, "Biz Starter Grant"))
      .returning();

    // Update The Nonprofit Grant deadline to August 18th at 11:59PM EST  
    const nonprofitUpdate = await db
      .update(grants)
      .set({ 
        deadline: new Date("2025-08-19T04:59:59Z"), // EST is UTC-5, so 11:59PM EST = 4:59AM UTC next day
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Updated Biz Starter Grant deadline:", bizStarterUpdate[0]?.deadline);
    console.log("Updated The Nonprofit Grant deadline:", nonprofitUpdate[0]?.deadline);

    // Show all current grants with their deadlines
    const allGrants = await db.select().from(grants);
    console.log("\nAll grants with updated deadlines:");
    allGrants.forEach(grant => {
      const deadlineEST = new Date(grant.deadline).toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "long", 
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      });
      console.log(`- ${grant.title}: ${deadlineEST}`);
    });

  } catch (error) {
    console.error("Error updating grant deadlines:", error);
  } finally {
    await sql.end();
  }
}

updateGrantDeadlines();