import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, DollarSign, FileText, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: employers, isLoading: employersLoading } = useQuery<EmployerSummary[]>({
    queryKey: ["/api/admin/employers/summary"],
  });

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    trend 
  }: { 
    title: string; 
    value: string | number; 
    icon: any; 
    description?: string;
    trend?: string;
  }) => (
    <Card>
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
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System-wide overview and employer management
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employers"
          value={stats?.totalEmployers || 0}
          icon={Building2}
          description="Active clients"
        />
        <StatCard
          title="Total Employees"
          value={stats?.totalEmployees || 0}
          icon={Users}
          description="Across all employers"
        />
        <StatCard
          title="Total Screenings"
          value={stats?.totalScreenings || 0}
          icon={FileText}
          description="Completed screenings"
          trend="+15% this month"
        />
        <StatCard
          title="Total Revenue"
          value={stats?.totalRevenue || "$0"}
          icon={DollarSign}
          description="All-time revenue"
          trend="+22% this month"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employer Overview</CardTitle>
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
