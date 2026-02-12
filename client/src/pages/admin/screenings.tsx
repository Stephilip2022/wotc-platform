import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, Upload, FileText, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminScreeningsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    employerId: "all",
    status: "all",
  });
  const [selectedScreening, setSelectedScreening] = useState<any>(null);
  const [statusDialog, setStatusDialog] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);

  // Fetch screenings
  const { data: screeningsData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/screenings", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.employerId && filters.employerId !== "all") params.append("employerId", filters.employerId);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      
      const response = await fetch(`/api/admin/screenings?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch employers for filter
  const { data: employers } = useQuery<any[]>({
    queryKey: ["/api/admin/employers"],
  });

  // Fetch screening history
  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/admin/screenings", selectedScreening?.screening?.id, "history"],
    enabled: !!selectedScreening && historyDialog,
    queryFn: async () => {
      const response = await fetch(`/api/admin/screenings/${selectedScreening.screening.id}/history`, { credentials: "include" });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/admin/screenings/${data.screeningId}/status`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screenings"] });
      setStatusDialog(false);
      setSelectedScreening(null);
      toast({
        title: "Status Updated",
        description: "Screening status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  // Upload determination letter mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ screeningId, file }: { screeningId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/admin/screenings/${screeningId}/determination-letter`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/screenings"] });
      setUploadDialog(false);
      setSelectedScreening(null);
      toast({
        title: "Letter Uploaded",
        description: "Determination letter uploaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload letter",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (data: any) => {
    updateStatusMutation.mutate({
      screeningId: selectedScreening.screening.id,
      ...data,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedScreening) {
      uploadMutation.mutate({
        screeningId: selectedScreening.screening.id,
        file,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      eligible: { variant: "default", icon: CheckCircle },
      certified: { variant: "default", icon: CheckCircle },
      denied: { variant: "destructive", icon: XCircle },
      not_eligible: { variant: "destructive", icon: XCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status?.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Determination Tracking</h1>
        <p className="text-muted-foreground">
          Manage WOTC screening statuses and upload determination letters
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>Employer</Label>
            <Select
              value={filters.employerId}
              onValueChange={(value) => setFilters({ ...filters, employerId: value })}
            >
              <SelectTrigger data-testid="select-employer-filter">
                <SelectValue placeholder="All Employers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employers</SelectItem>
                {(Array.isArray(employers) ? employers : []).map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label>Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="certified">Certified</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="not_eligible">Not Eligible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Screenings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Screenings ({screeningsData?.length || 0})</CardTitle>
          <CardDescription>Click on a screening to update status or upload determination letter</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !screeningsData || screeningsData.length === 0 ? (
            <p className="text-muted-foreground">No screenings found</p>
          ) : (
            <div className="space-y-2">
              {screeningsData.map((item: any) => (
                <div
                  key={item.screening.id}
                  className="border rounded-lg p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`screening-row-${item.screening.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold" data-testid={`employee-name-${item.screening.id}`}>
                            {item.employee.firstName} {item.employee.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.employer.name}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">
                          Target: {item.screening.primaryTargetGroup || "None"}
                        </span>
                        {item.screening.certificationNumber && (
                          <span className="text-sm text-muted-foreground">
                            Cert#: {item.screening.certificationNumber}
                          </span>
                        )}
                        {item.screening.form8850Generated && (
                          <Badge variant="secondary" data-testid={`badge-8850-${item.screening.id}`}>
                            <FileText className="h-3 w-3 mr-1" />
                            8850
                          </Badge>
                        )}
                        {item.screening.form9061Generated && (
                          <Badge variant="secondary" data-testid={`badge-9061-${item.screening.id}`}>
                            <FileText className="h-3 w-3 mr-1" />
                            9061
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.screening.status)}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScreening(item);
                          setStatusDialog(true);
                        }}
                        data-testid={`button-update-status-${item.screening.id}`}
                      >
                        Update Status
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScreening(item);
                          setUploadDialog(true);
                        }}
                        data-testid={`button-upload-letter-${item.screening.id}`}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Letter
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScreening(item);
                          setHistoryDialog(true);
                        }}
                        data-testid={`button-view-history-${item.screening.id}`}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Status Dialog */}
      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Screening Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedScreening?.employee.firstName} {selectedScreening?.employee.lastName}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleStatusUpdate({
                status: formData.get("status"),
                reason: formData.get("reason"),
                notes: formData.get("notes"),
                certificationNumber: formData.get("certificationNumber"),
                certificationDate: formData.get("certificationDate"),
                certificationExpiresAt: formData.get("certificationExpiresAt"),
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>New Status</Label>
              <Select name="status" required>
                <SelectTrigger data-testid="select-new-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="certified">Certified</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="not_eligible">Not Eligible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Certification Number (if certified)</Label>
              <Input name="certificationNumber" placeholder="Enter certification number" data-testid="input-cert-number" />
            </div>

            <div>
              <Label>Certification Date (if certified)</Label>
              <Input type="date" name="certificationDate" data-testid="input-cert-date" />
            </div>

            <div>
              <Label>Expiration Date (if applicable)</Label>
              <Input type="date" name="certificationExpiresAt" data-testid="input-cert-expires" />
            </div>

            <div>
              <Label>Reason for Change</Label>
              <Input name="reason" placeholder="e.g., State determination received" data-testid="input-reason" />
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea name="notes" placeholder="Optional notes" data-testid="textarea-notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStatusDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateStatusMutation.isPending} data-testid="button-confirm-status-update">
                {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Determination Letter</DialogTitle>
            <DialogDescription>
              Upload the official determination letter from the state workforce agency
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select File</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
                data-testid="input-file-upload"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Accepted formats: PDF, JPG, PNG, DOC, DOCX (max 10MB)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Status Change History</DialogTitle>
            <DialogDescription>
              Complete audit trail for {selectedScreening?.employee.firstName} {selectedScreening?.employee.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {history && history.length > 0 ? (
              history.map((item: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.change.fromStatus}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold">{item.change.toStatus}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(item.change.changedAt), "PPp")}
                    </span>
                  </div>
                  
                  {item.change.reason && (
                    <p className="text-sm"><strong>Reason:</strong> {item.change.reason}</p>
                  )}
                  
                  {item.change.notes && (
                    <p className="text-sm text-muted-foreground">{item.change.notes}</p>
                  )}

                  {item.change.certificationNumber && (
                    <p className="text-sm"><strong>Cert#:</strong> {item.change.certificationNumber}</p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Changed by: {item.changedByUser?.email || "Unknown"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No history available</p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
