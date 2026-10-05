import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, ArrowRight, Check, Users, DollarSign, Clock, Award, TrendingUp, Building, Globe, Zap, Target, Sparkles } from 'lucide-react';
import type { Grant } from '@shared/schema';
import { formatDeadlineWithDays } from '@/lib/timezone';

import Grant_Find__Logo__1 from "@assets/Grant Find (Logo) 1.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('find');
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [animatedStats, setAnimatedStats] = useState({
    businesses: 0,
    funding: 0,
    grants: 0
  });

  // Fetch real grants from database
  const { data: dbGrants = [] } = useQuery<Grant[]>({
    queryKey: ["/api/grants"],
  });

  const features = [
    {
      icon: DollarSign,
      title: "Find Funding Opportunities",
      description: "Access thousands of grants, funding programs, and investment opportunities tailored to your business needs.",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: Clock,
      title: "Complete Applications Faster", 
      description: "Streamlined application process with AI-powered assistance to help you submit winning proposals quickly.",
      color: "bg-green-100 text-green-600"
    },
    {
      icon: TrendingUp,
      title: "Access Quick Funding",
      description: "Discover fast-track funding opportunities designed for qualifying businesses that need rapid financial support.",
      color: "bg-purple-100 text-purple-600"
    },
    {
      icon: Award,
      title: "Let GrantFind Apply For You",
      description: "Our expert team can handle the entire application process, from research to submission.",
      color: "bg-orange-100 text-orange-600"
    }
  ];

  const stats = [
    { label: "Businesses Funded", value: "82 Billion", icon: Building },
    { label: "Success Rate", value: "94%", icon: TrendingUp },
    { label: "Active Grants", value: "50,000+", icon: Award },
    { label: "Countries", value: "25+", icon: Globe }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Tech Startup Founder",
      company: "InnovateLab",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=64&h=64&fit=crop&crop=face&auto=format",
      quote: "GrantFind helped us secure $5K in funding within 3 months. The platform made the entire process seamless.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez", 
      role: "Small Business Owner",
      company: "GreenTech Solutions",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face",
      quote: "The instant grant program was a game-changer for our business. We got funding when we needed it most.",
      rating: 5
    },
    {
      name: "Emily Johnson",
      role: "Non-profit Director", 
      company: "Community First",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=face",
      quote: "Over $15K in funding secured through GrantFind. The platform connects you with the right opportunities.",
      rating: 5
    }
  ];

  const partners = [
    { name: "Microsoft", logo: "https://logo.clearbit.com/microsoft.com" },
    { name: "Google", logo: "https://logo.clearbit.com/google.com" },
    { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com" },
    { name: "Meta", logo: "https://logo.clearbit.com/meta.com" },
    { name: "Apple", logo: "https://logo.clearbit.com/apple.com" }
  ];

  // Transform real grants into highlight format
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount}`;
  };

  const getColorForAmount = (amount: number) => {
    if (amount >= 100000) return "from-purple-500 to-pink-500";
    if (amount >= 50000) return "from-green-500 to-emerald-500";
    if (amount >= 25000) return "from-blue-500 to-cyan-500";
    return "from-orange-500 to-red-500";
  };

  const getCategoryFromTitle = (title: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('tech') || titleLower.includes('ai') || titleLower.includes('digital')) return 'Technology';
    if (titleLower.includes('green') || titleLower.includes('environment') || titleLower.includes('sustainability')) return 'Sustainability';
    if (titleLower.includes('women') || titleLower.includes('diversity') || titleLower.includes('minority')) return 'Diversity';
    if (titleLower.includes('small') || titleLower.includes('relief') || titleLower.includes('general')) return 'General';
    return 'Business';
  };

  const grantHighlights = dbGrants
    .filter(grant => new Date(grant.deadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4)
    .map((grant, index) => {
      const daysLeft = Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        title: grant.title,
        amount: formatAmount(grant.amount),
        company: grant.company,
        deadline: formatDeadlineWithDays(grant.deadline),
        category: getCategoryFromTitle(grant.title),
        hot: grant.isHot || daysLeft <= 7,
        color: getColorForAmount(grant.amount)
      };
    });

  // Animated stats effect
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const stepTime = duration / steps;
    
    const targets = {
      businesses: 82,
      funding: 2.5,
      grants: 50000
    };

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedStats({
        businesses: Math.floor(targets.businesses * easeOut),
        funding: (targets.funding * easeOut),
        grants: Math.floor(targets.grants * easeOut)
      });
      
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  // Rotating grant highlights
  useEffect(() => {
    if (grantHighlights.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentHighlight((prev) => (prev + 1) % grantHighlights.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [grantHighlights.length]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img 
                src="/grantfind-logo.png" 
                alt="GrantFind Logo" 
                className="h-8 object-contain"
              />
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#funding" className="text-gray-600 hover:text-gray-900">Funding Options</a>
              <a href="#footer" className="text-gray-600 hover:text-gray-900">Contact</a>
            </nav>

            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => setLocation('/company/auth')}
                className="text-gray-600 hover:text-gray-900"
              >
                Company Login
              </Button>
              <Button
                onClick={() => setLocation('/signin')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Hero Section with Animated Welcome */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-32 right-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-amber-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center relative">
            {/* Animated Badge */}
            <div className="mb-6 inline-flex items-center">
              <Badge className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white hover:from-yellow-700 hover:to-yellow-800 px-6 py-2 text-sm font-semibold animate-pulse">
                <Sparkles className="w-4 h-4 mr-2" />
                Find Grant Funding
              </Badge>
            </div>

            {/* Main Heading with Gradient */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-gray-900 via-yellow-800 to-yellow-900 bg-clip-text text-transparent animate-gradient-x">
                Find Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-700 bg-clip-text text-transparent animate-gradient-x">
                Grant Funding
              </span>
              <br />
              <span className="text-gray-900">Today</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Connect with thousands of grants and funding opportunities specifically designed for businesses. 
              From instant grants to major award programs, we help you secure the grant funding you need to grow.
            </p>
            
            {/* CTA Buttons with Animation */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button
                size="lg"
                onClick={() => setLocation('/signin')}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-8 py-4 text-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Zap className="mr-2 h-5 w-5" />
                Start Finding Grants <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

            </div>

            {/* Dynamic Grant Highlights Carousel */}
            {grantHighlights.length > 0 && (
              <div className="mb-12">
                <div className="relative max-w-4xl mx-auto">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">🔥 Hot Grant Opportunities</h3>
                    <p className="text-gray-600">Live grant opportunities updating every few seconds</p>
                  </div>
                  
                  <div className="relative h-40 overflow-hidden rounded-2xl">
                    {grantHighlights.map((grant, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-all duration-1000 transform ${
                        index === currentHighlight 
                          ? 'translate-x-0 opacity-100' 
                          : index < currentHighlight 
                            ? '-translate-x-full opacity-0' 
                            : 'translate-x-full opacity-0'
                      }`}
                    >
                      <div className={`h-full bg-gradient-to-r ${grant.color} rounded-2xl p-6 text-white relative overflow-hidden`}>
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-4 right-4 w-20 h-20 border border-white rounded-full"></div>
                          <div className="absolute bottom-4 left-4 w-16 h-16 border border-white rounded-full"></div>
                        </div>
                        
                        <div className="relative z-10 flex items-center justify-between h-full">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-white/20 text-white hover:bg-white/20">
                                {grant.category}
                              </Badge>
                              {grant.hot && (
                                <Badge className="bg-red-500 text-white animate-pulse">
                                  🔥 HOT
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-2xl font-bold mb-1">{grant.title}</h4>
                            <p className="text-white/90 mb-2">by {grant.company}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {grant.amount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {grant.deadline}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Button 
                              size="sm" 
                              onClick={() => setLocation('/signin')}
                              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                            >
                              Apply Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Carousel Indicators */}
                <div className="flex justify-center mt-4 gap-2">
                  {grantHighlights.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentHighlight(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentHighlight 
                          ? 'bg-yellow-600 scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            )}

            
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Secure Grant Funding
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive platform provides all the tools and resources you need to find, apply for, and secure grant funding.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-6`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-600 text-lg leading-relaxed">{feature.description}</p>
                  <Button variant="ghost" className="mt-4 p-0 h-auto text-yellow-600 hover:text-yellow-700">
                    Learn more <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* How Much Funding Section */}
      <section id="funding" className="py-20 bg-yellow-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            How Much Grant Funding Do You Need?
          </h2>
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              {['$1K', '$10K', '$50K', '$100K+'].map((amount, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-12 text-lg font-semibold border-2 hover:border-yellow-600 hover:text-yellow-600"
                >
                  {amount}
                </Button>
              ))}
            </div>
            <Button
              size="lg"
              onClick={() => setLocation('/signin')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-12 py-4 text-lg"
            >
              Find My Grant Options
            </Button>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Grant Funding?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of successful businesses and start your grant funding journey today. 
            No hidden fees, no upfront costs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => setLocation('/signin')}
              className="bg-yellow-600 text-white hover:bg-yellow-700 px-8 py-4 text-lg font-semibold"
            >
              Get Started Free
            </Button>

          </div>
        </div>
      </section>
      {/* Footer */}
      <footer id="footer" className="bg-gray-900 text-white py-16 border-t border-yellow-600/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img 
                  src={Grant_Find__Logo__1} 
                  alt="GrantFind Logo" 
                  className="h-10 object-contain"
                />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Empowering businesses with grant funding opportunities and growth resources worldwide.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Find Grants</a></li>
                <li><a href="#" className="hover:text-white">Instant Grants</a></li>
                <li><a href="#" className="hover:text-white">Application Help</a></li>
                <li><a href="#" className="hover:text-white">Success Stories</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Press</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 GrantFind. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}