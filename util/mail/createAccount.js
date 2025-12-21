const config = require("../config");
const readline = require("readline");

/**
 * 生成随机的邮箱名称（15位大小写字母+数字）
 */
function generateRandomName(length = 15) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 确保 fetch API 可用
 */
function ensureFetchAvailable() {
    if (typeof globalThis.fetch !== "function") {
        throw new Error("当前 Node 版本不支持全局 fetch，请使用 Node 18+ 或自行 polyfill fetch");
    }
}

/**
 * 提示用户输入
 */
async function prompt(question, rl) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

/**
 * 创建 readline 接口的辅助函数
 */
function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

/**
 * 创建单个子号（内部函数）
 * @param {string} token - 已登录的会话令牌
 * @returns {Promise<Object>} 创建的账号信息
 */
async function createSingleAccount(token) {
    ensureFetchAvailable();

    const { defaultDomain, emailApiUrl } = config.getCredentials();
    const createAccountUrl = `${emailApiUrl}/api/account/add`;

    const randomName = generateRandomName(15);
    const email = `${randomName}${defaultDomain}`;

    const requestPayload = {
        email: email,
        token: "",
    };

    const response = await fetch(createAccountUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token,
        },
        body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
        throw new Error(`创建子号请求失败，HTTP 状态码 ${response.status}`);
    }

    const payloadText = await response.text();
    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        throw new Error(`创建子号响应无法解析为 JSON: ${error.message}`);
    }

    if (payload.code !== 200 || !payload.data) {
        throw new Error(`创建子号失败: ${payload.message || "未知错误"}`);
    }

    return payload.data;
}

/**
 * 创建新的子号（主函数）
 * @param {string} token - 已登录的会话令牌
 * @param {Object} rl - readline 接口（可选，如果不提供则创建新的）
 * @returns {Promise<Object|Object[]>} 创建的账号信息或账号信息数组
 */
async function createAccount(token, rl = null) {
    if (!token) {
        throw new Error("缺少会话令牌，请确保已登录");
    }

    // 如果没有传入 readline 接口，则创建一个新的
    const shouldCloseRl = !rl;
    if (!rl) {
        rl = createReadlineInterface();
    }

    try {
        console.log("\n新建子号 - 请输入要创建的数量");
        console.log("  - 输入数字（如 50）批量创建多个子号");
        console.log("  - 直接按回车创建 1 个子号");
        console.log("  - 输入 0 取消操作");

        const input = await prompt("\n请输入创建数量: ", rl);

        // 直接按回车，默认创建 1 个
        const count = input === "" ? 1 : parseInt(input, 10);

        if (count === 0) {
            console.log("已取消创建操作。");
            return null;
        }

        if (isNaN(count) || count < 0) {
            throw new Error("无效的数量，请输入正整数");
        }

        if (count > 100) {
            console.log("⚠️  单次最多创建 100 个子号，已限制为 100 个");
        }

        const actualCount = Math.min(count, 100);

        if (actualCount === 1) {
            // 单个创建
            console.log(`\n正在创建子号...`);
            const accountData = await createSingleAccount(token);
            console.log(`✓ 子号创建成功！`);
            console.log(`  - 邮箱: ${accountData.email}`);
            console.log(`  - 账号ID: ${accountData.accountId}`);
            console.log(`  - 创建时间: ${accountData.createTime}`);
            return accountData;
        } else {
            // 批量创建
            console.log(`\n开始批量创建 ${actualCount} 个子号...`);
            console.log("-".repeat(50));

            const createdAccounts = [];
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < actualCount; i++) {
                try {
                    const accountData = await createSingleAccount(token);
                    createdAccounts.push(accountData);
                    successCount++;
                    console.log(`✓ [${i + 1}/${actualCount}] 创建成功: ${accountData.email}`);
                } catch (error) {
                    failCount++;
                    console.log(`✗ [${i + 1}/${actualCount}] 创建失败: ${error.message}`);
                }
                // 添加小延迟避免请求过快
                if (i < actualCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            console.log("-".repeat(50));
            console.log(`\n批量创建完成！成功: ${successCount}, 失败: ${failCount}`);

            return createdAccounts;
        }
    } finally {
        // 只有在函数内部创建的 readline 接口才需要关闭
        if (shouldCloseRl) {
            rl.close();
        }
    }
}

module.exports = createAccount;

