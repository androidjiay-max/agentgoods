# AgentGoods — Project Status

> 最后更新：2026-05-05

---

## 项目定位

**Agent 经济的淘宝+支付宝** — M2M commerce layer。AI Agent 自主发现、对比、购买 API。卖家上架、定价、收款。平台做结算和分账。

三个独一无二的结合：
1. API 卖家自主上架、定价
2. Agent 自主浏览、对比、购买
3. 平台处理结算、分账、退款

不做"API 集成平台"（那是 Composio/Apify 的赛道），做"M2M 电商"。

---

## 技术栈

| 层 | 技术 |
|------|------|
| 框架 | Next.js 16.2.4 (Turbopack) |
| 语言 | TypeScript (strict) |
| 数据库 | Supabase PostgreSQL (pooler: ap-northeast-2) |
| 认证 | Supabase Auth (Email + GitHub OAuth) |
| 支付 | Stripe（待接入） |
| 部署 | Vercel (agentgoods.io) / 自动 GitHub push |
| DNS | Cloudflare (agentgoods.io + agentgoods.shop) |
| 样式 | Tailwind v4, Terminal/Tool 风格 |
| 测试 | Node built-in test runner |
| 依赖 | Prisma, @supabase/ssr, lucide-react, tsx |

---

## 域名架构

```
agentgoods.io     → Vercel → Dashboard + API（需登录）
agentgoods.shop   → Vercel → 营销落地页（公开）
```

Cloudflare DNS 由 Vercel 自动管理（CNAME 记录），不需要手动 A 记录。

---

## 文件结构

```
agentgoods/
├── prisma/
│   ├── schema.prisma     # User, Agent, Product, LedgerTransaction + bonusExpiresAt
│   ├── seed.ts           # npm run seed — 填充演示数据
│   └── dev.db            # SQLite (本地开发)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout: I18nProvider + ToastProvider
│   │   ├── page.tsx            # Dashboard 服务端组件（并行查询）
│   │   ├── loading.tsx         # 骨架屏
│   │   ├── actions.ts          # Server Actions: CRUD, deposit, refund, getCurrentUser
│   │   ├── DashboardClient.tsx # 主客户端组件（~1050行）
│   │   ├── globals.css         # Terminal/Tool 设计系统
│   │   ├── login/page.tsx      # 登录/注册（支持中文）
│   │   ├── landing/page.tsx    # agentgoods.shop 营销落地页
│   │   ├── auth/callback/route.ts # OAuth 回调
│   │   ├── api/v1/
│   │   │   ├── catalog/route.ts    # GET — 产品目录（分页+搜索+鉴权）
│   │   │   ├── transact/route.ts   # POST — 购买（Serializable隔离+幂等）
│   │   │   ├── health/route.ts     # GET — 健康检查
│   │   │   └── schema/parse/route.ts # POST — Schema 解析引擎
│   │   └── services/access/[productId]/route.ts # Agent 消费 API 代理
│   ├── lib/
│   │   ├── db.ts                 # Prisma 单例
│   │   ├── api-error.ts          # 结构化错误码（12个）
│   │   ├── access-token.ts       # HMAC 签名 token
│   │   ├── rate-limit.ts         # 内存限流（待迁 Upstash Redis）
│   │   ├── logger.ts             # 结构化日志
│   │   ├── reconciliation.ts     # 财务对账脚本
│   │   ├── schema-engine/index.ts # OpenAPI/Swagger → tool_schema 解析器
│   │   ├── supabase/
│   │   │   ├── client.ts         # 浏览器端 Supabase 客户端
│   │   │   ├── server.ts         # 服务端 Supabase 客户端
│   │   │   └── middleware.ts     # 域名路由 + Auth 中间件
│   │   ├── i18n/
│   │   │   ├── dict.ts           # 中英词典
│   │   │   └── provider.tsx      # I18nProvider + useI18n
│   │   └── __tests__/core.test.ts
│   ├── middleware.ts             # App Router middleware
│   └── components/
│       └── toast.tsx             # Toast 通知队列
├── test-agent.js                 # M2M 端到端测试
├── .env.example                  # 示例环境变量
├── .env                          # 实际环境变量（gitignored）
└── PROJECT_STATUS.md             # 本文件
```

---

## 数据库模型

