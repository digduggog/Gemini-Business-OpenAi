const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const TEMP_MAIL_FILE = path.join(__dirname, '../../temp-mail.yaml');
const GEMINI_MAIL_FILE = path.join(__dirname, '../../gemini-mail.yaml');

/**
 * 从 temp-mail.yaml 读取所有子号
 */
function loadTempMailAccounts() {
    try {
        const fileContent = fs.readFileSync(TEMP_MAIL_FILE, 'utf8');
        const data = yaml.load(fileContent);
        return data.accounts || { parent: null, children: [] };
    } catch (error) {
        throw new Error(`读取 temp-mail.yaml 失败: ${error.message}`);
    }
}

/**
 * 从 gemini-mail.yaml 读取配置
 */
function loadGeminiMailConfig() {
    try {
        const fileContent = fs.readFileSync(GEMINI_MAIL_FILE, 'utf8');
        return yaml.load(fileContent);
    } catch (error) {
        throw new Error(`读取 gemini-mail.yaml 失败: ${error.message}`);
    }
}

/**
 * 保存选中的账户到 gemini-mail.yaml
 */
function saveSelectedAccounts(parent, selectedChildren, poolApiUrl, password) {
    try {
        const data = {
            poolApiUrl: poolApiUrl,
            password: password,
            accounts: {
                parent: parent,
                children: selectedChildren
            }
        };

        const yamlContent = yaml.dump(data, {
            indent: 2,
            lineWidth: -1,
            noRefs: true
        });

        fs.writeFileSync(GEMINI_MAIL_FILE, yamlContent, 'utf8');
        console.log(`✓ 已保存 ${selectedChildren.length} 个账户到 gemini-mail.yaml`);
    } catch (error) {
        throw new Error(`保存到 gemini-mail.yaml 失败: ${error.message}`);
    }
}

/**
 * 解析用户输入的序号（支持单个、逗号分隔或 all）
 * @param {string} input - 用户输入
 * @param {number} maxCount - 最大序号（用于 all）
 * @returns {number[]} 选中的序号数组
 */
function parseSelection(input, maxCount) {
    // 支持 all 关键字
    if (input.toLowerCase() === 'all') {
        return Array.from({ length: maxCount }, (_, i) => i + 1);
    }

    const selections = input.split(',').map(s => s.trim()).filter(s => s);
    const numbers = [];

    for (const sel of selections) {
        const num = parseInt(sel, 10);
        if (isNaN(num) || num < 1) {
            throw new Error(`无效的序号: ${sel}`);
        }
        numbers.push(num);
    }

    return [...new Set(numbers)]; // 去重
}

/**
 * 重新选择 Business 账号
 */
async function selectBusinessAccounts(rl) {
    try {
        console.log('\n正在读取邮箱列表...');

        // 读取 temp-mail.yaml 中的所有子号
        const tempMailAccounts = loadTempMailAccounts();
        const children = tempMailAccounts.children || [];

        if (children.length === 0) {
            console.log('❌ 没有找到任何子号，请先在邮箱管理中创建子号');
            return;
        }

        // 读取 gemini-mail.yaml 的配置
        const geminiConfig = loadGeminiMailConfig();
        const poolApiUrl = geminiConfig.poolApiUrl || 'https://mgs.ccode.vip';
        const password = geminiConfig.password || '';

        console.log('\n可用的子号列表：');
        console.log('-'.repeat(50));
        children.forEach((child, index) => {
            console.log(`  ${index + 1}. ${child.email} (ID: ${child.accountId})`);
        });
        console.log('-'.repeat(50));
        console.log('\n提示：输入 all 选择全部，或输入单个序号（如：1）或多个序号用逗号分隔（如：1,3,5）');

        // 获取用户输入
        const answer = await new Promise((resolve) => {
            rl.question('\n请输入要选择的账号序号: ', (input) => {
                resolve(input.trim());
            });
        });

        if (!answer) {
            console.log('❌ 未输入任何内容，操作取消');
            return;
        }

        // 解析选择
        const selectedIndexes = parseSelection(answer, children.length);
        const selectedChildren = [];

        for (const index of selectedIndexes) {
            if (index > children.length) {
                console.log(`⚠ 序号 ${index} 超出范围，已跳过`);
                continue;
            }
            selectedChildren.push(children[index - 1]);
        }

        if (selectedChildren.length === 0) {
            console.log('❌ 没有选择任何有效的账号');
            return;
        }

        console.log(`\n已选择 ${selectedChildren.length} 个账号：`);
        selectedChildren.forEach(child => {
            console.log(`  - ${child.email}`);
        });

        // 保存到 gemini-mail.yaml（清空原有列表）
        console.log('\n正在保存到 gemini-mail.yaml...');
        saveSelectedAccounts(
            tempMailAccounts.parent,
            selectedChildren,
            poolApiUrl,
            password
        );

        console.log('✓ 操作完成！gemini-mail.yaml 已更新');

    } catch (error) {
        console.error('选择账号失败:', error.message);
        throw error;
    }
}

module.exports = selectBusinessAccounts;
