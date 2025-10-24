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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bot, Database, CheckCircle2, AlertCircle, Settings, Play, RefreshCw } from "lucide-react";

export default function StateAutomationPage() {
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch state portal configurations
  const { data: statePortals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/state-portals"],
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
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Automation Enabled</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-automation-enabled">
              {statePortals?.filter((p) => p.automationEnabled).length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active automations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Portals</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-portals">
              {statePortals?.filter((p) => p.status === "active").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Operational</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-portal-issues">
              {statePortals?.filter((p) => p.status !== "active").length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* State Portal Table */}
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
