import { grants, userGrantApplications, userGrantInterests, users, companies, admins, userBusinesses, webhookConfigs, formTemplates, formFields, externalGrants, payments, grantWriters, grantWriterInquiries, renewalEmailDeliveries, type User, type InsertUser, type Company, type InsertCompany, type Admin, type InsertAdmin, type Grant, type InsertGrant, type UserGrantApplication, type InsertUserGrantApplication, type UserGrantInterest, type InsertUserGrantInterest, type UserBusiness, type InsertUserBusiness, type WebhookConfig, type InsertWebhookConfig, type FormTemplate, type InsertFormTemplate, type FormField, type InsertFormField, type ExternalGrant, type InsertExternalGrant, type Payment, type InsertPayment, type GrantWriter, type InsertGrantWriter, type GrantWriterInquiry, type InsertGrantWriterInquiry } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray, sql, getTableColumns, gte, lte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { buildWeeklyReport, type PaymentMetrics } from "./reporting";
import {
  DatabaseAvailability,
  DatabaseOperationGate,
  databaseDiagnosticCode,
  databaseDiagnosticReason,
  databaseUnavailableError,
  isDatabaseFailure,
} from "./database-availability";
import { TrackedPostgresSockets } from "./postgres-socket-adapter";

let activeDbStorage: DbStorage | undefined;

interface DbResource {
  client: ReturnType<typeof postgres>;
  db: any;
  sockets: TrackedPostgresSockets;
}

interface ProbeResource {
  client: ReturnType<typeof postgres>;
  sockets: TrackedPostgresSockets;
}

function postgresOptions(max: number, sockets: TrackedPostgresSockets) {
  return {
    max,
    // Disable prepared statements for compatibility with transaction poolers.
    prepare: false,
    // postgres.js documents connect_timeout in seconds. Set statement_timeout
    // as a PostgreSQL startup parameter so the server cancels slow statements.
    connect_timeout: 5,
    connection: { statement_timeout: 10_000 },
    socket: sockets.createSocket,
  } as any;
}

