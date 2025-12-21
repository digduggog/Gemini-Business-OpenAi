const registerTempEmail = require("./util/mail/tempMail");
const createAccount = require("./util/mail/createAccount");
const deleteAccount = require("./util/mail/deleteAccount");
const getVerificationCode = require("./util/mail/getVerificationCode");
const geminiAutoRefresh = require("./util/gemini/geminiAutoRefresh");
const updateGeminiPool = require("./util/gemini/updateGeminiPool");
const selectBusinessAccounts = require("./util/gemini/selectBusinessAccounts");
const cleanInvalidAccounts = require("./util/gemini/cleanInvalidAccounts");
const { openGeminiChildInteractive } = require("./util/gemini/autoRefresh");
const { getGeminiChildrenAccounts } = require("./util/gemini/geminiConfig");
const { autoLogin } = require("./util/auth");
const readline = require("readline");
const logUpdate = require("log-update");

// 全局会话 token，在程序启动时获取
let sessionToken = null;

// 邮箱管理工具
const mailTools = [
  {
    id: "1",
    name: "重新获取所有邮箱",
    action: async () => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }
      return await registerTempEmail(sessionToken);
    },
  },
  {
    id: "2",
    name: "新建子号",
    action: async (rl) => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }
      return await createAccount(sessionToken, rl);
    },
  },
  {
    id: "3",
    name: "删除子号",
    action: async (rl) => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }
      return await deleteAccount(sessionToken, rl);
    },
  },
];

// ChatGPT 管理工具
const chatgptTools = [
  {
    id: "1",
    name: "获取最新登录验证码",
    action: async (rl) => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }
      return await getVerificationCode(sessionToken, rl);
    },
  },
];

