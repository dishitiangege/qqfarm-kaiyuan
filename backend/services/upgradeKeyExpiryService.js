const { query, transaction } = require('../db');
const farmAccountService = require('../farmAccountService');

class UpgradeKeyExpiryService {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  // 启动定时任务
  start() {
    if (this.checkInterval) {
      console.log('[升级密钥到期检查] 任务已在运行');
      return;
    }

    console.log('[升级密钥到期检查] 启动定时任务，每30分钟检查一次');
    
    // 立即执行一次检查
    this.checkExpiredUpgrades();
    
    // 每30分钟检查一次
    this.checkInterval = setInterval(() => {
      this.checkExpiredUpgrades();
    }, 30 * 60 * 1000);
  }

  // 停止定时任务
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[升级密钥到期检查] 定时任务已停止');
    }
  }

  // 检查到期的升级密钥
  async checkExpiredUpgrades() {
    if (this.isRunning) {
      console.log('[升级密钥到期检查] 上次检查尚未完成，跳过本次');
      return;
    }

    this.isRunning = true;
    console.log('[升级密钥到期检查] 开始检查...');

    try {
      // 查找升级密钥已过期且子账号上限大于1的用户
      const [expiredUsers] = await query(
        `SELECT id, username, max_accounts, upgrade_expires_at 
         FROM users 
         WHERE upgrade_expires_at IS NOT NULL 
           AND upgrade_expires_at < NOW() 
           AND max_accounts > 1
           AND role = 'user'`,
        []
      );

      if (!expiredUsers || expiredUsers.length === 0) {
        console.log('[升级密钥到期检查] 没有到期的升级密钥');
        return;
      }

      console.log(`[升级密钥到期检查] 发现 ${expiredUsers.length} 个用户需要处理`);

      for (const user of expiredUsers) {
        await this.processExpiredUpgrade(user);
      }

      console.log('[升级密钥到期检查] 处理完成');
    } catch (error) {
      console.error('[升级密钥到期检查] 检查失败:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // 处理单个用户的升级密钥到期
  async processExpiredUpgrade(user) {
    console.log(`[升级密钥到期检查] 处理用户: ${user.username} (ID: ${user.id})`);

    try {
      await transaction(async (conn) => {
        // 1. 获取用户的所有子账号（按创建时间排序，最老的在前）
        const [accounts] = await conn.query(
          `SELECT id, account_id, name, created_at 
           FROM farm_accounts 
           WHERE user_id = ? AND is_deleted = FALSE 
           ORDER BY created_at ASC`,
          [user.id]
        );

        const accountCount = accounts ? accounts.length : 0;
        console.log(`[升级密钥到期检查] 用户 ${user.username} 有 ${accountCount} 个子账号`);

        // 2. 如果子账号数量大于1，需要删除最老的子账号，只保留最新的一个
        if (accountCount > 1) {
          // 保留最新的一个，删除其他的
          const accountsToDelete = accounts.slice(0, accountCount - 1);
          const accountToKeep = accounts[accountCount - 1];

          console.log(`[升级密钥到期检查] 保留子账号: ${accountToKeep.name} (${accountToKeep.account_id})`);
          console.log(`[升级密钥到期检查] 需要删除 ${accountsToDelete.length} 个子账号`);

          for (const account of accountsToDelete) {
            await this.deleteAccountAndStopScript(conn, account, user.id);
          }
        }

        // 3. 更新用户表：恢复默认子账号上限，清除升级到期时间
        await conn.query(
          `UPDATE users 
           SET max_accounts = 1,
               upgrade_expires_at = NULL,
               updated_at = NOW()
           WHERE id = ?`,
          [user.id]
        );

        // 4. 记录降级日志
        await conn.query(
          `INSERT INTO user_upgrade_logs 
           (user_id, upgrade_key_id, key_type, old_max_accounts, new_max_accounts, old_expires_at, new_expires_at, created_at)
           VALUES (?, NULL, 'expired', ?, 1, ?, NULL, NOW())`,
          [user.id, user.max_accounts, user.upgrade_expires_at]
        );

        console.log(`[升级密钥到期检查] 用户 ${user.username} 处理完成，子账号上限已恢复为1`);
      });
    } catch (error) {
      console.error(`[升级密钥到期检查] 处理用户 ${user.username} 失败:`, error);
    }
  }

  // 删除子账号并停止脚本
  async deleteAccountAndStopScript(conn, account, userId) {
    console.log(`[升级密钥到期检查] 删除子账号: ${account.name} (${account.account_id})`);

    try {
      // 1. 停止该账号的脚本进程
      await this.stopAccountScript(account.account_id);

      // 2. 软删除子账号
      await conn.query(
        `UPDATE farm_accounts 
         SET is_deleted = TRUE, 
             status = 'stopped',
             updated_at = NOW()
         WHERE id = ?`,
        [account.id]
      );

      // 3. 清理相关的运行数据（可选，保留历史记录）
      // 删除实时运行状态，但保留统计数据
      await conn.query(
        `DELETE FROM account_running_status WHERE account_id = ?`,
        [account.id]
      );

      console.log(`[升级密钥到期检查] 子账号 ${account.name} 已删除并停止脚本`);
    } catch (error) {
      console.error(`[升级密钥到期检查] 删除子账号 ${account.name} 失败:`, error);
      // 继续处理其他账号，不中断整个流程
    }
  }

  // 停止账号的脚本进程
  async stopAccountScript(accountId) {
    try {
      // 使用 farmAccountService 停止账号
      await farmAccountService.stopAccount(accountId);
      console.log(`[升级密钥到期检查] 已停止账号 ${accountId} 的脚本`);
    } catch (error) {
      // 如果账号已经不在运行，会报错，这是正常的
      if (error.message && error.message.includes('未运行')) {
        console.log(`[升级密钥到期检查] 账号 ${accountId} 脚本未运行，无需停止`);
      } else {
        console.error(`[升级密钥到期检查] 停止账号 ${accountId} 脚本失败:`, error.message);
      }
    }
  }

  // 手动触发检查（用于测试）
  async manualCheck() {
    console.log('[升级密钥到期检查] 手动触发检查');
    await this.checkExpiredUpgrades();
  }
}

module.exports = new UpgradeKeyExpiryService();