import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  Settings,
  Users,
  FileText,
  CreditCard,
  Shield,
  Sparkles,
} from "lucide-react";

const ONBOARDING_STEPS = [
  { id: "company", title: "Company Info", icon: Building2, description: "Basic company details" },
  { id: "branding", title: "Branding", icon: Sparkles, description: "Logo and colors" },
  { id: "payroll", title: "Payroll", icon: CreditCard, description: "Connect payroll system" },
  { id: "questionnaire", title: "Questionnaire", icon: FileText, description: "Configure screening" },
  { id: "users", title: "Team", icon: Users, description: "Invite team members" },
  { id: "review", title: "Review", icon: Shield, description: "Finalize setup" },
];

export default function OnboardingWizardPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    companyName: "",
    ein: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    logoUrl: "",
    primaryColor: "#2563eb",
    welcomeMessage: "",
    payrollProvider: "",
    payrollConnected: false,
    questionnaireEnabled: true,
    teamEmails: "",
  });

  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/employer/onboarding", formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Setup Complete",
        description: "Your account has been configured successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to complete setup",
        variant: "destructive",
      });
    },
  });

  const renderStepContent = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case "company":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Acme Corporation"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein">EIN (Tax ID)</Label>
                <Input
                  id="ein"
                  value={formData.ein}
                  onChange={(e) => updateField("ein", e.target.value)}
                  placeholder="XX-XXXXXXX"
                  data-testid="input-ein"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateField("contactEmail", e.target.value)}
                  placeholder="hr@company.com"
                  data-testid="input-contact-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => updateField("contactPhone", e.target.value)}
                  placeholder="(555) 123-4567"
                  data-testid="input-contact-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="123 Main Street"
                data-testid="input-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="New York"
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={formData.state} onValueChange={(v) => updateField("state", v)}>
                  <SelectTrigger data-testid="select-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AL">Alabama</SelectItem>
                    <SelectItem value="AK">Alaska</SelectItem>
                    <SelectItem value="AZ">Arizona</SelectItem>
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="CO">Colorado</SelectItem>
                    <SelectItem value="CT">Connecticut</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                    <SelectItem value="GA">Georgia</SelectItem>
                    <SelectItem value="IL">Illinois</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="WA">Washington</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateField("zipCode", e.target.value)}
                  placeholder="10001"
                  data-testid="input-zip"
                />
              </div>
            </div>
          </div>
        );

      case "branding":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop your logo here, or click to browse
                </p>
                <Button variant="outline" size="sm" data-testid="button-upload-logo">
                  Upload Logo
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Brand Color</Label>
              <div className="flex gap-4 items-center">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-16 h-10 p-1"
                  data-testid="input-primary-color"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => updateField("primaryColor", e.target.value)}
                  className="w-32"
                  placeholder="#2563eb"
                />
                <div 
                  className="w-32 h-10 rounded-md" 
                  style={{ backgroundColor: formData.primaryColor }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={formData.welcomeMessage}
                onChange={(e) => updateField("welcomeMessage", e.target.value)}
                placeholder="Welcome to our WOTC screening process. Please complete the questionnaire to help us determine your eligibility for tax credits."
                rows={3}
                data-testid="textarea-welcome"
              />
            </div>
          </div>
        );

      case "payroll":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Payroll Provider</Label>
              <Select value={formData.payrollProvider} onValueChange={(v) => updateField("payrollProvider", v)}>
                <SelectTrigger data-testid="select-payroll-provider">
                  <SelectValue placeholder="Select your payroll provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adp">ADP</SelectItem>
                  <SelectItem value="paychex">Paychex</SelectItem>
                  <SelectItem value="gusto">Gusto</SelectItem>
                  <SelectItem value="quickbooks">QuickBooks Payroll</SelectItem>
                  <SelectItem value="paycor">Paycor</SelectItem>
                  <SelectItem value="manual">Manual Entry / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.payrollProvider && formData.payrollProvider !== "manual" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Connect to {formData.payrollProvider.toUpperCase()}</CardTitle>
                  <CardDescription>
                    Securely connect your payroll system for automatic hours tracking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Connection Status</p>
                      <p className="text-sm text-muted-foreground">
                        {formData.payrollConnected ? "Connected and syncing" : "Not connected"}
                      </p>
                    </div>
                    <Badge variant={formData.payrollConnected ? "default" : "secondary"}>
                      {formData.payrollConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <Button 
                    variant={formData.payrollConnected ? "outline" : "default"}
                    className="w-full"
                    onClick={() => updateField("payrollConnected", !formData.payrollConnected)}
                    data-testid="button-connect-payroll"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    {formData.payrollConnected ? "Disconnect" : "Connect Payroll"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {formData.payrollProvider === "manual" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Manual Entry</CardTitle>
                  <CardDescription>
                    You'll need to upload hours data via CSV or enter it manually
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Don't worry! You can always connect a payroll provider later from your settings.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "questionnaire":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Employee Screening</Label>
                <p className="text-sm text-muted-foreground">
                  Allow employees to complete WOTC eligibility questionnaires
                </p>
              </div>
              <Switch
                checked={formData.questionnaireEnabled}
                onCheckedChange={(v) => updateField("questionnaireEnabled", v)}
                data-testid="switch-questionnaire"
              />
            </div>

            {formData.questionnaireEnabled && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Questionnaire Distribution</CardTitle>
                    <CardDescription>
                      Multiple ways to distribute the screening questionnaire
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                      <LinkIcon className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">Direct Link</p>
                        <p className="text-sm text-muted-foreground">
                          yourcompany.wotcplatform.com/screen
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Copy</Button>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">QR Code</p>
                        <p className="text-sm text-muted-foreground">
                          Printable QR code for onboarding materials
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Download</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Assistance</CardTitle>
                    <CardDescription>
                      Enable AI-powered question simplification for employees
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Smart Question Assistance</p>
                        <p className="text-sm text-muted-foreground">
                          AI helps employees understand complex questions
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-assistance" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teamEmails">Invite Team Members</Label>
              <Textarea
                id="teamEmails"
                value={formData.teamEmails}
                onChange={(e) => updateField("teamEmails", e.target.value)}
                placeholder="Enter email addresses, one per line:&#10;john@company.com&#10;jane@company.com"
                rows={5}
                data-testid="textarea-team-emails"
              />
              <p className="text-sm text-muted-foreground">
                Team members will receive an invitation to join your WOTC platform
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Default Permissions</CardTitle>
                <CardDescription>
                  Configure what team members can do by default
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">View screenings</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Manage employees</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">View credits & analytics</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Manage billing</span>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Setup Summary</CardTitle>
                <CardDescription>Review your configuration before completing setup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{formData.companyName || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">EIN</p>
                    <p className="font-medium">{formData.ein || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Email</p>
                    <p className="font-medium">{formData.contactEmail || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payroll Provider</p>
                    <p className="font-medium">
                      {formData.payrollProvider ? formData.payrollProvider.toUpperCase() : "Not set"}
                      {formData.payrollConnected && " (Connected)"}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Features Enabled</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.questionnaireEnabled && (
                      <Badge variant="secondary">Employee Screening</Badge>
                    )}
                    {formData.payrollConnected && (
                      <Badge variant="secondary">Payroll Integration</Badge>
                    )}
                    <Badge variant="secondary">AI Assistance</Badge>
                    <Badge variant="secondary">Analytics Dashboard</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Ready to Go!</p>
                  <p className="text-sm text-muted-foreground">
                    Click "Complete Setup" to finish configuration and start using the WOTC platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome to WOTC Platform</h1>
        <p className="text-muted-foreground mt-2">
          Let's get your account set up in a few easy steps
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {currentStep + 1} of {ONBOARDING_STEPS.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                isCurrent 
                  ? "border-primary bg-primary/10 text-primary" 
                  : isCompleted 
                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" 
                    : "border-border hover:bg-muted"
              }`}
              data-testid={`step-${step.id}`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isCurrent ? (
                <StepIcon className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">{step.title}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ONBOARDING_STEPS[currentStep].title}</CardTitle>
          <CardDescription>{ONBOARDING_STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
          data-testid="button-prev-step"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        {currentStep === ONBOARDING_STEPS.length - 1 ? (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-complete-setup"
          >
            {saveMutation.isPending ? "Saving..." : "Complete Setup"}
            <CheckCircle2 className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={nextStep} data-testid="button-next-step">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
