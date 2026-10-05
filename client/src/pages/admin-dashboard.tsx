import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Edit2, Trash2, Building2, LogOut, LayoutGrid, FileText, Users, Calendar, Eye, EyeOff, Power, Filter, Search, ChevronDown, Check, Download, ArrowUp, ArrowDown, User2, PowerOff, ExternalLink, Link, Award, GripVertical, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { Company, Grant, UserGrantApplication, User } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { datetimeLocalToEST, toDatetimeLocalEST, formatDeadlineFull, formatAppliedDateTime } from "@/lib/timezone";

function SortableWriterRow({ writer, onEdit, onToggleActive, onDelete, togglePending }: {
  writer: any;
  onEdit: (w: any) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
  onDelete: (id: number, name: string) => void;
  togglePending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: writer.id });
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative", zIndex: isDragging ? 10 : "auto" } as React.CSSProperties}
    >
      <TableCell className="w-8 px-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {writer.photoUrl && (
            <img src={writer.photoUrl} alt={writer.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {writer.name}
        </div>
      </TableCell>
      <TableCell className="text-gray-500 text-sm">{writer.email}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {(writer.niches || []).slice(0, 2).map((n: string) => (
            <Badge key={n} className="bg-amber-100 text-amber-800 border border-amber-200 text-xs">{n}</Badge>
          ))}
          {(writer.niches || []).length > 2 && <Badge variant="secondary" className="text-xs">+{writer.niches.length - 2}</Badge>}
        </div>
      </TableCell>
      <TableCell>{writer.yearsExperience}y</TableCell>
      <TableCell>
        <Badge variant={writer.isActive ? "default" : "secondary"}>
          {writer.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          {writer.inquiryCount ?? 0}
        </span>
      </TableCell>
      <TableCell className="text-right space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onToggleActive(writer.id, writer.isActive)}
          title={writer.isActive ? "Deactivate" : "Activate"}
          disabled={togglePending}
          className={writer.isActive ? "text-amber-600 hover:text-amber-800" : "text-gray-400 hover:text-gray-600"}
        >
          {writer.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEdit(writer)} title="Edit">
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(writer.id, writer.name)}
          className="text-red-500 hover:text-red-700"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function WeeklyReport({ token }: { token: string | null }) {
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const isCustomRange = !!(dateFrom && dateTo);

  const queryParams = isCustomRange ? `?from=${dateFrom}&to=${dateTo}` : "";

  const { data: report, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/reports/weekly", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/weekly${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to fetch report");
      }
      return res.json();
    },
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const TrendBadge = ({ cur, prev }: { cur: number; prev: number }) => {
    const p = pct(cur, prev);
    if (p === null) return null;
    if (p > 0) return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-50 rounded px-1 ml-1">
        <TrendingUp className="w-3 h-3" /> +{p}%
      </span>
    );
    if (p < 0) return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 bg-red-50 rounded px-1 ml-1">
        <TrendingDown className="w-3 h-3" /> {p}%
      </span>
    );
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gray-500 bg-gray-100 rounded px-1 ml-1">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  };

  const exportCSV = () => {
    if (!report) return;
    const headers = ["Metric", report.currentWeekLabel, report.previousWeekLabel, report.mtdLabel, "Remarks"];
    const rows = report.rows.map((r: any) => [
      r.metric,
      r.currentWeek,
      r.previousWeek,
      r.mtd,
      r.remark,
    ]);
    const csv = [headers, ...rows].map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `grantfind_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportPDF = async () => {
    if (!report || !tableRef.current) return;
    setExportingPdf(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(tableRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("GrantFind Insights Report", margin, margin + 6);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, margin, margin + 12);
      pdf.setTextColor(0);
      const imgY = margin + 18;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const finalHeight = Math.min(imgHeight, pageHeight - imgY - margin);
      pdf.addImage(imgData, "PNG", margin, imgY, imgWidth, finalHeight);
      pdf.save(`grantfind_report_${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GrantFind Insights Report</h2>
          {report && (
            <>
              <p className="text-sm text-gray-500 mt-0.5">
                Generated {new Date(report.generatedAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              {report.paymentVerifiedAt && (
                <p className="text-xs font-medium text-green-700 mt-0.5">
                  Payment figures verified with Stripe at {new Date(report.paymentVerifiedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-gray-600 whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || todayStr}
              onChange={e => setDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-gray-600 whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={todayStr}
              onChange={e => setDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          {isCustomRange && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
            >
              Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report} className="gap-2">
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!report || exportingPdf} className="gap-2">
            <FileText className="w-4 h-4" />
            {exportingPdf ? "Generating…" : "PDF"}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-amber-600 font-medium">Loading report…</div>
      )}
      {(error || (!isLoading && !report)) && (
        <div className="flex items-center justify-center h-48 text-red-500">Failed to load report.</div>
      )}
      {!isLoading && report && (
        <div ref={tableRef} className="rounded-lg border border-amber-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#ffc107" }}>
                <th className="text-left px-4 py-3 font-bold text-gray-900 w-40">Metric</th>
                <th className="text-center px-4 py-3 font-bold text-gray-900 w-36">{report.currentWeekLabel}</th>
                <th className="text-center px-4 py-3 font-bold text-gray-900 w-36">{report.previousWeekLabel}</th>
                <th className="text-center px-4 py-3 font-bold text-gray-900 w-36">{report.mtdLabel}</th>
                <th className="text-left px-4 py-3 font-bold text-gray-900">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row: any, i: number) => (
                <tr key={row.metric} style={{ backgroundColor: i % 2 === 0 ? "#fffbeb" : "#ffffff" }} className="border-t border-amber-100">
                  <td className="px-4 py-3 font-medium text-gray-800 align-top">{row.metric}</td>
                  <td className="px-4 py-3 text-center align-top">
                    <span className="font-semibold text-gray-900">{row.currentWeek}</span>
                    <TrendBadge cur={row.currentWeekRaw} prev={row.previousWeekRaw} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 align-top">{row.previousWeek}</td>
                  <td className="px-4 py-3 text-center text-gray-600 align-top">{row.mtd}</td>
                  <td className="px-4 py-3 text-gray-600 leading-relaxed align-top text-xs">{row.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { admin, adminLogout } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    description: "",
    website: "",
  });

  // Grant management states
  const [isCreateGrantOpen, setIsCreateGrantOpen] = useState(false);
  const [isEditGrantOpen, setIsEditGrantOpen] = useState(false);
  const [isViewGrantOpen, setIsViewGrantOpen] = useState(false);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [grantSortColumn, setGrantSortColumn] = useState<string | null>(null);
  const [grantSortDirection, setGrantSortDirection] = useState<"asc" | "desc">("asc");
  const [grantForm, setGrantForm] = useState({
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
    companyId: "",
  });
  const [isCompanySearchOpen, setIsCompanySearchOpen] = useState(false);

  // Form template states
  const [selectedCompanyForTemplates, setSelectedCompanyForTemplates] = useState<number | null>(null);
  const [isViewTemplateOpen, setIsViewTemplateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // External grants states
  const [isExternalGrantDialogOpen, setIsExternalGrantDialogOpen] = useState(false);
  const [editingExternalGrant, setEditingExternalGrant] = useState<any | null>(null);
  const [externalGrantForm, setExternalGrantForm] = useState({
    name: "",
    url: "",
    amount: "",
    category: "",
    isActive: true,
  });

  // Application review states
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<(UserGrantApplication & { user: User; grant: Grant }) | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [applicationFormFields, setApplicationFormFields] = useState<any[]>([]);

  // Application filters
  const [applicationFilters, setApplicationFilters] = useState({
    applicant: "",
    grant: "",
    company: "",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
  });
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Pagination states for applications
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Pagination states for companies
  const [companyCurrentPage, setCompanyCurrentPage] = useState(1);
  const [companyItemsPerPage, setCompanyItemsPerPage] = useState(10);

  // Sorting states for companies
  const [companySortColumn, setCompanySortColumn] = useState<string | null>(null);
  const [companySortDirection, setCompanySortDirection] = useState<"asc" | "desc">("asc");

  // User management states
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userItemsPerPage, setUserItemsPerPage] = useState(50);
  const [userSortColumn, setUserSortColumn] = useState<string | null>("createdAt");
  const [userSortDirection, setUserSortDirection] = useState<"asc" | "desc">("desc");
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);
  const [showEditUserConfirmPassword, setShowEditUserConfirmPassword] = useState(false);

  // User filters
  const [userFilters, setUserFilters] = useState({
    search: "",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
  });
  const [isUserStatusDropdownOpen, setIsUserStatusDropdownOpen] = useState(false);

  // Grant filters
  const [grantFilters, setGrantFilters] = useState({
    search: "",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
  });
  const [isGrantStatusDropdownOpen, setIsGrantStatusDropdownOpen] = useState(false);

  // Company filters
  const [companyFilters, setCompanyFilters] = useState({
    name: "",
    email: "",
    phone: "",
    status: [] as string[],
    dateFrom: "",
    dateTo: "",
  });
  const [isCompanyStatusDropdownOpen, setIsCompanyStatusDropdownOpen] = useState(false);

  // Checkbox selection states
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isAllApplicationRecordsSelected, setIsAllApplicationRecordsSelected] = useState(false);
  const [isAllUserRecordsSelected, setIsAllUserRecordsSelected] = useState(false);

  // Password visibility states
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [isCopyingTrialLink, setIsCopyingTrialLink] = useState(false);

  const token = localStorage.getItem('adminToken');

  const handleCopyTrialLink = async () => {
    setIsCopyingTrialLink(true);
    try {
      const response = await fetch("/api/admin/stripe/labor-day-trial-link", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create the private trial link.");
      await navigator.clipboard.writeText(data.url);
      toast({
        title: "Private trial link copied",
        description: "Paste this unlisted link into your confirmation email.",
      });
    } catch (error: any) {
      toast({
        title: "Could not copy trial link",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCopyingTrialLink(false);
    }
  };

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: async () => {
      const response = await fetch('/api/admin/companies', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
  });

  // Sort companies alphabetically by name for grant creation dropdowns
  const alphabeticalCompanies = [...companies].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '')
  );

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const activeUsers30Days = users.filter((u: any) => {
    if (!u.lastLoginAt) return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(u.lastLoginAt) >= thirtyDaysAgo;
  }).length;

  // Fetch all grants (used for both overview and grants tab)
  const { data: allGrantsForOverview = [], isLoading: grantsLoading } = useQuery<Grant[]>({
    queryKey: ["/api/admin/grants"],
    queryFn: async () => {
      const response = await fetch('/api/admin/grants', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch all grants');
      return response.json();
    },
  });

  // Grant filtering logic
  const filteredGrants = allGrantsForOverview.filter(grant => {
    // Search filter - searches across title and company name
    if (grantFilters.search) {
      const searchLower = grantFilters.search.toLowerCase();
      const titleMatch = (grant.title ?? "").toLowerCase().includes(searchLower);
      const companyName = companies.find(c => c.id === grant.companyId)?.name ?? "";
      const companyMatch = companyName.toLowerCase().includes(searchLower);
      
      if (!titleMatch && !companyMatch) {
        return false;
      }
    }

    // Status filter
    if (grantFilters.status.length > 0) {
      const grantStatus = grant.status || "active";
      if (!grantFilters.status.includes(grantStatus)) {
        return false;
      }
    }

    // Date range filter (using deadline field)
    if (grantFilters.dateFrom && grant.deadline) {
      const grantDate = new Date(grant.deadline);
      const fromDate = new Date(grantFilters.dateFrom);
      if (grantDate < fromDate) {
        return false;
      }
    }

    if (grantFilters.dateTo && grant.deadline) {
      const grantDate = new Date(grant.deadline);
      const toDate = new Date(grantFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (grantDate > toDate) {
        return false;
      }
    }

    return true;
  });

  // Sort grants
  const sortedGrants = [...filteredGrants].sort((a, b) => {
    if (!grantSortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (grantSortColumn) {
      case "title":
        aValue = a.title?.toLowerCase() || "";
        bValue = b.title?.toLowerCase() || "";
        break;
      case "company":
        const companyA = companies.find(c => c.id === a.companyId);
        const companyB = companies.find(c => c.id === b.companyId);
        aValue = companyA?.name?.toLowerCase() || "";
        bValue = companyB?.name?.toLowerCase() || "";
        break;
      case "amount":
        aValue = a.amount || 0;
        bValue = b.amount || 0;
        break;
      case "deadline":
        aValue = a.deadline ? new Date(a.deadline).getTime() : 0;
        bValue = b.deadline ? new Date(b.deadline).getTime() : 0;
        break;
      case "status":
        aValue = a.status?.toLowerCase() || "";
        bValue = b.status?.toLowerCase() || "";
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return grantSortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return grantSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Fetch all form templates (used for both overview and form templates tab)
  const { data: allFormTemplates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/form-templates"],
    queryFn: async () => {
      const response = await fetch('/api/admin/form-templates', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch form templates');
      return response.json();
    },
  });

  // Filter form templates by company for the templates tab
  const displayedFormTemplates = selectedCompanyForTemplates 
    ? allFormTemplates.filter(template => template.companyId === selectedCompanyForTemplates)
    : allFormTemplates;

  // Grant writer management states
  const [grantWriterForm, setGrantWriterForm] = useState({
    name: "", bio: "", email: "", photoUrl: "", websiteUrl: "", linkedinUrl: "",
    niches: "", specialties: "", yearsExperience: "", isActive: true, sortOrder: "0",
  });
  const [isGrantWriterDialogOpen, setIsGrantWriterDialogOpen] = useState(false);
  const [editingGrantWriter, setEditingGrantWriter] = useState<any>(null);
  const [sortedWriterIds, setSortedWriterIds] = useState<number[]>([]);

  const { data: adminGrantWriters = [], isLoading: grantWritersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/grant-writers"],
    queryFn: async () => {
      const response = await fetch('/api/admin/grant-writers', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch grant writers');
      return response.json();
    },
  });

  useEffect(() => {
    if (adminGrantWriters.length > 0) {
      setSortedWriterIds(
        [...adminGrantWriters].sort((a, b) => a.sortOrder - b.sortOrder).map((w) => w.id)
      );
    }
  }, [adminGrantWriters]);

  const writerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleWriterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSortedWriterIds((prev) => {
      const oldIndex = prev.indexOf(active.id as number);
      const newIndex = prev.indexOf(over.id as number);
      const newOrder = arrayMove(prev, oldIndex, newIndex);
      newOrder.forEach((id, idx) => {
        const writer = adminGrantWriters.find((w) => w.id === id);
        if (writer && writer.sortOrder !== idx) {
          updateGrantWriterMutation.mutate({ id: id as number, updates: { sortOrder: idx } });
        }
      });
      return newOrder;
    });
  };
  const [inquiryWriterFilter, setInquiryWriterFilter] = useState<string>("all");
  const [seenInquiryCount, setSeenInquiryCount] = useState<number>(() =>
    parseInt(localStorage.getItem("admin_inquiries_seen_count") || "0", 10)
  );
  const [seenApplicationCount, setSeenApplicationCount] = useState<number>(() =>
    parseInt(localStorage.getItem("admin_applications_seen_count") || "0", 10)
  );
  const [replyInquiry, setReplyInquiry] = useState<any | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const replyInquiryMutation = useMutation({
    mutationFn: async ({ id, subject, body }: { id: number; subject: string; body: string }) => {
      const response = await fetch(`/api/admin/inquiries/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ subject, body }),
      });
      if (!response.ok) throw new Error("Failed to send reply");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grant-writer-inquiries"] });
      setReplyInquiry(null);
      setReplySubject("");
      setReplyBody("");
      toast({ title: "Reply sent", description: "Your reply has been sent to the inquirer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reply. Please try again.", variant: "destructive" });
    },
  });

  const { data: grantWriterInquiries = [], isLoading: inquiriesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/grant-writer-inquiries"],
    queryFn: async () => {
      const response = await fetch('/api/admin/grant-writer-inquiries', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch inquiries');
      return response.json();
    },
  });

  const filteredInquiries = inquiryWriterFilter === "all"
    ? grantWriterInquiries
    : grantWriterInquiries.filter((i: any) => String(i.writerId) === inquiryWriterFilter);

  const unseenInquiryCount = Math.max(0, grantWriterInquiries.length - seenInquiryCount);

  useEffect(() => {
    if (activeTab === "grant-writers" && grantWriterInquiries.length > seenInquiryCount) {
      const count = grantWriterInquiries.length;
      setSeenInquiryCount(count);
      localStorage.setItem("admin_inquiries_seen_count", String(count));
    }
  }, [activeTab, grantWriterInquiries.length]);

  const createGrantWriterMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/grant-writers', {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.message || "Failed to create grant writer"); }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grant-writers"] });
      setIsGrantWriterDialogOpen(false);
      setGrantWriterForm({ name: "", bio: "", email: "", photoUrl: "", websiteUrl: "", linkedinUrl: "", niches: "", specialties: "", yearsExperience: "", isActive: true, sortOrder: "0" });
      toast({ title: "Success", description: "Grant writer created successfully" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to create grant writer", variant: "destructive" }); },
  });

  const updateGrantWriterMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      const response = await fetch(`/api/admin/grant-writers/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.message || "Failed to update grant writer"); }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grant-writers"] });
      setIsGrantWriterDialogOpen(false);
      setEditingGrantWriter(null);
      setGrantWriterForm({ name: "", bio: "", email: "", photoUrl: "", websiteUrl: "", linkedinUrl: "", niches: "", specialties: "", yearsExperience: "", isActive: true, sortOrder: "0" });
      toast({ title: "Success", description: "Grant writer updated successfully" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to update grant writer", variant: "destructive" }); },
  });

  const deleteGrantWriterMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/grant-writers/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.message || "Failed to delete grant writer"); }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grant-writers"] });
      toast({ title: "Success", description: "Grant writer deleted successfully" });
    },
    onError: (error: any) => { toast({ title: "Error", description: error.message || "Failed to delete grant writer", variant: "destructive" }); },
  });

  const handleOpenGrantWriterDialog = (writer?: any) => {
    if (writer) {
      setEditingGrantWriter(writer);
      setGrantWriterForm({
        name: writer.name, bio: writer.bio, email: writer.email,
        photoUrl: writer.photoUrl || "", websiteUrl: writer.websiteUrl || "", linkedinUrl: writer.linkedinUrl || "",
        niches: (writer.niches || []).join(", "), specialties: (writer.specialties || []).join(", "),
        yearsExperience: writer.yearsExperience?.toString() || "0",
        isActive: writer.isActive, sortOrder: writer.sortOrder?.toString() || "0",
      });
    } else {
      setEditingGrantWriter(null);
      setGrantWriterForm({ name: "", bio: "", email: "", photoUrl: "", websiteUrl: "", linkedinUrl: "", niches: "", specialties: "", yearsExperience: "", isActive: true, sortOrder: "0" });
    }
    setIsGrantWriterDialogOpen(true);
  };

  const handleSaveGrantWriter = () => {
    const payload = {
      name: grantWriterForm.name,
      bio: grantWriterForm.bio,
      email: grantWriterForm.email,
      photoUrl: grantWriterForm.photoUrl || null,
      websiteUrl: grantWriterForm.websiteUrl || null,
      linkedinUrl: grantWriterForm.linkedinUrl || null,
      niches: grantWriterForm.niches.split(",").map(s => s.trim()).filter(Boolean),
      specialties: grantWriterForm.specialties.split(",").map(s => s.trim()).filter(Boolean),
      yearsExperience: parseInt(grantWriterForm.yearsExperience) || 0,
      isActive: grantWriterForm.isActive,
      sortOrder: parseInt(grantWriterForm.sortOrder) || 0,
    };
    if (editingGrantWriter) {
      updateGrantWriterMutation.mutate({ id: editingGrantWriter.id, updates: payload });
    } else {
      createGrantWriterMutation.mutate(payload);
    }
  };

  // Fetch external grants
  const { data: externalGrants = [], isLoading: externalGrantsLoading, refetch: refetchExternalGrants } = useQuery<any[]>({
    queryKey: ["/api/admin/external-grants"],
    queryFn: async () => {
      const response = await fetch('/api/admin/external-grants', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch external grants');
      return response.json();
    },
  });

  const { data: allApplications = [], isLoading: applicationsLoading } = useQuery<(UserGrantApplication & { user: User; grant: Grant })[]>({
    queryKey: ["/api/admin/applications"],
    queryFn: async () => {
      const response = await fetch('/api/admin/applications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
  });

  const unseenApplicationCount = Math.max(0, allApplications.length - seenApplicationCount);

  useEffect(() => {
    if (activeTab === "applications" && allApplications.length > seenApplicationCount) {
      const count = allApplications.length;
      setSeenApplicationCount(count);
      localStorage.setItem("admin_applications_seen_count", String(count));
    }
  }, [activeTab, allApplications.length, seenApplicationCount]);

  // Fetch form fields when review dialog opens with a grant that has a form template
  useEffect(() => {
    let isCancelled = false;

    const fetchFormFields = async () => {
      if (isReviewDialogOpen && selectedApplication?.grant?.formTemplateId) {
        try {
          const response = await fetch(`/api/form-templates/${selectedApplication.grant.formTemplateId}/fields`);
          if (response.ok && !isCancelled) {
            const fields = await response.json();
            setApplicationFormFields(fields);
          } else if (!isCancelled) {
            setApplicationFormFields([]);
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error fetching form fields:", error);
            setApplicationFormFields([]);
          }
        }
      }
    };

    fetchFormFields();

    return () => {
      isCancelled = true;
    };
  }, [isReviewDialogOpen, selectedApplication?.id, selectedApplication?.grant?.formTemplateId]);

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: Omit<typeof companyForm, 'confirmPassword'>) => {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(companyData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create company");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setIsCreateCompanyOpen(false);
      setCompanyForm({ name: "", email: "", password: "", confirmPassword: "", description: "", website: "" });
      toast({ title: "Success", description: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create company", variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ companyId, companyData }: { companyId: number; companyData: Partial<typeof companyForm> }) => {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(companyData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update company");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setIsEditCompanyOpen(false);
      setSelectedCompany(null);
      toast({ title: "Success", description: "Company updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update company", variant: "destructive" });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete company");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Success", description: "Company deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete company", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: number; userData: typeof userForm }) => {
      const response = await fetch(`/api/admin/users/${data.userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data.userData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditUserOpen(false);
      setSelectedUser(null);
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle user status");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to toggle user status", variant: "destructive" });
    },
  });

  const createGrantMutation = useMutation({
    mutationFn: async (data: { companyId: number; grantData: any }) => {
      const response = await fetch(`/api/admin/companies/${data.companyId}/grants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data.grantData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grants"] });
      setIsCreateGrantOpen(false);
      setGrantForm({
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
        companyId: "",
      });
      toast({ title: "Success", description: "Grant created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create grant", variant: "destructive" });
    },
  });

  const deleteGrantMutation = useMutation({
    mutationFn: async (grantId: number) => {
      const response = await fetch(`/api/admin/grants/${grantId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grants"] });
      toast({ title: "Success", description: "Grant deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete grant", variant: "destructive" });
    },
  });

  const toggleGrantStatusMutation = useMutation({
    mutationFn: async (grantId: number) => {
      const response = await fetch(`/api/admin/grants/${grantId}/status`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle grant status");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/admin/grants"] });
      toast({ title: "Success", description: "Grant status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to toggle grant status", variant: "destructive" });
    },
  });

  const updateGrantMutation = useMutation({
    mutationFn: async (data: { grantId: number; grantData: any }) => {
      const response = await fetch(`/api/admin/grants/${data.grantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data.grantData,
          amount: parseInt(data.grantData.amount),
          tags: data.grantData.tags ? data.grantData.tags.split(",").map((tag: string) => tag.trim()) : [],
          formTemplateId: data.grantData.formTemplateId ? parseInt(data.grantData.formTemplateId) : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grants"] });
      setIsEditGrantOpen(false);
      setSelectedGrant(null);
      toast({ title: "Success", description: "Grant updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update grant", variant: "destructive" });
    },
  });

  // Form template creation now handled by dedicated Form Builder page

  // External grants mutations
  const createExternalGrantMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; category?: string; isActive?: boolean }) => {
      const response = await fetch('/api/admin/external-grants', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create external grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-grants"] });
      setIsExternalGrantDialogOpen(false);
      setExternalGrantForm({ name: "", url: "", amount: "", category: "", isActive: true });
      toast({ title: "Success", description: "External grant created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create external grant", variant: "destructive" });
    },
  });

  const updateExternalGrantMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      const response = await fetch(`/api/admin/external-grants/${data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update external grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-grants"] });
      setIsExternalGrantDialogOpen(false);
      setEditingExternalGrant(null);
      setExternalGrantForm({ name: "", url: "", amount: "", category: "", isActive: true });
      toast({ title: "Success", description: "External grant updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update external grant", variant: "destructive" });
    },
  });

  const deleteExternalGrantMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/external-grants/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete external grant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/external-grants"] });
      toast({ title: "Success", description: "External grant deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete external grant", variant: "destructive" });
    },
  });

  const handleOpenExternalGrantDialog = (grant?: any) => {
    if (grant) {
      setEditingExternalGrant(grant);
      setExternalGrantForm({
        name: grant.name,
        url: grant.url,
        amount: grant.amount?.toString() || "",
        category: grant.category || "",
        isActive: grant.isActive,
      });
    } else {
      setEditingExternalGrant(null);
      setExternalGrantForm({ name: "", url: "", amount: "", category: "", isActive: true });
    }
    setIsExternalGrantDialogOpen(true);
  };

  const handleSaveExternalGrant = () => {
    const parsedAmount = externalGrantForm.amount !== "" ? parseInt(externalGrantForm.amount) : null;
    const payload: any = {
      name: externalGrantForm.name,
      url: externalGrantForm.url,
      isActive: externalGrantForm.isActive,
      amount: !isNaN(parsedAmount as number) ? parsedAmount : null,
      category: externalGrantForm.category || null,
    };
    if (editingExternalGrant) {
      updateExternalGrantMutation.mutate({
        id: editingExternalGrant.id,
        updates: payload,
      });
    } else {
      createExternalGrantMutation.mutate(payload);
    }
  };

  const updateApplicationStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status, remarks }: { applicationId: number; status: string; remarks?: string }) => {
      const response = await fetch(`/api/admin/applications/${applicationId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ status, remarks }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update application status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      setIsReviewDialogOpen(false);
      setSelectedApplication(null);
      setReviewRemarks("");
      toast({ title: "Success", description: "Application status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update application status", variant: "destructive" });
    },
  });

  const handleLogout = () => {
    adminLogout();
    setLocation("/admin");
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setCompanyForm({
      name: company.name,
      email: company.email,
      password: "",
      confirmPassword: "",
      description: company.description || "",
      website: company.website || "",
    });
    setIsEditCompanyOpen(true);
  };

  const handleDeleteCompany = (companyId: number) => {
    if (confirm("Are you sure you want to delete this company? This will also delete all associated grants and applications.")) {
      deleteCompanyMutation.mutate(companyId);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email,
      phone: user.phone || "",
      password: "",
      confirmPassword: "",
    });
    setIsEditUserOpen(true);
  };

  const handleDeleteGrant = (grantId: number) => {
    if (confirm("Are you sure you want to delete this grant?")) {
      deleteGrantMutation.mutate(grantId);
    }
  };

  const handleViewGrant = (grant: Grant) => {
    setSelectedGrant(grant);
    setIsViewGrantOpen(true);
  };

  const handleEditGrant = (grant: Grant) => {
    setSelectedGrant(grant);
    setGrantForm({
      title: grant.title,
      amount: grant.amount?.toString() || "",
      deadline: grant.deadline ? toDatetimeLocalEST(grant.deadline) : "",
      timezone: grant.timezone || "America/New_York",
      category: grant.category || "",
      description: grant.description || "",
      requirements: grant.requirements || "",
      tags: grant.tags?.join(", ") || "",
      imageUrl: grant.imageUrl || "",
      formTemplateId: grant.formTemplateId?.toString() || "",
      companyId: grant.companyId?.toString() || "",
    });
    setIsEditGrantOpen(true);
  };


  const handleViewTemplate = (template: any) => {
    setSelectedTemplate(template);
    setIsViewTemplateOpen(true);
  };

  const handleReviewApplication = (application: UserGrantApplication & { user: User; grant: Grant }) => {
    setSelectedApplication(application);
    setReviewRemarks(application.remarks || "");
    setApplicationFormFields([]); // Reset fields immediately
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

  const handleQuickStatusUpdate = (applicationId: number, status: string) => {
    updateApplicationStatusMutation.mutate({
      applicationId,
      status,
      remarks: ""
    });
  };

  // Filter applications
  const filteredApplications = allApplications.filter(application => {
    // Exclude "In Progress" applications (not submitted yet)
    if (application.status === "In Progress") {
      return false;
    }

    // Filter by applicant name or email
    if (applicationFilters.applicant) {
      const applicantSearch = applicationFilters.applicant.toLowerCase();
      const fullName = application.user 
        ? `${application.user.firstName || ''} ${application.user.lastName || ''}`.toLowerCase()
        : '';
      const email = application.user ? (application.user.email || '').toLowerCase() : '';
      if (!fullName.includes(applicantSearch) && !email.includes(applicantSearch)) {
        return false;
      }
    }

    // Filter by grant title
    if (applicationFilters.grant) {
      const grantTitle = application.grant ? (application.grant.title || '').toLowerCase() : '';
      if (!grantTitle.includes(applicationFilters.grant.toLowerCase())) {
        return false;
      }
    }

    // Filter by company name
    if (applicationFilters.company) {
      const companySearch = applicationFilters.company.toLowerCase();
      const company = companies.find(c => c.id === application.grant?.companyId);
      const companyName = company ? (company.name || '').toLowerCase() : '';
      // Filter out if company doesn't match search term
      // If no company record found, exclude the application from filtered results
      if (!companyName.includes(companySearch)) {
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
      if (!application.appliedAt) {
        return false; // Exclude applications without dates when date filter is active
      }
      const appliedDate = new Date(application.appliedAt);
      const fromDate = new Date(applicationFilters.dateFrom);
      if (appliedDate < fromDate) {
        return false;
      }
    }

    if (applicationFilters.dateTo) {
      if (!application.appliedAt) {
        return false; // Exclude applications without dates when date filter is active
      }
      const appliedDate = new Date(application.appliedAt);
      const toDate = new Date(applicationFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (appliedDate > toDate) {
        return false;
      }
    }

    return true;
  });

  // Helper functions for filters
  const statusOptions = [
    { value: "In Progress", label: "In Progress" },
    { value: "Applied", label: "Applied" },
    { value: "Under Review", label: "Under Review" },
    { value: "Accepted", label: "Accepted" },
    { value: "Rejected", label: "Rejected" },
  ];

  const handleStatusChange = (status: string) => {
    setApplicationFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
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

  const clearFilters = () => {
    setApplicationFilters({
      applicant: "",
      grant: "",
      company: "",
      status: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  // Helper functions for user filters
  const userStatusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  const handleUserStatusChange = (status: string) => {
    setUserFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const getUserStatusDisplayText = () => {
    if (userFilters.status.length === 0) {
      return "All Statuses";
    } else if (userFilters.status.length === 1) {
      return userFilters.status[0] === "active" ? "Active" : "Inactive";
    } else {
      return `${userFilters.status.length} statuses selected`;
    }
  };

  const clearUserFilters = () => {
    setUserFilters({
      search: "",
      status: [],
      dateFrom: "",
      dateTo: "",
    });
    setUserCurrentPage(1);
  };

  // Helper functions for company filters
  const companyStatusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  const handleCompanyStatusChange = (status: string) => {
    setCompanyFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const getCompanyStatusDisplayText = () => {
    if (companyFilters.status.length === 0) {
      return "All Statuses";
    } else if (companyFilters.status.length === 1) {
      return companyFilters.status[0] === "active" ? "Active" : "Inactive";
    } else {
      return `${companyFilters.status.length} statuses selected`;
    }
  };

  const clearCompanyFilters = () => {
    setCompanyFilters({
      name: "",
      email: "",
      phone: "",
      status: [],
      dateFrom: "",
      dateTo: "",
    });
    setCompanyCurrentPage(1);
  };

  const getGrantStatusDisplayText = () => {
    if (grantFilters.status.length === 0) {
      return "All Statuses";
    } else if (grantFilters.status.length === 1) {
      return grantFilters.status[0] === "active" ? "Active" : "Inactive";
    } else {
      return `${grantFilters.status.length} statuses selected`;
    }
  };

  const clearGrantFilters = () => {
    setGrantFilters({
      search: "",
      status: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  const toggleGrantStatus = (status: string) => {
    setGrantFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [applicationFilters]);

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userFilters]);

  useEffect(() => {
    // Grant filters don't affect pagination yet as grants tab doesn't have pagination
    // This is here for consistency and future-proofing
  }, [grantFilters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApplications = filteredApplications.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Checkbox selection handlers
  const handleSelectApplication = (applicationId: number) => {
    setSelectedApplicationIds(prev => 
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedApplicationIds.length === paginatedApplications.length) {
      // Deselect all on current page
      const currentPageIds = paginatedApplications.map(app => app.id);
      setSelectedApplicationIds(prev => prev.filter(id => !currentPageIds.includes(id)));
      setIsAllApplicationRecordsSelected(false);
    } else {
      // Select all on current page
      const currentPageIds = paginatedApplications.map(app => app.id);
      setSelectedApplicationIds(prev => {
        const newIds = [...prev];
        currentPageIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const isAllSelected = paginatedApplications.length > 0 && 
    paginatedApplications.every(app => selectedApplicationIds.includes(app.id));

  const selectAllApplicationRecords = () => {
    const allFilteredIds = filteredApplications.map(app => app.id);
    setSelectedApplicationIds(allFilteredIds);
    setIsAllApplicationRecordsSelected(true);
  };

  const clearAllApplicationSelections = () => {
    setSelectedApplicationIds([]);
    setIsAllApplicationRecordsSelected(false);
  };

  // Company filtering logic
  const filteredCompanies = companies.filter(company => {
    // Name filter
    if (companyFilters.name) {
      const nameLower = companyFilters.name.toLowerCase();
      const companyName = (company.name ?? "").toLowerCase();
      if (!companyName.includes(nameLower)) {
        return false;
      }
    }

    // Email filter
    if (companyFilters.email) {
      const emailLower = companyFilters.email.toLowerCase();
      const companyEmail = (company.email ?? "").toLowerCase();
      if (!companyEmail.includes(emailLower)) {
        return false;
      }
    }

    // Phone filter
    if (companyFilters.phone) {
      const phoneLower = companyFilters.phone.toLowerCase();
      const companyPhone = (company.phone ?? "").toLowerCase();
      if (!companyPhone.includes(phoneLower)) {
        return false;
      }
    }

    // Status filter
    if (companyFilters.status.length > 0) {
      const companyStatus = company.status || "active";
      if (!companyFilters.status.includes(companyStatus)) {
        return false;
      }
    }

    // Date range filter (using createdAt field)
    if (companyFilters.dateFrom && company.createdAt) {
      const companyDate = new Date(company.createdAt);
      const fromDate = new Date(companyFilters.dateFrom);
      if (companyDate < fromDate) {
        return false;
      }
    }

    if (companyFilters.dateTo && company.createdAt) {
      const companyDate = new Date(company.createdAt);
      const toDate = new Date(companyFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (companyDate > toDate) {
        return false;
      }
    }

    return true;
  });

  // Company sorting and pagination calculations
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    if (!companySortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (companySortColumn) {
      case "name":
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
        break;
      case "email":
        aValue = a.email?.toLowerCase() || "";
        bValue = b.email?.toLowerCase() || "";
        break;
      case "website":
        aValue = a.website?.toLowerCase() || "";
        bValue = b.website?.toLowerCase() || "";
        break;
      case "description":
        aValue = a.description?.toLowerCase() || "";
        bValue = b.description?.toLowerCase() || "";
        break;
      case "createdAt":
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return companySortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return companySortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const companyTotalPages = Math.ceil(sortedCompanies.length / companyItemsPerPage);
  const companyStartIndex = (companyCurrentPage - 1) * companyItemsPerPage;
  const companyEndIndex = companyStartIndex + companyItemsPerPage;
  const paginatedCompanies = sortedCompanies.slice(companyStartIndex, companyEndIndex);

  // User filtering logic
  const filteredUsers = users.filter(user => {
    // Search filter - searches across firstName, lastName, email, phone
    if (userFilters.search) {
      const searchLower = userFilters.search.toLowerCase();
      const firstNameMatch = (user.firstName ?? "").toLowerCase().includes(searchLower);
      const lastNameMatch = (user.lastName ?? "").toLowerCase().includes(searchLower);
      const emailMatch = (user.email ?? "").toLowerCase().includes(searchLower);
      const phoneMatch = (user.phone ?? "").toLowerCase().includes(searchLower);
      
      if (!firstNameMatch && !lastNameMatch && !emailMatch && !phoneMatch) {
        return false;
      }
    }

    // Status filter
    if (userFilters.status.length > 0) {
      const userStatus = user.status || "active";
      if (!userFilters.status.includes(userStatus)) {
        return false;
      }
    }

    // Date range filter
    if (userFilters.dateFrom && user.createdAt) {
      const userDate = new Date(user.createdAt);
      const fromDate = new Date(userFilters.dateFrom);
      if (userDate < fromDate) {
        return false;
      }
    }

    if (userFilters.dateTo && user.createdAt) {
      const userDate = new Date(user.createdAt);
      const toDate = new Date(userFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (userDate > toDate) {
        return false;
      }
    }

    return true;
  });

  // User sorting and pagination logic
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!userSortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (userSortColumn) {
      case "firstName":
        aValue = a.firstName?.toLowerCase() || "";
        bValue = b.firstName?.toLowerCase() || "";
        break;
      case "lastName":
        aValue = a.lastName?.toLowerCase() || "";
        bValue = b.lastName?.toLowerCase() || "";
        break;
      case "email":
        aValue = a.email?.toLowerCase() || "";
        bValue = b.email?.toLowerCase() || "";
        break;
      case "phone":
        aValue = a.phone?.toLowerCase() || "";
        bValue = b.phone?.toLowerCase() || "";
        break;
      case "createdAt":
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return userSortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return userSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const userTotalPages = Math.ceil(filteredUsers.length / userItemsPerPage);
  const userStartIndex = (userCurrentPage - 1) * userItemsPerPage;
  const userEndIndex = userStartIndex + userItemsPerPage;
  const paginatedUsers = sortedUsers.slice(userStartIndex, userEndIndex);

  // User selection handlers
  const handleSelectUser = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const isAllUsersSelected = paginatedUsers.length > 0 && 
    paginatedUsers.every(user => selectedUserIds.includes(user.id));

  const handleSelectAllUsers = () => {
    if (isAllUsersSelected) {
      // Deselect all on current page
      const currentPageIds = paginatedUsers.map(user => user.id);
      setSelectedUserIds(prev => prev.filter(id => !currentPageIds.includes(id)));
      setIsAllUserRecordsSelected(false);
    } else {
      // Select all on current page
      const currentPageIds = paginatedUsers.map(user => user.id);
      setSelectedUserIds(prev => {
        const newIds = [...prev];
        currentPageIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const selectAllUserRecords = () => {
    const allFilteredIds = filteredUsers.map(user => user.id);
    setSelectedUserIds(allFilteredIds);
    setIsAllUserRecordsSelected(true);
  };

  const clearAllUserSelections = () => {
    setSelectedUserIds([]);
    setIsAllUserRecordsSelected(false);
  };

  // Company pagination handlers
  const handleCompanyPageChange = (page: number) => {
    setCompanyCurrentPage(page);
  };

  const handleCompanyItemsPerPageChange = (value: string) => {
    setCompanyItemsPerPage(Number(value));
    setCompanyCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleCompanyPreviousPage = () => {
    if (companyCurrentPage > 1) setCompanyCurrentPage(companyCurrentPage - 1);
  };

  const handleCompanyNextPage = () => {
    if (companyCurrentPage < companyTotalPages) setCompanyCurrentPage(companyCurrentPage + 1);
  };

  // Company sorting handler
  const handleCompanySort = (column: string) => {
    if (companySortColumn === column) {
      // Toggle direction if same column
      setCompanySortDirection(companySortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setCompanySortColumn(column);
      setCompanySortDirection("asc");
    }
  };

  // Grant sorting handler
  const handleGrantSort = (column: string) => {
    if (grantSortColumn === column) {
      setGrantSortDirection(grantSortDirection === "asc" ? "desc" : "asc");
    } else {
      setGrantSortColumn(column);
      setGrantSortDirection("asc");
    }
  };

  // User pagination handlers
  const handleUserPageChange = (page: number) => {
    setUserCurrentPage(page);
  };

  const handleUserItemsPerPageChange = (value: string) => {
    setUserItemsPerPage(Number(value));
    setUserCurrentPage(1);
  };

  const handleUserPreviousPage = () => {
    if (userCurrentPage > 1) setUserCurrentPage(userCurrentPage - 1);
  };

  const handleUserNextPage = () => {
    if (userCurrentPage < userTotalPages) setUserCurrentPage(userCurrentPage + 1);
  };

  // User sorting handler
  const handleUserSort = (column: string) => {
    if (userSortColumn === column) {
      setUserSortDirection(userSortDirection === "asc" ? "desc" : "asc");
    } else {
      setUserSortColumn(column);
      setUserSortDirection("asc");
    }
  };

  // CSV Export function
  const exportToCSV = () => {
    if (selectedApplicationIds.length === 0) {
      toast({
        title: "No applications selected",
        description: "Please select at least one application to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedApplications = filteredApplications.filter(app => 
      selectedApplicationIds.includes(app.id)
    );

    const headers = ['Applicant Name', 'Email', 'Grant Title', 'Company', 'Amount', 'Status', 'Applied Date'];
    const csvData = selectedApplications.map(app => [
      `${app.user?.firstName || ''} ${app.user?.lastName || ''}`.trim(),
      app.user?.email || '',
      app.grant?.title || '',
      app.grant?.company || '',
      app.grant?.amount || '',
      app.status,
      app.appliedAt ? format(new Date(app.appliedAt), 'MM/dd/yyyy') : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `applications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Users CSV Export function
  const exportUsersToCSV = () => {
    if (selectedUserIds.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select at least one user to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedUsers = filteredUsers.filter(user => 
      selectedUserIds.includes(user.id)
    );

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Created Date', 'Status', 'Last Seen', 'Subscription'];
    const csvData = selectedUsers.map(user => [
      user.firstName || '',
      user.lastName || '',
      user.email || '',
      user.phone || '',
      user.createdAt ? formatDeadlineFull(user.createdAt) : '',
      user.status || 'active',
      (user as any).lastLoginAt ? new Date((user as any).lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'Never',
      (user as any).subscriptionTier || 'free'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate overview statistics  
  const totalGrants = allGrantsForOverview.length;
  const totalApplications = allApplications.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-amber-600" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Logged in as: {admin?.username}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCopyTrialLink}
                variant="outline"
                className="gap-2"
                disabled={isCopyingTrialLink}
              >
                <Link className="w-4 h-4" />
                {isCopyingTrialLink ? "Creating…" : "Copy Private Trial Link"}
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="gap-2"
                data-testid="button-admin-logout"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 bg-white dark:bg-gray-900">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2">
              <Users className="w-4 h-4" />
              Applications
              {unseenApplicationCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none w-4 h-4 min-w-[1rem]">
                  {unseenApplicationCount > 99 ? "99+" : unseenApplicationCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <User2 className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="grants" className="gap-2">
              <FileText className="w-4 h-4" />
              Grants
            </TabsTrigger>
            <TabsTrigger value="external-grants" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              External Grants
            </TabsTrigger>
            <TabsTrigger value="grant-writers" className="gap-2">
              <Award className="w-4 h-4" />
              Writers
              {unseenInquiryCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none w-4 h-4 min-w-[1rem]">
                  {unseenInquiryCount > 99 ? "99+" : unseenInquiryCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Calendar className="w-4 h-4" />
              Form Templates
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Companies</CardDescription>
                  <CardTitle className="text-4xl text-amber-600">{companies.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Grants</CardDescription>
                  <CardTitle className="text-4xl text-amber-600">{totalGrants}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Applications</CardDescription>
                  <CardTitle className="text-4xl text-amber-600">{totalApplications}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Users (30 days)</CardDescription>
                  <CardTitle className="text-4xl text-amber-600">{activeUsers30Days}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Platform Status</CardDescription>
                  <CardTitle className="text-xl text-green-600">Active</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Recent Applications Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-2xl">Recent Applications</CardTitle>
                <CardDescription>Latest applications to your grants</CardDescription>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="text-center py-8">Loading applications...</div>
                ) : allApplications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No applications yet
                  </div>
                ) : (
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
                      {allApplications
                        .filter((app) => app.grant && app.user)
                        .sort((a, b) => {
                          const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
                          const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
                          return dateB - dateA;
                        })
                        .slice(0, 5)
                        .map((application) => (
                          <TableRow key={application.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{application.user?.firstName} {application.user?.lastName}</div>
                                <div className="text-sm text-gray-500">{application.user?.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{application.grant?.title || 'Deleted Grant'}</div>
                                <div className="text-sm text-gray-500">${application.grant?.amount?.toLocaleString() || 'N/A'}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {application.appliedAt ? format(new Date(application.appliedAt), 'M/d/yyyy') : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={application.status === 'applied' ? 'default' : application.status === 'in_progress' ? 'secondary' : 'outline'}
                                className={
                                  application.status === 'applied' 
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : application.status === 'in_progress'
                                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : ''
                                }
                              >
                                {application.status === 'applied' ? 'Applied' : application.status === 'in_progress' ? 'In Progress' : application.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies">
            {/* Filter Section */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter Companies
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {filteredCompanies.length} of {companies.length} companies
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearCompanyFilters}
                      disabled={!companyFilters.name && !companyFilters.email && !companyFilters.phone && companyFilters.status.length === 0 && !companyFilters.dateFrom && !companyFilters.dateTo}
                      data-testid="button-clear-company-filters"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Name Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-name-filter">Name</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="company-name-filter"
                        placeholder="Company name"
                        value={companyFilters.name}
                        onChange={(e) => setCompanyFilters(prev => ({ ...prev, name: e.target.value }))}
                        className="pl-10"
                        data-testid="input-company-name-filter"
                      />
                    </div>
                  </div>

                  {/* Email Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-email-filter">Email</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="company-email-filter"
                        placeholder="Company email"
                        value={companyFilters.email}
                        onChange={(e) => setCompanyFilters(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        data-testid="input-company-email-filter"
                      />
                    </div>
                  </div>

                  {/* Phone Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-phone-filter">Phone</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="company-phone-filter"
                        placeholder="Company phone"
                        value={companyFilters.phone}
                        onChange={(e) => setCompanyFilters(prev => ({ ...prev, phone: e.target.value }))}
                        className="pl-10"
                        data-testid="input-company-phone-filter"
                      />
                    </div>
                  </div>

                  {/* Status Filter - Multi-Select */}
                  <div className="space-y-2">
                    <Label htmlFor="company-status-filter">Status</Label>
                    <Popover open={isCompanyStatusDropdownOpen} onOpenChange={setIsCompanyStatusDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isCompanyStatusDropdownOpen}
                          className="w-full justify-between"
                          data-testid="button-company-status-filter"
                        >
                          {getCompanyStatusDisplayText()}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="p-2">
                          <div className="space-y-1">
                            {companyStatusOptions.map((option) => (
                              <div
                                key={option.value}
                                className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded cursor-pointer"
                                onClick={() => handleCompanyStatusChange(option.value)}
                                data-testid={`company-status-option-${option.value}`}
                              >
                                <Checkbox
                                  checked={companyFilters.status.includes(option.value)}
                                  onCheckedChange={() => {}}
                                  className="pointer-events-none"
                                />
                                <span className="text-sm">{option.label}</span>
                                {companyFilters.status.includes(option.value) && (
                                  <Check className="ml-auto h-4 w-4 text-green-600" />
                                )}
                              </div>
                            ))}
                          </div>
                          {companyFilters.status.length > 0 && (
                            <div className="border-t pt-2 mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCompanyFilters(prev => ({ ...prev, status: [] }))}
                                className="w-full text-xs"
                                data-testid="button-clear-company-status"
                              >
                                Clear Status Filter
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date From Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-date-from">Created From</Label>
                    <Input
                      id="company-date-from"
                      type="date"
                      value={companyFilters.dateFrom}
                      onChange={(e) => setCompanyFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      data-testid="input-company-date-from"
                    />
                  </div>

                  {/* Date To Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-date-to">Created To</Label>
                    <Input
                      id="company-date-to"
                      type="date"
                      value={companyFilters.dateTo}
                      onChange={(e) => setCompanyFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      data-testid="input-company-date-to"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Company Management</CardTitle>
                    <CardDescription>Manage all companies on the platform</CardDescription>
                  </div>
                  <Button 
                    onClick={() => {
                      setCompanyForm({ name: "", email: "", password: "", confirmPassword: "", description: "", website: "" });
                      setIsCreateCompanyOpen(true);
                    }}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    data-testid="button-create-company"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Company
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {companiesLoading ? (
                  <div className="text-center py-8">Loading companies...</div>
                ) : companies.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No companies found. Create your first company to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                          onClick={() => handleCompanySort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {companySortColumn === "name" && (
                              companySortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                          onClick={() => handleCompanySort("email")}
                        >
                          <div className="flex items-center gap-1">
                            Email
                            {companySortColumn === "email" && (
                              companySortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                          onClick={() => handleCompanySort("website")}
                        >
                          <div className="flex items-center gap-1">
                            Website
                            {companySortColumn === "website" && (
                              companySortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                          onClick={() => handleCompanySort("description")}
                        >
                          <div className="flex items-center gap-1">
                            Description
                            {companySortColumn === "description" && (
                              companySortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                          onClick={() => handleCompanySort("createdAt")}
                        >
                          <div className="flex items-center gap-1">
                            Created Date
                            {companySortColumn === "createdAt" && (
                              companySortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCompanies.map((company) => (
                        <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                          <TableCell className="font-medium" data-testid={`text-company-name-${company.id}`}>
                            {company.name}
                          </TableCell>
                          <TableCell data-testid={`text-company-email-${company.id}`}>
                            {company.email}
                          </TableCell>
                          <TableCell data-testid={`text-company-website-${company.id}`}>
                            {company.website || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-company-description-${company.id}`}>
                            {company.description || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-company-created-${company.id}`}>
                            {company.createdAt ? format(new Date(company.createdAt), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditCompany(company)}
                                data-testid={`button-edit-company-${company.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteCompany(company.id)}
                                data-testid={`button-delete-company-${company.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Pagination Controls */}
                {!companiesLoading && companies.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    {/* Items per page */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show</span>
                      <Select value={companyItemsPerPage.toString()} onValueChange={handleCompanyItemsPerPageChange}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-600">per page</span>
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Page {companyCurrentPage} of {companyTotalPages} ({companies.length} total)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCompanyPreviousPage}
                        disabled={companyCurrentPage === 1}
                        className="gap-1"
                      >
                        Previous
                      </Button>
                      
                      {/* Page numbers */}
                      <div className="flex gap-1">
                        {Array.from({ length: companyTotalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={companyCurrentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleCompanyPageChange(page)}
                            className={companyCurrentPage === page ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCompanyNextPage}
                        disabled={companyCurrentPage === companyTotalPages}
                        className="gap-1"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            {/* Filter Section */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter Users
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {filteredUsers.length} of {users.length} users
                      </span>
                      {selectedUserIds.length > 0 && (
                        <span className="text-sm font-medium text-amber-600" data-testid="text-selected-users-count">
                          • {selectedUserIds.length} selected
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportUsersToCSV}
                      className="gap-2"
                      data-testid="button-export-users-csv"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearUserFilters}
                      disabled={!userFilters.search && userFilters.status.length === 0 && !userFilters.dateFrom && !userFilters.dateTo}
                      data-testid="button-clear-user-filters-header"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Search Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="user-search-filter">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="user-search-filter"
                            placeholder="Name, email or phone"
                            value={userFilters.search}
                            onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="pl-10"
                            data-testid="input-user-search-filter"
                          />
                        </div>
                      </div>

                      {/* Status Filter - Multi-Select */}
                      <div className="space-y-2">
                        <Label htmlFor="user-status-filter">Status</Label>
                        <Popover open={isUserStatusDropdownOpen} onOpenChange={setIsUserStatusDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isUserStatusDropdownOpen}
                              className="w-full justify-between"
                              data-testid="button-user-status-filter"
                            >
                              {getUserStatusDisplayText()}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="p-2">
                              <div className="space-y-1">
                                {userStatusOptions.map((option) => (
                                  <div
                                    key={option.value}
                                    className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded cursor-pointer"
                                    onClick={() => handleUserStatusChange(option.value)}
                                    data-testid={`user-status-option-${option.value}`}
                                  >
                                    <Checkbox
                                      checked={userFilters.status.includes(option.value)}
                                      onCheckedChange={() => {}}
                                      className="pointer-events-none"
                                    />
                                    <span className="text-sm">{option.label}</span>
                                    {userFilters.status.includes(option.value) && (
                                      <Check className="ml-auto h-4 w-4 text-green-600" />
                                    )}
                                  </div>
                                ))}
                              </div>
                              {userFilters.status.length > 0 && (
                                <div className="border-t pt-2 mt-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setUserFilters(prev => ({ ...prev, status: [] }))}
                                    className="w-full text-xs"
                                    data-testid="button-clear-user-status"
                                  >
                                    Clear Status Filter
                                  </Button>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Date From Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="user-date-from">Created From</Label>
                        <Input
                          id="user-date-from"
                          type="date"
                          value={userFilters.dateFrom}
                          onChange={(e) => setUserFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                          data-testid="input-user-date-from"
                        />
                      </div>

                      {/* Date To Filter */}
                      <div className="space-y-2">
                        <Label htmlFor="user-date-to">Created To</Label>
                        <Input
                          id="user-date-to"
                          type="date"
                          value={userFilters.dateTo}
                          onChange={(e) => setUserFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                          data-testid="input-user-date-to"
                        />
                      </div>
                    </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Users Management</CardTitle>
                <CardDescription>Manage all registered users</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {users.length === 0 ? "No users found" : "No users match the current filters"}
                  </div>
                ) : (
                  <>
                    {isAllUsersSelected && !isAllUserRecordsSelected && filteredUsers.length > paginatedUsers.length && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md flex items-center justify-between">
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          All {paginatedUsers.length} users on this page are selected.{' '}
                          <button
                            onClick={selectAllUserRecords}
                            className="font-medium text-amber-700 dark:text-amber-400 hover:underline"
                            data-testid="button-select-all-users"
                          >
                            Select all {filteredUsers.length} users
                          </button>
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllUserSelections}
                          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                          data-testid="button-clear-user-selection"
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                    {isAllUserRecordsSelected && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          All {filteredUsers.length} users are selected.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllUserSelections}
                          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                          data-testid="button-clear-all-users"
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                            checked={isAllUsersSelected}
                            onCheckedChange={handleSelectAllUsers}
                            className="border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                            data-testid="checkbox-select-all-users"
                          />
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("firstName")}
                        >
                          <div className="flex items-center gap-2">
                            First Name
                            {userSortColumn === "firstName" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("lastName")}
                        >
                          <div className="flex items-center gap-2">
                            Last Name
                            {userSortColumn === "lastName" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("email")}
                        >
                          <div className="flex items-center gap-2">
                            Email
                            {userSortColumn === "email" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("phone")}
                        >
                          <div className="flex items-center gap-2">
                            Phone
                            {userSortColumn === "phone" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("createdAt")}
                        >
                          <div className="flex items-center gap-2">
                            Created At
                            {userSortColumn === "createdAt" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleUserSort("status")}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {userSortColumn === "status" && (
                              userSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => handleSelectUser(user.id)}
                              className="border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                              data-testid={`checkbox-select-user-${user.id}`}
                            />
                          </TableCell>
                          <TableCell data-testid={`text-user-firstname-${user.id}`}>{user.firstName || '-'}</TableCell>
                          <TableCell data-testid={`text-user-lastname-${user.id}`}>{user.lastName || '-'}</TableCell>
                          <TableCell data-testid={`text-user-email-${user.id}`}>{user.email}</TableCell>
                          <TableCell data-testid={`text-user-phone-${user.id}`}>{user.phone || '-'}</TableCell>
                          <TableCell data-testid={`text-user-created-${user.id}`}>
                            {user.createdAt ? formatDeadlineFull(user.createdAt) : '-'}
                          </TableCell>
                          <TableCell data-testid={`text-user-status-${user.id}`}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {user.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {(user as any).lastLoginAt
                              ? new Date((user as any).lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : <span className="text-gray-400 italic">Never</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant={user.status === 'active' ? 'default' : 'outline'}
                                className={user.status === 'active' 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'text-gray-600 hover:text-gray-700'
                                }
                                onClick={() => toggleUserStatusMutation.mutate(user.id)}
                                data-testid={`button-toggle-status-${user.id}`}
                                disabled={toggleUserStatusMutation.isPending}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditUser(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </>
                )}

                {/* Pagination Controls */}
                {!usersLoading && users.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    {/* Items per page */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show</span>
                      <Select value={userItemsPerPage.toString()} onValueChange={handleUserItemsPerPageChange}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-600">per page</span>
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        Page {userCurrentPage} of {userTotalPages} ({filteredUsers.length} total)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUserPreviousPage}
                        disabled={userCurrentPage === 1}
                        className="gap-1"
                      >
                        Previous
                      </Button>
                      
                      {/* Page numbers */}
                      <div className="flex gap-1">
                        {Array.from({ length: userTotalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={userCurrentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleUserPageChange(page)}
                            className={userCurrentPage === page ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUserNextPage}
                        disabled={userCurrentPage === userTotalPages}
                        className="gap-1"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grants Tab */}
          <TabsContent value="grants">
            {/* Filter Section */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter Grants
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {filteredGrants.length} of {allGrantsForOverview.length} grants
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearGrantFilters}
                      disabled={!grantFilters.search && grantFilters.status.length === 0 && !grantFilters.dateFrom && !grantFilters.dateTo}
                      data-testid="button-clear-grant-filters-header"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search Filter */}
                  <div>
                    <Label htmlFor="grant-search-filter" className="text-sm font-medium mb-1.5 block">
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="grant-search-filter"
                        placeholder="Title or company"
                        value={grantFilters.search}
                        onChange={(e) => setGrantFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                        data-testid="input-grant-search-filter"
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">
                      Status
                    </Label>
                    <Popover open={isGrantStatusDropdownOpen} onOpenChange={setIsGrantStatusDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between"
                          data-testid="button-grant-status-filter"
                        >
                          <span>{getGrantStatusDisplayText()}</span>
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <div className="p-2">
                          <div className="space-y-2">
                            {[
                              { value: "active", label: "Active" },
                              { value: "inactive", label: "Inactive" }
                            ].map((option) => (
                              <div
                                key={option.value}
                                className="flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer"
                                onClick={() => toggleGrantStatus(option.value)}
                                data-testid={`grant-status-option-${option.value}`}
                              >
                                <Checkbox
                                  checked={grantFilters.status.includes(option.value)}
                                  onCheckedChange={() => {}}
                                  className="pointer-events-none"
                                />
                                <span className="text-sm">{option.label}</span>
                                {grantFilters.status.includes(option.value) && (
                                  <Check className="ml-auto h-4 w-4 text-green-600" />
                                )}
                              </div>
                            ))}
                          </div>
                          {grantFilters.status.length > 0 && (
                            <div className="border-t pt-2 mt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => setGrantFilters(prev => ({ ...prev, status: [] }))}
                              >
                                Clear Status Filter
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date Range Filters */}
                  <div>
                    <Label htmlFor="grant-date-from" className="text-sm font-medium mb-1.5 block">
                      Deadline From
                    </Label>
                    <Input
                      id="grant-date-from"
                      type="date"
                      value={grantFilters.dateFrom}
                      onChange={(e) => setGrantFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      data-testid="input-grant-date-from"
                    />
                  </div>

                  <div>
                    <Label htmlFor="grant-date-to" className="text-sm font-medium mb-1.5 block">
                      Deadline To
                    </Label>
                    <Input
                      id="grant-date-to"
                      type="date"
                      value={grantFilters.dateTo}
                      onChange={(e) => setGrantFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      data-testid="input-grant-date-to"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grants Management Section */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Grants Management</CardTitle>
                    <CardDescription>Manage grants for all companies</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setIsCreateGrantOpen(true)}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    data-testid="button-create-grant"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Grant
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {grantsLoading ? (
                  <div className="text-center py-8">Loading grants...</div>
                ) : filteredGrants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No grants found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleGrantSort("title")}
                        >
                          <div className="flex items-center gap-2">
                            Title
                            {grantSortColumn === "title" && (
                              grantSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleGrantSort("company")}
                        >
                          <div className="flex items-center gap-2">
                            Company
                            {grantSortColumn === "company" && (
                              grantSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleGrantSort("amount")}
                        >
                          <div className="flex items-center gap-2">
                            Amount
                            {grantSortColumn === "amount" && (
                              grantSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleGrantSort("deadline")}
                        >
                          <div className="flex items-center gap-2">
                            Deadline
                            {grantSortColumn === "deadline" && (
                              grantSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-gray-50"
                          onClick={() => handleGrantSort("status")}
                        >
                          <div className="flex items-center gap-2">
                            Status
                            {grantSortColumn === "status" && (
                              grantSortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedGrants.map((grant) => (
                        <TableRow key={grant.id}>
                          <TableCell className="font-medium">{grant.title}</TableCell>
                          <TableCell>
                            {companies.find(c => c.id === grant.companyId)?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>${grant.amount?.toLocaleString()}</TableCell>
                          <TableCell>{grant.category}</TableCell>
                          <TableCell>{grant.deadline ? formatDeadlineFull(grant.deadline, grant.timezone) : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                grant.status === 'active' 
                                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                                  : 'bg-red-500 hover:bg-red-600 text-white'
                              }
                            >
                              {grant.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewGrant(grant)}
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditGrant(grant)}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={grant.status === 'active' ? 'default' : 'outline'}
                                className={grant.status === 'active' 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'text-gray-600 hover:text-gray-700'
                                }
                                onClick={() => toggleGrantStatusMutation.mutate(grant.id)}
                                data-testid={`button-toggle-grant-status-${grant.id}`}
                                disabled={toggleGrantStatusMutation.isPending}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteGrant(grant.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* External Grants Tab */}
          <TabsContent value="external-grants">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">External Grants Management</CardTitle>
                    <CardDescription>Manage links to external grant opportunities</CardDescription>
                  </div>
                  <Button
                    onClick={() => handleOpenExternalGrantDialog()}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add External Grant
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {externalGrantsLoading ? (
                  <div className="text-center py-8">Loading external grants...</div>
                ) : externalGrants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Link className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No external grants yet</p>
                    <p className="text-sm">Add links to external grant opportunities for users to explore</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {externalGrants.map((grant) => (
                        <TableRow key={grant.id}>
                          <TableCell className="font-medium">{grant.name}</TableCell>
                          <TableCell className="font-semibold text-amber-600">
                            {grant.amount ? `$${grant.amount.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell>
                            <a 
                              href={grant.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 max-w-xs truncate"
                            >
                              {grant.url.substring(0, 40)}{grant.url.length > 40 ? '...' : ''}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>{grant.category || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={grant.isActive ? "default" : "secondary"}>
                              {grant.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenExternalGrantDialog(grant)}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this external grant?')) {
                                  deleteExternalGrantMutation.mutate(grant.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grant Writers Tab */}
          <TabsContent value="grant-writers">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Certified Grant Writers</CardTitle>
                    <CardDescription>Manage the certified grant writer directory visible to logged-in users</CardDescription>
                  </div>
                  <Button
                    onClick={() => handleOpenGrantWriterDialog()}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Writer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {grantWritersLoading ? (
                  <div className="text-center py-8">Loading grant writers...</div>
                ) : adminGrantWriters.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No grant writers yet</p>
                    <p className="text-sm">Add certified grant writers to the directory</p>
                  </div>
                ) : (
                  <DndContext sensors={writerSensors} collisionDetection={closestCenter} onDragEnd={handleWriterDragEnd}>
                    <SortableContext items={sortedWriterIds} strategy={verticalListSortingStrategy}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8 px-2"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Niches</TableHead>
                            <TableHead>Experience</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Inquiries</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedWriterIds.map((id) => {
                            const writer = adminGrantWriters.find((w) => w.id === id);
                            if (!writer) return null;
                            return (
                              <SortableWriterRow
                                key={writer.id}
                                writer={writer}
                                onEdit={handleOpenGrantWriterDialog}
                                onToggleActive={(wid, isActive) => updateGrantWriterMutation.mutate({ id: wid, updates: { isActive: !isActive } })}
                                onDelete={(wid, name) => { if (confirm(`Delete ${name}? This cannot be undone.`)) deleteGrantWriterMutation.mutate(wid); }}
                                togglePending={updateGrantWriterMutation.isPending}
                              />
                            );
                          })}
                        </TableBody>
                      </Table>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>

            {/* Inquiries Card */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-xl">Inquiry History</CardTitle>
                    <CardDescription>All contact form submissions sent to grant writers</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">Filter by writer:</label>
                    <select
                      value={inquiryWriterFilter}
                      onChange={(e) => setInquiryWriterFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="all">All writers</option>
                      {adminGrantWriters.map((w: any) => (
                        <option key={w.id} value={String(w.id)}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {inquiriesLoading ? (
                  <div className="text-center py-8">Loading inquiries...</div>
                ) : filteredInquiries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg font-medium">No inquiries yet</p>
                    <p className="text-sm">Contact form submissions will appear here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Writer</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Help Type</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInquiries.map((inq: any) => (
                        <TableRow key={inq.id}>
                          <TableCell className="font-medium whitespace-nowrap">{inq.writerName}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{inq.senderName}</div>
                            <div className="text-xs text-gray-500">{inq.senderEmail}</div>
                            {inq.phone && <div className="text-xs text-gray-400">{inq.phone}</div>}
                          </TableCell>
                          <TableCell>
                            {inq.orgName ? (
                              <div>
                                <div className="text-sm font-medium">{inq.orgName}</div>
                                {inq.orgType && <div className="text-xs text-gray-500">{inq.orgType}</div>}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs whitespace-nowrap">
                              {inq.helpType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">{inq.budgetRange || "—"}</TableCell>
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">{inq.timeline || "—"}</TableCell>
                          <TableCell className="max-w-xs">
                            <span className="text-sm text-gray-700 line-clamp-2">{inq.message}</span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {inq.createdAt ? new Date(inq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {inq.repliedAt ? (
                              <Badge className="bg-green-100 text-green-800 border border-green-200 text-xs">
                                Replied
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                  setReplyInquiry(inq);
                                  setReplySubject(`Re: Your inquiry via GrantFind`);
                                  setReplyBody(`Hi ${inq.senderName},\n\nThank you for reaching out through GrantFind.\n\n`);
                                }}
                              >
                                Reply
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Form Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">Form Templates Management</CardTitle>
                    <CardDescription>Manage application form templates for companies</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select 
                      value={selectedCompanyForTemplates?.toString() || "all"} 
                      onValueChange={(value) => setSelectedCompanyForTemplates(value === "all" ? null : parseInt(value))}
                    >
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="All Companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => setLocation('/admin/form-builder/new')}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="text-center py-8">Loading templates...</div>
                ) : displayedFormTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No form templates found{selectedCompanyForTemplates ? ' for this company' : ''}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Fields Count</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedFormTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>
                            {companies.find(c => c.id === template.companyId)?.name || 'N/A'}
                          </TableCell>
                          <TableCell>{template.fields?.length || 0} fields</TableCell>
                          <TableCell>{template.updatedAt ? format(new Date(template.updatedAt), 'M/d/yyyy') : 'N/A'}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewTemplate(template)}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/admin/form-builder/edit/${template.id}`)}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            {/* Filter Section */}
            <Card className="mb-6">
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

                  {/* Company Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="company-filter">Company</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="company-filter"
                        placeholder="Search by company name"
                        value={applicationFilters.company}
                        onChange={(e) => setApplicationFilters(prev => ({ ...prev, company: e.target.value }))}
                        className="pl-10"
                        data-testid="input-company-filter"
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Grant Applications</CardTitle>
                    <CardDescription>
                      Click on any application row to view details and edit remarks
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {filteredApplications.length} of {allApplications.length} applications
                      </span>
                      {selectedApplicationIds.length > 0 && (
                        <span className="text-sm font-medium text-amber-600" data-testid="text-selected-count">
                          • {selectedApplicationIds.length} selected
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                      className="gap-2"
                      data-testid="button-export-csv"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
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
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="text-center py-8">Loading applications...</div>
                ) : filteredApplications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {allApplications.length === 0 ? "No applications found across all companies" : "No applications match your filters"}
                  </div>
                ) : (
                  <>
                    {isAllSelected && !isAllApplicationRecordsSelected && filteredApplications.length > paginatedApplications.length && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md flex items-center justify-between">
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          All {paginatedApplications.length} applications on this page are selected.{' '}
                          <button
                            onClick={selectAllApplicationRecords}
                            className="font-medium text-amber-700 dark:text-amber-400 hover:underline"
                            data-testid="button-select-all-applications"
                          >
                            Select all {filteredApplications.length} applications
                          </button>
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllApplicationSelections}
                          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                          data-testid="button-clear-application-selection"
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                    {isAllApplicationRecordsSelected && (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          All {filteredApplications.length} applications are selected.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllApplicationSelections}
                          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                          data-testid="button-clear-all-applications"
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                              className="border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                            />
                          </TableHead>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Grant</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Applied Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedApplications.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedApplicationIds.includes(app.id)}
                                onCheckedChange={() => handleSelectApplication(app.id)}
                                className="border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white"
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {app.user?.firstName} {app.user?.lastName}
                              <div className="text-sm text-gray-500">{app.user?.email}</div>
                            </TableCell>
                            <TableCell>{app.grant?.title || 'Deleted Grant'}</TableCell>
                            <TableCell>{app.grant?.company || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  app.status === "Applied" ? "bg-green-500 text-white hover:bg-green-600" :
                                  app.status === "In Progress" ? "bg-blue-500 text-white hover:bg-blue-600" :
                                  app.status === "Under Review" ? "bg-yellow-500 text-white hover:bg-yellow-600" :
                                  app.status === "Accepted" ? "bg-green-600 text-white hover:bg-green-700" :
                                  app.status === "Rejected" ? "bg-red-500 text-white hover:bg-red-600" : ""
                                }
                              >
                                {app.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {app.appliedAt ? formatAppliedDateTime(app.appliedAt) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              {app.status === "In Progress" ? (
                                // No buttons for "In Progress" status - user hasn't submitted yet
                                null
                              ) : app.status === "Accepted" ? (
                                // For Accepted: Show Review + Reject (allow reconsidering)
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleReviewApplication(app)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                    data-testid={`button-review-${app.id}`}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickStatusUpdate(app.id, "Rejected")}
                                    className="bg-red-500 hover:bg-red-600 text-white"
                                    disabled={updateApplicationStatusMutation.isPending}
                                    data-testid={`button-reject-${app.id}`}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : app.status === "Rejected" ? (
                                // For Rejected: Show Review + Accept (allow reconsidering)
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleReviewApplication(app)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                    data-testid={`button-review-${app.id}`}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickStatusUpdate(app.id, "Accepted")}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    disabled={updateApplicationStatusMutation.isPending}
                                    data-testid={`button-accept-${app.id}`}
                                  >
                                    Accept
                                  </Button>
                                </div>
                              ) : (app.status === "Applied" || app.status === "Under Review") ? (
                                // For Applied/Under Review: Show Review + Accept + Reject
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleReviewApplication(app)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                    data-testid={`button-review-${app.id}`}
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickStatusUpdate(app.id, "Accepted")}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    disabled={updateApplicationStatusMutation.isPending}
                                    data-testid={`button-accept-${app.id}`}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickStatusUpdate(app.id, "Rejected")}
                                    className="bg-red-500 hover:bg-red-600 text-white"
                                    disabled={updateApplicationStatusMutation.isPending}
                                    data-testid={`button-reject-${app.id}`}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      {/* Items per page */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Show</span>
                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-gray-600">per page</span>
                      </div>

                      {/* Page navigation */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          Page {currentPage} of {totalPages} ({filteredApplications.length} total)
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousPage}
                          disabled={currentPage === 1}
                          className="gap-1"
                        >
                          Previous
                        </Button>
                        
                        {/* Page numbers */}
                        <div className="flex gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              className={currentPage === page ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="gap-1"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <WeeklyReport token={token} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Company Dialog */}
      <Dialog open={isCreateCompanyOpen} onOpenChange={setIsCreateCompanyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                placeholder="Enter company name"
                data-testid="input-company-name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                placeholder="company@example.com"
                data-testid="input-company-email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showCreatePassword ? "text" : "password"}
                  value={companyForm.password}
                  onChange={(e) => setCompanyForm({ ...companyForm, password: e.target.value })}
                  placeholder="Enter password"
                  data-testid="input-company-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-create-password-visibility"
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showCreateConfirmPassword ? "text" : "password"}
                  value={companyForm.confirmPassword}
                  onChange={(e) => setCompanyForm({ ...companyForm, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  data-testid="input-company-confirm-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-create-confirm-password-visibility"
                >
                  {showCreateConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={companyForm.website}
                onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                placeholder="https://company.com"
                data-testid="input-company-website"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={companyForm.description}
                onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                placeholder="Enter company description"
                rows={3}
                data-testid="textarea-company-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateCompanyOpen(false)}
              data-testid="button-cancel-create-company"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (companyForm.password !== companyForm.confirmPassword) {
                  toast({ 
                    title: "Error", 
                    description: "Passwords do not match", 
                    variant: "destructive" 
                  });
                  return;
                }
                const { confirmPassword, ...submitData } = companyForm;
                createCompanyMutation.mutate(submitData);
              }}
              disabled={!companyForm.name || !companyForm.email || !companyForm.password || !companyForm.confirmPassword}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              data-testid="button-submit-create-company"
            >
              Create Company
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditCompanyOpen} onOpenChange={setIsEditCompanyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Company Name *</Label>
              <Input
                id="edit-name"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                placeholder="Enter company name"
                data-testid="input-edit-company-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                placeholder="company@example.com"
                data-testid="input-edit-company-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  value={companyForm.password}
                  onChange={(e) => setCompanyForm({ ...companyForm, password: e.target.value })}
                  placeholder="Enter new password"
                  data-testid="input-edit-company-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-edit-password-visibility"
                >
                  {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="edit-confirmPassword"
                  type={showEditConfirmPassword ? "text" : "password"}
                  value={companyForm.confirmPassword}
                  onChange={(e) => setCompanyForm({ ...companyForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  data-testid="input-edit-company-confirm-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-edit-confirm-password-visibility"
                >
                  {showEditConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={companyForm.website}
                onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                placeholder="https://company.com"
                data-testid="input-edit-company-website"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={companyForm.description}
                onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                placeholder="Enter company description"
                rows={3}
                data-testid="textarea-edit-company-description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditCompanyOpen(false)}
              data-testid="button-cancel-edit-company"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Validate passwords match if a new password is being set
                if (companyForm.password && companyForm.password !== companyForm.confirmPassword) {
                  toast({ 
                    title: "Error", 
                    description: "Passwords do not match", 
                    variant: "destructive" 
                  });
                  return;
                }
                
                const updateData: any = {
                  name: companyForm.name,
                  email: companyForm.email,
                  website: companyForm.website,
                  description: companyForm.description,
                };
                if (companyForm.password) {
                  updateData.password = companyForm.password;
                }
                updateCompanyMutation.mutate({
                  companyId: selectedCompany!.id,
                  companyData: updateData,
                });
              }}
              disabled={!companyForm.name || !companyForm.email}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              data-testid="button-submit-edit-company"
            >
              Update Company
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={userForm.firstName}
                  onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  placeholder="Enter first name"
                  data-testid="input-edit-user-first-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={userForm.lastName}
                  onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                  placeholder="Enter last name"
                  data-testid="input-edit-user-last-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-user-email">Email *</Label>
              <Input
                id="edit-user-email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
                data-testid="input-edit-user-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-user-phone">Phone *</Label>
              <Input
                id="edit-user-phone"
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                data-testid="input-edit-user-phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-user-password">Password (leave blank to keep current)</Label>
              <div className="relative">
                <Input
                  id="edit-user-password"
                  type={showEditUserPassword ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Enter new password"
                  data-testid="input-edit-user-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-edit-user-password-visibility"
                >
                  {showEditUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-user-confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="edit-user-confirmPassword"
                  type={showEditUserConfirmPassword ? "text" : "password"}
                  value={userForm.confirmPassword}
                  onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  data-testid="input-edit-user-confirm-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditUserConfirmPassword(!showEditUserConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  data-testid="toggle-edit-user-confirm-password-visibility"
                >
                  {showEditUserConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditUserOpen(false);
                setSelectedUser(null);
                setUserForm({
                  firstName: "",
                  lastName: "",
                  email: "",
                  phone: "",
                  password: "",
                  confirmPassword: "",
                });
              }}
              data-testid="button-cancel-edit-user"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Validate passwords match if a new password is being set
                if (userForm.password && userForm.password !== userForm.confirmPassword) {
                  toast({ 
                    title: "Error", 
                    description: "Passwords do not match", 
                    variant: "destructive" 
                  });
                  return;
                }
                
                const updateData: any = {
                  firstName: userForm.firstName,
                  lastName: userForm.lastName,
                  email: userForm.email,
                  phone: userForm.phone,
                };
                if (userForm.password) {
                  updateData.password = userForm.password;
                }
                updateUserMutation.mutate({
                  userId: selectedUser!.id,
                  userData: updateData,
                });
              }}
              disabled={!userForm.firstName || !userForm.lastName || !userForm.email || !userForm.phone}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              data-testid="button-submit-edit-user"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Grant Dialog */}
      <Dialog open={isCreateGrantOpen} onOpenChange={setIsCreateGrantOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Grant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Company Selection */}
            <div>
              <Label htmlFor="grant-company">Company *</Label>
              <Popover open={isCompanySearchOpen} onOpenChange={setIsCompanySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="grant-company"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCompanySearchOpen}
                    className="w-full justify-between"
                  >
                    {grantForm.companyId
                      ? alphabeticalCompanies.find((company) => company.id.toString() === grantForm.companyId)?.name
                      : "Select a company"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search company..." />
                    <CommandList>
                      <CommandEmpty>No company found.</CommandEmpty>
                      <CommandGroup>
                        {alphabeticalCompanies.map((company) => (
                          <CommandItem
                            key={company.id}
                            value={company.name}
                            onSelect={() => {
                              setGrantForm({ ...grantForm, companyId: company.id.toString() });
                              setIsCompanySearchOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                grantForm.companyId === company.id.toString() ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {company.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grant-title">Grant Title *</Label>
                <Input
                  id="grant-title"
                  value={grantForm.title}
                  onChange={(e) => setGrantForm({ ...grantForm, title: e.target.value })}
                  placeholder="Enter grant title"
                />
              </div>
              <div>
                <Label htmlFor="grant-amount">Amount ($) *</Label>
                <Input
                  id="grant-amount"
                  type="number"
                  value={grantForm.amount}
                  onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grant-deadline">Deadline *</Label>
                <Input
                  id="grant-deadline"
                  type="datetime-local"
                  value={grantForm.deadline}
                  onChange={(e) => setGrantForm({ ...grantForm, deadline: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="grant-category">Category *</Label>
                <Input
                  id="grant-category"
                  value={grantForm.category}
                  onChange={(e) => setGrantForm({ ...grantForm, category: e.target.value })}
                  placeholder="e.g., Business, Technology"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="grant-formTemplateId">Application Form Template *</Label>
              <Select
                value={grantForm.formTemplateId}
                onValueChange={(value) => setGrantForm({ ...grantForm, formTemplateId: value })}
              >
                <SelectTrigger id="grant-formTemplateId">
                  <SelectValue placeholder="Select a form template" />
                </SelectTrigger>
                <SelectContent>
                  {(allFormTemplates || [])
                    .filter((t: any) => !grantForm.companyId || t.companyId === parseInt(grantForm.companyId))
                    .map((template: any) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="grant-description">Description *</Label>
              <Textarea
                id="grant-description"
                value={grantForm.description}
                onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
                placeholder="Describe the grant opportunity..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="grant-requirements">Requirements</Label>
              <Textarea
                id="grant-requirements"
                value={grantForm.requirements}
                onChange={(e) => setGrantForm({ ...grantForm, requirements: e.target.value })}
                placeholder="List requirements..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grant-tags">Tags (comma-separated)</Label>
                <Input
                  id="grant-tags"
                  value={grantForm.tags}
                  onChange={(e) => setGrantForm({ ...grantForm, tags: e.target.value })}
                  placeholder="startup, innovation, tech"
                />
              </div>
              <div>
                <Label htmlFor="grant-imageUrl">Grant Image URL</Label>
                <Input
                  id="grant-imageUrl"
                  value={grantForm.imageUrl}
                  onChange={(e) => setGrantForm({ ...grantForm, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateGrantOpen(false);
              setGrantForm({
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
                companyId: "",
              });
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!grantForm.formTemplateId) {
                  toast({
                    title: "Validation Error",
                    description: "Please select an application form template",
                    variant: "destructive",
                  });
                  return;
                }

                const companyId = parseInt(grantForm.companyId);
                createGrantMutation.mutate({
                  companyId,
                  grantData: {
                    ...grantForm,
                    deadline: datetimeLocalToEST(grantForm.deadline),
                    amount: parseInt(grantForm.amount),
                    tags: grantForm.tags ? grantForm.tags.split(",").map((tag: string) => tag.trim()) : [],
                    formTemplateId: parseInt(grantForm.formTemplateId),
                  }
                });
              }}
              disabled={!grantForm.companyId || !grantForm.title || !grantForm.amount || !grantForm.deadline || !grantForm.category || !grantForm.description || !grantForm.formTemplateId}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              Create Grant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Grant Dialog */}
      <Dialog open={isViewGrantOpen} onOpenChange={setIsViewGrantOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grant Details</DialogTitle>
          </DialogHeader>
          {selectedGrant && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-gray-500">Title</Label>
                <p className="text-lg font-medium">{selectedGrant.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Amount</Label>
                  <p className="text-lg font-medium">${selectedGrant.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Category</Label>
                  <p className="text-lg font-medium">{selectedGrant.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <Badge 
                    className={
                      selectedGrant.status === 'active' 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }
                  >
                    {selectedGrant.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-500">Deadline</Label>
                  <p className="text-lg font-medium">
                    {selectedGrant.deadline ? formatDeadlineFull(selectedGrant.deadline, selectedGrant.timezone) : 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-gray-500">Company</Label>
                <p className="text-lg font-medium">{selectedGrant.company || companies.find(c => c.id === selectedGrant.companyId)?.name}</p>
              </div>
              <div>
                <Label className="text-gray-500">Description</Label>
                <p className="text-base">{selectedGrant.description}</p>
              </div>
              {selectedGrant.requirements && (
                <div>
                  <Label className="text-gray-500">Requirements</Label>
                  <p className="text-base">{selectedGrant.requirements}</p>
                </div>
              )}
              {selectedGrant.tags && selectedGrant.tags.length > 0 && (
                <div>
                  <Label className="text-gray-500">Tags</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {selectedGrant.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsViewGrantOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Grant Dialog */}
      <Dialog open={isEditGrantOpen} onOpenChange={setIsEditGrantOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Grant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-grant-title">Title *</Label>
              <Input
                id="edit-grant-title"
                value={grantForm.title}
                onChange={(e) => setGrantForm({ ...grantForm, title: e.target.value })}
                placeholder="Enter grant title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-grant-amount">Amount ($) *</Label>
                <Input
                  id="edit-grant-amount"
                  type="number"
                  value={grantForm.amount}
                  onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="edit-grant-category">Category *</Label>
                <Input
                  id="edit-grant-category"
                  value={grantForm.category}
                  onChange={(e) => setGrantForm({ ...grantForm, category: e.target.value })}
                  placeholder="e.g., Technology"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-grant-deadline">Deadline *</Label>
              <Input
                id="edit-grant-deadline"
                type="datetime-local"
                value={grantForm.deadline}
                onChange={(e) => setGrantForm({ ...grantForm, deadline: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-grant-description">Description *</Label>
              <Textarea
                id="edit-grant-description"
                value={grantForm.description}
                onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
                placeholder="Describe the grant..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-grant-requirements">Requirements</Label>
              <Textarea
                id="edit-grant-requirements"
                value={grantForm.requirements}
                onChange={(e) => setGrantForm({ ...grantForm, requirements: e.target.value })}
                placeholder="List requirements..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-grant-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-grant-tags"
                value={grantForm.tags}
                onChange={(e) => setGrantForm({ ...grantForm, tags: e.target.value })}
                placeholder="startup, innovation, tech"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsEditGrantOpen(false);
              setSelectedGrant(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedGrant) {
                  updateGrantMutation.mutate({
                    grantId: selectedGrant.id,
                    grantData: {
                      ...grantForm,
                      deadline: datetimeLocalToEST(grantForm.deadline)
                    }
                  });
                }
              }}
              disabled={!grantForm.title || !grantForm.amount || !grantForm.deadline || !grantForm.category || !grantForm.description}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              Update Grant
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog - Removed, now using Form Builder page */}

      {/* View Template Dialog */}
      <Dialog open={isViewTemplateOpen} onOpenChange={setIsViewTemplateOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Form Template</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-6">
              {/* Template Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Template Name</Label>
                  <p className="text-base mt-1">{selectedTemplate.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Company</Label>
                  <p className="text-base mt-1">
                    {companies.find(c => c.id === selectedTemplate.companyId)?.name || 'N/A'}
                  </p>
                </div>
                {selectedTemplate.description && (
                  <div className="col-span-2">
                    <Label className="text-sm font-semibold text-gray-600">Description</Label>
                    <p className="text-base mt-1">{selectedTemplate.description}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Total Fields</Label>
                  <p className="text-base mt-1">{selectedTemplate.fields?.length || 0} fields</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Last Updated</Label>
                  <p className="text-base mt-1">
                    {selectedTemplate.updatedAt 
                      ? format(new Date(selectedTemplate.updatedAt), 'MMM dd, yyyy')
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>

              {/* Template Fields */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Form Fields</h3>
                {selectedTemplate.fields && selectedTemplate.fields.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTemplate.fields.map((field: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg bg-white dark:bg-gray-900">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-gray-500">Field Name</Label>
                            <p className="font-medium">{field.name}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Type</Label>
                            <p className="font-medium capitalize">{field.type}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Required</Label>
                            <p className="font-medium">{field.required ? 'Yes' : 'No'}</p>
                          </div>
                          {field.label && (
                            <div className="col-span-3">
                              <Label className="text-xs text-gray-500">Label</Label>
                              <p className="font-medium">{field.label}</p>
                            </div>
                          )}
                          {field.placeholder && (
                            <div className="col-span-3">
                              <Label className="text-xs text-gray-500">Placeholder</Label>
                              <p className="text-sm text-gray-600">{field.placeholder}</p>
                            </div>
                          )}
                          {field.options && field.options.length > 0 && (
                            <div className="col-span-3">
                              <Label className="text-xs text-gray-500">Options</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {field.options.map((option: string, optIdx: number) => (
                                  <span key={optIdx} className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-sm">
                                    {option}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No fields configured</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => {
                  setIsViewTemplateOpen(false);
                  setSelectedTemplate(null);
                }}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Application Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-6">
              {/* Application Details */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Applicant</Label>
                  <p className="text-base mt-1">
                    {selectedApplication.user?.firstName} {selectedApplication.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedApplication.user?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Grant</Label>
                  <p className="text-base mt-1">{selectedApplication.grant?.title || 'Deleted Grant'}</p>
                  <p className="text-sm text-gray-500">{selectedApplication.grant?.company || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Applied Date</Label>
                  <p className="text-base mt-1">
                    {selectedApplication.appliedAt 
                      ? formatAppliedDateTime(selectedApplication.appliedAt)
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-600">Current Status</Label>
                  <div className="mt-1">
                    <Badge
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

              {/* Application Responses Section */}
              {selectedApplication.answers && applicationFormFields.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-gray-700">Application Responses</Label>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4">
                    {(() => {
                      try {
                        const answers = JSON.parse(selectedApplication.answers);
                        
                        return applicationFormFields.map((field: any) => {
                          const value = answers[field.label] ?? answers[field.id] ?? 'N/A';
                          
                          return (
                            <div key={field.id} className="space-y-1">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {field.label}
                              </p>
                              <p className="text-base text-gray-900 dark:text-gray-100">
                                {value}
                              </p>
                            </div>
                          );
                        });
                      } catch (e) {
                        return <p className="text-sm text-gray-500">No application responses available</p>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Remarks Section */}
              <div>
                <Label htmlFor="review-remarks" className="text-sm font-semibold text-gray-600">
                  Remarks / Notes
                </Label>
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
                  data-testid="button-mark-under-review"
                >
                  {updateApplicationStatusMutation.isPending ? "Updating..." : "Mark Under Review"}
                </Button>
                <Button
                  onClick={() => handleSubmitReview("Rejected")}
                  disabled={updateApplicationStatusMutation.isPending}
                  variant="destructive"
                  data-testid="button-reject-application"
                >
                  {updateApplicationStatusMutation.isPending ? "Updating..." : "Reject"}
                </Button>
                <Button
                  onClick={() => handleSubmitReview("Accepted")}
                  disabled={updateApplicationStatusMutation.isPending}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="button-accept-application"
                >
                  {updateApplicationStatusMutation.isPending ? "Updating..." : "Accept"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grant Writer Create/Edit Dialog */}
      <Dialog open={isGrantWriterDialogOpen} onOpenChange={setIsGrantWriterDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGrantWriter ? 'Edit Grant Writer' : 'Add Grant Writer'}</DialogTitle>
            <DialogDescription>
              {editingGrantWriter ? 'Update this certified grant writer profile.' : 'Add a new certified grant writer to the directory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="gw-name">Full Name *</Label>
              <Input id="gw-name" value={grantWriterForm.name} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, name: e.target.value })} placeholder="e.g., Angela Morrison" />
            </div>
            <div>
              <Label htmlFor="gw-email">Email *</Label>
              <Input id="gw-email" type="email" value={grantWriterForm.email} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, email: e.target.value })} placeholder="writer@example.com" />
            </div>
            <div>
              <Label htmlFor="gw-bio">Bio *</Label>
              <Textarea id="gw-bio" value={grantWriterForm.bio} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, bio: e.target.value })} placeholder="Writer background and expertise..." className="min-h-[80px] resize-none" />
            </div>
            <div>
              <Label htmlFor="gw-photo">Photo URL</Label>
              <Input id="gw-photo" value={grantWriterForm.photoUrl} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, photoUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label htmlFor="gw-niches">Niches <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input id="gw-niches" value={grantWriterForm.niches} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, niches: e.target.value })} placeholder="e.g., Nonprofits, Education, Healthcare" />
            </div>
            <div>
              <Label htmlFor="gw-specialties">Specialties <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input id="gw-specialties" value={grantWriterForm.specialties} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, specialties: e.target.value })} placeholder="e.g., Federal Grants, NIH, Foundation Grants" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gw-experience">Years Experience</Label>
                <Input id="gw-experience" type="number" min="0" value={grantWriterForm.yearsExperience} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, yearsExperience: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="gw-sort">Sort Order</Label>
                <Input id="gw-sort" type="number" min="0" value={grantWriterForm.sortOrder} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, sortOrder: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label htmlFor="gw-website">Website URL</Label>
              <Input id="gw-website" value={grantWriterForm.websiteUrl} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, websiteUrl: e.target.value })} placeholder="https://example.com" />
            </div>
            <div>
              <Label htmlFor="gw-linkedin">LinkedIn URL</Label>
              <Input id="gw-linkedin" value={grantWriterForm.linkedinUrl} onChange={(e) => setGrantWriterForm({ ...grantWriterForm, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="gw-active">Active (visible in directory)</Label>
              <Switch id="gw-active" checked={grantWriterForm.isActive} onCheckedChange={(checked) => setGrantWriterForm({ ...grantWriterForm, isActive: checked })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setIsGrantWriterDialogOpen(false); setEditingGrantWriter(null); }}>Cancel</Button>
            <Button
              onClick={handleSaveGrantWriter}
              disabled={!grantWriterForm.name || !grantWriterForm.email || !grantWriterForm.bio || createGrantWriterMutation.isPending || updateGrantWriterMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              {(createGrantWriterMutation.isPending || updateGrantWriterMutation.isPending) ? 'Saving...' : editingGrantWriter ? 'Update Writer' : 'Add Writer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* External Grant Create/Edit Dialog */}
      <Dialog open={isExternalGrantDialogOpen} onOpenChange={setIsExternalGrantDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExternalGrant ? 'Edit External Grant' : 'Add External Grant'}</DialogTitle>
            <DialogDescription>
              {editingExternalGrant 
                ? 'Update the external grant link details.' 
                : 'Add a link to an external grant opportunity.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="external-grant-name">Grant Name *</Label>
              <Input
                id="external-grant-name"
                value={externalGrantForm.name}
                onChange={(e) => setExternalGrantForm({ ...externalGrantForm, name: e.target.value })}
                placeholder="e.g., Walmart Spark Local Grant"
              />
            </div>
            <div>
              <Label htmlFor="external-grant-url">Grant URL *</Label>
              <Input
                id="external-grant-url"
                value={externalGrantForm.url}
                onChange={(e) => setExternalGrantForm({ ...externalGrantForm, url: e.target.value })}
                placeholder="https://example.com/grant-program"
              />
            </div>
            <div>
              <Label htmlFor="external-grant-amount">Amount ($)</Label>
              <Input
                id="external-grant-amount"
                type="number"
                value={externalGrantForm.amount}
                onChange={(e) => setExternalGrantForm({ ...externalGrantForm, amount: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <Label htmlFor="external-grant-category">Category (Optional)</Label>
              <Input
                id="external-grant-category"
                value={externalGrantForm.category}
                onChange={(e) => setExternalGrantForm({ ...externalGrantForm, category: e.target.value })}
                placeholder="e.g., Education, Healthcare, Small Business"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="external-grant-active">Active</Label>
              <Switch
                id="external-grant-active"
                checked={externalGrantForm.isActive}
                onCheckedChange={(checked) => setExternalGrantForm({ ...externalGrantForm, isActive: checked })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsExternalGrantDialogOpen(false);
              setEditingExternalGrant(null);
              setExternalGrantForm({ name: "", url: "", amount: "", category: "", isActive: true });
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveExternalGrant}
              disabled={!externalGrantForm.name || !externalGrantForm.url || createExternalGrantMutation.isPending || updateExternalGrantMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              {(createExternalGrantMutation.isPending || updateExternalGrantMutation.isPending) 
                ? 'Saving...' 
                : editingExternalGrant ? 'Update Grant' : 'Add Grant'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reply Inquiry Modal */}
      <Dialog open={!!replyInquiry} onOpenChange={(open) => { if (!open) { setReplyInquiry(null); setReplySubject(""); setReplyBody(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Inquiry</DialogTitle>
            <DialogDescription>
              Send a reply email to <strong>{replyInquiry?.senderName}</strong> ({replyInquiry?.senderEmail})
            </DialogDescription>
          </DialogHeader>
          {replyInquiry && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">Original inquiry:</p>
                <p className="line-clamp-4">{replyInquiry.message}</p>
              </div>
              <div>
                <Label htmlFor="reply-subject">Subject</Label>
                <Input
                  id="reply-subject"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Reply subject..."
                />
              </div>
              <div>
                <Label htmlFor="reply-body">Message</Label>
                <Textarea
                  id="reply-body"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write your reply..."
                  rows={8}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setReplyInquiry(null); setReplySubject(""); setReplyBody(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => replyInquiryMutation.mutate({ id: replyInquiry.id, subject: replySubject, body: replyBody })}
              disabled={!replySubject.trim() || !replyBody.trim() || replyInquiryMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              {replyInquiryMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
