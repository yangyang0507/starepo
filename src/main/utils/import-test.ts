/**
 * 测试不同的导入方式的性能和类型推断
 */

// 测试 1: ES6 import 导入
try {
  import { lancedbService } from '../services/database/lancedb-service';
  console.log('ES6 import 类型推断:', { lancedbService });
} catch (error) {
  console.error('ES6 import 失败:', error);
}

// 测试 2: 类型安全的动态 import
try {
  const lancedbModule = await import('../services/database/lancedb-service');
  console.log('动态 import 类型推断:', { 
    LanceDBService: lancedbModule.LanceDBService, 
    lancedbService: lancedbModule.lancedbService 
  });
} catch (error) {
  console.error('动态 import 失败:', error);
}

// 测试 3: 类型断言实例
try {
  const lancedbModule = await import('../services/database/lancedb-service');
  const service = lancedbModule.lancedbService;
  console.log('类型推断成功:', typeof service);
} catch (error) {
  console.error('类型推断失败:', error);
}
