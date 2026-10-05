import { useLocation } from "wouter";
import { Clock, Star, Bookmark, BookmarkCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Grant } from "@shared/schema";
import { formatDeadlineWithDays, formatDeadlineFull, isDeadlineSoon } from "@/lib/timezone";

interface GrantCardProps {
  grant: Grant;
  isNotInterested?: boolean;
  isSaved?: boolean;
  applicationStatus?: string;
  applicationRemarks?: string;
  isExpired?: boolean;
}

export default function GrantCard({ grant, isNotInterested = false, isSaved = false, applicationStatus, applicationRemarks, isExpired = false }: GrantCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const setPreferenceMutation = useMutation({
    mutationFn: async ({ grantId, preference }: { grantId: number; preference: string }) => {
      const res = await apiRequest("/api/user/interests", {
        method: "POST",
        body: JSON.stringify({ grantId, preference }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/interests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/grants"] });
      toast({
        title: "Success",
        description: "Grant preference updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Preference update failed:", error);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive",
      });
    },
  });

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount}`;
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save grants",
        variant: "destructive",
      });
      return;
    }

    if (isExpired) {
      toast({
        title: "Grant Expired",
        description: "This grant has expired and cannot be saved",
        variant: "destructive",
      });
      return;
    }

    const newPreference = isSaved ? "none" : "saved";
    setPreferenceMutation.mutate({
      grantId: grant.id,
      preference: newPreference,
    });
  };

  const handleClick = () => {
    setLocation(`/grants/${grant.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer group ${
        isExpired 
          ? "grayscale opacity-60 border-gray-300" 
          : "border-gray-200"
      }`}
    >
      <div className="relative">
        <img
          src={grant.imageUrl || "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200"}
          alt={grant.title}
          className={`w-full h-24 md:h-32 group-hover:scale-105 transition-transform duration-200 ${
            grant.title === "The Nonprofit Grant" ? "object-contain bg-white" : "object-cover"
          }`}
        />
        
        {/* Status Badges */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex gap-1 md:gap-2">
          {applicationStatus === "Applied" && (
            <Badge className="bg-teal-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium">
              Applied
            </Badge>
          )}
          {applicationStatus === "Under Review" && (
            <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium">
              Under Review
            </Badge>
          )}
          {applicationStatus === "Accepted" && (
            <Badge className="bg-green-600 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium">
              Accepted
            </Badge>
          )}
          {applicationStatus === "Rejected" && (
            <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium">
              Rejected
            </Badge>
          )}
          {isNotInterested && !applicationStatus && (
            <Badge className="bg-purple-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1 font-medium">
              Not Interested
            </Badge>
          )}
          {grant.isNew && !isNotInterested && !applicationStatus && (
            <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1">
              New
            </Badge>
          )}
          {grant.isHot && !isNotInterested && !applicationStatus && (
            <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0.5 md:px-2 md:py-1">
              Hot
            </Badge>
          )}
        </div>
        
        {/* Bookmark */}
        <div className="absolute top-2 right-2 md:top-3 md:right-3">
          <Button
            onClick={handleBookmarkClick}
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-white hover:bg-gray-100 rounded-lg shadow-sm"
            data-testid={`button-bookmark-${grant.id}`}
            title={isSaved ? "Remove from saved" : "Save for later"}
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-yellow-600 fill-yellow-600" data-testid={`icon-saved-${grant.id}`} />
            ) : (
              <Bookmark className="h-4 w-4 text-gray-600" data-testid={`icon-unsaved-${grant.id}`} />
            )}
          </Button>
        </div>
      </div>
      
      <div className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium">
            {formatAmount(grant.amount)} Grant
          </Badge>
          <div className="flex items-center space-x-1">
            <Star className="h-3 w-3 text-yellow-400 fill-current" />
            <span className="text-xs text-gray-600">
              {grant.rating ? (grant.rating / 10).toFixed(1) : "5.0"}
            </span>
          </div>
        </div>
        
        <h3 className="text-sm md:text-base font-semibold text-gray-900 mb-1 line-clamp-2">{grant.title}</h3>
        <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-1">{grant.company}</p>
        
        <div className="flex items-center text-xs text-gray-500">
          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className={isDeadlineSoon(grant.deadline) ? "text-red-500" : ""}>
            {formatDeadlineFull(grant.deadline)}
          </span>
        </div>
        
        {/* Company Remarks Display */}
        {applicationRemarks && (applicationStatus === "Under Review" || applicationStatus === "Accepted" || applicationStatus === "Rejected") && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs font-medium text-blue-900 mb-1">Review Comments</div>
            <div className="text-xs text-blue-800 line-clamp-3">{applicationRemarks}</div>
          </div>
        )}
      </div>
    </div>
  );
}
