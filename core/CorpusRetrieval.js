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
            // 监听聊天消息发送前事件
            if (this.eventSource) {
                this.eventSource.on('chatMessageSending', async (data) => {
                    if (this.enabled) {
                        await this.handleChatMessageSending(data);
                    }
                });
            }

            console.log('[CorpusRetrieval] 📡 事件监听已注册');
        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 注册事件监听失败:', error);
        }
    }

    /**
     * 💬 处理聊天消息发送前事件
     */
    async handleChatMessageSending(data) {
        try {
            console.log('[CorpusRetrieval] 💬 检测到消息发送，开始检索语料库...');

            // 获取用户消息
            const userMessage = data.message || '';
            if (!userMessage) {
                return;
            }

            // 检索相关内容
            const retrievedContent = await this.retrieveRelevantContent(userMessage);

            if (retrievedContent && retrievedContent.length > 0) {
                // 注入到提示词
                this.injectContent(data, retrievedContent);
            }

        } catch (error) {
            console.error('[CorpusRetrieval] ❌ 处理消息发送失败:', error);
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

                    // 查询向量数据库
                    const queryPayload = {
                        collectionId: corpus.collectionId,
                        searchText: query,
                        topK: this.config.topK,
                        threshold: this.config.threshold,
                        source: 'webllm',
                        embeddings: {
                            [query]: queryVector
                        }
                    };

                    const response = await fetch('/api/vector/query', {
                        method: 'POST',
                        headers: context.getRequestHeaders(),
                        body: JSON.stringify(queryPayload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        const results = result.metadata || result.results || result.data || [];
                        
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
     * 💉 注入内容到提示词
     */
    injectContent(data, retrievedContent) {
        try {
            console.log('[CorpusRetrieval] 💉 注入内容到提示词...');

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
}

