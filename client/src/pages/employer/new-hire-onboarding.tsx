import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Send, Copy, Clock, CheckCircle, AlertCircle, Users, BarChart3, Link2 } from "lucide-react";
import type { OnboardingInstance } from "@shared/schema";

export default function NewHireOnboardingPage() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">New Hire Onboarding</h1>
          <p className="text-muted-foreground">
            Send onboarding invites to new hires. They complete W-4, direct deposit, ID upload, and policy signatures from their phone.
          </p>
        </div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(instance.id)}
                        title="Copy onboarding link"
                        data-testid={`button-copy-link-${instance.id}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
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
