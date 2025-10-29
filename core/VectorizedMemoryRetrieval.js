/**
 * 向量化记忆检索系统
 *
 * 负责语义搜索和向量化记忆管理：
 * - 多引擎向量化支持（Transformers.js、OpenAI等）
 * - 语义相似度搜索
 * - 记忆向量化和索引
 * - 智能检索和排序
 * - 与AI记忆总结器深度集成
 *
 * @class VectorizedMemoryRetrieval
 */

import { VectorAPIAdapter } from './VectorAPIAdapter.js';
import { CustomVectorAPIAdapter } from './CustomVectorAPIAdapter.js';

export class VectorizedMemoryRetrieval {
    constructor(unifiedDataCore, eventSystem, aiMemorySummarizer) {
        console.log('[VectorizedMemoryRetrieval] 🔍 向量化记忆检索系统初始化开始');

        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.aiMemorySummarizer = aiMemorySummarizer;

        // 向量化设置
        this.settings = {
            enabled: false,                    // 🔧 修复：默认禁用向量化检索
            
            // 🔧 重构：向量化引擎（用于计算向量）
            vectorEngine: 'custom',            // 向量化引擎：'custom'（自定义API）| 'local'（本地Transformers.js）
            embeddingModel: 'Supabase/gte-small', // 嵌入模型（本地引擎使用）
            vectorDimensions: 384,             // 向量维度
            
            // 🚀 自定义向量化API配置（从信息栏设置读取）
            customVectorAPI: {                 
                url: '',                       // API地址
                apiKey: '',                    // API密钥
                model: ''                      // 模型名称
            },
            
            // 🚀 RAG优化：基于SillyTavern最佳实践
            similarityThreshold: 0.3,          // 🎯 RAG优化：降低到0.3，提高检索覆盖率
            maxResults: 15,                    // 最大返回结果数
            retrieveChunks: 2,                 // 🎯 RAG优化：检索块数（默认2，可根据需要调整）
            maxCacheSize: 1000,                // 最大缓存大小
            
            // 🎯 RAG优化：块大小配置（基于512 token嵌入模型）
            chunkSize: 2000,                   // 块大小（字符）- 对应约500 tokens
            chunkOverlap: 0,                   // 块重叠比例（0%）- 避免重复检索
            minChunkSize: 1024,                // 最小块大小 (>50%最大块)
            maxChunkSize: 2048,                // 最大块大小 (<嵌入模型上下文)
            
            // 🎯 RAG优化：注入配置
            injectionPosition: 'chat_depth_2', // 注入位置：聊天中@深度2
            injectionTemplate: 'rag_memory',   // 使用RAG优化的注入模板
            includeTimeContext: true,          // 包含时间上下文
            includeLocationContext: true,      // 包含位置上下文
            
            batchSize: 50,                     // 批量处理大小
            autoVectorize: true,               // 自动向量化新记忆
            fallbackMode: true,                // 🔧 启用fallback模式
            enableBasicSearch: true,           // 🔧 启用基础搜索作为备选
            
            // 🎯 RAG优化：查询增强
            queryExpansion: true,              // 查询扩展
            queryMessages: 2,                  // 查询消息数（用户+AI最近2条）
            semanticBoost: true,               // 语义增强
            hybridSearch: false                // 混合搜索（向量+关键词）
        };
        
        // 向量化引擎
        this.vectorEngines = {
            transformers: null,                // Transformers.js引擎
            openai: null,                      // OpenAI引擎
            custom: null                       // 自定义引擎
        };

        // 🚀 原生向量API适配器
        this.vectorAPI = new VectorAPIAdapter({
            context: window.SillyTavern?.getContext?.(),
            unifiedDataCore: this.unifiedDataCore
        });

        // 🚀 新增：自定义向量API适配器
        this.customVectorAPI = new CustomVectorAPIAdapter(this.settings.customVectorAPI);

        // 向量缓存和索引
        this.vectorCache = new Map();         // 向量缓存
        this.memoryIndex = new Map();         // 记忆索引
        this.vectorIndex = [];                // 向量索引数组
        this.isIndexing = false;              // 是否正在索引

        // 性能统计
        this.stats = {
            totalVectorized: 0,                // 总向量化数量
            cacheHits: 0,                      // 缓存命中次数
            searchCount: 0,                    // 搜索次数
            avgSearchTime: 0,                  // 平均搜索时间
            lastIndexTime: 0                   // 最后索引时间
        };

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;

        console.log('[VectorizedMemoryRetrieval] 🏗️ 构造函数完成');
    }

