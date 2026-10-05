#!/bin/bash
set -e

npm install

# Apply schema changes directly via SQL to avoid drizzle-kit interactive prompts.
# drizzle-kit push hangs when it detects constraint renames and asks for user input
# (stdin is closed during post-merge, causing it to time out).
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const changes = [
    'ALTER TABLE users ALTER COLUMN password DROP NOT NULL',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT',
    \"ALTER TABLE users ALTER COLUMN phone SET DEFAULT ''\",
    \"ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free'\",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_billing_period TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMP',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_start_email_sent_at TIMESTAMP',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMP',
    'CREATE TABLE IF NOT EXISTS renewal_email_deliveries (invoice_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  ];

  for (const sql of changes) {
    try {
      await pool.query(sql);
      console.log('Applied:', sql.substring(0, 70));
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('duplicate') || e.message.includes('does not exist')) {
        console.log('Skipped (already applied):', sql.substring(0, 70));
      } else {
        console.error('Error:', e.message, '|', sql.substring(0, 70));
        process.exit(1);
      }
    }
  }

  await pool.end();
  console.log('Schema migrations complete.');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
"
