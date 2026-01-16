import { Client } from 'pg';

/**
 * Get all table names from a database
 * @param {string} databaseUrl - Database connection URL
 * @returns {Promise<Array>} Array of table names
 */
export async function getAllTableNames(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    
    // Query to get all table names from PostgreSQL
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    return result.rows.map(row => row.table_name);
  } finally {
    await client.end();
  }
}

/**
 * Get all data from a specific table
 * @param {string} databaseUrl - Database connection URL
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} Array of rows from the table
 */
export async function getTableData(databaseUrl, tableName) {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    
    // Use parameterized query to prevent SQL injection
    // Note: PostgreSQL doesn't allow table names as parameters, so we validate the table name
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const query = `SELECT * FROM "${validTableName}"`;
    
    const result = await client.query(query);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from table ${tableName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Get paginated data from a specific table
 * @param {string} databaseUrl - Database connection URL
 * @param {string} tableName - Name of the table
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of records per page
 * @returns {Promise<Object>} Object with data, total count, page, and limit
 */
export async function getTableDataPaginated(databaseUrl, tableName, page = 1, limit = 10) {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const offset = (page - 1) * limit;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM "${validTableName}"`;
    const countResult = await client.query(countQuery);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated data
    const dataQuery = `SELECT * FROM "${validTableName}" LIMIT $1 OFFSET $2`;
    const dataResult = await client.query(dataQuery, [limit, offset]);
    
    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error(`Error fetching paginated data from table ${tableName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Get row count for a specific table
 * @param {string} databaseUrl - Database connection URL
 * @param {string} tableName - Name of the table
 * @returns {Promise<number>} Total row count
 */
export async function getTableRowCount(databaseUrl, tableName) {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    
    const validTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const query = `SELECT COUNT(*) as total FROM "${validTableName}"`;
    const result = await client.query(query);
    
    return parseInt(result.rows[0].total);
  } catch (error) {
    console.error(`Error getting row count from table ${tableName}:`, error);
    return 0;
  } finally {
    await client.end();
  }
}

/**
 * Get all tables with their row counts from a database
 * @param {string} databaseUrl - Database connection URL
 * @returns {Promise<Object>} Object with table names as keys and their row counts as values
 */
export async function getAllTablesWithCounts(databaseUrl) {
  try {
    const tableNames = await getAllTableNames(databaseUrl);
    const result = {};

    // Get row count for each table
    for (const tableName of tableNames) {
      try {
        const count = await getTableRowCount(databaseUrl, tableName);
        result[tableName] = { count };
      } catch (error) {
        result[tableName] = {
          error: `Failed to get count: ${error.message}`,
          count: 0
        };
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to get tables from database: ${error.message}`);
  }
}

/**
 * Get all tables with their data from a database
 * @param {string} databaseUrl - Database connection URL
 * @returns {Promise<Object>} Object with table names as keys and their data as values
 */
export async function getAllTablesWithData(databaseUrl) {
  try {
    const tableNames = await getAllTableNames(databaseUrl);
    const result = {};

    // Get data from each table
    for (const tableName of tableNames) {
      try {
        const data = await getTableData(databaseUrl, tableName);
        result[tableName] = data;
      } catch (error) {
        // If we can't fetch data from a table, store error message
        result[tableName] = {
          error: `Failed to fetch data: ${error.message}`
        };
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to get tables from database: ${error.message}`);
  }
}