// Gemini Business 管理工具
const geminiTools = [
  {
    id: "1",
    name: "重置 gemini-mail.yaml 文件(重选已注册的企业版账号)",
    action: async (rl) => {
      return await selectBusinessAccounts(rl);
    },
  },
  {
    id: "2",
    name: "检查并去除失效账户(Gemini Pool)",
    action: async () => {
      return await cleanInvalidAccounts();
    },
  },
  {
    id: "3",
    name: "（HOT）刷新所有账户 Token 并同步到 Gemini Pool",
    action: async () => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }
      await geminiAutoRefresh(sessionToken);

      // 自动继续同步到 Gemini Pool（删除所有并重新添加）
      console.log("\n" + "=".repeat(50));
      console.log("正在同步 Token 到 Gemini Pool 平台...");
      console.log("=".repeat(50));
      await updateGeminiPool();
    },
  },
  {
    id: "4",
    name: "仅同步 gemini-mail.yaml 到 Gemini Pool(不重新获取 Token)",
    action: async () => {
      console.log("\n" + "=".repeat(50));
      console.log("仅同步 gemini-mail.yaml 到 Gemini Pool 平台...");
      console.log("=".repeat(50));
      await updateGeminiPool();
    },
  },
  {
    id: "5",
    name: "临时在线使用网页版（选择一个账户）",
    action: async (rl) => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }

      const children = getGeminiChildrenAccounts();
      if (!children || children.length === 0) {
        console.log("❌ gemini-mail.yaml 中没有子账户，请先配置后再试。");
        return;
      }

      console.log("\n当前 Gemini 子账户列表：");
      console.log("=".repeat(80));
      children.forEach((child, idx) => {
        console.log(`${String(idx + 1).padEnd(3)} | ${child.email} | accountId: ${child.accountId ?? "未知"}`);
      });
      console.log("=".repeat(80));

      const choice = await prompt("\n请选择要使用的序号（0 取消）: ", rl);
      if (choice === "0") {
        console.log("已取消。");
        return;
      }

      const selectedIdx = parseInt(choice, 10) - 1;
      if (Number.isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= children.length) {
        throw new Error("无效的序号");
      }

      const selectedChild = children[selectedIdx];
      await openGeminiChildInteractive(sessionToken, selectedChild, rl);
    },
  },
  {
    id: "6",
    name: "（AUTO）定时自动刷新（每8小时执行一次）",
    action: async (rl) => {
      if (!sessionToken) {
        throw new Error("会话令牌未初始化，请重启程序");
      }

      // 让用户选择执行模式
      console.log("\n" + "=".repeat(50));
      console.log("请选择定时刷新模式：");
      console.log("=".repeat(50));
      console.log("  1. 立即执行一次 + 定时8小时");
      console.log("  2. 跳过首次，仅定时8小时");
      console.log("  0. 取消返回");
      console.log("=".repeat(50));

      const modeChoice = await prompt("\n请输入选项编号: ", rl);

      if (modeChoice === "0") {
        console.log("已取消。");
        return;
      }

      if (modeChoice !== "1" && modeChoice !== "2") {
        console.log("❌ 无效选择，已取消。");
        return;
      }

      const skipFirstRun = modeChoice === "2";

      const INTERVAL_HOURS = 8;
      const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000; // 8小时转毫秒

      // 执行刷新的函数
      const runRefresh = async () => {
        const now = new Date();
        console.log("\n" + "=".repeat(50));
        console.log(`⏰ [${now.toLocaleString()}] 开始执行定时刷新任务...`);
        console.log("=".repeat(50));

        try {
          await geminiAutoRefresh(sessionToken);

          console.log("\n" + "=".repeat(50));
          console.log("正在同步 Token 到 Gemini Pool 平台...");
          console.log("=".repeat(50));
          await updateGeminiPool();

          console.log("\n✅ 定时刷新任务完成！");
          const nextRun = new Date(Date.now() + INTERVAL_MS);
          console.log(`⏰ 下次执行时间: ${nextRun.toLocaleString()}`);
        } catch (error) {
          console.error(`\n❌ 定时刷新任务失败: ${error.message}`);
          console.log("⏰ 将在下一个周期继续尝试...");
        }
      };

      console.log("\n" + "=".repeat(50));
      console.log("🚀 启动定时自动刷新模式");
      console.log("=".repeat(50));
      console.log(`⏰ 刷新间隔: 每 ${INTERVAL_HOURS} 小时`);
      console.log(`📋 执行模式: ${skipFirstRun ? "跳过首次，仅定时" : "立即执行 + 定时"}`);
      console.log("📌 程序将持续运行，按 Ctrl+C 可退出");
      console.log("=".repeat(50));

      // 进度条相关变量
      let countdownIntervalId = null;
      let isRefreshing = false;
      let nextRunTime = Date.now() + INTERVAL_MS;

      // 格式化剩余时间
      const formatRemaining = (ms) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };

      // 生成进度条
      const generateProgressBar = (elapsed, total, width = 30) => {
        const progress = Math.min(elapsed / total, 1);
        const filled = Math.floor(progress * width);
        const empty = width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        const percent = Math.floor(progress * 100);
        return `[${bar}] ${percent}%`;
      };

      // 创建并启动倒计时显示
      const startCountdown = () => {
        nextRunTime = Date.now() + INTERVAL_MS;

        // 每秒更新进度
        countdownIntervalId = setInterval(() => {
          if (isRefreshing) return;

          const now = Date.now();
          const elapsed = Math.min(now - (nextRunTime - INTERVAL_MS), INTERVAL_MS);
          const remaining = Math.max(0, nextRunTime - now);

          const timeStr = formatRemaining(remaining);
          const progressBar = generateProgressBar(elapsed, INTERVAL_MS);
          const nextRunDate = new Date(nextRunTime).toLocaleString();

          // 使用 log-update 覆盖当前行
          logUpdate(`⏳ 距离下次刷新: ${timeStr} ${progressBar} | 下次执行: ${nextRunDate}`);
        }, 1000);
      };

      // 停止倒计时显示
      const stopCountdown = () => {
        if (countdownIntervalId) {
          clearInterval(countdownIntervalId);
          countdownIntervalId = null;
        }
        logUpdate.done(); // 保留最后一行并换行
      };

      // 包装刷新函数，控制进度条显示
      const runRefreshWithCountdown = async () => {
        isRefreshing = true;
        stopCountdown();
        await runRefresh();
        isRefreshing = false;
        startCountdown();
      };

      // 设置定时器
      const intervalId = setInterval(async () => {
        await runRefreshWithCountdown();
      }, INTERVAL_MS);

      // 根据用户选择决定是否立即执行第一次
      if (skipFirstRun) {
        console.log(`\n⏭️  已跳过首次执行`);
        console.log(`⏰ 首次执行时间: ${new Date(nextRunTime).toLocaleString()}\n`);
        startCountdown();
      } else {
        console.log("\n📌 首次执行刷新任务...");
        await runRefresh();
        console.log(""); // 换行
        startCountdown();
      }

      // 等待用户输入退出
      console.log("\n" + "=".repeat(50));
      console.log("💡 输入 'q' 并按回车可停止定时任务并返回主菜单");
      console.log("=".repeat(50) + "\n");

      // 使用循环等待用户输入
      while (true) {
        const input = await prompt("", rl);
        if (input.toLowerCase() === "q") {
          stopCountdown();
          clearInterval(intervalId);
          console.log("\n⏹️  已停止定时自动刷新任务");
          break;
        }
      }
    },
  },
];

