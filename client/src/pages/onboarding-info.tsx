import { SignInButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Users,
  Shield,
  Zap,
  Clock,
  Smartphone,
  FileText,
  Building2,
  Upload,
  Lock,
  Pen,
  ArrowRight,
  ArrowLeft,
  Wallet,
  Phone,
  Mail,
  QrCode,
  Link2,
  Settings,
  Layers,
  BarChart3,
  UserPlus,
  Globe,
  Download,
  ClipboardCheck,
} from "lucide-react";
import { Link } from "wouter";

export default function OnboardingInfoPage() {
  const onboardingSteps = [
    {
      icon: Users,
      title: "Personal Information",
      description: "Name, address, contact details, date of birth, and Social Security Number for tax and payroll processing.",
    },
    {
      icon: FileText,
      title: "Federal Tax (W-4)",
      description: "Complete the W-4 form with guided prompts for filing status, dependents, and withholding preferences.",
    },
    {
      icon: Building2,
      title: "State Tax Withholding",
      description: "State-specific tax withholding elections with allowances and additional withholding options.",
    },
    {
      icon: Wallet,
      title: "Direct Deposit",
      description: "Bank name, routing number, account number, and account type for paycheck direct deposit setup.",
    },
    {
      icon: Phone,
      title: "Emergency Contact",
      description: "Designated emergency contact with name, relationship, phone number, and email.",
    },
    {
      icon: Upload,
      title: "Photo ID Upload",
      description: "Upload a government-issued photo ID (driver's license, passport, or state ID) for identity verification.",
    },
    {
      icon: Pen,
      title: "Policy Acknowledgements",
      description: "Review and digitally sign the employee handbook, code of conduct, confidentiality agreement, and at-will notice.",
    },
  ];

  const deliveryMethods = [
    {
      icon: Mail,
      title: "Email Invite",
      description: "Automated welcome email with a secure onboarding link sent directly to the new hire's inbox.",
    },
    {
      icon: Smartphone,
      title: "SMS Text Message",
      description: "Text message with onboarding link for immediate mobile access. Perfect for hourly and field workers.",
    },
    {
      icon: QrCode,
      title: "QR Code",
      description: "Generate a scannable QR code for in-person onboarding at orientation sessions or job fairs.",
    },
    {
      icon: Link2,
      title: "Direct URL",
      description: "Copy and share the unique onboarding link through any channel: Slack, Teams, or your ATS system.",
    },
  ];

  const employerFeatures = [
    {
      icon: UserPlus,
      title: "Single & Bulk Invites",
      description: "Invite one new hire at a time or upload a CSV to onboard dozens simultaneously with smart column detection.",
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Funnel analysis, completion rates, average time-to-complete, and daily activity trends across all new hires.",
    },
    {
      icon: Settings,
      title: "Customizable Steps",
      description: "Toggle each onboarding step as required, optional, or disabled. Set custom deadlines and welcome messages.",
    },
    {
      icon: Layers,
      title: "Department Templates",
      description: "Create reusable templates for different departments or job roles with pre-configured step requirements.",
    },
    {
      icon: ClipboardCheck,
      title: "Progress Tracking",
      description: "Monitor each new hire's progress in real time. See which steps are completed, pending, or overdue.",
    },
    {
      icon: Download,
      title: "Data Export",
      description: "Export completed onboarding data as JSON with automatic PII masking for compliance and record-keeping.",
    },
    {
      icon: Zap,
      title: "Auto-Create Employee Records",
      description: "When onboarding completes, employee records are automatically created in the system with all collected data.",
    },
    {
      icon: Globe,
      title: "WOTC Screening Integration",
      description: "Optionally trigger WOTC screening automatically when onboarding finishes to maximize tax credit capture.",
    },
  ];

  const benefits = [
    { text: "100% paperless onboarding" },
    { text: "Mobile-first design works on any device" },
    { text: "No login required for new hires" },
    { text: "Secure token-based access with expiration" },
    { text: "Encrypted PII storage" },
    { text: "Automated email and SMS notifications" },
    { text: "Reminder system at day 3 and day 7" },
    { text: "Seamless WOTC screening connection" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2" data-testid="link-back-home">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Back to Home</span>
            </Link>
            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <Button size="sm" data-testid="button-login-onboarding-nav">
                  Employer Login
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 px-4 md:px-8 hero-gradient overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
        </div>

        <div className="max-w-5xl mx-auto text-center space-y-6 relative">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Smartphone className="h-3 w-3 mr-1" />
            Mobile-First Onboarding
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none" data-testid="text-onboarding-hero-title">
            <span className="block">New Hire</span>
            <span className="block gradient-text mt-2">Digital Onboarding</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Eliminate paper forms and manual data entry. New hires complete W-4, direct deposit, ID verification,
            and policy signatures from their phone in minutes — no app download or login required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <SignInButton mode="modal">
              <Button size="lg" data-testid="button-onboarding-cta">
                <Lock className="mr-2 h-5 w-5" />
                Access Employer Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignInButton>
          </div>

          <p className="text-sm text-muted-foreground">
            Employers log in to send onboarding invites and manage new hire progress
          </p>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "< 10 min", label: "Average Completion Time", icon: Clock },
              { value: "100%", label: "Paperless Process", icon: FileText },
              { value: "7", label: "Onboarding Steps", icon: ClipboardCheck },
              { value: "Any Device", label: "Mobile, Tablet, Desktop", icon: Smartphone },
            ].map((stat, index) => (
              <div key={index} className="text-center" data-testid={`onboarding-stat-${index}`}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-3xl md:text-4xl font-black gradient-text">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-14">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Users className="h-3 w-3 mr-1" />
              For New Hires
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black">
              How <span className="gradient-text">New Hires</span> Use It
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              New hires receive a secure link via email or text and complete all required forms from their phone.
              No account creation, no app download, no login needed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {onboardingSteps.map((step, index) => (
              <Card key={index} className="hover-elevate group" data-testid={`onboarding-step-${index}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <step.icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary">Step {index + 1}</span>
                      </div>
                      <h3 className="font-bold text-sm mb-1">{step.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/50">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-4">How New Hires Access Onboarding</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {deliveryMethods.map((method, index) => (
                  <div key={index} className="flex items-start gap-3" data-testid={`delivery-method-${index}`}>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <method.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{method.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 bg-muted/50 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-14">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Building2 className="h-3 w-3 mr-1" />
              For Employers
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black">
              How <span className="gradient-text">Employers</span> Manage It
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Employers log into the Rockerbox portal to send invites, track progress, customize settings,
              and manage the entire onboarding workflow from a single dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {employerFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate group" data-testid={`employer-feature-${index}`}>
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Shield className="h-3 w-3 mr-1" />
                Secure & Compliant
              </Badge>
              <h2 className="text-3xl md:text-4xl font-black">
                Built for <span className="gradient-text">Security</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Every piece of data collected during onboarding is encrypted at rest and in transit.
                Social Security Numbers, bank account details, and personal information are protected
                with enterprise-grade security. PII is automatically masked in exports and reports.
              </p>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3" data-testid={`benefit-${index}`}>
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-xl font-bold">Employer Access</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Employers are set up by a Rockerbox administrator. Once your account is created,
                  you receive a welcome email with a secure setup link. Click the link, set your password,
                  and you're in. From there you can:
                </p>
                <div className="space-y-3">
                  {[
                    "Send onboarding invites to new hires",
                    "Track completion progress in real time",
                    "Customize which steps are required",
                    "Create department-specific templates",
                    "Export completed onboarding records",
                    "View analytics and performance metrics",
                    "Manage WOTC screenings alongside onboarding",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                <SignInButton mode="modal">
                  <Button className="w-full" data-testid="button-employer-login-card">
                    <Lock className="mr-2 h-4 w-4" />
                    Log In to Employer Portal
                  </Button>
                </SignInButton>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 hero-gradient">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-black">
            Ready to Go <span className="gradient-text">Paperless?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Streamline your new hire experience. Get your onboarding system set up
            and start sending invites in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignInButton mode="modal">
              <Button size="lg" data-testid="button-onboarding-final-cta">
                <Lock className="mr-2 h-5 w-5" />
                Access Your Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignInButton>
          </div>
          <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              No app download needed
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Works on any device
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Setup in minutes
            </span>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 md:px-8 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-home-footer">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Rockerbox Home</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Part of the Rockerbox WOTC Optimization Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
