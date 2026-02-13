import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, RefreshCw, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function EmployerCreditsPage() {
  const { toast } = useToast();

  // Fetch credits
  const { data: credits, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employer/credits"],
  });

  // Recalculate all mutation
  const recalculateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/employer/credits/recalculate-all", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/credits"] });
      toast({
        title: "Credits Recalculated",
        description: `Successfully recalculated ${data.recalculated} credit(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to recalculate credits",
        variant: "destructive",
      });
    },
  });

  // Calculate totals
  const totalProjected = credits?.reduce((sum: number, item: any) => sum + Number(item.credit.projectedCreditAmount || 0), 0) || 0;
  const totalActual = credits?.reduce((sum: number, item: any) => sum + Number(item.credit.actualCreditAmount || 0), 0) || 0;
  const totalMax = credits?.reduce((sum: number, item: any) => sum + Number(item.credit.maxCreditAmount || 0), 0) || 0;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      projected: "secondary",
      in_progress: "default",
      claimed: "default",
      denied: "destructive",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status?.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getProgressPercentage = (hours: number, required: number) => {
    return Math.min((hours / required) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">WOTC Credits</h1>
          <p className="text-muted-foreground">
            Track and manage your Work Opportunity Tax Credits
          </p>
        </div>
        <Button
          onClick={() => recalculateAllMutation.mutate()}
          disabled={recalculateAllMutation.isPending}
          data-testid="button-recalculate-all"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${recalculateAllMutation.isPending ? "animate-spin" : ""}`} />
          Recalculate All
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Max Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-max">
              ${totalMax.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum potential value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Credits</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-projected">
              ${totalProjected.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on initial eligibility
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Credits</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-actual">
              ${totalActual.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on actual hours worked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credits Table */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Details ({credits?.length || 0})</CardTitle>
          <CardDescription>Individual credit calculations for each certified employee</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !credits || credits.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No credits calculated yet</p>
              <p className="text-sm text-muted-foreground">
                Credits will appear here once employees are certified and hours are tracked
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {credits.map((item: any) => {
                const hoursProgress = getProgressPercentage(
                  item.credit.hoursWorked || 0,
                  item.credit.minimumHoursRequired || 120
                );
                const isCompleted = (item.credit.hoursWorked || 0) >= (item.credit.minimumHoursRequired || 120);

                return (
                  <div
                    key={item.credit.id}
                    className="border rounded-lg p-4"
                    data-testid={`credit-row-${item.credit.id}`}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold" data-testid={`employee-name-${item.credit.id}`}>
                            {item.employee?.firstName} {item.employee?.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Target Group: {item.credit.targetGroup}
                          </p>
                        </div>
                        {getStatusBadge(item.credit.status)}
                      </div>

                      {/* Hours Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Hours Worked Progress</span>
                          <span className="font-medium">
                            {item.credit.hoursWorked || 0} / {item.credit.minimumHoursRequired || 120} hours
                          </span>
                        </div>
                        <Progress value={hoursProgress} className="h-2" />
                        {!isCompleted && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {(item.credit.minimumHoursRequired || 120) - (item.credit.hoursWorked || 0)} more hours needed
                          </p>
                        )}
                      </div>

                      {/* Credit Amounts */}
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Max Credit</p>
                          <p className="text-lg font-semibold">
                            ${Number(item.credit.maxCreditAmount || 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Projected</p>
                          <p className="text-lg font-semibold">
                            ${Number(item.credit.projectedCreditAmount || 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Actual</p>
                          <p className="text-lg font-semibold text-primary">
                            ${Number(item.credit.actualCreditAmount || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Additional Info */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Wages: ${Number(item.credit.wagesEarned || 0).toLocaleString()}</span>
                        <span>
                          Last Updated: {new Date(item.credit.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
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
