const DEFAULT_ANTI_DETECTION_CONFIG = {
  enabled: false,
  humanMode: { intensity: 'medium' },
  protocol: { enableTlog: true, deviceProfile: 'auto' },
};

const HUMAN_MODE_PARAMS = {
  low: {
    opJitter: 0.2,
    taskDelayRangeMs: [100, 300],
    restIntervalMinutes: [30, 60],
    restDurationSeconds: [30, 60],
  },
  medium: {
    opJitter: 0.35,
    taskDelayRangeMs: [200, 500],
    restIntervalMinutes: [15, 40],
    restDurationSeconds: [60, 180],
  },
  high: {
    opJitter: 0.5,
    taskDelayRangeMs: [300, 800],
    restIntervalMinutes: [8, 20],
    restDurationSeconds: [120, 300],
  },
};

let globalAntiDetectionEnabled = true;

const DEVICE_TEMPLATES = {
  iphone15: {
    client_version: '1.6.0.14_20251224',
    sys_software: 'iOS 18.2.1',
    sys_hardware: 'iPhone16,2',
    telecom_oper: '中国移动',
    network: 'wifi',
    screen_width: 1179,
    screen_height: 2556,
    density: 3,
    cpu: 'Apple A17 Pro',
    memory: 8192,
    gl_render: 'Apple GPU',
    gl_version: 'OpenGL ES 3.0 Metal',
    device_id: '',
    android_oaid: '',
    ios_caid: '',
  },
  iphone14: {
    client_version: '1.6.0.14_20251224',
    sys_software: 'iOS 17.7.2',
    sys_hardware: 'iPhone15,3',
    telecom_oper: '中国联通',
    network: 'wifi',
    screen_width: 1170,
    screen_height: 2532,
    density: 3,
    cpu: 'Apple A16 Bionic',
    memory: 6144,
    gl_render: 'Apple GPU',
    gl_version: 'OpenGL ES 3.0 Metal',
    device_id: '',
    android_oaid: '',
    ios_caid: '',
  },
  android_highend: {
    client_version: '1.6.0.14_20251224',
    sys_software: 'Android 14',
    sys_hardware: 'SM-S9280',
    telecom_oper: '中国电信',
    network: 'wifi',
    screen_width: 1440,
    screen_height: 3120,
    density: 3.5,
    cpu: 'Snapdragon 8 Gen 3',
    memory: 12288,
    gl_render: 'Adreno (TM) 750',
    gl_version: 'OpenGL ES 3.2 V@0615.0',
    device_id: '',
    android_oaid: '',
    ios_caid: '',
  },
  android_midrange: {
    client_version: '1.6.0.14_20251224',
    sys_software: 'Android 13',
    sys_hardware: 'M2012K11AC',
    telecom_oper: '中国移动',
    network: 'wifi',
    screen_width: 1080,
    screen_height: 2400,
    density: 2.75,
    cpu: 'Snapdragon 870',
    memory: 8192,
    gl_render: 'Adreno (TM) 650',
    gl_version: 'OpenGL ES 3.2 V@0502.0',
    device_id: '',
    android_oaid: '',
    ios_caid: '',
  },
};

function asObject(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_ANTI_DETECTION_CONFIG));
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase().trim();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return defaultValue;
}

function normalizeIntensity(value) {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function toNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function randomBetween(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms, timers) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      resolve();
    }, Math.max(0, ms));
    timers.add(timer);
  });
}

