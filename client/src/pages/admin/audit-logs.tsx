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
    action: "",
    category: "",
    severity: "",
    requiresReview: "",
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const buildQueryString = () => {
    const params = new URLSearchParams({ page: page.toString(), limit: "25" });
    if (filters.action) params.append("action", filters.action);
    if (filters.category) params.append("category", filters.category);
    if (filters.severity) params.append("severity", filters.severity);
    if (filters.requiresReview) params.append("requiresReview", filters.requiresReview);
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

  const logs = logsData?.logs || [];
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
        <TabsList>
          <TabsTrigger value="logs" className="flex items-center gap-2" data-testid="tab-audit-logs">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2" data-testid="tab-compliance-reports">
            <FileText className="h-4 w-4" />
            Compliance Reports
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
                      <SelectItem value="">All Actions</SelectItem>
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
                      <SelectItem value="">All Categories</SelectItem>
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
                      <SelectItem value="">All</SelectItem>
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
              ) : (reports || []).length > 0 ? (
                <div className="space-y-2">
                  {(reports || []).map((report) => (
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
