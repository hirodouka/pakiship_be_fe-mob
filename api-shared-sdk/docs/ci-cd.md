# SDK CI/CD

This repository publishes the API Center tribe SDK to GitHub Packages as:

```text
@implementsprint/sdk
```

The current distribution mode is restricted GitHub Packages, not public npm.
Consumers need GitHub Packages auth to install the package.

## Workflows

| Workflow | File | Trigger | Purpose |
| --- | --- | --- | --- |
| SDK CI | `.github/workflows/ci.yml` | Pull requests and pushes to `main` | Validates the SDK before merge |
| Create SDK Release Tag | `.github/workflows/create-sdk-release.yml` | Manual dispatch from Actions | Validates, versions, tags, and publishes the SDK |
| SDK Release | `.github/workflows/release.yml` | Semver tags pushed outside Actions, or manual dispatch for an already-versioned package | Publishes the SDK to GitHub Packages |

Both workflows run on Node.js 24 and use `npm ci`, so `package-lock.json` must
always be committed and in sync with `package.json`.

## CI Gate

The CI workflow runs:

```bash
npm ci
npm run ci
```

`npm run ci` expands to:

```bash
npm run verify:private-sdk
npm run check:contracts
npm run typecheck
npm run test
npm run build
npm run pack:check
```

This catches:

- wrong package scope or registry settings
- SDK and shared-service contract drift
- TypeScript type errors
- unit/runtime contract regressions
- package tarball issues before publish

## Release Gate

The release workflow is intentionally stricter than CI. It:

1. Installs from the committed lockfile with `npm ci`.
2. Verifies `publishConfig.registry` is `https://npm.pkg.github.com`.
3. Verifies the package scope is `@implementsprint/*`.
4. Verifies the Git tag matches `package.json` version.
5. Runs the full SDK CI gate.
6. Checks that the package version is not already published.
7. Publishes with the repository `GITHUB_TOKEN`.

The workflow has:

```yaml
permissions:
  contents: read
  packages: write
```

No npm token is required for the normal release path.

## One-Click SDK Release

Use **Actions -> Create SDK Release Tag -> Run workflow** when you want to
publish a new SDK version.

Inputs:

| Input | Value |
| --- | --- |
| `version` | Optional. Leave blank to use `package.json`, or enter the new version such as `1.1.1`. |
| `dry_run` | Set to `true` to validate without creating the tag. |

The workflow:

1. Reads the current package version and requested version.
2. If the requested version is different, updates `package.json`,
   `package-lock.json`, and `TribeClient.SDK_VERSION`.
3. Checks that the package version is not already published.
4. Checks that the matching tag does not already exist locally or remotely.
5. Runs `npm ci` and `npm run ci`.
6. If the version changed, commits the release metadata.
7. Creates and pushes `vX.Y.Z`.
8. Publishes the SDK to GitHub Packages.

The one-click workflow publishes directly because tags pushed with the default
Actions `GITHUB_TOKEN` do not trigger a second workflow run. The separate
`SDK Release` workflow is still useful for semver tags pushed manually or by a
personal access token outside Actions. It can also be run manually when the
version commit/tag already exists but the package was not published.

Do not publish automatically on every CI run. GitHub Packages versions are
immutable, so a CI run without a package version bump would either fail as
already published or publish a version before the release boundary is explicit.

## Publishing A New Version

1. If using the one-click workflow, enter the new version and let Actions update
   `package.json`, `package-lock.json`, and `TribeClient.SDK_VERSION`.
2. If releasing manually, update `package.json` version and
   `TribeClient.SDK_VERSION` in `src/TribeClient.ts`.
3. Update release docs only if the install example references a fixed version.
4. Run:

```bash
npm install --package-lock-only
npm run ci
npm publish --dry-run
```

5. Commit and push:

```bash
git add .
git commit -m "chore: release sdk vX.Y.Z"
git push origin main
```

6. Create and push a matching tag, or use the one-click workflow above:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The release tag must match `package.json` exactly. For package version `1.0.3`,
the tag must be `v1.0.3`.

## Token Guidance

The SDK release workflow should use the repository `GITHUB_TOKEN`; it already
has `packages: write` in the workflow permissions. A separate `GH_PR_TOKEN` is
not needed for publishing from this repository unless organization policy blocks
the default Actions token.

Consumers can use a shared secret such as `GH_PR_TOKEN` only if that token has
`read:packages` and access to `ImplementSprint/@implementsprint/sdk`. In an npm
install workflow, expose it as `GITHUB_TOKEN` or `NODE_AUTH_TOKEN` for the
install step because the repo `.npmrc` uses `${GITHUB_TOKEN}`.

## If Release Fails

Common causes:

| Failure | Cause | Fix |
| --- | --- | --- |
| `npm ci can only install packages when package.json and package-lock.json are in sync` | Lockfile was not regenerated | Run `npm install --package-lock-only`, commit the lockfile |
| `Release tag mismatch` | Git tag does not match `package.json` version | Use the one-click workflow, or bump package metadata before tagging |
| `already published` | GitHub Packages already has that version | Bump to a new patch version |
| `403` during publish | Repository or organization package permissions block `GITHUB_TOKEN` | Allow Actions to read/write packages for the repo/org |
| `404` when checking package locally | Private GitHub Packages require auth | Use a token with `read:packages` |

Do not overwrite published versions. GitHub Packages treats package versions as
immutable for normal release operations.
