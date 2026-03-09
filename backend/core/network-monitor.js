/**
 * 网络监控模块 - RTT 往返时间采样
 * 用于评估网络质量和计算经验收益
 */

class NetworkMonitor {
  constructor() {
    this.rttSamples = []; // RTT 采样数组（毫秒）
    this.maxSamples = 100; // 最大采样数
    this.lastRequestTime = null;
  }

  /**
   * 记录请求开始时间
   */
  startRequest() {
    this.lastRequestTime = Date.now();
  }

  /**
   * 记录请求结束，计算 RTT
   * @returns {number|null} RTT（毫秒）
   */
  endRequest() {
    if (this.lastRequestTime === null) return null;

    const rtt = Date.now() - this.lastRequestTime;
    this.addRttSample(rtt);
    this.lastRequestTime = null;
    return rtt;
  }

  /**
   * 添加 RTT 采样
   * @param {number} rtt - RTT（毫秒）
   */
  addRttSample(rtt) {
    if (rtt <= 0 || rtt > 30000) return; // 忽略异常值

    this.rttSamples.push(rtt);
    if (this.rttSamples.length > this.maxSamples) {
      this.rttSamples.shift(); // 移除最旧的采样
    }
  }

  /**
   * 获取平均 RTT
   * @returns {number} 平均 RTT（毫秒）
   */
  getAverageRtt() {
    if (this.rttSamples.length === 0) return 0;
    const sum = this.rttSamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.rttSamples.length);
  }

  /**
   * 获取 RTT 统计信息
   * @returns {Object} { avg, min, max, count }
   */
  getRttStats() {
    if (this.rttSamples.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const avg = this.getAverageRtt();
    const min = Math.min(...this.rttSamples);
    const max = Math.max(...this.rttSamples);

    return {
      avg,
      min,
      max,
      count: this.rttSamples.length,
    };
  }

  /**
   * 获取网络质量评级
   * @returns {string} 'excellent' | 'good' | 'fair' | 'poor'
   */
  getNetworkQuality() {
    const avg = this.getAverageRtt();
    if (avg === 0) return 'unknown';
    if (avg < 100) return 'excellent';
    if (avg < 300) return 'good';
    if (avg < 500) return 'fair';
    return 'poor';
  }

  /**
   * 获取网络质量中文描述
   * @returns {string}
   */
  getNetworkQualityText() {
    const quality = this.getNetworkQuality();
    const texts = {
      excellent: '优秀',
      good: '良好',
      fair: '一般',
      poor: '较差',
      unknown: '未知',
    };
    return texts[quality] || '未知';
  }

  /**
   * 清空采样
   */
  clear() {
    this.rttSamples = [];
    this.lastRequestTime = null;
  }
}

// 创建全局实例
const networkMonitor = new NetworkMonitor();

module.exports = {
  NetworkMonitor,
  networkMonitor,
};
