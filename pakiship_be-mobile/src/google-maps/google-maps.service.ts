import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as https from 'https';
import * as dns from 'node:dns';

@Injectable()
export class GoogleMapsService {
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY;

  private async makeRequest(hostname: string, path: string): Promise<any> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('Maps API key not configured on server.');
    }

    return new Promise((resolve, reject) => {
      const url = `https://${hostname}${path}`;
      https.get(url, {
        headers: {
          'User-Agent': 'PakiShip-Backend/1.0',
          'Accept': 'application/json'
        },
        family: 4,
        rejectUnauthorized: false
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error_message) {
              console.warn('Google Maps API Warning:', parsed.error_message);
            }
            resolve(parsed);
          } catch (e) {
            console.error('Failed to parse Google Maps response:', data.substring(0, 100));
            reject(new InternalServerErrorException('Failed to parse Google Maps response.'));
          }
        });
      }).on('error', (e) => {
        console.error(`Google Maps request failed: ${e.message}`);
        reject(new InternalServerErrorException(`Google Maps connection failed: ${e.message}`));
      });
    });
  }

  async getDistanceMatrix(origins: string, destinations: string) {
    const hostname = 'maps.googleapis.com';
    const path = `/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${this.apiKey}`;
    return this.makeRequest(hostname, path);
  }

  async getAutocomplete(query: string) {
    const hostname = 'maps.googleapis.com';
    const path = `/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:ph&key=${this.apiKey}`;
    return this.makeRequest(hostname, path);
  }

  async getPlaceDetails(placeId: string) {
    const hostname = 'maps.googleapis.com';
    const path = `/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${this.apiKey}`;
    return this.makeRequest(hostname, path);
  }

  async getDirections(origin: string, destination: string) {
    const hostname = 'maps.googleapis.com';
    const path = `/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${this.apiKey}`;
    return this.makeRequest(hostname, path);
  }

  async getReverseGeocode(lat: number, lng: number) {
    const hostname = 'maps.googleapis.com';
    const path = `/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`;
    return this.makeRequest(hostname, path);
  }
}
