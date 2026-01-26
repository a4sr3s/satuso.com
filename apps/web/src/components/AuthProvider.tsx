import { useEffect, useRef } from 'react';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { setTokenGetter } from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const initialized = useRef(false);
  const orgIdRef = useRef<string | undefined>(organization?.id);

  // Keep orgIdRef in sync
  orgIdRef.current = organization?.id;

  // Set up token getter synchronously on first render (not in useEffect)
  // This ensures it's ready before children mount and start making API calls
  if (!initialized.current) {
    initialized.current = true;
    setTokenGetter(async () => {
      try {
        // Pass organization ID to include org_id in the JWT claims
        return await getToken({ organizationId: orgIdRef.current });
      } catch {
        return null;
      }
    });
  }

  // Update the getter if getToken or organization changes
  useEffect(() => {
    setTokenGetter(async () => {
      try {
        // Pass organization ID to include org_id in the JWT claims
        return await getToken({ organizationId: organization?.id });
      } catch {
        return null;
      }
    });
  }, [getToken, organization?.id]);

  return <>{children}</>;
}
