/**
 * 🎯 多路召回+重排序系统
 * 
 * 功能说明:
 * - 关键词检索 + 语义检索 双路召回
 * - 重排序模型精准筛选
 * - 预测性检索（提前预测用户意图）
 * - 上下文感知，避免无关内容
 * 
 * @author Information bar integration tool
 * @version 1.0.0
 */

export class MultiRecallReranker {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.corpusRetrieval = dependencies.corpusRetrieval;
        this.vectorizedMemoryRetrieval = dependencies.vectorizedMemoryRetrieval;
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        
        // 📊 状态管理
        this.initialized = false;
        this.enabled = true;
        this.isProcessing = false;
        this.lastPredictedQuery = null;
        this.prefetchedResults = null;
        this.prefetchTime = 0;
        
        // ⚙️ 配置
        this.config = {
            // 多路召回配置
            keywordTopK: 10,              // 关键词检索返回数量
            semanticTopK: 10,             // 语义检索返回数量
            finalTopK: 10,                // 最终返回数量

            // 重排序配置
            enableReranking: true,        // 启用重排序
            rerankModel: '',              // 重排序模型
            rerankApiUrl: '',             // 重排序API地址
            rerankApiKey: '',             // 重排序API密钥
            rerankThreshold: 10,          // 🆕 重排序阈值（只有检索数量>此值时才使用重排序）

            // 预测性检索配置
            enablePredictive: true,       // 启用预测性检索
            predictiveDelay: 500,         // 预测延迟(ms)
            prefetchCacheTime: 10000,     // 预取缓存时间(ms)

            // 关键词提取配置
            maxKeywords: 5,               // 最大关键词数量
            minKeywordLength: 2,          // 最小关键词长度

            // 上下文配置
            contextMessages: 3,           // 上下文消息数量
            contextWeight: 0.3            // 上下文权重
        };
        
        // 🔧 停用词列表（中文）
        this.stopWords = new Set([
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
            '自己', '这', '那', '里', '就是', '什么', '吗', '呢', '啊', '哦', '嗯', '吧'
        ]);
        
        // 📝 查询历史
        this.queryHistory = [];
        this.maxHistorySize = 10;
        
        // 🎯 预测性检索定时器
        this.predictiveTimer = null;
        
