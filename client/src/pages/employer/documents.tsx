import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Upload,
  Download,
  FolderOpen,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function EmployerDocumentsPage() {
  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/employer/documents"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-2">Manage WOTC-related documents</p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-documents">Documents</h1>
          <p className="text-muted-foreground mt-2">
            Manage WOTC-related documents and IRS correspondence
          </p>
        </div>
        <Button data-testid="button-upload-document">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-determination-letters">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{documents?.filter(d => d.type === 'determination')?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Determination Letters</p>
          </CardContent>
        </Card>
        <Card data-testid="card-irs-letters">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{documents?.filter(d => d.type === 'irs')?.length || 0}</p>
            <p className="text-sm text-muted-foreground">IRS Letters</p>
          </CardContent>
        </Card>
        <Card data-testid="card-supporting-docs">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{documents?.filter(d => d.type === 'supporting')?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Supporting Documents</p>
          </CardContent>
        </Card>
      </div>

      {(!documents || documents.length === 0) ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-documents">No Documents Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload determination letters, IRS correspondence, and supporting documents here. 
              Documents can also be auto-imported via the Document OCR feature.
            </p>
            <Button className="mt-6" data-testid="button-upload-first">
              <Upload className="mr-2 h-4 w-4" />
              Upload Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Your uploaded WOTC documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.map((doc: any, index: number) => (
                <div key={doc.id || index} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`document-row-${index}`}>
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{doc.name || doc.filename}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.createdAt || doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {doc.type || "document"}
                    </Badge>
                    {doc.processed && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <Button variant="ghost" size="icon" data-testid={`button-download-${index}`}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
