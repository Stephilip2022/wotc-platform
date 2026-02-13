import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  UserPlus, Send, Clock, CheckCircle, AlertCircle, Users, BarChart3,
  Link2, Eye, Upload, FileText, ArrowLeft, FileCheck, Shield, X,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { OnboardingInstance } from "@shared/schema";

type InstanceDetail = {
  instance: OnboardingInstance;
  tasks: { id: string; stepKey: string; title: string; status: string; sortOrder: number; completedAt: string | null }[];
  documents: { id: string; documentType: string; fileName: string; fileSize: number; mimeType: string; status: string; signedAt: string | null; createdAt: string }[];
  forms: { formType: string; formData: Record<string, any>; isComplete: boolean; updatedAt: string }[];
  timeline: { step: string; stepKey: string; completedAt: string; sortOrder: number }[];
  inviteToken: { token: string; expiresAt: string; usedAt: string | null } | null;
};

type AnalyticsData = {
  funnel: { stepKey: string; title: string; completedCount: number; totalCount: number; completionRate: number }[];
  timeToComplete: { avgMinutes: number; medianMinutes: number; fastestMinutes: number; slowestMinutes: number; totalCompleted: number };
  statusDistribution: { pending: number; in_progress: number; completed: number; expired: number };
  dailyCompletions: { date: string; count: number }[];
  totalInstances: number;
};

const PIE_COLORS = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--destructive))"];

