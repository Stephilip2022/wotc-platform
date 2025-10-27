import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 150,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const touchStartHandler = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshingRef.current) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const touchMoveHandler = useCallback((e: TouchEvent) => {
    if (!isPulling.current || isRefreshingRef.current) return;

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0 && window.scrollY === 0) {
      const dampedDistance = Math.min(
        distance * 0.5,
        maxPullDistance
      );
      setPullDistance(dampedDistance);
    }
  }, [maxPullDistance]);

  const touchEndHandler = useCallback(async () => {
    if (!isPulling.current) return;

    isPulling.current = false;

    if (pullDistanceRef.current > threshold && !isRefreshingRef.current) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [onRefresh, threshold]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('touchstart', touchStartHandler, { passive: true });
    document.addEventListener('touchmove', touchMoveHandler, { passive: true });
    document.addEventListener('touchend', touchEndHandler);

    return () => {
      document.removeEventListener('touchstart', touchStartHandler);
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };
  }, [enabled, touchStartHandler, touchMoveHandler, touchEndHandler]);

  return {
    pullDistance,
    isRefreshing,
    isTriggered: pullDistance > threshold,
  };
}
