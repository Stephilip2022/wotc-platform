import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, AlertCircle, Webhook, Send, Eye, Copy, Key } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const createWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  events: z.array(z.string()).min(1, "Select at least one event"),
  maxRetries: z.number().min(0).max(10).optional(),
  retryBackoffSeconds: z.number().min(1).max(3600).optional(),
});

type CreateWebhookForm = z.infer<typeof createWebhookSchema>;

export default function WebhooksPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<any>(null);
  const [viewSecret, setViewSecret] = useState(false);

  const form = useForm<CreateWebhookForm>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      url: "",
      description: "",
      events: [],
      maxRetries: 3,
      retryBackoffSeconds: 5,
    },
  });

  const { data: webhooks, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/webhooks"],
  });

  const { data: eventsList } = useQuery<{ data: any[] }>({
    queryKey: ["/api/webhooks/events/list"],
  });

  const { data: deliveries, isLoading: isLoadingDeliveries } = useQuery<{ data: any[] }>({
    queryKey: ["/api/webhooks", selectedEndpoint?.id, "deliveries"],
    enabled: !!selectedEndpoint,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateWebhookForm) => {
      const res = await apiRequest("POST", "/api/webhooks", data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Webhook created",
        description: "Your webhook endpoint has been created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating webhook",
        description: error.message || "Failed to create webhook",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setSelectedEndpoint(null);
      toast({
        title: "Webhook deleted",
        description: "The webhook endpoint has been deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting webhook",
        description: error.message || "Failed to delete webhook",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/webhooks/${id}/test`);
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Test webhook sent",
        description: "Check your endpoint logs for the test delivery",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks", selectedEndpoint?.id, "deliveries"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error testing webhook",
        description: error.message || "Failed to send test webhook",
        variant: "destructive",
      });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/webhooks/${id}/regenerate-secret`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Secret regenerated",
        description: "Your webhook signing secret has been regenerated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error regenerating secret",
        description: error.message || "Failed to regenerate secret",
        variant: "destructive",
      });
    },
  });

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({
      title: "Copied to clipboard",
      description: "Signing secret copied successfully",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Webhooks</h1>
          <p className="text-muted-foreground mt-2">
            Configure webhook endpoints to receive real-time notifications
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-webhook">
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Webhook Endpoints</CardTitle>
            <CardDescription>Manage your webhook subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {!webhooks?.data || webhooks.data.length === 0 ? (
              <div className="text-center py-8" data-testid="text-no-webhooks">
                <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No webhooks yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first webhook to receive real-time notifications
                </p>
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.data.map((webhook: any) => (
                  <Card
                    key={webhook.id}
                    className={`cursor-pointer transition-colors ${
                      selectedEndpoint?.id === webhook.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedEndpoint(webhook)}
                    data-testid={`card-webhook-${webhook.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-url-${webhook.id}`}>
                            {webhook.url}
                          </p>
                          {webhook.description && (
                            <p className="text-sm text-muted-foreground">{webhook.description}</p>
                          )}
                        </div>
                        <Badge variant={webhook.isActive ? "default" : "secondary"} className="ml-2">
                          {webhook.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{webhook.events.length} events</span>
                        <span>•</span>
                        <span data-testid={`text-stats-${webhook.id}`}>
                          {webhook.totalDeliveries || 0} deliveries
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endpoint Details</CardTitle>
            <CardDescription>
              {selectedEndpoint ? "View and manage webhook details" : "Select a webhook to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedEndpoint ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-selection">
                <Eye className="h-12 w-12 mx-auto mb-4" />
                <p>Select a webhook endpoint to view details</p>
              </div>
            ) : (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                  <TabsTrigger value="deliveries" data-testid="tab-deliveries">Deliveries</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">URL</label>
                    <p className="text-sm text-muted-foreground break-all" data-testid="text-selected-url">
                      {selectedEndpoint.url}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Signing Secret</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 font-mono" data-testid="text-secret">
                        {viewSecret ? selectedEndpoint.secret : "•".repeat(32)}
                      </code>
                      <Button size="icon" variant="ghost" onClick={() => setViewSecret(!viewSecret)} data-testid="button-toggle-secret">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopySecret(selectedEndpoint.secret)}
                        data-testid="button-copy-secret"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this secret to verify webhook signatures
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Subscribed Events</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEndpoint.events.map((event: string) => (
                        <Badge key={event} variant="secondary" data-testid={`badge-event-${event}`}>
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Max Retries</label>
                      <p className="text-sm text-muted-foreground">{selectedEndpoint.maxRetries}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Retry Backoff</label>
                      <p className="text-sm text-muted-foreground">{selectedEndpoint.retryBackoffSeconds}s</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-deliveries">
                        {selectedEndpoint.totalDeliveries || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-successful-deliveries">
                        {selectedEndpoint.successfulDeliveries || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Success</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600" data-testid="text-failed-deliveries">
                        {selectedEndpoint.failedDeliveries || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      onClick={() => testMutation.mutate(selectedEndpoint.id)}
                      disabled={testMutation.isPending}
                      data-testid="button-test-webhook"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Test Webhook
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => regenerateSecretMutation.mutate(selectedEndpoint.id)}
                      disabled={regenerateSecretMutation.isPending}
                      data-testid="button-regenerate-secret"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Regenerate Secret
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(selectedEndpoint.id)}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-webhook"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="deliveries" className="space-y-4">
                  {isLoadingDeliveries ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : !deliveries?.data || deliveries.data.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="text-no-deliveries">
                      <p>No deliveries yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.data.map((delivery: any) => (
                        <Card key={delivery.id} data-testid={`card-delivery-${delivery.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-sm font-medium" data-testid={`text-event-${delivery.id}`}>
                                {delivery.eventType}
                              </span>
                              <Badge
                                variant={
                                  delivery.status === "success"
                                    ? "default"
                                    : delivery.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                data-testid={`badge-status-${delivery.id}`}
                              >
                                {delivery.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>Attempt {delivery.attemptNumber}</p>
                              <p>{format(new Date(delivery.createdAt), "MMM d, yyyy h:mm a")}</p>
                              {delivery.statusCode && <p>Status: {delivery.statusCode}</p>}
                              {delivery.errorMessage && (
                                <p className="text-red-600">Error: {delivery.errorMessage}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-webhook">
          <DialogHeader>
            <DialogTitle>Create Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Subscribe to events and receive real-time HTTP notifications
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.example.com/webhooks" {...field} data-testid="input-url" />
                    </FormControl>
                    <FormDescription>The URL where webhook events will be sent</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Production webhook" {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="events"
                render={() => (
                  <FormItem>
                    <FormLabel>Events</FormLabel>
                    <FormDescription>Select which events trigger this webhook</FormDescription>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {eventsList?.data?.map((event: any) => (
                        <FormField
                          key={event.name}
                          control={form.control}
                          name="events"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(event.name)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), event.name]
                                      : (field.value || []).filter((v: string) => v !== event.name);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-event-${event.name}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-normal">{event.name}</FormLabel>
                                <FormDescription className="text-xs">{event.description}</FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxRetries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Retries</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-max-retries"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retryBackoffSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry Backoff (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-retry-backoff"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Webhook
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
