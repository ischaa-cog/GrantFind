import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

export async function connectSqlServer(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required for SQL Server connection");
  }

  try {
    // Create connection pool with connection string
    pool = new sql.ConnectionPool(process.env.DATABASE_URL);
    await pool.connect();
    
    console.log("✓ Connected to SQL Server successfully");
    
    // Test the connection
    const result = await pool.request().query('SELECT 1 as test');
    console.log("✓ SQL Server connection test successful");
    
    return pool;
  } catch (error) {
    console.error("Failed to connect to SQL Server:", error);
    throw error;
  }
}

export async function closeSqlServerConnection() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export async function executeQuery(query: string, inputs?: any): Promise<any> {
  const connection = await connectSqlServer();
  const request = connection.request();
  
  // Add input parameters if provided
  if (inputs) {
    Object.keys(inputs).forEach(key => {
      request.input(key, inputs[key]);
    });
  }
  
  return await request.query(query);
}