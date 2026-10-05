import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Check, Gift, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type EligibilityResponse = {
  eligible: boolean;
  trialDays: number;
  accessToken: string;
  message?: string;
};

export default function LaborDayTrialPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [inviteToken] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    return fromUrl || sessionStorage.getItem("labor_day_invite") || "";
  });
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  const inviteValidity = useQuery<{ valid: boolean }>({
    queryKey: ["/api/stripe/labor-day-trial/invite", inviteToken],
    enabled: Boolean(inviteToken),
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/stripe/labor-day-trial/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken }),
      });
      if (!response.ok) throw new Error("This private offer link is invalid or has expired.");
      return response.json();
    },
  });

  const eligibility = useQuery<EligibilityResponse>({
    queryKey: ["/api/stripe/labor-day-trial/eligibility", inviteToken],
    enabled: isAuthenticated && inviteValidity.data?.valid === true,
    retry: false,
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/stripe/labor-day-trial/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not verify trial eligibility.");
      }
      return data;
    },
  });

  useEffect(() => {
    const robotsMeta = document.createElement("meta");
    robotsMeta.name = "robots";
    robotsMeta.content = "noindex,nofollow,noarchive";
    document.head.appendChild(robotsMeta);

    if (inviteToken) {
      sessionStorage.setItem("labor_day_invite", inviteToken);
      if (window.location.search) {
        window.history.replaceState({}, "", "/labor-day-bundle");
      }
    }
    return () => robotsMeta.remove();
  }, [inviteToken]);

  const startTrial = async () => {
    if (!eligibility.data?.accessToken) return;
    setIsStartingCheckout(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          billingPeriod,
          trialAccessToken: eligibility.data.accessToken,
          inviteToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not start checkout.");
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Could not start your trial",
        description: error.message,
        variant: "destructive",
      });
      setIsStartingCheckout(false);
    }
  };

  if (!inviteToken || inviteValidity.isError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-20">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Private link required</CardTitle>
              <CardDescription>
                Please use the private link included in your confirmation email.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  if (inviteValidity.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="flex justify-center py-24 text-gray-600">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Checking private link…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4 bg-amber-100 text-amber-800 hover:bg-amber-100">
            Private Labor Day Bundle Offer
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Try GrantFind Pro free for 30 days
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Explore every Premium grant-finding and writing tool today. Your card is charged only
            after the trial unless you cancel.
          </p>
        </div>

        <Card className="mx-auto mt-10 max-w-2xl border-amber-200 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Gift className="h-6 w-6 text-amber-700" />
            </div>
            <CardTitle>GrantFind Premium</CardTitle>
            <CardDescription>Choose the plan that begins after your free trial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  billingPeriod === "monthly"
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 hover:border-amber-200"
                }`}
              >
                <p className="font-semibold text-gray-900">Monthly</p>
                <p className="mt-1 text-2xl font-bold">$27<span className="text-sm font-normal text-gray-500">/month</span></p>
                <p className="mt-2 text-xs text-gray-500">First charge after 30 days</p>
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  billingPeriod === "annual"
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 hover:border-amber-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">Annual</p>
                  <Badge className="bg-green-100 text-green-700">Save 17%</Badge>
                </div>
                <p className="mt-1 text-2xl font-bold">$270<span className="text-sm font-normal text-gray-500">/year</span></p>
                <p className="mt-2 text-xs text-gray-500">First charge after 30 days</p>
              </button>
            </div>

            <ul className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              {["AI Grant Finder", "AI Proposal Writer", "Application Reviewer", "All Premium features"].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>

            {!isAuthenticated ? (
              <div className="space-y-3 rounded-xl bg-gray-50 p-5 text-center">
                <p className="font-medium text-gray-900">Create a new account to claim this offer</p>
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Button asChild className="bg-amber-600 hover:bg-amber-700">
                    <Link href={`/signup?redirect=${encodeURIComponent(`/labor-day-bundle?invite=${encodeURIComponent(inviteToken)}`)}`}>
                      Create Account
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/signin?redirect=${encodeURIComponent(`/labor-day-bundle?invite=${encodeURIComponent(inviteToken)}`)}`}>
                      Sign In
                    </Link>
                  </Button>
                </div>
              </div>
            ) : eligibility.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-3 text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying your offer eligibility…
              </div>
            ) : eligibility.isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                {(eligibility.error as Error).message}
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-700 text-base hover:from-amber-600 hover:to-amber-800"
                onClick={startTrial}
                disabled={isStartingCheckout}
              >
                {isStartingCheckout ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening secure checkout…</>
                ) : (
                  "Start My 30-Day Free Trial"
                )}
              </Button>
            )}

            <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                A card is required. Cancel during the trial to keep access through the final day
                without being charged. This offer is limited to first-time subscribers.
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}