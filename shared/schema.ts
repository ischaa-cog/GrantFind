import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"), // nullable — Google-auth users have no password
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull().default(""),
  status: text("status").notNull().default("active"), // active, inactive
  subscriptionTier: text("subscription_tier").notNull().default("free"), // free, paid
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  subscriptionStatus: text("subscription_status").notNull().default("free"),
  subscriptionBillingPeriod: text("subscription_billing_period"),
  subscriptionCancelAtPeriodEnd: boolean("subscription_cancel_at_period_end").notNull().default(false),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialUsedAt: timestamp("trial_used_at"),
  trialStartEmailSentAt: timestamp("trial_start_email_sent_at"),
  trialReminderSentAt: timestamp("trial_reminder_sent_at"),
  googleId: text("google_id"), // nullable — set for Google-auth users
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const renewalEmailDeliveries = pgTable("renewal_email_deliveries", {
  invoiceId: text("invoice_id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  description: text("description"),
  website: text("website"),
  logoUrl: text("logo_url"),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const grants = pgTable("grants", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  companyId: integer("company_id").notNull(),
  company: text("company").notNull(), // Keep for compatibility  
  amount: integer("amount").notNull(), // Amount in dollars
  deadline: text("deadline").notNull(), // Store as ISO string to preserve timezone
  timezone: text("timezone").notNull().default("America/New_York"), // EST timezone
  category: text("category").notNull(),
  tags: text("tags").array().notNull().default([]),
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  applicationUrl: text("application_url"),
  formTemplateId: integer("form_template_id"),
  status: text("status").notNull().default("active"), // active, expired
  rating: integer("rating").default(48), // Store as 45-50 for 4.5-5.0 range display
  imageUrl: text("image_url"),
  isNew: boolean("is_new").default(false),
  isHot: boolean("is_hot").default(false),
  timeRemaining: text("time_remaining"), // e.g., "34H : 39M : 40S"
  // Next Steps / Thank You Page Configuration
  enableNextSteps: boolean("enable_next_steps").default(false),
  thankYouHeadline: text("thank_you_headline"),
  thankYouSubheadline: text("thank_you_subheadline"),
  nextStepsHeadline: text("next_steps_headline"),
  nextStepsSubheadline: text("next_steps_subheadline"),
  nextStepsContent1: text("next_steps_content_1"),
  nextStepsCtaText: text("next_steps_cta_text"),
  nextStepsCtaUrl: text("next_steps_cta_url"),
  nextStepsContent2: text("next_steps_content_2"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userGrantApplications = pgTable("user_grant_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  grantId: integer("grant_id").notNull(),
  status: text("status").notNull().default("In Progress"), // "In Progress", "Applied", "Under Review", "Accepted", "Rejected"
  answers: text("answers"), // Store application question answers as JSON string
  remarks: text("remarks"), // Company remarks for the application
  appliedAt: timestamp("applied_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userGrantInterests = pgTable("user_grant_interests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  grantId: integer("grant_id").notNull(),
  preference: text("preference").default("none"), // "saved", "not_interested", "none"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Explicit login schema — password is always required for email/password login
export const loginUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerUserSchema = insertUserSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const insertGrantSchema = createInsertSchema(grants).omit({
  id: true,
});

export const insertUserGrantApplicationSchema = createInsertSchema(userGrantApplications).omit({
  id: true,
  appliedAt: true,
});

export const grantPreferenceEnum = z.enum(["saved", "not_interested", "none"]);

export const insertUserGrantInterestSchema = createInsertSchema(userGrantInterests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  preference: grantPreferenceEnum.default("none"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginCompanySchema = createInsertSchema(companies).pick({
  email: true,
  password: true,
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginAdminSchema = createInsertSchema(admins).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type LoginCompany = z.infer<typeof loginCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type LoginAdmin = z.infer<typeof loginAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertGrant = z.infer<typeof insertGrantSchema>;
export type Grant = typeof grants.$inferSelect;
export type InsertUserGrantApplication = z.infer<typeof insertUserGrantApplicationSchema>;
export type UserGrantApplication = typeof userGrantApplications.$inferSelect;
export type InsertUserGrantInterest = z.infer<typeof insertUserGrantInterestSchema>;
export type UserGrantInterest = typeof userGrantInterests.$inferSelect;

// User businesses table
export const userBusinesses = pgTable("user_businesses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  subcategory: text("subcategory"),
  entityType: text("entity_type"),
  yearEstablished: text("year_established"),
  zipCode: text("zip_code"),
  website: text("website"),
  revenue: text("revenue"),
  businessType: text("business_type").notNull(), // 'existing', 'startup', 'other'
  interests: text("interests").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserBusinessSchema = createInsertSchema(userBusinesses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserBusiness = z.infer<typeof insertUserBusinessSchema>;
export type UserBusiness = typeof userBusinesses.$inferSelect;

// Webhook configurations table
export const webhookConfigs = pgTable("webhook_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  event: text("event").notNull(),
  url: text("url").notNull(),
  active: boolean("active").default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;

// Form templates table - for custom grant application forms
export const formTemplates = pgTable("form_templates", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form fields table - individual fields within each form template
export const formFields = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  formTemplateId: integer("form_template_id").notNull(),
  fieldType: text("field_type").notNull(), // "text", "textarea", "dropdown", "multi-dropdown", "checkbox", "radio"
  label: text("label").notNull(),
  placeholder: text("placeholder"),
  required: boolean("required").default(false),
  options: text("options").array().default([]), // For dropdown, multi-dropdown, checkbox, radio options
  validation: text("validation"), // JSON string for validation rules like min/max length, patterns, etc.
  sortOrder: integer("sort_order").notNull().default(0),
  textContent: text("text_content"), // For terms_and_conditions field type
  linkUrl: text("link_url"), // URL for hyperlink in terms_and_conditions
  buttonFontSize: integer("button_font_size"), // Font size for button field type
  buttonAlignment: text("button_alignment"), // Alignment for button field type
  buttonBgColor: text("button_bg_color"), // Background color for button field type
  buttonTextColor: text("button_text_color"), // Text color for button field type
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFormFieldSchema = createInsertSchema(formFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
export type FormField = typeof formFields.$inferSelect;

// External Grants - Simple grants with just name and external URL
export const externalGrants = pgTable("external_grants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  amount: integer("amount"), // Grant amount in dollars
  category: text("category"), // Optional category for organization
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExternalGrantSchema = createInsertSchema(externalGrants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertExternalGrant = z.infer<typeof insertExternalGrantSchema>;
export type ExternalGrant = typeof externalGrants.$inferSelect;

// Grant Writers - Certified grant writers directory
export const grantWriters = pgTable("grant_writers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull(),
  photoUrl: text("photo_url"),
  email: text("email").notNull(),
  niches: text("niches").array().notNull().default([]),
  specialties: text("specialties").array().notNull().default([]),
  yearsExperience: integer("years_experience").notNull().default(0),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  location: text("location"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const grantWriterInquiries = pgTable("grant_writer_inquiries", {
  id: serial("id").primaryKey(),
  writerId: integer("writer_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  phone: text("phone"),
  orgName: text("org_name"),
  orgType: text("org_type"),
  budgetRange: text("budget_range"),
  timeline: text("timeline"),
  message: text("message").notNull(),
  helpType: text("help_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  repliedAt: timestamp("replied_at"),
});

export const insertGrantWriterSchema = createInsertSchema(grantWriters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGrantWriterInquirySchema = createInsertSchema(grantWriterInquiries).omit({
  id: true,
  createdAt: true,
});

export type InsertGrantWriter = z.infer<typeof insertGrantWriterSchema>;
export type GrantWriter = typeof grantWriters.$inferSelect;
export type InsertGrantWriterInquiry = z.infer<typeof insertGrantWriterInquirySchema>;
export type GrantWriterInquiry = typeof grantWriterInquiries.$inferSelect;

// Payments table - tracks Stripe payments
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
