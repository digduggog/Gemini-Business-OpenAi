const config = require("./config");

/**
 * 确保 fetch API 可用
 */
function ensureFetchAvailable() {
    if (typeof globalThis.fetch !== "function") {
        throw new Error("当前 Node 版本不支持全局 fetch，请使用 Node 18+ 或自行 polyfill fetch");
    }
}

/**
 * 延迟函数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的 fetch 请求
 * @param {string} url - 请求 URL
 * @param {object} options - fetch 选项
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            lastError = error;
            const errorMessage = error.cause?.code || error.code || error.message;

            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000; // 2秒, 4秒, 8秒
                console.log(`\n⚠️  网络请求失败 (尝试 ${attempt}/${maxRetries}): ${errorMessage}`);
                console.log(`   等待 ${waitTime / 1000} 秒后重试...`);
                await delay(waitTime);
            } else {
                console.log(`\n❌ 网络请求失败 (尝试 ${attempt}/${maxRetries}): ${errorMessage}`);
            }
        }
    }

    // 所有重试都失败了，抛出最后一个错误
    throw new Error(`网络请求失败，已重试 ${maxRetries} 次: ${lastError.message}`);
}

/**
 * 执行母号登录，返回 token
 */
async function performLogin({ account, password, defaultDomain, loginEmail, emailApiUrl }) {
    ensureFetchAvailable();

    const loginUrl = `${emailApiUrl}/api/login`;

    const requestPayload = {
        email: loginEmail,
        password,
    };
    console.log("正在登录母号...");
    console.log("登录邮箱:", loginEmail);
    console.log("登录地址:", loginUrl);

    const response = await fetchWithRetry(loginUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
    }, 3);

    if (!response.ok) {
        throw new Error(`登录请求失败，HTTP 状态码 ${response.status}`);
    }

    const payloadText = await response.text();
    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        throw new Error(`登录响应无法解析为 JSON: ${error.message}`);
    }

    if (payload.code !== 200 || !payload.data?.token) {
        throw new Error(`登录失败: ${payload.message || "未知错误"}`);
    }

    return payload.data.token;
}

/**
 * 自动登录母号并返回 token
 */
async function autoLogin() {
    const credentials = config.getCredentials();
    const token = await performLogin(credentials);
    console.log("✓ 母号登录成功！");
    console.log("✓ 会话令牌已获取（本次运行内有效）\n");
    return token;
}

module.exports = {
    autoLogin,
    performLogin,
};
