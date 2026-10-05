import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storagePromise } from "./storage";
import { hashPassword, comparePassword, generateToken, authenticateToken, optionalAuth, type AuthenticatedRequest } from "./auth";
import { generateCompanyToken, authenticateCompany, type AuthenticatedCompanyRequest } from "./company-auth";
import { generateAdminToken, authenticateAdmin, type AuthenticatedAdminRequest } from "./admin-auth";
import { loginUserSchema, registerUserSchema, loginCompanySchema, loginAdminSchema, insertCompanySchema, insertUserBusinessSchema } from "@shared/schema";
import { sendUserRegistrationWebhook, sendBusinessCreatedWebhook, sendTestWebhook, sendApplicationSubmittedWebhook } from "./webhook";
import { sendRegistrationConfirmationEmail, sendTestEmail } from "./email";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getStripePaymentMetrics, reconcilePaidRenewalInvoices, reconcilePendingCheckoutPayments } from "./stripe";

// Persistent webhook storage in JSON file
import fs from 'fs';
import path from 'path';

const WEBHOOK_CONFIG_FILE = path.join(process.cwd(), 'webhook-configs.json');

// Default webhook configurations
const defaultWebhookConfigs = [
  {
    id: "user-registration",
    name: "User Registration",
    event: "user.registered",
    url: "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/",
    active: true,
    description: "Triggered when a new user registers"
  },
  {
    id: "business-created",
    name: "Business Created",
    event: "business.created", 
    url: "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/",
    active: true,
    description: "Triggered when a new business is created"
  },
  {
    id: "application-submitted",
    name: "Application Submitted",
    event: "application.submitted",
    url: "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/",
    active: true,
    description: "Triggered when a user submits a grant application with all answers"
  }
];

// Load webhook configurations from persistent storage
function loadWebhookConfigs() {
  try {
    if (fs.existsSync(WEBHOOK_CONFIG_FILE)) {
      const data = fs.readFileSync(WEBHOOK_CONFIG_FILE, 'utf8');
      const configs = JSON.parse(data);
      console.log('Loaded webhook configurations from persistent storage');
      return configs;
    }
  } catch (error) {
    console.error('Error loading webhook configs:', error);
  }
  
  // Return defaults if file doesn't exist or error occurred
  console.log('Using default webhook configurations');
  return defaultWebhookConfigs;
}

// Save webhook configurations to persistent storage
function saveWebhookConfigs(configs: any[]) {
  try {
    fs.writeFileSync(WEBHOOK_CONFIG_FILE, JSON.stringify(configs, null, 2));
    console.log('Webhook configurations saved to persistent storage');
  } catch (error) {
    console.error('Error saving webhook configs:', error);
  }
}

let webhookConfigs = loadWebhookConfigs();

