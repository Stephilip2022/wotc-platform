import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Link2, Plus, RefreshCw, Trash2, Settings, Clock, 
  CheckCircle2, XCircle, AlertCircle, ExternalLink,
  Users, Building, Briefcase 
} from "lucide-react";
import { SiGreenhouse } from "react-icons/si";
import { format } from "date-fns";

interface IntegrationProvider {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  logoUrl: string;
  authTypes: string[];
  isActive: boolean;
}

interface IntegrationConnection {
  id: string;
  providerId: string;
  name: string;
  authType: string;
  status: string;
  syncEnabled: boolean;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  createdAt: string;
}

const providerIcons: Record<string, any> = {
  greenhouse: SiGreenhouse,
  bamboohr: Building,
};

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [newConnection, setNewConnection] = useState({
    name: "",
    apiKey: "",
    apiSecret: "",
    externalAccountId: "",
    syncFrequency: "hourly",
  });

  const { data: connections = [], isLoading: loadingConnections } = useQuery<IntegrationConnection[]>({
    queryKey: ["/api/integrations/connections"],
  });

  const { data: providers = [] } = useQuery<IntegrationProvider[]>({
    queryKey: ["/api/integrations/providers"],
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/integrations/connections", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      setShowAddDialog(false);
      setNewConnection({ name: "", apiKey: "", apiSecret: "", externalAccountId: "", syncFrequency: "hourly" });
      setSelectedProvider("");
      toast({ title: "Integration connected", description: "Your integration has been set up successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/integrations/connections/${connectionId}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({
        title: "Sync complete",
        description: `Processed ${data.recordsProcessed} records: ${data.recordsCreated} created, ${data.recordsUpdated} updated.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest("DELETE", `/api/integrations/connections/${connectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/connections"] });
      toast({ title: "Integration removed", description: "The integration has been disconnected." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddConnection = () => {
    if (!selectedProvider || !newConnection.name || !newConnection.apiKey) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createConnectionMutation.mutate({
      providerId: selectedProvider,
      ...newConnection,
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const availableProviders = [
    { id: "greenhouse", name: "Greenhouse", category: "ATS", description: "Sync candidates from Greenhouse ATS" },
    { id: "bamboohr", name: "BambooHR", category: "HRIS", description: "Sync employees from BambooHR" },
    { id: "adp", name: "ADP Workforce Now", category: "Payroll", description: "Import hours and wages from ADP" },
    { id: "gusto", name: "Gusto", category: "Payroll", description: "Sync payroll data from Gusto" },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="integrations-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect your HR and payroll systems to automatically sync employee data
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-integration">
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect Integration</DialogTitle>
              <DialogDescription>
                Choose a system to integrate with your WOTC platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Integration Type</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select integration..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProvider && (
                <>
                  <div className="space-y-2">
                    <Label>Connection Name</Label>
                    <Input
                      placeholder="e.g., Production Greenhouse"
                      value={newConnection.name}
                      onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                      data-testid="input-connection-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="Enter your API key"
                      value={newConnection.apiKey}
                      onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                      data-testid="input-api-key"
                    />
                  </div>
                  {(selectedProvider === "bamboohr") && (
                    <div className="space-y-2">
                      <Label>Subdomain / Account ID</Label>
                      <Input
                        placeholder="your-company"
                        value={newConnection.externalAccountId}
                        onChange={(e) => setNewConnection({ ...newConnection, externalAccountId: e.target.value })}
                        data-testid="input-subdomain"
                      />
                      <p className="text-xs text-muted-foreground">
                        The subdomain from your BambooHR URL (e.g., "acme" from acme.bamboohr.com)
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Sync Frequency</Label>
                    <Select 
                      value={newConnection.syncFrequency} 
                      onValueChange={(v) => setNewConnection({ ...newConnection, syncFrequency: v })}
                    >
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time (Webhooks)</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="manual">Manual Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddConnection} 
                disabled={createConnectionMutation.isPending}
                data-testid="button-connect"
              >
                {createConnectionMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected">Connected ({connections.length})</TabsTrigger>
          <TabsTrigger value="available">Available Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="space-y-4">
          {loadingConnections ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-6 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-full" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No integrations connected</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Connect your ATS, HRIS, or payroll system to automatically sync employee data
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map((connection) => {
                const IconComponent = providerIcons[connection.providerId] || Link2;
                return (
                  <Card key={connection.id} data-testid={`integration-card-${connection.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{connection.name}</CardTitle>
                            <CardDescription className="capitalize">
                              {connection.providerId.replace("_", " ")}
                            </CardDescription>
                          </div>
                        </div>
                        {getStatusBadge(connection.lastSyncStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Sync Frequency</p>
                          <p className="font-medium capitalize">{connection.syncFrequency}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Last Sync</p>
                          <p className="font-medium">
                            {connection.lastSyncAt
                              ? format(new Date(connection.lastSyncAt), "MMM d, h:mm a")
                              : "Never"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={connection.syncEnabled}
                            disabled
                          />
                          <span className="text-sm text-muted-foreground">
                            Auto-sync {connection.syncEnabled ? "enabled" : "disabled"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => syncMutation.mutate(connection.id)}
                            disabled={syncMutation.isPending}
                            data-testid={`button-sync-${connection.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            Sync Now
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to disconnect this integration?")) {
                                deleteConnectionMutation.mutate(connection.id);
                              }
                            }}
                            data-testid={`button-delete-${connection.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableProviders.map((provider) => {
              const IconComponent = providerIcons[provider.id] || Briefcase;
              const isConnected = connections.some((c) => c.providerId === provider.id);
              return (
                <Card key={provider.id} className="relative">
                  {isConnected && (
                    <Badge className="absolute top-3 right-3 bg-green-500">Connected</Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">{provider.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>
                    <Button
                      variant={isConnected ? "outline" : "default"}
                      className="w-full"
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setShowAddDialog(true);
                      }}
                      data-testid={`button-connect-${provider.id}`}
                    >
                      {isConnected ? (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          Configure
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
