import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, CreditCard, Calendar, Users, BarChart3, Headphones, Code, UserCheck, AlertCircle, FileText, Download, XCircle, Settings, TrendingUp, TrendingDown } from "lucide-react";
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

  // Billing portal mutation (for payment method updates)
  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/employer/subscription/portal", {});
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/employer/subscription/cancel", {});
      return res.json();
    },
    onSuccess: (data: { message: string; cancelAt: string }) => {
      toast({
        title: "Subscription Canceled",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/subscription"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: "monthly" | "annual" }) => {
      const res = await apiRequest("POST", "/api/employer/subscription/change-plan", data);
      return res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Plan Updated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/subscription"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Plan Change Failed",
        description: error.message || "Failed to change plan",
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
        <>
          {currentSubscription.subscription.cancelAtPeriodEnd && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your subscription will be canceled on{" "}
                {currentSubscription.subscription.currentPeriodEnd 
                  ? new Date(currentSubscription.subscription.currentPeriodEnd).toLocaleDateString()
                  : "the end of the current period"}.
                You can resubscribe anytime.
              </AlertDescription>
            </Alert>
          )}
          
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Subscription</CardTitle>
                  <CardDescription>
                    Manage your subscription and billing settings
                  </CardDescription>
                </div>
                <Badge 
                  variant={currentSubscription.subscription.status === "active" ? "default" : "secondary"}
                  data-testid="badge-subscription-status"
                >
                  {currentSubscription.subscription.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Plan</p>
                    <p className="text-xl font-bold" data-testid="text-current-plan">
                      {currentSubscription.plan.displayName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Billing Cycle</p>
                    <p className="text-lg font-semibold">
                      {currentSubscription.subscription.billingCycle === "monthly" ? "Monthly" : "Annual"}
                    </p>
                  </div>
                  {currentSubscription.subscription.currentPeriodEnd && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {currentSubscription.subscription.cancelAtPeriodEnd ? "Ends On" : "Renews On"}
                      </p>
                      <p className="text-lg font-semibold">
                        {new Date(currentSubscription.subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => billingPortalMutation.mutate()}
                    disabled={billingPortalMutation.isPending}
                    data-testid="button-update-payment"
                  >
                    {billingPortalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Update Payment Method
                  </Button>
                  
                  {!currentSubscription.subscription.cancelAtPeriodEnd && (
                    <Button 
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.")) {
                          cancelMutation.mutate();
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      data-testid="button-cancel-subscription"
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
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
                {!currentSubscription && !isCurrentPlan && (
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
                
                {currentSubscription && !isCurrentPlan && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      const cycle = currentSubscription.subscription.billingCycle;
                      if (confirm(`Switch to ${plan.displayName}? Your billing will be prorated.`)) {
                        changePlanMutation.mutate({ planId: plan.id, billingCycle: cycle });
                      }
                    }}
                    disabled={changePlanMutation.isPending}
                    data-testid={`button-change-to-${plan.name}`}
                  >
                    {changePlanMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : Number(plan.monthlyPrice) > Number(currentSubscription.plan.monthlyPrice) ? (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-2" />
                    )}
                    {Number(plan.monthlyPrice) > Number(currentSubscription.plan.monthlyPrice) ? "Upgrade" : "Downgrade"} to {plan.displayName}
                  </Button>
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
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Usage This Period</CardTitle>
              <CardDescription>
                Current billing period usage and limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Screenings</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-screenings-count">
                      {currentSubscription.subscription.screeningsThisPeriod || 0}
                      {currentSubscription.plan.maxScreeningsPerMonth && (
                        <> / {currentSubscription.plan.maxScreeningsPerMonth}</>
                      )}
                      {!currentSubscription.plan.maxScreeningsPerMonth && <> (Unlimited)</>}
                    </p>
                  </div>
                  {currentSubscription.plan.maxScreeningsPerMonth && (
                    <Progress 
                      value={Math.min(
                        ((currentSubscription.subscription.screeningsThisPeriod || 0) / currentSubscription.plan.maxScreeningsPerMonth) * 100,
                        100
                      )} 
                      className="h-2"
                      data-testid="progress-screenings"
                    />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Credits Earned This Period</p>
                    <p className="text-xl font-bold" data-testid="text-credits-earned">
                      ${Number(currentSubscription.subscription.creditsEarnedThisPeriod || 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Processing fee: {currentSubscription.plan.perCreditFee}% • Screening fee: ${currentSubscription.plan.perScreeningFee}
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
