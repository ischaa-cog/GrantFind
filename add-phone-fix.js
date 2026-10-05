import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function addPhoneColumn() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`;
    console.log("Phone column added successfully");
  } catch (error) {
    console.error("Error:", error);
  }
}

addPhoneColumn();