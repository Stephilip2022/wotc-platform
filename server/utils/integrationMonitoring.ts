import { db } from "../db";
import {
  integrationConnections,
  integrationSyncLogs,
  integrationProviders,
  integrationSyncedRecords,
} from "@shared/schema";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";

// ============================================================================
// CONNECTION HEALTH MONITORING
// ============================================================================

export interface ConnectionHealth {
  connectionId: string;
  providerName: string;
  status: "healthy" | "degraded" | "critical" | "disconnected";
  lastSyncAt: Date | null;
  successRate: number; // percentage
  errorCount24h: number;
  avgSyncDuration: number; // milliseconds
  totalRecordsSynced: number;
  issues: string[];
}

/**
 * Get health status for all active connections
 */
export async function getConnectionsHealth(
  employerId: string
): Promise<ConnectionHealth[]> {
  const connections = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.employerId, employerId),
        eq(integrationConnections.status, "active")
      )
    );

  const healthResults: ConnectionHealth[] = [];

  for (const connection of connections) {
    // Get provider info
    const [provider] = await db
      .select()
      .from(integrationProviders)
      .where(eq(integrationProviders.id, connection.providerId))
      .limit(1);

    // Get recent sync logs (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await db
      .select()
      .from(integrationSyncLogs)
      .where(
        and(
          eq(integrationSyncLogs.connectionId, connection.id),
          gte(integrationSyncLogs.startedAt, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(integrationSyncLogs.startedAt))
      .limit(100);

    // Calculate metrics
    const totalSyncs = recentLogs.length;
    const successfulSyncs = recentLogs.filter(
      (log) => log.status === "completed"
    ).length;
    const failedSyncs = recentLogs.filter((log) => log.status === "failed")
      .length;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 100;

    // Calculate average sync duration
    const syncsWithDuration = recentLogs.filter(
      (log) => log.startedAt && log.completedAt
    );
    const avgSyncDuration =
      syncsWithDuration.length > 0
        ? syncsWithDuration.reduce((sum, log) => {
            const duration =
              new Date(log.completedAt!).getTime() -
              new Date(log.startedAt!).getTime();
            return sum + duration;
          }, 0) / syncsWithDuration.length
        : 0;

    // Get total records synced
    const totalRecordsSynced = recentLogs.reduce(
      (sum, log) => sum + (log.recordsProcessed || 0),
      0
    );

    // Determine health status
    const issues: string[] = [];
    let status: ConnectionHealth["status"] = "healthy";

    if (!connection.lastSyncAt) {
      status = "disconnected";
      issues.push("Never synced");
    } else {
      const hoursSinceLastSync =
        (Date.now() - new Date(connection.lastSyncAt).getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastSync > 48) {
        status = "critical";
        issues.push(`No sync in ${Math.floor(hoursSinceLastSync)} hours`);
      } else if (hoursSinceLastSync > 24) {
        status = "degraded";
        issues.push(`Last sync ${Math.floor(hoursSinceLastSync)} hours ago`);
      }

      if (successRate < 50) {
        status = "critical";
        issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
      } else if (successRate < 80) {
        if (status === "healthy") status = "degraded";
        issues.push(`Success rate below target: ${successRate.toFixed(1)}%`);
      }

      if (failedSyncs > 10) {
        status = "critical";
        issues.push(`${failedSyncs} failures in last 24h`);
      } else if (failedSyncs > 5) {
        if (status === "healthy") status = "degraded";
        issues.push(`${failedSyncs} failures in last 24h`);
      }
    }

    healthResults.push({
      connectionId: connection.id,
      providerName: provider?.providerName || "Unknown",
      status,
      lastSyncAt: connection.lastSyncAt,
      successRate,
      errorCount24h: failedSyncs,
      avgSyncDuration,
      totalRecordsSynced,
      issues,
    });
  }

  return healthResults;
}

// ============================================================================
// SYNC STATISTICS
// ============================================================================

export interface SyncStatistics {
  totalConnections: number;
  activeConnections: number;
  totalSyncs24h: number;
  successfulSyncs24h: number;
  failedSyncs24h: number;
  totalRecordsProcessed24h: number;
  totalRecordsCreated24h: number;
  totalRecordsUpdated24h: number;
  avgSyncDuration: number;
  syncsByProvider: Record<string, number>;
  syncsByStatus: Record<string, number>;
}

/**
 * Get comprehensive sync statistics for an employer
 */
export async function getSyncStatistics(
  employerId: string
): Promise<SyncStatistics> {
  // Get all connections for this employer
  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.employerId, employerId));

  const activeConnections = connections.filter((c) => c.status === "active").length;

  // Get recent sync logs (last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await db
    .select()
    .from(integrationSyncLogs)
    .where(
      and(
        eq(integrationSyncLogs.employerId, employerId),
        gte(integrationSyncLogs.startedAt, twentyFourHoursAgo)
      )
    );

  // Calculate statistics
  const totalSyncs24h = recentLogs.length;
  const successfulSyncs24h = recentLogs.filter(
    (log) => log.status === "completed"
  ).length;
  const failedSyncs24h = recentLogs.filter((log) => log.status === "failed")
    .length;

  const totalRecordsProcessed24h = recentLogs.reduce(
    (sum, log) => sum + (log.recordsProcessed || 0),
    0
  );
  const totalRecordsCreated24h = recentLogs.reduce(
    (sum, log) => sum + (log.recordsCreated || 0),
    0
  );
  const totalRecordsUpdated24h = recentLogs.reduce(
    (sum, log) => sum + (log.recordsUpdated || 0),
    0
  );

  // Calculate average sync duration
  const syncsWithDuration = recentLogs.filter(
    (log) => log.startedAt && log.completedAt
  );
  const avgSyncDuration =
    syncsWithDuration.length > 0
      ? syncsWithDuration.reduce((sum, log) => {
          const duration =
            new Date(log.completedAt!).getTime() -
            new Date(log.startedAt!).getTime();
          return sum + duration;
        }, 0) / syncsWithDuration.length
      : 0;

  // Group by provider
  const syncsByProvider: Record<string, number> = {};
  for (const log of recentLogs) {
    const connection = connections.find((c) => c.id === log.connectionId);
    if (connection) {
      const [provider] = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.id, connection.providerId))
        .limit(1);

      const providerName = provider?.providerName || "Unknown";
      syncsByProvider[providerName] = (syncsByProvider[providerName] || 0) + 1;
    }
  }

  // Group by status
  const syncsByStatus: Record<string, number> = {};
  for (const log of recentLogs) {
    const status = log.status || "unknown";
    syncsByStatus[status] = (syncsByStatus[status] || 0) + 1;
  }

  return {
    totalConnections: connections.length,
    activeConnections,
    totalSyncs24h,
    successfulSyncs24h,
    failedSyncs24h,
    totalRecordsProcessed24h,
    totalRecordsCreated24h,
    totalRecordsUpdated24h,
    avgSyncDuration,
    syncsByProvider,
    syncsByStatus,
  };
}

