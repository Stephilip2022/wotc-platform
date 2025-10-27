export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const VIBRATION_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [30, 100, 30, 100, 30],
};

export function useHapticFeedback() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = (pattern: HapticPattern | number | number[]): boolean => {
    if (!isSupported) {
      return false;
    }

    try {
      if (typeof pattern === 'string') {
        return navigator.vibrate(VIBRATION_PATTERNS[pattern]);
      }
      return navigator.vibrate(pattern);
    } catch (error) {
      console.error('Haptic feedback error:', error);
      return false;
    }
  };

  const light = () => vibrate('light');
  const medium = () => vibrate('medium');
  const heavy = () => vibrate('heavy');
  const success = () => vibrate('success');
  const warning = () => vibrate('warning');
  const error = () => vibrate('error');

  const cancel = (): boolean => {
    if (!isSupported) return false;
    return navigator.vibrate(0);
  };

  return {
    isSupported,
    vibrate,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    cancel,
  };
}