// Helper function to get webhook config by event
const getWebhookConfig = (event: string) => {
  return webhookConfigs.find(config => config.event === event);
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { confirmPassword, ...validatedData } = registerUserSchema.parse(req.body);
      const storage = await storagePromise;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      
      // Hash password and create user
      const hashedPassword = await hashPassword(validatedData.password);
      const newUser = await storage.createUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
      });
      
      // Generate token
      const token = generateToken(newUser.id, newUser.email);
      
      // Send webhook notification asynchronously (don't block the response)
      sendUserRegistrationWebhook(newUser, getWebhookConfig).catch(error => {
        console.error("Failed to send user registration webhook:", error);
      });
      
      // Send registration confirmation email asynchronously
      sendRegistrationConfirmationEmail(newUser.email, newUser.firstName, newUser.lastName).catch(error => {
        console.error("Failed to send registration confirmation email:", error);
      });
      
      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Test email endpoint (admin only)
  app.post("/api/email/test", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const { toEmail } = req.body;
      if (!toEmail || typeof toEmail !== 'string') {
        return res.status(400).json({ message: "toEmail is required" });
      }
      
      console.log(`Admin sending test email to: ${toEmail}`);
      const result = await sendTestEmail(toEmail);
      
      if (result.success) {
        res.json({ message: "Test email sent successfully", success: true });
      } else {
        res.status(500).json({ message: "Failed to send test email", error: result.error, success: false });
      }
    } catch (error: any) {
      console.error("Test email error:", error);
      res.status(500).json({ message: "Failed to send test email", error: error.message });
    }
  });

  // Google OAuth endpoint
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Google credential required" });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ message: "Google authentication is not configured. Please contact support." });
      }

      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(clientId);

      let payload: import("google-auth-library").TokenPayload | undefined;
      try {
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
      } catch {
        return res.status(401).json({ message: "Invalid Google token" });
      }

      if (!payload || !payload.email) {
        return res.status(401).json({ message: "Invalid Google token: missing email" });
      }
      if (!payload.email_verified) {
        return res.status(401).json({ message: "Google account email is not verified" });
      }

      const { email, given_name, family_name, sub: googleId } = payload;
      const storage = await storagePromise;

      let user = await storage.getUserByEmail(email);

      if (user) {
        if (user.status === "inactive") {
          return res.status(403).json({ message: "This account is inactive. Please contact support." });
        }

        // Link Google ID to existing account if not already linked
        if (!user.googleId) {
          user = (await storage.updateUser(user.id, { googleId })) || user;
        }
      } else {
        // Create new user from Google profile
        user = await storage.createUser({
          email,
          password: null,
          firstName: given_name || email.split("@")[0],
          lastName: family_name || "",
          phone: "",
          googleId,
          subscriptionTier: "free",
          status: "active",
        });

        sendUserRegistrationWebhook(user, getWebhookConfig).catch(console.error);
        sendRegistrationConfirmationEmail(user.email, user.firstName, user.lastName).catch(console.error);
      }

      const token = generateToken(user.id, user.email);

      // Stamp last login (fire-and-forget)
      storage.updateLastLogin(user.id).catch(console.error);

      res.json({
        message: "Google login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          subscriptionTier: user.subscriptionTier || "free",
        },
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Google authentication failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginUserSchema.parse(req.body);
      const storage = await storagePromise;
      
      // Find user by email
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Google-only users have no password
      if (!user.password) {
        return res.status(401).json({ message: "This account uses Google sign-in. Please use the 'Continue with Google' button." });
      }
      
      // Verify password
      const isValidPassword = await comparePassword(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.status === "inactive") {
        return res.status(403).json({ message: "This account is inactive. Please contact support." });
      }
      
      // Generate token
      const token = generateToken(user.id, user.email);

      // Stamp last login (fire-and-forget — don't block the response)
      storage.updateLastLogin(user.id).catch(console.error);

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          subscriptionTier: (user as any).subscriptionTier || "free",
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Auto-refresh the token on each /me call so active users never expire
      const refreshedToken = generateToken(user.id, user.email);
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        subscriptionTier: (user as any).subscriptionTier || "free",
        subscriptionStartDate: (user as any).subscriptionStartDate || null,
        subscriptionEndDate: (user as any).subscriptionEndDate || null,
        stripeSubscriptionId: (user as any).stripeSubscriptionId || null,
        subscriptionStatus: (user as any).subscriptionStatus || "free",
        subscriptionBillingPeriod: (user as any).subscriptionBillingPeriod || null,
        subscriptionCancelAtPeriodEnd: Boolean((user as any).subscriptionCancelAtPeriodEnd),
        trialStartedAt: (user as any).trialStartedAt || null,
        trialEndsAt: (user as any).trialEndsAt || null,
        token: refreshedToken,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // For JWT-based auth, logout is primarily handled client-side by removing the token
      // This endpoint just confirms the logout action
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Company Authentication Routes
  app.post("/api/company/auth/login", async (req, res) => {
    try {
      const validatedData = loginCompanySchema.parse(req.body);
      const storage = await storagePromise;
      
      // Find company by email
      const company = await storage.getCompanyByEmail(validatedData.email);
      console.log("Company lookup for:", validatedData.email, "Found:", !!company);
      if (!company) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Verify password using bcrypt
      const isValidPassword = await comparePassword(validatedData.password, company.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Generate token
      const token = generateCompanyToken(company.id, company.email);
      console.log("Generated token:", token.substring(0, 20) + "...");
      
      res.json({
        message: "Company login successful",
        token,
        company: {
          id: company.id,
          email: company.email,
          name: company.name,
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Company login error:", error);
      res.status(500).json({ message: "Company login failed" });
    }
  });

  app.get("/api/company/auth/me", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const company = await storage.getCompany(req.company!.id);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json({
        id: company.id,
        email: company.email,
        name: company.name,
        description: company.description,
        website: company.website,
      });
    } catch (error) {
      console.error("Get company error:", error);
      res.status(500).json({ message: "Failed to get company" });
    }
  });

  // Admin Authentication Routes
  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      const validatedData = loginAdminSchema.parse(req.body);
      const storage = await storagePromise;
      
      // Find admin by username
      const admin = await storage.getAdminByUsername(validatedData.username);
      if (!admin) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Verify password using bcrypt
      const isValidPassword = await comparePassword(validatedData.password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Generate token
      const token = generateAdminToken(admin.id, admin.username);
      
      res.json({
        message: "Admin login successful",
        token,
        admin: {
          id: admin.id,
          username: admin.username,
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Admin login failed" });
    }
  });

  app.get("/api/admin/auth/me", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const admin = await storage.getAdmin(req.admin!.id);
      
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }
      
      res.json({
        id: admin.id,
        username: admin.username,
      });
    } catch (error) {
      console.error("Get admin error:", error);
      res.status(500).json({ message: "Failed to get admin" });
    }
  });

  app.post("/api/admin/auth/logout", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      res.json({ message: "Admin logout successful" });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ message: "Admin logout failed" });
    }
  });

  // Admin Company Management Routes
  app.get("/api/admin/companies", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post("/api/admin/companies", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const storage = await storagePromise;
      
      // Check if company already exists
      const existingCompany = await storage.getCompanyByEmail(validatedData.email);
      if (existingCompany) {
        return res.status(400).json({ message: "Company with this email already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      const company = await storage.createCompany({
        ...validatedData,
        password: hashedPassword,
      });
      
      res.status(201).json({
        id: company.id,
        email: company.email,
        name: company.name,
        description: company.description,
        website: company.website,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put("/api/admin/companies/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.id);
      
      const updateData: any = { ...req.body };
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const company = await storage.updateCompany(companyId, updateData);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json({
        id: company.id,
        email: company.email,
        name: company.name,
        description: company.description,
        website: company.website,
      });
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/admin/companies/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.id);
      
      const success = await storage.deleteCompany(companyId);
      
      if (!success) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Admin User Management Routes
  app.get("/api/admin/users", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const userId = parseInt(req.params.id);
      
      const updateData: any = { ...req.body };
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(userId, updateData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.patch("/api/admin/users/:id/status", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const userId = parseInt(req.params.id);
      
      const user = await storage.toggleUserStatus(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        status: user.status,
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      res.status(500).json({ message: "Failed to toggle user status" });
    }
  });

  // Admin Grant Management Routes
  app.get("/api/admin/companies/:companyId/grants", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.companyId);
      const grants = await storage.getGrantsByCompany(companyId);
      res.json(grants);
    } catch (error) {
      console.error("Error fetching company grants:", error);
      res.status(500).json({ message: "Failed to fetch grants" });
    }
  });

  app.post("/api/admin/companies/:companyId/grants", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.companyId);
      
      // Get company to set company name
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const grantData = {
        ...req.body,
        companyId: companyId,
        company: company.name,
      };
      
      if (grantData.deadline) {
        grantData.deadline = new Date(grantData.deadline);
      }
      
      const grant = await storage.createGrant(grantData);
      res.status(201).json(grant);
    } catch (error) {
      console.error("Error creating grant:", error);
      res.status(500).json({ message: "Failed to create grant" });
    }
  });

  app.put("/api/admin/grants/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      const grant = await storage.updateGrant(grantId, req.body);
      
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      res.json(grant);
    } catch (error) {
      console.error("Error updating grant:", error);
      res.status(500).json({ message: "Failed to update grant" });
    }
  });

  app.patch("/api/admin/grants/:id/status", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      
      const grant = await storage.toggleGrantStatus(grantId);
      
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      res.json({
        id: grant.id,
        status: grant.status,
      });
    } catch (error) {
      console.error("Error toggling grant status:", error);
      res.status(500).json({ message: "Failed to toggle grant status" });
    }
  });

  app.delete("/api/admin/grants/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      const success = await storage.deleteGrant(grantId);
      
      if (!success) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      res.json({ message: "Grant deleted successfully" });
    } catch (error) {
      console.error("Error deleting grant:", error);
      res.status(500).json({ message: "Failed to delete grant" });
    }
  });

  app.get("/api/admin/grants/:grantId/applications", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.grantId);
      const applications = await storage.getGrantApplications(grantId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/admin/form-templates", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const templates = await storage.getAllFormTemplates(companyId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching form templates:", error);
      res.status(500).json({ message: "Failed to fetch form templates" });
    }
  });

  app.get("/api/admin/companies/:companyId/form-templates", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.companyId);
      const templates = await storage.getFormTemplates(companyId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching form templates:", error);
      res.status(500).json({ message: "Failed to fetch form templates" });
    }
  });

  app.post("/api/admin/form-templates", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      
      // Validate request body with Zod
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
        companyId: z.union([z.number(), z.string()]).transform((val) => {
          const num = typeof val === 'string' ? parseInt(val, 10) : val;
          if (isNaN(num)) {
            throw new Error("Invalid companyId");
          }
          return num;
        }),
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { name, description, companyId } = validationResult.data;
      
      const template = await storage.createFormTemplate({
        name,
        description,
        companyId,
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating form template:", error);
      res.status(500).json({ message: "Failed to create form template" });
    }
  });

  app.post("/api/admin/companies/:companyId/form-templates", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const companyId = parseInt(req.params.companyId);
      
      const template = await storage.createFormTemplate({
        ...req.body,
        companyId: companyId,
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating form template:", error);
      res.status(500).json({ message: "Failed to create form template" });
    }
  });

  app.put("/api/admin/form-templates/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      const template = await storage.updateFormTemplate(templateId, req.body);
      
      if (!template) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error updating form template:", error);
      res.status(500).json({ message: "Failed to update form template" });
    }
  });

  app.delete("/api/admin/form-templates/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      const success = await storage.deleteFormTemplate(templateId);
      
      if (!success) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      res.json({ message: "Form template deleted successfully" });
    } catch (error) {
      console.error("Error deleting form template:", error);
      res.status(500).json({ message: "Failed to delete form template" });
    }
  });

  // Admin Form Template - Get single template
  app.get("/api/admin/form-templates/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      const template = await storage.getFormTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching form template:", error);
      res.status(500).json({ message: "Failed to fetch form template" });
    }
  });

  // Admin Form Template Fields - Get fields for a template
  app.get("/api/admin/form-templates/:templateId/fields", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      const fields = await storage.getFormFields(templateId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching form fields:", error);
      res.status(500).json({ message: "Failed to fetch form fields" });
    }
  });

  // Admin Form Template Fields - Create field
  app.post("/api/admin/form-templates/:templateId/fields", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      
      // Verify template exists
      const template = await storage.getFormTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      const fieldData = {
        formTemplateId: templateId,
        fieldType: req.body.fieldType,
        label: req.body.label,
        placeholder: req.body.placeholder || null,
        required: req.body.required || false,
        options: req.body.options || null,
        sortOrder: req.body.sortOrder || 0,
        textContent: req.body.textContent || null,
        linkUrl: req.body.linkUrl || null,
        buttonFontSize: req.body.buttonFontSize || null,
        buttonAlignment: req.body.buttonAlignment || null,
        buttonBgColor: req.body.buttonBgColor || null,
        buttonTextColor: req.body.buttonTextColor || null
      };
      
      const field = await storage.createFormField(fieldData);
      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating form field:", error);
      res.status(500).json({ message: "Failed to create form field" });
    }
  });

  // Admin Form Template Fields - Delete all fields for a template
  app.delete("/api/admin/form-templates/:templateId/fields", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      
      // Delete all fields for this template
      await storage.deleteFormFieldsByTemplateId(templateId);
      res.json({ message: "All fields deleted successfully" });
    } catch (error) {
      console.error("Error deleting form fields:", error);
      res.status(500).json({ message: "Failed to delete form fields" });
    }
  });

  // Admin Applications Route
  app.get("/api/admin/applications", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const applications = await storage.getAllApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.put("/api/admin/applications/:applicationId/status", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const applicationId = parseInt(req.params.applicationId);
      const { status, remarks } = req.body;
      
      // Validate status
      const validStatuses = ["In Progress", "Applied", "Under Review", "Accepted", "Rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedApplication = await storage.updateApplicationStatus(applicationId, status, remarks);
      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  // Admin All Grants Route (for overview statistics)
  app.get("/api/admin/grants", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grants = await storage.getAllGrants();
      res.json(grants);
    } catch (error) {
      console.error("Error fetching all grants:", error);
      res.status(500).json({ message: "Failed to fetch grants" });
    }
  });

  // Company Grant Management Routes
  app.get("/api/company/grants", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grants = await storage.getGrantsByCompany(req.company!.id);
      res.json(grants);
    } catch (error) {
      console.error("Error fetching company grants:", error);
      res.status(500).json({ message: "Failed to fetch grants" });
    }
  });

  app.post("/api/company/grants", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantData = {
        ...req.body,
        companyId: req.company!.id,
        company: req.company!.name,
      };
      
      // Process date conversion for create as well
      if (grantData.deadline) {
        grantData.deadline = new Date(grantData.deadline);
      }
      
      const grant = await storage.createGrant(grantData);
      res.status(201).json(grant);
    } catch (error) {
      console.error("Error creating grant:", error);
      res.status(500).json({ message: "Failed to create grant" });
    }
  });

  app.put("/api/company/grants/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      
      // Verify the grant belongs to this company
      const existingGrant = await storage.getGrantByIdUnfiltered(grantId);
      if (!existingGrant || existingGrant.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      // Process the request body to handle date conversion
      const updateData = { ...req.body };
      if (updateData.deadline) {
        updateData.deadline = new Date(updateData.deadline);
      }
      
      const updatedGrant = await storage.updateGrant(grantId, updateData);
      res.json(updatedGrant);
    } catch (error) {
      console.error("Error updating grant:", error);
      res.status(500).json({ message: "Failed to update grant" });
    }
  });

  app.patch("/api/company/grants/:id/status", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Validate status
      if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ message: "Invalid status. Must be 'active' or 'inactive'" });
      }
      
      // Verify the grant belongs to this company
      const existingGrant = await storage.getGrantByIdUnfiltered(grantId);
      if (!existingGrant || existingGrant.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      const updatedGrant = await storage.updateGrantStatus(grantId, status);
      if (updatedGrant) {
        res.json(updatedGrant);
      } else {
        res.status(404).json({ message: "Grant not found" });
      }
    } catch (error) {
      console.error("Error updating grant status:", error);
      res.status(500).json({ message: "Failed to update grant status" });
    }
  });

  app.delete("/api/company/grants/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.id);
      
      // Verify the grant belongs to this company
      const existingGrant = await storage.getGrantByIdUnfiltered(grantId);
      if (!existingGrant || existingGrant.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      const deleted = await storage.deleteGrant(grantId);
      if (deleted) {
        res.json({ message: "Grant deleted successfully" });
      } else {
        res.status(400).json({ message: "Failed to delete grant" });
      }
    } catch (error) {
      console.error("Error deleting grant:", error);
      res.status(500).json({ message: "Failed to delete grant" });
    }
  });

  // Form builder routes - Company form template management
  app.get("/api/company/form-templates", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templates = await storage.getFormTemplates(req.company!.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching form templates:", error);
      res.status(500).json({ message: "Failed to fetch form templates" });
    }
  });

  app.get("/api/company/form-templates/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      const template = await storage.getFormTemplate(templateId);
      
      if (!template || template.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching form template:", error);
      res.status(500).json({ message: "Failed to fetch form template" });
    }
  });

  app.post("/api/company/form-templates", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateData = {
        ...req.body,
        companyId: req.company!.id,
      };
      const template = await storage.createFormTemplate(templateData);
      res.json(template);
    } catch (error) {
      console.error("Error creating form template:", error);
      res.status(500).json({ message: "Failed to create form template" });
    }
  });

  app.put("/api/company/form-templates/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      
      // Verify the template belongs to this company
      const existingTemplate = await storage.getFormTemplate(templateId);
      if (!existingTemplate || existingTemplate.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }

      const updatedTemplate = await storage.updateFormTemplate(templateId, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating form template:", error);
      res.status(500).json({ message: "Failed to update form template" });
    }
  });

  app.delete("/api/company/form-templates/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      
      // Verify the template belongs to this company
      const existingTemplate = await storage.getFormTemplate(templateId);
      if (!existingTemplate || existingTemplate.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      const deleted = await storage.deleteFormTemplate(templateId);
      if (deleted) {
        res.json({ message: "Form template deleted successfully" });
      } else {
        res.status(400).json({ message: "Failed to delete form template" });
      }
    } catch (error) {
      console.error("Error deleting form template:", error);
      res.status(500).json({ message: "Failed to delete form template" });
    }
  });

  // Form field management routes
  app.get("/api/company/form-templates/:templateId/fields", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      
      // Verify the template belongs to this company
      const template = await storage.getFormTemplate(templateId);
      if (!template || template.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      const fields = await storage.getFormFields(templateId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching form fields:", error);
      res.status(500).json({ message: "Failed to fetch form fields" });
    }
  });

  app.post("/api/company/form-templates/:templateId/fields", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      
      // Verify the template belongs to this company
      const template = await storage.getFormTemplate(templateId);
      if (!template || template.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }

      console.log("📝 Creating form field with data:", JSON.stringify(req.body, null, 2));
      
      const fieldData: any = {
        fieldType: req.body.fieldType,
        label: req.body.label,
        placeholder: req.body.placeholder,
        required: req.body.required,
        options: req.body.options,
        sortOrder: req.body.sortOrder,
        formTemplateId: templateId,
      };

      // Map camelCase to snake_case for special properties
      if (req.body.textContent !== undefined) {
        fieldData.textContent = req.body.textContent;
      }
      if (req.body.linkUrl !== undefined) {
        fieldData.linkUrl = req.body.linkUrl;
      }
      if (req.body.buttonFontSize !== undefined) {
        fieldData.buttonFontSize = req.body.buttonFontSize;
      }
      if (req.body.buttonAlignment !== undefined) {
        fieldData.buttonAlignment = req.body.buttonAlignment;
      }
      if (req.body.buttonBgColor !== undefined) {
        fieldData.buttonBgColor = req.body.buttonBgColor;
      }
      if (req.body.buttonTextColor !== undefined) {
        fieldData.buttonTextColor = req.body.buttonTextColor;
      }

      const field = await storage.createFormField(fieldData);
      console.log("✅ Created form field:", JSON.stringify(field, null, 2));
      res.json(field);
    } catch (error) {
      console.error("Error creating form field:", error);
      res.status(500).json({ message: "Failed to create form field" });
    }
  });

  app.put("/api/company/form-fields/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const fieldId = parseInt(req.params.id);
      
      // Get the field to verify ownership through template
      const updatedField = await storage.updateFormField(fieldId, req.body);
      if (!updatedField) {
        return res.status(404).json({ message: "Form field not found" });
      }
      
      // Verify the template belongs to this company
      const template = await storage.getFormTemplate(updatedField.formTemplateId);
      if (!template || template.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form field not found" });
      }

      res.json(updatedField);
    } catch (error) {
      console.error("Error updating form field:", error);
      res.status(500).json({ message: "Failed to update form field" });
    }
  });

  app.delete("/api/company/form-fields/:id", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const fieldId = parseInt(req.params.id);
      
      const deleted = await storage.deleteFormField(fieldId);
      if (deleted) {
        res.json({ message: "Form field deleted successfully" });
      } else {
        res.status(404).json({ message: "Form field not found" });
      }
    } catch (error) {
      console.error("Error deleting form field:", error);
      res.status(500).json({ message: "Failed to delete form field" });
    }
  });

  // Delete all form fields for a template
  app.delete("/api/company/form-templates/:id/fields", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      
      // Verify the template belongs to this company
      const existingTemplate = await storage.getFormTemplate(templateId);
      if (!existingTemplate || existingTemplate.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }

      const deleted = await storage.deleteFormFieldsByTemplateId(templateId);
      if (deleted) {
        res.status(204).send(); // No content response for successful bulk delete
      } else {
        res.status(500).json({ message: "Failed to delete template fields" });
      }
    } catch (error) {
      console.error("Error deleting template fields:", error);
      res.status(500).json({ message: "Failed to delete template fields" });
    }
  });

  app.put("/api/company/form-templates/:templateId/fields/reorder", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.templateId);
      
      // Verify the template belongs to this company
      const template = await storage.getFormTemplate(templateId);
      if (!template || template.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Form template not found" });
      }

      const { fieldOrders } = req.body;
      const success = await storage.reorderFormFields(templateId, fieldOrders);
      
      if (success) {
        res.json({ message: "Form fields reordered successfully" });
      } else {
        res.status(400).json({ message: "Failed to reorder form fields" });
      }
    } catch (error) {
      console.error("Error reordering form fields:", error);
      res.status(500).json({ message: "Failed to reorder form fields" });
    }
  });

  // Admin route to add sample AT&T grants
  app.post("/api/admin/add-att-grants", async (req, res) => {
    try {
      const storage = await storagePromise;
      
      const newATTGrants = [
        {
          title: "AT&T 5G Innovation Challenge",
          companyId: 1,
          company: "AT&T",
          amount: 100000,
          deadline: new Date("2025-12-15T17:00:00Z"),
          category: "Technology",
          tags: ["$100k", "5G", "innovation", "telecom"],
          description: "Funding for startups developing innovative 5G applications and solutions that can transform industries.",
          requirements: "Must be developing 5G-enabled technology solutions with clear commercial potential.",
          applicationUrl: "https://example.com/apply/att-5g",
          status: "active",
          rating: 47,
          imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: true,
          isHot: false,
          timeRemaining: null
        },
        {
          title: "AT&T Digital Divide Bridge Grant",
          companyId: 1,
          company: "AT&T",
          amount: 75000,
          deadline: new Date("2025-11-30T16:00:00Z"),
          category: "Social Impact",
          tags: ["$75k", "digital-divide", "education", "community"],
          description: "Supporting organizations that bridge the digital divide and improve digital literacy in underserved communities.",
          requirements: "Must focus on digital inclusion initiatives for underserved populations.",
          applicationUrl: "https://example.com/apply/att-bridge",
          status: "active",
          rating: 45,
          imageUrl: "https://images.unsplash.com/photo-1509475826633-fed577a2c71b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: false,
          isHot: true,
          timeRemaining: null
        },
        {
          title: "AT&T Veteran Business Accelerator",
          companyId: 1,
          company: "AT&T",
          amount: 60000,
          deadline: new Date("2026-01-20T15:00:00Z"),
          category: "Veteran-owned Businesses",
          tags: ["$60k", "veterans", "business", "accelerator"],
          description: "Dedicated funding program for veteran-owned businesses in technology and telecommunications sectors.",
          requirements: "Business owner must be a verified military veteran with at least 51% ownership.",
          applicationUrl: "https://example.com/apply/att-veteran",
          status: "active",
          rating: 46,
          imageUrl: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: false,
          isHot: false,
          timeRemaining: null
        },
        {
          title: "AT&T Smart Cities Innovation Fund",
          companyId: 1,
          company: "AT&T",
          amount: 125000,
          deadline: new Date("2025-09-10T14:00:00Z"),
          category: "Smart Cities",
          tags: ["$125k", "smart-cities", "IoT", "infrastructure"],
          description: "Funding for innovative solutions that make cities smarter, more efficient, and more sustainable through connected technology.",
          requirements: "Must develop IoT or connectivity solutions for urban infrastructure improvement.",
          applicationUrl: "https://example.com/apply/att-smart-cities",
          status: "active",
          rating: 49,
          imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: true,
          isHot: true,
          timeRemaining: "42H : 15M : 30S"
        },
        {
          title: "AT&T Cybersecurity Excellence Grant",
          companyId: 1,
          company: "AT&T",
          amount: 80000,
          deadline: new Date("2025-10-25T13:00:00Z"),
          category: "Cybersecurity",
          tags: ["$80k", "cybersecurity", "enterprise", "security"],
          description: "Supporting startups developing cutting-edge cybersecurity solutions for enterprise and consumer markets.",
          requirements: "Must be developing innovative cybersecurity technology with proven effectiveness.",
          applicationUrl: "https://example.com/apply/att-cyber",
          status: "active",
          rating: 48,
          imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
          isNew: false,
          isHot: false,
          timeRemaining: null
        }
      ];

      // Create each grant
      const createdGrants = [];
      for (const grantData of newATTGrants) {
        const grant = await storage.createGrant(grantData);
        createdGrants.push(grant);
      }

      res.json({ 
        message: "Successfully added 5 new AT&T grants!", 
        grants: createdGrants,
        total: createdGrants.length 
      });
    } catch (error) {
      console.error("Error adding AT&T grants:", error);
      res.status(500).json({ message: "Failed to add AT&T grants" });
    }
  });

  // Company Application Management Routes
  app.get("/api/company/applications", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const applications = await storage.getCompanyApplications(req.company!.id);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching company applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/company/grants/:grantId/applications", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const grantId = parseInt(req.params.grantId);
      
      // Verify the grant belongs to this company
      const grant = await storage.getGrantByIdUnfiltered(grantId);
      if (!grant || grant.companyId !== req.company!.id) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      const applications = await storage.getGrantApplications(grantId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching grant applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.put("/api/company/applications/:applicationId/status", authenticateCompany, async (req: AuthenticatedCompanyRequest, res) => {
    try {
      const storage = await storagePromise;
      const applicationId = parseInt(req.params.applicationId);
      const { status, remarks } = req.body;
      
      // Validate status
      const validStatuses = ["In Progress", "Applied", "Under Review", "Accepted", "Rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedApplication = await storage.updateApplicationStatus(applicationId, status, remarks);
      if (!updatedApplication) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      res.json(updatedApplication);
    } catch (error) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  // Get all grants (with optional auth) - only active grants for users
  app.get("/api/grants", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const allGrants = await storage.getAllGrants();
      // Filter to show only active grants to regular users
      const activeGrants = allGrants.filter(grant => grant.status === "active");
      res.json(activeGrants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grants" });
    }
  });

  // Get grant by ID (with optional auth)
  app.get("/api/grants/:id", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      const grant = await storage.getGrantById(id);
      
      if (!grant) {
        return res.status(404).json({ message: "Grant not found" });
      }
      
      res.json(grant);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch grant" });
    }
  });

  // Get form fields for a template (public endpoint for grant applications)
  app.get("/api/form-templates/:id/fields", async (req, res) => {
    try {
      const storage = await storagePromise;
      const templateId = parseInt(req.params.id);
      
      // Verify the template exists
      const template = await storage.getFormTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Form template not found" });
      }
      
      const fields = await storage.getFormFields(templateId);
      
      // Transform database field types to frontend format
      const transformedFields = fields.map((field: any) => {
        // Map database field types to frontend field types
        let fieldType = field.fieldType;
        if (field.fieldType === 'single_text') {
          fieldType = 'text';
        } else if (field.fieldType === 'multi_text') {
          fieldType = 'textarea';
        } else if (field.fieldType === 'single_dropdown') {
          fieldType = 'select';
        } else if (field.fieldType === 'terms_and_conditions') {
          fieldType = 'checkbox';
        }
        
        return {
          id: field.id,
          fieldType,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options || [],
          order: field.sortOrder,
          textContent: field.textContent,
          linkUrl: field.linkUrl
        };
      }).sort((a: any, b: any) => a.order - b.order);
      
      res.json(transformedFields);
    } catch (error) {
      console.error("Error fetching form fields:", error);
      res.status(500).json({ message: "Failed to fetch form fields" });
    }
  });

  // Get user grant applications (requires auth)
  app.get("/api/user/applications", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const applications = await storage.getUserGrantApplications(req.user!.id);
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Grant interest routes
  app.get('/api/user/interests', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const interests = await storage.getUserGrantInterests(req.user!.id);
      res.json(interests);
    } catch (error) {
      console.error('Error fetching user interests:', error);
      res.status(500).json({ message: 'Failed to fetch interests' });
    }
  });

  app.post('/api/user/interests', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { grantId, preference } = req.body;
      
      if (typeof grantId !== 'number' || typeof preference !== 'string') {
        return res.status(400).json({ message: 'Invalid request data' });
      }
      
      if (!['saved', 'not_interested', 'none'].includes(preference)) {
        return res.status(400).json({ message: 'Invalid preference value' });
      }
      
      const storage = await storagePromise;
      const interest = await storage.setUserGrantInterest({
        userId: req.user!.id,
        grantId,
        preference: preference as "saved" | "not_interested" | "none"
      });
      
      res.json(interest);
    } catch (error) {
      console.error('Error setting user interest:', error);
      res.status(500).json({ message: 'Failed to set interest' });
    }
  });

  app.get('/api/user/interests/:grantId', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const grantId = parseInt(req.params.grantId);
      
      if (isNaN(grantId)) {
        return res.status(400).json({ message: 'Invalid grant ID' });
      }
      
      const storage = await storagePromise;
      const interest = await storage.getUserGrantInterest(req.user!.id, grantId);
      res.json(interest || { preference: 'none' }); // Default to none if no record
    } catch (error) {
      console.error('Error fetching user interest:', error);
      res.status(500).json({ message: 'Failed to fetch interest' });
    }
  });

  // Create user grant application (requires auth)
  app.post("/api/user/applications", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const { grantId, status } = req.body;
      
      const application = await storage.createUserGrantApplication({
        userId: req.user!.id,
        grantId,
        status
      });
      
      res.json(application);
    } catch (error) {
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  // Grant application endpoints
  app.post("/api/grants/:grantId/apply", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const grantId = parseInt(req.params.grantId);
      
      if (isNaN(grantId)) {
        return res.status(400).json({ message: 'Invalid grant ID' });
      }
      
      const storage = await storagePromise;
      const application = await storage.applyToGrant(req.user!.id, grantId);
      res.json(application);
    } catch (error) {
      console.error("Error applying to grant:", error);
      res.status(500).json({ message: "Failed to apply to grant" });
    }
  });

  app.get("/api/grants/:grantId/application", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const grantId = parseInt(req.params.grantId);
      
      if (isNaN(grantId)) {
        return res.status(400).json({ message: 'Invalid grant ID' });
      }
      
      const storage = await storagePromise;
      const application = await storage.getApplicationByUserAndGrant(req.user!.id, grantId);
      
      if (application) {
        res.json(application);
      } else {
        res.status(404).json({ message: "Application not found" });
      }
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  app.post("/api/grants/:grantId/submit-answers", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const grantId = parseInt(req.params.grantId);
      const { answers } = req.body;
      
      if (isNaN(grantId)) {
        return res.status(400).json({ message: 'Invalid grant ID' });
      }
      
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ message: 'Invalid answers format' });
      }
      
      const storage = await storagePromise;
      const application = await storage.submitApplicationAnswers(req.user!.id, grantId, answers);
      
      // Get additional data for webhook
      const fullUser = await storage.getUser(req.user!.id);
      const grant = await storage.getGrantById(grantId);
      const userBusinesses = await storage.getUserBusinesses(req.user!.id);
      const primaryBusiness = userBusinesses.length > 0 ? userBusinesses[0] : null;
      
      // Send application submitted webhook asynchronously
      if (grant && fullUser) {
        console.log(`Sending application submission webhook for grant: ${grant.title} (User: ${fullUser.email})`);
        sendApplicationSubmittedWebhook(fullUser, primaryBusiness, grant, application, getWebhookConfig).catch(error => {
          console.error("Failed to send application submission webhook:", error);
        });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Error submitting answers:", error);
      res.status(500).json({ message: "Failed to submit answers" });
    }
  });

  // User business routes
  app.get("/api/user/businesses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const businesses = await storage.getUserBusinesses(req.user!.id);
      res.json(businesses);
    } catch (error) {
      console.error("Error fetching user businesses:", error);
      res.status(500).json({ message: "Failed to fetch businesses" });
    }
  });

  app.post("/api/user/businesses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body || {};
      const validatedData = insertUserBusinessSchema.parse({
        ...body,
        userId: req.user!.id,
        name: body.name || `${req.user!.email?.split('@')[0] || 'User'}'s Business`,
        businessType: body.businessType || "other",
      });
      
      const storage = await storagePromise;
      const business = await storage.createUserBusiness(validatedData);
      
      // Send business creation webhook notification asynchronously
      // Get full user data from storage for webhook
      const fullUser = await storage.getUser(req.user!.id);
      if (fullUser) {
        sendBusinessCreatedWebhook(fullUser, business, getWebhookConfig).catch(error => {
          console.error("Failed to send business creation webhook:", error);
        });
      }
      
      res.status(201).json(business);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating user business:", error.message || error);
      res.status(500).json({ message: "Failed to create business", detail: error.message });
    }
  });

  app.put("/api/user/businesses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const businessId = parseInt(req.params.id);
      if (isNaN(businessId)) {
        return res.status(400).json({ message: 'Invalid business ID' });
      }

      const storage = await storagePromise;
      
      // Verify business belongs to user
      const existingBusinesses = await storage.getUserBusinesses(req.user!.id);
      const businessExists = existingBusinesses.some(b => b.id === businessId);
      
      if (!businessExists) {
        return res.status(404).json({ message: "Business not found" });
      }

      const updatedBusiness = await storage.updateUserBusiness(businessId, req.body);
      res.json(updatedBusiness);
    } catch (error) {
      console.error("Error updating user business:", error);
      res.status(500).json({ message: "Failed to update business" });
    }
  });

  app.delete("/api/user/businesses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const businessId = parseInt(req.params.id);
      if (isNaN(businessId)) {
        return res.status(400).json({ message: 'Invalid business ID' });
      }

      const storage = await storagePromise;
      
      // Verify business belongs to user
      const existingBusinesses = await storage.getUserBusinesses(req.user!.id);
      const businessExists = existingBusinesses.some(b => b.id === businessId);
      
      if (!businessExists) {
        return res.status(404).json({ message: "Business not found" });
      }

      const deleted = await storage.deleteUserBusiness(businessId);
      if (deleted) {
        res.json({ message: "Business deleted successfully" });
      } else {
        res.status(400).json({ message: "Failed to delete business" });
      }
    } catch (error) {
      console.error("Error deleting user business:", error);
      res.status(500).json({ message: "Failed to delete business" });
    }
  });

  // User Profile Management Endpoints
  app.put("/api/user/profile/email", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { newEmail, password } = req.body;
      
      if (!newEmail || !password) {
        return res.status(400).json({ message: "New email and current password are required" });
      }

      const storage = await storagePromise;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const bcrypt = await import("bcryptjs");
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Check if new email is already in use
      const existingUser = await storage.getUserByEmail(newEmail);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Update email
      await storage.updateUser(user.id, { email: newEmail });
      res.json({ message: "Email updated successfully" });
    } catch (error) {
      console.error("Error updating email:", error);
      res.status(500).json({ message: "Failed to update email" });
    }
  });

  app.put("/api/user/profile/password", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const storage = await storagePromise;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const bcrypt = await import("bcryptjs");
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      
      // Issue a fresh token so the user stays logged in
      const newToken = generateToken(user.id, user.email);
      res.json({ message: "Password updated successfully", token: newToken });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.put("/api/user/profile", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        phone: z.string().optional(),
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }
      const storage = await storagePromise;
      const updated = await storage.updateUser(req.user!.id, result.data);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Webhook test endpoint (for development/testing)
  app.post("/api/webhook/test", async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ message: "Webhook URL is required" });
      }
      
      // If payload is provided, use it directly; otherwise determine event type
      if (payload) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'GrantFind/1.0',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            return res.status(400).json({ 
              message: `Webhook failed with status ${response.status}: ${response.statusText}`,
              success: false 
            });
          }

          res.json({ message: `Webhook test successful! Status: ${response.status}`, success: true });
        } catch (error) {
          res.status(500).json({ 
            message: `Webhook test failed: ${error}`,
            success: false 
          });
        }
      } else {
        // Fallback to sendTestWebhook function
        const result = await sendTestWebhook(webhookUrl);
        
        if (result.success) {
          res.json({ message: result.message, success: true });
        } else {
          res.status(400).json({ message: result.message, success: false });
        }
      }
    } catch (error) {
      console.error("Webhook test error:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // Webhook configuration endpoint
  app.get("/api/webhook/config", async (req, res) => {
    try {
      const userWebhookUrl = process.env.USER_REGISTRATION_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
      const businessWebhookUrl = process.env.BUSINESS_CREATED_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
      const applicationWebhookUrl = process.env.APPLICATION_SUBMITTED_WEBHOOK_URL || "https://hooks.zapier.com/hooks/catch/1866149/u4tr5pf/";
      
      res.json({
        userRegistration: {
          configured: !!userWebhookUrl,
          url: userWebhookUrl ? `${userWebhookUrl.substring(0, 20)}...` : null
        },
        businessCreated: {
          configured: !!businessWebhookUrl,
          url: businessWebhookUrl ? `${businessWebhookUrl.substring(0, 20)}...` : null
        },
        applicationSubmitted: {
          configured: !!applicationWebhookUrl,
          url: applicationWebhookUrl ? `${applicationWebhookUrl.substring(0, 20)}...` : null
        }
      });
    } catch (error) {
      console.error("Webhook config error:", error);
      res.status(500).json({ message: "Failed to get webhook config" });
    }
  });



  // Admin webhook management endpoints
  app.get('/api/admin/webhooks', (req, res) => {
    res.json({ webhooks: webhookConfigs });
  });

  app.post('/api/admin/webhooks', (req, res) => {
    const { id, name, event, url, description, active } = req.body;
    
    if (!id || !name || !event || !url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: id, name, event, url' 
      });
    }

    // Find and update existing webhook or create new one
    const existingIndex = webhookConfigs.findIndex(w => w.id === id);
    const webhookData = {
      id,
      name,
      event,
      url,
      description: description || '',
      active: active !== undefined ? active : true
    };

    if (existingIndex >= 0) {
      // Update existing webhook
      webhookConfigs[existingIndex] = webhookData;
      console.log('Webhook configuration updated:', webhookData);
    } else {
      // Add new webhook
      webhookConfigs.push(webhookData);
      console.log('Webhook configuration created:', webhookData);
    }
    
    // Save to persistent storage
    saveWebhookConfigs(webhookConfigs);
    
    res.json({ 
      success: true, 
      message: 'Webhook configuration saved successfully',
      webhook: webhookData
    });
  });

  app.delete('/api/admin/webhooks/:id', (req, res) => {
    const { id } = req.params;
    
    const initialLength = webhookConfigs.length;
    webhookConfigs = webhookConfigs.filter(w => w.id !== id);
    
    if (webhookConfigs.length < initialLength) {
      console.log('Webhook configuration deleted:', id);
      // Save to persistent storage
      saveWebhookConfigs(webhookConfigs);
      res.json({ 
        success: true, 
        message: 'Webhook configuration deleted successfully' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Webhook configuration not found' 
      });
    }
  });

  // Enhanced webhook testing endpoint
  app.post('/api/webhook/test', async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ message: "Webhook URL is required" });
      }

      // If payload is provided, use it; otherwise use test webhook function
      if (payload) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            res.json({
              success: true,
              message: `Webhook test successful - Status: ${response.status}`,
              status: response.status,
            });
          } else {
            res.json({
              success: false,
              message: `Webhook test failed - Status: ${response.status}`,
              status: response.status,
            });
          }
        } catch (error: any) {
          console.error('Webhook test error:', error);
          res.json({
            success: false,
            message: `Webhook test failed: ${error.message}`,
          });
        }
      } else {
        // Use existing test webhook function
        const result = await sendTestWebhook(webhookUrl);
        
        if (result.success) {
          res.json({ message: result.message, success: true });
        } else {
          res.status(400).json({ message: result.message, success: false });
        }
      }
    } catch (error) {
      console.error("Webhook test error:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // Object storage routes for public file uploading (grant images)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      res.set("Cache-Control", "public, max-age=3600");
      return res.redirect(302, objectStorageService.getPublicObjectUrl(req.path));
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error creating image upload URL:", error);
      res.status(500).json({ error: "Image upload is unavailable" });
    }
  });

  app.put("/api/grant-images", async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.imageURL,
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting grant image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Grant Application Reviewer - AI Analysis Endpoint
  app.post("/api/review-application", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { grantRequirements, applicationText } = req.body;
      
      if (!grantRequirements || !applicationText) {
        return res.status(400).json({ message: "Grant requirements and application text are required" });
      }

      // Check if OpenAI is configured
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ 
          message: "AI service not configured. Please contact support to enable the Grant Application Reviewer." 
        });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const systemPrompt = `You are a Grant Application Reviewer that evaluates grant applications against grant requirements.

Your task is to:
1. Analyze the application for grammar, clarity, and professionalism
2. Evaluate alignment with the grant's goals and requirements
3. Score the application using these criteria (each out of 5):
   - Alignment with Funder Goals
   - Feasibility of the Project
   - Impact of the Project
   - Innovation
   - Organizational Capacity
   - Budget Feasibility
   - Scalability and Sustainability

Respond in JSON format with this exact structure:
{
  "scores": [
    {"criteria": "Alignment with Funder Goals", "score": 4, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Feasibility of the Project", "score": 3, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Impact of the Project", "score": 5, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Innovation", "score": 4, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Organizational Capacity", "score": 3, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Budget Feasibility", "score": 4, "maxScore": 5, "notes": "Specific feedback here"},
    {"criteria": "Scalability and Sustainability", "score": 2, "maxScore": 5, "notes": "Specific feedback here"}
  ],
  "totalScore": 25,
  "maxTotalScore": 35,
  "feedback": "Detailed overall feedback here explaining the evaluation",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "improvements": ["Improvement area 1", "Improvement area 2", "Improvement area 3"]
}`;

      const userPrompt = `GRANT REQUIREMENTS:
${grantRequirements}

APPLICATION TO REVIEW:
${applicationText}

Please analyze this grant application against the requirements and provide a detailed evaluation with scores and recommendations.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const reviewResult = JSON.parse(responseContent);
      res.json(reviewResult);
    } catch (error: any) {
      console.error("Application review error:", error);
      
      // Sanitize error messages - don't expose internal details to client
      let userMessage = "Failed to analyze application. Please try again.";
      let statusCode = 500;
      
      if (error.status === 429 || error.message?.includes('rate limit')) {
        userMessage = "The service is currently busy. Please wait a moment and try again.";
        statusCode = 429;
      } else if (error.status === 401 || error.status === 403) {
        userMessage = "AI service authentication error. Please contact support.";
        statusCode = 500;
      } else if (error.message?.includes('context length') || error.message?.includes('too long')) {
        userMessage = "Your application is too long to analyze. Please try with a shorter version.";
        statusCode = 400;
      } else if (error.message?.includes('JSON')) {
        userMessage = "There was an issue processing the analysis. Please try again.";
      }
      
      res.status(statusCode).json({ message: userMessage });
    }
  });

  // ===============================
  // GRANT PROPOSAL WRITER ENDPOINTS
  // ===============================

  // Analyze grant requirements
  app.post("/api/proposal-writer/analyze-grant", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { grantUrl, grantText } = req.body;
      
      if (!grantUrl && !grantText) {
        return res.status(400).json({ message: "Please provide a grant URL or paste the grant guidelines" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ 
          message: "AI service not configured. Please contact support." 
        });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const grantContent = grantText || `Grant URL: ${grantUrl}`;

      const systemPrompt = `You are a Grant Analysis Expert. Analyze the provided grant information and extract key details.

