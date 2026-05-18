const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT || 4015);
const nodeEnv = process.env.NODE_ENV || 'development';
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
const geocodingUrl =
  process.env.GOOGLE_MAPS_GEOCODING_URL ||
  'https://maps.googleapis.com/maps/api/geocode/json';

app.use(express.json());

const defaultFences = [
  {
    fenceId: 'metro-manila',
    name: 'Metro Manila',
    latitude: 14.5995,
    longitude: 120.9842,
    radiusMeters: 50000,
  },
];

function timestamp() {
  return new Date().toISOString();
}

function ok(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: { timestamp: timestamp() },
  });
}

function fail(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
    meta: { timestamp: timestamp() },
  });
}

function shouldUseMock() {
  return !googleMapsApiKey && nodeEnv !== 'production';
}

function assertGoogleMapsConfigured(res) {
  if (googleMapsApiKey || shouldUseMock()) {
    return true;
  }

  fail(
    res,
    500,
    'GOOGLE_MAPS_CONFIG_ERROR',
    'GOOGLE_MAPS_API_KEY is required in production.',
  );
  return false;
}

function normalizeGoogleGeocodeResult(result) {
  const location = result?.geometry?.location || {};

  return {
    formattedAddress: result?.formatted_address || '',
    latitude: Number(location.lat),
    longitude: Number(location.lng),
    placeId: result?.place_id,
    types: Array.isArray(result?.types) ? result.types : [],
    provider: 'google-maps',
    raw: result,
  };
}

function mockGeocode(address) {
  return {
    formattedAddress: address || 'Manila, Philippines',
    latitude: 14.5995,
    longitude: 120.9842,
    placeId: 'mock-place-id',
    types: ['locality', 'political'],
    provider: 'mock',
  };
}

async function callGoogleGeocoding(params) {
  const url = new URL(geocodingUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('key', googleMapsApiKey);

  const response = await fetch(url);
  const body = await response.json();

  if (!response.ok || body.status !== 'OK') {
    const message = body.error_message || body.status || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const firstResult = Array.isArray(body.results) ? body.results[0] : undefined;
  if (!firstResult) {
    throw new Error('Google Maps returned no geocoding results.');
  }

  return normalizeGoogleGeocodeResult(firstResult);
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

app.get('/health', (_req, res) => {
  return ok(res, {
    status: 'ok',
    service: 'geo-gateway',
    googleMapsEnabled: Boolean(googleMapsApiKey),
    mode: shouldUseMock() ? 'mock' : 'google-maps',
  });
});

app.post('/geocode', async (req, res) => {
  const { address, language, region } = req.body || {};
  if (!address || typeof address !== 'string') {
    return fail(res, 400, 'INVALID_REQUEST', 'address is required.');
  }

  if (!assertGoogleMapsConfigured(res)) {
    return undefined;
  }

  try {
    const data = shouldUseMock()
      ? mockGeocode(address)
      : await callGoogleGeocoding({ address, language, region });
    return ok(res, data);
  } catch (error) {
    return fail(res, 502, 'GOOGLE_MAPS_GEOCODING_FAILED', error.message);
  }
});

app.post('/reverse-geocode', async (req, res) => {
  const { latitude, longitude, language, resultType, locationType } = req.body || {};
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(res, 400, 'INVALID_REQUEST', 'latitude and longitude are required numbers.');
  }

  if (!assertGoogleMapsConfigured(res)) {
    return undefined;
  }

  try {
    const data = shouldUseMock()
      ? mockGeocode('Manila, Philippines')
      : await callGoogleGeocoding({
          latlng: `${lat},${lng}`,
          language,
          result_type: resultType,
          location_type: locationType,
        });
    return ok(res, data);
  } catch (error) {
    return fail(res, 502, 'GOOGLE_MAPS_REVERSE_GEOCODING_FAILED', error.message);
  }
});

app.post('/geofence/check', (req, res) => {
  const { latitude, longitude, fenceId } = req.body || {};
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(res, 400, 'INVALID_REQUEST', 'latitude and longitude are required numbers.');
  }

  const suppliedFences = Array.isArray(req.body?.fences) ? req.body.fences : [];
  const sourceFences = suppliedFences.length > 0 ? suppliedFences : defaultFences;
  const fences = fenceId
    ? sourceFences.filter((fence) => fence.fenceId === fenceId)
    : sourceFences;
  const point = { latitude: lat, longitude: lng };
  const distanceDetails = fences
    .filter((fence) => Number.isFinite(Number(fence.latitude)) && Number.isFinite(Number(fence.longitude)))
    .map((fence) => {
      const radiusMeters = Number(fence.radiusMeters);
      const distance = distanceMeters(point, {
        latitude: Number(fence.latitude),
        longitude: Number(fence.longitude),
      });

      return {
        fenceId: fence.fenceId,
        name: fence.name,
        inside: distance <= radiusMeters,
        distanceMeters: Math.round(distance),
        radiusMeters,
      };
    });

  return ok(res, {
    inside: distanceDetails.some((detail) => detail.inside),
    distanceDetails,
    provider: 'local',
  });
});

async function registerWithGateway() {
  const manifestPath = path.resolve(__dirname, '../../manifests/geo-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.baseUrl = process.env.SERVICE_BASE_URL || manifest.baseUrl;

  const apiCenterUrl = process.env.API_CENTER_URL || 'http://localhost:3000';
  const registerUrl = `${apiCenterUrl}/api/v1/registry/register`;
  const maxAttempts = 6;
  const baseDelayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform-Secret': process.env.PLATFORM_ADMIN_SECRET || '',
        },
        body: JSON.stringify(manifest),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      console.log('[geo-gateway] registered with api-center');
      return;
    } catch (err) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      if (attempt < maxAttempts) {
        console.warn(
          `[geo-gateway] registration attempt ${attempt} failed, retrying in ${delay}ms:`,
          err.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.warn(
          `[geo-gateway] WARN: all ${maxAttempts} registration attempts failed:`,
          err.message,
        );
      }
    }
  }
}

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[geo-gateway] listening on port ${port}`);
    registerWithGateway();
  });
}

module.exports = {
  app,
  callGoogleGeocoding,
  distanceMeters,
  registerWithGateway,
};
