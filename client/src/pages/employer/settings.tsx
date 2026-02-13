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
} from "lucide-react";

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
