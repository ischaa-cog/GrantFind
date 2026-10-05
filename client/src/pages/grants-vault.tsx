import { useQuery } from "@tanstack/react-query";
import { Archive, Calendar, DollarSign, Building2, CheckCircle, Trophy, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import type { Grant, UserGrantApplication } from "@shared/schema";
import { formatDeadlineFull } from "@/lib/timezone";

type GrantWithApplication = Grant & { application: UserGrantApplication };

export default function GrantsVault() {
  const { data: applications = [] } = useQuery<UserGrantApplication[]>({
    queryKey: ["/api/user/applications"],
  });

  const { data: grants = [] } = useQuery<Grant[]>({
    queryKey: ["/api/grants"],
  });

  // Filter applications that are accepted
  const acceptedApplications = applications.filter(app => app.status === "Accepted");

  // Get grant details for accepted applications
  const acceptedGrants = acceptedApplications
    .map(app => {
      const grant = grants.find(g => g.id === app.grantId);
      return grant ? { ...grant, application: app } : null;
    })
    .filter((grant): grant is GrantWithApplication => grant !== null);

  // Check if grant is expired or inactive
  const isGrantExpired = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount}`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const totalAcceptedAmount = acceptedGrants.reduce((sum, grant) => sum + (grant?.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <Header />
      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 p-3 md:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Archive className="h-3 w-3 md:h-4 md:w-4 text-white" />
                </div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-900">Grants Vault</h1>
              </div>
              <p className="text-gray-600 text-sm md:text-lg">
                Your collection of successfully awarded grants
              </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Total Grants Won</CardTitle>
                  <Trophy className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-green-600">{acceptedGrants.length}</div>
                  <p className="text-xs text-gray-500">
                    Successfully awarded grants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Total Funding</CardTitle>
                  <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-green-600">{formatAmount(totalAcceptedAmount)}</div>
                  <p className="text-xs text-gray-500">
                    Total amount awarded
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl md:text-2xl font-bold text-blue-600">
                    {applications.length > 0 ? Math.round((acceptedGrants.length / applications.length) * 100) : 0}%
                  </div>
                  <p className="text-xs text-gray-500">
                    Application success rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Grants List */}
            {acceptedGrants.length > 0 ? (
              <div className="space-y-4 md:space-y-6">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Your Awarded Grants</h2>
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {acceptedGrants.map((grant) => {
                    const expired = isGrantExpired(grant.deadline);
                    const inactive = grant.status === "expired" || grant.status === "inactive";
                    const isInactive = expired || inactive;
                    
                    return (
                    <Card key={grant.id} className={`overflow-hidden border-l-4 ${isInactive ? 'border-l-gray-400 opacity-75' : 'border-l-green-500'}`}>
                      <CardHeader className="p-4 md:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2 flex-wrap">
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Accepted
                              </Badge>
                              {expired && (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Expired
                                </Badge>
                              )}
                              {inactive && !expired && (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Inactive
                                </Badge>
                              )}
                              {!isInactive && grant.isNew && (
                                <Badge variant="destructive" className="text-xs">New</Badge>
                              )}
                              {!isInactive && grant.isHot && (
                                <Badge className="bg-orange-500 text-white text-xs">Hot</Badge>
                              )}
                            </div>
                            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1 line-clamp-2">{grant.title}</h3>
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs md:text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Building2 className="h-3 w-3 md:h-4 md:w-4" />
                                <span>{grant.company}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                                <span>Awarded: {formatDate(grant.application.appliedAt || new Date())}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-xl md:text-2xl font-bold text-green-600">
                              {formatAmount(grant.amount)}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">Grant Amount</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <div>
                            <h4 className="text-sm md:text-base font-medium text-gray-900 mb-2">Description</h4>
                            <p className="text-gray-700 text-xs md:text-sm leading-relaxed">
                              {grant.description}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm md:text-base font-medium text-gray-900 mb-2">Grant Details</h4>
                            <div className="space-y-2 text-xs md:text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Category:</span>
                                <span className="font-medium">{grant.category}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Original Deadline:</span>
                                <span className="font-medium">{formatDeadlineFull(grant.deadline, grant.timezone)}</span>
                              </div>
                              {grant.application.remarks && (
                                <div className="mt-3 p-2 md:p-3 bg-green-50 rounded-lg">
                                  <div className="text-xs font-medium text-green-800 mb-1">Award Notes:</div>
                                  <div className="text-xs md:text-sm text-green-700">{grant.application.remarks}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        {grant.tags && grant.tags.length > 0 && (
                          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
                            <div className="flex flex-wrap gap-2">
                              {grant.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Archive className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />
                </div>
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No Awarded Grants Yet</h3>
                <p className="text-sm md:text-base text-gray-600 mb-6 max-w-md mx-auto px-4">
                  Your successfully awarded grants will appear here. Keep applying to build your grants vault!
                </p>
                <a
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Browse Available Grants
                </a>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}