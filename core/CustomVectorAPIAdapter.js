/**
 * 🚀 自定义向量API适配器
 * 用于连接外部向量化API服务
 * 
 * 功能增强：
 * - 获取API提供的模型列表
 * - 筛选embedding模型
 * - 向量化数据处理
 * - 支持OpenAI兼容API
 */
export class CustomVectorAPIAdapter {
    constructor(config = {}) {
        this.config = {
            url: config.url || '',
            apiKey: config.apiKey || '',
            model: config.model || 'text-embedding-ada-002',
            timeout: config.timeout || 9999000, // 默认9999秒，转换为毫秒
            maxRetries: config.maxRetries || 3,
            // 🆕 新增：API类型配置
            apiType: config.apiType || 'openai', // openai, ollama, custom
            modelsEndpoint: config.modelsEndpoint || '/v1/models', // 模型列表端点
            embeddingsEndpoint: config.embeddingsEndpoint || '/v1/embeddings' // 向量化端点
        };

        this.stats = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            totalLatency: 0
        };

        // 🆕 模型缓存
        this.cachedModels = null;
        this.cachedEmbeddingModels = null;
        this.modelsCacheTime = 0;
        this.modelsCacheDuration = 5 * 60 * 1000; // 5分钟缓存

        // 🔧 SillyTavern上下文（用于获取请求头）
        this.context = null;
        
