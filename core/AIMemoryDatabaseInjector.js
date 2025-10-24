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

        // 🚀 新增：SillyTavern原生事件系统引用（用于监听generation_started等主API事件）
        this.sillyTavernEventSource = null;
        
        // 记忆管理模块
        this.summaryManager = dependencies.summaryManager;
        this.aiMemorySummarizer = dependencies.aiMemorySummarizer;
        this.vectorizedMemoryRetrieval = dependencies.vectorizedMemoryRetrieval;
        this.deepMemoryManager = dependencies.deepMemoryManager;
        this.intelligentMemoryClassifier = dependencies.intelligentMemoryClassifier;
        this.aiMemoryDatabase = dependencies.aiMemoryDatabase || null; // 🗄️ 新增：AI记忆数据库
        
        // SillyTavern上下文
        this.context = null;
        
        // 🔧 修复：当前聊天ID（用于记忆隔离）
        this.currentChatId = null;
        
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
            enabled: true,                          // 🔧 修复：默认启用，具体由getUserSettings控制
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
            smartCompression: false,                // 🔧 修复：禁用智能压缩（避免调用API）
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
            totalMemories: 0,                   // 🔧 新增：总记忆数
            sensoryMemories: 0,                 // 🔧 新增：感知层记忆数
            shortTermMemories: 0,               // 🔧 新增：短期记忆数
            longTermMemories: 0,                // 🔧 新增：长期记忆数
            deepArchiveMemories: 0,             // 🔧 新增：深度归档记忆数
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

            // 🚀 新增：获取SillyTavern原生事件系统
            this.sillyTavernEventSource = this.context.eventSource;
            if (!this.sillyTavernEventSource) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 无法获取SillyTavern原生事件系统');
            } else {
                console.log('[AIMemoryDatabaseInjector] ✅ 已获取SillyTavern原生事件系统');
            }

            // 🔧 修复：延迟获取当前聊天ID（确保SillyTavern已完全初始化）
            await this.initCurrentChatId();

            // 🔧 修复：始终绑定事件监听器，即使功能禁用（在事件处理时再检查设置）
            // 这样可以确保用户在运行时启用功能后，事件监听器已经就绪
            this.bindEventListeners();

            // 🔧 修复：检查用户设置，如果所有记忆功能都禁用，跳过数据库初始化
            const userSettings = await this.getUserSettings();
            if (!userSettings.aiMemoryDatabaseEnabled) {
                console.log('[AIMemoryDatabaseInjector] ⏸️ AI记忆数据库功能已禁用，跳过数据库初始化（事件监听器已绑定）');
                this.initialized = true;
                return;
            }

            // 初始化记忆数据库
            await this.initMemoryDatabase();

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
     * 🔧 修复：初始化当前聊天ID（延迟获取，确保SillyTavern已完全初始化）
     */
    async initCurrentChatId() {
        try {
            // 方法1: 从UnifiedDataCore获取
            if (this.unifiedDataCore && typeof this.unifiedDataCore.getCurrentChatId === 'function') {
                this.currentChatId = this.unifiedDataCore.getCurrentChatId();
                if (this.currentChatId) {
                    console.log('[AIMemoryDatabaseInjector] 📍 从UnifiedDataCore获取聊天ID:', this.currentChatId);
                    return;
                }
            }

            // 方法2: 从SillyTavern上下文获取
            const context = SillyTavern?.getContext?.();
            if (context && context.chatId) {
                this.currentChatId = context.chatId;
                console.log('[AIMemoryDatabaseInjector] 📍 从SillyTavern上下文获取聊天ID:', this.currentChatId);
                return;
            }

            // 方法3: 延迟重试（等待SillyTavern初始化）
            console.log('[AIMemoryDatabaseInjector] ⏳ 聊天ID暂时不可用，将在首次使用时获取');
            this.currentChatId = null;

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 初始化聊天ID失败:', error);
            this.currentChatId = null;
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

            // 🔧 修复：优先从持久化存储加载当前聊天的记忆数据
            if (this.currentChatId) {
                console.log('[AIMemoryDatabaseInjector] 📥 从持久化存储加载聊天记忆数据...');
                await this.loadMemoryDataForChat(this.currentChatId);
            }

            // 从总结管理器获取记忆（作为补充）
            if (this.summaryManager) {
                try {
                    // 🔧 修复：使用正确的方法名获取总结记忆
                    let summaries = [];
                    if (typeof this.summaryManager.getEnhancedSummaryHistory === 'function') {
                        summaries = await this.summaryManager.getEnhancedSummaryHistory() || [];
                    } else if (typeof this.summaryManager.getSummaryHistory === 'function') {
                        summaries = await this.summaryManager.getSummaryHistory() || [];
                    }

                    // 限制数量
                    const recentSummaries = summaries.slice(0, 20);
                    for (const summary of recentSummaries) {
                        await this.addToMemoryDatabase('summary', summary);
                    }
                    console.log(`[AIMemoryDatabaseInjector] 📥 加载了 ${recentSummaries.length} 个总结记忆`);
                } catch (error) {
                    console.warn('[AIMemoryDatabaseInjector] ⚠️ 从总结管理器加载记忆失败:', error.message);
                }
            }

            // 从深度记忆管理器获取记忆（作为补充）
            if (this.deepMemoryManager) {
                try {
                    // 🔧 修复：使用正确的方法名获取深度记忆
                    const recentMemories = await this.deepMemoryManager.getRecentMemories?.(10) || [];
                    for (const memory of recentMemories) {
                        await this.addToMemoryDatabase('deep', memory);
                    }
                    console.log(`[AIMemoryDatabaseInjector] 📥 加载了 ${recentMemories.length} 个深度记忆`);
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
            
            console.log('[AIMemoryDatabaseInjector] 📊 初始记忆统计:', {
                总计: this.stats.totalMemories,
                感知层: this.stats.sensoryMemories,
                短期: this.stats.shortTermMemories,
                长期: this.stats.longTermMemories,
                归档: this.stats.deepArchiveMemories
            });
            
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
            // 🔧 修复：如果未启用，不绑定事件监听器
            if (!this.injectorConfig.enabled) {
                console.log('[AIMemoryDatabaseInjector] ⏸️ AI记忆数据库注入器已禁用，跳过事件监听器绑定');
                return;
            }

            // 🚀 优先绑定SillyTavern原生事件系统（用于主API事件）
            this.bindSillyTavernEvents();

            // 🔧 绑定内部事件系统（用于内部模块通信）
            this.bindInternalEvents();

            console.log('[AIMemoryDatabaseInjector] 🔗 所有事件监听器绑定完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 事件监听器绑定失败:', error);
        }
    }

    /**
     * 🚀 新增：绑定SillyTavern原生事件系统
     */
    bindSillyTavernEvents() {
        try {
            if (!this.sillyTavernEventSource) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ SillyTavern事件系统不可用，跳过原生事件绑定');
                return;
            }

            // 监听SillyTavern的生成开始事件（关键：主API调用检测）
            this.sillyTavernEventSource.on('generation_started', this.handleGenerationStarted.bind(this));

            // 监听SillyTavern的消息接收事件
            this.sillyTavernEventSource.on('message_received', this.handleMessageReceived.bind(this));

            // 🔧 修复：监听SillyTavern的消息删除事件
            this.sillyTavernEventSource.on('MESSAGE_DELETED', this.handleSTMessageDeleted.bind(this));

            // 🔧 修复：监听SillyTavern的消息重新生成事件（swipe）
            this.sillyTavernEventSource.on('MESSAGE_SWIPED', this.handleSTMessageSwiped.bind(this));

            console.log('[AIMemoryDatabaseInjector] ✅ SillyTavern原生事件监听器绑定完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ SillyTavern原生事件绑定失败:', error);
        }
    }

    /**
     * 🔧 绑定内部事件系统
     */
    bindInternalEvents() {
        try {
            if (!this.eventSystem) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 内部事件系统不可用，跳过内部事件绑定');
                return;
            }

            // 监听内部记忆更新事件
            this.eventSystem.on('memory:updated', this.handleMemoryUpdated.bind(this));
            this.eventSystem.on('summary:created', this.handleSummaryCreated.bind(this));
            this.eventSystem.on('deep_memory:added', this.handleDeepMemoryAdded.bind(this));

            // 监听配置变更事件
            this.eventSystem.on('config:changed', this.handleConfigChanged.bind(this));

            // 🔧 新增：监听消息删除事件
            this.eventSystem.on('MESSAGE_DELETED', this.handleMessageDeleted.bind(this));

            // 🔧 新增：监听消息重新生成事件
            this.eventSystem.on('MESSAGE_REGENERATED', this.handleMessageRegenerated.bind(this));

            // 🔧 修复：监听聊天切换事件（确保记忆数据隔离）
            this.eventSystem.on('chat:changed', this.handleChatSwitch.bind(this));

            console.log('[AIMemoryDatabaseInjector] ✅ 内部事件监听器绑定完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 内部事件绑定失败:', error);
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
            // 🔧 修复：由UnifiedVectorRetrieval统一管理，此处禁用向量检索
            console.log('[AIMemoryDatabaseInjector] ⚠️ 向量检索已由UnifiedVectorRetrieval统一管理，此模块不再执行检索');
            return;

            /* 以下代码已禁用，由UnifiedVectorRetrieval接管
            console.log('[AIMemoryDatabaseInjector] 🚀 生成开始，检测API类型并进行记忆注入...');

            // 🔧 修复1：检查用户是否启用了AI记忆数据库功能
            if (!this.injectorConfig.enabled) {
                console.log('[AIMemoryDatabaseInjector] ⚠️ AI记忆数据库注入器已禁用，跳过注入');
                return;
            }

            // 🔧 修复2：检查用户设置
            const userSettings = await this.getUserSettings();
            if (!userSettings.aiMemoryDatabaseEnabled) {
                console.log('[AIMemoryDatabaseInjector] ⚠️ 用户已禁用AI记忆数据库功能，跳过注入');
                return;
            }

            // 🔧 关键：只检测主API，不受自定义API影响
            const isMainAPI = await this.detectMainAPI();

            if (!isMainAPI) {
                console.log('[AIMemoryDatabaseInjector] 🚫 非主API请求，跳过记忆注入');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] ✅ 检测到主API请求，开始注入AI记忆数据库...');

            // 准备记忆数据
            const memoryData = await this.prepareMemoryData();
            */
            
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
            console.log('[AIMemoryDatabaseInjector] 🔍 开始主API检测...');

            // 🚀 方法1：检查当前使用的API类型
            const currentAPI = this.context.main_api;
            if (currentAPI && currentAPI !== 'custom') {
                console.log(`[AIMemoryDatabaseInjector] ✅ 检测到主API类型: ${currentAPI}`);
                return true;
            }

            // 🚀 方法2：检查是否有active的主API配置
            const mainAPIs = ['openai', 'claude', 'gemini', 'koboldhorde', 'textgenerationwebui', 'novel', 'ooba'];
            for (const apiType of mainAPIs) {
                if (this.context[`${apiType}_setting`] && this.context[`${apiType}_setting`].active) {
                    console.log(`[AIMemoryDatabaseInjector] ✅ 检测到活跃的主API: ${apiType}`);
                    return true;
                }
            }

            // 🚀 方法3：检查生成请求的来源
            if (this.context.is_send_press && !this.context.is_custom_api_active) {
                console.log('[AIMemoryDatabaseInjector] ✅ 检测到主API发送请求');
                return true;
            }

            // 🚀 方法4：检测generation_started事件来源（新增）
            // 如果是从SillyTavern原生事件系统触发的，通常表示主API调用
            if (this.sillyTavernEventSource) {
                console.log('[AIMemoryDatabaseInjector] ✅ 通过SillyTavern原生事件系统触发，认定为主API');
                return true;
            }

            // 🚀 方法5：测试环境兼容性检测（新增）
            // 在测试环境或开发环境中，如果没有明确的主API配置，但有聊天记录，则认为是主API
            if (this.context.chat && this.context.chat.length > 0) {
                console.log('[AIMemoryDatabaseInjector] ✅ 检测到聊天记录，测试环境下认定为主API');
                return true;
            }

            // 🚀 方法6：备用检测 - 检查自定义API Hook状态
            const hasCustomAPIHook = this.checkCustomAPIHook();
            if (!hasCustomAPIHook) {
                console.log('[AIMemoryDatabaseInjector] ✅ 未检测到自定义API Hook，默认为主API');
                return true;
            }

            console.log('[AIMemoryDatabaseInjector] 🚫 所有检测方法均未确认主API状态，跳过注入');
            return false;

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 主API检测失败:', error);
            // 出错时默认认为是主API，确保记忆注入不被中断
            console.log('[AIMemoryDatabaseInjector] ⚠️ 检测失败，默认认定为主API以确保功能可用');
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

            // 🗄️ 新增：优先使用AI记忆数据库（智能检索）
            if (this.aiMemoryDatabase && this.aiMemoryDatabase.initialized && this.aiMemoryDatabase.config.enabled) {
                console.log('[AIMemoryDatabaseInjector] 🗄️ 使用AI记忆数据库智能检索记忆...');
                
                try {
                    // 获取高重要性和关键记忆
                    const criticalMemories = this.aiMemoryDatabase.getMemoriesByImportance('critical', 5);
                    const highMemories = this.aiMemoryDatabase.getMemoriesByImportance('high', 10);
                    
                    const allMemories = [...criticalMemories, ...highMemories];
                    
                    console.log(`[AIMemoryDatabaseInjector] ✅ 从AI记忆数据库获取${allMemories.length}条记忆`);
                    
                    return allMemories.map(memory => ({
                        type: memory.layer || 'database',
                        content: memory.content,
                        importance: memory.importance,
                        timestamp: memory.timestamp,
                        keywords: memory.keywords,
                        category: memory.category,
                        source: 'ai_memory_database'
                    }));
                } catch (error) {
                    console.error('[AIMemoryDatabaseInjector] ❌ 从AI记忆数据库获取记忆失败:', error);
                }
            }

            // 🧠 收集不同类型的记忆

            // 🔧 修复：优先从DeepMemoryManager获取记忆（真正的记忆数据）
            if (this.deepMemoryManager && this.deepMemoryManager.initialized) {
                console.log('[AIMemoryDatabaseInjector] 🧠 从DeepMemoryManager获取记忆...');

                try {
                    // 获取DeepMemoryManager的记忆层
                    const deepMemoryLayers = this.deepMemoryManager.memoryLayers;

                    if (deepMemoryLayers) {
                        // 1. 感知层记忆（最新的）
                        if (deepMemoryLayers.sensory && deepMemoryLayers.sensory.size > 0) {
                            for (const [id, memory] of deepMemoryLayers.sensory) {
                                const content = memory.content || memory.summary || String(memory);
                                
                                // 🔧 严重修复：过滤原始AI消息（包含update指令的）
                                if (this.isRawAIMessage(content)) {
                                    console.log('[AIMemoryDatabaseInjector] 🚫 跳过感知层的原始AI消息片段');
                                    continue;
                                }
                                
                                memoryEntries.push({
                                    type: 'sensory',
                                    content: content,
                                    importance: memory.importance || 0.9,
                                    timestamp: memory.timestamp || Date.now(),
                                    source: 'deep_memory_sensory'
                                });
                            }
                            console.log(`[AIMemoryDatabaseInjector] ✅ 获取感知层记忆: ${memoryEntries.filter(m => m.type === 'sensory').length} 条（已过滤）`);
                        }

                        // 2. 短期记忆
                        if (deepMemoryLayers.shortTerm && deepMemoryLayers.shortTerm.size > 0) {
                            for (const [id, memory] of deepMemoryLayers.shortTerm) {
                                const content = memory.content || memory.summary || String(memory);
                                
                                // 🔧 严重修复：过滤原始AI消息
                                if (this.isRawAIMessage(content)) {
                                    console.log('[AIMemoryDatabaseInjector] 🚫 跳过短期层的原始AI消息片段');
                                    continue;
                                }
                                
                                memoryEntries.push({
                                    type: 'short_term',
                                    content: content,
                                    importance: memory.importance || 0.7,
                                    timestamp: memory.timestamp || Date.now(),
                                    source: 'deep_memory_short_term'
                                });
                            }
                            console.log(`[AIMemoryDatabaseInjector] ✅ 获取短期记忆: ${memoryEntries.filter(m => m.type === 'short_term').length} 条（已过滤）`);
                        }

                        // 3. 长期记忆（最重要的）
                        if (deepMemoryLayers.longTerm && deepMemoryLayers.longTerm.size > 0) {
                            for (const [id, memory] of deepMemoryLayers.longTerm) {
                                const content = memory.content || memory.summary || String(memory);
                                
                                // 🔧 严重修复：过滤原始AI消息
                                if (this.isRawAIMessage(content)) {
                                    console.log('[AIMemoryDatabaseInjector] 🚫 跳过长期层的原始AI消息片段');
                                    continue;
                                }
                                
                                memoryEntries.push({
                                    type: 'long_term',
                                    content: content,
                                    importance: memory.importance || 0.8,
                                    timestamp: memory.timestamp || Date.now(),
                                    source: 'deep_memory_long_term'
                                });
                            }
                            console.log(`[AIMemoryDatabaseInjector] ✅ 获取长期记忆: ${memoryEntries.filter(m => m.type === 'long_term').length} 条（已过滤）`);
                        }
                    }
                } catch (deepMemoryError) {
                    console.error('[AIMemoryDatabaseInjector] ❌ 从DeepMemoryManager获取记忆失败:', deepMemoryError);
                }
            } else {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ DeepMemoryManager不可用，使用备用记忆源');

                // 备用方案：使用本地记忆数据库
                // 🚀 0. 感知层记忆（最新的重要记忆，优先级最高）
                const sensoryMemories = await this.getSensoryMemories();
                memoryEntries.push(...sensoryMemories);

                // 1. 短期记忆（当前会话重要信息）
                const shortTermMemories = await this.getShortTermMemories();
                memoryEntries.push(...shortTermMemories);

                // 2. 长期记忆（持久化重要记忆）
                const longTermMemories = await this.getLongTermMemories();
                memoryEntries.push(...longTermMemories);
            }

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
     * 🚀 新增：获取感知层记忆
     */
    async getSensoryMemories() {
        try {
            const memories = [];

            // 从感知层记忆数据库获取
            for (const [key, memory] of this.memoryDatabase.sensoryMemory) {
                // 感知层记忆通常都比较重要，设置较低的阈值
                if (memory.importance >= 0.1) {
                    memories.push({
                        type: 'sensory',
                        content: memory.content,
                        importance: memory.importance,
                        timestamp: memory.timestamp,
                        source: memory.source || 'sensory_memory'
                    });
                }
            }

            // 按重要性排序，取前5条
            memories.sort((a, b) => b.importance - a.importance);
            const topMemories = memories.slice(0, 5);

            console.log(`[AIMemoryDatabaseInjector] 🧠 获取感知层记忆: ${topMemories.length} 条`);
            return topMemories;

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取感知层记忆失败:', error);
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
                console.log('[AIMemoryDatabaseInjector] ⚠️ 向量化记忆检索模块不可用');
                return [];
            }

            // 🚀 修复：使用实际存在的方法进行语义搜索
            const currentContext = await this.getCurrentContext();
            if (typeof this.vectorizedMemoryRetrieval.semanticSearch === 'function') {
                const searchResult = await this.vectorizedMemoryRetrieval.semanticSearch(currentContext, 5);

                // 🚀 修复：确保searchResult是数组格式
                let relevantMemories = [];
                if (Array.isArray(searchResult)) {
                    relevantMemories = searchResult;
                } else if (searchResult && searchResult.results && Array.isArray(searchResult.results)) {
                    relevantMemories = searchResult.results;
                } else if (searchResult && typeof searchResult === 'object') {
                    // 如果是单个对象，包装成数组
                    relevantMemories = [searchResult];
                } else {
                    console.log('[AIMemoryDatabaseInjector] ⚠️ 向量化搜索返回格式不正确，跳过');
                    return [];
                }

                const memories = relevantMemories.map(memory => ({
                    type: 'vectorized',
                    content: memory.content || memory.text || '',
                    importance: memory.similarity || memory.score || memory.relevance || 0.5,
                    timestamp: memory.timestamp || Date.now(),
                    source: 'vectorized_memory'
                }));

                console.log(`[AIMemoryDatabaseInjector] 🔍 获取向量化记忆: ${memories.length} 条`);
                return memories;
            } else {
                console.log('[AIMemoryDatabaseInjector] ⚠️ 向量化记忆检索方法不可用，跳过');
                return [];
            }

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
                console.log('[AIMemoryDatabaseInjector] ⚠️ 智能记忆分类器模块不可用');
                return [];
            }

            // 🚀 修复：智能分类器没有getHighPriorityMemories方法，暂时跳过
            // 未来可以实现基于分类器状态的记忆获取逻辑
            console.log('[AIMemoryDatabaseInjector] ⚠️ 智能分类记忆功能暂未实现，跳过');
            return [];

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
            // 🚀 修复：为感知层记忆使用更低的阈值，确保重要记忆能够被注入
            const adjustedThreshold = Math.min(this.injectorConfig.priorityThreshold, 0.2);
            const highPriorityMemories = uniqueMemories.filter(
                memory => memory.importance >= adjustedThreshold
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
            
            // 🔧 关键修复：禁用智能压缩（调用API）
            // 使用基础压缩方法代替，避免频繁调用API导致阻塞
            // 智能压缩会调用AIMemorySummarizer.summarizeText() -> SummaryManager.callSummaryAPI()
            // 这会导致每次压缩记忆都调用API，严重阻塞消息发送
            
            // 3. 使用智能压缩（已禁用，避免API调用）
            // if (this.aiMemorySummarizer) {
            //     try {
            //         const summarized = await this.aiMemorySummarizer.summarizeText(compressed, {
            //             maxLength: Math.floor(compressed.length * this.injectorConfig.compressionRatio),
            //             preserveKeyInfo: true
            //         });
            //         if (summarized && summarized.length < compressed.length) {
            //             compressed = summarized;
            //         }
            //     } catch (error) {
            //         console.warn('[AIMemoryDatabaseInjector] ⚠️ AI压缩失败，使用基础压缩:', error.message);
            //     }
            // }
            
            console.log('[AIMemoryDatabaseInjector] ℹ️ 使用基础压缩（不调用API），避免阻塞');
            
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
     * 🎯 RAG优化：采用SillyTavern最佳实践的注入模板
     * 🔧 严重BUG修复：去重 + 过滤原始AI消息 + 限制长度
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
            
            // 🔧 新增：去重Set（基于内容哈希）
            const seenContents = new Set();
            
            // 🔧 新增：过滤和限制记忆
            let processedCount = 0;
            const maxMemories = 10; // 最多10条记忆，防止过多重复
            
            // 分类记忆内容
            for (const memory of memoryData) {
                // 🔧 新增：跳过已达到限制
                if (processedCount >= maxMemories) {
                    console.log(`[AIMemoryDatabaseInjector] ⚠️ 已达到记忆数量限制 (${maxMemories}条)，跳过剩余记忆`);
                    break;
                }
                
                // 🔧 新增：验证记忆内容质量
                if (!memory.content || typeof memory.content !== 'string') {
                    console.log('[AIMemoryDatabaseInjector] ⚠️ 跳过无效记忆（无content）');
                    continue;
                }
                
                // 🔧 严重修复：过滤掉原始AI消息片段
                // 如果记忆内容包含"update personal"等信息栏指令，说明这是原始AI消息，不是总结
                if (memory.content.includes('update personal') || 
                    memory.content.includes('update organization') ||
                    memory.content.includes('update ') && memory.content.length > 500) {
                    console.log('[AIMemoryDatabaseInjector] 🚫 跳过原始AI消息片段（包含update指令或过长）');
                    continue;
                }
                
                // 🔧 新增：过滤过长的内容（超过800字符的可能是原始消息）
                if (memory.content.length > 800) {
                    console.log(`[AIMemoryDatabaseInjector] 🚫 跳过过长内容 (${memory.content.length}字符 > 800)`);
                    continue;
                }
                
                // 🔧 新增：内容去重
                const contentHash = memory.content.substring(0, 100); // 使用前100字符作为哈希
                if (seenContents.has(contentHash)) {
                    console.log('[AIMemoryDatabaseInjector] 🚫 跳过重复记忆');
                    continue;
                }
                seenContents.add(contentHash);
                
                const category = this.categorizeMemory(memory);
                
                // 🗄️ 优化：如果记忆来自AI记忆数据库，包含关键词和重要性信息
                let formattedContent = `• ${memory.content}`;
                if (memory.source === 'ai_memory_database') {
                    const importance = memory.importance ? `[重要性:${(memory.importance * 100).toFixed(0)}%]` : '';
                    const keywords = memory.keywords && memory.keywords.length > 0 ? ` #${memory.keywords.join(' #')}` : '';
                    formattedContent = `• ${memory.content} ${importance}${keywords}`;
                }
                
                if (sections[category]) {
                    sections[category].push(formattedContent);
                } else {
                    sections['重要记忆'].push(formattedContent);
                }
                
                processedCount++;
            }
            
            console.log(`[AIMemoryDatabaseInjector] 📊 格式化完成: 总共${memoryData.length}条，处理${processedCount}条，去重${memoryData.length - processedCount}条`);
            
            // 构建最终格式
            const formattedSections = [];
            for (const [sectionName, items] of Object.entries(sections)) {
                if (items.length > 0) {
                    formattedSections.push(`\n**${sectionName}**\n${items.join('\n')}`);
                }
            }
            
            // 🎯 RAG优化：使用SillyTavern最佳实践的注入模板
            // 参考：SillyTavern Data Bank推荐的注入模板格式
            
            // 🗄️ 检查是否包含AI记忆数据库的记忆
            const hasAIMemoryDatabase = memoryData.some(m => m.source === 'ai_memory_database');
            
            let header = `以下是可能相关的先前事件的记忆：
<回忆>`;
            
            let footer = `</回忆>

这些记忆以第三人称视角、过去时态记录。{{char}}能够回忆起这些记忆，并在适当时自然地提及它们。
记忆可能与当前对话相关，也可能不相关，请根据上下文判断是否使用。`;

            // 🗄️ 如果包含AI记忆数据库记忆，添加额外说明
            if (hasAIMemoryDatabase) {
                footer += `

【AI记忆数据库提示】
带有 # 标签的记忆来自智能索引系统，已按关键词和重要性组织。
你可以参考这些关键词来理解记忆的核心要点。`;
            }
            
            return header + formattedSections.join('\n') + '\n' + footer;
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 格式化记忆内容失败:', error);
            return memoryData.map(m => m.content).join('\n\n');
        }
    }

    /**
     * 🔧 新增：判断是否为原始AI消息（而非记忆总结）
     */
    isRawAIMessage(content) {
        if (!content || typeof content !== 'string') {
            return true; // 无效内容视为需要过滤
        }
        
        // 检测特征：原始AI消息通常包含以下特征
        const rawMessageIndicators = [
            content.includes('update personal'),
            content.includes('update organization'),
            content.includes('update world'),
            content.includes('update tasks'),
            content.length > 800, // 记忆总结通常不超过800字符
            content.split('\n').length > 15, // 记忆总结通常不超过15行
            // 🔧 新增：检测是否包含大量叙事性内容（可能是原始消息）
            /他.*走.*过去|她.*说.*道|张.*凡.*想|陈.*希.*感觉/.test(content) && content.length > 200
        ];
        
        // 如果匹配任何一个指标，认为是原始消息
        const isRaw = rawMessageIndicators.filter(Boolean).length >= 1;
        
        if (isRaw) {
            console.log('[AIMemoryDatabaseInjector] 🚫 检测到原始AI消息特征，准备过滤');
        }
        
        return isRaw;
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
                tags: memoryData.tags || [],
                category: memoryData.category || '未分类',
                metadata: memoryData.metadata || {}
            };
            
            console.log('[AIMemoryDatabaseInjector] 📝 准备添加记忆:', {
                id: memoryEntry.id,
                type: memoryEntry.type,
                importance: memoryEntry.importance,
                contentLength: memoryEntry.content?.length,
                tags: memoryEntry.tags
            });
            
            // 🔧 修复：添加到Injector内部数据库
            if (memoryEntry.importance >= 0.8) {
                this.memoryDatabase.longTermMemory.set(memoryEntry.id, memoryEntry);
            } else if (memoryEntry.importance >= 0.5) {
                this.memoryDatabase.shortTermMemory.set(memoryEntry.id, memoryEntry);
            } else {
                this.memoryDatabase.sensoryMemory.set(memoryEntry.id, memoryEntry);
            }
            
            // 🔧 修复：同时添加到真正的AIMemoryDatabase模块
            if (this.aiMemoryDatabase && typeof this.aiMemoryDatabase.indexMemory === 'function') {
                await this.aiMemoryDatabase.indexMemory(memoryEntry.id, memoryEntry, 'ai_memory_summary');
                console.log('[AIMemoryDatabaseInjector] ✅ 记忆已索引到AIMemoryDatabase');
            } else {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ AIMemoryDatabase不可用，无法索引记忆');
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
        
        // 🔧 修复：同时更新细分统计
        this.stats.sensoryMemories = this.memoryDatabase.sensoryMemory.size;
        this.stats.shortTermMemories = this.memoryDatabase.shortTermMemory.size;
        this.stats.longTermMemories = this.memoryDatabase.longTermMemory.size;
        this.stats.deepArchiveMemories = this.memoryDatabase.deepArchive.size;
        this.stats.totalMemories = this.stats.totalMemoryEntries;
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
            
            // 🔧 修复：使用正确的方法名和安全调用
            let summaries = [];
            if (typeof this.summaryManager.getEnhancedSummaryHistory === 'function') {
                // 优先使用增强的总结历史（包含AI记忆总结）
                summaries = await this.summaryManager.getEnhancedSummaryHistory();
            } else if (typeof this.summaryManager.getSummaryHistory === 'function') {
                // 降级到基础总结历史
                summaries = await this.summaryManager.getSummaryHistory();
            } else {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 总结管理器没有可用的获取方法');
                return;
            }
            
            // 限制数量并处理
            const recentSummaries = summaries.slice(0, 10);
            for (const summary of recentSummaries) {
                await this.addToMemoryDatabase('summary_sync', summary);
            }
            
            console.log(`[AIMemoryDatabaseInjector] ✅ 成功同步 ${recentSummaries.length} 个总结记忆`);
            
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
            
            // 🔧 修复：使用正确的方法名和安全调用
            if (typeof this.deepMemoryManager.getRecentMemories !== 'function') {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 深度记忆管理器没有getRecentMemories方法');
                return;
            }
            
            const recentMemories = await this.deepMemoryManager.getRecentMemories(5);
            for (const memory of recentMemories) {
                await this.addToMemoryDatabase('deep_sync', memory);
            }
            
            console.log(`[AIMemoryDatabaseInjector] ✅ 成功同步 ${recentMemories.length} 个深度记忆`);
            
        } catch (error) {
            console.warn('[AIMemoryDatabaseInjector] ⚠️ 与深度记忆管理器同步失败:', error.message);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 📥 接收到消息接收事件，数据类型:', typeof data, '数据:', data);

            // 🔧 修复：SillyTavern传递的是消息索引，需要从聊天数组中获取消息
            let message;
            if (typeof data === 'number') {
                // data 是消息索引
                const chat = window.SillyTavern?.getContext?.()?.chat;
                if (chat && chat[data]) {
                    message = chat[data];
                }
            } else {
                // data 是消息对象
                message = data?.message || data;
            }

            // 检查是否是AI消息
            if (!message || message.is_user !== false) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 跳过用户消息或无效消息');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] 📥 接收到AI消息，开始提取记忆总结...');
            console.log('[AIMemoryDatabaseInjector] 📝 消息内容长度:', message.mes?.length);

            // 🔧 修复：使用正确的方法提取AI记忆总结
            const memorySummary = await this.extractAIMemorySummaryFromMessage(message.mes);

            if (memorySummary) {
                console.log('[AIMemoryDatabaseInjector] ✅ 成功提取AI记忆总结');

                // 🔧 新增：自动检测当前消息的楼层号
                const chat = window.SillyTavern?.getContext?.()?.chat;
                let floorNumber = 0;
                if (chat && Array.isArray(chat)) {
                    // 找到当前消息在聊天数组中的索引
                    const messageIndex = chat.findIndex(msg => msg === message);
                    if (messageIndex !== -1) {
                        floorNumber = messageIndex + 1; // 楼层号从1开始
                    } else {
                        // 如果找不到，使用聊天长度作为楼层号
                        floorNumber = chat.length;
                    }
                }

                console.log('[AIMemoryDatabaseInjector] 📍 当前消息楼层号:', floorNumber);

                // 将记忆总结添加到数据库
                await this.addToMemoryDatabase('ai_memory_summary', {
                    content: memorySummary.content,
                    importance: memorySummary.importance || 0.8,
                    tags: memorySummary.tags || [],
                    category: memorySummary.category || '角色互动',
                    source: 'ai_memory_summary',
                    floorNumber: floorNumber, // 🔧 新增：楼层号
                    timestamp: Date.now()
                });

                console.log('[AIMemoryDatabaseInjector] ✅ AI记忆总结已添加到数据库');
                console.log('[AIMemoryDatabaseInjector] 📊 数据库统计:', {
                    总记忆数: this.aiMemoryDatabase?.stats?.totalMemories,
                    总关键词数: this.aiMemoryDatabase?.stats?.totalKeywords
                });

                // 🔮 新增：触发AI记忆总结创建事件，供向量化总结管理器使用
                if (this.eventSystem) {
                    this.eventSystem.emit('ai-summary:created', {
                        summary: {
                            content: memorySummary.content,
                            importance: memorySummary.importance || 0.8,
                            tags: memorySummary.tags || [],
                            category: memorySummary.category || '角色互动',
                            floorNumber: floorNumber // 🔧 新增：楼层号
                        },
                        floorNumber: floorNumber, // 🔧 新增：楼层号
                        messageCount: 1,
                        importantCount: 1,
                        timestamp: Date.now(),
                        source: 'ai_memory_database_injector'
                    });
                    console.log('[AIMemoryDatabaseInjector] ✅ AI记忆总结事件已触发，楼层号:', floorNumber);
                }
            } else {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 消息中未找到AI记忆总结标签');
                console.log('[AIMemoryDatabaseInjector] 📝 消息预览:', message.mes?.substring(0, 200));
            }

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 🔧 修复：从消息中提取AI记忆总结（增强版，支持被HTML标签包裹）
     */
    async extractAIMemorySummaryFromMessage(message) {
        try {
            if (!message || typeof message !== 'string') {
                return null;
            }

            // 🔧 修复：使用indexOf方法精确提取，支持被HTML标签包裹的情况

            // 🔧 优先尝试小写标签（当前AI实际返回的格式）
            let startTag = '<ai_memory_summary>';
            let endTag = '</ai_memory_summary>';
            let startIndex = message.indexOf(startTag);

            if (startIndex !== -1) {
                const endIndex = message.indexOf(endTag, startIndex);
                if (endIndex !== -1) {
                    const innerContent = message.substring(startIndex + startTag.length, endIndex).trim();

                    // 🔧 修复：查找包含有效JSON的HTML注释
                    // 策略：找到所有HTML注释，尝试解析每一个，直到成功
                    let searchPos = 0;
                    while (true) {
                        const commentStart = innerContent.indexOf('<!--', searchPos);
                        if (commentStart === -1) break;
                        
                        const commentEnd = innerContent.indexOf('-->', commentStart);
                        if (commentEnd === -1) break;
                        
                        try {
                            let jsonContent = innerContent.substring(commentStart + 4, commentEnd).trim();
                            
                            // 🔧 修复：如果JSON内容缺少外层大括号，添加它们
                            if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
                                jsonContent = '{' + jsonContent + '}';
                            }
                            
                            // 尝试解析为JSON
                            const summary = JSON.parse(jsonContent);
                            // 验证是否是AI记忆总结格式
                            if (summary && (summary.type === 'ai_memory' || summary.content)) {
                                console.log('[AIMemoryDatabaseInjector] ✅ 检测到AI记忆总结（小写标签）');
                                return summary;
                            }
                        } catch (parseError) {
                            // 这个注释不是有效的JSON，继续查找下一个
                        }
                        
                        searchPos = commentEnd + 3;
                    }
                }
            }

            // 尝试大写标签（向后兼容）
            startTag = '<AI_MEMORY_SUMMARY>';
            endTag = '</AI_MEMORY_SUMMARY>';
            startIndex = message.indexOf(startTag);

            if (startIndex !== -1) {
                const endIndex = message.indexOf(endTag, startIndex);
                if (endIndex !== -1) {
                    const innerContent = message.substring(startIndex + startTag.length, endIndex).trim();

                    // 🔧 修复：查找包含有效JSON的HTML注释
                    let searchPos = 0;
                    while (true) {
                        const commentStart = innerContent.indexOf('<!--', searchPos);
                        if (commentStart === -1) break;
                        
                        const commentEnd = innerContent.indexOf('-->', commentStart);
                        if (commentEnd === -1) break;
                        
                        try {
                            let jsonContent = innerContent.substring(commentStart + 4, commentEnd).trim();
                            
                            // 🔧 修复：如果JSON内容缺少外层大括号，添加它们
                            if (!jsonContent.startsWith('{') && !jsonContent.startsWith('[')) {
                                jsonContent = '{' + jsonContent + '}';
                            }
                            
                            const summary = JSON.parse(jsonContent);
                            if (summary && (summary.type === 'ai_memory' || summary.content)) {
                                console.log('[AIMemoryDatabaseInjector] ✅ 检测到AI记忆总结（大写标签）');
                                return summary;
                            }
                        } catch (parseError) {
                            // 这个注释不是有效的JSON，继续查找下一个
                        }
                        
                        searchPos = commentEnd + 3;
                    }
                }
            }

            // 🔧 向后兼容：尝试旧格式 [AI_MEMORY_SUMMARY]...[/AI_MEMORY_SUMMARY]
            const oldFormatRegex = /\[AI_MEMORY_SUMMARY\]([\s\S]*?)\[\/AI_MEMORY_SUMMARY\]/;
            const oldMatch = message.match(oldFormatRegex);

            if (oldMatch && oldMatch[1]) {
                try {
                    const jsonContent = oldMatch[1].trim();
                    const summary = JSON.parse(jsonContent);
                    console.log('[AIMemoryDatabaseInjector] ⚠️ 检测到旧格式AI记忆总结（建议升级到新格式）');
                    return summary;
                } catch (parseError) {
                    console.error('[AIMemoryDatabaseInjector] ❌ 解析JSON失败:', parseError);
                }
            }

            return null;

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 提取AI记忆总结失败:', error);
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
     * 🔧 新增：处理消息删除事件
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🗑️ 处理消息删除事件');

            if (!this.initialized) return;

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 跳过记忆回溯（删除的是用户消息）');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] 🔄 开始记忆数据回溯...');

            // 清理最近的记忆数据
            await this.clearRecentMemoryData();

            console.log('[AIMemoryDatabaseInjector] ✅ 消息删除记忆回溯完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息重新生成事件
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🔄 处理消息重新生成事件');

            if (!this.initialized) return;

            console.log('[AIMemoryDatabaseInjector] 🔄 开始记忆数据回溯（重新生成）...');

            // 清理最近的记忆数据
            await this.clearRecentMemoryData();

            console.log('[AIMemoryDatabaseInjector] ✅ 消息重新生成记忆回溯完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理消息重新生成事件失败:', error);
        }
    }

    /**
     * 🔧 新增：清理最近的记忆数据
     */
    async clearRecentMemoryData() {
        try {
            console.log('[AIMemoryDatabaseInjector] 🧹 清理最近的记忆数据...');

            // 🔧 修复：更彻底地清理记忆数据
            // 1. 清理所有感知记忆（最新的记忆）
            const sensoryCount = this.memoryDatabase.sensoryMemory.size;
            this.memoryDatabase.sensoryMemory.clear();

            // 2. 清理短期记忆中的最近记忆
            const now = Date.now();
            const recentThreshold = 5 * 60 * 1000; // 🔧 修复：缩短到5分钟（原来30分钟太长）
            let shortTermCleared = 0;

            for (const [id, memory] of this.memoryDatabase.shortTermMemory) {
                if (now - memory.timestamp < recentThreshold) {
                    this.memoryDatabase.shortTermMemory.delete(id);
                    shortTermCleared++;
                }
            }

            // 3. 🆕 清理长期记忆中的最近记忆（重要改进）
            const longTermThreshold = 10 * 60 * 1000; // 10分钟内的长期记忆也清理
            let longTermCleared = 0;

            for (const [id, memory] of this.memoryDatabase.longTermMemory) {
                if (now - memory.timestamp < longTermThreshold) {
                    this.memoryDatabase.longTermMemory.delete(id);
                    longTermCleared++;
                }
            }

            console.log(`[AIMemoryDatabaseInjector] ✅ 已清理记忆: 感知记忆 ${sensoryCount} 个, 短期记忆 ${shortTermCleared} 个, 长期记忆 ${longTermCleared} 个`);

            // 🆕 更新记忆统计
            this.updateMemoryStats();

            // 🆕 触发记忆清理事件
            if (this.eventSystem) {
                this.eventSystem.emit('memoryInjector:memoryCleared', {
                    sensoryCount,
                    shortTermCleared,
                    longTermCleared,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 清理最近记忆失败:', error);
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
     * 🔧 新增：获取用户设置
     */
    async getUserSettings() {
        try {
            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement) {
                    const enhancement = memoryEnhancement.enhancement || {};
                    const semantic = memoryEnhancement.semantic || {};
                    const deep = memoryEnhancement.deep || {};
                    const aiDatabase = memoryEnhancement.aiDatabase || {};

                    return {
                        // 🔧 修复：AI记忆数据库注入器启用条件 - 检查深度记忆管理、AI数据库或AI记忆总结是否启用
                        aiMemoryDatabaseEnabled:
                            deep.enabled === true ||
                            aiDatabase.enabled === true ||
                            enhancement.memoryMaintenance === true ||
                            enhancement.contextualRetrieval === true ||
                            enhancement.userProfile === true ||
                            enhancement.knowledgeGraph === true ||
                            enhancement.timeAware === true ||
                            enhancement.stIntegration === true ||
                            semantic?.enabled === true ||
                            memoryEnhancement.ai?.enabled === true || // 🔧 新增：AI记忆总结功能
                            memoryEnhancement.summary?.aiSummary === true ||
                            memoryEnhancement.summary?.aiMemorySummary === true,

                        // AI记忆总结器：跟随总结功能或AI记忆总结
                        aiMemorySummarizerEnabled:
                            memoryEnhancement.summary?.aiSummary === true ||
                            memoryEnhancement.summary?.aiMemorySummary === true ||
                            memoryEnhancement.ai?.enabled === true, // 🔧 新增：AI记忆总结功能

                        // 语义搜索：检查向量化记忆检索
                        semanticSearchEnabled: semantic?.enabled === true,

                        // 🔧 修复：深度记忆管理器 - 使用deep.enabled
                        deepMemoryManagerEnabled: deep.enabled === true,

                        // 🔧 修复：智能记忆分类器 - 从classifier读取
                        intelligentMemoryClassifierEnabled: memoryEnhancement.classifier?.enabled === true,

                        // 记忆增强核心：检查是否有任何功能启用
                        memoryEnhancementCoreEnabled:
                            deep.enabled === true ||
                            aiDatabase.enabled === true ||
                            memoryEnhancement.classifier?.enabled === true ||
                            enhancement.memoryMaintenance === true ||
                            enhancement.contextualRetrieval === true ||
                            enhancement.userProfile === true ||
                            enhancement.knowledgeGraph === true ||
                            enhancement.timeAware === true ||
                            enhancement.stIntegration === true ||
                            semantic?.enabled === true
                    };
                }
            } catch (error) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从UnifiedDataCore获取用户设置
            if (this.unifiedDataCore && typeof this.unifiedDataCore.getData === 'function') {
                const settings = await this.unifiedDataCore.getData('user_settings', 'global');
                if (settings) {
                    return {
                        aiMemoryDatabaseEnabled: settings.aiMemoryDatabaseEnabled !== false,
                        aiMemorySummarizerEnabled: settings.aiMemorySummarizerEnabled !== false,
                        semanticSearchEnabled: settings.semanticSearchEnabled !== false,
                        deepMemoryManagerEnabled: settings.deepMemoryManagerEnabled !== false,
                        intelligentMemoryClassifierEnabled: settings.intelligentMemoryClassifierEnabled !== false,
                        memoryEnhancementCoreEnabled: settings.memoryEnhancementCoreEnabled !== false
                    };
                }
            }

            // 🔧 修复：默认全部禁用（而不是启用）
            return {
                aiMemoryDatabaseEnabled: false,
                aiMemorySummarizerEnabled: false,
                semanticSearchEnabled: false,
                deepMemoryManagerEnabled: false,
                intelligentMemoryClassifierEnabled: false,
                memoryEnhancementCoreEnabled: false
            };

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 获取用户设置失败:', error);
            // 🔧 修复：出错时默认全部禁用（而不是启用）
            return {
                aiMemoryDatabaseEnabled: false,
                aiMemorySummarizerEnabled: false,
                semanticSearchEnabled: false,
                deepMemoryManagerEnabled: false,
                intelligentMemoryClassifierEnabled: false,
                memoryEnhancementCoreEnabled: false
            };
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

    /**
     * 🔧 新增：清理DeepMemoryManager中的脏数据（原始AI消息）
     */
    async cleanupDirtyMemories() {
        try {
            console.log('[AIMemoryDatabaseInjector] 🧹 开始清理DeepMemoryManager中的脏数据...');
            
            if (!this.deepMemoryManager || !this.deepMemoryManager.initialized) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ DeepMemoryManager不可用');
                return { success: false, cleaned: 0 };
            }
            
            let totalCleaned = 0;
            const layers = ['sensory', 'shortTerm', 'longTerm', 'deepArchive'];
            
            for (const layerName of layers) {
                const layer = this.deepMemoryManager.memoryLayers[layerName];
                if (!layer || layer.size === 0) continue;
                
                console.log(`[AIMemoryDatabaseInjector] 🔍 检查${layerName}层，共${layer.size}条记忆`);
                
                const toDelete = [];
                for (const [id, memory] of layer) {
                    const content = memory.content || memory.summary || '';
                    
                    // 检测是否为原始AI消息
                    if (this.isRawAIMessage(content)) {
                        toDelete.push(id);
                    }
                }
                
                // 删除脏数据
                for (const id of toDelete) {
                    layer.delete(id);
                    if (this.deepMemoryManager.memoryIndex) {
                        this.deepMemoryManager.memoryIndex.delete(id);
                    }
                    totalCleaned++;
                }
                
                console.log(`[AIMemoryDatabaseInjector] 🗑️ ${layerName}层清理了${toDelete.length}条脏数据`);
            }
            
            // 更新DeepMemoryManager统计
            if (this.deepMemoryManager.stats) {
                this.deepMemoryManager.stats.totalMemories = 
                    this.deepMemoryManager.memoryLayers.sensory.size +
                    this.deepMemoryManager.memoryLayers.shortTerm.size +
                    this.deepMemoryManager.memoryLayers.longTerm.size +
                    this.deepMemoryManager.memoryLayers.deepArchive.size;
            }
            
            // 保存清理后的数据
            if (this.deepMemoryManager.saveMemoryData) {
                await this.deepMemoryManager.saveMemoryData();
            }
            
            console.log(`[AIMemoryDatabaseInjector] ✅ 清理完成，共删除${totalCleaned}条脏数据`);
            
            return { success: true, cleaned: totalCleaned };
            
        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 清理脏数据失败:', error);
            return { success: false, error: error.message, cleaned: 0 };
        }
    }

    /**
     * 🔧 修复：处理SillyTavern原生消息删除事件
     */
    async handleSTMessageDeleted(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🗑️ 处理SillyTavern消息删除事件');

            if (!this.initialized) return;

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.is_user === true) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 跳过记忆回溯（删除的是用户消息）');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] 🔄 开始记忆数据回溯（删除）...');

            // 清理最近的记忆数据
            await this.clearRecentMemoryData();

            console.log('[AIMemoryDatabaseInjector] ✅ 消息删除记忆回溯完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理SillyTavern消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 修复：处理SillyTavern原生消息重新生成事件（swipe）
     */
    async handleSTMessageSwiped(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🔄 处理SillyTavern消息重新生成事件（swipe）');

            if (!this.initialized) return;

            console.log('[AIMemoryDatabaseInjector] 🔄 开始记忆数据回溯（重新生成）...');

            // 清理最近的记忆数据
            await this.clearRecentMemoryData();

            console.log('[AIMemoryDatabaseInjector] ✅ 消息重新生成记忆回溯完成');

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理SillyTavern消息重新生成事件失败:', error);
        }
    }

    /**
     * 🔧 修复：处理聊天切换事件（确保记忆数据隔离）
     */
    async handleChatSwitch(data) {
        try {
            console.log('[AIMemoryDatabaseInjector] 🔄 处理聊天切换事件');

            // 🔧 修复：检查是否启用
            if (!this.initialized || !this.injectorConfig.enabled) {
                console.log('[AIMemoryDatabaseInjector] ⏸️ 注入器未初始化或已禁用，跳过聊天切换处理');
                return;
            }

            // 获取新的聊天ID（多种方式）
            let newChatId = data?.chatId;
            if (!newChatId && this.unifiedDataCore && typeof this.unifiedDataCore.getCurrentChatId === 'function') {
                newChatId = this.unifiedDataCore.getCurrentChatId();
            }
            if (!newChatId) {
                const context = SillyTavern?.getContext?.();
                newChatId = context?.chatId;
            }

            if (!newChatId) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 无法获取新聊天ID');
                return;
            }

            // 检查是否真的切换了聊天
            const oldChatId = this.currentChatId;
            if (newChatId === oldChatId) {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 聊天ID未变化，跳过处理');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] 🔄 聊天切换:', oldChatId, '->', newChatId);

            // 🔧 步骤1：保存当前聊天的记忆数据
            console.log('[AIMemoryDatabaseInjector] 📊 当前记忆统计 (保存前):', {
                总计: this.stats.totalMemories,
                感知层: this.memoryDatabase.sensoryMemory.size,
                短期: this.memoryDatabase.shortTermMemory.size,
                长期: this.memoryDatabase.longTermMemory.size,
                归档: this.memoryDatabase.deepArchive.size
            });

            if (oldChatId && (this.stats.totalMemories > 0 || 
                this.memoryDatabase.sensoryMemory.size > 0 ||
                this.memoryDatabase.shortTermMemory.size > 0 ||
                this.memoryDatabase.longTermMemory.size > 0 ||
                this.memoryDatabase.deepArchive.size > 0)) {
                console.log('[AIMemoryDatabaseInjector] 💾 保存当前聊天的记忆数据...');
                await this.saveMemoryDataForChat(oldChatId);
            } else {
                console.log('[AIMemoryDatabaseInjector] ℹ️ 无需保存记忆数据（无数据或无聊天ID）');
            }

            // 🔧 步骤2：清理内存中的记忆数据
            console.log('[AIMemoryDatabaseInjector] 🧹 清理内存中的记忆数据...');
            this.memoryDatabase.sensoryMemory.clear();
            this.memoryDatabase.shortTermMemory.clear();
            this.memoryDatabase.longTermMemory.clear();
            this.memoryDatabase.deepArchive.clear();

            // 🔧 步骤3：清理缓存
            this.memoryCache.clear();
            this.compressionCache.clear();

            // 🔧 步骤4：重置统计信息
            this.stats.totalMemories = 0;
            this.stats.totalMemoryEntries = 0;
            this.stats.sensoryMemories = 0;
            this.stats.shortTermMemories = 0;
            this.stats.longTermMemories = 0;
            this.stats.deepArchiveMemories = 0;

            console.log('[AIMemoryDatabaseInjector] 📊 统计已重置为0');

            // 🔧 步骤5：更新当前聊天ID
            this.currentChatId = newChatId;
            console.log('[AIMemoryDatabaseInjector] 📍 已更新当前聊天ID:', newChatId);

            // 🔧 步骤6：等待一小段时间确保清理完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 🔧 步骤7：加载新聊天的记忆数据
            console.log('[AIMemoryDatabaseInjector] 📥 加载新聊天的记忆数据...');
            await this.loadMemoryDataForChat(newChatId);

            console.log('[AIMemoryDatabaseInjector] ✅ 聊天切换处理完成');
            console.log(`[AIMemoryDatabaseInjector] 📊 新聊天记忆统计:`, {
                聊天ID: newChatId,
                总计: this.stats.totalMemories,
                感知层: this.stats.sensoryMemories,
                短期: this.stats.shortTermMemories,
                长期: this.stats.longTermMemories,
                归档: this.stats.deepArchiveMemories
            });

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 修复：保存指定聊天的记忆数据
     */
    async saveMemoryDataForChat(chatId) {
        try {
            if (!this.unifiedDataCore || !chatId) {
                console.warn('[AIMemoryDatabaseInjector] ⚠️ 无法保存：UnifiedDataCore或chatId不可用');
                return;
            }

            console.log('[AIMemoryDatabaseInjector] 💾 保存聊天记忆数据:', chatId);

            // 保存各层记忆数据，使用聊天ID作为键的一部分
            const layers = ['sensoryMemory', 'shortTermMemory', 'longTermMemory', 'deepArchive'];
            let totalSaved = 0;

            for (const layerName of layers) {
                const layerMap = this.memoryDatabase[layerName];
                if (layerMap && layerMap.size > 0) {
                    const layerData = Object.fromEntries(layerMap);
                    const storageKey = `ai_memory_${layerName}_${chatId}`;
                    await this.unifiedDataCore.setData(storageKey, layerData);
                    totalSaved += layerMap.size;
                    console.log(`[AIMemoryDatabaseInjector] 💾 已保存 ${layerName}: ${layerMap.size} 个记忆`);
                }
            }

            console.log(`[AIMemoryDatabaseInjector] ✅ 聊天记忆数据保存完成 (聊天: ${chatId}, 总计: ${totalSaved} 个记忆)`);

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 保存聊天记忆数据失败:', error);
        }
    }

    /**
     * 🔧 修复：加载指定聊天的记忆数据
     */
    async loadMemoryDataForChat(chatId) {
        try {
            if (!this.unifiedDataCore || !chatId) return;

            console.log('[AIMemoryDatabaseInjector] 📥 加载聊天记忆数据:', chatId);

            // 加载各层记忆数据
            const layers = [
                { name: 'sensoryMemory', map: this.memoryDatabase.sensoryMemory },
                { name: 'shortTermMemory', map: this.memoryDatabase.shortTermMemory },
                { name: 'longTermMemory', map: this.memoryDatabase.longTermMemory },
                { name: 'deepArchive', map: this.memoryDatabase.deepArchive }
            ];

            let totalLoaded = 0;
            for (const layer of layers) {
                const storageKey = `ai_memory_${layer.name}_${chatId}`;
                const layerData = await this.unifiedDataCore.getData(storageKey);

                if (layerData && Object.keys(layerData).length > 0) {
                    for (const [id, memory] of Object.entries(layerData)) {
                        layer.map.set(id, memory);
                    }
                    const count = Object.keys(layerData).length;
                    totalLoaded += count;
                    console.log(`[AIMemoryDatabaseInjector] ✅ 已加载 ${layer.name}: ${count} 个记忆`);
                } else {
                    console.log(`[AIMemoryDatabaseInjector] 📭 ${layer.name} 无数据`);
                }
            }

            // 更新统计信息
            this.updateMemoryStats();

            console.log(`[AIMemoryDatabaseInjector] ✅ 聊天记忆数据加载完成 (聊天: ${chatId}, 总计: ${this.stats.totalMemories})`);
            console.log('[AIMemoryDatabaseInjector] 📊 加载后统计:', {
                总计: this.stats.totalMemories,
                感知层: this.stats.sensoryMemories,
                短期: this.stats.shortTermMemories,
                长期: this.stats.longTermMemories,
                归档: this.stats.deepArchiveMemories
            });

        } catch (error) {
            console.error('[AIMemoryDatabaseInjector] ❌ 加载聊天记忆数据失败:', error);
        }
    }
}
