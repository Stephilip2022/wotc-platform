import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  DollarSign, 
  Settings,
  Building2,
  ClipboardCheck,
  FolderOpen,
  Download,
  CheckSquare,
  Clock,
  KeyRound,
  Code,
  Webhook,
  Book,
  Activity,
  TrendingUp,
  Link2,
  Palette,
  Bot,
  BarChart3,
  Shield,
  ScanLine,
  Layers,
  Calculator,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface AppSidebarProps {
  role: "admin" | "employer" | "employee";
}

export function AppSidebar({ role }: AppSidebarProps) {
  const [location] = useLocation();

  const adminItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: "Revenue", url: "/admin/revenue", icon: DollarSign },
    { title: "Employers", url: "/admin/employers", icon: Building2 },
    { title: "Screenings", url: "/admin/screenings", icon: CheckSquare },
    { title: "Questionnaires", url: "/admin/questionnaires", icon: ClipboardCheck },
    { title: "White-Label", url: "/admin/licensees", icon: Palette },
    { title: "Submissions", url: "/admin/submissions", icon: Bot },
    { title: "Audit Logs", url: "/admin/audit", icon: Shield },
    { title: "Document OCR", url: "/admin/document-ocr", icon: ScanLine },
    { title: "Pricing", url: "/admin/pricing", icon: Calculator },
    { title: "Tax Programs", url: "/admin/tax-programs", icon: Layers },
    { title: "CSV Export", url: "/admin/export", icon: Download },
    { title: "State Automation", url: "/admin/automation", icon: Settings },
    { title: "State Credentials", url: "/admin/state-credentials", icon: KeyRound },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  const employerItems = [
    { title: "Dashboard", url: "/employer", icon: LayoutDashboard },
    { title: "Employees", url: "/employer/employees", icon: Users },
    { title: "Screenings", url: "/employer/screenings", icon: ClipboardCheck },
    { title: "Hours", url: "/employer/hours", icon: Clock },
    { title: "Retention", url: "/employer/retention", icon: TrendingUp },
    { title: "Multi-Credit", url: "/employer/multi-credit", icon: Layers },
    { title: "Integrations", url: "/employer/integrations", icon: Link2 },
    { title: "Documents", url: "/employer/documents", icon: FolderOpen },
    { title: "Credits", url: "/employer/credits", icon: DollarSign },
    { title: "Billing", url: "/employer/billing", icon: DollarSign },
    { title: "Settings", url: "/employer/settings", icon: Settings },
  ];

  const developerItems = [
    { title: "API Keys", url: "/employer/api-keys", icon: KeyRound },
    { title: "Webhooks", url: "/employer/webhooks", icon: Webhook },
    { title: "API Docs", url: "/employer/api-docs", icon: Book },
    { title: "API Usage", url: "/employer/api-usage", icon: Activity },
  ];

  const items = role === "admin" ? adminItems : employerItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <h2 className="text-xl font-bold">WOTC Platform</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {role === "employer" && (
          <SidebarGroup>
            <SidebarGroupLabel>Developer</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {developerItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">
          {role === "admin" ? "Admin Portal" : "Employer Portal"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
