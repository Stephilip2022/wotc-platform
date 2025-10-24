import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Calendar, Users, BarChart3, Headphones, Code, UserCheck, AlertCircle, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SubscriptionPlan, Subscription, Invoice } from "@shared/schema";

export default function BillingPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Check for success/cancel query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast({
        title: "Subscription Activated!",
        description: "Your subscription has been successfully activated.",
      });
      // Clear query params
      window.history.replaceState({}, "", "/employer/billing");
      // Invalidate subscription query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/employer/subscription"] });
    } else if (params.get("canceled") === "true") {
      toast({
        title: "Checkout Canceled",
        description: "You can subscribe anytime by selecting a plan below.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/employer/billing");
    }
  }, [toast]);

  // Fetch subscription plans
  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery<{
    subscription: Subscription;
    plan: SubscriptionPlan;
  } | null>({
    queryKey: ["/api/employer/subscription"],
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery<Array<{
    invoice: Invoice;
    subscription: Subscription | null;
    plan: SubscriptionPlan | null;
  }>>({
    queryKey: ["/api/employer/invoices"],
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: "monthly" | "annual" }) => {
      const res = await apiRequest("POST", "/api/employer/subscription/checkout", data);
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (planId: string, billingCycle: "monthly" | "annual") => {
    checkoutMutation.mutate({ planId, billingCycle });
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const features = [];
    
    if (plan.maxEmployees) {
      features.push({ icon: Users, text: `Up to ${plan.maxEmployees} employees` });
    } else {
      features.push({ icon: Users, text: "Unlimited employees" });
    }

    if (plan.maxScreeningsPerMonth) {
      features.push({ icon: Check, text: `${plan.maxScreeningsPerMonth} screenings/month` });
    } else {
      features.push({ icon: Check, text: "Unlimited screenings" });
    }

    if (plan.includeAnalytics) {
      features.push({ icon: BarChart3, text: "Advanced analytics dashboard" });
    }

    if (plan.includePrioritySupport) {
      features.push({ icon: Headphones, text: "Priority support" });
    }

    if (plan.includeApiAccess) {
      features.push({ icon: Code, text: "API access" });
    }

    if (plan.includeDedicatedAccountManager) {
      features.push({ icon: UserCheck, text: "Dedicated account manager" });
    }

    if (plan.perScreeningFee && Number(plan.perScreeningFee) > 0) {
      features.push({ icon: AlertCircle, text: `$${plan.perScreeningFee}/screening overage fee` });
    }

    return features;
  };

  if (plansLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your WOTC platform subscription and billing details
        </p>
      </div>

      {currentSubscription && (
        <Alert className="mb-8">
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  Current Plan: {currentSubscription.plan.displayName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Billing Cycle: {currentSubscription.subscription.billingCycle === "monthly" ? "Monthly" : "Annual"}
                  {currentSubscription.subscription.currentPeriodEnd && (
                    <> • Renews on {new Date(currentSubscription.subscription.currentPeriodEnd).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <Badge 
                variant={currentSubscription.subscription.status === "active" ? "default" : "secondary"}
                data-testid="badge-subscription-status"
              >
                {currentSubscription.subscription.status}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const features = getPlanFeatures(plan);
          const isCurrentPlan = currentSubscription?.plan.id === plan.id;
          const annualSavings = plan.annualPrice 
            ? ((Number(plan.monthlyPrice) * 12 - Number(plan.annualPrice)) / (Number(plan.monthlyPrice) * 12) * 100).toFixed(0)
            : null;

          return (
            <Card key={plan.id} className={isCurrentPlan ? "border-primary" : ""} data-testid={`card-plan-${plan.name}`}>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle>{plan.displayName}</CardTitle>
                  {isCurrentPlan && <Badge data-testid={`badge-current-plan-${plan.name}`}>Current Plan</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold" data-testid={`text-price-monthly-${plan.name}`}>${plan.monthlyPrice}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {plan.annualPrice && annualSavings && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-price-annual-${plan.name}`}>
                      or ${plan.annualPrice}/year (save {annualSavings}%)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <feature.icon className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-2">
                {!isCurrentPlan && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(plan.id, "monthly")}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-subscribe-${plan.name}-monthly`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Calendar className="h-4 w-4 mr-2" />
                      )}
                      Subscribe Monthly
                    </Button>
                    {plan.annualPrice && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleSubscribe(plan.id, "annual")}
                        disabled={checkoutMutation.isPending}
                        data-testid={`button-subscribe-${plan.name}-annual`}
                      >
                        {checkoutMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Subscribe Annually
                      </Button>
                    )}
                  </>
                )}
                {isCurrentPlan && (
                  <Button 
                    className="w-full" 
                    variant="secondary" 
                    disabled
                    data-testid={`button-current-plan-${plan.name}`}
                  >
                    Current Plan
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {currentSubscription && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Usage This Period</CardTitle>
              <CardDescription>
                Current billing period usage and limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Screenings</p>
                  <p className="text-2xl font-bold" data-testid="text-screenings-count">
                    {currentSubscription.subscription.screeningsThisPeriod || 0}
                    {currentSubscription.plan.maxScreeningsPerMonth && (
                      <span className="text-base text-muted-foreground font-normal">
                        {" "}/ {currentSubscription.plan.maxScreeningsPerMonth}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Credits Earned</p>
                  <p className="text-2xl font-bold" data-testid="text-credits-earned">
                    ${Number(currentSubscription.subscription.creditsEarnedThisPeriod || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice History */}
      <Card data-testid="card-invoice-history">
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>
            View and download your past invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm mt-1">Invoices will appear here after certifications are processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(({ invoice }) => {
                const statusColor = invoice.status === "paid" 
                  ? "default" 
                  : invoice.status === "open" 
                  ? "secondary" 
                  : "destructive";

                return (
                  <div 
                    key={invoice.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`invoice-item-${invoice.invoiceNumber}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium" data-testid={`text-invoice-number-${invoice.invoiceNumber}`}>
                          {invoice.invoiceNumber}
                        </h4>
                        <Badge variant={statusColor} data-testid={`badge-invoice-status-${invoice.invoiceNumber}`}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span data-testid={`text-invoice-date-${invoice.invoiceNumber}`}>
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </span>
                        {invoice.periodStart && invoice.periodEnd && (
                          <span>
                            Period: {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                          </span>
                        )}
                        {invoice.dueDate && invoice.status !== "paid" && (
                          <span className="text-orange-600 dark:text-orange-400">
                            Due: {new Date(invoice.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-lg" data-testid={`text-invoice-amount-${invoice.invoiceNumber}`}>
                          ${Number(invoice.totalAmount).toLocaleString()}
                        </div>
                        {invoice.status === "open" && (
                          <div className="text-sm text-muted-foreground">
                            Due: ${Number(invoice.amountDue).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setLocation(`/employer/invoice/${invoice.id}`)}
                        data-testid={`button-view-invoice-${invoice.invoiceNumber}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
