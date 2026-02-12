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
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Settings, FileText, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Employer, EtaForm9198 } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployerSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { z } from "zod";
import { Link } from "wouter";

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

  const { data: employers, isLoading } = useQuery<Employer[]>({
    queryKey: ["/api/admin/employers"],
  });

  const { data: etaForms } = useQuery<EtaForm9198[]>({
    queryKey: ["/api/admin/eta-forms"],
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
    },
  });

  const addEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("POST", "/api/admin/employers", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Employer Added",
        description: "New employer has been added to the system.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers"] });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add employer. Please try again.",
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

  const filteredEmployers = employers?.filter((emp) => {
    const search = searchTerm.toLowerCase();
    return (
      emp.name.toLowerCase().includes(search) ||
      emp.ein.toLowerCase().includes(search) ||
      emp.contactEmail.toLowerCase().includes(search)
    );
  }) || [];

  const pendingForms = etaForms?.filter((form) => form.status === "sent") || [];

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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Employer</DialogTitle>
              <DialogDescription>
                Create a new employer account in the WOTC system.
              </DialogDescription>
            </DialogHeader>
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
                <DialogFooter>
                  <Button type="submit" disabled={addEmployerMutation.isPending} data-testid="button-submit-employer">
                    {addEmployerMutation.isPending ? "Adding..." : "Add Employer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
                <TableHead>Revenue Share</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployers.length > 0 ? (
                filteredEmployers.map((employer) => (
                  <TableRow key={employer.id} data-testid={`row-employer-${employer.id}`}>
                    <TableCell className="font-medium">{employer.name}</TableCell>
                    <TableCell className="font-mono text-sm">{employer.ein}</TableCell>
                    <TableCell>{employer.contactEmail}</TableCell>
                    <TableCell>{employer.revenueSharePercentage}%</TableCell>
                    <TableCell>
                      <Badge variant={employer.billingStatus === "active" ? "default" : "secondary"}>
                        {employer.billingStatus?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/admin/employers/${employer.id}/settings`)}
                        data-testid={`button-settings-${employer.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="font-mono text-sm">{form.ein}</TableCell>
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