        console.log('[MultiRecallReranker] 🎯 多路召回+重排序系统初始化');
        this.init();
    }
    
    /**
     * 🚀 初始化
     */
    async init() {
        try {
            // 加载配置
            await this.loadConfig();
            
            // 初始化预测性检索监听
            if (this.config.enablePredictive) {
                this.initPredictiveListeners();
            }
            
            this.initialized = true;
            console.log('[MultiRecallReranker] ✅ 初始化完成');
            
        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 初始化失败:', error);
        }
    }
    
    /**
     * 📥 加载配置
     */
    async loadConfig() {
        try {
            const context = window.SillyTavern?.getContext?.();
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};
            const multiRecallCfg = extCfg.multiRecallConfig || {};
            const vectorAPIConfig = extCfg.vectorAPIConfig || {};
            const vectorFunctionCfg = extCfg.vectorFunction || {};

            // 加载多路召回配置
            this.config.keywordTopK = multiRecallCfg.keywordTopK || 10;
            this.config.semanticTopK = multiRecallCfg.semanticTopK || 10;
            this.config.finalTopK = multiRecallCfg.finalTopK || 10;
            this.config.enableReranking = multiRecallCfg.enableReranking !== undefined ? multiRecallCfg.enableReranking : true;
            this.config.enablePredictive = multiRecallCfg.enablePredictive !== undefined ? multiRecallCfg.enablePredictive : true;
            this.config.maxKeywords = multiRecallCfg.maxKeywords || 5;
            this.config.contextMessages = multiRecallCfg.contextMessages || 3;

            // 🆕 加载重排序阈值（从向量功能配置读取）
            this.config.rerankThreshold = vectorFunctionCfg.rerankThreshold !== undefined ? vectorFunctionCfg.rerankThreshold : 10;

            // 加载重排序API配置（复用向量化API的URL和Key）
            this.config.rerankApiUrl = vectorAPIConfig.baseUrl || '';
            this.config.rerankApiKey = vectorAPIConfig.apiKey || '';
            this.config.rerankModel = vectorAPIConfig.rerankModel || '';

            console.log('[MultiRecallReranker] 📥 配置已加载:', this.config);

        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 加载配置失败:', error);
        }
    }
    
    /**
     * 🎯 初始化预测性检索监听
     */
    initPredictiveListeners() {
        try {
            console.log('[MultiRecallReranker] 🎯 初始化预测性检索监听...');
            
            // 监听用户输入框
            const chatInput = document.querySelector('#send_textarea');
            if (chatInput) {
                chatInput.addEventListener('input', (e) => {
                    this.handleUserInput(e.target.value);
                });
                console.log('[MultiRecallReranker] ✅ 已绑定输入框监听');
            }
            
        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 初始化预测性检索监听失败:', error);
        }
    }
    
    /**
     * 📝 处理用户输入（预测性检索）
     */
    handleUserInput(inputText) {
        if (!this.config.enablePredictive || !inputText || inputText.length < 5) {
            return;
        }
        
        // 清除之前的定时器
        if (this.predictiveTimer) {
            clearTimeout(this.predictiveTimer);
        }
        
        // 延迟执行预测性检索
        this.predictiveTimer = setTimeout(async () => {
            try {
                console.log('[MultiRecallReranker] 🔮 预测性检索触发:', inputText.substring(0, 50) + '...');
                
                // 预测用户意图
                const predictedQuery = await this.predictUserIntent(inputText);
                
                // 执行预取检索
                if (predictedQuery) {
                    this.lastPredictedQuery = predictedQuery;
                    this.prefetchedResults = await this.multiRecall(predictedQuery);
                    this.prefetchTime = Date.now();
                    
                    console.log('[MultiRecallReranker] ✅ 预取完成:', this.prefetchedResults?.length || 0, '条结果');
                }
                
            } catch (error) {
                console.error('[MultiRecallReranker] ❌ 预测性检索失败:', error);
            }
        }, this.config.predictiveDelay);
    }
    
    /**
     * 🔮 预测用户意图
     */
    async predictUserIntent(inputText) {
        try {
            // 获取上下文消息
            const context = window.SillyTavern?.getContext?.();
            const chat = context?.chat || [];
            const recentMessages = chat.slice(-this.config.contextMessages);
            
            // 构建上下文
            let contextText = recentMessages
                .map(msg => msg.mes || '')
                .join(' ');
            
            // 组合当前输入和上下文
            const combinedText = `${contextText} ${inputText}`.trim();
            
            // 提取关键词作为预测查询
            const keywords = this.extractKeywords(combinedText);
            const predictedQuery = keywords.slice(0, 3).join(' ');
            
            console.log('[MultiRecallReranker] 🔮 预测查询:', predictedQuery);
            return predictedQuery;
            
        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 预测用户意图失败:', error);
            return inputText;
        }
    }
    
    /**
     * 🔍 提取关键词
     */
    extractKeywords(text) {
        try {
            // 1. 分词（简单按空格和标点分割）
            const words = text
                .replace(/[，。！？；：、""''（）《》【】\s]+/g, ' ')
                .split(' ')
                .filter(word => word.length >= this.config.minKeywordLength)
                .filter(word => !this.stopWords.has(word));
            
            // 2. 统计词频
            const wordFreq = {};
            words.forEach(word => {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            });
            
            // 3. 按词频排序
            const sortedWords = Object.entries(wordFreq)
                .sort((a, b) => b[1] - a[1])
                .map(([word]) => word);
            
            // 4. 返回Top N关键词
            return sortedWords.slice(0, this.config.maxKeywords);
            
        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 提取关键词失败:', error);
            return [];
        }
    }
    
    /**
     * 🎯 多路召回（关键词 + 语义）
     */
    async multiRecall(query) {
        try {
            console.log('[MultiRecallReranker] 🎯 开始多路召回...');
            
            const allResults = [];
            
            // 1️⃣ 关键词检索
            const keywordResults = await this.keywordSearch(query);
            console.log(`[MultiRecallReranker] 🔑 关键词检索: ${keywordResults.length} 条`);
            allResults.push(...keywordResults.map(r => ({ ...r, source: 'keyword' })));
            
            // 2️⃣ 语义检索
            const semanticResults = await this.semanticSearch(query);
            console.log(`[MultiRecallReranker] 🧠 语义检索: ${semanticResults.length} 条`);
            allResults.push(...semanticResults.map(r => ({ ...r, source: 'semantic' })));
            
            // 3️⃣ 去重
            const uniqueResults = this.deduplicateResults(allResults);
            console.log(`[MultiRecallReranker] 🔄 去重后: ${uniqueResults.length} 条`);
            
            return uniqueResults;
            
        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 多路召回失败:', error);
            return [];
        }
    }
    
    /**
     * 🔑 关键词检索
     */
    async keywordSearch(query) {
        try {
            // 提取查询关键词
            const keywords = this.extractKeywords(query);

            if (keywords.length === 0) {
                return [];
            }

            // 使用AIMemoryDatabase进行关键词搜索
            const aiMemoryDB = window.SillyTavernInfobar?.modules?.aiMemoryDatabase;
            if (!aiMemoryDB) {
                console.warn('[MultiRecallReranker] ⚠️ AIMemoryDatabase未找到');
                return [];
            }

            const results = [];
            for (const keyword of keywords) {
                const searchResults = await aiMemoryDB.searchMemories(keyword, {
                    limit: Math.ceil(this.config.keywordTopK / keywords.length),
                    sortBy: 'relevance'
                });

                results.push(...searchResults.map(r => ({
                    text: r.content || r.text,
                    content: r.content || r.text,
                    score: r.matchScore || 0.5,
                    metadata: r.metadata || {},
                    keyword: keyword
                })));
            }

            // 按分数排序并返回Top K
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, this.config.keywordTopK);

        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 关键词检索失败:', error);
            return [];
        }
    }

    /**
     * 🧠 语义检索
     */
    async semanticSearch(query) {
        try {
            const results = [];

            // 1️⃣ 语料库语义检索
            if (this.corpusRetrieval) {
                try {
                    const corpusResults = await this.corpusRetrieval.retrieveRelevantContent(query);
                    results.push(...corpusResults.map(r => ({
                        text: r.text || r.content,
                        content: r.text || r.content,
                        score: r.similarity || r.score || 0.5,
                        metadata: r.metadata || {},
                        corpusSource: true
                    })));
                } catch (error) {
                    console.error('[MultiRecallReranker] ❌ 语料库检索失败:', error);
                }
            }

            // 2️⃣ 记忆语义检索
            if (this.vectorizedMemoryRetrieval && this.vectorizedMemoryRetrieval.settings?.enabled) {
                try {
                    const memoryResults = await this.vectorizedMemoryRetrieval.semanticSearch(query, {
                        topK: this.config.semanticTopK,
                        threshold: 0.3
                    });

                    if (memoryResults && memoryResults.length > 0) {
                        results.push(...memoryResults.map(r => ({
                            text: r.text || r.content,
                            content: r.text || r.content,
                            score: r.similarity || r.score || 0.5,
                            metadata: r.metadata || {},
                            memorySource: true
                        })));
                    }
                } catch (error) {
                    console.error('[MultiRecallReranker] ❌ 记忆检索失败:', error);
                }
            }

            // 按分数排序并返回Top K
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, this.config.semanticTopK);

        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 语义检索失败:', error);
            return [];
        }
    }

    /**
     * 🔄 去重结果
     */
    deduplicateResults(results) {
        const seen = new Set();
        const unique = [];

        for (const result of results) {
            const key = (result.text || result.content || '').trim();
            if (key && !seen.has(key)) {
                seen.add(key);
                unique.push(result);
            }
        }

        return unique;
    }

    /**
     * 🎯 重排序（调用重排序模型API）
     */
    async rerank(query, results) {
        try {
            // 🆕 检查是否启用重排序
            if (!this.config.enableReranking || !this.config.rerankModel) {
                console.log('[MultiRecallReranker] ⏸️ 重排序未启用或未配置模型');
                return results.slice(0, this.config.finalTopK);
            }

            if (results.length === 0) {
                return [];
            }

            // 🆕 检查是否达到重排序阈值
            if (this.config.rerankThreshold > 0 && results.length < this.config.rerankThreshold) {
                console.log(`[MultiRecallReranker] ⏸️ 结果数量(${results.length})未达到重排序阈值(${this.config.rerankThreshold})，跳过重排序`);
                return results.slice(0, this.config.finalTopK);
            }

            console.log('[MultiRecallReranker] 🎯 开始重排序...', results.length, '条结果');

            // 准备文档列表
            const documents = results.map(r => r.text || r.content);

            // 🔧 修复：调用重排序API（尝试多个可能的路径）
            const baseUrl = this.config.rerankApiUrl.replace(/\/+$/, '');
            const possibleUrls = [
                `${baseUrl}/rerank`,           // 直接路径
                `${baseUrl}/v1/rerank`,        // v1路径
                `${baseUrl}/api/rerank`        // api路径
            ];

            let lastError = null;
            for (const rerankUrl of possibleUrls) {
                try {
                    console.log(`[MultiRecallReranker] 🔍 尝试重排序API: ${rerankUrl}`);

                    const response = await fetch(rerankUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.config.rerankApiKey}`
                        },
                        body: JSON.stringify({
                            model: this.config.rerankModel,
                            query: query,
                            documents: documents,
                            top_n: this.config.finalTopK
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }

                    const data = await response.json();
                    console.log('[MultiRecallReranker] ✅ 重排序完成:', data);

                    // 解析重排序结果
                    if (data.results && Array.isArray(data.results)) {
                        // Jina Reranker格式: { results: [{ index, relevance_score, document }] }
                        const rerankedResults = data.results.map(item => {
                            const originalResult = results[item.index];
                            return {
                                ...originalResult,
                                rerankScore: item.relevance_score || item.score,
                                originalIndex: item.index
                            };
                        });

                        console.log('[MultiRecallReranker] ✅ 重排序后返回', rerankedResults.length, '条结果');
                        return rerankedResults;
                    }

                    // 如果API返回格式不符合预期，返回原始结果
                    console.warn('[MultiRecallReranker] ⚠️ 重排序API返回格式不符合预期，使用原始排序');
                    return results.slice(0, this.config.finalTopK);

                } catch (error) {
                    lastError = error;
                    console.warn(`[MultiRecallReranker] ⚠️ 重排序API ${rerankUrl} 失败:`, error.message);
                    // 继续尝试下一个URL
                }
            }

            // 所有URL都失败了
            throw new Error(`所有重排序API路径都失败。最后错误: ${lastError?.message}`);

        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 重排序失败:', error);
            console.error('[MultiRecallReranker] 📋 配置信息:', {
                rerankApiUrl: this.config.rerankApiUrl,
                rerankModel: this.config.rerankModel,
                hasApiKey: !!this.config.rerankApiKey
            });
            // 降级：返回原始排序结果
            return results.slice(0, this.config.finalTopK);
        }
    }

    /**
     * 🚀 执行完整的多路召回+重排序流程
     */
    async execute(query) {
        try {
            if (this.isProcessing) {
                console.log('[MultiRecallReranker] ⏸️ 正在处理中，跳过');
                return null;
            }

            this.isProcessing = true;
            console.log('[MultiRecallReranker] 🚀 开始执行多路召回+重排序...');

            // 检查是否可以使用预取结果
            const now = Date.now();
            if (this.prefetchedResults &&
                this.lastPredictedQuery === query &&
                (now - this.prefetchTime) < this.config.prefetchCacheTime) {
                console.log('[MultiRecallReranker] 💾 使用预取结果');
                const results = this.prefetchedResults;

                // 重排序
                const finalResults = await this.rerank(query, results);

                this.isProcessing = false;
                return finalResults;
            }

            // 1️⃣ 多路召回
            const recallResults = await this.multiRecall(query);

            // 2️⃣ 重排序
            const finalResults = await this.rerank(query, recallResults);

            // 3️⃣ 记录查询历史
            this.queryHistory.push(query);
            if (this.queryHistory.length > this.maxHistorySize) {
                this.queryHistory.shift();
            }

            this.isProcessing = false;
            console.log('[MultiRecallReranker] ✅ 执行完成，返回', finalResults.length, '条结果');

            return finalResults;

        } catch (error) {
            console.error('[MultiRecallReranker] ❌ 执行失败:', error);
            this.isProcessing = false;
            return [];
        }
    }

    /**
     * ⚙️ 更新配置
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('[MultiRecallReranker] ⚙️ 配置已更新:', this.config);
    }

    /**
     * 🔄 启用/禁用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[MultiRecallReranker] ${enabled ? '✅ 已启用' : '⏸️ 已禁用'}`);
    }

    /**
     * 📊 获取统计信息
     */
    getStats() {
        return {
            enabled: this.enabled,
            initialized: this.initialized,
            isProcessing: this.isProcessing,
            queryHistorySize: this.queryHistory.length,
            hasPrefetchedResults: !!this.prefetchedResults,
            config: this.config
        };
    }
}

