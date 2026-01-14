import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DollarSign, Percent, TrendingUp, Users, Calendar, Check } from "lucide-react";

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  pricingModel: string;
  percentageRate: string | null;
  deferredConfig: any;
  monthlySubscriptionFee: string;
  isDefault: boolean;
}

interface EmployerBillingPreferencesProps {
  employerId: string;
  onSave?: () => void;
  compact?: boolean;
}

export function EmployerBillingPreferences({ employerId, onSave, compact = false }: EmployerBillingPreferencesProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const { data: plans = [], isLoading: plansLoading } = useQuery<PricingPlan[]>({
    queryKey: ["/api/pricing/plans"],
  });

  const { data: currentBilling, isLoading: billingLoading } = useQuery<{ billing: any; plan: any } | null>({
    queryKey: ["/api/pricing/employer", employerId],
    enabled: !!employerId,
  });

  useEffect(() => {
    if (currentBilling?.billing?.pricingPlanId) {
      setSelectedPlanId(currentBilling.billing.pricingPlanId);
    } else if (plans.length > 0) {
      const defaultPlan = plans.find(p => p.isDefault);
      if (defaultPlan) {
        setSelectedPlanId(defaultPlan.id);
      }
    }
  }, [currentBilling, plans]);

  const assignPlanMutation = useMutation({
    mutationFn: async (pricingPlanId: string) => {
      const res = await apiRequest("POST", `/api/pricing/employer/${employerId}/assign`, { pricingPlanId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/employer", employerId] });
      toast({ title: "Billing preferences saved" });
      onSave?.();
    },
    onError: (error: any) => {
      toast({ title: "Error saving preferences", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (selectedPlanId) {
      assignPlanMutation.mutate(selectedPlanId);
    }
  };

  const getPricingModelIcon = (model: string) => {
    switch (model) {
      case "percentage": return <Percent className="h-5 w-5" />;
      case "milestone_flat_fee": return <TrendingUp className="h-5 w-5" />;
      case "per_screening": return <Users className="h-5 w-5" />;
      case "deferred_annual": return <Calendar className="h-5 w-5" />;
      default: return <DollarSign className="h-5 w-5" />;
    }
  };

  const getPlanSummary = (plan: PricingPlan) => {
    switch (plan.pricingModel) {
      case "percentage":
        return `${plan.percentageRate}% of captured credits`;
      case "milestone_flat_fee":
        return `$${plan.monthlySubscriptionFee}/mo + flat fees per milestone`;
      case "per_screening":
        return `$${plan.monthlySubscriptionFee}/mo + per-screening fee`;
      case "deferred_annual":
        return plan.deferredConfig 
          ? `$${plan.deferredConfig.monthlyBase}/mo + ${plan.deferredConfig.annualPercentage}% annually`
          : "Deferred annual billing";
      default:
        return plan.description;
    }
  };

  if (plansLoading || billingLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            No pricing plans available. Contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
          {plans.map((plan) => (
            <div key={plan.id} className="flex items-start space-x-3 p-3 border rounded-lg hover-elevate">
              <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" data-testid={`radio-plan-${plan.id}`} />
              <div className="flex-1">
                <Label htmlFor={plan.id} className="flex items-center gap-2 cursor-pointer">
                  {getPricingModelIcon(plan.pricingModel)}
                  <span className="font-medium">{plan.name}</span>
                  {plan.isDefault && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">{getPlanSummary(plan)}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
        
        <Button 
          onClick={handleSave} 
          disabled={!selectedPlanId || assignPlanMutation.isPending}
          className="w-full"
          data-testid="button-save-billing"
        >
          {assignPlanMutation.isPending ? "Saving..." : "Save Billing Preferences"}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Preferences</CardTitle>
        <CardDescription>Select your preferred pricing model</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`relative flex items-start space-x-4 p-4 border rounded-lg transition-colors ${
                selectedPlanId === plan.id ? "border-primary bg-primary/5" : "hover-elevate"
              }`}
            >
              <RadioGroupItem value={plan.id} id={plan.id} className="mt-1" data-testid={`radio-plan-${plan.id}`} />
              <div className="flex-1">
                <Label htmlFor={plan.id} className="flex items-center gap-2 cursor-pointer text-base">
                  {getPricingModelIcon(plan.pricingModel)}
                  <span className="font-semibold">{plan.name}</span>
                  {plan.isDefault && <Badge variant="default">Recommended</Badge>}
                </Label>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                <p className="text-sm font-medium mt-2">{getPlanSummary(plan)}</p>
              </div>
              {selectedPlanId === plan.id && (
                <Check className="h-5 w-5 text-primary absolute top-4 right-4" />
              )}
            </div>
          ))}
        </RadioGroup>

        <Separator />

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={!selectedPlanId || assignPlanMutation.isPending}
            data-testid="button-save-billing"
          >
            {assignPlanMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