// ============================================================================
// ERROR TRACKING
// ============================================================================

export interface SyncError {
  id: string;
  connectionId: string;
  providerName: string;
  syncType: string;
  errorMessage: string;
  errorDetails: any;
  timestamp: Date;
  recordsAffected: number;
}

/**
 * Get recent sync errors for troubleshooting
 */
export async function getRecentErrors(
  employerId: string,
  limit: number = 50
): Promise<SyncError[]> {
  const errorLogs = await db
    .select()
    .from(integrationSyncLogs)
    .where(
      and(
        eq(integrationSyncLogs.employerId, employerId),
        eq(integrationSyncLogs.status, "failed")
      )
    )
    .orderBy(desc(integrationSyncLogs.startedAt))
    .limit(limit);

  const errors: SyncError[] = [];

  for (const log of errorLogs) {
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, log.connectionId))
      .limit(1);

    if (connection) {
      const [provider] = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.id, connection.providerId))
        .limit(1);

      errors.push({
        id: log.id,
        connectionId: log.connectionId,
        providerName: provider?.providerName || "Unknown",
        syncType: log.syncType || "unknown",
        errorMessage: log.errorMessage || "No error message",
        errorDetails: log.errorDetails,
        timestamp: log.startedAt || new Date(),
        recordsAffected: log.recordsProcessed || 0,
      });
    }
  }

  return errors;
}

// ============================================================================
// DATA FLOW METRICS
// ============================================================================

export interface DataFlowMetrics {
  hourly: Array<{
    hour: string;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    syncCount: number;
  }>;
  daily: Array<{
    date: string;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    syncCount: number;
  }>;
  byProvider: Array<{
    providerName: string;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    syncCount: number;
  }>;
}

/**
 * Get data flow metrics for visualization
 */
