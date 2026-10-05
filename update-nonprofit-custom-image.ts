import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";
import { eq } from "drizzle-orm";

async function updateNonprofitCustomImage() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Update The Nonprofit Grant with the custom branded image
    const updatedGrant = await db
      .update(grants)
      .set({ 
        imageUrl: "/attached_assets/image_1754931367631.png",
        updatedAt: new Date()
      })
      .where(eq(grants.title, "The Nonprofit Grant"))
      .returning();

    console.log("Updated The Nonprofit Grant with custom branded image");
    console.log("New image URL:", updatedGrant[0]?.imageUrl);

  } catch (error) {
    console.error("Error updating nonprofit grant image:", error);
  } finally {
    await sql.end();
  }
}

updateNonprofitCustomImage();