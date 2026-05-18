const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const johndoeUserId = '930f6d2c-7338-4b0c-9824-9d41faefbb65';

async function main() {
  console.log("Creating test notifications for johndoe...");

  // 1. Insert into notifications.notifications
  const { data: n1, error: err1 } = await supabase
    .schema('notifications')
    .from('notifications')
    .insert([
      {
        user_id: johndoeUserId,
        type: 'delivery',
        title: 'Parcel Out for Delivery',
        message: 'Your package PKS-2026-350252 is out for delivery with driver Clark Kent.',
        is_read: false,
        source_service: 'pakiship'
      },
      {
        user_id: johndoeUserId,
        type: 'system',
        title: 'Profile details updated',
        message: 'Your customer profile has been successfully synchronized and verified.',
        is_read: false,
        source_service: 'pakiship'
      }
    ])
    .select();

  if (err1) {
    console.error("notifications.notifications insert error:", err1.message);
  } else {
    console.log("Successfully inserted into notifications.notifications:", n1);
  }

  // 2. Insert into account.customer_notifications
  const { data: n2, error: err2 } = await supabase
    .schema('account')
    .from('customer_notifications')
    .insert([
      {
        user_id: johndoeUserId,
        type: 'delivery',
        title: 'Parcel Out for Delivery',
        message: 'Your package PKS-2026-350252 is out for delivery with driver Clark Kent.',
        is_read: false
      },
      {
        user_id: johndoeUserId,
        type: 'system',
        title: 'Profile details updated',
        message: 'Your customer profile has been successfully synchronized and verified.',
        is_read: false
      }
    ])
    .select();

  if (err2) {
    console.error("account.customer_notifications insert error:", err2.message);
  } else {
    console.log("Successfully inserted into account.customer_notifications:", n2);
  }
}

main();
