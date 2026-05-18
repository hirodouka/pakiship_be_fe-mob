#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const contractPath = path.join(repoRoot, 'contracts', 'shared-service-contract.json');
const tribeClientPath = path.join(repoRoot, 'src', 'TribeClient.ts');

const violations = [];
const wrapperRouteExpectations = {
  paymentCreateCheckoutSession: ["'/checkout/sessions'", "method: options?.method ?? 'POST'"],
  paymentGetCheckoutSession: ['`/checkout/sessions/${encodeURIComponent(checkoutId)}`'],
  paymentCreateRefund: ['`/payments/${encodeURIComponent(paymentId)}/refunds`'],
  emailSend: ["'/send'", "method: options?.method ?? 'POST'"],
  emailGetStatus: ['`/status/${encodeURIComponent(messageId)}`'],
  smsSend: ["'/send'", "method: options?.method ?? 'POST'"],
  smsGetStatus: ['`/status/${encodeURIComponent(messageId)}`'],
  gauthGetAuthorizationUrl: ["'/oauth/authorize'", "method: options?.method ?? 'POST'"],
  gauthExchangeCode: ["'/oauth/token'", "method: options?.method ?? 'POST'"],
  gauthRefreshToken: ["'/oauth/token/refresh'", "method: options?.method ?? 'POST'"],
  gauthLogout: ["'/oauth/logout'", "method: options?.method ?? 'POST'"],
  otpGenerate: ["'/generate'", "method: 'POST'"],
  otpVerify: ["'/verify'", "method: 'POST'"],
  otpStatus: ['`/status/${otpId}`', "method: 'GET'"],
  geoGeocodeAddress: ["'/geocode'", "method: 'POST'"],
  geoReverseGeocode: ["'/reverse-geocode'", "method: 'POST'"],
  geoFenceCheck: ["'/geofence/check'", "method: 'POST'"],
  kafkaGetGovernanceCatalog: ["'/api/v1/kafka/governance'"],
  kafkaPublish: ["'/api/v1/kafka/publish'"],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertFileExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push(`Missing required file: ${relativePath}`);
    return null;
  }

  return absolutePath;
}

function hasAsyncMethod(source, methodName) {
  const methodPattern = new RegExp(`async\\s+${methodName}\\s*(?:<[^>]+>)?\\(`);
  return methodPattern.test(source);
}

function ensureContractAndWrappers(contract) {
  const tribeClientSource = fs.readFileSync(tribeClientPath, 'utf8');
  const contractServiceIds = new Set();

  for (const service of contract.sharedServices || []) {
    contractServiceIds.add(service.serviceId);

    const manifestPath = assertFileExists(service.manifest);
    if (!manifestPath) {
      continue;
    }

    const manifest = readJson(manifestPath);
    if (manifest.serviceId !== service.serviceId) {
      violations.push(
        `Manifest serviceId mismatch for ${service.manifest}: expected '${service.serviceId}', got '${manifest.serviceId}'`,
      );
    }

    const expectedEndpoints = manifest.exposes || [];
    const contractEndpoints = service.endpoints || [];
    if (JSON.stringify(contractEndpoints) !== JSON.stringify(expectedEndpoints)) {
      violations.push(
        `Shared service '${service.serviceId}' endpoints do not match manifest exposes list.`,
      );
    }

    for (const wrapperName of service.wrappers || []) {
      if (!hasAsyncMethod(tribeClientSource, wrapperName)) {
        violations.push(`Missing wrapper method in TribeClient: ${wrapperName}`);
        continue;
      }

      for (const expectedSnippet of wrapperRouteExpectations[wrapperName] || []) {
        if (!tribeClientSource.includes(expectedSnippet)) {
          violations.push(
            `Wrapper ${wrapperName} is missing expected route/method snippet: ${expectedSnippet}`,
          );
        }
      }
    }
  }

  const manifestsDir = path.join(repoRoot, 'shared-services', 'manifests');
  for (const manifestFileName of fs.readdirSync(manifestsDir)) {
    if (!manifestFileName.endsWith('-manifest.json')) {
      continue;
    }

    const manifestRelativePath = path.join('shared-services', 'manifests', manifestFileName);
    const manifest = readJson(path.join(manifestsDir, manifestFileName));
    if (!contractServiceIds.has(manifest.serviceId)) {
      violations.push(
        `Shared-service manifest is not listed in the contract: ${manifestRelativePath} (${manifest.serviceId})`,
      );
    }
  }

  for (const wrapperName of contract.kafkaGovernance?.wrappers || []) {
    if (!hasAsyncMethod(tribeClientSource, wrapperName)) {
      violations.push(`Missing Kafka governance wrapper in TribeClient: ${wrapperName}`);
      continue;
    }

    for (const expectedSnippet of wrapperRouteExpectations[wrapperName] || []) {
      if (!tribeClientSource.includes(expectedSnippet)) {
        violations.push(
          `Wrapper ${wrapperName} is missing expected route/method snippet: ${expectedSnippet}`,
        );
      }
    }
  }

  if (!tribeClientSource.includes("'/api/v1/kafka/publish'")) {
    violations.push('TribeClient is missing governed Kafka publish route integration (/api/v1/kafka/publish).');
  }

  if (!tribeClientSource.includes("'/api/v1/kafka/governance'")) {
    violations.push('TribeClient is missing Kafka governance catalog route integration (/api/v1/kafka/governance).');
  }
}

function main() {
  assertFileExists('contracts/shared-service-contract.json');
  assertFileExists('src/TribeClient.ts');

  if (violations.length > 0) {
    printAndExit();
    return;
  }

  const contract = readJson(contractPath);
  ensureContractAndWrappers(contract);
  printAndExit();
}

function printAndExit() {
  if (violations.length === 0) {
    console.log('Contract compatibility check passed.');
    process.exit(0);
  }

  console.error('\nContract compatibility check failed:\n');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

main();
