import { useEffect, useRef } from 'react';
import { useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { setTokenGetter } from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const { userMemberships, setActive, isLoaded: orgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const initialized = useRef(false);
  const orgIdRef = useRef<string | undefined>(organization?.id);
  const autoSelectAttempted = useRef(false);

  // Keep orgIdRef in sync
  orgIdRef.current = organization?.id;

  // Auto-select organization if user has one but none is active
  useEffect(() => {
    if (
      orgListLoaded &&
      !organization &&
      !autoSelectAttempted.current &&
      userMemberships?.data &&
      userMemberships.data.length > 0
    ) {
      autoSelectAttempted.current = true;
      const firstOrg = userMemberships.data[0].organization;
      if (firstOrg) {
        setActive({ organization: firstOrg.id });
      }
    }
  }, [orgListLoaded, organization, userMemberships?.data, setActive]);

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
