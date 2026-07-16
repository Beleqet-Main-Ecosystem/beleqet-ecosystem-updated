"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Briefcase, 
  Globe, 
  TrendingUp, 
  Sparkles, 
  Coins, 
  ChevronDown, 
  Check, 
  ArrowRight, 
  Loader2,
  Sun,
  Moon
} from "lucide-react";

interface SalaryResult {
  salary: number;
  currency: string;
}

const BASE_API_URL = process.env.NEXT_PUBLIC_API_URL 

const JOBS_LIST = [
  "Software Engineer",
  "Senior Software Engineer",
  "Junior Software Engineer",
  "Backend Developer",
  "Frontend Developer",
  "Fullstack Engineer",
  "Mobile App Developer",
  "iOS Developer",
  "Android Developer",
  "Web Developer",
  "Game Developer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Site Reliability Engineer",
  "System Administrator",
  "Network Engineer",
  "Cybersecurity Engineer",
  "Security Analyst",
  "Database Administrator",
  "Data Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  "Business Intelligence Analyst",
  "Data Analyst",
  "QA Engineer",
  "Software Tester",
  "Automation Engineer",
  "Technical Lead",
  "Engineering Manager",
  "CTO",
  "Product Manager",
  "Product Owner",
  "Project Manager",
  "Program Manager",
  "Scrum Master",
  "Business Analyst",
  "Operations Manager",
  "Operations Director",
  "UI Designer",
  "UX Designer",
  "UI/UX Designer",
  "Product Designer",
  "Graphic Designer",
  "Web Designer",
  "Motion Designer",
  "Creative Director",
  "Marketing Manager",
  "Digital Marketing Specialist",
  "SEO Specialist",
  "Content Marketing Manager",
  "Social Media Manager",
  "Brand Manager",
  "Marketing Director",
  "Growth Manager",
  "Public Relations Manager",
  "Sales Representative",
  "Sales Executive",
  "Account Executive",
  "Sales Manager",
  "Sales Director",
  "Business Development Manager",
  "Customer Success Manager",
  "Customer Support Specialist",
  "HR Manager",
  "Recruiter",
  "Talent Acquisition Specialist",
  "Human Resources Specialist",
  "Training Manager",
  "Financial Analyst",
  "Accountant",
  "Senior Accountant",
  "Finance Manager",
  "Chief Financial Officer",
  "Auditor",
  "Investment Analyst",
  "Doctor",
  "Nurse",
  "Pharmacist",
  "Medical Assistant",
  "Healthcare Administrator",
  "Dentist",
  "Therapist",
  "Teacher",
  "Professor",
  "Lecturer",
  "Tutor",
  "Education Coordinator",
  "Lawyer",
  "Legal Assistant",
  "Legal Advisor",
  "Paralegal",
  "Architect",
  "Civil Engineer",
  "Mechanical Engineer",
  "Electrical Engineer",
  "Construction Manager",
  "Chef",
  "Head Chef",
  "Sous Chef",
  "Line Cook",
  "Restaurant Manager",
  "Bartender",
  "Barista",
  "Hotel Manager",
  "Event Planner",
  "Travel Agent",
  "Tour Guide",
  "Photographer",
  "Videographer",
  "Editor",
  "Writer",
  "Copywriter",
  "Journalist",
  "Content Creator",
  "Driver",
  "Delivery Driver",
  "Truck Driver",
  "Logistics Manager",
  "Supply Chain Manager",
  "Retail Manager",
  "Store Manager",
  "Cashier",
  "Sales Associate",
  "Electrician",
  "Plumber",
  "Mechanic",
  "Technician",
  "Maintenance Engineer",
  "Security Guard",
  "Police Officer",
  "Firefighter",
  "Military Officer",
  "Entrepreneur",
  "Founder",
  "CEO",
  "COO",
  "Chief Marketing Officer",
  "Chief Product Officer"
];

