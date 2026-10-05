import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { storagePromise } from './storage';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseFailure } from './database-availability';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  try {
    const storage = await storagePromise;
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'This account is inactive. Please contact support.' });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    if (isDatabaseFailure(error)) {
      return res.status(503).json({ message: DATABASE_UNAVAILABLE_MESSAGE });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  const decoded = verifyToken(token);
  if (decoded) {
    req.user = { id: decoded.userId, email: decoded.email };
  }
  
  next();
}