import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  History,
  Settings,
  Users,
  Clock,
} from "lucide-react";

interface ImportSession {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  createdAt: string;
}

interface ImportTemplate {
  id: string;
  name: string;
  mappings: Record<string, string>;
  createdAt: string;
}

export default function BulkImportPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("auto");
  const [isUploading, setIsUploading] = useState(false);

  const { data: sessions = [], isLoading: loadingSessions } = useQuery<ImportSession[]>({
    queryKey: ["/api/import/sessions"],
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<ImportTemplate[]>({
    queryKey: ["/api/import/templates"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("templateId", selectedTemplate);
      
      const response = await fetch("/api/import/employees", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Started",
        description: `Processing ${data.totalRows} rows from ${selectedFile?.name}`,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/import/sessions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "partial":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Bulk Import</h1>
        <p className="text-muted-foreground mt-2">
          Import employee lists and hours data via CSV files
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            Import History
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Settings className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-upload-employees">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Import Employees
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with employee information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>CSV File</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedFile(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop your CSV file here, or click to browse
                        </p>
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          className="max-w-xs mx-auto"
                          data-testid="input-csv-file"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mapping Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect columns</SelectItem>
                      <SelectItem value="standard">Standard Format</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  data-testid="button-start-import"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Start Import
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-upload-hours">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Import Hours Data
                </CardTitle>
                <CardDescription>
                  Upload payroll hours and wages data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Upload hours data CSV
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    className="max-w-xs mx-auto mt-2"
                    data-testid="input-hours-file"
                  />
                </div>

                <Button className="w-full" variant="outline" data-testid="button-import-hours">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Hours
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-template-download">
            <CardHeader>
              <CardTitle>Download Templates</CardTitle>
              <CardDescription>
                Use these templates as a guide for formatting your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" data-testid="button-download-employee-template">
                  <Download className="h-4 w-4 mr-2" />
                  Employee Template
                </Button>
                <Button variant="outline" data-testid="button-download-hours-template">
                  <Download className="h-4 w-4 mr-2" />
                  Hours Template
                </Button>
                <Button variant="outline" data-testid="button-download-screening-template">
                  <Download className="h-4 w-4 mr-2" />
                  Screening Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card data-testid="card-import-history">
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View past import sessions and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No import sessions yet</p>
                  <p className="text-sm">Upload a CSV file to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Results</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                        <TableCell className="font-medium">
                          {session.fileName}
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          <div className="w-32">
                            <Progress 
                              value={(session.processedRows / session.totalRows) * 100} 
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {session.processedRows} / {session.totalRows}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 text-sm">
                            <span className="text-green-600">{session.successfulRows} success</span>
                            {session.failedRows > 0 && (
                              <span className="text-red-600">{session.failedRows} failed</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card data-testid="card-mapping-templates">
            <CardHeader>
              <CardTitle>Column Mapping Templates</CardTitle>
              <CardDescription>
                Save and reuse column mappings for your CSV files
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates saved yet</p>
                  <p className="text-sm">Templates are created automatically when you map columns during import</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Mapped Fields</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {Object.keys(template.mappings).length} fields
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(template.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Edit</Button>
                          <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Fields</CardTitle>
              <CardDescription>
                The following fields can be imported from your CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="font-medium text-sm mb-2">Required</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>First Name</li>
                    <li>Last Name</li>
                    <li>Email</li>
                    <li>Hire Date</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">Contact</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Phone</li>
                    <li>Address</li>
                    <li>City</li>
                    <li>State</li>
                    <li>ZIP Code</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">Employment</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Job Title</li>
                    <li>Department</li>
                    <li>Start Date</li>
                    <li>Employment Type</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">Optional</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>SSN (last 4)</li>
                    <li>Date of Birth</li>
                    <li>Employee ID</li>
                    <li>Location Code</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
