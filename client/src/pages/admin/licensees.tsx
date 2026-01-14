import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, Plus, Edit, Trash2, Palette, Globe, DollarSign,
  Users, Settings, ExternalLink, Copy, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

interface Licensee {
  id: string;
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string;
  isActive: boolean;
  commissionRate: number;
  billingModel: string;
  createdAt: string;
}

export default function LicenseesPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLicensee, setEditingLicensee] = useState<Licensee | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    logoUrl: "",
    primaryColor: "#0ea5e9",
    secondaryColor: "#6366f1",
    customDomain: "",
    commissionRate: 15,
    billingModel: "percentage",
  });

  const { data: licensees = [], isLoading } = useQuery<Licensee[]>({
    queryKey: ["/api/admin/licensees"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/licensees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licensees"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Licensee created", description: "The white-label licensee has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const res = await apiRequest("PATCH", `/api/admin/licensees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licensees"] });
      setEditingLicensee(null);
      resetForm();
      toast({ title: "Licensee updated", description: "The changes have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      logoUrl: "",
      primaryColor: "#0ea5e9",
      secondaryColor: "#6366f1",
      customDomain: "",
      commissionRate: 15,
      billingModel: "percentage",
    });
  };

  const handleEdit = (licensee: Licensee) => {
    setEditingLicensee(licensee);
    setFormData({
      name: licensee.name,
      slug: licensee.slug,
      contactName: licensee.contactName || "",
      contactEmail: licensee.contactEmail || "",
      contactPhone: licensee.contactPhone || "",
      logoUrl: licensee.logoUrl || "",
      primaryColor: licensee.primaryColor || "#0ea5e9",
      secondaryColor: licensee.secondaryColor || "#6366f1",
      customDomain: licensee.customDomain || "",
      commissionRate: licensee.commissionRate || 15,
      billingModel: licensee.billingModel || "percentage",
    });
  };

  const handleSubmit = () => {
    if (editingLicensee) {
      updateMutation.mutate({ id: editingLicensee.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Mock data for display
  const mockLicensees: Licensee[] = licensees.length > 0 ? licensees : [
    {
      id: "1",
      name: "HR Solutions Inc",
      slug: "hr-solutions",
      contactName: "John Smith",
      contactEmail: "john@hrsolutions.com",
      contactPhone: "(555) 123-4567",
      logoUrl: "",
      primaryColor: "#2563eb",
      secondaryColor: "#7c3aed",
      customDomain: "wotc.hrsolutions.com",
      isActive: true,
      commissionRate: 15,
      billingModel: "percentage",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Workforce Partners",
      slug: "workforce-partners",
      contactName: "Jane Doe",
      contactEmail: "jane@workforcepartners.com",
      contactPhone: "(555) 987-6543",
      logoUrl: "",
      primaryColor: "#059669",
      secondaryColor: "#0891b2",
      customDomain: "",
      isActive: true,
      commissionRate: 12,
      billingModel: "percentage",
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="licensees-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">White-Label Licensees</h1>
          <p className="text-muted-foreground mt-1">
            Manage white-label partners with custom branding and revenue sharing
          </p>
        </div>
        <Dialog open={showAddDialog || !!editingLicensee} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingLicensee(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-licensee">
              <Plus className="w-4 h-4 mr-2" />
              Add Licensee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLicensee ? "Edit Licensee" : "Create Licensee"}</DialogTitle>
              <DialogDescription>
                Configure white-label branding and revenue sharing settings
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Basic Info</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      placeholder="HR Solutions Inc"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          name: e.target.value,
                          slug: formData.slug || generateSlug(e.target.value)
                        });
                      }}
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL Slug *</Label>
                    <Input
                      placeholder="hr-solutions"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      data-testid="input-slug"
                    />
                    <p className="text-xs text-muted-foreground">
                      Platform URL: /{formData.slug || "slug"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    placeholder="John Smith"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      placeholder="contact@company.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      placeholder="(555) 123-4567"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      data-testid="input-contact-phone"
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://company.com/logo.png"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    data-testid="input-logo-url"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-primary-color"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        placeholder="#0ea5e9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                        data-testid="input-secondary-color"
                      />
                      <Input
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Custom Domain</Label>
                  <Input
                    placeholder="wotc.yourcompany.com"
                    value={formData.customDomain}
                    onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                    data-testid="input-custom-domain"
                  />
                  <p className="text-xs text-muted-foreground">
                    Point a CNAME record to our servers to use a custom domain
                  </p>
                </div>
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      {formData.logoUrl ? (
                        <img src={formData.logoUrl} alt="Logo" className="h-10 w-auto" />
                      ) : (
                        <div 
                          className="h-10 w-10 rounded flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          {formData.name.charAt(0) || "L"}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{formData.name || "Licensee Name"}</p>
                        <div className="flex gap-2 mt-1">
                          <div 
                            className="h-4 w-16 rounded"
                            style={{ backgroundColor: formData.primaryColor }}
                          />
                          <div 
                            className="h-4 w-16 rounded"
                            style={{ backgroundColor: formData.secondaryColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="billing" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Billing Model</Label>
                  <Select 
                    value={formData.billingModel} 
                    onValueChange={(v) => setFormData({ ...formData, billingModel: v })}
                  >
                    <SelectTrigger data-testid="select-billing-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Credits</SelectItem>
                      <SelectItem value="per_screening">Per Screening Fee</SelectItem>
                      <SelectItem value="flat_rate">Flat Monthly Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    data-testid="input-commission-rate"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of WOTC credits earned by employers under this licensee
                  </p>
                </div>
                <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Estimated Monthly Revenue
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Based on {formData.commissionRate}% commission rate
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setEditingLicensee(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-licensee"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Saving..." 
                  : editingLicensee ? "Save Changes" : "Create Licensee"
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Licensees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-licensees">
              {mockLicensees.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Partners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-partners">
              {mockLicensees.filter(l => l.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue Share</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-revenue-share">
              $0
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Licensees</CardTitle>
          <CardDescription>Manage white-label partners and their branding configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Licensee</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Branding</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLicensees.map((licensee) => (
                <TableRow key={licensee.id} data-testid={`licensee-row-${licensee.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-10 w-10 rounded flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: licensee.primaryColor }}
                      >
                        {licensee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{licensee.name}</p>
                        <p className="text-sm text-muted-foreground">/{licensee.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{licensee.contactName}</p>
                      <p className="text-sm text-muted-foreground">{licensee.contactEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: licensee.primaryColor }}
                        title="Primary"
                      />
                      <div 
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: licensee.secondaryColor }}
                        title="Secondary"
                      />
                      {licensee.customDomain && (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="w-3 h-3 mr-1" />
                          Custom Domain
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{licensee.commissionRate}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={licensee.isActive ? "default" : "secondary"}>
                      {licensee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const url = licensee.customDomain || `${window.location.origin}/${licensee.slug}`;
                          copyToClipboard(url, licensee.id);
                        }}
                        title="Copy URL"
                        data-testid={`button-copy-${licensee.id}`}
                      >
                        {copiedId === licensee.id ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(licensee)}
                        data-testid={`button-edit-${licensee.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