```
User:        id, email(unique), balance, earnings, bonusExpiresAt
Agent:       id, name, apiKeyHash(unique), apiKeyPrefix, userId, maxBudget, currentSpend
Product:     id, name, description, price(cents), schemaString, isSubscription, ownerId(nullable)
LedgerTx:    id, agentId, productId, userId, amount(cents), type(DEPOSIT|PURCHASE|REFUND), idempotencyKey
```

关键设计：
- 所有金额用整数（cents），杜绝浮点数误差
- balance/earnings 是物化视图，对账脚本定期校验
- onDelete: SetNull 保留交易历史

---

## 已完成的核心功能

### 安全
- API Key SHA-256 哈希存储，仅返回一次
- $transaction + Serializable 隔离级别防并发超支
- 幂等键防重复扣款
- HMAC 签名 access_token（timingSafeEqual 防时序攻击）
- 结构化错误码（INSUFFICIENT_BALANCE、BUDGET_EXCEEDED 等）

### 资金
- 买付卖收：买家扣款 → 卖家入账
- 自买自卖拦截
- 退款（恢复买家余额 + 冲销卖家收入）
- $5 新用户体验金，14 天过期自动扣回
- 财务对账脚本（验证 balance/earnings + 全局金钱守恒）

### 产品
- 卖家自主上架、定价
- 官方 / 卖家产品标签区分
- Marketplace 双视图（买家浏览 + 卖家管理）
- Schema 标准化引擎（OpenAPI/Swagger 解析）
- 产品销量、收入实时聚合

### 鉴权
- Supabase Email + GitHub OAuth 登录
- Middleware 域名路由（.shop → landing, .io → dashboard）
- 登录页语言切换（中/英）
- Dashboard header 语言切换 + 退出

### UI
- Terminal/Tool 风格（panel 实色边框替代 glass 模糊）
- 中英双语（dict.ts ~300 条目）
- Toast 通知队列（success/error/info）
- 乐观删除（Agent/Product 即时移除）
- Tab 导航：Agents / Marketplace / Transactions / My Products / Sales Ledger
- 角色切换：Buyer / Seller

### DevOps
- GitHub → Vercel 自动部署
- Postinstall: prisma generate
- Build 前 prisma generate
- 健康检查端点 /api/v1/health
- 种子数据 npm run seed

---

## 待完成 / 进行中

### 立即
- [x] Schema 引擎已写完，待测试验证
- [ ] Stripe 真实支付接入（用户充值和卖家提现）
- [ ] 速率限制器迁至 Upstash Redis（当前内存实现生产无效）

### 短期（2周内）
- [ ] 手动上架 30 个 API 到目录
- [ ] Agent Credit Pack 购买模型
- [ ] 找 5 个 Agent 开发者给 $20 credit 产生第一笔真实交易

### 中期（1-2月）
- [ ] 卖家数据分析面板（销量趋势、收入）
- [ ] LangChain / CrewAI tool integration
- [ ] API Key 轮换机制

### 长期
- [ ] MAB 动态定价引擎
- [ ] 产品搜索 + 分类
- [ ] RapidAPI 自动爬取（Phase 3）

---

## 环境变量 (Vercel Production)

```
DATABASE_URL=postgresql://postgres.vpqoqyhoflesucghgbqy:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
AGENTGOODS_BASE_URL=https://agentgoods.io
ACCESS_TOKEN_SECRET=<64-char random hex>
NEXT_PUBLIC_SUPABASE_URL=https://vpqoqyhoflesucghgbqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xQ0oC8CGps7YDO-4qJnG1A_ph5ZNskV
```

---

## 常用命令

```bash
cd ~/Documents/牛逼的程序员养成/ai-shop/agentgoods

npm run dev          # 本地启动
npm run build        # 构建
npm test             # 运行测试
npm run seed         # 填充种子数据
npx prisma db push   # 推送 schema 变更
npx prisma generate  # 重新生成 Prisma client

# 端到端测试
node test-agent.js --api-key=ag_demo_shopping_bot_key_001

# 财务对账
npx tsx src/lib/reconciliation.ts
```

---

## Supabase 信息

- 项目: vpqoqyhoflesucghgbqy
- 区域: ap-northeast-2（首尔）
- Auth: Email + GitHub OAuth
- DB 密码: (在 .env 中)

## Cloudflare

- agentgoods.io: Vercel 自动管理 CNAME
- agentgoods.shop: Vercel 自动管理 CNAME + middleware 路由到 /landing

## GitHub

- 仓库: androidjiay-max/agentgoods
- 推送: 用 GitHub Personal Access Token (ghp_开头)
