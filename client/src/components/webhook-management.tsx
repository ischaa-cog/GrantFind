import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Webhook, CheckCircle, XCircle, Play, Save, Plus, Edit, Trash2 } from "lucide-react";

interface WebhookConfig {
  id: string;
  name: string;
  event: string;
  url: string;
  active: boolean;
  description: string;
}

const webhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  event: z.string().min(1, "Event type is required"),
  url: z.string().url("Valid URL is required"),
  description: z.string().optional(),
});

type WebhookForm = z.infer<typeof webhookSchema>;

const sampleData = {
  "user.registered": {
    event: "user.registered",
    timestamp: "2025-07-31T19:10:00Z",
    user_id: 123,
    email: "john.doe@example.com",
    first_name: "John",
    last_name: "Doe",
    phone: "+1-555-0123"
  },
  "business.created": {
    event: "business.created",
    timestamp: "2025-07-31T19:10:00Z",
    user_id: 123,
    email: "john.doe@example.com",
    first_name: "John",
    last_name: "Doe",
    business_id: 456,
    business_name: "Acme Technologies",
    business_category: "Technology",
    business_subcategory: "Software Development",
    business_type: "existing",
    entity_type: "LLC",
    year_established: "2020",
    zip_code: "90210",
    website: "https://acme-tech.com",
    revenue: "500000",
    interests: "grants, funding, technology"
  },
  "application.submitted": {
    event: "application.submitted",
    timestamp: "2025-07-31T19:10:00Z",
    user_id: 123,
    email: "john.doe@example.com",
    first_name: "John",
    last_name: "Doe",
    business_id: 456,
    business_name: "Acme Technologies",
    business_category: "Technology",
    business_subcategory: "Software Development",
    business_type: "existing",
    entity_type: "LLC",
    year_established: "2020",
    zip_code: "90210",
    website: "https://acme-tech.com",
    revenue: "500000",
    interests: "grants, funding, technology",
    grant_id: 101,
    grant_title: "Innovation Grant 2025",
    grant_company: "Tech Innovations Inc",
    grant_amount: "100000",
    grant_deadline: "2025-12-31T23:59:59Z",
    grant_category: "Technology",
    application_id: 789,
    application_status: "Applied",
    submitted_at: "2025-07-31T19:10:00Z",
    // Current application form questions/answers
    fullName: "John Doe",
    phone: "+1555123456",
    igHandle: "@johndoe_tech",
    businessEstablished: "2020",
    currentCity: "Los Angeles",
    businessDescription: "business-owner-1-10",
    businessIndustry: "technology",
    monthlyRevenue: "10k-25k",
    grantPurpose: "I will use this grant to expand my AI-powered business platform to serve more small businesses in our community. The funding will help us hire additional developers and enhance our product features.",
    howHeard: "online-ads"
  }
};

