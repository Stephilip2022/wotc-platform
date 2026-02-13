import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Download,
  FileText,
  DollarSign,
  TrendingUp,
  FileCheck,
  Loader2,
  Calendar,
  Trash2,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea", "#0891b2"];
const tooltipStyle = { backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" };

interface ROISummaryData {
  wotcCredits: number;
  multiCreditPrograms: number;
  totalCredits: number;
  wotcCalculations: number;
  multiCreditCalculations: number;
  totalEmployers: number;
  totalEmployees: number;
  avgCreditPerEmployee: number;
  eligibilityRate: number;
  estimatedAnnualROI: number;
}

interface CategoryData {
  category: string;
  programCount: number;
  totalCredits: number;
  avgCredit: number;
  employeeCount: number;
}

interface ReportRecord {
  id: string;
  reportType: string;
  reportTitle: string;
  status: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
}

function formatCurrency(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function EmployerReportsPage() {
  const [period, setPeriod] = useState("30d");
  const { toast } = useToast();

  const startDate = (() => {
    const now = new Date();
    switch (period) {
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  })();

  const { data: roi, isLoading: loadingROI } = useQuery<ROISummaryData>({
    queryKey: ["/api/analytics/roi/summary"],
  });

  const { data: categories } = useQuery<CategoryData[]>({
    queryKey: ["/api/analytics/programs/by-category"],
  });

  const { data: reports, isLoading: loadingReports } = useQuery<ReportRecord[]>({
    queryKey: ["/api/analytics/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (type: string) => {
      const response = await fetch("/api/analytics/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportType: type,
          periodStart: startDate.toISOString(),
          periodEnd: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to generate report");
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/pdf")) {
        throw new Error("Unexpected response format");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rockerbox_${type}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/reports"] });
      toast({ title: "Report Generated", description: "Your PDF report has been downloaded." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to generate report. Please try again.", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/analytics/reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/reports"] });
      toast({ title: "Deleted", description: "Report removed successfully." });
    },
  });

  const categoryChartData = (Array.isArray(categories) ? categories : []).map(c => ({
    name: c.category || "Other",
    credits: c.totalCredits,
    programs: c.programCount,
  }));

  const reportTypes = [
    {
      type: "credit_summary",
      title: "Credit Summary Report",
      description: "Weekly overview of all WOTC and multi-credit program credits, screening results, and target group breakdowns.",
      icon: DollarSign,
      color: "text-blue-500",
    },
    {
      type: "roi_analysis",
      title: "ROI Analysis Report",
      description: "Quarterly return on investment analysis with cost-benefit breakdown, annualized projections, and employee impact.",
      icon: TrendingUp,
      color: "text-green-500",
    },
    {
      type: "compliance",
      title: "Compliance Status Report",
      description: "Monthly compliance scoring, screening completion rates, submission status, and actionable recommendations.",
      icon: FileCheck,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate professional PDF reports and view your credit analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" data-testid="select-period">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingROI ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-credits">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-credits">{formatCurrency(roi?.totalCredits || 0)}</div>
              <p className="text-xs text-muted-foreground">
                WOTC: {formatCurrency(roi?.wotcCredits || 0)} + Multi: {formatCurrency(roi?.multiCreditPrograms || 0)}
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-employees">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-employees">{roi?.totalEmployees || 0}</div>
              <p className="text-xs text-muted-foreground">Avg {formatCurrency(roi?.avgCreditPerEmployee || 0)} per employee</p>
            </CardContent>
          </Card>
          <Card data-testid="card-eligibility">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eligibility Rate</CardTitle>
              <FileCheck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-eligibility">{roi?.eligibilityRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Of screened employees</p>
            </CardContent>
          </Card>
          <Card data-testid="card-annual-roi">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Est. Annual ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-annual-roi">{formatCurrency(roi?.estimatedAnnualROI || 0)}</div>
              <p className="text-xs text-muted-foreground">Based on current trends</p>
            </CardContent>
          </Card>
        </div>
      )}

      {categoryChartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-category-pie">
            <CardHeader>
              <CardTitle>Credits by Category</CardTitle>
              <CardDescription>Distribution across program types</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryChartData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="credits" nameKey="name"
                    label={({ name, percent }) => `${(name as string)?.substring(0, 12)} ${(percent * 100).toFixed(0)}%`}>
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), "Credits"]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-category-bar">
            <CardHeader>
              <CardTitle>Program Categories</CardTitle>
              <CardDescription>Programs and credits per category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), "Credits"]} />
                  <Bar dataKey="credits" name="Credits" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-generate-reports">
        <CardHeader>
          <CardTitle>Generate PDF Reports</CardTitle>
          <CardDescription>Create professional, branded PDF reports for download and sharing with stakeholders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {reportTypes.map((rt) => (
              <Card key={rt.type} className="hover-elevate cursor-pointer" data-testid={`card-report-${rt.type}`}
                onClick={() => !generateReportMutation.isPending && generateReportMutation.mutate(rt.type)}>
                <CardContent className="p-5">
                  <rt.icon className={`h-8 w-8 mb-3 ${rt.color}`} />
                  <p className="font-medium mb-1">{rt.title}</p>
                  <p className="text-xs text-muted-foreground">{rt.description}</p>
                  {generateReportMutation.isPending && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating...
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-report-history">
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports available for download</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingReports ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (Array.isArray(reports) ? reports : []).length > 0 ? (
            <div className="space-y-2">
              {(Array.isArray(reports) ? reports : []).map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md" data-testid={`row-report-${report.id}`}>
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{report.reportTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" "} - {(report.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{report.downloadCount} downloads</Badge>
                    <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}
                      onClick={() => window.open(`/api/analytics/reports/${report.id}/download`, "_blank")}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="ghost" size="icon" data-testid={`button-delete-${report.id}`}
                      onClick={() => deleteReportMutation.mutate(report.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8" data-testid="text-no-reports">
              No reports generated yet. Click a report type above to create your first one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