export async function getDataFlowMetrics(
  employerId: string,
  days: number = 7
): Promise<DataFlowMetrics> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await db
    .select()
    .from(integrationSyncLogs)
    .where(
      and(
        eq(integrationSyncLogs.employerId, employerId),
        gte(integrationSyncLogs.startedAt, startDate)
      )
    )
    .orderBy(desc(integrationSyncLogs.startedAt));

  // Group by hour (last 24 hours)
  const hourly: Record<
    string,
    {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      syncCount: number;
    }
  > = {};

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = logs.filter(
    (log) => log.startedAt && new Date(log.startedAt) >= twentyFourHoursAgo
  );

  for (const log of recentLogs) {
    if (!log.startedAt) continue;
    const hour = new Date(log.startedAt).toISOString().substring(0, 13) + ":00";

    if (!hourly[hour]) {
      hourly[hour] = {
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        syncCount: 0,
      };
    }

    hourly[hour].recordsProcessed += log.recordsProcessed || 0;
    hourly[hour].recordsCreated += log.recordsCreated || 0;
    hourly[hour].recordsUpdated += log.recordsUpdated || 0;
    hourly[hour].syncCount += 1;
  }

  // Group by day
  const daily: Record<
    string,
    {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      syncCount: number;
    }
  > = {};

  for (const log of logs) {
    if (!log.startedAt) continue;
    const date = new Date(log.startedAt).toISOString().substring(0, 10);

    if (!daily[date]) {
      daily[date] = {
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        syncCount: 0,
      };
    }

    daily[date].recordsProcessed += log.recordsProcessed || 0;
    daily[date].recordsCreated += log.recordsCreated || 0;
    daily[date].recordsUpdated += log.recordsUpdated || 0;
    daily[date].syncCount += 1;
  }

  // Group by provider
  const byProvider: Record<
    string,
    {
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      syncCount: number;
    }
  > = {};

  for (const log of logs) {
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, log.connectionId))
      .limit(1);

    if (connection) {
      const [provider] = await db
        .select()
        .from(integrationProviders)
        .where(eq(integrationProviders.id, connection.providerId))
        .limit(1);

      const providerName = provider?.providerName || "Unknown";

      if (!byProvider[providerName]) {
        byProvider[providerName] = {
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          syncCount: 0,
        };
      }

      byProvider[providerName].recordsProcessed += log.recordsProcessed || 0;
      byProvider[providerName].recordsCreated += log.recordsCreated || 0;
      byProvider[providerName].recordsUpdated += log.recordsUpdated || 0;
      byProvider[providerName].syncCount += 1;
    }
  }

  return {
    hourly: Object.entries(hourly).map(([hour, metrics]) => ({
      hour,
      ...metrics,
    })),
    daily: Object.entries(daily).map(([date, metrics]) => ({
      date,
      ...metrics,
    })),
    byProvider: Object.entries(byProvider).map(([providerName, metrics]) => ({
      providerName,
      ...metrics,
    })),
  };
}

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

export interface IntegrationDashboard {
  overview: {
    totalConnections: number;
    activeConnections: number;
    healthyConnections: number;
    criticalConnections: number;
  };
  syncActivity: {
    totalSyncs24h: number;
    successRate: number;
    totalRecordsProcessed24h: number;
    avgSyncDuration: number;
  };
  connectionHealth: ConnectionHealth[];
  recentErrors: SyncError[];
  dataFlow: DataFlowMetrics;
}

/**
 * Get comprehensive dashboard data for integration monitoring
 */
export async function getIntegrationDashboard(
  employerId: string
): Promise<IntegrationDashboard> {
  const [health, stats, errors, dataFlow] = await Promise.all([
    getConnectionsHealth(employerId),
    getSyncStatistics(employerId),
    getRecentErrors(employerId, 10),
    getDataFlowMetrics(employerId, 7),
  ]);

  const healthyConnections = health.filter((h) => h.status === "healthy").length;
  const criticalConnections = health.filter((h) => h.status === "critical")
    .length;

  return {
    overview: {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      healthyConnections,
      criticalConnections,
    },
    syncActivity: {
      totalSyncs24h: stats.totalSyncs24h,
      successRate:
        stats.totalSyncs24h > 0
          ? (stats.successfulSyncs24h / stats.totalSyncs24h) * 100
          : 100,
      totalRecordsProcessed24h: stats.totalRecordsProcessed24h,
      avgSyncDuration: stats.avgSyncDuration,
    },
    connectionHealth: health,
    recentErrors: errors,
    dataFlow,
  };
}
