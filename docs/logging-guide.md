# 日志系统使用指南

## 概述

Starepo 应用使用了一个功能完整的日志系统，支持控制台输出、文件存储、日志轮转和结构化日志格式。

## 特性

- ✅ **多级别日志**: debug, info, warn, error
- ✅ **文件存储**: 自动写入到 `~/.starepo/logs/`
- ✅ **日志轮转**: 自动轮转和清理旧日志
- ✅ **性能优化**: 异步写入，不阻塞主线程
- ✅ **作用域支持**: 嵌套作用域便于分类
- ✅ **结构化日志**: 可选的 JSON 格式输出
- ✅ **环境配置**: 支持环境变量和动态配置

## 基本使用

### 导入和创建日志器

```typescript
import { getLogger } from '@main/utils/logger';

// 创建带作用域的日志器
const logger = getLogger('my-module');
```

### 日志级别

```typescript
logger.debug('调试信息', { data: 'value' });
logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息', new Error('错误详情'));
```

## 高级功能

### 日志配置

```typescript
import { getLogConfig, setLogConfig } from '@main/utils/logger';

// 获取当前配置
const config = getLogConfig();

// 更新配置
setLogConfig({
  enableFileLogging: true,
  maxFileSize: 20, // 20MB
  maxFiles: 10,
  enableStructuredLogging: true,
});
```

### 日志级别控制

```typescript
import { setLogLevel } from '@main/utils/logger';

// 设置全局日志级别
setLogLevel('debug');
```

### 嵌套作用域

```typescript
const parentLogger = getLogger('parent');
const childLogger = parentLogger.child('child');

// 输出: [timestamp] [LEVEL] [parent:child] message
childLogger.info('嵌套作用域日志');
```

## 配置选项

### 环境变量

- `STAREPO_LOG_LEVEL`: 设置日志级别 (debug|info|warn|error)
- `NODE_ENV`: 影响默认日志级别 (production=warn, development=info)

### 默认配置

```typescript
const DEFAULT_CONFIG = {
  level: 'info',                    // 默认日志级别
  enableFileLogging: true,          // 启用文件日志
  maxFileSize: 10,                  // 最大文件大小 (MB)
  maxFiles: 5,                      // 最大文件数量
  logDir: '~/.starepo/logs',        // 日志目录
  enableStructuredLogging: false,   // 结构化日志格式
};
```

## 文件日志

### 存储位置

- **日志目录**: `~/.starepo/logs/`
- **文件命名**: `starepo-YYYY-MM-DD.log`
- **轮转文件**: `starepo-YYYY-MM-DD-TIMESTAMP.log`

### 轮转机制

- 当文件大小超过 `maxFileSize` 时自动轮转
- 自动清理超过 `maxFiles` 数量的旧文件
- 轮转文件名包含时间戳

## 性能考虑

### 异步写入

日志写入是异步的，不会阻塞主线程：

```typescript
// 这行代码不会阻塞执行
logger.info('异步写入日志');
```

### 批量处理

多个日志消息会被批量写入文件，提高性能。

### 条件日志

只有达到当前日志级别的消息才会被处理：

```typescript
// 如果当前级别是 warn，这行代码几乎无开销
logger.debug('不会被执行的调试信息');
```

## 开发工具

### 测试日志功能

```bash
# 在开发环境下测试日志
npm run start -- --test-logger
```

### 调试模式

```bash
# 启用详细日志
STAREPO_LOG_LEVEL=debug npm run start
```

## 最佳实践

### 1. 合理使用作用域

```typescript
// ✅ 好的做法
const dbLogger = getLogger('database:lancedb');
const authLogger = getLogger('github:auth');

// ❌ 避免过于具体的作用域
const tooSpecific = getLogger('very:long:and:specific:scope:name');
```

### 2. 结构化错误日志

```typescript
// ✅ 包含上下文信息
logger.error('数据库连接失败', {
  error: error.message,
  database: 'lancedb',
  attempt: retryCount,
});

// ❌ 简单的错误信息
logger.error('数据库连接失败');
```

### 3. 避免敏感信息

```typescript
// ✅ 脱敏处理
logger.info('用户登录', { userId: user.id });

// ❌ 包含敏感信息
logger.info('用户登录', { token: user.authToken });
```

### 4. 性能敏感场景

```typescript
// ✅ 条件日志
if (getLogLevel() === 'debug') {
  const expensiveData = calculateExpensiveData();
  logger.debug('详细调试信息', expensiveData);
}

// ❌ 总是执行昂贵操作
logger.debug('调试信息', calculateExpensiveData());
```

## 故障排除

### 日志文件未生成

1. 检查 `enableFileLogging` 配置
2. 确认日志目录权限
3. 查看控制台错误信息

### 日志级别不生效

1. 检查环境变量 `STAREPO_LOG_LEVEL`
2. 确认 `NODE_ENV` 设置
3. 使用 `getLogLevel()` 检查当前级别

### 性能问题

1. 降低日志级别 (如改为 warn)
2. 增大 `maxFileSize` 减少轮转频率
3. 禁用文件日志用于性能测试

## 示例

### 完整的模块日志示例

```typescript
import { getLogger } from '@main/utils/logger';

class DatabaseService {
  private readonly logger = getLogger('database:service');

  async connect(): Promise<void> {
    try {
      this.logger.info('正在连接数据库...');

      // 连接逻辑
      await this.performConnection();

      this.logger.info('数据库连接成功');
    } catch (error) {
      this.logger.error('数据库连接失败', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async performConnection(): Promise<void> {
    this.logger.debug('执行数据库连接', {
      host: 'localhost',
      port: 5432,
      database: 'starepo',
    });

    // 实际连接逻辑...
  }
}
```

这样就完成了日志系统的全面改进！主要改进包括：

1. ✅ **调整默认日志级别**: 开发环境默认 `info`，生产环境 `warn`
2. ✅ **添加文件日志功能**: 异步写入，不阻塞主线程
3. ✅ **优化性能和结构化支持**: 批量处理、条件日志、JSON格式选项
4. ✅ **修复直接使用 console 的问题**: 替换为统一的日志接口
5. ✅ **添加日志轮转机制**: 自动轮转、大小限制、文件清理

所有改进都保持了向后兼容性，现有代码无需修改即可享受新的功能。