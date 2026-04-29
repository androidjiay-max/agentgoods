/**
 * test-agent.js
 * 
 * 模拟一个 AI Agent 的自主购物流程：
 * 1. 调用 GET /api/v1/catalog 查询商品
 * 2. 选择一个商品并提取其 tool_schema
 * 3. 调用 POST /api/v1/transact 发起购买
 */

const API_KEY = process.env.AGENT_API_KEY || "YOUR_AGENT_API_KEY"; // Replace when testing manually if needed
const BASE_URL = "http://localhost:3000/api/v1";

async function runAgent() {
  console.log("🤖 [Agent] Waking up and starting task...");
  
  if (!API_KEY || API_KEY === "YOUR_AGENT_API_KEY") {
    console.error("❌ Please provide an AGENT_API_KEY via environment variable.");
    console.error("Run: AGENT_API_KEY=ag_xxx node test-agent.js");
    return;
  }

  try {
    // 1. Discover Products
    console.log(`\n🔍 [Agent] Fetching product catalog from ${BASE_URL}/catalog...`);
    const catalogRes = await fetch(`${BASE_URL}/catalog`);
    const catalogData = await catalogRes.json();
    
    if (!catalogData.success || catalogData.data.length === 0) {
      console.log("📉 [Agent] No products available. Sleeping.");
      return;
    }
    
    console.log("🛒 [Agent] Found the following digital goods:");
    console.log(JSON.stringify(catalogData.data, null, 2));

    // 2. Select a product (Let's pick the first one for the MVP test)
    const targetProduct = catalogData.data[0];
    console.log(`\n🧠 [Agent] Decided to purchase: ${targetProduct.name} ($${targetProduct.price})`);

    // 3. Purchase the product
    console.log(`💳 [Agent] Initiating transaction using API Key: ${API_KEY.substring(0, 8)}***...`);
    const transactRes = await fetch(`${BASE_URL}/transact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        productId: targetProduct.product_id
      })
    });
    
    const transactData = await transactRes.json();

    if (transactData.success) {
      console.log("✅ [Agent] Transaction Successful!");
      console.log("📦 [Agent] Received Payload:");
      console.log(JSON.stringify(transactData.data, null, 2));
    } else {
      console.error("❌ [Agent] Transaction Failed!");
      console.error(transactData.error);
    }

  } catch (error) {
    console.error("💥 [Agent] Encountered a critical error:", error);
  }
}

runAgent();
