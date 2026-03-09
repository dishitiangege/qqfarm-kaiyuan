/**
 * 迁移脚本：为 user_upgrade_logs 表添加 extend_days 字段
 * 用于记录升级密钥延长的天数
 */

const { query } = require('../db');

async function migrate() {
  try {
    // 检查字段是否已存在
    const [columns] = await query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'user_upgrade_logs'
      AND COLUMN_NAME = 'extend_days'
    `);

    if (columns && columns.length > 0) {
      console.log('[迁移] extend_days 字段已存在，跳过');
      return;
    }

    // 添加 extend_days 字段
    await query(`
      ALTER TABLE user_upgrade_logs
      ADD COLUMN extend_days INT NOT NULL DEFAULT 30 COMMENT '延长的有效期天数'
      AFTER new_expires_at
    `);

    console.log('[迁移] 成功添加 extend_days 字段到 user_upgrade_logs 表');

    // 更新现有记录，根据 key_type 设置默认值
    await query(`
      UPDATE user_upgrade_logs uul
      JOIN upgrade_keys uk ON uul.upgrade_key_id = uk.id
      SET uul.extend_days = uk.extend_days
    `);

    console.log('[迁移] 成功更新现有记录的 extend_days 值');

  } catch (error) {
    console.error('[迁移] 失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[迁移] 完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[迁移] 错误:', error);
      process.exit(1);
    });
}

module.exports = migrate;
