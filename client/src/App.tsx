import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useAuth } from "@/hooks/useAuth";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { registerServiceWorker } from "@/utils/registerSW";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import EmployeeQuestionnaire from "@/pages/employee/questionnaire";
import EmployerDashboard from "@/pages/employer/dashboard";
import EmployeesPage from "@/pages/employer/employees";
import EmployeeDetailPage from "@/pages/employer/employee-detail";
import ScreeningsPage from "@/pages/employer/screenings";
import EmployerHoursPage from "@/pages/employer/hours";
import RetentionPage from "@/pages/employer/retention";
import BillingPage from "@/pages/employer/billing";
import InvoiceDetailPage from "@/pages/employer/invoice-detail";
import EmployerCreditsPage from "@/pages/employer/credits";
import ApiKeysPage from "@/pages/employer/api-keys";
import WebhooksPage from "@/pages/employer/webhooks";
import ApiDocsPage from "@/pages/employer/api-docs";
import ApiUsagePage from "@/pages/employer/api-usage";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployersPage from "@/pages/admin/employers";
import AdminScreeningsPage from "@/pages/admin/screenings";
import AdminQuestionnairesPage from "@/pages/admin/questionnaires";
import EtaForm9198Page from "@/pages/admin/eta-form-9198";
import EmployerSettingsPage from "@/pages/admin/employer-settings";
import WOTCExportPage from "@/pages/admin/wotc-export";
import RevenuemanagementPage from "@/pages/admin/revenue";
import StateAutomationPage from "@/pages/admin/state-automation";
import StateCredentialsPage from "@/pages/admin/state-credentials";
import SubmissionMonitoringPage from "@/pages/admin/submission-monitoring";
import LicenseesPage from "@/pages/admin/licensees";
import AnalyticsPage from "@/pages/admin/analytics";
import AuditLogsPage from "@/pages/admin/audit-logs";
import IntegrationsPage from "@/pages/employer/integrations";
import DocumentOCRPage from "@/pages/admin/document-ocr";
import PricingConfigPage from "@/pages/admin/pricing-config";
import MultiCreditPage from "@/pages/employer/multi-credit";
import OnboardingWizardPage from "@/pages/employer/onboarding-wizard";
import BulkImportPage from "@/pages/employer/bulk-import";
import { Loader2 } from "lucide-react";

function EmployeeRouter() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">WOTC Screening</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" data-testid="button-user-menu" />
          </div>
        </div>
      </header>
      <Switch>
        <Route path="/employee/questionnaire" component={EmployeeQuestionnaire} />
        <Route path="/employee" component={EmployeeQuestionnaire} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function PortalRouter({ role }: { role: "admin" | "employer" }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={role} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-card">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserButton afterSignOutUrl="/" data-testid="button-user-menu" />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-8">
            <Switch>
              {role === "admin" ? (
                <>
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/revenue" component={RevenuemanagementPage} />
                  <Route path="/admin/employers" component={AdminEmployersPage} />
                  <Route path="/admin/employers/new" component={EtaForm9198Page} />
                  <Route path="/admin/employers/:id/settings" component={EmployerSettingsPage} />
                  <Route path="/admin/screenings" component={AdminScreeningsPage} />
                  <Route path="/admin/questionnaires" component={AdminQuestionnairesPage} />
                  <Route path="/admin/export" component={WOTCExportPage} />
                  <Route path="/admin/automation" component={StateAutomationPage} />
                  <Route path="/admin/state-credentials" component={StateCredentialsPage} />
                  <Route path="/admin/submissions" component={SubmissionMonitoringPage} />
                  <Route path="/admin/licensees" component={LicenseesPage} />
                  <Route path="/admin/analytics" component={AnalyticsPage} />
                  <Route path="/admin/audit" component={AuditLogsPage} />
                  <Route path="/admin/document-ocr" component={DocumentOCRPage} />
                  <Route path="/admin/pricing" component={PricingConfigPage} />
                  <Route component={NotFound} />
                </>
              ) : (
                <>
                  <Route path="/employer" component={EmployerDashboard} />
                  <Route path="/employer/employees" component={EmployeesPage} />
                  <Route path="/employer/employees/:id" component={EmployeeDetailPage} />
                  <Route path="/employer/screenings" component={ScreeningsPage} />
                  <Route path="/employer/hours" component={EmployerHoursPage} />
                  <Route path="/employer/retention" component={RetentionPage} />
                  <Route path="/employer/integrations" component={IntegrationsPage} />
                  <Route path="/employer/credits" component={EmployerCreditsPage} />
                  <Route path="/employer/billing" component={BillingPage} />
                  <Route path="/employer/invoice/:id" component={InvoiceDetailPage} />
                  <Route path="/employer/api-keys" component={ApiKeysPage} />
                  <Route path="/employer/webhooks" component={WebhooksPage} />
                  <Route path="/employer/api-docs" component={ApiDocsPage} />
                  <Route path="/employer/api-usage" component={ApiUsagePage} />
                  <Route path="/employer/multi-credit" component={MultiCreditPage} />
                  <Route path="/employer/onboarding" component={OnboardingWizardPage} />
                  <Route path="/employer/import" component={BulkImportPage} />
                  <Route component={NotFound} />
                </>
              )}
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  if (user?.role === "employee") {
    return <EmployeeRouter />;
  }

  if (user?.role === "admin") {
    return <PortalRouter role="admin" />;
  }

  if (user?.role === "employer") {
    return <PortalRouter role="employer" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome!</h1>
        <p className="text-muted-foreground">Your account is being set up. Please contact support.</p>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PWAInstallPrompt />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
