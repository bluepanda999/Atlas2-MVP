import { Pool, PoolClient, PoolConfig } from "pg";
import { logger } from "../utils/logger";
import { config } from "../config/config";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseService {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || this.getConfigFromEnv();
    this.pool = new Pool(this.getPoolConfig());
  }

  private getConfigFromEnv(): DatabaseConfig {
    return {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      username: config.database.user,
      password: config.database.password,
      ssl: false,
      maxConnections: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }

  private getDefaultConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "atlas2",
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
      ssl: process.env.DB_SSL === "true",
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
      connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "2000",
      ),
    };
  }

  private getPoolConfig(): PoolConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
    };
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      logger.info("Database connected successfully", {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      });
    } catch (error) {
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info("Database disconnected successfully");
    } catch (error) {
      logger.error("Error disconnecting from database:", error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();

    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug("Database query executed", {
        query: text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error("Database query failed:", {
        query: text,
        params,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });

      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const result = await this.query("SELECT 1");
      return true;
    } catch (error) {
      return false;
    }
  }

  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      await this.query("SELECT 1");
      const responseTime = Date.now() - start;

      return {
        connected: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - start;

      return {
        connected: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getPoolStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  // Migration helper methods
  async runMigrations(migrationFiles: string[]): Promise<void> {
    logger.info(`Running ${migrationFiles.length} migrations`);

    for (const migrationFile of migrationFiles) {
      try {
        const migration = await import(migrationFile);
        if (migration.up && typeof migration.up === "function") {
          await migration.up(this);
          logger.info(`Migration ${migrationFile} completed successfully`);
        }
      } catch (error) {
        logger.error(`Migration ${migrationFile} failed:`, error);
        throw error;
      }
    }
  }

  // Schema validation helper
  async validateSchema(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check if required tables exist
      const requiredTables = [
        "processing_jobs",
        "mapping_configs",
        "field_mappings",
        "transformation_rules",
        "users",
        "api_keys",
      ];

      for (const table of requiredTables) {
        const result = await this.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `,
          [table],
        );

        if (!result.rows[0].exists) {
          errors.push(`Required table '${table}' does not exist`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Schema validation failed: ${error}`);
      return {
        valid: false,
        errors,
      };
    }
  }

  // Performance monitoring
  async getSlowQueries(thresholdMs: number = 1000): Promise<any[]> {
    try {
      const result = await this.query(
        `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > $1
        ORDER BY mean_time DESC
        LIMIT 10
      `,
        [thresholdMs],
      );

      return result.rows;
    } catch (error) {
      logger.warn(
        "Failed to get slow queries (pg_stat_statements may not be enabled):",
        error,
      );
      return [];
    }
  }
}
