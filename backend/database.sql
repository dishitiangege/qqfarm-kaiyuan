-- QQ农场助手数据库结构
-- 支持多用户权限管理

-- 创建数据库
CREATE DATABASE IF NOT EXISTS farmbot DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE farmbot;

-- 先创建用户表（不包含外键约束）
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '加密密码',
  email VARCHAR(100) COMMENT '邮箱',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色: admin-管理员, user-普通用户',
  status ENUM('active', 'frozen', 'deleted', 'pending') DEFAULT 'pending' COMMENT '状态: active-正常, frozen-冻结, deleted-已删除, pending-待审批',
  frozen_reason ENUM('admin', 'key_expired', 'key_deleted') DEFAULT NULL COMMENT '冻结原因: admin-管理员冻结, key_expired-密钥过期, key_deleted-密钥删除',
  bound_key_id INT DEFAULT NULL COMMENT '绑定的密钥ID',
  key_expires_at TIMESTAMP NULL COMMENT '密钥过期时间',
  max_accounts INT DEFAULT 1 COMMENT '最大子账号数量，默认1个',
  upgrade_expires_at TIMESTAMP NULL COMMENT '升级密钥过期时间（用于恢复到默认子账号上限）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
  -- 联合唯一索引：同一个非 deleted 状态的用户名不能重复，deleted 状态可以重复
  UNIQUE INDEX idx_username_status (username, (CASE WHEN status = 'deleted' THEN NULL ELSE status END)),
  INDEX idx_role (role),
  INDEX idx_status (status),
  INDEX idx_bound_key (bound_key_id),
  INDEX idx_upgrade_expires (upgrade_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 农场账号表
CREATE TABLE farm_accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '所属用户ID',
  account_id VARCHAR(50) UNIQUE NOT NULL COMMENT '账号唯一标识',
  name VARCHAR(100) DEFAULT '新账号' COMMENT '账号名称',
  platform VARCHAR(20) COMMENT '平台: qq/wechat',
  code TEXT COMMENT '登录凭证',
  level INT DEFAULT 1 COMMENT '等级',
  config JSON COMMENT '配置信息: autoFarm, autoFriend等',
  email VARCHAR(100) COMMENT '通知邮箱',
  farm_interval INT DEFAULT 10 COMMENT '农场巡查间隔(秒)',
  friend_interval INT DEFAULT 10 COMMENT '好友巡查间隔(秒)',
  status ENUM('active', 'stopped', 'error', 'offline') DEFAULT 'offline' COMMENT '运行状态',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否已删除',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='农场账号表';

-- 账号统计数据表
CREATE TABLE account_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id VARCHAR(50) NOT NULL COMMENT '账号ID',
  exp INT DEFAULT 0 COMMENT '经验值',
  coins INT DEFAULT 0 COMMENT '金币',
  online_time INT DEFAULT 0 COMMENT '在线时间(分钟)',
  today_stats JSON COMMENT '今日统计: 收获、偷取、浇水等',
  land_status JSON COMMENT '土地状态',
  friends JSON COMMENT '好友列表',
  bag JSON COMMENT '背包物品',
  tasks JSON COMMENT '任务列表',
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  FOREIGN KEY (account_id) REFERENCES farm_accounts(account_id) ON DELETE CASCADE,
  INDEX idx_account_id (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号统计数据表';

-- 注册密钥表
CREATE TABLE registration_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key_value VARCHAR(64) UNIQUE NOT NULL COMMENT '密钥值',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
  assigned_user_id INT DEFAULT NULL COMMENT '指定用户ID（可选，为NULL表示任意用户可用）',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已被使用',
  used_by_user_id INT DEFAULT NULL COMMENT '被哪个用户使用',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  created_by INT COMMENT '创建者（管理员）ID',
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_key_value (key_value),
  INDEX idx_expires_at (expires_at),
  INDEX idx_assigned_user (assigned_user_id),
  INDEX idx_is_used (is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='注册密钥表';

-- 添加用户表的外键约束（在registration_keys表创建后）
ALTER TABLE users
ADD CONSTRAINT fk_users_bound_key
FOREIGN KEY (bound_key_id) REFERENCES registration_keys(id) ON DELETE SET NULL;

-- 操作日志表
CREATE TABLE operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT COMMENT '操作用户ID',
  account_id VARCHAR(50) COMMENT '操作的账号ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  details JSON COMMENT '操作详情',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 每日统计数据表（用于累计多次登录的统计）
CREATE TABLE daily_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id VARCHAR(50) NOT NULL COMMENT '账号ID',
  stats_date DATE NOT NULL COMMENT '统计日期',
  total_online_time INT DEFAULT 0 COMMENT '累计在线时间(分钟)',
  total_exp_gained INT DEFAULT 0 COMMENT '累计获得经验',
  total_harvest INT DEFAULT 0 COMMENT '累计收获次数',
  total_steal INT DEFAULT 0 COMMENT '累计偷取次数',
  total_weed INT DEFAULT 0 COMMENT '累计除草次数',
  total_bug INT DEFAULT 0 COMMENT '累计除虫次数',
  total_water INT DEFAULT 0 COMMENT '累计浇水次数',
  total_sell_gold INT DEFAULT 0 COMMENT '累计出售金币',
  -- 以下字段用于检测会话变化（按天隔离）
  last_saved_online_time INT DEFAULT 0 COMMENT '上次保存时的在线时间(分钟)',
  last_saved_exp_gained INT DEFAULT 0 COMMENT '上次保存时的经验值',
  last_saved_date DATE DEFAULT NULL COMMENT '上次保存的日期',
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  FOREIGN KEY (account_id) REFERENCES farm_accounts(account_id) ON DELETE CASCADE,
  UNIQUE KEY uk_account_date (account_id, stats_date),
  INDEX idx_account_id (account_id),
  INDEX idx_stats_date (stats_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日统计数据表';

-- 公告表
CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL COMMENT '公告标题',
  content TEXT NOT NULL COMMENT '公告内容',
  interval_hours INT DEFAULT 24 COMMENT '显示间隔(小时)',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告表';

-- 用户公告阅读记录表
CREATE TABLE user_announcement_reads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  announcement_id INT NOT NULL COMMENT '公告ID',
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '阅读时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_announcement (user_id, announcement_id),
  INDEX idx_read_at (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户公告阅读记录表';

-- 插入默认管理员账号
-- 密码: admin123
INSERT INTO users (username, password, email, role, status) VALUES 
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@qqfarm.com', 'admin', 'active');

-- 创建视图: 用户账号列表
CREATE VIEW user_accounts_view AS
SELECT 
  u.id as user_id,
  u.username,
  u.role,
  u.status as user_status,
  fa.id as farm_account_db_id,
  fa.account_id,
  fa.name as account_name,
  fa.platform,
  fa.level,
  fa.status as account_status,
  fa.is_deleted,
  fa.created_at as account_created_at,
  fa.updated_at as account_updated_at,
  s.exp,
  s.coins,
  s.online_time,
  s.last_update as stats_updated_at
FROM users u
LEFT JOIN farm_accounts fa ON u.id = fa.user_id AND fa.is_deleted = FALSE
LEFT JOIN account_stats s ON fa.account_id = s.account_id
WHERE u.status != 'deleted';

-- ============================================
-- 密钥发放系统表
-- ============================================

-- 密钥发放活动表（管理员设置的发放活动）
CREATE TABLE key_distribution_campaigns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '活动名称',
  min_days INT NOT NULL COMMENT '最小天数',
  max_days INT NOT NULL COMMENT '最大天数',
  total_quota INT NOT NULL COMMENT '总名额',
  remaining_quota INT NOT NULL COMMENT '剩余名额',
  status ENUM('active', 'paused', 'ended') DEFAULT 'active' COMMENT '活动状态',
  start_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  end_at TIMESTAMP NULL COMMENT '结束时间',
  created_by INT NOT NULL COMMENT '创建者ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_start_at (start_at),
  INDEX idx_end_at (end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密钥发放活动表';

-- 已发放的密钥记录表
CREATE TABLE distributed_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id INT NOT NULL COMMENT '所属活动ID',
  key_value VARCHAR(64) UNIQUE NOT NULL COMMENT '密钥值',
  valid_days INT NOT NULL COMMENT '密钥有效天数',
  claimed_by_email VARCHAR(100) NULL COMMENT '领取邮箱（NULL表示未领取）',
  claimed_at TIMESTAMP NULL COMMENT '领取时间',
  expires_at TIMESTAMP NULL COMMENT '密钥过期时间',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已被使用',
  used_by_user_id INT DEFAULT NULL COMMENT '被哪个用户使用',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (campaign_id) REFERENCES key_distribution_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_key_value (key_value),
  INDEX idx_claimed_email (claimed_by_email),
  INDEX idx_is_used (is_used),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='已发放密钥记录表';

-- 邮箱领取记录表（用于防重复领取）
CREATE TABLE email_key_claims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) NOT NULL COMMENT '邮箱地址',
  claim_date DATE NOT NULL COMMENT '领取日期',
  key_id INT NOT NULL COMMENT '领取的密钥ID',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  FOREIGN KEY (key_id) REFERENCES distributed_keys(id) ON DELETE CASCADE,
  UNIQUE KEY uk_email_date (email, claim_date),
  INDEX idx_email (email),
  INDEX idx_claim_date (claim_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱领取记录表';

-- ============================================
-- 升级密钥系统表
-- ============================================

-- 升级密钥表（用于提升用户权限和延长有效期）
CREATE TABLE upgrade_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key_value VARCHAR(64) UNIQUE NOT NULL COMMENT '密钥值',
  key_type ENUM('level1', 'level2', 'custom') NOT NULL COMMENT '密钥等级: level1-一级密钥, level2-二级密钥, custom-自定义密钥',
  max_accounts INT NOT NULL COMMENT '升级后的子账号上限',
  extend_days INT NOT NULL COMMENT '延长的有效期天数',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已被使用',
  used_by_user_id INT DEFAULT NULL COMMENT '被哪个用户使用',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  created_by INT COMMENT '创建者（管理员）ID',
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_key_value (key_value),
  INDEX idx_key_type (key_type),
  INDEX idx_is_used (is_used),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='升级密钥表';

-- 用户升级记录表（记录用户使用升级密钥的历史）
CREATE TABLE user_upgrade_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  upgrade_key_id INT NOT NULL COMMENT '使用的升级密钥ID',
  key_type ENUM('level1', 'level2', 'custom') NOT NULL COMMENT '密钥等级: level1-一级密钥, level2-二级密钥, custom-自定义密钥',
  old_max_accounts INT NOT NULL COMMENT '升级前的子账号上限',
  new_max_accounts INT NOT NULL COMMENT '升级后的子账号上限',
  old_expires_at TIMESTAMP NULL COMMENT '升级前的过期时间',
  new_expires_at TIMESTAMP NOT NULL COMMENT '升级后的过期时间',
  extend_days INT NOT NULL COMMENT '延长的有效期天数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '升级时间',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (upgrade_key_id) REFERENCES upgrade_keys(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_upgrade_key_id (upgrade_key_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户升级记录表';

-- 邮箱验证码表
CREATE TABLE email_verification_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) NOT NULL COMMENT '邮箱地址',
  code VARCHAR(10) NOT NULL COMMENT '验证码',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_used (is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱验证码表';

-- 系统设置表
CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '设置键名',
  setting_value TEXT COMMENT '设置值',
  description VARCHAR(255) COMMENT '设置描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';

-- 插入默认系统设置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('registration_enabled', 'true', '是否开放用户注册'),
('registration_start_time', NULL, '注册开放开始时间（NULL表示不限制）'),
('registration_end_time', NULL, '注册开放结束时间（NULL表示不限制）'),
('anti_detection_global_enabled', 'true', '反检测系统全局总开关'),
('anti_detection_default_config', '{"enabled":false,"humanMode":{"intensity":"medium"},"protocol":{"enableTlog":true,"deviceProfile":"auto"}}', '新账号默认反检测配置');
