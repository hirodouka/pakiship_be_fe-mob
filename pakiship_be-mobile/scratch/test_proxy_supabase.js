const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const originalClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function wrapSupabaseClient(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'schema') {
        return function (schemaName) {
          if (['account', 'parcel', 'driver'].includes(schemaName)) {
            console.log(`[Proxy] Redirecting schema '${schemaName}' -> 'public'`);
            return target.schema('public');
          }
          return target.schema(schemaName);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
  });
}

const proxyClient = wrapSupabaseClient(originalClient);

async function main() {
  console.log("1. Querying account.profiles via proxy...");
  // This should call public.profiles instead of account.profiles.
  // Since public.profiles is empty, it should return an empty array [], whereas account.profiles returns a record johndoe.
  const { data, error } = await proxyClient
    .schema('account')
    .from('profiles')
    .select('id, email, full_name')
    .limit(1);

  if (error) {
    console.error("Proxy error:", error.message);
  } else {
    console.log("Proxy success (should be empty array []):", data);
  }
}

main();
