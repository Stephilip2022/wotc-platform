import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface BiometricAuthResult {
  success: boolean;
  credential?: any;
  error?: string;
}

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const checkAvailability = async () => {
    if (!window.PublicKeyCredential) {
      return false;
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setIsAvailable(available);
      return available;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  };

  const register = async (userId: string, userName: string): Promise<BiometricAuthResult> => {
    if (!isAvailable) {
      const available = await checkAvailability();
      if (!available) {
        return { success: false, error: 'Biometric authentication not available on this device' };
      }
    }

    setIsLoading(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'WOTC Platform',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });

      toast({
        title: 'Biometric Auth Enabled',
        description: 'You can now use your fingerprint or face to sign in.',
      });

      return { success: true, credential };
    } catch (error: any) {
      console.error('Error registering biometric:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register biometric authentication.',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const authenticate = async (): Promise<BiometricAuthResult> => {
    setIsLoading(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname,
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });

      return { success: true, credential };
    } catch (error: any) {
      console.error('Error authenticating with biometric:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAvailable,
    isLoading,
    checkAvailability,
    register,
    authenticate,
  };
}
