import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Edit, Plus, Trash2, Eye, EyeOff, Save, AlertTriangle, History, RefreshCw, Calendar } from "lucide-react";

// Form schema for state portal credentials
const stateCredentialsSchema = z.object({
  stateCode: z.string().min(2).max(2).toUpperCase(),
  stateName: z.string().min(1),
  portalUrl: z.string().url(),
  bulkUploadUrl: z.string().url().optional().or(z.literal('')),
  userId: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  ocrEnabled: z.boolean(),
  bulkUploadInput: z.string().optional().or(z.literal('')),
  challengeQuestions: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  mfaEnabled: z.boolean(),
  mfaType: z.string().optional().or(z.literal('')),
  mfaSecret: z.string().optional().or(z.literal('')),
  mfaPhone: z.string().optional().or(z.literal('')),
  mfaEmail: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  followUps: z.array(z.object({
    date: z.string(),
    description: z.string(),
    completed: z.boolean(),
  })).optional(),
  stateContacts: z.array(z.object({
    name: z.string(),
    title: z.string(),
    email: z.string().email(),
    phone: z.string(),
  })).max(3).optional(),
  missingElectronicSubmittals: z.boolean(),
  signatureRequirement: z.enum(['electronic', 'wet', 'both']),
  longPoaApprovalDuration: z.boolean(),
  automationEnabled: z.boolean(),
});

type StateCredentials = z.infer<typeof stateCredentialsSchema>;

