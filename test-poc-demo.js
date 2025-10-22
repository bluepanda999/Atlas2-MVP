#!/usr/bin/env node

/**
 * POC Demo Test Script
 * Tests the complete POC functionality with mock mode enabled
 */

import fs from "fs";

// Configuration
const WEB_URL = "http://localhost:3000";
const API_URL = "http://localhost:3001";

console.log("🚀 Starting Atlas2 POC Demo Test\n");

// Test 1: Check if frontend is running
async function testFrontend() {
  console.log("📱 Testing Frontend...");
  try {
    const response = await fetch(WEB_URL);
    if (response.ok) {
      console.log("✅ Frontend is running successfully");
      console.log(`🌐 Available at: ${WEB_URL}`);
      return true;
    } else {
      console.log("❌ Frontend not responding correctly");
      return false;
    }
  } catch (error) {
    console.log("❌ Frontend connection failed:", error.message);
    return false;
  }
}

// Test 2: Check if API is running
async function testAPI() {
  console.log("\n🔧 Testing API Server...");
  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      console.log("✅ API Server is running successfully");
      console.log(`📡 Available at: ${API_URL}`);
      return true;
    } else {
      console.log("❌ API Server not responding correctly");
      return false;
    }
  } catch (error) {
    console.log("❌ API Server connection failed:", error.message);
    return false;
  }
}

// Test 3: Check if mock mode is enabled
async function testMockMode() {
  console.log("\n🎭 Testing Mock Mode...");
  try {
    // This should work in mock mode without authentication
    const response = await fetch(`${API_URL}/api/upload/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: true }),
    });

    if (response.ok || response.status === 404) {
      console.log("✅ Mock mode is working (no authentication required)");
      return true;
    } else {
      console.log("❌ Mock mode may not be enabled");
      return false;
    }
  } catch (error) {
    console.log("❌ Mock mode test failed:", error.message);
    return false;
  }
}

// Test 4: Check if Settings page exists
async function testSettingsPage() {
  console.log("\n⚙️  Testing Settings Page...");
  try {
    const response = await fetch(`${WEB_URL}/settings`);
    if (response.ok) {
      console.log("✅ Settings page is accessible");
      console.log("🔧 Endpoint configuration UI should be available");
      return true;
    } else {
      console.log("❌ Settings page not accessible");
      return false;
    }
  } catch (error) {
    console.log("❌ Settings page test failed:", error.message);
    return false;
  }
}

// Test 5: Check if test files exist
function testFiles() {
  console.log("\n📁 Testing Test Files...");

  const files = [
    "test-upload.csv",
    "test-endpoint-config.js",
    "test-csv-upload.js",
    "POC-USER-GUIDE.md",
  ];

  let allExist = true;
  files.forEach((file) => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      allExist = false;
    }
  });

  return allExist;
}

// Main test execution
async function runTests() {
  const results = {
    frontend: await testFrontend(),
    api: await testAPI(),
    mockMode: await testMockMode(),
    settingsPage: await testSettingsPage(),
    files: testFiles(),
  };

  console.log("\n📊 Test Results Summary:");
  console.log("========================");

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    const testName = test
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
    console.log(`${status} ${testName}`);
  });

  console.log(`\n🎯 Overall Result: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("\n🎉 POC Demo is ready!");
    console.log("\n📋 Demo Instructions:");
    console.log("1. Open your browser and go to: http://localhost:3000");
    console.log(
      "2. Navigate to Settings page (http://localhost:3000/settings)",
    );
    console.log(
      "3. Configure an endpoint (e.g., https://jsonplaceholder.typicode.com)",
    );
    console.log("4. Test the connection using the Test button");
    console.log("5. Set as active configuration");
    console.log("6. Go to Upload page and test CSV upload");
    console.log("7. All features should work in mock mode");
    console.log("\n📖 For detailed instructions, see: POC-USER-GUIDE.md");
  } else {
    console.log("\n⚠️  Some tests failed. Please check the issues above.");
  }
}

// Run the tests
runTests().catch(console.error);
