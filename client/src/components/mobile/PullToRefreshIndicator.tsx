import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  isTriggered: boolean;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  isTriggered,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const rotation = Math.min((pullDistance / 80) * 360, 360);

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none transition-opacity"
      style={{
        height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
        opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-card border shadow-lg transition-all",
          isTriggered && "scale-110"
        )}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" data-testid="icon-refreshing" />
        ) : (
          <RefreshCw
            className="h-5 w-5 text-muted-foreground transition-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
            data-testid="icon-pull-indicator"
          />
        )}
      </div>
    </div>
  );
}
