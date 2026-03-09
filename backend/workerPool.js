/**
 * Worker 线程池管理器
 * 用于管理多个账号的 Worker 线程，共享内存空间
 */

const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPool {
  constructor() {
    // 根据 CPU 核心数设置并发 Worker 数量
    // 支持同时运行80个脚本，通过环境变量可配置
    this.maxConcurrentWorkers = 120;
    this.workers = new Map(); // accountId -> Worker
    this.workerQueue = []; // 等待启动的账号队列
    this.isProcessingQueue = false;
    
    // Worker 状态跟踪
    this.workerStates = new Map(); // accountId -> { status, lastActivity }
    
    // 消息处理器（从 Worker 接收消息）
    this.messageHandlers = new Map();
  }

  /**
   * 启动账号（加入队列或立即启动）
   */
  async startAccount(accountId, accountData) {
    // 如果已经在运行，先停止
    if (this.workers.has(accountId)) {
      await this.stopAccount(accountId);
    }

    // 加入队列
    this.workerQueue.push({ accountId, accountData });

    // 处理队列
    await this.processQueue();

    return { queued: true, position: this.workerQueue.length };
  }

  /**
   * 处理启动队列
   */
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.workerQueue.length > 0) {
        // 检查当前运行的 Worker 数量
        const runningCount = Array.from(this.workers.values()).filter(
          w => this.workerStates.get(w.accountId)?.status === 'running'
        ).length;

        if (runningCount >= this.maxConcurrentWorkers) {
          // 等待有 Worker 结束
          await this.waitForAvailableSlot();
          continue;
        }

        const { accountId, accountData } = this.workerQueue.shift();
        try {
          await this.createWorker(accountId, accountData);
        } catch (error) {
          console.error(`[WorkerPool] 创建 Worker ${accountId} 失败:`, error.message);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 等待有空闲槽位
   */
  waitForAvailableSlot() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const runningCount = Array.from(this.workers.values()).filter(
          w => this.workerStates.get(w.accountId)?.status === 'running'
        ).length;
        
        if (runningCount < this.maxConcurrentWorkers) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * 创建 Worker 线程
   */
  async createWorker(accountId, accountData) {
    // 检查是否已存在该账号的 Worker
    if (this.workers.has(accountId)) {
      console.log(`[WorkerPool] 账号 ${accountId} 的 Worker 已存在，跳过创建`);
      return;
    }
    
    const workerScript = path.join(__dirname, 'farmWorker.js');
    
    console.log(`[WorkerPool] 创建 Worker: ${accountId}`);
    
    try {
      const worker = new Worker(workerScript, {
        workerData: {
          accountId,
          accountData
        }
      });

      worker.accountId = accountId;
      worker.lastHeartbeat = Date.now();
      worker.restartCount = 0;
      worker.maxRestarts = 3;
      
      // 设置消息处理
      worker.on('message', (msg) => {
        // 更新心跳时间
        if (msg.type === 'data' || msg.type === 'log') {
          worker.lastHeartbeat = Date.now();
        }
        // 调试日志：显示收到的消息类型
        if (msg.type === 'harvestResult' || msg.type === 'plantResult') {
          console.log(`[WorkerPool ${accountId}] 收到消息: type=${msg.type}, success=${msg.success}`);
        }
        // 调用 handleWorkerMessage（会被 accountManagerWorker 覆盖）
        if (this.handleWorkerMessage) {
          this.handleWorkerMessage(accountId, msg);
        }
      });

      worker.on('error', (err) => {
        console.error(`[Worker ${accountId}] 错误:`, err.message);
        this.handleWorkerError(accountId, err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[Worker ${accountId}] 异常退出，代码:`, code);
        }
        this.handleWorkerExit(accountId, code);
      });

      // 启动健康检查
      this.startHealthCheck(accountId);

      this.workers.set(accountId, worker);
      this.workerStates.set(accountId, { 
        status: 'running', 
        startTime: Date.now(),
        restartCount: 0
      });

      console.log(`[WorkerPool] 账号 ${accountId} 已启动，当前运行: ${this.workers.size}`);
      
      return worker;
    } catch (error) {
      console.error(`[WorkerPool] 创建 Worker 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 启动健康检查
   */
  startHealthCheck(accountId) {
    const checkInterval = 30000; // 30秒检查一次
    
    const checkHealth = () => {
      const worker = this.workers.get(accountId);
      if (!worker) return;

      const now = Date.now();
      const lastHeartbeat = worker.lastHeartbeat || now;
      const timeSinceLastHeartbeat = now - lastHeartbeat;

      // 如果超过2分钟没有心跳，认为 Worker 卡死
      if (timeSinceLastHeartbeat > 120000) {
        console.error(`[WorkerPool] 账号 ${accountId} 心跳超时，准备重启`);
        this.restartWorker(accountId);
        return;
      }

      // 继续检查
      setTimeout(checkHealth, checkInterval);
    };

    setTimeout(checkHealth, checkInterval);
  }

  /**
   * 处理 Worker 错误
   */
  handleWorkerError(accountId, error) {
    const state = this.workerStates.get(accountId);
    if (state) {
      state.status = 'error';
      state.lastError = error.message;
    }
  }

  /**
   * 处理 Worker 退出
   */
  async handleWorkerExit(accountId, code) {
    const state = this.workerStates.get(accountId);
    
    // 立即从 workers Map 中移除，确保状态准确
    this.workers.delete(accountId);
    
    // 如果不是正常退出且重启次数未超限，尝试重启
    if (code !== 0 && state && state.restartCount < 3) {
      console.log(`[WorkerPool] 账号 ${accountId} 将在5秒后重启 (${state.restartCount + 1}/3)`);
      
      setTimeout(async () => {
        const accountData = this.getAccountData(accountId);
        if (accountData) {
          state.restartCount++;
          await this.createWorker(accountId, accountData);
        }
      }, 5000);
    } else {
      this.cleanupWorker(accountId);
      this.processQueue();
    }
  }

  /**
   * 重启 Worker
   */
  async restartWorker(accountId) {
    const worker = this.workers.get(accountId);
    if (!worker) return;

    try {
      await worker.terminate();
    } catch (e) {}

    this.cleanupWorker(accountId);

    // 重新创建
    const accountData = this.getAccountData(accountId);
    if (accountData) {
      const state = this.workerStates.get(accountId);
      if (state) {
        state.restartCount = (state.restartCount || 0) + 1;
      }
      await this.createWorker(accountId, accountData);
    }
  }

  /**
   * 设置账号数据获取回调
   */
  setAccountDataProvider(provider) {
    this.accountDataProvider = provider;
  }

  /**
   * 获取账号数据（用于重启）
   */
  getAccountData(accountId) {
    if (this.accountDataProvider) {
      return this.accountDataProvider(accountId);
    }
    return null;
  }

  /**
   * 处理 Worker 消息
   */
  handleWorkerMessage(accountId, msg) {
    const handler = this.messageHandlers.get(accountId);
    if (handler) {
      handler(msg);
    }
  }

  /**
   * 设置消息处理器
   */
  setMessageHandler(accountId, handler) {
    this.messageHandlers.set(accountId, handler);
  }

  /**
   * 移除消息处理器
   */
  removeMessageHandler(accountId) {
    this.messageHandlers.delete(accountId);
  }

  /**
   * 发送消息到 Worker
   */
  sendMessage(accountId, msg) {
    const worker = this.workers.get(accountId);
    if (worker) {
      worker.postMessage(msg);
      return true;
    }
    return false;
  }

  /**
   * 停止账号
   */
  async stopAccount(accountId) {
    const worker = this.workers.get(accountId);
    if (!worker) return false;

    // 发送停止信号
    worker.postMessage({ type: 'stop' });
    
    // 等待 Worker 优雅退出（最多5秒）
    await Promise.race([
      new Promise(resolve => {
        worker.once('exit', resolve);
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // 强制终止
    if (!worker.isTerminated) {
      await worker.terminate();
    }

    this.cleanupWorker(accountId);
    return true;
  }

  /**
   * 清理 Worker 资源
   */
  cleanupWorker(accountId) {
    this.workers.delete(accountId);
    this.workerStates.delete(accountId);
    this.messageHandlers.delete(accountId);
    console.log(`[WorkerPool] 账号 ${accountId} 已清理，当前运行: ${this.workers.size}`);
  }

  /**
   * 获取账号状态
   */
  getAccountStatus(accountId) {
    return this.workerStates.get(accountId) || { status: 'stopped' };
  }

  /**
   * 获取所有运行中的账号
   */
  getRunningAccounts() {
    return Array.from(this.workers.keys());
  }

  /**
   * 停止所有 Worker
   */
  async stopAll() {
    const promises = Array.from(this.workers.keys()).map(id => this.stopAccount(id));
    await Promise.all(promises);
    this.workerQueue = [];
  }

  /**
   * 获取池状态
   */
  getPoolStatus() {
    return {
      maxConcurrent: this.maxConcurrentWorkers,
      running: this.workers.size,
      queued: this.workerQueue.length,
      workers: Array.from(this.workerStates.entries()).map(([id, state]) => ({
        accountId: id,
        ...state
      }))
    };
  }
}

// 单例实例
module.exports = new WorkerPool();