Respond in JSON format with this exact structure:
{
  "grantType": "government" | "foundation" | "corporate" | "other",
  "formattingStandards": ["Standard 1", "Standard 2"],
  "keyRequirements": ["Requirement 1", "Requirement 2"],
  "fundingPriorities": ["Priority 1", "Priority 2"],
  "deadline": "Date if mentioned, null otherwise",
  "maxWordCount": number if mentioned, null otherwise
}

Be thorough in extracting all requirements and priorities from the grant guidelines.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this grant information:\n\n${grantContent}` }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const analysis = JSON.parse(responseContent);
      res.json(analysis);
    } catch (error: any) {
      console.error("Grant analysis error:", error);
      res.status(500).json({ message: "Failed to analyze grant. Please try again." });
    }
  });

  // Generate proposal outline
  app.post("/api/proposal-writer/generate-outline", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { grantAnalysis, projectPurpose, targetCommunity, primaryGoals } = req.body;
      
      if (!projectPurpose || !targetCommunity || !primaryGoals) {
        return res.status(400).json({ message: "Please provide all project information" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const systemPrompt = `You are a Grant Proposal Writer. Create a comprehensive proposal outline based on the project information.

The grant type is: ${grantAnalysis?.grantType || 'general'}
Key requirements: ${grantAnalysis?.keyRequirements?.join(', ') || 'Not specified'}
Funder priorities: ${grantAnalysis?.fundingPriorities?.join(', ') || 'Not specified'}

