import { neon } from '@neondatabase/serverless';

async function testConnection() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    console.log('Database connection successful:', result[0]);
    
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS grants (
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
    
    await sql`
      CREATE TABLE IF NOT EXISTS user_grant_applications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        grant_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    console.log('Tables created successfully');
    
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
      }
    ];
    
    for (const grant of sampleGrants) {
      await sql`
        INSERT INTO grants (title, company, amount, deadline, category, tags, description, requirements, application_url, status, rating, image_url, is_new, is_hot, time_remaining)
        VALUES (${grant.title}, ${grant.company}, ${grant.amount}, ${grant.deadline}, ${grant.category}, ${grant.tags}, ${grant.description}, ${grant.requirements}, ${grant.application_url}, ${grant.status}, ${grant.rating}, ${grant.image_url}, ${grant.is_new || false}, ${grant.is_hot || false}, ${grant.time_remaining})
        ON CONFLICT DO NOTHING
      `;
    }
    
    console.log('Sample grants inserted successfully');
    
  } catch (error) {
    console.error('Database error:', error);
  }
}

testConnection();