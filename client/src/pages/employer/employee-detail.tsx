import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  Calendar,
} from "lucide-react";

interface EmployeeDetail {
  employee: any;
  screenings: any[];
  hours: any[];
  credits: any[];
  documents: any[];
}

export default function EmployeeDetailPage() {
  const [, params] = useRoute("/employer/employees/:id");
  const employeeId = params?.id;

  const { data, isLoading, isError } = useQuery<EmployeeDetail>({
    queryKey: [`/api/employer/employees/${employeeId}`],
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto p-6">
        <Link href="/employer/employees">
          <Button variant="outline" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employees
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Error loading employee details
          </CardContent>
        </Card>
      </div>
    );
  }

  const { employee, screenings, hours, credits, documents } = data;
  const latestCredit = credits[0];
  const totalHours = hours.reduce((sum, h) => sum + (h.hours || 0), 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      certified: "default",
      pending: "secondary",
      eligible: "default",
      denied: "destructive",
      not_eligible: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/employer/employees">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-employee-name">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-muted-foreground">{employee.email}</p>
          </div>
        </div>
        {latestCredit && getStatusBadge(latestCredit.status)}
      </div>

      {/* Employee Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Job Title</p>
              <p className="font-medium">{employee.jobTitle || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hire Date</p>
              <p className="font-medium">
                {employee.hireDate
                  ? new Date(employee.hireDate).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{employee.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">
                {employee.address ? `${employee.address}, ${employee.city}, ${employee.state} ${employee.zipCode}` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SSN</p>
              <p className="font-medium font-mono">{employee.ssn ? `***-**-${employee.ssn.slice(-4)}` : "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours Worked</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-hours">
              {totalHours} hrs
            </div>
            <p className="text-xs text-muted-foreground">{hours.length} period(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-credit-amount">
              ${Number(latestCredit?.actualCreditAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Max: ${Number(latestCredit?.maxCreditAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-documents-count">
              {documents.length}
            </div>
            <p className="text-xs text-muted-foreground">Uploaded files</p>
          </CardContent>
        </Card>
      </div>

      {/* Screening History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Screening History
          </CardTitle>
          <CardDescription>WOTC screening records for this employee</CardDescription>
        </CardHeader>
        <CardContent>
          {screenings.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No screening records</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target Groups</TableHead>
                  <TableHead>Certification #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screenings.map((screening) => (
                  <TableRow key={screening.id} data-testid={`row-screening-${screening.id}`}>
                    <TableCell>
                      {new Date(screening.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(screening.status)}</TableCell>
                    <TableCell>
                      {screening.targetGroups?.join(", ") || "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {screening.certificationNumber || "Pending"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hours Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Hours Tracking
          </CardTitle>
          <CardDescription>Work hours recorded for this employee</CardDescription>
        </CardHeader>
        <CardContent>
          {hours.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hours recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period Start</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Wages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.map((hour) => (
                  <TableRow key={hour.id} data-testid={`row-hours-${hour.id}`}>
                    <TableCell>
                      {new Date(hour.periodStart).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(hour.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {hour.hours} hrs
                    </TableCell>
                    <TableCell className="text-right">
                      ${Number(hour.wages || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credit Breakdown */}
      {latestCredit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Credit Breakdown
            </CardTitle>
            <CardDescription>Tax credit calculation details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Target Group</p>
                <p className="font-medium">{latestCredit.targetGroup}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(latestCredit.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hours Worked</p>
                <p className="font-medium">{latestCredit.hoursWorked} hours</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Minimum Required</p>
                <p className="font-medium">{latestCredit.minimumHoursRequired} hours</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wages Earned</p>
                <p className="font-medium text-lg">
                  ${Number(latestCredit.wagesEarned || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Credit</p>
                <p className="font-medium text-lg">
                  ${Number(latestCredit.projectedCreditAmount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual Credit</p>
                <p className="font-medium text-lg text-primary">
                  ${Number(latestCredit.actualCreditAmount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Maximum Credit</p>
                <p className="font-medium text-lg">
                  ${Number(latestCredit.maxCreditAmount || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