    /**
     * 初始化向量化记忆检索系统
     */
    async init() {
        try {
            console.log('[VectorizedMemoryRetrieval] 📊 开始初始化向量化记忆检索系统...');

            // 🔧 修复：设置customVectorAPI的context
            if (this.customVectorAPI) {
                const context = window.SillyTavern?.getContext?.();
                if (context) {
                    this.customVectorAPI.setContext(context);
                    console.log('[VectorizedMemoryRetrieval] ✅ 已设置customVectorAPI的context');
                }
            }

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[VectorizedMemoryRetrieval] ⏸️ 向量化记忆检索已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 初始化向量化引擎
            await this.initializeVectorEngines();

            // 绑定事件监听器
            this.bindEventListeners();

            // 加载现有向量缓存
            await this.loadVectorCache();

            // 构建记忆索引
            await this.buildMemoryIndex();

            this.initialized = true;
            console.log('[VectorizedMemoryRetrieval] ✅ 向量化记忆检索系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-memory-retrieval:initialized', {
                    timestamp: Date.now(),
                    vectorEngine: this.settings.vectorEngine,
                    indexSize: this.vectorIndex.length
                });
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            console.log('[VectorizedMemoryRetrieval] 📥 加载向量化设置...');

            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.vector) {
                    if (memoryEnhancement.vector.enabled !== undefined) {
                        this.settings.enabled = memoryEnhancement.vector.enabled;
                    }
                    if (memoryEnhancement.vector.vectorEngine !== undefined) {
                        this.settings.vectorEngine = memoryEnhancement.vector.vectorEngine;
                    }
                    if (memoryEnhancement.vector.similarityThreshold !== undefined) {
                        this.settings.similarityThreshold = memoryEnhancement.vector.similarityThreshold;
                    }
                    if (memoryEnhancement.vector.maxResults !== undefined) {
                        this.settings.maxResults = memoryEnhancement.vector.maxResults;
                    }
                    console.log('[VectorizedMemoryRetrieval] 📥 从extensionSettings加载设置成功');
                }
            } catch (error) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('vectorized_memory_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[VectorizedMemoryRetrieval] ✅ 向量化设置加载完成:', this.settings);
                }
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔄 更新向量化设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 🚀 新增：更新自定义向量API配置
            if (newSettings.customVectorAPI) {
                this.customVectorAPI.updateConfig(newSettings.customVectorAPI);
                console.log('[VectorizedMemoryRetrieval] 🔧 自定义向量API配置已更新');
            }

            // 🔧 修复：保存设置到extensionSettings和UnifiedDataCore
            // 1. 保存到UnifiedDataCore
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('vectorized_memory_settings', this.settings);
            }

            // 2. 保存到SillyTavern扩展设置
            try {
                const context = SillyTavern?.getContext?.();
                if (context?.extensionSettings) {
                    if (!context.extensionSettings['Information bar integration tool']) {
                        context.extensionSettings['Information bar integration tool'] = {};
                    }
                    if (!context.extensionSettings['Information bar integration tool'].memoryEnhancement) {
                        context.extensionSettings['Information bar integration tool'].memoryEnhancement = {};
                    }

                    // 🔧 修复：保存到memoryEnhancement.vector（与loadSettings匹配）
                    context.extensionSettings['Information bar integration tool'].memoryEnhancement.vector = this.settings;

                    // 🔧 关键：调用saveSettingsDebounced持久化到settings.json
                    if (context.saveSettingsDebounced) {
                        await context.saveSettingsDebounced();
                    }

                    console.log('[VectorizedMemoryRetrieval] ✅ 设置已同步到扩展设置');
                }
            } catch (extensionError) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 同步到扩展设置失败:', extensionError);
            }

            // 如果引擎类型改变，重新初始化
            if (newSettings.vectorEngine && newSettings.vectorEngine !== this.settings.vectorEngine) {
                await this.initializeVectorEngines();
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 🔧 重构：初始化向量化引擎（用于计算向量）
     */
    async initializeVectorEngines() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🚀 初始化向量化引擎:', this.settings.vectorEngine);
            console.log('[VectorizedMemoryRetrieval] 📦 向量存储: SillyTavern向量API');

            // 🔧 修复：初始化SillyTavern向量存储API
            const context = window.SillyTavern?.getContext?.();
            if (context && this.vectorAPI) {
                this.vectorAPI.context = context;
                console.log('[VectorizedMemoryRetrieval] ✅ SillyTavern向量存储API已就绪');
            }

            // 🔧 重构：根据vectorEngine初始化向量化计算引擎
            switch (this.settings.vectorEngine) {
                case 'custom':
                    // 使用用户配置的自定义向量化API
                    console.log('[VectorizedMemoryRetrieval] 🔧 使用自定义向量化API');
                    await this.initializeCustomVectorAPI();
                    break;
                    
                case 'local':
                    // 使用本地Transformers.js
                    console.log('[VectorizedMemoryRetrieval] 💻 使用本地Transformers.js引擎');
                    await this.initializeTransformersEngine();
                    break;
                    
                default:
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 未知的向量化引擎:', this.settings.vectorEngine);
                    console.log('[VectorizedMemoryRetrieval] 🔄 自动选择向量化引擎...');
                    await this.autoSelectVectorEngine();
            }

            console.log('[VectorizedMemoryRetrieval] ✅ 向量化引擎初始化完成');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 初始化向量化引擎失败:', error);
            // 降级到基础搜索模式
            console.log('[VectorizedMemoryRetrieval] 🔄 降级到基础搜索模式');
            this.settings.enabled = false;
        }
    }


    /**
     * 🆕 初始化自定义向量API
     */
    async initializeCustomVectorAPI() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔧 初始化自定义向量API...');

            // 从信息栏设置读取向量API配置
            const context = window.SillyTavern?.getContext?.();
            const vectorAPIConfig = context?.extensionSettings?.['Information bar integration tool']?.vectorAPIConfig;

            if (vectorAPIConfig && vectorAPIConfig.baseUrl && vectorAPIConfig.apiKey) {
                console.log('[VectorizedMemoryRetrieval] 📥 从信息栏设置加载向量API配置');
                this.customVectorAPI.updateConfig({
                    url: vectorAPIConfig.baseUrl,
                    apiKey: vectorAPIConfig.apiKey,
                    model: vectorAPIConfig.model || 'text-embedding-ada-002'
                });
            }

            // 验证配置
            if (!this.customVectorAPI.isConfigValid()) {
                throw new Error('自定义向量API配置无效：缺少URL或API密钥');
            }

            // 🔧 修复：添加超时保护，避免长时间阻塞初始化
            console.log('[VectorizedMemoryRetrieval] 🔍 测试API连通性（超时时间: 10秒）...');
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API连通性测试超时(10秒)')), 10000);
            });

            try {
                // 使用Promise.race实现超时控制
                const models = await Promise.race([
                    this.customVectorAPI.getModels(),
                    timeoutPromise
                ]);
                console.log('[VectorizedMemoryRetrieval] 📋 自定义API可用模型数:', models.length);
                console.log('[VectorizedMemoryRetrieval] ✅ 自定义向量API初始化成功');
                return true;
            } catch (testError) {
                // API测试失败，但不阻塞初始化
                console.warn('[VectorizedMemoryRetrieval] ⚠️ API连通性测试失败:', testError.message);
                console.log('[VectorizedMemoryRetrieval] 💡 将在首次使用时再次尝试连接');
                // 标记为部分初始化成功，允许后续使用时重试
                return true;
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 自定义向量API初始化失败:', error);

            // 降级到本地引擎
            if (this.settings.fallbackMode) {
                console.log('[VectorizedMemoryRetrieval] 🔄 降级到本地Transformers.js引擎');
                this.settings.vectorStorage = 'local';
                await this.initializeTransformersEngine();
            }
            throw error;
        }
    }

    /**
     * 🆕 自动选择最佳向量化引擎（用于计算向量）
     */
    async autoSelectVectorEngine() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🤖 自动选择向量化引擎...');

            // 优先级1: 尝试自定义向量化API
            try {
                await this.initializeCustomVectorAPI();
                this.settings.vectorEngine = 'custom';
                console.log('[VectorizedMemoryRetrieval] ✅ 已选择: 自定义向量化API');
                return;
            } catch (error) {
                console.log('[VectorizedMemoryRetrieval] ⏭️ 自定义向量化API不可用，尝试下一个...');
            }

            // 优先级2: 使用本地Transformers.js
            try {
                await this.initializeTransformersEngine();
                this.settings.vectorEngine = 'local';
                console.log('[VectorizedMemoryRetrieval] ✅ 已选择: 本地Transformers.js引擎');
                return;
            } catch (error) {
                console.log('[VectorizedMemoryRetrieval] ⏭️ 本地引擎不可用');
            }

            // 所有方案都失败，禁用向量化
            console.warn('[VectorizedMemoryRetrieval] ⚠️ 所有向量化引擎均不可用，禁用向量化功能');
            this.settings.enabled = false;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 自动选择向量化引擎失败:', error);
            this.settings.enabled = false;
        }
    }

    /**
     * 初始化Transformers.js引擎
     */
    async initializeTransformersEngine() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🤖 初始化Transformers.js引擎...');

            // 检查Transformers.js是否可用
            try {
                // 🔧 修复：使用CDN方式加载Transformers.js库
                await this.loadTransformersLibrary();
                
                // 检查全局变量是否已加载
                if (typeof window.Transformers === 'undefined') {
                    throw new Error('Transformers.js库未成功加载到全局变量');
                }

                const { pipeline, env } = window.Transformers;

                // 配置环境（使用本地模型）
                env.allowLocalModels = true;
                env.allowRemoteModels = true;

                // 🔧 新增：检测并启用角色扮演模式
                const roleplaySupported = this.isRoleplayModeSupported();
                const pipelineOptions = {
                    quantized: true,  // 使用量化模型以提高性能
                    dimensions: this.settings.vectorDimensions,  // 指定向量维度
                    roleplayMode: roleplaySupported,  // 🔧 新增：角色扮演模式
                    progress_callback: (progress) => {
                        console.log('[VectorizedMemoryRetrieval] 📥 模型加载进度:', progress);
                    }
                };

                // 创建特征提取管道
                this.vectorEngines.transformers = await pipeline(
                    'feature-extraction',
                    this.settings.embeddingModel,
                    pipelineOptions
                );

                // 🔧 新增：如果是本地轻量版库，进行预训练和优化
                if (window.Transformers.version && window.Transformers.version.includes('lite')) {
                    console.log('[VectorizedMemoryRetrieval] 🎯 检测到本地轻量版库，开始优化...');
                    
                    // 预训练
                    await this.pretrainLiteLibrary();
                    
                    // 如果支持角色扮演模式，进行额外优化
                    if (roleplaySupported) {
                        console.log('[VectorizedMemoryRetrieval] 🎭 角色扮演模式已启用');
                        await this.optimizeForRoleplay();
                    }
                }

                console.log('[VectorizedMemoryRetrieval] ✅ Transformers.js引擎初始化完成');

            } catch (importError) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ Transformers.js库不可用:', importError.message);

                // 降级到基础文本相似度
                console.log('[VectorizedMemoryRetrieval] 🔄 降级到基础文本相似度模式');
                this.vectorEngines.transformers = 'fallback';
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ Transformers.js引擎初始化失败:', error);

            // 降级到基础文本相似度
            console.log('[VectorizedMemoryRetrieval] 🔄 降级到基础文本相似度模式');
            this.vectorEngines.transformers = 'fallback';
        }
    }

    /**
     * 🔧 新增：加载本地部署的Transformers.js库
     */
    async loadTransformersLibrary() {
        try {
            // 检查是否已经加载
            if (typeof window.Transformers !== 'undefined') {
                console.log('[VectorizedMemoryRetrieval] ✅ Transformers.js库已加载');
                return;
            }

            console.log('[VectorizedMemoryRetrieval] 📥 开始加载本地Transformers.js库...');

            // 方法1：优先加载角色扮演专用库文件
            const libraryFiles = [
                'scripts/extensions/third-party/Information bar integration tool/libs/transformers/roleplay-corpus.js',
                'scripts/extensions/third-party/Information bar integration tool/libs/transformers/roleplay-vocabulary.js',
                'scripts/extensions/third-party/Information bar integration tool/libs/transformers/transformers-lite.js'
            ];
            
            try {
                console.log('[VectorizedMemoryRetrieval] 📚 开始加载角色扮演优化库...');
                
                // 按顺序加载所有库文件
                for (const libPath of libraryFiles) {
                    await this.loadScript(libPath);
                    console.log('[VectorizedMemoryRetrieval] ✅ 已加载:', libPath.split('/').pop());
                }
                
                // 验证所有必需的组件都已加载
                if (typeof window.Transformers !== 'undefined' && 
                    typeof window.RoleplayCorpus !== 'undefined' && 
                    typeof window.VocabularyWeightCalculator !== 'undefined') {
                    console.log('[VectorizedMemoryRetrieval] ✅ 角色扮演优化库完整加载成功');
                    return;
                } else {
                    throw new Error('部分角色扮演库组件加载失败');
                }
            } catch (localError) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 角色扮演优化库加载失败:', localError.message);
                
                // 备用：仅加载基础库
                try {
                    const basicLibPath = 'scripts/extensions/third-party/Information bar integration tool/libs/transformers/transformers-lite.js';
                    await this.loadScript(basicLibPath);
                    if (typeof window.Transformers !== 'undefined') {
                        console.log('[VectorizedMemoryRetrieval] ✅ 基础轻量版Transformers.js加载成功');
                        return;
                    }
                } catch (basicError) {
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 基础库加载也失败:', basicError.message);
                }
            }

            // 方法2：尝试ES模块导入本地库
            try {
                const module = await import('scripts/extensions/third-party/Information bar integration tool/libs/transformers/transformers-lite.js');
                window.Transformers = {
                    pipeline: module.pipeline,
                    env: module.env,
                    similarity: module.similarity,
                    version: module.version
                };
                console.log('[VectorizedMemoryRetrieval] ✅ 本地库通过ES模块加载成功');
                return;
            } catch (esModuleError) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ ES模块导入本地库失败:', esModuleError.message);
            }

            // 方法3：备用CDN加载（如果本地库不可用）
            console.log('[VectorizedMemoryRetrieval] 🔄 本地库不可用，尝试CDN备用方案...');
            const cdnUrls = [
                'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js',
                'https://unpkg.com/@huggingface/transformers@3.0.2/dist/transformers.min.js'
            ];

            for (const url of cdnUrls) {
                try {
                    await this.loadScript(url);
                    if (typeof window.Transformers !== 'undefined') {
                        console.log('[VectorizedMemoryRetrieval] ✅ CDN备用加载成功:', url);
                        return;
                    }
                } catch (cdnError) {
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ CDN备用加载失败:', url, cdnError.message);
                }
            }

            throw new Error('本地库和CDN备用方案都失败');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 加载Transformers.js库失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 新增：为轻量版库进行预训练
     */
    async pretrainLiteLibrary() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🧠 开始为轻量版库准备预训练数据...');
            
            // 收集现有的记忆数据作为预训练文本
            const trainingTexts = await this.collectTrainingTexts();
            
            if (trainingTexts.length > 0) {
                console.log('[VectorizedMemoryRetrieval] 📚 找到训练文本:', trainingTexts.length, '条');
                
                // 调用轻量版库的预训练方法
                if (this.vectorEngines.transformers && typeof this.vectorEngines.transformers.pretrain === 'function') {
                    await this.vectorEngines.transformers.pretrain(trainingTexts);
                    console.log('[VectorizedMemoryRetrieval] ✅ 轻量版库预训练完成');
                }
            } else {
                console.log('[VectorizedMemoryRetrieval] ℹ️ 暂无训练数据，跳过预训练');
            }
            
        } catch (error) {
            console.warn('[VectorizedMemoryRetrieval] ⚠️ 轻量版库预训练失败:', error.message);
            // 预训练失败不应该阻止系统运行
        }
    }

        /**
         * 🔧 新增：收集预训练文本数据
         */
        async collectTrainingTexts() {
            const trainingTexts = [];
            
            try {
                // 从AI记忆总结器获取历史总结
                if (this.aiMemorySummarizer && this.aiMemorySummarizer.summaryCache) {
                    for (const summary of this.aiMemorySummarizer.summaryCache.values()) {
                        if (summary && summary.content) {
                            trainingTexts.push(summary.content);
                        }
                    }
                }
                
                // 从向量索引获取已有文本
                if (this.vectorIndex && this.vectorIndex.length > 0) {
                    for (const item of this.vectorIndex) {
                        if (item.text) {
                            trainingTexts.push(item.text);
                        }
                    }
                }
                
                // 🔧 新增：从统一数据核心获取面板数据作为训练文本
                if (this.unifiedDataCore) {
                    try {
                        const memoryData = await this.unifiedDataCore.getMemoryData();
                        if (memoryData && typeof memoryData === 'object') {
                            Object.entries(memoryData).forEach(([panelKey, panelData]) => {
                                if (panelData && typeof panelData === 'object') {
                                    Object.values(panelData).forEach(value => {
                                        if (typeof value === 'string' && value.trim().length > 5) {
                                            trainingTexts.push(value.trim());
                                        }
                                    });
                                }
                            });
                        }
                    } catch (dataError) {
                        console.warn('[VectorizedMemoryRetrieval] ⚠️ 获取面板数据失败:', dataError.message);
                    }
                }
                
                // 添加一些基础中英文训练文本
                const baseTexts = [
                    '这是一个关于角色对话的记忆片段',
                    '用户与AI进行了有趣的交流',
                    '重要的剧情发展和角色关系变化',
                    'Character development and story progression',
                    'Important dialogue and character interactions',
                    'Memorable scenes and emotional moments'
                ];
                trainingTexts.push(...baseTexts);
                
                console.log('[VectorizedMemoryRetrieval] 📊 收集到训练文本数量:', trainingTexts.length);
                return trainingTexts;
                
            } catch (error) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 收集训练文本失败:', error.message);
                return [];
            }
        }

        /**
         * 🔧 新增：检查是否支持角色扮演模式
         */
        isRoleplayModeSupported() {
            return typeof window !== 'undefined' && 
                   typeof window.RoleplayCorpus !== 'undefined' && 
                   typeof window.VocabularyWeightCalculator !== 'undefined';
        }

        /**
         * 🔧 新增：角色扮演模式优化
         */
        async optimizeForRoleplay() {
            try {
                console.log('[VectorizedMemoryRetrieval] 🎭 开始角色扮演模式优化...');
                
                // 统计词汇表信息
                if (window.VocabularyWeightCalculator) {
                    const calculator = new window.VocabularyWeightCalculator();
                    const stats = calculator.getStatistics();
                    console.log('[VectorizedMemoryRetrieval] 📊 词汇表统计:', stats);
                }
                
                // 预热角色扮演相关向量化
                const testTexts = [
                    '角色的性格和背景设定',
                    '重要的对话和情感表达',
                    '剧情发展和关系变化',
                    'Character emotions and relationships',
                    'Story development and plot progression'
                ];
                
                for (const text of testTexts) {
                    await this.vectorizeText(text);
                }
                
                console.log('[VectorizedMemoryRetrieval] ✅ 角色扮演模式优化完成');
                
            } catch (error) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 角色扮演优化失败:', error.message);
            }
        }

        /**
         * 🔧 新增：智能检测文本的面板类型
         */
        detectPanelType(text) {
            if (!text || typeof text !== 'string') return null;
            
            const lowerText = text.toLowerCase();
            
            // 面板关键词映射
            const panelKeywords = {
                personal: ['姓名', '年龄', '性格', '外貌', '背景', 'name', 'age', 'personality', 'appearance'],
                world: ['时间', '地点', '天气', '环境', '场景', 'time', 'location', 'weather', 'environment'],
                interaction: ['对话', '交流', '互动', '会面', '交谈', 'dialogue', 'conversation', 'interaction'],
                tasks: ['任务', '目标', '完成', '进度', '计划', 'task', 'goal', 'progress', 'plan'],
                organization: ['组织', '团体', '公司', '学校', '工作', 'organization', 'company', 'work'],
                news: ['新闻', '事件', '消息', '通知', '发生', 'news', 'event', 'happened', 'notice'],
                inventory: ['物品', '道具', '装备', '携带', '拥有', 'item', 'equipment', 'carry', 'possess'],
                abilities: ['能力', '技能', '属性', '等级', '擅长', 'ability', 'skill', 'talent', 'level'],
                plot: ['剧情', '故事', '情节', '发展', '转折', 'plot', 'story', 'development', 'twist'],
                cultivation: ['修炼', '境界', '功法', '提升', '突破', 'cultivation', 'realm', 'breakthrough'],
                fantasy: ['魔法', '奇幻', '法术', '神秘', '魔力', 'magic', 'fantasy', 'spell', 'mystical'],
                modern: ['现代', '科技', '都市', '生活', '手机', 'modern', 'technology', 'urban', 'phone'],
                historical: ['历史', '古代', '传统', '朝代', '古时', 'historical', 'ancient', 'traditional'],
                magic: ['魔法', '法师', '咒语', '魔力', '施法', 'magic', 'wizard', 'spell', 'cast'],
                training: ['训练', '练习', '提升', '学习', '锻炼', 'training', 'practice', 'exercise']
            };
            
            let maxScore = 0;
            let detectedPanel = null;
            
            // 计算每个面板的匹配分数
            for (const [panelType, keywords] of Object.entries(panelKeywords)) {
                let score = 0;
                for (const keyword of keywords) {
                    if (lowerText.includes(keyword.toLowerCase())) {
                        score += 1;
                    }
                }
                
                if (score > maxScore) {
                    maxScore = score;
                    detectedPanel = panelType;
                }
            }
            
            return maxScore >= 1 ? detectedPanel : null;
        }

    /**
     * 🔧 新增：动态加载脚本
     */
    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = (error) => reject(new Error(`加载脚本失败: ${url}`));
            document.head.appendChild(script);
        });
    }

    /**
     * 初始化OpenAI引擎
     */
    async initializeOpenAIEngine() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🌐 初始化OpenAI引擎...');
            
            // 检查是否有OpenAI API密钥
            const apiKey = await this.getOpenAIApiKey();
            if (!apiKey) {
                throw new Error('OpenAI API密钥未配置');
            }
            
            this.vectorEngines.openai = {
                apiKey: apiKey,
                model: 'text-embedding-3-small',
                dimensions: 1536
            };
            
            console.log('[VectorizedMemoryRetrieval] ✅ OpenAI引擎初始化完成');
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ OpenAI引擎初始化失败:', error);
            throw error;
        }
    }

    /**
     * 获取OpenAI API密钥
     */
    async getOpenAIApiKey() {
        try {
            // 从SillyTavern的设置中获取OpenAI API密钥
            const context = SillyTavern?.getContext?.();
            if (context?.openai_setting?.api_key_openai) {
                return context.openai_setting.api_key_openai;
            }
            
            // 从本地存储获取
            const apiKey = localStorage.getItem('openai_api_key');
            return apiKey;
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 获取OpenAI API密钥失败:', error);
            return null;
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔗 绑定事件监听器...');
            
            if (!this.eventSystem) return;
            
            // 🔧 修复：如果未启用，不绑定事件监听器
            if (!this.settings.enabled) {
                console.log('[VectorizedMemoryRetrieval] ⏸️ 向量化检索已禁用，跳过事件监听器绑定');
                return;
            }
            
            // 监听AI总结创建事件
            this.eventSystem.on('ai-summary:created', (data) => {
                this.handleAISummaryCreated(data);
            });
            
            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });
            
            // 监听记忆数据更新事件
            this.eventSystem.on('memory:updated', (data) => {
                this.handleMemoryUpdated(data);
            });
            
            console.log('[VectorizedMemoryRetrieval] ✅ 事件监听器绑定完成');
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 🔧 重构：向量化文本内容（支持多种存储方式）
     */
    async vectorizeText(text) {
        try {
            // 🔧 修复：如果未启用，直接返回null，避免无效调用
            if (!this.settings.enabled) {
                return null;
            }
            
            // 🔧 修复：更严格的输入验证和错误处理
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return null;
            }
            
            console.log('[VectorizedMemoryRetrieval] 🔢 向量化文本，长度:', text.length, '存储方式:', this.settings.vectorStorage);
            
            // 检查缓存
            const cacheKey = this.generateCacheKey(text);
            if (this.vectorCache.has(cacheKey)) {
                this.stats.cacheHits++;
                console.log('[VectorizedMemoryRetrieval] 💾 使用缓存的向量');
                return this.vectorCache.get(cacheKey);
            }
            
            let vector = null;

            // 🔧 重构：根据vectorEngine选择向量化计算方式
            switch (this.settings.vectorEngine) {
                case 'custom':
                    // 使用自定义向量化API
                    console.log('[VectorizedMemoryRetrieval] 🔧 使用自定义向量化API计算向量');
                    vector = await this.vectorizeWithCustomAPI(text);
                    break;
                    
                case 'local':
                    // 使用本地Transformers.js
                    console.log('[VectorizedMemoryRetrieval] 💻 使用本地Transformers.js计算向量');
                    vector = await this.vectorizeWithTransformers(text);
                    break;
                    
                default:
                    // 降级模式
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 未知的向量化引擎，使用降级方案');
                    vector = await this.vectorizeWithFallback(text);
            }
            
            if (vector) {
                // 缓存向量
                this.vectorCache.set(cacheKey, vector);
                this.stats.totalVectorized++;
                
                // 限制缓存大小
                if (this.vectorCache.size > this.settings.maxCacheSize) {
                    const firstKey = this.vectorCache.keys().next().value;
                    this.vectorCache.delete(firstKey);
                }
                
                console.log('[VectorizedMemoryRetrieval] ✅ 文本向量化完成，维度:', vector.length);
            }
            
            return vector;
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 向量化文本失败:', error);
            return null;
        }
    }

    /**
     * 🆕 使用SillyTavern向量API进行向量化
     */
    async vectorizeWithSillyTavernAPI(text) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🌐 使用SillyTavern API向量化文本');

            // 获取向量（SillyTavern会自动处理向量化）
            // 我们只需要调用query API，它会自动生成embedding
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                throw new Error('SillyTavern上下文未找到');
            }

            // 使用SillyTavern的getRequestEmbedding API
            const response = await fetch('/api/embeddings/compute', {
                method: 'POST',
                headers: context.getRequestHeaders?.() || { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text
                })
            });

            if (!response.ok) {
                throw new Error(`SillyTavern向量化失败 (${response.status})`);
            }

            const data = await response.json();
            const vector = data.embedding || data.vector || null;

            if (!vector || !Array.isArray(vector)) {
                throw new Error('SillyTavern返回的向量格式无效');
            }

            console.log('[VectorizedMemoryRetrieval] ✅ SillyTavern API向量化完成，维度:', vector.length);
            return vector;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ SillyTavern API向量化失败:', error);
            
            // 降级到其他方式
            if (this.settings.fallbackMode) {
                console.log('[VectorizedMemoryRetrieval] 🔄 降级到自定义API或本地引擎');
                if (this.customVectorAPI.isConfigValid()) {
                    return await this.vectorizeWithCustomAPI(text);
                } else {
                    return await this.vectorizeWithTransformers(text);
                }
            }
            throw error;
        }
    }

    /**
     * 🆕 使用自定义向量API进行向量化
     */
    async vectorizeWithCustomAPI(text) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔧 使用自定义API向量化文本');

            if (!this.customVectorAPI.isConfigValid()) {
                throw new Error('自定义向量API配置无效');
            }

            const vector = await this.customVectorAPI.vectorizeText(text);

            if (!vector || !Array.isArray(vector)) {
                throw new Error('自定义API返回的向量格式无效');
            }

            console.log('[VectorizedMemoryRetrieval] ✅ 自定义API向量化完成，维度:', vector.length);
            return vector;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 自定义API向量化失败:', error);
            
            // 降级到本地引擎
            if (this.settings.fallbackMode) {
                console.log('[VectorizedMemoryRetrieval] 🔄 降级到本地Transformers.js引擎');
                return await this.vectorizeWithTransformers(text);
            }
            throw error;
        }
    }


    /**
     * 🆕 使用自定义向量API进行向量化
     */
    async vectorizeWithCustomAPI(text) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔧 使用自定义API向量化文本');

            if (!this.customVectorAPI.isConfigValid()) {
                throw new Error('自定义向量API配置无效');
            }

            const vector = await this.customVectorAPI.vectorizeText(text);

            if (!vector || !Array.isArray(vector)) {
                throw new Error('自定义API返回的向量格式无效');
            }

            console.log('[VectorizedMemoryRetrieval] ✅ 自定义API向量化完成，维度:', vector.length);
            return vector;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 自定义API向量化失败:', error);
            
            // 降级到本地引擎
            if (this.settings.fallbackMode) {
                console.log('[VectorizedMemoryRetrieval] 🔄 降级到本地Transformers.js引擎');
                return await this.vectorizeWithTransformers(text);
            }
            throw error;
        }
    }

    /**
     * 使用Transformers.js向量化
     * 🔧 优化：增强引擎状态验证和错误处理
     */
    async vectorizeWithTransformers(text) {
        try {
            // 🔧 新增：完整的引擎状态验证
            const engineStatus = this.validateTransformersEngine();

            if (!engineStatus.available) {
                console.log('[VectorizedMemoryRetrieval] 🔄 Transformers引擎不可用，原因:', engineStatus.reason);
                return await this.vectorizeWithFallback(text);
            }

            // 🔧 修复：检查是否为fallback模式
            if (this.vectorEngines.transformers === 'fallback') {
                console.log('[VectorizedMemoryRetrieval] 🔄 使用fallback模式进行向量化');
                return await this.vectorizeWithFallback(text);
            }

            // 🔧 修复：确保transformers是函数类型，如果不是则静默降级
            if (typeof this.vectorEngines.transformers !== 'function') {
                console.log('[VectorizedMemoryRetrieval] 🔄 Transformers引擎不可用，使用fallback模式');
                // 设置为fallback模式，避免重复检查
                this.vectorEngines.transformers = 'fallback';
                return await this.vectorizeWithFallback(text);
            }
            
            // 🔧 新增：角色扮演优化 - 智能检测面板类型并设置上下文
            if (this.isRoleplayModeSupported() && 
                typeof this.vectorEngines.transformers === 'function' &&
                typeof this.vectorEngines.transformers.setPanelContext === 'function') {
                
                const detectedPanel = this.detectPanelType(text);
                if (detectedPanel) {
                    console.log('[VectorizedMemoryRetrieval] 🎯 检测到面板类型:', detectedPanel);
                    this.vectorEngines.transformers.setPanelContext(detectedPanel);
                }
            }
            
            // 此时transformers已确认为函数类型
            
            // 使用Transformers.js生成嵌入
            const output = await this.vectorEngines.transformers(text, {
                pooling: 'mean',
                normalize: true
            });
            
            // 🔧 修改：处理不同格式的输出
            let vector = null;
            
            if (output && typeof output === 'object') {
                // 标准Transformers.js输出格式
                if (output.data) {
                    vector = Array.from(output.data);
                } 
                // 轻量版库输出格式
                else if (Array.isArray(output)) {
                    vector = output;
                }
                // 其他可能的格式
                else if (output.tensor || output.values) {
                    vector = Array.from(output.tensor || output.values);
                }
            } 
            // 直接数组输出
            else if (Array.isArray(output)) {
                vector = output;
            }
            
            if (!vector || !Array.isArray(vector) || vector.length === 0) {
                throw new Error('向量化输出格式无效');
            }
            
            // 🔧 新增：验证向量维度
            if (vector.length !== this.settings.vectorDimensions) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 向量维度不匹配，期望:', this.settings.vectorDimensions, '实际:', vector.length);
            }
            
            return vector;
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ Transformers.js向量化失败:', error);
            return await this.vectorizeWithFallback(text);
        }
    }

    /**
     * 使用OpenAI向量化
     */
    async vectorizeWithOpenAI(text) {
        try {
            if (!this.vectorEngines.openai) {
                throw new Error('OpenAI引擎未初始化');
            }
            
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.vectorEngines.openai.apiKey}`
                },
                body: JSON.stringify({
                    input: text,
                    model: this.vectorEngines.openai.model,
                    dimensions: this.settings.vectorDimensions
                })
            });
            
            if (!response.ok) {
                throw new Error(`OpenAI API错误: ${response.status}`);
            }
            
            const data = await response.json();
            const vector = data.data[0].embedding;
            
            return vector;
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ OpenAI向量化失败:', error);
            return await this.vectorizeWithFallback(text);
        }
    }

    /**
     * 🔧 新增：验证Transformers引擎状态
     */
    validateTransformersEngine() {
        const result = {
            available: false,
            reason: '',
            engineType: null
        };

        try {
            if (!this.vectorEngines.transformers) {
                result.reason = '引擎未初始化';
                return result;
            }

            if (this.vectorEngines.transformers === 'fallback') {
                result.reason = '已设置为fallback模式';
                return result;
            }

            if (typeof this.vectorEngines.transformers !== 'function') {
                result.reason = '引擎类型错误，期望function类型';
                return result;
            }

            // 🔧 新增：检查引擎健康状态
            if (this.vectorEngines.transformers.isHealthy &&
                !this.vectorEngines.transformers.isHealthy()) {
                result.reason = '引擎健康检查失败';
                return result;
            }

            result.available = true;
            result.engineType = 'transformers';
            return result;

        } catch (error) {
            result.reason = `验证过程异常: ${error.message}`;
            return result;
        }
    }

    /**
     * 降级向量化方法（基于文本特征）
     * 🔧 优化：增强TF-IDF算法和语义特征提取
     * 🚀 紧急修复：使用多哈希位置提升向量质量
     * 🎯 最终修复：添加字符级n-gram特征解决中文分词问题
     */
    async vectorizeWithFallback(text) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔄 使用降级向量化方法（字符级n-gram）');

            // 清理文本
            const cleanText = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '');

            if (cleanText.length === 0) {
                return new Array(this.settings.vectorDimensions).fill(0);
            }

            const vector = new Array(this.settings.vectorDimensions).fill(0);
            const features = new Map(); // 存储所有特征及其频率

            // 🎯 方法1：词级特征（适用于英文和有空格的文本）
            const words = cleanText.split(/\s+/).filter(w => w.length > 1);
            words.forEach(word => {
                features.set(`word:${word}`, (features.get(`word:${word}`) || 0) + 1);
            });

            // 🎯 方法2：字符级2-gram特征（适用于中文）
            for (let i = 0; i < cleanText.length - 1; i++) {
                const bigram = cleanText.substring(i, i + 2);
                if (bigram.trim().length === 2) { // 跳过包含空格的bigram
                    features.set(`2gram:${bigram}`, (features.get(`2gram:${bigram}`) || 0) + 1);
                }
            }

            // 🎯 方法3：字符级3-gram特征（增强语义理解）
            for (let i = 0; i < cleanText.length - 2; i++) {
                const trigram = cleanText.substring(i, i + 3);
                if (trigram.trim().length === 3) { // 跳过包含空格的trigram
                    features.set(`3gram:${trigram}`, (features.get(`3gram:${trigram}`) || 0) + 1);
                }
            }

            // 🎯 方法4：单字符特征（作为补充）
            for (let i = 0; i < cleanText.length; i++) {
                const char = cleanText[i];
                if (char.trim().length > 0) { // 跳过空格
                    features.set(`char:${char}`, (features.get(`char:${char}`) || 0) + 1);
                }
            }

            // 计算总特征数
            const totalFeatures = Array.from(features.values()).reduce((sum, freq) => sum + freq, 0);

            // 🚀 向量化所有特征
            let featureIndex = 0;
            for (const [feature, freq] of features) {
                // TF权重
                const tfWeight = freq / totalFeatures;

                // 位置权重（早期特征更重要）
                const positionWeight = 1 / Math.log(featureIndex + 2);

                // 特征类型权重
                let typeWeight = 1.0;
                if (feature.startsWith('word:')) typeWeight = 1.5; // 词级特征最重要
                else if (feature.startsWith('3gram:')) typeWeight = 1.3; // 3-gram次之
                else if (feature.startsWith('2gram:')) typeWeight = 1.2; // 2-gram再次
                else if (feature.startsWith('char:')) typeWeight = 0.8; // 单字符权重较低

                // 使用5个哈希位置（减少以平衡性能）
                for (let hashSeed = 0; hashSeed < 5; hashSeed++) {
                    const hash = this.improvedHash(feature, hashSeed);
                    const pos = hash % this.settings.vectorDimensions;

                    // 累加权重到向量
                    vector[pos] += positionWeight * tfWeight * typeWeight;
                }

                featureIndex++;
            }

            // 归一化
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < vector.length; i++) {
                    vector[i] /= magnitude;
                }
            } else {
                // 如果向量全为0，返回均匀分布的向量
                const uniformValue = 1 / Math.sqrt(this.settings.vectorDimensions);
                for (let i = 0; i < this.settings.vectorDimensions; i++) {
                    vector[i] = uniformValue;
                }
            }

            console.log(`[VectorizedMemoryRetrieval] ✅ 提取了 ${features.size} 个特征`);
            return vector;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 降级向量化失败:', error);
            return null;
        }
    }

    /**
     * 🚀 新增：改进的哈希函数（支持多种子）
     */
    improvedHash(str, seed = 0) {
        let hash = seed * 0x9e3779b9; // 使用黄金比例常数

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
            hash = hash ^ (hash >>> 16); // 混合高位和低位
        }

        return Math.abs(hash);
    }

    /**
     * 🔧 新增：计算词的语义权重
     */
    calculateSemanticWeight(word) {
        let weight = 1.0;

        // 长词权重更高
        if (word.length > 6) weight *= 1.3;
        else if (word.length > 4) weight *= 1.1;

        // 包含数字或特殊字符的词权重更高（可能是专有名词）
        if (/[0-9]/.test(word)) weight *= 1.2;
        if (/[A-Z]/.test(word)) weight *= 1.15;

        // 常见停用词权重降低
        const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but'];
        if (stopWords.includes(word.toLowerCase())) weight *= 0.5;

        return weight;
    }

    /**
     * 简单哈希函数
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    /**
     * 生成缓存键
     */
    generateCacheKey(text) {
        // 使用文本的哈希作为缓存键
        return `vector_${this.simpleHash(text)}_${text.length}`;
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[VectorizedMemoryRetrieval] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('vectorized-memory-retrieval:error', {
                error: error,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 语义搜索记忆
     * 注意：此模块的向量化检索功能已合并到AI自动检索中，由UnifiedVectorRetrieval统一管理
     */
    async semanticSearch(query, options = {}) {
        try {
            const startTime = Date.now();
            console.log('[VectorizedMemoryRetrieval] 🔍 开始语义搜索:', query);

            const {
                maxResults = this.settings.maxResults,
                similarityThreshold = this.settings.similarityThreshold,
                includeMetadata = true,
                filterByType = null,
                filterByTimeRange = null,
                topK = maxResults  // 🆕 支持topK参数
            } = options;

            // 🔧 修复：检查是否启用
            // 注意：向量化检索已合并到AI自动检索中，此处的enabled状态仅用于独立调用
            if (!this.settings.enabled) {
                console.log('[VectorizedMemoryRetrieval] ℹ️ 独立向量化检索未启用（已由AI自动检索统一管理），使用基础搜索');
                return await this.basicSearch(query, options);
            }

            // 🔧 修复：向量化查询文本
            const queryVector = await this.vectorizeText(query);
            if (!queryVector) {
                console.log('[VectorizedMemoryRetrieval] ⚠️ 查询向量化失败，降级到基础搜索');
                if (this.settings.enableBasicSearch) {
                    return await this.basicSearch(query, options);
                }
                throw new Error('查询向量化失败');
            }

            // 🔧 修复：查询多个collection（memory + 总结向量化）
            console.log('[VectorizedMemoryRetrieval] 🌐 使用SillyTavern向量API查询存储的向量');
            const allResults = [];

            // 1️⃣ 查询memory collection
            try {
                const memoryResults = await this.vectorAPI.queryVectors(query, queryVector, 'memory', topK, similarityThreshold);
                console.log(`[VectorizedMemoryRetrieval] 📚 Memory检索: ${memoryResults.length} 条`);
                allResults.push(...memoryResults.map(r => ({ ...r, collectionType: 'memory' })));
            } catch (error) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ Memory检索失败:', error.message);
            }

            // 2️⃣ 查询总结向量化collections
            try {
                const vectorizedSummaryManager = window.SillyTavernInfobar?.modules?.vectorizedSummaryManager;
                const summaryManager = window.SillyTavernInfobar?.modules?.summaryManager;

                if (vectorizedSummaryManager) {
                    const vectorizedRecords = vectorizedSummaryManager.vectorizedRecords || [];
                    console.log(`[VectorizedMemoryRetrieval] 📊 找到 ${vectorizedRecords.length} 个总结向量化记录`);

                    // 查询每个总结向量化collection
                    for (const record of vectorizedRecords) {
                        try {
                            const summaryResults = await this.querySummaryCollection(record.collectionId, query, queryVector, topK, similarityThreshold);
                            console.log(`[VectorizedMemoryRetrieval] 📝 总结检索 (${record.collectionId}): ${summaryResults.length} 条`);
                            allResults.push(...summaryResults.map(r => ({ ...r, collectionType: 'summary', collectionId: record.collectionId })));
                        } catch (error) {
                            console.warn(`[VectorizedMemoryRetrieval] ⚠️ 总结检索失败 (${record.collectionId}):`, error.message);
                        }
                    }
                }

                // 3️⃣ 查询传统总结向量化collections
                if (summaryManager) {
                    const traditionalVectorizedRecords = summaryManager.vectorizedRecords || [];
                    console.log(`[VectorizedMemoryRetrieval] 📊 找到 ${traditionalVectorizedRecords.length} 个传统总结向量化记录`);

                    for (const record of traditionalVectorizedRecords) {
                        try {
                            const summaryResults = await this.querySummaryCollection(record.collectionId, query, queryVector, topK, similarityThreshold);
                            console.log(`[VectorizedMemoryRetrieval] 📝 传统总结检索 (${record.collectionId}): ${summaryResults.length} 条`);
                            allResults.push(...summaryResults.map(r => ({ ...r, collectionType: 'traditional_summary', collectionId: record.collectionId })));
                        } catch (error) {
                            console.warn(`[VectorizedMemoryRetrieval] ⚠️ 传统总结检索失败 (${record.collectionId}):`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 总结检索失败:', error.message);
            }

            // 4️⃣ 合并结果并按相似度排序
            const sortedResults = allResults
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, topK);

            const searchTime = Date.now() - startTime;
            console.log(`[VectorizedMemoryRetrieval] ✅ 语义搜索完成，找到 ${sortedResults.length} 个结果（总共查询 ${allResults.length} 条），耗时 ${searchTime}ms`);

            // 🔧 修复：更新统计
            this.stats.searchCount++;
            this.stats.avgSearchTime = (this.stats.avgSearchTime * (this.stats.searchCount - 1) + searchTime) / this.stats.searchCount;

            // 触发搜索完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-memory-retrieval:search-completed', {
                    query: query,
                    resultCount: sortedResults.length,
                    searchTime: searchTime,
                    timestamp: Date.now()
                });
            }

            return {
                query: query,
                results: sortedResults,
                totalResults: sortedResults.length,
                searchTime: searchTime,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 语义搜索失败:', error);
            this.handleError(error);
            return {
                query: query,
                results: [],
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 🆕 查询总结向量化collection
     */
    async querySummaryCollection(collectionId, query, queryVector, topK, threshold) {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                throw new Error('SillyTavern context未找到');
            }

            const response = await fetch('/api/vector/query', {
                method: 'POST',
                headers: context.getRequestHeaders(),
                body: JSON.stringify({
                    collectionId: collectionId,
                    searchText: query,
                    topK: topK,
                    threshold: threshold,
                    source: 'webllm',  // 总结向量化使用webllm作为source
                    embeddings: { [query]: queryVector }
                })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // 集合不存在，返回空结果
                    return [];
                }
                const errorText = await response.text();
                throw new Error(`向量查询失败 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            return data.results || data.metadata || data || [];

        } catch (error) {
            console.error(`[VectorizedMemoryRetrieval] ❌ 查询collection失败 (${collectionId}):`, error);
            return [];
        }
    }

    /**
     * 🚀 新增：使用原生向量API进行语义搜索
     */
    async semanticSearchWithNativeAPI(query, queryVector, options = {}) {
        try {
            const startTime = Date.now();
            console.log('[VectorizedMemoryRetrieval] 🚀 使用原生向量API进行搜索');

            const {
                maxResults = this.settings.maxResults,
                similarityThreshold = this.settings.similarityThreshold,
                includeMetadata = true
            } = options;

            // 使用原生API查询
            const results = await this.vectorAPI.queryVectors(query, queryVector, {
                knowledgeBaseId: 'default',
                topK: maxResults,
                threshold: similarityThreshold
            });

            // 转换结果格式
            const formattedResults = results.map(result => ({
                id: result.metadata?.id || result.hash,
                content: result.text,
                similarity: result.score || 0,
                type: result.metadata?.type || 'unknown',
                timestamp: result.metadata?.timestamp || Date.now(),
                metadata: includeMetadata ? result.metadata : undefined
            }));

            // 更新统计
            const searchTime = Date.now() - startTime;
            this.stats.searchCount++;
            this.stats.avgSearchTime = (this.stats.avgSearchTime * (this.stats.searchCount - 1) + searchTime) / this.stats.searchCount;

            console.log(`[VectorizedMemoryRetrieval] ✅ 原生API搜索完成，找到 ${formattedResults.length} 个结果，耗时 ${searchTime}ms`);

            // 触发搜索完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-memory-retrieval:search-completed', {
                    query: query,
                    resultCount: formattedResults.length,
                    searchTime: searchTime,
                    timestamp: Date.now()
                });
            }

            return {
                query: query,
                results: formattedResults,
                totalResults: formattedResults.length,
                searchTime: searchTime,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 原生API搜索失败:', error);
            throw error;
        }
    }

    /**
     * 计算余弦相似度
     */
    calculateCosineSimilarity(vectorA, vectorB) {
        try {
            if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
                return 0;
            }

            let dotProduct = 0;
            let magnitudeA = 0;
            let magnitudeB = 0;

            for (let i = 0; i < vectorA.length; i++) {
                dotProduct += vectorA[i] * vectorB[i];
                magnitudeA += vectorA[i] * vectorA[i];
                magnitudeB += vectorB[i] * vectorB[i];
            }

            magnitudeA = Math.sqrt(magnitudeA);
            magnitudeB = Math.sqrt(magnitudeB);

            if (magnitudeA === 0 || magnitudeB === 0) {
                return 0;
            }

            return dotProduct / (magnitudeA * magnitudeB);

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 计算余弦相似度失败:', error);
            return 0;
        }
    }

    /**
     * 检查时间范围
     */
    isInTimeRange(timestamp, timeRange) {
        try {
            const { start, end } = timeRange;
            return timestamp >= start && timestamp <= end;
        } catch (error) {
            return true;
        }
    }

    /**
     * 构建记忆索引
     */
    async buildMemoryIndex() {
        try {
            if (this.isIndexing) {
                console.log('[VectorizedMemoryRetrieval] ⏳ 索引构建正在进行中...');
                return;
            }

            this.isIndexing = true;
            console.log('[VectorizedMemoryRetrieval] 🏗️ 开始构建记忆索引...');

            // 清空现有索引
            this.vectorIndex = [];
            this.memoryIndex.clear();

            // 🔧 修复：从DeepMemoryManager获取记忆
            const deepMemories = await this.getDeepMemories();
            console.log(`[VectorizedMemoryRetrieval] 📚 从DeepMemoryManager获取到 ${deepMemories.length} 条记忆`);

            // 获取AI总结历史
            const aiSummaries = await this.getAISummaryHistory();

            // 获取传统总结历史
            const traditionalSummaries = await this.getTraditionalSummaryHistory();

            // 获取聊天历史
            const chatHistory = await this.getChatHistory();

            // 🔧 修复：优先索引DeepMemoryManager的记忆
            await this.indexMemories(deepMemories, 'deep_memory');

            // 索引AI总结
            await this.indexMemories(aiSummaries, 'ai_summary');

            // 索引传统总结
            await this.indexMemories(traditionalSummaries, 'traditional_summary');

            // 索引重要聊天消息
            await this.indexImportantMessages(chatHistory);

            this.stats.lastIndexTime = Date.now();
            this.isIndexing = false;

            console.log(`[VectorizedMemoryRetrieval] ✅ 记忆索引构建完成，共索引 ${this.vectorIndex.length} 个条目`);

            // 保存索引到本地存储
            if (this.settings.useLocalStorage) {
                await this.saveIndexToStorage();
            }

            // 触发索引完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-memory-retrieval:index-built', {
                    indexSize: this.vectorIndex.length,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 构建记忆索引失败:', error);
            this.isIndexing = false;
            this.handleError(error);
        }
    }

    /**
     * 🔧 新增：从DeepMemoryManager获取记忆
     */
    async getDeepMemories() {
        try {
            const memories = [];

            // 尝试从全局获取DeepMemoryManager
            const deepMemoryManager = window.SillyTavernInfobar?.modules?.deepMemoryManager;

            if (!deepMemoryManager) {
                console.log('[VectorizedMemoryRetrieval] ⚠️ DeepMemoryManager未找到');
                return memories;
            }

            // 从所有记忆层获取记忆
            const layers = ['sensory', 'shortTerm', 'longTerm', 'deepArchive'];

            for (const layerName of layers) {
                const layer = deepMemoryManager.memoryLayers[layerName];
                if (layer && layer.size > 0) {
                    for (const [id, memory] of layer) {
                        memories.push({
                            id: memory.id,
                            content: memory.content,
                            type: memory.type,
                            timestamp: memory.timestamp,
                            importance: memory.importance,
                            layer: layerName,
                            metadata: memory.metadata
                        });
                    }
                }
            }

            console.log(`[VectorizedMemoryRetrieval] ✅ 从DeepMemoryManager获取了 ${memories.length} 条记忆`);
            return memories;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 获取DeepMemories失败:', error);
            return [];
        }
    }

    /**
     * 索引记忆数据
     */
    async indexMemories(memories, type) {
        try {
            console.log(`[VectorizedMemoryRetrieval] 📚 索引 ${type} 记忆，数量: ${memories.length}`);

            for (const memory of memories) {
                try {
                    const content = memory.content || memory.summary || '';
                    if (!content) continue;

                    // 向量化内容
                    const vector = await this.vectorizeText(content);
                    if (!vector) continue;

                    // 创建索引条目
                    const indexEntry = {
                        id: memory.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        content: content,
                        vector: vector,
                        type: type,
                        timestamp: memory.timestamp || Date.now(),
                        metadata: {
                            classification: memory.classification,
                            tags: memory.tags,
                            messageRange: memory.messageRange,
                            relatedSummaryId: memory.relatedSummaryId,
                            chatId: memory.chatId
                        }
                    };

                    // 添加到索引
                    this.vectorIndex.push(indexEntry);
                    this.memoryIndex.set(indexEntry.id, indexEntry);

                } catch (error) {
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 索引单个记忆失败:', error);
                }
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 索引记忆数据失败:', error);
        }
    }

    /**
     * 获取AI总结历史
     */
    async getAISummaryHistory() {
        try {
            if (!this.unifiedDataCore) return [];

            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) return [];

            const chatData = await this.unifiedDataCore.getChatData(currentChatId);
            return chatData?.ai_summary_history || [];

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 获取AI总结历史失败:', error);
            return [];
        }
    }

    /**
     * 获取传统总结历史
     */
    async getTraditionalSummaryHistory() {
        try {
            if (!this.unifiedDataCore) return [];

            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) return [];

            const chatData = await this.unifiedDataCore.getChatData(currentChatId);
            return chatData?.summary_history || [];

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 获取传统总结历史失败:', error);
            return [];
        }
    }

    /**
     * 获取聊天历史
     */
    async getChatHistory() {
        try {
            if (!this.unifiedDataCore) return [];

            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) return [];

            const chatHistory = await this.unifiedDataCore.getChatHistory(currentChatId);
            return chatHistory || [];

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 获取聊天历史失败:', error);
            return [];
        }
    }

    /**
     * 索引重要聊天消息
     */
    async indexImportantMessages(chatHistory) {
        try {
            console.log(`[VectorizedMemoryRetrieval] 💬 索引重要聊天消息，总数: ${chatHistory.length}`);

            // 只索引重要的消息（长度超过阈值或包含关键词）
            const importantMessages = chatHistory.filter(msg => {
                const content = msg.mes || '';
                return content.length > 100 || this.containsImportantKeywords(content);
            });

            console.log(`[VectorizedMemoryRetrieval] 📝 筛选出重要消息: ${importantMessages.length}`);

            for (const message of importantMessages) {
                try {
                    const content = message.mes || '';
                    if (!content) continue;

                    // 清理HTML标签
                    const cleanContent = content.replace(/<[^>]*>/g, '').trim();
                    if (cleanContent.length < 20) continue;

                    // 向量化内容
                    const vector = await this.vectorizeText(cleanContent);
                    if (!vector) continue;

                    // 创建索引条目
                    const indexEntry = {
                        id: `message_${message.send_date || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        content: cleanContent,
                        vector: vector,
                        type: 'chat_message',
                        timestamp: message.send_date || Date.now(),
                        metadata: {
                            speaker: message.is_user ? 'user' : (message.name || 'assistant'),
                            isUser: message.is_user,
                            messageId: message.id,
                            swipeId: message.swipe_id
                        }
                    };

                    // 添加到索引
                    this.vectorIndex.push(indexEntry);
                    this.memoryIndex.set(indexEntry.id, indexEntry);

                } catch (error) {
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 索引单个消息失败:', error);
                }
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 索引重要聊天消息失败:', error);
        }
    }

    /**
     * 检查是否包含重要关键词
     */
    containsImportantKeywords(content) {
        const importantKeywords = [
            '重要', '关键', '决定', '计划', '目标', '问题', '解决',
            '发现', '结论', '总结', '建议', '想法', '创意', '灵感',
            'important', 'key', 'decision', 'plan', 'goal', 'problem', 'solution',
            'discovery', 'conclusion', 'summary', 'suggestion', 'idea', 'creative'
        ];

        const lowerContent = content.toLowerCase();
        return importantKeywords.some(keyword => lowerContent.includes(keyword));
    }

    /**
     * 🔧 重构：处理AI总结创建事件（支持多种存储方式）
     */
    async handleAISummaryCreated(data) {
        try {
            // 🔧 修复：双重检查 - enabled 和 autoVectorize 都必须开启
            if (!this.settings.enabled || !this.settings.autoVectorize) {
                return;
            }
            
            console.log('[VectorizedMemoryRetrieval] 🧠 处理AI总结创建事件，存储方式:', this.settings.vectorStorage);

            const summary = data.summary;
            if (!summary || !summary.content) return;

            // 向量化新总结
            const vector = await this.vectorizeText(summary.content);
            if (!vector) return;

            // 创建索引条目
            const indexEntry = {
                id: summary.id || `ai_summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: summary.content,
                vector: vector,
                type: 'ai_summary',
                timestamp: summary.timestamp || Date.now(),
                importance: summary.importance || 0.8,
                category: summary.category || '角色互动',
                tags: summary.tags || [],
                metadata: {
                    classification: summary.classification,
                    messageCount: summary.messageCount,
                    floorNumber: data.floorNumber || 0
                }
            };

            // 🔧 修复：存储到SillyTavern向量API（唯一的存储方式）
            await this.storeToSillyTavernAPI([indexEntry]);

            console.log('[VectorizedMemoryRetrieval] ✅ AI总结已自动索引并存储到SillyTavern向量API');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 处理AI总结创建事件失败:', error);
        }
    }

    /**
     * 🆕 存储记忆到SillyTavern向量API（唯一的存储方式）
     */
    async storeToSillyTavernAPI(memories) {
        try {
            console.log(`[VectorizedMemoryRetrieval] 🌐 存储 ${memories.length} 个记忆到SillyTavern向量API`);

            if (!this.vectorAPI) {
                throw new Error('VectorAPIAdapter未初始化');
            }

            // 准备向量数据
            const vectorData = memories.map(memory => ({
                content: memory.content,
                vector: memory.vector,
                type: memory.type,
                importance: memory.importance,
                timestamp: memory.timestamp,
                category: memory.category,
                tags: memory.tags,
                metadata: memory.metadata || {}
            }));

            // 插入到SillyTavern向量API（文件存储）
            const result = await this.vectorAPI.insertVectors(vectorData, 'memory');

            console.log('[VectorizedMemoryRetrieval] ✅ 成功存储到SillyTavern向量API:', result);
            return result;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 存储到SillyTavern向量API失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            // 🔧 修复：如果未启用，不处理聊天切换
            if (!this.settings.enabled) {
                return;
            }
            
            console.log('[VectorizedMemoryRetrieval] 🔄 处理聊天切换事件');

            // 清空当前索引
            this.vectorIndex = [];
            this.memoryIndex.clear();

            // 重新构建索引
            await this.buildMemoryIndex();

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 修复：处理记忆更新事件（增量索引）
     */
    async handleMemoryUpdated(data) {
        try {
            // 🔧 修复：双重检查 - enabled 和 autoVectorize 都必须开启
            if (!this.settings.enabled || !this.settings.autoVectorize) {
                return;
            }
            
            console.log('[VectorizedMemoryRetrieval] 📝 处理记忆更新事件:', data.action);

            // 如果是添加操作，进行增量索引
            if (data.action === 'add' && data.memory) {
                const memory = data.memory;

                // 检查是否已经索引
                if (this.memoryIndex.has(memory.id)) {
                    console.log('[VectorizedMemoryRetrieval] ⚠️ 记忆已索引，跳过');
                    return;
                }

                // 向量化内容
                const content = memory.content || '';
                if (!content) return;

                const vector = await this.vectorizeText(content);
                if (!vector) return;

                // 创建索引条目
                const indexEntry = {
                    id: memory.id,
                    content: content,
                    vector: vector,
                    type: 'deep_memory',
                    timestamp: memory.timestamp || Date.now(),
                    metadata: {
                        layer: data.layer,
                        importance: memory.importance,
                        source: memory.source,
                        memoryType: memory.type
                    }
                };

                // 添加到索引
                this.vectorIndex.push(indexEntry);
                this.memoryIndex.set(indexEntry.id, indexEntry);

                console.log(`[VectorizedMemoryRetrieval] ✅ 增量索引完成: ${memory.id}`);
                console.log(`[VectorizedMemoryRetrieval] 📊 当前索引大小: ${this.vectorIndex.length}`);

                // 保存索引
                if (this.settings.useLocalStorage) {
                    await this.saveIndexToStorage();
                }
            } else {
                // 其他操作（删除、更新等）需要重建索引
                console.log('[VectorizedMemoryRetrieval] 🔄 重建索引...');
                await this.buildMemoryIndex();
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 处理记忆更新事件失败:', error);
        }
    }

    /**
     * 加载向量缓存
     */
    async loadVectorCache() {
        try {
            if (!this.settings.useLocalStorage || !this.unifiedDataCore) return;

            console.log('[VectorizedMemoryRetrieval] 📥 加载向量缓存...');

            const cacheData = await this.unifiedDataCore.getData('vector_cache');
            if (cacheData) {
                this.vectorCache = new Map(Object.entries(cacheData));
                console.log(`[VectorizedMemoryRetrieval] ✅ 向量缓存加载完成，缓存条目: ${this.vectorCache.size}`);
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 加载向量缓存失败:', error);
        }
    }

    /**
     * 保存索引到存储
     */
    async saveIndexToStorage() {
        try {
            // 🚀 新方案：使用原生向量API
            if (this.settings.useNativeVectorAPI) {
                return await this.saveIndexToNativeAPI();
            }

            // 旧方案：使用本地存储
            if (!this.settings.useLocalStorage || !this.unifiedDataCore) return;

            console.log('[VectorizedMemoryRetrieval] 💾 保存索引到存储（旧方案）...');

            // 🚀 新增：检查并清理超大数据
            await this.checkAndCleanOversizedData();

            // 保存向量缓存
            const cacheObject = Object.fromEntries(this.vectorCache);
            await this.unifiedDataCore.setData('vector_cache', cacheObject);

            // 保存索引元数据（不包含向量数据，太大）
            const indexMetadata = this.vectorIndex.map(entry => ({
                id: entry.id,
                type: entry.type,
                timestamp: entry.timestamp,
                contentLength: entry.content.length,
                metadata: entry.metadata
            }));

            await this.unifiedDataCore.setData('vector_index_metadata', indexMetadata);

            console.log('[VectorizedMemoryRetrieval] ✅ 索引保存完成（旧方案）');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 保存索引失败:', error);
        }
    }

    /**
     * 🚀 新增：检查并清理超大向量数据
     */
    async checkAndCleanOversizedData() {
        try {
            // 如果没有设置大小限制，跳过
            if (!this.settings.storageSizeLimit || this.settings.storageSizeLimit <= 0) {
                return;
            }

            // 计算当前数据大小（估算）
            const cacheSize = JSON.stringify(Object.fromEntries(this.vectorCache)).length;
            const indexSize = JSON.stringify(this.vectorIndex).length;
            const totalSize = cacheSize + indexSize;
            const totalSizeMB = totalSize / (1024 * 1024);

            console.log(`[VectorizedMemoryRetrieval] 📊 当前向量数据大小: ${totalSizeMB.toFixed(2)} MB`);

            // 如果超过限制，删除最旧的数据
            if (totalSizeMB > this.settings.storageSizeLimit) {
                console.log(`[VectorizedMemoryRetrieval] ⚠️ 向量数据超过限制 (${this.settings.storageSizeLimit} MB)，开始清理...`);

                // 按时间戳排序，删除最旧的数据
                this.vectorIndex.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                // 计算需要删除的数量（删除20%的旧数据）
                const deleteCount = Math.ceil(this.vectorIndex.length * 0.2);
                const deletedEntries = this.vectorIndex.splice(0, deleteCount);

                // 从缓存中删除对应的向量
                deletedEntries.forEach(entry => {
                    const cacheKey = `${entry.type}_${entry.id}`;
                    this.vectorCache.delete(cacheKey);
                });

                console.log(`[VectorizedMemoryRetrieval] ✅ 已清理 ${deleteCount} 条旧数据`);

                // 重新计算大小
                const newCacheSize = JSON.stringify(Object.fromEntries(this.vectorCache)).length;
                const newIndexSize = JSON.stringify(this.vectorIndex).length;
                const newTotalSize = newCacheSize + newIndexSize;
                const newTotalSizeMB = newTotalSize / (1024 * 1024);

                console.log(`[VectorizedMemoryRetrieval] 📊 清理后数据大小: ${newTotalSizeMB.toFixed(2)} MB`);
            }

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 检查并清理超大数据失败:', error);
        }
    }

    /**
     * 🚀 新增：保存索引到原生向量API
     */
    async saveIndexToNativeAPI() {
        try {
            console.log('[VectorizedMemoryRetrieval] 💾 使用原生向量API保存索引...');

            if (this.vectorIndex.length === 0) {
                console.log('[VectorizedMemoryRetrieval] ℹ️ 没有需要保存的向量');
                return;
            }

            // 准备向量数据
            const vectors = this.vectorIndex.map(entry => ({
                content: entry.content,
                vector: entry.vector,
                metadata: {
                    id: entry.id,
                    type: entry.type,
                    timestamp: entry.timestamp,
                    ...entry.metadata
                }
            }));

            // 批量插入
            const batchSize = this.settings.batchSize || 50;
            let totalInserted = 0;
            let hasError = false;

            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize);
                try {
                    const result = await this.vectorAPI.insertVectors(batch, 'default');
                    if (result.success) {
                        totalInserted += result.count;
                    }
                } catch (batchError) {
                    console.error(`[VectorizedMemoryRetrieval] ❌ 批次 ${i}-${i+batchSize} 插入失败:`, batchError);
                    hasError = true;
                    // 继续处理下一批
                }
            }

            if (hasError) {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ 部分向量插入失败，建议检查SillyTavern向量扩展配置');
            }

            console.log(`[VectorizedMemoryRetrieval] ✅ 索引保存完成，共插入 ${totalInserted}/${vectors.length} 个向量`);

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 保存索引到原生API失败:', error);
            console.warn('[VectorizedMemoryRetrieval] ⚠️ 原生向量API不可用，请检查：');
            console.warn('  1. SillyTavern是否安装了向量扩展');
            console.warn('  2. 向量扩展是否正确配置');
            console.warn('  3. 可以在设置中禁用useNativeVectorAPI，使用旧存储方案');

            // 自动降级到旧方案
            if (this.settings.fallbackMode) {
                console.log('[VectorizedMemoryRetrieval] 🔄 自动降级到旧存储方案');
                this.settings.useNativeVectorAPI = false;
                await this.saveIndexToStorage(); // 递归调用，会使用旧方案
            }
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            settings: this.settings,
            vectorEngine: this.settings.vectorEngine,
            cacheSize: this.vectorCache.size,
            indexSize: this.vectorIndex.length,
            stats: this.stats,
            isIndexing: this.isIndexing,
            errorCount: this.errorCount
        };
    }

    /**
     * 🔧 新增：基础搜索方法（fallback）
     */
    async basicSearch(query, options = {}) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔍 使用基础搜索模式:', query);

            const {
                maxResults = this.settings.maxResults,
                includeMetadata = true
            } = options;

            const results = [];
            const queryLower = query.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);

            // 🔧 调试：检查deepMemoryManager状态
            console.log('[VectorizedMemoryRetrieval] 🔍 deepMemoryManager状态:', {
                exists: !!this.deepMemoryManager,
                initialized: this.deepMemoryManager?.initialized,
                layersExist: !!this.deepMemoryManager?.memoryLayers
            });

            // 搜索深度记忆管理器中的记忆
            if (this.deepMemoryManager) {
                const memoryLayers = this.deepMemoryManager.memoryLayers;
                
                // 🔧 调试：检查各层记忆数量
                if (memoryLayers) {
                    console.log('[VectorizedMemoryRetrieval] 📊 记忆层数据统计:', {
                        sensory: memoryLayers.sensory?.size || 0,
                        shortTerm: memoryLayers.shortTerm?.size || 0,
                        longTerm: memoryLayers.longTerm?.size || 0,
                        deepArchive: memoryLayers.deepArchive?.size || 0
                    });
                }

                // 搜索各个记忆层
                for (const [layerName, layer] of Object.entries(memoryLayers)) {
                    if (layer && layer.size > 0) {
                        for (const [id, memory] of layer) {
                            const content = memory.content || '';
                            const relevance = this.calculateBasicRelevance(content, queryWords);

                            if (relevance > 0.3) {
                                results.push({
                                    id: id,
                                    content: content,
                                    similarity: relevance,
                                    layer: layerName,
                                    importance: memory.importance || 0,
                                    timestamp: memory.timestamp || Date.now(),
                                    metadata: includeMetadata ? memory.metadata : null
                                });
                            }
                        }
                    }
                }
            }

            // 搜索AI记忆总结
            if (this.aiMemorySummarizer && this.aiMemorySummarizer.memorySummaries) {
                for (const summary of this.aiMemorySummarizer.memorySummaries) {
                    const content = summary.content || '';
                    const relevance = this.calculateBasicRelevance(content, queryWords);

                    if (relevance > 0.3) {
                        results.push({
                            id: summary.id || 'summary_' + Date.now(),
                            content: content,
                            similarity: relevance,
                            layer: 'ai_summary',
                            importance: 0.8,
                            timestamp: summary.timestamp || Date.now(),
                            metadata: includeMetadata ? summary : null
                        });
                    }
                }
            }

            // 按相似度排序并限制结果数量
            const sortedResults = results
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, maxResults);

            console.log(`[VectorizedMemoryRetrieval] ✅ 基础搜索完成，找到 ${sortedResults.length} 个结果`);

            return {
                results: sortedResults,
                query: query,
                searchTime: Date.now() - Date.now(),
                method: 'basic_search',
                totalResults: results.length
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 基础搜索失败:', error);
            return {
                results: [],
                query: query,
                searchTime: 0,
                method: 'basic_search',
                error: error.message
            };
        }
    }

    /**
     * 🔧 新增：计算基础相关性
     */
    calculateBasicRelevance(content, queryWords) {
        if (!content || !queryWords.length) return 0;

        const contentLower = content.toLowerCase();
        let score = 0;
        let matches = 0;

        for (const word of queryWords) {
            if (contentLower.includes(word)) {
                matches++;
                // 完整词匹配得分更高
                const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
                const wordMatches = (contentLower.match(wordRegex) || []).length;
                score += wordMatches * 0.3;

                // 部分匹配也有分数
                if (wordMatches === 0 && contentLower.includes(word)) {
                    score += 0.1;
                }
            }
        }

        // 匹配词汇比例
        const matchRatio = matches / queryWords.length;
        score += matchRatio * 0.5;

        // 内容长度权重（较短的内容如果匹配度高，相关性更高）
        const lengthFactor = Math.min(1, 100 / content.length);
        score *= (1 + lengthFactor * 0.2);

        return Math.min(1, score);
    }

    /**
     * 🔧 修复：使用向量索引进行语义搜索
     */
    async searchSimilarMemories(query, maxResults = 5) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔍 搜索相似记忆:', query);

            // 如果索引为空，返回空结果
            if (this.vectorIndex.length === 0) {
                console.log('[VectorizedMemoryRetrieval] ⚠️ 向量索引为空，无法搜索');
                return [];
            }

            // 向量化查询
            const queryVector = await this.vectorizeText(query);
            if (!queryVector) {
                console.log('[VectorizedMemoryRetrieval] ⚠️ 查询向量化失败');
                return [];
            }

            // 计算与所有索引条目的相似度
            const results = [];
            for (const entry of this.vectorIndex) {
                if (!entry.vector) continue;

                const similarity = this.calculateCosineSimilarity(queryVector, entry.vector);

                // 只保留相似度高于阈值的结果
                if (similarity > 0.1) { // 降低阈值以获得更多结果
                    results.push({
                        memory: {
                            id: entry.id,
                            content: entry.content,
                            type: entry.type,
                            timestamp: entry.timestamp,
                            metadata: entry.metadata
                        },
                        similarity: similarity
                    });
                }
            }

            // 按相似度排序并限制结果数量
            const sortedResults = results
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, maxResults);

            console.log(`[VectorizedMemoryRetrieval] ✅ 向量搜索完成，找到 ${sortedResults.length} 个结果`);

            return sortedResults;

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 搜索相似记忆失败:', error);
            return [];
        }
    }

    /**
     * 🚀 新增：数据迁移工具 - 从旧存储迁移到原生向量API
     */
    async migrateToNativeVectorAPI() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔄 开始迁移向量数据到原生API...');

            // 检查是否已经使用原生API
            if (this.settings.useNativeVectorAPI) {
                console.log('[VectorizedMemoryRetrieval] ℹ️ 已经在使用原生向量API');
            }

            // 1. 从旧存储加载数据
            const oldCacheData = await this.unifiedDataCore.getData('vector_cache');
            const oldIndexMetadata = await this.unifiedDataCore.getData('vector_index_metadata');

            if (!oldCacheData && !oldIndexMetadata && this.vectorIndex.length === 0) {
                console.log('[VectorizedMemoryRetrieval] ℹ️ 没有需要迁移的数据');
                return { success: true, migrated: 0, message: '没有需要迁移的数据' };
            }

            // 2. 统计需要迁移的数据量
            const totalVectors = this.vectorIndex.length;
            console.log(`[VectorizedMemoryRetrieval] 📊 发现 ${totalVectors} 个向量需要迁移`);

            if (totalVectors === 0) {
                // 尝试重建索引
                console.log('[VectorizedMemoryRetrieval] 🔄 尝试重建向量索引...');
                await this.buildMemoryIndex();

                if (this.vectorIndex.length === 0) {
                    console.log('[VectorizedMemoryRetrieval] ℹ️ 没有可迁移的向量数据');
                    return { success: true, migrated: 0, message: '没有可迁移的向量数据' };
                }
            }

            // 3. 启用原生API
            this.settings.useNativeVectorAPI = true;
            await this.unifiedDataCore.setData('vectorized_memory_settings', this.settings);

            // 4. 保存到新存储（使用原生API）
            console.log('[VectorizedMemoryRetrieval] 💾 开始保存到原生向量API...');
            await this.saveIndexToNativeAPI();

            // 5. 验证迁移
            const vectorCount = await this.vectorAPI.getVectorCount('default');
            console.log(`[VectorizedMemoryRetrieval] 📊 原生API中的向量数量: ${vectorCount}`);

            // 6. 清理旧数据（可选，保留备份）
            console.log('[VectorizedMemoryRetrieval] 🗑️ 清理旧存储数据...');
            await this.unifiedDataCore.setData('vector_cache_backup', oldCacheData);
            await this.unifiedDataCore.setData('vector_index_metadata_backup', oldIndexMetadata);
            await this.unifiedDataCore.setData('vector_cache', null);
            await this.unifiedDataCore.setData('vector_index_metadata', null);

            console.log('[VectorizedMemoryRetrieval] ✅ 数据迁移完成');

            return {
                success: true,
                migrated: this.vectorIndex.length,
                vectorCountInAPI: vectorCount,
                message: `成功迁移 ${this.vectorIndex.length} 个向量到原生API`
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 数据迁移失败:', error);
            return {
                success: false,
                error: error.message,
                message: `迁移失败: ${error.message}`
            };
        }
    }

    /**
     * 🚀 新增：检查迁移状态
     */
    async checkMigrationStatus() {
        try {
            // 检查旧数据
            const oldCacheData = await this.unifiedDataCore.getData('vector_cache');
            const oldIndexMetadata = await this.unifiedDataCore.getData('vector_index_metadata');
            const hasOldData = !!(oldCacheData || oldIndexMetadata);

            // 检查新数据
            const vectorCountInAPI = await this.vectorAPI.getVectorCount('default');
            const hasNewData = vectorCountInAPI > 0;

            // 检查配置
            const usingNativeAPI = this.settings.useNativeVectorAPI;

            return {
                hasOldData: hasOldData,
                hasNewData: hasNewData,
                usingNativeAPI: usingNativeAPI,
                vectorCountInAPI: vectorCountInAPI,
                vectorIndexSize: this.vectorIndex.length,
                needsMigration: hasOldData && !hasNewData,
                migrationComplete: !hasOldData && hasNewData && usingNativeAPI
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 检查迁移状态失败:', error);
            return {
                error: error.message
            };
        }
    }

    /**
     * 🚀 新增：回滚到旧存储方案
     */
    async rollbackToOldStorage() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔄 回滚到旧存储方案...');

            // 1. 禁用原生API
            this.settings.useNativeVectorAPI = false;
            await this.unifiedDataCore.setData('vectorized_memory_settings', this.settings);

            // 2. 恢复备份数据
            const backupCache = await this.unifiedDataCore.getData('vector_cache_backup');
            const backupMetadata = await this.unifiedDataCore.getData('vector_index_metadata_backup');

            if (backupCache) {
                await this.unifiedDataCore.setData('vector_cache', backupCache);
            }
            if (backupMetadata) {
                await this.unifiedDataCore.setData('vector_index_metadata', backupMetadata);
            }

            // 3. 重新加载
            await this.loadVectorCache();

            console.log('[VectorizedMemoryRetrieval] ✅ 回滚完成');

            return {
                success: true,
                message: '成功回滚到旧存储方案'
            };

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 回滚失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
