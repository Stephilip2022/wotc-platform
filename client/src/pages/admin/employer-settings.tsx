import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, QrCode, Eye, Save, Download } from "lucide-react";
import type { Employer } from "@shared/schema";

export default function EmployerSettings() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [primaryColor, setPrimaryColor] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [customFooter, setCustomFooter] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Fetch employer data
  const { data: employer, isLoading } = useQuery<Employer>({
    queryKey: ["/api/admin/employers", id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employers/${id}`);
      if (!response.ok) throw new Error("Failed to fetch employer");
      return response.json();
    },
    enabled: !!id,
  });

  // Set initial values when employer data loads
  useEffect(() => {
    if (employer) {
      setPrimaryColor(employer.primaryColor || "#2563eb");
      setWelcomeMessage(employer.welcomeMessage || "");
      setCustomFooter(employer.customFooter || "");
    }
  }, [employer]);

  // Logo upload mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const response = await fetch(`/api/admin/employers/${id}/logo`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload logo");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Logo uploaded",
        description: "Employer logo has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers", id] });
      setLogoFile(null);
      setLogoPreview(null);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Branding update mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/admin/employers/${id}/branding`, {
        primaryColor,
        welcomeMessage,
        customFooter,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Branding updated",
        description: "Employer branding settings have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers", id] });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update branding. Please try again.",
        variant: "destructive",
      });
    },
  });

  // QR code generation mutation
  const generateQrMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/admin/employers/${id}/qr-code`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "QR code generated",
        description: "QR code has been created and saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employers", id] });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  const handleSaveBranding = () => {
    updateBrandingMutation.mutate();
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!employer) {
    return <div className="p-8">Employer not found</div>;
  }

  const questionnaireUrl = employer.questionnaireUrl 
    ? `${window.location.origin}/screen/${employer.questionnaireUrl}`
    : "Not configured";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/employers")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{employer.name}</h1>
              <p className="text-sm text-muted-foreground">Employer Branding & Settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList>
            <TabsTrigger value="branding" data-testid="tab-branding">
              Branding
            </TabsTrigger>
            <TabsTrigger value="distribution" data-testid="tab-distribution">
              Distribution
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Logo</CardTitle>
                <CardDescription>
                  Upload a company logo to display on the screening questionnaire
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  <div className="space-y-4 flex-1">
                    <div>
                      <Label htmlFor="logo-upload">Upload Logo</Label>
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleLogoChange}
                        data-testid="input-logo-upload"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG or JPEG, max 10MB
                      </p>
                    </div>
                    {logoFile && (
                      <Button
                        onClick={handleUploadLogo}
                        disabled={uploadLogoMutation.isPending}
                        data-testid="button-upload-logo"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
                      </Button>
                    )}
                  </div>
                  <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                    {logoPreview || employer.logoUrl ? (
                      <img
                        src={logoPreview || employer.logoUrl || ""}
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                        data-testid="img-logo-preview"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground text-sm">
                        No logo uploaded
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Brand Colors</CardTitle>
                <CardDescription>
                  Customize the color scheme for the questionnaire
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-4">
                    <Input
                      id="primary-color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-24 h-10"
                      data-testid="input-primary-color"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#2563eb"
                      className="font-mono"
                      data-testid="input-primary-color-text"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Welcome Message</CardTitle>
                <CardDescription>
                  Custom message displayed at the start of the questionnaire
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Welcome to our WOTC screening process..."
                  rows={4}
                  data-testid="input-welcome-message"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Footer</CardTitle>
                <CardDescription>
                  Additional information displayed at the bottom of the questionnaire
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  placeholder="For questions, contact hr@company.com"
                  rows={3}
                  data-testid="input-custom-footer"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveBranding}
                disabled={updateBrandingMutation.isPending}
                data-testid="button-save-branding"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateBrandingMutation.isPending ? "Saving..." : "Save Branding"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Questionnaire URL</CardTitle>
                <CardDescription>
                  Share this URL with new hires to complete the WOTC screening
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all" data-testid="text-questionnaire-url">
                  {questionnaireUrl}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(questionnaireUrl);
                    toast({ title: "Copied to clipboard" });
                  }}
                  data-testid="button-copy-url"
                >
                  Copy URL
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Code</CardTitle>
                <CardDescription>
                  Generate a QR code for easy access on mobile devices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {employer.qrCodeUrl ? (
                  <div className="flex gap-6">
                    <div className="space-y-4 flex-1">
                      <p className="text-sm text-muted-foreground">
                        QR code generated and ready to download
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => generateQrMutation.mutate()}
                          disabled={generateQrMutation.isPending}
                          data-testid="button-regenerate-qr"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Regenerate
                        </Button>
                        <Button
                          variant="outline"
                          asChild
                          data-testid="button-download-qr"
                        >
                          <a href={employer.qrCodeUrl} download={`${employer.name}-qr-code.png`}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="w-64 h-64 border rounded-lg p-4 flex items-center justify-center bg-white">
                      <img
                        src={employer.qrCodeUrl}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                        data-testid="img-qr-code"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No QR code generated yet. Generate one to make it easy for employees to access the questionnaire.
                    </p>
                    <Button
                      onClick={() => generateQrMutation.mutate()}
                      disabled={generateQrMutation.isPending}
                      data-testid="button-generate-qr"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      {generateQrMutation.isPending ? "Generating..." : "Generate QR Code"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Branding Preview</CardTitle>
                <CardDescription>
                  Preview how the questionnaire will appear to employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 rounded-lg p-8 space-y-6"
                  style={{ borderColor: primaryColor }}
                >
                  {employer.logoUrl && (
                    <div className="flex justify-center">
                      <img
                        src={employer.logoUrl}
                        alt={employer.name}
                        className="max-h-24 object-contain"
                        data-testid="img-preview-logo"
                      />
                    </div>
                  )}
                  <div className="text-center">
                    <h2
                      className="text-2xl font-bold mb-4"
                      style={{ color: primaryColor }}
                    >
                      WOTC Screening Questionnaire
                    </h2>
                    {welcomeMessage && (
                      <p className="text-muted-foreground mb-6" data-testid="text-preview-welcome">
                        {welcomeMessage}
                      </p>
                    )}
                    <div className="space-y-4 text-left max-w-md mx-auto">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm font-medium mb-2">Sample Question</p>
                        <p className="text-sm text-muted-foreground">
                          This is how questions will appear in the questionnaire
                        </p>
                      </div>
                    </div>
                    {customFooter && (
                      <p className="text-xs text-muted-foreground mt-8" data-testid="text-preview-footer">
                        {customFooter}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
