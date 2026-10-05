import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Star, ExternalLink, Bookmark, BookmarkCheck, X, Send, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import ApplicationProgress from "@/components/application-progress";
import { ThankYouPage } from "@/components/ThankYouPage";
import type { Grant, UserGrantApplication } from "@shared/schema";
import { useState, useEffect } from "react";
import { formatDeadlineFull, isDeadlineSoon, isGrantExpired } from "@/lib/timezone";

export default function GrantDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);
  const [applicationAnswers, setApplicationAnswers] = useState<Record<string, any>>({});
  const [showThankYouPage, setShowThankYouPage] = useState(false);
  
  const { data: grant, isLoading } = useQuery<Grant>({
    queryKey: ["/api/grants", id],
    enabled: !!id,
  });

  const { data: formFields = [] } = useQuery<any[]>({
    queryKey: ["/api/form-templates", grant?.formTemplateId, "fields"],
    enabled: !!grant?.formTemplateId,
  });

  const { data: userInterest } = useQuery<{ preference: string } | null>({
    queryKey: ["/api/user/interests", id],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const { data: userApplication } = useQuery<UserGrantApplication | null>({
    queryKey: ["/api/grants", id, "application"],
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const { data: userBusinesses = [] } = useQuery<any[]>({
    queryKey: ["/api/user/businesses"],
    enabled: !!isAuthenticated,
  });

  // Pre-fill form with existing answers when userApplication data is available
  useEffect(() => {
    if (userApplication?.answers) {
      try {
        const parsedAnswers = typeof userApplication.answers === 'string' 
          ? JSON.parse(userApplication.answers) 
          : userApplication.answers;
        setApplicationAnswers(parsedAnswers);
      } catch (error) {
        console.error("Failed to parse application answers:", error);
      }
    }
  }, [userApplication]);

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
        description: "Failed to update grant preference",
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (grantId: number) => {
      const res = await apiRequest(`/api/grants/${grantId}/apply`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grants", id, "application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/applications"] });
      toast({
        title: "Success",
        description: "Application started! Status set to In Progress.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply to grant",
        variant: "destructive",
      });
    },
  });

  const submitAnswersMutation = useMutation({
    mutationFn: async ({ grantId, answers }: { grantId: number; answers: Record<string, string> }) => {
      const res = await apiRequest(`/api/grants/${grantId}/submit-answers`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grants", id, "application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/applications"] });
      setIsApplicationDialogOpen(false);
      setApplicationAnswers({});
      
      // Show custom thank you page if enabled
      if (grant?.enableNextSteps) {
        setShowThankYouPage(true);
      } else {
        toast({
          title: "Success",
          description: "Application submitted successfully! Status updated to Applied.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const handleApplyNow = () => {
    if (!grant || !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to apply for grants",
        variant: "destructive",
      });
      return;
    }

    if (!userBusinesses || userBusinesses.length === 0) {
      toast({
        title: "Business Required",
        description: "Please add a business profile before applying for grants",
        variant: "destructive",
      });
      return;
    }
    
    // Directly open the application form dialog
    setIsApplicationDialogOpen(true);
  };

  const handleSubmitAnswers = () => {
    if (!grant) return;

    // Validate that all required fields are filled
    const requiredFields = formFields.filter((field: any) => field.required);
    const missingFields = requiredFields.filter((field: any) => {
      const value = applicationAnswers[field.id];
      return !value || (typeof value === 'string' && !value.trim());
    });
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields marked with *",
        variant: "destructive",
      });
      return;
    }

    submitAnswersMutation.mutate({
      grantId: grant.id,
      answers: applicationAnswers,
    });
  };

  const handleSaveForLater = () => {
    if (!grant || !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save grants",
        variant: "destructive",
      });
      return;
    }
    
    const isSaved = userInterest?.preference === "saved";
    const newPreference = isSaved ? "none" : "saved";
    
    setPreferenceMutation.mutate({
      grantId: grant.id,
      preference: newPreference,
    });
  };

  const handleNotInterested = () => {
    if (!grant || !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to manage grant preferences",
        variant: "destructive",
      });
      return;
    }
    
    const isNotInterested = userInterest?.preference === "not_interested";
    const newPreference = isNotInterested ? "none" : "not_interested";
    
    setPreferenceMutation.mutate({
      grantId: grant.id,
      preference: newPreference,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
        <Header />
        <div className="flex">
          <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar />
          </div>
          <main className="flex-1 p-3 md:p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
              <div className="bg-white rounded-xl p-4 md:p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-32 bg-gray-200 rounded" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!grant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
        <Header />
        <div className="flex">
          <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar />
          </div>
          <main className="flex-1 p-3 md:p-6">
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">Grant not found</div>
              <Link href="/">
                <Button className="mt-4" variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount}`;
  };


  // Show thank you page if application was just submitted and next steps are enabled
  if (showThankYouPage && grant?.enableNextSteps) {
    return (
      <ThankYouPage
        grantTitle={grant.title}
        thankYouHeadline={grant.thankYouHeadline}
        thankYouSubheadline={grant.thankYouSubheadline}
        nextStepsHeadline={grant.nextStepsHeadline}
        nextStepsSubheadline={grant.nextStepsSubheadline}
        nextStepsContent1={grant.nextStepsContent1}
        nextStepsCtaText={grant.nextStepsCtaText}
        nextStepsCtaUrl={grant.nextStepsCtaUrl}
        nextStepsContent2={grant.nextStepsContent2}
      />
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
          <div className="p-3 md:p-6 max-w-4xl">
            {/* Back Button */}
            <Link href="/">
              <Button variant="ghost" className="mb-4 md:mb-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </Link>

            {/* Grant Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 md:mb-6">
              {grant.imageUrl && (
                <img
                  src={grant.imageUrl}
                  alt={grant.title}
                  className={`w-full h-48 md:h-64 ${
                    grant.title === "The Nonprofit Grant" ? "object-contain bg-white" : "object-cover"
                  }`}
                />
              )}
              <div className="p-4 md:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="secondary" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs">
                        {formatAmount(grant.amount)} Grant
                      </Badge>
                      {isGrantExpired(grant.deadline) && (
                        <Badge variant="destructive" className="bg-red-600 text-white text-xs">Expired</Badge>
                      )}
                      {grant.isNew && !isGrantExpired(grant.deadline) && (
                        <Badge variant="destructive" className="text-xs">New</Badge>
                      )}
                      {grant.isHot && !isGrantExpired(grant.deadline) && (
                        <Badge className="bg-orange-500 text-white text-xs">Hot</Badge>
                      )}
                    </div>
                    <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2 line-clamp-3">{grant.title}</h1>
                    <p className="text-base md:text-lg text-gray-600 mb-2">{grant.company}</p>
                    <p className="text-xs md:text-sm text-gray-500">{grant.category}</p>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-4">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{(grant.rating || 50) / 10}</span>
                  </div>
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="flex items-center space-x-2">
                    <Clock className={`h-4 w-4 ${isGrantExpired(grant.deadline) ? 'text-red-500' : 'text-gray-400'}`} />
                    <div>
                      <div className="text-xs md:text-sm font-medium text-gray-900">Deadline</div>
                      <div className={`text-xs md:text-sm font-medium ${
                        isGrantExpired(grant.deadline) ? 'text-red-600' : 
                        isDeadlineSoon(grant.deadline) ? 'text-red-500' : 
                        'text-gray-600'
                      }`}>
                        {isGrantExpired(grant.deadline) ? 'Expired - ' : ''}{formatDeadlineFull(grant.deadline, grant.timezone)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-xs md:text-sm font-medium text-gray-900">Category</div>
                      <div className="text-xs md:text-sm text-gray-600">{grant.category}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 text-gray-400">💰</div>
                    <div>
                      <div className="text-xs md:text-sm font-medium text-gray-900">Amount</div>
                      <div className="text-xs md:text-sm text-gray-600">{formatAmount(grant.amount)}</div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {grant.tags && grant.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
                    {grant.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Apply Now - Direct Application */}
                  {isAuthenticated ? (
                    <>
                      {!userApplication || userApplication.status === "In Progress" ? (
                        <>
                          <div className="flex flex-col gap-2">
                            <Dialog open={isApplicationDialogOpen} onOpenChange={setIsApplicationDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  disabled={!userBusinesses || userBusinesses.length === 0 || isGrantExpired(grant.deadline)}
                                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={
                                    isGrantExpired(grant.deadline) ? "This grant has expired" :
                                    !userBusinesses || userBusinesses.length === 0 ? "Please add a business profile before applying" : ""
                                  }
                                >
                                  Apply Now
                                  <Send className="h-4 w-4 ml-2" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 md:mx-auto">
                                <DialogHeader>
                                  <DialogTitle>Submit Your Application</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 mt-4">
                                  {/* Dynamic Form Fields */}
                                  {formFields.map((field: any) => {
                                    const fieldId = `field-${field.id}`;
                                    const fieldValue = applicationAnswers[field.id] || "";
                                    
                                    const handleFieldChange = (value: any) => {
                                      setApplicationAnswers(prev => ({
                                        ...prev,
                                        [field.id]: value
                                      }));
                                    };

                                    // Skip non-input field types
                                    if (['heading', 'paragraph', 'divider', 'image', 'video', 'button'].includes(field.fieldType)) {
                                      return null;
                                    }

                                    return (
                                      <div key={field.id} className="space-y-2">
                                        {/* Text, Email, Tel, Number, Date inputs */}
                                        {['text', 'email', 'tel', 'number', 'date', 'single_text', 'text_list'].includes(field.fieldType) && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Input
                                              id={fieldId}
                                              type={['single_text', 'text_list'].includes(field.fieldType) ? 'text' : field.fieldType}
                                              placeholder={field.placeholder || ''}
                                              value={fieldValue}
                                              onChange={(e) => handleFieldChange(e.target.value)}
                                              required={field.required}
                                              data-testid={`input-${field.id}`}
                                            />
                                          </>
                                        )}

                                        {/* Textarea */}
                                        {field.fieldType === 'textarea' && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Textarea
                                              id={fieldId}
                                              placeholder={field.placeholder || ''}
                                              value={fieldValue}
                                              onChange={(e) => handleFieldChange(e.target.value)}
                                              rows={4}
                                              required={field.required}
                                              data-testid={`textarea-${field.id}`}
                                            />
                                          </>
                                        )}

                                        {/* Select dropdown */}
                                        {field.fieldType === 'select' && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Select 
                                              value={fieldValue} 
                                              onValueChange={handleFieldChange}
                                            >
                                              <SelectTrigger data-testid={`select-${field.id}`}>
                                                <SelectValue placeholder={field.placeholder || 'Select an option...'} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {field.options && field.options.map((option: string, idx: number) => (
                                                  <SelectItem key={idx} value={option}>
                                                    {option}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </>
                                        )}

                                        {/* Radio buttons */}
                                        {field.fieldType === 'radio' && (
                                          <>
                                            <Label>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <RadioGroup
                                              value={fieldValue}
                                              onValueChange={handleFieldChange}
                                            >
                                              {field.options && field.options.map((option: string, idx: number) => (
                                                <div key={idx} className="flex items-center space-x-2">
                                                  <RadioGroupItem 
                                                    value={option} 
                                                    id={`${fieldId}-${idx}`}
                                                    data-testid={`radio-${field.id}-${idx}`}
                                                  />
                                                  <Label htmlFor={`${fieldId}-${idx}`}>{option}</Label>
                                                </div>
                                              ))}
                                            </RadioGroup>
                                          </>
                                        )}

                                        {/* Checkbox (Terms and Conditions) */}
                                        {(field.fieldType === 'checkbox' || field.fieldType === 'terms_and_conditions') && (
                                          <div className="flex items-start space-x-2">
                                            <input
                                              type="checkbox"
                                              id={fieldId}
                                              checked={fieldValue || false}
                                              onChange={(e) => handleFieldChange(e.target.checked)}
                                              className="h-4 w-4 rounded border-gray-300 mt-1"
                                              data-testid={`checkbox-${field.id}`}
                                              required={field.required}
                                            />
                                            <Label htmlFor={fieldId} className="text-sm leading-relaxed">
                                              {field.textContent ? (
                                                <>
                                                  {field.textContent}
                                                  {field.linkUrl && (
                                                    <a 
                                                      href={field.linkUrl} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="text-blue-600 hover:underline ml-1"
                                                    >
                                                      View here
                                                    </a>
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  {field.label} {field.required && '*'}
                                                </>
                                              )}
                                            </Label>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div className="flex justify-end gap-3 pt-4">
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setIsApplicationDialogOpen(false)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleSubmitAnswers}
                                      disabled={submitAnswersMutation.isPending}
                                      className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                                    >
                                      {submitAnswersMutation.isPending ? "Submitting..." : "Submit Application"}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {(!userBusinesses || userBusinesses.length === 0) && !isGrantExpired(grant.deadline) && (
                              <div className="text-xs text-red-500">
                                Add a business profile to apply
                              </div>
                            )}
                            {isGrantExpired(grant.deadline) && (
                              <div className="text-xs text-red-500">
                                This grant has expired
                              </div>
                            )}
                          </div>
                          
                          {/* Preference Buttons for Fresh Grants */}
                          <Button 
                            variant="outline" 
                            onClick={handleSaveForLater}
                            disabled={setPreferenceMutation.isPending || isGrantExpired(grant.deadline)}
                            className={`${userInterest?.preference === "saved" ? 'border-yellow-600 text-yellow-600 hover:bg-yellow-50' : ''}`}
                            title={isGrantExpired(grant.deadline) ? "This grant has expired" : ""}
                            data-testid="button-save-later"
                          >
                            {userInterest?.preference === "saved" ? (
                              <>
                                <BookmarkCheck className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Saved</span>
                                <span className="sm:hidden">Saved</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Save for Later</span>
                                <span className="sm:hidden">Save</span>
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={handleNotInterested}
                            disabled={setPreferenceMutation.isPending || isGrantExpired(grant.deadline)}
                            className={`${userInterest?.preference === "not_interested" ? 'border-red-500 text-red-500 hover:bg-red-50' : ''}`}
                            title={isGrantExpired(grant.deadline) ? "This grant has expired" : ""}
                            data-testid="button-not-interested"
                          >
                            {userInterest?.preference === "not_interested" ? (
                              <>
                                <X className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Marked Not Interested</span>
                                <span className="sm:hidden">Not Interested</span>
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Not Interested</span>
                                <span className="sm:hidden">Pass</span>
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-3 w-full">
                          <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <Badge 
                              className={
                                userApplication.status === "In Progress" ? "bg-blue-500 text-white" :
                                userApplication.status === "Applied" ? "bg-teal-500 text-white" :
                                userApplication.status === "Under Review" ? "bg-orange-500 text-white" :
                                userApplication.status === "Accepted" ? "bg-green-600 text-white" :
                                userApplication.status === "Rejected" ? "bg-red-500 text-white" :
                                "bg-gray-500 text-white"
                              }
                            >
                              {userApplication.status}
                            </Badge>
                            {(userApplication.status === "In Progress" || userApplication.status === "Applied") && (
                              <>
                                {!isGrantExpired(grant.deadline) ? (
                                  <Dialog open={isApplicationDialogOpen} onOpenChange={setIsApplicationDialogOpen}>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant={userApplication.status === "In Progress" ? "default" : "outline"}
                                        className={userApplication.status === "In Progress" 
                                          ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold animate-glow" 
                                          : ""
                                        }
                                        data-testid="button-complete-application"
                                      >
                                        {userApplication.status === "In Progress" ? "Complete Application" : "Edit Application"}
                                      </Button>
                                    </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 md:mx-auto">
                                <DialogHeader>
                                  <DialogTitle>
                                    {userApplication.status === "In Progress" ? "Complete Your Application" : "Edit Your Application"}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 mt-4">
                                  {/* Dynamic Form Fields */}
                                  {formFields.map((field: any) => {
                                    const fieldId = `field-${field.id}`;
                                    const fieldValue = applicationAnswers[field.id] || "";
                                    
                                    const handleFieldChange = (value: any) => {
                                      setApplicationAnswers(prev => ({
                                        ...prev,
                                        [field.id]: value
                                      }));
                                    };

                                    // Skip non-input field types
                                    if (['heading', 'paragraph', 'divider', 'image', 'video', 'button'].includes(field.fieldType)) {
                                      return null;
                                    }

                                    return (
                                      <div key={field.id} className="space-y-2">
                                        {/* Text, Email, Tel, Number, Date inputs */}
                                        {['text', 'email', 'tel', 'number', 'date', 'single_text', 'text_list'].includes(field.fieldType) && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Input
                                              id={fieldId}
                                              type={['single_text', 'text_list'].includes(field.fieldType) ? 'text' : field.fieldType}
                                              placeholder={field.placeholder || ''}
                                              value={fieldValue}
                                              onChange={(e) => handleFieldChange(e.target.value)}
                                              required={field.required}
                                              data-testid={`input-${field.id}`}
                                            />
                                          </>
                                        )}

                                        {/* Textarea */}
                                        {field.fieldType === 'textarea' && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Textarea
                                              id={fieldId}
                                              placeholder={field.placeholder || ''}
                                              value={fieldValue}
                                              onChange={(e) => handleFieldChange(e.target.value)}
                                              rows={4}
                                              required={field.required}
                                              data-testid={`textarea-${field.id}`}
                                            />
                                          </>
                                        )}

                                        {/* Select dropdown */}
                                        {field.fieldType === 'select' && (
                                          <>
                                            <Label htmlFor={fieldId}>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <Select 
                                              value={fieldValue} 
                                              onValueChange={handleFieldChange}
                                            >
                                              <SelectTrigger data-testid={`select-${field.id}`}>
                                                <SelectValue placeholder={field.placeholder || 'Select an option...'} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {field.options && field.options.map((option: string, idx: number) => (
                                                  <SelectItem key={idx} value={option}>
                                                    {option}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </>
                                        )}

                                        {/* Radio buttons */}
                                        {field.fieldType === 'radio' && (
                                          <>
                                            <Label>
                                              {field.label} {field.required && '*'}
                                            </Label>
                                            <RadioGroup
                                              value={fieldValue}
                                              onValueChange={handleFieldChange}
                                            >
                                              {field.options && field.options.map((option: string, idx: number) => (
                                                <div key={idx} className="flex items-center space-x-2">
                                                  <RadioGroupItem 
                                                    value={option} 
                                                    id={`${fieldId}-${idx}`}
                                                    data-testid={`radio-${field.id}-${idx}`}
                                                  />
                                                  <Label htmlFor={`${fieldId}-${idx}`}>{option}</Label>
                                                </div>
                                              ))}
                                            </RadioGroup>
                                          </>
                                        )}

                                        {/* Checkbox (Terms and Conditions) */}
                                        {(field.fieldType === 'checkbox' || field.fieldType === 'terms_and_conditions') && (
                                          <div className="flex items-start space-x-2">
                                            <input
                                              type="checkbox"
                                              id={fieldId}
                                              checked={fieldValue || false}
                                              onChange={(e) => handleFieldChange(e.target.checked)}
                                              className="h-4 w-4 rounded border-gray-300 mt-1"
                                              data-testid={`checkbox-${field.id}`}
                                              required={field.required}
                                            />
                                            <Label htmlFor={fieldId} className="text-sm leading-relaxed">
                                              {field.textContent ? (
                                                <>
                                                  {field.textContent}
                                                  {field.linkUrl && (
                                                    <a 
                                                      href={field.linkUrl} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="text-blue-600 hover:underline ml-1"
                                                    >
                                                      View here
                                                    </a>
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  {field.label} {field.required && '*'}
                                                </>
                                              )}
                                            </Label>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div className="flex justify-end gap-3 pt-4">
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setIsApplicationDialogOpen(false)}
                                    >
                                      Save Draft
                                    </Button>
                                    <Button 
                                      onClick={handleSubmitAnswers}
                                      disabled={submitAnswersMutation.isPending}
                                      className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                                    >
                                      {submitAnswersMutation.isPending ? "Submitting..." : "Submit Application"}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                              </Dialog>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    disabled
                                    title="This grant has expired"
                                  >
                                    {userApplication.status === "In Progress" ? "Complete Application" : "Edit Application"}
                                  </Button>
                                )}
                              </>
                            )}
                            
                            {/* View Application for read-only statuses */}
                            {(userApplication.status === "Under Review" || userApplication.status === "Accepted" || userApplication.status === "Rejected") && (
                              <Dialog open={isApplicationDialogOpen} onOpenChange={setIsApplicationDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline">
                                    View Application
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 md:mx-auto">
                                  <DialogHeader>
                                    <DialogTitle>Your Application</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-6 mt-4">
                                    {/* Read-only display of form answers */}
                                    {formFields.map((field: any) => {
                                      const fieldValue = applicationAnswers[field.id] || "";
                                      
                                      // Skip non-input field types
                                      if (['heading', 'paragraph', 'divider', 'image', 'video', 'button'].includes(field.fieldType)) {
                                        return null;
                                      }

                                      return (
                                        <div key={field.id} className="space-y-2">
                                          <Label className="font-medium text-gray-700">{field.label}</Label>
                                          <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                                            {(field.fieldType === 'checkbox' || field.fieldType === 'terms_and_conditions') ? (
                                              <span className="text-gray-900">{fieldValue ? "Yes" : "No"}</span>
                                            ) : (
                                              <span className="text-gray-900">{fieldValue || "No answer provided"}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    <div className="flex justify-end pt-4">
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setIsApplicationDialogOpen(false)}
                                      >
                                        Close
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            
                            {/* Preference Buttons for Grants with Applications */}
                            <Button 
                              variant="outline" 
                              onClick={handleSaveForLater}
                              disabled={setPreferenceMutation.isPending || isGrantExpired(grant.deadline)}
                              className={`${userInterest?.preference === "saved" ? 'border-yellow-600 text-yellow-600 hover:bg-yellow-50' : ''}`}
                              title={isGrantExpired(grant.deadline) ? "This grant has expired" : ""}
                              data-testid="button-save-later"
                            >
                              {userInterest?.preference === "saved" ? (
                                <>
                                  <BookmarkCheck className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">Saved</span>
                                  <span className="sm:hidden">Saved</span>
                                </>
                              ) : (
                                <>
                                  <Bookmark className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">Save for Later</span>
                                  <span className="sm:hidden">Save</span>
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={handleNotInterested}
                              disabled={setPreferenceMutation.isPending || isGrantExpired(grant.deadline)}
                              className={`${userInterest?.preference === "not_interested" ? 'border-red-500 text-red-500 hover:bg-red-50' : ''}`}
                              title={isGrantExpired(grant.deadline) ? "This grant has expired" : ""}
                              data-testid="button-not-interested"
                            >
                              {userInterest?.preference === "not_interested" ? (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">Marked Not Interested</span>
                                  <span className="sm:hidden">Not Interested</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  <span className="hidden sm:inline">Not Interested</span>
                                  <span className="sm:hidden">Pass</span>
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {/* Company Remarks Display */}
                          {userApplication.remarks && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                              <h4 className="text-sm md:text-base font-medium text-blue-900 mb-2">Review Comments from {grant.company}</h4>
                              <p className="text-xs md:text-sm text-blue-800 whitespace-pre-wrap">{userApplication.remarks}</p>
                            </div>
                          )}

                          {/* Next Steps CTA for Applied Grants */}
                          {userApplication.status === "Applied" && grant.enableNextSteps && grant.nextStepsCtaText && grant.nextStepsCtaUrl && (
                            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm md:text-base font-semibold text-gray-900 mb-2">
                                    Complete Your Next Steps
                                  </h4>
                                  <p className="text-xs md:text-sm text-gray-700 mb-4">
                                    If you haven't completed the next steps yet, click below to ensure you're eligible for this grant.
                                  </p>
                                  <Button
                                    asChild
                                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-semibold"
                                    data-testid="button-complete-next-steps"
                                  >
                                    <a href={grant.nextStepsCtaUrl} target="_blank" rel="noopener noreferrer">
                                      {grant.nextStepsCtaText}
                                      <ExternalLink className="h-4 w-4 ml-2" />
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <Button 
                      asChild={!isGrantExpired(grant.deadline)}
                      disabled={isGrantExpired(grant.deadline)}
                      className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isGrantExpired(grant.deadline) ? "This grant has expired" : ""}
                    >
                      {!isGrantExpired(grant.deadline) ? (
                        <a href="/auth">
                          Apply Now
                          <Send className="h-4 w-4 ml-2" />
                        </a>
                      ) : (
                        <>
                          Apply Now
                          <Send className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Congratulatory Banner for Accepted Applications */}
            {userApplication && userApplication.status === "Accepted" && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 md:p-6 shadow-lg mb-4 md:mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-green-900 mb-2">
                      🎉 Congratulations! Your Application Has Been Accepted!
                    </h3>
                    <div className="space-y-2">
                      <p className="text-sm md:text-base text-green-800">
                        We're thrilled to inform you that your application for <span className="font-semibold">{grant.title}</span> has been approved!
                      </p>
                      <div className="flex items-start gap-2 bg-white/50 rounded-lg p-3 border border-green-200">
                        <Mail className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-green-900">
                          <span className="font-semibold">Important:</span> Please check your email inbox for detailed information about the winner announcement process and the next steps.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Application Progress - Hide for In Progress status */}
            {userApplication && userApplication.status !== "In Progress" && (
              <ApplicationProgress 
                currentStage={
                  userApplication.status === "Applied" ? "Applied" :
                  userApplication.status === "Under Review" ? "In Review" :
                  (userApplication.status === "Accepted" || userApplication.status === "Rejected") ? "Results" :
                  "Applied"
                }
                status={userApplication.status as "Applied" | "Under Review" | "Accepted" | "Rejected"}
                remarks={userApplication.remarks || undefined}
                grantTitle={grant.title}
              />
            )}

            {/* Grant Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">{grant.description}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-lg">Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">{grant.requirements}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
