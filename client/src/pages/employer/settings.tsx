import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Bell,
  Users,
  Mail,
  Save,
  Globe,
  HelpCircle,
  Brain,
  Languages,
  FileSearch,
  Bot,
  Layers,
  Shield,
  Workflow,
  Upload,
  LineChart,
  Award,
  PieChart,
  MessageSquare,
  Phone,
  ChevronDown,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function EmployerSettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [screeningReminders, setScreeningReminders] = useState(true);
  const [creditAlerts, setCreditAlerts] = useState(true);

  const { data: employer } = useQuery<any>({
    queryKey: ["/api/employer/profile"],
  });

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your employer settings have been updated successfully.",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-employer-settings">Employer Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your company profile and preferences
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList data-testid="tabs-employer-settings">
          <TabsTrigger value="company" data-testid="tab-company">Company</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="screening" data-testid="tab-screening">Screening</TabsTrigger>
          <TabsTrigger value="help" data-testid="tab-help">Help & Support</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Information
              </CardTitle>
              <CardDescription>Your company profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue={employer?.name || ""} data-testid="input-company-name" />
                </div>
                <div className="space-y-2">
                  <Label>EIN</Label>
                  <Input defaultValue={employer?.ein ? `***-***${employer.ein.slice(-4)}` : ""} disabled data-testid="input-ein" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input defaultValue={employer?.contactEmail || ""} data-testid="input-contact-email" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input defaultValue={employer?.contactPhone || ""} data-testid="input-contact-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Owner</Label>
                <div className="flex items-center gap-3">
                  <Input value={user?.primaryEmailAddress?.emailAddress || ""} disabled data-testid="input-owner-email" />
                  <Badge>Owner</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email alerts for important events</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} data-testid="switch-email-notifications" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Screening Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminded about incomplete employee screenings</p>
                </div>
                <Switch checked={screeningReminders} onCheckedChange={setScreeningReminders} data-testid="switch-screening-reminders" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Credit Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notifications when credits are certified or milestones reached</p>
                </div>
                <Switch checked={creditAlerts} onCheckedChange={setCreditAlerts} data-testid="switch-credit-alerts" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screening" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Screening Configuration
              </CardTitle>
              <CardDescription>Customize the screening experience for your employees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Screening Language</Label>
                <Input defaultValue="English" data-testid="input-default-language" />
                <p className="text-xs text-muted-foreground">Employees can change to any of the 9 supported languages</p>
              </div>
              <div className="space-y-2">
                <Label>Questionnaire URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={employer?.questionnaireUrl || "Not configured"} disabled data-testid="input-questionnaire-url" />
                  <Button variant="outline" size="sm" data-testid="button-copy-url" onClick={() => {
                    if (employer?.questionnaireUrl) {
                      navigator.clipboard.writeText(employer.questionnaireUrl);
                      toast({ title: "Copied", description: "Questionnaire URL copied to clipboard" });
                    }
                  }}>
                    Copy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Management
              </CardTitle>
              <CardDescription>Manage access for your team members</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Team management features are coming soon. Contact support to add additional users to your account.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Platform Features & Capabilities
              </CardTitle>
              <CardDescription>Everything your Rockerbox platform can do for you</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="screening" data-testid="accordion-screening">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      AI-Powered WOTC Screening
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Our intelligent screening system automatically identifies employees who qualify for WOTC and related tax credits.</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Gamified, mobile-friendly questionnaire that employees complete in under 5 minutes</li>
                        <li>AI reading-level adjustment simplifies complex questions for higher completion rates</li>
                        <li>Eligibility prediction with confidence scoring before submission</li>
                        <li>Conditional logic skips irrelevant questions based on prior answers</li>
                        <li>Progress auto-saves so employees can resume anytime</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="languages" data-testid="accordion-languages">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-primary" />
                      9-Language Multilingual Support
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Reach your entire workforce with questionnaires available in 9 languages:</p>
                      <p className="font-medium text-foreground">English, Spanish, French, Chinese, Vietnamese, Korean, Portuguese, German, and Japanese</p>
                      <p>Employees can switch languages at any time during screening. All instructions, questions, and confirmations are fully translated.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="state-credits" data-testid="accordion-state-credits">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      85 State Credit Programs
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Beyond federal WOTC, Rockerbox manages 85 state-specific credit and incentive programs across 39 states.</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Programs include veteran credits, enterprise zone incentives, apprenticeship credits, historic rehabilitation, and more</li>
                        <li>Smart recommendations match programs to your business based on location and hiring patterns</li>
                        <li>Multi-credit bundling stacks WOTC with state programs for maximum savings</li>
                        <li>Downloadable credits matrix with program details, agencies, and capture strategies</li>
                        <li>Your admin can assign and manage which programs apply to your company</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="document-ocr" data-testid="accordion-document-ocr">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-primary" />
                      Document OCR & AI Extraction
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>AI-powered document scanning automatically extracts key data from uploaded files:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>DD-214 military discharge forms for veteran credit verification</li>
                        <li>TANF/SNAP benefit letters for public assistance target groups</li>
                        <li>State determination letters for certification status updates</li>
                        <li>IRS correspondence and approval documents</li>
                        <li>Automatic document reminders sent via SMS at 3, 5, and 7 days after screening</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="ai-chat" data-testid="accordion-ai-chat">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      AI Chat Assistant
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Your built-in AI assistant is available from any page in the platform. It can help you:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Answer WOTC eligibility and compliance questions</li>
                        <li>Navigate platform features and settings</li>
                        <li>Understand credit calculations and projections</li>
                        <li>Troubleshoot screening or submission issues</li>
                      </ul>
                      <p>Look for the chat icon in the bottom-right corner of any page.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="analytics" data-testid="accordion-analytics">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <LineChart className="h-4 w-4 text-primary" />
                      Analytics, Forecasting & Reports
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Comprehensive analytics help you understand and maximize your tax credit potential:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Real-time dashboard with screening rates, credit totals, and certification status</li>
                        <li>Predictive credit forecasting based on your historical hiring data</li>
                        <li>400-hour milestone tracking for maximizing per-employee credits</li>
                        <li>AI turnover prediction to identify at-risk employees before the retention threshold</li>
                        <li>Downloadable PDF reports: credit summary, ROI analysis, and compliance reports</li>
                        <li>CSV exports for all data tables</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="automation" data-testid="accordion-automation">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-primary" />
                      Zero-Touch Processing & State Automation
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>The platform automates the entire journey from screening to certified credits:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Automatic submission readiness detection when all required data is collected</li>
                        <li>56 state portal bots handle submissions, MFA, and status checking</li>
                        <li>OCR parsing of determination letters updates certification status automatically</li>
                        <li>Intelligent queue management with retry logic for failed submissions</li>
                        <li>CSDC/SFTP integration for bulk state submissions (AL, AR, CO, GA, ID, OK, OR, SC, VT, WV)</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="form9198" data-testid="accordion-form9198">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      ETA Form 9198 & Engagement Letters
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Digital authorization and engagement letter management:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Online ETA Form 9198 with digital signature capture</li>
                        <li>Engagement letter agreement with fee schedule details</li>
                        <li>Both forms accessible from your welcome email setup link</li>
                        <li>Signed copies stored securely and available in your documents section</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="imports" data-testid="accordion-imports">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Bulk Import & Payroll Integration
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Import employee and payroll data efficiently:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>CSV upload with intelligent column detection and mapping</li>
                        <li>Reusable mapping templates for recurring imports</li>
                        <li>Employee matching prevents duplicate records</li>
                        <li>Bidirectional sync with ADP, Gusto, QuickBooks, and other payroll providers</li>
                        <li>Automatic hours and wage data collection from connected payroll systems</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="multi-credit" data-testid="accordion-multi-credit">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-primary" />
                      Multi-Credit Bundling
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Maximize your tax savings by stacking multiple credit programs:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Federal WOTC combined with state-specific tax credits</li>
                        <li>Enterprise zone and empowerment zone credits for qualifying locations</li>
                        <li>Veteran, disability, re-entry, and youth training credit overlays</li>
                        <li>Automated eligibility cross-referencing across all assigned programs</li>
                        <li>Consolidated reporting shows total credit value across all programs</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="security" data-testid="accordion-security">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Security & Compliance
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Enterprise-grade security protects your data:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>PII encryption for all sensitive employee data</li>
                        <li>Role-based access control limits data visibility by user type</li>
                        <li>Complete audit trails track every action and change</li>
                        <li>Secure token-based employer onboarding with expiring links</li>
                        <li>Automated compliance scans with violation detection and remediation</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Contact Support
              </CardTitle>
              <CardDescription>Need help? Reach out to our team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-md border">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Email Support</p>
                    <p className="text-sm text-muted-foreground">support@rockerbox.app</p>
                    <p className="text-xs text-muted-foreground mt-1">Response within 24 hours</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-md border">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Phone Support</p>
                    <p className="text-sm text-muted-foreground">Available Mon-Fri, 9am-5pm ET</p>
                    <p className="text-xs text-muted-foreground mt-1">Contact your account manager</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-md border">
                <Bot className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">AI Chat Assistant</p>
                  <p className="text-sm text-muted-foreground">Get instant answers to common questions by clicking the chat icon in the bottom-right corner of any page.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-settings">
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
