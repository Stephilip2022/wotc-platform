import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Copy, Check, Book, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/employees",
    description: "List all employees",
    scopes: ["employees:read"],
    params: [
      { name: "page", type: "number", description: "Page number (default: 1)" },
      { name: "limit", type: "number", description: "Items per page (default: 50, max: 100)" },
      { name: "sort", type: "string", description: "Sort field (e.g., firstName, lastName, hireDate)" },
      { name: "order", type: "string", description: "Sort order: asc or desc" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/employees/:id",
    description: "Get employee by ID",
    scopes: ["employees:read"],
    params: [],
  },
  {
    method: "POST",
    path: "/api/v1/employees",
    description: "Create a new employee",
    scopes: ["employees:write"],
    params: [],
    body: {
      firstName: "string (required)",
      lastName: "string (required)",
      email: "string (required)",
      phone: "string (optional)",
      hireDate: "string (ISO date, optional)",
    },
  },
  {
    method: "GET",
    path: "/api/v1/screenings",
    description: "List all WOTC screenings",
    scopes: ["screenings:read"],
    params: [
      { name: "page", type: "number", description: "Page number" },
      { name: "limit", type: "number", description: "Items per page" },
      { name: "status", type: "string", description: "Filter by status (eligible, ineligible, pending)" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/screenings/:id",
    description: "Get screening by ID",
    scopes: ["screenings:read"],
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/credits",
    description: "List WOTC credit calculations",
    scopes: ["credits:read"],
    params: [
      { name: "page", type: "number", description: "Page number" },
      { name: "limit", type: "number", description: "Items per page" },
      { name: "status", type: "string", description: "Filter by status" },
    ],
  },
];

const CODE_EXAMPLES = {
  curl: (apiKey: string, endpoint: any) => `curl -X ${endpoint.method} \\
  'https://your-app.replit.app${endpoint.path}' \\
  -H 'Authorization: Bearer ${apiKey || "YOUR_API_KEY"}' \\
  -H 'Content-Type: application/json'${endpoint.body ? ` \\
  -d '${JSON.stringify(endpoint.body, null, 2)}'` : ""}`,
  
  nodejs: (apiKey: string, endpoint: any) => `const response = await fetch('https://your-app.replit.app${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey || "YOUR_API_KEY"}',
    'Content-Type': 'application/json'
  }${endpoint.body ? `,
  body: JSON.stringify(${JSON.stringify(endpoint.body, null, 2)})` : ""}
});

const data = await response.json();
console.log(data);`,
  
  python: (apiKey: string, endpoint: any) => `import requests

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">API Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive guide to integrating with the WOTC REST API
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
            <CardDescription>Available API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {API_ENDPOINTS.map((endpoint, idx) => (
                <Card
                  key={idx}
                  className={`cursor-pointer transition-colors ${
                    selectedEndpoint === endpoint ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedEndpoint(endpoint)}
                  data-testid={`card-endpoint-${idx}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          endpoint.method === "GET"
                            ? "default"
                            : endpoint.method === "POST"
                            ? "secondary"
                            : "outline"
                        }
                        data-testid={`badge-method-${endpoint.method}`}
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs" data-testid={`text-path-${idx}`}>
                        {endpoint.path}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant={selectedEndpoint.method === "GET" ? "default" : "secondary"}>
                    {selectedEndpoint.method}
                  </Badge>
                  <code data-testid="text-selected-path">{selectedEndpoint.path}</code>
                </CardTitle>
                <CardDescription className="mt-2">{selectedEndpoint.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedEndpoint.scopes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Required Scopes</h3>
                <div className="flex gap-2">
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
                    <div key={param.name} className="flex gap-4 text-sm" data-testid={`param-${param.name}`}>
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
                    <pre className="text-xs" data-testid="code-request-body">
                      <code>{JSON.stringify(selectedEndpoint.body, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
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
                  <pre className="text-xs overflow-x-auto" data-testid="code-example">
                    <code>{getCodeExample()}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>

          </CardContent>
        </Card>
      </div>

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
