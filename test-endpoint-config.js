// Test script for endpoint configuration
const testEndpoints = [
  {
    name: "JSONPlaceholder Test",
    baseUrl: "https://jsonplaceholder.typicode.com",
    testPath: "/posts/1",
    auth: { type: "none" },
  },
  {
    name: "HTTPBin Test",
    baseUrl: "https://httpbin.org",
    testPath: "/get",
    auth: { type: "none" },
  },
];

async function testEndpointConfiguration(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`📡 URL: ${config.baseUrl}${config.testPath}`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${config.baseUrl}${config.testPath}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;
    const valid = response.status >= 200 && response.status < 300;

    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status}`);
    console.log(`${valid ? "✅" : "❌"} ${valid ? "SUCCESS" : "FAILED"}`);

    if (valid) {
      const data = await response.json();
      console.log(
        `📄 Response preview: ${JSON.stringify(data).substring(0, 100)}...`,
      );
    }

    return { valid, responseTime, statusCode: response.status };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

async function runTests() {
  console.log("🚀 Starting Endpoint Configuration Tests\n");

  for (const config of testEndpoints) {
    await testEndpointConfiguration(config);
  }

  console.log("\n✨ Tests completed!");
  console.log("\n📋 Manual Testing Steps:");
  console.log("1. Open http://localhost:3002/settings");
  console.log("2. Add a new endpoint configuration");
  console.log("3. Test the connection using the test button");
  console.log("4. Set as active configuration");
  console.log("5. Try uploading a CSV file");
}

runTests().catch(console.error);
