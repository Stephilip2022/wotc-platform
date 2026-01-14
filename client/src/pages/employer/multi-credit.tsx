import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  DollarSign, 
  TrendingUp, 
  Building2, 
  Users,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText
} from "lucide-react";

interface OtherTaxCredit {
  id: string;
  employeeId: string;
  creditType: string;
  creditName: string;
  creditCategory: string;
  eligibilityScore: number;
  estimatedValue: string;
  status: string;
  identifiedAt: string;
  eligibilityFactors: any;
}

interface CreditSummary {
  otherCredits: {
    totalValue: number;
    count: number;
    byCategory: any[];
  };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const CREDIT_TYPES: Record<string, { label: string; description: string; icon: any }> = {
  rd_tax_credit: {
    label: "R&D Tax Credit",
    description: "Research and Development activities",
    icon: Sparkles
  },
  state_hiring_incentive: {
    label: "State Hiring Incentive",
    description: "State-specific hiring tax benefits",
    icon: Building2
  },
  new_markets_tax_credit: {
    label: "New Markets Tax Credit",
    description: "Investment in low-income communities",
    icon: TrendingUp
  },
  disabled_access_credit: {
    label: "Disabled Access Credit",
    description: "ADA compliance and accessibility",
    icon: Users
  },
  empowerment_zone_credit: {
    label: "Empowerment Zone Credit",
    description: "Hiring in designated empowerment zones",
    icon: Building2
  }
};

export default function MultiCreditPage() {
  const { toast } = useToast();

  const { data: credits = [], isLoading: loadingCredits } = useQuery<OtherTaxCredit[]>({
    queryKey: ["/api/credits/other"]
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<CreditSummary>({
    queryKey: ["/api/credits/summary"]
  });

  const batchScanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/credits/batch-scan");
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scan Complete",
        description: `Scanned ${data.employeesScanned} employees for additional credits`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/other"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/credits/other/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/other"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/summary"] });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "identified":
        return <Badge variant="secondary">Identified</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-100 text-blue-800">Reviewing</Badge>;
      case "pursuing":
        return <Badge className="bg-yellow-100 text-yellow-800">Pursuing</Badge>;
      case "claimed":
        return <Badge className="bg-green-100 text-green-800">Claimed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "federal":
        return <Badge variant="default">Federal</Badge>;
      case "state":
        return <Badge className="bg-purple-100 text-purple-800">State</Badge>;
      case "local":
        return <Badge className="bg-orange-100 text-orange-800">Local</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const getCreditInfo = (creditType: string) => {
    return CREDIT_TYPES[creditType] || {
      label: creditType,
      description: "",
      icon: DollarSign
    };
  };

  const totalPotentialValue = credits.reduce((sum, c) => sum + Number(c.estimatedValue || 0), 0);
  const identifiedCount = credits.filter(c => c.status === "identified").length;
  const pursuingCount = credits.filter(c => c.status === "pursuing").length;
  const claimedCount = credits.filter(c => c.status === "claimed").length;

  const groupedByType = credits.reduce((acc, credit) => {
    if (!acc[credit.creditType]) {
      acc[credit.creditType] = [];
    }
    acc[credit.creditType].push(credit);
    return acc;
  }, {} as Record<string, OtherTaxCredit[]>);

  if (loadingCredits || loadingSummary) {
    return <div className="p-8">Loading credit data...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="multi-credit-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-multi-credit">Multi-Credit Bundling</h1>
          <p className="text-muted-foreground mt-1">
            Identify and track additional tax credits beyond WOTC
          </p>
        </div>
        <Button
          onClick={() => batchScanMutation.mutate()}
          disabled={batchScanMutation.isPending}
          data-testid="button-scan-credits"
        >
          {batchScanMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Scan for Credits
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-value">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Potential Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-value">
              ${totalPotentialValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all credit types</p>
          </CardContent>
        </Card>

        <Card data-testid="card-identified">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Identified</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-identified">{identifiedCount}</div>
            <p className="text-xs text-muted-foreground">New opportunities found</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pursuing">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pursuing">{pursuingCount}</div>
            <p className="text-xs text-muted-foreground">Currently pursuing</p>
          </CardContent>
        </Card>

        <Card data-testid="card-claimed">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claimed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-claimed">{claimedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully claimed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList data-testid="tabs-credits">
          <TabsTrigger value="all" data-testid="tab-all">All Credits</TabsTrigger>
          <TabsTrigger value="by-type" data-testid="tab-by-type">By Type</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Tax Credit Opportunities</CardTitle>
              <CardDescription>
                Review and manage identified tax credit opportunities for your employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Eligibility Score</TableHead>
                    <TableHead>Estimated Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credits.length > 0 ? (
                    credits.map((credit) => {
                      const info = getCreditInfo(credit.creditType);
                      const Icon = info.icon;
                      return (
                        <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{info.label}</p>
                                <p className="text-xs text-muted-foreground">{info.description}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getCategoryBadge(credit.creditCategory)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={credit.eligibilityScore} className="h-2 w-20" />
                              <span className="text-xs">{credit.eligibilityScore}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600" data-testid={`text-value-${credit.id}`}>
                              ${Number(credit.estimatedValue).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(credit.status)}</TableCell>
                          <TableCell>
                            <Select
                              value={credit.status}
                              onValueChange={(value) => 
                                updateStatusMutation.mutate({ id: credit.id, status: value })
                              }
                            >
                              <SelectTrigger className="w-32" data-testid={`select-status-${credit.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="identified">Identified</SelectItem>
                                <SelectItem value="reviewing">Reviewing</SelectItem>
                                <SelectItem value="pursuing">Pursuing</SelectItem>
                                <SelectItem value="claimed">Claimed</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No credit opportunities found yet.</p>
                        <p className="text-sm">Click "Scan for Credits" to identify opportunities.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-type">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(CREDIT_TYPES).map(([type, info]) => {
              const typeCredits = groupedByType[type] || [];
              const totalValue = typeCredits.reduce((sum, c) => sum + Number(c.estimatedValue || 0), 0);
              const Icon = info.icon;
              
              return (
                <Card key={type} data-testid={`card-type-${type}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {info.label}
                    </CardTitle>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          ${totalValue.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {typeCredits.length} opportunities
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="font-medium">{typeCredits.filter(c => c.status === "claimed").length}</span>
                          {" "}claimed
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {typeCredits.filter(c => c.status === "pursuing").length} in progress
                        </p>
                      </div>
                    </div>
                    {typeCredits.length > 0 && (
                      <div className="space-y-2">
                        {typeCredits.slice(0, 3).map((credit) => (
                          <div 
                            key={credit.id} 
                            className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                          >
                            <span>${Number(credit.estimatedValue).toLocaleString()}</span>
                            {getStatusBadge(credit.status)}
                          </div>
                        ))}
                        {typeCredits.length > 3 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{typeCredits.length - 3} more
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
