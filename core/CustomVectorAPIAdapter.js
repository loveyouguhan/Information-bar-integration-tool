/**
 * 🚀 自定义向量API适配器
 * 用于连接外部向量化API服务
 */
export class CustomVectorAPIAdapter {
    constructor(config = {}) {
        this.config = {
            url: config.url || '',
            apiKey: config.apiKey || '',
            model: config.model || 'text-embedding-ada-002',
            timeout: config.timeout || 30000,
            maxRetries: config.maxRetries || 3
        };

        this.stats = {
            requestCount: 0,
            successCount: 0,
            errorCount: 0,
            totalLatency: 0
        };

        this.initialized = false;
        console.log('[CustomVectorAPIAdapter] 🚀 自定义向量API适配器初始化');
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

            const response = await this.makeRequest({
                input: text,
                model: this.config.model
            });

            if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
                throw new Error('API返回的数据格式无效');
            }

            const vector = response.data[0].embedding;
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

            const response = await this.makeRequest({
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
     * 发送HTTP请求
     */
    async makeRequest(data, retryCount = 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(this.config.url, {
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
                return this.makeRequest(data, retryCount + 1);
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
     * 获取状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            configValid: this.isConfigValid(),
            url: this.config.url,
            model: this.config.model,
            stats: this.getStats()
        };
    }
}

