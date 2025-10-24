import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import type { Employer } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

export default function WOTCExportPage() {
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedEmployer, setSelectedEmployer] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const { data: employers } = useQuery<Employer[]>({
    queryKey: ["/api/admin/employers"],
  });

  // Fetch record count based on current filters
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/export/wotc-csv/count", selectedState, selectedEmployer, startDate, endDate, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState) params.append("state", selectedState);
      if (selectedEmployer && selectedEmployer !== "all") params.append("employerId", selectedEmployer);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/export/wotc-csv/count?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch count");
      }
      
      return response.json();
    },
    enabled: !!selectedState, // Only fetch when state is selected
  });

  const handleExport = async () => {
    if (!selectedState) {
      toast({
        title: "State Required",
        description: "Please select a state for the export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("state", selectedState);
      
      if (selectedEmployer && selectedEmployer !== "all") {
        params.append("employerId", selectedEmployer);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`/api/admin/export/wotc-csv?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `wotc-export-${selectedState}-${new Date().toISOString().split("T")[0]}.csv`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: `CSV file downloaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export CSV. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedStateName = US_STATES.find(s => s.code === selectedState)?.name;
  const selectedEmployerName = employers?.find(e => e.id === selectedEmployer)?.name;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-export">
          WOTC CSV Export
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate state-specific CSV files for bulk WOTC submission
        </p>
      </div>

      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          Export screening data in state-specific ETA Form 9061 format for submission to state workforce agencies.
          Different states may have varying column requirements.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Export Filters</CardTitle>
          <CardDescription>
            Configure your export parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* State Selection - Required */}
            <div className="space-y-2">
              <Label htmlFor="state" className="flex items-center gap-2">
                State <span className="text-destructive">*</span>
              </Label>
              <Select 
                value={selectedState} 
                onValueChange={setSelectedState}
              >
                <SelectTrigger id="state" data-testid="select-state">
                  <SelectValue placeholder="Select state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Required - Determines CSV template format
              </p>
            </div>

            {/* Employer Filter - Optional */}
            <div className="space-y-2">
              <Label htmlFor="employer">Employer (Optional)</Label>
              <Select 
                value={selectedEmployer} 
                onValueChange={setSelectedEmployer}
              >
                <SelectTrigger id="employer" data-testid="select-employer">
                  <SelectValue placeholder="All employers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employers</SelectItem>
                  {employers?.map((employer) => (
                    <SelectItem key={employer.id} value={employer.id}>
                      {employer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
              <p className="text-xs text-muted-foreground">
                Filter by hire date
              </p>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status Filter</Label>
              <Select 
                value={statusFilter} 
                onValueChange={setStatusFilter}
              >
                <SelectTrigger id="status" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Screenings</SelectItem>
                  <SelectItem value="eligible">Eligible Only</SelectItem>
                  <SelectItem value="certified">Certified Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Summary with Record Count */}
          {selectedState && (
            <Alert className="bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <strong>Export Configuration:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• State: <span className="font-medium">{selectedStateName}</span> ({selectedState === "TX" ? "20-column simplified format" : "37-column universal format"})</li>
                      {selectedEmployer && selectedEmployer !== "all" && (
                        <li>• Employer: <span className="font-medium">{selectedEmployerName}</span></li>
                      )}
                      {startDate && (
                        <li>• From: <span className="font-medium">{new Date(startDate).toLocaleDateString()}</span></li>
                      )}
                      {endDate && (
                        <li>• To: <span className="font-medium">{new Date(endDate).toLocaleDateString()}</span></li>
                      )}
                      <li>• Status: <span className="font-medium">{statusFilter === "all" ? "All screenings" : statusFilter === "eligible" ? "Eligible only" : "Certified only"}</span></li>
                    </ul>
                  </div>
                  <div className="ml-6 text-right">
                    <div className="text-2xl font-bold" data-testid="text-record-count">
                      {countData?.count ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      record{countData?.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Export Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleExport}
              disabled={!selectedState || isExporting}
              size="lg"
              data-testid="button-export"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>State-Specific Templates</CardTitle>
          <CardDescription>Understanding CSV format variations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Texas (TX)</h4>
            <p className="text-sm text-muted-foreground">
              Simplified 20-column format focusing on core eligibility information.
              Ideal for streamlined submissions.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">California (CA), New York (NY), and Others</h4>
            <p className="text-sm text-muted-foreground">
              Comprehensive 37-column ETA Form 9061 format including all qualifying factors,
              target groups, and submission metadata.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Column Details</h4>
            <p className="text-sm text-muted-foreground">
              Universal format includes: employee demographics, employment details, target group
              classifications, qualifying factor indicators (TANF/SNAP, veteran status, disability,
              ex-felon, vocational rehab, unemployment), and employer information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