export default function StateCredentialsPage() {
  const { toast } = useToast();
  const [editingState, setEditingState] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rotatingPortal, setRotatingPortal] = useState<any>(null);
  const [viewingHistory, setViewingHistory] = useState<any>(null);
  const [rotationDialogOpen, setRotationDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Fetch state portal configurations
  const { data: statePortals, isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/state-portals'],
  });

  // Fetch portals due for rotation
  const { data: rotationDueData } = useQuery<{ count: number; portals: any[] }>({
    queryKey: ['/api/admin/state-portals/rotation-due'],
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Transform data for API
      const credentials = data.userId || data.password ? {
        userId: data.userId,
        password: data.password,
      } : null;

      const apiData = {
        ...data,
        credentials,
        challengeQuestions: data.challengeQuestions || [],
        stateContacts: data.stateContacts || [],
        followUps: data.followUps || [],
        mfaEnabled: data.mfaEnabled || false,
        mfaType: data.mfaType || null,
        mfaSecret: data.mfaSecret || null,
        mfaPhone: data.mfaPhone || null,
        mfaEmail: data.mfaEmail || null,
      };

      delete apiData.userId;
      delete apiData.password;

      const response = await apiRequest('PATCH', `/api/admin/state-portals/${id}`, apiData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-portals'] });
      toast({
        title: "Success",
        description: "State portal credentials updated successfully",
      });
      setIsDialogOpen(false);
      setEditingState(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    },
  });

  // Rotate credentials mutation
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [rotationReason, setRotationReason] = useState('');

  const rotateMutation = useMutation({
    mutationFn: async ({ id, newCredentials, reason }: { id: string; newCredentials: { userId: string; password: string }; reason?: string }) => {
      const response = await apiRequest('POST', `/api/admin/state-portals/${id}/rotate`, {
        newCredentials,
        rotationType: 'manual',
        reason,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-portals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/state-portals/rotation-due'] });
      toast({
        title: "Success",
        description: "Credentials rotated successfully",
      });
      setRotationDialogOpen(false);
      setRotatingPortal(null);
      setNewUserId('');
      setNewPassword('');
      setRotationReason('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rotate credentials",
        variant: "destructive",
      });
    },
  });

  // Fetch rotation history for viewing
  const { data: rotationHistory, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: ['/api/admin/state-portals', viewingHistory?.id, 'rotation-history'],
    enabled: !!viewingHistory,
    queryFn: async () => {
      if (!viewingHistory) return [];
      const response = await apiRequest('GET', `/api/admin/state-portals/${viewingHistory.id}/rotation-history`);
      return await response.json();
    },
  });

  const form = useForm<StateCredentials>({
    resolver: zodResolver(stateCredentialsSchema),
    defaultValues: {
      challengeQuestions: [],
      stateContacts: [],
      followUps: [],
      ocrEnabled: false,
      mfaEnabled: false,
      missingElectronicSubmittals: false,
      signatureRequirement: 'electronic',
      longPoaApprovalDuration: false,
      automationEnabled: false,
    },
  });

  const openEditDialog = (state: any) => {
    setEditingState(state);
    const creds = state.credentials || {};
    
    form.reset({
      stateCode: state.stateCode,
      stateName: state.stateName,
      portalUrl: state.portalUrl,
      bulkUploadUrl: state.bulkUploadUrl || '',
      userId: creds.userId || '',
      password: creds.password || '',
      ocrEnabled: state.ocrEnabled || false,
      bulkUploadInput: state.bulkUploadInput || '',
      challengeQuestions: state.challengeQuestions || [],
      mfaEnabled: state.mfaEnabled || false,
      mfaType: state.mfaType || '',
      mfaSecret: state.mfaSecret || '',
      mfaPhone: state.mfaPhone || '',
      mfaEmail: state.mfaEmail || '',
      notes: state.notes || '',
      followUps: state.followUps || [],
      stateContacts: state.stateContacts || [],
      missingElectronicSubmittals: state.missingElectronicSubmittals || false,
      signatureRequirement: state.signatureRequirement || 'electronic',
      longPoaApprovalDuration: state.longPoaApprovalDuration || false,
      automationEnabled: state.automationEnabled || false,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: StateCredentials) => {
    if (!editingState) return;
    updateMutation.mutate({ id: editingState.id, data });
  };

  if (isLoading) {
    return <div className="p-8">Loading state portals...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="heading-state-credentials">State Portal Credentials</h1>
        <p className="text-muted-foreground mt-2">
          Manage login credentials and configuration for state workforce agency portals
        </p>
      </div>

      {/* Rotation Alert Banner */}
      {rotationDueData && rotationDueData.count > 0 && (
        <Alert variant="destructive" className="mb-6" data-testid="alert-rotation-due">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Credential Rotation Required</AlertTitle>
          <AlertDescription>
            {rotationDueData.count} state portal{rotationDueData.count > 1 ? 's' : ''} {rotationDueData.count > 1 ? 'need' : 'needs'} credential rotation.
            Review and rotate credentials to maintain security compliance.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {statePortals?.map((state) => (
          <Card key={state.id} data-testid={`card-state-${state.stateCode}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-bold">{state.stateCode}</span>
                    <span>{state.stateName}</span>
                    {state.automationEnabled && (
                      <Badge variant="default">Automation Enabled</Badge>
                    )}
                    {state.ocrEnabled && (
                      <Badge variant="secondary">OCR Enabled</Badge>
                    )}
                    {state.nextRotationDue && new Date(state.nextRotationDue) < new Date() && (
                      <Badge variant="destructive" data-testid={`badge-rotation-overdue-${state.stateCode}`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Rotation Overdue
                      </Badge>
                    )}
                    {state.nextRotationDue && new Date(state.nextRotationDue) > new Date() && (
                      <Badge variant="outline" data-testid={`badge-rotation-scheduled-${state.stateCode}`}>
                        <Calendar className="w-3 h-3 mr-1" />
                        Next: {new Date(state.nextRotationDue).toLocaleDateString()}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {state.portalUrl}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setRotatingPortal(state);
                      setRotationDialogOpen(true);
                    }}
                    size="sm"
                    variant="outline"
                    data-testid={`button-rotate-${state.stateCode}`}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rotate
                  </Button>
                  <Button
                    onClick={() => {
                      setViewingHistory(state);
                      setHistoryDialogOpen(true);
                    }}
                    size="sm"
                    variant="ghost"
                    data-testid={`button-history-${state.stateCode}`}
                  >
                    <History className="w-4 h-4 mr-2" />
                    History
                  </Button>
                  <Button
                    onClick={() => openEditDialog(state)}
                    size="sm"
                    data-testid={`button-edit-${state.stateCode}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">User ID</div>
                  <div className="font-medium">
                    {state.credentials?.userId ? '••••••••' : 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Password</div>
                  <div className="font-medium">
                    {state.credentials?.password ? '••••••••' : 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Signature Requirement</div>
                  <div className="font-medium capitalize">{state.signatureRequirement || 'electronic'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">State Contacts</div>
                  <div className="font-medium">{state.stateContacts?.length || 0} contacts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {editingState?.stateCode} - {editingState?.stateName}
            </DialogTitle>
            <DialogDescription>
              Update login credentials and portal configuration
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="credentials" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="notes">Notes & Follow-ups</TabsTrigger>
              </TabsList>

              {/* Credentials Tab */}
              <TabsContent value="credentials" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="portalUrl">Portal URL *</Label>
                    <Input
                      id="portalUrl"
                      {...form.register('portalUrl')}
                      placeholder="https://state-portal.gov"
                      data-testid="input-portal-url"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulkUploadUrl">Bulk Upload URL</Label>
                    <Input
                      id="bulkUploadUrl"
                      {...form.register('bulkUploadUrl')}
                      placeholder="https://state-portal.gov/bulk-upload"
                      data-testid="input-bulk-url"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userId">User ID / Username</Label>
                    <Input
                      id="userId"
                      {...form.register('userId')}
                      placeholder="username"
                      data-testid="input-user-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        {...form.register('password')}
                        placeholder="••••••••"
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bulkUploadInput">Bulk Upload Requirements</Label>
                  <Textarea
                    id="bulkUploadInput"
                    {...form.register('bulkUploadInput')}
                    placeholder="Additional requirements or notes for bulk uploads..."
                    rows={3}
                    data-testid="textarea-bulk-requirements"
                  />
                </div>

                <ChallengeQuestionsSection form={form} />
                
                {/* MFA Configuration */}
                <div className="border-t pt-4 mt-6">
                  <h3 className="text-lg font-semibold mb-4">Multi-Factor Authentication (MFA)</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="mfaEnabled">Enable MFA</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable multi-factor authentication for this portal
                        </p>
                      </div>
                      <Controller
                        name="mfaEnabled"
                        control={form.control}
                        render={({ field }) => (
                          <Switch
                            id="mfaEnabled"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-mfa-enabled"
                          />
                        )}
                      />
                    </div>

                    {form.watch('mfaEnabled') && (
                      <>
                        <div>
                          <Label htmlFor="mfaType">MFA Type</Label>
                          <Select
                            value={form.watch('mfaType') || ''}
                            onValueChange={(value) => form.setValue('mfaType', value)}
                          >
                            <SelectTrigger data-testid="select-mfa-type">
                              <SelectValue placeholder="Select MFA type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="totp">TOTP (Time-based)</SelectItem>
                              <SelectItem value="authenticator_app">Authenticator App</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(form.watch('mfaType') === 'totp' || form.watch('mfaType') === 'authenticator_app') && (
                          <div>
                            <Label htmlFor="mfaSecret">TOTP Secret (Base32)</Label>
                            <Input
                              id="mfaSecret"
                              {...form.register('mfaSecret')}
                              placeholder="JBSWY3DPEHPK3PXP"
                              data-testid="input-mfa-secret"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Base32-encoded TOTP secret from authenticator app setup
                            </p>
                          </div>
                        )}

                        {form.watch('mfaType') === 'sms' && (
                          <div>
                            <Label htmlFor="mfaPhone">MFA Phone Number</Label>
                            <Input
                              id="mfaPhone"
                              {...form.register('mfaPhone')}
                              placeholder="+1 (555) 123-4567"
                              data-testid="input-mfa-phone"
                            />
                          </div>
                        )}

                        {form.watch('mfaType') === 'email' && (
                          <div>
                            <Label htmlFor="mfaEmail">MFA Email Address</Label>
                            <Input
                              id="mfaEmail"
                              type="email"
                              {...form.register('mfaEmail')}
                              placeholder="mfa@example.com"
                              data-testid="input-mfa-email"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Configuration Tab */}
              <TabsContent value="config" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="ocrEnabled">OCR Enabled</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable OCR for determination letter processing
                      </p>
                    </div>
                    <Controller
                      name="ocrEnabled"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="ocrEnabled"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-ocr-enabled"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="automationEnabled">Automation Enabled</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable automated bulk submissions
                      </p>
                    </div>
                    <Controller
                      name="automationEnabled"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="automationEnabled"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-automation-enabled"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="missingElectronicSubmittals">Missing Electronic Submittals</Label>
                      <p className="text-sm text-muted-foreground">
                        State requires manual submission (no electronic portal)
                      </p>
                    </div>
                    <Controller
                      name="missingElectronicSubmittals"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="missingElectronicSubmittals"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-missing-electronic"
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="longPoaApprovalDuration">Long POA Approval Duration</Label>
                      <p className="text-sm text-muted-foreground">
                        State has extended processing times for POA approvals
                      </p>
                    </div>
                    <Controller
                      name="longPoaApprovalDuration"
                      control={form.control}
                      render={({ field }) => (
                        <Switch
                          id="longPoaApprovalDuration"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-long-poa"
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="signatureRequirement">Signature Requirement</Label>
                    <Select
                      value={form.watch('signatureRequirement')}
                      onValueChange={(value: any) => form.setValue('signatureRequirement', value)}
                    >
                      <SelectTrigger data-testid="select-signature-requirement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electronic">Electronic Signatures</SelectItem>
                        <SelectItem value="wet">Wet Signatures (Physical)</SelectItem>
                        <SelectItem value="both">Both Required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="space-y-4">
                <StateContactsSection form={form} />
              </TabsContent>

              {/* Notes & Follow-ups Tab */}
              <TabsContent value="notes" className="space-y-4">
                <div>
                  <Label htmlFor="notes">General Notes</Label>
                  <Textarea
                    id="notes"
                    {...form.register('notes')}
                    placeholder="Important information about this state portal..."
                    rows={5}
                    data-testid="textarea-notes"
                  />
                </div>

                <FollowUpsSection form={form} />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rotate Credentials Dialog */}
      <Dialog open={rotationDialogOpen} onOpenChange={setRotationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Credentials - {rotatingPortal?.stateCode}</DialogTitle>
            <DialogDescription>
              Enter new credentials for {rotatingPortal?.stateName}. Old credentials will be securely logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newUserId">New User ID</Label>
              <Input
                id="newUserId"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="Enter new user ID"
                data-testid="input-new-userid"
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-new-password"
              />
            </div>

            <div>
              <Label htmlFor="rotationReason">Reason (Optional)</Label>
              <Textarea
                id="rotationReason"
                value={rotationReason}
                onChange={(e) => setRotationReason(e.target.value)}
                placeholder="Scheduled rotation, security incident, etc."
                rows={2}
                data-testid="textarea-rotation-reason"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setRotationDialogOpen(false);
                  setNewUserId('');
                  setNewPassword('');
                  setRotationReason('');
                }}
                data-testid="button-cancel-rotation"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Trim and validate inputs
                  const trimmedUserId = newUserId.trim();
                  const trimmedPassword = newPassword.trim();
                  
                  if (!trimmedUserId || !trimmedPassword) {
                    toast({
                      title: "Validation Error",
                      description: "User ID and password are required and cannot be empty or whitespace only",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (trimmedUserId.length < 3) {
                    toast({
                      title: "Validation Error",
                      description: "User ID must be at least 3 characters long",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (trimmedPassword.length < 6) {
                    toast({
                      title: "Validation Error",
                      description: "Password must be at least 6 characters long",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  rotateMutation.mutate({
                    id: rotatingPortal.id,
                    newCredentials: { userId: trimmedUserId, password: trimmedPassword },
                    reason: rotationReason?.trim() || undefined,
                  });
                }}
                disabled={rotateMutation.isPending || !newUserId.trim() || !newPassword.trim()}
                data-testid="button-confirm-rotation"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {rotateMutation.isPending ? 'Rotating...' : 'Rotate Credentials'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotation History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rotation History - {viewingHistory?.stateCode}</DialogTitle>
            <DialogDescription>
              View credential rotation history for {viewingHistory?.stateName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="text-center text-muted-foreground py-8">
                Loading rotation history...
              </div>
            ) : rotationHistory && rotationHistory.length > 0 ? (
              rotationHistory.map((entry: any) => (
                <Card key={entry.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {new Date(entry.rotatedAt).toLocaleString()}
                      </CardTitle>
                      <Badge variant={entry.rotationType === 'security_incident' ? 'destructive' : 'outline'}>
                        {entry.rotationType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground">Rotated by:</span>{' '}
                        <span className="font-medium">
                          {entry.rotatedByUser?.firstName} {entry.rotatedByUser?.lastName} ({entry.rotatedByUser?.email})
                        </span>
                      </div>
                      {entry.reason && (
                        <div>
                          <span className="text-muted-foreground">Reason:</span>{' '}
                          <span className="font-medium">{entry.reason}</span>
                        </div>
                      )}
                      {entry.mfaChanged && (
                        <Badge variant="secondary" className="mt-2">
                          MFA Configuration Changed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No rotation history available for this portal.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Challenge Questions Component
function ChallengeQuestionsSection({ form }: { form: any }) {
  const [questions, setQuestions] = useState<Array<{ question: string; answer: string }>>(
    form.watch('challengeQuestions') || []
  );

  const addQuestion = () => {
    const newQuestions = [...questions, { question: '', answer: '' }];
    setQuestions(newQuestions);
    form.setValue('challengeQuestions', newQuestions);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
    form.setValue('challengeQuestions', newQuestions);
  };

  const updateQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
    form.setValue('challengeQuestions', newQuestions);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Challenge Questions</Label>
        <Button type="button" size="sm" variant="outline" onClick={addQuestion} data-testid="button-add-challenge">
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      </div>

      {questions.map((q, index) => (
        <Card key={index} className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <Label className="text-sm">Question {index + 1}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeQuestion(index)}
                data-testid={`button-remove-challenge-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              value={q.question}
              onChange={(e) => updateQuestion(index, 'question', e.target.value)}
              placeholder="What is your mother's maiden name?"
              data-testid={`input-challenge-question-${index}`}
            />
            <Input
              value={q.answer}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Answer"
              type="password"
              data-testid={`input-challenge-answer-${index}`}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

// State Contacts Component
function StateContactsSection({ form }: { form: any }) {
  const [contacts, setContacts] = useState<Array<{ name: string; title: string; email: string; phone: string }>>(
    form.watch('stateContacts') || []
  );

  const addContact = () => {
    if (contacts.length >= 3) return;
    const newContacts = [...contacts, { name: '', title: '', email: '', phone: '' }];
    setContacts(newContacts);
    form.setValue('stateContacts', newContacts);
  };

  const removeContact = (index: number) => {
    const newContacts = contacts.filter((_, i) => i !== index);
    setContacts(newContacts);
    form.setValue('stateContacts', newContacts);
  };

  const updateContact = (index: number, field: keyof typeof contacts[0], value: string) => {
    const newContacts = [...contacts];
    newContacts[index][field] = value;
    setContacts(newContacts);
    form.setValue('stateContacts', newContacts);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>State Contacts (Max 3)</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addContact}
          disabled={contacts.length >= 3}
          data-testid="button-add-contact"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {contacts.map((contact, index) => (
        <Card key={index} className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <Label className="text-sm">Contact {index + 1}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeContact(index)}
                data-testid={`button-remove-contact-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={contact.name}
                onChange={(e) => updateContact(index, 'name', e.target.value)}
                placeholder="Name"
                data-testid={`input-contact-name-${index}`}
              />
              <Input
                value={contact.title}
                onChange={(e) => updateContact(index, 'title', e.target.value)}
                placeholder="Title"
                data-testid={`input-contact-title-${index}`}
              />
              <Input
                value={contact.email}
                onChange={(e) => updateContact(index, 'email', e.target.value)}
                placeholder="Email"
                type="email"
                data-testid={`input-contact-email-${index}`}
              />
              <Input
                value={contact.phone}
                onChange={(e) => updateContact(index, 'phone', e.target.value)}
                placeholder="Phone"
                data-testid={`input-contact-phone-${index}`}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Follow-ups Component
function FollowUpsSection({ form }: { form: any }) {
  const [followUps, setFollowUps] = useState<Array<{ date: string; description: string; completed: boolean }>>(
    form.watch('followUps') || []
  );

  const addFollowUp = () => {
    const newFollowUps = [...followUps, { date: '', description: '', completed: false }];
    setFollowUps(newFollowUps);
    form.setValue('followUps', newFollowUps);
  };

  const removeFollowUp = (index: number) => {
    const newFollowUps = followUps.filter((_, i) => i !== index);
    setFollowUps(newFollowUps);
    form.setValue('followUps', newFollowUps);
  };

  const updateFollowUp = (index: number, field: 'date' | 'description' | 'completed', value: any) => {
    const newFollowUps = [...followUps];
    newFollowUps[index][field] = value;
    setFollowUps(newFollowUps);
    form.setValue('followUps', newFollowUps);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Follow-ups & Reminders</Label>
        <Button type="button" size="sm" variant="outline" onClick={addFollowUp} data-testid="button-add-followup">
          <Plus className="w-4 h-4 mr-2" />
          Add Follow-up
        </Button>
      </div>

      {followUps.map((followUp, index) => (
        <Card key={index} className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <Label className="text-sm">Follow-up {index + 1}</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={followUp.completed}
                  onCheckedChange={(checked) => updateFollowUp(index, 'completed', checked)}
                  data-testid={`switch-followup-completed-${index}`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFollowUp(index)}
                  data-testid={`button-remove-followup-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Input
              value={followUp.date}
              onChange={(e) => updateFollowUp(index, 'date', e.target.value)}
              type="date"
              data-testid={`input-followup-date-${index}`}
            />
            <Textarea
              value={followUp.description}
              onChange={(e) => updateFollowUp(index, 'description', e.target.value)}
              placeholder="Description of follow-up action..."
              rows={2}
              data-testid={`textarea-followup-description-${index}`}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
