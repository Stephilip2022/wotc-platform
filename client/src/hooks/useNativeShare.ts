import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export function useNativeShare() {
  const [isSupported, setIsSupported] = useState(
    typeof navigator !== 'undefined' && 'share' in navigator
  );
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const share = async (data: ShareData): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Share Not Supported',
        description: 'Native sharing is not supported on this device.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSharing(true);
    try {
      await navigator.share(data);
      return true;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return false;
      }
      console.error('Error sharing:', error);
      toast({
        title: 'Share Failed',
        description: error.message || 'Failed to share content.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSharing(false);
    }
  };

  const shareQRCode = async (qrCodeUrl: string, employerName: string): Promise<boolean> => {
    return share({
      title: `WOTC Screening - ${employerName}`,
      text: `Scan this QR code to complete your WOTC screening questionnaire`,
      url: qrCodeUrl,
    });
  };

  const shareScreeningLink = async (screeningUrl: string): Promise<boolean> => {
    return share({
      title: 'WOTC Screening',
      text: 'Complete your WOTC screening questionnaire',
      url: screeningUrl,
    });
  };

  return {
    isSupported,
    isSharing,
    share,
    shareQRCode,
    shareScreeningLink,
  };
}
