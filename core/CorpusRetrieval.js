/**
 * 🔍 CorpusRetrieval - 语料库检索模块
 * 
 * 功能：
 * - 在AI对话时自动检索相关的语料库内容
 * - 基于语义相似度匹配
 * - 注入到提示词中
 */

export class CorpusRetrieval {
    constructor(dependencies = {}) {
        // 依赖注入
        this.vectorRetrieval = dependencies.vectorRetrieval || window.SillyTavernInfobar?.modules?.vectorizedMemoryRetrieval;
        this.eventSource = dependencies.eventSource || window.SillyTavernInfobar?.eventSource;

        // 🔧 修复：获取SillyTavern的原生事件系统
        this.sillyTavernEventSource = null;
        this.sillyTavernEventTypes = null;

        // 初始化状态
        this.initialized = false;
        this.enabled = false;
        this.config = {
            topK: 3,
            threshold: 0.7,
            injectionPosition: 'system'
        };

        console.log('[CorpusRetrieval] 🔍 语料库检索模块初始化');
        this.init();
    }

    async init() {
        try {
            // 🔧 修复：获取SillyTavern的原生事件系统
            const context = window.SillyTavern?.getContext?.();
            if (context) {
                this.sillyTavernEventSource = context.eventSource;
                this.sillyTavernEventTypes = context.event_types;
                console.log('[CorpusRetrieval] ✅ 已获取SillyTavern事件系统');
            } else {
                console.warn('[CorpusRetrieval] ⚠️ 无法获取SillyTavern事件系统');
            }

            // 加载配置
            this.loadConfig();

            // 注册事件监听
            this.registerEventListeners();

            this.initialized = true;
            console.log('[CorpusRetrieval] ✅ 语料库检索模块初始化完成');
        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 初始化失败:', error);
        }
    }

    /**
     * 📥 加载配置
     */
    loadConfig() {
        try {
            const context = SillyTavern.getContext();
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};
            const vectorCfg = extCfg.vectorFunction || {};

            this.enabled = vectorCfg.enableAIRetrieval || false;
            this.config = {
                topK: vectorCfg.retrievalTopK || 3,
                threshold: vectorCfg.retrievalThreshold || 0.7,
                injectionPosition: vectorCfg.retrievalInjectionPosition || 'system'
            };

            console.log('[CorpusRetrieval] 📥 配置已加载:', this.config);
        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 📡 注册事件监听
     */
    registerEventListeners() {
        try {
            // 🔧 修复：由UnifiedVectorRetrieval统一管理，此处不再注册事件监听
            console.log('[CorpusRetrieval] ⚠️ 语料库检索已由UnifiedVectorRetrieval统一管理，不再注册独立事件监听');
            console.log('[CorpusRetrieval] 📡 事件监听已跳过（由统一管理器接管）');
        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 注册事件监听失败:', error);
        }
    }

    /**
     * � 处理生成开始事件
     */
    async handleGenerationStarted() {
        try {
            console.log('[CorpusRetrieval] � 生成开始，准备检索语料库...');

            // 🔧 修复：从SillyTavern获取当前用户消息
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[CorpusRetrieval] ⚠️ 无法获取SillyTavern上下文');
                return;
            }

            // 获取聊天历史
            const chat = context.chat || [];
            if (chat.length === 0) {
                console.log('[CorpusRetrieval] ℹ️ 聊天历史为空');
                return;
            }

            // 获取最后一条用户消息
            const lastUserMessage = chat.slice().reverse().find(msg => msg.is_user);
            if (!lastUserMessage || !lastUserMessage.mes) {
                console.log('[CorpusRetrieval] ℹ️ 未找到用户消息');
                return;
            }

            const userMessage = lastUserMessage.mes;
            console.log('[CorpusRetrieval] 📝 用户消息:', userMessage.substring(0, 100) + '...');

            // 检索相关内容
            const retrievedContent = await this.retrieveRelevantContent(userMessage);

            if (retrievedContent && retrievedContent.length > 0) {
                // 🔧 修复：使用SillyTavern的扩展提示词API注入
                await this.injectToSillyTavern(retrievedContent);
            } else {
                console.log('[CorpusRetrieval] ℹ️ 未检索到相关内容');
            }

        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 处理生成开始事件失败:', error);
        }
    }

