import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
import { useLocation } from "wouter";

interface ThankYouPageProps {
  grantTitle: string;
  thankYouHeadline?: string | null;
  thankYouSubheadline?: string | null;
  nextStepsHeadline?: string | null;
  nextStepsSubheadline?: string | null;
  nextStepsContent1?: string | null;
  nextStepsCtaText?: string | null;
  nextStepsCtaUrl?: string | null;
  nextStepsContent2?: string | null;
}

export function ThankYouPage({
  grantTitle,
  thankYouHeadline,
  thankYouSubheadline,
  nextStepsHeadline,
  nextStepsSubheadline,
  nextStepsContent1,
  nextStepsCtaText,
  nextStepsCtaUrl,
  nextStepsContent2,
}: ThankYouPageProps) {
  const [, setLocation] = useLocation();

  const handleBackToDashboard = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 px-4 relative">
      {/* Close Button */}
      <button
        onClick={handleBackToDashboard}
        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        aria-label="Close and return to dashboard"
        data-testid="button-close-thank-you"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Main Thank You Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {thankYouHeadline || "Thank you for applying for"}
          </h1>
          <h2 className="text-3xl md:text-4xl font-bold text-[hsl(45,100%,51%)] mb-6">
            {grantTitle}!
          </h2>
          <p className="text-xl text-gray-300">
            {thankYouSubheadline || "Your application has been submitted successfully"}
          </p>
        </div>

        {/* What Happens Next Section */}
        <div className="bg-gradient-to-br from-amber-100 to-yellow-50 rounded-lg p-8 md:p-12 text-gray-900 shadow-2xl">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-4 text-[hsl(45,100%,40%)]">
            {nextStepsHeadline || "What happens next?"}
          </h3>
          
          {nextStepsSubheadline && (
            <p className="text-center text-lg font-semibold mb-8">
              {nextStepsSubheadline}
            </p>
          )}

          <div className="space-y-6">
            {nextStepsContent1 && (
              <div className="text-gray-700 whitespace-pre-wrap">
                {nextStepsContent1}
              </div>
            )}

            {nextStepsCtaText && nextStepsCtaUrl && (
              <div className="flex justify-center my-8">
                <Button
                  asChild
                  className="bg-[hsl(45,100%,51%)] hover:bg-[hsl(45,100%,45%)] text-black font-bold text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-xl transition-all uppercase"
                >
                  <a href={nextStepsCtaUrl} target="_blank" rel="noopener noreferrer">
                    {nextStepsCtaText}
                    <ExternalLink className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </div>
            )}

            {nextStepsContent2 && (
              <div className="text-gray-700 whitespace-pre-wrap mt-6">
                {nextStepsContent2}
              </div>
            )}
          </div>
        </div>

        {/* Back to Dashboard Button */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleBackToDashboard}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 px-8 py-6 text-lg font-semibold"
            data-testid="button-back-to-dashboard"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
