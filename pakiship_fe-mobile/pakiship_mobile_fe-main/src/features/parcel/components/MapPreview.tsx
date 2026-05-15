import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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

export default function MapPreview({ 
  pickupLocation, 
  deliveryLocation, 
  driverLocation,
  pickupAddress,
  deliveryAddress
}: Props) {
  const mapRef = useRef<MapView>(null);

  // Fallback coordinates (Metro Manila center) if none provided
  const centerLat = 14.5995;
  const centerLng = 120.9842;

  const origin = pickupLocation || (pickupAddress ? { lat: centerLat, lng: centerLng } : undefined);
  const destination = deliveryLocation || (deliveryAddress ? { lat: centerLat + 0.01, lng: centerLng + 0.01 } : undefined);

  useEffect(() => {
    if (mapRef.current && origin && destination) {
      const coordinates = [
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng }
      ];
      if (driverLocation) {
        coordinates.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
      }
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [origin?.lat, destination?.lat, driverLocation?.lat]);

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
        {origin && (
          <Marker
            coordinate={{ latitude: origin.lat, longitude: origin.lng }}
            title="Pickup"
            description={origin.address || pickupAddress}
          >
            <View style={[styles.markerCircle, { backgroundColor: '#39B5A8' }]}>
              <MapPin size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {destination && (
          <Marker
            coordinate={{ latitude: destination.lat, longitude: destination.lng }}
            title="Delivery"
            description={destination.address || deliveryAddress}
          >
            <View style={[styles.markerCircle, { backgroundColor: '#ef4444' }]}>
              <MapPin size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title="Rider"
            flat
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Navigation size={20} color="#fff" fill="#1A5D56" />
            </View>
          </Marker>
        )}

        {origin && destination && (
          <MapViewDirections
            origin={{ latitude: origin.lat, longitude: origin.lng }}
            destination={{ latitude: destination.lat, longitude: destination.lng }}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor="#39B5A8"
            optimizeWaypoints={true}
          />
        )}
      </MapView>
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
  }
});
