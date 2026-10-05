import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { storagePromise } from "./storage";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseFailure } from "./database-availability";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthenticatedCompanyRequest extends Request {
  company?: { id: number; email: string; name: string };
}

export async function authenticateCompany(req: AuthenticatedCompanyRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Access token required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    let decoded: { companyId: number; email: string; type: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { companyId: number; email: string; type: string };
    } catch (error) {
      console.error("Company authentication error:", error);
      return res.status(401).json({ message: "Invalid token" });
    }
    
    if (decoded.type !== "company") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    let company;
    try {
      const storage = await storagePromise;
      company = await storage.getCompany(decoded.companyId);
    } catch (error) {
      if (isDatabaseFailure(error)) {
        return res.status(503).json({ message: DATABASE_UNAVAILABLE_MESSAGE });
      }
      console.error("Company authentication error:", error);
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!company) {
      return res.status(401).json({ message: "Company not found" });
    }

    req.company = {
      id: company.id,
      email: company.email,
      name: company.name,
    };

    next();
  } catch (error) {
    console.error("Company authentication error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function generateCompanyToken(companyId: number, email: string): string {
  return jwt.sign(
    { companyId, email, type: "company" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}