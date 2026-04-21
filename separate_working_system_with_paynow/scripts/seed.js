/**
 * Database seed script – creates the initial admin account.
 * Run with: node scripts/seed.js
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const email = process.env.SEED_ADMIN_EMAIL.toLowerCase();
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Administrator';

  // Check if admin already exists
  const { data: existing } = await supabase
    .from('admins')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const { data, error } = await supabase
    .from('admins')
    .insert({ email, password_hash: passwordHash, name, role: 'superadmin' })
    .select('id, email, name, role')
    .single();

  if (error) {
    console.error('Failed to create admin:', error.message);
    process.exit(1);
  }

  console.log('✅ Admin created:');
  console.table(data);
}

main().catch(console.error);
