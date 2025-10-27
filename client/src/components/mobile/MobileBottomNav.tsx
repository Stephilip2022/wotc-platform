import { Link, useLocation } from "wouter";
import { Home, Users, ClipboardCheck, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  testId: string;
}

const employerNavItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: Home,
    path: "/employer/dashboard",
    testId: "nav-dashboard",
  },
  {
    label: "Employees",
    icon: Users,
    path: "/employer/employees",
    testId: "nav-employees",
  },
  {
    label: "Screenings",
    icon: ClipboardCheck,
    path: "/employer/screenings",
    testId: "nav-screenings",
  },
  {
    label: "Credits",
    icon: DollarSign,
    path: "/employer/credits",
    testId: "nav-credits",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/employer/settings",
    testId: "nav-settings",
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden">
      <div className="flex items-center justify-around h-16">
        {employerNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || location.startsWith(item.path + "/");

          return (
            <Link key={item.path} href={item.path}>
              <div
                data-testid={`button-mobile-${item.testId}`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] transition-colors",
                  "hover-elevate active-elevate-2 rounded-md cursor-pointer",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
