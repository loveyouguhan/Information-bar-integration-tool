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
        
        // API提供商
        this.providers = {
            gemini: new GeminiProvider(),
            openai: new OpenAIProvider()
        };
        
        // 当前提供商
        this.currentProvider = null;
        
        // 请求统计
        this.requestStats = {
            total: 0,
            success: 0,
            failed: 0,
            retries: 0
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
                    await this.configManager.getConfig('apiConfig.extraPrompt')
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
            
            // 添加额外提示词
            if (this.apiConfig.extraPrompt) {
                prompt = `${this.apiConfig.extraPrompt}\n\n${prompt}`;
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
            const models = await this.currentProvider.loadModels();
            
            // 更新缓存
            this.modelCache.set(cacheKey, {
                models,
                timestamp: Date.now()
            });
            
            console.log(`[APIIntegration] ✅ 加载了 ${models.length} 个模型`);
            return models;
            
        } catch (error) {
            console.error('[APIIntegration] ❌ 加载模型列表失败:', error);
            this.handleError(error);
            return [];
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
            retries: 0
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
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[APIIntegration] ❌ 错误 #${this.errorCount}:`, error);
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
}

/**
 * Gemini API提供商
 */
class GeminiProvider {
    constructor() {
        this.name = 'gemini';
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    }

    async init(config) {
        this.config = config;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint || this.baseURL;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.endpoint}/models?key=${this.apiKey}`);
            
            if (response.ok) {
                return { success: true, details: 'Gemini API连接正常' };
            } else {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
        } catch (error) {
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
        const response = await fetch(`${this.endpoint}/models?key=${this.apiKey}`);
        
        if (!response.ok) {
            throw new Error(`加载模型失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.models?.map(model => ({
            id: model.name,
            name: model.displayName,
            description: model.description
        })) || [];
    }
}

/**
 * OpenAI兼容API提供商
 */
class OpenAIProvider {
    constructor() {
        this.name = 'openai';
    }

    async init(config) {
        this.config = config;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.endpoint}/v1/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            
            if (response.ok) {
                return { success: true, details: 'OpenAI兼容API连接正常' };
            } else {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async generateText(prompt, options) {
        const requestBody = {
            model: options.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature,
            max_tokens: options.maxTokens
        };

        const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            text: data.choices?.[0]?.message?.content || '',
            usage: data.usage
        };
    }

    async loadModels() {
        const response = await fetch(`${this.endpoint}/v1/models`, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        
        if (!response.ok) {
            throw new Error(`加载模型失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data?.map(model => ({
            id: model.id,
            name: model.id,
            description: model.id
        })) || [];
    }
}
