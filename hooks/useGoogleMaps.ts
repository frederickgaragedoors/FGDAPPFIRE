
import { useState, useEffect } from 'react';
import { loadGoogleMapsScript } from '../utils.ts';

export const useGoogleMaps = (apiKey?: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let mounted = true;

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (mounted) setIsLoaded(true);
      })
      .catch((err) => {
        if (mounted) setError(err);
        console.error("Google Maps load error:", err);
      });

    return () => { mounted = false; };
  }, [apiKey]);

  return { isLoaded, error };
};
