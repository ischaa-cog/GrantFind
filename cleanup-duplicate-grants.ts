import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq, and, gt } from "drizzle-orm";

async function cleanupDuplicateGrants() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Delete duplicate Greatness Grant (keep the original, delete newer ones)
    const duplicateGreatnessGrants = await db
      .delete(grants)
      .where(and(
        eq(grants.title, "Greatness Grant"),
        gt(grants.id, 75) // Delete any with ID > 75
      ))
      .returning();

    // Delete duplicate Legacy Grant (keep the original, delete newer ones)  
    const duplicateLegacyGrants = await db
      .delete(grants)
      .where(and(
        eq(grants.title, "Legacy Grant"),
        gt(grants.id, 76) // Delete any with ID > 76
      ))
      .returning();

    console.log("Deleted duplicate Greatness Grants:", duplicateGreatnessGrants.length);
    console.log("Deleted duplicate Legacy Grants:", duplicateLegacyGrants.length);

    // Show remaining grants
    const remainingGrants = await db.select().from(grants);
    console.log("Remaining grants:");
    remainingGrants.forEach(grant => {
      console.log(`- ID: ${grant.id}, Title: ${grant.title}, Company: ${grant.company}`);
    });

  } catch (error) {
    console.error("Error cleaning up grants:", error);
  } finally {
    await sql.end();
  }
}

cleanupDuplicateGrants();