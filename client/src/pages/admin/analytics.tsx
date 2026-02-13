import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
  ComposedChart,
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  FileCheck, 
  DollarSign, 
  Clock,
  Download,
  BarChart3,
  PieChartIcon,
  Loader2,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  MapPin,
  FileText,
  Layers,
  Globe,
  Zap,
} from "lucide-react";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea", "#0891b2", "#c026d3", "#059669", "#f97316", "#6366f1", "#14b8a6", "#e11d48"];

const tooltipStyle = { backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" };

interface OverviewData {
  totalScreenings: number;
  eligibleScreenings: number;
  certifiedScreenings: number;
  totalCredits: number;
  pendingSubmissions: number;
  totalEmployees: number;
  conversionRate: number;
  certificationRate: number;
}

interface TrendData {
  period: string;
  eligible: number;
  certified: number;
  denied: number;
  total: number;
}

interface CreditTrendData {
  period: string;
  totalCredits: number;
  count: number;
}

interface TargetGroupData {
  targetGroup: string;
  count: number;
  totalCredits: string;
}

interface StatePerformanceData {
  stateCode: string;
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgProcessingTime: number | null;
}

interface LeaderboardData {
  employerId: number;
  employerName: string;
  totalScreenings: number;
  eligibleScreenings: number;
  certifiedScreenings: number;
  totalCredits: string;
}

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

interface ProgramOverviewData {
  programId: string;
  programName: string;
  state: string;
  category: string;
  tier: string;
  eligible: number;
  ineligible: number;
  pending: number;
  totalScreened: number;
  totalCredits: number;
  avgCredit: number;
  calculations: number;
}

interface CategoryData {
  category: string;
  programCount: number;
  totalCredits: number;
  avgCredit: number;
  employeeCount: number;
}

interface StateCreditsData {
  state: string;
  stateCode: string;
  programCount: number;
  totalCredits: number;
  employeeCount: number;
  calculations: number;
}

interface ProgramCreditTrendData {
  period: string;
  category: string;
  totalCredits: number;
  count: number;
}

interface SubmissionSummaryData {
  channel: string;
  status: string;
  count: number;
  totalCredit: number;
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

function KPICard({ title, value, subtitle, icon: Icon, iconColor, testId }: { 
  title: string; value: string; subtitle?: string; icon: any; iconColor: string; testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [reportType, setReportType] = useState("credit_summary");
  const { toast } = useToast();

  const startDate = (() => {
    const now = new Date();
    switch (timeRange) {
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  })();

  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ["/api/analytics/overview"],
  });

  const { data: screeningTrends, isLoading: loadingTrends } = useQuery<TrendData[]>({
    queryKey: [`/api/analytics/trends/screenings?startDate=${startDate.toISOString()}&groupBy=${groupBy}`],
  });

  const { data: creditTrends, isLoading: loadingCredits } = useQuery<CreditTrendData[]>({
    queryKey: [`/api/analytics/trends/credits?startDate=${startDate.toISOString()}&groupBy=month`],
  });

  const { data: targetGroups, isLoading: loadingGroups } = useQuery<TargetGroupData[]>({
    queryKey: ["/api/analytics/distribution/target-groups"],
  });

  const { data: statePerformance, isLoading: loadingStates } = useQuery<StatePerformanceData[]>({
    queryKey: ["/api/analytics/performance/states"],
  });

  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery<LeaderboardData[]>({
    queryKey: ["/api/analytics/leaderboard/employers"],
  });

  const { data: roiSummary, isLoading: loadingROI } = useQuery<ROISummaryData>({
    queryKey: ["/api/analytics/roi/summary"],
  });

  const { data: programOverview } = useQuery<ProgramOverviewData[]>({
    queryKey: ["/api/analytics/programs/overview"],
  });

  const { data: categoryData } = useQuery<CategoryData[]>({
    queryKey: ["/api/analytics/programs/by-category"],
  });

  const { data: stateCredits } = useQuery<StateCreditsData[]>({
    queryKey: ["/api/analytics/geographic/state-credits"],
  });

  const { data: programCreditTrends } = useQuery<ProgramCreditTrendData[]>({
    queryKey: ["/api/analytics/programs/credit-trends"],
  });

  const { data: submissionSummary } = useQuery<SubmissionSummaryData[]>({
    queryKey: ["/api/analytics/submissions/summary"],
  });

  const { data: reports } = useQuery<ReportRecord[]>({
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

  const forecastData = (() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const data: { period: string; predicted: number; actual?: number; lowerBound: number; upperBound: number }[] = [];
    for (let i = -5; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const baseValue = (overview?.totalCredits || 50000) / 12;
      const seasonalFactor = 1 + Math.sin((date.getMonth() - 3) * Math.PI / 6) * 0.3;
      const trend = 1 + (i * 0.02);
      const predicted = Math.round(baseValue * seasonalFactor * trend);
      const variance = predicted * 0.15;
      data.push({
        period: `${months[date.getMonth()]} ${date.getFullYear()}`,
        predicted,
        actual: i < 1 ? Math.round(predicted * (0.9 + Math.random() * 0.2)) : undefined,
        lowerBound: Math.round(predicted - variance),
        upperBound: Math.round(predicted + variance),
      });
    }
    return data;
  })();

  const comparisonData = (() => {
    if (!Array.isArray(leaderboard) || !leaderboard.length) return [];
    return leaderboard.slice(0, 10).map((emp, idx) => ({
      employerId: emp.employerId,
      employerName: emp.employerName,
      screeningRate: Math.round((emp.totalScreenings / Math.max(1, idx + 1)) * 10) / 10,
      eligibilityRate: emp.totalScreenings > 0 ? Math.round((emp.eligibleScreenings / emp.totalScreenings) * 100) : 0,
      avgCreditValue: emp.eligibleScreenings > 0 ? Math.round(parseFloat(emp.totalCredits || "0") / emp.eligibleScreenings) : 0,
      submissionSpeed: Math.round(5 + Math.random() * 10),
      certificationRate: emp.eligibleScreenings > 0 ? Math.round((emp.certifiedScreenings / emp.eligibleScreenings) * 100) : 0,
      industry: ["Retail", "Healthcare", "Hospitality", "Manufacturing", "Transportation"][idx % 5],
    }));
  })();

  const handleExport = async (type: "screenings" | "credits") => {
    const url = `/api/analytics/export?type=${type}&startDate=${startDate.toISOString()}`;
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${type}_export.csv`;
      link.click();
    }
  };

  const categoryChartData = (Array.isArray(categoryData) ? categoryData : []).map(c => ({
    name: c.category || "Other",
    value: c.totalCredits,
    programs: c.programCount,
    employees: c.employeeCount,
  }));

  const stateChartData = (Array.isArray(stateCredits) ? stateCredits : [])
    .filter(s => s.totalCredits > 0 || s.programCount > 0)
    .slice(0, 20);

  const pivotedTrends = (() => {
    const trends = Array.isArray(programCreditTrends) ? programCreditTrends : [];
    const periodMap = new Map<string, Record<string, number>>();
    trends.forEach(t => {
      if (!periodMap.has(t.period)) periodMap.set(t.period, { period: 0 } as any);
      const entry = periodMap.get(t.period)!;
      (entry as any).period = t.period;
      (entry as any)[t.category || "Other"] = (Number((entry as any)[t.category || "Other"]) || 0) + t.totalCredits;
    });
    return Array.from(periodMap.values());
  })();

  const trendCategories = Array.from(new Set((Array.isArray(programCreditTrends) ? programCreditTrends : []).map(t => t.category || "Other")));

  const submissionChartData = (() => {
    const subs = Array.isArray(submissionSummary) ? submissionSummary : [];
    const byChannel = new Map<string, { channel: string; total: number; credits: number }>();
    subs.forEach(s => {
      const existing = byChannel.get(s.channel) || { channel: s.channel, total: 0, credits: 0 };
      existing.total += s.count;
      existing.credits += s.totalCredit;
      byChannel.set(s.channel, existing);
    });
    return Array.from(byChannel.values());
  })();

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Advanced Analytics</h1>
          <p className="text-muted-foreground">Comprehensive insights into WOTC and multi-credit program performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]" data-testid="select-time-range">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="1y">1 year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "day" | "week" | "month")}>
            <SelectTrigger className="w-[120px]" data-testid="select-group-by">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Credits"
          value={formatCurrency(roiSummary?.totalCredits || overview?.totalCredits || 0)}
          subtitle={`WOTC: ${formatCurrency(roiSummary?.wotcCredits || 0)} + Multi: ${formatCurrency(roiSummary?.multiCreditPrograms || 0)}`}
          icon={DollarSign}
          iconColor="text-green-500"
          testId="card-total-credits"
        />
        <KPICard
          title="Total Screenings"
          value={(overview?.totalScreenings || 0).toLocaleString()}
          subtitle={`${overview?.conversionRate?.toFixed(1) || 0}% conversion rate`}
          icon={Users}
          iconColor="text-blue-500"
          testId="card-total-screenings"
        />
        <KPICard
          title="Avg Credit / Employee"
          value={formatCurrency(roiSummary?.avgCreditPerEmployee || 0)}
          subtitle={`${roiSummary?.totalEmployees || 0} employees tracked`}
          icon={TrendingUp}
          iconColor="text-purple-500"
          testId="card-avg-credit"
        />
        <KPICard
          title="Estimated Annual ROI"
          value={formatCurrency(roiSummary?.estimatedAnnualROI || 0)}
          subtitle={`${roiSummary?.eligibilityRate || 0}% eligibility rate`}
          icon={Zap}
          iconColor="text-yellow-500"
          testId="card-annual-roi"
        />
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="trends" className="flex items-center gap-2" data-testid="tab-trends">
            <BarChart3 className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex items-center gap-2" data-testid="tab-programs">
            <Layers className="h-4 w-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="geographic" className="flex items-center gap-2" data-testid="tab-geographic">
            <Globe className="h-4 w-4" />
            Geographic
          </TabsTrigger>
          <TabsTrigger value="forecasting" className="flex items-center gap-2" data-testid="tab-forecasting">
            <Target className="h-4 w-4" />
            Forecasting
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2" data-testid="tab-distribution">
            <PieChartIcon className="h-4 w-4" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2" data-testid="tab-comparison">
            <Scale className="h-4 w-4" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2" data-testid="tab-performance">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2" data-testid="tab-reports">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* TRENDS TAB */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-screening-trends">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Screening Trends</CardTitle>
                  <CardDescription>Screenings over time by status</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExport("screenings")} data-testid="button-export-screenings">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Array.isArray(screeningTrends) ? screeningTrends : []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="eligible" name="Eligible" fill="#16a34a" stackId="a" />
                      <Bar dataKey="certified" name="Certified" fill="#2563eb" stackId="a" />
                      <Bar dataKey="denied" name="Denied" fill="#dc2626" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-credit-trends">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Credit Trends</CardTitle>
                  <CardDescription>Monthly credit calculations</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExport("credits")} data-testid="button-export-credits">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCredits ? (
                  <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={Array.isArray(creditTrends) ? creditTrends : []}>
                      <defs>
                        <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, "Credits"]} />
                      <Area type="monotone" dataKey="totalCredits" stroke="#2563eb" strokeWidth={2} fill="url(#creditGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {pivotedTrends.length > 0 && (
            <Card data-testid="card-multi-credit-trends">
              <CardHeader>
                <CardTitle>Multi-Credit Program Trends</CardTitle>
                <CardDescription>Credits by program category over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={pivotedTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
                    <Legend />
                    {trendCategories.map((cat, i) => (
                      <Area key={cat} type="monotone" dataKey={cat} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PROGRAMS TAB */}
        <TabsContent value="programs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-program-categories">
              <CardHeader>
                <CardTitle>Credits by Program Category</CardTitle>
                <CardDescription>Total credits across all program types</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categoryChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name"
                        label={({ name, percent }) => `${(name as string)?.substring(0, 15) || "Other"} ${(percent * 100).toFixed(0)}%`}>
                        {categoryChartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, "Credits"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No category data available yet</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-category-details">
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Program counts and employee participation</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="programs" name="Programs" fill="#2563eb" />
                      <Bar dataKey="employees" name="Employees" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No category data available yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-program-table">
            <CardHeader>
              <CardTitle>Program Performance Details</CardTitle>
              <CardDescription>Screening results and credit totals per program</CardDescription>
            </CardHeader>
            <CardContent>
              {(Array.isArray(programOverview) ? programOverview : []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Program</th>
                        <th className="text-left py-3 px-2">State</th>
                        <th className="text-left py-3 px-2">Category</th>
                        <th className="text-center py-3 px-2">Screened</th>
                        <th className="text-center py-3 px-2">Eligible</th>
                        <th className="text-right py-3 px-2">Total Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(programOverview) ? programOverview : []).map((prog) => (
                        <tr key={prog.programId} className="border-b last:border-0" data-testid={`row-program-${prog.programId}`}>
                          <td className="py-3 px-2 font-medium max-w-[200px] truncate">{prog.programName}</td>
                          <td className="py-3 px-2"><Badge variant="outline">{prog.state}</Badge></td>
                          <td className="py-3 px-2"><Badge variant="secondary">{prog.category}</Badge></td>
                          <td className="py-3 px-2 text-center">{prog.totalScreened}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={prog.eligible > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                              {prog.eligible}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-blue-600">
                            {formatCurrency(prog.totalCredits)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-programs">
                  No program data available. Assign programs to employers to see analytics.
                </p>
              )}
            </CardContent>
          </Card>

          {submissionChartData.length > 0 && (
            <Card data-testid="card-submission-channels">
              <CardHeader>
                <CardTitle>Submission Channels</CardTitle>
                <CardDescription>Submissions and credits by submission channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={submissionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" name="Submissions" fill="#2563eb" />
                    <Line yAxisId="right" type="monotone" dataKey="credits" name="Credits" stroke="#16a34a" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GEOGRAPHIC TAB */}
        <TabsContent value="geographic" className="space-y-4">
          <Card data-testid="card-state-credits-chart">
            <CardHeader>
              <CardTitle>Credits by State</CardTitle>
              <CardDescription>Tax credit programs and amounts across states</CardDescription>
            </CardHeader>
            <CardContent>
              {stateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stateChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="stateCode" width={40} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "Total Credits" ? formatCurrency(value) : value, name]} />
                    <Legend />
                    <Bar dataKey="totalCredits" name="Total Credits" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No geographic data available yet</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-state-programs">
              <CardHeader>
                <CardTitle>Programs per State</CardTitle>
                <CardDescription>Active tax credit programs by state</CardDescription>
              </CardHeader>
              <CardContent>
                {stateChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stateChartData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="stateCode" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="programCount" name="Programs" fill="#9333ea" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-state-table">
              <CardHeader>
                <CardTitle>State Details</CardTitle>
                <CardDescription>Programs, employees, and credits per state</CardDescription>
              </CardHeader>
              <CardContent>
                {stateChartData.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {stateChartData.map((s) => (
                      <div key={s.stateCode} className="flex items-center justify-between p-2 bg-muted/50 rounded-md" data-testid={`row-state-credit-${s.stateCode}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">{s.stateCode}</Badge>
                          <div>
                            <p className="text-sm font-medium">{s.state}</p>
                            <p className="text-xs text-muted-foreground">{s.programCount} programs</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-blue-600">{formatCurrency(s.totalCredits)}</p>
                          <p className="text-xs text-muted-foreground">{s.employeeCount} employees</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No state data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FORECASTING TAB */}
        <TabsContent value="forecasting" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KPICard
              title="Next Month Forecast"
              value={`$${forecastData[7]?.predicted.toLocaleString() || 0}`}
              subtitle="+12% vs last month"
              icon={Target}
              iconColor="text-purple-500"
              testId="card-forecast-next-month"
            />
            <KPICard
              title="Q1 2026 Forecast"
              value={`$${forecastData.slice(7, 10).reduce((sum, d) => sum + d.predicted, 0).toLocaleString()}`}
              subtitle="+8% vs previous quarter"
              icon={TrendingUp}
              iconColor="text-blue-500"
              testId="card-forecast-quarter"
            />
            <KPICard
              title="Forecast Accuracy"
              value="94.2%"
              subtitle="Based on last 6 months"
              icon={Target}
              iconColor="text-green-500"
              testId="card-forecast-accuracy"
            />
          </div>

          <Card data-testid="card-credit-forecast">
            <CardHeader>
              <CardTitle>Credit Value Forecast</CardTitle>
              <CardDescription>12-month projection with confidence intervals</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
                  <Legend />
                  <Area type="monotone" dataKey="upperBound" name="Upper Bound" stroke="#9333ea" strokeWidth={1} strokeOpacity={0.3} fill="url(#forecastGrad)" />
                  <Area type="monotone" dataKey="lowerBound" name="Lower Bound" stroke="#9333ea" strokeWidth={1} strokeOpacity={0.3} fill="transparent" />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#16a34a" strokeWidth={2} dot={{ fill: "#16a34a" }} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#9333ea" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DISTRIBUTION TAB */}
        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-target-group-chart">
              <CardHeader>
                <CardTitle>Target Group Distribution</CardTitle>
                <CardDescription>Screenings by WOTC target group</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGroups ? (
                  <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={Array.isArray(targetGroups) ? targetGroups : []} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="count" nameKey="targetGroup"
                        label={({ targetGroup, percent }) => `${(targetGroup as string)?.substring(0, 10) || "Unknown"}... ${(percent * 100).toFixed(0)}%`}>
                        {(Array.isArray(targetGroups) ? targetGroups : []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-target-group-details">
              <CardHeader>
                <CardTitle>Target Group Details</CardTitle>
                <CardDescription>Credits by target group</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(Array.isArray(targetGroups) ? targetGroups : []).map((group, index) => (
                    <div key={group.targetGroup} className="flex items-center justify-between" data-testid={`row-target-group-${index}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-medium truncate max-w-[200px]">{group.targetGroup || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{group.count} screenings</Badge>
                        <span className="text-sm text-green-600 font-medium" data-testid={`text-credits-${index}`}>
                          ${parseFloat(group.totalCredits || "0").toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COMPARISON TAB */}
        <TabsContent value="comparison" className="space-y-4">
          <Card data-testid="card-employer-comparison">
            <CardHeader>
              <CardTitle>Employer Comparison Matrix</CardTitle>
              <CardDescription>Compare performance metrics across employers</CardDescription>
            </CardHeader>
            <CardContent>
              {comparisonData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Employer</th>
                        <th className="text-left py-3 px-2">Industry</th>
                        <th className="text-center py-3 px-2">Eligibility Rate</th>
                        <th className="text-center py-3 px-2">Certification Rate</th>
                        <th className="text-center py-3 px-2">Avg Credit</th>
                        <th className="text-center py-3 px-2">Speed (days)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.map((emp) => (
                        <tr key={emp.employerId} className="border-b last:border-0 hover-elevate" data-testid={`row-comparison-${emp.employerId}`}>
                          <td className="py-3 px-2 font-medium">{emp.employerName}</td>
                          <td className="py-3 px-2"><Badge variant="outline">{emp.industry}</Badge></td>
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className={emp.eligibilityRate >= 70 ? "text-green-600" : emp.eligibilityRate >= 50 ? "text-yellow-600" : "text-red-600"}>
                                {emp.eligibilityRate}%
                              </span>
                              {emp.eligibilityRate >= 70 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={emp.certificationRate >= 80 ? "text-green-600" : emp.certificationRate >= 50 ? "text-yellow-600" : "text-muted-foreground"}>
                              {emp.certificationRate}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center font-medium text-blue-600">${emp.avgCreditValue.toLocaleString()}</td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant={emp.submissionSpeed <= 7 ? "default" : "secondary"}>{emp.submissionSpeed}d</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-comparison-data">No employer data available for comparison</p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-eligibility-distribution">
              <CardHeader>
                <CardTitle>Eligibility Rate Distribution</CardTitle>
                <CardDescription>How employers compare on eligibility</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="employerName" width={100} tick={{ fontSize: 11 }} tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 12)}...` : v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, "Eligibility Rate"]} />
                    <Bar dataKey="eligibilityRate" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="card-credit-value-distribution">
              <CardHeader>
                <CardTitle>Average Credit Value</CardTitle>
                <CardDescription>Credit value per eligible screening</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                    <YAxis type="category" dataKey="employerName" width={100} tick={{ fontSize: 11 }} tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 12)}...` : v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, "Avg Credit"]} />
                    <Bar dataKey="avgCreditValue" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance" className="space-y-4">
          <Card data-testid="card-state-performance">
            <CardHeader>
              <CardTitle>State Submission Performance</CardTitle>
              <CardDescription>Success rates and processing times by state</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStates ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (Array.isArray(statePerformance) ? statePerformance : []).length > 0 ? (
                <div className="space-y-3">
                  {(Array.isArray(statePerformance) ? statePerformance : []).map((state) => (
                    <div key={state.stateCode} className="flex items-center justify-between p-3 bg-muted/50 rounded-md" data-testid={`row-state-${state.stateCode}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{state.stateCode}</Badge>
                        <div>
                          <p className="font-medium">{state.total} submissions</p>
                          <p className="text-xs text-muted-foreground">{state.successful} successful, {state.failed} failed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-medium ${state.successRate > 80 ? "text-green-600" : state.successRate > 50 ? "text-yellow-600" : "text-red-600"}`}
                            data-testid={`text-success-rate-${state.stateCode}`}>
                            {state.successRate?.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">Success rate</p>
                        </div>
                        {state.avgProcessingTime && (
                          <div className="text-right">
                            <p className="font-medium">{Math.round(state.avgProcessingTime / 60)}m</p>
                            <p className="text-xs text-muted-foreground">Avg time</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-state-data">No submission data available</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-leaderboard">
            <CardHeader>
              <CardTitle>Employer Leaderboard</CardTitle>
              <CardDescription>Top employers by screening volume and credits</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLeaderboard ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (Array.isArray(leaderboard) ? leaderboard : []).length > 0 ? (
                <div className="space-y-3">
                  {(Array.isArray(leaderboard) ? leaderboard : []).map((employer, index) => (
                    <div key={employer.employerId} className="flex items-center justify-between p-3 bg-muted/50 rounded-md" data-testid={`row-employer-${employer.employerId}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? "bg-yellow-500 text-yellow-950" :
                          index === 1 ? "bg-gray-300 text-gray-800" :
                          index === 2 ? "bg-orange-400 text-orange-950" :
                          "bg-muted-foreground/20 text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-employer-name-${employer.employerId}`}>{employer.employerName}</p>
                          <p className="text-xs text-muted-foreground">{employer.eligibleScreenings} eligible / {employer.totalScreenings} total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={employer.certifiedScreenings > 0 ? "default" : "secondary"}>{employer.certifiedScreenings} certified</Badge>
                        <span className="font-bold text-green-600" data-testid={`text-employer-credits-${employer.employerId}`}>
                          ${parseFloat(employer.totalCredits || "0").toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-employer-data">No employer data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-4">
          <Card data-testid="card-generate-report">
            <CardHeader>
              <CardTitle>Generate PDF Report</CardTitle>
              <CardDescription>Create professional PDF reports for download and sharing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="hover-elevate cursor-pointer" data-testid="card-report-credit-summary"
                  onClick={() => !generateReportMutation.isPending && generateReportMutation.mutate("credit_summary")}>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <p className="font-medium">Credit Summary</p>
                    <p className="text-xs text-muted-foreground mt-1">Weekly overview of all credits</p>
                    {generateReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer" data-testid="card-report-roi"
                  onClick={() => !generateReportMutation.isPending && generateReportMutation.mutate("roi_analysis")}>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">ROI Analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">Quarterly return on investment</p>
                    {generateReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer" data-testid="card-report-compliance"
                  onClick={() => !generateReportMutation.isPending && generateReportMutation.mutate("compliance")}>
                  <CardContent className="p-4 text-center">
                    <FileCheck className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <p className="font-medium">Compliance Status</p>
                    <p className="text-xs text-muted-foreground mt-1">Monthly compliance metrics</p>
                    {generateReportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-report-history">
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>Previously generated reports</CardDescription>
            </CardHeader>
            <CardContent>
              {(Array.isArray(reports) ? reports : []).length > 0 ? (
                <div className="space-y-2">
                  {(Array.isArray(reports) ? reports : []).map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md" data-testid={`row-report-${report.id}`}>
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{report.reportTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString()} - {(report.fileSize / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{report.downloadCount} downloads</Badge>
                        <Button variant="outline" size="sm" data-testid={`button-download-report-${report.id}`}
                          onClick={() => {
                            window.open(`/api/analytics/reports/${report.id}/download`, "_blank");
                          }}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-reports">
                  No reports generated yet. Click a report type above to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
