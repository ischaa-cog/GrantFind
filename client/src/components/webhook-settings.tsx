import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Send, Settings } from "lucide-react";

interface WebhookConfig {
  configured: boolean;
  url: string | null;
}

export function WebhookSettings() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWebhookConfig();
  }, []);

  const fetchWebhookConfig = async () => {
    try {
      const response = await apiRequest("/api/webhook/config");
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error("Failed to fetch webhook config:", error);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL to test",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await apiRequest("/api/webhook/test", {
        method: "POST",
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to test webhook",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <CardTitle>User Registration Webhook</CardTitle>
        </div>
        <CardDescription>
          Configure webhook notifications for new user registrations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Configuration Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Current Status:</span>
            {config?.configured ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge variant="secondary" className="bg-green-50 text-green-700">
                  Configured
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600" />
                <Badge variant="secondary" className="bg-red-50 text-red-700">
                  Not Configured
                </Badge>
              </>
            )}
          </div>
          {config?.url && (
            <span className="text-sm text-gray-500 font-mono">
              {config.url}
            </span>
          )}
        </div>

        {/* Webhook URL Testing */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="webhookUrl" className="text-sm font-medium">
              Test Webhook URL
            </Label>
            <div className="flex space-x-2 mt-2">
              <Input
                id="webhookUrl"
                placeholder="https://your-domain.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={testWebhook}
                disabled={isTesting || !webhookUrl.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isTesting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Configuration Instructions */}
        <div className="space-y-4">
          <h4 className="font-medium">Configuration Instructions</h4>
          <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm">
            <p>
              <strong>1. Set Environment Variable:</strong>
            </p>
            <code className="block bg-gray-100 p-2 rounded font-mono text-xs">
              USER_REGISTRATION_WEBHOOK_URL=https://your-domain.com/webhook
            </code>
            
            <p>
              <strong>2. Webhook Payload Format:</strong>
            </p>
            <pre className="bg-gray-100 p-2 rounded font-mono text-xs overflow-x-auto">
{`{
  "event": "user.registered",
  "timestamp": "2025-01-31T12:00:00Z",
  "data": {
    "user": {
      "id": 123,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}`}
            </pre>

            <p>
              <strong>3. Headers:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>Content-Type: application/json</code></li>
              <li><code>User-Agent: GrantFind/1.0</code></li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}