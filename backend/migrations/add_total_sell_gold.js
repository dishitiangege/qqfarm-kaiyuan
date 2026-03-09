/**
 * 迁移脚本：添加 total_sell_gold 字段到 daily_stats 表
 */

const { query } = require('../db');

async function migrate() {
  try {
    // 检查字段是否已存在
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'daily_stats' AND COLUMN_NAME = 'total_sell_gold'
    `);

    if (columns && columns.length > 0) {
      console.log('[迁移] total_sell_gold 字段已存在，跳过');
      return;
    }

    // 添加字段
    await query(`
      ALTER TABLE daily_stats 
      ADD COLUMN total_sell_gold INT DEFAULT 0 COMMENT '累计出售金币' AFTER total_water
    `);

    console.log('[迁移] total_sell_gold 字段添加成功');
  } catch (error) {
    console.error('[迁移] 失败:', error.message);
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
