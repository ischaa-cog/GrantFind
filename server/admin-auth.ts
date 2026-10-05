import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { storagePromise } from "./storage";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseFailure } from "./database-availability";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface AuthenticatedAdminRequest extends Request {
  admin?: { id: number; username: string };
}

export async function authenticateAdmin(req: AuthenticatedAdminRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Access token required" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    let decoded: { adminId: number; username: string; type: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { adminId: number; username: string; type: string };
    } catch (error) {
      console.error("Admin authentication error:", error);
      return res.status(401).json({ message: "Invalid token" });
    }
    
    if (decoded.type !== "admin") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    let admin;
    try {
      const storage = await storagePromise;
      admin = await storage.getAdmin(decoded.adminId);
    } catch (error) {
      if (isDatabaseFailure(error)) {
        return res.status(503).json({ message: DATABASE_UNAVAILABLE_MESSAGE });
      }
      console.error("Admin authentication error:", error);
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    req.admin = {
      id: admin.id,
      username: admin.username,
    };

    next();
  } catch (error) {
    console.error("Admin authentication error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function generateAdminToken(adminId: number, username: string): string {
  return jwt.sign(
    { adminId, username, type: "admin" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
