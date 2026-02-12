import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const { data: user, isLoading: isUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isLoaded && isSignedIn === true,
  });

  return {
    user,
    isLoading: !isLoaded || (isSignedIn && isUserLoading),
    isAuthenticated: isSignedIn === true && !!user,
  };
}
