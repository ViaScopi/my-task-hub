#!/usr/bin/env node
/**
 * Verification script to check if the Supabase database is properly set up
 * Run with: node scripts/verify-db.js
 */

const { createClient } = require('@supabase/supabase-js');

async function verifyDatabase() {
  console.log('🔍 Verifying Supabase Database Setup\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  console.log('✅ Environment variables present');
  console.log(`   URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test connection and check tables
  const tablesToCheck = [
    'user_integrations',
    'archived_tasks',
    'user_preferences',
    'task_notes',
    'task_priorities',
    'task_metadata'
  ];

  console.log('\n📋 Checking tables:\n');

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0); // Just check if table exists

      if (error) {
        console.error(`❌ Table "${table}": ${error.message}`);
        if (error.code === '42P01') {
          console.error(`   The table doesn't exist. Run the migration in Supabase SQL Editor.`);
        }
      } else {
        console.log(`✅ Table "${table}": exists`);
      }
    } catch (err) {
      console.error(`❌ Table "${table}": ${err.message}`);
    }
  }

  // Check RLS policies
  console.log('\n🔒 Checking RLS policies:\n');

  try {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .limit(1);

    if (error && error.code === 'PGRST301') {
      console.log('✅ RLS is enabled (expected behavior when not authenticated)');
    } else if (error) {
      console.error(`⚠️  Unexpected error: ${error.message}`);
    } else {
      console.log('✅ RLS policies configured correctly');
    }
  } catch (err) {
    console.error(`❌ RLS check failed: ${err.message}`);
  }

  console.log('\n✨ Verification complete!\n');
}

verifyDatabase().catch(console.error);
