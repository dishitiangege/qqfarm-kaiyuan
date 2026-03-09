const { query } = require('../db');

async function migrate() {
  try {
    console.log('[迁移] 检查并添加 upgrade_expires_at 列到 users 表...');
    
    // 检查列是否存在
    const [columns] = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'upgrade_expires_at'
    `);
    
    if (columns && columns.length > 0) {
      console.log('[迁移] upgrade_expires_at 列已存在，跳过');
      return;
    }
    
    // 添加列
    await query(`
      ALTER TABLE users 
      ADD COLUMN upgrade_expires_at TIMESTAMP NULL COMMENT '升级密钥过期时间（用于恢复到默认子账号上限）',
      ADD INDEX idx_upgrade_expires (upgrade_expires_at)
    `);
    
    console.log('[迁移] upgrade_expires_at 列添加成功');
  } catch (error) {
    console.error('[迁移] 失败:', error.message);
    throw error;
  }
}

module.exports = { migrate };

// 如果直接运行此文件
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