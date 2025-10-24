import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, DollarSign, FileText, TrendingUp, MapPin } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Employer } from "@shared/schema";

interface AdminStats {
  totalEmployers: number;
  activeEmployers: number;
  totalEmployees: number;
  totalScreenings: number;
  totalRevenue: string;
  monthlyRevenue: string;
}

interface EmployerSummary extends Employer {
  employeeCount: number;
  screeningCount: number;
  certifiedCount: number;
  projectedCredits: string;
}

interface CertificationTrend {
  month: string;
  certified: number;
  denied: number;
  pending: number;
}

interface StateBreakdown {
  state: string;
  totalScreenings: number;
  certified: number;
  denied: number;
  totalCredits: string;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: employers, isLoading: employersLoading, isError: employersError } = useQuery<EmployerSummary[]>({
    queryKey: ["/api/admin/employers/summary"],
  });

  const { data: certificationTrends, isLoading: trendsLoading, isError: trendsError } = useQuery<CertificationTrend[]>({
    queryKey: ["/api/admin/analytics/certification-trends"],
  });

  const { data: stateBreakdown, isLoading: statesLoading, isError: statesError } = useQuery<StateBreakdown[]>({
    queryKey: ["/api/admin/analytics/state-breakdown"],
  });

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    trend,
    isLoading,
    isError
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    description?: string;
    trend?: string;
    isLoading?: boolean;
    isError?: boolean;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : isError ? (
            <span className="text-destructive text-sm">Error</span>
          ) : (
            value
          )}
        </div>
        {description && !isError && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {isError && (
          <p className="text-xs text-destructive mt-1">Failed to load data</p>
        )}
        {trend && !isError && !isLoading && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs text-green-600">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Calculate totals from employer data
  const totalCertified = employersLoading ? 0 : (employers?.reduce((sum, e) => sum + e.certifiedCount, 0) || 0);
  const totalProjectedCredits = employersLoading ? 0 : (employers?.reduce((sum, e) => {
    const amount = Number(e.projectedCredits.replace(/[$,]/g, ""));
    return sum + amount;
  }, 0) || 0);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System-wide overview and employer management
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employers"
          value={stats?.totalEmployers || 0}
          icon={Building2}
          description="Active clients"
          isLoading={statsLoading}
          isError={statsError}
        />
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees || 0}
          icon={Users}
          description="Across all employers"
          isLoading={statsLoading}
          isError={statsError}
        />
        <StatCard
          title="Total Screenings"
          value={stats?.totalScreenings || 0}
          icon={FileText}
          description="Completed screenings"
          trend="+15% this month"
          isLoading={statsLoading}
          isError={statsError}
        />
        <StatCard
          title="Total Certified"
          value={totalCertified}
          icon={TrendingUp}
          description="WOTC certified employees"
          isLoading={employersLoading}
          isError={employersError}
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Certification Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Certification Trends</CardTitle>
            <CardDescription>Last 12 months certification activity</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : trendsError ? (
              <div className="flex items-center justify-center h-80 text-destructive">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Error loading trend data</p>
                </div>
              </div>
            ) : !certificationTrends || certificationTrends.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No trend data yet</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={certificationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="certified" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Certified"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="denied" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Denied"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pending" 
                    stroke="#94a3b8" 
                    strokeWidth={2}
                    name="Pending"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* State Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Top States by Screenings</CardTitle>
            <CardDescription>Screening activity by state</CardDescription>
          </CardHeader>
          <CardContent>
            {statesLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : statesError ? (
              <div className="flex items-center justify-center h-80 text-destructive">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Error loading state data</p>
                </div>
              </div>
            ) : !stateBreakdown || stateBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-muted-foreground">
                <div className="text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No state data yet</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stateBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="state" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="certified" fill="#22c55e" name="Certified" />
                  <Bar dataKey="denied" fill="#ef4444" name="Denied" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* State Details Table */}
      {stateBreakdown && stateBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>State Breakdown</CardTitle>
            <CardDescription>
              Detailed screening and credit data by state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Total Screenings</TableHead>
                  <TableHead>Certified</TableHead>
                  <TableHead>Denied</TableHead>
                  <TableHead className="text-right">Total Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateBreakdown.slice(0, 15).map((state) => (
                  <TableRow key={state.state} data-testid={`row-state-${state.state}`}>
                    <TableCell className="font-medium">{state.state}</TableCell>
                    <TableCell>{state.totalScreenings}</TableCell>
                    <TableCell>
                      <Badge variant="default">{state.certified}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{state.denied}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {state.totalCredits}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Employer Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Employer Overview</CardTitle>
          <CardDescription>Performance comparison across all employers</CardDescription>
        </CardHeader>
        <CardContent>
          {employersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Screenings</TableHead>
                  <TableHead>Certified</TableHead>
                  <TableHead>Projected Credits</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employers && employers.length > 0 ? (
                  employers.map((employer) => (
                    <TableRow key={employer.id} data-testid={`row-employer-${employer.id}`}>
                      <TableCell className="font-medium">
                        {employer.name}
                      </TableCell>
                      <TableCell>{employer.employeeCount}</TableCell>
                      <TableCell>{employer.screeningCount}</TableCell>
                      <TableCell>{employer.certifiedCount}</TableCell>
                      <TableCell>{employer.projectedCredits}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={employer.billingStatus === "active" ? "default" : "secondary"}
                        >
                          {employer.billingStatus?.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No employers yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
