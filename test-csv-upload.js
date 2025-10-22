#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test CSV upload functionality
async function testCsvUpload() {
  console.log("🚀 Testing CSV Upload Functionality\n");

  const API_BASE = "http://localhost:3001";
  const csvFilePath = path.join(__dirname, "test-upload.csv");

  try {
    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error("Test CSV file not found");
    }

    console.log("📁 Test CSV file found:", csvFilePath);

    // Read CSV file content
    const csvContent = fs.readFileSync(csvFilePath, "utf8");
    console.log("📄 CSV content preview:");
    console.log(csvContent.split("\n").slice(0, 3).join("\n") + "...\n");

    let authToken;

    // Generate unique email for this test run
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;

    try {
      // Step 1: Register a test user
      console.log("🔐 Creating test user...");
      const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testEmail,
          password: "testpassword123",
          name: "Test User",
        }),
      });

      if (registerResponse.ok) {
        console.log("✅ Test user created successfully");
      } else {
        const registerError = await registerResponse.text();
        console.log("📝 Registration failed:", registerError);
        throw new Error("Registration failed");
      }
    } catch (registerError) {
      console.log("📝 Registration error:", registerError.message);
      throw registerError;
    }

    // Step 2: Login to get auth token
    console.log("🔑 Logging in...");
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        password: "testpassword123",
      }),
    });

    if (loginResponse.ok) {
      const loginResult = await loginResponse.json();
      authToken = loginResult.data?.token || loginResult.token;
      console.log("✅ Authentication successful");
    } else {
      const loginError = await loginResponse.text();
      throw new Error(`Authentication failed: ${loginError}`);
    }

    // Step 3: Test upload endpoint with authentication
    console.log("🔍 Testing upload endpoint availability...");

    // Create FormData for file upload
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: "text/csv" });
    formData.append("file", blob, "test-upload.csv");

    // Add mapping configuration
    formData.append(
      "mappingConfig",
      JSON.stringify({
        fieldMappings: [
          { sourceField: "name", targetField: "full_name" },
          { sourceField: "email", targetField: "email_address" },
          { sourceField: "age", targetField: "user_age" },
          { sourceField: "city", targetField: "location" },
        ],
      }),
    );

    const uploadResponse = await fetch(`${API_BASE}/api/upload/upload`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    console.log(`📡 Upload request sent to: ${API_BASE}/api/upload/upload`);
    console.log(`📊 Response status: ${uploadResponse.status}`);

    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log("✅ Upload successful!");
      console.log("📋 Response:", JSON.stringify(result, null, 2));
    } else {
      const error = await uploadResponse.text();
      console.log("❌ Upload failed");
      console.log("🚨 Error:", error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    // Check if API server is running
    try {
      console.log("\n🔍 Checking if API server is running...");
      const healthResponse = await fetch(`${API_BASE}/health`);
      if (healthResponse.ok) {
        console.log("✅ API server is running");
      } else {
        console.log("❌ API server responded with error");
      }
    } catch (healthError) {
      console.log("❌ API server is not running");
      console.log("💡 Start the API server with: npm run dev:api");
    }
  }
}

// Run the test
testCsvUpload();
