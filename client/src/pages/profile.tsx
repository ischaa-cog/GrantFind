import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User, Mail, Phone, Lock, Crown, Check, Loader2, CalendarDays, RefreshCw, Settings, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken, setAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ billingPeriod }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to start checkout");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Upgrade Error",
        description: error.message || "Could not start the upgrade process. Please try again.",
        variant: "destructive",
      });
      setIsUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to open subscription management");
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not open subscription management. Please try again.",
        variant: "destructive",
      });
      setIsManagingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to cancel subscription");
      toast({
        title: isTrialing ? "Trial Cancelled" : "Subscription Cancelled",
        description: data.message || (isTrialing
          ? "You will keep Premium access until the trial ends and will not be charged."
          : "Your subscription has been cancelled."),
      });
      setIsManageDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; phone: string }) => {
      const token = getAuthToken();
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditingProfile(false);
      toast({ title: "Success", description: "Profile updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenProfileEdit = () => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
    });
    setIsEditingProfile(true);
  };

  const handleUpdateProfile = () => {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      toast({ title: "Error", description: "First and last name are required", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate(profileForm);
  };

  const updateEmailMutation = useMutation({
    mutationFn: async (data: { newEmail: string; password: string }) => {
      const token = getAuthToken();
      const response = await fetch("/api/user/profile/email", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update email");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setIsEditingEmail(false);
      setEmailForm({ newEmail: "", password: "" });
      toast({ title: "Success", description: "Email updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const token = getAuthToken();
      const response = await fetch("/api/user/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update password");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.token) {
        setAuthToken(data.token);
      }
      setIsEditingPassword(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Success", description: "Password updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateEmail = () => {
    if (!emailForm.newEmail || !emailForm.password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    updateEmailMutation.mutate(emailForm);
  };

  const handleUpdatePassword = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const subscriptionTier = (user as any)?.subscriptionTier || "free";
  const subscriptionStartDate = (user as any)?.subscriptionStartDate ? new Date((user as any).subscriptionStartDate) : null;
  const subscriptionEndDate = (user as any)?.subscriptionEndDate ? new Date((user as any).subscriptionEndDate) : null;
  const subscriptionStatus = (user as any)?.subscriptionStatus || "free";
  const subscriptionBillingPeriod = (user as any)?.subscriptionBillingPeriod as "monthly" | "annual" | null;
  const subscriptionCancelAtPeriodEnd = Boolean((user as any)?.subscriptionCancelAtPeriodEnd);
  const trialEndsAt = (user as any)?.trialEndsAt ? new Date((user as any).trialEndsAt) : null;
  const isTrialing = subscriptionStatus === "trialing";

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <Header />
      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 p-6 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-gray-600 mt-2">Manage your account details and preferences</p>
          </div>

          <div className="space-y-6">
            {/* Subscription Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Subscription
                </CardTitle>
                <CardDescription>Your current plan and subscription status</CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionTier === "paid" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow-lg">
                        <Crown className="w-5 h-5 text-white" />
                        <span className="text-white font-bold text-sm">
                          {isTrialing ? "GrantFind Premium Trial" : "GrantFind Premium"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Full access to all premium features including AI tools.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                        <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            {isTrialing ? "Trial Started" : "Subscribed On"}
                          </p>
                          <p className="text-sm font-semibold text-gray-800">
                            {subscriptionStartDate ? formatDate(subscriptionStartDate) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                        <RefreshCw className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            {isTrialing ? "Trial Ends" : "Next Renewal"}
                          </p>
                          <p className="text-sm font-semibold text-gray-800">
                            {isTrialing && trialEndsAt
                              ? formatDate(trialEndsAt)
                              : subscriptionEndDate
                                ? formatDate(subscriptionEndDate)
                                : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {isTrialing && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {subscriptionCancelAtPeriodEnd ? (
                          <p>
                            Your trial is cancelled. Premium access continues through{" "}
                            <strong>{trialEndsAt ? formatDate(trialEndsAt) : "the trial end date"}</strong>,
                            and you will not be charged.
                          </p>
                        ) : (
                          <p>
                            After your trial, your saved card will be charged{" "}
                            <strong>{subscriptionBillingPeriod === "annual" ? "$270 per year" : "$27 per month"}</strong>.
                            Cancel before the trial ends to avoid the charge.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="pt-1 flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                        onClick={() => setIsManageDialogOpen(true)}
                      >
                        <Settings className="w-4 h-4 mr-2" />Manage Subscription
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <Badge className="bg-gray-200 text-gray-700 mb-1">Free Plan</Badge>
                        <p className="text-sm text-gray-600">Upgrade to unlock all AI tools</p>
                      </div>
                      {/* Billing Toggle */}
                      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                        <button
                          onClick={() => setBillingPeriod("monthly")}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                            billingPeriod === "monthly"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setBillingPeriod("annual")}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                            billingPeriod === "annual"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          Annual
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Save 17%</span>
                        </button>
                      </div>
                    </div>

                    {/* Plan Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-1">Free Plan</h4>
                        <p className="text-2xl font-bold text-gray-900 mb-3">$0</p>
                        <ul className="space-y-2 text-sm text-gray-600">
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Browse all grants</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Save favorites</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Basic application tracking</li>
                        </ul>
                      </div>
                      <div className="p-4 border-2 rounded-lg border-amber-400 bg-amber-50/50">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900">GrantFind Premium</h4>
                          <Badge className="bg-amber-500 text-white text-xs">Popular</Badge>
                        </div>
                        <div className="mb-3">
                          {billingPeriod === "monthly" ? (
                            <p className="text-2xl font-bold text-gray-900">$27 <span className="text-sm font-normal text-gray-500">/ month</span></p>
                          ) : (
                            <>
                              <p className="text-2xl font-bold text-gray-900">$270 <span className="text-sm font-normal text-gray-500">/ year</span></p>
                              <p className="text-xs text-green-600 font-medium">2 months free vs monthly</p>
                            </>
                          )}
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600 mb-4">
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Everything in Free</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> AI Grant Finder</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> AI Proposal Writer</li>
                          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Application Reviewer</li>
                        </ul>
                        <Button
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                          onClick={handleUpgrade}
                          disabled={isUpgrading}
                        >
                          {isUpgrading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting...</>
                          ) : (
                            `Upgrade — ${billingPeriod === "monthly" ? "$27/mo" : "$270/yr"}`
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription>Your basic account information</CardDescription>
                  </div>
                  {!isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={handleOpenProfileEdit}>
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditingProfile ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          placeholder="First name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          placeholder="Last name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateProfile}
                        disabled={updateProfileMutation.isPending}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-500">First Name</Label>
                        <p className="font-medium">{user?.firstName || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-500">Last Name</Label>
                        <p className="font-medium">{user?.lastName || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Phone</Label>
                      <p className="font-medium">{user?.phone || "-"}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Address
                </CardTitle>
                <CardDescription>Update your email address</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditingEmail ? (
                  <div className="space-y-4">
                    <div>
                      <Label>New Email Address</Label>
                      <Input
                        type="email"
                        value={emailForm.newEmail}
                        onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                        placeholder="Enter new email"
                      />
                    </div>
                    <div>
                      <Label>Current Password</Label>
                      <Input
                        type="password"
                        value={emailForm.password}
                        onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                        placeholder="Enter your password to confirm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateEmail}
                        disabled={updateEmailMutation.isPending}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                      >
                        {updateEmailMutation.isPending ? "Updating..." : "Update Email"}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setIsEditingEmail(false);
                        setEmailForm({ newEmail: "", password: "" });
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{user?.email}</p>
                    <Button variant="outline" onClick={() => setIsEditingEmail(true)}>
                      Change Email
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Password Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Password
                </CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditingPassword ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Current Password</Label>
                      <Input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div>
                      <Label>Confirm New Password</Label>
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdatePassword}
                        disabled={updatePasswordMutation.isPending}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                      >
                        {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setIsEditingPassword(false);
                        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">••••••••••••</p>
                    <Button variant="outline" onClick={() => setIsEditingPassword(true)}>
                      Change Password
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </main>
      </div>

      {/* Manage Subscription Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Manage Subscription
            </DialogTitle>
            <DialogDescription>
              {isTrialing ? "Manage your GrantFind Pro trial below." : "Manage your GrantFind Pro subscription below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold text-gray-800">
                  GrantFind Pro {subscriptionBillingPeriod === "annual" ? "Annual" : "Monthly"}
                </span>
              </div>
              {subscriptionStartDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subscribed On</span>
                  <span className="font-medium text-gray-700">{formatDate(subscriptionStartDate)}</span>
                </div>
              )}
              {subscriptionEndDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{isTrialing ? "Trial Ends" : "Next Renewal"}</span>
                  <span className="font-medium text-gray-700">
                    {formatDate(isTrialing && trialEndsAt ? trialEndsAt : subscriptionEndDate)}
                  </span>
                </div>
              )}
            </div>

            {!isTrialing && (
              <Button
                variant="outline"
                className="w-full border-gray-300"
                onClick={handleManageSubscription}
                disabled={isManagingSubscription}
              >
                {isManagingSubscription ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening...</>
                ) : (
                  <><ExternalLink className="w-4 h-4 mr-2" />Manage Subscription</>
                )}
              </Button>
            )}

            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {isTrialing ? "Cancel Trial" : "Cancel Subscription"}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {isTrialing
                      ? "You will keep Pro access through the trial end date and your card will not be charged."
                      : "You will immediately lose access to all Pro features and AI tools. This cannot be undone."}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-3"
                onClick={handleCancelSubscription}
                disabled={isCancellingSubscription}
              >
                {isCancellingSubscription ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                ) : (
                  isTrialing ? "Cancel My Trial" : "Cancel My Subscription"
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsManageDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
