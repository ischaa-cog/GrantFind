import { useState } from "react";
import { WebhookSettings } from "@/components/webhook-settings";
import { WebhookManagement } from "@/components/webhook-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Shield, Webhook, Settings, LogOut, Database } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useLocation } from "wouter";

export default function AdminPage() {
  const { adminLogout } = useAdminAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    adminLogout();
    setLocation('/admin/auth');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/grantfind-logo.png" 
              alt="GrantFind Logo" 
              className="h-8 object-contain"
            />
            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center space-x-3 mb-2">
                <Shield className="h-6 w-6 text-yellow-600" />
                <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
              </div>
              <p className="text-gray-600">
                Manage system settings and configurations
              </p>
            </div>

            {/* Admin Tabs */}
            <Tabs defaultValue="webhooks" className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                <TabsTrigger value="webhooks" className="flex items-center space-x-2">
                  <Webhook className="h-4 w-4" />
                  <span>Webhooks</span>
                </TabsTrigger>
                <TabsTrigger value="legacy" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Legacy Config</span>
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>System</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="webhooks" className="mt-6">
                <WebhookManagement />
              </TabsContent>

              <TabsContent value="legacy" className="mt-6">
                <div className="space-y-6">
                  <WebhookSettings />
                </div>
              </TabsContent>

              <TabsContent value="system" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Settings</CardTitle>
                    <CardDescription>
                      Additional system configuration options will be available here
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">System settings will be available here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
    </div>
  );
}