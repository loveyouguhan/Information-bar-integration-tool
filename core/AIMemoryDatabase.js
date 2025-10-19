/**
 * AI记忆数据库
 * 
 * 基于关键词和重要性的智能记忆检索系统：
 * - 关键词索引构建
 * - 基于关键词的记忆检索
 * - 重要性加权排序
 * - 记忆层级整合（感知/短期/长期/归档）
 * - AI思考驱动的记忆获取
 * 
 * 核心功能：
 * - 自动从AI记忆总结中提取关键词并建立索引
 * - 支持多关键词联合检索
 * - 按重要性和相关性排序
 * - 与深度记忆管理器深度整合
 * - 提供AI思考接口，让AI主动检索所需记忆
 * 
 * @class AIMemoryDatabase
 */

export class AIMemoryDatabase {
    constructor(dependencies = {}) {
        console.log('[AIMemoryDatabase] 🗄️ AI记忆数据库初始化开始');
        
        // 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.deepMemoryManager = dependencies.deepMemoryManager || null;
        this.aiMemorySummarizer = dependencies.aiMemorySummarizer || null;
        
        // 数据库核心结构
        this.database = {
            // 关键词索引：Map<keyword, Set<memoryId>>
            keywordIndex: new Map(),
            
            // 记忆存储：Map<memoryId, memoryData>
            memories: new Map(),
            
            // 重要性索引：按重要性分层存储记忆ID
            importanceIndex: {
                critical: new Set(),      // 0.9-1.0 关键记忆
                high: new Set(),          // 0.7-0.9 高重要性
                medium: new Set(),        // 0.5-0.7 中等重要性
                low: new Set()            // 0.0-0.5 低重要性
            },
            
            // 分类索引：Map<category, Set<memoryId>>
            categoryIndex: new Map(),
            
            // 时间索引：按时间排序的记忆ID数组
            timelineIndex: []
        };
        
        // 统计信息
        this.stats = {
            totalMemories: 0,
            totalKeywords: 0,
            averageImportance: 0,
            lastIndexTime: 0,
            indexedLayers: {
                sensory: 0,
                shortTerm: 0,
                longTerm: 0,
                deepArchive: 0
            }
        };
        
        // 配置
        this.config = {
            enabled: false,                         // 🔧 修复：默认禁用，需要用户在设置中启用
            autoIndexing: true,                     // 自动索引新记忆
            minKeywordLength: 2,                    // 最小关键词长度
            maxKeywordsPerMemory: 10,               // 每个记忆最多关键词数
            similarityThreshold: 0.3,               // 🔧 优化：降低相似度阈值，增加召回率
            maxSearchResults: 20,                   // 最大搜索结果数
            enableThinkingInterface: true,          // 启用AI思考接口
            cacheSearchResults: true,               // 缓存搜索结果
            updateInterval: 60000,                  // 索引更新间隔（毫秒）
            minImportance: 0.5                      // 🔧 新增：最小重要性过滤
        };
        
        // 搜索缓存
        this.searchCache = new Map();
        this.cacheTimeout = 300000; // 5分钟缓存过期
        
        // 初始化状态
        this.initialized = false;
        this.isIndexing = false;
        this.errorCount = 0;
        
        console.log('[AIMemoryDatabase] 🏗️ 构造函数完成');
    }

