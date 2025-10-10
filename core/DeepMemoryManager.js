/**
 * 深度记忆管理器
 * 
 * 基于认知心理学三支柱理论的四层记忆架构：
 * - 感知记忆 (Sensory Memory): 即时输入处理和筛选
 * - 短期记忆 (Short-term Memory): 当前会话上下文管理
 * - 长期记忆 (Long-term Memory): 持久化重要记忆存储
 * - 深度归档 (Deep Archive): 压缩的历史记忆归档
 * 
 * 核心功能：
 * - 智能记忆分类和分层
 * - 记忆重要性评估和优先级管理
 * - 记忆生命周期管理和自动迁移
 * - 记忆冲突检测和解决
 * - 记忆压缩和优化
 * 
 * @class DeepMemoryManager
 */

export class DeepMemoryManager {
    constructor(unifiedDataCore, eventSystem, aiMemorySummarizer, vectorizedMemoryRetrieval) {
        console.log('[DeepMemoryManager] 🧠 深度记忆管理器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.aiMemorySummarizer = aiMemorySummarizer;
        this.vectorizedMemoryRetrieval = vectorizedMemoryRetrieval;
        
        // 深度记忆管理设置
        this.settings = {
            enabled: false,                        // 🔧 修复：默认禁用深度记忆管理
            autoSave: true,                        // 🔧 新增：自动保存记忆数据
            sensoryMemoryCapacity: 100,            // 感知记忆容量
            shortTermMemoryCapacity: 500,          // 短期记忆容量
            longTermMemoryCapacity: 5000,          // 长期记忆容量
            deepArchiveCapacity: 50000,            // 深度归档容量
            
            // 记忆迁移阈值
            sensoryToShortTermThreshold: 0.3,      // 感知->短期阈值
            shortTermToLongTermThreshold: 0.6,     // 短期->长期阈值
            longTermToArchiveThreshold: 0.8,       // 长期->归档阈值
            
            // 时间衰减参数
            sensoryMemoryDecayRate: 0.9,           // 感知记忆衰减率
            shortTermMemoryDecayRate: 0.95,        // 短期记忆衰减率
            longTermMemoryDecayRate: 0.99,         // 长期记忆衰减率
            
            // 记忆管理策略
            autoMemoryMigration: true,             // 自动记忆迁移
            memoryConflictResolution: true,        // 记忆冲突解决
            memoryCompression: true,               // 记忆压缩
            memoryValidation: true,                // 记忆验证
            
            // 评估权重
            importanceWeight: 0.4,                 // 重要性权重
            recencyWeight: 0.3,                    // 时效性权重
            relevanceWeight: 0.3                   // 关联性权重
        };
        
        // 四层记忆存储
        this.memoryLayers = {
            sensory: new Map(),                    // 感知记忆层
            shortTerm: new Map(),                  // 短期记忆层
            longTerm: new Map(),                   // 长期记忆层
            deepArchive: new Map()                 // 深度归档层
        };
        
        // 记忆索引和元数据
        this.memoryIndex = new Map();             // 记忆索引
        this.memoryMetadata = new Map();          // 记忆元数据
        this.memoryRelations = new Map();         // 记忆关联关系
        this.memoryConflicts = new Map();         // 记忆冲突记录
        
        // 记忆分类器
        this.memoryClassifier = {
            importanceClassifier: null,            // 重要性分类器
            categoryClassifier: null,              // 类别分类器
            emotionalClassifier: null,             // 情感分类器
            temporalClassifier: null               // 时间分类器
        };

        // 🔧 修复：防止重复绑定事件监听器
        this.eventListenersBound = false;         // 事件监听器绑定标志
        this.boundHandlers = null;                // 绑定的处理函数引用
        
        // 性能统计
        this.stats = {
            totalMemories: 0,                      // 总记忆数量
            memoryMigrations: 0,                   // 记忆迁移次数
            conflictsResolved: 0,                  // 解决的冲突数
            compressionRatio: 0,                   // 压缩比率
            averageImportance: 0,                  // 平均重要性
            lastMaintenanceTime: 0                 // 最后维护时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.isProcessing = false;
        this.errorCount = 0;
        
        console.log('[DeepMemoryManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化深度记忆管理器
     */
    async init() {
        try {
            console.log('[DeepMemoryManager] 📊 开始初始化深度记忆管理器...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[DeepMemoryManager] ⏸️ 深度记忆管理器已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 初始化记忆分类器
            await this.initializeMemoryClassifiers();

            // 加载现有记忆数据
            await this.loadExistingMemories();

            // 🔧 修复：如果初始化时没有加载到数据，延迟重试（增强版）
            if (this.stats.totalMemories === 0 && this.unifiedDataCore) {
                console.log('[DeepMemoryManager] 🔄 初始化时未加载到数据，启动延迟重试机制...');
                this.startDelayedLoadRetry();
            }

            // 绑定事件监听器
            this.bindEventListeners();

            // 启动记忆维护任务
            this.startMemoryMaintenance();

            this.initialized = true;
            console.log('[DeepMemoryManager] ✅ 深度记忆管理器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('deep-memory-manager:initialized', {
                    timestamp: Date.now(),
                    memoryLayers: Object.keys(this.memoryLayers),
                    totalMemories: this.stats.totalMemories
                });
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            console.log('[DeepMemoryManager] 📥 加载深度记忆管理设置...');

            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.deep) {
                    console.log('[DeepMemoryManager] 📥 从extensionSettings加载设置:', memoryEnhancement.deep);

                    // 合并设置，优先使用extensionSettings中的值
                    this.settings = {
                        ...this.settings,
                        enabled: memoryEnhancement.deep.enabled !== undefined ? memoryEnhancement.deep.enabled : this.settings.enabled,
                        autoMemoryMigration: memoryEnhancement.deep.autoMemoryMigration !== undefined ? memoryEnhancement.deep.autoMemoryMigration : this.settings.autoMemoryMigration,
                        memoryConflictResolution: memoryEnhancement.deep.conflictResolution !== undefined ? memoryEnhancement.deep.conflictResolution : this.settings.memoryConflictResolution
                    };

                    // 合并容量设置
                    if (memoryEnhancement.deep.capacities) {
                        const capacities = memoryEnhancement.deep.capacities;
                        if (capacities.sensory !== undefined) this.settings.sensoryMemoryCapacity = capacities.sensory;
                        if (capacities.shortTerm !== undefined) this.settings.shortTermMemoryCapacity = capacities.shortTerm;
                        if (capacities.longTerm !== undefined) this.settings.longTermMemoryCapacity = capacities.longTerm;
                        if (capacities.deepArchive !== undefined) this.settings.deepArchiveCapacity = capacities.deepArchive;
                    }

                    console.log('[DeepMemoryManager] ✅ 从extensionSettings加载设置成功');
                }
            } catch (error) {
                console.warn('[DeepMemoryManager] ⚠️ 从extensionSettings加载设置失败，使用默认值:', error);
            }

            // 🔧 向后兼容：尝试从unifiedDataCore加载（如果extensionSettings没有数据）
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('deep_memory_settings');
                if (savedSettings) {
                    // 只合并unifiedDataCore中有但extensionSettings中没有的设置
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[DeepMemoryManager] 📥 从unifiedDataCore加载了额外设置');
                }
            }

            // 确保autoSave设置存在（向后兼容）
            if (this.settings.autoSave === undefined) {
                this.settings.autoSave = true;
                console.log('[DeepMemoryManager] 🔧 添加缺失的autoSave设置');
            }

            console.log('[DeepMemoryManager] ✅ 深度记忆管理设置加载完成:', this.settings);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[DeepMemoryManager] 🔄 更新深度记忆管理设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('deep_memory_settings', this.settings);
            }

            // 如果启用状态改变，重新初始化
            if (newSettings.hasOwnProperty('enabled')) {
                if (newSettings.enabled && !this.initialized) {
                    await this.init();
                } else if (newSettings.enabled && this.initialized && !this.eventListenersBound) {
                    // 🔧 P0+修复：如果已初始化但事件监听器未绑定，手动绑定
                    console.log('[DeepMemoryManager] 🔧 检测到事件监听器未绑定，正在绑定...');
                    this.bindEventListeners();
                }
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 初始化记忆分类器
     */
    async initializeMemoryClassifiers() {
        try {
            console.log('[DeepMemoryManager] 🤖 初始化记忆分类器...');
            
            // 重要性分类器
            this.memoryClassifier.importanceClassifier = {
                evaluateImportance: this.evaluateMemoryImportance.bind(this),
                threshold: this.settings.shortTermToLongTermThreshold
            };
            
            // 类别分类器
            this.memoryClassifier.categoryClassifier = {
                classifyCategory: this.classifyMemoryCategory.bind(this),
                categories: [
                    'episodic',      // 情节记忆
                    'semantic',      // 语义记忆
                    'procedural',    // 程序记忆
                    'emotional',     // 情感记忆
                    'contextual'     // 上下文记忆
                ]
            };
            
            // 情感分类器
            this.memoryClassifier.emotionalClassifier = {
                analyzeEmotion: this.analyzeMemoryEmotion.bind(this),
                emotions: ['positive', 'negative', 'neutral', 'mixed']
            };
            
            // 时间分类器
            this.memoryClassifier.temporalClassifier = {
                analyzeTemporalPattern: this.analyzeTemporalPattern.bind(this),
                patterns: ['recent', 'periodic', 'historical', 'milestone']
            };
            
            console.log('[DeepMemoryManager] ✅ 记忆分类器初始化完成');
            
        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 初始化记忆分类器失败:', error);
        }
    }

    /**
     * 添加新记忆到感知记忆层
     */
    async addMemoryToSensoryLayer(memoryData) {
        try {
            console.log('[DeepMemoryManager] 👁️ 添加记忆到感知记忆层...');

            if (!this.settings.enabled) return null;

            // 🔧 P1修复：内容过滤 - 排除AI思考过程
            if (!this.shouldStoreMemory(memoryData.content)) {
                console.log('[DeepMemoryManager] 🚫 内容被过滤，不存储为记忆');
                return null;
            }

            // 创建记忆对象
            const memory = {
                id: `sensory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: memoryData.content,
                type: memoryData.type || 'general',
                source: memoryData.source || 'unknown',
                timestamp: Date.now(),
                layer: 'sensory',

                // 初始评分
                importance: 0,
                recency: 1.0,
                relevance: 0,

                // 元数据
                metadata: {
                    originalData: memoryData,
                    processingStage: 'initial',
                    accessCount: 0,
                    lastAccessed: Date.now(),
                    // 🔧 P1修复：确保chatId被正确记录
                    chatId: memoryData.metadata?.originalData?.chatId ||
                           this.unifiedDataCore?.getCurrentChatId?.() ||
                           'unknown'
                }
            };
            
            // 快速重要性评估
            memory.importance = await this.quickImportanceEvaluation(memory);
            
            // 检查感知记忆容量
            if (this.memoryLayers.sensory.size >= this.settings.sensoryMemoryCapacity) {
                await this.evictFromSensoryMemory();
            }
            
            // 添加到感知记忆层
            this.memoryLayers.sensory.set(memory.id, memory);
            this.memoryIndex.set(memory.id, memory);
            
            // 更新统计
            this.stats.totalMemories++;
            
            console.log(`[DeepMemoryManager] ✅ 记忆已添加到感知层: ${memory.id}`);
            
            // 检查是否需要立即迁移到短期记忆
            if (memory.importance >= this.settings.sensoryToShortTermThreshold) {
                await this.migrateMemory(memory.id, 'sensory', 'shortTerm');
            }

            // 🔧 修复：自动保存记忆数据到持久化存储
            if (this.settings.autoSave !== false) { // 默认启用自动保存
                await this.saveMemoryData();
                console.log('[DeepMemoryManager] 💾 记忆数据已自动保存');
            }

            // 🔧 新增：触发记忆更新事件，通知向量化系统索引新记忆
            if (this.eventSystem) {
                this.eventSystem.emit('memory:updated', {
                    action: 'add',
                    memory: memory,
                    layer: 'sensory',
                    timestamp: Date.now()
                });
                console.log('[DeepMemoryManager] 📢 已触发memory:updated事件');
            }

            return memory;
            
        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 添加感知记忆失败:', error);
            return null;
        }
    }

    /**
     * 🔧 P1修复：判断内容是否应该被存储为记忆
     * 过滤掉AI的思考过程、系统提示等不应该作为记忆的内容
     */
    shouldStoreMemory(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // 过滤模式列表
        const filterPatterns = [
            // AI思考过程标记
            /^<thinking>/i,
            /^- 当前处于何种情境/,
            /^时间？.*地点？.*社会关系？/,
            /^<interactive_input>/i,

            // 系统提示和元指令
            /^System:/i,
            /^Assistant:/i,
            /^\[System\]/i,
            /^\[Assistant\]/i,

            // 空内容或过短内容
            /^\s*$/,

            // 纯标点符号
            /^[。，、；：？！,.;:?!\s]+$/
        ];

        // 检查是否匹配任何过滤模式
        for (const pattern of filterPatterns) {
            if (pattern.test(content)) {
                console.log('[DeepMemoryManager] 🚫 内容匹配过滤模式:', pattern);
                return false;
            }
        }

        // 内容长度检查（太短的内容可能没有记忆价值）
        if (content.trim().length < 5) {
            console.log('[DeepMemoryManager] 🚫 内容过短，不存储');
            return false;
        }

        return true;
    }

    /**
     * 快速重要性评估
     */
    async quickImportanceEvaluation(memory) {
        try {
            let importance = 0;

            // 基于内容长度的基础评分
            const contentLength = memory.content.length;
            importance += Math.min(contentLength / 1000, 0.3);

            // 基于类型的评分
            const typeScores = {
                'ai_summary': 0.8,
                'user_message': 0.6,
                'system_message': 0.4,
                'general': 0.3
            };
            importance += typeScores[memory.type] || 0.3;

            // 基于关键词的评分
            const importantKeywords = [
                '重要', '关键', '决定', '计划', '目标', '问题', '解决',
                'important', 'key', 'decision', 'plan', 'goal', 'problem'
            ];

            const content = memory.content.toLowerCase();
            const keywordMatches = importantKeywords.filter(keyword =>
                content.includes(keyword)
            ).length;

            importance += keywordMatches * 0.1;

            // 限制在0-1范围内
            return Math.min(Math.max(importance, 0), 1);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 快速重要性评估失败:', error);
            return 0.3; // 默认值
        }
    }

    /**
     * 从感知记忆层驱逐记忆
     */
    async evictFromSensoryMemory() {
        try {
            console.log('[DeepMemoryManager] 🗑️ 从感知记忆层驱逐记忆...');
            
            const sensoryMemories = Array.from(this.memoryLayers.sensory.values());
            
            // 按重要性和时间排序，驱逐最不重要的记忆
            sensoryMemories.sort((a, b) => {
                const scoreA = a.importance * 0.7 + a.recency * 0.3;
                const scoreB = b.importance * 0.7 + b.recency * 0.3;
                return scoreA - scoreB;
            });
            
            // 驱逐最低分的记忆
            const memoryToEvict = sensoryMemories[0];
            if (memoryToEvict) {
                this.memoryLayers.sensory.delete(memoryToEvict.id);
                this.memoryIndex.delete(memoryToEvict.id);
                
                console.log(`[DeepMemoryManager] 🗑️ 已驱逐感知记忆: ${memoryToEvict.id}`);
            }
            
        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 驱逐感知记忆失败:', error);
        }
    }

    /**
     * 记忆迁移
     */
    async migrateMemory(memoryId, fromLayer, toLayer) {
        try {
            console.log(`[DeepMemoryManager] 🔄 迁移记忆: ${memoryId} (${fromLayer} -> ${toLayer})`);
            
            const memory = this.memoryLayers[fromLayer].get(memoryId);
            if (!memory) {
                console.warn(`[DeepMemoryManager] ⚠️ 记忆不存在: ${memoryId}`);
                return false;
            }
            
            // 检查目标层容量
            const capacitySettings = {
                shortTerm: this.settings.shortTermMemoryCapacity,
                longTerm: this.settings.longTermMemoryCapacity,
                deepArchive: this.settings.deepArchiveCapacity
            };
            
            if (this.memoryLayers[toLayer].size >= capacitySettings[toLayer]) {
                await this.evictFromLayer(toLayer);
            }
            
            // 更新记忆层级
            memory.layer = toLayer;
            memory.metadata.migrationHistory = memory.metadata.migrationHistory || [];
            memory.metadata.migrationHistory.push({
                from: fromLayer,
                to: toLayer,
                timestamp: Date.now(),
                reason: 'automatic_migration'
            });
            
            // 如果迁移到长期记忆或归档，进行深度处理
            if (toLayer === 'longTerm' || toLayer === 'deepArchive') {
                await this.deepProcessMemory(memory);
            }
            
            // 移动记忆
            this.memoryLayers[fromLayer].delete(memoryId);
            this.memoryLayers[toLayer].set(memoryId, memory);
            
            // 更新统计
            this.stats.memoryMigrations++;
            
            console.log(`[DeepMemoryManager] ✅ 记忆迁移完成: ${memoryId}`);
            
            // 触发迁移事件
            if (this.eventSystem) {
                this.eventSystem.emit('deep-memory-manager:memory-migrated', {
                    memoryId: memoryId,
                    fromLayer: fromLayer,
                    toLayer: toLayer,
                    timestamp: Date.now()
                });
            }

            // 🔧 修复：记忆迁移后自动保存数据
            if (this.settings.autoSave !== false) { // 默认启用自动保存
                await this.saveMemoryData();
                console.log('[DeepMemoryManager] 💾 记忆迁移后数据已自动保存');
            }

            return true;
            
        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 记忆迁移失败:', error);
            return false;
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[DeepMemoryManager] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('deep-memory-manager:error', {
                error: error,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 深度处理记忆
     */
    async deepProcessMemory(memory) {
        try {
            console.log(`[DeepMemoryManager] 🔬 深度处理记忆: ${memory.id}`);

            // 详细重要性评估
            memory.importance = await this.evaluateMemoryImportance(memory);

            // 记忆分类
            memory.category = await this.classifyMemoryCategory(memory);

            // 情感分析
            memory.emotion = await this.analyzeMemoryEmotion(memory);

            // 时间模式分析
            memory.temporalPattern = await this.analyzeTemporalPattern(memory);

            // 关联性分析
            memory.relations = await this.analyzeMemoryRelations(memory);

            // 向量化处理
            if (this.vectorizedMemoryRetrieval) {
                memory.vector = await this.vectorizedMemoryRetrieval.vectorizeText(memory.content);
            }

            // 更新元数据
            memory.metadata.processingStage = 'deep_processed';
            memory.metadata.lastProcessed = Date.now();

            console.log(`[DeepMemoryManager] ✅ 记忆深度处理完成: ${memory.id}`);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 深度处理记忆失败:', error);
        }
    }

    /**
     * 评估记忆重要性
     */
    async evaluateMemoryImportance(memory) {
        try {
            let importance = 0;

            // 1. 内容复杂度评分 (0-0.3)
            const contentComplexity = this.calculateContentComplexity(memory.content);
            importance += contentComplexity * 0.3;

            // 2. 语义重要性评分 (0-0.4)
            const semanticImportance = await this.calculateSemanticImportance(memory);
            importance += semanticImportance * 0.4;

            // 3. 上下文相关性评分 (0-0.3)
            const contextualRelevance = await this.calculateContextualRelevance(memory);
            importance += contextualRelevance * 0.3;

            return Math.min(Math.max(importance, 0), 1);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 评估记忆重要性失败:', error);
            return memory.importance || 0.5;
        }
    }

    /**
     * 计算内容复杂度
     */
    calculateContentComplexity(content) {
        try {
            let complexity = 0;

            // 长度因子
            const length = content.length;
            complexity += Math.min(length / 2000, 0.4);

            // 词汇多样性
            const words = content.toLowerCase().split(/\s+/);
            const uniqueWords = new Set(words);
            const diversity = uniqueWords.size / words.length;
            complexity += diversity * 0.3;

            // 句子复杂度
            const sentences = content.split(/[.!?]+/);
            const avgSentenceLength = words.length / sentences.length;
            complexity += Math.min(avgSentenceLength / 20, 0.3);

            return Math.min(complexity, 1);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 计算内容复杂度失败:', error);
            return 0.5;
        }
    }

    /**
     * 计算语义重要性
     */
    async calculateSemanticImportance(memory) {
        try {
            let semanticScore = 0;

            // 关键词权重
            const highImportanceKeywords = [
                '重要', '关键', '决定', '计划', '目标', '问题', '解决', '发现', '结论',
                'important', 'key', 'critical', 'decision', 'plan', 'goal', 'problem', 'solution'
            ];

            const mediumImportanceKeywords = [
                '建议', '想法', '创意', '灵感', '思考', '分析', '总结',
                'suggestion', 'idea', 'creative', 'inspiration', 'analysis', 'summary'
            ];

            const content = memory.content.toLowerCase();

            // 高重要性关键词
            const highMatches = highImportanceKeywords.filter(keyword =>
                content.includes(keyword)
            ).length;
            semanticScore += highMatches * 0.15;

            // 中等重要性关键词
            const mediumMatches = mediumImportanceKeywords.filter(keyword =>
                content.includes(keyword)
            ).length;
            semanticScore += mediumMatches * 0.08;

            // 情感强度
            const emotionalWords = ['爱', '恨', '喜欢', '讨厌', '惊讶', '愤怒', '悲伤', '快乐'];
            const emotionalMatches = emotionalWords.filter(word =>
                content.includes(word)
            ).length;
            semanticScore += emotionalMatches * 0.1;

            return Math.min(semanticScore, 1);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 计算语义重要性失败:', error);
            return 0.5;
        }
    }

    /**
     * 计算上下文相关性
     */
    async calculateContextualRelevance(memory) {
        try {
            let relevance = 0;

            // 与当前会话的相关性
            const currentContext = await this.getCurrentContext();
            if (currentContext) {
                relevance += await this.calculateSimilarity(memory.content, currentContext) * 0.5;
            }

            // 与最近记忆的相关性
            const recentMemories = await this.getRecentMemories(5);
            if (recentMemories.length > 0) {
                const similarities = await Promise.all(
                    recentMemories.map(recentMemory =>
                        this.calculateSimilarity(memory.content, recentMemory.content)
                    )
                );
                const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
                relevance += avgSimilarity * 0.5;
            }

            return Math.min(relevance, 1);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 计算上下文相关性失败:', error);
            return 0.5;
        }
    }

    /**
     * 分类记忆类别
     */
    async classifyMemoryCategory(memory) {
        try {
            // 🔧 修复：添加严格的输入验证
            if (!memory || !memory.content || typeof memory.content !== 'string') {
                console.warn('[DeepMemoryManager] ⚠️ 无效的记忆内容，使用默认分类');
                return 'contextual';
            }

            const content = memory.content.toLowerCase();

            // 情节记忆 - 具体事件和经历
            if (content.includes('发生') || content.includes('经历') || content.includes('事件') ||
                content.includes('happened') || content.includes('experience') || content.includes('event')) {
                return 'episodic';
            }

            // 语义记忆 - 事实和知识
            if (content.includes('知识') || content.includes('事实') || content.includes('定义') ||
                content.includes('knowledge') || content.includes('fact') || content.includes('definition')) {
                return 'semantic';
            }

            // 程序记忆 - 技能和方法
            if (content.includes('方法') || content.includes('步骤') || content.includes('技能') ||
                content.includes('method') || content.includes('step') || content.includes('skill')) {
                return 'procedural';
            }

            // 情感记忆 - 情感和感受
            if (content.includes('感觉') || content.includes('情感') || content.includes('心情') ||
                content.includes('feel') || content.includes('emotion') || content.includes('mood')) {
                return 'emotional';
            }

            // 默认为上下文记忆
            return 'contextual';

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 分类记忆类别失败:', error);
            return 'contextual';
        }
    }

    /**
     * 分析记忆情感
     */
    async analyzeMemoryEmotion(memory) {
        try {
            const content = memory.content.toLowerCase();

            const positiveWords = ['好', '棒', '优秀', '成功', '快乐', '喜欢', 'good', 'great', 'excellent', 'success', 'happy', 'like'];
            const negativeWords = ['坏', '糟糕', '失败', '悲伤', '讨厌', 'bad', 'terrible', 'failure', 'sad', 'hate'];

            const positiveCount = positiveWords.filter(word => content.includes(word)).length;
            const negativeCount = negativeWords.filter(word => content.includes(word)).length;

            if (positiveCount > negativeCount) {
                return 'positive';
            } else if (negativeCount > positiveCount) {
                return 'negative';
            } else if (positiveCount > 0 && negativeCount > 0) {
                return 'mixed';
            } else {
                return 'neutral';
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 分析记忆情感失败:', error);
            return 'neutral';
        }
    }

    /**
     * 分析时间模式
     */
    async analyzeTemporalPattern(memory) {
        try {
            const now = Date.now();
            const memoryAge = now - memory.timestamp;

            // 最近记忆 (1小时内)
            if (memoryAge < 60 * 60 * 1000) {
                return 'recent';
            }

            // 检查是否为周期性记忆
            const similarMemories = await this.findSimilarMemories(memory, 0.7);
            if (similarMemories.length >= 3) {
                return 'periodic';
            }

            // 里程碑记忆 (重要性很高)
            if (memory.importance >= 0.8) {
                return 'milestone';
            }

            // 历史记忆
            return 'historical';

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 分析时间模式失败:', error);
            return 'historical';
        }
    }

    /**
     * 分析记忆关联关系
     */
    async analyzeMemoryRelations(memory) {
        try {
            console.log(`[DeepMemoryManager] 🔗 分析记忆关联关系: ${memory.id}`);

            // 查找相似记忆
            const similarMemories = await this.findSimilarMemories(memory, 0.6);

            if (similarMemories.length === 0) {
                return {
                    type: 'isolated',
                    count: 0,
                    strength: 0,
                    connections: []
                };
            }

            // 分析关联强度
            const connections = [];
            let totalStrength = 0;

            for (const similarMemory of similarMemories.slice(0, 5)) { // 限制为前5个最相似的
                const strength = await this.calculateSimilarity(memory.content, similarMemory.content);

                connections.push({
                    memoryId: similarMemory.id,
                    strength: strength,
                    type: this.determineRelationType(memory, similarMemory)
                });

                totalStrength += strength;
            }

            const averageStrength = totalStrength / connections.length;

            // 确定关联类型
            let relationType = 'weak';
            if (averageStrength > 0.8) {
                relationType = 'strong';
            } else if (averageStrength > 0.6) {
                relationType = 'moderate';
            }

            return {
                type: relationType,
                count: connections.length,
                strength: averageStrength,
                connections: connections
            };

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 分析记忆关联关系失败:', error);
            return {
                type: 'isolated',
                count: 0,
                strength: 0,
                connections: []
            };
        }
    }

    /**
     * 确定关联关系类型
     */
    determineRelationType(memory1, memory2) {
        try {
            // 基于时间的关联
            const timeDiff = Math.abs(memory1.timestamp - memory2.timestamp);
            const oneHour = 60 * 60 * 1000;

            if (timeDiff < oneHour) {
                return 'temporal';
            }

            // 基于类型的关联
            if (memory1.type === memory2.type) {
                return 'categorical';
            }

            // 基于情感的关联
            if (memory1.emotion && memory2.emotion && memory1.emotion === memory2.emotion) {
                return 'emotional';
            }

            // 默认为语义关联
            return 'semantic';

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 确定关联关系类型失败:', error);
            return 'semantic';
        }
    }

    /**
     * 启动记忆维护任务
     */
    startMemoryMaintenance() {
        try {
            console.log('[DeepMemoryManager] 🔧 启动记忆维护任务...');

            // 每5分钟执行一次记忆维护
            setInterval(() => {
                this.performMemoryMaintenance();
            }, 5 * 60 * 1000);

            // 每小时执行一次深度维护
            setInterval(() => {
                this.performDeepMaintenance();
            }, 60 * 60 * 1000);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 启动记忆维护任务失败:', error);
        }
    }

    /**
     * 执行记忆维护
     */
    async performMemoryMaintenance() {
        try {
            if (this.isProcessing) return;

            this.isProcessing = true;
            console.log('[DeepMemoryManager] 🔧 执行记忆维护...');

            // 1. 更新记忆衰减
            await this.updateMemoryDecay();

            // 2. 自动记忆迁移
            if (this.settings.autoMemoryMigration) {
                await this.performAutoMigration();
            }

            // 3. 记忆冲突检测和解决
            if (this.settings.memoryConflictResolution) {
                await this.detectAndResolveConflicts();
            }

            // 4. 记忆压缩
            if (this.settings.memoryCompression) {
                await this.compressMemories();
            }

            this.stats.lastMaintenanceTime = Date.now();
            this.isProcessing = false;

            console.log('[DeepMemoryManager] ✅ 记忆维护完成');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 记忆维护失败:', error);
            this.isProcessing = false;
        }
    }

    /**
     * 更新记忆衰减
     */
    async updateMemoryDecay() {
        try {
            console.log('[DeepMemoryManager] ⏰ 更新记忆衰减...');

            const now = Date.now();

            // 更新感知记忆衰减
            for (const [id, memory] of this.memoryLayers.sensory) {
                const age = (now - memory.timestamp) / (1000 * 60); // 分钟
                memory.recency *= Math.pow(this.settings.sensoryMemoryDecayRate, age);

                // 如果衰减过低，移除记忆
                if (memory.recency < 0.1) {
                    this.memoryLayers.sensory.delete(id);
                    this.memoryIndex.delete(id);
                }
            }

            // 更新短期记忆衰减
            for (const [id, memory] of this.memoryLayers.shortTerm) {
                const age = (now - memory.timestamp) / (1000 * 60 * 60); // 小时
                memory.recency *= Math.pow(this.settings.shortTermMemoryDecayRate, age);
            }

            // 更新长期记忆衰减
            for (const [id, memory] of this.memoryLayers.longTerm) {
                const age = (now - memory.timestamp) / (1000 * 60 * 60 * 24); // 天
                memory.recency *= Math.pow(this.settings.longTermMemoryDecayRate, age);
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 更新记忆衰减失败:', error);
        }
    }

    /**
     * 执行自动迁移
     */
    async performAutoMigration() {
        try {
            console.log('[DeepMemoryManager] 🔄 执行自动记忆迁移...');

            // 感知记忆 -> 短期记忆
            for (const [id, memory] of this.memoryLayers.sensory) {
                if (memory.importance >= this.settings.sensoryToShortTermThreshold) {
                    await this.migrateMemory(id, 'sensory', 'shortTerm');
                }
            }

            // 短期记忆 -> 长期记忆
            for (const [id, memory] of this.memoryLayers.shortTerm) {
                if (memory.importance >= this.settings.shortTermToLongTermThreshold) {
                    await this.migrateMemory(id, 'shortTerm', 'longTerm');
                }
            }

            // 长期记忆 -> 深度归档
            for (const [id, memory] of this.memoryLayers.longTerm) {
                if (memory.importance >= this.settings.longTermToArchiveThreshold) {
                    await this.migrateMemory(id, 'longTerm', 'deepArchive');
                }
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 自动记忆迁移失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[DeepMemoryManager] 🔗 绑定事件监听器...');

            if (!this.eventSystem) return;

            // 🔧 修复：先解绑旧的监听器（如果存在）
            if (this.boundHandlers) {
                console.log('[DeepMemoryManager] 🔓 解绑旧的事件监听器...');
                this.eventSystem.off('ai-summary:created', this.boundHandlers.aiSummaryCreated);
                this.eventSystem.off('message:received', this.boundHandlers.messageReceived);
                // 🔧 P0+修复：解绑所有聊天切换事件
                this.eventSystem.off('chat:changed', this.boundHandlers.chatChanged);
                this.eventSystem.off('CHAT_CHANGED', this.boundHandlers.chatChanged);
                this.eventSystem.off('chatChanged', this.boundHandlers.chatChanged);
                this.eventSystem.off('vectorized-memory-retrieval:memory-indexed', this.boundHandlers.memoryIndexed);
                this.eventSystem.off('message:deleted', this.boundHandlers.messageDeleted);
                this.eventSystem.off('message:regenerated', this.boundHandlers.messageRegenerated);
            }

            // 🔧 修复：防止重复绑定事件监听器
            if (this.eventListenersBound) {
                console.log('[DeepMemoryManager] ⚠️ 事件监听器已绑定，重新绑定');
            }

            // 创建绑定的处理函数引用（用于后续解绑）
            this.boundHandlers = {
                aiSummaryCreated: (data) => this.handleAISummaryCreated(data),
                messageReceived: (data) => this.handleMessageReceived(data),
                chatChanged: (data) => this.handleChatChanged(data),
                memoryIndexed: (data) => this.handleVectorizedMemoryIndexed(data),
                messageDeleted: (data) => this.handleMessageDeleted(data),
                messageRegenerated: (data) => this.handleMessageRegenerated(data)
            };

            // 监听AI总结创建事件
            this.eventSystem.on('ai-summary:created', this.boundHandlers.aiSummaryCreated);

            // 监听消息接收事件
            this.eventSystem.on('message:received', this.boundHandlers.messageReceived);

            // 🔧 P0+修复：监听聊天切换事件（兼容多种事件名）
            this.eventSystem.on('chat:changed', this.boundHandlers.chatChanged);
            this.eventSystem.on('CHAT_CHANGED', this.boundHandlers.chatChanged);  // SillyTavern官方事件名
            this.eventSystem.on('chatChanged', this.boundHandlers.chatChanged);   // 备用事件名

            // 监听向量化记忆创建事件
            this.eventSystem.on('vectorized-memory-retrieval:memory-indexed', this.boundHandlers.memoryIndexed);

            // 🔧 新增：监听消息删除事件
            this.eventSystem.on('message:deleted', this.boundHandlers.messageDeleted);

            // 🔧 新增：监听消息重新生成事件
            this.eventSystem.on('message:regenerated', this.boundHandlers.messageRegenerated);

            // 标记已绑定
            this.eventListenersBound = true;

            console.log('[DeepMemoryManager] ✅ 事件监听器绑定完成');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理AI总结创建事件
     */
    async handleAISummaryCreated(data) {
        try {
            console.log('[DeepMemoryManager] 🧠 处理AI总结创建事件');

            if (!this.settings.enabled) return;

            const memoryData = {
                content: data.summary.content,
                type: 'ai_summary',
                source: 'ai_memory_summarizer',
                metadata: {
                    classification: data.summary.classification,
                    tags: data.summary.tags,
                    messageCount: data.messageCount,
                    importantCount: data.importantCount
                }
            };

            await this.addMemoryToSensoryLayer(memoryData);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理AI总结创建事件失败:', error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[DeepMemoryManager] 📝 处理消息接收事件', data);

            if (!this.settings.enabled) {
                console.log('[DeepMemoryManager] ⚠️ 深度记忆管理器未启用，跳过处理');
                return;
            }

            // 🔧 修复：防止重复处理同一条消息
            const messageId = data.messageId || data.timestamp || Date.now();
            const messageKey = `${messageId}_${data.message || data.mes || ''}`.substring(0, 100);

            if (!this.processedMessages) {
                this.processedMessages = new Set();
            }

            if (this.processedMessages.has(messageKey)) {
                console.log('[DeepMemoryManager] ⚠️ 消息已处理，跳过重复处理');
                return;
            }

            // 标记消息已处理
            this.processedMessages.add(messageKey);

            // 限制Set大小，防止内存泄漏
            if (this.processedMessages.size > 1000) {
                const firstKey = this.processedMessages.values().next().value;
                this.processedMessages.delete(firstKey);
            }

            // 🔧 修复：更强大的消息内容提取逻辑
            let messageContent = '';
            let isUser = false;

            // 尝试多种方式提取消息内容
            if (data.message) {
                messageContent = data.message;
                isUser = data.isUser || false;
            } else if (data.mes) {
                messageContent = data.mes;
                isUser = data.is_user || false;
            } else if (typeof data === 'string') {
                messageContent = data;
                isUser = false;
            } else if (data.content) {
                messageContent = data.content;
                isUser = data.isUser || false;
            }

            // 清理HTML标签和特殊标记
            if (messageContent) {
                messageContent = messageContent.replace(/<[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
            }

            console.log('[DeepMemoryManager] 🔍 提取的消息内容长度:', messageContent.length);
            console.log('[DeepMemoryManager] 🔍 消息内容预览:', messageContent.substring(0, 100) + '...');

            // 🔧 修复：降低消息长度要求，处理更多消息
            if (messageContent && messageContent.length > 10) {
                console.log('[DeepMemoryManager] 📝 处理消息:', messageContent.substring(0, 50) + '...');

                // 🔧 P1修复：确保chatId被正确提取和记录
                const currentChatId = this.unifiedDataCore?.getCurrentChatId?.() ||
                                     data.chatId ||
                                     data.metadata?.chatId ||
                                     'unknown';

                console.log('[DeepMemoryManager] 🆔 当前聊天ID:', currentChatId);

                const memoryData = {
                    content: messageContent,
                    type: isUser ? 'user_message' : 'assistant_message',
                    source: 'chat_message',
                    metadata: {
                        isUser: isUser,
                        timestamp: data.timestamp || Date.now(),
                        chatId: currentChatId,  // 🔧 P1修复：明确记录chatId
                        originalData: {
                            ...data,
                            chatId: currentChatId  // 🔧 P1修复：在originalData中也记录chatId
                        }
                    }
                };

                console.log('[DeepMemoryManager] 🧠 添加记忆到感知层...');
                await this.addMemoryToSensoryLayer(memoryData);
                console.log('[DeepMemoryManager] ✅ 记忆处理完成');
            } else {
                console.log('[DeepMemoryManager] ⚠️ 消息太短或无效，跳过处理:', messageContent?.length || 0, '字符');
                console.log('[DeepMemoryManager] 🔍 原始数据结构:', Object.keys(data || {}));
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 辅助方法：计算相似度
     */
    async calculateSimilarity(text1, text2) {
        try {
            if (this.vectorizedMemoryRetrieval) {
                const vector1 = await this.vectorizedMemoryRetrieval.vectorizeText(text1);
                const vector2 = await this.vectorizedMemoryRetrieval.vectorizeText(text2);

                if (vector1 && vector2) {
                    return this.vectorizedMemoryRetrieval.calculateCosineSimilarity(vector1, vector2);
                }
            }

            // 降级到基础文本相似度
            return this.basicTextSimilarity(text1, text2);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 计算相似度失败:', error);
            return 0;
        }
    }

    /**
     * 基础文本相似度计算
     */
    basicTextSimilarity(text1, text2) {
        try {
            const words1 = new Set(text1.toLowerCase().split(/\s+/));
            const words2 = new Set(text2.toLowerCase().split(/\s+/));

            const intersection = new Set([...words1].filter(word => words2.has(word)));
            const union = new Set([...words1, ...words2]);

            return intersection.size / union.size;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 获取当前上下文
     */
    async getCurrentContext() {
        try {
            // 从短期记忆中获取最近的上下文
            const shortTermMemories = Array.from(this.memoryLayers.shortTerm.values());
            if (shortTermMemories.length === 0) return null;

            // 按时间排序，获取最新的记忆
            shortTermMemories.sort((a, b) => b.timestamp - a.timestamp);
            const recentMemories = shortTermMemories.slice(0, 3);

            return recentMemories.map(memory => memory.content).join(' ');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 获取当前上下文失败:', error);
            return null;
        }
    }

    /**
     * 获取最近记忆
     */
    async getRecentMemories(count = 5) {
        try {
            const allMemories = [];

            // 收集所有记忆
            for (const layer of Object.values(this.memoryLayers)) {
                allMemories.push(...Array.from(layer.values()));
            }

            // 按时间排序
            allMemories.sort((a, b) => b.timestamp - a.timestamp);

            return allMemories.slice(0, count);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 获取最近记忆失败:', error);
            return [];
        }
    }

    /**
     * 查找相似记忆
     */
    async findSimilarMemories(targetMemory, threshold = 0.7) {
        try {
            const similarMemories = [];

            for (const layer of Object.values(this.memoryLayers)) {
                for (const memory of layer.values()) {
                    if (memory.id === targetMemory.id) continue;

                    const similarity = await this.calculateSimilarity(
                        targetMemory.content,
                        memory.content
                    );

                    if (similarity >= threshold) {
                        similarMemories.push({
                            memory: memory,
                            similarity: similarity
                        });
                    }
                }
            }

            // 按相似度排序
            similarMemories.sort((a, b) => b.similarity - a.similarity);

            return similarMemories.map(item => item.memory);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 查找相似记忆失败:', error);
            return [];
        }
    }

    /**
     * 从指定层驱逐记忆
     */
    async evictFromLayer(layerName) {
        try {
            console.log(`[DeepMemoryManager] 🗑️ 从${layerName}层驱逐记忆...`);

            const layer = this.memoryLayers[layerName];
            const memories = Array.from(layer.values());

            if (memories.length === 0) return;

            // 计算综合分数并排序
            memories.forEach(memory => {
                memory.score = (
                    memory.importance * this.settings.importanceWeight +
                    memory.recency * this.settings.recencyWeight +
                    (memory.relevance || 0) * this.settings.relevanceWeight
                );
            });

            memories.sort((a, b) => a.score - b.score);

            // 驱逐最低分的记忆
            const memoryToEvict = memories[0];
            layer.delete(memoryToEvict.id);
            this.memoryIndex.delete(memoryToEvict.id);

            console.log(`[DeepMemoryManager] 🗑️ 已从${layerName}层驱逐记忆: ${memoryToEvict.id}`);

        } catch (error) {
            console.error(`[DeepMemoryManager] ❌ 从${layerName}层驱逐记忆失败:`, error);
        }
    }

    /**
     * 🔧 新增：启动延迟加载重试机制
     */
    startDelayedLoadRetry() {
        let retryCount = 0;
        const maxRetries = 5;
        const retryIntervals = [2000, 5000, 10000, 15000, 30000]; // 递增的重试间隔

        const attemptLoad = async () => {
            try {
                console.log(`[DeepMemoryManager] 🔄 延迟加载尝试 ${retryCount + 1}/${maxRetries}...`);

                // 检查UnifiedDataCore是否已完全初始化
                if (!this.unifiedDataCore || !this.unifiedDataCore.initialized) {
                    console.log('[DeepMemoryManager] ⚠️ UnifiedDataCore尚未完全初始化，继续等待...');
                    scheduleNextRetry();
                    return;
                }

                await this.loadExistingMemories();

                if (this.stats.totalMemories > 0) {
                    console.log(`[DeepMemoryManager] ✅ 延迟加载成功，恢复了 ${this.stats.totalMemories} 个记忆`);
                    return; // 成功加载，停止重试
                } else {
                    console.log('[DeepMemoryManager] ⚠️ 延迟加载仍未找到数据，继续重试...');
                    scheduleNextRetry();
                }
            } catch (error) {
                console.error('[DeepMemoryManager] ❌ 延迟加载失败:', error);
                scheduleNextRetry();
            }
        };

        const scheduleNextRetry = () => {
            retryCount++;
            if (retryCount < maxRetries) {
                const delay = retryIntervals[retryCount - 1] || 30000;
                console.log(`[DeepMemoryManager] ⏰ 将在 ${delay}ms 后进行第 ${retryCount + 1} 次重试`);
                setTimeout(attemptLoad, delay);
            } else {
                console.warn('[DeepMemoryManager] ⚠️ 已达到最大重试次数，停止延迟加载重试');
            }
        };

        // 开始第一次重试
        setTimeout(attemptLoad, retryIntervals[0]);
    }

    /**
     * 加载现有记忆数据
     * @param {string} targetChatId - 可选的目标聊天ID，如果不提供则使用当前聊天ID
     */
    async loadExistingMemories(targetChatId = null) {
        try {
            console.log('[DeepMemoryManager] 📥 加载现有记忆数据...');

            if (!this.unifiedDataCore) return;

            // 🔧 P0+修复：优先使用传入的targetChatId，否则使用当前聊天ID
            const currentChatId = targetChatId || this.unifiedDataCore.getCurrentChatId?.() || 'default';
            console.log('[DeepMemoryManager] 📍 目标聊天ID:', currentChatId);
            if (targetChatId) {
                console.log('[DeepMemoryManager] 🎯 使用指定的聊天ID:', targetChatId);
            }

            const layerNames = ['sensory', 'shortTerm', 'longTerm', 'deepArchive'];
            let loadedCount = 0;

            for (const layerName of layerNames) {
                // 🔧 P0+修复：只加载带当前聊天ID的数据，不再加载历史数据
                const layerKeyWithChat = `deep_memory_${layerName}_${currentChatId}`;
                const layerData = await this.unifiedDataCore.getData(layerKeyWithChat);

                if (layerData && Object.keys(layerData).length > 0) {
                    console.log(`[DeepMemoryManager] 📥 加载 ${layerName} 层数据: ${Object.keys(layerData).length} 个记忆`);

                    // 🔧 P0+修复：验证每个记忆是否属于当前聊天
                    for (const [id, memory] of Object.entries(layerData)) {
                        const memoryChatId = memory.metadata?.chatId ||
                                           memory.metadata?.originalData?.chatId ||
                                           'unknown';

                        // 只加载属于当前聊天的记忆
                        if (memoryChatId === currentChatId || memoryChatId === 'unknown') {
                            this.memoryLayers[layerName].set(id, memory);
                            this.memoryIndex.set(id, memory);
                            this.stats.totalMemories++;
                            loadedCount++;
                        } else {
                            console.warn(`[DeepMemoryManager] ⚠️ 跳过不属于当前聊天的记忆: ${id} (chatId: ${memoryChatId})`);
                        }
                    }

                    console.log(`[DeepMemoryManager] ✅ ${layerName} 层加载完成: ${this.memoryLayers[layerName].size} 个记忆`);
                } else {
                    console.log(`[DeepMemoryManager] 📭 ${layerName} 层无数据`);
                }
            }

            console.log(`[DeepMemoryManager] ✅ 加载完成: ${loadedCount} 个记忆 (聊天: ${currentChatId})`);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 加载现有记忆数据失败:', error);
        }
    }

    /**
     * 保存记忆数据
     */
    async saveMemoryData() {
        try {
            console.log('[DeepMemoryManager] 💾 保存记忆数据...');

            if (!this.unifiedDataCore) return;

            // 🔧 修复：获取当前聊天ID，按聊天分别保存记忆数据
            const currentChatId = this.unifiedDataCore.getCurrentChatId?.() || 'default';
            console.log('[DeepMemoryManager] 📍 保存到聊天:', currentChatId);

            // 保存各层记忆数据，使用聊天ID作为前缀
            for (const [layerName, layer] of Object.entries(this.memoryLayers)) {
                const layerData = Object.fromEntries(layer);
                const layerKey = `deep_memory_${layerName}_${currentChatId}`;
                await this.unifiedDataCore.setData(layerKey, layerData);
            }

            console.log(`[DeepMemoryManager] ✅ 记忆数据保存完成 (聊天: ${currentChatId})`);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 保存记忆数据失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            const newChatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[DeepMemoryManager] 🔄 处理聊天切换事件, 新聊天ID:', newChatId);

            if (!this.settings.enabled) {
                console.log('[DeepMemoryManager] ⏸️ 深度记忆管理器已禁用，跳过聊天切换处理');
                return;
            }

            // 🔧 P0修复：保存当前聊天的记忆数据（如果有）
            if (this.stats.totalMemories > 0) {
                console.log('[DeepMemoryManager] 💾 保存当前聊天的记忆数据...');
                console.log(`[DeepMemoryManager] 📊 保存前统计: ${this.stats.totalMemories} 个记忆`);
                await this.saveMemoryData();
            } else {
                console.log('[DeepMemoryManager] ⚠️ 记忆层为空，跳过保存');
            }

            // 🔧 P0修复：强制清理所有层级的记忆数据
            console.log('[DeepMemoryManager] 🧹 强制清理所有记忆层级...');
            this.memoryLayers.sensory.clear();
            this.memoryLayers.shortTerm.clear();
            this.memoryLayers.longTerm.clear();
            this.memoryLayers.deepArchive.clear();

            // 🔧 P0修复：清理所有索引和元数据
            this.memoryIndex.clear();
            this.memoryMetadata.clear();
            this.memoryRelations.clear();
            this.memoryConflicts.clear();

            // 🔧 P0修复：重置统计信息
            this.stats.totalMemories = 0;
            this.stats.memoryMigrations = 0;
            this.stats.conflictsResolved = 0;
            this.stats.lastMaintenanceTime = Date.now();

            console.log('[DeepMemoryManager] ✅ 内存清理完成');

            // 🔧 P0修复：等待一小段时间确保清理完成
            await new Promise(resolve => setTimeout(resolve, 100));

            // 🔧 P0+修复：重新加载新聊天的记忆数据，传入新的chatId
            console.log('[DeepMemoryManager] 📥 重新加载新聊天的记忆数据...');
            console.log('[DeepMemoryManager] 🆔 目标聊天ID:', newChatId);
            await this.loadExistingMemories(newChatId);

            console.log('[DeepMemoryManager] ✅ 聊天切换处理完成');
            console.log(`[DeepMemoryManager] 📊 新聊天记忆统计: 总计 ${this.stats.totalMemories} 个记忆`);

            // 验证清理是否成功
            const totalInMemory = this.memoryLayers.sensory.size +
                                 this.memoryLayers.shortTerm.size +
                                 this.memoryLayers.longTerm.size +
                                 this.memoryLayers.deepArchive.size;

            if (totalInMemory !== this.stats.totalMemories) {
                console.warn('[DeepMemoryManager] ⚠️ 记忆统计不一致！内存中:', totalInMemory, '统计:', this.stats.totalMemories);
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理聊天切换事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理向量化记忆索引事件
     */
    async handleVectorizedMemoryIndexed(data) {
        try {
            console.log('[DeepMemoryManager] 🔍 处理向量化记忆索引事件');

            if (!this.settings.enabled || !data.memoryId) return;

            // 查找对应的记忆
            const memory = this.memoryIndex.get(data.memoryId);
            if (memory && data.vector) {
                // 更新记忆的向量信息
                memory.vector = data.vector;
                memory.metadata.vectorized = true;
                memory.metadata.vectorizedTime = Date.now();

                console.log(`[DeepMemoryManager] ✅ 记忆向量化完成: ${data.memoryId}`);
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理向量化记忆索引事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息删除事件
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[DeepMemoryManager] 🗑️ 处理消息删除事件', data);

            if (!this.settings.enabled) {
                console.log('[DeepMemoryManager] ⚠️ 深度记忆管理未启用，跳过处理');
                return;
            }

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[DeepMemoryManager] ℹ️ 跳过记忆回溯（删除的是用户消息）');
                return;
            }

            console.log('[DeepMemoryManager] 🔄 开始记忆数据回溯（AI消息被删除）...');

            // 获取当前聊天ID
            const chatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId();
            if (!chatId) {
                console.warn('[DeepMemoryManager] ⚠️ 无法获取聊天ID，跳过记忆回溯');
                return;
            }

            console.log('[DeepMemoryManager] 📍 聊天ID:', chatId);
            console.log('[DeepMemoryManager] 📊 回溯前记忆统计:', {
                sensory: this.memoryLayers.sensory.size,
                shortTerm: this.memoryLayers.shortTerm.size,
                longTerm: this.memoryLayers.longTerm.size,
                deepArchive: this.memoryLayers.deepArchive.size,
                total: this.stats.totalMemories
            });

            // 1. 清理最近的记忆数据
            await this.clearRecentMemories();

            // 2. 🔧 新增：清理UnifiedDataCore中的AI记忆数据
            if (this.unifiedDataCore) {
                console.log('[DeepMemoryManager] 🧹 清理UnifiedDataCore中的AI记忆数据...');
                try {
                    // 清理AI记忆摘要
                    await this.unifiedDataCore.deleteData('ai_memory_summary', 'chat');
                    console.log('[DeepMemoryManager] ✅ 已清理AI记忆摘要');
                } catch (coreError) {
                    console.warn('[DeepMemoryManager] ⚠️ 清理UnifiedDataCore数据失败:', coreError);
                }
            }

            // 3. 重新加载记忆数据
            await this.loadExistingMemories();

            console.log('[DeepMemoryManager] 📊 回溯后记忆统计:', {
                sensory: this.memoryLayers.sensory.size,
                shortTerm: this.memoryLayers.shortTerm.size,
                longTerm: this.memoryLayers.longTerm.size,
                deepArchive: this.memoryLayers.deepArchive.size,
                total: this.stats.totalMemories
            });

            console.log('[DeepMemoryManager] ✅ 消息删除记忆回溯完成');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息重新生成事件
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[DeepMemoryManager] 🔄 处理消息重新生成事件', data);

            if (!this.settings.enabled) {
                console.log('[DeepMemoryManager] ⚠️ 深度记忆管理未启用，跳过处理');
                return;
            }

            // 获取当前聊天ID
            const chatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId();
            if (!chatId) {
                console.warn('[DeepMemoryManager] ⚠️ 无法获取聊天ID，跳过记忆回溯');
                return;
            }

            console.log('[DeepMemoryManager] 🔄 开始记忆数据回溯（重新生成）...');
            console.log('[DeepMemoryManager] 📍 聊天ID:', chatId);
            console.log('[DeepMemoryManager] 📊 回溯前记忆统计:', {
                sensory: this.memoryLayers.sensory.size,
                shortTerm: this.memoryLayers.shortTerm.size,
                longTerm: this.memoryLayers.longTerm.size,
                deepArchive: this.memoryLayers.deepArchive.size,
                total: this.stats.totalMemories
            });

            // 1. 清理最近的记忆数据
            await this.clearRecentMemories();

            // 2. 🔧 新增：清理UnifiedDataCore中的AI记忆数据
            if (this.unifiedDataCore) {
                console.log('[DeepMemoryManager] 🧹 清理UnifiedDataCore中的AI记忆数据...');
                try {
                    await this.unifiedDataCore.deleteData('ai_memory_summary', 'chat');
                    console.log('[DeepMemoryManager] ✅ 已清理AI记忆摘要');
                } catch (coreError) {
                    console.warn('[DeepMemoryManager] ⚠️ 清理UnifiedDataCore数据失败:', coreError);
                }
            }

            // 3. 重新加载记忆数据
            await this.loadExistingMemories();

            console.log('[DeepMemoryManager] 📊 回溯后记忆统计:', {
                sensory: this.memoryLayers.sensory.size,
                shortTerm: this.memoryLayers.shortTerm.size,
                longTerm: this.memoryLayers.longTerm.size,
                deepArchive: this.memoryLayers.deepArchive.size,
                total: this.stats.totalMemories
            });

            console.log('[DeepMemoryManager] ✅ 消息重新生成记忆回溯完成');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 处理消息重新生成事件失败:', error);
        }
    }

    /**
     * 🔧 新增：清理最近的记忆数据
     */
    async clearRecentMemories() {
        try {
            console.log('[DeepMemoryManager] 🧹 清理最近的记忆数据...');

            let totalCleared = 0;

            // 1. 清理感知记忆层（最新的记忆）
            const sensoryMemoryCount = this.memoryLayers.sensory.size;
            this.memoryLayers.sensory.clear();
            totalCleared += sensoryMemoryCount;

            // 2. 清理短期记忆中的最近记忆
            const now = Date.now();
            const recentThreshold = 5 * 60 * 1000; // 🔧 修改为5分钟内的记忆（更激进的清理）

            const shortTermCleared = [];
            for (const [id, memory] of this.memoryLayers.shortTerm) {
                if (now - memory.timestamp < recentThreshold) {
                    this.memoryLayers.shortTerm.delete(id);
                    this.memoryIndex.delete(id);
                    shortTermCleared.push(id);
                }
            }
            totalCleared += shortTermCleared.length;

            // 3. 🔧 新增：清理向量化记忆索引中的最近记忆
            if (this.vectorizedMemoryRetrieval) {
                console.log('[DeepMemoryManager] 🔍 清理向量化记忆索引...');
                try {
                    // 获取所有向量化记忆
                    const allVectorMemories = await this.vectorizedMemoryRetrieval.getAllMemories?.() || [];

                    // 找出需要删除的记忆ID
                    const vectorMemoriesToDelete = allVectorMemories
                        .filter(vm => now - vm.timestamp < recentThreshold)
                        .map(vm => vm.id);

                    // 删除向量化记忆
                    for (const id of vectorMemoriesToDelete) {
                        await this.vectorizedMemoryRetrieval.deleteMemory?.(id);
                    }

                    console.log(`[DeepMemoryManager] 🗑️ 已清理 ${vectorMemoriesToDelete.length} 个向量化记忆`);
                    totalCleared += vectorMemoriesToDelete.length;
                } catch (vectorError) {
                    console.warn('[DeepMemoryManager] ⚠️ 清理向量化记忆失败:', vectorError);
                }
            }

            // 4. 更新统计信息
            this.stats.totalMemories = this.memoryLayers.sensory.size +
                                      this.memoryLayers.shortTerm.size +
                                      this.memoryLayers.longTerm.size +
                                      this.memoryLayers.deepArchive.size;

            console.log(`[DeepMemoryManager] ✅ 已清理 ${totalCleared} 个最近记忆`);
            console.log(`[DeepMemoryManager] 📊 剩余记忆: ${this.stats.totalMemories} 个`);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 清理最近记忆失败:', error);
        }
    }

    /**
     * 检测和解决冲突
     */
    async detectAndResolveConflicts() {
        try {
            console.log('[DeepMemoryManager] 🔍 检测记忆冲突...');

            const conflicts = [];
            const allMemories = [];

            // 收集所有记忆
            for (const layer of Object.values(this.memoryLayers)) {
                allMemories.push(...Array.from(layer.values()));
            }

            // 检测内容相似但分类不同的记忆
            for (let i = 0; i < allMemories.length; i++) {
                for (let j = i + 1; j < allMemories.length; j++) {
                    const memory1 = allMemories[i];
                    const memory2 = allMemories[j];

                    const similarity = await this.calculateSimilarity(memory1.content, memory2.content);

                    if (similarity > 0.8 && memory1.category !== memory2.category) {
                        conflicts.push({
                            memory1: memory1,
                            memory2: memory2,
                            similarity: similarity,
                            type: 'category_conflict'
                        });
                    }
                }
            }

            // 解决冲突
            for (const conflict of conflicts) {
                await this.resolveMemoryConflict(conflict);
            }

            this.stats.conflictsResolved += conflicts.length;

            if (conflicts.length > 0) {
                console.log(`[DeepMemoryManager] ✅ 解决了 ${conflicts.length} 个记忆冲突`);
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 检测和解决冲突失败:', error);
        }
    }

    /**
     * 解决记忆冲突
     */
    async resolveMemoryConflict(conflict) {
        try {
            const { memory1, memory2, similarity } = conflict;

            // 选择重要性更高的记忆作为主记忆
            const primaryMemory = memory1.importance >= memory2.importance ? memory1 : memory2;
            const secondaryMemory = memory1.importance >= memory2.importance ? memory2 : memory1;

            // 合并记忆信息
            primaryMemory.metadata.mergedFrom = primaryMemory.metadata.mergedFrom || [];
            primaryMemory.metadata.mergedFrom.push({
                id: secondaryMemory.id,
                content: secondaryMemory.content,
                timestamp: secondaryMemory.timestamp,
                mergedAt: Date.now()
            });

            // 删除次要记忆
            for (const layer of Object.values(this.memoryLayers)) {
                if (layer.has(secondaryMemory.id)) {
                    layer.delete(secondaryMemory.id);
                    break;
                }
            }

            this.memoryIndex.delete(secondaryMemory.id);

            console.log(`[DeepMemoryManager] 🔗 合并冲突记忆: ${secondaryMemory.id} -> ${primaryMemory.id}`);

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 解决记忆冲突失败:', error);
        }
    }

    /**
     * 压缩记忆
     */
    async compressMemories() {
        try {
            console.log('[DeepMemoryManager] 🗜️ 压缩记忆...');

            let compressionCount = 0;

            // 压缩长期记忆中的相似记忆
            const longTermMemories = Array.from(this.memoryLayers.longTerm.values());

            for (let i = 0; i < longTermMemories.length; i++) {
                const memory = longTermMemories[i];

                // 查找相似记忆
                const similarMemories = [];
                for (let j = i + 1; j < longTermMemories.length; j++) {
                    const otherMemory = longTermMemories[j];
                    const similarity = await this.calculateSimilarity(memory.content, otherMemory.content);

                    if (similarity > 0.7) {
                        similarMemories.push(otherMemory);
                    }
                }

                // 如果有多个相似记忆，进行压缩
                if (similarMemories.length >= 2) {
                    await this.compressMemoryGroup([memory, ...similarMemories]);
                    compressionCount++;
                }
            }

            // 更新压缩比率
            if (longTermMemories.length > 0) {
                this.stats.compressionRatio = compressionCount / longTermMemories.length;
            }

            if (compressionCount > 0) {
                console.log(`[DeepMemoryManager] ✅ 压缩了 ${compressionCount} 组记忆`);
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 压缩记忆失败:', error);
        }
    }

    /**
     * 压缩记忆组
     */
    async compressMemoryGroup(memories) {
        try {
            if (memories.length < 2) return;

            // 选择最重要的记忆作为主记忆
            const primaryMemory = memories.reduce((best, current) =>
                current.importance > best.importance ? current : best
            );

            // 创建压缩摘要
            const contents = memories.map(m => m.content);
            const compressedContent = await this.createCompressedSummary(contents);

            // 更新主记忆
            primaryMemory.content = compressedContent;
            primaryMemory.metadata.compressed = true;
            primaryMemory.metadata.originalCount = memories.length;
            primaryMemory.metadata.compressedAt = Date.now();

            // 删除其他记忆
            for (const memory of memories) {
                if (memory.id !== primaryMemory.id) {
                    this.memoryLayers.longTerm.delete(memory.id);
                    this.memoryIndex.delete(memory.id);
                }
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 压缩记忆组失败:', error);
        }
    }

    /**
     * 创建压缩摘要
     */
    async createCompressedSummary(contents) {
        try {
            // 简单的压缩策略：合并内容并去重
            const allText = contents.join(' ');
            const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);

            // 去重相似句子
            const uniqueSentences = [];
            for (const sentence of sentences) {
                const isDuplicate = uniqueSentences.some(existing =>
                    this.basicTextSimilarity(sentence.trim(), existing.trim()) > 0.8
                );

                if (!isDuplicate) {
                    uniqueSentences.push(sentence.trim());
                }
            }

            return uniqueSentences.join('. ') + '.';

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 创建压缩摘要失败:', error);
            return contents[0]; // 降级到第一个内容
        }
    }

    /**
     * 执行深度维护
     */
    async performDeepMaintenance() {
        try {
            console.log('[DeepMemoryManager] 🔧 执行深度维护...');

            // 深度分析记忆模式
            await this.analyzeMemoryPatterns();

            // 优化记忆索引
            await this.optimizeMemoryIndex();

            // 清理过期记忆
            await this.cleanupExpiredMemories();

            // 保存维护后的数据
            await this.saveMemoryData();

            console.log('[DeepMemoryManager] ✅ 深度维护完成');

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 深度维护失败:', error);
        }
    }

    /**
     * 分析记忆模式
     */
    async analyzeMemoryPatterns() {
        try {
            // 分析记忆的时间分布
            const allMemories = [];
            for (const layer of Object.values(this.memoryLayers)) {
                allMemories.push(...Array.from(layer.values()));
            }

            // 计算平均重要性
            if (allMemories.length > 0) {
                const totalImportance = allMemories.reduce((sum, memory) =>
                    sum + (memory.importance || 0.5), 0);
                this.stats.averageImportance = totalImportance / allMemories.length;
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 分析记忆模式失败:', error);
        }
    }

    /**
     * 优化记忆索引
     */
    async optimizeMemoryIndex() {
        try {
            // 重建记忆索引
            this.memoryIndex.clear();

            for (const [layerName, layer] of Object.entries(this.memoryLayers)) {
                for (const [id, memory] of layer) {
                    this.memoryIndex.set(id, memory);
                }
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 优化记忆索引失败:', error);
        }
    }

    /**
     * 清理过期记忆
     */
    async cleanupExpiredMemories() {
        try {
            const now = Date.now();
            const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

            // 清理过期的感知记忆
            for (const [id, memory] of this.memoryLayers.sensory) {
                if (memory.timestamp < oneMonthAgo && memory.importance < 0.3) {
                    this.memoryLayers.sensory.delete(id);
                    this.memoryIndex.delete(id);
                }
            }

        } catch (error) {
            console.error('[DeepMemoryManager] ❌ 清理过期记忆失败:', error);
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            settings: this.settings,
            memoryLayers: {
                sensory: this.memoryLayers.sensory.size,
                shortTerm: this.memoryLayers.shortTerm.size,
                longTerm: this.memoryLayers.longTerm.size,
                deepArchive: this.memoryLayers.deepArchive.size
            },
            stats: this.stats,
            isProcessing: this.isProcessing,
            errorCount: this.errorCount
        };
    }
}
