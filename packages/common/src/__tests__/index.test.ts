/**
 * @beleqet/common — unit tests
 *
 * These tests verify:
 *  1. All enum values are present and match backend Prisma schema strings.
 *  2. All named exports exist at the package entry point (structural checks).
 *  3. Interface shapes are compatible with realistic fixture objects
 *     (TypeScript structural typing enforced via compile-time assignments).
 *
 * No runtime schema library is used intentionally — @beleqet/common is a
 * pure-TypeScript types package. Tests validate enum contract and export surface.
 */

import {
  // Enums
  UserRole,
  JobType,
  JobStatus,
  ApplicationStatus,
  FreelanceJobStatus,
  BidStatus,
  ContractStatus,
  WalletTransactionType,
  BillingInterval,
  SubscriptionStatus,
  PaymentProvider,
  ThemePreference,
} from '../enums';

import type {
  // Auth
  LoginDto,
  RegisterDto,
  AuthUser,
  AuthResponse,
  JwtPayload,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RefreshTokenDto,
  VerifyEmailDto,
  // Jobs
  Job,
  JobCategory,
  JobCompany,
  JobsResponse,
  JobStats,
  QueryJobsDto,
  CreateJobDto,
  // Freelance
  FreelanceJob,
  FreelanceJobsResponse,
  Bid,
  Contract,
  SubmitBidDto,
  QueryFreelanceJobsDto,
  CreateFreelanceJobDto,
  // Applications
  Application,
  ApplicationsResponse,
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  // Wallet
  WalletTransaction,
  FreelancerWallet,
  EmployerWallet,
  EmployerWalletTransaction,
  // Subscriptions
  Plan,
  Subscription,
  CheckoutDto,
  // API response
  PaginatedResponse,
  MessageResponse,
  ApiError,
} from '../index';

// ── 1. Enum value tests ───────────────────────────────────────────────────────

describe('UserRole enum', () => {
  it('contains all four roles', () => {
    expect(UserRole.ADMIN).toBe('ADMIN');
    expect(UserRole.EMPLOYER).toBe('EMPLOYER');
    expect(UserRole.JOB_SEEKER).toBe('JOB_SEEKER');
    expect(UserRole.FREELANCER).toBe('FREELANCER');
  });

  it('has exactly 4 entries', () => {
    expect(Object.keys(UserRole)).toHaveLength(4);
  });
});

describe('JobType enum', () => {
  it('contains all five employment types', () => {
    expect(JobType.FULL_TIME).toBe('FULL_TIME');
    expect(JobType.PART_TIME).toBe('PART_TIME');
    expect(JobType.REMOTE).toBe('REMOTE');
    expect(JobType.HYBRID).toBe('HYBRID');
    expect(JobType.CONTRACT).toBe('CONTRACT');
  });
});

describe('JobStatus enum', () => {
  it('contains all lifecycle stages', () => {
    expect(JobStatus.DRAFT).toBe('DRAFT');
    expect(JobStatus.PUBLISHED).toBe('PUBLISHED');
    expect(JobStatus.CLOSED).toBe('CLOSED');
    expect(JobStatus.ARCHIVED).toBe('ARCHIVED');
  });
});

describe('ApplicationStatus enum', () => {
  it('contains the full hiring pipeline', () => {
    const expected = [
      'SUBMITTED',
      'SCREENING',
      'SHORTLISTED',
      'INTERVIEW_SCHEDULED',
      'OFFERED',
      'REJECTED',
      'WITHDRAWN',
    ];
    expected.forEach((v) => {
      expect(Object.values(ApplicationStatus)).toContain(v);
    });
  });
});