const COUNTRIES_LIST = [
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Ireland",
  "Poland",
  "Czech Republic",
  "Greece",
  "Turkey",
  "Ukraine",
  "Romania",
  "Hungary",
  "Japan",
  "South Korea",
  "China",
  "India",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Australia",
  "New Zealand",
  "Ethiopia",
  "South Africa",
  "Egypt",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Morocco",
  "Algeria",
  "Tunisia",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Israel",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Russia",
  "United States Minor Outlying Islands",
  "Iceland",
  "Luxembourg",
  "Monaco",
  "Liechtenstein",
  "Malta",
  "Cyprus",
  "Croatia",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Bulgaria",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Georgia",
  "Armenia",
  "Azerbaijan",
  "Kazakhstan",
  "Uzbekistan",
  "Afghanistan",
  "Iran",
  "Iraq",
  "Jordan",
  "Lebanon",
  "Kuwait",
  "Oman",
  "Bahrain",
  "Yemen",
  "Hong Kong",
  "Taiwan",
  "Mongolia",
  "Cambodia",
  "Laos",
  "Myanmar",
  "Papua New Guinea",
  "Fiji",
  "Jamaica",
  "Cuba",
  "Dominican Republic",
  "Costa Rica",
  "Panama",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Venezuela",
  "Peru",
  "Bolivia",
  "Uruguay",
  "Paraguay"
];

const EXPERIENCE_TIERS = [
  { label: "Junior", years: 2, desc: "0 - 2 Years" },
  { label: "Mid-Level", years: 5, desc: "3 - 5 Years" },
  { label: "Senior", years: 8, desc: "6 - 10 Years" },
  { label: "Director / Lead", years: 12, desc: "10+ Years" },
];

