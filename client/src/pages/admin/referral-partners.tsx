import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Handshake, Plus, Search, Users, DollarSign, Building2, Trash2, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { insertReferralPartnerSchema } from "@shared/schema";
import type { ReferralPartner, InsertReferralPartner } from "@shared/schema";
import type { z } from "zod";

interface TeamMemberInput {
  name: string;
  title: string;
  email: string;
  phone: string;
}

type PartnerFormData = z.infer<typeof insertReferralPartnerSchema>;

interface PartnerDetail extends ReferralPartner {
  teamMembers?: Array<{ id: string; name: string; title: string | null; email: string | null; phone: string | null }>;
  referredEmployers?: Array<{ id: string; name: string; ein: string; contactEmail: string; status?: string }>;
  commissions?: Array<{
    id: string;
    quarter: string;
    year: number;
    quarterNumber: number;
    totalCredits: string;
    revenueSharePercentage: string;
    commissionAmount: string;
    referredEmployerCount: number;
    status: string;
  }>;
}

export default function AdminReferralPartnersPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInput[]>([]);
  const [commissionYear, setCommissionYear] = useState(new Date().getFullYear());
  const [commissionQuarter, setCommissionQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  const { data: partners, isLoading } = useQuery<ReferralPartner[]>({
    queryKey: ["/api/admin/referral-partners"],
  });

  const { data: partnerDetail, isLoading: isDetailLoading } = useQuery<PartnerDetail>({
    queryKey: ["/api/admin/referral-partners", selectedPartnerId],
    enabled: !!selectedPartnerId,
  });

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(insertReferralPartnerSchema),
    defaultValues: {
      legalName: "",
      dba: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      contactName: "",
      contactTitle: "",
      contactEmail: "",
      contactPhone: "",
      revenueSharePercentage: "10.00",
    },
  });

  const addPartnerMutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      const response = await apiRequest("POST", "/api/admin/referral-partners", {
        ...data,
        teamMembers: teamMembers.filter((tm) => tm.name.trim() !== ""),
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Partner Added",
        description: "New referral partner has been added to the system.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-partners"] });
      setDialogOpen(false);
      form.reset();
      setTeamMembers([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add partner. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: async ({ partnerId, memberId }: { partnerId: string; memberId: string }) => {
      await apiRequest("DELETE", `/api/admin/referral-partners/${partnerId}/team-members/${memberId}`);
    },
    onSuccess: () => {
      toast({ title: "Team Member Removed", description: "Team member has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-partners", selectedPartnerId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to remove team member.", variant: "destructive" });
    },
  });

  const calculateCommissionMutation = useMutation({
    mutationFn: async ({ partnerId, year, quarter }: { partnerId: string; year: number; quarter: number }) => {
      const response = await apiRequest("POST", `/api/admin/referral-partners/${partnerId}/calculate-commission`, {
        year,
        quarter,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Commission Calculated", description: "Quarterly commission has been calculated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-partners", selectedPartnerId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to calculate commission.", variant: "destructive" });
    },
  });

  const safePartners = Array.isArray(partners) ? partners : [];

  const filteredPartners = safePartners.filter((p) => {
    const search = searchTerm.toLowerCase();
    return (
      p.legalName?.toLowerCase().includes(search) ||
      p.dba?.toLowerCase().includes(search) ||
      p.ein?.toLowerCase().includes(search) ||
      p.contactName?.toLowerCase().includes(search) ||
      p.contactEmail?.toLowerCase().includes(search)
    );
  });

  const addTeamMemberRow = () => {
    if (teamMembers.length < 5) {
      setTeamMembers([...teamMembers, { name: "", title: "", email: "", phone: "" }]);
    }
  };

  const updateTeamMember = (index: number, field: keyof TeamMemberInput, value: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const removeTeamMemberRow = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Referral Partners</h1>
          <p className="text-muted-foreground">
            Manage referral partners, team members, and commissions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-partner">
              <Plus className="h-4 w-4 mr-2" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Referral Partner</DialogTitle>
              <DialogDescription>
                Create a new referral partner account.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => addPartnerMutation.mutate(data))}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="legalName"
                    rules={{ required: "Legal name is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-legal-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dba"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DBA</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-dba" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ein"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EIN</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="XX-XXXXXXX" data-testid="input-ein" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="CA" data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-zip-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Main Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactName"
                      rules={{ required: "Contact name is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      rules={{ required: "Contact email is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="revenueSharePercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Revenue Share Percentage
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Set the revenue share percentage (0% - 50%) for this partner
                      </p>
                      <div className="flex items-center gap-4">
                        <FormControl>
                          <Slider
                            min={0}
                            max={50}
                            step={0.5}
                            value={[parseFloat(field.value || "10")]}
                            onValueChange={(vals) => field.onChange(vals[0].toFixed(2))}
                            className="flex-1"
                            data-testid="slider-revenue-share"
                          />
                        </FormControl>
                        <div className="flex items-center gap-1 min-w-[80px]">
                          <Input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            value={field.value || "10.00"}
                            onChange={(e) => {
                              const val = Math.min(50, Math.max(0, parseFloat(e.target.value) || 0));
                              field.onChange(val.toFixed(2));
                            }}
                            className="w-[70px] text-center"
                            data-testid="input-revenue-share"
                          />
                          <span className="text-sm font-medium text-muted-foreground">%</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <h3 className="font-medium">Team Members</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTeamMemberRow}
                      disabled={teamMembers.length >= 5}
                      data-testid="button-add-team-member"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Team Member
                    </Button>
                  </div>
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No team members added yet.</p>
                  )}
                  {teamMembers.map((member, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-2 items-end" data-testid={`team-member-row-${index}`}>
                      <div>
                        {index === 0 && <label className="text-xs text-muted-foreground">Name</label>}
                        <Input
                          value={member.name}
                          onChange={(e) => updateTeamMember(index, "name", e.target.value)}
                          placeholder="Name"
                          data-testid={`input-team-name-${index}`}
                        />
                      </div>
                      <div>
                        {index === 0 && <label className="text-xs text-muted-foreground">Title</label>}
                        <Input
                          value={member.title}
                          onChange={(e) => updateTeamMember(index, "title", e.target.value)}
                          placeholder="Title"
                          data-testid={`input-team-title-${index}`}
                        />
                      </div>
                      <div>
                        {index === 0 && <label className="text-xs text-muted-foreground">Email</label>}
                        <Input
                          value={member.email}
                          onChange={(e) => updateTeamMember(index, "email", e.target.value)}
                          placeholder="Email"
                          data-testid={`input-team-email-${index}`}
                        />
                      </div>
                      <div>
                        {index === 0 && <label className="text-xs text-muted-foreground">Phone</label>}
                        <Input
                          value={member.phone}
                          onChange={(e) => updateTeamMember(index, "phone", e.target.value)}
                          placeholder="Phone"
                          data-testid={`input-team-phone-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamMemberRow(index)}
                        data-testid={`button-remove-team-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={addPartnerMutation.isPending} data-testid="button-submit-partner">
                    {addPartnerMutation.isPending ? "Adding..." : "Add Partner"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-partners"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
              Loading partners...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Name</TableHead>
                  <TableHead>DBA</TableHead>
                  <TableHead>EIN</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Revenue Share %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Referred Employers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.length > 0 ? (
                  filteredPartners.map((partner) => (
                    <TableRow
                      key={partner.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() =>
                        setSelectedPartnerId(selectedPartnerId === partner.id ? null : partner.id)
                      }
                      data-testid={`row-partner-${partner.id}`}
                    >
                      <TableCell className="font-medium" data-testid={`text-legal-name-${partner.id}`}>
                        <div className="flex items-center gap-2">
                          <Handshake className="h-4 w-4 text-muted-foreground" />
                          {partner.legalName}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-dba-${partner.id}`}>{partner.dba || "--"}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-ein-${partner.id}`}>
                        {partner.ein || "--"}
                      </TableCell>
                      <TableCell data-testid={`text-contact-${partner.id}`}>
                        <div className="text-sm">
                          <div>{partner.contactName}</div>
                          <div className="text-muted-foreground">{partner.contactEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-revenue-share-${partner.id}`}>
                        {partner.revenueSharePercentage}%
                      </TableCell>
                      <TableCell data-testid={`text-status-${partner.id}`}>
                        <Badge
                          variant={
                            partner.status === "active"
                              ? "default"
                              : partner.status === "suspended"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {partner.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-referred-count-${partner.id}`}>
                        <div className="flex items-center justify-end gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          --
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="text-no-partners">
                      {searchTerm ? "No partners match your search." : "No referral partners yet. Add one to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedPartnerId && (
        <Card data-testid="card-partner-detail">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Partner Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDetailLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-detail-loading">
                Loading partner details...
              </div>
            ) : partnerDetail ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Legal Name</p>
                    <p className="font-medium" data-testid="text-detail-legal-name">{partnerDetail.legalName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">DBA</p>
                    <p className="font-medium" data-testid="text-detail-dba">{partnerDetail.dba || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">EIN</p>
                    <p className="font-mono" data-testid="text-detail-ein">{partnerDetail.ein || "--"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge
                      variant={partnerDetail.status === "active" ? "default" : "secondary"}
                      data-testid="badge-detail-status"
                    >
                      {partnerDetail.status?.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p data-testid="text-detail-address">
                      {[partnerDetail.address, partnerDetail.city, partnerDetail.state, partnerDetail.zipCode]
                        .filter(Boolean)
                        .join(", ") || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p data-testid="text-detail-contact">
                      {partnerDetail.contactName}
                      {partnerDetail.contactTitle ? ` (${partnerDetail.contactTitle})` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{partnerDetail.contactEmail}</p>
                    {partnerDetail.contactPhone && (
                      <p className="text-sm text-muted-foreground">{partnerDetail.contactPhone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue Share</p>
                    <p className="font-medium text-lg" data-testid="text-detail-revenue-share">
                      {partnerDetail.revenueSharePercentage}%
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Members
                  </h3>
                  {partnerDetail.teamMembers && partnerDetail.teamMembers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partnerDetail.teamMembers.map((member) => (
                          <TableRow key={member.id} data-testid={`row-team-member-${member.id}`}>
                            <TableCell className="font-medium" data-testid={`text-member-name-${member.id}`}>
                              {member.name}
                            </TableCell>
                            <TableCell data-testid={`text-member-title-${member.id}`}>
                              {member.title || "--"}
                            </TableCell>
                            <TableCell data-testid={`text-member-email-${member.id}`}>
                              {member.email || "--"}
                            </TableCell>
                            <TableCell data-testid={`text-member-phone-${member.id}`}>
                              {member.phone || "--"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  deleteTeamMemberMutation.mutate({
                                    partnerId: selectedPartnerId!,
                                    memberId: member.id,
                                  })
                                }
                                data-testid={`button-delete-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-team-members">
                      No team members.
                    </p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Referred Employers
                  </h3>
                  {partnerDetail.referredEmployers && partnerDetail.referredEmployers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company Name</TableHead>
                          <TableHead>EIN</TableHead>
                          <TableHead>Contact Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partnerDetail.referredEmployers.map((employer) => (
                          <TableRow key={employer.id} data-testid={`row-referred-employer-${employer.id}`}>
                            <TableCell className="font-medium" data-testid={`text-employer-name-${employer.id}`}>
                              {employer.name}
                            </TableCell>
                            <TableCell className="font-mono text-sm" data-testid={`text-employer-ein-${employer.id}`}>
                              {employer.ein}
                            </TableCell>
                            <TableCell data-testid={`text-employer-email-${employer.id}`}>
                              {employer.contactEmail}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-referred-employers">
                      No referred employers yet.
                    </p>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Quarterly Commissions
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        value={commissionYear}
                        onChange={(e) => setCommissionYear(parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-[90px]"
                        data-testid="input-commission-year"
                      />
                      <span className="text-sm text-muted-foreground">Q</span>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={commissionQuarter}
                        onChange={(e) => setCommissionQuarter(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-[60px]"
                        data-testid="input-commission-quarter"
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          calculateCommissionMutation.mutate({
                            partnerId: selectedPartnerId!,
                            year: commissionYear,
                            quarter: commissionQuarter,
                          })
                        }
                        disabled={calculateCommissionMutation.isPending}
                        data-testid="button-calculate-commission"
                      >
                        {calculateCommissionMutation.isPending ? "Calculating..." : "Calculate Commission"}
                      </Button>
                    </div>
                  </div>
                  {partnerDetail.commissions && partnerDetail.commissions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quarter</TableHead>
                          <TableHead>Total Credits</TableHead>
                          <TableHead>Revenue Share %</TableHead>
                          <TableHead>Commission</TableHead>
                          <TableHead>Employers</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partnerDetail.commissions.map((commission) => (
                          <TableRow key={commission.id} data-testid={`row-commission-${commission.id}`}>
                            <TableCell className="font-medium" data-testid={`text-commission-quarter-${commission.id}`}>
                              {commission.quarter}
                            </TableCell>
                            <TableCell data-testid={`text-commission-credits-${commission.id}`}>
                              ${parseFloat(commission.totalCredits || "0").toLocaleString()}
                            </TableCell>
                            <TableCell data-testid={`text-commission-share-${commission.id}`}>
                              {commission.revenueSharePercentage}%
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`text-commission-amount-${commission.id}`}>
                              ${parseFloat(commission.commissionAmount || "0").toLocaleString()}
                            </TableCell>
                            <TableCell data-testid={`text-commission-employers-${commission.id}`}>
                              {commission.referredEmployerCount}
                            </TableCell>
                            <TableCell data-testid={`text-commission-status-${commission.id}`}>
                              <Badge
                                variant={
                                  commission.status === "paid"
                                    ? "default"
                                    : commission.status === "approved"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {commission.status?.toUpperCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-commissions">
                      No commission records yet.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-detail-error">
                Failed to load partner details.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
