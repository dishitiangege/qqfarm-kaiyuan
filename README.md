# QQ农场自动化助手

> **QQ群：1082121037** - 欢迎加入交流！

## 项目简介

本项目是一个基于 Node.js 和 Vue.js 的 QQ农场自动化助手系统，包含完整的后端 API 服务和前端管理界面。项目采用前后端分离架构，支持多账号管理、自动农场操作、数据统计等功能。

**原作者**：玄机博客 <https://xuanji.hk-gov.com/>

---

## 目录结构

```
qqfarm-kaiyuan/
├── backend/                    # 后端服务目录
│   ├── config/                 # 配置文件
│   │   └── schema.js           # 数据库 schema 配置
│   ├── core/                   # 核心功能模块
│   │   ├── antiDetection.js    # 反检测模块
│   │   ├── event-store.js      # 事件存储
│   │   ├── exp-calculator.js   # 经验计算器
│   │   └── network-monitor.js  # 网络监控
│   ├── middleware/             # 中间件
│   │   └── auth.js             # 认证中间件
│   ├── migrations/             # 数据库迁移文件
│   ├── routes/                 # 路由定义
│   │   ├── land-management.js  # 土地管理路由
│   │   ├── recommendation.js   # 推荐系统路由
│   │   └── upgradeKeyRoutes.js # 升级密钥路由
│   ├── services/               # 业务服务层
│   │   ├── dailyStatsService.js    # 每日统计服务
│   │   ├── emailService.js         # 邮件服务
│   │   ├── upgradeKeyExpiryService.js  # 密钥过期服务
│   │   └── upgradeKeyService.js    # 密钥管理服务
│   ├── utils/                  # 工具函数
│   │   ├── crypto-wasm.js      # WebAssembly 加密工具
│   │   └── tsdk.wasm           # WASM 文件
│   ├── server.js               # 服务器入口文件
│   ├── db.js                   # 数据库连接配置
│   └── package.json            # 后端依赖配置
│
├── frontend/                   # 前端项目目录 (Vue3 + TypeScript)
│   ├── src/
│   │   ├── components/         # Vue 组件
│   │   │   ├── FarmConsole/    # 农场控制台组件
│   │   │   │   ├── BagTab.vue      # 背包标签页
│   │   │   │   ├── ConfigTab.vue   # 配置标签页
│   │   │   │   ├── LandTab.vue     # 土地标签页
│   │   │   │   ├── LogTab.vue      # 日志标签页
│   │   │   │   ├── OverviewTab.vue # 概览标签页
│   │   │   │   └── RankingTab.vue  # 排行榜标签页
│   │   │   ├── AdminPanel.vue      # 管理面板
│   │   │   ├── FarmConsole.vue     # 农场控制台主组件
│   │   │   ├── LoginPage.vue       # 登录页面
│   │   │   └── ...                 # 其他组件
│   │   ├── services/           # 前端服务层
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── views/              # 页面视图
│   │   ├── App.vue             # 根组件
│   │   ├── main.ts             # 入口文件
│   │   └── router.ts           # 路由配置
│   ├── dist/                   # 构建输出目录
│   └── package.json            # 前端依赖配置
│
├── src/                        # 核心源码目录
│   ├── config.js               # 全局配置
│   ├── decode.js               # 解码工具
│   ├── email.js                # 邮件功能
│   ├── farm.js                 # 农场核心逻辑
│   ├── friend.js               # 好友系统
│   ├── gameConfig.js           # 游戏配置
│   ├── illustrated.js          # 图鉴系统
│   ├── invite.js               # 邀请系统
│   ├── monthCard.js            # 月卡系统
│   ├── network.js              # 网络请求
│   ├── openServer.js           # 开服逻辑
│   ├── proto.js                # Protocol Buffer 处理
│   ├── qqvip.js                # QQ会员功能
│   ├── share.js                # 分享功能
│   ├── shop.js                 # 商店功能
│   ├── status.js               # 状态管理
│   ├── task.js                 # 任务系统
│   ├── telemetry.js            # 遥测数据
│   ├── utils.js                # 工具函数
│   └── warehouse.js            # 仓库管理
│
├── proto/                      # Protocol Buffer 定义文件
│   ├── corepb.proto            # 核心协议
│   ├── game.proto              # 游戏协议
│   ├── itempb.proto            # 物品协议
│   ├── plantpb.proto           # 种植协议
│   ├── userpb.proto            # 用户协议
│   └── ...                     # 其他协议定义
│
├── gameConfig/                 # 游戏配置文件
│   ├── ItemInfo.json           # 物品信息
│   ├── Plant.json              # 植物数据
│   └── RoleLevel.json          # 角色等级
│
├── collectors/                 # 数据收集器
├── tools/                      # 工具脚本
├── docs/                       # 文档目录
├── logs/                       # 日志文件目录
├── client.js                   # 客户端入口
└── package.json                # 项目根配置
```

---

## 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **MySQL2** - 数据库
- **JWT** - 身份认证
- **bcrypt** - 密码加密
- **nodemailer** - 邮件服务
- **Protocol Buffer** - 数据序列化

### 前端
- **Vue 3** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Pinia** - 状态管理
- **Vue Router** - 路由管理
- **Tailwind CSS** - CSS 框架

---

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- MySQL >= 5.7

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置数据库
1. 创建 MySQL 数据库
2. 导入 `backend/database.sql` 文件
3. 修改 `backend/db.js` 中的数据库连接配置

### 启动服务

```bash
# 启动后端服务
cd backend
npm start

# 启动前端开发服务器
cd frontend
npm run dev
```

---

## 版权声明

### 原创声明

本项目由 **玄机博客**（<https://xuanji.hk-gov.com/>）原创开发并开源发布。

### 使用协议

1. **开源免费**：本项目完全开源免费，欢迎个人学习、研究使用。

2. **禁止倒卖**：
   - **严禁**将本项目或基于本项目的衍生作品进行售卖、转让或用于任何商业盈利目的。
   - **严禁**以任何形式将本项目作为商品或服务进行销售。
   - **严禁**删除、修改或隐藏原作者署名和版权信息。

3. **尊重原创**：
   - 使用本项目时，请保留原作者署名和版权声明。
   - 如需转载或分享，请注明出处和原作者信息。
   - 欢迎提交 Issue 和 Pull Request 参与项目改进。

4. **免责声明**：
   - 本项目仅供学习研究使用，使用本项目产生的任何后果由使用者自行承担。
   - 请遵守相关法律法规和平台规则，合理使用本项目。

### 侵权举报

如发现任何倒卖、侵权或违反本协议的行为，欢迎向原作者举报。

---

## 联系方式

- **原作者**：玄机博客
- **网站**：[https://xuanji.hk-gov.com/](https://xuanji.hk-gov.com/)

---

## 致谢

感谢所有为本项目提供建议、反馈和贡献的朋友们！

特别感谢 [linguo2625469](https://github.com/linguo2625469) 的代码参考与启发。
