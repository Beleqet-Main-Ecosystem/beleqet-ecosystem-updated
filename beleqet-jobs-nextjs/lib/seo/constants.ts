/**
 * Static title / description templates used by the per-page metadata factories.
 * Keeping them here (rather than inline) makes copy changes trivial.
 */

export const TITLES = {
  HOME: "Beleqet Jobs | Find Your Next Opportunity Faster",
  JOBS: "Find Jobs | Beleqet Jobs",
  JOB_DETAIL: (title: string, company: string): string =>
    `${title} at ${company} | Beleqet Jobs`,
  ABOUT: "About Beleqet | Ethiopia\u2019s Career Marketplace",
  PRICING: "Pricing | Beleqet Jobs",
  CONTACT: "Contact Beleqet | Get Support",
  LOGIN: "Sign In | Beleqet Jobs",
  REGISTER: "Create Account | Beleqet Jobs",
  FORGOT_PASSWORD: "Reset Password | Beleqet Jobs",
  PROFILE: "My Profile | Beleqet Jobs",
  POST_JOB: "Post a Job | Beleqet Jobs",
  EMPLOYER: "Employer Dashboard | Beleqet Jobs",
  CV_MAKER: "CV Maker | Beleqet Jobs",
  APPLICATIONS: "My Applications | Beleqet Jobs",
  ADMIN: "Admin Dashboard | Beleqet Jobs",
  RESET_PASSWORD: "Set New Password | Beleqet Jobs",
  VERIFY_EMAIL: "Verify Email | Beleqet Jobs",
  NOT_FOUND: "Page Not Found | Beleqet Jobs",
} as const;

export const DESCRIPTIONS = {
  HOME:
    "Search verified jobs from trusted employers across Ethiopia. Discover thousands of job opportunities, get instant alerts on Telegram, and apply faster with Beleqet Vacancy Platform.",
  JOBS:
    "Browse thousands of verified job listings across Ethiopia. Filter by category, type, and location to find your next career opportunity on Beleqet.",
  JOB_DETAIL: (title: string, company: string, location: string): string =>
    `Apply for ${title} at ${company} in ${location}. View job requirements, responsibilities, and how to apply on Beleqet Jobs.`,
  ABOUT:
    "Beleqet connects ambitious Ethiopian talent with credible employers through one focused career marketplace — making discovery, application, and hiring simpler for everyone.",
  PRICING:
    "Simple, transparent pricing for Ethiopian employers. Post jobs and reach thousands of qualified candidates on Beleqet.",
  CONTACT:
    "Get in touch with the Beleqet team. Questions about accounts, listings, hiring plans, or partnerships — we are here to help.",
  LOGIN:
    "Sign in to your Beleqet account to manage applications, saved jobs, and your profile.",
  REGISTER:
    "Create your Beleqet account in less than a minute. Start applying for verified jobs across Ethiopia.",
  FORGOT_PASSWORD:
    "Reset your Beleqet account password. Enter your email and we will send a secure reset link.",
  PROFILE:
    "Manage your Beleqet profile, skills, and career preferences. Keep your information up to date for recruiters.",
  POST_JOB:
    "Post a job listing on Beleqet and reach thousands of qualified candidates across Ethiopia. Simple, transparent pricing.",
  EMPLOYER:
    "Employer dashboard for managing job listings, reviewing applications, and connecting with candidates on Beleqet.",
  CV_MAKER:
    "Build a professional CV with Beleqet's free CV maker. Choose from templates and export or share your resume.",
  APPLICATIONS:
    "Track your job applications and saved jobs on Beleqet. Monitor application status and manage your opportunities.",
  ADMIN:
    "Beleqet admin panel for managing users, contacts, notifications, disputes, and platform compliance.",
  RESET_PASSWORD:
    "Choose a new password for your Beleqet account. Use at least eight characters for better security.",
  VERIFY_EMAIL:
    "Verify your email address to activate your Beleqet account and start applying for jobs.",
  NOT_FOUND:
    "The page you are looking for does not exist or has been moved. Browse jobs or return to the Beleqet homepage.",
} as const;
