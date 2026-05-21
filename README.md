# PakiSHIP - Mobile Suite

Welcome to the unified workspace for the PakiSHIP Mobile Application architecture. This project binds the client application code seamlessly with an optimized query processor.

---

## 📁 Repository Map

* **`pakiship_fe-mobile/`**: React Native (Expo) graphical workspace.
* **`pakiship_be-mobile/`**: NestJS Server engine configured over secure API integrations.

---

## 🛠️ Boot Steps (Bash)

### Terminal A - Node API Server
```bash
cd pakiship_be-mobile
npm install
npm run build
npm run start
```

### Terminal B - Native Bundle
```bash
cd pakiship_fe-mobile/pakiship_mobile_fe-main
npm run setup
npm start
```

---

## 🔐 Environment Setup

To run the application, you need to set up environment variables for both the backend and frontend.

### 1. Backend (`pakiship_be-mobile/.env`)
Create a `.env` file in the `pakiship_be-mobile` directory:
```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:8081,http://YOUR_LAN_IP:8081
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET=YOUR_AUTH_SECRET
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

### 2. Frontend (`pakiship_fe-mobile/pakiship_mobile_fe-main/.env`)
Create a `.env` file in the `pakiship_fe-mobile/pakiship_mobile_fe-main` directory:
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:4000/api
```

> [!TIP]
> When running the mobile app on a physical device or emulator, use your computer's **LAN IP address** (e.g., `10.18.5.20`) instead of `localhost` for the `API_BASE_URL` so the app can reach your local server.

---

## 🗺️ Google Maps API Setup

The application uses Google Maps for tracking and address autocomplete.

### Steps to enable:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Enable the following APIs:
   - **Maps SDK for Android** (for mobile)
   - **Maps SDK for iOS** (for mobile)
   - **Places API** (for address autocomplete)
   - **Directions API** (for route calculation)
   - **Distance Matrix API** (for ETAs)
4. Create an **API Key** under "Credentials".
5. **Restriction (Optional but Recommended)**: Restrict the API key to your specific application bundle ID or Android package name to prevent unauthorized use.
6. Copy the API Key into the `.env` files as shown above.

---

## ??? Database Setup (Supabase)

If you are setting up a fresh Supabase project:
1. Go to the **SQL Editor** in your Supabase dashboard.
2. Copy the contents of [\pakiship_be-mobile/sql/pakiship_full_setup.sql\](file:///c:/Users/Bopbopgurl/Downloads/pakiship-be-fe-mobile-main/pakiship-be-fe-mobile-main/pakiship_be-mobile/sql/pakiship_full_setup.sql).
3. Paste and **Run** the script. This will create all necessary tables (\profiles\, \parcel_drafts\, \driver_jobs\, etc.) and enable Row Level Security (RLS) policies.

---
