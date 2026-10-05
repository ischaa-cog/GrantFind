import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import GrantDetails from "@/pages/grant-details";
import GrantsVault from "@/pages/grants-vault";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminFormBuilderPage from "@/pages/admin-form-builder";
import CompanyAuth from "@/pages/company-auth";
import CompanyDashboard from "@/pages/company-dashboard";
import FormBuilderPage from "@/pages/form-builder";
import ApplicationReviewerPage from "@/pages/application-reviewer";
import ProposalWriterPage from "@/pages/proposal-writer";
import GrantFinderPage from "@/pages/grant-finder";
import ProfilePage from "@/pages/profile";
import PaymentSuccessPage from "@/pages/payment-success";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import RegisterInvitePage from "@/pages/register-invite";
import GrantWritersPage from "@/pages/grant-writers";
import LaborDayTrialPage from "@/pages/labor-day-trial";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useCompanyAuth } from "@/hooks/useCompanyAuth";
import { Redirect } from "wouter";

function PremiumRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user } = useAuth();
  const isPremium = (user as any)?.subscriptionTier === "paid";
  if (!isPremium) {
    return <Redirect to="/profile" />;
  }
  return <Component />;
}

function SubscriptionExpiryBanner() {
  const { user } = useAuth();
  const tier = (user as any)?.subscriptionTier;
  const endDateRaw = (user as any)?.subscriptionEndDate;
  const subscriptionStatus = (user as any)?.subscriptionStatus;
  const cancelAtPeriodEnd = (user as any)?.subscriptionCancelAtPeriodEnd;

  if (tier !== "paid" || !endDateRaw) return null;

  const endDate = new Date(endDateRaw);
  const now = new Date();
  const hoursLeft = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft > 72 || hoursLeft <= 0) return null;

  const isTrial = subscriptionStatus === "trialing";
  const message = isTrial
    ? cancelAtPeriodEnd
      ? "Your Pro trial ends soon. You will not be charged."
      : "Your Pro trial ends soon and your selected plan will begin."
    : "Your Pro subscription period ends soon.";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      <Link href="/profile" className="underline font-bold ml-1 hover:text-amber-100">
        View account
      </Link>
    </div>
  );
}

function Router() {
  const [path] = useLocation();
  const userAuth = useAuth();
  const adminAuth = useAdminAuth();
  const companyAuth = useCompanyAuth();
  const { isAuthenticated, isLoading } = userAuth;
  const { isAdminAuthenticated, isLoading: adminLoading } = adminAuth;
  const { isAuthenticated: isCompanyAuthenticated, isLoading: companyLoading } = companyAuth;
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const adminRoute = path.startsWith('/admin');
  const companyRoute = path.startsWith('/company');
  const publicEntry = ['/signin', '/signup', '/register/invite', '/labor-day-bundle', '/grant-writers'].includes(path);
  const routeLoading = adminRoute ? adminLoading : companyRoute ? companyLoading : isLoading;
  const activeAuth = adminRoute ? adminAuth : companyRoute ? companyAuth : userAuth;
  if (!publicEntry && routeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (!publicEntry && activeAuth.authError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4" role="alert">
          <h1 className="text-xl font-semibold">Unable to verify your account</h1>
          <p>{activeAuth.authError}</p>
          <button className="rounded-md bg-yellow-600 px-4 py-2 text-white" onClick={() => void activeAuth.retryAuth()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
    <SubscriptionExpiryBanner />
    <Switch>
      {/* Admin routes - separate authentication */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard">
        {() => isAdminAuthenticated ? <AdminDashboard /> : <AdminLogin />}
      </Route>
      <Route path="/admin-dashboard">
        {() => isAdminAuthenticated ? <AdminDashboard /> : <AdminLogin />}
      </Route>
      <Route path="/admin/form-builder/new">
        {() => isAdminAuthenticated ? <AdminFormBuilderPage /> : <AdminLogin />}
      </Route>
      <Route path="/admin/form-builder/:companyId/new">
        {() => isAdminAuthenticated ? <AdminFormBuilderPage /> : <AdminLogin />}
      </Route>
      <Route path="/admin/form-builder/edit/:templateId">
        {() => isAdminAuthenticated ? <AdminFormBuilderPage /> : <AdminLogin />}
      </Route>
      
      {/* Company routes - accessible without user authentication */}
      <Route path="/company">
        {() => isCompanyAuthenticated ? <Redirect to="/company/dashboard" /> : <Redirect to="/company/auth" />}
      </Route>
      <Route path="/company/auth" component={CompanyAuth} />
      <Route path="/company-login" component={CompanyAuth} />
      <Route path="/company/dashboard" component={CompanyDashboard} />
      <Route path="/company/form-builder/new" component={FormBuilderPage} />
      <Route path="/company/form-builder/edit/:id" component={FormBuilderPage} />
      
      {/* Dedicated auth routes - accessible without authentication */}
      <Route path="/signin" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/register/invite" component={RegisterInvitePage} />
      <Route path="/labor-day-bundle" component={LaborDayTrialPage} />
      
      {/* User authenticated routes */}
      <Route path="/">
        {() => isAuthenticated ? <Dashboard /> : (
          showAuth ? (
            <AuthPage
              initialMode={authMode}
              onBack={() => setShowAuth(false)}
            />
          ) : (
            <LandingPage />
          )
        )}
      </Route>
      <Route path="/grants">
        {() => isAuthenticated ? <Dashboard /> : <Redirect to="/signin" />}
      </Route>
      <Route path="/grants/:id">
        {() => isAuthenticated ? <GrantDetails /> : <Redirect to="/signin" />}
      </Route>
      <Route path="/grants-vault">
        {() => isAuthenticated ? <GrantsVault /> : <Redirect to="/signin" />}
      </Route>
      <Route path="/application-reviewer">
        {() => !isAuthenticated ? <Redirect to="/signin" /> : <PremiumRoute component={ApplicationReviewerPage} />}
      </Route>
      <Route path="/proposal-writer">
        {() => !isAuthenticated ? <Redirect to="/signin" /> : <PremiumRoute component={ProposalWriterPage} />}
      </Route>
      <Route path="/grant-finder">
        {() => !isAuthenticated ? <Redirect to="/signin" /> : <PremiumRoute component={GrantFinderPage} />}
      </Route>
      <Route path="/profile">
        {() => isAuthenticated ? <ProfilePage /> : <Redirect to="/signin" />}
      </Route>
      <Route path="/payment-success">
        {() => isAuthenticated ? <PaymentSuccessPage /> : <Redirect to="/signin" />}
      </Route>
      <Route path="/grant-writers" component={GrantWritersPage} />
      
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