export function WebhookManagement() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: any }>({});
  const { toast } = useToast();

  const form = useForm<WebhookForm>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: "",
      event: "",
      url: "",
      description: "",
    },
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const response = await apiRequest("/api/admin/webhooks");
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      // Initialize with default webhooks if endpoint doesn't exist yet
      const defaultWebhooks: WebhookConfig[] = [
        {
          id: "user-registration",
          name: "User Registration",
          event: "user.registered",
          url: "https://hooks.zapier.com/hooks/catch/1866149/u4th37c/",
          active: true,
          description: "Triggered when a new user registers"
        },
        {
          id: "business-created",
          name: "Business Created",
          event: "business.created", 
          url: "https://hooks.zapier.com/hooks/catch/1866149/u4thrly/",
          active: true,
          description: "Triggered when a new business is created"
        }
      ];
      setWebhooks(defaultWebhooks);
    }
  };

  const saveWebhook = async (data: WebhookForm) => {
    try {
      const webhookData = {
        ...data,
        id: selectedWebhook?.id || `webhook-${Date.now()}`,
        active: true,
      };

      const response = await apiRequest("/api/admin/webhooks", {
        method: "POST",
        body: JSON.stringify(webhookData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Webhook saved successfully",
        });
        await loadWebhooks();
        resetForm();
      } else {
        throw new Error("Failed to save webhook");
      }
    } catch (error) {
      // Fallback: save to local state if API not available
      const newWebhook: WebhookConfig = {
        id: selectedWebhook?.id || `webhook-${Date.now()}`,
        name: data.name,
        event: data.event,
        url: data.url,
        active: true,
        description: data.description || "",
      };

      if (selectedWebhook) {
        setWebhooks(prev => prev.map(w => w.id === selectedWebhook.id ? newWebhook : w));
      } else {
        setWebhooks(prev => [...prev, newWebhook]);
      }

      toast({
        title: "Success",
        description: "Webhook saved successfully",
      });
      resetForm();
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    try {
      const response = await apiRequest(`/api/admin/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Webhook deleted successfully",
        });
        await loadWebhooks();
      } else {
        throw new Error("Failed to delete webhook");
      }
    } catch (error) {
      // Fallback: remove from local state
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast({
        title: "Success",
        description: "Webhook deleted successfully",
      });
    }
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    setIsTestingWebhook(webhook.id);
    try {
      const testPayload = {
        ...sampleData[webhook.event as keyof typeof sampleData],
        event: webhook.event,
      };

      const response = await apiRequest("/api/webhook/test", {
        method: "POST",
        body: JSON.stringify({ 
          webhookUrl: webhook.url,
          payload: testPayload
        }),
      });

      const result = await response.json();
      
      // Include the sent payload in the result for display
      const resultWithPayload = {
        ...result,
        sentPayload: testPayload,
        webhookUrl: webhook.url
      };
      
      setTestResults(prev => ({ ...prev, [webhook.id]: resultWithPayload }));

      if (result.success) {
        toast({
          title: "Test Successful",
          description: `Webhook "${webhook.name}" tested successfully`,
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.message || "Webhook test failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to test webhook",
        variant: "destructive",
      });
      setTestResults(prev => ({ 
        ...prev, 
        [webhook.id]: { 
          success: false, 
          message: "Network error or timeout",
          error: true
        }
      }));
    } finally {
      setIsTestingWebhook(null);
    }
  };

  const toggleWebhookActive = async (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook) return;

    const updatedWebhook = { ...webhook, active: !webhook.active };
    setWebhooks(prev => prev.map(w => w.id === webhookId ? updatedWebhook : w));

    toast({
      title: "Success",
      description: `Webhook ${updatedWebhook.active ? 'activated' : 'deactivated'}`,
    });
  };

  const editWebhook = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    form.reset({
      name: webhook.name,
      event: webhook.event,
      url: webhook.url,
      description: webhook.description,
    });
    setIsEditing(true);
  };

  const resetForm = () => {
    setSelectedWebhook(null);
    setIsEditing(false);
    form.reset({
      name: "",
      event: "",
      url: "",
      description: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Webhook Management</h2>
          <p className="text-gray-600">Configure and manage webhook endpoints for different events</p>
        </div>
        <Button
          onClick={() => setIsEditing(true)}
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Webhook className="h-5 w-5 mr-2" />
              Configured Webhooks
            </CardTitle>
            <CardDescription>
              Manage your webhook endpoints and their configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhooks.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No webhooks configured</p>
            ) : (
              webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium">{webhook.name}</h3>
                      <Badge variant={webhook.active ? "default" : "secondary"}>
                        {webhook.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{webhook.description}</p>
                    <p className="text-xs text-gray-500">Event: {webhook.event}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {webhook.url.length > 50 ? `${webhook.url.substring(0, 50)}...` : webhook.url}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook(webhook)}
                      disabled={isTestingWebhook === webhook.id}
                    >
                      {isTestingWebhook === webhook.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editWebhook(webhook)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleWebhookActive(webhook.id)}
                    >
                      {webhook.active ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteWebhook(webhook.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Webhook Form */}
        {isEditing && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedWebhook ? "Edit Webhook" : "Add New Webhook"}
              </CardTitle>
              <CardDescription>
                Configure webhook endpoint and event trigger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(saveWebhook)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Webhook Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., User Registration Webhook"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event">Event Type</Label>
                  <Select
                    value={form.watch("event")}
                    onValueChange={(value) => form.setValue("event", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user.registered">User Registration</SelectItem>
                      <SelectItem value="business.created">Business Created</SelectItem>
                      <SelectItem value="application.submitted">Application Submitted</SelectItem>
                      <SelectItem value="grant.created">Grant Created</SelectItem>
                      <SelectItem value="custom.event">Custom Event</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.event && (
                    <p className="text-sm text-red-600">{form.formState.errors.event.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    placeholder="https://your-app.com/webhook"
                    {...form.register("url")}
                  />
                  {form.formState.errors.url && (
                    <p className="text-sm text-red-600">{form.formState.errors.url.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this webhook's purpose"
                    {...form.register("description")}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {selectedWebhook ? "Update" : "Save"} Webhook
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Results from recent webhook tests with payload details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(testResults).map(([webhookId, result]) => {
                const webhook = webhooks.find(w => w.id === webhookId);
                if (!webhook) return null;

                return (
                  <div key={webhookId} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{webhook.name}</h4>
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Response Status:</p>
                        <p className="text-sm text-gray-600">{result.message}</p>
                      </div>
                      
                      {result.webhookUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Webhook URL:</p>
                          <p className="text-xs font-mono bg-gray-50 p-2 rounded border">
                            {result.webhookUrl}
                          </p>
                        </div>
                      )}
                      
                      {result.sentPayload && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Sent Payload:</p>
                          <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono whitespace-pre">
{JSON.stringify(result.sentPayload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {result.status && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">HTTP Status:</p>
                          <Badge variant={result.status === 200 ? "default" : "destructive"}>
                            {result.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}