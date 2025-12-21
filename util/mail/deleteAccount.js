const config = require("../config");
const { selectAccount, prompt } = require("../selectAccount");
const readline = require("readline");

/**
 * 确保 fetch API 可用
 */
function ensureFetchAvailable() {
    if (typeof globalThis.fetch !== "function") {
        throw new Error("当前 Node 版本不支持全局 fetch，请使用 Node 18+ 或自行 polyfill fetch");
    }
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
 * 执行删除账号的 API 请求
 * @param {string} token - 已登录的会话令牌
 * @param {number} accountId - 要删除的账号ID
 */
async function performDelete(token, accountId) {
    ensureFetchAvailable();

    const { emailApiUrl } = config.getCredentials();
    const url = `${emailApiUrl}/api/account/delete?accountId=${accountId}`;

    console.log(`正在删除账号 ID: ${accountId}...`);

    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": token,
        },
    });

    if (!response.ok) {
        throw new Error(`删除账号请求失败，HTTP 状态码 ${response.status}`);
    }

    const payloadText = await response.text();
    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        throw new Error(`删除账号响应无法解析为 JSON: ${error.message}`);
    }

    if (payload.code !== 200) {
        throw new Error(`删除账号失败: ${payload.message || "未知错误"}`);
    }

    return payload;
}

/**
 * 手动输入邮箱地址进行删除
 */
async function deleteByManualInput(token, rl) {
    const email = await prompt("\n请输入要删除的邮箱地址: ", rl);

    if (!email) {
        console.log("邮箱地址不能为空。");
        return null;
    }

    // 从配置文件中查找对应的账号ID
    const accounts = config.getStoredAccounts();
    const children = accounts.children || [];
    const foundAccount = children.find(child => child.email === email);

    if (!foundAccount) {
        throw new Error(`未找到邮箱 ${email} 对应的账号`);
    }

    return foundAccount;
}

/**
 * 确认删除
 */
async function confirmDelete(account, rl) {
    console.log(`\n准备删除账号: ${account.email} (ID: ${account.accountId})`);
    const confirm = await prompt(
        `⚠️  确认要删除吗？(y/n): `,
        rl
    );

    if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("已取消删除操作。");
        return false;
    }
    return true;
}

/**
 * 删除子号主函数
 * @param {string} token - 已登录的会话令牌
 * @param {Object} rl - readline 接口（可选，如果不提供则创建新的）
 */
async function deleteAccount(token, rl = null) {
    if (!token) {
        throw new Error("缺少会话令牌，请确保已登录");
    }

    // 如果没有传入 readline 接口，则创建一个新的
    const shouldCloseRl = !rl;
    if (!rl) {
        rl = createReadlineInterface();
    }

    try {
        console.log("\n删除子号 - 请选择操作方式：");
        console.log("  1. 同步子号列表（推荐）");
        console.log("  2. 手动输入邮箱");
        console.log("  0. 取消");

        const choice = await prompt("\n请选择: ", rl);

        let accountToDelete = null;

        if (choice === "1") {
            // 使用共享的 selectAccount 函数
            accountToDelete = await selectAccount(token, rl, true);
        } else if (choice === "2") {
            accountToDelete = await deleteByManualInput(token, rl);
        } else if (choice === "0") {
            console.log("已取消删除操作。");
            return;
        } else {
            throw new Error("无效的选择");
        }

        if (!accountToDelete) {
            return; // 用户取消了操作
        }

        // 检查是否是批量删除（selectAccount 返回数组时表示选择了全部）
        if (Array.isArray(accountToDelete)) {
            const accountsToDelete = accountToDelete;
            console.log(`\n⚠️  即将删除所有 ${accountsToDelete.length} 个子号！`);
            console.log("-".repeat(50));
            accountsToDelete.forEach((acc, idx) => {
                console.log(`  ${idx + 1}. ${acc.email} (ID: ${acc.accountId})`);
            });
            console.log("-".repeat(50));

            const confirmAll = await prompt(
                `⚠️  确认要删除以上所有 ${accountsToDelete.length} 个子号吗？此操作不可撤销！(输入 yes 确认): `,
                rl
            );

            if (confirmAll.toLowerCase() !== "yes") {
                console.log("已取消批量删除操作。");
                return;
            }

            // 批量删除
            console.log("\n开始批量删除...");
            let successCount = 0;
            let failCount = 0;

            for (const account of accountsToDelete) {
                try {
                    await performDelete(token, account.accountId);
                    console.log(`✓ 删除成功: ${account.email}`);
                    successCount++;
                } catch (error) {
                    console.log(`✗ 删除失败: ${account.email} - ${error.message}`);
                    failCount++;
                }
                // 添加小延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            console.log("\n" + "=".repeat(50));
            console.log(`批量删除完成！成功: ${successCount}, 失败: ${failCount}`);
            return;
        }

        // 单个删除的逻辑
        // 统一进行二次确认
        const confirmed = await confirmDelete(accountToDelete, rl);
        if (!confirmed) {
            return;
        }

        // 执行删除
        await performDelete(token, accountToDelete.accountId);

        console.log(`✓ 子号删除成功！`);
        console.log(`  - 邮箱: ${accountToDelete.email}`);
        console.log(`  - 账号ID: ${accountToDelete.accountId}`);

    } finally {
        // 只有在函数内部创建的 readline 接口才需要关闭
        if (shouldCloseRl) {
            rl.close();
        }
    }
}

module.exports = deleteAccount;

