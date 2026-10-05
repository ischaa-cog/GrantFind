import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function addPhoneColumn() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    return;
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    // Add phone column as nullable first, then make it required
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;`;
    console.log('✅ Phone column added successfully to users table');
    
    // Update existing users with placeholder phone numbers
    await client`UPDATE users SET phone = '+1-555-' || LPAD(id::text, 4, '0') WHERE phone IS NULL;`;
    console.log('✅ Updated existing users with phone numbers');
    
    // Now make phone column NOT NULL
    await client`ALTER TABLE users ALTER COLUMN phone SET NOT NULL;`;
    console.log('✅ Phone column set to NOT NULL');
    
  } catch (error) {
    console.error('❌ Error migrating phone column:', error);
  } finally {
    await client.end();
  }
}

addPhoneColumn();