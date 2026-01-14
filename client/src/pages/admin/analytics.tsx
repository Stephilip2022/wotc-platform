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
  TrendingDown, 
  Users, 
  FileCheck, 
  DollarSign, 
  Clock,
  Download,
  BarChart3,
  PieChartIcon,
  Loader2,
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

  const { data: screeningTrends, isLoading: loadingTrends } = useQuery({
    queryKey: ["/api/analytics/trends/screenings", startDate.toISOString(), groupBy],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/trends/screenings?startDate=${startDate.toISOString()}&groupBy=${groupBy}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  const { data: creditTrends, isLoading: loadingCredits } = useQuery({
    queryKey: ["/api/analytics/trends/credits", startDate.toISOString(), "month"],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/trends/credits?startDate=${startDate.toISOString()}&groupBy=month`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch credit trends");
      return res.json();
    },
  });

  const { data: targetGroups, isLoading: loadingGroups } = useQuery({
    queryKey: ["/api/analytics/distribution/target-groups"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/distribution/target-groups", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch distribution");
      return res.json();
    },
  });

  const { data: statePerformance, isLoading: loadingStates } = useQuery({
    queryKey: ["/api/analytics/performance/states"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/performance/states", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch state performance");
      return res.json();
    },
  });

  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["/api/analytics/leaderboard/employers"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/leaderboard/employers", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Screenings</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-screenings">
              {overview?.totalScreenings?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.conversionRate?.toFixed(1)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-eligible">
              {overview?.eligibleScreenings?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.certificationRate?.toFixed(1)}% certified
            </p>
          </CardContent>
        </Card>

        <Card>
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

        <Card>
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
        <TabsList>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="distribution" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
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

            <Card>
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

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
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
                          `${targetGroup?.substring(0, 10) || "Unknown"}... ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {(targetGroups || []).map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target Group Details</CardTitle>
                <CardDescription>Credits by target group</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(targetGroups || []).map((group: any, index: number) => (
                    <div key={group.targetGroup} className="flex items-center justify-between">
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
                        <span className="text-sm text-green-600 font-medium">
                          ${parseFloat(group.totalCredits || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
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
                  {(statePerformance || []).map((state: any) => (
                    <div key={state.stateCode} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
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
                          <p className={`font-medium ${state.successRate > 80 ? "text-green-600" : state.successRate > 50 ? "text-yellow-600" : "text-red-600"}`}>
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
                <p className="text-center text-muted-foreground py-8">No submission data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
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
                  {(leaderboard || []).map((employer: any, index: number) => (
                    <div 
                      key={employer.employerId} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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
                          <p className="font-medium">{employer.employerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {employer.eligibleScreenings} eligible / {employer.totalScreenings} total
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={employer.certifiedScreenings > 0 ? "default" : "secondary"}>
                          {employer.certifiedScreenings} certified
                        </Badge>
                        <span className="font-bold text-green-600">
                          ${parseFloat(employer.totalCredits || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No employer data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
