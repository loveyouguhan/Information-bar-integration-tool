/**
 * API集成模块
 * 
 * 负责管理外部API集成：
 * - Gemini API集成
 * - OpenAI兼容API集成
 * - API连接测试和验证
 * - 请求重试和错误处理
 * - 模型管理和配置
 * 
 * @class APIIntegration
 */

export class APIIntegration {
    constructor(configManager) {
        console.log('[APIIntegration] 🔧 API集成模块初始化开始');
        
        this.configManager = configManager;
        
        // 🚀 代理配置（智能代理解决方案）
        this.proxyConfig = {
            enableDirectFallback: true,  // 允许先尝试直接请求
            autoDetectProxy: true,       // 自动检测可用代理端点
            provideFriendlyErrors: true, // 提供友好的错误信息
            maxRetries: 2                // 最大重试次数
        };
        
        // API提供商
        this.providers = {
            gemini: new GeminiProvider(this),
            openai: new OpenAIProvider(this)
        };
        
        // 当前提供商
        this.currentProvider = null;
        
        // 请求统计
        this.requestStats = {
            total: 0,
            success: 0,
            failed: 0,
            retries: 0,
            corsErrors: 0,
            proxySuccess: 0,
            directSuccess: 0
        };
        
        // 模型列表缓存
        this.modelCache = new Map();
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.testConnection = this.testConnection.bind(this);
        this.generateText = this.generateText.bind(this);
        this.loadModels = this.loadModels.bind(this);
        this.proxyCompatibleFetch = this.proxyCompatibleFetch.bind(this);
    }

    /**
     * 初始化API集成模块
     */
    async init() {
        try {
            console.log('[APIIntegration] 📊 开始初始化API集成模块...');
            
            if (!this.configManager) {
                throw new Error('配置管理器未初始化');
            }
            
            // 加载API配置
            await this.loadAPIConfig();
            
            // 初始化当前提供商
            await this.initCurrentProvider();

            // 监听配置变更事件，保持配置同步
            this.setupConfigSyncListener();

            this.initialized = true;
            console.log('[APIIntegration] ✅ API集成模块初始化完成');
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载API配置
     */
    async loadAPIConfig() {
        try {
            // 优先从SillyTavern扩展设置中读取配置（与InfoBarSettings保持一致）
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const apiConfigFromExtension = configs.apiConfig || {};

            // 如果扩展设置中有配置，优先使用；否则从ConfigManager读取
            this.apiConfig = {
                enabled: apiConfigFromExtension.enabled !== undefined ?
                    apiConfigFromExtension.enabled :
                    await this.configManager.getConfig('apiConfig.enabled'),
                provider: apiConfigFromExtension.provider ||
                    await this.configManager.getConfig('apiConfig.provider'),
                format: apiConfigFromExtension.format ||
                    await this.configManager.getConfig('apiConfig.format'),
                endpoint: apiConfigFromExtension.endpoint ||
                    await this.configManager.getConfig('apiConfig.endpoint'),
                apiKey: apiConfigFromExtension.apiKey ||
                    await this.configManager.getConfig('apiConfig.apiKey'),
                model: apiConfigFromExtension.model ||
                    await this.configManager.getConfig('apiConfig.model'),
                temperature: apiConfigFromExtension.temperature !== undefined ?
                    apiConfigFromExtension.temperature :
                    await this.configManager.getConfig('apiConfig.temperature'),
                maxTokens: apiConfigFromExtension.maxTokens !== undefined ?
                    apiConfigFromExtension.maxTokens :
                    await this.configManager.getConfig('apiConfig.maxTokens'),
                retryCount: apiConfigFromExtension.retryCount !== undefined ?
                    apiConfigFromExtension.retryCount :
                    await this.configManager.getConfig('apiConfig.retryCount'),
                extraPrompt: apiConfigFromExtension.extraPrompt ||
                    await this.configManager.getConfig('apiConfig.extraPrompt'),
                mergeMessages: apiConfigFromExtension.mergeMessages !== undefined ?
                    apiConfigFromExtension.mergeMessages :
                    await this.configManager.getConfig('apiConfig.mergeMessages', true) // 默认为true
            };

            console.log('[APIIntegration] ⚙️ API配置加载完成');
            console.log('[APIIntegration] 📊 API启用状态:', this.apiConfig.enabled);
            console.log('[APIIntegration] 📊 API提供商:', this.apiConfig.provider);
            console.log('[APIIntegration] 📊 API模型:', this.apiConfig.model);

        } catch (error) {
            console.error('[APIIntegration] ❌ 加载API配置失败:', error);
            throw error;
        }
    }

    /**
     * 初始化当前提供商
     */
    async initCurrentProvider() {
        try {
            if (!this.apiConfig.enabled) {
                console.log('[APIIntegration] ⚠️ API功能未启用');
                return;
            }
            
            const providerName = this.apiConfig.provider;
            this.currentProvider = this.providers[providerName];
            
            if (!this.currentProvider) {
                throw new Error(`不支持的API提供商: ${providerName}`);
            }
            
            // 初始化提供商
            await this.currentProvider.init(this.apiConfig);
            
            console.log(`[APIIntegration] ✅ 当前提供商: ${providerName}`);
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 初始化提供商失败:', error);
            throw error;
        }
    }

    /**
     * 测试API连接
     */
    async testConnection() {
        try {
            console.log('[APIIntegration] 🔍 开始测试API连接...');
            
            if (!this.apiConfig.enabled) {
                throw new Error('API功能未启用');
            }
            
            if (!this.currentProvider) {
                throw new Error('当前提供商未初始化');
            }
            
            // 执行连接测试
            const result = await this.currentProvider.testConnection();
            
            if (result.success) {
                console.log('[APIIntegration] ✅ API连接测试成功');
                return {
                    success: true,
                    message: 'API连接正常',
                    details: result.details
                };
            } else {
                console.error('[APIIntegration] ❌ API连接测试失败:', result.error);
                return {
                    success: false,
                    message: 'API连接失败',
                    error: result.error
                };
            }
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 测试连接失败:', error);
            this.handleError(error);
            return {
                success: false,
                message: '连接测试异常',
                error: error.message
            };
        }
    }

    /**
     * 生成文本
     * @param {string} prompt - 提示词
     * @param {Object} options - 生成选项
     */
    async generateText(prompt, options = {}) {
        try {
            this.requestStats.total++;
            
            if (!this.apiConfig.enabled) {
                throw new Error('API功能未启用');
            }
            
            if (!this.currentProvider) {
                throw new Error('当前提供商未初始化');
            }
            
            // 合并配置和选项
            const requestOptions = {
                temperature: options.temperature || this.apiConfig.temperature,
                maxTokens: options.maxTokens || this.apiConfig.maxTokens,
                model: options.model || this.apiConfig.model,
                ...options
            };
            
            // 🚀 新增：获取SmartPromptSystem的智能提示词（包含NPC格式要求）
            const smartPrompt = await this.getSmartPromptSystemPrompt();
            if (smartPrompt && smartPrompt.length > 0) {
                console.log('[APIIntegration] 🧠 添加SmartPromptSystem智能提示词，字符数:', smartPrompt.length);
                prompt = `${smartPrompt}\n\n${prompt}`;
            }

            // 添加额外提示词
            if (this.apiConfig.extraPrompt) {
                prompt = `${this.apiConfig.extraPrompt}\n\n${prompt}`;
            }

            // 🆕 添加世界书内容
            if (this.apiConfig.includeWorldBook) {
                const worldBookContent = await this.getWorldBookContent();
                if (worldBookContent && worldBookContent.length > 0) {
                    console.log('[APIIntegration] 📚 添加世界书内容到请求中，字符数:', worldBookContent.length);
                    prompt = `${worldBookContent}\n\n${prompt}`;
                }
            }

            console.log('[APIIntegration] 🚀 开始生成文本...');
            
            // 执行生成请求（带重试）
            const result = await this.executeWithRetry(
                () => this.currentProvider.generateText(prompt, requestOptions),
                this.apiConfig.retryCount
            );
            
            if (result.success) {
                this.requestStats.success++;
                console.log('[APIIntegration] ✅ 文本生成成功');
                return result;
            } else {
                this.requestStats.failed++;
                console.error('[APIIntegration] ❌ 文本生成失败:', result.error);
                return result;
            }
            
        } catch (error) {
            this.requestStats.failed++;
            console.error('[APIIntegration] ❌ 生成文本异常:', error);
            this.handleError(error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 带重试的执行函数
     */
    async executeWithRetry(fn, maxRetries) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    this.requestStats.retries++;
                    console.log(`[APIIntegration] 🔄 重试第 ${attempt} 次...`);
                    
                    // 指数退避延迟
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                const result = await fn();
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`[APIIntegration] ❌ 尝试 ${attempt + 1} 失败:`, error);
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === maxRetries) {
                    throw lastError;
                }
            }
        }
    }

