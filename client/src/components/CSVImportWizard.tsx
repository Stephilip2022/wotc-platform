import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, ArrowRight, ArrowLeft, Check, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DetectedColumn {
  name: string;
  dataType: string;
  sampleValues: string[];
  suggestedField?: string;
  confidence?: number;
}

interface ImportSession {
  id: string;
  fileName: string;
  rowCount: number;
  detectedColumns: DetectedColumn[];
  columnMappings?: Record<string, string>;
  employeeMatchStrategy?: string;
  status: string;
}

const TARGET_FIELDS = [
  { value: "employeeId", label: "Employee ID" },
  { value: "ssn", label: "SSN" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "hours", label: "Hours Worked" },
  { value: "periodStart", label: "Period Start Date" },
  { value: "periodEnd", label: "Period End Date" },
  { value: "notes", label: "Notes" },
  { value: "_ignore", label: "-- Ignore Column --" },
];

const MATCH_STRATEGIES = [
  { value: "id", label: "Employee ID (fastest, most reliable)" },
  { value: "ssn", label: "SSN (reliable if available)" },
  { value: "email", label: "Email Address" },
  { value: "name", label: "Name Matching (fuzzy, handles typos)" },
  { value: "auto", label: "Auto-detect (try all methods)" },
];

interface CSVImportWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function CSVImportWizard({ open, onClose, onComplete }: CSVImportWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [matchStrategy, setMatchStrategy] = useState("auto");
  const [templateName, setTemplateName] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);

  // Fetch saved templates
  const { data: templates } = useQuery({
    queryKey: ["/api/employer/hours/import/templates"],
    enabled: open,
  });

  // Step 1: Upload and parse CSV
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("POST", "/api/employer/hours/import/init", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setSession({
        id: data.sessionId,
        fileName: csvFile?.name || "",
        rowCount: data.rowCount,
        detectedColumns: data.columns,
        status: "mapping",
      });
      
      // Auto-populate mappings based on suggestions
      const autoMappings: Record<string, string> = {};
      data.columns.forEach((col: DetectedColumn) => {
        if (col.suggestedField && col.confidence && col.confidence >= 0.8) {
          autoMappings[col.name] = col.suggestedField;
        }
      });
      setColumnMappings(autoMappings);
      setStep(2);
      
      toast({
        title: "CSV Parsed Successfully",
        description: `Found ${data.rowCount} rows with ${data.columns.length} columns`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive",
      });
    },
  });

  // Step 2: Save column mappings
  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("No session");
      const response = await apiRequest("PATCH", `/api/employer/hours/import/${session.id}/mappings`, {
        columnMappings,
        employeeMatchStrategy: matchStrategy,
      });
      return response.json();
    },
    onSuccess: () => {
      setStep(3);
      // Auto-trigger preview generation
      setTimeout(() => previewMutation.mutate(), 100);
      toast({
        title: "Mappings Saved",
        description: "Generating preview with employee matching...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save mappings",
        variant: "destructive",
      });
    },
  });

  // Step 3: Generate preview with employee matching
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!session || !csvFile) throw new Error("No session or file");
      const formData = new FormData();
      formData.append("file", csvFile);
      const response = await apiRequest("POST", `/api/employer/hours/import/${session.id}/preview`, formData);
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      toast({
        title: "Preview Ready",
        description: `Processed ${data.totalRows} rows: ${data.successCount} valid, ${data.errorCount} errors`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
    },
  });

  // Save as template
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/employer/hours/import/templates", {
        name: templateName,
        description: `Auto-saved from ${csvFile?.name}`,
        columnMappings,
        employeeMatchStrategy: matchStrategy,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/hours/import/templates"] });
      toast({
        title: "Template Saved",
        description: `Mapping template "${templateName}" saved for future use`,
      });
      setTemplateName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setCsvFile(file);
    }
  };

  const handleUpload = () => {
    if (csvFile) {
      uploadMutation.mutate(csvFile);
    }
  };

  const handleMappingChange = (columnName: string, targetField: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [columnName]: targetField,
    }));
  };

  const loadTemplate = (template: any) => {
    setColumnMappings(template.columnMappings || {});
    setMatchStrategy(template.employeeMatchStrategy || "auto");
    toast({
      title: "Template Loaded",
      description: `Loaded mapping from "${template.name}"`,
    });
  };

  const handleClose = () => {
    setStep(1);
    setCsvFile(null);
    setSession(null);
    setColumnMappings({});
    setMatchStrategy("auto");
    setTemplateName("");
    onClose();
  };

  const getMappedFieldsCount = () => {
    return Object.values(columnMappings).filter(f => f && f !== "_ignore").length;
  };

  const isReadyForPreview = () => {
    // Must have at least employeeId/SSN/email and hours mapped
    const values = Object.values(columnMappings);
    const hasEmployeeIdentifier = 
      values.includes("employeeId") || 
      values.includes("ssn") || 
      values.includes("email") ||
      (values.includes("firstName") && values.includes("lastName"));
    const hasHours = values.includes("hours");
    return hasEmployeeIdentifier && hasHours;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Enhanced CSV Import
          </DialogTitle>
          <DialogDescription>
            Import payroll hours data with smart field mapping and validation
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={step >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
              1. Upload
            </span>
            <span className={step >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
              2. Map Columns
            </span>
            <span className={step >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
              3. Preview & Import
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2" data-testid="progress-import-wizard" />
        </div>

        {/* Step 1: Upload CSV */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload CSV File
                </CardTitle>
                <CardDescription>
                  Select your payroll CSV file to begin the import process
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    data-testid="input-csv-file"
                  />
                  {csvFile ? (
                    <p className="text-sm text-muted-foreground">
                      Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                    </p>
                  ) : null}
                </div>

                {/* Saved templates */}
                {templates && Array.isArray(templates) && templates.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Or load a saved template</Label>
                    <div className="grid gap-2">
                      {(templates as any[]).slice(0, 3).map((template: any) => (
                        <Card key={template.id} className="hover-elevate cursor-pointer" onClick={() => loadTemplate(template)}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{template.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {template.description}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                {template.employeeMatchStrategy || "auto"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && session && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Map CSV Columns
                </CardTitle>
                <CardDescription>
                  Match your CSV columns to the required fields ({getMappedFieldsCount()} of {session.detectedColumns.length} columns mapped)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Employee match strategy */}
                <div className="space-y-2">
                  <Label>Employee Matching Strategy</Label>
                  <Select value={matchStrategy} onValueChange={setMatchStrategy}>
                    <SelectTrigger data-testid="select-match-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATCH_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          {strategy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How should we match CSV rows to your employees?
                  </p>
                </div>

                {/* Column mappings */}
                <div className="space-y-3">
                  <Label>Column Mappings</Label>
                  <div className="border rounded-md divide-y">
                    {session.detectedColumns.map((column) => (
                      <div key={column.name} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{column.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {column.dataType}
                              </Badge>
                              {column.suggestedField && column.confidence && column.confidence >= 0.8 && (
                                <Badge variant="default" className="text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Suggested
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {column.sampleValues.slice(0, 3).map((sample, idx) => (
                                <span key={idx} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                  {sample}
                                </span>
                              ))}
                            </div>
                          </div>
                          <Select
                            value={columnMappings[column.name] || ""}
                            onValueChange={(value) => handleMappingChange(column.name, value)}
                          >
                            <SelectTrigger className="w-[200px]" data-testid={`select-mapping-${column.name}`}>
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation warnings */}
                {!isReadyForPreview() && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Required mappings missing:</strong> You must map at least one employee identifier (ID, SSN, email, or name) and hours worked.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Save as template */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Save as Template (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Template name (e.g., 'ADP Weekly Payroll')"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      data-testid="input-template-name"
                    />
                    <Button
                      variant="outline"
                      onClick={() => saveTemplateMutation.mutate()}
                      disabled={!templateName.trim() || saveTemplateMutation.isPending}
                      data-testid="button-save-template"
                    >
                      Save Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && session && (
          <div className="space-y-4">
            {previewMutation.isPending ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-3">
                    <Progress value={undefined} className="h-2" />
                    <p className="text-sm text-muted-foreground">
                      Matching employees and validating data...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : previewData ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Import Preview</CardTitle>
                    <CardDescription>
                      {previewData.successCount} of {previewData.totalRows} rows ready to import
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Rows</p>
                        <p className="font-semibold text-lg">{previewData.totalRows}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valid</p>
                        <p className="font-semibold text-lg text-green-600">{previewData.successCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Errors</p>
                        <p className="font-semibold text-lg text-red-600">{previewData.errorCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Strategy</p>
                        <p className="font-semibold text-sm capitalize">{matchStrategy}</p>
                      </div>
                    </div>

                    {previewData.errorCount > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {previewData.errorCount} row(s) have validation errors and will be skipped during import.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview table */}
                    <div className="border rounded-md max-h-96 overflow-y-auto">
                      <div className="divide-y">
                        {previewData.rows?.slice(0, 10).map((row: any) => (
                          <div key={row.id} className="p-3 hover-elevate">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  {row.employeeData && (
                                    <span className="font-medium text-sm">
                                      {row.employeeData.firstName} {row.employeeData.lastName}
                                    </span>
                                  )}
                                  {row.matchConfidence && (
                                    <Badge 
                                      variant={
                                        row.matchConfidence === 'exact' ? 'default' :
                                        row.matchConfidence === 'high' ? 'secondary' :
                                        'outline'
                                      }
                                      className="text-xs"
                                    >
                                      {row.matchConfidence} ({row.matchScore}%)
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {row.matchMethod}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Row {row.rowNumber}: {row.mappedData?.hours}h • {row.mappedData?.periodStart} to {row.mappedData?.periodEnd}
                                </p>
                              </div>
                              {row.validationStatus === 'valid' ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  {row.validationErrors?.[0] || 'Error'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {previewData.rows?.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Showing first 10 of {previewData.rows.length} rows
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Click "Generate Preview" to validate your data
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={uploadMutation.isPending || saveMappingsMutation.isPending}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
              Cancel
            </Button>
            {step === 1 && (
              <Button
                onClick={handleUpload}
                disabled={!csvFile || uploadMutation.isPending}
                data-testid="button-upload-csv"
              >
                {uploadMutation.isPending ? "Parsing..." : "Next: Map Columns"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => saveMappingsMutation.mutate()}
                disabled={!isReadyForPreview() || saveMappingsMutation.isPending}
                data-testid="button-save-mappings"
              >
                {saveMappingsMutation.isPending ? "Saving..." : "Next: Preview"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 3 && !previewMutation.isPending && (
              <>
                {!previewData && (
                  <Button
                    onClick={() => previewMutation.mutate()}
                    disabled={previewMutation.isPending}
                    data-testid="button-generate-preview"
                  >
                    Generate Preview
                  </Button>
                )}
                {previewData && previewData.successCount > 0 && (
                  <Button
                    onClick={() => {
                      onComplete();
                      toast({
                        title: "Import Complete",
                        description: `Successfully imported ${previewData.successCount} hours entries`,
                      });
                    }}
                    data-testid="button-complete-import"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Complete Import ({previewData.successCount} rows)
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
