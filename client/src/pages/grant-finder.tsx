import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, CheckCircle, Loader2, ExternalLink, Calendar, DollarSign, Building, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import Sidebar from "@/components/sidebar";

type FinderStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface GrantResult {
  title: string;
  description: string;
  eligibility: string;
  deadline: string;
  amount: string;
  link: string;
  source?: string;
}

interface SearchCriteria {
  businessType: string;
  projectGoals: string;
  location: string;
  geographicScope: string;
  industry: string;
  fundingNeed: string;
  ownershipTypes: string[];
  hasAppliedBefore: string;
  grantPreference: string;
  currentDate: string;
}

export default function GrantFinderPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<FinderStep>(1);
  const [isSearching, setIsSearching] = useState(false);
  const [grantResults, setGrantResults] = useState<GrantResult[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  
  const [criteria, setCriteria] = useState<SearchCriteria>({
    businessType: "",
    projectGoals: "",
    location: "",
    geographicScope: "",
    industry: "",
    fundingNeed: "",
    ownershipTypes: [],
    hasAppliedBefore: "",
    grantPreference: "",
    currentDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/signin" />;
  }

  const questions = [
    { step: 1, title: "Business Type", question: "What type of business or organization do you represent?" },
    { step: 2, title: "Project Goals", question: "What are your project goals?" },
    { step: 3, title: "Location", question: "Where is your business located, and do you want to focus on local, national, or international grants?" },
    { step: 4, title: "Industry", question: "Which industry does your business operate in?" },
    { step: 5, title: "Funding Need", question: "What is your approximate funding need?" },
    { step: 6, title: "Ownership", question: "Is your business minority-owned, women-owned, veteran-owned, or disabled-owned?" },
    { step: 7, title: "Experience", question: "Have you applied for grants before?" },
    { step: 8, title: "Grant Preference", question: "Do you prefer federal, corporate, or foundation grants?" },
    { step: 9, title: "Date", question: "Confirm today's date" },
    { step: 10, title: "Results", question: "Your matched grants" },
  ];

  const businessTypes = [
    "Nonprofit Organization",
    "Small Business (1-50 employees)",
    "Medium Business (51-250 employees)",
    "Large Business (250+ employees)",
    "Startup",
    "Social Enterprise",
    "Educational Institution",
    "Research Organization",
    "Other",
  ];

  const industries = [
    "Healthcare & Medical",
    "Technology & Software",
    "Education & Training",
    "Agriculture & Food",
    "Manufacturing",
    "Clean Energy & Environment",
    "Arts & Culture",
    "Community Development",
    "Social Services",
    "Scientific Research",
    "Construction & Real Estate",
    "Retail & E-commerce",
    "Transportation & Logistics",
    "Other",
  ];

  const fundingRanges = [
    "Under $10,000",
    "$10,000 - $50,000",
    "$50,000 - $100,000",
    "$100,000 - $500,000",
    "$500,000 - $1,000,000",
    "Over $1,000,000",
  ];

  const ownershipOptions = [
    { id: "minority", label: "Minority-owned" },
    { id: "women", label: "Women-owned" },
    { id: "veteran", label: "Veteran-owned" },
    { id: "disabled", label: "Disabled-owned" },
    { id: "none", label: "None of the above" },
  ];

  const handleOwnershipChange = (id: string, checked: boolean) => {
    if (id === "none") {
      setCriteria(prev => ({
        ...prev,
        ownershipTypes: checked ? ["none"] : [],
      }));
    } else {
      setCriteria(prev => ({
        ...prev,
        ownershipTypes: checked 
          ? [...prev.ownershipTypes.filter(t => t !== "none"), id]
          : prev.ownershipTypes.filter(t => t !== id),
      }));
    }
  };

  const searchGrants = async () => {
    setIsSearching(true);
    
    try {
      const response = await fetch("/api/grant-finder/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(criteria),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to search grants");
      }

      const { grants } = await response.json();
      setGrantResults(grants);
      setCurrentStep(10);
    } catch (err: any) {
      toast({
        title: "Search Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !criteria.businessType) {
      toast({ title: "Please select a business type", variant: "destructive" });
      return;
    }
    if (currentStep === 2 && !criteria.projectGoals.trim()) {
      toast({ title: "Please describe your project goals", variant: "destructive" });
      return;
    }
    if (currentStep === 3 && (!criteria.location.trim() || !criteria.geographicScope)) {
      toast({ title: "Please provide your location and geographic preference", variant: "destructive" });
      return;
    }
    if (currentStep === 4 && !criteria.industry) {
      toast({ title: "Please select an industry", variant: "destructive" });
      return;
    }
    if (currentStep === 5 && !criteria.fundingNeed) {
      toast({ title: "Please select a funding range", variant: "destructive" });
      return;
    }
    if (currentStep === 6 && criteria.ownershipTypes.length === 0) {
      toast({ title: "Please select at least one option", variant: "destructive" });
      return;
    }
    if (currentStep === 7 && !criteria.hasAppliedBefore) {
      toast({ title: "Please answer the question", variant: "destructive" });
      return;
    }
    if (currentStep === 8 && !criteria.grantPreference) {
      toast({ title: "Please select a preference", variant: "destructive" });
      return;
    }

    if (currentStep === 9) {
      searchGrants();
    } else {
      setCurrentStep((currentStep + 1) as FinderStep);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as FinderStep);
    }
  };

  const resetFinder = () => {
    setCurrentStep(1);
    setHasStarted(false);
    setGrantResults([]);
    setCriteria({
      businessType: "",
      projectGoals: "",
      location: "",
      geographicScope: "",
      industry: "",
      fundingNeed: "",
      ownershipTypes: [],
      hasAppliedBefore: "",
      grantPreference: "",
      currentDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    });
  };

  const progressPercentage = currentStep === 10 ? 100 : ((currentStep - 1) / 9) * 100;

  // Welcome screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Search className="h-8 w-8 text-amber-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Business Grant Finder</h1>
                  <p className="text-sm text-gray-500">Find grants matched to your business</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar />
          </div>
          <main className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
            <Card className="text-center">
              <CardHeader className="pb-4">
                <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-10 w-10 text-amber-600" />
                </div>
                <CardTitle className="text-2xl">Find Your Perfect Grant</CardTitle>
                <CardDescription className="text-base mt-2">
                  Answer a few quick questions about your business and we'll match you with relevant grant opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setHasStarted(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-lg px-8 py-6"
                  data-testid="button-get-started"
                >
                  Click here to get started
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  Takes about 2 minutes to complete
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Search className="h-8 w-8 text-amber-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Business Grant Finder</h1>
                <p className="text-sm text-gray-500">Find grants matched to your business</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
          {currentStep < 10 && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Question {currentStep} of 9</span>
                <span>{Math.round(progressPercentage)}% complete</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {/* Question 1: Business Type */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[0].question}</CardTitle>
                <CardDescription>Select the option that best describes your organization</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={criteria.businessType}
                  onValueChange={(value) => setCriteria(prev => ({ ...prev, businessType: value }))}
                  className="space-y-3"
                >
                  {businessTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                      <RadioGroupItem value={type} id={type} />
                      <Label htmlFor={type} className="flex-1 cursor-pointer">{type}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Question 2: Project Goals */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[1].question}</CardTitle>
                <CardDescription>Describe what you need funding for (e.g., research, operational costs, expansion)</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={criteria.projectGoals}
                  onChange={(e) => setCriteria(prev => ({ ...prev, projectGoals: e.target.value }))}
                  placeholder="Describe your project goals and what you need funding for..."
                  className="w-full min-h-[150px] p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  data-testid="textarea-project-goals"
                />
              </CardContent>
            </Card>
          )}

          {/* Question 3: Location */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[2].question}</CardTitle>
                <CardDescription>Tell us where you're based and your geographic preference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium">Business Location</Label>
                  <Input
                    value={criteria.location}
                    onChange={(e) => setCriteria(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State, Country"
                    className="mt-2"
                    data-testid="input-location"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Geographic Scope Preference</Label>
                  <RadioGroup
                    value={criteria.geographicScope}
                    onValueChange={(value) => setCriteria(prev => ({ ...prev, geographicScope: value }))}
                    className="space-y-3"
                  >
                    {["Local grants only", "National grants", "International grants", "Open to all"].map((scope) => (
                      <div key={scope} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                        <RadioGroupItem value={scope} id={scope} />
                        <Label htmlFor={scope} className="flex-1 cursor-pointer">{scope}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question 4: Industry */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[3].question}</CardTitle>
                <CardDescription>Select your primary industry</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={criteria.industry}
                  onValueChange={(value) => setCriteria(prev => ({ ...prev, industry: value }))}
                >
                  <SelectTrigger data-testid="select-industry">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Question 5: Funding Need */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[4].question}</CardTitle>
                <CardDescription>Select your approximate funding range</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={criteria.fundingNeed}
                  onValueChange={(value) => setCriteria(prev => ({ ...prev, fundingNeed: value }))}
                  className="space-y-3"
                >
                  {fundingRanges.map((range) => (
                    <div key={range} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                      <RadioGroupItem value={range} id={range} />
                      <Label htmlFor={range} className="flex-1 cursor-pointer">{range}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Question 6: Ownership */}
          {currentStep === 6 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[5].question}</CardTitle>
                <CardDescription>Select all that apply</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ownershipOptions.map((option) => (
                    <div key={option.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                      <Checkbox
                        id={option.id}
                        checked={criteria.ownershipTypes.includes(option.id)}
                        onCheckedChange={(checked) => handleOwnershipChange(option.id, checked as boolean)}
                      />
                      <Label htmlFor={option.id} className="flex-1 cursor-pointer">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Question 7: Experience */}
          {currentStep === 7 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[6].question}</CardTitle>
                <CardDescription>This helps us tailor our recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={criteria.hasAppliedBefore}
                  onValueChange={(value) => setCriteria(prev => ({ ...prev, hasAppliedBefore: value }))}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                    <RadioGroupItem value="yes" id="exp-yes" />
                    <Label htmlFor="exp-yes" className="flex-1 cursor-pointer">Yes, I have applied for grants before</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                    <RadioGroupItem value="no" id="exp-no" />
                    <Label htmlFor="exp-no" className="flex-1 cursor-pointer">No, this is my first time</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Question 8: Grant Preference */}
          {currentStep === 8 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[7].question}</CardTitle>
                <CardDescription>Select your preference or choose "Open to all"</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={criteria.grantPreference}
                  onValueChange={(value) => setCriteria(prev => ({ ...prev, grantPreference: value }))}
                  className="space-y-3"
                >
                  {["Federal grants", "Corporate grants", "Foundation grants", "Open to all types"].map((pref) => (
                    <div key={pref} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border">
                      <RadioGroupItem value={pref} id={pref} />
                      <Label htmlFor={pref} className="flex-1 cursor-pointer">{pref}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Question 9: Date Confirmation */}
          {currentStep === 9 && (
            <Card>
              <CardHeader>
                <CardTitle>{questions[8].question}</CardTitle>
                <CardDescription>We'll use this to show you grants with active deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  <span className="text-lg font-medium">{criteria.currentDate}</span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Click "Find Grants" to search for grants matching your criteria.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    {grantResults.length} Grants Found
                  </CardTitle>
                  <CardDescription>
                    Based on your criteria, here are the best matching grant opportunities.
                  </CardDescription>
                </CardHeader>
              </Card>

              {grantResults.map((grant, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-amber-100 text-amber-800">#{index + 1}</Badge>
                          {grant.source && (
                            <Badge variant="outline" className="text-gray-600">
                              <Building className="h-3 w-3 mr-1" />
                              {grant.source}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{grant.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-700">{grant.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="font-medium">Eligibility:</span>
                          <p className="text-gray-600">{grant.eligibility}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <span className="font-medium">Deadline:</span>
                          <span className="text-gray-600 ml-1">{grant.deadline}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <div>
                          <span className="font-medium">Amount:</span>
                          <span className="text-gray-600 ml-1">{grant.amount}</span>
                        </div>
                      </div>
                    </div>

                    {grant.link && grant.link !== "Not specified" ? (
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        onClick={() => window.open(grant.link, "_blank")}
                        data-testid={`button-apply-${index}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Apply Now
                      </Button>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-2">
                        Search for this grant on grants.gov or the funder's website to apply.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Call to Action - Mandatory message under results */}
              <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-800 leading-relaxed">
                    Ready to discover the grant funding secrets that successful entrepreneurs use to fuel their businesses? 
                    Join my Business and Grant community to learn how you can secure 6-figure grants, save time, 
                    and access the funding you deserve—even if you're not a pro grant writer!
                  </p>
                  <Button
                    className="mt-4 bg-amber-500 hover:bg-amber-600"
                    onClick={() => window.open("https://businessgrantcommunity.com", "_blank")}
                    data-testid="button-cta"
                  >
                    Reserve your spot now ➔
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={resetFinder}
                  data-testid="button-start-new"
                >
                  Start New Search
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {currentStep < 10 && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={currentStep === 1 ? resetFinder : handlePrevious}
                disabled={isSearching}
                data-testid="button-previous"
              >
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>
              <Button
                onClick={handleNext}
                disabled={isSearching}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-next"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : currentStep === 9 ? (
                  "Find Grants"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
