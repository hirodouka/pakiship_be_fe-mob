# PakiShip Frontend

This repository contains multiple Expo/React Native frontend apps for PakiShip.

## Apps In This Repo

- `pakiShip_Signup-main`: main combined app and the default app at the repo root
- `pakiShip_Login-main`: older standalone login app
- `pakiShip_Sender-main`: sender-focused standalone app
- `pakiShip_Driver-main`: driver app
- `pakiShip_Operator-main`: operator app

## Generic Run Flow

From the outer downloaded folder, run:

```powershell
cd .\pakiship_mobile_fe-main
npm run setup
npm start
```

That is the recommended GitHub-friendly flow.

- `cd .\pakiship_mobile_fe-main` moves into the actual project root
- `npm run setup` installs dependencies for the default app
- `npm start` starts the default app, which is `pakiShip_Signup-main`

## Run A Specific App

Everything can be launched from the repository root.

Install dependencies for one app:

```powershell
npm run install:signup
npm run install:login
npm run install:sender
npm run install:driver
npm run install:operator
```

Start one app:

```powershell
npm run start:signup
npm run start:login
npm run start:sender
npm run start:driver
npm run start:operator
```

Run on Android or iOS:

```powershell
npm run android:signup
npm run ios:signup
```

Equivalent commands also exist for `login`, `sender`, `driver`, and `operator`.

## Install Everything

If someone wants all frontend workspaces ready at once:

```powershell
npm run install:all
```

## Common Commands

From the repository root:

```powershell
npm run test:signup
npm run lint:signup
npm run verify:signup
```

Equivalent commands also exist for `login`, `sender`, `driver`, and `operator`.

## Environment Notes

- The frontend expects a backend API URL through `EXPO_PUBLIC_API_BASE_URL`
- Expo Go can be used after the Metro server starts and shows a QR code
- Some apps use `--legacy-peer-deps` during install, so the root install scripts already handle that

## Recommendation For GitHub Users

If you want the least confusing path for collaborators, tell them to treat this repo like this:

1. `npm run setup`
2. `npm start`

If they need a different frontend persona, they can switch to the matching `install:*` and `start:*` scripts without changing folders.
