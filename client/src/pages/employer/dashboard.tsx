import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardCheck, DollarSign, TrendingUp, FileText, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { queryClient } from "@/lib/queryClient";

interface DashboardStats {
  totalEmployees: number;
  activeScreenings: number;
  certifiedEmployees: number;
  projectedCredits: string;
  actualCredits: string;
}

interface RecentActivity {
  id: string;
  employeeName: string;
  action: string;
  status: string;
  date: string;
}

interface EmployeeWithCredit {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  screening: {
    id: string;
    status: string;
    targetGroups: string[];
  } | null;
  credit: {
    id: string;
    maxCreditAmount: string;
    projectedCreditAmount: string;
    actualCreditAmount: string;
    hoursWorked: number;
    status: string;
  } | null;
}

export default function EmployerDashboard() {
  const { isMobile } = useMobileDetect();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/employer/stats"],
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/employer/recent-activity"],
  });

  const { data: screenings, isLoading: screeningsLoading } = useQuery<any[]>({
    queryKey: ["/api/employer/screenings"],
  });

  const { data: employeesWithCredits, isLoading: creditsLoading } = useQuery<EmployeeWithCredit[]>({
    queryKey: ["/api/employer/credits"],
  });

  // Pull-to-refresh for mobile
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/employer/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/employer/recent-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/employer/screenings"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/employer/credits"] }),
    ]);
  };

  const { pullDistance, isRefreshing, isTriggered } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: isMobile,
  });

  // Calculate pipeline distribution
  const pipelineData = (screenings || []).reduce((acc: any, s: any) => {
    const status = s.status;
    const existing = acc.find((item: any) => item.status === status);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ status, count: 1 });
    }
    return acc;
  }, []) || [];

  // Prepare chart data for credits comparison
  const creditChartData = [
    {
      name: "Projected",
      amount: Number((stats?.projectedCredits || "$0").replace(/[$,]/g, "")),
    },
    {
      name: "Actual",
      amount: Number((stats?.actualCredits || "$0").replace(/[$,]/g, "")),
    },
  ];

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    trend,
    link 
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    description?: string;
    trend?: string;
    link?: string;
  }) => {
    const content = (
      <>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid={`text-${title.toLowerCase().replace(/\s+/g, "-")}`}>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">{trend}</span>
            </div>
          )}
        </CardContent>
      </>
    );

    if (link) {
      return (
        <Link href={link}>
          <Card className="hover-elevate cursor-pointer">
            {content}
          </Card>
        </Link>
      );
    }

    return <Card>{content}</Card>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      certified: "default",
      pending: "secondary",
      eligible: "default",
      not_eligible: "destructive",
      denied: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "#94a3b8",
    eligible: "#3b82f6",
    certified: "#22c55e",
    denied: "#ef4444",
    not_eligible: "#f97316",
  };

  return (
    <>
      {/* Pull-to-refresh indicator for mobile */}
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isTriggered={isTriggered}
        />
      )}

      <div className={`container mx-auto p-4 md:p-6 space-y-6 md:space-y-8 ${isMobile ? "pb-20" : ""}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Overview of your WOTC screening and credit tracking
            </p>
          </div>
          <Link href="/employer/employees">
            <Button data-testid="button-view-employees" size={isMobile ? "sm" : "default"}>
              {isMobile ? "Employees" : "View All Employees"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees || 0}
          icon={Users}
          description="Employees in system"
          link="/employer/employees"
        />
        <StatCard
          title="Active Screenings"
          value={stats?.activeScreenings || 0}
          icon={ClipboardCheck}
          description="In-progress screenings"
          link="/employer/screenings"
        />
        <StatCard
          title="Certified"
          value={stats?.certifiedEmployees || 0}
          icon={FileText}
          description="WOTC certified employees"
          link="/employer/screenings"
        />
        <StatCard
          title="Actual Credits"
          value={stats?.actualCredits || "$0"}
          icon={DollarSign}
          description="Tax credits earned"
          link="/employer/credits"
        />
      </div>

      {/* Pipeline & Credits Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Screening Pipeline</CardTitle>
            <CardDescription>Distribution of screening statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {screeningsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : pipelineData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No screening data yet</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="status" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                    height={isMobile ? 60 : 30}
                  />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {pipelineData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Credits Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Projections vs Actuals</CardTitle>
            <CardDescription>Comparison of projected and actual tax credits</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <BarChart data={creditChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip
                    formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                  />
                  <Legend wrapperStyle={{ fontSize: isMobile ? 12 : 14 }} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Employees by Credit */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top Employees by Tax Credit</CardTitle>
              <CardDescription>Employees with the highest actual credit amounts</CardDescription>
            </div>
            <Link href="/employer/credits">
              <Button variant="outline" size="sm" data-testid="button-view-all-credits">
                View All Credits
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {creditsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !employeesWithCredits || employeesWithCredits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No credit data available yet</p>
            </div>
          ) : (
            <div className={isMobile ? "overflow-x-auto" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="text-right">Actual Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesWithCredits
                    .filter(e => e.credit)
                    .sort((a, b) => Number(b.credit?.actualCreditAmount || 0) - Number(a.credit?.actualCreditAmount || 0))
                    .slice(0, 5)
                    .map((emp) => (
                      <TableRow key={emp.employee.id} data-testid={`row-employee-${emp.employee.id}`}>
                        <TableCell className="font-medium">
                          {emp.employee.firstName} {emp.employee.lastName}
                        </TableCell>
                        <TableCell>
                          {emp.credit && getStatusBadge(emp.credit.status)}
                        </TableCell>
                        <TableCell>
                          {emp.credit?.hoursWorked || 0} hours
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${Number(emp.credit?.actualCreditAmount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest screening submissions and status changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className={isMobile ? "overflow-x-auto" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity && recentActivity.length > 0 ? (
                    recentActivity.map((activity) => (
                      <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                        <TableCell className="font-medium">
                          {activity.employeeName}
                        </TableCell>
                        <TableCell>{activity.action}</TableCell>
                        <TableCell>{getStatusBadge(activity.status)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {activity.date}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No recent activity
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Mobile Bottom Navigation */}
    {isMobile && <MobileBottomNav />}
  </>
  );
}
