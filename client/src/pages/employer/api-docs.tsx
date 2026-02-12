import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Copy, Check, Book, AlertCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  category: string;
  scopes: string[];
  params?: { name: string; type: string; description: string }[];
  body?: Record<string, string | Record<string, string>[] | string[]>;
  response?: Record<string, unknown>;
}

const API_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/employees",
    description: "Create a new employee",
    category: "Questionnaire Delivery",
    scopes: ["employees:write"],
    params: [],
    body: {
      firstName: "string (required)",
      lastName: "string (required)",
      email: "string (required)",
      phone: "string",
      dateOfBirth: "string (ISO date)",
      ssn: "string",
      address: "string",
      city: "string",
      state: "string",
      zipCode: "string",
      hireDate: "string (ISO date)",
      startDate: "string (ISO date)",
    },
  },
  {
    method: "POST",
    path: "/api/v1/screenings/initiate",
    description: "Initiate WOTC screening for an employee, returns questionnaire URL to embed in ATS/HRIS",
    category: "Questionnaire Delivery",
    scopes: ["screenings:write"],
    params: [],
    body: {
      employeeId: "string (optional, if employee already exists)",
      firstName: "string (required if no employeeId)",
      lastName: "string (required if no employeeId)",
      email: "string (required if no employeeId)",
      phone: "string",
      hireDate: "string (ISO date)",
      callbackUrl: "string (optional, for status updates)",
    },
    response: {
      screeningId: "scr_abc123",
      questionnaireUrl: "https://your-app.replit.app/q/abc123",
      expiresAt: "2026-03-01T00:00:00Z",
    },
  },
  {
    method: "GET",
    path: "/api/v1/screenings/:id/questionnaire-status",
    description: "Track questionnaire lifecycle (accessed, started, completed)",
    category: "Status & Eligibility",
    scopes: ["screenings:read"],
    params: [],
    response: {
      questionnaireStatus: "completed",
      accessedAt: "2026-01-15T10:00:00Z",
      startedAt: "2026-01-15T10:01:00Z",
      completedAt: "2026-01-15T10:15:00Z",
      screeningStatus: "eligible",
    },
  },
  {
    method: "GET",
    path: "/api/v1/screenings/:id/eligibility",
    description: "Get detailed eligibility results including target groups, certification status, and credit calculations",
    category: "Status & Eligibility",
    scopes: ["screenings:read"],
    params: [],
    response: {
      eligible: true,
      targetGroups: [
        { code: "IV-A", name: "TANF Recipient", qualified: true },
      ],
      certificationNumber: "CERT-2026-001",
      credits: { projected: 2400, actual: 2400, status: "certified" },
    },
  },
  {
    method: "GET",
    path: "/api/v1/wotc-summary",
    description: "Aggregate WOTC summary for the employer",
    category: "Status & Eligibility",
    scopes: ["screenings:read", "credits:read"],
    params: [],
    response: {
      employees: { total: 250 },
      screenings: { byStatus: { eligible: 80, ineligible: 40, pending: 30 } },
      questionnaire: { accessed: 140, started: 130, completed: 120 },
      credits: { totalProjected: 192000, totalActual: 156000, totalClaimed: 120000 },
    },
  },
  {
    method: "POST",
    path: "/api/v1/payroll/import",
    description: "Import payroll hours/wages data in bulk (up to 500 records per request)",
    category: "Payroll & Credits",
    scopes: ["payroll:write"],
    params: [],
    body: {
      records: [
        { employeeId: "emp_abc123", hours: "520", wages: "7800.00", periodStart: "2026-01-01", periodEnd: "2026-01-31", notes: "string" },
      ] as any,
    },
    response: {
      imported: 1,
      errors: 0,
      results: [{ employeeId: "emp_abc123", status: "success" }],
    },
  },
  {
    method: "POST",
    path: "/api/v1/payroll/calculate-credits",
    description: "Recalculate WOTC credits using imported payroll data for certified employees",
    category: "Payroll & Credits",
    scopes: ["credits:write"],
    params: [],
    body: {
      employeeIds: ["emp_abc123", "emp_def456"] as any,
    },
    response: {
      calculated: 2,
      results: [
        { employeeId: "emp_abc123", hours: 520, wages: 7800, creditAmount: 2400, tier: "40%" },
      ],
    },
  },
  {
    method: "GET",
    path: "/api/v1/employees",
    description: "List employees with pagination, sorting, and search",
    category: "Employees",
    scopes: ["employees:read"],
    params: [
      { name: "page", type: "number", description: "Page number (default: 1)" },
      { name: "limit", type: "number", description: "Items per page (default: 50, max: 100)" },
      { name: "sort", type: "string", description: "Sort field (e.g., firstName, lastName, hireDate)" },
      { name: "order", type: "string", description: "Sort order: asc or desc" },
      { name: "search", type: "string", description: "Search by name or email" },
      { name: "status", type: "string", description: "Filter by employee status" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/employees/:id",
    description: "Get employee by ID",
    category: "Employees",
    scopes: ["employees:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/employees/:id/screenings",
    description: "Get all screenings for a specific employee",
    category: "Employees",
    scopes: ["employees:read", "screenings:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/screenings",
    description: "List all WOTC screenings with pagination and filtering",
    category: "Screenings",
    scopes: ["screenings:read"],
    params: [
      { name: "page", type: "number", description: "Page number (default: 1)" },
      { name: "limit", type: "number", description: "Items per page (default: 50, max: 100)" },
      { name: "sort", type: "string", description: "Sort field" },
      { name: "order", type: "string", description: "Sort order: asc or desc" },
      { name: "employeeId", type: "string", description: "Filter by employee ID" },
      { name: "status", type: "string", description: "Filter by status (eligible, ineligible, pending)" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/screenings/:id",
    description: "Get screening by ID",
    category: "Screenings",
    scopes: ["screenings:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/screenings/:id/status",
    description: "Get screening status (lightweight endpoint)",
    category: "Screenings",
    scopes: ["screenings:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/credits",
    description: "List WOTC credit calculations with pagination and filtering",
    category: "Credits",
    scopes: ["credits:read"],
    params: [
      { name: "page", type: "number", description: "Page number (default: 1)" },
      { name: "limit", type: "number", description: "Items per page (default: 50, max: 100)" },
      { name: "sort", type: "string", description: "Sort field" },
      { name: "order", type: "string", description: "Sort order: asc or desc" },
      { name: "employeeId", type: "string", description: "Filter by employee ID" },
      { name: "screeningId", type: "string", description: "Filter by screening ID" },
      { name: "status", type: "string", description: "Filter by credit status" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/credits/:id",
    description: "Get credit calculation by ID",
    category: "Credits",
    scopes: ["credits:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/target-groups",
    description: "List all WOTC target groups with credit amounts and wage caps",
    category: "Reference",
    scopes: [],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/webhook-events",
    description: "List all available webhook events and their payload schemas",
    category: "Reference",
    scopes: [],
    params: [],
  },
];

const CATEGORY_ORDER = [
  "Questionnaire Delivery",
  "Status & Eligibility",
  "Payroll & Credits",
  "Employees",
  "Screenings",
  "Credits",
  "Reference",
];

const WEBHOOK_EVENTS = [
  { event: "employee.hired", description: "Fired when a new employee record is created" },
  { event: "employee.status_changed", description: "Fired when an employee's status changes" },
  { event: "questionnaire.accessed", description: "Fired when a candidate opens the questionnaire link" },
  { event: "questionnaire.started", description: "Fired when a candidate begins answering questions" },
  { event: "questionnaire.completed", description: "Fired when a candidate submits all answers" },
  { event: "screening.started", description: "Fired when WOTC screening begins processing" },
  { event: "screening.completed", description: "Fired when screening analysis is complete" },
  { event: "screening.certified", description: "Fired when the SWA certifies eligibility" },
  { event: "screening.denied", description: "Fired when the SWA denies eligibility" },
  { event: "credit.calculated", description: "Fired when a new credit amount is calculated" },
  { event: "credit.updated", description: "Fired when a credit calculation is revised" },
  { event: "payroll.imported", description: "Fired when payroll data is successfully imported" },
  { event: "credits.recalculated", description: "Fired when credits are recalculated with new payroll data" },
];

const CREDIT_TIERS = [
  { hours: "< 120 hours", rate: "0%", description: "No credit", example: "" },
  { hours: "120 - 399 hours", rate: "25%", description: "25% of qualified first-year wages", example: "$6,000 x 25% = $1,500" },
  { hours: "400+ hours", rate: "40%", description: "40% of qualified first-year wages", example: "$6,000 x 40% = $2,400" },
];

const CREDIT_CAPS = [
  { group: "Standard (most target groups)", wageCap: "$6,000", maxCredit: "$2,400" },
  { group: "Long-term TANF (Year 1)", wageCap: "$10,000", maxCredit: "$4,000" },
  { group: "Long-term TANF (Year 2, 50%)", wageCap: "$10,000", maxCredit: "$5,000" },
  { group: "Disabled Veteran (unemployed 6+ months)", wageCap: "$24,000", maxCredit: "$9,600" },
  { group: "Summer Youth Employee", wageCap: "$3,000", maxCredit: "$1,200" },
];

const CODE_EXAMPLES = {
  curl: (apiKey: string, endpoint: Endpoint) => `curl -X ${endpoint.method} \\
  'https://your-app.replit.app${endpoint.path}' \\
  -H 'Authorization: Bearer ${apiKey || "YOUR_API_KEY"}' \\
  -H 'Content-Type: application/json'${endpoint.body ? ` \\
  -d '${JSON.stringify(endpoint.body, null, 2)}'` : ""}`,

  nodejs: (apiKey: string, endpoint: Endpoint) => `const response = await fetch('https://your-app.replit.app${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey || "YOUR_API_KEY"}',
    'Content-Type': 'application/json'
  }${endpoint.body ? `,
  body: JSON.stringify(${JSON.stringify(endpoint.body, null, 2)})` : ""}
});

const data = await response.json();
console.log(data);`,

  python: (apiKey: string, endpoint: Endpoint) => `import requests

response = requests.${endpoint.method.toLowerCase()}(
    'https://your-app.replit.app${endpoint.path}',
    headers={
        'Authorization': 'Bearer ${apiKey || "YOUR_API_KEY"}',
        'Content-Type': 'application/json'
    }${endpoint.body ? `,
    json=${JSON.stringify(endpoint.body, null, 2).replace(/"/g, "'")}` : ""}
)

data = response.json()
print(data)`,
};

function groupEndpointsByCategory(endpoints: Endpoint[]) {
  const groups: Record<string, Endpoint[]> = {};
  for (const ep of endpoints) {
    if (!groups[ep.category]) groups[ep.category] = [];
    groups[ep.category].push(ep);
  }
  return CATEGORY_ORDER
    .filter((cat) => groups[cat])
    .map((cat) => ({ category: cat, endpoints: groups[cat] }));
}

export default function ApiDocsPage() {
  const { toast } = useToast();
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "nodejs" | "python">("curl");
  const [copied, setCopied] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");

  const { data: apiKeys } = useQuery<{ data: any[] }>({
    queryKey: ["/api/api-keys"],
  });

  useEffect(() => {
    const lastCreatedKey = localStorage.getItem("lastCreatedApiKey");
    if (lastCreatedKey) {
      setCustomApiKey(lastCreatedKey);
    }
  }, []);

  const apiKeyToUse = customApiKey || "YOUR_API_KEY";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "Code example copied successfully",
    });
  };

  const getCodeExample = () => {
    return CODE_EXAMPLES[selectedLanguage](apiKeyToUse, selectedEndpoint);
  };

  const handleApiKeyChange = (value: string) => {
    setCustomApiKey(value);
    if (value.trim()) {
      localStorage.setItem("lastCreatedApiKey", value.trim());
    }
  };

  const groupedEndpoints = groupEndpointsByCategory(API_ENDPOINTS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">API Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive guide to integrating with the WOTC REST API for ATS/HRIS systems
        </p>
      </div>

      <div className="space-y-4">
        <Alert data-testid="alert-base-url">
          <Book className="h-4 w-4" />
          <AlertDescription>
            <strong>Base URL:</strong> <code className="bg-muted px-2 py-1 rounded ml-2">https://your-app.replit.app</code>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Key for Examples</CardTitle>
            <CardDescription>
              Enter your API key to populate code examples with working authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Paste your API key here..."
                value={customApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                data-testid="input-api-key"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally in your browser and used only to generate code examples below.
              </p>
            </div>
          </CardContent>
        </Card>

        {apiKeyToUse === "YOUR_API_KEY" && (
          <Alert variant="destructive" data-testid="alert-no-api-key-entered">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>No API key entered.</strong> The code examples below use a placeholder.
              {!apiKeys?.data || apiKeys.data.length === 0 ? (
                <>
                  {" "}Create an API key{" "}
                  <a href="/employer/api-keys" className="underline font-semibold">here</a>
                  {" "}and paste it above.
                </>
              ) : (
                " Enter your API key above to generate working examples."
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>Available API endpoints grouped by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupedEndpoints.map((group) => (
                <div key={group.category}>
                  <h3
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
                    data-testid={`text-category-${group.category.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {group.category}
                  </h3>
                  <div className="space-y-1">
                    {group.endpoints.map((endpoint, idx) => {
                      const globalIdx = API_ENDPOINTS.indexOf(endpoint);
                      return (
                        <div
                          key={globalIdx}
                          className={`cursor-pointer rounded-md p-2 transition-colors ${
                            selectedEndpoint === endpoint
                              ? "bg-primary/10 border border-primary"
                              : "hover-elevate border border-transparent"
                          }`}
                          onClick={() => setSelectedEndpoint(endpoint)}
                          data-testid={`card-endpoint-${globalIdx}`}
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                endpoint.method === "GET"
                                  ? "default"
                                  : endpoint.method === "POST"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[10px] px-1.5 py-0"
                              data-testid={`badge-method-${endpoint.method}-${globalIdx}`}
                            >
                              {endpoint.method}
                            </Badge>
                            <code className="text-[11px] truncate" data-testid={`text-path-${globalIdx}`}>
                              {endpoint.path}
                            </code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedEndpoint.method === "GET" ? "default" : "secondary"}>
                    {selectedEndpoint.method}
                  </Badge>
                  <code className="text-sm" data-testid="text-selected-path">{selectedEndpoint.path}</code>
                </CardTitle>
                <CardDescription className="mt-2">{selectedEndpoint.description}</CardDescription>
                {selectedEndpoint.category && (
                  <Badge variant="outline" className="mt-2" data-testid="badge-endpoint-category">
                    {selectedEndpoint.category}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedEndpoint.scopes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Required Scopes</h3>
                <div className="flex gap-2 flex-wrap">
                  {selectedEndpoint.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" data-testid={`badge-scope-${scope}`}>
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Query Parameters</h3>
                <div className="space-y-2">
                  {selectedEndpoint.params.map((param) => (
                    <div key={param.name} className="flex gap-4 text-sm flex-wrap" data-testid={`param-${param.name}`}>
                      <code className="font-mono text-primary">{param.name}</code>
                      <Badge variant="secondary" className="text-xs">{param.type}</Badge>
                      <span className="text-muted-foreground flex-1">{param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedEndpoint.body && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Request Body</h3>
                <Card className="bg-muted">
                  <CardContent className="p-4">
                    <pre className="text-xs overflow-x-auto" data-testid="code-request-body">
                      <code>{JSON.stringify(selectedEndpoint.body, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedEndpoint.response && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Example Response</h3>
                <Card className="bg-muted">
                  <CardContent className="p-4">
                    <pre className="text-xs overflow-x-auto" data-testid="code-response-example">
                      <code>{JSON.stringify(selectedEndpoint.response, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Code Example</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectedLanguage === "curl" ? "default" : "outline"}
                    onClick={() => setSelectedLanguage("curl")}
                    data-testid="button-lang-curl"
                  >
                    cURL
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedLanguage === "nodejs" ? "default" : "outline"}
                    onClick={() => setSelectedLanguage("nodejs")}
                    data-testid="button-lang-nodejs"
                  >
                    Node.js
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedLanguage === "python" ? "default" : "outline"}
                    onClick={() => setSelectedLanguage("python")}
                    data-testid="button-lang-python"
                  >
                    Python
                  </Button>
                </div>
              </div>
              <Card className="bg-muted relative">
                <CardContent className="p-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(getCodeExample())}
                    data-testid="button-copy-code"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <pre className="text-xs overflow-x-auto pr-10" data-testid="code-example">
                    <code>{getCodeExample()}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-integration-workflow">
        <CardHeader>
          <CardTitle>Integration Workflow</CardTitle>
          <CardDescription>Three-step flow to integrate WOTC screening into your ATS/HRIS</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3" data-testid="workflow-step-1">
              <div className="flex items-center gap-2">
                <Badge variant="default">Step 1</Badge>
                <h3 className="text-sm font-semibold">Questionnaire Delivery</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Create employee via <code className="bg-muted px-1 rounded text-xs">POST /api/v1/employees</code></li>
                <li>Initiate screening via <code className="bg-muted px-1 rounded text-xs">POST /api/v1/screenings/initiate</code></li>
                <li>Embed the returned <code className="bg-muted px-1 rounded text-xs">questionnaireUrl</code> in your ATS/HRIS</li>
              </ol>
            </div>
            <div className="space-y-3" data-testid="workflow-step-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">Step 2</Badge>
                <h3 className="text-sm font-semibold">Status Push-Back</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Poll <code className="bg-muted px-1 rounded text-xs">GET /api/v1/screenings/:id/questionnaire-status</code> or subscribe to webhooks to receive real-time updates:
              </p>
              <div className="flex gap-1 flex-wrap">
                {["questionnaire.accessed", "questionnaire.started", "questionnaire.completed", "screening.certified", "screening.denied"].map((evt) => (
                  <Badge key={evt} variant="outline" className="text-[10px]">{evt}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-3" data-testid="workflow-step-3">
              <div className="flex items-center gap-2">
                <Badge variant="default">Step 3</Badge>
                <h3 className="text-sm font-semibold">Payroll & Credits</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Import payroll data via <code className="bg-muted px-1 rounded text-xs">POST /api/v1/payroll/import</code></li>
                <li>Trigger credit recalculation via <code className="bg-muted px-1 rounded text-xs">POST /api/v1/payroll/calculate-credits</code></li>
                <li>Get detailed credit breakdown per employee</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-webhook-events">
        <CardHeader>
          <CardTitle>Webhook Events</CardTitle>
          <CardDescription>Subscribe to real-time event notifications for your integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-semibold">Event</th>
                  <th className="text-left py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {WEBHOOK_EVENTS.map((evt) => (
                  <tr key={evt.event} className="border-b last:border-b-0" data-testid={`webhook-event-${evt.event}`}>
                    <td className="py-2 pr-4">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{evt.event}</code>
                    </td>
                    <td className="py-2 text-muted-foreground">{evt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Webhook Payload Example</h3>
            <Card className="bg-muted">
              <CardContent className="p-4">
                <pre className="text-xs overflow-x-auto" data-testid="code-webhook-payload">
                  <code>{JSON.stringify({
                    id: "evt_abc123",
                    event: "screening.certified",
                    timestamp: "2026-01-15T14:30:00Z",
                    data: {
                      screeningId: "scr_abc123",
                      employeeId: "emp_def456",
                      status: "certified",
                      certificationNumber: "CERT-2026-001",
                      creditAmount: 2400,
                    },
                  }, null, 2)}</code>
                </pre>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Signature Verification</h3>
            <p className="text-sm text-muted-foreground mb-3">
              All webhook payloads include an <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header containing an HMAC-SHA256 signature. Verify the signature using your webhook secret to ensure the payload is authentic.
            </p>
            <Card className="bg-muted">
              <CardContent className="p-4">
                <pre className="text-xs overflow-x-auto" data-testid="code-webhook-signature">
                  <code>{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-wotc-credit-calculation">
        <CardHeader>
          <CardTitle>WOTC Credit Calculation</CardTitle>
          <CardDescription>How tax credits are calculated based on hours worked and target group</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Credit Tiers by Hours Worked</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Hours Worked</th>
                    <th className="text-left py-2 pr-4 font-semibold">Rate</th>
                    <th className="text-left py-2 pr-4 font-semibold">Formula</th>
                    <th className="text-left py-2 font-semibold">Example (standard)</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_TIERS.map((tier) => (
                    <tr key={tier.hours} className="border-b last:border-b-0" data-testid={`credit-tier-${tier.rate}`}>
                      <td className="py-2 pr-4 font-mono text-xs">{tier.hours}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{tier.rate}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{tier.description}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{tier.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Wage Caps and Maximum Credits by Target Group</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Target Group</th>
                    <th className="text-left py-2 pr-4 font-semibold">Qualified Wage Cap</th>
                    <th className="text-left py-2 font-semibold">Maximum Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_CAPS.map((cap) => (
                    <tr key={cap.group} className="border-b last:border-b-0" data-testid={`credit-cap-${cap.group.replace(/\s+/g, "-").toLowerCase()}`}>
                      <td className="py-2 pr-4">{cap.group}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{cap.wageCap}</td>
                      <td className="py-2 font-mono text-xs font-semibold">{cap.maxCredit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Alert data-testid="alert-credit-note">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Long-term TANF recipients may qualify for a second-year credit of up to $5,000 (50% of up to $10,000 in qualified wages), for a combined maximum of $9,000 across both years.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>How to authenticate your API requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            All API requests must include your API key in the <code className="bg-muted px-2 py-1 rounded">Authorization</code> header using the Bearer scheme:
          </p>
          <Card className="bg-muted">
            <CardContent className="p-4">
              <pre className="text-xs">
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </pre>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            Replace <code className="bg-muted px-2 py-1 rounded">YOUR_API_KEY</code> with your actual API key from the API Keys page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
          <CardDescription>API request limits and quotas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            API requests are rate-limited to ensure fair usage and system stability. Rate limits are applied per API key:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Default: 100 requests per hour per key</li>
            <li>Rate limit headers are included in every response</li>
            <li>Exceeding limits returns HTTP 429 (Too Many Requests)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response Format</CardTitle>
          <CardDescription>Standard API response structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">All API responses follow a consistent JSON structure:</p>
          <Tabs defaultValue="success" className="w-full">
            <TabsList>
              <TabsTrigger value="success" data-testid="tab-success">Success</TabsTrigger>
              <TabsTrigger value="error" data-testid="tab-error">Error</TabsTrigger>
            </TabsList>
            <TabsContent value="success">
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <pre className="text-xs" data-testid="code-success-response">
                    <code>{JSON.stringify({
                      data: [],
                      pagination: {
                        page: 1,
                        limit: 50,
                        total: 150,
                        totalPages: 3,
                      },
                    }, null, 2)}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="error">
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <pre className="text-xs" data-testid="code-error-response">
                    <code>{JSON.stringify({
                      error: "Validation error",
                      message: "Invalid request parameters",
                      details: ["Field 'email' is required"],
                    }, null, 2)}</code>
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
