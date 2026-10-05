import postgres from 'postgres';

async function checkDatabase() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Checking database schema...');
    
    const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables:', tables.map(t => t.table_name));
    
    const columns = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grants' AND table_schema = 'public' ORDER BY ordinal_position`;
    console.log('Grants table columns:', columns);
    
    // Test if we can query grants
    const grantCount = await client`SELECT COUNT(*) as count FROM grants`;
    console.log('Grant count:', grantCount[0].count);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
  }
}

checkDatabase();