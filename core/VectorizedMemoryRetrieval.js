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

export class VectorizedMemoryRetrieval {
    constructor(unifiedDataCore, eventSystem, aiMemorySummarizer) {
        console.log('[VectorizedMemoryRetrieval] 🔍 向量化记忆检索系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.aiMemorySummarizer = aiMemorySummarizer;
        
        // 向量化设置
        this.settings = {
            enabled: false,                    // 是否启用向量化检索
            vectorEngine: 'transformers',      // 向量化引擎类型
            embeddingModel: 'Supabase/gte-small', // 嵌入模型
            vectorDimensions: 384,             // 向量维度
            maxCacheSize: 1000,                // 最大缓存大小
            similarityThreshold: 0.7,          // 相似度阈值
            maxResults: 10,                    // 最大返回结果数
            batchSize: 50,                     // 批量处理大小
            autoVectorize: true,               // 自动向量化新记忆
            useLocalStorage: true              // 使用本地存储
        };
        
        // 向量化引擎
        this.vectorEngines = {
            transformers: null,                // Transformers.js引擎
            openai: null,                      // OpenAI引擎
            custom: null                       // 自定义引擎
        };
        
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
            
            // 加载设置
            await this.loadSettings();
            
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
            
            if (!this.unifiedDataCore) return;
            
            const savedSettings = await this.unifiedDataCore.getData('vectorized_memory_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
                console.log('[VectorizedMemoryRetrieval] ✅ 向量化设置加载完成:', this.settings);
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
            
            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('vectorized_memory_settings', this.settings);
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
     * 初始化向量化引擎
     */
    async initializeVectorEngines() {
        try {
            console.log('[VectorizedMemoryRetrieval] 🚀 初始化向量化引擎:', this.settings.vectorEngine);
            
            switch (this.settings.vectorEngine) {
                case 'transformers':
                    await this.initializeTransformersEngine();
                    break;
                case 'openai':
                    await this.initializeOpenAIEngine();
                    break;
                default:
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 未知的向量化引擎:', this.settings.vectorEngine);
            }
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 初始化向量化引擎失败:', error);
            throw error;
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
     * 向量化文本内容
     */
    async vectorizeText(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('无效的文本内容');
            }
            
            console.log('[VectorizedMemoryRetrieval] 🔢 向量化文本，长度:', text.length);
            
            // 检查缓存
            const cacheKey = this.generateCacheKey(text);
            if (this.vectorCache.has(cacheKey)) {
                this.stats.cacheHits++;
                console.log('[VectorizedMemoryRetrieval] 💾 使用缓存的向量');
                return this.vectorCache.get(cacheKey);
            }
            
            let vector = null;
            
            switch (this.settings.vectorEngine) {
                case 'transformers':
                    vector = await this.vectorizeWithTransformers(text);
                    break;
                case 'openai':
                    vector = await this.vectorizeWithOpenAI(text);
                    break;
                default:
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
     * 使用Transformers.js向量化
     */
    async vectorizeWithTransformers(text) {
        try {
            if (!this.vectorEngines.transformers) {
                throw new Error('Transformers.js引擎未初始化');
            }
            
            // 🔧 修复：检查是否为fallback模式
            if (this.vectorEngines.transformers === 'fallback') {
                return await this.vectorizeWithFallback(text);
            }
            
            // 🔧 新增：确保transformers是函数类型
            if (typeof this.vectorEngines.transformers !== 'function') {
                console.warn('[VectorizedMemoryRetrieval] ⚠️ Transformers引擎类型错误，降级到fallback模式');
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
            
            // 🔧 修复：再次确保transformers是函数后再调用
            if (typeof this.vectorEngines.transformers !== 'function') {
                throw new Error('Transformers引擎不是有效的函数');
            }
            
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
     * 降级向量化方法（基于文本特征）
     */
    async vectorizeWithFallback(text) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🔄 使用降级向量化方法');
            
            // 简单的文本特征向量化
            const words = text.toLowerCase().split(/\s+/);
            const vector = new Array(this.settings.vectorDimensions).fill(0);
            
            // 基于词频和位置的简单向量化
            words.forEach((word, index) => {
                const hash = this.simpleHash(word);
                const pos = hash % this.settings.vectorDimensions;
                vector[pos] += 1 / (index + 1); // 位置权重
            });
            
            // 归一化
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < vector.length; i++) {
                    vector[i] /= magnitude;
                }
            }
            
            return vector;
            
        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 降级向量化失败:', error);
            return null;
        }
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
                filterByTimeRange = null
            } = options;

            // 向量化查询
            const queryVector = await this.vectorizeText(query);
            if (!queryVector) {
                throw new Error('查询向量化失败');
            }

            // 搜索相似向量
            const searchResults = [];

            for (const indexEntry of this.vectorIndex) {
                try {
                    // 计算相似度
                    const similarity = this.calculateCosineSimilarity(queryVector, indexEntry.vector);

                    if (similarity >= similarityThreshold) {
                        // 应用过滤器
                        if (filterByType && indexEntry.type !== filterByType) continue;
                        if (filterByTimeRange && !this.isInTimeRange(indexEntry.timestamp, filterByTimeRange)) continue;

                        searchResults.push({
                            id: indexEntry.id,
                            content: indexEntry.content,
                            similarity: similarity,
                            type: indexEntry.type,
                            timestamp: indexEntry.timestamp,
                            metadata: includeMetadata ? indexEntry.metadata : undefined
                        });
                    }
                } catch (error) {
                    console.warn('[VectorizedMemoryRetrieval] ⚠️ 搜索条目处理失败:', error);
                }
            }

            // 按相似度排序并限制结果数量
            searchResults.sort((a, b) => b.similarity - a.similarity);
            const finalResults = searchResults.slice(0, maxResults);

            // 更新统计
            const searchTime = Date.now() - startTime;
            this.stats.searchCount++;
            this.stats.avgSearchTime = (this.stats.avgSearchTime * (this.stats.searchCount - 1) + searchTime) / this.stats.searchCount;

            console.log(`[VectorizedMemoryRetrieval] ✅ 语义搜索完成，找到 ${finalResults.length} 个结果，耗时 ${searchTime}ms`);

            // 触发搜索完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('vectorized-memory-retrieval:search-completed', {
                    query: query,
                    resultCount: finalResults.length,
                    searchTime: searchTime,
                    timestamp: Date.now()
                });
            }

            return {
                query: query,
                results: finalResults,
                totalResults: searchResults.length,
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

            // 获取AI总结历史
            const aiSummaries = await this.getAISummaryHistory();

            // 获取传统总结历史
            const traditionalSummaries = await this.getTraditionalSummaryHistory();

            // 获取聊天历史
            const chatHistory = await this.getChatHistory();

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
     * 处理AI总结创建事件
     */
    async handleAISummaryCreated(data) {
        try {
            console.log('[VectorizedMemoryRetrieval] 🧠 处理AI总结创建事件');

            if (!this.settings.autoVectorize) return;

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
                metadata: {
                    classification: summary.classification,
                    tags: summary.tags,
                    messageCount: summary.messageCount
                }
            };

            // 添加到索引
            this.vectorIndex.push(indexEntry);
            this.memoryIndex.set(indexEntry.id, indexEntry);

            console.log('[VectorizedMemoryRetrieval] ✅ AI总结已自动索引');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 处理AI总结创建事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
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
     * 处理记忆更新事件
     */
    async handleMemoryUpdated(data) {
        try {
            console.log('[VectorizedMemoryRetrieval] 📝 处理记忆更新事件');

            if (!this.settings.autoVectorize) return;

            // 增量更新索引
            await this.buildMemoryIndex();

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
            if (!this.settings.useLocalStorage || !this.unifiedDataCore) return;

            console.log('[VectorizedMemoryRetrieval] 💾 保存索引到存储...');

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

            console.log('[VectorizedMemoryRetrieval] ✅ 索引保存完成');

        } catch (error) {
            console.error('[VectorizedMemoryRetrieval] ❌ 保存索引失败:', error);
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
}
