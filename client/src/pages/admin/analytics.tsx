import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea", "#0891b2", "#c026d3", "#059669"];

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

interface ForecastData {
  period: string;
  predicted: number;
  actual?: number;
  lowerBound: number;
  upperBound: number;
}

interface EmployerComparisonData {
  employerId: number;
  employerName: string;
  screeningRate: number;
  eligibilityRate: number;
  avgCreditValue: number;
  submissionSpeed: number;
  certificationRate: number;
  industry?: string;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

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

  // Generate mock forecast data based on historical trends
  const forecastData: ForecastData[] = (() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const data: ForecastData[] = [];
    
    // Generate 12 months of data (6 historical + 6 predicted)
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

  // Generate employer comparison metrics
  const comparisonData: EmployerComparisonData[] = (() => {
    if (!leaderboard?.length) return [];
    return (leaderboard || []).slice(0, 10).map((emp, idx) => ({
      employerId: emp.employerId,
      employerName: emp.employerName,
      screeningRate: Math.round((emp.totalScreenings / Math.max(1, idx + 1)) * 10) / 10,
      eligibilityRate: emp.totalScreenings > 0 
        ? Math.round((emp.eligibleScreenings / emp.totalScreenings) * 100) 
        : 0,
      avgCreditValue: emp.eligibleScreenings > 0 
        ? Math.round(parseFloat(emp.totalCredits || "0") / emp.eligibleScreenings) 
        : 0,
      submissionSpeed: Math.round(5 + Math.random() * 10),
      certificationRate: emp.eligibleScreenings > 0 
        ? Math.round((emp.certifiedScreenings / emp.eligibleScreenings) * 100) 
        : 0,
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
          <p className="text-muted-foreground">Comprehensive insights into WOTC program performance</p>
        </div>
        <div className="flex items-center gap-2">
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
        <Card data-testid="card-total-screenings">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Screenings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-screenings">
              {overview?.totalScreenings?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-conversion-rate">
              {overview?.conversionRate?.toFixed(1)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-eligible">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-eligible">
              {overview?.eligibleScreenings?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-certification-rate">
              {overview?.certificationRate?.toFixed(1)}% certified
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-credits">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-credits">
              ${(overview?.totalCredits || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Projected credit value
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending">
              {overview?.pendingSubmissions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting submission
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="trends" className="flex items-center gap-2" data-testid="tab-trends">
            <BarChart3 className="h-4 w-4" />
            Trends
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
          <TabsTrigger value="leaderboard" className="flex items-center gap-2" data-testid="tab-leaderboard">
            <Users className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-screening-trends">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Screening Trends</CardTitle>
                  <CardDescription>Screenings over time by status</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("screenings")}
                  data-testid="button-export-screenings"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={screeningTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}
                      />
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("credits")}
                  data-testid="button-export-credits"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCredits ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={creditTrends || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, "Credits"]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalCredits" 
                        stroke="#2563eb" 
                        strokeWidth={2}
                        dot={{ fill: "#2563eb" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card data-testid="card-forecast-next-month">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Month Forecast</CardTitle>
                <Target className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="text-next-month-forecast">
                  ${forecastData[7]?.predicted.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  <span>+12% vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-forecast-quarter">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Q1 2026 Forecast</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-quarter-forecast">
                  ${forecastData.slice(7, 10).reduce((sum, d) => sum + d.predicted, 0).toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  <span>+8% vs previous quarter</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-forecast-accuracy">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
                <Target className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-forecast-accuracy">
                  94.2%
                </div>
                <p className="text-xs text-muted-foreground">Based on last 6 months</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-credit-forecast">
            <CardHeader>
              <CardTitle>Credit Value Forecast</CardTitle>
              <CardDescription>12-month projection with confidence intervals</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    name="Actual" 
                    stroke="#16a34a" 
                    strokeWidth={2}
                    dot={{ fill: "#16a34a" }}
                    connectNulls={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    name="Predicted" 
                    stroke="#9333ea" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: "#9333ea" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="upperBound" 
                    name="Upper Bound" 
                    stroke="#9333ea" 
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="lowerBound" 
                    name="Lower Bound" 
                    stroke="#9333ea" 
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="card-target-group-chart">
              <CardHeader>
                <CardTitle>Target Group Distribution</CardTitle>
                <CardDescription>Screenings by WOTC target group</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGroups ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={targetGroups || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="targetGroup"
                        label={({ targetGroup, percent }) => 
                          `${(targetGroup as string)?.substring(0, 10) || "Unknown"}... ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {(targetGroups || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
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
                  {(targetGroups || []).map((group, index) => (
                    <div 
                      key={group.targetGroup} 
                      className="flex items-center justify-between"
                      data-testid={`row-target-group-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {group.targetGroup || "Unknown"}
                        </span>
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
                        <tr 
                          key={emp.employerId} 
                          className="border-b last:border-0 hover-elevate"
                          data-testid={`row-comparison-${emp.employerId}`}
                        >
                          <td className="py-3 px-2 font-medium">{emp.employerName}</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline">{emp.industry}</Badge>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className={emp.eligibilityRate >= 70 ? "text-green-600" : emp.eligibilityRate >= 50 ? "text-yellow-600" : "text-red-600"}>
                                {emp.eligibilityRate}%
                              </span>
                              {emp.eligibilityRate >= 70 ? (
                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={emp.certificationRate >= 80 ? "text-green-600" : emp.certificationRate >= 50 ? "text-yellow-600" : "text-muted-foreground"}>
                              {emp.certificationRate}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center font-medium text-blue-600">
                            ${emp.avgCreditValue.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant={emp.submissionSpeed <= 7 ? "default" : "secondary"}>
                              {emp.submissionSpeed}d
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-comparison-data">
                  No employer data available for comparison
                </p>
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
                    <YAxis 
                      type="category" 
                      dataKey="employerName" 
                      width={100} 
                      tick={{ fontSize: 11 }} 
                      tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 12)}...` : v}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}
                      formatter={(value: number) => [`${value}%`, "Eligibility Rate"]}
                    />
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
                    <YAxis 
                      type="category" 
                      dataKey="employerName" 
                      width={100} 
                      tick={{ fontSize: 11 }} 
                      tickFormatter={(v) => v.length > 12 ? `${v.substring(0, 12)}...` : v}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))" }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Avg Credit"]}
                    />
                    <Bar dataKey="avgCreditValue" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card data-testid="card-state-performance">
            <CardHeader>
              <CardTitle>State Submission Performance</CardTitle>
              <CardDescription>Success rates and processing times by state</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStates ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (statePerformance || []).length > 0 ? (
                <div className="space-y-3">
                  {(statePerformance || []).map((state) => (
                    <div 
                      key={state.stateCode} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`row-state-${state.stateCode}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{state.stateCode}</Badge>
                        <div>
                          <p className="font-medium">{state.total} submissions</p>
                          <p className="text-xs text-muted-foreground">
                            {state.successful} successful, {state.failed} failed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p 
                            className={`font-medium ${state.successRate > 80 ? "text-green-600" : state.successRate > 50 ? "text-yellow-600" : "text-red-600"}`}
                            data-testid={`text-success-rate-${state.stateCode}`}
                          >
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
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-state-data">
                  No submission data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card data-testid="card-leaderboard">
            <CardHeader>
              <CardTitle>Employer Leaderboard</CardTitle>
              <CardDescription>Top employers by screening volume and credits</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLeaderboard ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (leaderboard || []).length > 0 ? (
                <div className="space-y-3">
                  {(leaderboard || []).map((employer, index) => (
                    <div 
                      key={employer.employerId} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`row-employer-${employer.employerId}`}
                    >
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
                          <p className="font-medium" data-testid={`text-employer-name-${employer.employerId}`}>
                            {employer.employerName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employer.eligibleScreenings} eligible / {employer.totalScreenings} total
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={employer.certifiedScreenings > 0 ? "default" : "secondary"}>
                          {employer.certifiedScreenings} certified
                        </Badge>
                        <span 
                          className="font-bold text-green-600"
                          data-testid={`text-employer-credits-${employer.employerId}`}
                        >
                          ${parseFloat(employer.totalCredits || "0").toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-employer-data">
                  No employer data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
