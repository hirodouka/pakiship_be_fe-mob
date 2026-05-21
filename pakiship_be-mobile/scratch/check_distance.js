const hubLat = 14.5409;
const hubLng = 121.0503;

function calculateDistance(pickupLat, pickupLng) {
  const R = 6371; // Earth's radius in km
  const dLat = (hubLat - pickupLat) * (Math.PI / 180);
  const dLon = (hubLng - pickupLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pickupLat * (Math.PI / 180)) *
      Math.cos(hubLat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  return distanceKm;
}

console.log('Distance Greenhills to BGC Taguig Hub:', calculateDistance(14.6008192, 121.0484381), 'km');
