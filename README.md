# Gemini Business 临时邮箱管理工具

一个基于 Node.js + Puppeteer 的自动化工具，用于管理临时邮箱并自动完成 Gemini Business 账户的登录与 Token 刷新。

## ✨ 核心功能

### 📧 邮箱管理
- **重新获取所有邮箱** - 自动获取母号下的所有子邮箱列表（支持分页获取全部账户）
- **新建子号** - 支持单个或批量创建子邮箱（最多单次 100 个）
- **删除子号** - 交互式选择并删除子邮箱

### 🤖 Gemini Business 管理
- **Token 批量刷新** - 自动登录所有子账户并刷新 Token
- **同步到 Gemini Pool** - 一键将 Token 同步到 [business-gemini-pool](https://github.com/ddcat666/business-gemini-pool) 平台
- **定时自动刷新** - 设置 8 小时周期自动刷新，支持两种模式：
  - 立即执行 + 定时
  - 跳过首次，仅定时
- **临时在线使用** - 快速登录任意子账户的网页版
- **失效账户检测** - 自动检查并清理已失效的账户
- **账户选择** - 重新选择已注册的企业版账号配置

### 📨 ChatGPT 管理
- **获取登录验证码** - 从邮箱获取最新的登录验证码

## 🚀 快速开始

### 环境要求
- **Node.js 18+**（需要原生 fetch 支持）
- **图形化桌面环境**（Puppeteer 需要显示浏览器界面）

### 安装

```bash
npm install
```

### 运行

**交互式启动：**
```bash
npm start
```

**快速刷新（跳过交互菜单）：**
```bash
npm run quick-refresh
```
等同于执行菜单中的"刷新所有账户 Token 并同步到 Gemini Pool"。

## ⚙️ 配置文件

项目使用 YAML 配置文件，首次运行前需要创建：

### `temp-mail.yaml`（必需）
### `gemini-mail.yaml`（必需）

> 💡 可参考 `temp-mail.example.yaml` 和 `gemini-mail.example.yaml` 创建配置文件。

## 🔧 常见问题

### Puppeteer 无法启动

**默认行为：** `npm install` 时会自动下载 Chrome for Testing 到 `~/.cache/puppeteer` 目录（约 280MB）。

**如果自动下载失败**或想使用本地已安装的 Chrome，可设置环境变量：

**PowerShell：**
```powershell
$env:PUPPETEER_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm start
```

**CMD：**
```cmd
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
npm start
```

**跳过自动下载：** 如果你确定要使用本地 Chrome，可在安装时跳过下载：
```powershell
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'
npm install
```

**手动安装浏览器：** 如果自动下载失败，可手动触发下载：
```bash
npx puppeteer browsers install chrome
```

### 配置文件缺失

确保 `temp-mail.yaml` 配置了正确的账号密码，否则会提示：
> 请在 temp-mail.yaml 中填写 account 与 password 字段后再运行

## 📁 项目结构

```
├── index.js                    # 主程序入口，交互式菜单
├── util/
│   ├── config.js               # 配置文件读取（temp-mail.yaml）
│   ├── auth.js                 # 登录认证模块
│   ├── puppeteer.js            # Puppeteer 配置
│   ├── quickRefresh.js         # 快速刷新脚本
│   ├── selectAccount.js        # 账户选择模块
│   ├── mail/
│   │   ├── tempMail.js         # 邮箱列表获取（支持分页）
│   │   ├── createAccount.js    # 批量创建子号
│   │   ├── deleteAccount.js    # 删除子号
│   │   └── getVerificationCode.js  # 获取验证码
│   └── gemini/
│       ├── geminiConfig.js     # Gemini 配置读取
│       ├── geminiAutoRefresh.js # 自动刷新入口
│       ├── autoRefresh.js      # 自动登录与 Token 获取
│       ├── updateGeminiPool.js # 同步到 Gemini Pool
│       ├── cleanInvalidAccounts.js # 清理失效账户
│       └── selectBusinessAccounts.js # 选择企业版账户
├── temp-mail.example.yaml      # 临时邮箱配置示例
├── gemini-mail.example.yaml    # Gemini Pool 配置示例
└── package.json
```

## 🔗 相关项目

- **[cloud-mail](https://github.com/maillab/cloud-mail)** - 配套的临时邮箱系统
- **[business-gemini-pool](https://github.com/ddcat666/business-gemini-pool)** - 配套的 Gemini Business 2API 系统

## 📄 许可证

ISC License
