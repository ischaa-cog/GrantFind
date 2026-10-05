import { Play, Wallet, User, LogOut, Plus, Check, Building, Rocket, HelpCircle, X, ArrowLeft, MoreHorizontal, Menu, Home, Archive, ClipboardCheck, Feather, Search } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserBusiness } from "@shared/schema";

export default function Header() {
  const { user, logout, isLogoutPending } = useAuth();
  const { needsOnboarding } = useOnboarding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [isAddBusinessOpen, setIsAddBusinessOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBusinessType, setSelectedBusinessType] = useState("");
  const [businessForm, setBusinessForm] = useState({
    name: "",
    category: "",
    subcategory: "",
    entityType: "",
    yearEstablished: "",
    zipCode: "",
    website: "",
    revenue: ""
  });
  const [futureBusinessForm, setFutureBusinessForm] = useState({
    name: "",
    undecidedName: false,
    category: "",
    subcategory: "",
    zipCode: "",
    website: ""
  });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  // Fetch user businesses from API
  const { data: userBusinesses = [], isLoading: isLoadingBusinesses } = useQuery<UserBusiness[]>({
    queryKey: ["/api/user/businesses"],
    enabled: !!user,
  });

  // Create business mutation
  const createBusinessMutation = useMutation({
    mutationFn: async (businessData: any) => {
      const res = await apiRequest("/api/user/businesses", {
        method: "POST",
        body: JSON.stringify(businessData),
      });
      return await res.json();
    },
    onSuccess: (newBusiness: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/businesses"] });
      toast({
        title: "Success",
        description: "Business added successfully!",
      });
      // Auto-select the newly created business
      if (newBusiness?.name) {
        handleBusinessSelect(newBusiness.name);
      }
      // Mark onboarding as complete since user successfully created a business
      if (user?.id) {
        localStorage.setItem(`onboarding-completed-${user.id}`, 'true');
      }
      setIsAddBusinessOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add business",
        variant: "destructive",
      });
    },
  });

  // Handle business selection with persistence
  const handleBusinessSelect = (businessName: string) => {
    setSelectedBusiness(businessName);
    localStorage.setItem('selectedBusiness', businessName);
  };

  // Set default business selection
  useEffect(() => {
    if (!user || !userBusinesses) return;

    const savedBusiness = localStorage.getItem('selectedBusiness');
    
    if (userBusinesses.length === 0) {
      // No businesses exist
      setSelectedBusiness("No businesses added yet");
    } else if (savedBusiness && userBusinesses.some(b => b.name === savedBusiness)) {
      // Saved business exists in the list
      setSelectedBusiness(savedBusiness);
    } else {
      // Set first business as default
      const firstBusiness = userBusinesses[0].name;
      setSelectedBusiness(firstBusiness);
      localStorage.setItem('selectedBusiness', firstBusiness);
    }
  }, [user, userBusinesses]);

  // Auto-open business modal for new users who need onboarding
  useEffect(() => {
    // For users who need onboarding (have no businesses), show the modal
    // unless they explicitly completed onboarding before
    if (needsOnboarding && !localStorage.getItem(`onboarding-completed-${user?.id}`)) {
      setIsAddBusinessOpen(true);
    }
  }, [needsOnboarding, user?.id]);

  // Reset form function
  const resetForm = () => {
    setCurrentStep(1);
    setSelectedBusinessType("");
    setBusinessForm({
      name: "",
      category: "",
      subcategory: "",
      entityType: "",
      yearEstablished: "",
      zipCode: "",
      website: "",
      revenue: ""
    });
    setFutureBusinessForm({
      name: "",
      undecidedName: false,
      category: "",
      subcategory: "",
      zipCode: "",
      website: ""
    });
    setSelectedInterests([]);
  }

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/');
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: "Error",
        description: "Failed to logout properly",
        variant: "destructive",
      });
    }
  };

  const businessOptions = [
    {
      icon: Building,
      title: "I have an existing business",
      description: "Connect your established business to access grants"
    },
    {
      icon: Rocket,
      title: "I want to start a business",
      description: "Get funding to launch your new venture"
    },
    {
      icon: HelpCircle,
      title: "I'm here for something else",
      description: "Explore other funding opportunities"
    }
  ];
  return (
    <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center">
            <img 
              src="/grantfind-logo.png" 
              alt="GrantFind Logo" 
              className="h-6 md:h-8 object-contain"
            />
          </div>

          <div className="hidden md:block">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-sm text-gray-600 hover:text-gray-900 p-2">
                {selectedBusiness || "Select Business"}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4">
              <DropdownMenuLabel className="text-base font-semibold pb-3">
                Select a Business Profile
              </DropdownMenuLabel>
              <div className="space-y-2">
                {isLoadingBusinesses ? (
                  <DropdownMenuItem disabled className="p-3">
                    Loading businesses...
                  </DropdownMenuItem>
                ) : userBusinesses.length > 0 ? (
                  userBusinesses.map((business) => (
                    <DropdownMenuItem
                      key={business.id}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleBusinessSelect(business.name)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{business.name}</div>
                        <div className="text-sm text-gray-500">
                          {business.businessType === 'existing' ? 'Existing Business' : 
                           business.businessType === 'startup' ? 'Startup' : 'Other'}
                        </div>
                      </div>
                      {selectedBusiness === business.name && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="p-3 text-center text-gray-500">
                    No businesses added yet. Add your first business below.
                  </DropdownMenuItem>
                )}
              </div>
              <DropdownMenuSeparator className="my-3" />
              <DropdownMenuItem 
                className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-50 text-blue-600"
                onClick={() => setIsAddBusinessOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Business
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {/* User Profile Section */}
          {user && (
            <div className="flex items-center space-x-2 md:space-x-3 px-2 md:px-3 py-2 bg-gray-50 rounded-lg">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="h-3 w-3 md:h-4 md:w-4 text-white" />
              </div>
              <div className="hidden md:block flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
                disabled={isLogoutPending}
              >
                <LogOut className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop overlay to close menu when clicking outside */}
          <div 
            className="md:hidden fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-[65px] left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
            <div className="p-4 space-y-4">
              {/* Business Selector for Mobile */}
              <div className="border-b border-gray-100 pb-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => {
                    setIsAddBusinessOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {selectedBusiness || "Select Business"}
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Navigation Items */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setLocation("/");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors w-full text-left ${
                    location === "/" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Home className={`h-4 w-4 ${location === "/" ? "text-yellow-600" : "text-gray-400"}`} />
                  <span>Home</span>
                </button>
                
                <button
                  onClick={() => {
                    setLocation("/grants-vault");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors w-full text-left ${
                    location === "/grants-vault" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Archive className={`h-4 w-4 ${location === "/grants-vault" ? "text-yellow-600" : "text-gray-400"}`} />
                  <span>Grants Vault</span>
                </button>
                
                <button
                  onClick={() => {
                    setLocation("/application-reviewer");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors w-full text-left ${
                    location === "/application-reviewer" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-100"
                  }`}
                  data-testid="link-application-reviewer"
                >
                  <ClipboardCheck className={`h-4 w-4 ${location === "/application-reviewer" ? "text-yellow-600" : "text-gray-400"}`} />
                  <span>Application Reviewer</span>
                </button>
                
                <button
                  onClick={() => {
                    setLocation("/proposal-writer");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors w-full text-left ${
                    location === "/proposal-writer" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Feather className={`h-4 w-4 ${location === "/proposal-writer" ? "text-yellow-600" : "text-gray-400"}`} />
                  <span>Proposal Writer</span>
                </button>
                
                <button
                  onClick={() => {
                    setLocation("/grant-finder");
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors w-full text-left ${
                    location === "/grant-finder" ? "text-gray-900 bg-gray-100" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Search className={`h-4 w-4 ${location === "/grant-finder" ? "text-yellow-600" : "text-gray-400"}`} />
                  <span>Grant Finder</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Custom Modal Overlay */}
      {isAddBusinessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-2 md:mx-4 max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            {/* Single Close Button */}
            <button
              className="absolute top-2 right-2 md:top-4 md:right-4 z-10 text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors"
              onClick={() => {
                // Note: Don't mark onboarding as dismissed when user closes modal
                // They still need to complete business setup. Dismissal is only set
                // when they successfully create a business.
                setIsAddBusinessOpen(false);
                resetForm();
              }}
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          
          {currentStep === 1 ? (
            <div className="relative p-4 md:p-8">
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  Hi {user?.firstName}! What brings you to GrantFind?
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                {businessOptions.map((option, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center p-4 md:p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => {
                      if (option.title === "I have an existing business") {
                        setSelectedBusinessType("existing");
                        setCurrentStep(2);
                      } else if (option.title === "I want to start a business") {
                        setSelectedBusinessType("startup");
                        setCurrentStep(2);
                      } else if (option.title === "I'm here for something else") {
                        setSelectedBusinessType("other");
                        setCurrentStep(3);
                      } else {
                        console.log(`Selected: ${option.title}`);
                        setIsAddBusinessOpen(false);
                      }
                    }}
                  >
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3 md:mb-4 group-hover:bg-blue-100 transition-colors">
                      <option.icon className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 text-center mb-2">
                      {option.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 text-center">
                      {option.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : currentStep === 2 ? (
            <div className="relative p-4 md:p-8">
              {/* Header with Back button and Progress */}
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(1)}
                  className="text-blue-600 hover:text-blue-700 p-0 text-sm md:text-base"
                >
                  <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
                  Back
                </Button>
                
                {/* Progress indicators */}
                <div className="flex space-x-1 md:space-x-2">
                  <div className="w-6 md:w-8 h-2 bg-blue-600 rounded-full"></div>
                  <div className={`w-6 md:w-8 h-2 rounded-full ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`w-6 md:w-8 h-2 rounded-full ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                </div>

                {/* Empty div to maintain flex layout balance */}
                <div className="w-6 md:w-8"></div>
              </div>

              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                  {selectedBusinessType === "existing" ? "Enter your business details" : "Tell us about your future business"}
                </h2>
              </div>

              <div className="space-y-4 md:space-y-6">
                {selectedBusinessType === "existing" ? (
                  <>
                    {/* Existing Business Form */}
                    {/* Business Name */}
                    <div>
                      <Label htmlFor="businessName" className="text-sm font-medium text-gray-700 mb-2 block">
                        Business Name
                      </Label>
                      <div className="relative">
                        <Input
                          id="businessName"
                          placeholder="Enter your business name"
                          value={businessForm.name}
                          onChange={(e) => setBusinessForm({...businessForm, name: e.target.value})}
                          className="pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Future Business Form */}
                    {/* Business Name */}
                    <div>
                      <Label htmlFor="futureBusinessName" className="text-sm font-medium text-gray-700 mb-2 block">
                        Business Name
                      </Label>
                      <div className="relative">
                        <Input
                          id="futureBusinessName"
                          placeholder="Enter your business name"
                          value={futureBusinessForm.name}
                          onChange={(e) => setFutureBusinessForm({...futureBusinessForm, name: e.target.value})}
                          className="pr-10"
                          disabled={futureBusinessForm.undecidedName}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-400"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          id="undecidedName"
                          checked={futureBusinessForm.undecidedName}
                          onChange={(e) => setFutureBusinessForm({
                            ...futureBusinessForm, 
                            undecidedName: e.target.checked,
                            name: e.target.checked ? "" : futureBusinessForm.name
                          })}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <Label htmlFor="undecidedName" className="text-sm text-gray-600">
                          I haven't decided on a business name yet
                        </Label>
                      </div>
                    </div>
                  </>
                )}

                {/* Business Category and Subcategory */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Business Category
                    </Label>
                    {selectedBusinessType === "existing" ? (
                      <Select value={businessForm.category} onValueChange={(value) => setBusinessForm({...businessForm, category: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="services">Services</SelectItem>
                          <SelectItem value="non-profit">Non Profit Organization</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={futureBusinessForm.category} onValueChange={(value) => setFutureBusinessForm({...futureBusinessForm, category: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="services">Services</SelectItem>
                          <SelectItem value="non-profit">Non Profit Organization</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Business Subcategory
                    </Label>
                    {selectedBusinessType === "existing" ? (
                      <Select value={businessForm.subcategory} onValueChange={(value) => setBusinessForm({...businessForm, subcategory: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="consulting">Consulting</SelectItem>
                          <SelectItem value="ecommerce">E-commerce</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={futureBusinessForm.subcategory} onValueChange={(value) => setFutureBusinessForm({...futureBusinessForm, subcategory: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="consulting">Consulting</SelectItem>
                          <SelectItem value="ecommerce">E-commerce</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Entity Type and Zip Code OR just Zip Code for future business */}
                {selectedBusinessType === "existing" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        Business Entity Type
                      </Label>
                      <Select value={businessForm.entityType} onValueChange={(value) => setBusinessForm({...businessForm, entityType: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="llc">LLC</SelectItem>
                          <SelectItem value="corporation">Corporation</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="sole-proprietorship">Sole Proprietorship</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="zipCode" className="text-sm font-medium text-gray-700 mb-2 block">
                        Zip Code
                      </Label>
                      <Input
                        id="zipCode"
                        placeholder="Eg. 90011"
                        value={businessForm.zipCode}
                        onChange={(e) => setBusinessForm({...businessForm, zipCode: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="futureZipCode" className="text-sm font-medium text-gray-700 mb-2 block">
                      Zip Code
                    </Label>
                    <Input
                      id="futureZipCode"
                      placeholder="Eg. 90011"
                      value={futureBusinessForm.zipCode}
                      onChange={(e) => setFutureBusinessForm({...futureBusinessForm, zipCode: e.target.value})}
                    />
                  </div>
                )}

                {/* Year Established and Website OR just Website for future business */}
                {selectedBusinessType === "existing" ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                          Year Established
                        </Label>
                        <Select value={businessForm.yearEstablished} onValueChange={(value) => setBusinessForm({...businessForm, yearEstablished: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({length: 30}, (_, i) => {
                              const year = new Date().getFullYear() - i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="website" className="text-sm font-medium text-gray-700 mb-2 block">
                          Website (if available)
                        </Label>
                        <Input
                          id="website"
                          placeholder="Eg. tryskip.com"
                          value={businessForm.website}
                          onChange={(e) => setBusinessForm({...businessForm, website: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Revenue */}
                    <div>
                      <Label htmlFor="revenue" className="text-sm font-medium text-gray-700 mb-2 block">
                        Approximate Annual Business Revenue (Enter $0 if Pre Revenue)
                      </Label>
                      <div className="relative">
                        <Input
                          id="revenue"
                          placeholder="Enter revenue amount"
                          value={businessForm.revenue}
                          onChange={(e) => setBusinessForm({...businessForm, revenue: e.target.value})}
                          className="pl-8"
                        />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <Label htmlFor="futureWebsite" className="text-sm font-medium text-gray-700 mb-2 block">
                      Website (if available)
                    </Label>
                    <Input
                      id="futureWebsite"
                      placeholder="Eg. tryskip.com"
                      value={futureBusinessForm.website}
                      onChange={(e) => setFutureBusinessForm({...futureBusinessForm, website: e.target.value})}
                    />
                  </div>
                )}

                {/* Continue Button */}
                <div className="flex justify-center pt-4 md:pt-6">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-12 py-2 md:py-3 rounded-lg w-full md:w-auto"
                    onClick={() => {
                      if (selectedBusinessType === "existing") {
                        console.log("Existing business form submitted:", businessForm);
                      } else {
                        console.log("Future business form submitted:", futureBusinessForm);
                      }
                      setCurrentStep(3);
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Step 3: Interest Selection
            <div className="relative p-4 md:p-8">
              {selectedBusinessType === "other" ? (
                // Simplified header for "other" option - no progress indicators
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(1)}
                    className="text-blue-600 hover:text-blue-700 p-0 text-sm md:text-base"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
                    Back
                  </Button>
                  
                  {/* Empty div to maintain flex layout balance */}
                  <div className="w-6 md:w-8"></div>
                </div>
              ) : (
                // Full header with progress for business workflows
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(2)}
                    className="text-blue-600 hover:text-blue-700 p-0 text-sm md:text-base"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1 md:mr-2" />
                    Back
                  </Button>
                  
                  {/* Progress indicators */}
                  <div className="flex space-x-1 md:space-x-2">
                    <div className="w-6 md:w-8 h-2 bg-blue-600 rounded-full"></div>
                    <div className="w-6 md:w-8 h-2 bg-blue-600 rounded-full"></div>
                    <div className="w-6 md:w-8 h-2 bg-blue-600 rounded-full"></div>
                  </div>

                  {/* Empty div to maintain flex layout balance */}
                  <div className="w-6 md:w-8"></div>
                </div>
              )}

              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
                  {selectedBusinessType === "other" ? "What are you looking for?" : "What are you interested in?"}
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  Select all that apply
                </p>
              </div>

              {/* Interest Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
                {[
                  "Grants",
                  "Financing", 
                  "Credit Help",
                  "Business Registration",
                  "Website",
                  "Business Plan",
                  "1-1 Expert Help",
                  "Marketing Help"
                ].map((interest) => (
                  <div
                    key={interest}
                    className={`p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all text-center ${
                      selectedInterests.includes(interest)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                    onClick={() => {
                      setSelectedInterests(prev => 
                        prev.includes(interest)
                          ? prev.filter(item => item !== interest)
                          : [...prev, interest]
                      );
                    }}
                  >
                    <span className="text-sm md:text-base font-medium">{interest}</span>
                  </div>
                ))}
              </div>

              {/* Finish Button */}
              <div className="flex justify-center">
                <Button 
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-8 md:px-12 py-2 md:py-3 rounded-lg w-full md:w-auto"
                  disabled={createBusinessMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    // Prepare the business data
                    let businessData: any = {
                      businessType: selectedBusinessType,
                      interests: selectedInterests,
                    };

                    if (selectedBusinessType === "existing") {
                      businessData = { ...businessData, ...businessForm };
                    } else if (selectedBusinessType === "startup") {
                      businessData = { 
                        ...businessData, 
                        name: futureBusinessForm.undecidedName ? "Undecided" : futureBusinessForm.name,
                        category: futureBusinessForm.category,
                        subcategory: futureBusinessForm.subcategory,
                        zipCode: futureBusinessForm.zipCode,
                        website: futureBusinessForm.website,
                      };
                    } else {
                      // For "other" option, create a generic business entry
                      businessData = {
                        ...businessData,
                        name: `${user?.firstName || 'User'}'s Profile`,
                      };
                    }

                    createBusinessMutation.mutate(businessData);
                  }}
                >
                  {createBusinessMutation.isPending ? "Adding..." : "Finish"}
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </header>
  );
}
