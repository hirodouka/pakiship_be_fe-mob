const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'd775924e-f87a-42c7-90d1-1eeeee5de10a';

async function diagnose() {
  console.log('=== DIAGNOSING PROFILE FETCH INDIVIDUAL QUERIES ===\n');

  // Query 1: profiles table
  console.log('--- Query 1: profiles table select ---');
  try {
    const { data: profile, error: profileError } = await admin
      .schema("account")
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        dob,
        address,
        city,
        province,
        profile_picture,
        discount_id_uploaded,
        discount_id_type,
        discount_id_status,
        discount_id_file_url,
        discount_id_submitted_at,
        discount_id_verified_at,
        two_factor_enabled,
        password_updated_at,
        created_at
      `)
      .eq("id", userId)
      .single();

    if (profileError) {
      console.log('❌ Query 1 Error:', profileError);
    } else {
      console.log('✅ Query 1 Success! Data:', profile);
    }
  } catch (e) {
    console.log('❌ Query 1 Exception:', e.message);
  }

  // Query 2: auth user
  console.log('\n--- Query 2: auth user ---');
  try {
    const res = await admin.auth.admin.getUserById(userId);
    if (res.error) {
      console.log('❌ Query 2 Error:', res.error);
    } else {
      console.log('✅ Query 2 Success! User exists.');
    }
  } catch (e) {
    console.log('❌ Query 2 Exception:', e.message);
  }

  // Query 3: parcel_drafts count
  console.log('\n--- Query 3: parcel_drafts count ---');
  try {
    const { data, count, error } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "submitted");

    if (error) {
      console.log('❌ Query 3 Error:', error);
    } else {
      console.log('✅ Query 3 Success! Count:', count);
    }
  } catch (e) {
    console.log('❌ Query 3 Exception:', e.message);
  }

  // Query 4: parcel_activity_logs
  console.log('\n--- Query 4: parcel_activity_logs ---');
  try {
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_activity_logs")
      .select("id, activity_type, title, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.log('❌ Query 4 Error:', error);
    } else {
      console.log('✅ Query 4 Success! Rows:', data.length);
    }
  } catch (e) {
    console.log('❌ Query 4 Exception:', e.message);
  }
}

diagnose();
