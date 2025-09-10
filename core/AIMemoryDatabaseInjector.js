/**
 * AI记忆数据库注入器
 * 
 * 专门负责将AI记忆数据库注入给主API的独立模块：
 * - 只注入给主API，不注入自定义API
 * - 不受其他因素影响的独立注入机制
 * - 整合所有记忆管理模块的统一数据库
 * - 优化的记忆注入性能和策略
 * 
 * 核心功能：
 * - 主API检测和独立注入逻辑
 * - 统一记忆数据库管理
 * - 智能记忆压缩和优化
 * - 记忆优先级管理
 * - 记忆生命周期管理
 * 
 * @class AIMemoryDatabaseInjector
 */

export class AIMemoryDatabaseInjector {
    constructor(dependencies = {}) {
        console.log('[AIMemoryDatabaseInjector] 🧠 AI记忆数据库注入器初始化开始');
        
        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager;
        
        // 记忆管理模块
        this.summaryManager = dependencies.summaryManager;
        this.aiMemorySummarizer = dependencies.aiMemorySummarizer;
        this.vectorizedMemoryRetrieval = dependencies.vectorizedMemoryRetrieval;
        this.deepMemoryManager = dependencies.deepMemoryManager;
        this.intelligentMemoryClassifier = dependencies.intelligentMemoryClassifier;
        
        // SillyTavern上下文
        this.context = null;
        
        // 记忆数据库核心
        this.memoryDatabase = {
            // 感知记忆：实时输入数据
            sensoryMemory: new Map(),
            // 短期记忆：当前会话重要信息
            shortTermMemory: new Map(),
            // 长期记忆：持久化重要记忆
            longTermMemory: new Map(),
            // 深度归档：压缩历史记忆
            deepArchive: new Map()
        };
        
        // 注入器配置
        this.injectorConfig = {
            // 核心开关
            enabled: true,                          // 是否启用记忆注入
            mainAPIOnly: true,                      // 只注入给主API
            ignoreCustomAPI: true,                  // 忽略自定义API状态
            
            // 注入策略
            injectionMethod: 'system_message',      // 注入方法：system_message, memory, author_note
            maxMemorySize: 4000,                    // 最大记忆大小（字符）
            compressionRatio: 0.7,                  // 记忆压缩比例
            priorityThreshold: 0.8,                 // 优先级阈值
            
            // 记忆管理
            memoryLifecycle: 'session',             // 记忆生命周期：session, permanent, auto
            memoryRotation: true,                   // 启用记忆轮换
            smartCompression: true,                 // 智能压缩
            vectorizedSearch: true,                 // 向量化搜索
            
            // 性能优化
            batchProcessing: true,                  // 批量处理
            asyncInjection: true,                   // 异步注入
            cacheEnabled: true,                     // 启用缓存
            debounceInterval: 1000                  // 防抖间隔（毫秒）
        };
        
        // 注入状态管理
        this.injectionState = {
            active: false,                          // 是否正在注入
            lastInjectionTime: 0,                   // 上次注入时间
            injectionCount: 0,                      // 注入计数
            totalInjectedSize: 0,                   // 总注入大小
            averageInjectionTime: 0,                // 平均注入时间
            successRate: 0                          // 成功率
        };
        
        // 记忆缓存
        this.memoryCache = new Map();
        this.compressionCache = new Map();
        this.injectionQueue = [];
        
        // 性能统计
        this.stats = {
            totalMemoryEntries: 0,
            compressedEntries: 0,
            successfulInjections: 0,
            failedInjections: 0,
            averageResponseTime: 0,
            cacheHitRate: 0
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[AIMemoryDatabaseInjector] 🧠 初始化配置完成');
    }

    /**
     * 初始化AI记忆数据库注入器
     */
    async init() {
        try {
            console.log('[AIMemoryDatabaseInjector] 🚀 开始初始化AI记忆数据库注入器...');
            
            // 获取SillyTavern上下文
            this.context = SillyTavern.getContext();
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }
            
            // 初始化记忆数据库
            await this.initMemoryDatabase();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 启动记忆管理器
            await this.startMemoryManager();
            
            this.initialized = true;
            console.log('[AIMemoryDatabaseInjector] ✅ AI记忆数据库注入器初始化完成');
            
            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('memoryInjector:initialized', {
                    timestamp: Date.now(),
                    config: this.injectorConfig
                });
            }
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 初始化记忆数据库
     */
    async initMemoryDatabase() {
        try {
            console.log('[AIMemoryDatabaseInjector] 📊 初始化记忆数据库...');
            
            // 加载现有记忆数据
            await this.loadExistingMemories();
            
            // 初始化记忆分类器
            await this.initMemoryClassifier();
            
            // 启动记忆清理任务
            this.startMemoryCleanupTask();
            
            console.log('[AIMemoryDatabaseInjector] ✅ 记忆数据库初始化完成');
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载现有记忆数据
     */
    async loadExistingMemories() {
        try {
            console.log('[AIMemoryDatabaseInjector] 📥 加载现有记忆数据...');
            
            // 从总结管理器获取记忆
            if (this.summaryManager) {
                try {
                    // 尝试获取最近的总结记忆
                    const summaries = await this.summaryManager.getRecentSummaries?.(20) || [];
                    for (const summary of summaries) {
                        await this.addToMemoryDatabase('summary', summary);
                    }
                    console.log(`[AIMemoryDatabaseInjector] 📥 加载了 ${summaries.length} 个总结记忆`);
                } catch (error) {
                    console.warn('[AIMemoryDatabaseInjector] ⚠️ 从总结管理器加载记忆失败:', error.message);
                }
            }
            
            // 从深度记忆管理器获取记忆
            if (this.deepMemoryManager) {
                try {
                    // 尝试获取重要的深度记忆
                    const deepMemories = await this.deepMemoryManager.getImportantMemories?.(10) || [];
                    for (const memory of deepMemories) {
                        await this.addToMemoryDatabase('deep', memory);
                    }
                    console.log(`[AIMemoryDatabaseInjector] 📥 加载了 ${deepMemories.length} 个深度记忆`);
                } catch (error) {
                    console.warn('[AIMemoryDatabaseInjector] ⚠️ 从深度记忆管理器加载记忆失败:', error.message);
                }
            }
            
            // 从向量化检索系统获取记忆
            if (this.vectorizedMemoryRetrieval) {
                try {
                    // 由于向量化记忆通常是动态检索的，这里不预加载
                    console.log('[AIMemoryDatabaseInjector] 📥 向量化记忆将在需要时动态检索');
                } catch (error) {
                    console.warn('[AIMemoryDatabaseInjector] ⚠️ 向量化记忆初始化失败:', error.message);
                }
            }
            
            // 统计记忆数据
            this.updateMemoryStats();
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 加载现有记忆数据失败:', error);
            // 不抛出错误，允许继续初始化
        }
    }

    /**
     * 初始化记忆分类器
     */
    async initMemoryClassifier() {
        try {
            if (this.intelligentMemoryClassifier) {
                // 确保智能记忆分类器已初始化
                if (!this.intelligentMemoryClassifier.initialized) {
                    await this.intelligentMemoryClassifier.init();
                }
                console.log('[AIMemoryDatabaseInjector] 🤖 智能记忆分类器已就绪');
            } else {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 智能记忆分类器不可用，使用基础分类');
            }
        } catch (error) {
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 记忆分类器初始化失败:', error.message);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 事件系统不可用，跳过事件绑定');
                return;
            }
            
            // 监听生成开始事件（主API检测和注入）
            this.eventSystem.on('generation_started', this.handleGenerationStarted.bind(this));
            
            // 监听消息接收事件（记忆数据更新）
            this.eventSystem.on('message_received', this.handleMessageReceived.bind(this));
            
            // 监听记忆更新事件
            this.eventSystem.on('memory:updated', this.handleMemoryUpdated.bind(this));
            this.eventSystem.on('summary:created', this.handleSummaryCreated.bind(this));
            this.eventSystem.on('deep_memory:added', this.handleDeepMemoryAdded.bind(this));
            
            // 监听配置变更事件
            this.eventSystem.on('config:changed', this.handleConfigChanged.bind(this));
            
            console.log('[AIMemoryDatabaseInjector] 🔗 事件监听器绑定完成');
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 事件监听器绑定失败:', error);
        }
    }

    /**
     * 启动记忆管理器
     */
    async startMemoryManager() {
        try {
            console.log('[AIMemoryDatabaseInjector] ⚙️ 启动记忆管理器...');
            
            // 启动记忆压缩任务
            this.startMemoryCompressionTask();
            
            // 启动记忆同步任务
            this.startMemorySyncTask();
            
            console.log('[AIMemoryDatabaseInjector] ✅ 记忆管理器启动完成');
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆管理器启动失败:', error);
        }
    }

    /**
     * 处理生成开始事件 - 主API检测和记忆注入
     */
    async handleGenerationStarted(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🚀 生成开始，检测API类型并进行记忆注入...');
            
            // 🔧 关键：只检测主API，不受自定义API影响
            const isMainAPI = await this.detectMainAPI();
            
            if (!isMainAPI) {
                console.log('[AIMemoryDatabaseInjector] 🚫 非主API请求，跳过记忆注入');
                return;
            }
            
            console.log('[AIMemoryDatabaseInjector] ✅ 检测到主API请求，开始注入AI记忆数据库...');
            
            // 准备记忆数据
            const memoryData = await this.prepareMemoryData();
            
            if (!memoryData || memoryData.length === 0) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 没有可注入的记忆数据');
                return;
            }
            
            // 执行记忆注入
            const injectionResult = await this.injectMemoryToMainAPI(memoryData);
            
            if (injectionResult.success) {
                console.log(`[AIMemoryDatabaseInjector] ✅ AI记忆数据库注入成功，大小: ${injectionResult.size} 字符`);
                this.updateInjectionStats(true, injectionResult.size);
            } else {
                console.error('[AIMemoryDatabaseInjector] ❌ AI记忆数据库注入失败:', injectionResult.error);
                this.updateInjectionStats(false, 0);
            }
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理生成开始事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 检测是否为主API请求
     * 🔧 核心功能：独立检测，不受自定义API配置影响
     */
    async detectMainAPI() {
        try {
            // 🚀 创新检测逻辑：通过SillyTavern内部状态判断主API
            
            // 方法1：检查当前使用的API类型
            const currentAPI = this.context.main_api;
            if (currentAPI && currentAPI !== 'custom') {
                console.log(`[AIMemoryDatabaseInjector] 🔍 检测到主API类型: ${currentAPI}`);
                return true;
            }
            
            // 方法2：检查是否有active的主API配置
            const mainAPIs = ['openai', 'claude', 'gemini', 'koboldhorde', 'textgenerationwebui', 'novel', 'ooba'];
            for (const apiType of mainAPIs) {
                if (this.context[`${apiType}_setting`] && this.context[`${apiType}_setting`].active) {
                    console.log(`[AIMemoryDatabaseInjector] 🔍 检测到活跃的主API: ${apiType}`);
                    return true;
                }
            }
            
            // 方法3：检查生成请求的来源
            if (this.context.is_send_press && !this.context.is_custom_api_active) {
                console.log('[AIMemoryDatabaseInjector] 🔍 检测到主API发送请求');
                return true;
            }
            
            // 方法4：备用检测 - 假设没有自定义API Hook就是主API
            const hasCustomAPIHook = this.checkCustomAPIHook();
            if (!hasCustomAPIHook) {
                console.log('[AIMemoryDatabaseInjector] 🔍 未检测到自定义API Hook，默认为主API');
                return true;
            }
            
            console.log('[AIMemoryDatabaseInjector] 🚫 未能确认主API状态，跳过注入');
            return false;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 主API检测失败:', error);
            // 出错时默认认为是主API，确保记忆注入不被中断
            return true;
        }
    }

    /**
     * 检查是否存在自定义API Hook
     */
    checkCustomAPIHook() {
        try {
            // 检查扩展设置中的自定义API配置
            const extensionSettings = this.context.extensionSettings?.['Information bar integration tool'];
            const apiConfig = extensionSettings?.apiConfig;
            
            return apiConfig?.enabled && apiConfig?.apiKey && apiConfig?.model;
        } catch {
            return false;
        }
    }

    /**
     * 准备记忆数据
     */
    async prepareMemoryData() {
        try {
            console.log('[AIMemoryDatabaseInjector] 📋 准备记忆数据...');
            
            const memoryEntries = [];
            
            // 🧠 收集不同类型的记忆
            
            // 1. 短期记忆（当前会话重要信息）
            const shortTermMemories = await this.getShortTermMemories();
            memoryEntries.push(...shortTermMemories);
            
            // 2. 长期记忆（持久化重要记忆）
            const longTermMemories = await this.getLongTermMemories();
            memoryEntries.push(...longTermMemories);
            
            // 3. 向量化检索记忆（相关性记忆）
            const vectorMemories = await this.getVectorizedMemories();
            memoryEntries.push(...vectorMemories);
            
            // 4. 智能分类记忆（高优先级记忆）
            const classifiedMemories = await this.getClassifiedMemories();
            memoryEntries.push(...classifiedMemories);
            
            // 📊 记忆优先级排序和筛选
            const processedMemories = await this.processMemoryEntries(memoryEntries);
            
            // 📦 记忆压缩和优化
            const optimizedMemories = await this.optimizeMemoryData(processedMemories);
            
            console.log(`[AIMemoryDatabaseInjector] 📋 准备完成，记忆条目: ${optimizedMemories.length}`);
            return optimizedMemories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 准备记忆数据失败:', error);
            return [];
        }
    }

    /**
     * 获取短期记忆
     */
    async getShortTermMemories() {
        try {
            const memories = [];
            
            // 从短期记忆数据库获取
            for (const [key, memory] of this.memoryDatabase.shortTermMemory) {
                if (memory.importance >= this.injectorConfig.priorityThreshold) {
                    memories.push({
                        type: 'short_term',
                        content: memory.content,
                        importance: memory.importance,
                        timestamp: memory.timestamp,
                        source: 'short_term_memory'
                    });
                }
            }
            
            console.log(`[AIMemoryDatabaseInjector] 🧠 获取短期记忆: ${memories.length} 条`);
            return memories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取短期记忆失败:', error);
            return [];
        }
    }

    /**
     * 获取长期记忆
     */
    async getLongTermMemories() {
        try {
            const memories = [];
            
            // 从长期记忆数据库获取
            for (const [key, memory] of this.memoryDatabase.longTermMemory) {
                if (memory.importance >= this.injectorConfig.priorityThreshold) {
                    memories.push({
                        type: 'long_term',
                        content: memory.content,
                        importance: memory.importance,
                        timestamp: memory.timestamp,
                        source: 'long_term_memory'
                    });
                }
            }
            
            console.log(`[AIMemoryDatabaseInjector] 🧠 获取长期记忆: ${memories.length} 条`);
            return memories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取长期记忆失败:', error);
            return [];
        }
    }

    /**
     * 获取向量化记忆
     */
    async getVectorizedMemories() {
        try {
            if (!this.vectorizedMemoryRetrieval) {
                return [];
            }
            
            // 使用当前对话上下文搜索相关记忆
            const currentContext = await this.getCurrentContext();
            const relevantMemories = await this.vectorizedMemoryRetrieval.searchSimilarMemories(currentContext, 5);
            
            const memories = relevantMemories.map(memory => ({
                type: 'vectorized',
                content: memory.content,
                importance: memory.similarity,
                timestamp: memory.timestamp,
                source: 'vectorized_memory'
            }));
            
            console.log(`[AIMemoryDatabaseInjector] 🔍 获取向量化记忆: ${memories.length} 条`);
            return memories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取向量化记忆失败:', error);
            return [];
        }
    }

    /**
     * 获取智能分类记忆
     */
    async getClassifiedMemories() {
        try {
            if (!this.intelligentMemoryClassifier) {
                return [];
            }
            
            // 获取高优先级分类记忆
            const classifiedMemories = await this.intelligentMemoryClassifier.getHighPriorityMemories();
            
            const memories = classifiedMemories.map(memory => ({
                type: 'classified',
                content: memory.content,
                importance: memory.priority,
                timestamp: memory.timestamp,
                source: 'intelligent_classifier'
            }));
            
            console.log(`[AIMemoryDatabaseInjector] 🤖 获取智能分类记忆: ${memories.length} 条`);
            return memories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取智能分类记忆失败:', error);
            return [];
        }
    }

    /**
     * 处理记忆条目（排序和筛选）
     */
    async processMemoryEntries(memoryEntries) {
        try {
            console.log('[AIMemoryDatabaseInjector] 📊 处理记忆条目...');
            
            // 1. 去重
            const uniqueMemories = this.deduplicateMemories(memoryEntries);
            
            // 2. 按重要性和时间排序
            uniqueMemories.sort((a, b) => {
                // 优先按重要性排序
                if (a.importance !== b.importance) {
                    return b.importance - a.importance;
                }
                // 然后按时间排序（最新的优先）
                return b.timestamp - a.timestamp;
            });
            
            // 3. 筛选高优先级记忆
            const highPriorityMemories = uniqueMemories.filter(
                memory => memory.importance >= this.injectorConfig.priorityThreshold
            );
            
            console.log(`[AIMemoryDatabaseInjector] 📊 处理完成: ${uniqueMemories.length} -> ${highPriorityMemories.length} 条`);
            return highPriorityMemories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理记忆条目失败:', error);
            return memoryEntries;
        }
    }

    /**
     * 去重记忆
     */
    deduplicateMemories(memories) {
        const seen = new Set();
        return memories.filter(memory => {
            const key = `${memory.content.substring(0, 100)}_${memory.type}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 优化记忆数据（压缩和大小控制）
     */
    async optimizeMemoryData(memories) {
        try {
            console.log('[AIMemoryDatabaseInjector] 📦 优化记忆数据...');
            
            let totalSize = 0;
            const optimizedMemories = [];
            
            for (const memory of memories) {
                // 检查大小限制
                if (totalSize >= this.injectorConfig.maxMemorySize) {
                    break;
                }
                
                // 压缩记忆内容
                let content = memory.content;
                if (this.injectorConfig.smartCompression) {
                    content = await this.compressMemoryContent(content);
                }
                
                const memorySize = content.length;
                if (totalSize + memorySize <= this.injectorConfig.maxMemorySize) {
                    optimizedMemories.push({
                        ...memory,
                        content: content,
                        size: memorySize
                    });
                    totalSize += memorySize;
                } else {
                    // 部分添加以利用剩余空间
                    const remainingSpace = this.injectorConfig.maxMemorySize - totalSize;
                    if (remainingSpace > 100) { // 至少保留100字符
                        const truncatedContent = content.substring(0, remainingSpace - 3) + '...';
                        optimizedMemories.push({
                            ...memory,
                            content: truncatedContent,
                            size: truncatedContent.length,
                            truncated: true
                        });
                        totalSize += truncatedContent.length;
                    }
                    break;
                }
            }
            
            console.log(`[AIMemoryDatabaseInjector] 📦 优化完成: ${optimizedMemories.length} 条，总大小: ${totalSize} 字符`);
            return optimizedMemories;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 优化记忆数据失败:', error);
            return memories;
        }
    }

    /**
     * 压缩记忆内容
     */
    async compressMemoryContent(content) {
        try {
            // 检查缓存
            if (this.compressionCache.has(content)) {
                return this.compressionCache.get(content);
            }
            
            let compressed = content;
            
            // 1. 移除多余空白
            compressed = compressed.replace(/\s+/g, ' ').trim();
            
            // 2. 简化重复内容
            compressed = this.simplifyRepeatedContent(compressed);
            
            // 3. 使用智能压缩（如果可用）
            if (this.aiMemorySummarizer) {
                try {
                    const summarized = await this.aiMemorySummarizer.summarizeText(compressed, {
                        maxLength: Math.floor(compressed.length * this.injectorConfig.compressionRatio),
                        preserveKeyInfo: true
                    });
                    if (summarized && summarized.length < compressed.length) {
                        compressed = summarized;
                    }
                } catch (error) {
                    console.warn('[AIMemoryDatabaseInjector] ⚠️ AI压缩失败，使用基础压缩:', error.message);
                }
            }
            
            // 缓存压缩结果
            this.compressionCache.set(content, compressed);
            
            return compressed;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 压缩记忆内容失败:', error);
            return content;
        }
    }

    /**
     * 简化重复内容
     */
    simplifyRepeatedContent(content) {
        // 移除重复的句子
        const sentences = content.split(/[.!?]+/).filter(s => s.trim());
        const uniqueSentences = [...new Set(sentences)];
        return uniqueSentences.join('. ') + (content.endsWith('.') ? '' : '.');
    }

    /**
     * 注入记忆到主API
     */
    async injectMemoryToMainAPI(memoryData) {
        try {
            console.log('[AIMemoryDatabaseInjector] 💉 开始注入AI记忆数据库到主API...');
            
            const startTime = Date.now();
            this.injectionState.active = true;
            
            // 格式化记忆内容
            const formattedMemory = this.formatMemoryForInjection(memoryData);
            
            // 选择注入方法
            let injectionResult;
            switch (this.injectorConfig.injectionMethod) {
                case 'system_message':
                    injectionResult = await this.injectAsSystemMessage(formattedMemory);
                    break;
                case 'memory':
                    injectionResult = await this.injectToMemorySystem(formattedMemory);
                    break;
                case 'author_note':
                    injectionResult = await this.injectToAuthorNote(formattedMemory);
                    break;
                default:
                    injectionResult = await this.injectAsSystemMessage(formattedMemory);
            }
            
            const endTime = Date.now();
            const injectionTime = endTime - startTime;
            
            this.injectionState.active = false;
            this.injectionState.lastInjectionTime = endTime;
            this.injectionState.injectionCount++;
            
            if (injectionResult.success) {
                console.log(`[AIMemoryDatabaseInjector] ✅ 记忆注入成功，耗时: ${injectionTime}ms`);
                
                // 触发注入成功事件
                if (this.eventSystem) {
                    this.eventSystem.emit('memoryInjector:injected', {
                        success: true,
                        size: formattedMemory.length,
                        injectionTime: injectionTime,
                        method: this.injectorConfig.injectionMethod,
                        memoryCount: memoryData.length,
                        timestamp: endTime
                    });
                }
            }
            
            return {
                success: injectionResult.success,
                size: formattedMemory.length,
                injectionTime: injectionTime,
                method: this.injectorConfig.injectionMethod,
                error: injectionResult.error
            };
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 注入记忆到主API失败:', error);
            this.injectionState.active = false;
            
            return {
                success: false,
                size: 0,
                injectionTime: 0,
                error: error.message
            };
        }
    }

    /**
     * 格式化记忆内容用于注入
     */
    formatMemoryForInjection(memoryData) {
        try {
            const sections = {
                '重要记忆': [],
                '角色信息': [],
                '剧情发展': [],
                '关系状态': [],
                '环境信息': []
            };
            
            // 分类记忆内容
            for (const memory of memoryData) {
                const category = this.categorizeMemory(memory);
                const formattedContent = `• ${memory.content}`;
                
                if (sections[category]) {
                    sections[category].push(formattedContent);
                } else {
                    sections['重要记忆'].push(formattedContent);
                }
            }
            
            // 构建最终格式
            const formattedSections = [];
            for (const [sectionName, items] of Object.entries(sections)) {
                if (items.length > 0) {
                    formattedSections.push(`\n**${sectionName}**\n${items.join('\n')}`);
                }
            }
            
            const header = "【AI记忆数据库】\n以下是重要的记忆信息，请在回复中自然地体现这些内容：";
            const footer = "\n---\n请根据以上记忆信息进行回复，保持角色一致性和情节连贯性。";
            
            return header + formattedSections.join('\n') + footer;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 格式化记忆内容失败:', error);
            return memoryData.map(m => m.content).join('\n\n');
        }
    }

    /**
     * 记忆分类
     */
    categorizeMemory(memory) {
        const content = memory.content.toLowerCase();
        
        if (content.includes('角色') || content.includes('性格') || content.includes('特征')) {
            return '角色信息';
        } else if (content.includes('剧情') || content.includes('故事') || content.includes('发生')) {
            return '剧情发展';
        } else if (content.includes('关系') || content.includes('感情') || content.includes('友情') || content.includes('恋爱')) {
            return '关系状态';
        } else if (content.includes('环境') || content.includes('地点') || content.includes('场景')) {
            return '环境信息';
        } else {
            return '重要记忆';
        }
    }

    /**
     * 作为系统消息注入
     */
    async injectAsSystemMessage(memoryContent) {
        try {
            console.log('[AIMemoryDatabaseInjector] 📝 作为系统消息注入记忆...');
            
            // 使用SillyTavern的扩展提示词机制
            if (this.context.setExtensionPrompt) {
                this.context.setExtensionPrompt(
                    'ai_memory_database_injector',
                    memoryContent,
                    2, // 位置：在用户消息之后
                    false // 不是隐藏的
                );
                
                console.log('[AIMemoryDatabaseInjector] ✅ 已通过setExtensionPrompt注入记忆');
                return { success: true };
            }
            
            // 备用方案：直接修改系统消息
            if (this.context.system_message !== undefined) {
                const separator = this.context.system_message ? '\n\n' : '';
                this.context.system_message += separator + memoryContent;
                
                console.log('[AIMemoryDatabaseInjector] ✅ 已添加到系统消息');
                return { success: true };
            }
            
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 无法找到合适的系统消息注入点');
            return { success: false, error: '无法找到系统消息注入点' };
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 系统消息注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 注入到记忆系统
     */
    async injectToMemorySystem(memoryContent) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🧠 注入到记忆系统...');
            
            if (this.context.memory !== undefined) {
                const separator = this.context.memory ? '\n\n---\n\n' : '';
                this.context.memory += separator + memoryContent;
                
                // 尝试保存记忆
                if (this.context.saveMemory && typeof this.context.saveMemory === 'function') {
                    await this.context.saveMemory();
                }
                
                console.log('[AIMemoryDatabaseInjector] ✅ 已注入到记忆系统');
                return { success: true };
            }
            
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 记忆系统不可用');
            return { success: false, error: '记忆系统不可用' };
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆系统注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 注入到Author's Note
     */
    async injectToAuthorNote(memoryContent) {
        try {
            console.log('[AIMemoryDatabaseInjector] 📝 注入到Author\'s Note...');
            
            if (this.context.author_note !== undefined) {
                const separator = this.context.author_note ? '\n\n' : '';
                this.context.author_note += separator + memoryContent;
                
                console.log('[AIMemoryDatabaseInjector] ✅ 已注入到Author\'s Note');
                return { success: true };
            }
            
            console.warn('[AIMemoryDatabaseInjector] ⚠️ Author\'s Note不可用');
            return { success: false, error: 'Author\'s Note不可用' };
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ Author\'s Note注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 添加记忆到数据库
     */
    async addToMemoryDatabase(type, memoryData) {
        try {
            const memoryEntry = {
                id: this.generateMemoryId(),
                type: type,
                content: memoryData.content || memoryData.summary || memoryData.text || String(memoryData),
                importance: memoryData.importance || memoryData.priority || 0.5,
                timestamp: memoryData.timestamp || Date.now(),
                source: memoryData.source || type,
                metadata: memoryData.metadata || {}
            };
            
            // 根据重要性决定存储位置
            if (memoryEntry.importance >= 0.8) {
                this.memoryDatabase.longTermMemory.set(memoryEntry.id, memoryEntry);
            } else if (memoryEntry.importance >= 0.5) {
                this.memoryDatabase.shortTermMemory.set(memoryEntry.id, memoryEntry);
            } else {
                this.memoryDatabase.sensoryMemory.set(memoryEntry.id, memoryEntry);
            }
            
            // 触发记忆添加事件
            if (this.eventSystem) {
                this.eventSystem.emit('memoryInjector:memoryAdded', {
                    id: memoryEntry.id,
                    type: type,
                    importance: memoryEntry.importance
                });
            }
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 添加记忆到数据库失败:', error);
        }
    }

    /**
     * 生成记忆ID
     */
    generateMemoryId() {
        return `memory_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * 获取当前对话上下文
     */
    async getCurrentContext() {
        try {
            // 获取最近的对话消息
            const chatHistory = this.context.chat || [];
            const recentMessages = chatHistory.slice(-5); // 最近5条消息
            
            return recentMessages.map(msg => msg.mes || msg.content || '').join(' ');
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取当前上下文失败:', error);
            return '';
        }
    }

    /**
     * 更新注入统计
     */
    updateInjectionStats(success, size) {
        if (success) {
            this.stats.successfulInjections++;
            this.injectionState.totalInjectedSize += size;
        } else {
            this.stats.failedInjections++;
        }
        
        // 计算成功率
        const totalAttempts = this.stats.successfulInjections + this.stats.failedInjections;
        this.injectionState.successRate = totalAttempts > 0 ? this.stats.successfulInjections / totalAttempts : 0;
    }

    /**
     * 更新记忆统计
     */
    updateMemoryStats() {
        this.stats.totalMemoryEntries = 
            this.memoryDatabase.sensoryMemory.size +
            this.memoryDatabase.shortTermMemory.size +
            this.memoryDatabase.longTermMemory.size +
            this.memoryDatabase.deepArchive.size;
    }

    /**
     * 启动记忆清理任务
     */
    startMemoryCleanupTask() {
        // 每30分钟清理一次过期的感知记忆
        setInterval(() => {
            this.cleanupExpiredMemories();
        }, 30 * 60 * 1000);
    }

    /**
     * 启动记忆压缩任务
     */
    startMemoryCompressionTask() {
        // 每小时压缩一次记忆
        setInterval(() => {
            this.compressMemoryDatabase();
        }, 60 * 60 * 1000);
    }

    /**
     * 启动记忆同步任务
     */
    startMemorySyncTask() {
        // 每10分钟同步一次记忆数据
        setInterval(() => {
            this.syncMemoryDatabase();
        }, 10 * 60 * 1000);
    }

    /**
     * 清理过期记忆
     */
    cleanupExpiredMemories() {
        try {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            // 清理超过1小时的感知记忆
            for (const [id, memory] of this.memoryDatabase.sensoryMemory) {
                if (memory.timestamp < oneHourAgo) {
                    this.memoryDatabase.sensoryMemory.delete(id);
                }
            }
            
            console.log('[AIMemoryDatabaseInjector] 🧹 记忆清理完成');
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆清理失败:', error);
        }
    }

    /**
     * 压缩记忆数据库
     */
    async compressMemoryDatabase() {
        try {
            console.log('[AIMemoryDatabaseInjector] 📦 开始压缩记忆数据库...');
            
            // 将低重要性的短期记忆移动到深度归档
            for (const [id, memory] of this.memoryDatabase.shortTermMemory) {
                if (memory.importance < 0.3) {
                    this.memoryDatabase.deepArchive.set(id, {
                        ...memory,
                        archived: true,
                        archivedAt: Date.now()
                    });
                    this.memoryDatabase.shortTermMemory.delete(id);
                }
            }
            
            this.stats.compressedEntries = this.memoryDatabase.deepArchive.size;
            console.log('[AIMemoryDatabaseInjector] 📦 记忆压缩完成');
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆压缩失败:', error);
        }
    }

    /**
     * 同步记忆数据库
     */
    async syncMemoryDatabase() {
        try {
            // 与其他记忆管理模块同步
            if (this.summaryManager) {
                await this.syncWithSummaryManager();
            }
            
            if (this.deepMemoryManager) {
                await this.syncWithDeepMemoryManager();
            }
            
            this.updateMemoryStats();
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 记忆同步失败:', error);
        }
    }

    /**
     * 与总结管理器同步
     */
    async syncWithSummaryManager() {
        try {
            if (!this.summaryManager) return;
            
            const recentSummaries = await this.summaryManager.getRecentSummaries(10);
            for (const summary of recentSummaries) {
                await this.addToMemoryDatabase('summary_sync', summary);
            }
        } catch (error) {
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 与总结管理器同步失败:', error.message);
        }
    }

    /**
     * 与深度记忆管理器同步
     */
    async syncWithDeepMemoryManager() {
        try {
            if (!this.deepMemoryManager) return;
            
            const importantMemories = await this.deepMemoryManager.getImportantMemories(5);
            for (const memory of importantMemories) {
                await this.addToMemoryDatabase('deep_sync', memory);
            }
        } catch (error) {
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 与深度记忆管理器同步失败:', error.message);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            if (!data || data.is_user !== false) return;
            
            // 分析AI回复内容，提取潜在的记忆信息
            const memoryContent = await this.extractMemoryFromMessage(data.mes);
            if (memoryContent) {
                await this.addToMemoryDatabase('ai_response', {
                    content: memoryContent,
                    importance: 0.6,
                    source: 'ai_response_analysis'
                });
            }
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 从消息中提取记忆
     */
    async extractMemoryFromMessage(message) {
        try {
            // 简单的关键词提取
            const keywords = ['记住', '重要', '决定', '发生', '改变', '关系', '感情'];
            const hasKeywords = keywords.some(keyword => message.includes(keyword));
            
            if (hasKeywords && message.length > 50) {
                return message.substring(0, 200) + (message.length > 200 ? '...' : '');
            }
            
            return null;
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 提取记忆失败:', error);
            return null;
        }
    }

    /**
     * 处理记忆更新事件
     */
    async handleMemoryUpdated(data) {
        try {
            if (data && data.memory) {
                await this.addToMemoryDatabase('external_update', data.memory);
            }
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理记忆更新事件失败:', error);
        }
    }

    /**
     * 处理总结创建事件
     */
    async handleSummaryCreated(data) {
        try {
            if (data && data.summary) {
                await this.addToMemoryDatabase('summary_created', {
                    content: data.summary.content,
                    importance: 0.8,
                    source: 'summary_manager'
                });
            }
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理总结创建事件失败:', error);
        }
    }

    /**
     * 处理深度记忆添加事件
     */
    async handleDeepMemoryAdded(data) {
        try {
            if (data && data.memory) {
                await this.addToMemoryDatabase('deep_memory_added', {
                    content: data.memory.content,
                    importance: 0.9,
                    source: 'deep_memory_manager'
                });
            }
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理深度记忆添加事件失败:', error);
        }
    }

    /**
     * 处理配置变更事件
     */
    async handleConfigChanged(data) {
        try {
            if (data && data.config) {
                // 更新注入器配置
                Object.assign(this.injectorConfig, data.config);
                console.log('[AIMemoryDatabaseInjector] ⚙️ 配置已更新');
            }
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理配置变更事件失败:', error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[AIMemoryDatabaseInjector] ❌ 错误 #${this.errorCount}:`, error);
        
        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('memoryInjector:error', {
                error: error.message,
                count: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            injectionState: this.injectionState,
            memoryStats: {
                sensoryMemory: this.memoryDatabase.sensoryMemory.size,
                shortTermMemory: this.memoryDatabase.shortTermMemory.size,
                longTermMemory: this.memoryDatabase.longTermMemory.size,
                deepArchive: this.memoryDatabase.deepArchive.size
            },
            stats: this.stats,
            config: this.injectorConfig
        };
    }

    /**
     * 手动触发记忆注入
     */
    async manualInject() {
        try {
            console.log('[AIMemoryDatabaseInjector] 🔧 手动触发记忆注入...');
            
            const memoryData = await this.prepareMemoryData();
            if (memoryData.length === 0) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 没有可注入的记忆数据');
                return { success: false, message: '没有可注入的记忆数据' };
            }
            
            const result = await this.injectMemoryToMainAPI(memoryData);
            return result;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 手动注入失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 清空记忆数据库
     */
    clearMemoryDatabase() {
        try {
            this.memoryDatabase.sensoryMemory.clear();
            this.memoryDatabase.shortTermMemory.clear();
            this.memoryDatabase.longTermMemory.clear();
            this.memoryDatabase.deepArchive.clear();
            
            this.memoryCache.clear();
            this.compressionCache.clear();
            
            this.updateMemoryStats();
            console.log('[AIMemoryDatabaseInjector] 🧹 记忆数据库已清空');
            
            return true;
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 清空记忆数据库失败:', error);
            return false;
        }
    }
}
