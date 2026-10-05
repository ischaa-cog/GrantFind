import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import GrantCard from "@/components/grant-card";

import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { Grant, UserGrantApplication, ExternalGrant } from "@shared/schema";

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeTag, setActiveTag] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { user } = useAuth();
  const { needsOnboarding } = useOnboarding();

  const { data: grants = [], isLoading: grantsLoading } = useQuery<Grant[]>({
    queryKey: ["/api/grants"],
  });

  const { data: applications = [] } = useQuery<UserGrantApplication[]>({
    queryKey: ["/api/user/applications"],
  });

  const { data: userInterests = [] } = useQuery<any[]>({
    queryKey: ["/api/user/interests"],
  });

  const { data: externalGrants = [] } = useQuery<ExternalGrant[]>({
    queryKey: ["/api/external-grants"],
  });

  // Only count interests where the grant still exists to avoid orphaned records
  const savedCount = userInterests.filter((interest: any) => 
    interest.preference === "saved" && grants.some(grant => grant.id === interest.grantId)
  ).length;
  const notInterestedCount = userInterests.filter((interest: any) => 
    interest.preference === "not_interested" && grants.some(grant => grant.id === interest.grantId)
  ).length;
  
  // Filter applications to only include those for existing grants to avoid orphaned records
  const validApplications = applications.filter(app => 
    grants.some(grant => grant.id === app.grantId)
  );

  const filterTabs = [
    { key: "all", label: "All", count: grants.length },
    { key: "saved", label: "Saved", count: savedCount },
    { key: "in-progress", label: "In Progress", count: validApplications.filter(app => app.status === "In Progress").length },
    { key: "applied", label: "Applied", count: validApplications.filter(app => app.status === "Applied").length },
    { key: "under-review", label: "Under Review", count: validApplications.filter(app => app.status === "Under Review").length },
    { key: "results", label: "Results", count: validApplications.filter(app => ["Accepted", "Rejected"].includes(app.status)).length },
    { key: "not-interested", label: "Not Interested", count: notInterestedCount },
    { key: "past", label: "Past", count: grants.filter(grant => new Date(grant.deadline) < new Date()).length },
  ];

  // Dynamically generate amount filters based on unique grant amounts
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
    return `$${amount}`;
  };

  const uniqueAmounts = Array.from(new Set(grants.map(grant => grant.amount))).sort((a, b) => a - b);
  
  const amountTags = [
    { key: "all", label: "All Amounts", amount: null },
    ...uniqueAmounts.map(amount => ({
      key: amount.toString(),
      label: formatAmount(amount),
      amount: amount
    }))
  ];

  const filteredGrants = grants.filter(grant => {
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!grant.title.toLowerCase().includes(searchLower) &&
          !grant.company.toLowerCase().includes(searchLower) &&
          !grant.category.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Filter by status
    if (activeFilter === "past") {
      return new Date(grant.deadline) < new Date();
    }
    if (activeFilter === "saved") {
      const userInterest = userInterests.find((interest: any) => interest.grantId === grant.id);
      return userInterest?.preference === "saved";
    }
    if (activeFilter === "not-interested") {
      const userInterest = userInterests.find((interest: any) => interest.grantId === grant.id);
      return userInterest?.preference === "not_interested";
    }
    if (activeFilter !== "all") {
      const userApplication = validApplications.find(app => app.grantId === grant.id);
      if (activeFilter === "in-progress") return userApplication?.status === "In Progress";
      if (activeFilter === "applied") return userApplication?.status === "Applied";
      if (activeFilter === "under-review") return userApplication?.status === "Under Review";
      if (activeFilter === "results") return userApplication && ["Accepted", "Rejected"].includes(userApplication.status);
    }

    // Filter by amount tag
    if (activeTag !== "all") {
      const selectedTag = amountTags.find(tag => tag.key === activeTag);
      if (selectedTag && selectedTag.amount !== null && grant.amount !== selectedTag.amount) {
        return false;
      }
    }

    return true;
  });

  // Sort grants: due soon (within 7 days) -> active (future) -> expired (past)
  const sortedGrants = [...filteredGrants].sort((a, b) => {
    const now = new Date().getTime();
    const aDeadline = new Date(a.deadline).getTime();
    const bDeadline = new Date(b.deadline).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    const aExpired = aDeadline < now;
    const bExpired = bDeadline < now;
    const aDueSoon = !aExpired && (aDeadline - now) <= sevenDaysMs;
    const bDueSoon = !bExpired && (bDeadline - now) <= sevenDaysMs;
    
    // Category priority: due soon (0) > active (1) > expired (2)
    const aCategory = aExpired ? 2 : (aDueSoon ? 0 : 1);
    const bCategory = bExpired ? 2 : (bDueSoon ? 0 : 1);
    
    if (aCategory !== bCategory) {
      return aCategory - bCategory;
    }
    
    // Within same category, sort by deadline (earliest first)
    return aDeadline - bDeadline;
  });

  if (grantsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
        <Header />
        <div className="flex">
          <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar />
          </div>
          <main className="flex-1 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="w-full h-32 bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 animate-pulse rounded" />
                    <div className="h-6 bg-gray-200 animate-pulse rounded" />
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                    <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <Header />
      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="p-3 md:p-6">
            {(user as any)?.subscriptionTier === "paid" && (
              <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow">
                  <Crown className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-xs">Lifetime Premium</span>
                </div>
                <p className="text-sm text-amber-800">You have full access to all premium AI tools and features.</p>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex flex-col space-y-4 mb-6 md:flex-row md:items-center md:justify-between md:space-y-0">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      activeFilter === tab.key
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                    <Badge variant="secondary" className="ml-1 md:ml-2 bg-gray-200 text-gray-600 px-1 md:px-2 py-0.5 text-xs">
                      {tab.count}
                    </Badge>
                  </button>
                ))}
              </div>
              
              <div className="flex items-center space-x-2 md:space-x-4">
                <div className="relative flex-1 md:flex-none">
                  <Input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-600 focus:border-transparent w-full md:w-auto"
                  />
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Tag Filters */}
            <div className="flex flex-wrap gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
              {amountTags.map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => setActiveTag(tag.key)}
                  className={`px-3 py-1 text-xs md:text-sm rounded-full font-medium transition-colors whitespace-nowrap ${
                    activeTag === tag.key
                      ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Grant Cards Grid */}
            {sortedGrants.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No grants found</div>
                <div className="text-gray-400 text-sm mt-2">
                  Try adjusting your filters or search terms
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {sortedGrants.map((grant) => {
                  const userInterest = (userInterests as any[]).find((interest: any) => interest.grantId === grant.id);
                  const isSaved = userInterest?.preference === "saved";
                  const isNotInterested = userInterest?.preference === "not_interested";
                  const userApplication = validApplications.find(app => app.grantId === grant.id);
                  const isExpired = new Date(grant.deadline) < new Date();
                  
                  return (
                    <GrantCard 
                      key={grant.id} 
                      grant={grant} 
                      isSaved={isSaved}
                      isNotInterested={isNotInterested}
                      applicationStatus={userApplication?.status}
                      applicationRemarks={userApplication?.remarks || undefined}
                      isExpired={isExpired}
                    />
                  );
                })}
              </div>
            )}

            {/* External Grants Section */}
            {externalGrants.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">External Grant Opportunities</h2>
                <p className="text-gray-600 text-sm mb-6">Additional funding opportunities from external sources</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {externalGrants.map((grant) => (
                    <Card key={grant.id} className="h-full border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-2">
                            {grant.name}
                          </h3>
                          {grant.amount && (
                            <p className="text-lg font-bold text-amber-600 mb-2">
                              ${grant.amount.toLocaleString()}
                            </p>
                          )}
                          {grant.category && (
                            <Badge variant="secondary" className="text-xs">
                              {grant.category}
                            </Badge>
                          )}
                        </div>
                        <Button
                          asChild
                          className="mt-4 w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                        >
                          <a href={grant.url} target="_blank" rel="noopener noreferrer">
                            Apply Now
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Onboarding now handled automatically by the Header component */}
    </div>
  );
}
