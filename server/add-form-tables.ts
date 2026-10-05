import { neon } from "@neondatabase/serverless";

async function addFormBuilderTables() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not found");
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    console.log("🔗 Connected to Supabase database");
    
    // Check existing tables first
    console.log("📋 Checking existing tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log("Existing tables:", tables.map(t => t.table_name).join(", "));

    // Create form_templates table if it doesn't exist
    console.log("📝 Creating form_templates table...");
    await sql`
      CREATE TABLE IF NOT EXISTS form_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create form_fields table if it doesn't exist
    console.log("🔧 Creating form_fields table...");
    await sql`
      CREATE TABLE IF NOT EXISTS form_fields (
        id SERIAL PRIMARY KEY,
        form_template_id INTEGER NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
        field_type TEXT NOT NULL,
        label TEXT NOT NULL,
        placeholder TEXT,
        required BOOLEAN DEFAULT FALSE,
        options TEXT[],
        sort_order INTEGER DEFAULT 0
      )
    `;

    // Add form_template_id to grants table if it doesn't exist
    console.log("🔗 Adding form_template_id reference to grants table...");
    await sql`
      ALTER TABLE grants 
      ADD COLUMN IF NOT EXISTS form_template_id INTEGER REFERENCES form_templates(id)
    `;

    // Add textContent column to form_fields table if it doesn't exist
    console.log("📝 Adding textContent column to form_fields table...");
    await sql`
      ALTER TABLE form_fields 
      ADD COLUMN IF NOT EXISTS text_content TEXT
    `;

    // Add linkUrl column to form_fields table if it doesn't exist
    console.log("🔗 Adding linkUrl column to form_fields table...");
    await sql`
      ALTER TABLE form_fields 
      ADD COLUMN IF NOT EXISTS link_url TEXT
    `;

    // Verify new tables were created
    console.log("✅ Verifying new tables...");
    const updatedTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log("Updated tables:", updatedTables.map(t => t.table_name).join(", "));

    // Check form_templates table structure
    const formTemplatesCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'form_templates' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log("📋 form_templates columns:", formTemplatesCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    // Check form_fields table structure  
    const formFieldsCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'form_fields' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log("🔧 form_fields columns:", formFieldsCols.map(c => `${c.column_name} (${c.data_type})`).join(", "));

    console.log("🎉 Form builder tables added successfully to Supabase!");
    console.log("⚠️  No existing data was modified or deleted.");
    
  } catch (error) {
    console.error("❌ Error adding form builder tables:", error);
  }
}

addFormBuilderTables().then(() => process.exit(0));