// 主菜单分类
const categories = [
  { id: "1", name: "邮箱管理", tools: mailTools },
  { id: "2", name: "ChatGPT 管理", tools: chatgptTools },
  { id: "3", name: "Gemini Business 管理", tools: geminiTools },
];

async function prompt(question, rl) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function renderMainMenu() {
  console.log("\n请选择管理类别（输入编号，q 退出）：");
  categories.forEach((category) => {
    console.log(`  ${category.id}. ${category.name}`);
  });
}

function renderSubMenu(category) {
  console.log(`\n【${category.name}】可用工具（输入编号，b 返回上级菜单）：`);
  category.tools.forEach((tool) => {
    console.log(`  ${tool.id}. ${tool.name}`);
  });
}

async function main() {
  console.log("=".repeat(50));
  console.log("欢迎使用临时邮箱管理工具");
  console.log("=".repeat(50));
  console.log();

  // 启动时自动登录母号
  try {
    sessionToken = await autoLogin();
  } catch (error) {
    console.error("❌ 母号登录失败:", error.message);
    console.error("请检查 temp-mail.yaml 中的账号密码配置");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 主循环：显示主菜单
  let running = true;
  while (running) {
    renderMainMenu();
    const categorySelection = await prompt("\n请选择类别编号: ", rl);

    if (categorySelection.toLowerCase() === "q") {
      console.log("已退出。");
      running = false;
      break;
    }

    const category = categories.find((cat) => cat.id === categorySelection);
    if (!category) {
      console.log("❌ 无效选择，请重新输入。\n");
      continue;
    }

    // 子菜单循环
    let inSubMenu = true;
    while (inSubMenu) {
      renderSubMenu(category);
      const toolSelection = await prompt("\n请选择工具编号: ", rl);

      if (toolSelection.toLowerCase() === "b") {
        inSubMenu = false;
        break;
      }

      const tool = category.tools.find((t) => t.id === toolSelection);
      if (!tool) {
        console.log("❌ 无效选择，请重新输入。\n");
        continue;
      }

      try {
        console.log(`\n执行工具: ${tool.name}`);
        console.log("-".repeat(50));
        await tool.action(rl);
        console.log("-".repeat(50));
        console.log("✓ 执行完成\n");

        // 如果是邮箱管理的新建子号或删除子号,自动运行重新获取所有邮箱
        if (category.id === "1" && (tool.id === "2" || tool.id === "3")) {
          console.log("正在自动同步邮箱列表...");
          console.log("-".repeat(50));
          await mailTools[0].action(rl); // 重新获取所有邮箱
          console.log("-".repeat(50));
          console.log("✓ 邮箱列表已同步\n");
        }
      } catch (error) {
        console.error(`❌ ${tool.name} 执行失败:`, error.message);
        console.log(); // 添加空行
      }
    }
  }

  rl.close();
}

main();

