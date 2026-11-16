export type TravellerLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: 'browser-consent' | 'manual';
};

export type ResolvedTravellerContext = {
  name: string;
  region: string;
  country: string;
  countryCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
};

export function requestTravellerLocation(): Promise<TravellerLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available on this device. Choose a city or airport instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: 'browser-consent',
      }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission was not granted. You can still choose a city or airport manually.'
          : 'We could not determine your location. Choose a city or airport manually.',
      )),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export function validateCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
