import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function updateNonprofitImage() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update The Nonprofit Grant with a more relevant image
    const updatedGrant = await db
      .update(grants)
      .set({ 
        imageUrl: "https://images.unsplash.com/photo-1593113598332-cd288d649433?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Updated The Nonprofit Grant image successfully");
    console.log("New image URL:", updatedGrant[0]?.imageUrl);

  } catch (error) {
    console.error("Error updating nonprofit grant image:", error);
  } finally {
    await sql.end();
  }
}

updateNonprofitImage();