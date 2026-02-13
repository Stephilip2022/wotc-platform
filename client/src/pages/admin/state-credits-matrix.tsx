import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Grid3X3,
  Info,
  Building2,
  MapPin,
  FileText,
  Briefcase,
} from "lucide-react";

interface ProgramDetail {
  id: string;
  state: string;
  programName: string;
  programDescription: string;
  programCategory: string;
  agencyToWorkWith: string;
  informationNeededToCertify: string;
  leverageType: string;
  creditFormula: string;
  maxCreditAmount: string | null;
  tier: string;
  isActive: boolean;
}

type SortField = "programName" | "state" | "programCategory" | "tier" | "agencyToWorkWith";
type SortDir = "asc" | "desc";

const LEVERAGE_LABELS: Record<string, string> = {
  wage_percentage: "Wage-based percentage credit",
  per_employee_flat_plus_wage: "Flat amount per employee plus wage-based component",
  percentage_of_expenditure: "Percentage of qualified expenditures",
  flat_per_employee: "Flat credit per qualifying employee",
  tiered_by_hours: "Tiered credit based on hours worked",
};

const CATEGORY_LABELS: Record<string, string> = {
  veteran_credit: "Veteran",
  disability_credit: "Disability",
  reentry_credit: "Re-entry",
  youth_training_credit: "Youth/Training",
  enterprise_zone_credit: "Enterprise Zone",
  historic_rehabilitation: "Historic Rehab",
  general_screening: "General",
};

function getCategoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category;
}

function getLeverageLabel(type: string) {
  return LEVERAGE_LABELS[type] || type;
}

function getTierLabel(tier: string) {
  switch (tier) {
    case "1": return "Tier 1 (Auto-screen)";
    case "2": return "Tier 2 (Extra Questions)";
    case "3": return "Tier 3 (Specialized)";
    default: return `Tier ${tier}`;
  }
}

function getCaptureStrategy(program: ProgramDetail): string {
  const parts: string[] = [];

  if (program.leverageType === "wage_percentage") {
    parts.push("Screen employees using WOTC-aligned questionnaire to identify eligibility.");
    parts.push("Collect wage records and hours worked data from employer payroll.");
    parts.push("Calculate credit as percentage of qualifying wages.");
  } else if (program.leverageType === "per_employee_flat_plus_wage") {
    parts.push("Verify employer worksite is within designated zone boundaries.");
    parts.push("Screen new hires for zone residency and employment eligibility.");
    parts.push("Submit zone certification along with employee wage documentation.");
  } else if (program.leverageType === "percentage_of_expenditure") {
    parts.push("Collect documentation of qualified expenditures from employer.");
    parts.push("Verify project meets program-specific certification requirements.");
    parts.push("Submit application to certifying agency with expenditure records.");
  } else if (program.leverageType === "flat_per_employee") {
    parts.push("Screen employees using target group criteria aligned with program rules.");
    parts.push("Collect required documentation (hire date, job details, eligibility proof).");
    parts.push("Submit per-employee certification to administering agency.");
  } else if (program.leverageType === "tiered_by_hours") {
    parts.push("Track employee hours worked to determine credit tier eligibility.");
    parts.push("Collect payroll data to verify hours thresholds (120/400 hour milestones).");
    parts.push("Calculate tiered credit amount based on hours worked and wage data.");
  } else {
    parts.push("Review program-specific criteria and documentation requirements.");
    parts.push("Collect relevant employee/employer data for certification.");
  }

  parts.push(`Submit to ${program.agencyToWorkWith || "state agency"} for certification and approval.`);

  if (program.informationNeededToCertify) {
    parts.push(`Required info: ${program.informationNeededToCertify}`);
  }

  return parts.join(" ");
}

