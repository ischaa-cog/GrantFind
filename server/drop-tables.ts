import { neon } from "@neondatabase/serverless";

async function dropTables() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not found");
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    await sql`DROP TABLE IF EXISTS user_grant_applications CASCADE`;
    await sql`DROP TABLE IF EXISTS grants CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP TABLE IF EXISTS companies CASCADE`;
    await sql`DROP TABLE IF EXISTS form_fields CASCADE`;
    await sql`DROP TABLE IF EXISTS form_templates CASCADE`;
    
    console.log("Tables dropped successfully");
  } catch (error) {
    console.error("Error dropping tables:", error);
  }
}

dropTables().then(() => process.exit(0));