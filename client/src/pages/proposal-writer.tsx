import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, Upload, CheckCircle, AlertCircle, Loader2, PenTool, ExternalLink, Download, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import Sidebar from "@/components/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ProposalStep = 1 | 2 | 3 | 4 | 5 | 6;

interface GrantAnalysis {
  grantType: "government" | "foundation" | "corporate" | "other";
  formattingStandards: string[];
  keyRequirements: string[];
  fundingPriorities: string[];
  deadline?: string;
  maxWordCount?: number;
}

interface ProposalOutline {
  coverLetter: string;
  executiveSummary: string;
  statementOfNeed: string;
  projectDescription: {
    objectives: string;
    methods: string;
    timeline: string;
  };
  budget: string;
  impactStatement: string;
  evaluationPlan: string;
  sustainabilityPlan: string;
  organizationalBackground: string;
  appendices: string;
}

interface ComplianceCheck {
  section: string;
  status: "compliant" | "warning" | "error";
  message: string;
  suggestion?: string;
}

export default function ProposalWriterPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<ProposalStep>(1);
  const [grantUrl, setGrantUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [grantText, setGrantText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [grantAnalysis, setGrantAnalysis] = useState<GrantAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Project information (Step 3)
  const [projectPurpose, setProjectPurpose] = useState("");
  const [targetCommunity, setTargetCommunity] = useState("");
  const [primaryGoals, setPrimaryGoals] = useState("");
  const [proposalOutline, setProposalOutline] = useState<ProposalOutline | null>(null);
  
  // Section drafts (Step 4)
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState<string>("executiveSummary");
  const [isGeneratingSection, setIsGeneratingSection] = useState(false);
  
  // Compliance checks (Step 5)
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([]);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
  
  // Final draft (Step 6)
  const [finalDraft, setFinalDraft] = useState("");
  const [isCompilingDraft, setIsCompilingDraft] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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

  const steps = [
    { number: 1, title: "Grant Information", description: "Provide the grant details" },
    { number: 2, title: "Grant Analysis", description: "AI analyzes requirements" },
    { number: 3, title: "Project Info", description: "Describe your project" },
    { number: 4, title: "Write Sections", description: "Draft each section" },
    { number: 5, title: "Compliance Check", description: "Verify requirements" },
    { number: 6, title: "Final Review", description: "Review and export" },
  ];

  const sectionLabels: Record<string, string> = {
    coverLetter: "Cover Letter",
    executiveSummary: "Executive Summary",
    statementOfNeed: "Statement of Need",
    projectDescription: "Project Description",
    budget: "Budget",
    impactStatement: "Impact Statement",
    evaluationPlan: "Evaluation Plan",
    sustainabilityPlan: "Sustainability Plan",
    organizationalBackground: "Organizational Background",
    appendices: "Appendices",
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      try {
        const text = await extractTextFromPdf(file);
        setGrantText(text);
        toast({
          title: "PDF Uploaded",
          description: "Successfully extracted text from the grant guidelines.",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to extract text from PDF. Please paste the grant guidelines manually.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const typedArray = new Uint8Array(reader.result as ArrayBuffer);
          const pdfjsLib = await import('pdfjs-dist');
          
          // Use unpkg CDN which is more reliable
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          
          const loadingTask = pdfjsLib.getDocument({
            data: typedArray,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
          });
          
          const pdf = await loadingTask.promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          resolve(fullText.trim());
        } catch (err) {
          console.error('PDF extraction error:', err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const analyzeGrant = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch("/api/proposal-writer/analyze-grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          grantUrl,
          grantText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to analyze grant");
      }

      const analysis = await response.json();
      setGrantAnalysis(analysis);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Analysis Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateOutline = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch("/api/proposal-writer/generate-outline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          grantAnalysis,
          projectPurpose,
          targetCommunity,
          primaryGoals,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to generate outline");
      }

      const outline = await response.json();
      setProposalOutline(outline);
      
      // Initialize section drafts from outline
      const drafts: Record<string, string> = {};
      Object.keys(outline).forEach(key => {
        if (typeof outline[key] === 'string') {
          drafts[key] = outline[key];
        } else if (key === 'projectDescription') {
          drafts[key] = `Objectives:\n${outline[key].objectives}\n\nMethods:\n${outline[key].methods}\n\nTimeline:\n${outline[key].timeline}`;
        }
      });
      setSectionDrafts(drafts);
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const improveSection = async (sectionKey: string) => {
    setIsGeneratingSection(true);
    
    try {
      const response = await fetch("/api/proposal-writer/improve-section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          sectionName: sectionLabels[sectionKey],
          currentContent: sectionDrafts[sectionKey] || "",
          grantAnalysis,
          projectInfo: {
            purpose: projectPurpose,
            community: targetCommunity,
            goals: primaryGoals,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to improve section");
      }

      const { improvedContent } = await response.json();
      setSectionDrafts(prev => ({
        ...prev,
        [sectionKey]: improvedContent,
      }));
      
      toast({
        title: "Section Improved",
        description: `${sectionLabels[sectionKey]} has been enhanced by AI.`,
      });
    } catch (err: any) {
      toast({
        title: "Improvement Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSection(false);
    }
  };

  const checkCompliance = async () => {
    setIsCheckingCompliance(true);
    
    try {
      const response = await fetch("/api/proposal-writer/check-compliance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          sectionDrafts,
          grantAnalysis,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to check compliance");
      }

      const { checks } = await response.json();
      setComplianceChecks(checks);
      setCurrentStep(5);
    } catch (err: any) {
      toast({
        title: "Compliance Check Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingCompliance(false);
    }
  };

  const compileFinalDraft = async () => {
    setIsCompilingDraft(true);
    
    try {
      const response = await fetch("/api/proposal-writer/compile-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          sectionDrafts,
          grantAnalysis,
          projectInfo: {
            purpose: projectPurpose,
            community: targetCommunity,
            goals: primaryGoals,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to compile draft");
      }

      const { finalDraft: draft } = await response.json();
      setFinalDraft(draft);
      setCurrentStep(6);
    } catch (err: any) {
      toast({
        title: "Compilation Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsCompilingDraft(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(finalDraft);
      toast({
        title: "Copied!",
        description: "The proposal has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Please manually select and copy the text.",
        variant: "destructive",
      });
    }
  };

  const downloadAsTxt = () => {
    const blob = new Blob([finalDraft], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grant-proposal.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!grantUrl && !grantText && !pdfFile) {
        toast({
          title: "Information Required",
          description: "Please provide a grant URL or upload the grant guidelines PDF.",
          variant: "destructive",
        });
        return;
      }
      analyzeGrant();
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!projectPurpose || !targetCommunity || !primaryGoals) {
        toast({
          title: "Information Required",
          description: "Please fill in all project information fields.",
          variant: "destructive",
        });
        return;
      }
      generateOutline();
    } else if (currentStep === 4) {
      checkCompliance();
    } else if (currentStep === 5) {
      compileFinalDraft();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as ProposalStep);
    }
  };

  const resetWriter = () => {
    setCurrentStep(1);
    setGrantUrl("");
    setPdfFile(null);
    setGrantText("");
    setGrantAnalysis(null);
    setProjectPurpose("");
    setTargetCommunity("");
    setPrimaryGoals("");
    setProposalOutline(null);
    setSectionDrafts({});
    setComplianceChecks([]);
    setFinalDraft("");
    setError(null);
  };

  const getComplianceStatusColor = (status: ComplianceCheck["status"]) => {
    switch (status) {
      case "compliant": return "text-green-600 bg-green-100";
      case "warning": return "text-yellow-600 bg-yellow-100";
      case "error": return "text-red-600 bg-red-100";
    }
  };

  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

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
              <PenTool className="h-8 w-8 text-amber-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Grant Proposal Writer</h1>
                <p className="text-sm text-gray-500">AI-powered proposal generation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="hidden md:block sticky top-16 h-[calc(100vh-4rem)]">
          <Sidebar />
        </div>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.number 
                      ? "bg-amber-500 border-amber-500 text-white" 
                      : "bg-white border-gray-300 text-gray-400"
                  }`}>
                    {currentStep > step.number ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`hidden md:block w-12 lg:w-20 h-1 mx-2 ${
                      currentStep > step.number ? "bg-amber-500" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-center mt-2 text-sm text-gray-600">
              Step {currentStep}: {steps[currentStep - 1].title}
            </p>
          </div>

          {/* Step 1: Grant Information */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  Grant Information
                </CardTitle>
                <CardDescription>
                  Paste the URL of the grant you're applying for, or upload the PDF of the grant guidelines. 
                  This allows us to analyze the specific requirements and tailor the proposal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grant URL (optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/grant-guidelines"
                      value={grantUrl}
                      onChange={(e) => setGrantUrl(e.target.value)}
                      data-testid="input-grant-url"
                    />
                    {grantUrl && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(grantUrl, "_blank")}
                        data-testid="button-open-url"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="text-center text-gray-500">— OR —</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Grant Guidelines (PDF)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                      id="pdf-upload"
                      data-testid="input-pdf-upload"
                    />
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <span className="text-amber-600 hover:text-amber-700 font-medium">
                        Click to upload
                      </span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </label>
                    <p className="text-sm text-gray-400 mt-1">PDF files only</p>
                    {pdfFile && (
                      <Badge className="mt-2 bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {pdfFile.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-center text-gray-500">— OR —</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste Grant Guidelines
                  </label>
                  <Textarea
                    placeholder="Paste the grant requirements and guidelines here..."
                    value={grantText}
                    onChange={(e) => setGrantText(e.target.value)}
                    rows={8}
                    data-testid="textarea-grant-text"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Grant Analysis */}
          {currentStep === 2 && grantAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Grant Analysis Complete
                </CardTitle>
                <CardDescription>
                  We've analyzed the grant requirements. Review the details below before proceeding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Grant Type</h3>
                  <Badge className="bg-amber-100 text-amber-800 capitalize">
                    {grantAnalysis.grantType}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Formatting Standards</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {grantAnalysis.formattingStandards.map((standard, i) => (
                      <li key={i}>{standard}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Key Requirements</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {grantAnalysis.keyRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Funder Priorities</h3>
                  <div className="flex flex-wrap gap-2">
                    {grantAnalysis.fundingPriorities.map((priority, i) => (
                      <Badge key={i} variant="outline">{priority}</Badge>
                    ))}
                  </div>
                </div>

                {grantAnalysis.deadline && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Deadline</h3>
                    <Badge variant="destructive">{grantAnalysis.deadline}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Project Information */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  Project Information
                </CardTitle>
                <CardDescription>
                  Tell us about your project so we can create a tailored proposal outline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What is the purpose of your project?
                  </label>
                  <Textarea
                    placeholder="Describe the main purpose and mission of your project..."
                    value={projectPurpose}
                    onChange={(e) => setProjectPurpose(e.target.value)}
                    rows={4}
                    data-testid="textarea-project-purpose"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Who is the target community or audience for this project?
                  </label>
                  <Textarea
                    placeholder="Describe who will benefit from this project..."
                    value={targetCommunity}
                    onChange={(e) => setTargetCommunity(e.target.value)}
                    rows={4}
                    data-testid="textarea-target-community"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What are the primary goals and anticipated outcomes?
                  </label>
                  <Textarea
                    placeholder="List your main goals and the outcomes you expect to achieve..."
                    value={primaryGoals}
                    onChange={(e) => setPrimaryGoals(e.target.value)}
                    rows={4}
                    data-testid="textarea-primary-goals"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Write Sections */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-amber-600" />
                    Draft Your Proposal
                  </CardTitle>
                  <CardDescription>
                    Edit each section of your proposal. Use the AI button to enhance any section.
                  </CardDescription>
                </CardHeader>
              </Card>

              {Object.keys(sectionLabels).map((sectionKey) => (
                <Collapsible 
                  key={sectionKey}
                  open={expandedSections[sectionKey]}
                  onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, [sectionKey]: open }))}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50">
                        <CardTitle className="text-base">{sectionLabels[sectionKey]}</CardTitle>
                        {expandedSections[sectionKey] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        <Textarea
                          placeholder={`Write your ${sectionLabels[sectionKey].toLowerCase()} here...`}
                          value={sectionDrafts[sectionKey] || ""}
                          onChange={(e) => setSectionDrafts(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                          rows={8}
                          data-testid={`textarea-section-${sectionKey}`}
                        />
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            onClick={() => improveSection(sectionKey)}
                            disabled={isGeneratingSection}
                            data-testid={`button-improve-${sectionKey}`}
                          >
                            {isGeneratingSection ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <PenTool className="h-4 w-4 mr-2" />
                            )}
                            Enhance with AI
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}

          {/* Step 5: Compliance Check */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  Compliance Check
                </CardTitle>
                <CardDescription>
                  Review compliance status for each section against the grant requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {complianceChecks.length > 0 ? (
                  complianceChecks.map((check, i) => (
                    <div key={i} className={`p-4 rounded-lg ${getComplianceStatusColor(check.status)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{check.section}</h4>
                        <Badge className={getComplianceStatusColor(check.status)}>
                          {check.status === "compliant" ? "✓ Compliant" : 
                           check.status === "warning" ? "⚠ Warning" : "✗ Needs Attention"}
                        </Badge>
                      </div>
                      <p className="text-sm">{check.message}</p>
                      {check.suggestion && (
                        <p className="text-sm mt-2 italic">
                          Suggestion: {check.suggestion}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                    <p>Checking compliance...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 6: Final Review */}
          {currentStep === 6 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-600" />
                  Final Draft
                </CardTitle>
                <CardDescription>
                  Your complete grant proposal is ready. Review and make any final edits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={finalDraft}
                  onChange={(e) => setFinalDraft(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  data-testid="textarea-final-draft"
                />
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={resetWriter}
                    data-testid="button-start-new"
                  >
                    Start New Proposal
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={copyToClipboard}
                      data-testid="button-copy"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={downloadAsTxt}
                      className="bg-amber-500 hover:bg-amber-600"
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          {currentStep < 6 && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={currentStep === 1 ? () => setLocation("/") : handlePreviousStep}
                disabled={isAnalyzing || isGeneratingSection || isCheckingCompliance || isCompilingDraft}
                data-testid="button-previous"
              >
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={isAnalyzing || isGeneratingSection || isCheckingCompliance || isCompilingDraft}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-next"
              >
                {(isAnalyzing || isGeneratingSection || isCheckingCompliance || isCompilingDraft) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {currentStep === 1 ? "Analyze Grant" : 
                 currentStep === 2 ? "Continue to Project Info" :
                 currentStep === 3 ? "Generate Outline" :
                 currentStep === 4 ? "Check Compliance" :
                 "Compile Final Draft"}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
