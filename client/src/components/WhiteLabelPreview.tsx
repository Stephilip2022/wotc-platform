import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Monitor, 
  Smartphone, 
  Tablet,
  Sun,
  Moon,
  X
} from "lucide-react";

interface WhiteLabelConfig {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  customDomain?: string;
}

interface WhiteLabelPreviewProps {
  config: WhiteLabelConfig;
  onClose?: () => void;
}

export default function WhiteLabelPreview({ config, onClose }: WhiteLabelPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [darkMode, setDarkMode] = useState(false);

  const getDeviceWidth = () => {
    switch (device) {
      case "mobile": return "w-[375px]";
      case "tablet": return "w-[768px]";
      default: return "w-full max-w-4xl";
    }
  };

  const bgColor = darkMode ? "#1a1a2e" : "#ffffff";
  const textColor = darkMode ? "#ffffff" : "#1a1a2e";
  const mutedColor = darkMode ? "#a0a0a0" : "#666666";
  const cardBg = darkMode ? "#252545" : "#f8f9fa";

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      data-testid="whitelabel-preview-modal"
    >
      <div className="bg-background rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">White-Label Preview</h2>
            <Badge variant="outline">{config.name}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice("desktop")}
                data-testid="button-device-desktop"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "tablet" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice("tablet")}
                data-testid="button-device-tablet"
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDevice("mobile")}
                data-testid="button-device-mobile"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
              data-testid="button-toggle-dark-mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-preview">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-muted/50 flex justify-center">
          <div 
            className={`${getDeviceWidth()} rounded-lg shadow-2xl overflow-hidden transition-all duration-300`}
            style={{ backgroundColor: bgColor }}
          >
            <header 
              className="p-4 flex items-center justify-between"
              style={{ backgroundColor: config.primaryColor }}
            >
              <div className="flex items-center gap-3">
                {config.logoUrl ? (
                  <img 
                    src={config.logoUrl} 
                    alt="Logo" 
                    className="h-8 w-auto"
                    data-testid="preview-logo"
                  />
                ) : (
                  <div 
                    className="h-8 w-8 rounded flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: config.secondaryColor }}
                  >
                    {config.name.charAt(0)}
                  </div>
                )}
                <span className="text-white font-semibold" data-testid="preview-company-name">
                  {config.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  className="text-sm px-3 py-1 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}
                >
                  {config.customDomain || "wotc-platform.com"}
                </span>
              </div>
            </header>

            <nav 
              className="px-4 py-2 flex gap-4 text-sm border-b"
              style={{ 
                backgroundColor: config.primaryColor, 
                opacity: 0.9,
                borderColor: "rgba(255,255,255,0.1)"
              }}
            >
              {["Dashboard", "Employees", "Screenings", "Credits"].map((item) => (
                <span 
                  key={item} 
                  className="text-white/80 hover:text-white cursor-pointer transition-colors"
                >
                  {item}
                </span>
              ))}
            </nav>

            <main className="p-6 space-y-6" style={{ color: textColor }}>
              <div>
                <h1 className="text-2xl font-bold">Welcome back!</h1>
                <p style={{ color: mutedColor }}>
                  Manage your WOTC screenings and tax credits
                </p>
              </div>

              <div className={`grid gap-4 ${device === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
                {[
                  { label: "Active Employees", value: "156" },
                  { label: "Pending Screenings", value: "23" },
                  { label: "Credits This Year", value: "$48,500" }
                ].map((stat) => (
                  <div 
                    key={stat.label}
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: cardBg }}
                  >
                    <p className="text-sm" style={{ color: mutedColor }}>{stat.label}</p>
                    <p 
                      className="text-2xl font-bold"
                      style={{ color: config.primaryColor }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div 
                className="rounded-lg p-4"
                style={{ backgroundColor: cardBg }}
              >
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {[
                    { action: "New screening submitted", time: "2 hours ago" },
                    { action: "Employee certified for WOTC", time: "5 hours ago" },
                    { action: "Credit calculation completed", time: "1 day ago" }
                  ].map((item, i) => (
                    <div 
                      key={i}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                      style={{ borderColor: darkMode ? "#333" : "#eee" }}
                    >
                      <span>{item.action}</span>
                      <span className="text-sm" style={{ color: mutedColor }}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  Add Employee
                </button>
                <button
                  className="px-4 py-2 rounded-lg font-medium border"
                  style={{ 
                    borderColor: config.primaryColor, 
                    color: config.primaryColor,
                    backgroundColor: "transparent"
                  }}
                >
                  View Reports
                </button>
              </div>
            </main>

            <footer 
              className="p-4 text-center text-sm border-t"
              style={{ 
                color: mutedColor,
                borderColor: darkMode ? "#333" : "#eee"
              }}
            >
              Powered by WOTC Platform
            </footer>
          </div>
        </div>

        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Primary:</span>
                <div 
                  className="h-6 w-6 rounded border"
                  style={{ backgroundColor: config.primaryColor }}
                />
                <code className="text-xs">{config.primaryColor}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Secondary:</span>
                <div 
                  className="h-6 w-6 rounded border"
                  style={{ backgroundColor: config.secondaryColor }}
                />
                <code className="text-xs">{config.secondaryColor}</code>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Preview how your branded portal will appear to users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