export default function StateCreditsMatrixPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("state");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProgram, setSelectedProgram] = useState<ProgramDetail | null>(null);

  const { data: programs = [], isLoading } = useQuery<ProgramDetail[]>({
    queryKey: ["/api/tax-programs/programs"],
  });

  const uniqueStates = useMemo(
    () => Array.from(new Set(programs.map((p) => p.state))).sort(),
    [programs]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(programs.map((p) => p.programCategory))).sort(),
    [programs]
  );

  const filtered = useMemo(() => {
    let result = programs.filter((p) => {
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      if (categoryFilter !== "all" && p.programCategory !== categoryFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.programName.toLowerCase().includes(term) ||
          p.state.toLowerCase().includes(term) ||
          (p.agencyToWorkWith || "").toLowerCase().includes(term) ||
          (p.programDescription || "").toLowerCase().includes(term)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      const aVal = (a[sortField] || "").toLowerCase();
      const bVal = (b[sortField] || "").toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [programs, stateFilter, categoryFilter, searchTerm, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-3 w-3 inline" /> : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  }

  function handleExportCSV() {
    const headers = ["Program Name", "State", "Category", "Tier", "Description", "Certifying Agency", "Capture Strategy", "Credit Formula", "Max Credit Amount"];
    const rows = filtered.map((p) => [
      p.programName,
      p.state,
      getCategoryLabel(p.programCategory),
      getTierLabel(p.tier),
      (p.programDescription || "").replace(/"/g, '""'),
      p.agencyToWorkWith || "",
      getCaptureStrategy(p).replace(/"/g, '""'),
      getLeverageLabel(p.leverageType),
      p.maxCreditAmount ? `$${Number(p.maxCreditAmount).toLocaleString()}` : "Varies",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "state_credits_matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">State Credits Matrix</h1>
          <p className="text-muted-foreground">
            Comprehensive reference of all {programs.length} state-specific credit programs across {uniqueStates.length} states
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0} data-testid="button-export-csv">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Programs</p>
                <p className="text-2xl font-bold" data-testid="text-total-programs">{programs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">States Covered</p>
                <p className="text-2xl font-bold" data-testid="text-states-covered">{uniqueStates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Agencies</p>
                <p className="text-2xl font-bold" data-testid="text-agencies-count">
                  {new Set(programs.map((p) => p.agencyToWorkWith).filter(Boolean)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Showing</p>
                <p className="text-2xl font-bold" data-testid="text-showing-count">{filtered.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Program Detail Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, state, agency, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-matrix"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-state-filter">
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
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((c) => (
                  <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Grid3X3 className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium mb-1">No programs found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px] cursor-pointer select-none" onClick={() => handleSort("programName")} data-testid="th-program-name">
                      Program Name <SortIcon field="programName" />
                    </TableHead>
                    <TableHead className="min-w-[100px] cursor-pointer select-none" onClick={() => handleSort("state")} data-testid="th-state">
                      State <SortIcon field="state" />
                    </TableHead>
                    <TableHead className="min-w-[120px] cursor-pointer select-none" onClick={() => handleSort("programCategory")} data-testid="th-category">
                      Category <SortIcon field="programCategory" />
                    </TableHead>
                    <TableHead className="min-w-[250px]" data-testid="th-description">
                      Description
                    </TableHead>
                    <TableHead className="min-w-[180px] cursor-pointer select-none" onClick={() => handleSort("agencyToWorkWith")} data-testid="th-agency">
                      Certifying Agency <SortIcon field="agencyToWorkWith" />
                    </TableHead>
                    <TableHead className="min-w-[250px]" data-testid="th-capture">
                      How to Capture Credit
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((program) => (
                    <TableRow key={program.id} data-testid={`row-matrix-${program.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${program.id}`}>
                        {program.programName}
                      </TableCell>
                      <TableCell data-testid={`text-state-${program.id}`}>
                        <Badge variant="outline">{program.state}</Badge>
                      </TableCell>
                      <TableCell data-testid={`text-category-${program.id}`}>
                        <Badge variant="secondary">{getCategoryLabel(program.programCategory)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px]" data-testid={`text-desc-${program.id}`}>
                        <span className="line-clamp-3">{program.programDescription || "—"}</span>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-agency-${program.id}`}>
                        {program.agencyToWorkWith || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px]" data-testid={`text-capture-${program.id}`}>
                        <span className="line-clamp-3">{getCaptureStrategy(program)}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedProgram(program)}
                          data-testid={`button-detail-${program.id}`}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedProgram} onOpenChange={(open) => !open && setSelectedProgram(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedProgram && (
            <>
              <DialogHeader>
                <DialogTitle data-testid="text-dialog-title">{selectedProgram.programName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedProgram.state}</Badge>
                  <Badge variant="secondary">{getCategoryLabel(selectedProgram.programCategory)}</Badge>
                  <Badge variant="outline">{getTierLabel(selectedProgram.tier)}</Badge>
                  {selectedProgram.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedProgram.programDescription || "No description available."}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-1">Certifying / Approving Agency</h4>
                  <p className="text-sm">{selectedProgram.agencyToWorkWith || "Not specified"}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">Credit Structure</h4>
                  <p className="text-sm">{getLeverageLabel(selectedProgram.leverageType)}</p>
                  {selectedProgram.maxCreditAmount && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Maximum credit: ${Number(selectedProgram.maxCreditAmount).toLocaleString()} per qualifying employee
                    </p>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-1">Information Needed to Certify</h4>
                  <p className="text-sm text-muted-foreground">{selectedProgram.informationNeededToCertify || "Standard program documentation required."}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">How Our Team Captures This Credit</h4>
                  <p className="text-sm text-muted-foreground">{getCaptureStrategy(selectedProgram)}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
