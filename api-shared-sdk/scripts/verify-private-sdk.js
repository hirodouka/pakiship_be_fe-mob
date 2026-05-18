#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const violations = [];

if (typeof packageJson.name !== 'string' || !packageJson.name.startsWith('@implementsprint/')) {
  violations.push('Package name must remain under the @implementsprint scope.');
}

if (packageJson.private === true) {
  violations.push('Package must be publishable, so package.json private=true is not allowed.');
}

if (packageJson.publishConfig?.access !== 'restricted') {
  violations.push('publishConfig.access must be "restricted" for GitHub Packages.');
}

if (packageJson.publishConfig?.registry !== 'https://npm.pkg.github.com') {
  violations.push('publishConfig.registry must be https://npm.pkg.github.com for GitHub Packages.');
}

if (violations.length > 0) {
  console.error('\nSDK publish guard failed:\n');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('SDK publish guard passed.');
