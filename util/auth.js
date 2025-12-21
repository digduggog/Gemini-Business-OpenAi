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

    const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
    });

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