function closePostgresResource(resource: { client: ReturnType<typeof postgres>; sockets: TrackedPostgresSockets }) {
  // Socket.destroy() is the hard cancellation primitive. In particular, when
  // TLS is active postgres.js wraps this original socket; destroying it still
  // aborts the underlying transport immediately.
  resource.sockets.destroyAll();
  return resource.client.end({ timeout: 0 });
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  claimTrialStartEmail(id: number): Promise<boolean>;
  claimTrialReminderEmail(id: number): Promise<boolean>;
  claimRenewalEmail(id: number, invoiceId: string): Promise<boolean>;
  releaseRenewalEmail(id: number, invoiceId: string): Promise<void>;
  deleteUser(id: number): Promise<boolean>;
  toggleUserStatus(id: number): Promise<User | undefined>;
  updateLastLogin(id: number): Promise<User | undefined>;
  
  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByEmail(email: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  getAllCompanies(): Promise<Company[]>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  
  // Admin operations
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // Grant operations
  getAllGrants(): Promise<Grant[]>;
  getGrantById(id: number): Promise<Grant | undefined>;
  getGrantByIdUnfiltered(id: number): Promise<Grant | undefined>;
  getGrantsByCompany(companyId: number): Promise<Grant[]>;
  createGrant(grant: InsertGrant): Promise<Grant>;
  updateGrant(id: number, grant: Partial<InsertGrant>): Promise<Grant | undefined>;
  updateGrantStatus(grantId: number, status: "active" | "inactive"): Promise<Grant | undefined>;
  toggleGrantStatus(id: number): Promise<Grant | undefined>;
  deleteGrant(id: number): Promise<boolean>;
  
  // Application operations
  getUserGrantApplications(userId: number): Promise<UserGrantApplication[]>;
  getGrantApplications(grantId: number): Promise<(UserGrantApplication & { user: User })[]>;
  getCompanyApplications(companyId: number): Promise<(UserGrantApplication & { user: User; grant: Grant })[]>;
  getAllApplications(): Promise<(UserGrantApplication & { user: User; grant: Grant })[]>;
  createUserGrantApplication(application: InsertUserGrantApplication): Promise<UserGrantApplication>;
  updateUserGrantApplication(id: number, status: string): Promise<UserGrantApplication | undefined>;
  updateApplicationStatus(applicationId: number, status: string, remarks?: string): Promise<UserGrantApplication | undefined>;
  
  // Interest operations
  getUserGrantInterests(userId: number): Promise<UserGrantInterest[]>;
  setUserGrantInterest(interest: InsertUserGrantInterest): Promise<UserGrantInterest>;
  getUserGrantInterest(userId: number, grantId: number): Promise<UserGrantInterest | undefined>;
  
  // Application methods
  applyToGrant(userId: number, grantId: number): Promise<UserGrantApplication>;
  submitApplicationAnswers(userId: number, grantId: number, answers: Record<string, any>): Promise<UserGrantApplication>;
  getApplicationByUserAndGrant(userId: number, grantId: number): Promise<UserGrantApplication | undefined>;
  
  // User business operations
  getUserBusinesses(userId: number): Promise<UserBusiness[]>;
  createUserBusiness(business: InsertUserBusiness): Promise<UserBusiness>;
  updateUserBusiness(id: number, business: Partial<InsertUserBusiness>): Promise<UserBusiness | undefined>;
  deleteUserBusiness(id: number): Promise<boolean>;
  
  // Webhook configuration operations
  getWebhookConfigs(): Promise<WebhookConfig[]>;
  getWebhookConfig(id: string): Promise<WebhookConfig | undefined>;
  getWebhookConfigByEvent(event: string): Promise<WebhookConfig | undefined>;
  createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig>;
  updateWebhookConfig(id: string, config: Partial<InsertWebhookConfig>): Promise<WebhookConfig | undefined>;

  deleteWebhookConfig(id: string): Promise<boolean>;

  // Form builder operations
  getAllFormTemplates(companyId?: number): Promise<FormTemplate[]>;
  getFormTemplates(companyId: number): Promise<FormTemplate[]>;
  getFormTemplate(id: number): Promise<FormTemplate | undefined>;
  createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate>;
  updateFormTemplate(id: number, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined>;
  deleteFormTemplate(id: number): Promise<boolean>;
  
  getFormFields(templateId: number): Promise<FormField[]>;
  createFormField(field: InsertFormField): Promise<FormField>;
  updateFormField(id: number, field: Partial<InsertFormField>): Promise<FormField | undefined>;
  deleteFormField(id: number): Promise<boolean>;
  deleteFormFieldsByTemplateId(templateId: number): Promise<boolean>;
  reorderFormFields(templateId: number, fieldOrders: { id: number; sortOrder: number; }[]): Promise<boolean>;
  
  // External grants operations
  getAllExternalGrants(): Promise<ExternalGrant[]>;
  getActiveExternalGrants(): Promise<ExternalGrant[]>;
  getExternalGrant(id: number): Promise<ExternalGrant | undefined>;
  createExternalGrant(grant: InsertExternalGrant): Promise<ExternalGrant>;
  updateExternalGrant(id: number, grant: Partial<InsertExternalGrant>): Promise<ExternalGrant | undefined>;
  deleteExternalGrant(id: number): Promise<boolean>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentBySessionId(sessionId: string): Promise<Payment | undefined>;
  updatePaymentStatus(sessionId: string, status: string, paymentIntentId?: string): Promise<Payment | undefined>;
  getUserPayments(userId: number): Promise<Payment[]>;
  getPaymentsByStatus(status: string, from?: Date, to?: Date): Promise<Payment[]>;

  // Grant Writer operations
  getActiveGrantWriters(niche?: string): Promise<GrantWriter[]>;
  getAllGrantWriters(): Promise<(GrantWriter & { inquiryCount: number })[]>;
  getGrantWriterById(id: number): Promise<GrantWriter | undefined>;
  createGrantWriter(writer: InsertGrantWriter): Promise<GrantWriter>;
  updateGrantWriter(id: number, writer: Partial<InsertGrantWriter>): Promise<GrantWriter | undefined>;
  deleteGrantWriter(id: number): Promise<boolean>;
  createGrantWriterInquiry(inquiry: InsertGrantWriterInquiry): Promise<GrantWriterInquiry>;
  getGrantWriterInquiries(writerId?: number): Promise<(GrantWriterInquiry & { writerName: string })[]>;
  markInquiryReplied(id: number): Promise<GrantWriterInquiry | undefined>;
  getWeeklyReport(
    params?: { from?: string; to?: string; prevFrom?: string; prevTo?: string },
    paymentMetrics?: PaymentMetrics,
  ): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private companies: Map<number, Company>;
  private grants: Map<number, Grant>;
  private userGrantApplications: Map<number, UserGrantApplication>;
  private userGrantInterests: Map<number, UserGrantInterest>;
  private userBusinesses: Map<number, UserBusiness>;
  private renewalEmailInvoiceIds: Set<string>;
  private currentUserId: number;
  private currentCompanyId: number;
  private currentGrantId: number;
  private currentApplicationId: number;
  private currentInterestId: number;
  private currentBusinessId: number;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.grants = new Map();
    this.userGrantApplications = new Map();
    this.userGrantInterests = new Map();
    this.userBusinesses = new Map();
    this.renewalEmailInvoiceIds = new Set();
    this.currentUserId = 1;
    this.currentCompanyId = 1;
    this.currentGrantId = 1;
    this.currentApplicationId = 1;
    this.currentInterestId = 1;
    this.currentBusinessId = 1;

    // Initialize with some sample data
    this.initializeSampleUsers();
    this.initializeSampleCompanies();
    this.initializeSampleGrants();
  }

  private initializeSampleUsers() {
    const sampleUsers = [
      {
        email: "demo@example.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "Demo",
        lastName: "User",
        phone: "+1-555-0123"
      },
      {
        email: "john@startup.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "John",
        lastName: "Entrepreneur",
        phone: "+1-555-0124"
      },
      {
        email: "sarah@business.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "Sarah",
        lastName: "Founder",
        phone: "+1-555-0125"
      }
    ];

    sampleUsers.forEach((user, index) => {
      const newUser = {
        id: index + 1,
        ...user,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(newUser.id, newUser);
      console.log("Added user:", newUser.email, "with ID:", newUser.id);
    });

    this.currentUserId = sampleUsers.length + 1;
  }

  private initializeSampleCompanies() {
    const sampleCompanies = [
      {
        name: "AT&T",
        email: "grants@att.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Telecommunications giant supporting innovative businesses"
      },
      {
        name: "American Express",
        email: "grants@americanexpress.com", 
        password: bcrypt.hashSync("company123", 10),
        description: "Financial services company backing small businesses"
      },
      {
        name: "Small Business Awards",
        email: "awards@smallbusinessawards.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Recognition program for top small businesses"
      },
      {
        name: "Technology Innovation Fund",
        email: "grants@techfund.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Funding innovative technology solutions"
      },
      {
        name: "Skip Foundation",
        email: "foundation@skip.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Supporting young entrepreneurs and startups"
      },
      {
        name: "Circle Of Greatness LLC",
        email: "grants@circleofgreatness.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Empowering beginning entrepreneurs to achieve greatness"
      },
      {
        name: "Coach K University LLC",
        email: "grants@coachkuniversity.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Educational institution supporting business growth and development"
      }
    ];

    sampleCompanies.forEach((company, index) => {
      const newCompany = {
        id: index + 1,
        ...company,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.companies.set(newCompany.id, newCompany);
      console.log("Added company:", newCompany.email, "with ID:", newCompany.id);
    });

    this.currentCompanyId = sampleCompanies.length + 1;
  }

  private initializeSampleGrants() {
    const sampleGrants: InsertGrant[] = [
      {
        title: "Greatness Grant",
        companyId: 6,
        company: "Circle Of Greatness LLC",
        amount: 2500,
        deadline: new Date("2025-08-29T23:59:59Z").toISOString(),
        category: "Businesses",
        tags: ["$2.5k", "entrepreneurs", "beginning"],
        description: "The Greatness Grant is a funding opportunity designed specifically for beginning entrepreneurs who are ready to take the leap but need financial support to kickstart their journey. Whether you're starting your first business or growing an idea that's been on your heart, this grant is your chance to access the resources you need to succeed.",
        requirements: "Must be a beginning entrepreneur starting their first business or growing an early-stage idea.",
        applicationUrl: "https://example.com/apply/greatness",
        status: "active",
        rating: 50,
        imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true
      },
      {
        title: "Legacy Grant",
        companyId: 7, // Coach K University LLC
        company: "Coach K University LLC",
        amount: 1000,
        deadline: new Date("2025-08-28T23:59:59Z").toISOString(),
        category: "Businesses",
        tags: ["$1k", "business-growth", "scaling"],
        description: "Empower Your Business with the Coach K Legacy Grant: Whether you're launching a new product or scaling operations, this $1,000 grant can give your business the boost it needs to get to that next level.",
        requirements: "Must be an existing business looking to launch new products or scale operations.",
        applicationUrl: "https://example.com/apply/legacy",
        status: "active",
        rating: 48,
        imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true
      }
    ];

    sampleGrants.forEach(grant => {
      this.createGrant(grant);
    });
  }

  async ensureFormBuilderTables() {
    try {
      console.log("🔧 Ensuring form builder tables exist...");
      
      // Use SQL template to create tables directly
      const client = this.db._.config.client;
      
      // Create form_templates table
      await client`
        CREATE TABLE IF NOT EXISTS form_templates (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Create form_fields table
      await client`
        CREATE TABLE IF NOT EXISTS form_fields (
          id SERIAL PRIMARY KEY,
          form_template_id INTEGER NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
          field_type TEXT NOT NULL,
          label TEXT NOT NULL,
          placeholder TEXT,
          required BOOLEAN DEFAULT false,
          options TEXT[],
          sort_order INTEGER DEFAULT 0
        )
      `;
      
      console.log("✅ Form builder tables ensured in Supabase");
    } catch (error) {
      console.log("⚠️ Form builder tables may already exist or error occurred:", error.message);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => (user as any).stripeCustomerId === customerId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser,
      id,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...user, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async claimTrialStartEmail(id: number): Promise<boolean> {
    const user = this.users.get(id);
    if (!user || (user as any).trialStartEmailSentAt) return false;
    this.users.set(id, { ...user, trialStartEmailSentAt: new Date(), updatedAt: new Date() });
    return true;
  }

  async claimTrialReminderEmail(id: number): Promise<boolean> {
    const user = this.users.get(id);
    if (!user || (user as any).trialReminderSentAt) return false;
    this.users.set(id, { ...user, trialReminderSentAt: new Date(), updatedAt: new Date() });
    return true;
  }

  async claimRenewalEmail(id: number, invoiceId: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user || this.renewalEmailInvoiceIds.has(invoiceId)) return false;
    this.renewalEmailInvoiceIds.add(invoiceId);
    return true;
  }

  async releaseRenewalEmail(_id: number, invoiceId: string): Promise<void> {
    this.renewalEmailInvoiceIds.delete(invoiceId);
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async toggleUserStatus(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const newStatus = user.status === "active" ? "inactive" : "active";
    const updatedUser = { ...user, status: newStatus, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateLastLogin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, lastLoginAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async getAllGrants(): Promise<Grant[]> {
    return Array.from(this.grants.values());
  }

  async getGrantById(id: number): Promise<Grant | undefined> {
    const grant = this.grants.get(id);
    return grant?.status === "active" ? grant : undefined;
  }

  async getGrantByIdUnfiltered(id: number): Promise<Grant | undefined> {
    return this.grants.get(id);
  }

  async createGrant(insertGrant: InsertGrant): Promise<Grant> {
    const id = this.currentGrantId++;
    // Generate random rating between 45-50 (displays as 4.5-5.0 when divided by 10)
    const randomRating = Math.floor(Math.random() * 6) + 45; // 45, 46, 47, 48, 49, or 50
    const grant: Grant = { 
      ...insertGrant, 
      id,
      status: insertGrant.status || "active",
      tags: insertGrant.tags || [],
      applicationUrl: insertGrant.applicationUrl || null,
      rating: insertGrant.rating || randomRating,
      imageUrl: insertGrant.imageUrl || null,
      isNew: insertGrant.isNew || false,
      isHot: insertGrant.isHot || false,
      timeRemaining: insertGrant.timeRemaining || null
    };
    this.grants.set(id, grant);
    return grant;
  }

  async getUserGrantApplications(userId: number): Promise<UserGrantApplication[]> {
    return Array.from(this.userGrantApplications.values()).filter(
      app => app.userId === userId
    );
  }

  async createUserGrantApplication(insertApplication: InsertUserGrantApplication): Promise<UserGrantApplication> {
    const id = this.currentApplicationId++;
    const application: UserGrantApplication = { 
      ...insertApplication, 
      id,
      appliedAt: new Date(),
      updatedAt: new Date()
    };
    this.userGrantApplications.set(id, application);
    return application;
  }

  async updateUserGrantApplication(id: number, status: string): Promise<UserGrantApplication | undefined> {
    const application = this.userGrantApplications.get(id);
    if (application) {
      application.status = status;
      this.userGrantApplications.set(id, application);
      return application;
    }
    return undefined;
  }

  async getUserGrantInterests(userId: number): Promise<UserGrantInterest[]> {
    return Array.from(this.userGrantInterests.values())
      .filter(interest => interest.userId === userId);
  }

  async setUserGrantInterest(interest: InsertUserGrantInterest): Promise<UserGrantInterest> {
    // Check if interest already exists
    const existingInterest = Array.from(this.userGrantInterests.values())
      .find(i => i.userId === interest.userId && i.grantId === interest.grantId);

    if (existingInterest) {
      existingInterest.preference = interest.preference ?? "none";
      existingInterest.updatedAt = new Date();
      return existingInterest;
    }

    const newInterest: UserGrantInterest = {
      id: this.currentInterestId++,
      userId: interest.userId,
      grantId: interest.grantId,
      preference: interest.preference ?? "none",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.userGrantInterests.set(newInterest.id, newInterest);
    return newInterest;
  }

  async getUserGrantInterest(userId: number, grantId: number): Promise<UserGrantInterest | undefined> {
    return Array.from(this.userGrantInterests.values())
      .find(interest => interest.userId === userId && interest.grantId === grantId);
  }

  async applyToGrant(userId: number, grantId: number): Promise<UserGrantApplication> {
    // Check if application already exists
    const existingApp = Array.from(this.userGrantApplications.values())
      .find(app => app.userId === userId && app.grantId === grantId);

    if (existingApp) {
      return existingApp;
    }

    const newApp: UserGrantApplication = {
      id: this.currentApplicationId++,
      userId,
      grantId,
      status: "In Progress",
      answers: null,
      appliedAt: new Date(),
      updatedAt: new Date(),
    };

    this.userGrantApplications.set(newApp.id, newApp);
    return newApp;
  }

  async submitApplicationAnswers(userId: number, grantId: number, answers: Record<string, any>): Promise<UserGrantApplication> {
    const existingApp = Array.from(this.userGrantApplications.values())
      .find(app => app.userId === userId && app.grantId === grantId);

    // Create application with "Applied" status if it doesn't exist
    if (!existingApp) {
      const newApp: UserGrantApplication = {
        id: this.currentApplicationId++,
        userId,
        grantId,
        status: "Applied",
        answers: JSON.stringify(answers),
        appliedAt: new Date(),
        updatedAt: new Date(),
      };
      this.userGrantApplications.set(newApp.id, newApp);
      return newApp;
    }

    // Only allow editing for "In Progress" and "Applied" statuses
    if (!["In Progress", "Applied"].includes(existingApp.status)) {
      throw new Error("Cannot edit application in current status");
    }

    // Update answers and set status to "Applied" only if currently "In Progress"
    existingApp.status = existingApp.status === "In Progress" ? "Applied" : existingApp.status;
    existingApp.answers = JSON.stringify(answers);
    existingApp.updatedAt = new Date();
    return existingApp;
  }

  async getApplicationByUserAndGrant(userId: number, grantId: number): Promise<UserGrantApplication | undefined> {
    return Array.from(this.userGrantApplications.values())
      .find(app => app.userId === userId && app.grantId === grantId);
  }

  // Company methods (for MemStorage)
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    console.log("Looking for company with email:", email);
    console.log("Available companies:", Array.from(this.companies.values()).map(c => c.email));
    return Array.from(this.companies.values()).find(company => company.email === email);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const newCompany: Company = {
      id: this.currentCompanyId++,
      ...company,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.companies.set(newCompany.id, newCompany);
    return newCompany;
  }

  async getGrantsByCompany(companyId: number): Promise<Grant[]> {
    return Array.from(this.grants.values()).filter(grant => grant.companyId === companyId);
  }

  async updateGrant(id: number, grant: Partial<InsertGrant>): Promise<Grant | undefined> {
    const existingGrant = this.grants.get(id);
    if (!existingGrant) return undefined;
    
    // Fix invalid ratings: if rating exists and is less than 45, generate random 45-50
    const grantData = { ...grant };
    if (grantData.rating !== undefined && grantData.rating < 45) {
      grantData.rating = Math.floor(Math.random() * 6) + 45; // 45-50
    }
    
    const updatedGrant = { ...existingGrant, ...grantData, updatedAt: new Date() };
    this.grants.set(id, updatedGrant);
    return updatedGrant;
  }

  async updateGrantStatus(grantId: number, status: "active" | "inactive"): Promise<Grant | undefined> {
    const grant = this.grants.get(grantId);
    if (!grant) return undefined;
    
    const updatedGrant = { ...grant, status };
    this.grants.set(grantId, updatedGrant);
    return updatedGrant;
  }

  async toggleGrantStatus(id: number): Promise<Grant | undefined> {
    const grant = this.grants.get(id);
    if (!grant) return undefined;
    
    const newStatus = grant.status === "active" ? "inactive" : "active";
    const updatedGrant = { ...grant, status: newStatus, updatedAt: new Date() };
    this.grants.set(id, updatedGrant);
    return updatedGrant;
  }

  async deleteGrant(id: number): Promise<boolean> {
    return this.grants.delete(id);
  }

  async getGrantApplications(grantId: number): Promise<(UserGrantApplication & { user: User })[]> {
    const applications = Array.from(this.userGrantApplications.values())
      .filter(app => app.grantId === grantId);
    
    return applications.map(app => {
      const user = this.users.get(app.userId)!;
      return { ...app, user };
    });
  }

  async getCompanyApplications(companyId: number): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    const companyGrants = Array.from(this.grants.values()).filter(grant => grant.companyId === companyId);
    const grantIds = companyGrants.map(grant => grant.id);
    
    const applications = Array.from(this.userGrantApplications.values())
      .filter(app => grantIds.includes(app.grantId));
    
    return applications.map(app => {
      const user = this.users.get(app.userId)!;
      const grant = this.grants.get(app.grantId)!;
      return { ...app, user, grant };
    });
  }

  async getAllApplications(): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    const applications = Array.from(this.userGrantApplications.values());
    
    return applications.map(app => {
      const user = this.users.get(app.userId)!;
      const grant = this.grants.get(app.grantId)!;
      return { ...app, user, grant };
    });
  }

  async updateApplicationStatus(applicationId: number, status: string, remarks?: string): Promise<UserGrantApplication | undefined> {
    const application = this.userGrantApplications.get(applicationId);
    if (!application) return undefined;
    
    application.status = status;
    application.updatedAt = new Date();
    if (remarks !== undefined) {
      application.remarks = remarks;
    }
    return application;
  }

  // User business methods
  async getUserBusinesses(userId: number): Promise<UserBusiness[]> {
    return Array.from(this.userBusinesses.values()).filter(
      business => business.userId === userId
    );
  }

  async createUserBusiness(business: InsertUserBusiness): Promise<UserBusiness> {
    const id = this.currentBusinessId++;
    const newBusiness: UserBusiness = { 
      ...business,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.userBusinesses.set(id, newBusiness);
    return newBusiness;
  }

  async updateUserBusiness(id: number, business: Partial<InsertUserBusiness>): Promise<UserBusiness | undefined> {
    const existingBusiness = this.userBusinesses.get(id);
    if (!existingBusiness) return undefined;
    
    const updatedBusiness = { 
      ...existingBusiness, 
      ...business,
      updatedAt: new Date()
    };
    this.userBusinesses.set(id, updatedBusiness);
    return updatedBusiness;
  }

  async deleteUserBusiness(id: number): Promise<boolean> {
    return this.userBusinesses.delete(id);
  }

  // Form template stubs (not implemented in MemStorage, use DbStorage for form templates)
  async getAllFormTemplates(companyId?: number): Promise<FormTemplate[]> {
    return [];
  }

  // External grants stubs (not implemented in MemStorage)
  async getAllExternalGrants(): Promise<ExternalGrant[]> {
    return [];
  }
  async getActiveExternalGrants(): Promise<ExternalGrant[]> {
    return [];
  }
  async getExternalGrant(id: number): Promise<ExternalGrant | undefined> {
    return undefined;
  }
  async createExternalGrant(grant: InsertExternalGrant): Promise<ExternalGrant> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateExternalGrant(id: number, grant: Partial<InsertExternalGrant>): Promise<ExternalGrant | undefined> {
    return undefined;
  }
  async deleteExternalGrant(id: number): Promise<boolean> {
    return false;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    throw new Error("Not implemented in MemStorage");
  }
  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    return undefined;
  }
  async updatePaymentStatus(sessionId: string, status: string, paymentIntentId?: string): Promise<Payment | undefined> {
    return undefined;
  }
  async getUserPayments(userId: number): Promise<Payment[]> {
    return [];
  }
  async getPaymentsByStatus(_status: string, _from?: Date, _to?: Date): Promise<Payment[]> {
    return [];
  }

  async getActiveGrantWriters(niche?: string): Promise<GrantWriter[]> { return []; }
  async getAllGrantWriters(): Promise<(GrantWriter & { inquiryCount: number })[]> { return []; }
  async getGrantWriterById(id: number): Promise<GrantWriter | undefined> { return undefined; }
  async createGrantWriter(writer: InsertGrantWriter): Promise<GrantWriter> { throw new Error("Not implemented in MemStorage"); }
  async updateGrantWriter(id: number, writer: Partial<InsertGrantWriter>): Promise<GrantWriter | undefined> { return undefined; }
  async deleteGrantWriter(id: number): Promise<boolean> { return false; }
  async createGrantWriterInquiry(inquiry: InsertGrantWriterInquiry): Promise<GrantWriterInquiry> { throw new Error("Not implemented in MemStorage"); }
  async getGrantWriterInquiries(_writerId?: number): Promise<(GrantWriterInquiry & { writerName: string })[]> { return []; }
  async markInquiryReplied(_id: number): Promise<GrantWriterInquiry | undefined> { return undefined; }
  async getWeeklyReport(
    _params?: { from?: string; to?: string; prevFrom?: string; prevTo?: string },
    _paymentMetrics?: PaymentMetrics,
  ): Promise<any> { return { rows: [], currentWeekLabel: '', previousWeekLabel: '', mtdLabel: '' }; }
}

// Database storage implementation
export class DbStorage implements IStorage {
  private db: any;
  private operationGate: DatabaseOperationGate<DbResource>;
  private probeGate: DatabaseOperationGate<ProbeResource>;

  constructor(dbUrl: string) {
    const createOperationResource = (): DbResource => {
      const sockets = new TrackedPostgresSockets();
      const client = postgres(dbUrl, postgresOptions(3, sockets));
      return { client, db: drizzle(client), sockets };
    };
    const initialOperationResource = createOperationResource();
    this.db = initialOperationResource.db;
    this.operationGate = new DatabaseOperationGate({
      initialClient: initialOperationResource,
      createClient: createOperationResource,
      closeClient: closePostgresResource,
      maxPending: 12,
      timeoutMs: 15_000,
      isDatabaseFailure,
    });

    const createProbeResource = (): ProbeResource => {
      const sockets = new TrackedPostgresSockets();
      return { client: postgres(dbUrl, postgresOptions(1, sockets)), sockets };
    };
    this.probeGate = new DatabaseOperationGate({
      initialClient: createProbeResource(),
      createClient: createProbeResource,
      closeClient: closePostgresResource,
      maxPending: 1,
      timeoutMs: 15_000,
      isDatabaseFailure,
    });
    activeDbStorage = this;
  }

  async ping(): Promise<void> {
    await this.probeGate.run(async (resource) => {
      await resource.client.unsafe("SELECT 1");
    });
  }

  async runStorageOperation(
    method: (...args: any[]) => any,
    args: unknown[],
  ): Promise<unknown> {
    return this.operationGate.run((resource) => {
      // Snapshot the per-operation Drizzle instance. Even if this operation
      // times out, later continuations cannot start queries on a replacement
      // client after the old one is destroyed.
      const operationStorage = Object.create(this) as DbStorage;
      Object.defineProperties(operationStorage, {
        db: { value: resource.db, writable: true, configurable: true },
      });
      return method.apply(operationStorage, args);
    });
  }

  async bootstrapSampleData(): Promise<void> {
    await this.initializeSampleUsers();
    await this.initializeSampleCompanies();
    await this.initializeSampleGrants();
  }

  private async initializeSampleUsers() {
    const sampleUsers = [
      {
        email: "demo@example.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "Demo",
        lastName: "User",
        phone: "+1-555-0123"
      },
      {
        email: "john@startup.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "John",
        lastName: "Entrepreneur",
        phone: "+1-555-0124"
      },
      {
        email: "sarah@business.com",
        password: bcrypt.hashSync("password123", 10),
        firstName: "Sarah",
        lastName: "Founder",
        phone: "+1-555-0125"
      }
    ];

    try {
      for (const user of sampleUsers) {
        // Check if user already exists
        const existing = await this.getUserByEmail(user.email);
        if (!existing) {
          await this.createUser(user);
          console.log("Added user:", user.email);
        } else {
          console.log("User already exists:", user.email);
        }
      }
    } catch (error) {
      console.error("Error initializing sample users:", error);
    }
  }

  private async initializeSampleCompanies() {
    const sampleCompanies = [
      {
        name: "Circle Of Greatness LLC",
        email: "grants@circleofgreatness.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Empowering beginning entrepreneurs to achieve greatness"
      },
      {
        name: "Coach K University LLC",
        email: "grants@coachkuniversity.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Educational institution supporting business growth and development"
      },
      {
        name: "Dillard Hospitality Group LLC",
        email: "grants@dillardgroup.com",
        password: bcrypt.hashSync("company123", 10),
        description: "Supporting ambitious women in beauty business and entrepreneurship"
      }
    ];

    try {
      for (const company of sampleCompanies) {
        // Check if company already exists
        const existing = await this.getCompanyByEmail(company.email);
        if (!existing) {
          await this.createCompany(company);
          console.log("Added company:", company.email);
        } else {
          console.log("Company already exists:", company.email);
        }
      }
    } catch (error) {
      console.error("Error initializing sample companies:", error);
    }
  }

  private async initializeSampleGrants() {
    // Check if grants already exist
    const existingGrants = await this.db.select().from(grants);
    if (existingGrants.length > 0) {
      console.log("Grants already exist, skipping initialization");
      return;
    }

    console.log("No grants found, initializing sample grants");

    // Get actual company IDs from database
    const circleCompany = await this.getCompanyByEmail("grants@circleofgreatness.com");
    const coachCompany = await this.getCompanyByEmail("grants@coachkuniversity.com");
    const dillardCompany = await this.getCompanyByEmail("grants@dillardgroup.com");

    const sampleGrants: InsertGrant[] = [
      {
        title: "Greatness Grant",
        companyId: circleCompany?.id || 1,
        company: "Circle Of Greatness LLC",
        amount: 2500,
        deadline: new Date("2025-08-29T23:59:59Z").toISOString(),
        category: "Businesses",
        tags: ["$2.5k", "entrepreneurs", "beginning"],
        description: "The Greatness Grant is a funding opportunity designed specifically for beginning entrepreneurs who are ready to take the leap but need financial support to kickstart their journey. Whether you're starting your first business or growing an idea that's been on your heart, this grant is your chance to access the resources you need to succeed.",
        requirements: "Must be a beginning entrepreneur starting their first business or growing an early-stage idea.",
        applicationUrl: "https://example.com/apply/greatness",
        status: "active",
        rating: 50,
        imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true
      },
      {
        title: "Legacy Grant",
        companyId: coachCompany?.id || 2,
        company: "Coach K University LLC",
        amount: 1000,
        deadline: new Date("2025-08-28T23:59:59Z").toISOString(),
        category: "Businesses",
        tags: ["$1k", "business-growth", "scaling"],
        description: "Empower Your Business with the Coach K Legacy Grant: Whether you're launching a new product or scaling operations, this $1,000 grant can give your business the boost it needs to get to that next level.",
        requirements: "Must be an existing business looking to launch new products or scale operations.",
        applicationUrl: "https://example.com/apply/legacy",
        status: "active",
        rating: 48,
        imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true
      },
      {
        title: "Biz Starter Grant",
        companyId: dillardCompany?.id || 3,
        company: "Dillard Hospitality Group LLC",
        amount: 1000,
        deadline: new Date("2025-08-13T23:59:59Z").toISOString(),
        category: "Beauty Business",
        tags: ["$1k", "women-entrepreneurs", "beauty", "startup"],
        description: "Mychel \"Snoop\" Dillard is awarding $1,000 through the Biz Starter Grant to help ambitious women launch their beauty business and start building real wealth through beauty. The application is quick, easy, and designed for people serious about creating passive income, even with zero experience. This grant is made for go-getters who want to build long-term income in beauty business, even if they're just getting started. No business plan needed. Just your drive and a clear first step.",
        requirements: "Must be an ambitious woman looking to launch their beauty business. No business plan required, just drive and determination.",
        applicationUrl: "https://example.com/apply/biz-starter",
        status: "active",
        rating: 52,
        imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        isNew: true
      }
    ];

    try {
      for (const grant of sampleGrants) {
        await this.createGrant(grant);
        console.log("Added grant:", grant.title);
      }
    } catch (error) {
      console.error("Error initializing sample grants:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...user, updatedAt: new Date() };
    const result = await this.db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async claimTrialStartEmail(id: number): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({ trialStartEmailSentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.trialStartEmailSentAt)))
      .returning({ id: users.id });
    return result.length === 1;
  }

  async claimTrialReminderEmail(id: number): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({ trialReminderSentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.trialReminderSentAt)))
      .returning({ id: users.id });
    return result.length === 1;
  }

  async claimRenewalEmail(id: number, invoiceId: string): Promise<boolean> {
    const result = await this.db
      .insert(renewalEmailDeliveries)
      .values({ userId: id, invoiceId })
      .onConflictDoNothing({ target: renewalEmailDeliveries.invoiceId })
      .returning({ invoiceId: renewalEmailDeliveries.invoiceId });
    return result.length === 1;
  }

  async releaseRenewalEmail(id: number, invoiceId: string): Promise<void> {
    await this.db
      .delete(renewalEmailDeliveries)
      .where(and(
        eq(renewalEmailDeliveries.userId, id),
        eq(renewalEmailDeliveries.invoiceId, invoiceId),
      ));
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return true;
  }

  async toggleUserStatus(id: number): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const newStatus = user.status === "active" ? "inactive" : "active";
    const result = await this.db
      .update(users)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateLastLogin(id: number): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getAllGrants(): Promise<Grant[]> {
    return await this.db.select().from(grants);
  }

  async getGrantById(id: number): Promise<Grant | undefined> {
    const result = await this.db.select().from(grants).where(
      and(eq(grants.id, id), eq(grants.status, "active"))
    );
    return result[0];
  }

  async getGrantByIdUnfiltered(id: number): Promise<Grant | undefined> {
    const result = await this.db.select().from(grants).where(eq(grants.id, id));
    return result[0];
  }

  async createGrant(grant: InsertGrant): Promise<Grant> {
    // Generate random rating between 45-50 (displays as 4.5-5.0 when divided by 10)
    const randomRating = Math.floor(Math.random() * 6) + 45; // 45, 46, 47, 48, 49, or 50
    const grantWithRating = {
      ...grant,
      rating: grant.rating || randomRating,
      // Convert deadline to ISO string if it's a Date object
      deadline: grant.deadline instanceof Date ? grant.deadline.toISOString() : grant.deadline
    };
    const result = await this.db.insert(grants).values(grantWithRating).returning();
    return result[0];
  }

  async getUserGrantApplications(userId: number): Promise<UserGrantApplication[]> {
    return await this.db.select().from(userGrantApplications).where(eq(userGrantApplications.userId, userId));
  }

  async createUserGrantApplication(application: InsertUserGrantApplication): Promise<UserGrantApplication> {
    const result = await this.db.insert(userGrantApplications).values(application).returning();
    return result[0];
  }

  async updateUserGrantApplication(id: number, status: string): Promise<UserGrantApplication | undefined> {
    const result = await this.db
      .update(userGrantApplications)
      .set({ status })
      .where(eq(userGrantApplications.id, id))
      .returning();
    return result[0];
  }

  async getUserGrantInterests(userId: number): Promise<UserGrantInterest[]> {
    return await this.db.select().from(userGrantInterests).where(eq(userGrantInterests.userId, userId));
  }

  async setUserGrantInterest(interest: InsertUserGrantInterest): Promise<UserGrantInterest> {
    // Check if interest already exists
    const existing = await this.db
      .select()
      .from(userGrantInterests)
      .where(
        and(
          eq(userGrantInterests.userId, interest.userId),
          eq(userGrantInterests.grantId, interest.grantId)
        )
      );

    if (existing.length > 0) {
      // Update existing interest
      const result = await this.db
        .update(userGrantInterests)
        .set({ 
          preference: interest.preference ?? "none",
          updatedAt: new Date()
        })
        .where(eq(userGrantInterests.id, existing[0].id))
        .returning();
      return result[0];
    }

    // Create new interest
    const result = await this.db.insert(userGrantInterests).values(interest).returning();
    return result[0];
  }

  async getUserGrantInterest(userId: number, grantId: number): Promise<UserGrantInterest | undefined> {
    const result = await this.db
      .select()
      .from(userGrantInterests)
      .where(
        and(
          eq(userGrantInterests.userId, userId),
          eq(userGrantInterests.grantId, grantId)
        )
      );
    return result[0];
  }

  async applyToGrant(userId: number, grantId: number): Promise<UserGrantApplication> {
    // Check if application already exists
    const existing = await this.db
      .select()
      .from(userGrantApplications)
      .where(
        and(
          eq(userGrantApplications.userId, userId),
          eq(userGrantApplications.grantId, grantId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new application
    const result = await this.db
      .insert(userGrantApplications)
      .values({
        userId,
        grantId,
        status: "In Progress",
      })
      .returning();
    return result[0];
  }

  async submitApplicationAnswers(userId: number, grantId: number, answers: Record<string, any>): Promise<UserGrantApplication> {
    // First, get the current application to check its status
    const currentApp = await this.db
      .select()
      .from(userGrantApplications)
      .where(
        and(
          eq(userGrantApplications.userId, userId),
          eq(userGrantApplications.grantId, grantId)
        )
      )
      .limit(1);
    
    // Create application with "Applied" status if it doesn't exist
    if (currentApp.length === 0) {
      const result = await this.db
        .insert(userGrantApplications)
        .values({
          userId,
          grantId,
          status: "Applied",
          answers: JSON.stringify(answers),
        })
        .returning();
      return result[0];
    }

    // Only allow editing for "In Progress" and "Applied" statuses
    if (!["In Progress", "Applied"].includes(currentApp[0].status)) {
      throw new Error("Cannot edit application in current status");
    }

    // Update answers and set status to "Applied" only if currently "In Progress"
    const result = await this.db
      .update(userGrantApplications)
      .set({
        status: currentApp[0].status === "In Progress" ? "Applied" : currentApp[0].status,
        answers: JSON.stringify(answers),
      })
      .where(
        and(
          eq(userGrantApplications.userId, userId),
          eq(userGrantApplications.grantId, grantId)
        )
      )
      .returning();
    
    return result[0];
  }

  async getApplicationByUserAndGrant(userId: number, grantId: number): Promise<UserGrantApplication | undefined> {
    const result = await this.db
      .select()
      .from(userGrantApplications)
      .where(
        and(
          eq(userGrantApplications.userId, userId),
          eq(userGrantApplications.grantId, grantId)
        )
      );
    return result[0];
  }

  // Company methods
  async getCompany(id: number): Promise<Company | undefined> {
    const result = await this.db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const result = await this.db.select().from(companies).where(eq(companies.email, email));
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await this.db.insert(companies).values(company).returning();
    return result[0];
  }

  async getAllCompanies(): Promise<Company[]> {
    return await this.db.select().from(companies);
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const result = await this.db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async deleteCompany(id: number): Promise<boolean> {
    const result = await this.db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  // Admin methods
  async getAdmin(id: number): Promise<Admin | undefined> {
    const result = await this.db.select().from(admins).where(eq(admins.id, id));
    return result[0];
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const result = await this.db.select().from(admins).where(eq(admins.username, username));
    return result[0];
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const result = await this.db.insert(admins).values(admin).returning();
    return result[0];
  }

  async getGrantsByCompany(companyId: number): Promise<Grant[]> {
    return await this.db.select().from(grants).where(eq(grants.companyId, companyId));
  }

  async updateGrant(id: number, grant: Partial<InsertGrant>): Promise<Grant | undefined> {
    // Ensure proper date handling - convert Date to ISO string
    const updateData = { ...grant };
    if (updateData.deadline instanceof Date) {
      updateData.deadline = updateData.deadline.toISOString();
    }
    // If it's already a string, keep it as is
    
    // Fix invalid ratings: if rating exists and is less than 45, generate random 45-50
    if (updateData.rating !== undefined && updateData.rating < 45) {
      updateData.rating = Math.floor(Math.random() * 6) + 45; // 45-50
    }
    
    const result = await this.db
      .update(grants)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(grants.id, id))
      .returning();
    return result[0];
  }

  async updateGrantStatus(grantId: number, status: "active" | "inactive"): Promise<Grant | undefined> {
    const result = await this.db.update(grants)
      .set({ status })
      .where(eq(grants.id, grantId))
      .returning();
    return result[0];
  }

  async toggleGrantStatus(id: number): Promise<Grant | undefined> {
    const grant = await this.getGrantByIdUnfiltered(id);
    if (!grant) return undefined;
    
    const newStatus = grant.status === "active" ? "inactive" : "active";
    const result = await this.db.update(grants)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(grants.id, id))
      .returning();
    return result[0];
  }

  async deleteGrant(id: number): Promise<boolean> {
    const result = await this.db.delete(grants).where(eq(grants.id, id)).returning();
    return result.length > 0;
  }

  async getGrantApplications(grantId: number): Promise<(UserGrantApplication & { user: User })[]> {
    const result = await this.db
      .select({
        id: userGrantApplications.id,
        userId: userGrantApplications.userId,
        grantId: userGrantApplications.grantId,
        status: userGrantApplications.status,
        answers: userGrantApplications.answers,
        remarks: userGrantApplications.remarks,
        appliedAt: userGrantApplications.appliedAt,
        updatedAt: userGrantApplications.updatedAt,
        user: users
      })
      .from(userGrantApplications)
      .leftJoin(users, eq(userGrantApplications.userId, users.id))
      .where(eq(userGrantApplications.grantId, grantId));
    
    return result.map(row => ({
      ...row,
      user: row.user!
    }));
  }

  async getCompanyApplications(companyId: number): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    const result = await this.db
      .select({
        id: userGrantApplications.id,
        userId: userGrantApplications.userId,
        grantId: userGrantApplications.grantId,
        status: userGrantApplications.status,
        answers: userGrantApplications.answers,
        remarks: userGrantApplications.remarks,
        appliedAt: userGrantApplications.appliedAt,
        updatedAt: userGrantApplications.updatedAt,
        user: users,
        grant: grants
      })
      .from(userGrantApplications)
      .leftJoin(users, eq(userGrantApplications.userId, users.id))
      .leftJoin(grants, eq(userGrantApplications.grantId, grants.id))
      .where(eq(grants.companyId, companyId));
    
    return result.map(row => ({
      ...row,
      user: row.user!,
      grant: row.grant!
    }));
  }

  async getAllApplications(): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    const result = await this.db
      .select({
        id: userGrantApplications.id,
        userId: userGrantApplications.userId,
        grantId: userGrantApplications.grantId,
        status: userGrantApplications.status,
        answers: userGrantApplications.answers,
        remarks: userGrantApplications.remarks,
        appliedAt: userGrantApplications.appliedAt,
        updatedAt: userGrantApplications.updatedAt,
        user: users,
        grant: grants
      })
      .from(userGrantApplications)
      .leftJoin(users, eq(userGrantApplications.userId, users.id))
      .leftJoin(grants, eq(userGrantApplications.grantId, grants.id));
    
    return result.map(row => ({
      ...row,
      user: row.user!,
      grant: row.grant!
    }));
  }

  async updateApplicationStatus(applicationId: number, status: string, remarks?: string): Promise<UserGrantApplication | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }
    
    const result = await this.db
      .update(userGrantApplications)
      .set(updateData)
      .where(eq(userGrantApplications.id, applicationId))
      .returning();
    return result[0];
  }

  // User business methods
  async getUserBusinesses(userId: number): Promise<UserBusiness[]> {
    return await this.db.select().from(userBusinesses).where(eq(userBusinesses.userId, userId));
  }

  async createUserBusiness(business: InsertUserBusiness): Promise<UserBusiness> {
    const result = await this.db.insert(userBusinesses).values(business).returning();
    return result[0];
  }

  async updateUserBusiness(id: number, business: Partial<InsertUserBusiness>): Promise<UserBusiness | undefined> {
    const result = await this.db
      .update(userBusinesses)
      .set({ ...business, updatedAt: new Date() })
      .where(eq(userBusinesses.id, id))
      .returning();
    return result[0];
  }

  async deleteUserBusiness(id: number): Promise<boolean> {
    const result = await this.db.delete(userBusinesses).where(eq(userBusinesses.id, id)).returning();
    return result.length > 0;
  }

  // Form builder methods
  async getAllFormTemplates(companyId?: number): Promise<FormTemplate[]> {
    let templates;
    if (companyId) {
      templates = await this.db.select().from(formTemplates).where(eq(formTemplates.companyId, companyId));
    } else {
      templates = await this.db.select().from(formTemplates);
    }
    
    if (templates.length === 0) return [];

    // Fetch fields in one bounded query rather than fanning out one query per
    // template (which could bypass the storage operation admission limit).
    const fields = await this.db
      .select()
      .from(formFields)
      .where(inArray(formFields.formTemplateId, templates.map((template) => template.id)))
      .orderBy(formFields.sortOrder);
    const fieldsByTemplate = new Map<number, FormField[]>();
    for (const field of fields) {
      const templateFields = fieldsByTemplate.get(field.formTemplateId) ?? [];
      templateFields.push(field);
      fieldsByTemplate.set(field.formTemplateId, templateFields);
    }

    return templates.map((template) => ({
      ...template,
      fields: fieldsByTemplate.get(template.id) ?? [],
    }));
  }

  async getFormTemplates(companyId: number): Promise<FormTemplate[]> {
    return await this.db.select().from(formTemplates).where(eq(formTemplates.companyId, companyId));
  }

  async getFormTemplate(id: number): Promise<FormTemplate | undefined> {
    const result = await this.db.select().from(formTemplates).where(eq(formTemplates.id, id));
    return result[0];
  }

  async createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate> {
    const result = await this.db.insert(formTemplates).values(template).returning();
    return result[0];
  }

  async updateFormTemplate(id: number, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined> {
    const result = await this.db
      .update(formTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(formTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteFormTemplate(id: number): Promise<boolean> {
    const result = await this.db.delete(formTemplates).where(eq(formTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getFormFields(templateId: number): Promise<FormField[]> {
    return await this.db
      .select()
      .from(formFields)
      .where(eq(formFields.formTemplateId, templateId))
      .orderBy(formFields.sortOrder);
  }

  async createFormField(field: InsertFormField): Promise<FormField> {
    const result = await this.db.insert(formFields).values(field).returning();
    return result[0];
  }

  async updateFormField(id: number, field: Partial<InsertFormField>): Promise<FormField | undefined> {
    const result = await this.db
      .update(formFields)
      .set(field)
      .where(eq(formFields.id, id))
      .returning();
    return result[0];
  }

  async deleteFormField(id: number): Promise<boolean> {
    const result = await this.db.delete(formFields).where(eq(formFields.id, id)).returning();
    return result.length > 0;
  }

  async deleteFormFieldsByTemplateId(templateId: number): Promise<boolean> {
    const result = await this.db.delete(formFields).where(eq(formFields.formTemplateId, templateId)).returning();
    return result.length >= 0; // Return true even if no fields were deleted (template had no fields)
  }

  async reorderFormFields(templateId: number, fieldOrders: { id: number; sortOrder: number; }[]): Promise<boolean> {
    try {
      for (const order of fieldOrders) {
        await this.db
          .update(formFields)
          .set({ sortOrder: order.sortOrder })
          .where(and(eq(formFields.id, order.id), eq(formFields.formTemplateId, templateId)));
      }
      return true;
    } catch {
      return false;
    }
  }

  // External grants operations
  async getAllExternalGrants(): Promise<ExternalGrant[]> {
    return await this.db.select().from(externalGrants).orderBy(externalGrants.sortOrder);
  }

  async getActiveExternalGrants(): Promise<ExternalGrant[]> {
    return await this.db
      .select()
      .from(externalGrants)
      .where(eq(externalGrants.isActive, true))
      .orderBy(externalGrants.sortOrder);
  }

  async getExternalGrant(id: number): Promise<ExternalGrant | undefined> {
    const result = await this.db.select().from(externalGrants).where(eq(externalGrants.id, id));
    return result[0];
  }

  async createExternalGrant(grant: InsertExternalGrant): Promise<ExternalGrant> {
    const result = await this.db.insert(externalGrants).values(grant).returning();
    return result[0];
  }

  async updateExternalGrant(id: number, grant: Partial<InsertExternalGrant>): Promise<ExternalGrant | undefined> {
    const result = await this.db
      .update(externalGrants)
      .set({ ...grant, updatedAt: new Date() })
      .where(eq(externalGrants.id, id))
      .returning();
    return result[0];
  }

  async deleteExternalGrant(id: number): Promise<boolean> {
    const result = await this.db.delete(externalGrants).where(eq(externalGrants.id, id)).returning();
    return result.length > 0;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await this.db.insert(payments).values(payment).returning();
    return result[0];
  }

  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    const result = await this.db.select().from(payments).where(eq(payments.stripeSessionId, sessionId));
    return result[0];
  }

  async updatePaymentStatus(sessionId: string, status: string, paymentIntentId?: string): Promise<Payment | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (paymentIntentId) {
      updateData.stripePaymentIntentId = paymentIntentId;
    }
    const result = await this.db
      .update(payments)
      .set(updateData)
      .where(eq(payments.stripeSessionId, sessionId))
      .returning();
    return result[0];
  }

  async getUserPayments(userId: number): Promise<Payment[]> {
    return await this.db.select().from(payments).where(eq(payments.userId, userId));
  }

  async getPaymentsByStatus(status: string, from?: Date, to?: Date): Promise<Payment[]> {
    const conditions = [eq(payments.status, status)];
    if (from) conditions.push(gte(payments.createdAt, from));
    if (to) conditions.push(lte(payments.createdAt, to));
    return await this.db.select().from(payments).where(and(...conditions));
  }

  async getActiveGrantWriters(niche?: string): Promise<GrantWriter[]> {
    const rows = await this.db.select().from(grantWriters).where(eq(grantWriters.isActive, true));
    if (!niche || niche === "All") return rows.sort((a: GrantWriter, b: GrantWriter) => a.sortOrder - b.sortOrder);
    return rows.filter((w: GrantWriter) => w.niches.includes(niche)).sort((a: GrantWriter, b: GrantWriter) => a.sortOrder - b.sortOrder);
  }

  async getAllGrantWriters(): Promise<(GrantWriter & { inquiryCount: number })[]> {
    const rows = await this.db
      .select({
        ...getTableColumns(grantWriters),
        inquiryCount: sql<number>`cast(count(${grantWriterInquiries.id}) as int)`,
      })
      .from(grantWriters)
      .leftJoin(grantWriterInquiries, eq(grantWriterInquiries.writerId, grantWriters.id))
      .groupBy(grantWriters.id)
      .orderBy(grantWriters.sortOrder);
    return rows;
  }

  async getGrantWriterById(id: number): Promise<GrantWriter | undefined> {
    const rows = await this.db.select().from(grantWriters).where(eq(grantWriters.id, id));
    return rows[0];
  }

  async createGrantWriter(writer: InsertGrantWriter): Promise<GrantWriter> {
    const result = await this.db.insert(grantWriters).values(writer).returning();
    return result[0];
  }

  async updateGrantWriter(id: number, writer: Partial<InsertGrantWriter>): Promise<GrantWriter | undefined> {
    const result = await this.db.update(grantWriters).set({ ...writer, updatedAt: new Date() }).where(eq(grantWriters.id, id)).returning();
    return result[0];
  }

  async deleteGrantWriter(id: number): Promise<boolean> {
    const result = await this.db.delete(grantWriters).where(eq(grantWriters.id, id)).returning();
    return result.length > 0;
  }

  async createGrantWriterInquiry(inquiry: InsertGrantWriterInquiry): Promise<GrantWriterInquiry> {
    const result = await this.db.insert(grantWriterInquiries).values(inquiry).returning();
    return result[0];
  }

  async getGrantWriterInquiries(writerId?: number): Promise<(GrantWriterInquiry & { writerName: string })[]> {
    const rows = writerId
      ? await this.db.select().from(grantWriterInquiries).where(eq(grantWriterInquiries.writerId, writerId))
      : await this.db.select().from(grantWriterInquiries);

    const writerIds = [...new Set(rows.map(r => r.writerId))];
    const writers = writerIds.length > 0
      ? await this.db.select().from(grantWriters).where(
          writerIds.length === 1
            ? eq(grantWriters.id, writerIds[0])
            : inArray(grantWriters.id, writerIds)
        )
      : [];

    const writerMap = new Map(writers.map(w => [w.id, w.name]));
    return rows
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .map(r => ({ ...r, writerName: writerMap.get(r.writerId) ?? "Unknown" }));
  }

  async markInquiryReplied(id: number): Promise<GrantWriterInquiry | undefined> {
    const result = await this.db
      .update(grantWriterInquiries)
      .set({ repliedAt: new Date() })
      .where(eq(grantWriterInquiries.id, id))
      .returning();
    return result[0];
  }

  async getWeeklyReport(
    params?: { from?: string; to?: string; prevFrom?: string; prevTo?: string },
    paymentMetrics?: PaymentMetrics,
  ): Promise<any> {
    return buildWeeklyReport(this.db, params, paymentMetrics);
  }
}

function createStorageProxy(target?: IStorage): IStorage {
  return new Proxy({} as IStorage, {
    get(_proxyTarget, property) {
      // A storage proxy is returned from storagePromise; it must not look
      // like a thenable to Promise resolution.
      if (property === "then") return undefined;
      if (typeof property !== "string") return undefined;

      const method = target ? (target as any)[property] : undefined;
      if (typeof method !== "function") {
        return async () => {
          throw databaseUnavailableError();
        };
      }

      return async (...args: unknown[]) => {
        try {
          if (target instanceof DbStorage) {
            return await target.runStorageOperation(method, args);
          }
          return await method.apply(target, args);
        } catch (error) {
          if (isDatabaseFailure(error)) {
            databaseAvailability.markUnavailable();
            throw databaseUnavailableError();
          }
          throw error;
        }
      };
    },
  });
}

function createUnavailableStorageProxy(): IStorage {
  return createStorageProxy();
}

// Initialize storage based on availability
let storage: IStorage;

async function initializeStorage(): Promise<IStorage> {
  const activeDbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!activeDbUrl) {
    console.error("[database] configuration unavailable: neither SUPABASE_DATABASE_URL nor DATABASE_URL is set in this runtime.");
    return createUnavailableStorageProxy();
  }
  console.info(`[database] configuration source=${process.env.SUPABASE_DATABASE_URL ? "SUPABASE_DATABASE_URL" : "DATABASE_URL"}; credential values omitted.`);

  // Startup DDL, sequence repair, sample data, and admin credential updates are
  // deliberately disabled by default and are never run in production.
  const developmentBootstrapEnabled =
    process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_DATABASE_BOOTSTRAP === "true";
  if (!developmentBootstrapEnabled) {
    try {
      return createStorageProxy(new DbStorage(activeDbUrl));
    } catch (error) {
      console.error(`[database] storage initialization failed; code=${databaseDiagnosticCode(error)}; credential values omitted.`);
      return createUnavailableStorageProxy();
    }
  }

  if (activeDbUrl) {
    try {
      // Run schema migrations BEFORE instantiating DbStorage so Drizzle
      // doesn't fail on columns that don't exist in the DB yet.
      const migrationSockets = new TrackedPostgresSockets();
      const migrationClient = postgres(activeDbUrl, postgresOptions(1, migrationSockets));
      try {
        await migrationClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
        console.log("✅ users.last_login_at column ensured (pre-init)");
      } catch (e) {
        console.log("⚠️ users.last_login_at pre-init migration:", (e as any).message);
      } finally {
        await closePostgresResource({ client: migrationClient, sockets: migrationSockets });
      }

      const dbStorage = new DbStorage(activeDbUrl);
      // Test the connection by trying to get grants
      await dbStorage.getAllGrants();
      console.log("Database storage initialized successfully");
      
      // Use a single shared client for all startup tasks to avoid exceeding connection pool limits
      const startupSockets = new TrackedPostgresSockets();
      const startupClient = postgres(activeDbUrl, postgresOptions(1, startupSockets));
      
      // Auto-sync all sequences to prevent duplicate key errors after restores/deployments
      try {
        const sequences = [
          { table: 'users', seq: 'users_id_seq' },
          { table: 'grants', seq: 'grants_id_seq' },
          { table: 'user_grant_applications', seq: 'user_grant_applications_id_seq' },
          { table: 'user_businesses', seq: 'user_businesses_id_seq' },
          { table: 'payments', seq: 'payments_id_seq' },
          { table: 'companies', seq: 'companies_id_seq' },
          { table: 'external_grants', seq: 'external_grants_id_seq' },
          { table: 'form_templates', seq: 'form_templates_id_seq' },
          { table: 'form_fields', seq: 'form_fields_id_seq' },
          { table: 'admins', seq: 'admins_id_seq' },
        ];
        for (const { table, seq } of sequences) {
          try {
            await startupClient.unsafe(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
          } catch {}
        }
        console.log("✅ Database sequences synced successfully");
      } catch (error) {
        console.log("⚠️ Sequence sync warning:", error.message);
      }
      
      // Ensure last_login_at column exists on users
      try {
        await startupClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
        console.log("✅ users.last_login_at column ensured");
      } catch (error) {
        console.log("⚠️ users.last_login_at migration warning:", (error as any).message);
      }

      // Ensure amount column exists on external_grants (may be missing if db:push failed)
      try {
        await startupClient.unsafe(`ALTER TABLE external_grants ADD COLUMN IF NOT EXISTS amount INTEGER`);
        console.log("✅ external_grants.amount column ensured");
      } catch (error) {
        console.log("⚠️ external_grants.amount column check:", error.message);
      }

      // Ensure form builder tables exist (reuse the same startup client)
      try {
        await startupClient`
          CREATE TABLE IF NOT EXISTS form_templates (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        await startupClient`
          CREATE TABLE IF NOT EXISTS form_fields (
            id SERIAL PRIMARY KEY,
            form_template_id INTEGER NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
            field_type TEXT NOT NULL,
            label TEXT NOT NULL,
            placeholder TEXT,
            required BOOLEAN DEFAULT false,
            options TEXT[],
            sort_order INTEGER DEFAULT 0
          )
        `;
        console.log("✅ Form builder tables ready");
      } catch (error) {
        console.log("⚠️ Form builder tables issue:", error.message);
      }
      
      // Ensure default admin account exists (handles fresh deployment databases)
      try {
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash('grantfind2025', 10);
        await startupClient`
          INSERT INTO admins (username, password) VALUES ('admin', ${hash})
          ON CONFLICT (username) DO UPDATE SET password = ${hash}
        `;
        console.log("✅ Admin account synced (username: admin)");
      } catch (error) {
        console.log("⚠️ Admin account check:", error.message);
      }

      // Ensure grant_writers and grant_writer_inquiries tables exist
      try {
        await startupClient.unsafe(`
          CREATE TABLE IF NOT EXISTS grant_writers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            bio TEXT NOT NULL,
            photo_url TEXT,
            email TEXT NOT NULL,
            niches TEXT[] NOT NULL DEFAULT '{}',
            specialties TEXT[] NOT NULL DEFAULT '{}',
            years_experience INTEGER NOT NULL DEFAULT 0,
            website_url TEXT,
            linkedin_url TEXT,
            location TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await startupClient.unsafe(`
          ALTER TABLE grant_writers ADD COLUMN IF NOT EXISTS location TEXT
        `);
        // Backfill location for existing writers that don't have one
        await startupClient.unsafe(`
          UPDATE grant_writers SET location = CASE
            WHEN name = 'Angela Morrison' THEN 'New York, NY'
            WHEN name = 'David Chen' THEN 'San Francisco, CA'
            WHEN name = 'Keisha Williams' THEN 'Washington, DC'
            WHEN name = 'Marcus Rodriguez' THEN 'Chicago, IL'
            WHEN name = 'Patricia Thompson' THEN 'Boston, MA'
            WHEN name = 'James Okafor' THEN 'Atlanta, GA'
            WHEN name = 'Stephanie Park' THEN 'Seattle, WA'
            ELSE location
          END
          WHERE location IS NULL
        `);
        await startupClient.unsafe(`
          CREATE TABLE IF NOT EXISTS grant_writer_inquiries (
            id SERIAL PRIMARY KEY,
            writer_id INTEGER NOT NULL,
            sender_name TEXT NOT NULL,
            sender_email TEXT NOT NULL,
            phone TEXT,
            org_name TEXT,
            org_type TEXT,
            budget_range TEXT,
            timeline TEXT,
            message TEXT NOT NULL,
            help_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Add new inquiry columns to existing tables (safe for already-migrated DBs)
        for (const col of [
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS phone TEXT",
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS org_name TEXT",
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS org_type TEXT",
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS budget_range TEXT",
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS timeline TEXT",
          "ALTER TABLE grant_writer_inquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP",
        ]) {
          await startupClient.unsafe(col);
        }
        console.log("✅ Grant writer tables ready");
      } catch (error) {
        console.log("⚠️ Grant writer tables issue:", (error as any).message);
      }

      // Seed dummy grant writer profiles (only if none exist)
      try {
        const existingWriters = await startupClient`SELECT id FROM grant_writers LIMIT 1`;
        if (existingWriters.length === 0) {
          const dummyWriters = [
            {
              name: "Angela Morrison",
              bio: "Angela specializes in helping nonprofits secure transformative funding. With over 12 years of grant writing experience, she has secured more than $8M in grants for organizations across the country. Her deep understanding of funder priorities and compelling storytelling sets her clients apart.",
              photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop",
              email: "angela.morrison@grantwriters.com",
              niches: ["Nonprofits", "Community Development"],
              specialties: ["Federal Grants", "Foundation Grants", "Program Narrative Writing"],
              years_experience: 12,
              website_url: "https://example.com/angela",
              linkedin_url: "https://linkedin.com/in/angelamorrison",
              location: "New York, NY",
              sort_order: 1
            },
            {
              name: "David Chen",
              bio: "David is a results-driven grant writer who has helped over 200 small businesses and startups access government and private funding. He brings a strategic business mindset to every application, focusing on ROI-driven narratives that resonate with funders.",
              photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop",
              email: "david.chen@grantwriters.com",
              niches: ["Small Business", "Startups"],
              specialties: ["SBA Grants", "SBIR/STTR", "Business Development Grants"],
              years_experience: 8,
              website_url: "https://example.com/david",
              linkedin_url: "https://linkedin.com/in/davidchen",
              location: "San Francisco, CA",
              sort_order: 2
            },
            {
              name: "Keisha Williams",
              bio: "Keisha is a former federal program officer who now uses her insider knowledge to help organizations navigate the complex world of government grants. She has an unmatched understanding of federal grant requirements and compliance, with a 90% success rate on federal applications.",
              photo_url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=300&h=300&fit=crop",
              email: "keisha.williams@grantwriters.com",
              niches: ["Government", "Nonprofits"],
              specialties: ["Federal Grants", "HUD Grants", "DOJ Grants", "Compliance Writing"],
              years_experience: 15,
              website_url: "https://example.com/keisha",
              linkedin_url: "https://linkedin.com/in/keishawilliams",
              location: "Washington, DC",
              sort_order: 3
            },
            {
              name: "Marcus Rodriguez",
              bio: "Marcus has dedicated his career to advancing education through strategic grant funding. He has secured over $15M for K-12 schools, community colleges, and universities. Marcus understands the unique language of education funders and knows how to position institutions for success.",
              photo_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop",
              email: "marcus.rodriguez@grantwriters.com",
              niches: ["Education", "Nonprofits"],
              specialties: ["Title I Grants", "STEM Education", "Workforce Development", "Higher Education"],
              years_experience: 10,
              website_url: "https://example.com/marcus",
              linkedin_url: "https://linkedin.com/in/marcusrodriguez",
              location: "Chicago, IL",
              sort_order: 4
            },
            {
              name: "Patricia Thompson",
              bio: "Patricia brings a clinical background to grant writing, giving her an edge in the healthcare sector. She has helped hospitals, clinics, and research organizations secure funding from NIH, HRSA, and major health foundations. Her technical writing skills and medical knowledge produce applications that stand out.",
              photo_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop",
              email: "patricia.thompson@grantwriters.com",
              niches: ["Healthcare", "Nonprofits"],
              specialties: ["NIH Grants", "HRSA Funding", "Community Health", "Medical Research"],
              years_experience: 11,
              website_url: "https://example.com/patricia",
              linkedin_url: "https://linkedin.com/in/patriciathompson",
              location: "Boston, MA",
              sort_order: 5
            },
            {
              name: "James Okafor",
              bio: "James is a passionate advocate for arts and culture funding. He has helped museums, theaters, arts organizations, and individual artists access NEA grants, state arts council funding, and private foundation support. His creative approach to grant writing mirrors the creative work his clients produce.",
              photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop",
              email: "james.okafor@grantwriters.com",
              niches: ["Arts & Culture", "Nonprofits"],
              specialties: ["NEA Grants", "State Arts Funding", "Cultural Programming", "Artist Residencies"],
              years_experience: 7,
              website_url: "https://example.com/james",
              linkedin_url: "https://linkedin.com/in/jamesokafor",
              location: "Atlanta, GA",
              sort_order: 6
            },
            {
              name: "Stephanie Park",
              bio: "Stephanie is a housing and community development expert who has helped CDFIs, housing authorities, and community organizations secure millions in HUD, USDA, and foundation funding. She is passionate about affordable housing and uses grant funding as a tool for lasting community transformation.",
              photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop",
              email: "stephanie.park@grantwriters.com",
              niches: ["Housing", "Community Development", "Nonprofits"],
              specialties: ["HUD CDBG", "HOME Program", "USDA Rural Development", "Affordable Housing"],
              years_experience: 9,
              website_url: "https://example.com/stephanie",
              linkedin_url: "https://linkedin.com/in/stephaniepark",
              location: "Seattle, WA",
              sort_order: 7
            }
          ];
          for (const w of dummyWriters) {
            await startupClient.unsafe(
              `INSERT INTO grant_writers (name, bio, photo_url, email, niches, specialties, years_experience, website_url, linkedin_url, location, is_active, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)`,
              [w.name, w.bio, w.photo_url, w.email, w.niches, w.specialties, w.years_experience, w.website_url, w.linkedin_url, w.location, w.sort_order]
            );
          }
          console.log("✅ Dummy grant writer profiles seeded");
        } else {
          console.log("✅ Grant writers already seeded");
        }
      } catch (error) {
        console.log("⚠️ Grant writer seeding issue:", (error as any).message);
      }

      // Close the shared startup client
      await closePostgresResource({ client: startupClient, sockets: startupSockets });

      // Sample rows are development-only and explicitly opted into with the
      // bootstrap flag above; wait for all writes to settle before serving.
      await dbStorage.bootstrapSampleData();
      
      return createStorageProxy(dbStorage);
    } catch (error) {
      console.error("Development database bootstrap failed; continuing with database-backed storage unavailable.");
      if (!activeDbStorage) {
        try {
          activeDbStorage = new DbStorage(activeDbUrl);
        } catch {
          // Keep the application running in its explicit unavailable state.
        }
      }
    }
  }
  
  return activeDbStorage ? createStorageProxy(activeDbStorage) : createUnavailableStorageProxy();
}

// Export a promise that resolves to the storage instance
export const storagePromise = initializeStorage().then((storageInstance) => {
  storage = storageInstance;
  return storageInstance;
});

let lastProbeFailureLogAt = Number.NEGATIVE_INFINITY;
let probePreviouslyFailed = false;
export const databaseAvailability = new DatabaseAvailability(async () => {
  try {
    if (!activeDbStorage) throw databaseUnavailableError();
    await activeDbStorage.ping();
    if (probePreviouslyFailed) console.info("[database] connection recovered.");
    probePreviouslyFailed = false;
  } catch (error) {
    probePreviouslyFailed = true;
    const now = Date.now();
    if (now - lastProbeFailureLogAt >= 30_000) {
      lastProbeFailureLogAt = now;
      console.error(`[database] availability probe failed; code=${databaseDiagnosticCode(error)}; reason=${databaseDiagnosticReason(error)}; storageInitialized=${!!activeDbStorage}; credential values omitted.`);
    }
    throw error;
  }
});

// For backwards compatibility, export a storage getter
export { storage };
