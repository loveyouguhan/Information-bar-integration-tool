/**
 * 🔍 统一向量检索管理器
 * 
 * 功能说明:
 * - 统一管理所有向量检索功能(语料库、记忆、总结)
 * - 避免重复检索,提高性能
 * - 智能合并检索结果
 * - 统一注入到SillyTavern
 * 
 * @author Information bar integration tool
 * @version 2.0.0
 */

export class UnifiedVectorRetrieval {
    constructor(dependencies = {}) {
        // 🔧 依赖注入
        this.corpusRetrieval = dependencies.corpusRetrieval;
        this.vectorizedMemoryRetrieval = dependencies.vectorizedMemoryRetrieval;
        this.aiMemoryDatabase = dependencies.aiMemoryDatabase;
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.multiRecallReranker = dependencies.multiRecallReranker; // 🆕 多路召回+重排序

        // 🔧 获取SillyTavern的原生事件系统
        this.sillyTavernEventSource = null;
        this.sillyTavernEventTypes = null;

        // 📊 状态管理
        this.initialized = false;
        this.enabled = true;
        this.isProcessing = false;
        this.lastQuery = null;
        this.lastResults = null;
        this.lastQueryTime = 0;

        // ⚙️ 配置
        this.config = {
            // 检索源配置
            enableCorpusRetrieval: true,      // 启用语料库检索
            enableMemoryRetrieval: true,      // 启用记忆检索
            enableSummaryRetrieval: true,     // 启用总结检索

            // 🆕 多路召回配置
            enableMultiRecall: false,         // 启用多路召回+重排序

            // 性能优化
            cacheTimeout: 5000,               // 缓存超时时间(ms)
            skipDryRun: true,                 // 跳过dry run

            // 检索参数
            topK: 10,                         // 每个源最多返回的结果数
            threshold: 0.3,                   // 相似度阈值

            // 注入配置
            injectionPosition: 'system',      // 注入位置（字符串标识，用于UI显示）
            injectionDepth: 0,                // 注入深度（0=system, 1=after_character, 2=before_examples, 4=chat_history）
            injectionPriority: 1              // 注入优先级（position参数，数字越小越靠前，建议1-5）
        };

        console.log('[UnifiedVectorRetrieval] 🔍 统一向量检索管理器初始化');
        this.init();
    }
    
    async init() {
        try {
            // 🔧 获取SillyTavern的原生事件系统
            const context = window.SillyTavern?.getContext?.();
            if (context) {
                this.sillyTavernEventSource = context.eventSource;
                this.sillyTavernEventTypes = context.event_types;
                console.log('[UnifiedVectorRetrieval] ✅ 已获取SillyTavern事件系统');
            } else {
                console.warn('[UnifiedVectorRetrieval] ⚠️ 无法获取SillyTavern事件系统');
            }
            
            // 📥 加载配置
            this.loadConfig();
            
            // 📡 注册事件监听
            this.registerEventListeners();
            
            this.initialized = true;
            console.log('[UnifiedVectorRetrieval] ✅ 统一向量检索管理器初始化完成');
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 初始化失败:', error);
        }
    }
    