function hashString(value) {
  const text = String(value ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function setGlobalAntiDetectionEnabled(enabled) {
  globalAntiDetectionEnabled = toBoolean(enabled, true);
}

function isGlobalAntiDetectionEnabled() {
  return globalAntiDetectionEnabled;
}

function getAntiDetectionConfig(rawConfig) {
  const normalized = cloneDefaultConfig();
  const accountConfig = asObject(rawConfig);
  const anti = asObject(accountConfig.antiDetection);
  const humanMode = asObject(anti.humanMode);
  const protocol = asObject(anti.protocol);

  normalized.enabled = toBoolean(anti.enabled, normalized.enabled);
  normalized.humanMode.intensity = normalizeIntensity(humanMode.intensity);
  normalized.protocol.enableTlog = toBoolean(protocol.enableTlog, normalized.protocol.enableTlog);
  normalized.protocol.deviceProfile = typeof protocol.deviceProfile === 'string' && protocol.deviceProfile.trim()
    ? protocol.deviceProfile.trim()
    : normalized.protocol.deviceProfile;

  if (!isGlobalAntiDetectionEnabled()) {
    normalized.enabled = false;
  }

  return normalized;
}

function isAntiDetectionEnabled(rawConfig) {
  const config = getAntiDetectionConfig(rawConfig);
  return config.enabled === true;
}

function createHumanDispatcher(accountId, antiConfig, options = {}) {
  const logger = typeof options.logger === 'function' ? options.logger : null;
  const intensity = normalizeIntensity(antiConfig?.humanMode?.intensity);
  const params = HUMAN_MODE_PARAMS[intensity] || HUMAN_MODE_PARAMS.medium;
  const queue = [];
  const timers = new Set();
  let stopped = false;
  let processing = false;
  let nextRestAt = Date.now() + randomBetween(
    params.restIntervalMinutes[0] * 60 * 1000,
    params.restIntervalMinutes[1] * 60 * 1000
  );
  let isConnected = true; // 连接状态跟踪

  const log = (message) => {
    if (!logger) return;
    try {
      logger(`[反检测] [${accountId}] ${message}`);
    } catch (_) {}
  };

  const applyJitter = (baseMs) => {
    const base = toNumber(baseMs, 0);
    const jitter = base * params.opJitter;
    const min = Math.max(0, Math.round(base - jitter));
    const max = Math.max(min, Math.round(base + jitter));
    return randomBetween(min, max);
  };

  async function maybeRest() {
    if (Date.now() < nextRestAt) return;
    const restMs = randomBetween(
      params.restDurationSeconds[0] * 1000,
      params.restDurationSeconds[1] * 1000
    );
    log(`进入休息 ${Math.round(restMs / 1000)}s`);
    await sleep(restMs, timers);
    nextRestAt = Date.now() + randomBetween(
      params.restIntervalMinutes[0] * 60 * 1000,
      params.restIntervalMinutes[1] * 60 * 1000
    );
    log('休息结束');
  }

  async function processQueue() {
    if (processing || stopped) return;
    processing = true;
    try {
      while (!stopped && queue.length > 0) {
        // 检查连接状态，如果断开则暂停处理
        if (!isConnected) {
          log('连接已断开，暂停任务处理，等待重连...');
          await sleep(5000, timers);
          continue;
        }

        await maybeRest();
        if (stopped) break;

        const task = queue.shift();
        if (!task) break;

        try {
          const result = await task.fn();
          task.resolve(result);
        } catch (error) {
          // 检查是否是连接相关错误
          if (error.message && (
            error.message.includes('连接未打开') ||
            error.message.includes('连接已断开') ||
            error.message.includes('超时')
          )) {
            log(`任务执行遇到连接问题: ${error.message}`);
          }
          task.reject(error);
        }

        if (queue.length > 0) {
          const delay = randomBetween(params.taskDelayRangeMs[0], params.taskDelayRangeMs[1]);
          await sleep(delay, timers);
        }
      }
    } finally {
      processing = false;
    }
  }

  const enqueueTask = (taskType, fn, opts = {}, addToFront = false) => {
    if (typeof fn !== 'function') {
      return Promise.reject(new Error(`dispatcher task ${taskType || 'unknown'} is not a function`));
    }
    if (stopped) {
      return Promise.reject(new Error('dispatcher stopped'));
    }

    return new Promise((resolve, reject) => {
      const task = { taskType, fn, opts, resolve, reject };
      if (addToFront) {
        queue.unshift(task);
      } else {
        queue.push(task);
      }
      processQueue();
    });
  };

  return {
    enqueue(taskType, fn, opts = {}) {
      return enqueueTask(taskType, fn, opts, false);
    },
    runImmediately(taskType, fn, opts = {}) {
      return enqueueTask(taskType, fn, opts, true);
    },
    applyJitter,
    setConnected(connected) {
      const newState = !!connected;
      if (isConnected !== newState) {
        isConnected = newState;
        log(`连接状态变更: ${isConnected ? '已连接' : '已断开'}`);
      }
    },
    isConnected() {
      return isConnected;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      while (queue.length > 0) {
        const task = queue.shift();
        task?.reject(new Error('dispatcher stopped'));
      }
    },
  };
}

function buildDeviceInfo(accountId, antiConfig) {
  const profile = antiConfig?.protocol?.deviceProfile || 'auto';
  const keys = Object.keys(DEVICE_TEMPLATES);
  const selectedKey = (profile && profile !== 'auto' && DEVICE_TEMPLATES[profile])
    ? profile
    : keys[hashString(accountId) % keys.length];
  const template = DEVICE_TEMPLATES[selectedKey] || DEVICE_TEMPLATES.iphone14;
  const hash = hashString(`${accountId}:${selectedKey}`);

  return {
    ...template,
    device_id: `${selectedKey}-${accountId}-${hash}`.slice(0, 64),
    android_oaid: selectedKey.startsWith('android') ? `oaid-${hash}` : '',
    ios_caid: selectedKey.startsWith('iphone') ? `caid-${hash}` : '',
  };
}

function createNoopTlogSession() {
  return {
    pushEvent() {},
    sendStartupSequence() {},
    stop() {},
  };
}

function initTlogSession(accountId, antiConfig, sendTlogFn) {
  const enabled = antiConfig?.enabled === true && antiConfig?.protocol?.enableTlog !== false;
  if (!enabled || typeof sendTlogFn !== 'function') {
    return createNoopTlogSession();
  }

  const timers = new Set();
  const buffer = [];
  let stopped = false;

  const flush = async (force = false) => {
    if ((!force && stopped) || buffer.length === 0) return;
    const events = buffer.splice(0, buffer.length);
    try {
      await sendTlogFn(events);
    } catch (_) {
      // 上报失败时不抛出到业务线程，避免影响主流程
    }
  };

  const interval = setInterval(() => {
    flush();
  }, 10_000);
  timers.add(interval);

  return {
    pushEvent(eventType, payload = {}) {
      if (stopped || !eventType) return;
      buffer.push({
        accountId,
        eventType,
        payload,
        ts: Date.now(),
      });
    },
    sendStartupSequence() {
      this.pushEvent('LOADING_START');
      this.pushEvent('PRELOAD_COMPLETE');
      this.pushEvent('LOADING_END');
      this.pushEvent('GAME_LOGIN');
      flush();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      for (const timer of timers) {
        clearInterval(timer);
      }
      timers.clear();
      flush(true);
    },
  };
}

module.exports = {
  DEFAULT_ANTI_DETECTION_CONFIG,
  HUMAN_MODE_PARAMS,
  setGlobalAntiDetectionEnabled,
  isGlobalAntiDetectionEnabled,
  getAntiDetectionConfig,
  isAntiDetectionEnabled,
  createHumanDispatcher,
  buildDeviceInfo,
  initTlogSession,
};
