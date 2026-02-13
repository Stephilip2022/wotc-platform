import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Search,
  Database,
  Sparkles,
  CheckCircle,
  BarChart3,
  Layers,
  Filter,
  Users,
} from "lucide-react";

interface TaxCreditProgram {
  id: string;
  state: string;
  programName: string;
  programCategory: string;
  programDescription?: string;
  tier: string;
  isActive: boolean;
  leverageType?: string;
  informationNeededToCertify?: string;
  agencyToWorkWith?: string;
}

interface ProgramStats {
  totalPrograms: number;
  activePrograms: number;
  byState: Array<{ state: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byTier: Array<{ tier: string; count: number }>;
  totalAssignments: number;
  enabledAssignments: number;
}

interface EmployerAssignment {
  assignment: {
    id: string;
    employerId: string;
    programId: string;
    isEnabled: boolean;
    isRecommended?: boolean;
  };
  program: TaxCreditProgram;
}

interface Employer {
  id: string;
  name: string;
  state: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  veteran_credit: "Veteran",
  disability_credit: "Disability",
  reentry_credit: "Re-entry",
  youth_training_credit: "Youth/Training",
  enterprise_zone_credit: "Enterprise Zone",
  historic_rehabilitation: "Historic Rehab",
  general_screening: "General",
};

const CATEGORY_VARIANTS: Record<string, string> = {
  veteran_credit: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  disability_credit: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  reentry_credit: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  youth_training_credit: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  enterprise_zone_credit: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  historic_rehabilitation: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  general_screening: "",
};

const TIER_LABELS: Record<string, string> = {
  "1": "Tier 1 (Auto-screen)",
  "2": "Tier 2 (Extra Questions)",
  "3": "Tier 3 (Specialized)",
};

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category;
}

function getTierLabel(tier: number | string) {
  return TIER_LABELS[String(tier)] || `Tier ${tier}`;
}