describe('FreelanceJobStatus enum', () => {
  it('contains all gig lifecycle states', () => {
    expect(FreelanceJobStatus.DRAFT).toBe('DRAFT');
    expect(FreelanceJobStatus.OPEN).toBe('OPEN');
    expect(FreelanceJobStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(FreelanceJobStatus.COMPLETED).toBe('COMPLETED');
    expect(FreelanceJobStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('BidStatus enum', () => {
  it('covers all proposal outcomes', () => {
    expect(BidStatus.PENDING).toBe('PENDING');
    expect(BidStatus.ACCEPTED).toBe('ACCEPTED');
    expect(BidStatus.REJECTED).toBe('REJECTED');
    expect(BidStatus.WITHDRAWN).toBe('WITHDRAWN');
  });
});

describe('ContractStatus enum', () => {
  it('has all contract states', () => {
    expect(ContractStatus.ACTIVE).toBe('ACTIVE');
    expect(ContractStatus.COMPLETED).toBe('COMPLETED');
    expect(ContractStatus.DISPUTED).toBe('DISPUTED');
    expect(ContractStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('WalletTransactionType enum', () => {
  it('has CREDIT and DEBIT only', () => {
    expect(WalletTransactionType.CREDIT).toBe('CREDIT');
    expect(WalletTransactionType.DEBIT).toBe('DEBIT');
    expect(Object.keys(WalletTransactionType)).toHaveLength(2);
  });
});

describe('BillingInterval enum', () => {
  it('has MONTHLY and YEARLY', () => {
    expect(BillingInterval.MONTHLY).toBe('MONTHLY');
    expect(BillingInterval.YEARLY).toBe('YEARLY');
  });
});

describe('SubscriptionStatus enum', () => {
  it('covers all subscription states', () => {
    expect(SubscriptionStatus.ACTIVE).toBe('ACTIVE');
    expect(SubscriptionStatus.INACTIVE).toBe('INACTIVE');
    expect(SubscriptionStatus.EXPIRED).toBe('EXPIRED');
    expect(SubscriptionStatus.CANCELLED).toBe('CANCELLED');
    expect(SubscriptionStatus.PENDING).toBe('PENDING');
  });
});

describe('PaymentProvider enum', () => {
  it('includes all three payment providers', () => {
    expect(PaymentProvider.STRIPE).toBe('STRIPE');
    expect(PaymentProvider.PAYPAL).toBe('PAYPAL');
    expect(PaymentProvider.CHAPA).toBe('CHAPA');
  });
});

describe('ThemePreference enum', () => {
  it('has LIGHT, DARK and SYSTEM', () => {
    expect(ThemePreference.LIGHT).toBe('LIGHT');
    expect(ThemePreference.DARK).toBe('DARK');
    expect(ThemePreference.SYSTEM).toBe('SYSTEM');
  });
});

// ── 2. Structural type-compatibility fixtures ─────────────────────────────────
//
// These assignments are compile-time checks — if an interface changes in a
// breaking way (field rename, type widened to incompatible type), tsc will
// catch it here before any runtime test runs.

describe('AuthUser interface', () => {
  it('accepts a minimal valid user fixture', () => {
    const fixture: AuthUser = {
      id: 'usr_abc123',
      email: 'test@beleqetjobs.com',
      firstName: 'Kal',
      lastName: 'Dev',
      role: UserRole.JOB_SEEKER,
      isActive: true,
      emailVerified: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(fixture.id).toBe('usr_abc123');
    expect(fixture.role).toBe(UserRole.JOB_SEEKER);
    // Canonical field name (not isEmailVerified — that was the old mismatch)
    expect(fixture.emailVerified).toBe(false);
  });

  it('accepts a full user fixture with all optional fields', () => {
    const fixture: AuthUser = {
      id: 'usr_xyz',
      email: 'full@beleqetjobs.com',
      firstName: 'Full',
      lastName: 'User',
      role: UserRole.FREELANCER,
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      phone: '+251911000000',
      headline: 'Senior Developer',
      bio: 'I build things.',
      location: 'Addis Ababa',
      skills: ['TypeScript', 'React', 'NestJS'],
      githubUrl: 'https://github.com/dev',
      linkedinUrl: 'https://linkedin.com/in/dev',
      portfolioUrl: 'https://dev.io',
      defaultResumeUrl: 'https://cdn.example.com/resume.pdf',
      isActive: true,
      emailVerified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    };

    expect(fixture.skills).toContain('TypeScript');
    expect(fixture.emailVerified).toBe(true);
  });
});

describe('AuthResponse interface', () => {
  it('accepts a valid login response fixture', () => {
    const minimalUser: AuthUser = {
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      role: UserRole.EMPLOYER,
      isActive: true,
      emailVerified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const fixture: AuthResponse = {
      accessToken: 'eyJhb...',
      refreshToken: 'refresh_token_here',
      user: minimalUser,
    };

    expect(fixture.accessToken).toBeTruthy();
    expect(fixture.user.role).toBe(UserRole.EMPLOYER);
  });
});

describe('Job interface', () => {
  it('accepts a minimal valid job fixture', () => {
    const fixture: Job = {
      id: 'job_001',
      title: 'Senior React Developer',
      description: 'Build amazing UIs.',
      location: 'Addis Ababa',
      type: JobType.FULL_TIME,
      categoryId: 'cat_tech',
      companyId: 'co_001',
      currency: 'ETB',
      status: JobStatus.PUBLISHED,
      featured: false,
      urgent: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(fixture.type).toBe(JobType.FULL_TIME);
    expect(fixture.status).toBe(JobStatus.PUBLISHED);
  });
});

describe('FreelanceJob interface', () => {
  it('accepts a valid gig fixture', () => {
    const fixture: FreelanceJob = {
      id: 'gig_001',
      title: 'Build a REST API',
      description: 'NestJS backend.',
      categoryId: 'cat_backend',
      clientId: 'usr_client',
      budgetMin: 5000,
      budgetMax: 10000,
      currency: 'ETB',
      pricingType: 'FIXED',
      deadlineDays: 14,
      skills: ['NestJS', 'PostgreSQL'],
      status: FreelanceJobStatus.OPEN,
      featured: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    expect(fixture.status).toBe(FreelanceJobStatus.OPEN);
    expect(fixture.budgetMin).toBeLessThan(fixture.budgetMax);
  });
});

describe('PaginatedResponse generic', () => {
  it('works with Job items', () => {
    const minJob: Job = {
      id: 'j1',
      title: 'Dev',
      description: 'desc',
      location: 'Remote',
      type: JobType.REMOTE,
      categoryId: 'c1',
      companyId: 'co1',
      currency: 'USD',
      status: JobStatus.PUBLISHED,
      featured: false,
      urgent: false,
      createdAt: '',
      updatedAt: '',
    };

    const page: PaginatedResponse<Job> = {
      items: [minJob],
      total: 1,
      page: 1,
      limit: 10,
    };

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });
});

describe('ApiError interface', () => {
  it('accepts a standard NestJS error shape', () => {
    const err: ApiError = {
      statusCode: 400,
      message: ['email must be a valid email', 'password is too short'],
      error: 'Bad Request',
      path: '/api/v1/auth/register',
      timestamp: new Date().toISOString(),
    };

    expect(err.statusCode).toBe(400);
    expect(Array.isArray(err.message)).toBe(true);
  });

  it('accepts a single-message error', () => {
    const err: ApiError = {
      statusCode: 401,
      message: 'Unauthorized',
    };

    expect(typeof err.message).toBe('string');
  });
});

// ── 3. Export surface smoke-test ───────────────────────────────────────────────

describe('@beleqet/common index exports', () => {
  it('exports all enums from index', async () => {
    const mod = await import('../index');

    // Spot-check all enum objects are present
    expect(mod.UserRole).toBeDefined();
    expect(mod.JobType).toBeDefined();
    expect(mod.JobStatus).toBeDefined();
    expect(mod.ApplicationStatus).toBeDefined();
    expect(mod.FreelanceJobStatus).toBeDefined();
    expect(mod.BidStatus).toBeDefined();
    expect(mod.ContractStatus).toBeDefined();
    expect(mod.WalletTransactionType).toBeDefined();
    expect(mod.BillingInterval).toBeDefined();
    expect(mod.SubscriptionStatus).toBeDefined();
    expect(mod.PaymentProvider).toBeDefined();
    expect(mod.ThemePreference).toBeDefined();
  });
});

// Suppress unused-import TS warnings for type-only imports used structurally
const _typeCheck = (): void => {
  const _loginDto: LoginDto = { email: '', password: '' };
  const _registerDto: RegisterDto = { firstName: '', lastName: '', email: '', password: '' };
  const _jwt: JwtPayload = { userId: '', email: '', role: UserRole.JOB_SEEKER };
  const _forgot: ForgotPasswordDto = { email: '' };
  const _reset: ResetPasswordDto = { token: '', newPassword: '' };
  const _change: ChangePasswordDto = { currentPassword: '', newPassword: '' };
  const _refresh: RefreshTokenDto = { refreshToken: '' };
  const _verify: VerifyEmailDto = { token: '' };
  const _queryJobs: QueryJobsDto = {};
  const _createJob: CreateJobDto = { title: '', description: '', location: '', type: JobType.FULL_TIME, categoryId: '' };
  const _queryFree: QueryFreelanceJobsDto = {};
  const _createFree: CreateFreelanceJobDto = { title: '', description: '', categoryId: '', budgetMin: 0, budgetMax: 0, deadlineDays: 1, skills: [] };
  const _submitBid: SubmitBidDto = { amount: 0, timelineDays: 1, coverLetter: '' };
  const _createApp: CreateApplicationDto = { jobId: '' };
  const _updateApp: UpdateApplicationStatusDto = { status: ApplicationStatus.SUBMITTED };
  const _checkout: CheckoutDto = { planId: '', provider: PaymentProvider.CHAPA };
  const _msg: MessageResponse = { success: true, message: '' };

  // These are referenced to satisfy tsc that the imports are used
  void [_loginDto, _registerDto, _jwt, _forgot, _reset, _change, _refresh, _verify,
        _queryJobs, _createJob, _queryFree, _createFree, _submitBid, _createApp,
        _updateApp, _checkout, _msg];

  // Type-only used types (no runtime value needed — TS validates their shape above)
  type _JobCategory = JobCategory;
  type _JobCompany = JobCompany;
  type _JobsResponse = JobsResponse;
  type _JobStats = JobStats;
  type _FreelanceJobsResponse = FreelanceJobsResponse;
  type _Bid = Bid;
  type _Contract = Contract;
  type _Application = Application;
  type _ApplicationsResponse = ApplicationsResponse;
  type _WalletTx = WalletTransaction;
  type _FWallet = FreelancerWallet;
  type _EWallet = EmployerWallet;
  type _EWalletTx = EmployerWalletTransaction;
  type _Plan = Plan;
  type _Sub = Subscription;
};
