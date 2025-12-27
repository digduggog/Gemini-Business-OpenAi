const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Gemini Pool 配置文件路径
const GEMINI_MAIL_FILE = path.join(__dirname, '../../gemini-mail.yaml');

/**
 * 登录 Gemini Pool 平台获取 x-admin-token
 */
async function loginGeminiPool(poolApiUrl, password) {
    try {
        console.log('正在登录 Gemini Pool 平台...');
        console.log('平台地址:', poolApiUrl);
        const response = await axios.post(`${poolApiUrl}/api/auth/login`, {
            password: password
        });

        if (response.data && response.data.token) {
            console.log('登录成功！');
            return response.data.token;
        } else {
            throw new Error('登录响应中没有 token');
        }
    } catch (error) {
        console.error('登录失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        throw error;
    }
}

/**
 * 从 gemini-mail.yaml 读取账户信息
 */
function loadAccountsFromYaml() {
    try {
        const fileContent = fs.readFileSync(GEMINI_MAIL_FILE, 'utf8');
        const data = yaml.load(fileContent);
        return data;
    } catch (error) {
        console.error('读取 YAML 文件失败:', error.message);
        throw error;
    }
}

/**
 * 获取 Gemini Pool 平台上的所有账户
 */
async function getPoolAccounts(poolApiUrl, adminToken) {
    try {
        console.log('\n正在获取平台账户列表...');
        const response = await axios.get(`${poolApiUrl}/api/accounts`, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        if (response.data && response.data.accounts) {
            console.log(`找到 ${response.data.accounts.length} 个平台账户`);
            return response.data.accounts;
        } else {
            throw new Error('获取账户列表失败');
        }
    } catch (error) {
        console.error('获取账户列表失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        throw error;
    }
}

/**
 * 测试单个账户是否可用
 */
async function testAccount(poolApiUrl, accountId, adminToken) {
    try {
        const response = await axios.get(`${poolApiUrl}/api/accounts/${accountId}/test`, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        return response.data && response.data.success === true;
    } catch (error) {
        console.error(`测试账户 ${accountId} 失败:`, error.message);
        return false;
    }
}

/**
 * 删除账户
 */
async function deleteAccount(poolApiUrl, accountId, adminToken) {
    try {
        const response = await axios.delete(`${poolApiUrl}/api/accounts/${accountId}`, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        return response.data && response.data.success === true;
    } catch (error) {
        console.error(`删除账户 ${accountId} 失败:`, error.message);
        return false;
    }
}

/**
 * 删除所有账户
 */
async function deleteAllAccounts(poolApiUrl, adminToken) {
    try {
        // 获取所有账户（按 id 降序删除，避免删除低 id 后高 id 重排导致 404）
        const accounts = (await getPoolAccounts(poolApiUrl, adminToken)).sort((a, b) => b.id - a.id);

        if (accounts.length === 0) {
            console.log('平台上没有账户需要删除');
            return 0;
        }

        console.log(`\n开始删除所有账户（共 ${accounts.length} 个）...`);

        let deletedCount = 0;

        for (const account of accounts) {
            const accountId = account.id;
            console.log(`正在删除账户 ID ${accountId}...`);

            const deleted = await deleteAccount(poolApiUrl, accountId, adminToken);
            if (deleted) {
                console.log(`✓ 账户 ${accountId} 已删除`);
                deletedCount++;
            } else {
                console.log(`✗ 账户 ${accountId} 删除失败`);
            }

            // 添加小延迟避免请求过快
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`\n=== 删除完成 ===`);
        console.log(`已删除: ${deletedCount}/${accounts.length} 个账户`);

        return deletedCount;

    } catch (error) {
        console.error('删除账户失败:', error.message);
        throw error;
    }
}

/**
 * 添加新账户到平台
 */
async function addAccount(poolApiUrl, accountData, adminToken) {
    try {
        const response = await axios.post(`${poolApiUrl}/api/accounts`, {
            team_id: accountData.team_id,
            secure_c_ses: accountData.secure_c_ses,
            host_c_oses: accountData.host_c_oses,
            csesidx: accountData.csesidx,
            user_agent: accountData.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        return response.data && response.data.success === true;
    } catch (error) {
        console.error('添加账户失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
        return false;
    }
}

/**
 * 添加所有账户
 */
async function addAllAccounts(poolApiUrl, yamlAccounts, adminToken) {
    try {
        console.log('\n=== 开始添加账户 ===');

        let addedCount = 0;
        let skippedCount = 0;

        // 遍历 YAML 中的子账户
        if (yamlAccounts.children && yamlAccounts.children.length > 0) {
            for (const child of yamlAccounts.children) {
                if (!child.tokens) {
                    console.log(`\n跳过账户 ${child.email}: 没有 tokens 信息`);
                    skippedCount++;
                    continue;
                }

                const accountData = {
                    team_id: child.tokens.team_id,
                    secure_c_ses: child.tokens.secure_c_ses,
                    host_c_oses: child.tokens.host_c_oses,
                    csesidx: child.tokens.csesidx,
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
                };

                console.log(`\n正在添加账户 ${child.email}...`);
                const success = await addAccount(poolApiUrl, accountData, adminToken);

                if (success) {
                    console.log(`✓ 账户 ${child.email} 添加成功`);
                    addedCount++;
                } else {
                    console.log(`✗ 账户 ${child.email} 添加失败`);
                }

                // 添加小延迟
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // 获取最终账户总数
        const finalAccounts = await getPoolAccounts(poolApiUrl, adminToken);

        console.log('\n=== 添加完成 ===');
        console.log(`成功添加: ${addedCount}`);
        console.log(`跳过: ${skippedCount}`);
        console.log(`当前总数: ${finalAccounts.length}`);

        return { addedCount, skippedCount, totalCount: finalAccounts.length };

    } catch (error) {
        console.error('添加账户失败:', error.message);
        throw error;
    }
}

/**
 * 更新 Gemini Pool 的主函数（删除所有账户并重新添加）
 */
async function updateGeminiPool() {
    try {
        // 1. 读取 gemini-mail.yaml
        console.log('读取账户信息...');
        const yamlData = loadAccountsFromYaml();
        const poolApiUrl = yamlData.poolApiUrl;
        const password = yamlData.password;
        const accounts = yamlData.accounts;

        if (!poolApiUrl) {
            console.log('❌ gemini-mail.yaml 中没有配置 poolApiUrl');
            return;
        }

        if (!accounts.children || accounts.children.length === 0) {
            console.log('❌ gemini-mail.yaml 中没有子账户，请先选择账户');
            return;
        }

        // 2. 登录获取 token
        const adminToken = await loginGeminiPool(poolApiUrl, password);

        // 3. 删除所有账户
        await deleteAllAccounts(poolApiUrl, adminToken);

        // 4. 添加所有账户
        await addAllAccounts(poolApiUrl, accounts, adminToken);

        console.log('\n✓ 所有任务完成！');

    } catch (error) {
        console.error('执行失败:', error.message);
        throw error;
    }
}

/**
 * 更新平台上的单个账户
 */
async function updatePoolAccount(poolApiUrl, accountId, accountData, adminToken) {
    try {
        const response = await axios.put(`${poolApiUrl}/api/accounts/${accountId}`, {
            team_id: accountData.team_id,
            secure_c_ses: accountData.secure_c_ses,
            host_c_oses: accountData.host_c_oses,
            csesidx: accountData.csesidx,
            user_agent: accountData.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        return response.data && response.data.success === true;
    } catch (error) {
        console.error(`更新账户 ${accountId} 失败:`, error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
        return false;
    }
}

// 缓存登录 token，避免每次同步都重新登录
let cachedAdminToken = null;
let cachedTokenTime = 0;
const TOKEN_CACHE_DURATION = 300000; // 5 分钟

/**
 * 获取或刷新 admin token（带缓存）
 */
async function getAdminToken(poolApiUrl, password) {
    const now = Date.now();
    if (cachedAdminToken && (now - cachedTokenTime) < TOKEN_CACHE_DURATION) {
        return cachedAdminToken;
    }

    cachedAdminToken = await loginGeminiPool(poolApiUrl, password);
    cachedTokenTime = now;
    return cachedAdminToken;
}

/**
 * 获取平台账户列表（静默模式，不打印日志）
 */
async function getPoolAccountsSilent(poolApiUrl, adminToken) {
    try {
        const response = await axios.get(`${poolApiUrl}/api/accounts`, {
            headers: {
                'x-admin-token': adminToken
            }
        });

        if (response.data && response.data.accounts) {
            return response.data.accounts;
        } else {
            throw new Error('获取账户列表失败');
        }
    } catch (error) {
        throw error;
    }
}

/**
 * 增量同步单个账户到 Gemini Pool 平台
 * 刷新一个 token 后立即调用此函数同步
 * @param {string} email - 子号邮箱（用于日志）
 * @param {Object} tokens - 包含 team_id, secure_c_ses, host_c_oses, csesidx
 * @returns {Promise<{success: boolean, action: string, error?: string}>}
 */
async function syncSingleAccount(email, tokens) {
    try {
        // 读取配置
        const yamlData = loadAccountsFromYaml();
        const poolApiUrl = yamlData.poolApiUrl;
        const password = yamlData.password;

        if (!poolApiUrl) {
            return { success: false, action: 'skip', error: 'poolApiUrl 未配置' };
        }

        // 获取 admin token（使用缓存）
        const adminToken = await getAdminToken(poolApiUrl, password);

        // 获取平台账户列表
        const poolAccounts = await getPoolAccountsSilent(poolApiUrl, adminToken);

        // 通过 team_id 匹配找到对应账户
        const matchedAccount = poolAccounts.find(acc => acc.team_id === tokens.team_id);

        const accountData = {
            team_id: tokens.team_id,
            secure_c_ses: tokens.secure_c_ses,
            host_c_oses: tokens.host_c_oses,
            csesidx: tokens.csesidx,
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        };

        if (matchedAccount) {
            // 更新已有账户
            const success = await updatePoolAccount(poolApiUrl, matchedAccount.id, accountData, adminToken);
            if (success) {
                console.log(`   🔄 Pool 同步: 已更新账户 (ID: ${matchedAccount.id})`);
                return { success: true, action: 'updated', poolId: matchedAccount.id };
            } else {
                return { success: false, action: 'update_failed', error: '更新失败' };
            }
        } else {
            // 添加新账户
            const success = await addAccount(poolApiUrl, accountData, adminToken);
            if (success) {
                console.log(`   🔄 Pool 同步: 已添加新账户`);
                return { success: true, action: 'added' };
            } else {
                return { success: false, action: 'add_failed', error: '添加失败' };
            }
        }
    } catch (error) {
        console.error(`   ❌ Pool 同步失败: ${error.message}`);
        return { success: false, action: 'error', error: error.message };
    }
}

// 导出函数供其他模块使用
module.exports = {
    updateGeminiPool,
    syncSingleAccount
};

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
    updateGeminiPool().catch(error => {
        console.error('执行失败:', error.message);
        process.exit(1);
    });
}
