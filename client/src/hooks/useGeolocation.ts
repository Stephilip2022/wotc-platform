import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

interface GeolocationError {
  code: number;
  message: string;
}

export function useGeolocation(options?: PositionOptions) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getCurrentPosition = async (): Promise<GeolocationPosition | null> => {
    if (!('geolocation' in navigator)) {
      const errorMsg = 'Geolocation is not supported by your browser';
      toast({
        title: 'Geolocation Unavailable',
        description: errorMsg,
        variant: 'destructive',
      });
      setError({ code: 0, message: errorMsg });
      return null;
    }

    setIsLoading(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPosition: GeolocationPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };
          setPosition(geoPosition);
          setIsLoading(false);
          resolve(geoPosition);
        },
        (err) => {
          const geoError: GeolocationError = {
            code: err.code,
            message: err.message,
          };
          setError(geoError);
          setIsLoading(false);
          toast({
            title: 'Location Access Denied',
            description: 'Please enable location access in your browser settings.',
            variant: 'destructive',
          });
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          ...options,
        }
      );
    });
  };

  const watchPosition = (callback: (position: GeolocationPosition) => void) => {
    if (!('geolocation' in navigator)) {
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const geoPosition: GeolocationPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        };
        setPosition(geoPosition);
        callback(geoPosition);
      },
      (err) => {
        const geoError: GeolocationError = {
          code: err.code,
          message: err.message,
        };
        setError(geoError);
      },
      {
        enableHighAccuracy: true,
        ...options,
      }
    );

    return watchId;
  };

  const clearWatch = (watchId: number) => {
    navigator.geolocation.clearWatch(watchId);
  };

  return {
    position,
    error,
    isLoading,
    getCurrentPosition,
    watchPosition,
    clearWatch,
  };
}
