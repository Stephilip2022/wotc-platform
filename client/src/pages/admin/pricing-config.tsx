import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DollarSign, Percent, Calculator, TrendingUp, Settings, Zap, Calendar, Users } from "lucide-react";

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  pricingModel: string;
  percentageRate: string | null;
  milestoneFeesConfig: any;
  perScreeningConfig: any;
  deferredConfig: any;
  monthlySubscriptionFee: string;
  minimumAnnualFee: string | null;
  setupFee: string;
  isActive: boolean;
  isDefault: boolean;
}

interface CalculatorResult {
  pricingModel: string;
  annualRevenue: number;
  monthlyRevenue: number;
  breakdown: any;
  comparison: {
    percentageModelRevenue: number;
    difference: number;
    percentageDifference: number;
  };
}

export default function PricingConfig() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("plans");
  const [calculatorParams, setCalculatorParams] = useState({
    pricingModel: "percentage",
    annualHires: 1000,
    certificationRate: 7,
    averageCredit: 2800,
    monthlySubscriptionFee: 99,
    percentageRate: 15,
    perScreeningRate: 27,
  });
  const [calculatorResult, setCalculatorResult] = useState<CalculatorResult | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<PricingPlan[]>({
    queryKey: ["/api/pricing/plans/all"],
  });

  const { data: defaults } = useQuery({
    queryKey: ["/api/pricing/defaults"],
  });

  const initializePlansMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pricing/initialize");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/plans"] });
      toast({ title: "Default pricing plans created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating plans", description: error.message, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/pricing/plans/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/plans"] });
      toast({ title: "Plan updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating plan", description: error.message, variant: "destructive" });
    },
  });

  const calculatePricingMutation = useMutation({
    mutationFn: async (params: typeof calculatorParams) => {
      const res = await apiRequest("POST", "/api/pricing/calculate", params);
      return res.json() as Promise<CalculatorResult>;
    },
    onSuccess: (data) => {
      setCalculatorResult(data);
    },
    onError: (error: any) => {
      toast({ title: "Calculation error", description: error.message, variant: "destructive" });
    },
  });

  const handleCalculate = () => {
    calculatePricingMutation.mutate(calculatorParams);
  };

  const togglePlanStatus = (plan: PricingPlan) => {
    updatePlanMutation.mutate({ id: plan.id, data: { isActive: !plan.isActive } });
  };

  const setDefaultPlan = (plan: PricingPlan) => {
    updatePlanMutation.mutate({ id: plan.id, data: { isDefault: true } });
  };

  const getPricingModelIcon = (model: string) => {
    switch (model) {
      case "percentage": return <Percent className="h-4 w-4" />;
      case "milestone_flat_fee": return <TrendingUp className="h-4 w-4" />;
      case "per_screening": return <Users className="h-4 w-4" />;
      case "deferred_annual": return <Calendar className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPricingModelLabel = (model: string) => {
    switch (model) {
      case "percentage": return "Percentage of Credits";
      case "milestone_flat_fee": return "Milestone Flat Fee";
      case "per_screening": return "Per-Screening Volume";
      case "deferred_annual": return "Deferred Annual";
      default: return model;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Pricing Configuration</h1>
          <p className="text-muted-foreground">Manage pricing plans and calculate revenue projections</p>
        </div>
        {plans.length === 0 && (
          <Button
            onClick={() => initializePlansMutation.mutate()}
            disabled={initializePlansMutation.isPending}
            data-testid="button-initialize-plans"
          >
            <Zap className="mr-2 h-4 w-4" />
            Initialize Default Plans
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <Settings className="mr-2 h-4 w-4" />
            Pricing Plans
          </TabsTrigger>
          <TabsTrigger value="calculator" data-testid="tab-calculator">
            <Calculator className="mr-2 h-4 w-4" />
            Revenue Calculator
          </TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-comparison">
            <TrendingUp className="mr-2 h-4 w-4" />
            Model Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {plansLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pricing Plans Yet</h3>
                <p className="text-muted-foreground mb-4">Click the button above to create default pricing plans</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getPricingModelIcon(plan.pricingModel)}
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                      </div>
                      <div className="flex gap-2">
                        {plan.isDefault && <Badge variant="default">Default</Badge>}
                        <Badge variant={plan.isActive ? "outline" : "secondary"}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-medium">{getPricingModelLabel(plan.pricingModel)}</span>
                      </div>
                      {plan.percentageRate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rate:</span>
                          <span className="font-medium">{plan.percentageRate}%</span>
                        </div>
                      )}
                      {plan.monthlySubscriptionFee && parseFloat(plan.monthlySubscriptionFee) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Fee:</span>
                          <span className="font-medium">${plan.monthlySubscriptionFee}/mo</span>
                        </div>
                      )}
                      {plan.deferredConfig && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly Base:</span>
                            <span className="font-medium">${plan.deferredConfig.monthlyBase}/mo</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Annual %:</span>
                            <span className="font-medium">{plan.deferredConfig.annualPercentage}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Billing Date:</span>
                            <span className="font-medium">{plan.deferredConfig.billingDate}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePlanStatus(plan)}
                        data-testid={`button-toggle-${plan.id}`}
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {!plan.isDefault && plan.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultPlan(plan)}
                          data-testid={`button-set-default-${plan.id}`}
                        >
                          Set as Default
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calculator" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Calculator</CardTitle>
                <CardDescription>Estimate revenue under different pricing models</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pricing Model</Label>
                  <Select
                    value={calculatorParams.pricingModel}
                    onValueChange={(v) => setCalculatorParams({ ...calculatorParams, pricingModel: v })}
                  >
                    <SelectTrigger data-testid="select-pricing-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Credits (15%)</SelectItem>
                      <SelectItem value="milestone_flat_fee">Milestone Flat Fee</SelectItem>
                      <SelectItem value="per_screening">Per-Screening Volume</SelectItem>
                      <SelectItem value="deferred_annual">Deferred Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Annual Hires</Label>
                    <Input
                      type="number"
                      value={calculatorParams.annualHires}
                      onChange={(e) => setCalculatorParams({ ...calculatorParams, annualHires: parseInt(e.target.value) || 0 })}
                      data-testid="input-annual-hires"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Certification Rate (%)</Label>
                    <Input
                      type="number"
                      value={calculatorParams.certificationRate}
                      onChange={(e) => setCalculatorParams({ ...calculatorParams, certificationRate: parseFloat(e.target.value) || 0 })}
                      data-testid="input-cert-rate"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Average Credit ($)</Label>
                  <Input
                    type="number"
                    value={calculatorParams.averageCredit}
                    onChange={(e) => setCalculatorParams({ ...calculatorParams, averageCredit: parseFloat(e.target.value) || 0 })}
                    data-testid="input-avg-credit"
                  />
                </div>

                {calculatorParams.pricingModel === "percentage" && (
                  <div className="space-y-2">
                    <Label>Percentage Rate (%)</Label>
                    <Input
                      type="number"
                      value={calculatorParams.percentageRate}
                      onChange={(e) => setCalculatorParams({ ...calculatorParams, percentageRate: parseFloat(e.target.value) || 0 })}
                      data-testid="input-percentage-rate"
                    />
                  </div>
                )}

                {(calculatorParams.pricingModel === "milestone_flat_fee" || calculatorParams.pricingModel === "per_screening") && (
                  <div className="space-y-2">
                    <Label>Monthly Subscription ($)</Label>
                    <Input
                      type="number"
                      value={calculatorParams.monthlySubscriptionFee}
                      onChange={(e) => setCalculatorParams({ ...calculatorParams, monthlySubscriptionFee: parseFloat(e.target.value) || 0 })}
                      data-testid="input-monthly-fee"
                    />
                  </div>
                )}

                {calculatorParams.pricingModel === "per_screening" && (
                  <div className="space-y-2">
                    <Label>Per-Screening Rate ($)</Label>
                    <Input
                      type="number"
                      value={calculatorParams.perScreeningRate}
                      onChange={(e) => setCalculatorParams({ ...calculatorParams, perScreeningRate: parseFloat(e.target.value) || 0 })}
                      data-testid="input-screening-rate"
                    />
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleCalculate}
                  disabled={calculatePricingMutation.isPending}
                  data-testid="button-calculate"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate Revenue
                </Button>
              </CardContent>
            </Card>

            {calculatorResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Projection</CardTitle>
                  <CardDescription>Based on {getPricingModelLabel(calculatorResult.pricingModel)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Annual Revenue</p>
                    <p className="text-3xl font-bold text-primary" data-testid="text-annual-revenue">
                      {formatCurrency(calculatorResult.annualRevenue)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ({formatCurrency(calculatorResult.monthlyRevenue)}/month)
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold">Breakdown</h4>
                    {Object.entries(calculatorResult.breakdown).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                        <span className="font-medium">
                          {typeof value === "number" ? formatCurrency(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold">vs. 15% Model</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">15% Model Revenue</span>
                      <span className="font-medium">{formatCurrency(calculatorResult.comparison.percentageModelRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Difference</span>
                      <span className={`font-medium ${calculatorResult.comparison.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {calculatorResult.comparison.difference >= 0 ? "+" : ""}{formatCurrency(calculatorResult.comparison.difference)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Model Comparison</CardTitle>
              <CardDescription>Side-by-side comparison of all pricing models for a typical client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Client Size</th>
                      <th className="text-right p-2">Annual Hires</th>
                      <th className="text-right p-2">15% Model</th>
                      <th className="text-right p-2">Milestone Fee</th>
                      <th className="text-right p-2">Per-Screening</th>
                      <th className="text-right p-2">Deferred Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { size: "Small", hires: 250 },
                      { size: "Growing", hires: 500 },
                      { size: "Mid-Market", hires: 1000 },
                      { size: "Large", hires: 2000 },
                      { size: "Enterprise", hires: 5000 },
                    ].map((row) => {
                      const certRate = 0.07;
                      const avgCredit = 2800;
                      const certified = Math.round(row.hires * certRate);
                      const totalCredits = certified * avgCredit;
                      
                      const percentage = totalCredits * 0.15;
                      const milestone = (99 * 12) + (certified * 362);
                      const perScreening = (99 * 12) + (row.hires * 27);
                      const deferred = (199 * 12) + (totalCredits * 0.095);

                      return (
                        <tr key={row.size} className="border-b">
                          <td className="p-2 font-medium">{row.size}</td>
                          <td className="p-2 text-right">{row.hires.toLocaleString()}</td>
                          <td className="p-2 text-right">{formatCurrency(percentage)}</td>
                          <td className="p-2 text-right">{formatCurrency(milestone)}</td>
                          <td className="p-2 text-right">{formatCurrency(perScreening)}</td>
                          <td className="p-2 text-right">{formatCurrency(deferred)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                * Assumes 7% certification rate and $2,800 average credit. Milestone fee uses $362 avg per certification. Per-screening uses $27/hire. Deferred uses $199/mo + 9.5%.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
