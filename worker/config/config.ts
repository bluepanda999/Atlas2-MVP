import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3002", 10),

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "atlas2_dev",
    user: process.env.DB_USER || "atlas2",
    password: process.env.DB_PASSWORD || "atlas2_password",
  },

  redis: {
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