export default function TaxProgramsPage() {
  const { toast } = useToast();
  const [stateFilter, setStateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployerId, setSelectedEmployerId] = useState<string>("");

  const { data: stats, isLoading: statsLoading } = useQuery<ProgramStats>({
    queryKey: ["/api/tax-programs/stats"],
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<TaxCreditProgram[]>({
    queryKey: ["/api/tax-programs/programs"],
  });

  const { data: employers = [] } = useQuery<Employer[]>({
    queryKey: ["/api/admin/employers"],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<EmployerAssignment[]>({
    queryKey: ["/api/tax-programs/employer", selectedEmployerId, "assignments"],
    enabled: !!selectedEmployerId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tax-programs/seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-programs"] });
      toast({ title: "C2ER Data Imported", description: `${data.count || "All"} programs imported successfully.` });
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleProgramMutation = useMutation({
    mutationFn: async (programId: string) => {
      const res = await apiRequest("PATCH", `/api/tax-programs/programs/${programId}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-programs"] });
    },
    onError: (error: any) => {
      toast({ title: "Toggle Failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("PATCH", `/api/tax-programs/employer/${selectedEmployerId}/assignments/${assignmentId}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-programs/employer", selectedEmployerId, "assignments"] });
    },
    onError: (error: any) => {
      toast({ title: "Toggle Failed", description: error.message, variant: "destructive" });
    },
  });

  const recommendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tax-programs/employer/${selectedEmployerId}/recommend`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-programs/employer", selectedEmployerId, "assignments"] });
      toast({ title: "Recommendations Generated", description: `${data.recommended?.length || 0} programs recommended.` });
    },
    onError: (error: any) => {
      toast({ title: "Recommendation Failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (programIds: string[]) => {
      const res = await apiRequest("POST", `/api/tax-programs/employer/${selectedEmployerId}/bulk-assign`, {
        programIds,
        isEnabled: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax-programs/employer", selectedEmployerId, "assignments"] });
      toast({ title: "Programs Enabled", description: "All recommended programs have been enabled." });
    },
    onError: (error: any) => {
      toast({ title: "Bulk Assign Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredPrograms = programs.filter((p) => {
    if (stateFilter !== "all" && p.state !== stateFilter) return false;
    if (categoryFilter !== "all" && p.programCategory !== categoryFilter) return false;
    if (tierFilter !== "all" && String(p.tier) !== tierFilter) return false;
    if (searchTerm && !p.programName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const uniqueStates = Array.from(new Set(programs.map((p) => p.state))).sort();
  const uniqueCategories = Array.from(new Set(programs.map((p) => p.programCategory))).sort();

  const recommendedAssignments = assignments.filter((a) => a.assignment.isRecommended);
  const recommendedNotEnabled = recommendedAssignments.filter((a) => !a.assignment.isEnabled);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Tax Credit Programs</h1>
          <p className="text-muted-foreground">Manage the catalog of tax credit programs from the C2ER database</p>
        </div>
        {stats && stats.totalPrograms === 0 && (
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            data-testid="button-seed-data"
          >
            <Database className="mr-2 h-4 w-4" />
            {seedMutation.isPending ? "Importing..." : "Seed C2ER Data"}
          </Button>
        )}
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Programs</p>
                  <p className="text-2xl font-bold" data-testid="text-total-programs">{stats.totalPrograms}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Programs</p>
                  <p className="text-2xl font-bold" data-testid="text-active-programs">{stats.activePrograms}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tier 1 Programs</p>
                  <p className="text-2xl font-bold" data-testid="text-tier1-count">
                    {stats.byTier?.find((t: any) => t.tier === "1")?.count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tier 2/3 Programs</p>
                  <p className="text-2xl font-bold" data-testid="text-tier23-count">
                    {(stats.byTier?.find((t: any) => t.tier === "2")?.count || 0) + (stats.byTier?.find((t: any) => t.tier === "3")?.count || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Program Catalog
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search programs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-programs"
                  />
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-state-filter">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-tier-filter">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="1">Tier 1 (Auto-screen)</SelectItem>
                    <SelectItem value="2">Tier 2 (Extra Questions)</SelectItem>
                    <SelectItem value="3">Tier 3 (Specialized)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {programsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium mb-1">No programs found</p>
                  <p className="text-sm">
                    {programs.length === 0
                      ? "Import C2ER data to get started"
                      : "Try adjusting your filters"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredPrograms.map((program) => (
                    <div
                      key={program.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md border"
                      data-testid={`row-program-${program.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                        <Badge variant="outline" className="shrink-0" data-testid={`badge-state-${program.id}`}>
                          {program.state}
                        </Badge>
                        <span className="font-medium truncate" data-testid={`text-program-name-${program.id}`}>
                          {program.programName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`shrink-0 ${CATEGORY_VARIANTS[program.programCategory] || ""}`}
                          data-testid={`badge-category-${program.id}`}
                        >
                          {getCategoryLabel(program.programCategory)}
                        </Badge>
                        <Badge variant="outline" className="shrink-0" data-testid={`badge-tier-${program.id}`}>
                          {getTierLabel(program.tier)}
                        </Badge>
                      </div>
                      <Switch
                        checked={program.isActive}
                        onCheckedChange={() => toggleProgramMutation.mutate(program.id)}
                        data-testid={`switch-program-active-${program.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {filteredPrograms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Showing {filteredPrograms.length} of {programs.length} programs
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employer Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedEmployerId} onValueChange={setSelectedEmployerId}>
                <SelectTrigger data-testid="select-employer">
                  <SelectValue placeholder="Select an employer..." />
                </SelectTrigger>
                <SelectContent>
                  {employers.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}{emp.state ? ` (${emp.state})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEmployerId && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => recommendMutation.mutate()}
                      disabled={recommendMutation.isPending}
                      data-testid="button-smart-recommend"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {recommendMutation.isPending ? "Analyzing..." : "Smart Recommend"}
                    </Button>
                    {recommendedNotEnabled.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const programIds = recommendedNotEnabled.map((a) => a.assignment.programId);
                          bulkAssignMutation.mutate(programIds);
                        }}
                        disabled={bulkAssignMutation.isPending}
                        data-testid="button-enable-all-recommended"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Enable All Recommended ({recommendedNotEnabled.length})
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {assignmentsLoading ? (
                    <div className="flex items-center justify-center h-24">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No programs assigned yet.</p>
                      <p className="text-sm">Use Smart Recommend to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {assignments.map((item) => (
                        <div
                          key={item.assignment.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-md border"
                          data-testid={`row-assignment-${item.assignment.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate" data-testid={`text-assignment-name-${item.assignment.id}`}>
                                {item.program.programName}
                              </span>
                              {item.assignment.isRecommended && (
                                <Badge variant="default" className="shrink-0" data-testid={`badge-recommended-${item.assignment.id}`}>
                                  Recommended
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.program.state}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${CATEGORY_VARIANTS[item.program.programCategory] || ""}`}
                              >
                                {getCategoryLabel(item.program.programCategory)}
                              </Badge>
                            </div>
                          </div>
                          <Switch
                            checked={item.assignment.isEnabled}
                            onCheckedChange={() => toggleAssignmentMutation.mutate(item.assignment.id)}
                            data-testid={`switch-assignment-${item.assignment.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {assignments.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {assignments.filter((a) => a.assignment.isEnabled).length} of {assignments.length} programs enabled
                    </p>
                  )}
                </>
              )}

              {!selectedEmployerId && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Select an employer to manage their program assignments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