        this.initialized = false;
        console.log('[CustomVectorAPIAdapter] 🚀 自定义向量API适配器初始化');
    }
    
    /**
     * 🔧 设置SillyTavern上下文
     */
    setContext(context) {
        this.context = context;
        console.log('[CustomVectorAPIAdapter] 🔧 已设置SillyTavern上下文');
    }
    
    /**
     * 🔧 获取请求头（参考VectorAPIAdapter实现）
     */
    getRequestHeaders() {
        if (this.context && typeof this.context.getRequestHeaders === 'function') {
            return this.context.getRequestHeaders();
        }
        // 降级方案
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initialized = !!(this.config.url && this.config.apiKey);
        console.log('[CustomVectorAPIAdapter] 🔧 配置已更新:', {
            url: this.config.url,
            model: this.config.model,
            initialized: this.initialized
        });
    }

    /**
     * 检查配置是否有效
     */
    isConfigValid() {
        return !!(this.config.url && this.config.apiKey);
    }

    /**
     * 🆕 获取模型列表
     * @param {boolean} refresh - 是否强制刷新缓存
     * @returns {Promise<Array>} 模型列表
     */
    async getModels(refresh = false) {
        if (!this.isConfigValid()) {
            throw new Error('自定义向量API配置无效：缺少URL或API密钥');
        }

        // 检查缓存
        const now = Date.now();
        if (!refresh && this.cachedModels && (now - this.modelsCacheTime) < this.modelsCacheDuration) {
            console.log('[CustomVectorAPIAdapter] 📦 使用缓存的模型列表');
            return this.cachedModels;
        }

        try {
            console.log('[CustomVectorAPIAdapter] 📥 获取模型列表...');

            // 🔧 修复：智能检测API类型并构建模型列表URL
            const baseUrl = this.config.url.replace(/\/+$/, ''); // 移除末尾斜杠
            let modelsUrl;
            let requestMethod = 'GET';
            let requestBody = null;

            // 检测API类型
            if (baseUrl.includes('ollama') || baseUrl.includes(':11434')) {
                // Ollama格式
                modelsUrl = `${baseUrl}/api/tags`;
            } else if (baseUrl.includes('huggingface')) {
                // HuggingFace格式 - 通常不提供模型列表API
                console.warn('[CustomVectorAPIAdapter] ⚠️ HuggingFace API通常不提供模型列表');
                return [];
            } else if (baseUrl.includes('openai.com') || baseUrl.endsWith('/v1')) {
                // OpenAI兼容格式 - baseUrl已经包含/v1
                modelsUrl = `${baseUrl}/models`;
            } else {
                // 默认尝试OpenAI格式 - baseUrl不包含/v1，需要添加
                modelsUrl = `${baseUrl}/v1/models`;
            }

            // 🔧 使用智能代理策略（参考APIIntegration的实现）
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 添加Authorization头
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            console.log('[CustomVectorAPIAdapter] 🔧 检测API类型并请求:', modelsUrl);

            const response = await this.smartFetch(modelsUrl, {
                method: requestMethod,
                headers: headers,
                body: requestBody ? JSON.stringify(requestBody) : undefined
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取模型列表失败 (HTTP ${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // 解析模型列表（支持不同API格式）
            let models = [];
            if (data.data && Array.isArray(data.data)) {
                // OpenAI格式
                models = data.data;
            } else if (data.models && Array.isArray(data.models)) {
                // Ollama格式
                models = data.models.map(m => ({
                    id: m.name || m.model || m.id,
                    object: 'model',
                    created: m.modified_at || Date.now(),
                    owned_by: m.details?.family || 'unknown'
                }));
            } else if (data.tags && Array.isArray(data.tags)) {
                // Ollama tags格式
                models = data.tags.map(tag => ({
                    id: tag.name,
                    name: tag.name,
                    object: 'model',
                    owned_by: 'ollama'
                }));
            } else if (Array.isArray(data)) {
                // 直接数组格式
                models = data.map(m => {
                    if (typeof m === 'string') {
                        return { id: m, object: 'model' };
                    }
                    return m;
                });
            } else {
                console.warn('[CustomVectorAPIAdapter] ⚠️ 未知的模型列表格式，尝试手动添加一些常见的embedding模型');
                // 如果无法获取模型列表，提供一些常见的embedding模型选项
                models = [
                    { id: 'text-embedding-ada-002', object: 'model', owned_by: 'openai' },
                    { id: 'text-embedding-3-small', object: 'model', owned_by: 'openai' },
                    { id: 'text-embedding-3-large', object: 'model', owned_by: 'openai' },
                    { id: 'nomic-embed-text', object: 'model', owned_by: 'ollama' },
                    { id: 'mxbai-embed-large', object: 'model', owned_by: 'ollama' },
                    { id: 'all-minilm', object: 'model', owned_by: 'ollama' }
                ];
            }

            // 缓存结果
            this.cachedModels = models;
            this.modelsCacheTime = now;

            console.log(`[CustomVectorAPIAdapter] ✅ 获取到 ${models.length} 个模型`);
            return models;

        } catch (error) {
            console.error('[CustomVectorAPIAdapter] ❌ 获取模型列表失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 获取embedding模型列表（筛选）
     * @param {boolean} refresh - 是否强制刷新缓存
     * @returns {Promise<Array>} embedding模型列表
     */
    async getEmbeddingModels(refresh = false) {
        if (!refresh && this.cachedEmbeddingModels && 
            (Date.now() - this.modelsCacheTime) < this.modelsCacheDuration) {
            console.log('[CustomVectorAPIAdapter] 📦 使用缓存的embedding模型列表');
            return this.cachedEmbeddingModels;
        }

        try {
            const allModels = await this.getModels(refresh);

            // 筛选embedding模型的关键词
            const embeddingKeywords = [
                'embed',
                'embedding',
                'ada',
                'text-embedding',
                'bge',
                'gte',
                'mxbai',
                'jina',
                'voyage',
                'e5',
                'instructor',
                'snowflake',
                'nomic'
            ];

            const embeddingModels = allModels.filter(model => {
                const modelId = (model.id || model.name || '').toLowerCase();
                
                // 检查是否包含embedding关键词
                const isEmbedding = embeddingKeywords.some(keyword => 
                    modelId.includes(keyword)
                );

                // 排除chat/completion模型
                const isChatModel = modelId.includes('chat') || 
                                   modelId.includes('gpt-') || 
                                   modelId.includes('turbo') ||
                                   modelId.includes('davinci');

                return isEmbedding && !isChatModel;
            });

            // 缓存结果
            this.cachedEmbeddingModels = embeddingModels;

            console.log(`[CustomVectorAPIAdapter] ✅ 筛选出 ${embeddingModels.length} 个embedding模型`);
            console.log('[CustomVectorAPIAdapter] 📋 模型列表:', 
                embeddingModels.map(m => m.id).join(', '));

            return embeddingModels;

        } catch (error) {
            console.error('[CustomVectorAPIAdapter] ❌ 获取embedding模型列表失败:', error);
            throw error;
        }
    }

    /**
     * 向量化文本
     */
    async vectorizeText(text) {
        if (!this.isConfigValid()) {
            throw new Error('自定义向量API配置无效：缺少URL或API密钥');
        }

        const startTime = Date.now();
        this.stats.requestCount++;

        try {
            console.log('[CustomVectorAPIAdapter] 📤 发送向量化请求:', {
                textLength: text.length,
                model: this.config.model
            });

            // 🔧 修复：智能检测API类型和构建请求
            const baseUrl = this.config.url.replace(/\/+$/, '');
            let embeddingsUrl;
            let requestBody;

            // 检测API类型
            if (baseUrl.includes('ollama') || baseUrl.includes(':11434')) {
                // Ollama格式
                embeddingsUrl = `${baseUrl}/api/embeddings`;
                requestBody = {
                    model: this.config.model || 'nomic-embed-text',
                    prompt: text
                };
            } else if (baseUrl.includes('huggingface')) {
                // HuggingFace格式
                embeddingsUrl = baseUrl;
                requestBody = {
                    inputs: text
                };
            } else if (baseUrl.endsWith('/embeddings')) {
                // 用户已经提供了完整的embeddings端点
                embeddingsUrl = baseUrl;
                requestBody = {
                    input: text,
                    model: this.config.model
                };
            } else if (baseUrl.includes('openai.com') || baseUrl.endsWith('/v1')) {
                // OpenAI兼容格式 - baseUrl已经包含/v1
                embeddingsUrl = `${baseUrl}/embeddings`;
                requestBody = {
                    input: text,
                    model: this.config.model || 'text-embedding-ada-002'
                };
            } else if (baseUrl.includes('gemini') || baseUrl.includes('google')) {
                // Google/Gemini格式
                embeddingsUrl = `${baseUrl}/v1/embeddings`;
                requestBody = {
                    input: text,
                    model: this.config.model || 'embedding-001'
                };
            } else {
                // 默认OpenAI格式 - baseUrl不包含/v1，需要添加
                embeddingsUrl = `${baseUrl}/v1/embeddings`;
                requestBody = {
                    input: text,
                    model: this.config.model
                };
            }

            console.log('[CustomVectorAPIAdapter] 🔧 使用端点:', embeddingsUrl);
            console.log('[CustomVectorAPIAdapter] 📦 请求体:', requestBody);

            const response = await this.makeEmbeddingRequest(embeddingsUrl, requestBody);

            // 🔧 修复：智能解析不同格式的响应
            let vector;
            
            // OpenAI格式
            if (response.data && response.data[0] && response.data[0].embedding) {
                vector = response.data[0].embedding;
            }
            // Ollama格式
            else if (response.embedding) {
                vector = response.embedding;
            }
            // HuggingFace格式
            else if (Array.isArray(response) && response.length > 0) {
                vector = response;
            }
            // 直接返回向量数组
            else if (response.embeddings && Array.isArray(response.embeddings)) {
                vector = response.embeddings[0] || response.embeddings;
            }
            // Gemini格式
            else if (response.values && Array.isArray(response.values)) {
                vector = response.values;
            }
            else {
                console.error('[CustomVectorAPIAdapter] ❌ 未知的响应格式:', response);
                throw new Error('API返回的数据格式无效，无法解析向量');
            }

            // 验证向量
            if (!Array.isArray(vector) || vector.length === 0) {
                throw new Error('返回的向量无效或为空');
            }

            const latency = Date.now() - startTime;

            this.stats.successCount++;
            this.stats.totalLatency += latency;

            console.log('[CustomVectorAPIAdapter] ✅ 向量化成功:', {
                vectorDimensions: vector.length,
                latency: `${latency}ms`
            });

            return vector;

        } catch (error) {
            this.stats.errorCount++;
            console.error('[CustomVectorAPIAdapter] ❌ 向量化失败:', error);
            
            // 🔧 添加更详细的错误信息
            if (error.message.includes('400')) {
                console.error('[CustomVectorAPIAdapter] 💡 可能的原因：');
                console.error('1. 模型名称不正确');
                console.error('2. API格式不匹配');
                console.error('3. 请求体结构错误');
                console.error('4. API密钥无效');
            }
            
            throw error;
        }
    }

    /**
     * 批量向量化文本
     */
    async vectorizeBatch(texts) {
        if (!this.isConfigValid()) {
            throw new Error('自定义向量API配置无效：缺少URL或API密钥');
        }

        const startTime = Date.now();
        this.stats.requestCount++;

        try {
            console.log('[CustomVectorAPIAdapter] 📤 发送批量向量化请求:', {
                count: texts.length,
                model: this.config.model
            });

            // 构建向量化URL
            const baseUrl = this.config.url.replace(/\/+$/, '');
            const embeddingsUrl = `${baseUrl}${this.config.embeddingsEndpoint}`;

            const response = await this.makeEmbeddingRequest(embeddingsUrl, {
                input: texts,
                model: this.config.model
            });

            if (!response || !response.data || !Array.isArray(response.data)) {
                throw new Error('API返回的数据格式无效');
            }

            const vectors = response.data.map(item => item.embedding);
            const latency = Date.now() - startTime;

            this.stats.successCount++;
            this.stats.totalLatency += latency;

            console.log('[CustomVectorAPIAdapter] ✅ 批量向量化成功:', {
                count: vectors.length,
                latency: `${latency}ms`
            });

            return vectors;

        } catch (error) {
            this.stats.errorCount++;
            console.error('[CustomVectorAPIAdapter] ❌ 批量向量化失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 智能fetch（多层代理策略）
     * 参考APIIntegration的proxyCompatibleFetch实现
     */
    async smartFetch(url, options = {}) {
        console.log('[CustomVectorAPIAdapter] 🔄 开始智能fetch:', url);
        
        // 策略1: 尝试直接请求
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            
            const response = await fetch(url, {
                ...options,
                mode: 'cors',
                credentials: 'omit',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // 直接请求成功
            if (response.ok || response.status === 401 || response.status === 403) {
                console.log('[CustomVectorAPIAdapter] ✅ 直接请求成功');
                return response;
            }
        } catch (directError) {
            console.log('[CustomVectorAPIAdapter] ⚠️ 直接请求失败，尝试公共代理:', directError.message);
        }
        
        // 策略2: 使用公共CORS代理
        const publicProxies = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url='
        ];
        
        for (const proxyPrefix of publicProxies) {
            try {
                const proxyUrl = proxyPrefix + encodeURIComponent(url);
                console.log(`[CustomVectorAPIAdapter] 🔄 尝试代理: ${proxyPrefix}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                
                const response = await fetch(proxyUrl, {
                    ...options,
                    mode: 'cors',
                    credentials: 'omit',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok || response.status === 401 || response.status === 403) {
                    console.log(`[CustomVectorAPIAdapter] ✅ 代理请求成功: ${proxyPrefix}`);
                    return response;
                }
            } catch (proxyError) {
                console.log(`[CustomVectorAPIAdapter] ⚠️ 代理 ${proxyPrefix} 失败:`, proxyError.message);
            }
        }
        
        // 所有策略都失败
        throw new Error('无法访问API：直接请求和所有公共代理都失败。请检查API地址或配置反向代理。');
    }

    /**
     * 🆕 发送embedding请求（专用于向量化）
     * 🔧 使用智能代理策略
     */
    async makeEmbeddingRequest(url, data, retryCount = 0) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // 添加Authorization头
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            const response = await this.smartFetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();

        } catch (error) {
            // 重试逻辑
            if (retryCount < this.config.maxRetries) {
                console.warn(`[CustomVectorAPIAdapter] ⚠️ 请求失败，重试 ${retryCount + 1}/${this.config.maxRetries}`);
                await this.delay(1000 * (retryCount + 1)); // 指数退避
                return this.makeEmbeddingRequest(url, data, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * 发送HTTP请求（通用）
     */
    async makeRequest(url, data, retryCount = 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();

        } catch (error) {
            // 重试逻辑
            if (retryCount < this.config.maxRetries) {
                console.warn(`[CustomVectorAPIAdapter] ⚠️ 请求失败，重试 ${retryCount + 1}/${this.config.maxRetries}`);
                await this.delay(1000 * (retryCount + 1)); // 指数退避
                return this.makeRequest(url, data, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const avgLatency = this.stats.requestCount > 0 
            ? Math.round(this.stats.totalLatency / this.stats.requestCount) 
            : 0;

        return {
            ...this.stats,
            averageLatency: avgLatency,
            successRate: this.stats.requestCount > 0 
                ? Math.round((this.stats.successCount / this.stats.requestCount) * 100) 
                : 0
        };
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            totalLatency: 0
        };
        console.log('[CustomVectorAPIAdapter] 🔄 统计信息已重置');
    }

    /**
     * 🆕 清除模型缓存
     */
    clearModelsCache() {
        this.cachedModels = null;
        this.cachedEmbeddingModels = null;
        this.modelsCacheTime = 0;
        console.log('[CustomVectorAPIAdapter] 🧹 模型缓存已清除');
    }

    /**
     * 测试连接
     */
    async testConnection() {
        try {
            console.log('[CustomVectorAPIAdapter] 🔍 测试连接...');
            
            const testText = 'Hello, this is a test.';
            const vector = await this.vectorizeText(testText);

            if (vector && Array.isArray(vector) && vector.length > 0) {
                console.log('[CustomVectorAPIAdapter] ✅ 连接测试成功');
                return {
                    success: true,
                    vectorDimensions: vector.length,
                    message: '连接成功'
                };
            } else {
                throw new Error('返回的向量无效');
            }

        } catch (error) {
            console.error('[CustomVectorAPIAdapter] ❌ 连接测试失败:', error);
            return {
                success: false,
                error: error.message,
                message: '连接失败'
            };
        }
    }

    /**
     * 🆕 测试连接并获取模型列表
     */
    async testConnectionAndGetModels() {
        try {
            console.log('[CustomVectorAPIAdapter] 🔍 测试连接并获取模型列表...');
            
            // 1. 测试向量化功能
            const testText = 'Hello, this is a test.';
            const vector = await this.vectorizeText(testText);

            if (!vector || !Array.isArray(vector) || vector.length === 0) {
                throw new Error('向量化测试失败：返回的向量无效');
            }

            // 2. 获取embedding模型列表
            const embeddingModels = await this.getEmbeddingModels(true); // 强制刷新

            console.log('[CustomVectorAPIAdapter] ✅ 连接测试成功');
            return {
                success: true,
                vectorDimensions: vector.length,
                embeddingModels: embeddingModels,
                modelCount: embeddingModels.length,
                currentModel: this.config.model,
                message: `连接成功，找到 ${embeddingModels.length} 个embedding模型`
            };

        } catch (error) {
            console.error('[CustomVectorAPIAdapter] ❌ 连接测试失败:', error);
            return {
                success: false,
                error: error.message,
                message: '连接失败'
            };
        }
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            configValid: this.isConfigValid(),
            url: this.config.url,
            model: this.config.model,
            stats: this.getStats(),
            cachedModelsCount: this.cachedEmbeddingModels?.length || 0,
            cacheValid: this.modelsCacheTime > 0 && 
                       (Date.now() - this.modelsCacheTime) < this.modelsCacheDuration
        };
    }
}