export default function NewHireOnboardingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("invites");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteForm, setInviteForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", jobTitle: "", department: "", startDate: "",
  });

  const { data: instances, isLoading } = useQuery<OnboardingInstance[]>({
    queryKey: ["/api/onboarding/employer/instances"],
  });

  const { data: metrics } = useQuery<{
    total: number; completed: number; inProgress: number; pending: number;
    completionRate: number; avgCompletionMinutes: number; avgProgress: number;
    upcomingHires: OnboardingInstance[];
  }>({
    queryKey: ["/api/onboarding/employer/metrics"],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/onboarding/employer/analytics"],
    enabled: activeTab === "analytics",
  });

  const { data: instanceDetail, isLoading: detailLoading } = useQuery<InstanceDetail>({
    queryKey: ["/api/onboarding/employer/instances", selectedInstanceId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/onboarding/employer/instances/${selectedInstanceId}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch detail");
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      const response = await apiRequest("POST", "/api/onboarding/employer/invite", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Invite Sent", description: `Onboarding invite created for ${data.invite.firstName} ${data.invite.lastName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/employer/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/employer/metrics"] });
      setInviteDialogOpen(false);
      setInviteForm({ firstName: "", lastName: "", email: "", phone: "", jobTitle: "", department: "", startDate: "" });
      if (data.onboardLink) {
        navigator.clipboard.writeText(data.onboardLink).then(() => {
          toast({ title: "Link Copied", description: "Onboarding link copied to clipboard" });
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create invite", variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/onboarding/employer/bulk-invite", {
        method: "POST", body: formData, credentials: "include",
      });
      if (!response.ok) throw new Error((await response.json()).error || "Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Bulk Import Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/employer/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/employer/metrics"] });
      setBulkDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Bulk import failed", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge data-testid="badge-status-completed"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "in_progress": return <Badge variant="secondary" data-testid="badge-status-in-progress"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "expired": return <Badge variant="destructive" data-testid="badge-status-expired"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default: return <Badge variant="outline" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const copyLink = async (instanceId: string) => {
    try {
      const response = await apiRequest("POST", `/api/onboarding/employer/resend-invite/${instanceId}`);
      const data = await response.json();
      if (data.onboardLink) {
        await navigator.clipboard.writeText(data.onboardLink);
        toast({ title: "Link Copied", description: "Onboarding link copied to clipboard" });
      }
    } catch {
      toast({ title: "Error", description: "Could not retrieve link", variant: "destructive" });
    }
  };

  if (selectedInstanceId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setSelectedInstanceId(null)} data-testid="button-back-to-list">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold" data-testid="text-detail-title">
            {detailLoading ? "Loading..." : `${instanceDetail?.instance.firstName} ${instanceDetail?.instance.lastName}`}
          </h1>
          {instanceDetail && getStatusBadge(instanceDetail.instance.status)}
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : instanceDetail ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {instanceDetail.tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3" data-testid={`task-row-${task.stepKey}`}>
                        <div className="flex-shrink-0">
                          {task.status === "completed" ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-5 w-5 text-blue-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.completedAt && (
                            <p className="text-xs text-muted-foreground">
                              Completed {new Date(task.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(task.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {instanceDetail.forms.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Submitted Forms</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {instanceDetail.forms.map((form, i) => (
                        <div key={i} className="border rounded-md p-4" data-testid={`form-section-${form.formType}`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm capitalize">{form.formType.replace(/_/g, " ")}</span>
                            </div>
                            {form.isComplete ? (
                              <Badge><FileCheck className="h-3 w-3 mr-1" />Complete</Badge>
                            ) : (
                              <Badge variant="outline">In Progress</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(form.formData).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}: </span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {instanceDetail.documents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Uploaded Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>File Name</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {instanceDetail.documents.map(doc => (
                          <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
                            <TableCell className="capitalize">{doc.documentType.replace(/_/g, " ")}</TableCell>
                            <TableCell>{doc.fileName}</TableCell>
                            <TableCell>{Math.round(doc.fileSize / 1024)} KB</TableCell>
                            <TableCell>{getStatusBadge(doc.status)}</TableCell>
                            <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium" data-testid="text-detail-email">{instanceDetail.instance.email}</span></div>
                  {instanceDetail.instance.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{instanceDetail.instance.phone}</span></div>}
                  {instanceDetail.instance.jobTitle && <div><span className="text-muted-foreground">Job Title:</span> <span className="font-medium">{instanceDetail.instance.jobTitle}</span></div>}
                  {instanceDetail.instance.department && <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{instanceDetail.instance.department}</span></div>}
                  {instanceDetail.instance.startDate && <div><span className="text-muted-foreground">Start Date:</span> <span className="font-medium">{instanceDetail.instance.startDate}</span></div>}
                  <div>
                    <span className="text-muted-foreground">Progress:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={instanceDetail.instance.progressPercent} className="flex-1" />
                      <span className="font-medium">{instanceDetail.instance.progressPercent}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {instanceDetail.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative pl-6 space-y-4">
                      <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                      {instanceDetail.timeline.map((event, i) => (
                        <div key={i} className="relative" data-testid={`timeline-event-${event.stepKey}`}>
                          <div className="absolute -left-4 top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                          <p className="font-medium text-sm">{event.step}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.completedAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {instanceDetail.inviteToken && (
                <Card>
                  <CardHeader>
                    <CardTitle>Invite Link</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Expires:</span> <span className="font-medium">{new Date(instanceDetail.inviteToken.expiresAt).toLocaleDateString()}</span></div>
                    {instanceDetail.inviteToken.usedAt && (
                      <div><span className="text-muted-foreground">Used:</span> <span className="font-medium">{new Date(instanceDetail.inviteToken.usedAt).toLocaleDateString()}</span></div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => copyLink(instanceDetail.instance.id)}
                      data-testid="button-copy-detail-link"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">New Hire Onboarding</h1>
          <p className="text-muted-foreground">
            Send onboarding invites to new hires. They complete W-4, direct deposit, ID upload, and policy signatures from their phone.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-upload">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import New Hires</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with columns: firstName, lastName, email. Optional: phone, jobTitle, department, startDate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-md p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Drag and drop a CSV file, or click to browse
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) bulkMutation.mutate(file);
                    }}
                    data-testid="input-csv-file"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-browse-csv">
                    Browse Files
                  </Button>
                </div>
                {bulkMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 animate-spin" />
                    Processing CSV...
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-invite-new-hire">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite New Hire
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Hire</DialogTitle>
                <DialogDescription>
                  Create an onboarding invite. The new hire will receive a link to complete their onboarding from any device.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name *</label>
                    <Input
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm(p => ({ ...p, firstName: e.target.value }))}
                      data-testid="input-invite-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name *</label>
                    <Input
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm(p => ({ ...p, lastName: e.target.value }))}
                      data-testid="input-invite-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(p => ({ ...p, email: e.target.value }))}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm(p => ({ ...p, phone: e.target.value }))}
                      data-testid="input-invite-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={inviteForm.startDate}
                      onChange={(e) => setInviteForm(p => ({ ...p, startDate: e.target.value }))}
                      data-testid="input-invite-start-date"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Title</label>
                    <Input
                      value={inviteForm.jobTitle}
                      onChange={(e) => setInviteForm(p => ({ ...p, jobTitle: e.target.value }))}
                      data-testid="input-invite-job-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Input
                      value={inviteForm.department}
                      onChange={(e) => setInviteForm(p => ({ ...p, department: e.target.value }))}
                      data-testid="input-invite-department"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => inviteMutation.mutate(inviteForm)}
                  disabled={inviteMutation.isPending || !inviteForm.firstName || !inviteForm.lastName || !inviteForm.email}
                  data-testid="button-send-invite"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {inviteMutation.isPending ? "Creating..." : "Create Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-invites">{metrics?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed">{metrics?.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-in-progress">{metrics?.inProgress || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">{metrics?.completionRate || 0}%</div>
            {metrics && metrics.avgCompletionMinutes > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg. {metrics.avgCompletionMinutes} min to complete
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-onboarding">
          <TabsTrigger value="invites" data-testid="tab-invites">Invites</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="invites">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Instances</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !instances || instances.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No onboarding invites yet</h3>
                  <p className="text-muted-foreground mb-4">Click "Invite New Hire" to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instances.map((instance) => (
                      <TableRow key={instance.id} data-testid={`row-onboarding-${instance.id}`}>
                        <TableCell className="font-medium">{instance.firstName} {instance.lastName}</TableCell>
                        <TableCell>{instance.email}</TableCell>
                        <TableCell>{instance.jobTitle || "--"}</TableCell>
                        <TableCell>{instance.startDate || "--"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={instance.progressPercent} className="w-20" />
                            <span className="text-sm text-muted-foreground">{instance.progressPercent}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(instance.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedInstanceId(instance.id)}
                              title="View details"
                              data-testid={`button-view-detail-${instance.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(instance.id)}
                              title="Copy onboarding link"
                              data-testid={`button-copy-link-${instance.id}`}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : analytics ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Funnel</CardTitle>
                  <CardDescription>Per-step completion rates across all onboarding instances</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.funnel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value: number) => [`${value}%`, "Completion Rate"]} />
                      <Bar dataKey="completionRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current status of all onboarding instances</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Pending", value: analytics.statusDistribution.pending },
                          { name: "In Progress", value: analytics.statusDistribution.in_progress },
                          { name: "Completed", value: analytics.statusDistribution.completed },
                          { name: "Expired", value: analytics.statusDistribution.expired },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        paddingAngle={2}
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                      >
                        {PIE_COLORS.map((color, index) => (
                          <Cell key={index} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Daily Completions (30 Days)</CardTitle>
                  <CardDescription>Onboarding completions per day over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.dailyCompletions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time to Complete</CardTitle>
                  <CardDescription>Statistics for completed onboarding instances</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-md bg-muted/40">
                      <p className="text-2xl font-bold" data-testid="text-avg-minutes">{analytics.timeToComplete.avgMinutes}</p>
                      <p className="text-xs text-muted-foreground">Avg. Minutes</p>
                    </div>
                    <div className="text-center p-4 rounded-md bg-muted/40">
                      <p className="text-2xl font-bold" data-testid="text-median-minutes">{analytics.timeToComplete.medianMinutes}</p>
                      <p className="text-xs text-muted-foreground">Median Minutes</p>
                    </div>
                    <div className="text-center p-4 rounded-md bg-muted/40">
                      <p className="text-2xl font-bold" data-testid="text-fastest-minutes">{analytics.timeToComplete.fastestMinutes}</p>
                      <p className="text-xs text-muted-foreground">Fastest</p>
                    </div>
                    <div className="text-center p-4 rounded-md bg-muted/40">
                      <p className="text-2xl font-bold" data-testid="text-slowest-minutes">{analytics.timeToComplete.slowestMinutes}</p>
                      <p className="text-xs text-muted-foreground">Slowest</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Based on {analytics.timeToComplete.totalCompleted} completed onboardings
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No analytics data available yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