Generate a detailed outline for each section. Respond in JSON format:
{
  "coverLetter": "Draft cover letter text introducing the organization and funding request",
  "executiveSummary": "Concise summary of project purpose, goals, and funding needs",
  "statementOfNeed": "Detailed description of the community problem with supporting context",
  "projectDescription": {
    "objectives": "Clear, measurable project goals",
    "methods": "Activities and steps to achieve objectives",
    "timeline": "Key milestones and dates"
  },
  "budget": "Cost breakdown categories and justifications",
  "impactStatement": "Expected short and long-term outcomes",
  "evaluationPlan": "Methods for assessing project success",
  "sustainabilityPlan": "Strategies for project continuation beyond grant",
  "organizationalBackground": "Organization mission, expertise, and credibility",
  "appendices": "List of supplementary materials to include"
}`;

      const userPrompt = `Create a grant proposal outline for this project:

PROJECT PURPOSE: ${projectPurpose}

TARGET COMMUNITY: ${targetCommunity}

PRIMARY GOALS AND OUTCOMES: ${primaryGoals}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const outline = JSON.parse(responseContent);
      res.json(outline);
    } catch (error: any) {
      console.error("Outline generation error:", error);
      res.status(500).json({ message: "Failed to generate outline. Please try again." });
    }
  });

  // Improve a section
  app.post("/api/proposal-writer/improve-section", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { sectionName, currentContent, grantAnalysis, projectInfo } = req.body;
      
      if (!sectionName) {
        return res.status(400).json({ message: "Section name is required" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const systemPrompt = `You are a Grant Writing Expert. Improve the given section of a grant proposal.

Grant type: ${grantAnalysis?.grantType || 'general'}
Funder priorities: ${grantAnalysis?.fundingPriorities?.join(', ') || 'Not specified'}

Guidelines:
- Use persuasive, professional language
- Be specific and data-driven where possible
- Align with funder priorities
- Maintain clarity and readability
- Keep the content substantive and compelling

Return ONLY the improved text, no additional commentary.`;

      const userPrompt = `Improve this ${sectionName} section:

PROJECT CONTEXT:
- Purpose: ${projectInfo?.purpose || 'Not provided'}
- Target Community: ${projectInfo?.community || 'Not provided'}
- Goals: ${projectInfo?.goals || 'Not provided'}

CURRENT CONTENT:
${currentContent || 'No content yet - please generate initial draft'}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: 2048,
      });

      const improvedContent = completion.choices[0]?.message?.content;
      if (!improvedContent) {
        throw new Error("No response from AI");
      }

      res.json({ improvedContent });
    } catch (error: any) {
      console.error("Section improvement error:", error);
      res.status(500).json({ message: "Failed to improve section. Please try again." });
    }
  });

  // Check compliance
  app.post("/api/proposal-writer/check-compliance", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { sectionDrafts, grantAnalysis } = req.body;
      
      if (!sectionDrafts) {
        return res.status(400).json({ message: "Section drafts are required" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const systemPrompt = `You are a Grant Compliance Reviewer. Check each section against the grant requirements.

Grant type: ${grantAnalysis?.grantType || 'general'}
Key requirements: ${grantAnalysis?.keyRequirements?.join(', ') || 'Standard grant requirements'}
Formatting standards: ${grantAnalysis?.formattingStandards?.join(', ') || 'Standard formatting'}

Evaluate each section for:
- Completeness
- Alignment with funder priorities
- Clarity and professionalism
- Word count appropriateness

Respond in JSON format:
{
  "checks": [
    {
      "section": "Section Name",
      "status": "compliant" | "warning" | "error",
      "message": "Brief explanation",
      "suggestion": "Improvement suggestion if applicable"
    }
  ]
}`;

      const userPrompt = `Check compliance for these proposal sections:\n\n${JSON.stringify(sectionDrafts, null, 2)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(responseContent);
      res.json(result);
    } catch (error: any) {
      console.error("Compliance check error:", error);
      res.status(500).json({ message: "Failed to check compliance. Please try again." });
    }
  });

  // Compile final draft
  app.post("/api/proposal-writer/compile-draft", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { sectionDrafts, grantAnalysis, projectInfo } = req.body;
      
      if (!sectionDrafts) {
        return res.status(400).json({ message: "Section drafts are required" });
      }

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const systemPrompt = `You are a Grant Proposal Editor. Compile the provided sections into a cohesive, submission-ready grant proposal.

Guidelines:
- Ensure smooth transitions between sections
- Maintain consistent tone and voice throughout
- Format with clear section headers
- Check for coherence and flow
- Remove any redundancy

Output the complete proposal as formatted text with clear section headers.`;

      const sectionOrder = [
        'coverLetter',
        'executiveSummary', 
        'statementOfNeed',
        'projectDescription',
        'budget',
        'impactStatement',
        'evaluationPlan',
        'sustainabilityPlan',
        'organizationalBackground',
        'appendices'
      ];

      const sectionLabels: Record<string, string> = {
        coverLetter: "COVER LETTER",
        executiveSummary: "EXECUTIVE SUMMARY",
        statementOfNeed: "STATEMENT OF NEED",
        projectDescription: "PROJECT DESCRIPTION",
        budget: "BUDGET",
        impactStatement: "IMPACT STATEMENT",
        evaluationPlan: "EVALUATION PLAN",
        sustainabilityPlan: "SUSTAINABILITY PLAN",
        organizationalBackground: "ORGANIZATIONAL BACKGROUND",
        appendices: "APPENDICES"
      };

      let sectionsText = "";
      for (const key of sectionOrder) {
        if (sectionDrafts[key]) {
          sectionsText += `\n\n=== ${sectionLabels[key]} ===\n${sectionDrafts[key]}`;
        }
      }

      const userPrompt = `Compile and polish this grant proposal into a final, submission-ready document:
${sectionsText}

Ensure the document flows naturally and maintains professional tone throughout.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_completion_tokens: 8192,
      });

      const finalDraft = completion.choices[0]?.message?.content;
      if (!finalDraft) {
        throw new Error("No response from AI");
      }

      res.json({ finalDraft });
    } catch (error: any) {
      console.error("Draft compilation error:", error);
      res.status(500).json({ message: "Failed to compile draft. Please try again." });
    }
  });

  // ===============================
  // GRANT FINDER ENDPOINTS
  // ===============================

  app.post("/api/grant-finder/search", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        businessType,
        projectGoals,
        location,
        geographicScope,
        industry,
        fundingNeed,
        ownershipTypes,
        hasAppliedBefore,
        grantPreference,
        currentDate
      } = req.body;

      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });

      const ownershipDescription = ownershipTypes.includes("none") 
        ? "No special ownership designation"
        : ownershipTypes.map((t: string) => {
            if (t === "minority") return "Minority-owned";
            if (t === "women") return "Women-owned";
            if (t === "veteran") return "Veteran-owned";
            if (t === "disabled") return "Disabled-owned";
            return t;
          }).join(", ");

      const systemPrompt = `You are a Business Grant Finder expert. Your objective is to identify REAL grant opportunities based on the user's business profile. You MUST return exactly 10 grants from this verified list.

VERIFIED GRANT DATABASE (ACTIVE & ACCEPTING APPLICATIONS):

=== WOMEN-OWNED BUSINESS GRANTS (Rolling/Monthly) ===
1. Amber Grant | $10,000 monthly + $25,000 annual | Rolling monthly | https://ambergrantsforwomen.com/get-an-amber-grant/
2. IFundWomen Universal Grant Application | Various amounts | Rolling | https://www.ifundwomen.com/grants/apply-for-grants
3. Cartier Women's Initiative | Up to $100,000 | Opens April 2025 | https://www.cartierwomensinitiative.com/
4. Galaxy Grant (Hidden Star) | $2,750 | Quarterly | Women & minority owners | https://www.galaxyofstars.org
5. Tory Burch Foundation Fellows | $5,000 + mentorship | Annual cycle | https://www.toryburchfoundation.org/programs/fellows-program/

=== MINORITY-OWNED BUSINESS GRANTS ===
6. Comcast RISE | $5,000 + resources | Rolling through Sept 2025 | https://www.comcastrise.com
7. Freed Fellowship | $500/month + $2,500 year-end | Rolling | https://www.yourfreedstudio.com/freed-fellowship
8. Secretsos Small Business Grant | $2,500 | Rolling quarterly | https://secretsos.com/small-business-grant/
9. Greatness Grant | $2,500 | Rolling | https://www.greatnessgrants.com
10. NAACP Grants | Various | Check website | https://naacp.org/find-resources/grants

=== VETERAN-OWNED BUSINESS GRANTS ===
11. Hiring Our Heroes Small Business Grant | $10,000-$25,000 | Annual Dec deadline | https://www.hiringourheroes.org/small-business-grant/
12. Warrior Rising | Training + startup grants | Ongoing | https://www.warriorrising.org/
13. StreetShares Foundation | $15,000 | Annual | https://streetsharesfoundation.org/

=== GENERAL SMALL BUSINESS GRANTS (Rolling/Quarterly) ===
14. NASE Growth Grants | $4,000 | Quarterly (Jan, Apr, Jul, Oct) | https://www.nase.org/become-a-member/member-benefits/business-resources/nase-growth-grants
15. Hello Alice Grants | Various amounts | Rolling | https://helloalice.com/grants/
16. FedEx Entrepreneur Fund | Various | Rolling via Hello Alice | https://helloalice.com/grants/fedex/
17. Nav Small Business Grant | $10,000 | Rolling | https://www.nav.com/small-business-grant/
18. Skip Grants | $1,000+ | Monthly (5-10 winners) | https://www.helloskip.com/grants
19. 500 Global Flagship Accelerator | $150,000 investment | Rolling | https://500.co/accelerators/flagship

=== FEDERAL/GOVERNMENT GRANTS ===
20. SBIR/STTR Programs | Up to $1.5M | Rolling by agency | https://www.sbir.gov/
21. SBA Grants Portal | Various | Ongoing | https://www.sba.gov/funding-programs/grants
22. Grants.gov | Thousands of grants | Ongoing | https://www.grants.gov/
23. USDA Rural Business Development | Various | Rolling | https://www.rd.usda.gov/programs-services/business-programs
24. EDA Economic Development Grants | Various | Rolling | https://www.eda.gov/funding/programs/

=== INDUSTRY-SPECIFIC GRANTS ===
25. Halstead Grant (Jewelry/Metalwork) | $7,500 | Annual | https://halsteadbead.com/halstead-grant
26. Patagonia Environmental Grants | Up to $20,000 | Biannual | https://www.patagonia.com/how-we-fund/
27. National Restaurant Assoc Foundation | Various | Rolling | https://chooserestaurants.org/programs/
28. Feed the Soul Foundation (Food/Culinary) | $15,000 in services | Ongoing | https://feedthesoulfoundation.org/

=== ACCELERATORS & COMPETITIONS ===
29. Visa Everywhere Initiative | $50,000 | Annual | https://usa.visa.com/visa-everywhere/everywhere-initiative.html
30. FedEx Small Business Grant Contest | Up to $50,000 | Opens Feb annually | https://www.fedex.com/en-us/small-business/grant-contest.html

FILTERING CRITERIA:
- Geographic Scope: Match grants to the user's location preference (local, national, or international)
- Ownership Type: Prioritize grants for minority, women, veteran, or disabled-owned businesses if applicable
- Industry Fit: Match grants that align with the specified industry and exclude irrelevant sectors
- Funding Need: Prioritize grants that match the user's budget range

RESPONSE GENERATION:
Generate a list of exactly 10 matched grants in JSON format with the following structure:

{
  "grants": [
    {
      "title": "Grant Title",
      "description": "Concise summary of the grant's purpose and eligibility requirements",
      "eligibility": "Requirements such as organization type, location, and ownership category",
      "deadline": "Application Deadline (specific date or 'Rolling/Ongoing')",
      "amount": "Funding Amount (range or maximum)",
      "link": "Application Link (direct URL to apply)",
      "source": "Organization offering the grant"
    }
  ]
}

CRITICAL RULES:
- You MUST return EXACTLY 10 grants - no more, no less
- ONLY use grants from the VERIFIED GRANT DATABASE above - never invent or guess grant programs
- Use the EXACT URLs provided in the database - never make up or guess URLs
- Each grant listing MUST include all fields in the JSON format
- For deadlines, use the exact deadline from the database or "Rolling/Ongoing"
- Organize grants by relevance to user's stated goals, industry, and ownership type

PRIORITIZATION ORDER:
1. Ownership type eligibility (women-owned, minority-owned, veteran-owned, disabled-owned if applicable)
2. Industry alignment with user's business
3. Funding amount matching user's stated needs
4. Geographic scope preference
5. Grant type preference (federal, corporate, foundation)

ALWAYS INCLUDE THESE RELIABLE GRANTS (fill remaining slots from these):
- Hello Alice Grants (Rolling) - Good for any small business
- NASE Growth Grants (Quarterly) - Good for any small business
- SBIR/STTR Programs - Good for R&D/tech businesses
- Grants.gov - Federal grant database
- SBA Grants Portal - Federal programs`;

      const userPrompt = `Find grants matching this business profile:

BUSINESS TYPE: ${businessType}
PROJECT GOALS: ${projectGoals}
LOCATION: ${location}
GEOGRAPHIC PREFERENCE: ${geographicScope}
INDUSTRY: ${industry}
FUNDING NEED: ${fundingNeed}
OWNERSHIP: ${ownershipDescription}
GRANT EXPERIENCE: ${hasAppliedBefore === "yes" ? "Has applied before" : "First-time applicant"}
GRANT TYPE PREFERENCE: ${grantPreference}
SEARCH DATE: ${currentDate}

Please find 10 relevant grant opportunities prioritized by fit.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(responseContent);
      
      // Return grants directly - links are from our verified database
      // Many grant sites block server-side requests, so we trust our curated list
      const grants = result.grants || [];
      
      // Ensure we have valid grant objects with required fields
      const validGrants = grants.filter((grant: any) => 
        grant.title && grant.link && grant.link !== "Not specified"
      );

      console.log(`Grant finder returned ${validGrants.length} grants`);

      res.json({ grants: validGrants });
    } catch (error: any) {
      console.error("Grant finder error:", error);
      res.status(500).json({ message: "Failed to search for grants. Please try again." });
    }
  });

  // ========================================
  // External Grants Routes (Simple URL-based grants)
  // ========================================

  // Public endpoint - get active external grants for users
  app.get("/api/external-grants", async (req, res) => {
    try {
      const storage = await storagePromise;
      const grants = await storage.getActiveExternalGrants();
      res.json(grants);
    } catch (error) {
      console.error("Error fetching external grants:", error);
      res.status(500).json({ message: "Failed to fetch external grants" });
    }
  });

  // Admin endpoints for external grants CRUD
  app.get("/api/admin/external-grants", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const grants = await storage.getAllExternalGrants();
      res.json(grants);
    } catch (error) {
      console.error("Error fetching external grants:", error);
      res.status(500).json({ message: "Failed to fetch external grants" });
    }
  });

  app.post("/api/admin/external-grants", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        url: z.string().url("Valid URL is required"),
        amount: z.number().optional().nullable(),
        category: z.string().optional().nullable(),
        isActive: z.boolean().optional().default(true),
        sortOrder: z.number().optional().default(0),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const grant = await storage.createExternalGrant(validationResult.data);
      res.status(201).json(grant);
    } catch (error) {
      console.error("Error creating external grant:", error);
      res.status(500).json({ message: "Failed to create external grant" });
    }
  });

  app.put("/api/admin/external-grants/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      const schema = z.object({
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        amount: z.number().optional().nullable(),
        category: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const grant = await storage.updateExternalGrant(id, validationResult.data);
      if (!grant) {
        return res.status(404).json({ message: "External grant not found" });
      }
      res.json(grant);
    } catch (error) {
      console.error("Error updating external grant:", error);
      res.status(500).json({ message: "Failed to update external grant" });
    }
  });

  app.delete("/api/admin/external-grants/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      const success = await storage.deleteExternalGrant(id);
      if (!success) {
        return res.status(404).json({ message: "External grant not found" });
      }
      res.json({ message: "External grant deleted successfully" });
    } catch (error) {
      console.error("Error deleting external grant:", error);
      res.status(500).json({ message: "Failed to delete external grant" });
    }
  });

  // ========================================
  // Grant Writers Routes
  // ========================================

  // Public-facing (auth-gated on frontend): get active grant writers with optional niche filter
  app.get("/api/grant-writers", async (req, res) => {
    try {
      const storage = await storagePromise;
      const niche = req.query.niche as string | undefined;
      const writers = await storage.getActiveGrantWriters(niche);
      // Strip email from public response to avoid data exposure
      const safeWriters = writers.map(({ email: _email, ...w }) => w);
      res.json(safeWriters);
    } catch (error) {
      console.error("Error fetching grant writers:", error);
      res.status(500).json({ message: "Failed to fetch grant writers" });
    }
  });

  // Submit an inquiry to a specific grant writer (user auth required)
  app.post("/api/grant-writers/:id/inquire", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const storage = await storagePromise;
      const writerId = parseInt(req.params.id);
      if (isNaN(writerId)) return res.status(400).json({ message: "Invalid writer ID" });

      const schema = z.object({
        senderName: z.string().min(1, "Name is required"),
        senderEmail: z.string().email("Valid email is required"),
        phone: z.string().optional().nullable(),
        orgName: z.string().optional().nullable(),
        orgType: z.string().optional().nullable(),
        budgetRange: z.string().optional().nullable(),
        timeline: z.string().optional().nullable(),
        message: z.string().min(10, "Message must be at least 10 characters"),
        helpType: z.string().min(1, "Help type is required"),
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
      }

      const writer = await storage.getGrantWriterById(writerId);
      if (!writer) {
        return res.status(404).json({ message: "Grant writer not found" });
      }

      const inquiry = await storage.createGrantWriterInquiry({
        writerId,
        ...validation.data,
      });

      // Send email notification to the grant writer via Resend
      const { Resend } = await import("resend");
      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
      if (resend) {
        await resend.emails.send({
          from: "GrantFind <noreply@grantfind.io>",
          to: writer.email,
          subject: `New inquiry from ${validation.data.senderName} via GrantFind`,
          html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">New Client Inquiry — GrantFind</h1>
  </div>
  <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151;">Hi ${writer.name},</p>
    <p style="color: #374151;">You have a new inquiry from a GrantFind user who wants to work with you.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold; width: 30%;">Name</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.senderName}</td></tr>
      <tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #e5e7eb;"><a href="mailto:${validation.data.senderEmail}">${validation.data.senderEmail}</a></td></tr>
      ${validation.data.phone ? `<tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Phone</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.phone}</td></tr>` : ''}
      ${validation.data.orgName ? `<tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Organization</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.orgName}</td></tr>` : ''}
      ${validation.data.orgType ? `<tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Org Type</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.orgType}</td></tr>` : ''}
      <tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Help Needed</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.helpType}</td></tr>
      ${validation.data.budgetRange ? `<tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Budget</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.budgetRange}</td></tr>` : ''}
      ${validation.data.timeline ? `<tr><td style="padding: 8px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: bold;">Timeline</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${validation.data.timeline}</td></tr>` : ''}
    </table>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; font-weight: bold; color: #92400e;">Message:</p>
      <p style="margin: 8px 0 0; color: #374151;">${validation.data.message}</p>
    </div>
    <p style="color: #6b7280; font-size: 14px;">Reply directly to their email: <a href="mailto:${validation.data.senderEmail}">${validation.data.senderEmail}</a></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">This inquiry was submitted through GrantFind's Certified Grant Writers Directory.</p>
  </div>
</div>`,
        }).catch((err: any) => console.error("Failed to send inquiry email:", err));
        console.log(`Inquiry email sent to writer ${writerId} (${writer.email})`);
      }

      res.status(201).json({ message: "Inquiry sent successfully", inquiry });
    } catch (error) {
      console.error("Error submitting inquiry:", error);
      res.status(500).json({ message: "Failed to submit inquiry" });
    }
  });

  // Admin CRUD for grant writers
  app.get("/api/admin/grant-writers", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const writers = await storage.getAllGrantWriters();
      res.json(writers);
    } catch (error) {
      console.error("Error fetching grant writers:", error);
      res.status(500).json({ message: "Failed to fetch grant writers" });
    }
  });

  app.post("/api/admin/grant-writers", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const schema = z.object({
        name: z.string().min(1),
        bio: z.string().min(1),
        photoUrl: z.string().optional().nullable(),
        email: z.string().email(),
        niches: z.array(z.string()).default([]),
        specialties: z.array(z.string()).default([]),
        yearsExperience: z.number().default(0),
        websiteUrl: z.string().optional().nullable(),
        linkedinUrl: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
      }
      const writer = await storage.createGrantWriter(validation.data);
      res.status(201).json(writer);
    } catch (error) {
      console.error("Error creating grant writer:", error);
      res.status(500).json({ message: "Failed to create grant writer" });
    }
  });

  app.put("/api/admin/grant-writers/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      const schema = z.object({
        name: z.string().min(1).optional(),
        bio: z.string().optional(),
        photoUrl: z.string().optional().nullable(),
        email: z.string().email().optional(),
        niches: z.array(z.string()).optional(),
        specialties: z.array(z.string()).optional(),
        yearsExperience: z.number().optional(),
        websiteUrl: z.string().optional().nullable(),
        linkedinUrl: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Validation failed", errors: validation.error.errors });
      }
      const writer = await storage.updateGrantWriter(id, validation.data);
      if (!writer) return res.status(404).json({ message: "Grant writer not found" });
      res.json(writer);
    } catch (error) {
      console.error("Error updating grant writer:", error);
      res.status(500).json({ message: "Failed to update grant writer" });
    }
  });

  app.delete("/api/admin/grant-writers/:id", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      const success = await storage.deleteGrantWriter(id);
      if (!success) return res.status(404).json({ message: "Grant writer not found" });
      res.json({ message: "Grant writer deleted successfully" });
    } catch (error) {
      console.error("Error deleting grant writer:", error);
      res.status(500).json({ message: "Failed to delete grant writer" });
    }
  });

  app.get("/api/admin/grant-writer-inquiries", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const writerId = req.query.writerId ? parseInt(req.query.writerId as string) : undefined;
      const inquiries = await storage.getGrantWriterInquiries(writerId);
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching grant writer inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.post("/api/admin/inquiries/:id/reply", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid inquiry ID" });

      const { subject, body } = req.body;
      if (!subject || !body) return res.status(400).json({ message: "Subject and body are required" });

      const inquiries = await storage.getGrantWriterInquiries();
      const inquiry = inquiries.find(i => i.id === id);
      if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

      const { Resend } = await import("resend");
      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
      if (resend) {
        await resend.emails.send({
          from: "GrantFind <noreply@grantfind.io>",
          to: inquiry.senderEmail,
          subject,
          html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Reply from GrantFind</h1>
  </div>
  <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151;">Hi ${inquiry.senderName},</p>
    <div style="white-space: pre-line; color: #374151; line-height: 1.6;">${body.replace(/\n/g, "<br>")}</div>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Your original inquiry:</p>
      <p style="margin: 0; font-size: 13px; color: #6b7280;">${inquiry.message}</p>
    </div>
    <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">This reply was sent via GrantFind on behalf of the GrantFind team.</p>
  </div>
</div>`,
        });
      }

      const updated = await storage.markInquiryReplied(id);
      res.json({ message: "Reply sent successfully", inquiry: updated });
    } catch (error) {
      console.error("Error sending inquiry reply:", error);
      res.status(500).json({ message: "Failed to send reply" });
    }
  });

  app.get("/api/admin/reports/weekly", authenticateAdmin, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const storage = await storagePromise;
      const { from, to, prevFrom, prevTo } = req.query as Record<string, string | undefined>;
      let currentPeriodStart: Date;
      let currentPeriodEnd: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      let mtdStart: Date;

      // Validate date params when provided
      if (from || to) {
        if (!from || !to) {
          return res.status(400).json({ message: "Both 'from' and 'to' are required when specifying a date range" });
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format for 'from' or 'to'" });
        }
        if (fromDate > toDate) {
          return res.status(400).json({ message: "'from' date must be before or equal to 'to' date" });
        }
        if (prevFrom || prevTo) {
          if (!prevFrom || !prevTo) {
            return res.status(400).json({ message: "Both 'prevFrom' and 'prevTo' are required when specifying a comparison range" });
          }
          const prevFromDate = new Date(prevFrom);
          const prevToDate = new Date(prevTo);
          if (isNaN(prevFromDate.getTime()) || isNaN(prevToDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format for 'prevFrom' or 'prevTo'" });
          }
          if (prevFromDate > prevToDate) {
            return res.status(400).json({ message: "'prevFrom' date must be before or equal to 'prevTo' date" });
          }
        }

        currentPeriodStart = new Date(from);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(to);
        currentPeriodEnd.setHours(23, 59, 59, 999);
        if (prevFrom && prevTo) {
          previousPeriodStart = new Date(prevFrom);
          previousPeriodStart.setHours(0, 0, 0, 0);
          previousPeriodEnd = new Date(prevTo);
          previousPeriodEnd.setHours(23, 59, 59, 999);
        } else {
          const durationMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
          previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
          previousPeriodStart = new Date(previousPeriodEnd.getTime() - durationMs);
        }
        mtdStart = new Date(currentPeriodEnd.getFullYear(), currentPeriodEnd.getMonth(), 1);
      } else {
        const now = new Date();
        const daysToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - daysToMonday);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = now;
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
        mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Stripe is authoritative for payment status. Reconcile only pending
      // checkout sessions in the report range before calculating its totals.
      await reconcilePendingCheckoutPayments(mtdStart, currentPeriodEnd);
      await reconcilePaidRenewalInvoices(mtdStart, currentPeriodEnd);
      const [currentPaymentMetrics, previousPaymentMetrics, mtdPaymentMetrics] = await Promise.all([
        getStripePaymentMetrics(currentPeriodStart, currentPeriodEnd),
        getStripePaymentMetrics(previousPeriodStart, previousPeriodEnd),
        getStripePaymentMetrics(mtdStart, currentPeriodEnd),
      ]);
      const report = await storage.getWeeklyReport(
        { from, to, prevFrom, prevTo },
        {
          current: currentPaymentMetrics,
          previous: previousPaymentMetrics,
          mtd: mtdPaymentMetrics,
        },
      );
      res.json({
        ...report,
        paymentSource: "Stripe paid invoices",
        paymentVerifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating weekly report:", error);
      res.status(503).json({
        message: "Report unavailable because Stripe payment figures could not be verified.",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
