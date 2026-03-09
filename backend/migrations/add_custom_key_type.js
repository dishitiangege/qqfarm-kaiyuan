/**
 * 迁移脚本：为 upgrade_keys 和 user_upgrade_logs 表添加 custom 密钥类型
 */

const { query } = require('../db');

async function migrate() {
  try {
    // 检查 upgrade_keys 表的 key_type 字段
    const [upgradeKeysColumns] = await query(`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'upgrade_keys'
      AND COLUMN_NAME = 'key_type'
    `);

    if (upgradeKeysColumns && upgradeKeysColumns.length > 0) {
      const columnType = upgradeKeysColumns[0].COLUMN_TYPE;
      console.log('[迁移] upgrade_keys.key_type 当前类型:', columnType);

      // 如果枚举类型不包含 custom，则修改
      if (!columnType.includes('custom')) {
        await query(`
          ALTER TABLE upgrade_keys
          MODIFY COLUMN key_type ENUM('level1', 'level2', 'custom') NOT NULL COMMENT '密钥等级: level1-一级密钥, level2-二级密钥, custom-自定义密钥'
        `);
        console.log('[迁移] 成功修改 upgrade_keys.key_type 字段，添加 custom 类型');
      } else {
        console.log('[迁移] upgrade_keys.key_type 已包含 custom 类型，跳过');
      }
    }

    // 检查 user_upgrade_logs 表的 key_type 字段
    const [upgradeLogsColumns] = await query(`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'user_upgrade_logs'
      AND COLUMN_NAME = 'key_type'
    `);

    if (upgradeLogsColumns && upgradeLogsColumns.length > 0) {
      const columnType = upgradeLogsColumns[0].COLUMN_TYPE;
      console.log('[迁移] user_upgrade_logs.key_type 当前类型:', columnType);

      // 如果枚举类型不包含 custom，则修改
      if (!columnType.includes('custom')) {
        await query(`
          ALTER TABLE user_upgrade_logs
          MODIFY COLUMN key_type ENUM('level1', 'level2', 'custom') NOT NULL COMMENT '密钥等级: level1-一级密钥, level2-二级密钥, custom-自定义密钥'
        `);
        console.log('[迁移] 成功修改 user_upgrade_logs.key_type 字段，添加 custom 类型');
      } else {
        console.log('[迁移] user_upgrade_logs.key_type 已包含 custom 类型，跳过');
      }
    }

    console.log('[迁移] 完成');
  } catch (error) {
    console.error('[迁移] 失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[迁移] 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[迁移] 脚本执行错误:', error);
      process.exit(1);
    });
}

module.exports = migrate;