    /**
     * 初始化AI记忆数据库
     */
    async init() {
        try {
            console.log('[AIMemoryDatabase] 📊 开始初始化AI记忆数据库...');

            // 加载配置
            await this.loadConfig();

            // 绑定事件监听
            this.bindEventListeners();

            // 从深度记忆管理器加载现有记忆
            await this.loadExistingMemories();

            // 构建初始索引
            await this.buildInitialIndex();

            this.initialized = true;
            console.log('[AIMemoryDatabase] ✅ AI记忆数据库初始化完成');
            console.log('[AIMemoryDatabase] 📊 数据库统计:', {
                记忆总数: this.stats.totalMemories,
                关键词总数: this.stats.totalKeywords,
                平均重要性: this.stats.averageImportance.toFixed(2)
            });

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('aiMemoryDatabase:initialized', {
                    stats: this.stats,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            console.log('[AIMemoryDatabase] 📥 加载AI记忆数据库配置...');

            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 🔧 修复：从memoryEnhancement.aiDatabase读取配置
            const aiDatabaseConfig = configs.memoryEnhancement?.aiDatabase || configs.aiMemoryDatabase;

            if (aiDatabaseConfig) {
                Object.assign(this.config, aiDatabaseConfig);
                console.log('[AIMemoryDatabase] ✅ 从扩展设置加载配置:', this.config);
            } else {
                console.log('[AIMemoryDatabase] ℹ️ 使用默认配置');
            }

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            // 🔧 修复：保存到memoryEnhancement.aiDatabase
            if (!configs.memoryEnhancement) {
                configs.memoryEnhancement = {};
            }
            configs.memoryEnhancement.aiDatabase = this.config;
            
            // 也保存到aiMemoryDatabase（向后兼容）
            configs.aiMemoryDatabase = this.config;
            
            extensionSettings['Information bar integration tool'] = configs;

            await context.saveSettingsDebounced();
            console.log('[AIMemoryDatabase] ✅ 配置已保存到memoryEnhancement.aiDatabase');

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 保存配置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[AIMemoryDatabase] 🔗 绑定事件监听器...');

            if (!this.eventSystem) {
                console.warn('[AIMemoryDatabase] ⚠️ 事件系统不可用');
                return;
            }

            // 监听AI记忆总结创建事件
            this.eventSystem.on('ai-summary:created', (data) => this.handleAISummaryCreated(data));

            // 监听深度记忆添加事件
            this.eventSystem.on('deepMemory:memoryAdded', (data) => this.handleMemoryAdded(data));

            // 监听聊天切换事件
            this.eventSystem.on('chat:switched', (data) => this.handleChatSwitched(data));

            console.log('[AIMemoryDatabase] ✅ 事件监听器绑定完成');

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 从深度记忆管理器加载现有记忆
     */
    async loadExistingMemories() {
        try {
            console.log('[AIMemoryDatabase] 📥 从深度记忆管理器加载现有记忆...');

            if (!this.deepMemoryManager || !this.deepMemoryManager.initialized) {
                console.warn('[AIMemoryDatabase] ⚠️ 深度记忆管理器不可用');
                return;
            }

            const layers = ['sensory', 'shortTerm', 'longTerm', 'deepArchive'];
            let loadedCount = 0;

            for (const layerName of layers) {
                const layer = this.deepMemoryManager.memoryLayers[layerName];
                if (!layer || layer.size === 0) continue;

                console.log(`[AIMemoryDatabase] 📂 加载${layerName}层记忆，共${layer.size}条`);

                for (const [memoryId, memoryData] of layer.entries()) {
                    await this.indexMemory(memoryId, memoryData, layerName);
                    loadedCount++;
                }

                this.stats.indexedLayers[layerName] = layer.size;
            }

            console.log(`[AIMemoryDatabase] ✅ 加载完成，共索引${loadedCount}条记忆`);

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 加载现有记忆失败:', error);
        }
    }

    /**
     * 构建初始索引
     */
    async buildInitialIndex() {
        try {
            console.log('[AIMemoryDatabase] 🏗️ 构建初始索引...');

            if (this.database.memories.size === 0) {
                console.log('[AIMemoryDatabase] ℹ️ 没有记忆数据，跳过索引构建');
                return;
            }

            // 统计信息
            this.updateStats();

            console.log('[AIMemoryDatabase] ✅ 初始索引构建完成');

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 构建初始索引失败:', error);
        }
    }

    /**
     * 索引单个记忆
     * @param {string} memoryId - 记忆ID
     * @param {Object} memoryData - 记忆数据
     * @param {string} layer - 记忆层级
     */
    async indexMemory(memoryId, memoryData, layer = 'unknown') {
        try {
            // 提取记忆的关键信息
            const importance = this.extractImportance(memoryData);
            
            // 🔧 优化：重要性过滤
            if (importance < this.config.minImportance) {
                console.log(`[AIMemoryDatabase] ⏭️ 跳过低重要性记忆: ${memoryId.substring(0, 20)}... (重要性: ${importance.toFixed(2)} < ${this.config.minImportance})`);
                return;
            }
            
            const keywords = this.extractKeywords(memoryData);
            const category = this.extractCategory(memoryData);
            const timestamp = this.extractTimestamp(memoryData);

            // 创建记忆索引条目
            const indexedMemory = {
                id: memoryId,
                content: memoryData.content || memoryData.summary || '',
                importance: importance,
                keywords: keywords,
                category: category,
                timestamp: timestamp,
                layer: layer,
                metadata: {
                    messageId: memoryData.messageId,
                    tags: memoryData.tags || [],
                    source: memoryData.source || 'unknown',
                    type: memoryData.type || 'unknown'
                }
            };

            // 存储记忆
            this.database.memories.set(memoryId, indexedMemory);

            // 建立关键词索引
            for (const keyword of keywords) {
                if (!this.database.keywordIndex.has(keyword)) {
                    this.database.keywordIndex.set(keyword, new Set());
                }
                this.database.keywordIndex.get(keyword).add(memoryId);
            }

            // 建立重要性索引
            this.addToImportanceIndex(memoryId, importance);

            // 建立分类索引
            if (category) {
                if (!this.database.categoryIndex.has(category)) {
                    this.database.categoryIndex.set(category, new Set());
                }
                this.database.categoryIndex.get(category).add(memoryId);
            }

            // 添加到时间线索引
            this.database.timelineIndex.push({
                id: memoryId,
                timestamp: timestamp
            });

            // 保持时间线排序
            this.database.timelineIndex.sort((a, b) => b.timestamp - a.timestamp);

            console.log(`[AIMemoryDatabase] 📌 记忆已索引: ${memoryId.substring(0, 20)}... (关键词: ${keywords.length}, 重要性: ${importance.toFixed(2)})`);

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 索引记忆失败:', error);
        }
    }

    /**
     * 提取记忆的重要性
     */
    extractImportance(memoryData) {
        if (typeof memoryData.importance === 'number') {
            return Math.max(0, Math.min(1, memoryData.importance));
        }
        
        // 根据记忆类型和来源估算重要性
        if (memoryData.type === 'ai_memory' || memoryData.source === 'ai_memory_summary') {
            return 0.7; // AI总结默认较高重要性
        }
        
        return 0.5; // 默认中等重要性
    }

    /**
     * 提取记忆的关键词
     */
    extractKeywords(memoryData) {
        const keywords = new Set();

        // 1. 从tags字段提取
        if (Array.isArray(memoryData.tags)) {
            memoryData.tags.forEach(tag => {
                if (typeof tag === 'string' && tag.length >= this.config.minKeywordLength) {
                    keywords.add(tag.toLowerCase());
                }
            });
        }

        // 2. 从metadata.tags提取
        if (memoryData.metadata && Array.isArray(memoryData.metadata.tags)) {
            memoryData.metadata.tags.forEach(tag => {
                if (typeof tag === 'string' && tag.length >= this.config.minKeywordLength) {
                    keywords.add(tag.toLowerCase());
                }
            });
        }

        // 3. 从category提取
        if (memoryData.category) {
            keywords.add(memoryData.category.toLowerCase());
        }

        // 4. 从内容中提取高频词（简单实现）
        if (memoryData.content && keywords.size < 3) {
            const contentKeywords = this.extractKeywordsFromContent(memoryData.content);
            contentKeywords.forEach(kw => keywords.add(kw));
        }

        // 限制关键词数量
        const keywordArray = Array.from(keywords).slice(0, this.config.maxKeywordsPerMemory);
        return keywordArray;
    }

    /**
     * 🔧 优化：从内容中提取关键词（智能提取）
     */
    extractKeywordsFromContent(content) {
        const keywords = new Set();
        
        // 1. 提取专有名词（人名、地名等，通常是2-4个字）
        const properNouns = content.match(/[A-Z一-龥]{2,4}(?:[•·]?[A-Z一-龥]{2,4})?/g) || [];
        properNouns.forEach(noun => {
            if (noun.length >= this.config.minKeywordLength && noun.length <= 6) {
                keywords.add(noun.toLowerCase());
            }
        });
        
        // 2. 提取重要动作词（基于语义模式）
        const actionPatterns = [
            /(?:发现|获得|失去|改变|决定|计划|前往|到达|离开|遭遇)了?([^\s，。！？]{2,6})/g,
            /(?:看到|听到|感觉|意识到|察觉到)([^\s，。！？]{2,6})/g
        ];
        
        actionPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1] && match[1].length >= this.config.minKeywordLength) {
                    keywords.add(match[1].toLowerCase());
                }
            }
        });
        
