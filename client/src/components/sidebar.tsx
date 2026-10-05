import { Home, Archive, ClipboardCheck, PenTool, Search, User, Lock, Crown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import type { UserGrantApplication, Grant } from "@shared/schema";

interface NavigationItem {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  badge?: boolean;
  badgeColor?: string;
  betaBadge?: boolean;
  disabled?: boolean;
  count?: number;
  premiumOnly?: boolean;
  locked?: boolean;
}

interface NavigationSection {
  section: string;
  items: NavigationItem[];
}

export default function Sidebar() {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();
  const isPremium = (user as any)?.subscriptionTier === "paid";
  
  const { data: applications = [] } = useQuery<UserGrantApplication[]>({
    queryKey: ["/api/user/applications"],
    enabled: !!isAuthenticated,
  });

  const { data: grants = [] } = useQuery<Grant[]>({
    queryKey: ["/api/grants"],
    enabled: !!isAuthenticated,
  });

  const acceptedApplications = applications.filter(app => app.status === "Accepted");
  const acceptedGrantsCount = acceptedApplications.filter(app => 
    grants.some(grant => grant.id === app.grantId)
  ).length;

  const navigationItems: NavigationSection[] = [
    {
      section: "Funding",
      items: [
        { icon: Home, label: "Home", href: "/", active: location === "/" },
        { icon: Archive, label: "Grants Vault", href: "/grants-vault", count: acceptedGrantsCount, active: location === "/grants-vault" },
        ...(isAuthenticated ? [{ icon: Users, label: "Grant Writers", href: "/grant-writers", active: location === "/grant-writers" }] : []),
      ]
    },
    {
      section: "AI Tools",
      items: [
        { icon: ClipboardCheck, label: "Application Reviewer", href: "/application-reviewer", active: location === "/application-reviewer", locked: !isPremium },
        { icon: PenTool, label: "Proposal Writer", href: "/proposal-writer", active: location === "/proposal-writer", locked: !isPremium },
        { icon: Search, label: "Grant Finder", href: "/grant-finder", active: location === "/grant-finder", locked: !isPremium },
      ]
    },
    {
      section: "Account",
      items: [
        { icon: User, label: "Profile", href: "/profile", active: location === "/profile" },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 px-4 py-6 flex flex-col">

      <nav className="space-y-8 flex-1">
        {navigationItems.map((section) => (
          <div key={section.section}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section.section}
              </span>
              {section.section === "AI Tools" && !isPremium && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Crown className="h-3 w-3" /> Pro
                </span>
              )}
            </div>
            <div className="space-y-2">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.disabled ? undefined : item.locked ? () => setLocation("/profile") : () => setLocation(item.href)}
                  disabled={item.disabled}
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors w-full text-left ${
                    item.disabled
                      ? "text-gray-400 cursor-not-allowed opacity-50"
                      : item.locked
                      ? "text-gray-400 hover:bg-gray-50"
                      : item.active
                      ? "text-gray-900 bg-gray-100"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon 
                    className={`h-4 w-4 ${
                      item.locked ? "text-gray-300" :
                      item.active ? "text-yellow-600" : 
                      item.badge ? "text-red-500" : 
                      "text-gray-400"
                    }`} 
                  />
                  <span className="flex-1">{item.label}</span>
                  
                  {item.locked && (
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  
                  {item.badge && (
                    <div className={`w-2 h-2 ${item.badgeColor} rounded-full`} />
                  )}
                  
                  {item.betaBadge && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">
                      Beta
                    </Badge>
                  )}
                  
                  {item.count !== undefined && item.count > 0 && (
                    <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5 min-w-[20px] text-center">
                      {item.count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
