import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Activity,
  Calendar,
  Play,
  Pause,
  Settings,
  RefreshCw,
  BarChart,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string | null;
  category: string;
  severity: string;
  piiAccessed: boolean;
  exportedData: boolean;
  requiresReview: boolean;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  timestamp: string;
}

interface AuditStats {
  total: number;
  today: number;
  pendingReview: number;
  critical: number;
}

interface ComplianceReport {
  id: number;
  reportName: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
}

interface ScheduledScan {
  id: string;
  name: string;
  type: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string;
  status: "active" | "paused";
  issuesFound: number;
}

interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "passed" | "warning" | "failed";
  lastChecked: string;
  details: string;
}

interface LogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    pages: number;
    total: number;
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  create: CheckCircle,
  read: Eye,
  update: Activity,
  delete: AlertTriangle,
  login: User,
  logout: User,
  export: Download,
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "all",
    category: "all",
    severity: "all",
    requiresReview: "all",
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [runningScans, setRunningScans] = useState<Set<string>>(new Set());

  // Mock scheduled scans data
  const scheduledScans: ScheduledScan[] = [
    {
      id: "scan-1",
      name: "Daily PII Access Audit",
      type: "pii_access",
      schedule: "Daily at 2:00 AM",
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      status: "active",
      issuesFound: 3,
    },
    {
      id: "scan-2",
      name: "Weekly Data Export Review",
      type: "data_export",
      schedule: "Every Monday at 6:00 AM",
      lastRun: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      issuesFound: 0,
    },
    {
      id: "scan-3",
      name: "Monthly Compliance Check",
      type: "compliance",
      schedule: "1st of each month at 12:00 AM",
      lastRun: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      issuesFound: 1,
    },
    {
      id: "scan-4",
      name: "Form 8850 Submission Audit",
      type: "submission_audit",
      schedule: "Daily at 8:00 PM",
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      status: "paused",
      issuesFound: 0,
    },
  ];

  // Mock compliance checks data
  const complianceChecks: ComplianceCheck[] = [
    {
      id: "check-1",
      name: "Form 8850 Timeliness",
      description: "All Form 8850s must be submitted within 28 days of hire",
      category: "WOTC Submission",
      status: "passed",
      lastChecked: new Date().toISOString(),
      details: "All 47 pending submissions are within the required timeframe",
    },
    {
      id: "check-2",
      name: "Data Retention Policy",
      description: "Employee data must be retained per IRS guidelines",
      category: "Data Governance",
      status: "passed",
      lastChecked: new Date().toISOString(),
      details: "All records meet 7-year retention requirements",
    },
    {
      id: "check-3",
      name: "PII Access Controls",
      description: "Only authorized personnel should access PII",
      category: "Security",
      status: "warning",
      lastChecked: new Date().toISOString(),
      details: "2 users have excessive permissions - review recommended",
    },
    {
      id: "check-4",
      name: "State Portal Credentials",
      description: "All state portal credentials must be valid and encrypted",
      category: "Security",
      status: "passed",
      lastChecked: new Date().toISOString(),
      details: "All 52 state credentials are valid and properly encrypted",
    },
    {
      id: "check-5",
      name: "Audit Log Integrity",
      description: "Audit logs must be immutable and complete",
      category: "Compliance",
      status: "passed",
      lastChecked: new Date().toISOString(),
      details: "No gaps or modifications detected in audit trail",
    },
    {
      id: "check-6",
      name: "Employee Consent Records",
      description: "All employees must have signed consent for WOTC screening",
      category: "Legal",
      status: "warning",
      lastChecked: new Date().toISOString(),
      details: "12 screenings pending consent verification",
    },
  ];

  const handleRunScan = (scanId: string) => {
    setRunningScans(prev => new Set(Array.from(prev).concat(scanId)));
    setTimeout(() => {
      setRunningScans(prev => {
        const next = new Set(prev);
        next.delete(scanId);
        return next;
      });
    }, 3000);
  };

  const handleExportAuditLog = async () => {
    const url = `/api/audit/export?startDate=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `audit_log_export_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const buildQueryString = () => {
    const params = new URLSearchParams({ page: page.toString(), limit: "25" });
    if (filters.action && filters.action !== "all") params.append("action", filters.action);
    if (filters.category && filters.category !== "all") params.append("category", filters.category);
    if (filters.severity && filters.severity !== "all") params.append("severity", filters.severity);
    if (filters.requiresReview && filters.requiresReview !== "all") params.append("requiresReview", filters.requiresReview);
    return params.toString();
  };

  const { data: logsData, isLoading: loadingLogs } = useQuery<LogsResponse>({
    queryKey: [`/api/audit?${buildQueryString()}`],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<AuditStats>({
    queryKey: ["/api/audit/stats"],
  });

  const { data: reports, isLoading: loadingReports } = useQuery<ComplianceReport[]>({
    queryKey: ["/api/audit/compliance-reports"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("POST", `/api/audit/${id}/review`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/audit');
        }
      });
      setSelectedLog(null);
      setReviewNotes("");
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { reportType: string; periodStart: string; periodEnd: string }) => {
      return apiRequest("POST", "/api/audit/compliance-report", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/audit');
        }
      });
    },
  });

  const handleGenerateReport = (reportType: string) => {
    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    generateReportMutation.mutate({ reportType, periodStart, periodEnd });
  };

  const logs = Array.isArray(logsData?.logs) ? logsData.logs : [];
  const pagination = logsData?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Audit Logs & Compliance</h1>
          <p className="text-muted-foreground">Track all system activities and generate compliance reports</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-events">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-events">
              {stats?.total?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-today-events">
              {stats?.today || 0} today
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-review">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-review">
              {stats?.pendingReview || 0}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-critical-events">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-critical-events">
              {stats?.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">Security events</p>
          </CardContent>
        </Card>

        <Card data-testid="card-reports-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-reports-count">
              {reports?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Generated reports</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="logs" className="flex items-center gap-2" data-testid="tab-audit-logs">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2" data-testid="tab-compliance-checks">
            <Shield className="h-4 w-4" />
            Compliance Checks
          </TabsTrigger>
          <TabsTrigger value="scans" className="flex items-center gap-2" data-testid="tab-scheduled-scans">
            <Calendar className="h-4 w-4" />
            Scheduled Scans
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2" data-testid="tab-compliance-reports">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card data-testid="card-activity-log">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>All system events and user actions</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select 
                    value={filters.action} 
                    onValueChange={(v) => setFilters({ ...filters, action: v })}
                  >
                    <SelectTrigger className="w-[120px]" data-testid="select-action-filter">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="export">Export</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={filters.category} 
                    onValueChange={(v) => setFilters({ ...filters, category: v })}
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="authentication">Authentication</SelectItem>
                      <SelectItem value="data_access">Data Access</SelectItem>
                      <SelectItem value="data_modification">Data Modification</SelectItem>
                      <SelectItem value="admin_action">Admin Action</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={filters.severity} 
                    onValueChange={(v) => setFilters({ ...filters, severity: v })}
                  >
                    <SelectTrigger className="w-[120px]" data-testid="select-severity-filter">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="flex items-center justify-center h-64" data-testid="loading-logs">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log) => {
                    const ActionIcon = ACTION_ICONS[log.action] || Activity;
                    return (
                      <div 
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`row-audit-log-${log.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-background rounded-md">
                            <ActionIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium capitalize" data-testid={`text-action-${log.id}`}>
                                {log.action}
                              </span>
                              <Badge variant="outline" className="text-xs">{log.resourceType}</Badge>
                              {log.piiAccessed && (
                                <Badge variant="secondary" className="text-xs">PII</Badge>
                              )}
                              {log.requiresReview && !log.reviewed && (
                                <Badge className="bg-yellow-500 text-xs">Needs Review</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {log.userEmail || "System"} - {log.description || `${log.action} ${log.resourceType}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={SEVERITY_COLORS[log.severity]}>{log.severity}</Badge>
                          <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${log.id}`}>
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-logs">
                  No audit logs found
                </p>
              )}

              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                      disabled={page >= pagination.pages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card data-testid="card-compliance-overview">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>Automated compliance checks and their current status</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-run-all-checks">
                <RefreshCw className="h-4 w-4 mr-2" />
                Run All Checks
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {complianceChecks.map((check) => (
                  <Card 
                    key={check.id} 
                    className={`border-l-4 ${
                      check.status === "passed" ? "border-l-green-500" :
                      check.status === "warning" ? "border-l-yellow-500" :
                      "border-l-red-500"
                    }`}
                    data-testid={`card-check-${check.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-medium">{check.name}</CardTitle>
                        <Badge 
                          variant={check.status === "passed" ? "default" : check.status === "warning" ? "secondary" : "destructive"}
                          className={check.status === "passed" ? "bg-green-500" : ""}
                        >
                          {check.status === "passed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {check.status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {check.status}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="w-fit text-xs">{check.category}</Badge>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground mb-2">{check.description}</p>
                      <p className="text-sm">{check.details}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Last checked: {new Date(check.lastChecked).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-compliance-summary">
              <CardHeader>
                <CardTitle className="text-lg">Compliance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Checks Passed</span>
                    <span className="font-bold text-green-600">{complianceChecks.filter(c => c.status === "passed").length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Warnings</span>
                    <span className="font-bold text-yellow-600">{complianceChecks.filter(c => c.status === "warning").length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed</span>
                    <span className="font-bold text-red-600">{complianceChecks.filter(c => c.status === "failed").length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-export-options">
              <CardHeader>
                <CardTitle className="text-lg">Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleExportAuditLog}
                  data-testid="button-export-audit-log"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Audit Log (CSV)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-export-compliance-report"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export Compliance Report (PDF)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scans" className="space-y-4">
          <Card data-testid="card-scheduled-scans">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Scheduled Compliance Scans</CardTitle>
                <CardDescription>Automated scans to ensure ongoing compliance</CardDescription>
              </div>
              <Button data-testid="button-add-scan">
                <Settings className="h-4 w-4 mr-2" />
                Configure Scans
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledScans.map((scan) => (
                  <div 
                    key={scan.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                    data-testid={`row-scan-${scan.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${scan.status === "active" ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                        {scan.status === "active" ? (
                          <Play className="h-4 w-4 text-green-600" />
                        ) : (
                          <Pause className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{scan.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{scan.schedule}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">
                          Last run: {scan.lastRun ? new Date(scan.lastRun).toLocaleDateString() : "Never"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Next: {new Date(scan.nextRun).toLocaleDateString()}
                        </p>
                      </div>
                      {scan.issuesFound > 0 && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          {scan.issuesFound} issues
                        </Badge>
                      )}
                      <Badge variant={scan.status === "active" ? "default" : "secondary"}>
                        {scan.status}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRunScan(scan.id)}
                        disabled={runningScans.has(scan.id)}
                        data-testid={`button-run-scan-${scan.id}`}
                      >
                        {runningScans.has(scan.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-scan-history">
            <CardHeader>
              <CardTitle>Recent Scan Results</CardTitle>
              <CardDescription>Summary of recent automated scan findings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Daily PII Access Audit</p>
                      <p className="text-xs text-muted-foreground">Completed yesterday at 2:00 AM</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500">Passed</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Monthly Compliance Check</p>
                      <p className="text-xs text-muted-foreground">1 warning found on last scan</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-500 text-yellow-950">Warning</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Weekly Data Export Review</p>
                      <p className="text-xs text-muted-foreground">No issues found</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500">Passed</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => handleGenerateReport("monthly_summary")}
              data-testid="card-monthly-summary"
            >
              <CardHeader>
                <CardTitle className="text-lg">Monthly Summary</CardTitle>
                <CardDescription>Generate a monthly activity summary report</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  disabled={generateReportMutation.isPending}
                  data-testid="button-generate-monthly"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => handleGenerateReport("pii_access")}
              data-testid="card-pii-access"
            >
              <CardHeader>
                <CardTitle className="text-lg">PII Access Report</CardTitle>
                <CardDescription>Track all personal data access events</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-generate-pii">
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="hover-elevate cursor-pointer" 
              onClick={() => handleGenerateReport("data_retention")}
              data-testid="card-data-retention"
            >
              <CardHeader>
                <CardTitle className="text-lg">Data Retention Audit</CardTitle>
                <CardDescription>Review data exports and deletions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-generate-retention">
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-generated-reports">
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>Previously generated compliance reports</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="flex items-center justify-center h-32" data-testid="loading-reports">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (Array.isArray(reports) ? reports : []).length > 0 ? (
                <div className="space-y-2">
                  {(Array.isArray(reports) ? reports : []).map((report) => (
                    <div 
                      key={report.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`row-report-${report.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid={`text-report-name-${report.id}`}>
                            {report.reportName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={report.status === "completed" ? "default" : report.status === "failed" ? "destructive" : "secondary"}>
                          {report.status}
                        </Badge>
                        {report.status === "completed" && (
                          <Button variant="ghost" size="sm" data-testid={`button-view-report-${report.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-reports">
                  No reports generated yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-audit-details">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this event
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <p className="font-medium capitalize" data-testid="text-detail-action">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resource</p>
                  <p className="font-medium" data-testid="text-detail-resource">
                    {selectedLog.resourceType} {selectedLog.resourceId && `(${selectedLog.resourceId})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium" data-testid="text-detail-user">{selectedLog.userEmail || "System"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timestamp</p>
                  <p className="font-medium" data-testid="text-detail-timestamp">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <Badge variant="outline">{selectedLog.category}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <Badge className={SEVERITY_COLORS[selectedLog.severity]}>{selectedLog.severity}</Badge>
                </div>
              </div>

              {selectedLog.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium" data-testid="text-detail-description">{selectedLog.description}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {selectedLog.piiAccessed && <Badge variant="secondary">PII Accessed</Badge>}
                {selectedLog.exportedData && <Badge variant="secondary">Data Exported</Badge>}
              </div>

              {selectedLog.requiresReview && !selectedLog.reviewed && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Review Notes</p>
                  <Textarea
                    placeholder="Add notes about your review..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    data-testid="input-review-notes"
                  />
                </div>
              )}

              {selectedLog.reviewed && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Reviewed</p>
                  <p className="font-medium" data-testid="text-reviewed-at">
                    {new Date(selectedLog.reviewedAt!).toLocaleString()}
                  </p>
                  {selectedLog.reviewNotes && (
                    <p className="text-sm mt-1" data-testid="text-review-notes">{selectedLog.reviewNotes}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)} data-testid="button-close-dialog">
              Close
            </Button>
            {selectedLog?.requiresReview && !selectedLog?.reviewed && (
              <Button 
                onClick={() => reviewMutation.mutate({ id: selectedLog.id, notes: reviewNotes })}
                disabled={reviewMutation.isPending}
                data-testid="button-mark-reviewed"
              >
                {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mark as Reviewed
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
