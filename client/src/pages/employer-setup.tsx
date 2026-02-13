import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SetupTokenData {
  employerName: string;
  contactName: string;
  email: string;
  employerId: string;
}

export default function EmployerSetupPage({ token }: { token: string }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const { data: tokenData, isLoading, error } = useQuery<SetupTokenData>({
    queryKey: ["/api/public/setup", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/setup/${token}/validate`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid or expired setup link");
      }
      return res.json();
    },
    retry: false,
  });

  const setupMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const res = await apiRequest("POST", `/api/public/setup/${token}/complete`, data);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.signInUrl) {
        setSetupComplete(true);
        setTimeout(() => {
          window.location.href = data.signInUrl;
        }, 2000);
      } else {
        setSetupComplete(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error?.message || "Failed to create your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setupMutation.mutate({ password });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Validating your setup link...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle data-testid="text-setup-error-title">Invalid Setup Link</CardTitle>
            <CardDescription data-testid="text-setup-error-description">
              {(error as Error)?.message || "This setup link is invalid or has expired. Please contact your administrator for a new welcome email."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">
              Go to Home Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle data-testid="text-setup-success-title">Account Created!</CardTitle>
            <CardDescription data-testid="text-setup-success-description">
              Your account has been set up. Redirecting you to sign in...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-setup-title">
            Set Up Your Account
          </CardTitle>
          <CardDescription data-testid="text-setup-description">
            Welcome, {tokenData.contactName || "there"}! Create a password to access the {tokenData.employerName} employer portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={tokenData.email}
                disabled
                className="bg-muted"
                data-testid="input-setup-email"
              />
              <p className="text-xs text-muted-foreground">This is the email associated with your employer account.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  data-testid="input-setup-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                data-testid="input-setup-confirm-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setupMutation.isPending || !password || !confirmPassword}
              data-testid="button-setup-submit"
            >
              {setupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Account...
                </>
              ) : (
                "Create Account & Sign In"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{" "}
              <a href="/" className="text-primary hover:underline" data-testid="link-sign-in">
                Sign in here
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
