import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck, AlertCircle, Shield, CheckCircle2, X, Loader2 } from "lucide-react";

interface RequiredDocument {
  type: string;
  label: string;
  description: string;
  accept: string;
}

interface UploadData {
  employerName: string;
  employerLogo: string | null;
  employerColor: string | null;
  employeeFirstName: string;
  requiredDocuments: RequiredDocument[];
  expiresAt: string;
}

interface FileSelection {
  file: File;
  docType: string;
  preview?: string;
}

export default function PublicUpload({ token }: { token: string }) {
  const [selectedFiles, setSelectedFiles] = useState<FileSelection[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery<UploadData>({
    queryKey: ["/api/public/upload", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/upload/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load upload page");
      }
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileSelection[]) => {
      const formData = new FormData();
      const docTypes: string[] = [];

      files.forEach(({ file, docType }) => {
        formData.append("documents", file);
        docTypes.push(docType);
      });

      formData.append("documentTypes", JSON.stringify(docTypes));

      const res = await fetch(`/api/public/upload/${token}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleFileSelect = useCallback((docType: string, file: File) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.docType !== docType);
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }
      return [...filtered, { file, docType, preview }];
    });
  }, []);

  const handleRemoveFile = useCallback((docType: string) => {
    setSelectedFiles(prev => {
      const removed = prev.find(f => f.docType === docType);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter(f => f.docType !== docType);
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedFiles.length === 0) return;
    uploadMutation.mutate(selectedFiles);
  }, [selectedFiles, uploadMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle data-testid="text-upload-error-title">Upload Link Unavailable</CardTitle>
            <CardDescription data-testid="text-upload-error-message">
              {errorMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const brandColor = data.employerColor || "#2563eb";
  const allDocsSelected = data.requiredDocuments.every(
    doc => selectedFiles.some(f => f.docType === doc.type)
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            {data.employerLogo && (
              <img
                src={data.employerLogo}
                alt={data.employerName}
                className="h-8 w-auto"
                data-testid="img-employer-logo"
              />
            )}
            <span className="font-semibold text-foreground" data-testid="text-employer-name">
              {data.employerName}
            </span>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
               style={{ backgroundColor: `${brandColor}15` }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: brandColor }} />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3" data-testid="text-upload-success-title">
            Documents Uploaded Successfully
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-upload-success-message">
            Thank you, {data.employeeFirstName}! Your documents have been received and are being reviewed.
            You can close this page now.
          </p>
        </div>
      </div>
    );
  }

  const daysUntilExpiry = Math.ceil(
    (new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {data.employerLogo && (
            <img
              src={data.employerLogo}
              alt={data.employerName}
              className="h-8 w-auto"
              data-testid="img-employer-logo"
            />
          )}
          <span className="font-semibold text-foreground" data-testid="text-employer-name">
            {data.employerName}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-upload-title">
            Document Upload
          </h1>
          <p className="text-muted-foreground">
            Hi {data.employeeFirstName}, we need a few more documents to complete your screening.
            Please upload the following:
          </p>
          {daysUntilExpiry > 0 && (
            <p className="text-sm text-muted-foreground">
              This link expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your documents are transmitted securely and used only for WOTC eligibility verification.
          </p>
        </div>

        <div className="space-y-4">
          {data.requiredDocuments.map((doc) => {
            const selected = selectedFiles.find(f => f.docType === doc.type);

            return (
              <Card key={doc.type} data-testid={`card-upload-${doc.type}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {selected ? (
                      <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    {doc.label}
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {selected ? (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border">
                      {selected.preview && (
                        <img
                          src={selected.preview}
                          alt="Preview"
                          className="h-12 w-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-filename-${doc.type}`}>
                          {selected.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(selected.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveFile(doc.type)}
                        data-testid={`button-remove-${doc.type}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept={doc.accept}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(doc.type, file);
                        }}
                        data-testid={`input-file-${doc.type}`}
                      />
                      <div className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate transition-colors">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                          Click to select file
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF or image, up to 10MB
                        </p>
                      </div>
                    </label>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!allDocsSelected || uploadMutation.isPending}
          onClick={handleSubmit}
          style={allDocsSelected ? { backgroundColor: brandColor } : undefined}
          data-testid="button-submit-upload"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </>
          )}
        </Button>

        {uploadMutation.isError && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive" data-testid="text-upload-error">
              {uploadMutation.error instanceof Error
                ? uploadMutation.error.message
                : "Upload failed. Please try again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
