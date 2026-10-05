import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { grants } from "./shared/schema";

async function verifyDatabaseRatings() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    console.log("=== DATABASE RATING VERIFICATION ===\n");
    
    // Fetch all grants from database
    const allGrants = await db.select().from(grants);
    
    console.log("Raw database values:");
    allGrants.forEach(grant => {
      console.log(`- ${grant.title}: ${grant.rating} (raw database value)`);
    });
    
    console.log("\nDisplay values (what frontend shows):");
    allGrants.forEach(grant => {
      const displayRating = (grant.rating / 10).toFixed(1);
      console.log(`- ${grant.title}: ${displayRating}/5.0`);
    });
    
    console.log("\nVerification:");
    const expectedRatings = {
      "Greatness Grant": 50,      // Should display as 5.0
      "Legacy Grant": 48,         // Should display as 4.8
      "Biz Starter Grant": 49,    // Should display as 4.9
      "The Nonprofit Grant": 47   // Should display as 4.7
    };
    
    let allCorrect = true;
    allGrants.forEach(grant => {
      const expected = expectedRatings[grant.title];
      const actual = grant.rating;
      const match = expected === actual;
      
      console.log(`${grant.title}: ${match ? '✓' : '✗'} Expected ${expected}, Got ${actual}`);
      if (!match) allCorrect = false;
    });
    
    console.log(`\nOverall verification: ${allCorrect ? '✓ ALL CORRECT' : '✗ ISSUES FOUND'}`);
    
    // Check if all ratings are in 4.5-5.0 range (45-50 in database)
    const ratingsInRange = allGrants.every(grant => grant.rating >= 45 && grant.rating <= 50);
    console.log(`Ratings in 4.5-5.0 range: ${ratingsInRange ? '✓ YES' : '✗ NO'}`);

  } catch (error) {
    console.error("Error verifying database ratings:", error);
  } finally {
    await sql.end();
  }
}

verifyDatabaseRatings();