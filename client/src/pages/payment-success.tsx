import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/header";

export default function PaymentSuccessPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      return;
    }

    const token = localStorage.getItem("auth_token");
    fetch(`/api/stripe/session-status?session_id=${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setSessionData(data);
        if (data.status === "paid" || data.status === "trialing") {
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <Header />
      <div className="flex items-center justify-center p-6 mt-12">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            {status === "loading" && (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 mx-auto text-amber-500 animate-spin" />
                <h2 className="text-xl font-semibold">Confirming your subscription...</h2>
                <p className="text-gray-600">Please wait while we confirm your account access.</p>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
                <h2 className="text-2xl font-bold text-gray-900">
                  {sessionData?.status === "trialing" ? "Your Free Trial Is Active!" : "Payment Successful!"}
                </h2>
                <p className="text-gray-600">
                  Your account has been upgraded to Premium. You now have access to all features including AI Grant Finder, Proposal Writer, and Application Reviewer.
                </p>
                {sessionData?.status !== "trialing" && sessionData?.customerEmail && (
                  <p className="text-sm text-gray-500">
                    A receipt has been sent to {sessionData.customerEmail}
                  </p>
                )}
                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    onClick={() => setLocation("/")}
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setLocation("/profile")}
                  >
                    View Account
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <XCircle className="w-16 h-16 mx-auto text-red-500" />
                <h2 className="text-2xl font-bold text-gray-900">Payment Issue</h2>
                <p className="text-gray-600">
                  We couldn't verify your payment. If you were charged, please contact support and we'll resolve this right away.
                </p>
                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    onClick={() => setLocation("/profile")}
                  >
                    Back to Profile
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
