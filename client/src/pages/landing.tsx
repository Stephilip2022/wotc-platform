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
  DollarSign
} from "lucide-react";

export default function LandingPage() {

  const features = [
    {
      icon: Users,
      title: "Multi-Tenant Platform",
      description: "Dedicated portals for employees, employers, and administrators with role-based access control.",
    },
    {
      icon: FileText,
      title: "Intelligent Screening",
      description: "Gamified questionnaire wizard covering all 9 WOTC target groups with AI-powered question simplification.",
    },
    {
      icon: TrendingUp,
      title: "Automated Eligibility",
      description: "Metadata-driven eligibility engine that automatically determines qualification for tax credits.",
    },
    {
      icon: Shield,
      title: "Secure Document Management",
      description: "Object storage integration for DD-214s, TANF letters, and other verification documents.",
    },
    {
      icon: BarChart3,
      title: "Credit Calculations",
      description: "Real-time tracking of credit amounts, work hours, and projected vs. actual credit values.",
    },
    {
      icon: Zap,
      title: "IRS Form Generation",
      description: "Automated creation of Form 8850 and ETA Form 9061/9062 for seamless submissions.",
    },
    {
      icon: DollarSign,
      title: "Stripe Billing",
      description: "Integrated payment processing with revenue-share calculations for licensee partners.",
    },
    {
      icon: Clock,
      title: "White-Label Ready",
      description: "Employer branding customization with logos, colors, and custom welcome messages.",
    },
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <Badge variant="outline" className="text-sm">
            Work Opportunity Tax Credit Platform
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            WOTC Optimization System
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Streamline your Work Opportunity Tax Credit process with our comprehensive
            enterprise SaaS platform. Maximize credits, minimize paperwork.
          </p>
          
          {/* Login Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              asChild
              data-testid="button-employer-login"
              className="min-w-[200px]"
            >
              <a href="/api/login">
                <Users className="mr-2 h-5 w-5" />
                Employer Login
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
              data-testid="button-admin-login"
              className="min-w-[200px]"
            >
              <a href="/api/login">
                <Shield className="mr-2 h-5 w-5" />
                Admin Portal
              </a>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground pt-4">
            Employees: Access your screening questionnaire through your employer's invitation link
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 md:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card data-testid="stat-target-groups">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold">9</CardTitle>
                <CardDescription>Target Groups</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-subcategories">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold">14</CardTitle>
                <CardDescription>Subcategories</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-max-credit">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold">$9,600</CardTitle>
                <CardDescription>Max Credit/Employee</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-automated">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold">100%</CardTitle>
                <CardDescription>Automated Processing</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Platform Features</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage WOTC screening, certification, and credit tracking
              in one comprehensive platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover-elevate">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Groups Section */}
      <section className="py-20 px-4 md:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Complete WOTC Coverage</h2>
            <p className="text-lg text-muted-foreground">
              Screen for all eligible Work Opportunity Tax Credit target groups
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targetGroups.map((group, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-background rounded-lg" data-testid={`target-group-${index}`}>
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span className="font-medium">{group}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Simple, streamlined workflow from screening to credit calculation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-xl font-bold">
                  1
                </div>
                <CardTitle>Employee Screening</CardTitle>
                <CardDescription>
                  Employees complete the gamified questionnaire wizard with AI-assisted questions
                  and conditional follow-ups based on their responses.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-xl font-bold">
                  2
                </div>
                <CardTitle>Automated Determination</CardTitle>
                <CardDescription>
                  Our eligibility engine analyzes responses against IRS requirements and automatically
                  identifies qualifying target groups and credit amounts.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-4 text-xl font-bold">
                  3
                </div>
                <CardTitle>Form Generation & Tracking</CardTitle>
                <CardDescription>
                  Generate IRS forms automatically, track certification status, and monitor
                  credit calculations with real-time analytics dashboards.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Optimize Your WOTC Credits?
          </h2>
          <p className="text-lg opacity-90">
            Join employers who are maximizing their tax credits with our automated platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              variant="secondary"
              asChild
              data-testid="button-employer-login-cta"
              className="min-w-[200px]"
            >
              <a href="/api/login">Employer Login</a>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
              data-testid="button-admin-login-cta"
              className="min-w-[200px] bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a href="/api/login">Admin Portal</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 md:px-8 border-t">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 WOTC Optimization System. All rights reserved.</p>
          <p className="mt-2">
            Work Opportunity Tax Credit screening and certification platform
          </p>
        </div>
      </footer>
    </div>
  );
}