        // 3. 提取核心概念词（高频且有意义的词）
        const corePatterns = ['秘密', '密室', '线索', '关键', '重要', '发现', '谜题', '真相', '危险', '宝物', '任务', '目标'];
        corePatterns.forEach(pattern => {
            if (content.includes(pattern)) {
                keywords.add(pattern.toLowerCase());
            }
        });
        
        // 4. 提取引号包裹的内容（通常是重要概念）
        const quotedPatterns = [
            /"([^"]{2,10})"/g,
            /「([^」]{2,10})」/g,
            /『([^』]{2,10})』/g,
            /【([^】]{2,10})】/g
        ];
        
        quotedPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1] && match[1].length >= this.config.minKeywordLength) {
                    keywords.add(match[1].toLowerCase());
                }
            }
        });
        
        // 5. 如果关键词少于3个，使用分词提取
        if (keywords.size < 3) {
            const words = content.replace(/[，。！？、；：""''（）《》【】\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 2 && w.length <= 4);
            
            // 过滤常见停用词
            const stopWords = ['这个', '那个', '一些', '一个', '什么', '怎么', '为什么', '如何', '可以', '可能', '应该', '需要'];
            const filtered = words.filter(w => !stopWords.includes(w));
            
            filtered.slice(0, 3).forEach(w => keywords.add(w.toLowerCase()));
        }
        
        // 限制数量并返回
        return Array.from(keywords).slice(0, this.config.maxKeywordsPerMemory);
    }

    /**
     * 提取记忆的分类
     */
    extractCategory(memoryData) {
        if (memoryData.category) {
            return memoryData.category;
        }
        
        if (memoryData.metadata && memoryData.metadata.category) {
            return memoryData.metadata.category;
        }
        
        return '未分类';
    }

    /**
     * 提取记忆的时间戳
     */
    extractTimestamp(memoryData) {
        if (memoryData.timestamp) {
            return typeof memoryData.timestamp === 'number' ? memoryData.timestamp : Date.now();
        }
        
        if (memoryData.createdAt) {
            return typeof memoryData.createdAt === 'number' ? memoryData.createdAt : Date.now();
        }
        
        return Date.now();
    }

    /**
     * 添加到重要性索引
     */
    addToImportanceIndex(memoryId, importance) {
        if (importance >= 0.9) {
            this.database.importanceIndex.critical.add(memoryId);
        } else if (importance >= 0.7) {
            this.database.importanceIndex.high.add(memoryId);
        } else if (importance >= 0.5) {
            this.database.importanceIndex.medium.add(memoryId);
        } else {
            this.database.importanceIndex.low.add(memoryId);
        }
    }

    /**
     * 处理AI总结创建事件
     */
    async handleAISummaryCreated(data) {
        try {
            console.log('[AIMemoryDatabase] 🧠 处理AI总结创建事件');

            if (!this.config.enabled || !this.config.autoIndexing) return;

            const summary = data.summary;
            if (!summary || !summary.content) {
                console.warn('[AIMemoryDatabase] ⚠️ 总结内容为空，跳过索引');
                return;
            }

            // 生成记忆ID
            const memoryId = this.generateMemoryId(summary);

            // 索引新记忆
            await this.indexMemory(memoryId, summary, 'ai_summary');

            console.log('[AIMemoryDatabase] ✅ AI总结已自动索引:', memoryId);

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 处理AI总结创建事件失败:', error);
        }
    }

    /**
     * 处理记忆添加事件
     */
    async handleMemoryAdded(data) {
        try {
            console.log('[AIMemoryDatabase] 📥 处理记忆添加事件');

            if (!this.config.enabled || !this.config.autoIndexing) return;

            const { memoryId, memoryData, layer } = data;

            // 索引新记忆
            await this.indexMemory(memoryId, memoryData, layer);

            console.log('[AIMemoryDatabase] ✅ 新记忆已索引:', memoryId);

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 处理记忆添加事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatSwitched(data) {
        try {
            console.log('[AIMemoryDatabase] 🔄 处理聊天切换事件');

            // 清空当前索引
            this.clearIndex();

            // 重新加载新聊天的记忆
            await this.loadExistingMemories();

            // 重建索引
            await this.buildInitialIndex();

            console.log('[AIMemoryDatabase] ✅ 聊天切换处理完成');

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🚀 核心功能：基于关键词搜索记忆
     * @param {string|string[]} keywords - 关键词或关键词数组
     * @param {Object} options - 搜索选项
     * @returns {Array} 排序后的记忆数组
     */
    searchByKeywords(keywords, options = {}) {
        try {
            // 标准化关键词
            const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
            const normalizedKeywords = keywordArray.map(kw => kw.toLowerCase().trim()).filter(kw => kw);

            if (normalizedKeywords.length === 0) {
                console.warn('[AIMemoryDatabase] ⚠️ 关键词为空');
                return [];
            }

            console.log('[AIMemoryDatabase] 🔍 搜索关键词:', normalizedKeywords);

            // 检查缓存
            const cacheKey = normalizedKeywords.join('|');
            if (this.config.cacheSearchResults && this.searchCache.has(cacheKey)) {
                const cached = this.searchCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log('[AIMemoryDatabase] ✅ 使用缓存的搜索结果');
                    return cached.results;
                }
            }

            // 收集所有匹配的记忆ID
            const matchedMemories = new Map(); // memoryId -> matchScore

            for (const keyword of normalizedKeywords) {
                if (this.database.keywordIndex.has(keyword)) {
                    const memoryIds = this.database.keywordIndex.get(keyword);
                    
                    for (const memoryId of memoryIds) {
                        if (!matchedMemories.has(memoryId)) {
                            matchedMemories.set(memoryId, 0);
                        }
                        // 每个关键词匹配加1分
                        matchedMemories.set(memoryId, matchedMemories.get(memoryId) + 1);
                    }
                }
            }

            if (matchedMemories.size === 0) {
                console.log('[AIMemoryDatabase] ℹ️ 未找到匹配的记忆');
                return [];
            }

            // 获取记忆详情并计算综合评分
            const results = [];
            for (const [memoryId, keywordMatchCount] of matchedMemories.entries()) {
                const memory = this.database.memories.get(memoryId);
                if (!memory) continue;

                // 计算综合评分
                const score = this.calculateRelevanceScore(memory, keywordMatchCount, normalizedKeywords.length, options);

                results.push({
                    ...memory,
                    matchScore: score,
                    keywordMatches: keywordMatchCount
                });
            }

            // 排序：按评分降序
            results.sort((a, b) => b.matchScore - a.matchScore);

            // 限制结果数量
            const maxResults = options.maxResults || this.config.maxSearchResults;
            const finalResults = results.slice(0, maxResults);

            console.log(`[AIMemoryDatabase] ✅ 找到${matchedMemories.size}条记忆，返回前${finalResults.length}条`);

            // 缓存结果
            if (this.config.cacheSearchResults) {
                this.searchCache.set(cacheKey, {
                    results: finalResults,
                    timestamp: Date.now()
                });
            }

            return finalResults;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 搜索记忆失败:', error);
            return [];
        }
    }

    /**
     * 计算记忆的相关性评分
     */
    calculateRelevanceScore(memory, keywordMatchCount, totalKeywords, options = {}) {
        try {
            // 关键词匹配度（0-1）
            const keywordScore = keywordMatchCount / totalKeywords;

            // 重要性权重（0-1）
            const importanceScore = memory.importance || 0.5;

            // 时效性权重（0-1）
            const recencyScore = this.calculateRecencyScore(memory.timestamp);

            // 综合评分（可配置权重）
            const weights = {
                keyword: options.keywordWeight || 0.5,
                importance: options.importanceWeight || 0.3,
                recency: options.recencyWeight || 0.2
            };

            const totalScore = 
                keywordScore * weights.keyword +
                importanceScore * weights.importance +
                recencyScore * weights.recency;

            return totalScore;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 计算相关性评分失败:', error);
            return 0;
        }
    }

    /**
     * 计算时效性评分
     */
    calculateRecencyScore(timestamp) {
        const now = Date.now();
        const age = now - timestamp;
        
        // 时间衰减：1小时内=1.0, 1天=0.7, 1周=0.5, 1月=0.3
        const oneHour = 3600000;
        const oneDay = 86400000;
        const oneWeek = 604800000;
        const oneMonth = 2592000000;

        if (age < oneHour) return 1.0;
        if (age < oneDay) return 0.9;
        if (age < oneWeek) return 0.7;
        if (age < oneMonth) return 0.5;
        return 0.3;
    }

    /**
     * 🚀 核心功能：按重要性获取记忆
     * @param {string} level - 重要性级别：critical/high/medium/low
     * @param {number} limit - 限制数量
     * @returns {Array} 记忆数组
     */
    getMemoriesByImportance(level = 'high', limit = 10) {
        try {
            const memoryIds = this.database.importanceIndex[level];
            if (!memoryIds || memoryIds.size === 0) {
                return [];
            }

            const memories = [];
            for (const memoryId of memoryIds) {
                const memory = this.database.memories.get(memoryId);
                if (memory) {
                    memories.push(memory);
                }
                if (memories.length >= limit) break;
            }

            // 按时间倒序排列
            memories.sort((a, b) => b.timestamp - a.timestamp);

            console.log(`[AIMemoryDatabase] 📊 获取${level}级别记忆: ${memories.length}条`);
            return memories;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 按重要性获取记忆失败:', error);
            return [];
        }
    }

    /**
     * 🚀 核心功能：按分类获取记忆
     * @param {string} category - 分类名称
     * @param {number} limit - 限制数量
     * @returns {Array} 记忆数组
     */
    getMemoriesByCategory(category, limit = 10) {
        try {
            const memoryIds = this.database.categoryIndex.get(category);
            if (!memoryIds || memoryIds.size === 0) {
                return [];
            }

            const memories = [];
            for (const memoryId of memoryIds) {
                const memory = this.database.memories.get(memoryId);
                if (memory) {
                    memories.push(memory);
                }
                if (memories.length >= limit) break;
            }

            // 按重要性和时间排序
            memories.sort((a, b) => {
                const importanceDiff = b.importance - a.importance;
                if (Math.abs(importanceDiff) > 0.1) {
                    return importanceDiff;
                }
                return b.timestamp - a.timestamp;
            });

            console.log(`[AIMemoryDatabase] 📂 获取"${category}"分类记忆: ${memories.length}条`);
            return memories;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 按分类获取记忆失败:', error);
            return [];
        }
    }

    /**
     * 🚀 AI思考接口：让AI通过关键词获取相关记忆
     * @param {string} thinkingContent - AI的思考内容
     * @returns {Array} 相关记忆数组
     */
    async getMemoriesForAIThinking(thinkingContent) {
        try {
            console.log('[AIMemoryDatabase] 🤔 AI思考驱动的记忆检索...');

            if (!this.config.enableThinkingInterface) {
                console.log('[AIMemoryDatabase] ℹ️ AI思考接口未启用');
                return [];
            }

            // 从思考内容中提取关键词
            const extractedKeywords = this.extractThinkingKeywords(thinkingContent);

            if (extractedKeywords.length === 0) {
                console.log('[AIMemoryDatabase] ℹ️ 未从思考内容中提取到关键词');
                return [];
            }

            console.log('[AIMemoryDatabase] 🔑 从思考中提取的关键词:', extractedKeywords);

            // 搜索相关记忆
            const memories = this.searchByKeywords(extractedKeywords, {
                keywordWeight: 0.6,
                importanceWeight: 0.3,
                recencyWeight: 0.1,
                maxResults: 10
            });

            console.log(`[AIMemoryDatabase] ✅ 为AI思考检索到${memories.length}条相关记忆`);

            return memories;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ AI思考驱动的记忆检索失败:', error);
            return [];
        }
    }

    /**
     * 从AI思考内容中提取关键词
     */
    extractThinkingKeywords(thinkingContent) {
        const keywords = new Set();

        // 提取被引号包裹的关键词
        const quotedPattern = /["「『](.*?)["」』]/g;
        let match;
        while ((match = quotedPattern.exec(thinkingContent)) !== null) {
            if (match[1].length >= this.config.minKeywordLength) {
                keywords.add(match[1].toLowerCase());
            }
        }

        // 提取"关于XXX"、"查找XXX"、"回忆XXX"等模式
        const aboutPattern = /(?:关于|查找|回忆|搜索|需要|想起)([^\s，。！？]{2,6})/g;
        while ((match = aboutPattern.exec(thinkingContent)) !== null) {
            if (match[1].length >= this.config.minKeywordLength) {
                keywords.add(match[1].toLowerCase());
            }
        }

        // 提取重要名词（简单实现）
        if (keywords.size < 3) {
            const contentKeywords = this.extractKeywordsFromContent(thinkingContent);
            contentKeywords.forEach(kw => keywords.add(kw));
        }

        return Array.from(keywords).slice(0, 5);
    }

    /**
     * 🚀 综合检索：结合多种条件
     * @param {Object} criteria - 检索条件
     * @returns {Array} 排序后的记忆数组
     */
    searchMemories(criteria = {}) {
        try {
            console.log('[AIMemoryDatabase] 🔍 综合检索记忆:', criteria);

            let candidateMemories = [];

            // 1. 关键词检索
            if (criteria.keywords && criteria.keywords.length > 0) {
                candidateMemories = this.searchByKeywords(criteria.keywords, criteria.options);
            }

            // 2. 如果没有关键词，按重要性或分类检索
            if (candidateMemories.length === 0) {
                if (criteria.category) {
                    candidateMemories = this.getMemoriesByCategory(criteria.category, criteria.limit || 20);
                } else if (criteria.importance) {
                    candidateMemories = this.getMemoriesByImportance(criteria.importance, criteria.limit || 20);
                } else {
                    // 默认返回最重要的记忆
                    candidateMemories = this.getMemoriesByImportance('critical', 10);
                    if (candidateMemories.length < 5) {
                        candidateMemories = candidateMemories.concat(
                            this.getMemoriesByImportance('high', 10 - candidateMemories.length)
                        );
                    }
                }
            }

            // 3. 应用过滤器
            if (criteria.filter) {
                candidateMemories = this.applyFilters(candidateMemories, criteria.filter);
            }

            // 4. 应用排序
            if (criteria.sortBy) {
                candidateMemories = this.applySorting(candidateMemories, criteria.sortBy);
            }

            // 5. 限制数量
            const limit = criteria.limit || 10;
            const results = candidateMemories.slice(0, limit);

            console.log(`[AIMemoryDatabase] ✅ 综合检索完成，返回${results.length}条记忆`);
            return results;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 综合检索失败:', error);
            return [];
        }
    }

    /**
     * 应用过滤器
     */
    applyFilters(memories, filters) {
        let filtered = memories;

        if (filters.minImportance !== undefined) {
            filtered = filtered.filter(m => m.importance >= filters.minImportance);
        }

        if (filters.maxAge !== undefined) {
            const cutoffTime = Date.now() - filters.maxAge;
            filtered = filtered.filter(m => m.timestamp >= cutoffTime);
        }

        if (filters.layers && filters.layers.length > 0) {
            filtered = filtered.filter(m => filters.layers.includes(m.layer));
        }

        if (filters.categories && filters.categories.length > 0) {
            filtered = filtered.filter(m => filters.categories.includes(m.category));
        }

        return filtered;
    }

    /**
     * 应用排序
     */
    applySorting(memories, sortBy) {
        const sorted = [...memories];

        switch (sortBy) {
            case 'importance':
                sorted.sort((a, b) => b.importance - a.importance);
                break;
            case 'recency':
                sorted.sort((a, b) => b.timestamp - a.timestamp);
                break;
            case 'relevance':
                sorted.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
                break;
            default:
                // 综合排序：重要性 > 匹配度 > 时效性
                sorted.sort((a, b) => {
                    const importanceDiff = b.importance - a.importance;
                    if (Math.abs(importanceDiff) > 0.2) return importanceDiff;
                    
                    const matchDiff = (b.matchScore || 0) - (a.matchScore || 0);
                    if (Math.abs(matchDiff) > 0.1) return matchDiff;
                    
                    return b.timestamp - a.timestamp;
                });
        }

        return sorted;
    }

    /**
     * 生成记忆ID
     */
    generateMemoryId(memoryData) {
        const timestamp = memoryData.timestamp || Date.now();
        const messageId = memoryData.messageId || '';
        const random = Math.random().toString(36).substring(2, 8);
        
        if (messageId) {
            return `mem_${messageId}_${random}`;
        }
        
        return `mem_${timestamp}_${random}`;
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        this.stats.totalMemories = this.database.memories.size;
        this.stats.totalKeywords = this.database.keywordIndex.size;

        // 计算平均重要性
        let totalImportance = 0;
        for (const memory of this.database.memories.values()) {
            totalImportance += memory.importance || 0.5;
        }
        this.stats.averageImportance = this.stats.totalMemories > 0 
            ? totalImportance / this.stats.totalMemories 
            : 0;

        this.stats.lastIndexTime = Date.now();
    }

    /**
     * 清空索引
     */
    clearIndex() {
        console.log('[AIMemoryDatabase] 🧹 清空索引...');

        this.database.keywordIndex.clear();
        this.database.memories.clear();
        this.database.importanceIndex.critical.clear();
        this.database.importanceIndex.high.clear();
        this.database.importanceIndex.medium.clear();
        this.database.importanceIndex.low.clear();
        this.database.categoryIndex.clear();
        this.database.timelineIndex = [];
        this.searchCache.clear();

        this.updateStats();

        console.log('[AIMemoryDatabase] ✅ 索引已清空');
    }

    /**
     * 获取数据库状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            stats: { ...this.stats },
            memoryCount: this.database.memories.size,
            keywordCount: this.database.keywordIndex.size,
            categoryCount: this.database.categoryIndex.size
        };
    }

    /**
     * 🚀 导出记忆数据（用于提示词注入）
     * @param {Object} criteria - 检索条件
     * @returns {string} 格式化的记忆内容
     */
    exportMemoriesForPrompt(criteria = {}) {
        try {
            console.log('[AIMemoryDatabase] 📤 导出记忆用于提示词注入...');

            // 获取记忆
            const memories = this.searchMemories(criteria);

            if (memories.length === 0) {
                return '';
            }

            // 格式化输出
            let output = '【AI记忆数据库】\n\n';

            memories.forEach((memory, index) => {
                output += `记忆 ${index + 1}:\n`;
                output += `- 内容: ${memory.content}\n`;
                output += `- 重要性: ${(memory.importance * 100).toFixed(0)}%\n`;
                if (memory.keywords && memory.keywords.length > 0) {
                    output += `- 关键词: ${memory.keywords.join(', ')}\n`;
                }
                if (memory.category) {
                    output += `- 分类: ${memory.category}\n`;
                }
                output += `\n`;
            });

            console.log(`[AIMemoryDatabase] ✅ 导出${memories.length}条记忆用于提示词`);
            return output;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 导出记忆失败:', error);
            return '';
        }
    }

    /**
     * 🚀 智能推荐：基于上下文推荐相关记忆（使用余弦相似度）
     * @param {string} context - 当前上下文
     * @param {number} limit - 限制数量
     * @returns {Array} 推荐的记忆数组
     */
    async recommendMemories(context, limit = 5) {
        try {
            console.log('[AIMemoryDatabase] 💡 智能推荐相关记忆（使用相似度计算）...');

            // 从上下文提取关键词
            const contextKeywords = this.extractKeywordsFromContent(context);

            if (contextKeywords.length === 0) {
                // 如果没有关键词，返回最重要的记忆
                return this.getMemoriesByImportance('critical', limit);
            }

            // 计算所有记忆与上下文的相似度
            const memoriesWithSimilarity = [];
            
            for (const [memoryId, memory] of this.database.memories.entries()) {
                // 计算余弦相似度
                const similarity = this.calculateCosineSimilarity(contextKeywords, memory.keywords);
                
                if (similarity > 0) {
                    memoriesWithSimilarity.push({
                        ...memory,
                        similarity: similarity,
                        combinedScore: similarity * 0.6 + memory.importance * 0.4
                    });
                }
            }

            // 按综合评分排序
            memoriesWithSimilarity.sort((a, b) => b.combinedScore - a.combinedScore);

            // 返回前N个
            const results = memoriesWithSimilarity.slice(0, limit);

            console.log(`[AIMemoryDatabase] ✅ 推荐${results.length}条相关记忆（平均相似度: ${(results.reduce((sum, m) => sum + m.similarity, 0) / results.length * 100).toFixed(1)}%）`);
            return results;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 智能推荐失败:', error);
            return [];
        }
    }

    /**
     * 🔧 新增：计算余弦相似度
     * @param {Array} keywords1 - 关键词数组1
     * @param {Array} keywords2 - 关键词数组2
     * @returns {number} 相似度（0-1）
     */
    calculateCosineSimilarity(keywords1, keywords2) {
        try {
            if (!keywords1 || !keywords2 || keywords1.length === 0 || keywords2.length === 0) {
                return 0;
            }

            // 构建词汇表
            const vocabulary = new Set([...keywords1, ...keywords2]);
            const vocabArray = Array.from(vocabulary);

            // 构建向量
            const vector1 = vocabArray.map(word => keywords1.includes(word) ? 1 : 0);
            const vector2 = vocabArray.map(word => keywords2.includes(word) ? 1 : 0);

            // 计算点积
            let dotProduct = 0;
            for (let i = 0; i < vocabArray.length; i++) {
                dotProduct += vector1[i] * vector2[i];
            }

            // 计算向量长度
            const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
            const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

            // 计算余弦相似度
            if (magnitude1 === 0 || magnitude2 === 0) {
                return 0;
            }

            const similarity = dotProduct / (magnitude1 * magnitude2);
            return similarity;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 计算余弦相似度失败:', error);
            return 0;
        }
    }

    /**
     * 🚀 新增：基于相似度搜索记忆
     * @param {string|string[]} keywords - 关键词或关键词数组
     * @param {number} limit - 限制数量
     * @returns {Array} 排序后的记忆数组
     */
    searchBySimilarity(keywords, limit = 10) {
        try {
            const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
            const normalizedKeywords = keywordArray.map(kw => kw.toLowerCase().trim());

            console.log('[AIMemoryDatabase] 🔍 基于相似度搜索关键词:', normalizedKeywords);

            const memoriesWithSimilarity = [];

            // 计算所有记忆的相似度
            for (const [memoryId, memory] of this.database.memories.entries()) {
                const similarity = this.calculateCosineSimilarity(normalizedKeywords, memory.keywords);
                
                if (similarity > this.config.similarityThreshold) {
                    memoriesWithSimilarity.push({
                        ...memory,
                        similarity: similarity,
                        combinedScore: similarity * 0.7 + memory.importance * 0.3
                    });
                }
            }

            // 按综合评分排序
            memoriesWithSimilarity.sort((a, b) => b.combinedScore - a.combinedScore);

            const results = memoriesWithSimilarity.slice(0, limit);

            console.log(`[AIMemoryDatabase] ✅ 找到${results.length}条相似记忆`);
            return results;

        } catch (error) {
            console.error('[AIMemoryDatabase] ❌ 基于相似度搜索失败:', error);
            return [];
        }
    }

    /**
     * 获取所有关键词
     */
    getAllKeywords() {
        return Array.from(this.database.keywordIndex.keys());
    }

    /**
     * 获取所有分类
     */
    getAllCategories() {
        return Array.from(this.database.categoryIndex.keys());
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[AIMemoryDatabase] ❌ 错误计数:', this.errorCount);

        if (this.eventSystem) {
            this.eventSystem.emit('aiMemoryDatabase:error', {
                error: error.message,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }
}

