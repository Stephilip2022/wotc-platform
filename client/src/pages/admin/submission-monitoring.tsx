import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  FileText
} from "lucide-react";

interface SubmissionMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  inProgressJobs: number;
  pendingJobs: number;
  successRate: number;
  averageProcessingTime: number;
  totalScreenings: number;
  submittedScreenings: number;
  failedScreenings: number;
  byState: {
    stateCode: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  byEmployer: {
    employerId: string;
    employerName: string;
    total: number;
    completed: number;
    failed: number;
  }[];
  recentFailures: {
    jobId: string;
    stateCode: string;
    employerName: string;
    errorMessage: string | null;
    createdAt: Date;
    retryCount: number | null;
  }[];
}

interface Anomalies {
  highFailureRates: { stateCode: string; failureRate: number; count: number }[];
  stuckJobs: { jobId: string; stateCode: string; startedAt: Date }[];
  repeatedFailures: { screeningId: string; failureCount: number }[];
}

export default function SubmissionMonitoringPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<SubmissionMetrics>({
    queryKey: ["/api/admin/submissions/metrics"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: anomalies, isLoading: anomaliesLoading } = useQuery<Anomalies>({
    queryKey: ["/api/admin/submissions/anomalies"],
    refetchInterval: 60000, // Check for anomalies every minute
  });

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    trend,
    variant = "default",
  }: {
    title: string;
    value: string | number;
    icon: any;
    description?: string;
    trend?: string;
    variant?: "default" | "success" | "warning" | "destructive";
  }) => {
    const variantColors = {
      default: "text-primary",
      success: "text-green-600",
      warning: "text-yellow-600",
      destructive: "text-red-600",
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${variantColors[variant]}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${variantColors[variant]}`} data-testid={`text-${title.toLowerCase().replace(/\s+/g, "-")}`}>
            {metricsLoading ? <Skeleton className="h-8 w-24" /> : value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && !metricsLoading && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">{trend}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const hasAnomalies = anomalies && (
    anomalies.highFailureRates.length > 0 ||
    anomalies.stuckJobs.length > 0 ||
    anomalies.repeatedFailures.length > 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Submission Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of automated WOTC submissions
        </p>
      </div>

      {/* Anomaly Alerts */}
      {!anomaliesLoading && hasAnomalies && (
        <Card className="border-destructive" data-testid="card-anomaly-alerts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {anomalies.highFailureRates.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">High Failure Rates</h4>
                <div className="space-y-2">
                  {anomalies.highFailureRates.map((state) => (
                    <div
                      key={state.stateCode}
                      className="flex items-center justify-between p-3 bg-destructive/10 rounded-md"
                      data-testid={`alert-high-failure-${state.stateCode}`}
                    >
                      <span className="font-medium">{state.stateCode}</span>
                      <Badge variant="destructive">
                        {state.failureRate}% failure rate ({state.count} jobs)
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {anomalies.stuckJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Stuck Jobs</h4>
                <div className="space-y-2">
                  {anomalies.stuckJobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-md"
                      data-testid={`alert-stuck-job-${job.jobId}`}
                    >
                      <div>
                        <span className="font-medium">{job.stateCode}</span>
                        <p className="text-xs text-muted-foreground">
                          Started: {new Date(job.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">In Progress &gt;30min</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {anomalies.repeatedFailures.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Repeated Failures</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {anomalies.repeatedFailures.length} screenings with 3+ failed attempts
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Jobs"
          value={metrics?.totalJobs || 0}
          icon={Activity}
          description="All submission jobs"
        />
        <StatCard
          title="Success Rate"
          value={`${metrics?.successRate || 0}%`}
          icon={CheckCircle2}
          description="Completed successfully"
          variant="success"
        />
        <StatCard
          title="Failed Jobs"
          value={metrics?.failedJobs || 0}
          icon={XCircle}
          description="Requiring attention"
          variant={metrics && metrics.failedJobs > 0 ? "destructive" : "default"}
        />
        <StatCard
          title="Avg Processing Time"
          value={`${metrics?.averageProcessingTime.toFixed(1) || 0}m`}
          icon={Clock}
          description="Minutes per job"
        />
      </div>

      {/* Job Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-jobs">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.pendingJobs || 0}
            </div>
            <p className="text-xs text-muted-foreground">Waiting to process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-in-progress-jobs">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.inProgressJobs || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-jobs">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.completedJobs || 0}
            </div>
            <p className="text-xs text-muted-foreground">Successfully submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* State Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by State</CardTitle>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : metrics && metrics.byState.length > 0 ? (
            <div className="space-y-3">
              {metrics.byState.slice(0, 10).map((state) => (
                <div key={state.stateCode} className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="font-medium w-12">{state.stateCode}</span>
                    <div className="flex-1">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            state.successRate >= 80
                              ? "bg-green-600"
                              : state.successRate >= 60
                              ? "bg-yellow-600"
                              : "bg-red-600"
                          }`}
                          style={{ width: `${state.successRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{state.total} jobs</span>
                    <Badge variant={state.successRate >= 80 ? "default" : "secondary"}>
                      {state.successRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No state data available</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Failures */}
      {metrics && metrics.recentFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentFailures.slice(0, 5).map((failure) => (
                <div
                  key={failure.jobId}
                  className="flex items-start gap-3 p-3 bg-muted rounded-md"
                  data-testid={`failure-${failure.jobId}`}
                >
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{failure.employerName}</span>
                      <Badge variant="secondary">{failure.stateCode}</Badge>
                      {failure.retryCount && failure.retryCount > 0 && (
                        <Badge variant="outline">Retry {failure.retryCount}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {failure.errorMessage || "Unknown error"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(failure.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Screening Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Screenings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-screenings">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.totalScreenings || 0}
            </div>
            <p className="text-xs text-muted-foreground">In submission queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.submittedScreenings || 0}
            </div>
            <p className="text-xs text-muted-foreground">Successfully submitted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metricsLoading ? <Skeleton className="h-8 w-16" /> : metrics?.failedScreenings || 0}
            </div>
            <p className="text-xs text-muted-foreground">Need retry</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
