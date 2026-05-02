# AGENTGOODS — M2M Protocol Gateway

全球首个专为 AI 智能体设计的"认知网关（Cognitive Gateway）"与"统一信用清算网络"——做 AI 时代的"淘宝 + 支付宝"。

## 核心概念

- **消除支付碎片化**：统一 Master Wallet + Agent API Key，代理全球独立 API 接口计费
- **消除数据格式碎片化**：将全网混乱的 API 参数转化为标准 OpenSchema，解决 Agent 调用外部接口时的幻觉和报错

## Phase 1 MVP 功能

- **四大核心模型**：User（主理人）、Agent（机器特工）、Product（数字商品）、LedgerTransaction（交易账本）
- **机器通讯协议网关**：
  - `GET /api/v1/catalog` — 发现协议，输出对 LLM 友好的工具调用 Schema
  - `POST /api/v1/transact` — 结算协议，原子交易（扣费 + 下发凭证），含防超支检查和幂等性支持
- **主理人控制台**：暗黑霓虹风格 React UI，管理 Agent / 充值 / 发布商品 / 实时账本
- **M2M 闭环测试**：`test-agent.js` 验证从浏览目录到自动下单的完整机器闭环

## 快速开始

```bash
# 安装依赖
npm install

# 初始化数据库（首次运行或 schema 变更后使用 --force-reset）
npx prisma db push --force-reset
npx prisma generate

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 访问控制台。

**注意**：创建 Agent 时，API Key 仅在创建时显示一次，请立即复制保存。Key 在数据库中仅存储 SHA-256 哈希值，无法恢复。

## 运行测试

```bash
npm test              # 运行核心逻辑单元测试
npm run test:watch    # 监听模式
```

## 财务对账

```bash
npx tsx src/lib/reconciliation.ts
```

该脚本验证数据库中 User 余额和 Agent 消费是否与账本（LedgerTransaction）一致。建议定期运行。

## 运行 M2M 闭环测试

```bash
# 使用环境变量
AGENTGOODS_BASE_URL=http://localhost:3000 \
AGENTGOODS_API_KEY=ag_your_agent_key \
node test-agent.js

# 或使用命令行参数
node test-agent.js --api-key=ag_your_agent_key
```

测试脚本会依次执行：浏览目录 → 选择商品 → 执行购买 → 验证幂等性。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript (strict) |
| 数据库 | SQLite + Prisma ORM |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide React |

## API 文档

### GET /api/v1/catalog

返回所有可用产品的列表，格式化为 LLM function-calling 兼容结构。

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "product_id": "clx...",
      "name": "Weather API",
      "description": "Real-time weather data",
      "price": 0.50,
      "is_subscription": false,
      "tool_schema": { "type": "object", "properties": { "query": { "type": "string" } } }
    }
  ]
}
```

### POST /api/v1/transact

执行购买交易。需要 Bearer Token 认证（Agent 的 API Key）。

**请求：**
```json
{
  "productId": "clx...",
  "idempotencyKey": "optional-unique-key"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "transaction_id": "clx...",
    "message": "Purchase successful.",
    "payload": {
      "api_endpoint": "http://localhost:3000/services/access/clx...",
      "access_token": "tok_..."
    }
  }
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./dev.db` |
| `AGENTGOODS_BASE_URL` | API 响应中使用的域名 | `http://localhost:3000` |

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 主页面（Server Component）
│   ├── DashboardClient.tsx     # 交互式控制台（Client Component）
│   ├── actions.ts              # Server Actions（CRUD、充值）
│   ├── globals.css             # 全局样式 + Tailwind v4 主题
│   └── api/v1/
│       ├── catalog/route.ts    # GET  /api/v1/catalog
│       └── transact/route.ts   # POST /api/v1/transact（原子事务 + 幂等）
├── lib/
│   ├── db.ts                   # Prisma 客户端单例
│   ├── logger.ts               # 结构化 JSON 日志
│   ├── rate-limit.ts           # 内存速率限制（Phase 2 迁至 Upstash Redis）
│   ├── reconciliation.ts       # 财务对账脚本
│   └── __tests__/
│       └── core.test.ts        # 核心逻辑单元测试
prisma/
└── schema.prisma               # 数据库 Schema
```

## Phase 2 规划

- Supabase (PostgreSQL + Auth) 替代 SQLite
- Upstash Redis 速率限制（替代当前内存限流）
- Dashboard 用户认证（当前为 MVP 开放模式，标注为技术债）
- Stripe / USDC 真实支付集成
- 动态定价引擎（多臂老虎机算法）
- Sentry 错误监控

## 安全设计

- **API Key**：创建时生成，仅返回一次明文；数据库仅存储 SHA-256 哈希
- **交易原子性**：余额检查和扣款在同一 `$transaction` 内，`updateMany` + `WHERE` 条件防止并发超支
- **幂等性**：`idempotencyKey` 防止重复扣款（数据库唯一约束 + 事务内检查）
- **速率限制**：API 端点有基于 IP 的内存限流（30 req/min for /transact, 100 req/min for /catalog）
