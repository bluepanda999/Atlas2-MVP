#!/usr/bin/env node

/**
 * Test Settings Page Functionality
 */

console.log("🔍 Testing Settings Page...\n");

// Test 1: Check if Settings route exists in App.tsx
import fs from "fs";

console.log("1. Checking App.tsx for Settings route...");
try {
  const appContent = fs.readFileSync("./src/App.tsx", "utf8");

  if (appContent.includes('import Settings from "./pages/Settings"')) {
    console.log("✅ Settings import found in App.tsx");
  } else {
    console.log("❌ Settings import NOT found in App.tsx");
  }

  if (appContent.includes("<Settings />")) {
    console.log("✅ Settings component found in route");
  } else {
    console.log("❌ Settings component NOT found in route");
  }

  if (appContent.includes("Settings Page (TODO)")) {
    console.log("❌ TODO placeholder still exists");
  } else {
    console.log("✅ No TODO placeholder found");
  }
} catch (error) {
  console.log("❌ Error reading App.tsx:", error.message);
}

// Test 2: Check if Settings component exists
console.log("\n2. Checking Settings component...");
try {
  const settingsContent = fs.readFileSync("./src/pages/Settings.tsx", "utf8");

  if (settingsContent.includes("export default Settings")) {
    console.log("✅ Settings component properly exported");
  } else {
    console.log("❌ Settings component not properly exported");
  }

  if (settingsContent.includes("EndpointConfiguration")) {
    console.log("✅ Settings component has endpoint configuration logic");
  } else {
    console.log("❌ Settings component missing endpoint configuration");
  }

  if (settingsContent.includes("API Endpoint Configurations")) {
    console.log("✅ Settings component has UI for endpoint configurations");
  } else {
    console.log("❌ Settings component missing UI");
  }
} catch (error) {
  console.log("❌ Error reading Settings.tsx:", error.message);
}

// Test 3: Check if frontend is running
console.log("\n3. Checking if frontend is accessible...");
const http = require("http");

const checkFrontend = () => {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:3000", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

checkFrontend().then((isRunning) => {
  if (isRunning) {
    console.log("✅ Frontend is running on port 3000");
  } else {
    console.log("❌ Frontend is not accessible");
  }

  console.log("\n📋 Summary:");
  console.log('If all checks pass but you still see "Settings Page (TODO)",');
  console.log("try the following:");
  console.log("1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)");
  console.log("2. Open developer tools and check for JavaScript errors");
  console.log("3. Navigate directly to: http://localhost:3000/settings");
  console.log("4. Check browser console for any import errors");
});
