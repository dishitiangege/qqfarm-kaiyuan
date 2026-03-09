/**
 * 数据库连接模块
 * 使用 MySQL2 连接数据库
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'farmbot',
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 创建连接池
let pool = null;

async function initPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(dbConfig);
      console.log('[数据库] 连接池已创建');
    } catch (error) {
      console.error('[数据库] 创建连接池失败:', error);
      throw error;
    }
  }
  return pool;
}

// 获取连接
async function getConnection() {
  await initPool();
  return pool.getConnection();
}

// 执行查询
async function query(sql, params) {
  await initPool();
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('[数据库] 查询失败:', error);
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 初始化数据库
async function initDatabase() {
  try {
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'database.sql');
    if (!fs.existsSync(sqlPath)) {
      console.log('[数据库] SQL文件不存在，跳过初始化');
      return;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 先创建数据库（不使用数据库）
    const tempPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 5
    });

    // 创建数据库
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('[数据库] 数据库已创建或已存在');
    await tempPool.end();

    // 初始化连接池
    await initPool();

    // 执行建表语句
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim() && !statement.includes('CREATE DATABASE') && !statement.includes('USE ')) {
        try {
          await pool.execute(statement);
        } catch (error) {
          // 忽略已存在的错误
          if (!error.message.includes('Duplicate') && !error.message.includes('already exists')) {
            console.error('[数据库] 执行SQL失败:', error.message);
          }
        }
      }
    }

    console.log('[数据库] 表结构初始化完成');

    // 检查并添加 last_activity 字段到 users 表
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_activity'
      `, [dbConfig.database]);

      if (columns.length === 0) {
        await pool.execute(`
          ALTER TABLE users ADD COLUMN last_activity TIMESTAMP NULL COMMENT '最后活动时间' AFTER last_login_at
        `);
        console.log('[数据库] 已添加 last_activity 字段到 users 表');
      }
    } catch (error) {
      console.error('[数据库] 添加 last_activity 字段失败:', error.message);
    }

    // 检查并更新 users 表的 status 字段 ENUM 值
    try {
      const [statusColumn] = await pool.execute(`
        SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
      `, [dbConfig.database]);

      if (statusColumn.length > 0) {
        const currentType = statusColumn[0].COLUMN_TYPE;
        if (!currentType.includes('pending')) {
          await pool.execute(`
            ALTER TABLE users MODIFY COLUMN status ENUM('active', 'frozen', 'deleted', 'pending') DEFAULT 'pending' COMMENT '状态: active-正常, frozen-冻结, deleted-已删除, pending-待审批'
          `);
          console.log('[数据库] 已更新 users 表的 status 字段，添加 pending 值');
        }
      }
    } catch (error) {
      console.error('[数据库] 更新 status 字段失败:', error.message);
    }

    // 检查并修复 users 表的 username 唯一约束
    try {
      // 检查是否存在 username 的唯一索引
      const [uniqueIndexes] = await pool.execute(`
        SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE 
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'
      `, [dbConfig.database]);

      // 检查是否有单独的 username 唯一约束（不是联合索引）
      const usernameUniqueIndex = uniqueIndexes.find(idx => 
        idx.INDEX_NAME !== 'PRIMARY' && 
        idx.NON_UNIQUE === 0 &&
        !idx.INDEX_NAME.includes('status')
      );

      if (usernameUniqueIndex) {
        console.log('[数据库] 发现 username 唯一约束，需要修改为联合唯一约束');
        
        // 删除旧的唯一索引
        try {
          await pool.execute(`ALTER TABLE users DROP INDEX ${usernameUniqueIndex.INDEX_NAME}`);
          console.log('[数据库] 已删除旧的 username 唯一索引');
        } catch (dropError) {
          console.log('[数据库] 删除旧索引失败（可能不存在）:', dropError.message);
        }

        // 添加新的联合唯一索引 (username, status)，但只针对非 deleted 状态
        // 使用 MySQL 8.0.13+ 的功能：函数式唯一索引
        try {
          await pool.execute(`
            ALTER TABLE users 
            ADD UNIQUE INDEX idx_username_status (username, (CASE WHEN status = 'deleted' THEN NULL ELSE status END))
          `);
          console.log('[数据库] 已添加 username + status 联合唯一索引');
        } catch (indexError) {
          // 如果数据库不支持函数式索引，使用备选方案：只添加普通联合索引，不强制唯一
          console.log('[数据库] 函数式索引不支持，使用备选方案');
          try {
            await pool.execute(`
              ALTER TABLE users 
              ADD INDEX idx_username_status (username, status)
            `);
            console.log('[数据库] 已添加 username + status 普通联合索引');
          } catch (indexError2) {
            console.error('[数据库] 添加联合索引失败:', indexError2.message);
          }
        }
      }
    } catch (error) {
      console.error('[数据库] 修复 username 唯一约束失败:', error.message);
    }

    // 检查并修复 distributed_keys 表结构
    try {
      // 获取当前表的所有字段
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'distributed_keys'
      `, [dbConfig.database]);

      const existingColumns = columns.map(c => c.COLUMN_NAME);

      // 检查并删除错误的字段
      const wrongColumns = ['days', 'email', 'ip_address', 'user_id'];
      for (const wrongCol of wrongColumns) {
        if (existingColumns.includes(wrongCol)) {
          try {
            await pool.execute(`ALTER TABLE distributed_keys DROP COLUMN ${wrongCol}`);
            console.log(`[数据库] 已删除错误的 ${wrongCol} 字段`);
          } catch (dropError) {
            console.error(`[数据库] 删除 ${wrongCol} 字段失败:`, dropError.message);
          }
        }
      }

      // 定义需要的字段
      const requiredColumns = [
        { name: 'campaign_id', type: 'INT NOT NULL COMMENT "所属活动ID"', after: 'id' },
        { name: 'key_value', type: 'VARCHAR(64) UNIQUE NOT NULL COMMENT "密钥值"', after: 'campaign_id' },
        { name: 'valid_days', type: 'INT NOT NULL DEFAULT 7 COMMENT "密钥有效天数"', after: 'key_value' },
        { name: 'claimed_by_email', type: 'VARCHAR(100) NULL COMMENT "领取邮箱"', after: 'valid_days' },
        { name: 'claimed_at', type: 'TIMESTAMP NULL COMMENT "领取时间"', after: 'claimed_by_email' },
        { name: 'expires_at', type: 'TIMESTAMP NULL COMMENT "密钥过期时间"', after: 'claimed_at' },
        { name: 'is_used', type: 'BOOLEAN DEFAULT FALSE COMMENT "是否已被使用"', after: 'expires_at' },
        { name: 'used_by_user_id', type: 'INT DEFAULT NULL COMMENT "被哪个用户使用"', after: 'is_used' },
        { name: 'used_at', type: 'TIMESTAMP NULL COMMENT "使用时间"', after: 'used_by_user_id' }
      ];

      for (const col of requiredColumns) {
        if (!existingColumns.includes(col.name)) {
          try {
            await pool.execute(`
              ALTER TABLE distributed_keys ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}
            `);
            console.log(`[数据库] 已添加 ${col.name} 字段到 distributed_keys 表`);
          } catch (colError) {
            console.error(`[数据库] 添加 ${col.name} 字段失败:`, colError.message);
          }
        }
      }
    } catch (error) {
      console.error('[数据库] 检查/添加 distributed_keys 字段失败:', error.message);
    }

    // 检查并添加 registration_keys 表缺失的字段
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'registration_keys'
      `, [dbConfig.database]);

      const existingColumns = columns.map(c => c.COLUMN_NAME);

      // 检查并添加缺失的字段
      const regKeyColumns = [
        { name: 'key_value', type: 'VARCHAR(64) UNIQUE NOT NULL COMMENT "密钥值"' },
        { name: 'expires_at', type: 'TIMESTAMP NOT NULL COMMENT "过期时间"' },
        { name: 'assigned_user_id', type: 'INT DEFAULT NULL COMMENT "指定用户ID"' },
        { name: 'is_used', type: 'BOOLEAN DEFAULT FALSE COMMENT "是否已被使用"' },
        { name: 'used_by_user_id', type: 'INT DEFAULT NULL COMMENT "被哪个用户使用"' },
        { name: 'used_at', type: 'TIMESTAMP NULL COMMENT "使用时间"' },
        { name: 'created_by', type: 'INT COMMENT "创建者（管理员）ID"' }
      ];

      for (const col of regKeyColumns) {
        if (!existingColumns.includes(col.name)) {
          try {
            await pool.execute(`
              ALTER TABLE registration_keys ADD COLUMN ${col.name} ${col.type}
            `);
            console.log(`[数据库] 已添加 ${col.name} 字段到 registration_keys 表`);
          } catch (colError) {
            console.error(`[数据库] 添加 ${col.name} 字段失败:`, colError.message);
          }
        }
      }
    } catch (error) {
      console.error('[数据库] 检查/添加 registration_keys 字段失败:', error.message);
    }

    // 检查并添加 key_distribution_campaigns 表缺失的字段
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'key_distribution_campaigns'
      `, [dbConfig.database]);

      const existingColumns = columns.map(c => c.COLUMN_NAME);

      const campaignColumns = [
        { name: 'name', type: 'VARCHAR(100) NOT NULL COMMENT "活动名称"' },
        { name: 'min_days', type: 'INT NOT NULL COMMENT "最小天数"' },
        { name: 'max_days', type: 'INT NOT NULL COMMENT "最大天数"' },
        { name: 'total_quota', type: 'INT NOT NULL COMMENT "总名额"' },
        { name: 'remaining_quota', type: 'INT NOT NULL COMMENT "剩余名额"' },
        { name: 'status', type: "ENUM('active', 'paused', 'ended') DEFAULT 'active' COMMENT '活动状态'" },
        { name: 'end_at', type: 'TIMESTAMP NULL COMMENT "结束时间"' },
        { name: 'created_by', type: 'INT NOT NULL COMMENT "创建者ID"' }
      ];

      for (const col of campaignColumns) {
        if (!existingColumns.includes(col.name)) {
          try {
            await pool.execute(`
              ALTER TABLE key_distribution_campaigns ADD COLUMN ${col.name} ${col.type}
            `);
            console.log(`[数据库] 已添加 ${col.name} 字段到 key_distribution_campaigns 表`);
          } catch (colError) {
            console.error(`[数据库] 添加 ${col.name} 字段失败:`, colError.message);
          }
        }
      }
    } catch (error) {
      console.error('[数据库] 检查/添加 key_distribution_campaigns 字段失败:', error.message);
    }

    // 检查并添加 email_key_claims 表缺失的字段
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'email_key_claims'
      `, [dbConfig.database]);

      const existingColumns = columns.map(c => c.COLUMN_NAME);

      // 检查并添加 campaign_id 字段
      if (!existingColumns.includes('campaign_id')) {
        try {
          await pool.execute(`
            ALTER TABLE email_key_claims ADD COLUMN campaign_id INT COMMENT '所属活动ID'
          `);
          console.log('[数据库] 已添加 campaign_id 字段到 email_key_claims 表');
        } catch (colError) {
          console.error('[数据库] 添加 campaign_id 字段失败:', colError.message);
        }
      }
    } catch (error) {
      console.error('[数据库] 检查/添加 email_key_claims 字段失败:', error.message);
    }

    // 检查并创建 system_settings 表
    try {
      const [tables] = await pool.execute(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'system_settings'
      `, [dbConfig.database]);

      if (tables.length === 0) {
        await pool.execute(`
          CREATE TABLE system_settings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '设置键名',
            setting_value TEXT COMMENT '设置值',
            description VARCHAR(255) COMMENT '设置描述',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            INDEX idx_setting_key (setting_key)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表'
        `);
        console.log('[数据库] 已创建 system_settings 表');

        // 插入默认设置
        await pool.execute(`
          INSERT INTO system_settings (setting_key, setting_value, description) VALUES
          ('registration_enabled', 'true', '是否开放用户注册'),
          ('registration_start_time', NULL, '注册开放开始时间'),
          ('registration_end_time', NULL, '注册开放结束时间')
        `);
        console.log('[数据库] 已插入默认系统设置');
      }

      // 补充反检测相关默认设置（表已存在时也确保有默认键）
      await pool.execute(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
        ('anti_detection_global_enabled', 'true', '反检测系统全局总开关'),
        ('anti_detection_default_config', '{"enabled":false,"humanMode":{"intensity":"medium"},"protocol":{"enableTlog":true,"deviceProfile":"auto"}}', '新账号默认反检测配置')
      `);
    } catch (error) {
      console.error('[数据库] 检查/创建 system_settings 表失败:', error.message);
    }

  } catch (error) {
    console.error('[数据库] 初始化失败:', error);
    throw error;
  }
}

// 关闭连接池
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[数据库] 连接池已关闭');
  }
}

module.exports = {
  initPool,
  getConnection,
  query,
  transaction,
  initDatabase,
  closePool
};
