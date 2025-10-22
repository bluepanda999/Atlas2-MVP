#!/usr/bin/env node

/**
 * Simple test script to verify analytics API endpoints
 */

const http = require("http");
const fs = require("fs");

const API_BASE = "http://localhost:3001/api";
const TEST_TOKEN = "test-token"; // You would need a real JWT token for actual testing

// Test endpoints
const endpoints = ["/health", "/analytics/health", "/analytics/config"];

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3001,
      path: path,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

async function testEndpoints() {
  console.log("🚀 Testing Analytics API Endpoints\n");

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await makeRequest(endpoint);

      console.log(`✅ ${endpoint} - Status: ${response.statusCode}`);

      if (response.statusCode === 200) {
        try {
          const data = JSON.parse(response.body);
          console.log(
            `   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`,
          );
        } catch (e) {
          console.log(`   Response: ${response.body.substring(0, 200)}...`);
        }
      } else {
        console.log(`   Error: ${response.body}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }

    console.log("");
  }
}

// Check if server is running
async function checkServer() {
  try {
    await makeRequest("/health");
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log("🔍 Checking if API server is running...");

  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.log("❌ API server is not running on localhost:3000");
    console.log("Please start the server with: npm run dev");
    process.exit(1);
  }

  console.log("✅ API server is running\n");

  await testEndpoints();

  console.log("🎉 Analytics API testing complete!");
}

main().catch(console.error);
