import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Eye, Edit2, Trash2, Users, Calendar, DollarSign, TrendingUp, Search, Filter, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Upload, Power } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useCompanyAuth } from "@/hooks/useCompanyAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Grant, UserGrantApplication, User } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { datetimeLocalToEST, toDatetimeLocalEST, formatDeadlineFull, formatAppliedDateTime } from "@/lib/timezone";

export default function CompanyDashboard() {
  const [, setLocation] = useLocation();
  const { company, isAuthenticated, isLoading: authLoading } = useCompanyAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateGrantOpen, setIsCreateGrantOpen] = useState(false);
  const [isEditGrantOpen, setIsEditGrantOpen] = useState(false);
  const [isViewGrantOpen, setIsViewGrantOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<(UserGrantApplication & { user: User; grant: Grant }) | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [isDeleteTemplateOpen, setIsDeleteTemplateOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [templateNameFilter, setTemplateNameFilter] = useState("");
  
  // Form template states - now handled by dedicated form builder page
  const [newGrant, setNewGrant] = useState({
    title: "",
    amount: "",
    deadline: "",
    timezone: "America/New_York",
    category: "",
    description: "",
    requirements: "",
    tags: "",
    imageUrl: "",
    formTemplateId: "",
    enableNextSteps: false,
    thankYouHeadline: "",
    thankYouSubheadline: "",
    nextStepsHeadline: "",
    nextStepsSubheadline: "",
    nextStepsContent1: "",
    nextStepsCtaText: "",
    nextStepsCtaUrl: "",
    nextStepsContent2: "",
  });

  // Application filters
  const [applicationFilters, setApplicationFilters] = useState({
    applicant: "",
    grant: "",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
  });

  // Multi-select status state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const statusOptions = [
    { value: "Applied", label: "Applied" },
    { value: "In Progress", label: "In Progress" },
    { value: "Under Review", label: "Under Review" },
    { value: "Accepted", label: "Accepted" },
    { value: "Rejected", label: "Rejected" }
  ];

  // Selected applications for export
  const [selectedApplications, setSelectedApplications] = useState<Set<number>>(new Set());

  // Sorting state - default to showing latest applications first
  const [sortConfig, setSortConfig] = useState<{
    key: 'applicant' | 'grant' | 'appliedDate' | 'status' | null;
    direction: 'asc' | 'desc';
  }>({ key: 'appliedDate', direction: 'desc' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  
  // Template pagination state
  const [currentTemplatePage, setCurrentTemplatePage] = useState(1);
  const [templatesPerPage, setTemplatesPerPage] = useState(10);


  const { data: grants = [], isLoading: grantsLoading } = useQuery<Grant[]>({
    queryKey: ["/api/company/grants"],
    enabled: isAuthenticated,
  });

  const { data: applications = [], isLoading: applicationsLoading } = useQuery<(UserGrantApplication & { user: User; grant: Grant })[]>({
    queryKey: ["/api/company/applications"],
    enabled: isAuthenticated,
  });

  const { data: formTemplates = [], isLoading: formTemplatesLoading } = useQuery<any[]>({
    queryKey: ["/api/company/form-templates"],
    enabled: isAuthenticated,
  });

  // Fetch form fields for the selected application's grant
  const { data: reviewFormFields = [] } = useQuery<any[]>({
    queryKey: ["/api/form-templates", selectedApplication?.grant?.formTemplateId, "fields"],
    enabled: !!selectedApplication?.grant?.formTemplateId,
  });

  const createGrantMutation = useMutation({
    mutationFn: async (grantData: any) => {
      const response = await apiRequest("/api/company/grants", {
        method: "POST",
        body: JSON.stringify({
          ...grantData,
          amount: parseInt(grantData.amount),
          tags: grantData.tags ? grantData.tags.split(",").map((tag: string) => tag.trim()) : [],
          formTemplateId: parseInt(grantData.formTemplateId),
          enableNextSteps: grantData.enableNextSteps || false,
          thankYouHeadline: grantData.thankYouHeadline || null,
          thankYouSubheadline: grantData.thankYouSubheadline || null,
          nextStepsHeadline: grantData.nextStepsHeadline || null,
          nextStepsSubheadline: grantData.nextStepsSubheadline || null,
          nextStepsContent1: grantData.nextStepsContent1 || null,
          nextStepsCtaText: grantData.nextStepsCtaText || null,
          nextStepsCtaUrl: grantData.nextStepsCtaUrl || null,
          nextStepsContent2: grantData.nextStepsContent2 || null,
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/grants"] });
      setIsCreateGrantOpen(false);
      setNewGrant({
        title: "", amount: "", deadline: "", timezone: "America/New_York", category: "", 
        description: "", requirements: "", tags: "", imageUrl: "", formTemplateId: "",
        enableNextSteps: false, thankYouHeadline: "", thankYouSubheadline: "",
        nextStepsHeadline: "", nextStepsSubheadline: "", nextStepsContent1: "",
        nextStepsCtaText: "", nextStepsCtaUrl: "", nextStepsContent2: ""
      });
      toast({
        title: "Success",
        description: "Grant created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create grant",
        variant: "destructive",
      });
    },
  });

  const updateApplicationStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status, remarks }: { applicationId: number; status: string; remarks?: string }) => {
      const response = await apiRequest(`/api/company/applications/${applicationId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, remarks }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/applications"] });
      setIsReviewDialogOpen(false);
      setSelectedApplication(null);
      setReviewRemarks("");
      toast({
        title: "Success",
        description: "Application reviewed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const updateGrantMutation = useMutation({
    mutationFn: async ({ grantId, grantData }: { grantId: number; grantData: any }) => {
      const response = await apiRequest(`/api/company/grants/${grantId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...grantData,
          amount: parseInt(grantData.amount),
          tags: grantData.tags ? grantData.tags.split(",").map((tag: string) => tag.trim()) : [],
          formTemplateId: parseInt(grantData.formTemplateId),
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/grants"] });
      setIsEditGrantOpen(false);
      setSelectedGrant(null);
      toast({
        title: "Success",
        description: "Grant updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update grant",
        variant: "destructive",
      });
    },
  });

  const toggleGrantStatusMutation = useMutation({
    mutationFn: async ({ grantId, status }: { grantId: number; status: "active" | "inactive" }) => {
      const response = await apiRequest(`/api/company/grants/${grantId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/grants"] });
      toast({
        title: "Success",
        description: `Grant ${data.status === "active" ? "activated" : "deactivated"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update grant status",
        variant: "destructive",
      });
    },
  });

  const deleteGrantMutation = useMutation({
    mutationFn: async (grantId: number) => {
      const response = await apiRequest(`/api/company/grants/${grantId}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/grants"] });
      toast({
        title: "Success",
        description: "Grant deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete grant",
        variant: "destructive",
      });
    },
  });

  const deleteFormTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest(`/api/company/form-templates/${templateId}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/form-templates"] });
      setIsDeleteTemplateOpen(false);
      setTemplateToDelete(null);
      toast({
        title: "Success",
        description: "Form template deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form template",
        variant: "destructive",
      });
    },
  });

  // Form template save mutation - removed, now handled by dedicated form builder page

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/company/auth");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Filter applications based on current filters
  const filteredApplications = applications.filter(application => {
    // Exclude "In Progress" applications (not submitted yet)
    if (application.status === "In Progress") {
      return false;
    }

    // Filter by applicant name or email
    if (applicationFilters.applicant) {
      const applicantSearch = applicationFilters.applicant.toLowerCase();
      const fullName = `${application.user?.firstName || ''} ${application.user?.lastName || ''}`.toLowerCase();
      const email = (application.user?.email || '').toLowerCase();
      if (!fullName.includes(applicantSearch) && !email.includes(applicantSearch)) {
        return false;
      }
    }

    // Filter by grant title
    if (applicationFilters.grant) {
      if (!application.grant.title.toLowerCase().includes(applicationFilters.grant.toLowerCase())) {
        return false;
      }
    }

    // Filter by status
    if (applicationFilters.status.length > 0) {
      if (!applicationFilters.status.includes(application.status)) {
        return false;
      }
    }

    // Filter by date range
    if (applicationFilters.dateFrom) {
      const appliedDate = new Date(application.appliedAt);
      const fromDate = new Date(applicationFilters.dateFrom);
      if (appliedDate < fromDate) {
        return false;
      }
    }

    if (applicationFilters.dateTo) {
      const appliedDate = new Date(application.appliedAt);
      const toDate = new Date(applicationFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (appliedDate > toDate) {
        return false;
      }
    }

    return true;
  });

  // Reset to page 1 when filters change and current page is out of bounds
  useEffect(() => {
    const totalPages = Math.ceil(filteredApplications.length / recordsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredApplications.length, currentPage, recordsPerPage]);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }


  const handleLogout = () => {
    localStorage.removeItem("companyToken");
    queryClient.clear();
    setLocation("/company/auth");
  };

  const handleOpenCreateGrant = () => {
    // Reset form to blank state
    setNewGrant({
      title: "",
      amount: "",
      deadline: "",
      timezone: "America/New_York",
      category: "",
      description: "",
      requirements: "",
      tags: "",
      imageUrl: "",
      formTemplateId: "",
    });
    setIsCreateGrantOpen(true);
  };

  const handleCreateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form template is selected
    if (!newGrant.formTemplateId) {
      toast({
        title: "Validation Error",
        description: "Please select an application form template",
        variant: "destructive",
      });
      return;
    }
    
    createGrantMutation.mutate({
      ...newGrant,
      deadline: datetimeLocalToEST(newGrant.deadline)
    }, {
      onSuccess: () => {
        // Reset form after successful creation
        setNewGrant({
          title: "",
          amount: "",
          deadline: "",
          timezone: "America/New_York",
          category: "",
          description: "",
          requirements: "",
          tags: "",
          imageUrl: "",
          formTemplateId: "",
        });
        setIsCreateGrantOpen(false);
      }
    });
  };

  const handleStatusUpdate = (applicationId: number, status: string) => {
    updateApplicationStatusMutation.mutate({ applicationId, status });
  };

  const handleReviewApplication = (application: UserGrantApplication & { user: User; grant: Grant }) => {
    setSelectedApplication(application);
    setReviewRemarks(application.remarks || "");
    setIsReviewDialogOpen(true);
  };

  const handleSubmitReview = (status: string) => {
    if (selectedApplication) {
      updateApplicationStatusMutation.mutate({
        applicationId: selectedApplication.id,
        status,
        remarks: reviewRemarks
      });
    }
  };

  const handleViewGrant = (grant: Grant) => {
    setSelectedGrant(grant);
    setIsViewGrantOpen(true);
  };

  const handleEditGrant = (grant: Grant) => {
    setSelectedGrant(grant);
    setNewGrant({
      title: grant.title,
      amount: grant.amount.toString(),
      deadline: toDatetimeLocalEST(grant.deadline),
      timezone: grant.timezone || "America/New_York",
      category: grant.category,
      description: grant.description,
      requirements: grant.requirements,
      tags: grant.tags.join(", "),
      imageUrl: grant.imageUrl || "",
      formTemplateId: grant.formTemplateId?.toString() || "",
      enableNextSteps: grant.enableNextSteps || false,
      thankYouHeadline: grant.thankYouHeadline || "",
      thankYouSubheadline: grant.thankYouSubheadline || "",
      nextStepsHeadline: grant.nextStepsHeadline || "",
      nextStepsSubheadline: grant.nextStepsSubheadline || "",
      nextStepsContent1: grant.nextStepsContent1 || "",
      nextStepsCtaText: grant.nextStepsCtaText || "",
      nextStepsCtaUrl: grant.nextStepsCtaUrl || "",
      nextStepsContent2: grant.nextStepsContent2 || "",
    });
    setIsEditGrantOpen(true);
  };

  const handleDeleteGrant = (grantId: number) => {
    if (window.confirm("Are you sure you want to delete this grant? This action cannot be undone.")) {
      deleteGrantMutation.mutate(grantId);
    }
  };

  const handleDeleteTemplate = (template: any) => {
    setTemplateToDelete(template);
    setIsDeleteTemplateOpen(true);
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      deleteFormTemplateMutation.mutate(templateToDelete.id);
    }
  };

  const handleUpdateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form template is selected
    if (!newGrant.formTemplateId) {
      toast({
        title: "Validation Error",
        description: "Please select an application form template",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedGrant) {
      updateGrantMutation.mutate({ 
        grantId: selectedGrant.id, 
        grantData: {
          ...newGrant,
          deadline: datetimeLocalToEST(newGrant.deadline)
        }
      });
    }
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount}`;
  };


  const totalGrantAmount = grants.reduce((sum, grant) => sum + grant.amount, 0);
  const totalApplications = applications.length;
  const activeGrants = grants.filter(grant => grant.status === "active").length;



  const clearFilters = () => {
    setApplicationFilters({
      applicant: "",
      grant: "",
      status: [],
      dateFrom: "",
      dateTo: "",
    });
    // Clear selections when filters are cleared
    setSelectedApplications(new Set());
  };

  // Multi-select status handlers
  const handleStatusChange = (statusValue: string) => {
    setApplicationFilters(prev => {
      const currentStatuses = prev.status;
      const isSelected = currentStatuses.includes(statusValue);
      
      if (isSelected) {
        // Remove status if already selected
        return {
          ...prev,
          status: currentStatuses.filter(s => s !== statusValue)
        };
      } else {
        // Add status if not selected
        return {
          ...prev,
          status: [...currentStatuses, statusValue]
        };
      }
    });
  };

  const getStatusDisplayText = () => {
    if (applicationFilters.status.length === 0) {
      return "All Statuses";
    } else if (applicationFilters.status.length === 1) {
      return applicationFilters.status[0];
    } else {
      return `${applicationFilters.status.length} statuses selected`;
    }
  };

  // Sorting function
  const handleSort = (key: 'applicant' | 'grant' | 'appliedDate' | 'status') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting to filtered applications
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (sortConfig.key) {
      case 'applicant':
        aValue = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.toLowerCase();
        bValue = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.toLowerCase();
        break;
      case 'grant':
        aValue = a.grant.title.toLowerCase();
        bValue = b.grant.title.toLowerCase();
        break;
      case 'appliedDate':
        aValue = new Date(a.appliedAt).getTime();
        bValue = new Date(b.appliedAt).getTime();
        break;
      case 'status':
        aValue = a.status.toLowerCase();
        bValue = b.status.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Pagination calculations
  const totalRecords = sortedApplications.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedApplications = sortedApplications.slice(startIndex, endIndex);


  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRecordsPerPageChange = (newRecordsPerPage: number) => {
    setRecordsPerPage(newRecordsPerPage);
    setCurrentPage(1); // Reset to first page when changing records per page
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }
    
    return pageNumbers;
  };

  // Template pagination calculations
  const filteredTemplates = formTemplates.filter(template => 
    templateNameFilter === "" || 
    template.name.toLowerCase().includes(templateNameFilter.toLowerCase())
  );
  const totalTemplateRecords = filteredTemplates.length;
  const totalTemplatePages = Math.ceil(totalTemplateRecords / templatesPerPage);
  const templateStartIndex = (currentTemplatePage - 1) * templatesPerPage;
  const templateEndIndex = templateStartIndex + templatesPerPage;
  const paginatedTemplates = filteredTemplates.slice(templateStartIndex, templateEndIndex);

  // Template pagination handlers
  const handleTemplatePageChange = (page: number) => {
    setCurrentTemplatePage(page);
  };

  const handleTemplatesPerPageChange = (newTemplatesPerPage: number) => {
    setTemplatesPerPage(newTemplatesPerPage);
    setCurrentTemplatePage(1);
  };

  const handleTemplatePreviousPage = () => {
    if (currentTemplatePage > 1) {
      setCurrentTemplatePage(currentTemplatePage - 1);
    }
  };

  const handleTemplateNextPage = () => {
    if (currentTemplatePage < totalTemplatePages) {
      setCurrentTemplatePage(currentTemplatePage + 1);
    }
  };

  const getTemplatePageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalTemplatePages <= maxPagesToShow) {
      for (let i = 1; i <= totalTemplatePages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentTemplatePage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentTemplatePage >= totalTemplatePages - 2) {
        for (let i = totalTemplatePages - 4; i <= totalTemplatePages; i++) {
          pageNumbers.push(i);
        }
      } else {
        for (let i = currentTemplatePage - 2; i <= currentTemplatePage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }
    
    return pageNumbers;
  };

  // Checkbox selection functions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedApplications.map(app => app.id));
      setSelectedApplications(allIds);
    } else {
      setSelectedApplications(new Set());
    }
  };

  const handleSelectApplication = (applicationId: number, checked: boolean) => {
    const newSelected = new Set(selectedApplications);
    if (checked) {
      newSelected.add(applicationId);
    } else {
      newSelected.delete(applicationId);
    }
    setSelectedApplications(newSelected);
  };

  const isAllSelected = sortedApplications.length > 0 && sortedApplications.every(app => selectedApplications.has(app.id));
  const isSomeSelected = sortedApplications.some(app => selectedApplications.has(app.id));

  // Helper function to render sort icon
  const renderSortIcon = (columnKey: 'applicant' | 'grant' | 'appliedDate' | 'status') => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp className="h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  const exportApplicationsToCSV = () => {
    // Check if any applications are selected
    if (selectedApplications.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one application to export",
        variant: "destructive",
      });
      return;
    }

    // Filter to only include selected applications
    const selectedApps = sortedApplications.filter(app => selectedApplications.has(app.id));

    // Prepare CSV headers
    const headers = [
      "Applicant Name",
      "Applicant Email", 
      "Grant Name",
      "Grant Amount",
      "Applied Date",
      "Status",
      "Company Remarks"
    ];

    // Get all unique question keys from selected applications to create dynamic columns
    const allQuestionKeys = new Set<string>();
    selectedApps.forEach(application => {
      if (application.answers) {
        try {
          const answers = JSON.parse(application.answers);
          Object.keys(answers).forEach(key => allQuestionKeys.add(key));
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });

    // Add question headers
    const questionHeaders = Array.from(allQuestionKeys).map(key => 
      key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())
    );
    headers.push(...questionHeaders);

    // Prepare CSV rows
    const rows = selectedApps.map(application => {
      const row = [
        `${application.user?.firstName || ''} ${application.user?.lastName || ''}`,
        application.user?.email || '',
        application.grant.title,
        `$${application.grant.amount.toLocaleString()}`,
        formatAppliedDateTime(application.appliedAt),
        application.status,
        application.remarks || ""
      ];

      // Add answers for each question
      const answers = application.answers ? JSON.parse(application.answers || "{}") : {};
      Array.from(allQuestionKeys).forEach(key => {
        const answer = answers[key];
        row.push(answer ? String(answer).replace(/\n/g, ' ').replace(/\r/g, ' ') : "");
      });

      return row;
    });

    // Create CSV content
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `grant-applications-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `${selectedApps.length} selected applications exported to CSV`,
    });
  };

  // Form builder helper functions - removed, now handled by dedicated form builder page

  // Form field preview and save functions - removed, now handled by dedicated form builder page

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {company?.name} Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {company?.name}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
          {[
            { key: "overview", label: "Overview" },
            { key: "applications", label: "Applications" },
            { key: "forms", label: "Form Templates" },
            { key: "grants", label: "My Grants" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-yellow-600 shadow-sm"
                  : "text-gray-600 hover:text-yellow-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Grants</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{grants.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatAmount(totalGrantAmount)} total value
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Grants</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeGrants}</div>
                  <p className="text-xs text-muted-foreground">
                    Currently accepting applications
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalApplications}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all grants
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {applications.filter(app => 
                      new Date(app.appliedAt).getMonth() === new Date().getMonth()
                    ).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New applications
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Latest applications to your grants</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Grant</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...applications]
                      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
                      .slice(0, 10)
                      .map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{application.user?.firstName || ''} {application.user?.lastName || ''}</p>
                            <p className="text-sm text-gray-500">{application.user?.email || 'Unknown'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{application.grant.title}</p>
                            <p className="text-sm text-gray-500">{formatAmount(application.grant.amount)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatAppliedDateTime(application.appliedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={
                              application.status === "Applied" ? "bg-green-500 text-white" :
                              application.status === "In Progress" ? "bg-blue-500 text-white" :
                              application.status === "Under Review" ? "bg-yellow-500 text-white" :
                              application.status === "Accepted" ? "bg-green-600 text-white" :
                              application.status === "Rejected" ? "bg-red-500 text-white" : ""
                            }
                          >
                            {application.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {applications.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No applications yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Grants Tab */}
        {activeTab === "grants" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">My Grants</h2>
                <p className="text-sm text-gray-500 mt-1">Manage your grant offerings</p>
              </div>
              <Dialog open={isCreateGrantOpen} onOpenChange={setIsCreateGrantOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleOpenCreateGrant}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Grant
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Grant</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateGrant} className="space-y-4">
                    <Tabs defaultValue="details" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Grant Details</TabsTrigger>
                        <TabsTrigger value="next-steps">Next Steps</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Grant Title *</Label>
                        <Input
                          id="title"
                          value={newGrant.title}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, title: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount ($) *</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={newGrant.amount}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, amount: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="deadline">Deadline *</Label>
                        <Input
                          id="deadline"
                          type="datetime-local"
                          value={newGrant.deadline}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, deadline: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone *</Label>
                        <Select
                          value={newGrant.timezone}
                          onValueChange={(value) => setNewGrant(prev => ({ ...prev, timezone: value }))}
                        >
                          <SelectTrigger id="timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">EST (America/New_York)</SelectItem>
                            <SelectItem value="America/Chicago">CST (America/Chicago)</SelectItem>
                            <SelectItem value="America/Denver">MST (America/Denver)</SelectItem>
                            <SelectItem value="America/Los_Angeles">PST (America/Los_Angeles)</SelectItem>
                            <SelectItem value="America/Anchorage">AKST (America/Anchorage)</SelectItem>
                            <SelectItem value="Pacific/Honolulu">HST (Pacific/Honolulu)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="Europe/London">GMT (Europe/London)</SelectItem>
                            <SelectItem value="Europe/Paris">CET (Europe/Paris)</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST (Asia/Tokyo)</SelectItem>
                            <SelectItem value="Australia/Sydney">AEST (Australia/Sydney)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={newGrant.category}
                        onValueChange={(value) => setNewGrant(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arts">Arts</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Environment">Environment</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Research">Research</SelectItem>
                          <SelectItem value="Small Business">Small Business</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Women-owned Businesses">Women-owned Businesses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="formTemplateId">Application Form Template *</Label>
                      <Select
                        value={newGrant.formTemplateId}
                        onValueChange={(value) => setNewGrant(prev => ({ ...prev, formTemplateId: value }))}
                        required
                      >
                        <SelectTrigger id="formTemplateId" data-testid="select-form-template">
                          <SelectValue placeholder="Select a form template" />
                        </SelectTrigger>
                        <SelectContent>
                          {formTemplates.map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={newGrant.description}
                        onChange={(e) => setNewGrant(prev => ({ ...prev, description: e.target.value }))}
                        required
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="requirements">Requirements</Label>
                      <Textarea
                        id="requirements"
                        value={newGrant.requirements}
                        onChange={(e) => setNewGrant(prev => ({ ...prev, requirements: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tags">Tags (comma-separated)</Label>
                        <Input
                          id="tags"
                          value={newGrant.tags}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, tags: e.target.value }))}
                          placeholder="startup, innovation, tech"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">Grant Image</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="imageUrl"
                            value={newGrant.imageUrl || "No file chosen"}
                            readOnly
                            placeholder="No file chosen"
                            className="flex-1"
                          />
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            onGetUploadParameters={async () => {
                              const response = await fetch("/api/objects/upload", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "Authorization": `Bearer ${localStorage.getItem("companyToken")}`,
                                },
                              });
                              const data = await response.json();
                              return {
                                method: "PUT" as const,
                                url: data.uploadURL,
                              };
                            }}
                            onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                              if (result.successful && result.successful.length > 0) {
                                const uploadURL = result.successful[0].uploadURL;
                                const response = await apiRequest("/api/grant-images", {
                                  method: "PUT",
                                  body: JSON.stringify({ imageURL: uploadURL }),
                                });
                                const data = await response.json();
                                setNewGrant(prev => ({ ...prev, imageUrl: data.objectPath }));
                                toast({
                                  title: "Success",
                                  description: "Image uploaded successfully",
                                });
                              }
                            }}
                            buttonClassName="bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-black"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Choose File
                          </ObjectUploader>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enableNextSteps"
                          checked={newGrant.enableNextSteps}
                          onCheckedChange={(checked) => 
                            setNewGrant(prev => ({ ...prev, enableNextSteps: checked as boolean }))
                          }
                        />
                        <Label htmlFor="enableNextSteps" className="text-sm font-medium">
                          Enable custom "Next Steps" thank you page
                        </Label>
                      </div>
                    </div>
                      </TabsContent>
                      
                      <TabsContent value="next-steps" className="space-y-4 mt-4">
                        <div className="space-y-4">
                          {newGrant.enableNextSteps ? (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="thankYouHeadline">Main Headline</Label>
                                <Input
                                  id="thankYouHeadline"
                                  value={newGrant.thankYouHeadline}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, thankYouHeadline: e.target.value }))}
                                  placeholder="Thank you for applying for"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="thankYouSubheadline">Sub Headline</Label>
                                <Input
                                  id="thankYouSubheadline"
                                  value={newGrant.thankYouSubheadline}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, thankYouSubheadline: e.target.value }))}
                                  placeholder="Your application has been submitted successfully"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="nextStepsHeadline">"What Happens Next" Headline</Label>
                                <Input
                                  id="nextStepsHeadline"
                                  value={newGrant.nextStepsHeadline}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsHeadline: e.target.value }))}
                                  placeholder="What happens next?"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="nextStepsSubheadline">"What Happens Next" Sub Headline</Label>
                                <Input
                                  id="nextStepsSubheadline"
                                  value={newGrant.nextStepsSubheadline}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsSubheadline: e.target.value }))}
                                  placeholder="To be completely entered into the grant giveaway, you must..."
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="nextStepsContent1">Content Before Call-to-Action (multiline)</Label>
                                <Textarea
                                  id="nextStepsContent1"
                                  value={newGrant.nextStepsContent1}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsContent1: e.target.value }))}
                                  placeholder="Please submit your application video for our team to review..."
                                  rows={4}
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="nextStepsCtaText">Call-to-Action Button Text</Label>
                                  <Input
                                    id="nextStepsCtaText"
                                    value={newGrant.nextStepsCtaText}
                                    onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsCtaText: e.target.value }))}
                                    placeholder="Click here to submit your video today"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="nextStepsCtaUrl">Call-to-Action URL</Label>
                                  <Input
                                    id="nextStepsCtaUrl"
                                    type="url"
                                    value={newGrant.nextStepsCtaUrl}
                                    onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsCtaUrl: e.target.value }))}
                                    placeholder="https://example.com/submit-video"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="nextStepsContent2">Content After Call-to-Action (multiline)</Label>
                                <Textarea
                                  id="nextStepsContent2"
                                  value={newGrant.nextStepsContent2}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsContent2: e.target.value }))}
                                  placeholder="We will be looking at all website submissions AND all video submissions..."
                                  rows={4}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p>Enable "Next Steps" in the Grant Details tab to configure a custom thank you page for applicants.</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateGrantOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white"
                        disabled={createGrantMutation.isPending}
                      >
                        {createGrantMutation.isPending ? "Creating..." : "Create Grant"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Application Form</TableHead>
                      <TableHead>Applications</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grants.map((grant) => (
                      <TableRow key={grant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{grant.title}</p>
                            <p className="text-sm text-gray-500 truncate max-w-xs">{grant.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{grant.category}</TableCell>
                        <TableCell>{formatAmount(grant.amount)}</TableCell>
                        <TableCell>
                          {formatDeadlineFull(grant.deadline, grant.timezone)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={grant.status === "active" ? "default" : "secondary"}
                            className={grant.status === "active" ? "bg-green-500" : "bg-gray-400 text-gray-700 dark:bg-gray-600 dark:text-gray-300"}
                          >
                            {grant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formTemplates.find(t => t.id === grant.formTemplateId)?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {applications.filter(app => app.grantId === grant.id).length}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewGrant(grant)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditGrant(grant)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={grant.status === "active" ? "text-green-600" : "text-gray-400"}
                              onClick={() => toggleGrantStatusMutation.mutate({ 
                                grantId: grant.id, 
                                status: grant.status === "active" ? "inactive" : "active" 
                              })}
                              disabled={toggleGrantStatusMutation.isPending}
                              data-testid={`button-toggle-status-${grant.id}`}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteGrant(grant.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {grants.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No grants created yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* View Grant Dialog */}
            <Dialog open={isViewGrantOpen} onOpenChange={setIsViewGrantOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Grant Details</DialogTitle>
                </DialogHeader>
                {selectedGrant && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Title</Label>
                        <p className="text-lg font-semibold">{selectedGrant.title}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Amount</Label>
                        <p className="text-lg font-semibold">{formatAmount(selectedGrant.amount)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Category</Label>
                        <p>{selectedGrant.category}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Deadline</Label>
                        <p>{formatDeadlineFull(selectedGrant.deadline, selectedGrant.timezone)}</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Description</Label>
                      <p className="mt-1">{selectedGrant.description}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Requirements</Label>
                      <p className="mt-1">{selectedGrant.requirements}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Tags</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedGrant.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Application Form Template</Label>
                      <p className="mt-1">{formTemplates.find(t => t.id === selectedGrant.formTemplateId)?.name || "-"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Status</Label>
                        <Badge 
                          variant={selectedGrant.status === "active" ? "default" : "secondary"}
                          className={selectedGrant.status === "active" ? "bg-green-500" : ""}
                        >
                          {selectedGrant.status}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Applications</Label>
                        <p>{applications.filter(app => app.grantId === selectedGrant.id).length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Edit Grant Dialog */}
            <Dialog open={isEditGrantOpen} onOpenChange={setIsEditGrantOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Grant</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateGrant} className="space-y-4">
                  <Tabs defaultValue="grant-details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="grant-details">Grant Details</TabsTrigger>
                      <TabsTrigger value="next-steps">Next Steps</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="grant-details" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-title">Grant Title *</Label>
                        <Input
                          id="edit-title"
                          value={newGrant.title}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, title: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-amount">Amount ($) *</Label>
                        <Input
                          id="edit-amount"
                          type="number"
                          value={newGrant.amount}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, amount: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-deadline">Deadline *</Label>
                        <Input
                          id="edit-deadline"
                          type="datetime-local"
                          value={newGrant.deadline}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, deadline: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-timezone">Timezone *</Label>
                        <Select
                          value={newGrant.timezone}
                          onValueChange={(value) => setNewGrant(prev => ({ ...prev, timezone: value }))}
                        >
                          <SelectTrigger id="edit-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">EST (America/New_York)</SelectItem>
                            <SelectItem value="America/Chicago">CST (America/Chicago)</SelectItem>
                            <SelectItem value="America/Denver">MST (America/Denver)</SelectItem>
                            <SelectItem value="America/Los_Angeles">PST (America/Los_Angeles)</SelectItem>
                            <SelectItem value="America/Anchorage">AKST (America/Anchorage)</SelectItem>
                            <SelectItem value="Pacific/Honolulu">HST (Pacific/Honolulu)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="Europe/London">GMT (Europe/London)</SelectItem>
                            <SelectItem value="Europe/Paris">CET (Europe/Paris)</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST (Asia/Tokyo)</SelectItem>
                            <SelectItem value="Australia/Sydney">AEST (Australia/Sydney)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Category *</Label>
                      <Select
                        value={newGrant.category}
                        onValueChange={(value) => setNewGrant(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger id="edit-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arts">Arts</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Environment">Environment</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Research">Research</SelectItem>
                          <SelectItem value="Small Business">Small Business</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Women-owned Businesses">Women-owned Businesses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-formTemplateId">Application Form Template *</Label>
                      <Select
                        value={newGrant.formTemplateId}
                        onValueChange={(value) => setNewGrant(prev => ({ ...prev, formTemplateId: value }))}
                        required
                      >
                        <SelectTrigger id="edit-formTemplateId" data-testid="select-edit-form-template">
                          <SelectValue placeholder="Select a form template" />
                        </SelectTrigger>
                        <SelectContent>
                          {formTemplates.map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description *</Label>
                      <Textarea
                        id="edit-description"
                        value={newGrant.description}
                        onChange={(e) => setNewGrant(prev => ({ ...prev, description: e.target.value }))}
                        required
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-requirements">Requirements</Label>
                      <Textarea
                        id="edit-requirements"
                        value={newGrant.requirements}
                        onChange={(e) => setNewGrant(prev => ({ ...prev, requirements: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                        <Input
                          id="edit-tags"
                          value={newGrant.tags}
                          onChange={(e) => setNewGrant(prev => ({ ...prev, tags: e.target.value }))}
                          placeholder="startup, innovation, tech"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-imageUrl">Grant Image</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="edit-imageUrl"
                            value={newGrant.imageUrl || "No file chosen"}
                            readOnly
                            placeholder="No file chosen"
                            className="flex-1"
                          />
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={10485760}
                            onGetUploadParameters={async () => {
                              const response = await fetch("/api/objects/upload", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "Authorization": `Bearer ${localStorage.getItem("companyToken")}`,
                                },
                              });
                              const data = await response.json();
                              return {
                                method: "PUT" as const,
                                url: data.uploadURL,
                              };
                            }}
                            onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                              if (result.successful && result.successful.length > 0) {
                                const uploadURL = result.successful[0].uploadURL;
                                const response = await apiRequest("/api/grant-images", {
                                  method: "PUT",
                                  body: JSON.stringify({ imageURL: uploadURL }),
                                });
                                const data = await response.json();
                                setNewGrant(prev => ({ ...prev, imageUrl: data.objectPath }));
                                toast({
                                  title: "Success",
                                  description: "Image uploaded successfully",
                                });
                              }
                            }}
                            buttonClassName="bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-black"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Choose File
                          </ObjectUploader>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-enableNextSteps"
                          checked={newGrant.enableNextSteps}
                          onCheckedChange={(checked) => 
                            setNewGrant(prev => ({ ...prev, enableNextSteps: checked as boolean }))
                          }
                        />
                        <Label htmlFor="edit-enableNextSteps" className="text-sm font-medium">
                          Enable custom "Next Steps" thank you page
                        </Label>
                      </div>
                    </div>
                    </TabsContent>
                    
                    <TabsContent value="next-steps" className="space-y-4 mt-4">
                      <div className="space-y-4">
                        {newGrant.enableNextSteps ? (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="edit-thankYouHeadline">Main Headline</Label>
                              <Input
                                id="edit-thankYouHeadline"
                                value={newGrant.thankYouHeadline}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, thankYouHeadline: e.target.value }))}
                                placeholder="Thank you for applying for"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-thankYouSubheadline">Sub Headline</Label>
                              <Input
                                id="edit-thankYouSubheadline"
                                value={newGrant.thankYouSubheadline}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, thankYouSubheadline: e.target.value }))}
                                placeholder="Your application has been submitted successfully"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-nextStepsHeadline">"What Happens Next" Headline</Label>
                              <Input
                                id="edit-nextStepsHeadline"
                                value={newGrant.nextStepsHeadline}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsHeadline: e.target.value }))}
                                placeholder="What happens next?"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-nextStepsSubheadline">"What Happens Next" Sub Headline</Label>
                              <Input
                                id="edit-nextStepsSubheadline"
                                value={newGrant.nextStepsSubheadline}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsSubheadline: e.target.value }))}
                                placeholder="To be completely entered into the grant giveaway, you must..."
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-nextStepsContent1">Content Before Call-to-Action (multiline)</Label>
                              <Textarea
                                id="edit-nextStepsContent1"
                                value={newGrant.nextStepsContent1}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsContent1: e.target.value }))}
                                placeholder="Please submit your application video for our team to review..."
                                rows={4}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-nextStepsCtaText">Call-to-Action Button Text</Label>
                                <Input
                                  id="edit-nextStepsCtaText"
                                  value={newGrant.nextStepsCtaText}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsCtaText: e.target.value }))}
                                  placeholder="Click here to submit your video today"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-nextStepsCtaUrl">Call-to-Action URL</Label>
                                <Input
                                  id="edit-nextStepsCtaUrl"
                                  type="url"
                                  value={newGrant.nextStepsCtaUrl}
                                  onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsCtaUrl: e.target.value }))}
                                  placeholder="https://example.com/submit-video"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-nextStepsContent2">Content After Call-to-Action (multiline)</Label>
                              <Textarea
                                id="edit-nextStepsContent2"
                                value={newGrant.nextStepsContent2}
                                onChange={(e) => setNewGrant(prev => ({ ...prev, nextStepsContent2: e.target.value }))}
                                placeholder="We will be looking at all website submissions AND all video submissions..."
                                rows={4}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <p>Enable "Next Steps" in the Grant Details tab to configure a custom thank you page for applicants.</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditGrantOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white"
                      disabled={updateGrantMutation.isPending}
                    >
                      {updateGrantMutation.isPending ? "Updating..." : "Update Grant"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === "applications" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Grant Applications</h2>
                <p className="text-sm text-gray-500 mt-1">Click on any application row to view details and edit remarks</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {filteredApplications.length} of {applications.length} applications
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportApplicationsToCSV}
                  disabled={selectedApplications.size === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV {selectedApplications.size > 0 ? `(${selectedApplications.size})` : ""}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={applicationFilters.applicant === "" && applicationFilters.grant === "" && applicationFilters.status.length === 0 && applicationFilters.dateFrom === "" && applicationFilters.dateTo === ""}
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Applicant Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="applicant-filter">Applicant</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="applicant-filter"
                        placeholder="Search by name or email"
                        value={applicationFilters.applicant}
                        onChange={(e) => setApplicationFilters(prev => ({ ...prev, applicant: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Grant Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="grant-filter">Grant</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="grant-filter"
                        placeholder="Search by grant title"
                        value={applicationFilters.grant}
                        onChange={(e) => setApplicationFilters(prev => ({ ...prev, grant: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Status Filter - Multi-Select */}
                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isStatusDropdownOpen}
                          className="w-full justify-between"
                          data-testid="status-filter-trigger"
                        >
                          {getStatusDisplayText()}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="p-2">
                          <div className="space-y-1">
                            {statusOptions.map((option) => (
                              <div
                                key={option.value}
                                className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded cursor-pointer"
                                onClick={() => handleStatusChange(option.value)}
                                data-testid={`status-option-${option.value.toLowerCase().replace(' ', '-')}`}
                              >
                                <Checkbox
                                  checked={applicationFilters.status.includes(option.value)}
                                  onCheckedChange={() => {}} // Handled by parent div onClick
                                  className="pointer-events-none"
                                />
                                <span className="text-sm">{option.label}</span>
                                {applicationFilters.status.includes(option.value) && (
                                  <Check className="ml-auto h-4 w-4 text-green-600" />
                                )}
                              </div>
                            ))}
                          </div>
                          {applicationFilters.status.length > 0 && (
                            <div className="border-t pt-2 mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setApplicationFilters(prev => ({ ...prev, status: [] }))}
                                className="w-full text-xs"
                                data-testid="clear-status-filter"
                              >
                                Clear Selection
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date From Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="date-from-filter">From Date</Label>
                    <Input
                      id="date-from-filter"
                      type="date"
                      value={applicationFilters.dateFrom}
                      onChange={(e) => setApplicationFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    />
                  </div>

                  {/* Date To Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="date-to-filter">To Date</Label>
                    <Input
                      id="date-to-filter"
                      type="date"
                      value={applicationFilters.dateTo}
                      onChange={(e) => setApplicationFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all applications"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('applicant')}
                        data-testid="header-applicant"
                      >
                        <div className="flex items-center gap-1">
                          Applicant
                          {renderSortIcon('applicant')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('grant')}
                        data-testid="header-grant"
                      >
                        <div className="flex items-center gap-1">
                          Grant
                          {renderSortIcon('grant')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('appliedDate')}
                        data-testid="header-applied-date"
                      >
                        <div className="flex items-center gap-1">
                          Applied Date
                          {renderSortIcon('appliedDate')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('status')}
                        data-testid="header-status"
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {renderSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedApplications.map((application) => (
                      <TableRow 
                        key={application.id} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleReviewApplication(application)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedApplications.has(application.id)}
                            onCheckedChange={(checked) => handleSelectApplication(application.id, !!checked)}
                            aria-label={`Select application for ${application.user?.firstName || ''} ${application.user?.lastName || ''}`}
                            data-testid={`checkbox-application-${application.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{application.user?.firstName || ''} {application.user?.lastName || ''}</p>
                            <p className="text-sm text-gray-500">{application.user?.email || 'Unknown'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{application.grant.title}</p>
                            <p className="text-sm text-gray-500">{formatAmount(application.grant.amount)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatAppliedDateTime(application.appliedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={
                              application.status === "Applied" ? "bg-green-500 text-white" :
                              application.status === "In Progress" ? "bg-blue-500 text-white" :
                              application.status === "Under Review" ? "bg-yellow-500 text-white" :
                              application.status === "Accepted" ? "bg-green-600 text-white" :
                              application.status === "Rejected" ? "bg-red-500 text-white" : ""
                            }
                          >
                            {application.status}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex space-x-2">
                            {application.status === "In Progress" ? (
                              // No buttons for "In Progress" status - user hasn't submitted yet
                              null
                            ) : application.status === "Accepted" ? (
                              // For Accepted: Show Review + Reject (allow reconsidering)
                              <>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReviewApplication(application);
                                  }}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                  data-testid={`button-review-${application.id}`}
                                >
                                  Review
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(application.id, "Rejected");
                                  }}
                                  variant="destructive"
                                  data-testid={`button-reject-${application.id}`}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : application.status === "Rejected" ? (
                              // For Rejected: Show Review + Accept (allow reconsidering)
                              <>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReviewApplication(application);
                                  }}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                  data-testid={`button-review-${application.id}`}
                                >
                                  Review
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(application.id, "Accepted");
                                  }}
                                  className="bg-green-500 hover:bg-green-600"
                                  data-testid={`button-accept-${application.id}`}
                                >
                                  Accept
                                </Button>
                              </>
                            ) : (application.status === "Applied" || application.status === "Under Review") ? (
                              // For Applied/Under Review: Show Review + Accept + Reject
                              <>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReviewApplication(application);
                                  }}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                  data-testid={`button-review-${application.id}`}
                                >
                                  Review
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(application.id, "Accepted");
                                  }}
                                  className="bg-green-500 hover:bg-green-600"
                                  data-testid={`button-accept-${application.id}`}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(application.id, "Rejected");
                                  }}
                                  variant="destructive"
                                  data-testid={`button-reject-${application.id}`}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {paginatedApplications.length === 0 && filteredApplications.length > 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No applications found on this page. Try changing filters or page.
                  </div>
                )}
                {filteredApplications.length === 0 && applications.length > 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No applications match your filters. Try clearing filters.
                  </div>
                )}
                {applications.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No applications received yet.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show</span>
                      <Select
                        value={recordsPerPage.toString()}
                        onValueChange={(value) => handleRecordsPerPageChange(parseInt(value))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-600">per page</span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Page info and navigation */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-700">
                          Page {currentPage} of {totalPages} ({totalRecords} total)
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          {getPageNumbers().map((pageNum) => (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className={currentPage === pageNum ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                            >
                              {pageNum}
                            </Button>
                          ))}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        )}

        {/* Form Templates Tab */}
        {activeTab === "forms" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Form Templates</h2>
                <p className="text-sm text-gray-500 mt-1">Create and manage custom grant application forms</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {filteredTemplates.length} of {formTemplates.length} templates
                </span>
                <Button 
                  onClick={() => setLocation('/company/form-builder/new')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  data-testid="button-create-form"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Form Template
                </Button>
              </div>
            </div>

            {/* Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name-filter">Template Name</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="template-name-filter"
                        placeholder="Search by template name"
                        value={templateNameFilter}
                        onChange={(e) => setTemplateNameFilter(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTemplateNameFilter("")}
                      disabled={templateNameFilter === ""}
                    >
                      Clear Filter
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Form Templates Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form Name</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formTemplatesLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          Loading form templates...
                        </TableCell>
                      </TableRow>
                    ) : filteredTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          {templateNameFilter ? "No templates match your search." : "No form templates created yet. Click \"Create Form Template\" to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTemplates.map((template: any) => (
                          <TableRow key={template.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <p className="font-medium text-gray-900" data-testid={`template-name-${template.id}`}>
                                  {template.name}
                                </p>
                                {template.description && (
                                  <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">
                                {new Date(template.updatedAt).toLocaleDateString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLocation(`/company/form-builder/edit/${template.id}`)}
                                  data-testid={`button-edit-template-${template.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTemplate(template)}
                                  className="text-red-600 hover:text-red-800"
                                  data-testid={`button-delete-template-${template.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Template Pagination */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={templatesPerPage.toString()}
                      onValueChange={(value) => handleTemplatesPerPageChange(parseInt(value))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-700">
                        Page {currentTemplatePage} of {Math.max(totalTemplatePages, 1)} ({totalTemplateRecords} total)
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTemplatePreviousPage}
                          disabled={currentTemplatePage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        
                        {getTemplatePageNumbers().map((pageNum) => (
                          <Button
                            key={pageNum}
                            variant={currentTemplatePage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleTemplatePageChange(pageNum)}
                            className={currentTemplatePage === pageNum ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                          >
                            {pageNum}
                          </Button>
                        ))}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTemplateNextPage}
                          disabled={currentTemplatePage === Math.max(totalTemplatePages, 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Application Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Application</DialogTitle>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-6">
                {/* Application Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Applicant</Label>
                      <p className="text-lg font-semibold">
                        {selectedApplication.user?.firstName || ''} {selectedApplication.user?.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-500">{selectedApplication.user?.email || ''}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Grant</Label>
                      <p className="text-lg font-semibold">{selectedApplication.grant.title}</p>
                      <p className="text-sm text-gray-500">{formatAmount(selectedApplication.grant.amount)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Applied Date</Label>
                      <p>{formatAppliedDateTime(selectedApplication.appliedAt)}</p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Current Status</Label>
                      <Badge 
                        variant="secondary"
                        className={
                          selectedApplication.status === "Applied" ? "bg-green-500 text-white" :
                          selectedApplication.status === "In Progress" ? "bg-blue-500 text-white" :
                          selectedApplication.status === "Under Review" ? "bg-yellow-500 text-white" :
                          selectedApplication.status === "Accepted" ? "bg-green-600 text-white" :
                          selectedApplication.status === "Rejected" ? "bg-red-500 text-white" : ""
                        }
                      >
                        {selectedApplication.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Application Answers */}
                {selectedApplication.answers && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600 mb-3 block">Application Responses</Label>
                    <Card>
                      <CardContent className="p-4">
                        {(() => {
                          try {
                            const answers = JSON.parse(selectedApplication.answers);
                            
                            // Sort fields by their order and display answers in that order
                            const sortedFields = [...reviewFormFields].sort((a: any, b: any) => a.order - b.order);
                            
                            return (
                              <div className="space-y-4">
                                {sortedFields.map((field: any) => {
                                  const fieldId = String(field.id);
                                  const answer = answers[fieldId];
                                  
                                  // Only display if there's an answer for this field
                                  if (answer !== undefined && answer !== null && answer !== '') {
                                    return (
                                      <div key={fieldId}>
                                        <Label className="text-sm font-medium">{field.label}</Label>
                                        <p className="mt-1 text-sm">{String(answer)}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            );
                          } catch (error) {
                            return <p className="text-sm text-gray-500">Unable to parse application responses</p>;
                          }
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Company Remarks */}
                <div>
                  <Label htmlFor="review-remarks" className="text-sm font-medium text-gray-600">Company Remarks</Label>
                  <Textarea
                    id="review-remarks"
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Add your remarks about this application..."
                    className="mt-2"
                    rows={4}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    onClick={() => handleSubmitReview("Under Review")}
                    disabled={updateApplicationStatusMutation.isPending}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {updateApplicationStatusMutation.isPending ? "Updating..." : "Mark Under Review"}
                  </Button>
                  <Button
                    onClick={() => handleSubmitReview("Rejected")}
                    disabled={updateApplicationStatusMutation.isPending}
                    variant="destructive"
                  >
                    {updateApplicationStatusMutation.isPending ? "Updating..." : "Reject"}
                  </Button>
                  <Button
                    onClick={() => handleSubmitReview("Accepted")}
                    disabled={updateApplicationStatusMutation.isPending}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {updateApplicationStatusMutation.isPending ? "Updating..." : "Accept"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Form Template Confirmation Dialog */}
        <Dialog open={isDeleteTemplateOpen} onOpenChange={setIsDeleteTemplateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Form Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete the form template "{templateToDelete?.name}"? 
                This action will permanently delete the template and all its fields. This cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteTemplateOpen(false)}
                  disabled={deleteFormTemplateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteTemplate}
                  disabled={deleteFormTemplateMutation.isPending}
                  data-testid="button-confirm-delete-template"
                >
                  {deleteFormTemplateMutation.isPending ? "Deleting..." : "Delete Template"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Form Template Dialog removed - now using dedicated form builder page */}
      </div>
    </div>
  );
}