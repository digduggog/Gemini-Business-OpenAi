const config = require("./config");
const registerTempEmail = require("./mail/tempMail");

/**
 * 提示用户输入
 */
async function prompt(question, rl) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

/**
 * 显示子号列表并让用户选择
 * @param {string} token - 已登录的会话令牌
 * @param {Object} rl - readline 接口
 * @param {boolean} syncFirst - 是否先同步列表（默认 true）
 * @returns {Promise<Object|null>} 选中的账号对象，或 null（用户取消）
 */
async function selectAccount(token, rl, syncFirst = true) {
    if (syncFirst) {
        console.log("\n正在同步子号列表...");
        await registerTempEmail(token);
    }

    // 读取配置文件中的子号列表
    const accounts = config.getStoredAccounts();
    const children = accounts.children || [];

    if (children.length === 0) {
        console.log("\n当前没有子号可选择。");
        return null;
    }

    console.log("\n当前子号列表：");
    console.log("=".repeat(80));
    console.log("序号 | 账号ID | 邮箱地址                          | 创建时间");
    console.log("-".repeat(80));

    children.forEach((child, index) => {
        const num = String(index + 1).padEnd(4);
        const id = String(child.accountId).padEnd(6);
        const email = String(child.email).padEnd(35);
        const time = child.createTime || "未知";
        console.log(`${num} | ${id} | ${email} | ${time}`);
    });

    console.log("=".repeat(80));
    console.log(`共 ${children.length} 个子号\n`);

    const selection = await prompt("请输入要选择的序号（输入 0 取消，输入 all 选择全部）: ", rl);

    if (selection === "0") {
        console.log("已取消操作。");
        return null;
    }

    // 支持 all 选项，返回所有子号
    if (selection.toLowerCase() === "all") {
        return children; // 返回数组表示选择了全部
    }

    const selectedIndex = parseInt(selection, 10) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= children.length) {
        throw new Error("无效的序号");
    }

    return children[selectedIndex];
}

module.exports = { selectAccount, prompt };
