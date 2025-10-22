import dotenv from "dotenv";

dotenv.config();

// Parse DATABASE_URL if available
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname || "localhost",
      port: parseInt(urlObj.port || "5432", 10),
      name: urlObj.pathname.slice(1) || "atlas2_dev",
      user: urlObj.username || "atlas2",
      password: urlObj.password || "atlas2_password",
    };
  } catch {
    return {
      host: "localhost",
      port: 5432,
      name: "atlas2_dev",
      user: "atlas2",
      password: "atlas2_password",
    };
  }
}

const databaseConfig = process.env.DATABASE_URL
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      name: process.env.DB_NAME || "atlas2_dev",
      user: process.env.DB_USER || "atlas2",
      password: process.env.DB_PASSWORD || "atlas2_password",
    };

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3002", 10),

  database: databaseConfig,

  redis: process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
      }
    : {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || "",
      },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2", 10),
  },

  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
  },
};
