import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Building2, FileText, Send, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Form validation schema based on shared/schema.ts
const etaForm9198Schema = z.object({
  // Employer Information
  employerName: z.string().min(2, "Employer name is required"),
  tradeName: z.string().optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/, "EIN must be in format XX-XXXXXXX"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "State must be 2-letter code"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  contactName: z.string().min(2, "Contact name is required"),
  contactTitle: z.string().optional(),
  contactPhone: z.string().min(7, "Phone number must be at least 7 digits").regex(/^[\d\s\-\(\)\.]+$/, "Phone number can only contain digits, spaces, dashes, dots, and parentheses"),
  contactEmail: z.string().email("Valid email is required"),
  
  // Business Details
  businessType: z.enum(["corporation", "partnership", "sole_proprietor", "llc", "other"]).optional(),
  naicsCode: z.string().optional(),
  numberOfEmployees: z.preprocess(
    (val) => val === "" || val === null || val === undefined ? undefined : val,
    z.coerce.number().int().positive().optional()
  ),
  averageHiresPerMonth: z.preprocess(
    (val) => val === "" || val === null || val === undefined ? undefined : val,
    z.coerce.number().int().positive().optional()
  ),
});

type EtaForm9198Data = z.infer<typeof etaForm9198Schema>;

export default function EtaForm9198Page() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saveAsDraft, setSaveAsDraft] = useState(false);

  const form = useForm<EtaForm9198Data>({
    resolver: zodResolver(etaForm9198Schema),
    defaultValues: {
      employerName: "",
      tradeName: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      contactName: "",
      contactTitle: "",
      contactPhone: "",
      contactEmail: "",
      numberOfEmployees: undefined,
      averageHiresPerMonth: undefined,
    },
  });

  // Create ETA Form 9198
  const createMutation = useMutation({
    mutationFn: async (data: EtaForm9198Data & { status: string }) => {
      const response = await apiRequest("POST", "/api/admin/eta-forms", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/eta-forms"] });
      
      if (data.status === "draft") {
        toast({
          title: "Draft Saved",
          description: "Form saved as draft successfully.",
        });
      } else {
        toast({
          title: "Form Sent!",
          description: `E-signature request sent to ${data.contactEmail}`,
        });
      }
      
      setLocation("/admin/employers");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create form",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EtaForm9198Data) => {
    createMutation.mutate({
      ...data,
      status: saveAsDraft ? "draft" : "sent",
    });
  };

  const handleSaveDraft = () => {
    setSaveAsDraft(true);
    form.handleSubmit(onSubmit)();
  };

  const handleSendForSignature = () => {
    setSaveAsDraft(false);
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            ETA Form 9198
          </h1>
          <p className="text-muted-foreground mt-1">
            Pre-Screening Notice and Certification Request for the Work Opportunity Credit
          </p>
        </div>
        <Badge variant="secondary">New Employer Intake</Badge>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          {/* Employer Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Employer Information
              </CardTitle>
              <CardDescription>
                Basic business details for the new employer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corporation" {...field} data-testid="input-employer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tradeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade Name / DBA</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme" {...field} data-testid="input-trade-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="ein"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employer Identification Number (EIN) *</FormLabel>
                    <FormControl>
                      <Input placeholder="12-3456789" {...field} data-testid="input-ein" />
                    </FormControl>
                    <FormDescription>Format: XX-XXXXXXX</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} data-testid="input-city" />
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
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" maxLength={2} {...field} data-testid="input-state" />
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
                      <FormLabel>ZIP Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} data-testid="input-zip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Section */}
          <Card>
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
              <CardDescription>
                Person responsible for WOTC program management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="HR Director" {...field} data-testid="input-contact-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} data-testid="input-contact-phone" />
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
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@acme.com" {...field} data-testid="input-contact-email" />
                      </FormControl>
                      <FormDescription>E-signature request will be sent here</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>
                Optional information for program optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-business-type">
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corporation">Corporation</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                          <SelectItem value="llc">LLC</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="naicsCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NAICS Code</FormLabel>
                      <FormControl>
                        <Input placeholder="722511" {...field} data-testid="input-naics" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numberOfEmployees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Employees</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50" {...field} data-testid="input-num-employees" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="averageHiresPerMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average Hires Per Month</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10" {...field} data-testid="input-avg-hires" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/admin/employers")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={createMutation.isPending}
                data-testid="button-save-draft"
              >
                {createMutation.isPending && saveAsDraft ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save as Draft
              </Button>

              <Button
                type="button"
                onClick={handleSendForSignature}
                disabled={createMutation.isPending}
                data-testid="button-send-signature"
              >
                {createMutation.isPending && !saveAsDraft ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send for E-Signature
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
