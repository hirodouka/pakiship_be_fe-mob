const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== MIGRATION TO PUBLIC SCHEMA STARTED ===\n");

  // 1. Copy profiles
  console.log("1. Fetching all profiles from account.profiles...");
  const { data: profiles, error: getProfilesErr } = await supabase
    .schema('account')
    .from('profiles')
    .select('*');

  if (getProfilesErr) {
    console.error("Failed to fetch profiles:", getProfilesErr.message);
  } else {
    console.log(`Fetched ${profiles.length} profiles.`);
    if (profiles.length > 0) {
      console.log("Upserting profiles to public.profiles...");
      const { error: upsertProfilesErr } = await supabase
        .from('profiles') // public schema
        .upsert(profiles);

      if (upsertProfilesErr) {
        console.error("Failed to upsert profiles:", upsertProfilesErr.message);
      } else {
        console.log("Successfully migrated all profiles to public.profiles!");
      }
    }
  }

  // 2. Copy parcel drafts
  console.log("\n2. Fetching all parcel drafts from parcel.parcel_drafts...");
  const { data: drafts, error: getDraftsErr } = await supabase
    .schema('parcel')
    .from('parcel_drafts')
    .select('*');

  if (getDraftsErr) {
    console.error("Failed to fetch parcel drafts:", getDraftsErr.message);
  } else {
    console.log(`Fetched ${drafts.length} parcel drafts.`);
    if (drafts.length > 0) {
      console.log("Upserting parcel drafts to public.parcel_drafts...");
      const { error: upsertDraftsErr } = await supabase
        .from('parcel_drafts') // public schema
        .upsert(drafts);

      if (upsertDraftsErr) {
        console.error("Failed to upsert parcel drafts:", upsertDraftsErr.message);
      } else {
        console.log("Successfully migrated all parcel drafts to public.parcel_drafts!");
      }
    }
  }

  console.log("\n=== MIGRATION COMPLETED ===");
}

main();
