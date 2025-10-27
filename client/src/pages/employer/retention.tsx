import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingUp, Clock, DollarSign, Check, X } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RetentionMilestone {
  id: string;
  employeeId: string;
  currentHours: string;
  targetMilestone: number;
  progressPercent: string;
  averageHoursPerWeek: string;
  estimatedDaysToMilestone: number;
  currentCreditValue: string;
  potentialCreditValue: string;
}

interface TurnoverPrediction {
  id: string;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  factors: any[];
  recommendedActions: any[];
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
}

interface AtRiskEmployee {
  employee: Employee;
  milestone: RetentionMilestone;
  latestPrediction: TurnoverPrediction | null;
}

interface RetentionAlert {
  alert: {
    id: string;
    alertType: string;
    severity: string;
    title: string;
    message: string;
    currentHours: string | null;
    targetMilestone: number | null;
    daysRemaining: number | null;
    potentialValueAtRisk: string | null;
    recommendedActions: any;
    acknowledged: boolean;
    createdAt: string;
  };
  employee: Employee;
}

export default function RetentionOptimization() {
  const { data: atRiskEmployees, isLoading: loadingAtRisk } = useQuery<AtRiskEmployee[]>({
    queryKey: ["/api/retention/at-risk"],
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<RetentionAlert[]>({
    queryKey: ["/api/retention/alerts"],
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest(`/api/retention/alerts/${alertId}/acknowledge`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retention/alerts"] });
    },
  });

  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest(`/api/retention/alerts/${alertId}/dismiss`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retention/alerts"] });
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/retention/batch-update", "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/retention/at-risk"] });
      queryClient.invalidateQueries({ queryKey: ["/api/retention/alerts"] });
    },
  });

  // Calculate summary stats
  const totalAtRisk = atRiskEmployees?.length || 0;
  const highRiskCount = atRiskEmployees?.filter(e => 
    e.latestPrediction?.riskLevel === "high" || e.latestPrediction?.riskLevel === "critical"
  ).length || 0;
  const totalPotentialValue = atRiskEmployees?.reduce((sum, e) => 
    sum + Number(e.milestone?.potentialCreditValue || 0), 0
  ) || 0;
  const urgentAlerts = alerts?.filter(a => 
    a.alert.severity === "high" || a.alert.severity === "critical"
  ).length || 0;

  const getRiskLevelBadge = (riskLevel: string | undefined, riskScore: number | undefined) => {
    if (!riskLevel) return null;

    const variant = 
      riskLevel === "critical" ? "destructive" :
      riskLevel === "high" ? "destructive" :
      riskLevel === "medium" ? "secondary" : "default";

    return (
      <Badge variant={variant} data-testid={`badge-risk-${riskLevel}`}>
        {riskLevel.toUpperCase()} ({riskScore}%)
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const variant =
      severity === "critical" ? "destructive" :
      severity === "high" ? "destructive" :
      severity === "medium" ? "secondary" : "default";

    return <Badge variant={variant}>{severity.toUpperCase()}</Badge>;
  };

  if (loadingAtRisk || loadingAlerts) {
    return <div className="p-8">Loading retention data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-retention">Retention Optimization</h1>
          <p className="text-muted-foreground">Maximize WOTC credits by keeping employees through milestone hours</p>
        </div>
        <Button
          onClick={() => batchUpdateMutation.mutate()}
          disabled={batchUpdateMutation.isPending}
          data-testid="button-refresh-data"
        >
          {batchUpdateMutation.isPending ? "Updating..." : "Refresh Data"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-at-risk">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees At Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-at-risk">{totalAtRisk}</div>
            <p className="text-xs text-muted-foreground">Near milestones or at-risk</p>
          </CardContent>
        </Card>

        <Card data-testid="card-high-risk">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Turnover Risk</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-high-risk">{highRiskCount}</div>
            <p className="text-xs text-muted-foreground">Requires immediate action</p>
          </CardContent>
        </Card>

        <Card data-testid="card-potential-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Value at Risk</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-potential-value">
              ${totalPotentialValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total WOTC credits at risk</p>
          </CardContent>
        </Card>

        <Card data-testid="card-urgent-alerts">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Alerts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-urgent-alerts">{urgentAlerts}</div>
            <p className="text-xs text-muted-foreground">High/critical severity</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts && alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Retention Alerts</CardTitle>
            <CardDescription>Employees requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.map((alertData) => (
              <Alert
                key={alertData.alert.id}
                variant={alertData.alert.severity === "critical" || alertData.alert.severity === "high" ? "destructive" : "default"}
                data-testid={`alert-${alertData.employee.id}`}
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  {alertData.alert.title}
                  {getSeverityBadge(alertData.alert.severity)}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{alertData.alert.message}</p>
                  {alertData.alert.potentialValueAtRisk && (
                    <p className="font-semibold">
                      Potential value at risk: ${Number(alertData.alert.potentialValueAtRisk).toLocaleString()}
                    </p>
                  )}
                  {alertData.alert.recommendedActions && (
                    <div className="mt-2">
                      <p className="font-semibold text-sm">Recommended Actions:</p>
                      <ul className="list-disc list-inside text-sm">
                        {alertData.alert.recommendedActions.map((action: any, idx: number) => (
                          <li key={idx}>{action.action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeAlertMutation.mutate(alertData.alert.id)}
                      disabled={alertData.alert.acknowledged || acknowledgeAlertMutation.isPending}
                      data-testid={`button-acknowledge-${alertData.alert.id}`}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {alertData.alert.acknowledged ? "Acknowledged" : "Acknowledge"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissAlertMutation.mutate(alertData.alert.id)}
                      disabled={dismissAlertMutation.isPending}
                      data-testid={`button-dismiss-${alertData.alert.id}`}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* At-Risk Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>At-Risk Employees</CardTitle>
          <CardDescription>Employees near milestones or with high turnover risk</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Current Hours</TableHead>
                <TableHead>Milestone Progress</TableHead>
                <TableHead>Days to Milestone</TableHead>
                <TableHead>Turnover Risk</TableHead>
                <TableHead>Potential Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRiskEmployees && atRiskEmployees.length > 0 ? (
                atRiskEmployees.map((item) => (
                  <TableRow key={item.employee.id} data-testid={`row-employee-${item.employee.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium" data-testid={`text-name-${item.employee.id}`}>
                          {item.employee.firstName} {item.employee.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">{item.employee.jobTitle}</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-hours-${item.employee.id}`}>
                      {Number(item.milestone?.currentHours || 0).toFixed(1)} / {item.milestone?.targetMilestone} hrs
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress 
                          value={Number(item.milestone?.progressPercent || 0)} 
                          className="h-2"
                          data-testid={`progress-${item.employee.id}`}
                        />
                        <div className="text-sm" data-testid={`text-progress-${item.employee.id}`}>
                          {Number(item.milestone?.progressPercent || 0).toFixed(1)}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-days-${item.employee.id}`}>
                      {item.milestone?.estimatedDaysToMilestone || 0} days
                    </TableCell>
                    <TableCell>
                      {getRiskLevelBadge(item.latestPrediction?.riskLevel, item.latestPrediction?.riskScore)}
                    </TableCell>
                    <TableCell data-testid={`text-credit-${item.employee.id}`}>
                      ${Number(item.milestone?.potentialCreditValue || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No employees currently at risk
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