    /**
     * 📥 加载配置
     * 🔧 从向量功能面板读取配置
     */
    loadConfig() {
        try {
            // 🔧 从向量功能面板读取配置
            const context = window.SillyTavern?.getContext?.();
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};
            const vectorCfg = extCfg.vectorFunction || {};

            // 读取启用状态
            this.enabled = vectorCfg.enableAIRetrieval || false;

            // 🆕 同步VectorizedMemoryRetrieval的enabled状态
            // 因为向量化检索已合并到AI自动检索中，需要同步状态
            if (this.vectorizedMemoryRetrieval && this.vectorizedMemoryRetrieval.settings) {
                this.vectorizedMemoryRetrieval.settings.enabled = this.enabled;
                console.log('[UnifiedVectorRetrieval] 🔄 已同步VectorizedMemoryRetrieval状态:', this.enabled);
            }

            // 读取检索参数
            this.config.enableCorpusRetrieval = vectorCfg.enableCorpusRetrieval !== undefined ? vectorCfg.enableCorpusRetrieval : true;
            this.config.enableMemoryRetrieval = vectorCfg.enableMemoryRetrieval !== undefined ? vectorCfg.enableMemoryRetrieval : true;
            this.config.enableSummaryRetrieval = vectorCfg.enableSummaryRetrieval !== undefined ? vectorCfg.enableSummaryRetrieval : true;
            this.config.enableMultiRecall = vectorCfg.enableMultiRecall !== undefined ? vectorCfg.enableMultiRecall : false; // 🆕 多路召回
            this.config.topK = vectorCfg.retrievalTopK || 10;
            this.config.threshold = vectorCfg.retrievalThreshold || 0.3;
            this.config.cacheTimeout = vectorCfg.retrievalCacheTimeout || 5000;
            this.config.injectionPosition = vectorCfg.retrievalInjectionPosition || 'system';
            this.config.injectionDepth = vectorCfg.retrievalInjectionDepth !== undefined ? vectorCfg.retrievalInjectionDepth : 0;

            // 🔧 修复：injectionPriority 应该是一个较小的值（1-5），确保向量检索内容能够出现在提示词前面
            // 如果配置值过大（>5），自动修正为合理值
            let priority = vectorCfg.retrievalInjectionPriority !== undefined ? vectorCfg.retrievalInjectionPriority : 1;
            if (priority > 5) {
                console.warn(`[UnifiedVectorRetrieval] ⚠️ injectionPriority值过大(${priority})，自动修正为1`);
                priority = 1;
                // 更新配置
                if (vectorCfg) {
                    vectorCfg.retrievalInjectionPriority = 1;
                    this.saveConfigToExtension();
                }
            }
            this.config.injectionPriority = priority;

            console.log('[UnifiedVectorRetrieval] 📥 配置已加载:', {
                enabled: this.enabled,
                config: this.config
            });
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 💾 保存配置
     */
    saveConfig() {
        try {
            this.unifiedDataCore?.setData('unified_vector_retrieval_config', this.config, 'global');
            console.log('[UnifiedVectorRetrieval] 💾 配置已保存');
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 保存配置失败:', error);
        }
    }

    /**
     * 💾 保存配置到扩展设置
     */
    saveConfigToExtension() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (context && context.saveSettingsDebounced) {
                context.saveSettingsDebounced();
                console.log('[UnifiedVectorRetrieval] 💾 配置已保存到扩展设置');
            }
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 保存配置到扩展设置失败:', error);
        }
    }
    
    /**
     * 📡 注册事件监听
     */
    registerEventListeners() {
        try {
            if (this.sillyTavernEventSource && this.sillyTavernEventTypes) {
                // 🔧 监听SillyTavern的GENERATION_STARTED事件
                this.sillyTavernEventSource.on(this.sillyTavernEventTypes.GENERATION_STARTED, async (data) => {
                    if (this.enabled) {
                        await this.handleGenerationStarted(data);
                    }
                });
                console.log('[UnifiedVectorRetrieval] ✅ 已监听SillyTavern的GENERATION_STARTED事件');
            } else {
                console.warn('[UnifiedVectorRetrieval] ⚠️ SillyTavern事件系统不可用');
            }
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 注册事件监听失败:', error);
        }
    }
    
    /**
     * 🚀 处理生成开始事件
     */
    async handleGenerationStarted(data) {
        try {
            // 🔧 检查是否启用
            if (!this.enabled) {
                console.log('[UnifiedVectorRetrieval] ⏸️ 统一向量检索已禁用');
                return;
            }

            // 🔧 检测是否为dry run
            if (this.config.skipDryRun && data?.dryRun) {
                console.log('[UnifiedVectorRetrieval] ⏭️ 跳过dry run');
                return;
            }

            // 🔒 防止并发处理
            if (this.isProcessing) {
                console.log('[UnifiedVectorRetrieval] ⏸️ 正在处理中，跳过');
                return;
            }
            
            this.isProcessing = true;
            console.log('[UnifiedVectorRetrieval] 🚀 生成开始，准备统一检索...');
            
            // 📝 获取用户消息
            const userMessage = await this.getUserMessage();
            if (!userMessage) {
                console.log('[UnifiedVectorRetrieval] ℹ️ 未找到用户消息');
                this.isProcessing = false;
                return;
            }
            
            console.log('[UnifiedVectorRetrieval] 📝 用户消息:', userMessage.substring(0, 100) + '...');
            
            // 🔍 检查缓存
            const now = Date.now();
            if (this.lastQuery === userMessage && 
                this.lastResults && 
                (now - this.lastQueryTime) < this.config.cacheTimeout) {
                console.log('[UnifiedVectorRetrieval] 💾 使用缓存的检索结果');
                await this.injectResults(this.lastResults);
                this.isProcessing = false;
                return;
            }
            
            // 🔍 执行统一检索
            const results = await this.performUnifiedRetrieval(userMessage);
            
            // 💾 缓存结果
            this.lastQuery = userMessage;
            this.lastResults = results;
            this.lastQueryTime = now;
            
            // 💉 注入结果
            if (results && results.length > 0) {
                await this.injectResults(results);
            } else {
                console.log('[UnifiedVectorRetrieval] ℹ️ 未检索到相关内容');
            }
            
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 处理生成开始事件失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * 📝 获取用户消息
     */
    async getUserMessage() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                return null;
            }
            
            const chat = context.chat || [];
            if (chat.length === 0) {
                return null;
            }
            
            // 获取最后一条用户消息
            const lastUserMessage = chat.slice().reverse().find(msg => msg.is_user);
            return lastUserMessage?.mes || null;
        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 获取用户消息失败:', error);
            return null;
        }
    }
    
    /**
     * 🔍 执行统一检索
     */
    async performUnifiedRetrieval(query) {
        try {
            console.log('[UnifiedVectorRetrieval] 🔍 开始统一检索...');

            // 🆕 如果启用了多路召回+重排序，使用新系统
            if (this.config.enableMultiRecall && this.multiRecallReranker) {
                console.log('[UnifiedVectorRetrieval] 🎯 使用多路召回+重排序系统');
                const results = await this.multiRecallReranker.execute(query);
                console.log(`[UnifiedVectorRetrieval] ✅ 多路召回完成: ${results.length} 条结果`);
                return results;
            }

            // 传统检索流程
            const allResults = [];

            // 1️⃣ 语料库检索
            if (this.config.enableCorpusRetrieval && this.corpusRetrieval) {
                try {
                    const corpusResults = await this.corpusRetrieval.retrieveRelevantContent(query);
                    if (corpusResults && corpusResults.length > 0) {
                        console.log(`[UnifiedVectorRetrieval] 📚 语料库检索: ${corpusResults.length} 条`);
                        allResults.push(...corpusResults.map(r => ({
                            ...r,
                            source: 'corpus',
                            priority: 1
                        })));
                    }
                } catch (error) {
                    console.error('[UnifiedVectorRetrieval] ❌ 语料库检索失败:', error);
                }
            }

            // 2️⃣ 记忆检索
            if (this.config.enableMemoryRetrieval && this.vectorizedMemoryRetrieval) {
                try {
                    // 🔧 检查VectorizedMemoryRetrieval是否启用
                    if (!this.vectorizedMemoryRetrieval.settings?.enabled) {
                        console.log('[UnifiedVectorRetrieval] ⏸️ VectorizedMemoryRetrieval已禁用，跳过记忆检索');
                    } else {
                        const memoryResults = await this.vectorizedMemoryRetrieval.semanticSearch(query, {
                            topK: this.config.topK,
                            threshold: this.config.threshold
                        });
                        if (memoryResults && memoryResults.length > 0) {
                            console.log(`[UnifiedVectorRetrieval] 🧠 记忆检索: ${memoryResults.length} 条`);
                            allResults.push(...memoryResults.map(r => ({
                                ...r,
                                source: 'memory',
                                priority: 2
                            })));
                        }
                    }
                } catch (error) {
                    console.error('[UnifiedVectorRetrieval] ❌ 记忆检索失败:', error);
                }
            }

            // 3️⃣ 去重和排序
            const uniqueResults = this.deduplicateAndSort(allResults);

            console.log(`[UnifiedVectorRetrieval] ✅ 统一检索完成: ${uniqueResults.length} 条结果`);
            return uniqueResults;

        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 统一检索失败:', error);
            return [];
        }
    }
    
    /**
     * 🔄 去重和排序
     */
    deduplicateAndSort(results) {
        // 简单去重: 基于文本内容
        const seen = new Set();
        const unique = results.filter(r => {
            const key = r.text || r.content || '';
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
        
        // 排序: 优先级 > 相似度
        unique.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            return (b.similarity || 0) - (a.similarity || 0);
        });
        
        return unique;
    }
    
    /**
     * 💉 注入结果到SillyTavern
     */
    async injectResults(results) {
        try {
            console.log('[UnifiedVectorRetrieval] 💉 注入检索结果到SillyTavern...');

            // 构建注入文本
            let injectionText = '\n\n【🔍 智能向量检索】\n';
            injectionText += '以下是从知识库中检索到的相关内容：\n\n';

            results.forEach((item, index) => {
                const sourceLabel = item.source === 'corpus' ? '📚 语料库' : '🧠 记忆';
                injectionText += `${index + 1}. [${sourceLabel}] ${item.text || item.content}\n`;
                if (item.similarity) {
                    injectionText += `   相似度: ${(item.similarity * 100).toFixed(1)}%\n`;
                }
                injectionText += '\n';
            });

            // 使用SillyTavern的扩展提示词API
            const context = window.SillyTavern?.getContext?.();
            if (context && typeof context.setExtensionPrompt === 'function') {
                // 🔧 修复：setExtensionPrompt的参数顺序是 (key, value, position, depth, scan, role, filter)
                // position: 注入位置的优先级（数字越小越靠前）
                // depth: 注入深度（0=system, 1=after_character, 2=before_examples, 4=chat_history）
                context.setExtensionPrompt(
                    'Information bar integration tool - Unified Vector Retrieval',
                    injectionText,
                    this.config.injectionPriority,  // position: 优先级
                    this.config.injectionDepth,     // depth: 深度
                    false,                          // scan: 是否扫描
                    0                               // role: 0=system
                );

                console.log(`[UnifiedVectorRetrieval] ✅ 已注入 ${results.length} 条结果 (position: ${this.config.injectionPriority}, depth: ${this.config.injectionDepth})`);
            } else {
                console.warn('[UnifiedVectorRetrieval] ⚠️ SillyTavern扩展提示词API不可用');
            }

        } catch (error) {
            console.error('[UnifiedVectorRetrieval] ❌ 注入结果失败:', error);
        }
    }
    
    /**
     * ⚙️ 更新配置
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.saveConfig();
        console.log('[UnifiedVectorRetrieval] ⚙️ 配置已更新:', this.config);
    }
    
    /**
     * 🔄 启用/禁用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[UnifiedVectorRetrieval] ${enabled ? '✅ 已启用' : '⏸️ 已禁用'}`);
    }
    
    /**
     * 📊 获取状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.enabled,
            isProcessing: this.isProcessing,
            config: this.config,
            lastQuery: this.lastQuery,
            lastQueryTime: this.lastQueryTime
        };
    }
}

