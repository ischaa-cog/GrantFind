import postgres from 'postgres';

async function fixSchema() {
  const client = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('Fixing database schema to match application...');
    
    // Drop and recreate the grants table with correct schema
    await client`DROP TABLE IF EXISTS user_grant_applications`;
    await client`DROP TABLE IF EXISTS grants`;
    
    // Create grants table with correct schema
    await client`
      CREATE TABLE grants (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        amount INTEGER NOT NULL,
        deadline TIMESTAMP NOT NULL,
        category TEXT NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        application_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        rating INTEGER DEFAULT 5,
        image_url TEXT,
        is_new BOOLEAN DEFAULT false,
        is_hot BOOLEAN DEFAULT false,
        time_remaining TEXT
      );
    `;
    
    // Recreate user_grant_applications table
    await client`
      CREATE TABLE user_grant_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        grant_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('✓ Tables recreated with correct schema');
    
    // Insert sample grants
    const sampleGrants = [
      {
        title: "Skip Instant Grants #126",
        company: "Technology Startups",
        amount: 1000,
        deadline: new Date("2025-07-26T12:00:00Z"),
        category: "Technology",
        tags: ["$1k", "instant", "tech"],
        description: "Quick funding for technology startups with innovative solutions.",
        requirements: "Must be a registered technology startup with less than 2 years in operation.",
        application_url: "https://example.com/apply/126",
        status: "active",
        rating: 49,
        image_url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        is_new: true,
        time_remaining: "34H : 39M : 40S"
      },
      {
        title: "She's Connected by AT&T",
        company: "AT&T",
        amount: 50000,
        deadline: new Date("2025-10-01T09:00:00Z"),
        category: "Women-owned Businesses",
        tags: ["$50k", "women", "telecom"],
        description: "Supporting women-owned businesses in the telecommunications sector.",
        requirements: "Must be a women-owned business with focus on technology or telecommunications.",
        application_url: "https://example.com/apply/att",
        status: "active",
        rating: 48,
        image_url: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      },
      {
        title: "Prose AANHPI $10k Grant",
        company: "Prose",
        amount: 10000,
        deadline: new Date("2025-08-02T09:00:00Z"),
        category: "Beauty & Personal Care",
        tags: ["$10k", "beauty", "diversity"],
        description: "Supporting AANHPI entrepreneurs in the beauty and personal care industry.",
        requirements: "Must be an AANHPI-owned business in beauty or personal care sector.",
        application_url: "https://example.com/apply/prose",
        status: "active",
        rating: 48,
        image_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      },
      {
        title: "AmEx Backing Small Businesses Grant",
        company: "American Express",
        amount: 10000,
        deadline: new Date("2025-08-01T10:00:00Z"),
        category: "Small Businesses",
        tags: ["$10k", "small-business", "finance"],
        description: "American Express program to support small businesses across various industries.",
        requirements: "Must be a registered small business with less than 50 employees.",
        application_url: "https://example.com/apply/amex",
        status: "active",
        rating: 47,
        image_url: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      },
      {
        title: "America's Top 100 Small Businesses",
        company: "Recognition Program",
        amount: 25000,
        deadline: new Date("2025-07-26T09:00:00Z"),
        category: "Recognition Program",
        tags: ["$25k", "recognition", "small-business"],
        description: "Recognition and funding program for America's top small businesses.",
        requirements: "Must demonstrate exceptional business growth and community impact.",
        application_url: "https://example.com/apply/top100",
        status: "active",
        rating: 46,
        image_url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        is_hot: true,
        time_remaining: "43H : 38M : 40S"
      },
      {
        title: "Galaxy Grants",
        company: "Technology Innovation",
        amount: 2950,
        deadline: new Date("2025-07-26T12:00:00Z"),
        category: "Technology Innovation",
        tags: ["$2.5k", "innovation", "tech"],
        description: "Supporting innovative technology solutions for the future.",
        requirements: "Must have a working prototype of innovative technology solution.",
        application_url: "https://example.com/apply/galaxy",
        status: "active",
        rating: 49,
        image_url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      },
      {
        title: "Skip $10,000 Summer",
        company: "Skip",
        amount: 10000,
        deadline: new Date("2025-10-01T09:00:00Z"),
        category: "Summer Entrepreneurs",
        tags: ["$10k", "summer", "entrepreneurs"],
        description: "Summer funding program for young entrepreneurs with innovative ideas.",
        requirements: "Must be under 30 years old with a business idea in early stages.",
        application_url: "https://example.com/apply/summer",
        status: "active",
        rating: 48,
        image_url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      },
      {
        title: "Alibaba CoCreate Pitch",
        company: "Alibaba",
        amount: 200000,
        deadline: new Date("2025-08-02T09:00:00Z"),
        category: "E-commerce Startups",
        tags: ["$200k", "ecommerce", "alibaba"],
        description: "Large funding opportunity for e-commerce startups with global potential.",
        requirements: "Must be an e-commerce startup with international expansion plans.",
        application_url: "https://example.com/apply/alibaba",
        status: "active",
        rating: 47,
        image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"
      }
    ];
    
    // Insert grants
    for (const grant of sampleGrants) {
      await client`
        INSERT INTO grants (title, company, amount, deadline, category, tags, description, requirements, application_url, status, rating, image_url, is_new, is_hot, time_remaining)
        VALUES (${grant.title}, ${grant.company}, ${grant.amount}, ${grant.deadline}, ${grant.category}, ${grant.tags}, ${grant.description}, ${grant.requirements}, ${grant.application_url || null}, ${grant.status}, ${grant.rating}, ${grant.image_url || null}, ${grant.is_new || false}, ${grant.is_hot || false}, ${grant.time_remaining || null})
      `;
    }
    
    console.log('✓ Sample grants inserted successfully');
    
    // Verify the schema
    const columns = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grants' AND table_schema = 'public' ORDER BY ordinal_position`;
    console.log('✓ Final schema:', columns.map(c => `${c.column_name}: ${c.data_type}`));
    
    const grantCount = await client`SELECT COUNT(*) as count FROM grants`;
    console.log(`✓ Database now contains ${grantCount[0].count} grants`);
    
  } catch (error) {
    console.error('Schema fix failed:', error);
  } finally {
    await client.end();
  }
}

fixSchema();