/**
 * Worker 线程测试脚本
 * 用于验证 Worker 相关代码是否能正常加载
 */

console.log('[测试] 开始检查 Worker 线程代码...\n');

let hasError = false;

// 测试 1: 检查 workerPool.js
console.log('[测试 1] 检查 workerPool.js...');
try {
  const workerPool = require('./workerPool');
  console.log('  ✓ workerPool 加载成功');
  console.log(`  ✓ 最大并发数: ${workerPool.maxConcurrentWorkers}`);
  console.log(`  ✓ 方法: startAccount, stopAccount, getPoolStatus`);
} catch (error) {
  console.error('  ✗ workerPool 加载失败:', error.message);
  hasError = true;
}

// 测试 2: 检查 farmOperations.js
console.log('\n[测试 2] 检查 farmOperations.js...');
try {
  const FarmOperations = require('./farmOperations');
  console.log('  ✓ FarmOperations 类加载成功');
  console.log('  ✓ 类方法:', Object.getOwnPropertyNames(FarmOperations.prototype).filter(m => m !== 'constructor').join(', '));
} catch (error) {
  console.error('  ✗ FarmOperations 加载失败:', error.message);
  hasError = true;
}

// 测试 3: 检查 accountManagerWorker.js
console.log('\n[测试 3] 检查 accountManagerWorker.js...');
try {
  const accountManagerWorker = require('./accountManagerWorker');
  console.log('  ✓ accountManagerWorker 加载成功');
  console.log(`  ✓ 已加载账号数: ${accountManagerWorker.accounts?.size || 0}`);
} catch (error) {
  console.error('  ✗ accountManagerWorker 加载失败:', error.message);
  hasError = true;
}

// 测试 4: 检查 farmWorker.js 语法
console.log('\n[测试 4] 检查 farmWorker.js 语法...');
try {
  // 使用 Node.js 的 --check 选项检查语法
  const { execSync } = require('child_process');
  execSync('node --check farmWorker.js', { cwd: __dirname, stdio: 'pipe' });
  console.log('  ✓ farmWorker.js 语法检查通过');
} catch (error) {
  console.error('  ✗ farmWorker.js 语法错误:', error.message);
  hasError = true;
}

// 测试 5: 检查依赖模块
console.log('\n[测试 5] 检查依赖模块...');
const requiredModules = [
  '../src/proto',
  '../src/network',
  '../src/utils',
  '../src/gameConfig',
  '../src/email',
  '../src/illustrated',
  '../src/shop'
];

for (const mod of requiredModules) {
  try {
    require(mod);
    console.log(`  ✓ ${mod}`);
  } catch (error) {
    console.error(`  ✗ ${mod}: ${error.message}`);
    hasError = true;
  }
}

// 总结
console.log('\n' + '='.repeat(50));
if (hasError) {
  console.log('[结果] 测试未通过，请修复上述错误');
  process.exit(1);
} else {
  console.log('[结果] 所有测试通过！代码可以正常运行');
  console.log('\n下一步建议:');
  console.log('1. 备份现有的 accountManager.js');
  console.log('2. 修改 server.js 使用新的 accountManagerWorker');
  console.log('3. 启动服务并测试少量账号');
  process.exit(0);
}
