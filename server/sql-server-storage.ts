import sql from 'mssql';
import { connectSqlServer, executeQuery } from './sql-server-db';
import type { IStorage } from './storage';
import type { 
  User, InsertUser, LoginUser,
  Company, InsertCompany, LoginCompany, 
  Grant, InsertGrant,
  UserGrantApplication, InsertUserGrantApplication,
  UserGrantInterest, InsertUserGrantInterest
} from '@shared/schema';

export class SqlServerStorage implements IStorage {
  private async ensureConnection() {
    await connectSqlServer();
  }

  // User operations
  async createUser(userData: InsertUser): Promise<User> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      INSERT INTO users (email, password, first_name, last_name)
      OUTPUT INSERTED.*
      VALUES (@email, @password, @firstName, @lastName)
    `, {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName
    });
    
    return this.mapUserFromDb(result.recordset[0]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM users WHERE email = @email
    `, { email });
    
    return result.recordset[0] ? this.mapUserFromDb(result.recordset[0]) : undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM users WHERE id = @id
    `, { id });
    
    return result.recordset[0] ? this.mapUserFromDb(result.recordset[0]) : undefined;
  }

  // Company operations
  async createCompany(companyData: InsertCompany): Promise<Company> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      INSERT INTO companies (name, email, password, description, website, logo_url)
      OUTPUT INSERTED.*
      VALUES (@name, @email, @password, @description, @website, @logoUrl)
    `, {
      name: companyData.name,
      email: companyData.email,
      password: companyData.password,
      description: companyData.description || null,
      website: companyData.website || null,
      logoUrl: companyData.logoUrl || null
    });
    
    return this.mapCompanyFromDb(result.recordset[0]);
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM companies WHERE email = @email
    `, { email });
    
    return result.recordset[0] ? this.mapCompanyFromDb(result.recordset[0]) : undefined;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM companies WHERE id = @id
    `, { id });
    
    return result.recordset[0] ? this.mapCompanyFromDb(result.recordset[0]) : undefined;
  }

  async updateCompanyPassword(id: number, hashedPassword: string): Promise<void> {
    await this.ensureConnection();
    
    await executeQuery(`
      UPDATE companies SET password = @password, updated_at = GETUTCDATE() WHERE id = @id
    `, { id, password: hashedPassword });
  }

  // Grant operations
  async createGrant(grantData: InsertGrant & { companyId: number; company: string }): Promise<Grant> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      INSERT INTO grants (title, company_id, company, amount, deadline, category, tags, description, requirements, application_url, status, rating, image_url, is_new, is_hot, time_remaining)
      OUTPUT INSERTED.*
      VALUES (@title, @companyId, @company, @amount, @deadline, @category, @tags, @description, @requirements, @applicationUrl, @status, @rating, @imageUrl, @isNew, @isHot, @timeRemaining)
    `, {
      title: grantData.title,
      companyId: grantData.companyId,
      company: grantData.company,
      amount: grantData.amount,
      deadline: grantData.deadline,
      category: grantData.category,
      tags: JSON.stringify(grantData.tags || []),
      description: grantData.description,
      requirements: grantData.requirements,
      applicationUrl: grantData.applicationUrl || null,
      status: grantData.status || 'active',
      rating: grantData.rating || 5,
      imageUrl: grantData.imageUrl || null,
      isNew: grantData.isNew || false,
      isHot: grantData.isHot || false,
      timeRemaining: grantData.timeRemaining || null
    });
    
    return this.mapGrantFromDb(result.recordset[0]);
  }

  async getAllGrants(): Promise<Grant[]> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM grants ORDER BY created_at DESC
    `);
    
    return result.recordset.map(row => this.mapGrantFromDb(row));
  }

  async getGrantById(id: number): Promise<Grant | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM grants WHERE id = @id
    `, { id });
    
    return result.recordset[0] ? this.mapGrantFromDb(result.recordset[0]) : undefined;
  }

  async getGrantsByCompany(companyId: number): Promise<Grant[]> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM grants WHERE company_id = @companyId ORDER BY created_at DESC
    `, { companyId });
    
    return result.recordset.map(row => this.mapGrantFromDb(row));
  }

  async updateGrant(id: number, grantData: Partial<InsertGrant>): Promise<Grant> {
    await this.ensureConnection();
    
    const setParts = [];
    const params: any = { id };
    
    Object.entries(grantData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'tags') {
          setParts.push(`${key} = @${key}`);
          params[key] = JSON.stringify(value);
        } else {
          setParts.push(`${key} = @${key}`);
          params[key] = value;
        }
      }
    });
    
    setParts.push('updated_at = GETUTCDATE()');
    
    const result = await executeQuery(`
      UPDATE grants SET ${setParts.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `, params);
    
    return this.mapGrantFromDb(result.recordset[0]);
  }

  async deleteGrant(id: number): Promise<void> {
    await this.ensureConnection();
    
    await executeQuery(`DELETE FROM grants WHERE id = @id`, { id });
  }

  // Application operations
  async createApplication(applicationData: InsertUserGrantApplication): Promise<UserGrantApplication> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      INSERT INTO user_grant_applications (user_id, grant_id, status, answers, remarks)
      OUTPUT INSERTED.*
      VALUES (@userId, @grantId, @status, @answers, @remarks)
    `, {
      userId: applicationData.userId,
      grantId: applicationData.grantId,
      status: applicationData.status || 'In Progress',
      answers: applicationData.answers || null,
      remarks: applicationData.remarks || null
    });
    
    return this.mapApplicationFromDb(result.recordset[0]);
  }

  async getApplicationsByUser(userId: number): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT a.*, u.*, g.*,
             u.id as user_id, u.email as user_email, u.first_name, u.last_name,
             g.id as grant_id, g.title as grant_title
      FROM user_grant_applications a
      JOIN users u ON a.user_id = u.id
      JOIN grants g ON a.grant_id = g.id
      WHERE a.user_id = @userId
      ORDER BY a.applied_at DESC
    `, { userId });
    
    return result.recordset.map(row => ({
      ...this.mapApplicationFromDb(row),
      user: this.mapUserFromDb(row),
      grant: this.mapGrantFromDb(row)
    }));
  }

  async getApplicationsByCompany(companyId: number): Promise<(UserGrantApplication & { user: User; grant: Grant })[]> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT a.*, u.*, g.*,
             u.id as user_id, u.email as user_email, u.first_name, u.last_name,
             g.id as grant_id, g.title as grant_title
      FROM user_grant_applications a
      JOIN users u ON a.user_id = u.id
      JOIN grants g ON a.grant_id = g.id
      WHERE g.company_id = @companyId
      ORDER BY a.applied_at DESC
    `, { companyId });
    
    return result.recordset.map(row => ({
      ...this.mapApplicationFromDb(row),
      user: this.mapUserFromDb(row),
      grant: this.mapGrantFromDb(row)
    }));
  }

  async getApplicationByUserAndGrant(userId: number, grantId: number): Promise<UserGrantApplication | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM user_grant_applications WHERE user_id = @userId AND grant_id = @grantId
    `, { userId, grantId });
    
    return result.recordset[0] ? this.mapApplicationFromDb(result.recordset[0]) : undefined;
  }

  async updateApplicationStatus(id: number, status: string, remarks?: string): Promise<UserGrantApplication> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      UPDATE user_grant_applications 
      SET status = @status, remarks = @remarks, updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `, { id, status, remarks: remarks || null });
    
    return this.mapApplicationFromDb(result.recordset[0]);
  }

  async updateApplicationAnswers(id: number, answers: string): Promise<UserGrantApplication> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      UPDATE user_grant_applications 
      SET answers = @answers, status = 'Applied', updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `, { id, answers });
    
    return this.mapApplicationFromDb(result.recordset[0]);
  }

  // Interest operations
  async createOrUpdateInterest(interestData: InsertUserGrantInterest): Promise<UserGrantInterest> {
    await this.ensureConnection();
    
    // Try to update first
    const updateResult = await executeQuery(`
      UPDATE user_grant_interests 
      SET is_interested = @isInterested, updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE user_id = @userId AND grant_id = @grantId
    `, {
      userId: interestData.userId,
      grantId: interestData.grantId,
      isInterested: interestData.isInterested
    });
    
    if (updateResult.recordset.length > 0) {
      return this.mapInterestFromDb(updateResult.recordset[0]);
    }
    
    // If no update, create new
    const insertResult = await executeQuery(`
      INSERT INTO user_grant_interests (user_id, grant_id, is_interested)
      OUTPUT INSERTED.*
      VALUES (@userId, @grantId, @isInterested)
    `, {
      userId: interestData.userId,
      grantId: interestData.grantId,
      isInterested: interestData.isInterested
    });
    
    return this.mapInterestFromDb(insertResult.recordset[0]);
  }

  async getInterestsByUser(userId: number): Promise<UserGrantInterest[]> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM user_grant_interests WHERE user_id = @userId AND is_interested = 1
    `, { userId });
    
    return result.recordset.map(row => this.mapInterestFromDb(row));
  }

  async getInterestByUserAndGrant(userId: number, grantId: number): Promise<UserGrantInterest | undefined> {
    await this.ensureConnection();
    
    const result = await executeQuery(`
      SELECT * FROM user_grant_interests WHERE user_id = @userId AND grant_id = @grantId
    `, { userId, grantId });
    
    return result.recordset[0] ? this.mapInterestFromDb(result.recordset[0]) : undefined;
  }

  // Helper methods to map database rows to TypeScript objects
  private mapUserFromDb(row: any): User {
    return {
      id: row.id || row.user_id,
      email: row.email || row.user_email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCompanyFromDb(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      description: row.description,
      website: row.website,
      logoUrl: row.logo_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapGrantFromDb(row: any): Grant {
    return {
      id: row.id || row.grant_id,
      title: row.title || row.grant_title,
      companyId: row.company_id,
      company: row.company,
      amount: row.amount,
      deadline: row.deadline,
      category: row.category,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      description: row.description,
      requirements: row.requirements,
      applicationUrl: row.application_url,
      status: row.status,
      rating: row.rating,
      imageUrl: row.image_url,
      isNew: row.is_new,
      isHot: row.is_hot,
      timeRemaining: row.time_remaining,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapApplicationFromDb(row: any): UserGrantApplication {
    return {
      id: row.id,
      userId: row.user_id,
      grantId: row.grant_id,
      status: row.status,
      answers: row.answers,
      remarks: row.remarks,
      appliedAt: row.applied_at,
      updatedAt: row.updated_at
    };
  }

  private mapInterestFromDb(row: any): UserGrantInterest {
    return {
      id: row.id,
      userId: row.user_id,
      grantId: row.grant_id,
      isInterested: row.is_interested,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}