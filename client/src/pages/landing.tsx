import { useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle2, 
  Users, 
  TrendingUp, 
  Shield, 
  Zap,
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
  Award,
  ArrowRight,
  Star,
  ShoppingCart,
  Utensils,
  Hotel,
  Truck,
  Factory,
  Headphones,
  Heart,
  HardHat,
  Package,
  Calculator,
  ChevronRight,
  Play,
  Coins,
  Target,
  Crown,
  Rocket
} from "lucide-react";

function GoldNugget({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2L8 6L4 8L2 12L4 16L8 18L12 22L16 18L20 16L22 12L20 8L16 6L12 2Z" />
      <path d="M8 10L10 12L8 14" />
      <path d="M14 9L16 11" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function LandingPage() {
  const [annualHires, setAnnualHires] = useState(500);
  const [selectedState, setSelectedState] = useState("California");
  const [selectedIndustry, setSelectedIndustry] = useState("Restaurants");

  const industryData: Record<string, { avgCredit: number; eligiblePercent: number }> = {
    "Restaurants": { avgCredit: 1200, eligiblePercent: 0.20 },
    "Retail": { avgCredit: 1000, eligiblePercent: 0.17 },
    "Construction": { avgCredit: 1850, eligiblePercent: 0.17 },
    "Trucking & Transportation": { avgCredit: 2000, eligiblePercent: 0.30 },
    "Home Health": { avgCredit: 650, eligiblePercent: 0.30 },
    "Light Industrial": { avgCredit: 850, eligiblePercent: 0.20 },
    "Manufacturing": { avgCredit: 850, eligiblePercent: 0.20 },
    "Warehousing & Distribution": { avgCredit: 850, eligiblePercent: 0.20 },
    "Nursing & Medical": { avgCredit: 1500, eligiblePercent: 0.06 },
    "Grocery & Convenience": { avgCredit: 1250, eligiblePercent: 0.15 },
    "Temporary Staffing": { avgCredit: 1250, eligiblePercent: 0.15 },
    "Hospitality & Hotels": { avgCredit: 1100, eligiblePercent: 0.22 },
    "Call Centers": { avgCredit: 950, eligiblePercent: 0.25 },
  };

  const stateCertRates: Record<string, number> = {
    "Alabama": 0.71, "Alaska": 0.65, "Arizona": 0.65, "Arkansas": 0.65,
    "California": 0.65, "Colorado": 0.65, "Connecticut": 0.65, "Delaware": 0.65,
    "District of Columbia": 0.65, "Florida": 0.65, "Georgia": 0.65, "Hawaii": 0.65,
    "Idaho": 0.65, "Illinois": 0.69, "Indiana": 0.65, "Iowa": 0.63,
    "Kansas": 0.65, "Kentucky": 0.65, "Louisiana": 0.70, "Maine": 0.65,
    "Maryland": 0.72, "Massachusetts": 0.65, "Michigan": 0.75, "Minnesota": 0.65,
    "Mississippi": 0.75, "Missouri": 0.63, "Montana": 0.65, "Nebraska": 0.63,
    "Nevada": 0.59, "New Hampshire": 0.80, "New Jersey": 0.63, "New Mexico": 0.75,
    "New York": 0.60, "North Carolina": 0.65, "North Dakota": 0.63, "Ohio": 0.63,
    "Oklahoma": 0.61, "Oregon": 0.67, "Pennsylvania": 0.59, "Rhode Island": 0.65,
    "South Carolina": 0.65, "South Dakota": 0.63, "Tennessee": 0.65, "Texas": 0.65,
    "Utah": 0.65, "Vermont": 0.65, "Virginia": 0.65, "Washington": 0.67,
    "West Virginia": 0.65, "Wisconsin": 0.65, "Wyoming": 0.65,
  };

  const screeningRate = 0.95;

  const calculateCredits = () => {
    const industry = industryData[selectedIndustry] || { avgCredit: 1200, eligiblePercent: 0.20 };
    const stateCertRate = stateCertRates[selectedState] || 0.65;
    
    const screenedHires = annualHires * screeningRate;
    const eligibleEmployees = Math.round(screenedHires * industry.eligiblePercent);
    const certifiedEmployees = Math.round(eligibleEmployees * stateCertRate);
    const totalCredits = Math.round(certifiedEmployees * industry.avgCredit);
    
    return { 
      screenedHires: Math.round(screenedHires),
      eligibleEmployees, 
      certifiedEmployees,
      totalCredits,
      avgCredit: industry.avgCredit,
      eligiblePercent: industry.eligiblePercent,
      stateCertRate
    };
  };

  const calculatorResults = calculateCredits();

  const industries = [
    { icon: Utensils, name: "Restaurants", eligibility: "20-30%" },
    { icon: ShoppingCart, name: "Retail", eligibility: "17-25%" },
    { icon: Hotel, name: "Hospitality", eligibility: "15-25%" },
    { icon: Package, name: "Warehousing", eligibility: "20-28%" },
    { icon: Factory, name: "Manufacturing", eligibility: "12-20%" },
    { icon: Headphones, name: "Call Centers", eligibility: "22-35%" },
    { icon: Heart, name: "Healthcare", eligibility: "10-18%" },
    { icon: Truck, name: "Transportation", eligibility: "15-22%" },
    { icon: HardHat, name: "Construction", eligibility: "12-18%" },
    { icon: Users, name: "Staffing", eligibility: "25-40%" },
  ];

  const coreFeatures = [
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
      title: "Document OCR & AI Extraction",
      description: "AI-powered scanning extracts data from DD-214s, TANF documents, and determination letters automatically.",
    },
    {
      icon: Bot,
      title: "AI Chat Assistant",
      description: "Built-in AI assistant helps users navigate the platform and answer WOTC questions instantly.",
    },
    {
      icon: LineChart,
      title: "Predictive Analytics & Forecasting",
      description: "Advanced credit forecasting with trend analysis, employer comparisons, and optimization recommendations.",
    },
    {
      icon: Lock,
      title: "Compliance Automation",
      description: "Scheduled audit scans, violation detection, automated remediation with complete audit trails.",
    },
    {
      icon: Building2,
      title: "56 State Portal Automation",
      description: "Production-ready bots for all state workforce agencies with OCR parsing and MFA handling.",
    },
    {
      icon: Workflow,
      title: "Zero-Touch Processing",
      description: "Fully automated workflow from screening to state submission to certification with intelligent queue management.",
    },
    {
      icon: Award,
      title: "ETA Form 9198 Automation",
      description: "Digital intake, e-signatures, and automated form generation for WOTC authorization.",
    },
    {
      icon: PieChart,
      title: "Multi-Credit Bundling",
      description: "Stack WOTC with R&D tax credits and state/local incentives for maximum tax savings.",
    },
    {
      icon: TrendingUp,
      title: "Retention & Turnover Analytics",
      description: "AI-powered turnover prediction, 400-hour milestone tracking, and retention optimization.",
    },
    {
      icon: Upload,
      title: "Bulk Import Tools",
      description: "CSV upload with intelligent column detection, employee matching, and reusable mapping templates.",
    },
  ];

  const advancedFeatures = [
    {
      icon: Server,
      title: "Enterprise Integrations",
      description: "Bidirectional sync with ADP, Paychex, Gusto, QuickBooks, Greenhouse, and BambooHR.",
    },
    {
      icon: Webhook,
      title: "Developer API & Webhooks",
      description: "Secure REST API with scope-based permissions, rate limiting, and real-time webhooks.",
    },
    {
      icon: Globe,
      title: "White-Label Platform",
      description: "Full branding customization with logos, colors, domains, and revenue sharing for licensees.",
    },
    {
      icon: Sparkles,
      title: "Self-Service Onboarding",
      description: "6-step employer setup wizard with branding, payroll integration, and team management.",
    },
    {
      icon: DollarSign,
      title: "Flexible Pricing Models",
      description: "Percentage-based, milestone flat fees, per-screening volume, or deferred annual billing.",
    },
    {
      icon: Clock,
      title: "400-Hour Milestone Tracking",
      description: "Automatic tracking of hours worked to maximize first-year and second-year credits.",
    },
    {
      icon: Shield,
      title: "Role-Based Access Control",
      description: "Multi-portal platform with dedicated access for employees, employers, admins, and licensees.",
    },
    {
      icon: Zap,
      title: "Email & Push Notifications",
      description: "Automated screening invites, status updates, milestone alerts, and invoice reminders.",
    },
  ];

  const stats = [
    { value: "$9,600", label: "Max Credit Per Employee", icon: DollarSign },
    { value: "56", label: "State Portals Automated", icon: Building2 },
    { value: "9", label: "Languages Supported", icon: Languages },
    { value: "100%", label: "Automated Processing", icon: Zap },
  ];

  const workflowSteps = [
    {
      step: "01",
      title: "Screen",
      description: "Employees complete gamified questionnaires in their language with AI simplification.",
      icon: Users,
    },
    {
      step: "02", 
      title: "Analyze",
      description: "AI engine identifies qualifying groups and calculates potential credits instantly.",
      icon: Brain,
    },
    {
      step: "03",
      title: "Submit",
      description: "Zero-touch processing submits to state portals automatically with MFA handling.",
      icon: Rocket,
    },
    {
      step: "04",
      title: "Collect",
      description: "OCR scans determination letters and certifies credits for your tax return.",
      icon: Coins,
    },
  ];

  const testimonials = [
    {
      quote: "Rockerbox increased our WOTC capture rate by 340% in the first quarter.",
      author: "Sarah Chen",
      role: "HR Director",
      company: "FastFood Corp",
    },
    {
      quote: "The AI screening saves our team 20 hours per week on manual data entry.",
      author: "Michael Torres",
      role: "Payroll Manager",
      company: "StaffRight Solutions",
    },
    {
      quote: "Finally, a WOTC platform that actually works. State automation is a game-changer.",
      author: "Jennifer Walsh",
      role: "CFO",
      company: "Hospitality Group LLC",
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <GoldNugget className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold gradient-text">Rockerbox</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#calculator" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Calculator</a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#industries" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Industries</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            </div>
            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" data-testid="button-login-nav">
                  Log In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/register/employer">
                <Button size="sm" data-testid="button-employer-signup-nav">
                  Employer Sign Up
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 md:px-8 hero-gradient overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto text-center space-y-8 relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">The #1 WOTC Optimization Platform</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-none">
            <span className="block">Unlock Hidden</span>
            <span className="block gradient-text mt-2">Tax Credits</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Automate your entire WOTC lifecycle with AI-powered screening, 
            <span className="text-foreground font-medium"> 56-state portal automation</span>, and 
            <span className="text-foreground font-medium"> predictive analytics</span>. 
            Available in <span className="text-primary font-semibold">9 languages</span>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <SignUpButton mode="modal" forceRedirectUrl="/register/employer">
              <Button 
                size="lg" 
                data-testid="button-employer-signup"
                className="h-14 px-8 text-lg font-semibold animate-pulse-glow"
              >
                <Building2 className="mr-2 h-5 w-5" />
                Employer Sign Up
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button 
                size="lg" 
                variant="outline"
                data-testid="button-employee-login"
                className="h-14 px-8 text-lg"
              >
                <Users className="mr-2 h-5 w-5" />
                Employee Login
              </Button>
            </SignInButton>
          </div>

          <p className="text-sm text-muted-foreground">
            Employers: No credit card required. Setup in under 10 minutes. Employees: Log in to complete your WOTC screening.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 md:px-8 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center" data-testid={`stat-${index}`}>
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                  <stat.icon className="w-7 h-7 text-primary" />
                </div>
                <p className="text-4xl md:text-5xl font-black gradient-text">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator Section */}
      <section id="calculator" className="py-24 px-4 md:px-8 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Calculator className="h-3 w-3 mr-1" />
              Free Savings Calculator
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black">
              How Much Could <span className="gradient-text">You Save?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Calculate your potential WOTC tax credits in seconds
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <Card className="lg:col-span-3 p-6 border-2" data-testid="card-wotc-calculator">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-primary" />
                  </div>
                  WOTC Credit Estimator
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 space-y-8">
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">1</span>
                    Select Your State
                  </Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="h-12" data-testid="select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(stateCertRates).sort().map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    State certification rate: <span className="font-semibold text-primary">{Math.round(calculatorResults.stateCertRate * 100)}%</span>
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">2</span>
                    Annual New Hires
                  </Label>
                  <div className="flex items-center gap-6">
                    <Slider
                      value={[annualHires]}
                      onValueChange={(value) => setAnnualHires(value[0])}
                      min={10}
                      max={5000}
                      step={10}
                      className="flex-1"
                      data-testid="slider-annual-hires"
                    />
                    <div className="text-4xl font-black text-primary min-w-[100px] text-right">
                      {annualHires.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-bold">3</span>
                    Select Your Industry
                  </Label>
                  <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                    <SelectTrigger className="h-12" data-testid="select-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(industryData).map((industry) => (
                        <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Avg credit: <span className="font-semibold">${calculatorResults.avgCredit.toLocaleString()}</span> | 
                    Eligible rate: <span className="font-semibold">{Math.round(calculatorResults.eligiblePercent * 100)}%</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-white border-0 shadow-2xl" data-testid="card-calculator-results">
              <CardContent className="p-0 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Estimated Annual</p>
                    <p className="text-lg font-semibold">WOTC Tax Credits</p>
                  </div>
                </div>

                <div className="py-6">
                  <p className="text-7xl md:text-8xl font-black tracking-tight">
                    ${calculatorResults.totalCredits.toLocaleString()}
                  </p>
                  <p className="text-lg opacity-90 mt-2">per year in tax savings</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{calculatorResults.eligibleEmployees}</p>
                    <p className="text-xs opacity-80">Eligible</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{calculatorResults.certifiedEmployees}</p>
                    <p className="text-xs opacity-80">Certified</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">${calculatorResults.avgCredit.toLocaleString()}</p>
                    <p className="text-xs opacity-80">Avg Credit</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Up to $9,600 for veteran categories</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dollar-for-dollar tax liability reduction</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>No limit on eligible employees</span>
                  </div>
                </div>

                <SignUpButton mode="modal" forceRedirectUrl="/register/employer">
                  <Button 
                    variant="secondary" 
                    size="lg" 
                    className="w-full h-14 text-lg font-semibold bg-white text-amber-700 hover:bg-white/90"
                    data-testid="button-get-started-calculator"
                  >
                    Start Capturing Credits
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>

                <p className="text-xs opacity-60 text-center">
                  Based on industry averages. Actual results may vary.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-24 px-4 md:px-8 bg-muted/50 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Target className="h-3 w-3 mr-1" />
              High-Impact Industries
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black">
              Industries We <span className="gradient-text">Serve</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              WOTC delivers the highest ROI for industries with high turnover and entry-level positions
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {industries.map((industry, index) => (
              <Card key={index} className="hover-elevate group cursor-pointer transition-all duration-300" data-testid={`industry-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <industry.icon className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-semibold text-sm">{industry.name}</p>
                  <p className="text-xs text-primary mt-1 font-medium">{industry.eligibility} eligible</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 md:px-8 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Platform Features
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black">
              Everything You <span className="gradient-text">Need</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete solution for WOTC management from screening to certification
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="hover-elevate group" data-testid={`feature-${index}`}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {advancedFeatures.map((feature, index) => (
              <Card key={index} className="bg-muted/50 hover-elevate" data-testid={`advanced-feature-${index}`}>
                <CardContent className="p-5 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 md:px-8 bg-card border-y border-border scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Workflow className="h-3 w-3 mr-1" />
              Simple Process
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black">
              How <span className="gradient-text">Rockerbox</span> Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From employee screening to certified tax credits in four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step, index) => (
              <div key={index} className="relative" data-testid={`workflow-step-${index}`}>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-primary/10" />
                )}
                <Card className="relative hover-elevate bg-background">
                  <CardContent className="p-6 text-center">
                    <div className="relative inline-block mb-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <step.icon className="w-8 h-8 text-primary" />
                      </div>
                      <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Star className="h-3 w-3 mr-1 fill-primary" />
              Customer Stories
            </Badge>
            <h2 className="text-4xl md:text-6xl font-black">
              Trusted by <span className="gradient-text">Industry Leaders</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover-elevate" data-testid={`testimonial-${index}`}>
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-lg mb-6 leading-relaxed">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {testimonial.author.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{testimonial.author}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 md:px-8 hero-gradient">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <GoldNugget className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Start Your Free Trial Today</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-black">
            Ready to Capture Your
            <span className="block gradient-text mt-2">Hidden Tax Credits?</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of employers who are maximizing their WOTC credits with Rockerbox. 
            Setup takes less than 10 minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignUpButton mode="modal" forceRedirectUrl="/register/employer">
              <Button 
                size="lg" 
                className="h-14 px-10 text-lg font-semibold"
                data-testid="button-final-cta"
              >
                Employer Sign Up
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button 
                size="lg" 
                variant="outline"
                className="h-14 px-10 text-lg"
                data-testid="button-employee-login-bottom"
              >
                <Users className="mr-2 h-5 w-5" />
                Employee Login
              </Button>
            </SignInButton>
          </div>

          <div className="flex flex-wrap justify-center gap-6 pt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Setup in 10 minutes
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Free savings calculation
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-8 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <GoldNugget className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Rockerbox</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Rockerbox. All rights reserved. The WOTC Optimization Platform.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}