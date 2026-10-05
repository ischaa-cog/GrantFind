import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

async function createFormBuilderTables() {
  if (!process.env.DATABASE_URL) {
    console.log("❌ DATABASE_URL not found");
    return;
  }

  try {
    console.log("🔗 Connecting to Supabase...");
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Test connection first
    await sql`SELECT 1 as test`;
    console.log("✅ Connected to Supabase successfully");

    // Check what tables currently exist
    const existingTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log("📋 Current tables:", existingTables.map(t => t.table_name).join(", "));

    // Create form_templates table
    console.log("📝 Creating form_templates table...");
    await sql`
      CREATE TABLE IF NOT EXISTS form_templates (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ form_templates table created");

    // Create form_fields table
    console.log("🔧 Creating form_fields table...");
    await sql`
      CREATE TABLE IF NOT EXISTS form_fields (
        id SERIAL PRIMARY KEY,
        form_template_id INTEGER NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
        field_type TEXT NOT NULL,
        label TEXT NOT NULL,
        placeholder TEXT,
        required BOOLEAN DEFAULT false,
        options TEXT[],
        sort_order INTEGER DEFAULT 0
      )
    `;
    console.log("✅ form_fields table created");

    // Verify the tables were created
    const updatedTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log("📋 Updated tables:", updatedTables.map(t => t.table_name).join(", "));

    // Check if form_templates exists in the list
    const hasFormTemplates = updatedTables.some(t => t.table_name === 'form_templates');
    const hasFormFields = updatedTables.some(t => t.table_name === 'form_fields');

    if (hasFormTemplates && hasFormFields) {
      console.log("🎉 SUCCESS: Form builder tables added to Supabase!");
      console.log("✅ form_templates table: Ready");
      console.log("✅ form_fields table: Ready");
      console.log("⚠️  No existing data was modified");
    } else {
      console.log("⚠️  Some tables may not have been created properly");
    }

  } catch (error) {
    console.error("❌ Error creating form builder tables:", error);
  }
}

// Run the function
createFormBuilderTables().then(() => {
  console.log("🏁 Form table creation process completed");
  process.exit(0);
}).catch(error => {
  console.error("💥 Process failed:", error);
  process.exit(1);
});