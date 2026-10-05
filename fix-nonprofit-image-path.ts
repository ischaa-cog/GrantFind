import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixNonprofitImagePath() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update The Nonprofit Grant with the correct public image path
    const updatedGrant = await db
      .update(grants)
      .set({ 
        imageUrl: "/nonprofit-grant-image.png",
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Updated The Nonprofit Grant with correct public image path");
    console.log("New image URL:", updatedGrant[0]?.imageUrl);

  } catch (error) {
    console.error("Error updating nonprofit grant image path:", error);
  } finally {
    await sql.end();
  }
}

fixNonprofitImagePath();