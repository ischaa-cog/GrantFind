import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function addPhoneColumn() {
  try {
    // Add phone column to users table
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`;
    console.log('Phone column added successfully to users table.');
  } catch (error) {
    console.error('Error adding phone column:', error);
  }
}

addPhoneColumn();