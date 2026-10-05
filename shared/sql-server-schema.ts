import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Note: Since drizzle doesn't have first-class MSSQL support yet, 
// we'll use SQL Server specific types but structure it for manual SQL creation

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  description: text("description"),
  website: text("website"),
  logoUrl: text("logo_url"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const grants = sqliteTable("grants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  companyId: integer("company_id").notNull(),
  company: text("company").notNull(),
  amount: integer("amount").notNull(),
  deadline: text("deadline").notNull(),
  category: text("category").notNull(),
  tags: text("tags").notNull().default("[]"), // JSON string for array
  description: text("description").notNull(),
  requirements: text("requirements").notNull(),
  applicationUrl: text("application_url"),
  status: text("status").notNull().default("active"),
  rating: integer("rating").default(5),
  imageUrl: text("image_url"),
  isNew: integer("is_new", { mode: 'boolean' }).default(false),
  isHot: integer("is_hot", { mode: 'boolean' }).default(false),
  timeRemaining: text("time_remaining"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const userGrantApplications = sqliteTable("user_grant_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  grantId: integer("grant_id").notNull(),
  status: text("status").notNull().default("In Progress"),
  answers: text("answers"),
  remarks: text("remarks"),
  appliedAt: text("applied_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const userGrantInterests = sqliteTable("user_grant_interests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  grantId: integer("grant_id").notNull(),
  isInterested: integer("is_interested", { mode: 'boolean' }).notNull().default(true),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
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

export const insertGrantSchema = createInsertSchema(grants).omit({
  id: true,
  companyId: true,
  company: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGrantApplicationSchema = createInsertSchema(userGrantApplications).omit({
  id: true,
  appliedAt: true,
  updatedAt: true,
});

export const insertUserGrantInterestSchema = createInsertSchema(userGrantInterests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type LoginCompany = z.infer<typeof loginCompanySchema>;

export type Grant = typeof grants.$inferSelect;
export type InsertGrant = z.infer<typeof insertGrantSchema>;

export type UserGrantApplication = typeof userGrantApplications.$inferSelect;
export type InsertUserGrantApplication = z.infer<typeof insertUserGrantApplicationSchema>;

export type UserGrantInterest = typeof userGrantInterests.$inferSelect;
export type InsertUserGrantInterest = z.infer<typeof insertUserGrantInterestSchema>;