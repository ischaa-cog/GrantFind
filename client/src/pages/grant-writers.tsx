import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Award, Globe, Linkedin, Mail, MapPin, Search, Star, Users, CheckCircle, X } from "lucide-react";
import type { GrantWriter } from "@shared/schema";

const NICHES = ["All", "Nonprofits", "Small Business", "Startups", "Government", "Education", "Healthcare", "Arts & Culture", "Housing", "Community Development"];

const inquirySchema = z.object({
  senderName: z.string().min(1, "Name is required"),
  senderEmail: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  orgName: z.string().optional(),
  orgType: z.string().optional(),
  budgetRange: z.string().optional(),
  timeline: z.string().optional(),
  helpType: z.string().min(1, "Please select the type of help you need"),
  message: z.string().min(10, "Please provide at least 10 characters"),
});
type InquiryForm = z.infer<typeof inquirySchema>;

function WriterCard({ writer, onContact }: { writer: GrantWriter; onContact: (writer: GrantWriter) => void }) {
  return (
    <Card className="flex flex-col border-gray-200 hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-6 flex flex-col items-center text-center border-b border-gray-100">
        <div className="relative mb-3">
          <img
            src={writer.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=f59e0b&color=fff&size=120`}
            alt={writer.name}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-md"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=f59e0b&color=fff&size=120`;
            }}
          />
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-gray-900">{writer.name}</h3>
        <div className="flex items-center gap-1.5 text-amber-600 text-sm font-medium mt-1">
          <Award className="w-4 h-4" />
          <span>Certified Grant Writer</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{writer.yearsExperience}+ years experience</span>
        </div>
        {writer.location && (
          <div className="flex items-center gap-1 text-gray-400 text-xs mt-1">
            <MapPin className="w-3 h-3" />
            <span>{writer.location}</span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-col flex-1 p-5 gap-4">
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{writer.bio}</p>

        {writer.niches.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Serves
            </p>
            <div className="flex flex-wrap gap-1.5">
              {writer.niches.map((niche) => (
                <Badge key={niche} className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium">
                  {niche}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {writer.specialties.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {writer.specialties.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
              {writer.specialties.length > 3 && (
                <Badge variant="secondary" className="text-xs">+{writer.specialties.length - 3} more</Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          {writer.websiteUrl && (
            <a href={writer.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-amber-600 transition-colors">
              <Globe className="w-4 h-4" />
            </a>
          )}
          {writer.linkedinUrl && (
            <a href={writer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
              <Linkedin className="w-4 h-4" />
            </a>
          )}
        </div>

        <Button
          onClick={() => onContact(writer)}
          className="mt-auto w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold shadow-sm"
        >
          <Mail className="w-4 h-4 mr-2" />
          Contact {writer.name.split(" ")[0]}
        </Button>
      </CardContent>
    </Card>
  );
}

function ContactModal({
  writer,
  open,
  onClose,
  userFirstName,
  userLastName,
  userEmail,
}: {
  writer: GrantWriter | null;
  open: boolean;
  onClose: () => void;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
}) {
  const { toast } = useToast();
  const form = useForm<InquiryForm>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      senderName: userFirstName && userLastName ? `${userFirstName} ${userLastName}` : "",
      senderEmail: userEmail || "",
      phone: "",
      orgName: "",
      orgType: "",
      budgetRange: "",
      timeline: "",
      helpType: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InquiryForm) => {
      const res = await apiRequest(`/api/grant-writers/${writer!.id}/inquire`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Inquiry sent!",
        description: `${writer?.name} will be in touch with you soon.`,
      });
      form.reset();
      onClose();
    },
    onError: () => {
      toast({
        title: "Failed to send inquiry",
        description: "Please try again or email them directly.",
        variant: "destructive",
      });
    },
  });

  if (!writer) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img
              src={writer.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=f59e0b&color=fff&size=60`}
              alt={writer.name}
              className="w-9 h-9 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(writer.name)}&background=f59e0b&color=fff&size=60`; }}
            />
            Contact {writer.name}
          </DialogTitle>
          <DialogDescription>
            Fill out the form below and {writer.name.split(" ")[0]} will receive your inquiry directly.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="senderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="senderEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input type="tel" placeholder="(555) 000-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl><Input placeholder="Your org or business" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="orgType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Nonprofit">Nonprofit</SelectItem>
                      <SelectItem value="Small Business">Small Business</SelectItem>
                      <SelectItem value="Faith-Based">Faith-Based Organization</SelectItem>
                      <SelectItem value="Education">Education Institution</SelectItem>
                      <SelectItem value="Healthcare">Healthcare Organization</SelectItem>
                      <SelectItem value="Government">Government / Public Agency</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="helpType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of Help Needed</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select one…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Grant Research">Grant Research</SelectItem>
                      <SelectItem value="Grant Writing">Grant Writing</SelectItem>
                      <SelectItem value="Full Application Support">Full Application Support</SelectItem>
                      <SelectItem value="Review & Feedback">Review & Feedback</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budgetRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Range</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select range…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Under $5k">Under $5,000</SelectItem>
                        <SelectItem value="$5k–$15k">$5,000 – $15,000</SelectItem>
                        <SelectItem value="$15k–$50k">$15,000 – $50,000</SelectItem>
                        <SelectItem value="$50k+">$50,000+</SelectItem>
                        <SelectItem value="Not sure">Not sure yet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeline</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select timeline…" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ASAP">ASAP</SelectItem>
                        <SelectItem value="1–3 months">1–3 months</SelectItem>
                        <SelectItem value="3–6 months">3–6 months</SelectItem>
                        <SelectItem value="Flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell them about your project, funding goals, and any deadlines…"
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              >
                {mutation.isPending ? "Sending…" : "Send Inquiry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function GrantWritersPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeNiche, setActiveNiche] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedWriter, setSelectedWriter] = useState<GrantWriter | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const { data: allWriters = [], isLoading: writersLoading } = useQuery<GrantWriter[]>({
    queryKey: ["/api/grant-writers"],
    queryFn: async () => {
      const res = await fetch("/api/grant-writers", { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const locations = useMemo(() => {
    const locs = allWriters
      .map((w) => w.location)
      .filter((l): l is string => Boolean(l));
    return Array.from(new Set(locs)).sort();
  }, [allWriters]);

  const filteredWriters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allWriters.filter((w) => {
      const matchesNiche = activeNiche === "All" || w.niches.includes(activeNiche);
      const matchesLocation = locationFilter === "all" || w.location === locationFilter;
      const matchesSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.specialties.some((s) => s.toLowerCase().includes(q)) ||
        w.niches.some((n) => n.toLowerCase().includes(q)) ||
        (w.bio && w.bio.toLowerCase().includes(q));
      return matchesNiche && matchesLocation && matchesSearch;
    });
  }, [allWriters, activeNiche, locationFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== "" || activeNiche !== "All" || locationFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setActiveNiche("All");
    setLocationFilter("all");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/signin" />;
  }

  const handleContact = (writer: GrantWriter) => {
    setSelectedWriter(writer);
    setContactOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <Header />
      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-6 h-6 text-amber-500" />
                <span className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Coach K Certified</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Certified Grant Writers</h1>
              <p className="text-gray-500 mt-2 max-w-2xl">
                Browse our roster of certified grant writing professionals. Each writer has been personally vetted and certified through Coach K's program.
              </p>
            </div>

            {/* Search + Location filter row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or specialty…"
                  className="pl-9 bg-white border-gray-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-52 bg-white border-gray-200">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Niche filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {NICHES.map((niche) => (
                <button
                  key={niche}
                  onClick={() => setActiveNiche(niche)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeNiche === niche
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700"
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>

            {/* Active filters + result count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {writersLoading ? "Loading…" : `${filteredWriters.length} writer${filteredWriters.length !== 1 ? "s" : ""} found`}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear filters
                </button>
              )}
            </div>

            {/* Writers grid */}
            {writersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                    <div className="bg-amber-50 p-6 flex flex-col items-center gap-3">
                      <div className="w-24 h-24 rounded-full bg-gray-200" />
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-4/5" />
                      <div className="h-8 bg-gray-200 rounded mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredWriters.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No writers match your search</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or search terms</p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="mt-4 text-amber-600 border-amber-200 hover:bg-amber-50">
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredWriters.map((writer) => (
                  <WriterCard key={writer.id} writer={writer} onContact={handleContact} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <ContactModal
        writer={selectedWriter}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        userFirstName={(user as any)?.firstName}
        userLastName={(user as any)?.lastName}
        userEmail={(user as any)?.email}
      />
    </div>
  );
}
