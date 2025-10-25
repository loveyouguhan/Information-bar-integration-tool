/**
 * 上下文感知检索系统
 * 
 * 核心功能：
 * - 混合检索引擎（向量检索 + 关键词检索 + 图检索）
 * - 查询增强和上下文注入
 * - 结果融合和智能重排序
 * - 语义缓存系统
 * - 上下文感知的相关性评分
 * 
 * 基于业界最佳实践：
 * - Anthropic的Contextual Retrieval技术
 * - RAG优化策略
 * - 混合搜索算法
 * 
 * @class ContextualRetrieval
 */

export class ContextualRetrieval {
    constructor(unifiedDataCore, eventSystem, vectorizedMemoryRetrieval, deepMemoryManager) {
        console.log('[ContextualRetrieval] 🔍 上下文感知检索系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.vectorizedMemoryRetrieval = vectorizedMemoryRetrieval;
        this.deepMemoryManager = deepMemoryManager;
        
        // 检索设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用上下文感知检索
            
            // 混合检索权重
            vectorWeight: 0.5,                      // 向量检索权重
            keywordWeight: 0.3,                     // 关键词检索权重
            graphWeight: 0.2,                       // 图检索权重
            
            // 查询增强
            enableQueryExpansion: true,             // 启用查询扩展
            enableContextInjection: true,           // 启用上下文注入
            contextWindowSize: 5,                   // 上下文窗口大小（消息数）
            
            // 重排序
            enableReranking: true,                  // 启用重排序
            rerankingModel: 'cross-encoder',        // 重排序模型
            
            // 语义缓存
            enableSemanticCache: true,              // 启用语义缓存
            cacheSize: 100,                         // 缓存大小
            cacheSimilarityThreshold: 0.95,         // 缓存相似度阈值
            
            // 检索参数
            maxResults: 10,                         // 最大返回结果数
            minRelevanceScore: 0.3,                 // 最小相关性分数
            diversityFactor: 0.3                    // 多样性因子
        };
        
        // 语义缓存
        this.semanticCache = new Map();             // query -> results
        this.cacheVectors = new Map();              // query -> vector
        
        // 查询历史（用于上下文感知）
        this.queryHistory = [];                     // 最近的查询历史
        this.maxQueryHistory = 10;                  // 最大查询历史数
        
        // 统计信息
        this.stats = {
            totalQueries: 0,                        // 总查询次数
            cacheHits: 0,                           // 缓存命中次数
            avgRetrievalTime: 0,                    // 平均检索时间
            vectorSearchCount: 0,                   // 向量搜索次数
            keywordSearchCount: 0,                  // 关键词搜索次数
            graphSearchCount: 0,                    // 图搜索次数
            rerankingCount: 0                       // 重排序次数
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[ContextualRetrieval] 🏗️ 构造函数完成');
    }

    /**
     * 初始化上下文感知检索系统
     */
    async init() {
        try {
            console.log('[ContextualRetrieval] 📊 开始初始化上下文感知检索系统...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[ContextualRetrieval] ⏸️ 上下文感知检索系统已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[ContextualRetrieval] ✅ 上下文感知检索系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('contextual-retrieval:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.enhancement?.contextualRetrieval !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.contextualRetrieval;
                    console.log('[ContextualRetrieval] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[ContextualRetrieval] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('contextual_retrieval_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[ContextualRetrieval] ✅ 设置已加载');
                }
            }

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[ContextualRetrieval] 🔄 更新设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 如果禁用，清理缓存
            if (newSettings.hasOwnProperty('enabled') && !newSettings.enabled) {
                this.semanticCache.clear();
                console.log('[ContextualRetrieval] 🧹 已清理语义缓存');
            }

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('contextual_retrieval_settings', this.settings);
            }

            console.log('[ContextualRetrieval] ✅ 设置更新完成');

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[ContextualRetrieval] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }
            
            // 监听聊天切换事件（清理缓存）
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatSwitch(data);
            });
            
            console.log('[ContextualRetrieval] 🔗 事件监听器已绑定');
            
        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatSwitch(data) {
        try {
            console.log('[ContextualRetrieval] 🔄 处理聊天切换事件，清理缓存...');
            
            // 清理语义缓存
            this.semanticCache.clear();
            this.cacheVectors.clear();
            
            // 清理查询历史
            this.queryHistory = [];
            
            console.log('[ContextualRetrieval] ✅ 缓存已清理');
            
        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 核心功能：混合检索
     * 整合向量检索、关键词检索和图检索
     */
    async hybridSearch(query, options = {}) {
        try {
            const startTime = Date.now();
            console.log('[ContextualRetrieval] 🔍 开始混合检索:', query);
            
            if (!this.settings.enabled) {
                console.log('[ContextualRetrieval] ⚠️ 上下文感知检索已禁用，使用默认检索');
                // 🔧 修复：检查向量化检索是否启用
                if (this.vectorizedMemoryRetrieval?.settings?.enabled) {
                    return await this.vectorizedMemoryRetrieval.semanticSearch(query, options);
                } else {
                    console.log('[ContextualRetrieval] ⚠️ 向量化检索也已禁用，返回空结果');
                    return { results: [], processingTime: 0 };
                }
            }
            
            // 更新统计
            this.stats.totalQueries++;
            
            // 🔧 步骤1：检查语义缓存
            const cachedResult = await this.checkSemanticCache(query);
            if (cachedResult) {
                console.log('[ContextualRetrieval] ✅ 命中语义缓存');
                this.stats.cacheHits++;
                return cachedResult;
            }
            
            // 🔧 步骤2：查询增强（添加上下文）
            const enhancedQuery = await this.enhanceQuery(query, options);
            console.log('[ContextualRetrieval] 📝 增强后的查询:', enhancedQuery);
            
            // 🔧 步骤3：并行执行多路检索
            const [vectorResults, keywordResults, graphResults] = await Promise.all([
                this.vectorSearch(enhancedQuery, options),
                this.keywordSearch(enhancedQuery, options),
                this.graphSearch(enhancedQuery, options)
            ]);
            
            console.log('[ContextualRetrieval] 📊 检索结果统计:');
            console.log(`  - 向量检索: ${vectorResults.length} 个结果`);
            console.log(`  - 关键词检索: ${keywordResults.length} 个结果`);
            console.log(`  - 图检索: ${graphResults.length} 个结果`);
            
            // 🔧 步骤4：融合多路检索结果
            const fusedResults = await this.fuseResults(vectorResults, keywordResults, graphResults);
            
            // 🔧 步骤5：重排序
            let finalResults = fusedResults;
            if (this.settings.enableReranking && fusedResults.length > 0) {
                finalResults = await this.rerankResults(query, fusedResults);
                this.stats.rerankingCount++;
            }
            
            // 🔧 步骤6：应用多样性过滤
            finalResults = await this.applyDiversityFilter(finalResults);
            
            // 限制结果数量
            finalResults = finalResults.slice(0, this.settings.maxResults);
            
            const retrievalTime = Date.now() - startTime;
            this.stats.avgRetrievalTime = (this.stats.avgRetrievalTime * (this.stats.totalQueries - 1) + retrievalTime) / this.stats.totalQueries;
            
            console.log(`[ContextualRetrieval] ✅ 混合检索完成，返回 ${finalResults.length} 个结果，耗时: ${retrievalTime}ms`);
            
            // 缓存结果
            await this.cacheResults(query, finalResults);
            
            // 更新查询历史
            this.updateQueryHistory(query);
            
            return {
                results: finalResults,
                query: query,
                enhancedQuery: enhancedQuery,
                retrievalTime: retrievalTime,
                method: 'hybrid_search',
                stats: {
                    vectorResults: vectorResults.length,
                    keywordResults: keywordResults.length,
                    graphResults: graphResults.length,
                    fusedResults: fusedResults.length,
                    finalResults: finalResults.length
                }
            };
            
        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 混合检索失败:', error);
            this.handleError(error);
            
            // 降级到默认检索
            // 🔧 修复：检查向量化检索是否启用
            if (this.vectorizedMemoryRetrieval?.settings?.enabled) {
                return await this.vectorizedMemoryRetrieval.semanticSearch(query, options);
            } else {
                console.log('[ContextualRetrieval] ⚠️ 向量化检索已禁用，返回空结果');
                return { results: [], processingTime: 0 };
            }
        }
    }

    /**
     * 🔧 查询增强：添加上下文信息
     */
    async enhanceQuery(query, options = {}) {
        try {
            if (!this.settings.enableQueryExpansion && !this.settings.enableContextInjection) {
                return query;
            }

            let enhancedQuery = query;

            // 🔧 步骤1：添加对话上下文
            if (this.settings.enableContextInjection) {
                const context = await this.getConversationContext();
                if (context) {
                    enhancedQuery = `${context}\n当前查询: ${query}`;
                }
            }

            // 🔧 步骤2：查询扩展（添加同义词、相关词）
            if (this.settings.enableQueryExpansion) {
                const expandedTerms = await this.expandQueryTerms(query);
                if (expandedTerms.length > 0) {
                    enhancedQuery += ` ${expandedTerms.join(' ')}`;
                }
            }

            return enhancedQuery;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 查询增强失败:', error);
            return query;
        }
    }

    /**
     * 获取对话上下文
     */
    async getConversationContext() {
        try {
            if (!this.unifiedDataCore) return '';

            // 使用getData获取最近的聊天历史
            const recentHistory = await this.unifiedDataCore.getData('recent_history');
            if (!recentHistory || recentHistory.length === 0) return '';

            // 提取最近几条消息的关键信息
            const contextParts = recentHistory
                .slice(-this.settings.contextWindowSize)
                .map(msg => {
                    const content = msg.mes || msg.content || '';
                    // 只取前100个字符作为上下文
                    return content.substring(0, 100);
                });

            return `对话上下文: ${contextParts.join(' | ')}`;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 获取对话上下文失败:', error);
            return '';
        }
    }

    /**
     * 扩展查询词汇
     */
    async expandQueryTerms(query) {
        try {
            const expandedTerms = [];

            // 简单的同义词扩展（可以后续使用AI进行更智能的扩展）
            const synonymMap = {
                '记忆': ['回忆', '印象', '记得'],
                '总结': ['概括', '归纳', '摘要'],
                '重要': ['关键', '核心', '主要'],
                '问题': ['疑问', '困惑', '难题'],
                '解决': ['处理', '应对', '解答']
            };

            const queryWords = query.split(/\s+/);
            for (const word of queryWords) {
                if (synonymMap[word]) {
                    expandedTerms.push(...synonymMap[word]);
                }
            }

            return expandedTerms.slice(0, 3); // 最多添加3个扩展词

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 扩展查询词汇失败:', error);
            return [];
        }
    }

    /**
     * 🔧 向量检索
     * 注意：此方法已被UnifiedVectorRetrieval统一管理，仅作为备用
     */
    async vectorSearch(query, options = {}) {
        try {
            if (!this.vectorizedMemoryRetrieval) return [];

            // 🔧 修复：检查向量化检索是否启用
            // 注意：向量化检索已合并到AI自动检索中，由UnifiedVectorRetrieval统一管理
            if (!this.vectorizedMemoryRetrieval.settings?.enabled) {
                console.log('[ContextualRetrieval] ℹ️ 向量化记忆检索未单独启用（已由AI自动检索统一管理），跳过独立向量搜索');
                return [];
            }

            this.stats.vectorSearchCount++;

            const results = await this.vectorizedMemoryRetrieval.semanticSearch(query, {
                maxResults: this.settings.maxResults * 2, // 获取更多结果用于融合
                ...options
            });

            // 转换为统一格式
            return (results.results || []).map(result => ({
                id: result.id,
                content: result.content,
                score: result.similarity,
                source: 'vector',
                metadata: result.metadata,
                timestamp: result.timestamp
            }));

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 向量检索失败:', error);
            return [];
        }
    }

    /**
     * 🔧 关键词检索
     */
    async keywordSearch(query, options = {}) {
        try {
            if (!this.deepMemoryManager) return [];

            this.stats.keywordSearchCount++;

            const results = [];
            const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);

            // 搜索所有记忆层
            for (const [layerName, layer] of Object.entries(this.deepMemoryManager.memoryLayers)) {
                for (const [id, memory] of layer) {
                    const content = (memory.content || '').toLowerCase();

                    // 计算关键词匹配分数
                    let matchScore = 0;
                    let matchedWords = 0;

                    for (const word of queryWords) {
                        if (content.includes(word)) {
                            matchedWords++;
                            // 精确匹配加分
                            const regex = new RegExp(`\\b${word}\\b`, 'gi');
                            const matches = content.match(regex);
                            matchScore += matches ? matches.length : 0.5;
                        }
                    }

                    if (matchedWords > 0) {
                        // 归一化分数
                        const normalizedScore = (matchScore / queryWords.length) / 10;

                        results.push({
                            id: id,
                            content: memory.content,
                            score: Math.min(normalizedScore, 1.0),
                            source: 'keyword',
                            metadata: memory.metadata,
                            timestamp: memory.timestamp,
                            layer: layerName
                        });
                    }
                }
            }

            // 按分数排序
            return results.sort((a, b) => b.score - a.score).slice(0, this.settings.maxResults * 2);

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 关键词检索失败:', error);
            return [];
        }
    }

    /**
     * 🔧 图检索（基于记忆关联）
     */
    async graphSearch(query, options = {}) {
        try {
            if (!this.deepMemoryManager) return [];

            this.stats.graphSearchCount++;

            const results = [];

            // 简化的图检索：基于时间邻近性和重要性
            const allMemories = [];
            for (const [layerName, layer] of Object.entries(this.deepMemoryManager.memoryLayers)) {
                for (const [id, memory] of layer) {
                    allMemories.push({
                        id: id,
                        content: memory.content,
                        timestamp: memory.timestamp,
                        importance: memory.metadata?.importance || 0.5,
                        layer: layerName
                    });
                }
            }

            // 按时间排序
            allMemories.sort((a, b) => b.timestamp - a.timestamp);

            // 选择最近的高重要性记忆
            const topMemories = allMemories
                .filter(m => m.importance > 0.6)
                .slice(0, this.settings.maxResults);

            for (const memory of topMemories) {
                results.push({
                    id: memory.id,
                    content: memory.content,
                    score: memory.importance,
                    source: 'graph',
                    metadata: { layer: memory.layer },
                    timestamp: memory.timestamp
                });
            }

            return results;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 图检索失败:', error);
            return [];
        }
    }

    /**
     * 🔧 融合多路检索结果
     * 使用加权融合算法
     */
    async fuseResults(vectorResults, keywordResults, graphResults) {
        try {
            console.log('[ContextualRetrieval] 🔀 开始融合检索结果...');

            const fusedMap = new Map();

            // 融合向量检索结果
            for (const result of vectorResults) {
                const score = result.score * this.settings.vectorWeight;
                fusedMap.set(result.id, {
                    ...result,
                    fusedScore: score,
                    sources: ['vector']
                });
            }

            // 融合关键词检索结果
            for (const result of keywordResults) {
                const score = result.score * this.settings.keywordWeight;

                if (fusedMap.has(result.id)) {
                    const existing = fusedMap.get(result.id);
                    existing.fusedScore += score;
                    existing.sources.push('keyword');
                } else {
                    fusedMap.set(result.id, {
                        ...result,
                        fusedScore: score,
                        sources: ['keyword']
                    });
                }
            }

            // 融合图检索结果
            for (const result of graphResults) {
                const score = result.score * this.settings.graphWeight;

                if (fusedMap.has(result.id)) {
                    const existing = fusedMap.get(result.id);
                    existing.fusedScore += score;
                    existing.sources.push('graph');
                } else {
                    fusedMap.set(result.id, {
                        ...result,
                        fusedScore: score,
                        sources: ['graph']
                    });
                }
            }

            // 转换为数组并按融合分数排序
            const fusedResults = Array.from(fusedMap.values())
                .sort((a, b) => b.fusedScore - a.fusedScore);

            console.log(`[ContextualRetrieval] ✅ 融合完成，共 ${fusedResults.length} 个结果`);

            return fusedResults;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 融合结果失败:', error);
            return [];
        }
    }

    /**
     * 🔧 重排序：基于上下文相关性重新排序
     */
    async rerankResults(query, results) {
        try {
            console.log('[ContextualRetrieval] 🔄 开始重排序...');

            if (results.length === 0) return results;

            // 获取查询历史上下文
            const queryContext = this.queryHistory.slice(-3).join(' ');

            // 重新计算每个结果的相关性分数
            const rerankedResults = results.map(result => {
                let rerankScore = result.fusedScore || result.score;

                // 🔧 因子1：多源加成（来自多个检索源的结果更可靠）
                if (result.sources && result.sources.length > 1) {
                    rerankScore *= (1 + 0.2 * result.sources.length);
                }

                // 🔧 因子2：时间衰减（最近的记忆更相关）
                if (result.timestamp) {
                    const age = Date.now() - result.timestamp;
                    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
                    const timeFactor = Math.exp(-daysSinceCreation / 30); // 30天半衰期
                    rerankScore *= (0.7 + 0.3 * timeFactor);
                }

                // 🔧 因子3：重要性加成
                if (result.metadata?.importance) {
                    rerankScore *= (0.8 + 0.2 * result.metadata.importance);
                }

                // 🔧 因子4：查询历史相关性
                if (queryContext && result.content) {
                    const contextRelevance = this.calculateTextSimilarity(queryContext, result.content);
                    rerankScore *= (0.9 + 0.1 * contextRelevance);
                }

                return {
                    ...result,
                    rerankScore: rerankScore
                };
            });

            // 按重排序分数排序
            rerankedResults.sort((a, b) => b.rerankScore - a.rerankScore);

            console.log('[ContextualRetrieval] ✅ 重排序完成');

            return rerankedResults;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 重排序失败:', error);
            return results;
        }
    }

    /**
     * 计算文本相似度（简单版本）
     */
    calculateTextSimilarity(text1, text2) {
        try {
            const words1 = new Set(text1.toLowerCase().split(/\s+/));
            const words2 = new Set(text2.toLowerCase().split(/\s+/));

            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);

            return intersection.size / union.size;

        } catch (error) {
            return 0;
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[ContextualRetrieval] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('contextual-retrieval:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 🔧 应用多样性过滤
     * 避免返回过于相似的结果
     */
    async applyDiversityFilter(results) {
        try {
            if (results.length <= 1 || this.settings.diversityFactor === 0) {
                return results;
            }

            console.log('[ContextualRetrieval] 🎨 应用多样性过滤...');

            const diverseResults = [];
            const selectedContents = [];

            for (const result of results) {
                // 检查与已选结果的相似度
                let tooSimilar = false;

                for (const selectedContent of selectedContents) {
                    const similarity = this.calculateTextSimilarity(result.content, selectedContent);

                    // 如果相似度超过阈值，跳过此结果
                    if (similarity > (1 - this.settings.diversityFactor)) {
                        tooSimilar = true;
                        break;
                    }
                }

                if (!tooSimilar) {
                    diverseResults.push(result);
                    selectedContents.push(result.content);
                }
            }

            console.log(`[ContextualRetrieval] ✅ 多样性过滤完成，从 ${results.length} 个结果筛选出 ${diverseResults.length} 个`);

            return diverseResults;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 多样性过滤失败:', error);
            return results;
        }
    }

    /**
     * 🔧 检查语义缓存
     */
    async checkSemanticCache(query) {
        try {
            if (!this.settings.enableSemanticCache || this.semanticCache.size === 0) {
                return null;
            }

            // 向量化查询
            const queryVector = await this.vectorizeQueryForCache(query);
            if (!queryVector) return null;

            // 检查缓存中是否有相似查询
            for (const [cachedQuery, cachedResults] of this.semanticCache) {
                const cachedVector = this.cacheVectors.get(cachedQuery);
                if (!cachedVector) continue;

                const similarity = this.calculateVectorSimilarity(queryVector, cachedVector);

                if (similarity >= this.settings.cacheSimilarityThreshold) {
                    console.log(`[ContextualRetrieval] 🎯 找到相似缓存查询: "${cachedQuery}" (相似度: ${similarity.toFixed(3)})`);
                    return cachedResults;
                }
            }

            return null;

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 检查语义缓存失败:', error);
            return null;
        }
    }

    /**
     * 向量化查询（用于缓存）
     */
    async vectorizeQueryForCache(query) {
        try {
            if (!this.vectorizedMemoryRetrieval) return null;

            return await this.vectorizedMemoryRetrieval.vectorizeText(query);

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 向量化查询失败:', error);
            return null;
        }
    }

    /**
     * 计算向量相似度
     */
    calculateVectorSimilarity(vec1, vec2) {
        try {
            if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

            // 余弦相似度
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let i = 0; i < vec1.length; i++) {
                dotProduct += vec1[i] * vec2[i];
                norm1 += vec1[i] * vec1[i];
                norm2 += vec2[i] * vec2[i];
            }

            if (norm1 === 0 || norm2 === 0) return 0;

            return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

        } catch (error) {
            return 0;
        }
    }

    /**
     * 🔧 缓存检索结果
     */
    async cacheResults(query, results) {
        try {
            if (!this.settings.enableSemanticCache) return;

            // 限制缓存大小
            if (this.semanticCache.size >= this.settings.cacheSize) {
                const firstKey = this.semanticCache.keys().next().value;
                this.semanticCache.delete(firstKey);
                this.cacheVectors.delete(firstKey);
            }

            // 向量化查询并缓存
            const queryVector = await this.vectorizeQueryForCache(query);
            if (queryVector) {
                this.semanticCache.set(query, results);
                this.cacheVectors.set(query, queryVector);
                console.log(`[ContextualRetrieval] 💾 已缓存查询结果: "${query}"`);
            }

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 缓存结果失败:', error);
        }
    }

    /**
     * 更新查询历史
     */
    updateQueryHistory(query) {
        try {
            this.queryHistory.push(query);

            // 限制历史大小
            if (this.queryHistory.length > this.maxQueryHistory) {
                this.queryHistory.shift();
            }

        } catch (error) {
            console.error('[ContextualRetrieval] ❌ 更新查询历史失败:', error);
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.settings.enabled,
            stats: this.stats,
            cacheSize: this.semanticCache.size,
            queryHistorySize: this.queryHistory.length,
            errorCount: this.errorCount
        };
    }
}

