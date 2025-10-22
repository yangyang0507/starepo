import { getLogger, setLogLevel, getLogConfig, setLogConfig, type LogLevel } from './logger';

/**
 * 日志功能测试工具
 * 开发环境下用于测试和演示日志功能
 */
export class LoggerTest {
  private readonly logger = getLogger('test');

  async runTests(): Promise<void> {
    console.log('=== 日志系统测试开始 ===');

    // 测试基本日志功能
    await this.testBasicLogging();

    // 测试日志级别
    await this.testLogLevels();

    // 测试配置功能
    await this.testLogConfig();

    // 测试文件日志
    await this.testFileLogging();

    // 测试嵌套作用域
    await this.testNestedScopes();

    console.log('=== 日志系统测试完成 ===');
  }

  private async testBasicLogging(): Promise<void> {
    console.log('\n1. 测试基本日志功能:');

    this.logger.debug('这是一条调试信息');
    this.logger.info('这是一条信息日志');
    this.logger.warn('这是一条警告日志');
    this.logger.error('这是一条错误日志');

    // 测试带参数的日志
    this.logger.info('带参数的日志', { userId: 123 }, 'additional data');
    this.logger.error('错误对象', new Error('测试错误'));
  }

  private async testLogLevels(): Promise<void> {
    console.log('\n2. 测试日志级别控制:');

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

    for (const level of levels) {
      console.log(`\n设置日志级别为: ${level}`);
      setLogLevel(level);

      this.logger.debug('调试信息 (可能不显示)');
      this.logger.info('信息日志');
      this.logger.warn('警告日志');
      this.logger.error('错误日志');
    }

    // 恢复默认级别
    setLogLevel('info');
  }

  private async testLogConfig(): Promise<void> {
    console.log('\n3. 测试日志配置:');

    const currentConfig = getLogConfig();
    console.log('当前配置:', currentConfig);

    // 测试配置更新
    setLogConfig({
      enableStructuredLogging: true,
      maxFileSize: 5, // 5MB
    });

    console.log('启用结构化日志:');
    this.logger.info('结构化日志测试', { structured: true, data: { test: true } });

    // 恢复配置
    setLogConfig(currentConfig);
    console.log('恢复传统日志格式:');
    this.logger.info('传统日志测试', { traditional: true });
  }

  private async testFileLogging(): Promise<void> {
    console.log('\n4. 测试文件日志:');

    const config = getLogConfig();
    console.log(`日志文件目录: ${config.logDir}`);
    console.log(`文件日志启用: ${config.enableFileLogging}`);

    this.logger.info('这条日志会同时输出到控制台和文件');
    this.logger.warn('文件日志警告测试');
    this.logger.error('文件日志错误测试');

    // 给文件写入一些时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('文件日志写入完成');
  }

  private async testNestedScopes(): Promise<void> {
    console.log('\n5. 测试嵌套作用域:');

    const parentLogger = getLogger('parent');
    const childLogger = parentLogger.child('child');
    const grandchildLogger = childLogger.child('grandchild');

    parentLogger.info('父级日志');
    childLogger.info('子级日志');
    grandchildLogger.info('孙级日志');

    // 测试深层嵌套
    const deepLogger = parentLogger
      .child('level1')
      .child('level2')
      .child('level3');

    deepLogger.info('深层嵌套日志');
  }
}

// 开发环境下自动运行测试
if (process.env.NODE_ENV === 'development' && process.argv.includes('--test-logger')) {
  const tester = new LoggerTest();
  tester.runTests().catch(console.error);
}

export const loggerTest = new LoggerTest();