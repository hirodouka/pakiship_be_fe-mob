import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MapPin, Navigation } from 'lucide-react-native';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCuUv6DYuvUrLJLAitwKWirrQe2xwgqscA';

interface Props {
  pickupLocation?: { lat: number; lng: number; address?: string };
  deliveryLocation?: { lat: number; lng: number; address?: string };
  driverLocation?: { lat: number; lng: number };
  pickupAddress?: string; // Legacy support
  deliveryAddress?: string; // Legacy support
}

function hasValidCoords(location?: { lat?: number; lng?: number } | null) {
  return location?.lat != null && location?.lng != null && !Number.isNaN(location.lat) && !Number.isNaN(location.lng);
}

async function geocodeAddress(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  const json = await response.json();
  const location = json?.results?.[0]?.geometry?.location;
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    return { lat: location.lat, lng: location.lng };
  }
  return null;
}

export default function MapPreview({ 
  pickupLocation, 
  deliveryLocation, 
  driverLocation,
  pickupAddress,
  deliveryAddress
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; address?: string } | undefined>(
    hasValidCoords(pickupLocation) ? pickupLocation : undefined,
  );
  const [destination, setDestination] = useState<{ lat: number; lng: number; address?: string } | undefined>(
    hasValidCoords(deliveryLocation) ? deliveryLocation : undefined,
  );

  const centerLat = 14.5995;
  const centerLng = 120.9842;

  const driverCoords = hasValidCoords(driverLocation) ? driverLocation : undefined;

  useEffect(() => {
    const geocodeData = async () => {
      if (!hasValidCoords(origin) && !hasValidCoords(pickupLocation) && pickupAddress) {
        const result = await geocodeAddress(pickupAddress);
        if (result) setOrigin({ ...result, address: pickupAddress });
      } else if (hasValidCoords(pickupLocation) && pickupLocation) {
        setOrigin(pickupLocation);
      }

      if (!hasValidCoords(destination) && !hasValidCoords(deliveryLocation) && deliveryAddress) {
        const result = await geocodeAddress(deliveryAddress);
        if (result) setDestination({ ...result, address: deliveryAddress });
      } else if (hasValidCoords(deliveryLocation) && deliveryLocation) {
        setDestination(deliveryLocation);
      }
    };

    geocodeData();
  }, [pickupLocation?.lat, pickupLocation?.lng, pickupAddress, deliveryLocation?.lat, deliveryLocation?.lng, deliveryAddress]);

  useEffect(() => {
    if (!mapRef.current) return;

    const coordinates: Array<{ latitude: number; longitude: number }> = [];
    if (origin) coordinates.push({ latitude: origin.lat, longitude: origin.lng });
    if (destination) coordinates.push({ latitude: destination.lat, longitude: destination.lng });
    if (driverCoords) coordinates.push({ latitude: driverCoords.lat, longitude: driverCoords.lng });

    if (coordinates.length >= 2) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, driverCoords?.lat, driverCoords?.lng]);

  const originCoord = origin && hasValidCoords(origin) ? { latitude: origin.lat, longitude: origin.lng } : undefined;
  const destinationCoord = destination && hasValidCoords(destination) ? { latitude: destination.lat, longitude: destination.lng } : undefined;
  const driverCoord = driverCoords ? { latitude: driverCoords.lat, longitude: driverCoords.lng } : undefined;

  const canDrawRoute = !!originCoord && !!destinationCoord;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: origin?.lat || centerLat,
          longitude: origin?.lng || centerLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
{originCoord && (
          <Marker
            coordinate={originCoord}
            title="Pickup"
            description={origin?.address || pickupAddress}
          >
            <View style={[styles.markerCircle, { backgroundColor: '#39B5A8' }]}> 
              <MapPin size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {destinationCoord && (
          <Marker
            coordinate={destinationCoord}
            title="Delivery"
            description={destination?.address || deliveryAddress}
          >
            <View style={[styles.markerCircle, { backgroundColor: '#ef4444' }]}> 
              <MapPin size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {driverCoord && (
          <Marker
            coordinate={driverCoord}
            title="Rider"
            flat
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Navigation size={20} color="#fff" fill="#1A5D56" />
            </View>
          </Marker>
        )}

        {canDrawRoute && (
          <MapViewDirections
            origin={originCoord!}
            destination={destinationCoord!}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor="#39B5A8"
            optimizeWaypoints={true}
          />
        )}
      </MapView>
      {!canDrawRoute && (
        <View style={styles.placeholderOverlay} pointerEvents="none">
          <Text style={styles.placeholderText}>Map unavailable for this parcel yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A5D56',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    textAlign: 'center',
  }
});
