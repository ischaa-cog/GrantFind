-- SQL Server Database Initialization Script
-- Run this script on your SQL Server database before starting the application

-- Create Users table
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password NVARCHAR(255) NOT NULL,
  first_name NVARCHAR(255) NOT NULL,
  last_name NVARCHAR(255) NOT NULL,
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create Companies table
CREATE TABLE companies (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL UNIQUE,
  email NVARCHAR(255) NOT NULL UNIQUE,
  password NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX),
  website NVARCHAR(255),
  logo_url NVARCHAR(255),
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create Grants table
CREATE TABLE grants (
  id INT IDENTITY(1,1) PRIMARY KEY,
  title NVARCHAR(255) NOT NULL,
  company_id INT NOT NULL,
  company NVARCHAR(255) NOT NULL,
  amount INT NOT NULL,
  deadline DATETIME2 NOT NULL,
  category NVARCHAR(100) NOT NULL,
  tags NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  description NVARCHAR(MAX) NOT NULL,
  requirements NVARCHAR(MAX) NOT NULL,
  application_url NVARCHAR(255),
  status NVARCHAR(50) NOT NULL DEFAULT 'active',
  rating INT DEFAULT 5,
  image_url NVARCHAR(255),
  is_new BIT DEFAULT 0,
  is_hot BIT DEFAULT 0,
  time_remaining NVARCHAR(100),
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Create User Grant Applications table
CREATE TABLE user_grant_applications (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  grant_id INT NOT NULL,
  status NVARCHAR(50) NOT NULL DEFAULT 'In Progress',
  answers NVARCHAR(MAX),
  remarks NVARCHAR(MAX),
  applied_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (grant_id) REFERENCES grants(id)
);

-- Create User Grant Interests table
CREATE TABLE user_grant_interests (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  grant_id INT NOT NULL,
  is_interested BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (grant_id) REFERENCES grants(id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_companies_email ON companies(email);
CREATE INDEX idx_grants_company_id ON grants(company_id);
CREATE INDEX idx_grants_category ON grants(category);
CREATE INDEX idx_grants_status ON grants(status);
CREATE INDEX idx_user_applications_user_id ON user_grant_applications(user_id);
CREATE INDEX idx_user_applications_grant_id ON user_grant_applications(grant_id);
CREATE INDEX idx_user_interests_user_id ON user_grant_interests(user_id);
CREATE INDEX idx_user_interests_grant_id ON user_grant_interests(grant_id);

-- Insert sample companies
INSERT INTO companies (name, email, password, description, website) VALUES
('AT&T', 'grants@att.com', '$2b$10$example1', 'Leading telecommunications company', 'https://att.com'),
('American Express', 'grants@americanexpress.com', '$2b$10$example2', 'Global financial services company', 'https://americanexpress.com'),
('Small Business Awards', 'awards@smallbusinessawards.com', '$2b$10$example3', 'Supporting small businesses nationwide', 'https://smallbusinessawards.com'),
('TechFund', 'grants@techfund.com', '$2b$10$example4', 'Technology startup accelerator', 'https://techfund.com'),
('Skip Foundation', 'foundation@skip.com', '$2b$10$example5', 'Innovation and entrepreneurship foundation', 'https://skip.com');

-- Insert sample grants
INSERT INTO grants (title, company_id, company, amount, deadline, category, tags, description, requirements, image_url, is_new, is_hot) VALUES
('AT&T 5G Innovation Challenge', 1, 'AT&T', 50000, '2025-08-15T23:59:59', 'Technology', '["5G", "innovation", "technology"]', 'Seeking innovative 5G applications and solutions', 'Must be a registered business with 5G technology focus', 'https://example.com/att-5g.jpg', 1, 1),
('AmEx Backing Small Businesses', 2, 'American Express', 25000, '2025-07-30T23:59:59', 'Small Business', '["small-business", "funding", "growth"]', 'Supporting small business growth and expansion', 'Small businesses with revenue under $5M', 'https://example.com/amex-small.jpg', 0, 1),
('TechFund Startup Grant', 4, 'TechFund', 100000, '2025-09-01T23:59:59', 'Technology', '["startup", "technology", "seed-funding"]', 'Early-stage technology startup funding', 'Tech startups in seed or Series A stage', 'https://example.com/techfund.jpg', 1, 0);

PRINT 'SQL Server database initialized successfully!';