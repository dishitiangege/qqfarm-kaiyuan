const { query } = require('./db');

class SystemSettingsService {
  getDefaultAntiDetectionConfig() {
    return {
      enabled: false,
      humanMode: { intensity: 'medium' },
      protocol: { enableTlog: true, deviceProfile: 'auto' }
    };
  }

  normalizeAntiDetectionConfig(rawConfig) {
    const defaults = this.getDefaultAntiDetectionConfig();
    const input = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const humanMode = input.humanMode && typeof input.humanMode === 'object' ? input.humanMode : {};
    const protocol = input.protocol && typeof input.protocol === 'object' ? input.protocol : {};
    const intensity = ['low', 'medium', 'high'].includes(humanMode.intensity) ? humanMode.intensity : 'medium';

    return {
      enabled: input.enabled === true,
      humanMode: { intensity },
      protocol: {
        enableTlog: protocol.enableTlog !== false,
        deviceProfile: typeof protocol.deviceProfile === 'string' && protocol.deviceProfile.trim()
          ? protocol.deviceProfile.trim()
          : 'auto'
      }
    };
  }

  async getSetting(key) {
    const results = await query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    );
    return results.length > 0 ? results[0].setting_value : null;
  }

  async setSetting(key, value) {
    await query(
      'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
      [key, value, '', value]
    );
    return true;
  }

  async isRegistrationOpen() {
    const enabled = await this.getSetting('registration_enabled');
    if (enabled !== 'true') {
      return { open: false, reason: '注册功能已关闭' };
    }

    const startTime = await this.getSetting('registration_start_time');
    const endTime = await this.getSetting('registration_end_time');

    if (startTime || endTime) {
      const now = new Date();
      
      if (startTime) {
        const start = new Date(startTime);
        if (now < start) {
          return { 
            open: false, 
            reason: `注册将在 ${start.toLocaleString('zh-CN')} 开放` 
          };
        }
      }

      if (endTime) {
        const end = new Date(endTime);
        if (now > end) {
          return { 
            open: false, 
            reason: `注册已于 ${end.toLocaleString('zh-CN')} 关闭` 
          };
        }
      }
    }

    return { open: true };
  }

  async getRegistrationSettings() {
    const enabled = await this.getSetting('registration_enabled');
    const startTime = await this.getSetting('registration_start_time');
    const endTime = await this.getSetting('registration_end_time');

    return {
      enabled: enabled === 'true',
      startTime: startTime || null,
      endTime: endTime || null
    };
  }

  async updateRegistrationSettings(settings) {
    const { enabled, startTime, endTime } = settings;

    if (enabled !== undefined) {
      await this.setSetting('registration_enabled', enabled ? 'true' : 'false');
    }

    if (startTime !== undefined) {
      await this.setSetting('registration_start_time', startTime || null);
    }

    if (endTime !== undefined) {
      await this.setSetting('registration_end_time', endTime || null);
    }

    return this.getRegistrationSettings();
  }

  // 邮箱黑名单相关方法
  async getEmailBlacklist() {
    const result = await this.getSetting('email_blacklist');
    if (!result) return [];
    try {
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  async addEmailToBlacklist(email, reason = '') {
    const blacklist = await this.getEmailBlacklist();
    // 检查是否已存在
    if (blacklist.some(item => item.email === email)) {
      throw new Error('该邮箱已在黑名单中');
    }
    blacklist.push({
      email,
      reason,
      addedAt: new Date().toISOString()
    });
    await this.setSetting('email_blacklist', JSON.stringify(blacklist));
    return blacklist;
  }

  async removeEmailFromBlacklist(email) {
    let blacklist = await this.getEmailBlacklist();
    blacklist = blacklist.filter(item => item.email !== email);
    await this.setSetting('email_blacklist', JSON.stringify(blacklist));
    return blacklist;
  }

  async isEmailBlacklisted(email) {
    const blacklist = await this.getEmailBlacklist();
    return blacklist.some(item => item.email === email);
  }

  async updateEmailBlacklist(blacklist) {
    await this.setSetting('email_blacklist', JSON.stringify(blacklist));
    return blacklist;
  }

  async getAntiDetectionSettings() {
    const globalEnabled = await this.getSetting('anti_detection_global_enabled');
    const defaultConfigStr = await this.getSetting('anti_detection_default_config');

    let defaultConfig = this.getDefaultAntiDetectionConfig();
    if (defaultConfigStr) {
      try {
        defaultConfig = this.normalizeAntiDetectionConfig(JSON.parse(defaultConfigStr));
      } catch (_) {}
    }

    return {
      globalEnabled: globalEnabled !== 'false',
      defaultConfig
    };
  }

  async updateAntiDetectionSettings(settings) {
    const normalized = {
      globalEnabled: settings?.globalEnabled !== false,
      defaultConfig: this.normalizeAntiDetectionConfig(settings?.defaultConfig || {})
    };

    await this.setSetting('anti_detection_global_enabled', normalized.globalEnabled ? 'true' : 'false');
    await this.setSetting('anti_detection_default_config', JSON.stringify(normalized.defaultConfig));
    return normalized;
  }
}

module.exports = new SystemSettingsService();
