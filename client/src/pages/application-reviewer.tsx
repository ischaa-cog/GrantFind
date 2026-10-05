import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, Upload, CheckCircle, AlertCircle, Loader2, ClipboardCheck, ExternalLink } from "lucide-react";
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

type ReviewStep = 1 | 2 | 3 | 4 | 5;

interface ScoreItem {
  criteria: string;
  score: number;
  maxScore: number;
  notes: string;
}

interface ReviewResult {
  scores: ScoreItem[];
  totalScore: number;
  maxTotalScore: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export default function ApplicationReviewerPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<ReviewStep>(1);
  const [grantRequirements, setGrantRequirements] = useState("");
  const [grantUrl, setGrantUrl] = useState("");
  const [applicationText, setApplicationText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    { number: 1, title: "Grant Requirements", description: "Provide the grant details" },
    { number: 2, title: "Application Upload", description: "Upload your application" },
    { number: 3, title: "Analysis", description: "AI reviews your application" },
    { number: 4, title: "Scoring", description: "View your scores" },
    { number: 5, title: "Recommendations", description: "Get improvement tips" },
  ];

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      try {
        const text = await extractTextFromPdf(file);
        setApplicationText(text);
        toast({
          title: "PDF Uploaded",
          description: "Successfully extracted text from your application.",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to extract text from PDF. Please paste your application text manually.",
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

  const analyzeApplication = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/review-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          grantRequirements: grantRequirements || `Grant URL: ${grantUrl}`,
          applicationText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze application');
      }

      const result = await response.json();
      setReviewResult(result);
      // Stay on Step 3 to show success state - user clicks "View Results" to proceed
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis');
      toast({
        title: "Analysis Failed",
        description: err.message || 'Failed to analyze your application. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !grantRequirements && !grantUrl) {
      toast({
        title: "Missing Information",
        description: "Please provide the grant requirements or URL before proceeding.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep === 2 && !applicationText) {
      toast({
        title: "Missing Application",
        description: "Please upload your application PDF or paste the text before proceeding.",
        variant: "destructive",
      });
      return;
    }
    if (currentStep === 2) {
      setCurrentStep(3);
      analyzeApplication();
    } else if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as ReviewStep);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as ReviewStep);
    }
  };

  const resetReview = () => {
    setCurrentStep(1);
    setGrantRequirements("");
    setGrantUrl("");
    setApplicationText("");
    setPdfFile(null);
    setReviewResult(null);
    setError(null);
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "text-green-600 bg-green-100";
    if (percentage >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
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
              <ClipboardCheck className="h-8 w-8 text-amber-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Grant Application Reviewer</h1>
                <p className="text-sm text-gray-500">AI-powered application analysis</p>
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
                  <div className={`hidden md:block w-16 lg:w-24 h-1 mx-2 ${
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

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-600" />
                Grant Requirements
              </CardTitle>
              <CardDescription>
                Provide the grant requirements so we can evaluate your application against them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Paste Grant Requirements
                </label>
                <Textarea
                  placeholder="Paste the full grant requirements here (eligibility criteria, objectives, evaluation criteria, etc.)"
                  value={grantRequirements}
                  onChange={(e) => setGrantRequirements(e.target.value)}
                  rows={10}
                  className="w-full"
                  data-testid="input-grant-requirements"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-sm text-gray-500">OR</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Grant Website URL
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/grant-details"
                  value={grantUrl}
                  onChange={(e) => setGrantUrl(e.target.value)}
                  data-testid="input-grant-url"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll analyze the grant requirements from this URL.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-amber-600" />
                Upload Your Application
              </CardTitle>
              <CardDescription>
                Upload your grant application as a PDF or paste the text directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-amber-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                  id="pdf-upload"
                  data-testid="input-pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-700">
                    {pdfFile ? pdfFile.name : "Click to upload PDF"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {pdfFile ? "Click to replace" : "or drag and drop your application here"}
                  </p>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-sm text-gray-500">OR</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Paste Application Text
                </label>
                <Textarea
                  placeholder="Paste your full grant application text here..."
                  value={applicationText}
                  onChange={(e) => setApplicationText(e.target.value)}
                  rows={15}
                  className="w-full font-mono text-sm"
                  data-testid="input-application-text"
                />
                {applicationText && (
                  <p className="text-xs text-gray-500 mt-1">
                    {applicationText.split(/\s+/).length} words
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isAnalyzing ? (
                  <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                ) : error ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                Analyzing Your Application
              </CardTitle>
              <CardDescription>
                {isAnalyzing 
                  ? "Our AI is reviewing your application against the grant requirements..."
                  : error 
                    ? "There was an issue analyzing your application."
                    : "Analysis complete! View your results."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAnalyzing && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-lg">
                    <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                    <div>
                      <p className="font-medium">Analyzing application...</p>
                      <p className="text-sm text-gray-600">This may take a minute</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Checking grammar and clarity
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                      Evaluating alignment with grant goals
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      Generating improvement recommendations
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Analysis Failed</span>
                  </div>
                  <p className="text-sm text-red-600 mt-2">{error}</p>
                  <div className="flex gap-3 mt-4">
                    <Button 
                      onClick={() => setCurrentStep(2)}
                      variant="outline"
                      data-testid="button-back-to-edit"
                    >
                      Edit Application
                    </Button>
                    <Button 
                      onClick={() => { setError(null); analyzeApplication(); }}
                      className="bg-amber-500 hover:bg-amber-600"
                      data-testid="button-retry-analysis"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
              {!isAnalyzing && !error && reviewResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Analysis Complete!</span>
                  </div>
                  <p className="text-sm text-green-600 mt-2">Your application has been reviewed. Click below to see your scores and recommendations.</p>
                  <Button 
                    onClick={() => setCurrentStep(4)}
                    className="mt-4 bg-amber-500 hover:bg-amber-600"
                    data-testid="button-view-results"
                  >
                    View Results
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && reviewResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
                Application Score
              </CardTitle>
              <CardDescription>
                Your application has been scored against the grant criteria.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-lg text-white text-center">
                <p className="text-sm uppercase tracking-wide opacity-90">Overall Score</p>
                <p className="text-4xl font-bold">{reviewResult.totalScore}/{reviewResult.maxTotalScore}</p>
                <p className="text-sm opacity-90">
                  {Math.round((reviewResult.totalScore / reviewResult.maxTotalScore) * 100)}% match
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-scores">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Evaluation Criteria</th>
                      <th className="text-center py-3 px-2">Score</th>
                      <th className="text-left py-3 px-2">Notes/Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewResult.scores.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-2 font-medium">{item.criteria}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={getScoreColor(item.score, item.maxScore)}>
                            {item.score}/{item.maxScore}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-gray-600">{item.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 5 && reviewResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {reviewResult.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {reviewResult.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-1 flex-shrink-0" />
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{reviewResult.feedback}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4 justify-center">
              <Button
                variant="outline"
                onClick={resetReview}
                data-testid="button-new-review"
              >
                Start New Review
              </Button>
              <Button
                onClick={() => setLocation("/")}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-back-to-dashboard"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}

        {currentStep < 5 && (
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => setLocation("/") : handlePreviousStep}
              disabled={isAnalyzing}
              data-testid="button-previous"
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>
            {currentStep !== 3 && (
              <Button
                onClick={handleNextStep}
                disabled={isAnalyzing}
                className="bg-amber-500 hover:bg-amber-600"
                data-testid="button-next"
              >
                {currentStep === 2 ? "Analyze Application" : currentStep === 4 ? "View Recommendations" : "Next"}
              </Button>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
