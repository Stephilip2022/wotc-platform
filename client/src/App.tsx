import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import EmployeeQuestionnaire from "@/pages/employee/questionnaire";
import EmployerDashboard from "@/pages/employer/dashboard";
import EmployeesPage from "@/pages/employer/employees";
import ScreeningsPage from "@/pages/employer/screenings";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminEmployersPage from "@/pages/admin/employers";
import { Loader2 } from "lucide-react";

function EmployeeRouter() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">WOTC Screening</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild data-testid="button-logout">
              <a href="/api/logout">Logout</a>
            </Button>
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
              <Button variant="ghost" size="sm" asChild data-testid="button-logout">
                <a href="/api/logout">Logout</a>
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-8">
            <Switch>
              {role === "admin" ? (
                <>
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/employers" component={AdminEmployersPage} />
                  <Route component={NotFound} />
                </>
              ) : (
                <>
                  <Route path="/employer" component={EmployerDashboard} />
                  <Route path="/employer/employees" component={EmployeesPage} />
                  <Route path="/employer/screenings" component={ScreeningsPage} />
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md mx-auto p-8">
          <h1 className="text-4xl font-bold">WOTC Optimization Platform</h1>
          <p className="text-muted-foreground text-lg">
            Streamline your Work Opportunity Tax Credit screening and maximize your tax savings
          </p>
          <Button size="lg" asChild data-testid="button-login">
            <a href="/api/login">Log In to Continue</a>
          </Button>
        </div>
      </div>
    );
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
