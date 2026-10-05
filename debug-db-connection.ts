import postgres from 'postgres';

async function debugConnection() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('=== DATABASE CONNECTION DEBUG ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // Get database info
    const dbInfo = await client`SELECT current_database(), current_user`;
    console.log('Connected to database:', dbInfo[0].current_database);
    console.log('Connected as user:', dbInfo[0].current_user);
    
    // List all tables
    const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Available tables:', tables.map(t => t.table_name));
    
    // Check grants table structure
    const columns = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grants' AND table_schema = 'public' ORDER BY ordinal_position`;
    console.log('Grants table columns:', columns);
    
    // Count grants
    const grantCount = await client`SELECT COUNT(*) as count FROM grants`;
    console.log('Total grants in database:', grantCount[0].count);
    
    // Fetch all grants with their IDs
    const allGrants = await client`SELECT id, title, company FROM grants ORDER BY id`;
    console.log('All grants in database:');
    allGrants.forEach(grant => {
      console.log(`  ID ${grant.id}: ${grant.title} (${grant.company})`);
    });
    
    // Test the exact query our application uses
    console.log('\n=== TESTING APPLICATION QUERY ===');
    const appGrants = await client`SELECT * FROM grants`;
    console.log('Query result count:', appGrants.length);
    console.log('First grant:', appGrants[0] ? {
      id: appGrants[0].id,
      title: appGrants[0].title,
      company: appGrants[0].company
    } : 'None');
    
  } catch (error) {
    console.error('Database debug failed:', error);
  } finally {
    await client.end();
  }
}

debugConnection();