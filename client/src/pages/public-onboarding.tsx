import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  CheckCircle, Clock, Upload, FileText, Shield, User, Building2, 
  ChevronRight, ChevronLeft, Loader2, AlertCircle, Pen
} from "lucide-react";

interface OnboardingData {
  employer: { id: string; name: string; logoUrl: string | null; primaryColor: string | null; welcomeMessage: string | null };
  instance: { id: string; firstName: string; lastName: string; email: string; status: string; progressPercent: number; currentStep: string };
  tasks: Array<{ id: string; stepKey: string; title: string; description: string | null; category: string; status: string; sortOrder: number }>;
  forms: Array<{ formType: string; isComplete: boolean | null }>;
  documents: Array<{ id: string; documentType: string; fileName: string; status: string }>;
}

const FILING_STATUSES = [
  { value: "single", label: "Single or Married filing separately" },
  { value: "married_jointly", label: "Married filing jointly" },
  { value: "head_of_household", label: "Head of household" },
];

export default function PublicOnboarding({ token }: { token: string }) {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", dateOfBirth: "", ssn: "",
  });
  const [w4Data, setW4Data] = useState({
    filingStatus: "single", multipleJobs: false, dependentsAmount: "", otherIncome: "", deductions: "", extraWithholding: "",
  });
  const [stateWithholding, setStateWithholding] = useState({
    state: "", allowances: "0", additionalWithholding: "", exempt: false,
  });
  const [directDeposit, setDirectDeposit] = useState({
    bankName: "", routingNumber: "", accountNumber: "", accountType: "checking",
  });
  const [emergencyContact, setEmergencyContact] = useState({
    name: "", relationship: "", phone: "", email: "",
  });

  const { data, isLoading, error } = useQuery<OnboardingData>({
    queryKey: ["/api/public/onboard", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/onboard/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load" }));
        throw new Error(err.error);
      }
      return res.json();
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async ({ stepKey, formData }: { stepKey: string; formData: any }) => {
      const res = await fetch(`/api/public/onboard/${token}/save-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepKey, formData }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/onboard", token] });
      toast({ title: "Saved", description: "Your progress has been saved" });
      if (result.currentStep && result.currentStep !== "completed") {
        setActiveStep(result.currentStep);
      } else {
        setActiveStep(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "government_id");
      const idTask = data?.tasks.find(t => t.stepKey === "id_upload");
      if (idTask) formData.append("taskId", idTask.id);
      const res = await fetch(`/api/public/onboard/${token}/upload-document`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/onboard", token] });
      toast({ title: "Uploaded", description: "Your document has been uploaded" });
      const nextStep = getNextPendingStep("id_upload");
      setActiveStep(nextStep);
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const signPolicyMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      const res = await fetch(`/api/public/onboard/${token}/sign-policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData, policyName: "Employee Handbook & Policies" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/onboard", token] });
      toast({ title: "Signed", description: "Policy acknowledgement recorded" });
      setActiveStep(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/onboard/${token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public/onboard", token] });
      toast({ title: "Complete!", description: "Your onboarding is complete. Your employer has been notified." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getNextPendingStep = (afterStep: string) => {
    if (!data?.tasks) return null;
    const sorted = [...data.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIdx = sorted.findIndex(t => t.stepKey === afterStep);
    const next = sorted.slice(currentIdx + 1).find(t => t.status === "pending");
    return next?.stepKey || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Unable to Load Onboarding</h2>
            <p className="text-muted-foreground">{(error as Error)?.message || "This link may be invalid or expired."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.instance.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Onboarding Complete!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you, {data.instance.firstName}. Your onboarding for {data.employer.name} is complete.
            </p>
            <p className="text-sm text-muted-foreground">Your employer has been notified. You're all set for your first day!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedCount = data.tasks.filter(t => t.status === "completed").length;
  const totalTasks = data.tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const remainingMinutes = Math.max(1, (totalTasks - completedCount) * 2);

  const startSignature = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignature = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "currentColor";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endSignature = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const renderStepContent = (stepKey: string) => {
    switch (stepKey) {
      case "personal_info":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>First Name</Label><Input value={personalInfo.firstName || data.instance.firstName} onChange={e => setPersonalInfo(p => ({ ...p, firstName: e.target.value }))} data-testid="input-personal-first-name" /></div>
              <div className="space-y-1"><Label>Last Name</Label><Input value={personalInfo.lastName || data.instance.lastName} onChange={e => setPersonalInfo(p => ({ ...p, lastName: e.target.value }))} data-testid="input-personal-last-name" /></div>
            </div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={personalInfo.email || data.instance.email} onChange={e => setPersonalInfo(p => ({ ...p, email: e.target.value }))} data-testid="input-personal-email" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={personalInfo.phone} onChange={e => setPersonalInfo(p => ({ ...p, phone: e.target.value }))} data-testid="input-personal-phone" /></div>
            <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={personalInfo.dateOfBirth} onChange={e => setPersonalInfo(p => ({ ...p, dateOfBirth: e.target.value }))} data-testid="input-personal-dob" /></div>
            <div className="space-y-1"><Label>Social Security Number</Label><Input type="password" placeholder="XXX-XX-XXXX" value={personalInfo.ssn} onChange={e => setPersonalInfo(p => ({ ...p, ssn: e.target.value }))} data-testid="input-personal-ssn" /><p className="text-xs text-muted-foreground">Required for tax withholding. Your data is encrypted and secure.</p></div>
            <div className="space-y-1"><Label>Address</Label><Input value={personalInfo.address} onChange={e => setPersonalInfo(p => ({ ...p, address: e.target.value }))} data-testid="input-personal-address" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>City</Label><Input value={personalInfo.city} onChange={e => setPersonalInfo(p => ({ ...p, city: e.target.value }))} data-testid="input-personal-city" /></div>
              <div className="space-y-1"><Label>State</Label><Input value={personalInfo.state} onChange={e => setPersonalInfo(p => ({ ...p, state: e.target.value }))} placeholder="CA" data-testid="input-personal-state" /></div>
              <div className="space-y-1"><Label>ZIP</Label><Input value={personalInfo.zipCode} onChange={e => setPersonalInfo(p => ({ ...p, zipCode: e.target.value }))} data-testid="input-personal-zip" /></div>
            </div>
            <Button className="w-full" onClick={() => saveStepMutation.mutate({ stepKey: "personal_info", formData: { ...personalInfo, firstName: personalInfo.firstName || data.instance.firstName, lastName: personalInfo.lastName || data.instance.lastName, email: personalInfo.email || data.instance.email } })} disabled={saveStepMutation.isPending} data-testid="button-save-personal-info">
              {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        );

      case "tax_w4":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">What is a W-4?</p>
              <p className="text-xs text-muted-foreground">The W-4 tells your employer how much federal income tax to withhold from your paycheck. Getting it right means you won't owe a big tax bill or get too large a refund.</p>
            </div>
            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select value={w4Data.filingStatus} onValueChange={v => setW4Data(p => ({ ...p, filingStatus: v }))}>
                <SelectTrigger data-testid="select-w4-filing-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILING_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Dependents Amount ($)</Label><Input type="number" placeholder="0" value={w4Data.dependentsAmount} onChange={e => setW4Data(p => ({ ...p, dependentsAmount: e.target.value }))} data-testid="input-w4-dependents" /><p className="text-xs text-muted-foreground">Multiply number of qualifying children by $2,000 and other dependents by $500</p></div>
            <div className="space-y-1"><Label>Other Income ($)</Label><Input type="number" placeholder="0" value={w4Data.otherIncome} onChange={e => setW4Data(p => ({ ...p, otherIncome: e.target.value }))} data-testid="input-w4-other-income" /><p className="text-xs text-muted-foreground">Income from interest, dividends, retirement, etc.</p></div>
            <div className="space-y-1"><Label>Extra Withholding per Pay Period ($)</Label><Input type="number" placeholder="0" value={w4Data.extraWithholding} onChange={e => setW4Data(p => ({ ...p, extraWithholding: e.target.value }))} data-testid="input-w4-extra" /></div>
            <Button className="w-full" onClick={() => saveStepMutation.mutate({ stepKey: "tax_w4", formData: w4Data })} disabled={saveStepMutation.isPending} data-testid="button-save-w4">
              {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        );

      case "state_withholding":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">State Tax Withholding</p>
              <p className="text-xs text-muted-foreground">Most states require separate tax withholding. This form tells your employer how much state income tax to withhold.</p>
            </div>
            <div className="space-y-1"><Label>State</Label><Input placeholder="CA" value={stateWithholding.state} onChange={e => setStateWithholding(p => ({ ...p, state: e.target.value }))} data-testid="input-state-wh-state" /></div>
            <div className="space-y-1"><Label>Allowances</Label><Input type="number" value={stateWithholding.allowances} onChange={e => setStateWithholding(p => ({ ...p, allowances: e.target.value }))} data-testid="input-state-wh-allowances" /></div>
            <div className="space-y-1"><Label>Additional Withholding ($)</Label><Input type="number" placeholder="0" value={stateWithholding.additionalWithholding} onChange={e => setStateWithholding(p => ({ ...p, additionalWithholding: e.target.value }))} data-testid="input-state-wh-additional" /></div>
            <Button className="w-full" onClick={() => saveStepMutation.mutate({ stepKey: "state_withholding", formData: stateWithholding })} disabled={saveStepMutation.isPending} data-testid="button-save-state-wh">
              {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        );

      case "direct_deposit":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">Direct Deposit Setup</p>
              <p className="text-xs text-muted-foreground">Get paid faster with direct deposit. Your bank details are encrypted and stored securely.</p>
            </div>
            <div className="space-y-1"><Label>Bank Name</Label><Input value={directDeposit.bankName} onChange={e => setDirectDeposit(p => ({ ...p, bankName: e.target.value }))} data-testid="input-dd-bank-name" /></div>
            <div className="space-y-1"><Label>Routing Number</Label><Input value={directDeposit.routingNumber} onChange={e => setDirectDeposit(p => ({ ...p, routingNumber: e.target.value }))} placeholder="9 digits" maxLength={9} data-testid="input-dd-routing" /><p className="text-xs text-muted-foreground">The 9-digit number at the bottom left of your check</p></div>
            <div className="space-y-1"><Label>Account Number</Label><Input type="password" value={directDeposit.accountNumber} onChange={e => setDirectDeposit(p => ({ ...p, accountNumber: e.target.value }))} data-testid="input-dd-account" /></div>
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={directDeposit.accountType} onValueChange={v => setDirectDeposit(p => ({ ...p, accountType: v }))}>
                <SelectTrigger data-testid="select-dd-account-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => saveStepMutation.mutate({ stepKey: "direct_deposit", formData: directDeposit })} disabled={saveStepMutation.isPending} data-testid="button-save-direct-deposit">
              {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        );

      case "emergency_contact":
        return (
          <div className="space-y-4">
            <div className="space-y-1"><Label>Contact Name</Label><Input value={emergencyContact.name} onChange={e => setEmergencyContact(p => ({ ...p, name: e.target.value }))} data-testid="input-ec-name" /></div>
            <div className="space-y-1"><Label>Relationship</Label><Input value={emergencyContact.relationship} onChange={e => setEmergencyContact(p => ({ ...p, relationship: e.target.value }))} placeholder="e.g. Spouse, Parent, Sibling" data-testid="input-ec-relationship" /></div>
            <div className="space-y-1"><Label>Phone Number</Label><Input value={emergencyContact.phone} onChange={e => setEmergencyContact(p => ({ ...p, phone: e.target.value }))} data-testid="input-ec-phone" /></div>
            <div className="space-y-1"><Label>Email (optional)</Label><Input type="email" value={emergencyContact.email} onChange={e => setEmergencyContact(p => ({ ...p, email: e.target.value }))} data-testid="input-ec-email" /></div>
            <Button className="w-full" onClick={() => saveStepMutation.mutate({ stepKey: "emergency_contact", formData: emergencyContact })} disabled={saveStepMutation.isPending} data-testid="button-save-emergency-contact">
              {saveStepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
              Save & Continue
            </Button>
          </div>
        );

      case "id_upload":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-1">Photo ID Upload</p>
              <p className="text-xs text-muted-foreground">Upload a clear photo of your government-issued photo ID (driver's license, passport, or state ID). This is required for identity verification.</p>
            </div>
            {data.documents.some(d => d.documentType === "government_id") ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">ID document uploaded</span>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadMutation.mutate(e.target.files[0]); }} data-testid="input-id-upload" />
                <Button className="w-full" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-id">
                  {uploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploadMutation.isPending ? "Uploading..." : "Choose File or Take Photo"}
                </Button>
              </>
            )}
          </div>
        );

      case "policy_sign":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/50">
              <p className="text-sm font-medium mb-2">Policy Acknowledgements</p>
              <p className="text-xs text-muted-foreground mb-3">By signing below, you acknowledge that you have received, read, and agree to the following:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Employee Handbook</li>
                <li>Code of Conduct</li>
                <li>Confidentiality Agreement</li>
                <li>At-Will Employment Notice</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Your Signature</Label>
              <div className="border rounded-md bg-background">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={100}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startSignature}
                  onMouseMove={drawSignature}
                  onMouseUp={endSignature}
                  onMouseLeave={endSignature}
                  onTouchStart={startSignature}
                  onTouchMove={drawSignature}
                  onTouchEnd={endSignature}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearSignature} data-testid="button-clear-signature">Clear</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const sigData = canvas.toDataURL("image/png");
                    signPolicyMutation.mutate(sigData);
                  }}
                  disabled={signPolicyMutation.isPending}
                  data-testid="button-submit-signature"
                >
                  {signPolicyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pen className="h-4 w-4 mr-2" />}
                  Sign & Accept
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-muted-foreground">This step is not yet available.</p>;
    }
  };

  const getStepIcon = (stepKey: string) => {
    switch (stepKey) {
      case "personal_info": return User;
      case "tax_w4": return FileText;
      case "state_withholding": return FileText;
      case "direct_deposit": return Building2;
      case "emergency_contact": return Shield;
      case "id_upload": return Upload;
      case "policy_sign": return Pen;
      default: return Clock;
    }
  };

  const sortedTasks = [...data.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const allRequiredDone = data.tasks.filter(t => t.category === "required").every(t => t.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="text-center space-y-2 py-4">
          <h1 className="text-2xl font-bold" data-testid="text-employer-name">{data.employer.name}</h1>
          <p className="text-muted-foreground">Welcome, {data.instance.firstName}! Let's get you set up.</p>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" data-testid="text-progress-label">
                You're {progressPercent}% done
              </span>
              <span className="text-xs text-muted-foreground">
                ~{remainingMinutes} min left
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedCount} of {totalTasks} steps completed
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {sortedTasks.map((task) => {
            const isActive = activeStep === task.stepKey;
            const isCompleted = task.status === "completed";
            const StepIcon = getStepIcon(task.stepKey);

            return (
              <Card
                key={task.id}
                className={isActive ? "ring-2 ring-primary" : ""}
                data-testid={`card-step-${task.stepKey}`}
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setActiveStep(isActive ? null : task.stepKey)}
                  data-testid={`button-toggle-step-${task.stepKey}`}
                >
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full ${isCompleted ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <StepIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    {task.description && !isActive && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                  {isCompleted ? (
                    <Badge variant="outline" className="no-default-active-elevate text-xs">Done</Badge>
                  ) : (
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isActive ? "rotate-90" : ""}`} />
                  )}
                </div>
                {isActive && (
                  <CardContent className="pt-0 pb-4">
                    {renderStepContent(task.stepKey)}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {allRequiredDone && data.instance.status !== "completed" && (
          <Button
            className="w-full"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            data-testid="button-submit-onboarding"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Complete Onboarding
          </Button>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Your data is encrypted and stored securely. Questions? Contact your HR department.
          </p>
        </div>
      </div>
    </div>
  );
}
