import { Check, Clock, Trophy, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ApplicationProgressProps {
  currentStage: "Applied" | "In Review" | "Results";
  status?: "Applied" | "Under Review" | "Accepted" | "Rejected";
  remarks?: string;
  grantTitle?: string;
}

export default function ApplicationProgress({ currentStage, status, remarks, grantTitle }: ApplicationProgressProps) {
  const getResultsDescription = () => {
    if (status === "Accepted" || status === "Rejected") {
      return "Application reviewed - see feedback below";
    }
    return "Results will be announced";
  };

  const getInReviewDescription = () => {
    if (grantTitle) {
      return `${grantTitle} application is under review. You can check this page for updates or keep an eye on your email for the next steps.`;
    }
    return "Grant application is under review. You can check this page for updates or keep an eye on your email for the next steps.";
  };

  const stages = [
    {
      key: "Applied",
      label: "Applied",
      icon: Check,
      description: "Application submitted successfully"
    },
    {
      key: "In Review",
      label: "In Review",  
      icon: Clock,
      description: getInReviewDescription()
    },
    {
      key: "Results",
      label: "Results",
      icon: Trophy,
      description: getResultsDescription()
    }
  ];

  const getCurrentStageIndex = () => {
    return stages.findIndex(stage => stage.key === currentStage);
  };

  const currentIndex = getCurrentStageIndex();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Progress</h3>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={stage.key} className="flex items-center">
              {/* Step Circle */}
              <div className={`
                relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                ${isCompleted 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'bg-gray-100 border-gray-300 text-gray-400'
                }
              `}>
                <Icon className="w-5 h-5" />
                {isCurrent && (
                  <div className="absolute -top-2 -right-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
              
              {/* Step Label */}
              <div className="ml-3">
                <div className={`text-sm font-medium ${
                  isCompleted ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {stage.label}
                  {isCurrent && (
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-4 transition-colors
                  ${index < currentIndex ? 'bg-blue-500' : 'bg-gray-200'}
                `} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Current Stage Info - Hide for accepted applications */}
      {!(currentStage === "Results" && status === "Accepted") && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-sm text-purple-800 font-medium">
              {stages[currentIndex]?.description}
            </div>
          </div>
        </div>
      )}

      {/* Results Section - Show when status is Accepted or Rejected */}
      {currentStage === "Results" && status && (status === "Accepted" || status === "Rejected") && (
        <div className={`mt-4 rounded-lg p-4 border ${
          status === "Accepted" 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-start">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              status === "Accepted" ? "bg-green-100" : "bg-red-100"
            }`}>
              {status === "Accepted" ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium mb-2 ${
                status === "Accepted" ? "text-green-800" : "text-red-800"
              }`}>
                Application {status === "Accepted" ? "Accepted" : "Rejected"}
              </div>
              {remarks && (
                <div className={`text-sm ${
                  status === "Accepted" ? "text-green-700" : "text-red-700"
                }`}>
                  <strong>Company Feedback:</strong>
                  <p className="mt-1 whitespace-pre-wrap">{remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}