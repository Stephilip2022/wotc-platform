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
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface AppSidebarProps {
  role: "admin" | "employer" | "employee";
}

export function AppSidebar({ role }: AppSidebarProps) {
  const [location] = useLocation();

  const adminItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Employers", url: "/admin/employers", icon: Building2 },
    { title: "Screenings", url: "/admin/screenings", icon: CheckSquare },
    { title: "Questionnaires", url: "/admin/questionnaires", icon: ClipboardCheck },
    { title: "CSV Export", url: "/admin/export", icon: Download },
    { title: "Analytics", url: "/admin/analytics", icon: FileText },
    { title: "Billing", url: "/admin/billing", icon: DollarSign },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  const employerItems = [
    { title: "Dashboard", url: "/employer", icon: LayoutDashboard },
    { title: "Employees", url: "/employer/employees", icon: Users },
    { title: "Screenings", url: "/employer/screenings", icon: ClipboardCheck },
    { title: "Hours", url: "/employer/hours", icon: Clock },
    { title: "Documents", url: "/employer/documents", icon: FolderOpen },
    { title: "Credits", url: "/employer/credits", icon: DollarSign },
    { title: "Settings", url: "/employer/settings", icon: Settings },
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
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">
          {role === "admin" ? "Admin Portal" : "Employer Portal"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