export default function SalaryHelper() {
  const [job, setJob] = useState(JOBS_LIST[0]);
  const [country, setCountry] = useState(COUNTRIES_LIST[0]);
  const [experience, setExperience] = useState<number>(5);
  
  const [jobOpen, setJobOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local storage / state based fallback (100% self-contained)
  const [isDark, setIsDark] = useState(true);

  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read preference on client mount
    const saved = localStorage.getItem("salary-helper-theme");
    if (saved !== null) {
      setIsDark(saved === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextVal = !isDark;
    setIsDark(nextVal);
    localStorage.setItem("salary-helper-theme", nextVal ? "dark" : "light");
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setJobOpen(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${BASE_API_URL}/estimate?job=${encodeURIComponent(job)}&country=${encodeURIComponent(country)}&experience=${experience}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to calculate. Please check your backend connection.");
      }

      const data: SalaryResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (val: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 0,
      }).format(val);
    } catch {
      return `${val} ${currency}`;
    }
  };

  return (
    // Instead of using global HTML class files, we just apply theme styling conditionally directly on our root div wrapper!
    <div className={`min-h-screen flex flex-col justify-center items-center p-4 md:p-8 selection:bg-indigo-500 selection:text-white transition-colors duration-300 relative overflow-hidden ${
      isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* Background Glows (Active in Dark Mode Only) */}
      {isDark && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        </>
      )}

      {/* Simplified, Beautiful Header Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          type="button"
          className={`p-3 rounded-full border shadow-md transition-all flex items-center justify-center ${
            isDark 
              ? "border-slate-800/80 bg-slate-900/60 hover:bg-slate-800 text-amber-400" 
              : "border-slate-200 bg-white hover:bg-slate-100 text-indigo-600"
          }`}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5 animate-pulse" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <main className="w-full max-w-2xl z-10 my-10">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-3 ${
            isDark 
              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
              : "bg-indigo-50 border-indigo-100 text-indigo-600"
          }`}>
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            AI-Powered Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Salary <span className="text-indigo-500 font-medium">Helper</span>
          </h1>
          <p className={`mt-2 text-sm md:text-base max-w-md mx-auto ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Choose details from the verified metrics below to analyze instant global market calculations.
          </p>
        </div>

        {/* Form Panel */}
        <div className={`border rounded-2xl p-6 md:p-8 shadow-xl relative transition-all duration-300 ${
          isDark 
            ? "bg-slate-900/60 backdrop-blur-xl border-slate-800/80 shadow-2xl" 
            : "bg-white border-slate-200"
        }`}>
          
          <form onSubmit={handleEstimate} className="space-y-6">
            
            {/* Job Selector */}
            <div className="space-y-2 relative" ref={jobDropdownRef}>
              <label className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                Target Job Role
              </label>
              
              <button
                type="button"
                onClick={() => {
                  setJobOpen(!jobOpen);
                  setCountryOpen(false);
                }}
                className={`w-full border rounded-xl px-4 py-3.5 text-left transition-all outline-none flex items-center justify-between ${
                  isDark 
                    ? "bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-200" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-750"
                }`}
              >
                <span>{job}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDark ? "text-slate-500" : "text-slate-450"} ${jobOpen ? 'rotate-180' : ''}`} />
              </button>

              {jobOpen && (
                <div className={`absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto border rounded-xl shadow-2xl z-50 ${
                  isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                }`}>
                  {JOBS_LIST.map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => {
                        setJob(j);
                        setJobOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-all flex items-center justify-between ${
                        isDark 
                          ? "hover:bg-indigo-500/10 text-slate-300 hover:text-white" 
                          : "hover:bg-indigo-50 text-slate-600 hover:text-indigo-950"
                      }`}
                    >
                      <span>{j}</span>
                      {job === j && <Check className="w-4 h-4 text-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Pick the closest industry match to keep database parsing completely optimal.</p>
            </div>

            {/* Country Selector */}
            <div className="space-y-2 relative" ref={countryDropdownRef}>
              <label className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                Location (Country)
              </label>

              <button
                type="button"
                onClick={() => {
                  setCountryOpen(!countryOpen);
                  setJobOpen(false);
                }}
                className={`w-full border rounded-xl px-4 py-3.5 text-left transition-all outline-none flex items-center justify-between ${
                  isDark 
                    ? "bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-200" 
                    : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-750"
                }`}
              >
                <span>{country}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDark ? "text-slate-500" : "text-slate-450"} ${countryOpen ? 'rotate-180' : ''}`} />
              </button>

              {countryOpen && (
                <div className={`absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto border rounded-xl shadow-2xl z-50 ${
                  isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                }`}>
                  {COUNTRIES_LIST.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCountry(c);
                        setCountryOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-all flex items-center justify-between ${
                        isDark 
                          ? "hover:bg-emerald-500/10 text-slate-300 hover:text-white" 
                          : "hover:bg-emerald-50 text-slate-600 hover:text-emerald-950"
                      }`}
                    >
                      <span>{c}</span>
                      {country === c && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                  ))}
                </div>
              )}
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Locational limits guarantee localized legal currency matches.</p>
            </div>

            {/* Experience Cards */}
            <div className="space-y-3">
              <label className={`text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Experience Tier
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {EXPERIENCE_TIERS.map((tier) => (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => setExperience(tier.years)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      experience === tier.years
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-200 shadow-md"
                        : isDark
                          ? "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    <span className="text-xs font-semibold">{tier.label}</span>
                    <span className={`text-[10px] mt-1 block ${isDark ? "text-slate-500" : "text-slate-400"}`}>{tier.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white/80" />
                  Processing Market Factors...
                </>
              ) : (
                <>
                  Calculate Target Salary
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Error Board */}
          {error && (
            <div className={`mt-6 p-4 rounded-xl border text-sm ${
              isDark ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-red-200 bg-red-50 text-red-600"
            }`}>
              {error}
            </div>
          )}

          {/* Result Panel */}
          {result && (
            <div className={`mt-8 pt-6 border-t ${isDark ? "border-slate-800/80" : "border-slate-200"}`}>
              <div className={`border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-br ${
                isDark 
                  ? "from-indigo-950/40 to-slate-900/40 border-indigo-500/20" 
                  : "from-indigo-50 to-slate-100/50 border-indigo-150"
              }`}>
                <div className="space-y-1 text-center md:text-left">
                  <span className={`text-xs font-semibold tracking-widest uppercase flex items-center justify-center md:justify-start gap-1 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    <Coins className="w-3.5 h-3.5 text-indigo-500" />
                    Estimated Average Annual Salary
                  </span>
                  <p className={`text-xs italic mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    For a {job} in {country} ({experience} yrs exp)
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <div className={`text-3xl md:text-4xl font-black ${
                    isDark 
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-white" 
                      : "text-indigo-600"
                  }`}>
                    {formatSalary(result.salary, result.currency)}
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold block mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Summerization of d/t webs
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}