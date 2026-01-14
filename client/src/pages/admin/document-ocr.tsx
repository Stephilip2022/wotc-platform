import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Eye,
  Download,
  Sparkles
} from "lucide-react";

interface OCRResult {
  success: boolean;
  extractedData: {
    certificationNumber: string | null;
    employerEIN: string | null;
    employerName: string | null;
    employeeName: string | null;
    employeeSSNLast4: string | null;
    targetGroup: string | null;
    determinationStatus: "certified" | "denied" | "pending" | "unknown";
    creditAmount: number | null;
    maxCreditAmount: number | null;
    hireDate: string | null;
    certificationDate: string | null;
    expirationDate: string | null;
    state: string | null;
    additionalNotes: string | null;
  } | null;
  confidence: number;
  processingTimeMs: number;
  error?: string;
}

interface DocumentAnalysis {
  isWOTCDocument: boolean;
  documentType: string;
  confidence: number;
}

export default function DocumentOCRPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);

  const analyzeDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      const response = await apiRequest("POST", "/api/ocr/analyze", {
        imageBase64: base64,
        mimeType: file.type
      });
      return response.json() as Promise<DocumentAnalysis>;
    },
    onSuccess: (data) => {
      setDocumentAnalysis(data);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze document",
        variant: "destructive"
      });
    }
  });

  const extractDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await fileToBase64(file);
      const response = await apiRequest("POST", "/api/ocr/extract", {
        imageBase64: base64,
        mimeType: file.type
      });
      return response.json() as Promise<OCRResult>;
    },
    onSuccess: (data) => {
      setOcrResult(data);
      if (data.success) {
        toast({
          title: "Extraction Complete",
          description: `Extracted data with ${Math.round(data.confidence * 100)}% confidence`
        });
      } else {
        toast({
          title: "Extraction Failed",
          description: data.error || "Could not extract data from document",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract data",
        variant: "destructive"
      });
    }
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOcrResult(null);
      setDocumentAnalysis(null);

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      analyzeDocumentMutation.mutate(file);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOcrResult(null);
      setDocumentAnalysis(null);

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      analyzeDocumentMutation.mutate(file);
    }
  }, []);

  const handleExtract = () => {
    if (selectedFile) {
      extractDataMutation.mutate(selectedFile);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "certified":
        return <Badge className="bg-green-100 text-green-800">Certified</Badge>;
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="document-ocr-page">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-ocr">Document OCR Processing</h1>
        <p className="text-muted-foreground mt-1">
          Upload determination letters to automatically extract certification data using AI
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Upload a determination letter image (PNG, JPG) or PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("file-upload")?.click()}
              data-testid="dropzone"
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleFileSelect}
                data-testid="input-file"
              />
              
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <p className="font-medium" data-testid="text-filename">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop file here or click to upload</p>
                  <p className="text-sm text-muted-foreground">
                    Supports PNG, JPG, and PDF files
                  </p>
                </div>
              )}
            </div>

            {previewUrl && (
              <div className="relative">
                <Label>Preview</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <img 
                    src={previewUrl} 
                    alt="Document preview" 
                    className="max-h-64 w-full object-contain"
                    data-testid="image-preview"
                  />
                </div>
              </div>
            )}

            {documentAnalysis && (
              <Alert variant={documentAnalysis.isWOTCDocument ? "default" : "destructive"}>
                {documentAnalysis.isWOTCDocument ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>Document Analysis</AlertTitle>
                <AlertDescription>
                  {documentAnalysis.isWOTCDocument ? (
                    <>
                      <span className="font-medium">WOTC Document Detected:</span>{" "}
                      {documentAnalysis.documentType.replace("_", " ")}
                      {" "}({Math.round(documentAnalysis.confidence * 100)}% confidence)
                    </>
                  ) : (
                    "This does not appear to be a WOTC-related document."
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              onClick={handleExtract}
              disabled={!selectedFile || extractDataMutation.isPending || analyzeDocumentMutation.isPending}
              data-testid="button-extract"
            >
              {extractDataMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Data with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Extracted Data
            </CardTitle>
            <CardDescription>
              AI-extracted information from the determination letter
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ocrResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ocrResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {ocrResult.success ? "Extraction Successful" : "Extraction Failed"}
                    </span>
                  </div>
                  <Badge variant="outline" data-testid="badge-confidence">
                    {Math.round(ocrResult.confidence * 100)}% confidence
                  </Badge>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Confidence Level</Label>
                  <Progress 
                    value={ocrResult.confidence * 100} 
                    className={`h-2 ${getConfidenceColor(ocrResult.confidence)}`}
                    data-testid="progress-confidence"
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Processing time: {ocrResult.processingTimeMs}ms
                </p>

                {ocrResult.extractedData && (
                  <>
                    <Separator />
                    
                    <div className="grid gap-4" data-testid="extracted-data">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <div className="mt-1" data-testid="text-status">
                            {getStatusBadge(ocrResult.extractedData.determinationStatus)}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Certification #</Label>
                          <p className="font-mono text-sm" data-testid="text-cert-number">
                            {ocrResult.extractedData.certificationNumber || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Employee Name</Label>
                          <p className="text-sm" data-testid="text-employee-name">
                            {ocrResult.extractedData.employeeName || "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">SSN (Last 4)</Label>
                          <p className="font-mono text-sm" data-testid="text-ssn">
                            ***-**-{ocrResult.extractedData.employeeSSNLast4 || "****"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Employer Name</Label>
                          <p className="text-sm" data-testid="text-employer-name">
                            {ocrResult.extractedData.employerName || "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Employer EIN</Label>
                          <p className="font-mono text-sm" data-testid="text-ein">
                            {ocrResult.extractedData.employerEIN || "—"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Target Group</Label>
                        <p className="text-sm" data-testid="text-target-group">
                          {ocrResult.extractedData.targetGroup || "—"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Credit Amount</Label>
                          <p className="text-lg font-bold text-green-600" data-testid="text-credit-amount">
                            ${ocrResult.extractedData.creditAmount?.toLocaleString() || "0"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Max Credit</Label>
                          <p className="text-sm" data-testid="text-max-credit">
                            ${ocrResult.extractedData.maxCreditAmount?.toLocaleString() || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Hire Date</Label>
                          <p className="text-sm" data-testid="text-hire-date">
                            {ocrResult.extractedData.hireDate || "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Cert Date</Label>
                          <p className="text-sm" data-testid="text-cert-date">
                            {ocrResult.extractedData.certificationDate || "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">State</Label>
                          <p className="text-sm" data-testid="text-state">
                            {ocrResult.extractedData.state || "—"}
                          </p>
                        </div>
                      </div>

                      {ocrResult.extractedData.additionalNotes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <p className="text-sm text-muted-foreground" data-testid="text-notes">
                            {ocrResult.extractedData.additionalNotes}
                          </p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <Button variant="outline" className="w-full" data-testid="button-save-record">
                      <Download className="h-4 w-4 mr-2" />
                      Save to Screening Record
                    </Button>
                  </>
                )}

                {ocrResult.error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{ocrResult.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a document to see extracted data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
