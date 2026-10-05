import postgres from 'postgres';

async function updateSchema() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Updating users table schema...');
    
    // Add email column if it doesn't exist
    await client`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email text UNIQUE,
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS last_name text,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW()
    `;
    
    // Drop username column if it exists (from old schema)
    try {
      await client`ALTER TABLE users DROP COLUMN IF EXISTS username`;
    } catch (error) {
      console.log('Username column might not exist, continuing...');
    }

    // Make firstName and lastName NOT NULL
    await client`
      ALTER TABLE users 
      ALTER COLUMN email SET NOT NULL,
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name SET NOT NULL
    `;
    
    console.log('✓ Schema updated successfully');
    
    // Check final schema
    const columns = await client`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' ORDER BY ordinal_position`;
    console.log('Current users table schema:', columns);
    
  } catch (error) {
    console.error('Schema update failed:', error);
  } finally {
    await client.end();
  }
}

updateSchema();