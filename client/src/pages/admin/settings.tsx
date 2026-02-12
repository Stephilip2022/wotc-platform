import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Building2,
  Bell,
  Shield,
  Database,
  Globe,
  Mail,
  Save,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoScreening, setAutoScreening] = useState(true);
  const [complianceAlerts, setComplianceAlerts] = useState(true);
  const [credentialRotationReminders, setCredentialRotationReminders] = useState(true);

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your admin settings have been updated successfully.",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-admin-settings">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage platform configuration and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList data-testid="tabs-settings">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Platform Information
              </CardTitle>
              <CardDescription>Basic platform settings and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input defaultValue="Rockerbox" data-testid="input-platform-name" />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input defaultValue="support@rockerbox.app" data-testid="input-support-email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admin Account</Label>
                <div className="flex items-center gap-3">
                  <Input value={user?.primaryEmailAddress?.emailAddress || ""} disabled data-testid="input-admin-email" />
                  <Badge>Admin</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Processing Defaults
              </CardTitle>
              <CardDescription>Default settings for WOTC processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Screening</Label>
                  <p className="text-sm text-muted-foreground">Automatically process new screenings when submitted</p>
                </div>
                <Switch checked={autoScreening} onCheckedChange={setAutoScreening} data-testid="switch-auto-screening" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Compliance Alerts</Label>
                  <p className="text-sm text-muted-foreground">Generate alerts for compliance deadlines and issues</p>
                </div>
                <Switch checked={complianceAlerts} onCheckedChange={setComplianceAlerts} data-testid="switch-compliance-alerts" />
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
              <CardDescription>Configure how you receive platform notifications</CardDescription>
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
                  <Label>Credential Rotation Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get notified when state portal credentials need rotation</p>
                </div>
                <Switch checked={credentialRotationReminders} onCheckedChange={setCredentialRotationReminders} data-testid="switch-rotation-reminders" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Configuration
              </CardTitle>
              <CardDescription>Email sending settings for the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input defaultValue="Rockerbox WOTC" data-testid="input-from-name" />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input defaultValue="noreply@rockerbox.app" data-testid="input-from-email" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription>Platform security and access configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input type="number" defaultValue="60" data-testid="input-session-timeout" />
                <p className="text-xs text-muted-foreground">Inactive sessions will be terminated after this period</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>Database and data retention settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Audit Log Retention (days)</Label>
                <Input type="number" defaultValue="365" data-testid="input-audit-retention" />
              </div>
              <div className="space-y-2">
                <Label>Screening Data Retention (years)</Label>
                <Input type="number" defaultValue="7" data-testid="input-screening-retention" />
                <p className="text-xs text-muted-foreground">IRS requires WOTC records to be retained for at least 4 years</p>
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
