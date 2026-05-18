#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const refName = process.env.GITHUB_REF_NAME || process.argv[2] || '';
const expectedTag = `v${packageJson.version}`;

if (!packageJson.name || !packageJson.version) {
  console.error('package.json must include name and version before release.');
  process.exit(1);
}

if (refName && /^v\d+\.\d+\.\d+/.test(refName) && refName !== expectedTag) {
  console.error(
    `Release tag mismatch: got ${refName}, expected ${expectedTag} from package.json.`,
  );
  process.exit(1);
}

console.log(`Release version verified: ${packageJson.name}@${packageJson.version}`);
