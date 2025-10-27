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
import { Loader2, Plus, Copy, Eye, EyeOff, Trash2, AlertCircle, Key } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const AVAILABLE_SCOPES = [
  { id: "employees:read", label: "Read employees", description: "View employee data" },
  { id: "employees:write", label: "Write employees", description: "Create and update employees" },
  { id: "screenings:read", label: "Read screenings", description: "View screening data" },
  { id: "screenings:write", label: "Write screenings", description: "Create and update screenings" },
  { id: "credits:read", label: "Read credits", description: "View credit calculations" },
];

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  expiresInDays: z.number().min(1).max(365).optional(),
});

type CreateKeyForm = z.infer<typeof createKeySchema>;

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ key: string; name: string } | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const form = useForm<CreateKeyForm>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      name: "",
      scopes: [],
      expiresInDays: 90,
    },
  });

  const { data: apiKeys, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateKeyForm) => {
      const res = await apiRequest("POST", "/api/api-keys", data);
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      const fullKey = data.key;
      setNewlyCreatedKey({ key: fullKey, name: data.data.name });
      localStorage.setItem("lastCreatedApiKey", fullKey);
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "API key created",
        description: "Your new API key has been created successfully. Copy it now - you won't see it again!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating API key",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "API key deleted",
        description: "The API key has been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting API key",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied to clipboard",
      description: "API key copied successfully",
    });
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + "..." + key.substring(key.length - 4);
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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">API Keys</h1>
          <p className="text-muted-foreground mt-2">
            Manage API keys for programmatic access to your WOTC data
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-key">
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {newlyCreatedKey && (
        <Alert data-testid="alert-new-key">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <p className="font-semibold mb-1">Your new API key for "{newlyCreatedKey.name}"</p>
              <code className="bg-muted px-2 py-1 rounded text-sm" data-testid="text-new-key">
                {newlyCreatedKey.key}
              </code>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure to copy your API key now. You won't be able to see it again!
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyKey(newlyCreatedKey.key)}
                data-testid="button-copy-new-key"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNewlyCreatedKey(null)}
                data-testid="button-dismiss-alert"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active API Keys</CardTitle>
          <CardDescription>
            API keys provide programmatic access to your WOTC data via REST API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!apiKeys?.data || apiKeys.data.length === 0 ? (
            <div className="text-center py-12" data-testid="text-no-keys">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first API key to start using the REST API
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-key">
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.data.map((key: any) => (
                  <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                    <TableCell className="font-medium" data-testid={`text-key-name-${key.id}`}>
                      {key.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm" data-testid={`text-key-value-${key.id}`}>
                          {visibleKeys.has(key.id) ? key.keyPrefix + "..." : maskKey(key.keyPrefix + "xxxx")}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleKeyVisibility(key.id)}
                          data-testid={`button-toggle-visibility-${key.id}`}
                        >
                          {visibleKeys.has(key.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.slice(0, 2).map((scope: string) => (
                          <Badge key={scope} variant="secondary" data-testid={`badge-scope-${scope}`}>
                            {scope}
                          </Badge>
                        ))}
                        {key.scopes.length > 2 && (
                          <Badge variant="outline">+{key.scopes.length - 2} more</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-created-${key.id}`}>
                      {format(new Date(key.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`text-expires-${key.id}`}>
                      {key.expiresAt ? format(new Date(key.expiresAt), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(key.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${key.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-key">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access to your WOTC data
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Production API Key" {...field} data-testid="input-key-name" />
                    </FormControl>
                    <FormDescription>A descriptive name for this API key</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scopes"
                render={() => (
                  <FormItem>
                    <FormLabel>Scopes</FormLabel>
                    <FormDescription>Select the permissions for this API key</FormDescription>
                    <div className="space-y-2 mt-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <FormField
                          key={scope.id}
                          control={form.control}
                          name="scopes"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(scope.id)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), scope.id]
                                      : (field.value || []).filter((v: string) => v !== scope.id);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-scope-${scope.id}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="font-normal">{scope.label}</FormLabel>
                                <FormDescription className="text-xs">{scope.description}</FormDescription>
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

              <FormField
                control={form.control}
                name="expiresInDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="90"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-expires-days"
                      />
                    </FormControl>
                    <FormDescription>Leave empty for no expiration</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  Create Key
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