    /**
     * 🔍 检索相关内容
     */
    async retrieveRelevantContent(query) {
        try {
            console.log('[CorpusRetrieval] 🔍 检索查询:', query);

            // 获取所有语料库
            const context = SillyTavern.getContext();
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};
            const vectorCorpus = extCfg.vectorCorpus || {};

            // 🔧 修复：确保向量API已配置
            const vectorAPIConfig = extCfg.vectorAPIConfig || {};
            if (!vectorAPIConfig.baseUrl || !vectorAPIConfig.apiKey) {
                console.warn('[CorpusRetrieval] ⚠️ 向量API未配置，无法检索');
                return [];
            }

            // 更新向量API配置
            this.vectorRetrieval.customVectorAPI.updateConfig({
                url: vectorAPIConfig.baseUrl,
                apiKey: vectorAPIConfig.apiKey,
                model: vectorAPIConfig.model
            });

            // 🔥 新增：智能意图识别
            const intent = this.detectIntent(query);

            console.log('[CorpusRetrieval] 🔧 向量API配置已更新:', {
                url: vectorAPIConfig.baseUrl,
                model: vectorAPIConfig.model
            });

            const allResults = [];

            // 遍历所有语料库进行检索
            for (const [fileName, corpus] of Object.entries(vectorCorpus)) {
                if (!corpus.collectionId) {
                    continue;
                }

                try {
                    // 向量化查询文本
                    const queryVector = await this.vectorRetrieval.customVectorAPI.vectorizeText(query);

                    // 🔥 新增：构建metadata过滤器
                    const filters = this.buildMetadataFilters(intent, corpus);

                    // 查询向量数据库
                    const queryPayload = {
                        collectionId: corpus.collectionId,
                        searchText: query,
                        topK: this.config.topK * 2,  // 获取更多结果用于过滤
                        threshold: this.config.threshold,
                        source: 'webllm',
                        embeddings: {
                            [query]: queryVector
                        },
                        // 🔥 新增：metadata过滤
                        filter: filters
                    };

                    const response = await fetch('/api/vector/query', {
                        method: 'POST',
                        headers: context.getRequestHeaders(),
                        body: JSON.stringify(queryPayload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        let results = result.metadata || result.results || result.data || [];

                        // 🔥 新增：客户端二次过滤（如果后端不支持filter）
                        results = this.applyClientSideFilters(results, intent);

                        // 添加来源信息
                        results.forEach(r => {
                            r.source = fileName;
                            r.analysis = corpus.analysis;
                        });

                        allResults.push(...results);
                    }
                } catch (error) {
                    console.warn('[CorpusRetrieval] ⚠️ 检索语料库失败:', fileName, error);
                }
            }

            // 按相似度排序并取前topK个
            allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
            const topResults = allResults.slice(0, this.config.topK);

            console.log('[CorpusRetrieval] ✅ 检索到', topResults.length, '个相关内容');
            return topResults;

        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 检索失败:', error);
            return [];
        }
    }

    /**
     * � 新增：注入到SillyTavern
     */
    async injectToSillyTavern(retrievedContent) {
        try {
            console.log('[CorpusRetrieval] 💉 注入内容到SillyTavern...');

            // 构建注入文本
            let injectionText = '\n\n【📚 语料库知识】\n';
            injectionText += '以下是从语料库中检索到的相关内容，可以作为参考：\n\n';

            retrievedContent.forEach((item, index) => {
                injectionText += `${index + 1}. 来源：${item.source}\n`;
                injectionText += `   内容：${item.text}\n`;

                // 如果有分析结果，添加相关信息
                if (item.analysis) {
                    if (item.analysis.writingStyle) {
                        injectionText += `   文风：${item.analysis.writingStyle.languageStyle || '未知'}\n`;
                    }
                }

                injectionText += '\n';
            });

            // 🔧 修复：使用SillyTavern的扩展提示词API
            const context = window.SillyTavern?.getContext?.();
            if (context && typeof context.setExtensionPrompt === 'function') {
                // 根据配置的位置确定注入深度和位置
                let depth = 0;
                let position = 0;

                switch (this.config.injectionPosition) {
                    case 'system':
                        depth = 0;  // 最高优先级
                        position = 0;
                        break;
                    case 'after_character':
                        depth = 1;
                        position = 1;
                        break;
                    case 'before_examples':
                        depth = 2;
                        position = 0;
                        break;
                    case 'chat_history':
                        depth = 4;
                        position = 0;
                        break;
                    default:
                        depth = 0;
                        position = 0;
                }

                context.setExtensionPrompt(
                    'Information bar integration tool - Corpus Retrieval',
                    injectionText,
                    position,
                    depth
                );

                console.log(`[CorpusRetrieval] ✅ 内容已注入到SillyTavern (depth: ${depth}, position: ${position})`);
            } else {
                console.warn('[CorpusRetrieval] ⚠️ SillyTavern扩展提示词API不可用');
            }

        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 注入内容失败:', error);
        }
    }

    /**
     * 💉 注入内容到提示词（已废弃，保留用于兼容性）
     * @deprecated 使用 injectToSillyTavern 代替
     */
    injectContent(data, retrievedContent) {
        try {
            console.log('[CorpusRetrieval] ⚠️ 使用已废弃的injectContent方法，建议使用injectToSillyTavern');

            // 构建注入文本
            let injectionText = '\n\n【语料库知识】\n';
            injectionText += '以下是从语料库中检索到的相关内容，可以作为参考：\n\n';

            retrievedContent.forEach((item, index) => {
                injectionText += `${index + 1}. 来源：${item.source}\n`;
                injectionText += `   内容：${item.text}\n`;

                // 如果有分析结果，添加相关信息
                if (item.analysis) {
                    if (item.analysis.writingStyle) {
                        injectionText += `   文风：${item.analysis.writingStyle.languageStyle || '未知'}\n`;
                    }
                }

                injectionText += '\n';
            });

            // 根据配置的位置注入
            switch (this.config.injectionPosition) {
                case 'system':
                    // 注入到系统提示词
                    if (data.systemPrompt) {
                        data.systemPrompt += injectionText;
                    } else {
                        data.systemPrompt = injectionText;
                    }
                    break;

                case 'after_character':
                    // 注入到角色描述后
                    if (data.characterDescription) {
                        data.characterDescription += injectionText;
                    }
                    break;

                case 'before_examples':
                    // 注入到示例对话前
                    if (data.examples) {
                        data.examples = injectionText + data.examples;
                    }
                    break;

                case 'chat_history':
                    // 注入到聊天历史中
                    if (data.chatHistory) {
                        data.chatHistory.push({
                            role: 'system',
                            content: injectionText
                        });
                    }
                    break;

                default:
                    // 默认注入到系统提示词
                    if (data.systemPrompt) {
                        data.systemPrompt += injectionText;
                    } else {
                        data.systemPrompt = injectionText;
                    }
            }

            console.log('[CorpusRetrieval] ✅ 内容已注入到:', this.config.injectionPosition);

        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 注入内容失败:', error);
        }
    }

    /**
     * 🔄 更新配置
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
        console.log('[CorpusRetrieval] 🔄 配置已更新:', this.config);
    }

    /**
     * 🔌 启用/禁用检索
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log('[CorpusRetrieval] 🔌 检索已', enabled ? '启用' : '禁用');
    }

    /**
     * 📊 获取状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.enabled,
            config: this.config
        };
    }

    /**
     * 🔥 新增：智能意图识别
     */
    detectIntent(query) {
        const intent = {
            type: 'general',  // general, character, location, event, time
            character: null,
            location: null,
            timeRange: null,
            plotType: null,
            keywords: []
        };

        const lowerQuery = query.toLowerCase();

        // 角色查询检测
        const characterPatterns = [
            /(?:关于|有关|描述|介绍)(.+?)(?:的|是|在)/,
            /(.+?)(?:是谁|做了什么|在哪里|怎么样)/,
            /(.+?)(?:和|与)(.+?)(?:的关系|关系如何)/
        ];

        for (const pattern of characterPatterns) {
            const match = query.match(pattern);
            if (match) {
                intent.type = 'character';
                intent.character = match[1].trim();
                break;
            }
        }

        // 地点查询检测
        const locationPatterns = [
            /在(.+?)(?:发生|出现|有)/,
            /(.+?)(?:这个地方|这里|那里)/
        ];

        for (const pattern of locationPatterns) {
            const match = query.match(pattern);
            if (match) {
                intent.type = 'location';
                intent.location = match[1].trim();
                break;
            }
        }

        // 时间查询检测
        if (lowerQuery.includes('之前') || lowerQuery.includes('之后') ||
            lowerQuery.includes('早期') || lowerQuery.includes('后期')) {
            intent.type = 'time';
        }

        // 剧情类型检测
        if (lowerQuery.includes('战斗') || lowerQuery.includes('打斗')) {
            intent.plotType = 'combat';
        } else if (lowerQuery.includes('修炼') || lowerQuery.includes('突破')) {
            intent.plotType = 'cultivation';
        } else if (lowerQuery.includes('探索') || lowerQuery.includes('冒险')) {
            intent.plotType = 'exploration';
        } else if (lowerQuery.includes('对话') || lowerQuery.includes('交流')) {
            intent.plotType = 'social';
        }

        // 提取关键词
        intent.keywords = query.split(/\s+/).filter(w => w.length > 1);

        console.log('[CorpusRetrieval] 🎯 意图识别结果:', intent);
        return intent;
    }

    /**
     * 🔥 新增：构建metadata过滤器
     */
    buildMetadataFilters(intent) {
        const filters = {};

        // 🔥 剧透控制：只检索当前章节之前的内容
        // 注意：这需要知道用户当前阅读到哪一章
        // 暂时不实现，因为在对话场景中无法确定"当前章节"

        // 角色过滤
        if (intent.character) {
            filters['metadata.characters'] = {
                $contains: intent.character
            };
        }

        // 地点过滤
        if (intent.location) {
            filters['metadata.worldBuilding.locations'] = {
                $contains: intent.location
            };
        }

        // 剧情类型过滤
        if (intent.plotType) {
            filters['metadata.plotType'] = intent.plotType;
        }

        // 重要性过滤（优先返回重要内容）
        if (intent.type === 'character' || intent.type === 'event') {
            filters['metadata.importance'] = {
                $gte: 0.6
            };
        }

        console.log('[CorpusRetrieval] 🔍 构建的过滤器:', filters);
        return Object.keys(filters).length > 0 ? filters : null;
    }

    /**
     * 🔥 新增：客户端二次过滤
     */
    applyClientSideFilters(results, intent) {
        if (!results || results.length === 0) {
            return results;
        }

        let filtered = results;

        // 角色过滤
        if (intent.character) {
            filtered = filtered.filter(r => {
                const metadata = r.metadata || {};
                const characters = metadata.characters || [];
                return characters.some(c =>
                    c.name && c.name.includes(intent.character)
                );
            });
        }

        // 地点过滤
        if (intent.location) {
            filtered = filtered.filter(r => {
                const metadata = r.metadata || {};
                const locations = metadata.worldBuilding?.locations || [];
                return locations.some(l =>
                    l.name && l.name.includes(intent.location)
                );
            });
        }

        // 剧情类型过滤
        if (intent.plotType) {
            filtered = filtered.filter(r => {
                const metadata = r.metadata || {};
                return metadata.plotType === intent.plotType;
            });
        }

        // 重要性过滤
        if (intent.type === 'character' || intent.type === 'event') {
            filtered = filtered.filter(r => {
                const metadata = r.metadata || {};
                return (metadata.importance || 0) >= 0.6;
            });
        }

        console.log(`[CorpusRetrieval] 🔍 客户端过滤: ${results.length} → ${filtered.length}`);
        return filtered;
    }
}

