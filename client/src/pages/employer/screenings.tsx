import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, Eye } from "lucide-react";
import { useState } from "react";
import type { Screening, Employee } from "@shared/schema";

interface ScreeningWithEmployee extends Screening {
  employee: Employee;
}

export default function ScreeningsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: screenings, isLoading } = useQuery<ScreeningWithEmployee[]>({
    queryKey: ["/api/employer/screenings"],
  });

  const filteredScreenings = screenings?.filter((screening) => {
    const search = searchTerm.toLowerCase();
    return (
      screening.employee.firstName.toLowerCase().includes(search) ||
      screening.employee.lastName.toLowerCase().includes(search) ||
      screening.primaryTargetGroup?.toLowerCase().includes(search)
    );
  }) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      certified: "default",
      eligible: "default",
      pending: "secondary",
      not_eligible: "destructive",
      denied: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Screenings</h1>
        <p className="text-muted-foreground">
          Track WOTC eligibility screenings and certifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search screenings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-screenings"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Target Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Certification #</TableHead>
                <TableHead>Form 8850</TableHead>
                <TableHead>Form 9061</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScreenings.length > 0 ? (
                filteredScreenings.map((screening) => (
                  <TableRow key={screening.id} data-testid={`row-screening-${screening.id}`}>
                    <TableCell className="font-medium">
                      {screening.employee.firstName} {screening.employee.lastName}
                    </TableCell>
                    <TableCell>{screening.primaryTargetGroup || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(screening.status || "pending")}</TableCell>
                    <TableCell>
                      {screening.certificationNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {screening.form8850Generated ? (
                        <Badge variant="secondary">Generated</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {screening.form9061Generated ? (
                        <Badge variant="secondary">Generated</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" data-testid={`button-view-${screening.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {screening.form8850Url && (
                          <Button variant="ghost" size="sm" data-testid={`button-download-8850-${screening.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchTerm ? "No screenings found" : "No screenings yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
