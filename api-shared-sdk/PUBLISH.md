# Publishing @implementsprint/sdk

The SDK is published to GitHub Packages under the `ImplementSprint` GitHub
organization.

This is not public npm distribution. The current package uses restricted
GitHub Packages access, so consumers need GitHub Packages authentication.

## Package

```text
@implementsprint/sdk
```

GitHub Packages requires the npm scope to match the GitHub owner. Because the
GitHub org is `ImplementSprint`, the package scope is lowercase
`@implementsprint`.

## Public vs Restricted Distribution

Current mode:

```text
Registry: https://npm.pkg.github.com
Access: restricted
Consumer install: requires GitHub Packages auth
```

If the SDK should be token-free for all consumers, publish to the public npm
registry instead. That would require changing `publishConfig.registry` and
`publishConfig.access`, then updating this release workflow and docs.

## Local Publish

Create a GitHub personal access token with `write:packages` and `read:packages`
for publishing. If the package is private and consumers are outside the same
permission boundary, they also need `read:packages`.

```powershell
$env:GITHUB_TOKEN = "ghp_..."
npm run ci
npm publish --access restricted
```

The package has this registry pinned in `package.json`:

```json
"publishConfig": {
  "access": "restricted",
  "registry": "https://npm.pkg.github.com"
}
```

## GitHub Actions Publish

The release workflow publishes on semver tag pushes (`v*.*.*`). It uses the
repository `GITHUB_TOKEN` with `packages: write`.

Before publishing, it runs the same validation as CI and verifies the Git tag
matches `package.json`.

For a one-click release from GitHub Actions, use:

```text
Actions -> Create SDK Release Tag -> Run workflow
```

Leave `version` blank to use the version from `package.json`, or enter a new
version such as `1.1.1`. If you enter a new version, the workflow updates
`package.json`, `package-lock.json`, and `TribeClient.SDK_VERSION`, commits that
release metadata, runs the full SDK gate, creates `vX.Y.Z`, and publishes the
package to GitHub Packages.

The one-click workflow publishes directly. Tags created with the default
Actions `GITHUB_TOKEN` do not trigger a second workflow run, so it should not
depend on the separate tag-triggered publish workflow.

If a version tag already exists but the package was not published, run:

```text
Actions -> SDK Release -> Run workflow
```

That publishes the current `package.json` version if it has not already been
published.

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Payment Subscription Release Checklist

Before tagging a release that includes payment subscriptions:

```powershell
npm run typecheck
npm run build
npx vitest run tests/TribeClient.test.ts tests/payment-subscription-smoke.test.ts --pool threads
npm run pack:check
```

After the package is published, validate the consumer path against test:

```powershell
$env:APICENTER_GATEWAY_URL = "https://api-center-test.itsandbox.site"
$env:APICENTER_TRIBE_ID = "smoke-tribe"
$env:APICENTER_TRIBE_SECRET = $env:SMOKE_TRIBE_SECRET
npm run smoke:payment-subscription:sdk
```

Do not publish if the smoke result does not return `provider: "paymongo"` and
`providerMode: "test"` in test.

## Tribe Install

Each consuming tribe repo needs an `.npmrc`:

```ini
@implementsprint:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
npm install @implementsprint/sdk
```

If a repo already has a global `GH_PR_TOKEN`, it can be reused for install only
when it has `read:packages` permission and package access. Map it to the token
variable used by npm:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GH_PR_TOKEN }}
```

For publishing from this SDK repository, prefer the workflow-provided
`GITHUB_TOKEN` with `packages: write`.

## Updating Tribe Backends

Once the package is live, each tribe backend should remove local file
dependencies:

```diff
- "@implementsprint/sdk": "file:../../api-shared"
+ "@implementsprint/sdk": "^1.1.0"
```

Then run `npm install` in the tribe repo.

For the full consumer setup, use:

- `docs/tribe-sdk-consumption.md`

For the full release runbook, use:

- `docs/ci-cd.md`

## Versioning

Every publish needs a new version because GitHub Packages versions are
immutable. The one-click workflow can bump `package.json`,
`package-lock.json`, and `TribeClient.SDK_VERSION` for you. Use semantic
versioning: patch for fixes, minor for new APIs, major for breaking changes.
