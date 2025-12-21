const config = require("../config");

/**
 * 重新获取所有邮箱列表
 * @param {string} token - 已登录的会话令牌
 */
async function registerTempEmail(token) {
  if (!token) {
    throw new Error("缺少会话令牌，请确保已登录");
  }

  const credentials = config.getCredentials();

  console.log("正在获取邮箱列表...");
  const accountList = await fetchAccountList(token, credentials.emailApiUrl);
  const { parent, children } = splitAccounts(accountList, credentials.loginEmail);

  config.persistAccountsSnapshot({ parent, children });
  console.log(`✓ 已保存母号 ${parent.email} 和 ${children.length} 个子号到 temp-mail.yaml`);

  return {
    parent,
    children,
  };
}

function ensureFetchAvailable() {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("当前 Node 版本不支持全局 fetch，请使用 Node 18+ 或自行 polyfill fetch");
  }
}

async function fetchAccountList(token, emailApiUrl) {
  ensureFetchAvailable();

  const allAccounts = [];
  let lastAccountId = 0;
  const pageSize = 30; // 上游服务限制每次最多返回30条
  let pageNum = 1;

  console.log("开始请求邮箱列表，使用 token:", token);

  // 循环分页获取所有账户
  while (true) {
    const accountListUrl = `${emailApiUrl}/api/account/list?accountId=${lastAccountId}&size=${pageSize}`;
    console.log(`请求第 ${pageNum} 页: ${accountListUrl}`);

    const response = await fetch(accountListUrl, {
      headers: {
        Authorization: `${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`获取邮箱列表失败，HTTP 状态码 ${response.status}`);
    }

    const listText = await response.text();
    let payload;
    try {
      payload = JSON.parse(listText);
    } catch (error) {
      throw new Error(`邮箱列表响应无法解析为 JSON: ${error.message}`);
    }

    if (payload.code !== 200 || !Array.isArray(payload.data)) {
      throw new Error(`邮箱列表 API 返回异常: ${payload.message || "未知"}`);
    }

    const accounts = payload.data;

    if (accounts.length === 0) {
      // 没有更多数据了
      break;
    }

    allAccounts.push(...accounts);
    console.log(`  获取到 ${accounts.length} 个账户，累计 ${allAccounts.length} 个`);

    // 如果返回的数量小于 pageSize，说明已经是最后一页
    if (accounts.length < pageSize) {
      break;
    }

    // 获取最后一个账户的 ID 作为下一页的起始点
    lastAccountId = accounts[accounts.length - 1].accountId;
    pageNum++;

    // 添加小延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`✓ 共获取到 ${allAccounts.length} 个账户`);
  return allAccounts;
}

function splitAccounts(list, loginEmail) {
  const children = [];
  let parent = null;

  for (const item of list) {
    if (!parent && item.email === loginEmail) {
      parent = item;
      continue;
    }
    children.push(item);
  }

  if (!parent) {
    parent = {
      email: loginEmail,
      accountId: null,
      name: "",
      status: null,
      latestEmailTime: "",
      createTime: new Date().toISOString(),
    };
  }

  return { parent, children };
}

module.exports = registerTempEmail;
