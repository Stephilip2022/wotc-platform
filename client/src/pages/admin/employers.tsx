import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Settings, FileText, CheckCircle, MapPin, X, DollarSign, Handshake, Mail, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Employer, EtaForm9198, ReferralPartner } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployerSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { z } from "zod";
import { Link } from "wouter";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
  { code: "PR", name: "Puerto Rico" }, { code: "VI", name: "U.S. Virgin Islands" },
  { code: "GU", name: "Guam" }, { code: "AS", name: "American Samoa" },
];

type EmployerFormData = z.infer<typeof insertEmployerSchema>;

export default function AdminEmployersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [signedByName, setSignedByName] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const [selectedHiringStates, setSelectedHiringStates] = useState<string[]>([]);
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [onboardingEnabled, setOnboardingEnabled] = useState(false);

  const { data: employers, isLoading } = useQuery<Employer[]>({
    queryKey: ["/api/admin/employers"],
  });

  const { data: etaForms } = useQuery<EtaForm9198[]>({
    queryKey: ["/api/admin/eta-forms"],
  });

  const { data: referralPartners, isLoading: partnersLoading } = useQuery<ReferralPartner[]>({
    queryKey: ["/api/admin/referral-partners"],
  });

  const form = useForm<EmployerFormData>({
    resolver: zodResolver(insertEmployerSchema.omit({ 
      logoUrl: true, 
      primaryColor: true, 
      welcomeMessage: true, 
      customFooter: true,
      revenueSharePercentage: true,
      stripeCustomerId: true,
      billingStatus: true,
    })),
    defaultValues: {
      name: "",
      ein: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      feePercentage: "15.00",
      referralPartnerId: null,
    },
  });

  const addEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("POST", "/api/admin/employers", {
        ...data,
        hiringStates: selectedHiringStates.length > 0 ? selectedHiringStates : null,
        onboardingModuleEnabled: onboardingEnabled,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Employer Added",
        description: "New employer has been added to the system. A unique questionnaire URL has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers"] });
      setDialogOpen(false);
      form.reset();
      setSelectedHiringStates([]);
      setStateSearchTerm("");
      setOnboardingEnabled(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add employer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendWelcomeEmailMutation = useMutation({
    mutationFn: async (employerId: string) => {
      const response = await apiRequest("POST", `/api/admin/employers/${employerId}/resend-welcome`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Sent",
        description: data.message || "Welcome email has been resent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to resend welcome email.",
        variant: "destructive",
      });
    },
  });

  const completeSignatureMutation = useMutation({
    mutationFn: async ({ formId, signedByName, signedByEmail }: { formId: string; signedByName: string; signedByEmail: string }) => {
      const response = await apiRequest("POST", `/api/admin/eta-forms/${formId}/complete-signature`, {
        signedByName,
        signedByEmail,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Employer Account Created!",
        description: `${data.employer.name} has been activated. Questionnaire URL: ${data.questionnaireUrl}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/eta-forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers"] });
      setSignatureDialogOpen(false);
      setSignedByName("");
      setSignedByEmail("");
      setSelectedFormId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete signature",
        variant: "destructive",
      });
    },
  });

  const safeEmployers = Array.isArray(employers) ? employers : [];
  const safeEtaForms = Array.isArray(etaForms) ? etaForms : [];

  const filteredEmployers = safeEmployers.filter((emp) => {
    const search = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(search) ||
      emp.ein?.toLowerCase().includes(search) ||
      emp.contactEmail?.toLowerCase().includes(search)
    );
  });

  const pendingForms = safeEtaForms.filter((form) => form.status === "sent");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employers</h1>
          <p className="text-muted-foreground">
            Manage employer accounts, onboarding, and billing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild data-testid="button-new-eta-form">
            <Link href="/admin/employers/new">
              <FileText className="h-4 w-4 mr-2" />
              New ETA Form 9198
            </Link>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-employer">
                <Plus className="h-4 w-4 mr-2" />
                Add Employer
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add New Employer</DialogTitle>
              <DialogDescription>
                Create a new employer account in the WOTC system.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => addEmployerMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ein"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EIN</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="XX-XXXXXXX" data-testid="input-ein" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="CA" data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-zip-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="feePercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Service Fee Percentage
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Set the percentage fee (0% - 20%) for this employer's engagement letter
                      </p>
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Slider
                            min={0}
                            max={20}
                            step={0.5}
                            value={[parseFloat(field.value || "15")]}
                            onValueChange={(vals) => field.onChange(vals[0].toFixed(2))}
                            className="flex-1"
                            data-testid="slider-fee-percentage"
                          />
                        </FormControl>
                        <div className="flex items-center gap-1 min-w-[80px]">
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            step={0.5}
                            value={field.value || "15.00"}
                            onChange={(e) => {
                              const val = Math.min(20, Math.max(0, parseFloat(e.target.value) || 0));
                              field.onChange(val.toFixed(2));
                            }}
                            className="w-[70px] text-center"
                            data-testid="input-fee-percentage"
                          />
                          <span className="text-sm font-medium text-muted-foreground">%</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Handshake className="h-4 w-4" />
                    Referral Partner
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Select the referral partner who referred this employer, or leave as "No Partner"
                  </p>
                  <Select
                    value={form.watch("referralPartnerId") || "none"}
                    onValueChange={(val) => form.setValue("referralPartnerId", val === "none" ? null : val)}
                  >
                    <SelectTrigger data-testid="select-referral-partner">
                      <SelectValue placeholder="No Partner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Partner</SelectItem>
                      {referralPartners?.filter(p => p.status === "active").map((partner) => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.dba || partner.legalName} ({partner.revenueSharePercentage}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>

                <div className="space-y-3">
                  <FormLabel>Hiring States</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Select the states where this employer hires employees
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedHiringStates.length === US_STATES.length) {
                          setSelectedHiringStates([]);
                        } else {
                          setSelectedHiringStates(US_STATES.map(s => s.code));
                        }
                      }}
                      data-testid="button-select-all-states"
                    >
                      {selectedHiringStates.length === US_STATES.length ? "Deselect All" : "Select All 50 States"}
                    </Button>
                    {selectedHiringStates.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedHiringStates.length} state{selectedHiringStates.length !== 1 ? "s" : ""} selected
                      </span>
                    )}
                  </div>
                  {selectedHiringStates.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedHiringStates.sort().map(code => (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedHiringStates(prev => prev.filter(s => s !== code))}
                          data-testid={`badge-state-${code}`}
                        >
                          {code}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    placeholder="Search states..."
                    value={stateSearchTerm}
                    onChange={(e) => setStateSearchTerm(e.target.value)}
                    data-testid="input-search-states"
                  />
                  <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {US_STATES
                        .filter(s =>
                          s.name.toLowerCase().includes(stateSearchTerm.toLowerCase()) ||
                          s.code.toLowerCase().includes(stateSearchTerm.toLowerCase())
                        )
                        .map(state => (
                          <label
                            key={state.code}
                            className="flex items-center gap-2 p-1.5 rounded-md hover-elevate cursor-pointer text-sm"
                            data-testid={`label-state-${state.code}`}
                          >
                            <Checkbox
                              checked={selectedHiringStates.includes(state.code)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedHiringStates(prev => [...prev, state.code]);
                                } else {
                                  setSelectedHiringStates(prev => prev.filter(s => s !== state.code));
                                }
                              }}
                              data-testid={`checkbox-state-${state.code}`}
                            />
                            <span>{state.code}</span>
                            <span className="text-muted-foreground">{state.name}</span>
                          </label>
                        ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">New Hire Onboarding Module</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable the new hire onboarding system for this employer. Provides digital W-4, direct deposit, ID upload, policy e-signatures, and more.
                    </p>
                  </div>
                  <Switch
                    checked={onboardingEnabled}
                    onCheckedChange={setOnboardingEnabled}
                    data-testid="switch-onboarding-module"
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={addEmployerMutation.isPending} data-testid="button-submit-employer">
                    {addEmployerMutation.isPending ? "Adding..." : "Add Employer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="employers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employers" data-testid="tab-employers">
            Active Employers ({employers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-forms">
            Pending Forms ({pendingForms.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-employers"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>EIN</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Hiring States</TableHead>
                <TableHead>Fee %</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployers.length > 0 ? (
                filteredEmployers.map((employer) => (
                  <TableRow key={employer.id} data-testid={`row-employer-${employer.id}`}>
                    <TableCell className="font-medium">{employer.name}</TableCell>
                    <TableCell className="font-mono text-sm">{employer.ein ? `***-***${employer.ein.slice(-4)}` : ""}</TableCell>
                    <TableCell>{employer.contactEmail}</TableCell>
                    <TableCell>
                      {employer.hiringStates && employer.hiringStates.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {employer.hiringStates.length <= 5 ? (
                            employer.hiringStates.map(s => (
                              <Badge key={s} variant="secondary" className="text-xs no-default-active-elevate">
                                {s}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {employer.hiringStates.length} states
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-fee-${employer.id}`}>{employer.feePercentage || "15.00"}%</TableCell>
                    <TableCell data-testid={`text-partner-${employer.id}`}>
                      {employer.referralPartnerId ? (
                        <Badge variant="outline" className="no-default-active-elevate">
                          <Handshake className="h-3 w-3 mr-1" />
                          {referralPartners?.find(p => p.id.toString() === employer.referralPartnerId)?.dba ||
                           referralPartners?.find(p => p.id.toString() === employer.referralPartnerId)?.legalName ||
                           "Partner"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={employer.billingStatus === "active" ? "default" : "secondary"}>
                          {employer.billingStatus?.toUpperCase()}
                        </Badge>
                        {(employer as any).onboardingModuleEnabled && (
                          <Badge variant="outline" className="no-default-active-elevate text-xs">
                            <UserPlus className="h-3 w-3 mr-1" />
                            Onboarding
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => resendWelcomeEmailMutation.mutate(employer.id)}
                          disabled={resendWelcomeEmailMutation.isPending}
                          title="Resend welcome email"
                          data-testid={`button-resend-email-${employer.id}`}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/admin/employers/${employer.id}/settings`)}
                          title="Employer settings"
                          data-testid={`button-settings-${employer.id}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchTerm ? "No employers found" : "No employers yet. Add your first employer to get started."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending ETA Form 9198 Signatures</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employer Name</TableHead>
                    <TableHead>EIN</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Sent Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingForms.length > 0 ? (
                    pendingForms.map((form) => (
                      <TableRow key={form.id} data-testid={`row-eta-form-${form.id}`}>
                        <TableCell className="font-medium">{form.employerName}</TableCell>
                        <TableCell className="font-mono text-sm">{form.ein ? `***-***${form.ein.slice(-4)}` : ""}</TableCell>
                        <TableCell>{form.contactEmail}</TableCell>
                        <TableCell>
                          {form.signatureRequestSentAt
                            ? new Date(form.signatureRequestSentAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedFormId(form.id);
                              setSignedByName(form.contactName);
                              setSignedByEmail(form.contactEmail);
                              setSignatureDialogOpen(true);
                            }}
                            data-testid={`button-complete-signature-${form.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete Signature
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No pending forms awaiting signature.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Signature & Activate Employer</DialogTitle>
            <DialogDescription>
              This will create the employer account and activate their WOTC screening portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Signed By Name</label>
              <Input
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="John Doe"
                data-testid="input-signed-by-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Signed By Email</label>
              <Input
                type="email"
                value={signedByEmail}
                onChange={(e) => setSignedByEmail(e.target.value)}
                placeholder="john@example.com"
                data-testid="input-signed-by-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSignatureDialogOpen(false)}
              data-testid="button-cancel-signature"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedFormId) {
                  completeSignatureMutation.mutate({
                    formId: selectedFormId,
                    signedByName,
                    signedByEmail,
                  });
                }
              }}
              disabled={!signedByName || !signedByEmail || completeSignatureMutation.isPending}
              data-testid="button-confirm-signature"
            >
              {completeSignatureMutation.isPending ? "Processing..." : "Complete & Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
