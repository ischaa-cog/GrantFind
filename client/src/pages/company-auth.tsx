import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CompanyAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest("/api/company/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("companyToken", data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/company/auth/me"] });
      toast({
        title: "Success",
        description: "Successfully logged in",
      });
      setLocation("/company/dashboard");
    },
    onError: (error: any) => {
      // Parse the error message to extract just the user-friendly message
      let errorMessage = "Login failed";
      
      if (error.message) {
        // Error format is typically "401: {"message":"Invalid email or password"}"
        const match = error.message.match(/:\s*(\{.*\})/);
        if (match) {
          try {
            const jsonError = JSON.parse(match[1]);
            errorMessage = jsonError.message || errorMessage;
          } catch {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/grantfind-logo.png" 
              alt="GrantFind Logo" 
              className="h-10 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Company Login</CardTitle>
          <CardDescription>
            Access your company's grant management dashboard
          </CardDescription>
          <button
            onClick={() => setLocation("/")}
            className="mt-4 text-yellow-600 hover:text-yellow-700 text-sm"
          >
            ← Back to home
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="company@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
          

        </CardContent>
      </Card>
    </div>
  );
}