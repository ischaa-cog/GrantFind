# SQL Server Setup Guide

This guide will help you migrate your GrantFind application from Supabase/PostgreSQL to SQL Server.

## Prerequisites

1. **SQL Server Instance**: You need access to a SQL Server database (local or cloud-based like Azure SQL Database)
2. **Database Connection String**: Connection string in one of these formats:

### Connection String Formats

**Option 1: Standard Connection String**
```
Server=your-server;Database=your-database;User Id=your-username;Password=your-password;TrustServerCertificate=true;
```

**Option 2: Azure SQL Database**
```
Server=tcp:your-server.database.windows.net,1433;Initial Catalog=your-database;Persist Security Info=False;User ID=your-username;Password=your-password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

**Option 3: Windows Authentication (Local)**
```
Server=localhost;Database=your-database;Trusted_Connection=true;TrustServerCertificate=true;
```

## Setup Steps

### Step 1: Create Your SQL Server Database
1. Connect to your SQL Server instance using SQL Server Management Studio (SSMS) or Azure Data Studio
2. Create a new database: `CREATE DATABASE grantfind_db`
3. Run the initialization script: `server/sql-server-init.sql`

### Step 2: Set Environment Variable
In your Replit secrets or environment, set:
```
DATABASE_URL=your-sql-server-connection-string
```

### Step 3: Install Dependencies
The required packages have already been installed:
- `mssql` - SQL Server driver
- `drizzle-orm` - ORM with SQL Server support

### Step 4: Update Application Configuration
The application has been configured to:
- Detect SQL Server connection strings
- Use SQL Server-compatible data types
- Handle SQL Server-specific features (IDENTITY columns, NVARCHAR, etc.)

## Features Supported

✅ **User Authentication** - JWT-based auth with bcrypt password hashing
✅ **Company Authentication** - Separate company login system  
✅ **Grant Management** - Create, edit, delete grants with categories
✅ **Application System** - Two-stage application process with status tracking
✅ **Interest Tracking** - Users can mark grants as interesting
✅ **Application Reviews** - Companies can review and approve/reject applications
✅ **Filtering & Search** - Comprehensive filtering on both user and company sides

## Database Schema

The SQL Server schema includes:
- **users** - User accounts with authentication
- **companies** - Company accounts for grant providers
- **grants** - Grant listings with all metadata
- **user_grant_applications** - Application submissions with status tracking
- **user_grant_interests** - User interest tracking for grants

## Migration Notes

### Key Differences from PostgreSQL:
1. **IDENTITY instead of SERIAL** - Auto-incrementing primary keys
2. **NVARCHAR instead of TEXT** - Unicode string support
3. **BIT instead of BOOLEAN** - Boolean values (0/1)
4. **DATETIME2 instead of TIMESTAMP** - Date/time handling
5. **JSON as NVARCHAR(MAX)** - JSON data stored as strings

### Performance Optimizations:
- Indexes on frequently queried columns
- Foreign key constraints for data integrity
- Efficient query patterns for filtering and searching

## Testing the Connection

After setup, the application will:
1. Test the database connection on startup
2. Log connection status to console
3. Fall back to in-memory storage if SQL Server is unavailable

## Troubleshooting

**Connection Issues:**
- Verify your connection string format
- Check firewall settings (SQL Server uses port 1433 by default)
- For Azure SQL, ensure your IP is allowlisted

**Authentication Issues:**
- Verify username and password
- For Windows Auth, ensure the application runs under correct user context
- Check SQL Server authentication mode (mixed mode required for SQL auth)

**Data Issues:**
- Run the init script to create tables and sample data
- Verify table structure matches expected schema
- Check for any data type compatibility issues

## Next Steps

Once configured, your application will use SQL Server instead of Supabase while maintaining all existing functionality. The user interface and API endpoints remain unchanged.