    /**
     * 加载可用模型列表
     */
    async loadModels() {
        try {
            console.log('[APIIntegration] 📋 开始加载模型列表...');
            
            if (!this.apiConfig.enabled) {
                throw new Error('API功能未启用');
            }
            
            if (!this.currentProvider) {
                throw new Error('当前提供商未初始化');
            }
            
            // 检查缓存
            const cacheKey = `${this.apiConfig.provider}_models`;
            if (this.modelCache.has(cacheKey)) {
                const cached = this.modelCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
                    console.log('[APIIntegration] 📋 使用缓存的模型列表');
                    return cached.models;
                }
            }
            
            // 从API加载模型列表
            let models = [];
            try {
                models = await this.currentProvider.loadModels();
                
                // 验证模型列表有效性
                if (!Array.isArray(models) || models.length === 0) {
                    console.warn('[APIIntegration] ⚠️ 获取到空的模型列表，使用降级处理');
                    throw new Error('获取到空的模型列表');
                }
                
                console.log(`[APIIntegration] ✅ 成功加载 ${models.length} 个模型`);
                
            } catch (providerError) {
                console.error('[APIIntegration] ❌ 提供商加载模型失败:', providerError);
                
                // 处理降级模型列表
                if (providerError.fallbackModels && Array.isArray(providerError.fallbackModels)) {
                    console.log('[APIIntegration] 🔄 使用提供商提供的降级模型列表');
                    models = providerError.fallbackModels;
                } else {
                    console.log('[APIIntegration] 🔄 使用内置降级模型列表');
                    models = this.getFallbackModels();
                }
                
                // 标记这些是降级模型
                models = models.map(model => ({
                    ...model,
                    isFallback: true,
                    fallbackReason: providerError.message
                }));
                
                console.log(`[APIIntegration] 🔄 降级处理完成，提供 ${models.length} 个默认模型`);
            }
            
            // 更新缓存（包括降级模型）
            this.modelCache.set(cacheKey, {
                models,
                timestamp: Date.now(),
                isFallback: models.some(m => m.isFallback)
            });
            
            // 如果是降级模型，缓存时间缩短到1分钟
            if (models.some(m => m.isFallback)) {
                console.log('[APIIntegration] ⏱️ 降级模型缓存时间设置为1分钟');
                setTimeout(() => {
                    if (this.modelCache.has(cacheKey)) {
                        this.modelCache.delete(cacheKey);
                        console.log('[APIIntegration] 🗑️ 已清除降级模型缓存');
                    }
                }, 60000); // 1分钟后清除缓存
            }
            
            return models;
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 加载模型列表完全失败:', error);
            this.handleError(error);
            
            // 最后的降级：返回基础模型列表
            const basicModels = this.getFallbackModels();
            console.log('[APIIntegration] 🚨 使用最基础的降级模型列表');
            return basicModels.map(model => ({
                ...model,
                isFallback: true,
                fallbackReason: 'API连接完全失败'
            }));
        }
    }

    /**
     * 设置提供商
     * @param {string} provider - 提供商名称
     */
    async setProvider(provider) {
        try {
            if (!this.providers[provider]) {
                throw new Error(`不支持的提供商: ${provider}`);
            }
            
            // 更新配置
            await this.configManager.setConfig('apiConfig.provider', provider);
            
            // 重新加载配置
            await this.loadAPIConfig();
            
            // 重新初始化提供商
            await this.initCurrentProvider();
            
            console.log(`[APIIntegration] ✅ 提供商已切换到: ${provider}`);
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 设置提供商失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 设置配置同步监听器
     */
    setupConfigSyncListener() {
        try {
            // 监听SillyTavern的设置更新事件
            if (window.eventSource) {
                window.eventSource.on('settings_updated', async () => {
                    try {
                        console.log('[APIIntegration] 🔄 检测到设置更新，重新加载API配置...');

                        const oldEnabled = this.apiConfig?.enabled;
                        await this.loadAPIConfig();
                        const newEnabled = this.apiConfig?.enabled;

                        // 如果启用状态发生变化，重新初始化提供商
                        if (oldEnabled !== newEnabled) {
                            console.log(`[APIIntegration] 🔄 API启用状态变更: ${oldEnabled} -> ${newEnabled}`);
                            await this.initCurrentProvider();
                        }

                    } catch (error) {
                        console.error('[APIIntegration] ❌ 配置同步失败:', error);
                    }
                });

                console.log('[APIIntegration] 🔗 配置同步监听器已设置');
            }

        } catch (error) {
            console.warn('[APIIntegration] ⚠️ 设置配置同步监听器失败:', error);
        }
    }

    /**
     * 更新API配置
     * @param {Object} config - 新的配置
     */
    async updateConfig(config) {
        try {
            // 批量更新配置
            const configUpdates = {};
            for (const [key, value] of Object.entries(config)) {
                configUpdates[`apiConfig.${key}`] = value;
            }

            await this.configManager.setConfigs(configUpdates);

            // 重新加载配置
            await this.loadAPIConfig();

            // 如果提供商发生变化，重新初始化
            if (config.provider && config.provider !== this.currentProvider?.name) {
                await this.initCurrentProvider();
            }

            console.log('[APIIntegration] ✅ API配置已更新');

        } catch (error) {
            console.error('[APIIntegration] ❌ 更新配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取请求统计
     */
    getStats() {
        return {
            ...this.requestStats,
            successRate: this.requestStats.total > 0 
                ? (this.requestStats.success / this.requestStats.total * 100).toFixed(2) + '%'
                : '0%',
            corsErrorRate: this.requestStats.total > 0
                ? (this.requestStats.corsErrors / this.requestStats.total * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * 重置统计
     */
    resetStats() {
        this.requestStats = {
            total: 0,
            success: 0,
            failed: 0,
            retries: 0,
            corsErrors: 0
        };
        console.log('[APIIntegration] 📊 统计已重置');
    }

    /**
     * 设置配置同步监听器
     */
    setupConfigSyncListener() {
        try {
            // 监听SillyTavern的设置更新事件
            if (window.eventSource) {
                window.eventSource.on('settings_updated', async () => {
                    try {
                        console.log('[APIIntegration] 🔄 检测到设置更新，重新加载API配置...');

                        const oldEnabled = this.apiConfig?.enabled;
                        const oldProvider = this.apiConfig?.provider;

                        await this.loadAPIConfig();

                        const newEnabled = this.apiConfig?.enabled;
                        const newProvider = this.apiConfig?.provider;

                        // 如果启用状态或提供商发生变化，重新初始化提供商
                        if (oldEnabled !== newEnabled || oldProvider !== newProvider) {
                            console.log(`[APIIntegration] 🔄 API配置变更: enabled(${oldEnabled}->${newEnabled}), provider(${oldProvider}->${newProvider})`);
                            await this.initCurrentProvider();
                        }

                    } catch (error) {
                        console.error('[APIIntegration] ❌ 配置同步失败:', error);
                    }
                });

                console.log('[APIIntegration] 🔗 配置同步监听器已设置');
            }

        } catch (error) {
            console.warn('[APIIntegration] ⚠️ 设置配置同步监听器失败:', error);
        }
    }

    /**
     * 智能代理请求处理器
     * 使用SillyTavern内置代理功能解决跨域问题
     */
    async proxyCompatibleFetch(url, options = {}) {
        console.log('[APIIntegration] 🔄 开始代理请求处理:', url);
        
        try {
            // 🔧 策略1: 尝试直接请求（用于同域或已配置CORS的端点）
            const directResponse = await this.tryDirectRequest(url, options);
            if (directResponse) {
                console.log('[APIIntegration] ✅ 直接请求成功');
                return directResponse;
            }
            
        } catch (error) {
            console.log('[APIIntegration] ⚠️ 直接请求失败，尝试代理:', error.message);
        }
        
        // 🔧 策略2: 尝试公共CORS代理（仅测试用）
        try {
            console.log('[APIIntegration] 🔄 直接请求失败，尝试公共代理...');
            return await this.tryPublicCorsProxy(url, options);
        } catch (publicProxyError) {
            console.log('[APIIntegration] ⚠️ 公共代理也失败，尝试内置代理...');
        }
        
        // 🔧 策略3: 使用SillyTavern代理（可能不可用）
        return await this.useSillyTavernProxy(url, options);
    }
    
    /**
     * 尝试直接请求
     */
    async tryDirectRequest(url, options = {}) {
        console.log('[APIIntegration] 🔄 尝试直接请求:', url);
        console.log('[APIIntegration] 🔍 请求头部:', JSON.stringify(options.headers || {}, null, 2));
        
        const safeOptions = {
            ...options,
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-cache'
        };
        
        try {
            const response = await fetch(url, safeOptions);
            console.log(`[APIIntegration] 📊 响应状态: ${response.status} ${response.statusText}`);
            
            // 🔧 改进的状态码处理逻辑
            if (response.status === 401) {
                console.error('[APIIntegration] ❌ 401未授权错误 - API Key可能无效或缺失');
                console.error('[APIIntegration] 🔍 请检查:', {
                    hasAuthHeader: !!(options.headers && options.headers['Authorization']),
                    authHeaderFormat: options.headers?.['Authorization']?.substring(0, 20) + '...'
                });
                return response; // 返回401响应让调用者处理
            } else if (response.status === 500) {
                console.error('[APIIntegration] ❌ 500服务器内部错误 - 反代服务器配置问题');
                console.error('[APIIntegration] 🔍 诊断信息:', {
                    url: url,
                    endpoint: url.split('/').pop(),
                    isModelsEndpoint: url.includes('/models'),
                    isChatEndpoint: url.includes('/chat/completions')
                });
                // 尝试获取服务器错误详情
                try {
                    const errorText = await response.clone().text();
                    if (errorText) {
                        console.error('[APIIntegration] 🔍 服务器错误详情:', errorText.substring(0, 300));
                    }
                } catch (e) {
                    console.warn('[APIIntegration] ⚠️ 无法读取500错误详情');
                }
                return response; // 返回500响应让调用者处理
            } else if (response.status < 400) {
                console.log(`[APIIntegration] ✅ 直接请求成功: ${response.status}`);
                this.requestStats.directSuccess++;
                return response;
            } else if (response.status < 500) {
                console.warn(`[APIIntegration] ⚠️ 客户端错误: ${response.status} ${response.statusText}`);
                return response; // 返回客户端错误让调用者处理
            }
            throw new Error(`Server error: ${response.status}`);
        } catch (error) {
            console.log(`[APIIntegration] ⚠️ 直接请求失败: ${error.message}`);
            // 检查是否为CORS错误
            if (this.isCorsError(error)) {
                return null; // 指示需要使用代理
            }
            throw error; // 其他错误直接抛出
        }
    }
    
    /**
     * 使用公共CORS代理（仅用于测试）
     */
    async tryPublicCorsProxy(url, options = {}) {
        console.log('[APIIntegration] 🌐 尝试公共CORS代理（智能重试）');
        
        // 🔧 扩展的公共代理列表，增加更多选择
        const publicProxies = [
            'https://corsproxy.io/?url=',           // 优先使用之前成功的
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/', // 备用选项
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        let lastError = null;
        
        for (const proxyPrefix of publicProxies) {
            // 🔄 对于每个代理，尝试多次重试
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`[APIIntegration] 🔄 尝试代理: ${proxyPrefix} (第${attempt}次)`);
                    
                    const proxyUrl = proxyPrefix + encodeURIComponent(url);
                    const proxyOptions = {
                        ...options,
                        mode: 'cors',
                        credentials: 'omit',
                        // 🕐 添加超时控制
                        signal: AbortSignal.timeout(15000) // 15秒超时
                    };
                    
                    const response = await fetch(proxyUrl, proxyOptions);
                    
                    // ✅ 接受成功状态或认证错误（说明服务器可达）
                    if (response.ok || response.status === 401 || response.status === 403) {
                        console.log(`[APIIntegration] ✅ 公共代理成功: ${response.status} (${proxyPrefix})`);
                        this.requestStats.proxySuccess++;
                        return response;
                    }
                    
                    // ⚠️ 临时错误，记录但不立即失败
                    if (response.status >= 500) {
                        console.log(`[APIIntegration] ⚠️ 代理临时错误 ${response.status}，将重试其他代理`);
                        lastError = new Error(`Proxy returned ${response.status}`);
                        continue; // 跳到下一个代理
                    }
                    
                } catch (error) {
                    console.log(`[APIIntegration] ⚠️ 代理 ${proxyPrefix} 第${attempt}次尝试失败:`, error.message);
                    lastError = error;
                    
                    // 🔄 对于网络错误，稍微延迟后重试
                    if (attempt < 2 && (error.name === 'AbortError' || error.message.includes('fetch'))) {
                        console.log(`[APIIntegration] 🕐 等待1秒后重试...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                break; // 成功或最大重试次数，跳出重试循环
            }
        }
        
        // 🚨 所有代理都失败了
        console.error('[APIIntegration] ❌ 所有公共CORS代理都不可用，最后错误:', lastError?.message);
        throw new Error(`所有公共CORS代理都不可用。最后错误: ${lastError?.message}`);
    }
    
    /**
     * 尝试CORS解决方案
     */
    async useSillyTavernProxy(targetUrl, options = {}) {
        console.log('[APIIntegration] 🔄 尝试CORS解决方案:', targetUrl);
        
        try {
            // 🔧 策略1: 检查是否有可用的内置代理
            const proxyEndpoints = await this.detectProxyEndpoints();
            
            for (const proxyEndpoint of proxyEndpoints) {
                try {
                    console.log(`[APIIntegration] 🔄 尝试代理端点: ${proxyEndpoint}`);
                    const response = await this.makeProxyRequest(proxyEndpoint, targetUrl, options);
                    
                    if (response && response.ok !== false && response.status !== 403) {
                        console.log('[APIIntegration] ✅ 内置代理成功');
                        this.requestStats.proxySuccess++;
                        return response;
                    }
                } catch (proxyError) {
                    console.log(`[APIIntegration] ⚠️ 代理端点 ${proxyEndpoint} 失败:`, proxyError.message);
                    continue;
                }
            }
            
            // 🔧 策略2: 提供详细的CORS诊断和解决方案
            console.log('[APIIntegration] 📋 内置代理不可用，进行CORS诊断...');
            
            // 执行网络可达性测试
            const diagnostic = await this.diagnoseCORSIssue(targetUrl);
            
            throw new Error(`反代服务器CORS配置问题 - ${diagnostic}`);
            
        } catch (error) {
            console.error('[APIIntegration] ❌ CORS解决方案失败:', error);
            this.requestStats.corsErrors++;
            throw this.createProxyError(targetUrl, error);
        }
    }
    
    /**
     * 诊断CORS问题
     */
    async diagnoseCORSIssue(url) {
        try {
            // 使用no-cors模式测试服务器可达性
            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors'
            });
            
            if (response.type === 'opaque') {
                return '服务器可达但未配置CORS头，需要在反代服务器添加CORS配置';
            }
            
            return '服务器响应正常，CORS配置可能存在其他问题';
            
        } catch (error) {
            if (error.name === 'AbortError') {
                return '服务器响应超时，请检查网络连接或服务器状态';
            }
            return `网络连接失败: ${error.message}`;
        }
    }
    
    /**
     * 检测可用的代理端点（有限检测）
     */
    async detectProxyEndpoints() {
        const possibleEndpoints = [
            '/api/proxy'              // SillyTavern可能的API代理
        ];
        
        const availableEndpoints = [];
        
        for (const endpoint of possibleEndpoints) {
            try {
                // 快速检查端点是否存在且可用
                const testResponse = await fetch(endpoint, {
                    method: 'HEAD'
                });
                
                // 只有200系列状态码才认为端点可用
                if (testResponse.status >= 200 && testResponse.status < 300) {
                    availableEndpoints.push(endpoint);
                    console.log(`[APIIntegration] ✅ 发现可用代理端点: ${endpoint}`);
                } else if (testResponse.status === 403) {
                    console.log(`[APIIntegration] 🔒 端点 ${endpoint} 存在但被禁止访问`);
                } else {
                    console.log(`[APIIntegration] ⚠️ 端点 ${endpoint} 不可用 (${testResponse.status})`);
                }
            } catch (error) {
                console.log(`[APIIntegration] ❌ 端点 ${endpoint} 检测失败:`, error.message);
                continue;
            }
        }
        
        return availableEndpoints;
    }
    
    /**
     * 执行代理请求
     */
    async makeProxyRequest(proxyEndpoint, targetUrl, options = {}) {
        const proxyPayload = {
            url: targetUrl,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body || null
        };
        
        const proxyOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proxyPayload)
        };
        
        return await fetch(proxyEndpoint, proxyOptions);
    }
    
    /**
     * 检查是否为CORS错误
     */
    isCorsError(error) {
        return error.name === 'TypeError' && 
               (error.message.includes('CORS') || 
                error.message.includes('Failed to fetch') ||
                error.message.includes('Access to fetch') ||
                error.message.includes('NetworkError') ||
                error.message.includes('cross-origin'));
    }
    
    /**
     * 创建详细的诊断错误信息
     */
    createProxyError(url, originalError) {
        const hostname = new URL(url).hostname;
        
        const proxyError = new Error(`
🚨 反代API连接失败

🔗 目标地址: ${hostname}
❌ 诊断结果: 服务器可达但缺少CORS配置

✅ 推荐解决方案：

1. 【最佳】配置反代服务器CORS头：
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, OPTIONS
   Access-Control-Allow-Headers: Authorization, Content-Type

2. 【临时】使用浏览器扩展（仅开发用）：
   - 安装 "CORS Unblock" 或 "CORS Everywhere"
   - 仅在开发测试时启用

3. 【备选】使用支持CORS的公共代理：
   - https://api.allorigins.win/raw?url=
   - https://corsproxy.io/?url=
   
4. 【推荐】使用已配置CORS的反代服务：
   - 确保您的反代服务商支持CORS
   - 或自建支持CORS的反代服务

🔧 技术详情: ${originalError.message}`);
        
        proxyError.name = 'CORSConfigurationError';
        proxyError.endpoint = url;
        proxyError.hostname = hostname;
        proxyError.originalError = originalError;
        proxyError.solutions = [
            { type: 'server_config', description: '配置反代服务器CORS头' },
            { type: 'browser_extension', description: '使用CORS浏览器扩展（临时）' },
            { type: 'public_proxy', description: '使用公共CORS代理' },
            { type: 'alternative_service', description: '使用支持CORS的反代服务' }
        ];
        
        return proxyError;
    }

    


    /**
     * 获取降级模型列表
     */
    getFallbackModels() {
        const currentProvider = this.apiConfig?.provider || 'openai';
        
        if (currentProvider === 'gemini') {
            return [
                { id: 'gemini-pro', name: 'Gemini Pro (降级)', description: '连接失败时的默认Gemini模型' },
                { id: 'gemini-pro-vision', name: 'Gemini Pro Vision (降级)', description: '连接失败时的默认Gemini视觉模型' }
            ];
        } else {
            return [
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (降级)', description: '连接失败时的默认模型' },
                { id: 'gpt-4', name: 'GPT-4 (降级)', description: '连接失败时的默认模型' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (降级)', description: '连接失败时的默认模型' },
                { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet (降级)', description: '适用于兼容反代的Claude模型' },
                { id: 'llama-2-70b', name: 'Llama 2 70B (降级)', description: '适用于开源反代的Llama模型' }
            ];
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        
        // 详细的错误日志
        console.group(`[APIIntegration] ❌ 错误 #${this.errorCount}`);
        console.error('错误信息:', error.message);
        console.error('错误类型:', error.name);
        if (error.stack) {
            console.error('错误堆栈:', error.stack);
        }
        if (error.technicalDetails) {
            console.error('技术详情:', error.technicalDetails);
        }
        console.groupEnd();
        
        // 触发错误事件（如果事件系统可用）
        if (this.configManager?.dataCore?.eventSystem) {
            this.configManager.dataCore.eventSystem.emit('api:error', {
                error: {
                    message: error.message,
                    name: error.name,
                    count: this.errorCount
                },
                provider: this.currentProvider?.name,
                config: {
                    endpoint: this.apiConfig?.endpoint,
                    provider: this.apiConfig?.provider
                },
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            enabled: this.apiConfig?.enabled || false,
            currentProvider: this.currentProvider?.name || null,
            stats: this.getStats()
        };
    }

    // ==================== 🆕 世界书集成方法 ====================

    /**
     * 获取SmartPromptSystem的智能提示词（包含NPC格式要求）
     */
    async getSmartPromptSystemPrompt() {
        try {
            console.log('[APIIntegration] 🧠 获取SmartPromptSystem智能提示词...');

            // 获取SmartPromptSystem实例
            const smartPromptSystem = window.SillyTavernInfobar?.modules?.smartPromptSystem;
            if (!smartPromptSystem) {
                console.warn('[APIIntegration] ⚠️ SmartPromptSystem未找到');
                return '';
            }

            // 检查SmartPromptSystem是否已初始化
            if (!smartPromptSystem.initialized) {
                console.warn('[APIIntegration] ⚠️ SmartPromptSystem未初始化');
                return '';
            }

            // 生成智能提示词
            const smartPrompt = await smartPromptSystem.generateSmartPrompt();
            if (!smartPrompt || smartPrompt.length === 0) {
                console.log('[APIIntegration] 📝 SmartPromptSystem返回空提示词');
                return '';
            }

            console.log('[APIIntegration] ✅ SmartPromptSystem智能提示词获取成功:', {
                length: smartPrompt.length,
                preview: smartPrompt.substring(0, 200) + '...'
            });

            return smartPrompt;

        } catch (error) {
            console.error('[APIIntegration] ❌ 获取SmartPromptSystem智能提示词失败:', error);
            return '';
        }
    }

    /**
     * 获取世界书内容用于API注入
     */
    async getWorldBookContent() {
        try {
            console.log('[APIIntegration] 📚 获取世界书内容...');

            // 获取世界书管理器
            const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
            if (!worldBookManager) {
                console.warn('[APIIntegration] ⚠️ 世界书管理器未找到');
                return '';
            }

            // 获取选中的世界书内容
            const worldBookData = await worldBookManager.getSelectedWorldBookContent();
            if (!worldBookData || !worldBookData.entries || worldBookData.entries.length === 0) {
                console.log('[APIIntegration] 📚 没有可用的世界书内容');
                return '';
            }

            // 构建世界书内容字符串
            const worldBookSections = [];

            // 添加世界书标题
            worldBookSections.push('=== 世界书信息 ===');

            // 按来源分组条目
            const entriesBySource = {};
            worldBookData.entries.forEach(entry => {
                if (!entriesBySource[entry.source]) {
                    entriesBySource[entry.source] = [];
                }
                entriesBySource[entry.source].push(entry);
            });

            // 为每个来源添加内容
            for (const [source, entries] of Object.entries(entriesBySource)) {
                worldBookSections.push(`\n--- ${source} ---`);

                entries.forEach(entry => {
                    if (entry.key && entry.content) {
                        worldBookSections.push(`关键词: ${entry.key}`);
                        worldBookSections.push(`内容: ${entry.content}`);
                        worldBookSections.push(''); // 空行分隔
                    }
                });
            }

            // 添加统计信息
            worldBookSections.push(`\n=== 世界书统计 ===`);
            worldBookSections.push(`总条目数: ${worldBookData.entries.length}`);
            worldBookSections.push(`总字符数: ${worldBookData.totalCharacters}`);
            if (worldBookData.truncated) {
                worldBookSections.push(`注意: 内容已根据字符限制进行截断`);
            }
            worldBookSections.push('===================\n');

            const finalContent = worldBookSections.join('\n');

            console.log('[APIIntegration] ✅ 世界书内容构建完成:', {
                entries: worldBookData.entries.length,
                characters: finalContent.length,
                truncated: worldBookData.truncated
            });

            return finalContent;

        } catch (error) {
            console.error('[APIIntegration] ❌ 获取世界书内容失败:', error);
            return '';
        }
    }

    /**
     * 检查世界书功能是否可用
     */
    isWorldBookAvailable() {
        try {
            const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
            return !!(worldBookManager && worldBookManager.initialized);
        } catch (error) {
            console.error('[APIIntegration] ❌ 检查世界书可用性失败:', error);
            return false;
        }
    }

    /**
     * 获取世界书配置状态
     */
    getWorldBookStatus() {
        try {
            const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
            if (!worldBookManager) {
                return {
                    available: false,
                    enabled: false,
                    error: '世界书管理器未找到'
                };
            }

            return {
                available: true,
                enabled: this.apiConfig.includeWorldBook || false,
                config: worldBookManager.config,
                status: worldBookManager.getStatus()
            };

        } catch (error) {
            console.error('[APIIntegration] ❌ 获取世界书状态失败:', error);
            return {
                available: false,
                enabled: false,
                error: error.message
            };
        }
    }
}

/**
 * Gemini API提供商
 */
class GeminiProvider {
    constructor(apiIntegration) {
        this.name = 'gemini';
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiIntegration = apiIntegration; // 引用主集成对象
    }

    async init(config) {
        this.config = config;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint || this.baseURL;
    }

    async testConnection() {
        try {
            console.log('[GeminiProvider] 🔍 开始测试Gemini API连接...');
            
            // 使用CORS兼容的fetch
            const response = await this.apiIntegration.proxyCompatibleFetch(
                `${this.endpoint}/models?key=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'SillyTavern-InfoBar/1.0'
                    }
                }
            );
            
            if (response.ok) {
                console.log('[GeminiProvider] ✅ Gemini API连接成功');
                return { success: true, details: 'Gemini API连接正常' };
            } else {
                console.error('[GeminiProvider] ❌ Gemini API连接失败:', response.status);
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
        } catch (error) {
            console.error('[GeminiProvider] ❌ Gemini API连接异常:', error);
            
            if (error.message.includes('CORS_BLOCKED')) {
                return { 
                    success: false, 
                    error: 'CORS跨域错误：请配置Gemini反代服务器的CORS头，或使用服务器端代理',
                    corsError: true
                };
            }
            
            return { success: false, error: error.message };
        }
    }

    async generateText(prompt, options) {
        // Gemini API实现
        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens
            }
        };

        const response = await fetch(
            `${this.endpoint}/models/${options.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            usage: data.usageMetadata
        };
    }

    async loadModels() {
        try {
            console.log('[GeminiProvider] 📋 开始加载Gemini模型列表...');
            
            // 使用CORS兼容的fetch
            const response = await this.apiIntegration.proxyCompatibleFetch(
                `${this.endpoint}/models?key=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'SillyTavern-InfoBar/1.0'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`加载模型失败: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            const models = data.models?.map(model => ({
                id: model.name,
                name: model.displayName,
                description: model.description
            })) || [];
            
            console.log(`[GeminiProvider] ✅ 成功加载 ${models.length} 个Gemini模型`);
            return models;
            
        } catch (error) {
            console.error('[GeminiProvider] ❌ 加载Gemini模型失败:', error);
            
            if (error.message.includes('CORS_BLOCKED')) {
                // 返回降级模型列表
                const fallbackModels = [
                    { id: 'gemini-pro', name: 'Gemini Pro (降级)', description: 'CORS错误时的默认Gemini模型' },
                    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision (降级)', description: 'CORS错误时的默认Gemini视觉模型' }
                ];
                
                const corsError = new Error(`${error.message} - 已提供降级模型列表`);
                corsError.fallbackModels = fallbackModels;
                corsError.corsError = true;
                throw corsError;
            }
            
            throw error;
        }
    }
}

/**
 * OpenAI兼容API提供商
 */
class OpenAIProvider {
    constructor(apiIntegration) {
        this.name = 'openai';
        this.apiIntegration = apiIntegration; // 引用主集成对象
    }

    async init(config) {
        this.config = config;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
    }

    async testConnection() {
        try {
            console.log('[OpenAIProvider] 🔍 开始测试API连接...');
            
            // 🔧 改进的URL拼接逻辑
            let endpoint = this.endpoint.trim();
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.slice(0, -1);
            }
            const testUrl = `${endpoint}/v1/models`;
            console.log('[OpenAIProvider] 📊 测试端点:', testUrl);
            
            // 🔧 API Key验证
            if (!this.apiKey || this.apiKey.trim() === '') {
                console.error('[OpenAIProvider] ❌ API Key未设置或为空');
                return {
                    success: false,
                    error: 'API Key未设置，请在扩展设置中配置有效的API Key'
                };
            }
            
            const apiKeyLength = this.apiKey.length;
            const apiKeyPreview = this.apiKey.substring(0, 8) + '***' + this.apiKey.slice(-4);
            console.log(`[OpenAIProvider] 🔑 API Key信息: 长度=${apiKeyLength}, 预览=${apiKeyPreview}`);
            
            // 使用CORS兼容的fetch
            const response = await this.apiIntegration.proxyCompatibleFetch(
                testUrl,
                {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'SillyTavern-InfoBar/1.0'
                    },
                    timeout: 10000 // 10秒超时
                }
            );
            
            console.log('[OpenAIProvider] 📊 响应状态:', response.status, response.statusText);
            
            // 🔧 处理CORS模拟响应
            if (response._isOpaqueResponse) {
                console.log('[OpenAIProvider] 🎭 检测到CORS模拟响应');
                return {
                    success: false,
                    error: 'CORS跨域问题：请求已发送但无法读取响应。请配置反代服务器的CORS头。',
                    corsError: true,
                    corsHandled: true
                };
            }
            
            if (response.ok) {
                // 尝试解析响应以验证格式
                try {
                    const data = await response.json();
                    console.log('[OpenAIProvider] ✅ API响应格式验证成功');
                    
                    // 检查是否有模型数据
                    const modelCount = data.data?.length || data.models?.length || 0;
                    
                    return { 
                        success: true, 
                        details: `OpenAI兼容API连接正常，发现 ${modelCount} 个模型`,
                        modelCount: modelCount,
                        responseFormat: data.data ? 'openai' : (data.models ? 'custom' : 'unknown')
                    };
                } catch (parseError) {
                    console.warn('[OpenAIProvider] ⚠️ 响应解析失败，但连接成功:', parseError);
                    return { 
                        success: true, 
                        details: 'API连接成功，但响应格式可能不标准',
                        warning: parseError.message
                    };
                }
            } else {
                // 🔧 专门处理401未授权错误
                if (response.status === 401) {
                    let errorData = '';
                    try {
                        errorData = await response.text();
                        console.error('[OpenAIProvider] ❌ 401未授权错误 - 详细信息:', errorData);
                    } catch (e) {
                        console.warn('[OpenAIProvider] ⚠️ 无法读取401错误响应');
                    }
                    
                    return {
                        success: false,
                        error: `API认证失败: 您的API Key无效或已过期。请检查以下项目：
1. API Key是否正确配置 (当前长度: ${this.apiKey?.length || 0})
2. API Key是否有访问权限
3. 反代服务器是否正确转发Authorization头部
4. 服务器端点地址是否正确: ${this.endpoint}
技术详情: HTTP ${response.status} ${response.statusText}${errorData ? ' - ' + errorData.substring(0, 200) : ''}`,
                        status: response.status,
                        endpoint: this.endpoint
                    };
                }
                
                // 详细的错误信息
                let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.text();
                    if (errorData) {
                        console.error('[OpenAIProvider] ❌ 错误响应内容:', errorData);
                        errorDetails += ` - ${errorData.substring(0, 200)}`;
                    }
                } catch (e) {
                    console.warn('[OpenAIProvider] ⚠️ 无法读取错误响应内容');
                }
                
                return { success: false, error: errorDetails };
            }
        } catch (error) {
            console.error('[OpenAIProvider] ❌ 连接测试异常:', error);
            
            // 检查是否是CORS错误
            if (error.name === 'CORSBlockedError' || error.message.includes('CORS跨域访问被阻止')) {
                return {
                    success: false,
                    error: error.message,
                    corsError: true,
                    userFriendly: true,
                    technicalDetails: {
                        name: error.name,
                        hostname: error.hostname,
                        endpoint: this.endpoint
                    }
                };
            }
            
            // 提供更详细的错误信息
            let errorMessage = error.message;
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = '网络连接失败，请检查API端点地址是否正确（可能是CORS问题）';
            } else if (error.name === 'AbortError') {
                errorMessage = '请求超时，API服务器响应时间过长';
            }
            
            return { 
                success: false, 
                error: errorMessage,
                technicalDetails: {
                    name: error.name,
                    message: error.message,
                    endpoint: this.endpoint
                }
            };
        }
    }

    async generateText(prompt, options) {
        try {
            console.log('[OpenAIProvider] 🚀 开始生成文本...');
            console.log('[OpenAIProvider] 📊 使用模型:', options.model);
            
            const requestBody = {
                model: options.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: options.temperature,
                max_tokens: options.maxTokens
            };
            
            // 添加有用的调试信息
            console.log('[OpenAIProvider] 📝 请求参数:', {
                endpoint: `${this.endpoint}/v1/chat/completions`,
                model: requestBody.model,
                temperature: requestBody.temperature,
                max_tokens: requestBody.max_tokens,
                promptLength: prompt.length
            });

            // 使用CORS兼容的fetch
            const response = await this.apiIntegration.proxyCompatibleFetch(
                `${this.endpoint}/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                        'User-Agent': 'SillyTavern-InfoBar/1.0'
                    },
                    body: JSON.stringify(requestBody),
                    timeout: 30000 // 30秒超时
                }
            );
            
            console.log('[OpenAIProvider] 📊 生成响应状态:', response.status);
            
            // 🔧 处理CORS模拟响应
            if (response._isOpaqueResponse) {
                console.log('[OpenAIProvider] 🎭 检测到CORS模拟响应，生成失败');
                return {
                    success: false,
                    error: 'CORS跨域错误：无法生成文本，请配置反代服务器的CORS头。',
                    corsError: true
                };
            }

            if (!response.ok) {
                // 详细的错误处理
                let errorDetail = '';
                try {
                    const errorData = await response.text();
                    errorDetail = errorData.substring(0, 300);
                    console.error('[OpenAIProvider] ❌ 生成错误响应:', errorDetail);
                } catch (e) {
                    console.warn('[OpenAIProvider] ⚠️ 无法读取错误响应');
                }
                
                const error = new Error(`OpenAI API错误: ${response.status} ${response.statusText}${errorDetail ? ' - ' + errorDetail : ''}`);
                error.status = response.status;
                error.statusText = response.statusText;
                error.endpoint = this.endpoint;
                throw error;
            }

            const data = await response.json();
            console.log('[OpenAIProvider] 📊 响应数据结构:', Object.keys(data));
            
            // 兼容性处理不同的响应格式
            let generatedText = '';
            let usage = null;
            
            if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
                // 标准OpenAI格式
                const choice = data.choices[0];
                if (choice.message && choice.message.content) {
                    generatedText = choice.message.content;
                } else if (choice.text) {
                    // 某些兼容实现使用text字段
                    generatedText = choice.text;
                }
                usage = data.usage;
            } else if (data.content) {
                // 直接content字段
                generatedText = data.content;
            } else if (data.text) {
                // 直接text字段
                generatedText = data.text;
            } else if (data.response) {
                // response字段
                generatedText = data.response;
            } else {
                console.warn('[OpenAIProvider] ⚠️ 未识别的响应格式:', JSON.stringify(data, null, 2));
                throw new Error('无法从响应中提取生成的文本');
            }
            
            if (!generatedText || generatedText.trim() === '') {
                console.warn('[OpenAIProvider] ⚠️ 生成的文本为空');
                throw new Error('生成的文本为空');
            }
            
            console.log(`[OpenAIProvider] ✅ 文本生成成功，长度: ${generatedText.length} 字符`);
            
            return {
                success: true,
                text: generatedText,
                usage: usage
            };
            
        } catch (error) {
            console.error('[OpenAIProvider] ❌ 生成文本异常:', error);
            
            // 检查是否是CORS错误
            if (error.name === 'CORSBlockedError' || error.message.includes('CORS跨域访问被阻止')) {
                return {
                    success: false,
                    error: error.message,
                    corsError: true,
                    userFriendly: true,
                    technicalDetails: {
                        name: error.name,
                        hostname: error.hostname,
                        endpoint: error.endpoint
                    }
                };
            }
            
            return {
                success: false,
                error: error.message,
                technicalDetails: {
                    name: error.name,
                    status: error.status,
                    endpoint: error.endpoint
                }
            };
        }
    }

    async loadModels() {
        try {
            console.log('[OpenAIProvider] 📋 开始加载模型列表...');
            
            // 🔧 改进的URL拼接逻辑
            let endpoint = this.endpoint.trim();
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.slice(0, -1);
            }
            const modelsUrl = `${endpoint}/v1/models`;
            console.log('[OpenAIProvider] 🔗 请求端点:', modelsUrl);
            
            // 🔧 API Key验证和调试信息
            if (!this.apiKey || this.apiKey.trim() === '') {
                console.error('[OpenAIProvider] ❌ API Key未设置或为空');
                throw new Error('API Key未设置，请在扩展设置中配置有效的API Key');
            }
            
            const apiKeyLength = this.apiKey.length;
            const apiKeyPreview = this.apiKey.substring(0, 8) + '***' + this.apiKey.slice(-4);
            console.log(`[OpenAIProvider] 🔑 API Key信息: 长度=${apiKeyLength}, 预览=${apiKeyPreview}`);
            
            // 使用CORS兼容的fetch
            const response = await this.apiIntegration.proxyCompatibleFetch(
                modelsUrl,
                {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'SillyTavern-InfoBar/1.0'
                    },
                    timeout: 15000 // 15秒超时
                }
            );
            
            console.log('[OpenAIProvider] 📊 模型列表响应状态:', response.status);
            
            // 🔧 处理CORS模拟响应
            if (response._isOpaqueResponse) {
                console.log('[OpenAIProvider] 🎭 检测到CORS模拟响应，使用降级模型列表');
                const corsAwareFallbackModels = [
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' },
                    { id: 'gpt-4', name: 'GPT-4 (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' }
                ];
                console.log(`[OpenAIProvider] ✅ 返回 ${corsAwareFallbackModels.length} 个CORS降级模型`);
                return corsAwareFallbackModels;
            }
            
            if (!response.ok) {
                // 🔧 专门处理401未授权错误
                if (response.status === 401) {
                    let errorDetail = '';
                    try {
                        const errorData = await response.text();
                        errorDetail = errorData.substring(0, 200);
                        console.error('[OpenAIProvider] ❌ 401未授权错误 - 详细信息:', errorDetail);
                    } catch (e) {
                        console.warn('[OpenAIProvider] ⚠️ 无法读取401错误响应');
                    }
                    
                    throw new Error(`API认证失败: 您的API Key无效或已过期。请检查以下项目：
1. API Key是否正确配置 (当前长度: ${this.apiKey?.length || 0})
2. API Key是否有访问模型列表的权限
3. 反代服务器是否正确转发Authorization头部
4. 服务器端点地址是否正确: ${this.endpoint}
技术详情: ${response.status} ${response.statusText}${errorDetail ? ' - ' + errorDetail : ''}`);
                }
                
                // 尝试获取详细错误信息
                let errorDetail = '';
                try {
                    const errorData = await response.text();
                    errorDetail = errorData.substring(0, 200);
                    console.error('[OpenAIProvider] ❌ 模型列表错误响应:', errorDetail);
                } catch (e) {
                    console.warn('[OpenAIProvider] ⚠️ 无法读取错误响应');
                }
                
                throw new Error(`加载模型失败: HTTP ${response.status} ${response.statusText}${errorDetail ? ' - ' + errorDetail : ''}`);
            }
            
            const data = await response.json();
            console.log('[OpenAIProvider] 📊 原始响应数据结构:', Object.keys(data));
            
            let models = [];
            
            // 兼容多种响应格式
            if (data.data && Array.isArray(data.data)) {
                // 标准OpenAI格式: { "data": [...] }
                console.log('[OpenAIProvider] 📋 检测到标准OpenAI格式');
                models = data.data.map(model => ({
                    id: model.id || model.model || 'unknown',
                    name: model.id || model.model || model.name || 'Unknown Model',
                    description: model.description || model.id || model.model || ''
                }));
            } else if (data.models && Array.isArray(data.models)) {
                // 某些反代使用的格式: { "models": [...] }
                console.log('[OpenAIProvider] 📋 检测到自定义models格式');
                models = data.models.map(model => ({
                    id: model.id || model.model || model.name || 'unknown',
                    name: model.name || model.id || model.model || 'Unknown Model',
                    description: model.description || model.id || ''
                }));
            } else if (Array.isArray(data)) {
                // 直接数组格式: [...]
                console.log('[OpenAIProvider] 📋 检测到直接数组格式');
                models = data.map(model => ({
                    id: model.id || model.model || model.name || 'unknown',
                    name: model.name || model.id || model.model || 'Unknown Model',
                    description: model.description || model.id || ''
                }));
            } else {
                // 未知格式，尝试降级处理
                console.warn('[OpenAIProvider] ⚠️ 未识别的响应格式，尝试降级处理');
                console.log('[OpenAIProvider] 🔍 响应数据:', JSON.stringify(data, null, 2));
                
                // 尝试从任何字段中提取模型信息
                const possibleModels = [];
                for (const [key, value] of Object.entries(data)) {
                    if (Array.isArray(value)) {
                        console.log(`[OpenAIProvider] 🔍 尝试从字段 '${key}' 提取模型`);
                        possibleModels.push(...value);
                    }
                }
                
                if (possibleModels.length > 0) {
                    models = possibleModels.map((model, index) => {
                        if (typeof model === 'string') {
                            return { id: model, name: model, description: model };
                        } else if (typeof model === 'object' && model !== null) {
                            return {
                                id: model.id || model.model || model.name || `model_${index}`,
                                name: model.name || model.id || model.model || `Model ${index + 1}`,
                                description: model.description || model.id || ''
                            };
                        }
                        return { id: `model_${index}`, name: `Model ${index + 1}`, description: '' };
                    });
                } else {
                    // 完全无法解析，提供默认模型列表
                    console.warn('[OpenAIProvider] ⚠️ 无法解析任何模型，使用默认列表');
                    models = [
                        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (默认)', description: '默认模型' },
                        { id: 'gpt-4', name: 'GPT-4 (默认)', description: '默认模型' }
                    ];
                }
            }
            
            // 过滤和验证模型列表
            models = models.filter(model => 
                model && 
                typeof model === 'object' && 
                model.id && 
                typeof model.id === 'string' &&
                model.id.trim() !== ''
            );
            
            console.log(`[OpenAIProvider] ✅ 成功加载 ${models.length} 个模型:`);
            models.forEach((model, index) => {
                console.log(`[OpenAIProvider] 📋 模型 ${index + 1}: ${model.id} (${model.name})`);
            });
            
            return models;
            
        } catch (error) {
            console.error('[OpenAIProvider] ❌ 加载模型列表异常:', error);
            
            // 检查是否是CORS错误  
            if (error.name === 'CORSBlockedError' || error.message.includes('CORS跨域访问被阻止')) {
                console.log('[OpenAIProvider] 🚨 检测到CORS错误，提供CORS降级模型列表');
                const corsAwareFallbackModels = [
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' },
                    { id: 'gpt-4', name: 'GPT-4 (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (跨域降级)', description: 'CORS错误时的默认模型，请配置反代CORS头' }
                ];
                
                const corsError = new Error(error.message + ' - 已提供降级模型列表');
                corsError.fallbackModels = corsAwareFallbackModels;
                corsError.corsError = true;
                corsError.userFriendly = true;
                corsError.originalError = error;
                throw corsError;
            }
            
            // 提供降级的模型列表
            console.log('[OpenAIProvider] 🔄 提供降级模型列表');
            const fallbackModels = [
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (降级)', description: '连接失败时的默认模型' },
                { id: 'gpt-4', name: 'GPT-4 (降级)', description: '连接失败时的默认模型' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (降级)', description: '连接失败时的默认模型' }
            ];
            
            // 重新抛出错误，但附加降级信息
            const enhancedError = new Error(`${error.message} - 已提供降级模型列表`);
            enhancedError.fallbackModels = fallbackModels;
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }
}
