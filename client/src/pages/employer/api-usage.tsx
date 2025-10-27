import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, Activity, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function ApiUsagePage() {
  const { data: apiKeys, isLoading: isLoadingKeys } = useQuery<{ data: any[] }>({
    queryKey: ["/api/api-keys"],
  });

  const { data: usageStats, isLoading: isLoadingUsage } = useQuery<{ data: any[] }>({
    queryKey: ["/api/api-keys/usage"],
  });

  if (isLoadingKeys || isLoadingUsage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRequests = usageStats?.data?.reduce((sum: number, stat: any) => sum + stat.requestCount, 0) || 0;
  const avgResponseTime = usageStats?.data?.length
    ? Math.round(
        usageStats.data.reduce((sum: number, stat: any) => sum + (stat.avgResponseTime || 0), 0) /
          usageStats.data.length
      )
    : 0;
  const errorRate = usageStats?.data?.length
    ? (
        (usageStats.data.reduce((sum: number, stat: any) => sum + (stat.errorCount || 0), 0) / totalRequests) *
        100
      ).toFixed(2)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">API Usage</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your API key usage and performance metrics
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-requests">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time API calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-response-time">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">Average across all endpoints</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-error-rate">{errorRate}%</div>
            <p className="text-xs text-muted-foreground">Failed requests</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Key Usage</CardTitle>
          <CardDescription>Request counts and performance by API key</CardDescription>
        </CardHeader>
        <CardContent>
          {!apiKeys?.data || apiKeys.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-keys">
              <Activity className="h-12 w-12 mx-auto mb-4" />
              <p>No API keys found</p>
              <p className="text-sm mt-2">Create an API key to start tracking usage</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Key</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.data.map((key: any) => {
                  const usage = usageStats?.data?.find((u: any) => u.apiKeyId === key.id);
                  const requestCount = usage?.requestCount || 0;
                  const limit = key.rateLimit || 100;
                  const utilizationPercent = (requestCount / limit) * 100;

                  return (
                    <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                      <TableCell className="font-medium" data-testid={`text-key-name-${key.id}`}>
                        <div>
                          <p>{key.name}</p>
                          <code className="text-xs text-muted-foreground">{key.keyPrefix}...</code>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-requests-${key.id}`}>
                        <div>
                          <p className="font-semibold">{requestCount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {utilizationPercent.toFixed(1)}% of limit
                          </p>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-rate-limit-${key.id}`}>
                        {limit.toLocaleString()} / hour
                      </TableCell>
                      <TableCell data-testid={`text-last-used-${key.id}`}>
                        {key.lastUsedAt
                          ? format(new Date(key.lastUsedAt), "MMM d, yyyy h:mm a")
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            utilizationPercent > 90
                              ? "destructive"
                              : utilizationPercent > 70
                              ? "secondary"
                              : "default"
                          }
                          data-testid={`badge-status-${key.id}`}
                        >
                          {utilizationPercent > 90
                            ? "High Usage"
                            : utilizationPercent > 70
                            ? "Moderate"
                            : "Normal"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {usageStats?.data && usageStats.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Performance</CardTitle>
            <CardDescription>Most frequently used API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Avg Response</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageStats.data.slice(0, 10).map((stat: any, idx: number) => (
                  <TableRow key={idx} data-testid={`row-endpoint-${idx}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-endpoint-${idx}`}>
                      {stat.endpoint || "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-method-${idx}`}>
                        {stat.method || "GET"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-endpoint-requests-${idx}`}>
                      {(stat.requestCount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell data-testid={`text-response-time-${idx}`}>
                      {stat.avgResponseTime || 0}ms
                    </TableCell>
                    <TableCell data-testid={`text-errors-${idx}`}>
                      <span className={stat.errorCount > 0 ? "text-red-600 font-semibold" : ""}>
                        {stat.errorCount || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
