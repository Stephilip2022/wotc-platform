import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Users, 
  FileText, 
  TrendingUp, 
  Shield, 
  Zap,
  BarChart3,
  Clock,
  DollarSign,
  Globe,
  Bot,
  FileSearch,
  Building2,
  Upload,
  LineChart,
  Lock,
  Sparkles,
  Languages,
  Brain,
  Workflow,
  Server,
  Webhook,
  PieChart,
  Target,
  Award,
  ArrowRight,
  CheckCheck,
  Star
} from "lucide-react";

export default function LandingPage() {

  const coreFeatures = [
    {
      icon: Users,
      title: "Multi-Portal Platform",
      description: "Dedicated portals for employees, employers, and administrators with intelligent role-based access control.",
    },
    {
      icon: Brain,
      title: "AI-Powered Screening",
      description: "Smart questionnaire wizard with reading-level adjustment, eligibility prediction, and confidence scoring.",
    },
    {
      icon: Languages,
      title: "9-Language Support",
      description: "Complete multilingual experience: English, Spanish, French, Chinese, Vietnamese, Korean, Portuguese, German, Japanese.",
    },
    {
      icon: FileSearch,
      title: "Document OCR",
      description: "AI-powered document scanning extracts data from determination letters, DD-214s, and TANF documents automatically.",
    },
    {
      icon: Bot,
      title: "AI Chat Assistant",
      description: "Built-in AI assistant helps users navigate the platform, answer WOTC questions, and troubleshoot issues.",
    },
    {
      icon: LineChart,
      title: "Predictive Analytics",
      description: "Advanced forecasting with employer comparisons, trend analysis, and credit optimization recommendations.",
    },
    {
      icon: Workflow,
      title: "Zero-Touch Processing",
      description: "Fully automated workflow from screening to certification with intelligent queue management.",
    },
    {
      icon: Lock,
      title: "Compliance Automation",
      description: "Scheduled audit scans, violation detection, and automated remediation with complete audit trails.",
    },
  ];

  const advancedFeatures = [
    {
      icon: Building2,
      title: "State Portal Automation",
      description: "Production-ready bots for 56 state portals with OCR parsing, credential encryption, and MFA handling.",
    },
    {
      icon: Upload,
      title: "Bulk Import Tools",
      description: "CSV upload for employee lists and payroll hours with intelligent column detection and reusable templates.",
    },
    {
      icon: Sparkles,
      title: "Self-Service Onboarding",
      description: "6-step employer setup wizard with branding, payroll integration, and team management in minutes.",
    },
    {
      icon: Award,
      title: "Certification Automation",
      description: "Automatic processing from determination letters to certified credits with billing reconciliation.",
    },
    {
      icon: Server,
      title: "Enterprise Integrations",
      description: "Bidirectional sync with ADP, Paychex, Gusto, QuickBooks, Greenhouse, BambooHR, and more.",
    },
    {
      icon: Webhook,
      title: "Developer API Platform",
      description: "Secure REST API with webhooks, scope-based permissions, rate limiting, and interactive documentation.",
    },
    {
      icon: PieChart,
      title: "Multi-Credit Bundling",
      description: "Stack WOTC with R&D credits and state/local incentives for maximum tax savings.",
    },
    {
      icon: Globe,
      title: "White-Label Ready",
      description: "Full branding customization with logos, colors, domains, and revenue sharing for licensee partners.",
    },
  ];

  const stats = [
    { value: "9", label: "Languages Supported", icon: Languages },
    { value: "56", label: "State Portals", icon: Building2 },
    { value: "$9,600", label: "Max Credit/Employee", icon: DollarSign },
    { value: "100%", label: "Automated Processing", icon: Zap },
  ];

  const targetGroups = [
    "TANF Recipients",
    "Veterans (5 subcategories)",
    "Ex-Felons",
    "Designated Community Residents",
    "Vocational Rehabilitation",
    "SNAP Recipients",
    "SSI Recipients",
    "Summer Youth Employees",
    "Long-Term Unemployment",
  ];

  const workflowSteps = [
    {
      step: "1",
      title: "Employee Screening",
      description: "Employees complete our gamified questionnaire in their preferred language with AI-powered question simplification and real-time eligibility prediction.",
    },
    {
      step: "2",
      title: "Automated Determination",
      description: "Our eligibility engine analyzes responses, identifies qualifying target groups, and calculates potential credits with confidence scores.",
    },
    {
      step: "3",
      title: "State Submission",
      description: "Zero-touch processing automatically submits to state portals, handles MFA, and tracks status through intelligent queue management.",
    },
    {
      step: "4",
      title: "Credit Certification",
      description: "OCR scans determination letters, updates certifications, calculates actual credits, and reconciles billing automatically.",
    },
  ];

  const differentiators = [
    "Most comprehensive multilingual support in the industry",
    "AI-powered document processing and eligibility prediction",
    "Only platform with 56-state portal automation",
    "Enterprise-grade security with SOC 2 compliance",
    "Real-time predictive analytics and forecasting",
    "Self-service onboarding in under 10 minutes",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-24 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="max-w-6xl mx-auto text-center space-y-8 relative">
          <div className="flex justify-center gap-2">
            <Badge variant="outline" className="text-sm px-4 py-1">
              <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
              Industry-Leading WOTC Platform
            </Badge>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            The World's Most Advanced
            <span className="block text-primary mt-2">WOTC Optimization System</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Automate your entire Work Opportunity Tax Credit lifecycle with AI-powered screening, 
            56-state portal automation, and real-time predictive analytics. 
            Available in 9 languages.
          </p>
          
          {/* Key Highlights */}
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            {differentiators.slice(0, 3).map((item, index) => (
              <Badge key={index} variant="secondary" className="text-sm py-2 px-4">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                {item}
              </Badge>
            ))}
          </div>

          {/* Login Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button 
              size="lg" 
              asChild
              data-testid="button-employer-login"
              className="min-w-[220px] h-14 text-lg"
            >
              <a href="/api/login">
                <Building2 className="mr-2 h-5 w-5" />
                Employer Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
              data-testid="button-admin-login"
              className="min-w-[220px] h-14 text-lg"
            >
              <a href="/api/login">
                <Shield className="mr-2 h-5 w-5" />
                Admin Portal
              </a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground pt-4">
            Employees access their screening questionnaire through their employer's personalized invitation link
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 md:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center" data-testid={`stat-${index}`}>
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-4xl font-bold">{stat.value}</CardTitle>
                  <CardDescription className="text-sm">{stat.label}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">Core Capabilities</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Intelligent Automation at Every Step</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              From AI-powered screening to automatic credit certification, our platform handles 
              the entire WOTC lifecycle with zero manual intervention
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate" data-testid={`core-feature-${index}`}>
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 px-4 md:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">End-to-End Automation</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From employee screening to certified credits, fully automated in four seamless steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((item, index) => (
              <Card key={index} className="relative" data-testid={`workflow-step-${index}`}>
                <CardHeader>
                  <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-2xl font-bold">
                    {item.step}
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-4 text-muted-foreground">
                    <ArrowRight className="w-8 h-8" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">Enterprise Features</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Built for Scale</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Advanced capabilities for enterprise employers, staffing agencies, and white-label partners
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {advancedFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate" data-testid={`advanced-feature-${index}`}>
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-4">
                    <feature.icon className="w-7 h-7 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Groups Section */}
      <section className="py-24 px-4 md:px-8 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="outline" className="mb-4">Complete Coverage</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">All 9 WOTC Target Groups</h2>
            <p className="text-lg text-muted-foreground">
              Screen for every eligible Work Opportunity Tax Credit category
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {targetGroups.map((group, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-4 bg-background rounded-lg border"
                data-testid={`target-group-${index}`}
              >
                <CheckCheck className="w-5 h-5 text-green-600 shrink-0" />
                <span className="font-medium">{group}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="inline-block">
              <CardContent className="flex items-center gap-6 py-6">
                <div className="text-left">
                  <p className="text-3xl font-bold text-primary">14 Subcategories</p>
                  <p className="text-muted-foreground">Including 5 veteran classifications</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-left">
                  <p className="text-3xl font-bold text-primary">$2,400 - $9,600</p>
                  <p className="text-muted-foreground">Credit range per employee</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="outline" className="mb-4">Why Choose Us</Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Industry-Leading Capabilities</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {differentiators.map((item, index) => (
              <div 
                key={index} 
                className="flex items-start gap-4 p-6 bg-muted/50 rounded-xl"
                data-testid={`differentiator-${index}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <p className="text-lg font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 md:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold">
            Ready to Maximize Your WOTC Credits?
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Join leading employers who trust our AI-powered platform to automate their 
            entire WOTC lifecycle and capture every eligible credit
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              variant="secondary"
              asChild
              data-testid="button-employer-login-cta"
              className="min-w-[220px] h-14 text-lg"
            >
              <a href="/api/login">
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
              data-testid="button-admin-login-cta"
              className="min-w-[220px] h-14 text-lg bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a href="/api/login">Admin Portal</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-8 border-t">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">WOTC Platform</h3>
              <p className="text-muted-foreground text-sm">
                The world's most advanced Work Opportunity Tax Credit optimization system. 
                AI-powered, multilingual, fully automated.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Features</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>AI-Powered Screening</li>
                <li>56-State Portal Automation</li>
                <li>9-Language Support</li>
                <li>Predictive Analytics</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Enterprise</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>Developer API</li>
                <li>White-Label Solutions</li>
                <li>Enterprise Integrations</li>
                <li>Compliance Automation</li>
              </ul>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t text-sm text-muted-foreground">
            <p>© 2026 WOTC Optimization System. All rights reserved.</p>
            <p className="mt-2">
              Enterprise-grade WOTC screening, certification, and credit optimization platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
