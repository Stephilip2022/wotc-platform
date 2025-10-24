import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bot, Database, CheckCircle2, AlertCircle, Settings, Play, RefreshCw, FileText, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function StateAutomationPage() {
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch state portal configurations
  const { data: statePortals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/state-portals"],
  });

  // Fetch submission jobs
  const { data: submissionJobs, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/submissions"],
  });

  // Fetch determination letters
  const { data: determinationLetters, isLoading: lettersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/determination-letters"],
  });

  // Seed state portals mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/state-portals/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/state-portals"] });
      toast({
        title: "Success",
        description: "State portal configurations have been seeded",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed state portals",
        variant: "destructive",
      });
    },
  });

  // Update state portal mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/state-portals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/state-portals"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "State portal configuration updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update state portal",
        variant: "destructive",
      });
    },
  });

  const handleToggleAutomation = async (portal: any) => {
    await updateMutation.mutateAsync({
      id: portal.id,
      data: {
        automationEnabled: !portal.automationEnabled,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: { variant: "default" as const, label: "Active" },
      maintenance: { variant: "secondary" as const, label: "Maintenance" },
      disabled: { variant: "destructive" as const, label: "Disabled" },
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
  };

  const getJobStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary" as const, label: "Pending", icon: Clock },
      processing: { variant: "default" as const, label: "Processing", icon: RefreshCw },
      completed: { variant: "default" as const, label: "Completed", icon: CheckCircle2 },
      failed: { variant: "destructive" as const, label: "Failed", icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} data-testid={`badge-job-${status}`}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getLetterStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary" as const, label: "Pending" },
      processed: { variant: "default" as const, label: "Processed" },
      needs_review: { variant: "destructive" as const, label: "Needs Review" },
      error: { variant: "destructive" as const, label: "Error" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Calculate statistics
  const totalJobs = submissionJobs?.length || 0;
  const completedJobs = submissionJobs?.filter(j => j.status === 'completed').length || 0;
  const failedJobs = submissionJobs?.filter(j => j.status === 'failed').length || 0;
  const successRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : '0.0';
  
  const needsReviewCount = determinationLetters?.filter(l => l.status === 'needs_review').length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-state">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPortals = statePortals && statePortals.length > 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-page">State Automation</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-description">
            Manage state WOTC portal configurations and automation settings
          </p>
        </div>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-seed-portals"
        >
          {seedMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Seeding...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Seed State Portals
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total States</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-states">{statePortals?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured portals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">{successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{completedJobs} of {totalJobs} jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-jobs">
              {submissionJobs?.filter((j) => j.status === 'processing').length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-needs-review">{needsReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Manual intervention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-failed-jobs">{failedJobs}</div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Automation Dashboard Tabs */}
      <Tabs defaultValue="portals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portals" data-testid="tab-portals">
            <Settings className="mr-2 h-4 w-4" />
            State Portals
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Bot className="mr-2 h-4 w-4" />
            Submission Jobs
          </TabsTrigger>
          <TabsTrigger value="letters" data-testid="tab-letters">
            <FileText className="mr-2 h-4 w-4" />
            Determination Letters
            {needsReviewCount > 0 && (
              <Badge variant="destructive" className="ml-2">{needsReviewCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* State Portals Tab */}
        <TabsContent value="portals">
          <Card>
            <CardHeader>
              <CardTitle>State Portal Configurations</CardTitle>
              <CardDescription>Configure automation settings for each state's WOTC portal</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasPortals ? (
                <div className="text-center py-12" data-testid="empty-state">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No State Portals Configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "Seed State Portals" above to initialize configurations for major states.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-state">State</TableHead>
                        <TableHead data-testid="header-portal-url">Portal URL</TableHead>
                        <TableHead data-testid="header-status">Status</TableHead>
                        <TableHead data-testid="header-automation">Automation</TableHead>
                        <TableHead data-testid="header-frequency">Frequency</TableHead>
                        <TableHead data-testid="header-processing">Processing Days</TableHead>
                        <TableHead data-testid="header-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statePortals.map((portal) => (
                        <TableRow key={portal.id} data-testid={`row-state-${portal.stateCode}`}>
                          <TableCell className="font-medium" data-testid={`cell-state-${portal.stateCode}`}>
                            {portal.stateCode} - {portal.stateName}
                          </TableCell>
                          <TableCell>
                            <a
                              href={portal.portalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                              data-testid={`link-portal-${portal.stateCode}`}
                            >
                              {portal.portalUrl.substring(0, 40)}...
                            </a>
                          </TableCell>
                          <TableCell data-testid={`cell-status-${portal.stateCode}`}>
                            {getStatusBadge(portal.status)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={portal.automationEnabled}
                              onCheckedChange={() => handleToggleAutomation(portal)}
                              disabled={portal.status !== "active" || updateMutation.isPending}
                              data-testid={`switch-automation-${portal.stateCode}`}
                            />
                          </TableCell>
                          <TableCell data-testid={`cell-frequency-${portal.stateCode}`}>
                            <Badge variant="outline">{portal.submissionFrequency}</Badge>
                          </TableCell>
                          <TableCell data-testid={`cell-processing-${portal.stateCode}`}>
                            {portal.expectedProcessingDays} days
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedState(portal);
                                setIsEditDialogOpen(true);
                              }}
                              data-testid={`button-edit-${portal.stateCode}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Submission Jobs Tab */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Submission Jobs</CardTitle>
              <CardDescription>Monitor state portal submission automation jobs</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !submissionJobs || submissionJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Submission Jobs</h3>
                  <p className="text-muted-foreground">
                    Submission jobs will appear here when automation runs
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead>Employer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissionJobs.slice(0, 50).map((job) => (
                        <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                          <TableCell className="font-medium">{job.stateCode}</TableCell>
                          <TableCell>{job.employerId}</TableCell>
                          <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            {job.recordsSubmitted || 0} / {job.totalRecords || 0}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {job.confirmationNumber || job.error || '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                toast({
                                  title: "Job Details",
                                  description: JSON.stringify(job, null, 2),
                                });
                              }}
                              data-testid={`button-view-job-${job.id}`}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Determination Letters Tab */}
        <TabsContent value="letters">
          <Card>
            <CardHeader>
              <CardTitle>Determination Letters</CardTitle>
              <CardDescription>Review OCR-parsed determination letters and handle manual interventions</CardDescription>
            </CardHeader>
            <CardContent>
              {lettersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !determinationLetters || determinationLetters.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Determination Letters</h3>
                  <p className="text-muted-foreground">
                    Parsed determination letters will appear here
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead>Employer</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cert Number</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {determinationLetters
                        .sort((a, b) => {
                          // Prioritize needs_review
                          if (a.status === 'needs_review' && b.status !== 'needs_review') return -1;
                          if (a.status !== 'needs_review' && b.status === 'needs_review') return 1;
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        })
                        .slice(0, 50)
                        .map((letter) => (
                          <TableRow key={letter.id} data-testid={`row-letter-${letter.id}`}>
                            <TableCell className="font-medium">{letter.stateCode}</TableCell>
                            <TableCell className="text-xs">{letter.employerId?.substring(0, 8)}...</TableCell>
                            <TableCell className="text-xs">
                              {letter.employeeId ? `${letter.employeeId.substring(0, 8)}...` : '-'}
                            </TableCell>
                            <TableCell>{getLetterStatusBadge(letter.status)}</TableCell>
                            <TableCell className="text-xs">{letter.certificationNumber || '-'}</TableCell>
                            <TableCell>
                              {letter.creditAmount ? `$${letter.creditAmount.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {letter.processedAt
                                ? formatDistanceToNow(new Date(letter.processedAt), { addSuffix: true })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  toast({
                                    title: "Letter Details",
                                    description: JSON.stringify(letter.parsedData, null, 2),
                                  });
                                }}
                                data-testid={`button-view-letter-${letter.id}`}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-portal">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedState?.stateCode} Configuration
            </DialogTitle>
            <DialogDescription>
              Update portal settings and automation configuration
            </DialogDescription>
          </DialogHeader>
          {selectedState && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portal-url">Portal URL</Label>
                <Input
                  id="portal-url"
                  defaultValue={selectedState.portalUrl}
                  data-testid="input-portal-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-batch-size">Max Batch Size</Label>
                <Input
                  id="max-batch-size"
                  type="number"
                  defaultValue={selectedState.maxBatchSize}
                  data-testid="input-batch-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processing-days">Expected Processing Days</Label>
                <Input
                  id="processing-days"
                  type="number"
                  defaultValue={selectedState.expectedProcessingDays}
                  data-testid="input-processing-days"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-email">Support Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  defaultValue={selectedState.supportEmail || ""}
                  data-testid="input-support-email"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // In a real implementation, collect form values and update
                    toast({
                      title: "Info",
                      description: "Full form implementation pending",
                    });
                  }}
                  data-testid="button-save-portal"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
