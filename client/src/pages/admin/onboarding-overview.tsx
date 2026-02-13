import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Users, CheckCircle, Clock, AlertCircle, Building2, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

type AdminOverviewData = {
  totals: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    expired: number;
    completionRate: number;
    avgCompletionHours: number;
  };
  employerStats: {
    employerId: string;
    employerName: string;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
  }[];
  dailyTrend: { date: string; count: number }[];
  enabledEmployerCount: number;
};

export default function AdminOnboardingOverview() {
  const { data, isLoading } = useQuery<AdminOverviewData>({
    queryKey: ["/api/onboarding/admin/overview"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No onboarding data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-onboarding-title">Onboarding Overview</h1>
        <p className="text-muted-foreground">System-wide onboarding metrics across all employers</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-instances">{data.totals.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed">{data.totals.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-in-progress">{data.totals.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">{data.totals.completionRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enabled Employers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-enabled-employers">{data.enabledEmployerCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Onboarding Activity (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.split("-").slice(1).join("/")} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" name="New Instances" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No activity data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employer Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.employerStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.employerStats.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="employerName" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="hsl(var(--chart-2))" name="Completed" />
                  <Bar dataKey="inProgress" fill="hsl(var(--primary))" name="In Progress" />
                  <Bar dataKey="pending" fill="hsl(var(--muted-foreground))" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No employer data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employer Details</CardTitle>
          <CardDescription>Onboarding performance by employer</CardDescription>
        </CardHeader>
        <CardContent>
          {data.employerStats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No employers with onboarding enabled</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>In Progress</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Completion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employerStats.map(emp => (
                  <TableRow key={emp.employerId} data-testid={`row-employer-${emp.employerId}`}>
                    <TableCell className="font-medium">{emp.employerName}</TableCell>
                    <TableCell>{emp.total}</TableCell>
                    <TableCell>
                      <Badge>{emp.completed}</Badge>
                    </TableCell>
                    <TableCell>{emp.inProgress}</TableCell>
                    <TableCell>{emp.pending}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={emp.completionRate} className="w-16" />
                        <span className="text-sm">{emp.completionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
