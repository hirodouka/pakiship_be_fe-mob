-- ==========================================
-- CREATE TEST USERS (SQL VERSION)
-- ==========================================

-- 1. KEITH (Customer)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
VALUES (
  gen_random_uuid(),
  'keithsanmiguel@pakiship.com',
  crypt('Charizard1@', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Keith San Miguel', 'customer'
FROM auth.users WHERE email = 'keithsanmiguel@pakiship.com'
ON CONFLICT (id) DO UPDATE SET role = 'customer';

-- 2. CUSTOMER 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
VALUES (
  gen_random_uuid(),
  'customer1@example.com',
  crypt('Password123!', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Test Customer', 'customer'
FROM auth.users WHERE email = 'customer1@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'customer';

-- 3. DRIVER 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
VALUES (
  gen_random_uuid(),
  'driver1@example.com',
  crypt('Password123!', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Test Driver', 'driver'
FROM auth.users WHERE email = 'driver1@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'driver';

-- 4. OPERATOR 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud)
VALUES (
  gen_random_uuid(),
  'operator1@example.com',
  crypt('Password123!', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, 'Test Operator', 'operator'
FROM auth.users WHERE email = 'operator1@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'operator';
