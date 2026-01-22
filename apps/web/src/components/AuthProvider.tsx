import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter } from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const initialized = useRef(false);

  // Set up token getter synchronously on first render (not in useEffect)
  // This ensures it's ready before children mount and start making API calls
  if (!initialized.current) {
    initialized.current = true;
    setTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }

  // Update the getter if getToken changes
  useEffect(() => {
    setTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}
