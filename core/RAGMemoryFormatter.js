/**
 * RAG记忆格式化增强器
 * 
 * 基于SillyTavern RAG最佳实践的记忆格式化系统：
 * - 过去时态、第三人称视角格式化
 * - 时间和位置上下文明确标注
 * - 信息密度优化
 * - 避免与当前聊天语法混淆
 * - 智能块大小控制
 * 
 * 参考资料：
 * - SillyTavern Data Bank 最佳实践
 * - RAG检索优化策略
 * - Ebbinghaus遗忘曲线应用
 * 
 * @class RAGMemoryFormatter
 */

export class RAGMemoryFormatter {
    constructor(unifiedDataCore, eventSystem) {
        console.log('[RAGMemoryFormatter] 🎨 RAG记忆格式化增强器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        
        // RAG格式化设置
        this.settings = {
            enabled: true,                          // 启用RAG格式化
            
            // 格式化策略
            usePastTense: true,                     // 使用过去时态
            useThirdPerson: true,                   // 使用第三人称视角
            addTimeContext: true,                   // 添加时间上下文
            addLocationContext: true,               // 添加位置上下文
            addEmotionalContext: false,             // 添加情感上下文
            
            // 块大小控制（基于512 token嵌入模型）
            minChunkSize: 1024,                     // 最小块大小（字符）>50%最大块
            maxChunkSize: 2048,                     // 最大块大小（字符）<嵌入模型上下文
            targetChunkSize: 1500,                  // 目标块大小（字符）
            chunkOverlap: 0,                        // 块重叠比例（0-100%）
            
            // 信息密度优化
            removeFluff: true,                      // 移除冗余表述
            extractKeyInfo: true,                   // 提取关键信息
            prioritizeImportance: true,             // 优先重要信息
            
            // 时间标注格式
            timeFormat: 'relative',                 // 时间格式：relative, absolute, hybrid
            relativeTimeUnits: ['天前', '周前', '月前', '年前'],
            absoluteTimeFormat: 'YYYY-MM-DD HH:mm',
            
            // 模板配置
            useCustomTemplate: true,                // 使用自定义模板
            templateFormat: 'detailed'              // 模板格式：simple, detailed, narrative
        };
        
        // 格式化模板库
        this.templates = {
            // 简单模板
            simple: {
                prefix: '[这些是{{char}}对过去事件的记忆；{{char}}记得这些记忆；]',
                context: '[{{timeContext}}{{locationContext}}]',
                content: '{{formattedContent}}',
                suffix: ''
            },
            
            // 详细模板
            detailed: {
                prefix: '[以下是{{char}}对过去事件的记忆。这些记忆以第三人称视角、过去时态记录。{{char}}能够回忆起这些记忆。]',
                context: '[时间: {{timeContext}}; 地点: {{locationContext}}{{emotionalContext}}]',
                content: '{{formattedContent}}',
                suffix: '[记忆可信度: {{reliability}}; 重要性: {{importance}}]'
            },
            
            // 叙事模板
            narrative: {
                prefix: '【{{char}}的记忆片段】',
                context: '在{{timeContext}}{{locationContext}}时，',
                content: '{{formattedContent}}',
                suffix: '这段记忆对{{char}}来说{{importanceText}}。'
            }
        };
        
        // 语法转换规则
        this.grammarRules = {
            // 现在时 -> 过去时
            presentToPast: {
                '是': '曾是',
                '在': '曾在',
                '有': '曾有',
                '说': '曾说',
                '做': '曾做',
                '想': '曾想',
                '认为': '曾认为',
                '感到': '曾感到',
                '吃': '曾吃',
                '喝': '曾喝'
                // 更多规则可以动态扩展
            },
            
            // 第一人称 -> 第三人称
            firstToThird: {
                '我': '{{char}}',
                '我的': '{{char}}的',
                '我们': '{{char}}和{{user}}',
                '咱们': '{{char}}和{{user}}'
            }
        };
        
        // 时间上下文生成器
        this.timeContextGenerators = {
            relative: (timestamp) => this.generateRelativeTime(timestamp),
            absolute: (timestamp) => this.generateAbsoluteTime(timestamp),
            hybrid: (timestamp) => this.generateHybridTime(timestamp)
        };
        
        // 统计信息
        this.stats = {
            totalFormatted: 0,                      // 总格式化次数
            avgChunkSize: 0,                        // 平均块大小
            tenseConversions: 0,                    // 时态转换次数
            personConversions: 0,                   // 人称转换次数
            contextAdditions: 0                     // 上下文添加次数
        };
        
        // 缓存
        this.formattedCache = new Map();            // 格式化结果缓存
        this.grammarCache = new Map();              // 语法转换缓存
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[RAGMemoryFormatter] 🏗️ 构造函数完成');
    }

    /**
     * 初始化RAG记忆格式化器
     */
    async init() {
        try {
            console.log('[RAGMemoryFormatter] 📊 开始初始化RAG记忆格式化器...');

            // 加载设置
            await this.loadSettings();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[RAGMemoryFormatter] ✅ RAG记忆格式化器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('rag-memory-formatter:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            console.log('[RAGMemoryFormatter] 📥 加载RAG格式化设置...');

            if (!this.unifiedDataCore) return;

            // 从扩展设置加载
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const ragSettings = extensionSettings?.memoryEnhancement?.ragFormatter;

                if (ragSettings && typeof ragSettings === 'object') {
                    this.settings = { ...this.settings, ...ragSettings };
                    console.log('[RAGMemoryFormatter] ✅ 从扩展设置加载RAG格式化配置');
                }
            } catch (extensionError) {
                console.warn('[RAGMemoryFormatter] ⚠️ 从扩展设置加载失败:', extensionError);
            }

            // 从UnifiedDataCore加载
            const savedSettings = await this.unifiedDataCore.getData('rag_memory_formatter_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
                console.log('[RAGMemoryFormatter] ✅ 从UnifiedDataCore加载RAG格式化配置');
            }

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[RAGMemoryFormatter] 🔄 更新RAG格式化设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 保存到UnifiedDataCore
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('rag_memory_formatter_settings', this.settings);
            }

            // 触发设置更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('rag-memory-formatter:settingsUpdated', this.settings);
            }

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (!this.eventSystem) return;

        // 监听记忆添加事件，进行格式化
        this.eventSystem.on('deep-memory:memoryAdded', (data) => {
            this.handleMemoryAddedForFormatting(data);
        });

        console.log('[RAGMemoryFormatter] 🎧 事件监听器已绑定');
    }

    /**
     * 处理记忆添加进行格式化
     */
    async handleMemoryAddedForFormatting(data) {
        try {
            if (!this.settings.enabled) return;

            const { memory, layer } = data;
            if (!memory || !memory.content) return;

            // 只格式化长期记忆层和深度归档层
            if (layer !== 'longTerm' && layer !== 'deepArchive') {
                return;
            }

            console.log('[RAGMemoryFormatter] 🎨 检测到新记忆添加，开始RAG格式化...');

            // 执行格式化
            const formattedMemory = await this.formatMemoryForRAG(memory);

            // 触发格式化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('rag-memory-formatter:memoryFormatted', {
                    originalMemory: memory,
                    formattedMemory: formattedMemory,
                    layer: layer
                });
            }

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 处理记忆格式化失败:', error);
        }
    }

    /**
     * 核心方法：将记忆格式化为RAG最佳实践格式
     * @param {Object} memory - 记忆对象
     * @param {Object} options - 格式化选项
     * @returns {Object} 格式化后的记忆对象
     */
    async formatMemoryForRAG(memory, options = {}) {
        try {
            console.log('[RAGMemoryFormatter] 🎨 开始格式化记忆为RAG格式...');

            if (!memory || !memory.content) {
                return memory;
            }

            // 合并选项
            const opts = { ...this.settings, ...options };

            // 1. 提取关键信息
            const keyInfo = this.extractKeyInformation(memory.content, opts);

            // 2. 语法转换（时态 + 人称）
            let formattedContent = memory.content;
            if (opts.usePastTense) {
                formattedContent = this.convertToPastTense(formattedContent);
                this.stats.tenseConversions++;
            }
            if (opts.useThirdPerson) {
                formattedContent = this.convertToThirdPerson(formattedContent);
                this.stats.personConversions++;
            }

            // 3. 生成上下文信息
            const timeContext = opts.addTimeContext ? 
                this.generateTimeContext(memory.timestamp, opts.timeFormat) : '';
            const locationContext = opts.addLocationContext ? 
                this.extractLocationContext(memory) : '';
            const emotionalContext = opts.addEmotionalContext ? 
                this.extractEmotionalContext(memory) : '';

            // 4. 块大小优化
            formattedContent = this.optimizeChunkSize(formattedContent, opts);

            // 5. 应用模板
            const template = this.templates[opts.templateFormat] || this.templates.detailed;
            const finalFormatted = this.applyTemplate(template, {
                formattedContent: formattedContent,
                timeContext: timeContext,
                locationContext: locationContext,
                emotionalContext: emotionalContext ? `; 情感: ${emotionalContext}` : '',
                importance: memory.importance || 0.5,
                importanceText: this.getImportanceText(memory.importance),
                reliability: memory.reliability || 0.8
            });

            // 6. 创建格式化后的记忆对象
            const formattedMemory = {
                ...memory,
                originalContent: memory.content,
                content: finalFormatted,
                formatted: true,
                formattedAt: Date.now(),
                ragOptimized: true,
                chunkSize: finalFormatted.length,
                metadata: {
                    ...(memory.metadata || {}),
                    ragFormatted: true,
                    timeContext: timeContext,
                    locationContext: locationContext,
                    emotionalContext: emotionalContext,
                    templateFormat: opts.templateFormat
                }
            };

            // 7. 更新统计
            this.stats.totalFormatted++;
            this.stats.avgChunkSize = 
                (this.stats.avgChunkSize * (this.stats.totalFormatted - 1) + finalFormatted.length) / 
                this.stats.totalFormatted;

            console.log('[RAGMemoryFormatter] ✅ RAG格式化完成');
            console.log(`- 原始长度: ${memory.content.length} 字符`);
            console.log(`- 格式化长度: ${finalFormatted.length} 字符`);
            console.log(`- 时间上下文: ${timeContext}`);
            console.log(`- 位置上下文: ${locationContext}`);

            return formattedMemory;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ RAG格式化失败:', error);
            return memory; // 返回原始记忆
        }
    }

    /**
     * 提取关键信息
     */
    extractKeyInformation(content, options) {
        if (!options.extractKeyInfo) {
            return content;
        }

        try {
            // 移除冗余词语和重复表述
            let processed = content;

            if (options.removeFluff) {
                // 移除常见的填充词
                const fluffWords = ['嗯', '啊', '呃', '额', '那个', '这个', '就是说'];
                fluffWords.forEach(word => {
                    processed = processed.replace(new RegExp(word, 'g'), '');
                });

                // 移除过多的标点符号
                processed = processed.replace(/[。！？]{2,}/g, '。');
                processed = processed.replace(/[，、]{2,}/g, '，');
            }

            // 清理多余空格
            processed = processed.replace(/\s+/g, ' ').trim();

            return processed;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 提取关键信息失败:', error);
            return content;
        }
    }

    /**
     * 转换为过去时态
     */
    convertToPastTense(content) {
        try {
            // 检查缓存
            const cacheKey = `past_${content}`;
            if (this.grammarCache.has(cacheKey)) {
                return this.grammarCache.get(cacheKey);
            }

            let converted = content;

            // 应用时态转换规则
            for (const [present, past] of Object.entries(this.grammarRules.presentToPast)) {
                // 使用正则表达式进行精确匹配
                const regex = new RegExp(`\\b${present}\\b`, 'g');
                converted = converted.replace(regex, past);
            }

            // 缓存结果
            this.grammarCache.set(cacheKey, converted);

            return converted;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 时态转换失败:', error);
            return content;
        }
    }

    /**
     * 转换为第三人称
     */
    convertToThirdPerson(content) {
        try {
            // 检查缓存
            const cacheKey = `third_${content}`;
            if (this.grammarCache.has(cacheKey)) {
                return this.grammarCache.get(cacheKey);
            }

            let converted = content;

            // 应用人称转换规则
            for (const [first, third] of Object.entries(this.grammarRules.firstToThird)) {
                const regex = new RegExp(`\\b${first}\\b`, 'g');
                converted = converted.replace(regex, third);
            }

            // 缓存结果
            this.grammarCache.set(cacheKey, converted);

            return converted;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 人称转换失败:', error);
            return content;
        }
    }

    /**
     * 生成时间上下文
     */
    generateTimeContext(timestamp, format = 'relative') {
        try {
            const generator = this.timeContextGenerators[format];
            if (generator) {
                return generator(timestamp);
            }
            return this.generateRelativeTime(timestamp);

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 生成时间上下文失败:', error);
            return '';
        }
    }

    /**
     * 生成相对时间描述
     */
    generateRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (years > 0) return `${years}年前`;
        if (months > 0) return `${months}个月前`;
        if (weeks > 0) return `${weeks}周前`;
        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
    }

    /**
     * 生成绝对时间描述
     */
    generateAbsoluteTime(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    /**
     * 生成混合时间描述
     */
    generateHybridTime(timestamp) {
        const relative = this.generateRelativeTime(timestamp);
        const absolute = this.generateAbsoluteTime(timestamp);
        return `${relative} (${absolute})`;
    }

    /**
     * 提取位置上下文
     */
    extractLocationContext(memory) {
        try {
            // 从元数据提取
            if (memory.metadata?.location) {
                return memory.metadata.location;
            }

            // 从内容中提取（简单模式）
            const locationPatterns = [
                /在(.{2,10}?)(，|。|；|、)/,
                /位于(.{2,10}?)(，|。|；|、)/,
                /来到(.{2,10}?)(，|。|；|、)/
            ];

            for (const pattern of locationPatterns) {
                const match = memory.content.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }

            return '';

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 提取位置上下文失败:', error);
            return '';
        }
    }

    /**
     * 提取情感上下文
     */
    extractEmotionalContext(memory) {
        try {
            // 从元数据提取
            if (memory.metadata?.emotion) {
                return memory.metadata.emotion;
            }

            // 简单情感关键词检测
            const emotionKeywords = {
                '开心': ['开心', '高兴', '快乐', '愉快', '欢喜'],
                '悲伤': ['悲伤', '难过', '伤心', '痛苦', '哀伤'],
                '愤怒': ['愤怒', '生气', '恼怒', '气愤', '暴怒'],
                '恐惧': ['恐惧', '害怕', '惊恐', '担心', '焦虑'],
                '惊讶': ['惊讶', '吃惊', '震惊', '诧异', '意外']
            };

            for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
                for (const keyword of keywords) {
                    if (memory.content.includes(keyword)) {
                        return emotion;
                    }
                }
            }

            return '';

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 提取情感上下文失败:', error);
            return '';
        }
    }

    /**
     * 优化块大小
     */
    optimizeChunkSize(content, options) {
        try {
            const currentSize = content.length;

            // 如果在理想范围内，直接返回
            if (currentSize >= options.minChunkSize && currentSize <= options.maxChunkSize) {
                return content;
            }

            // 如果太短，保持原样（可以后续合并）
            if (currentSize < options.minChunkSize) {
                console.log(`[RAGMemoryFormatter] ⚠️ 内容过短 (${currentSize}字符)，建议合并`);
                return content;
            }

            // 如果太长，智能截断到目标大小
            if (currentSize > options.maxChunkSize) {
                console.log(`[RAGMemoryFormatter] ⚠️ 内容过长 (${currentSize}字符)，进行智能截断`);
                
                // 尝试在句子边界截断
                const targetSize = options.targetChunkSize;
                let truncated = content.substring(0, targetSize);
                
                // 找到最后一个句子结束符
                const sentenceEnds = ['。', '！', '？', '；'];
                let lastEnd = -1;
                for (const end of sentenceEnds) {
                    const pos = truncated.lastIndexOf(end);
                    if (pos > lastEnd) {
                        lastEnd = pos;
                    }
                }
                
                if (lastEnd > targetSize * 0.7) {
                    // 如果找到了合适的句子边界（在70%以上位置）
                    truncated = truncated.substring(0, lastEnd + 1);
                } else {
                    // 否则在目标大小截断并添加省略号
                    truncated = truncated + '...';
                }
                
                return truncated;
            }

            return content;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 优化块大小失败:', error);
            return content;
        }
    }

    /**
     * 应用模板
     */
    applyTemplate(template, variables) {
        try {
            let result = '';

            // 应用前缀
            result += this.replaceVariables(template.prefix, variables) + '\n';

            // 应用上下文
            if (template.context) {
                result += this.replaceVariables(template.context, variables) + '\n';
            }

            // 应用内容
            result += this.replaceVariables(template.content, variables);

            // 应用后缀
            if (template.suffix) {
                result += '\n' + this.replaceVariables(template.suffix, variables);
            }

            return result.trim();

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 应用模板失败:', error);
            return variables.formattedContent || '';
        }
    }

    /**
     * 替换模板变量
     */
    replaceVariables(template, variables) {
        let result = template;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || '');
        }

        return result;
    }

    /**
     * 获取重要性文本描述
     */
    getImportanceText(importance) {
        if (importance >= 0.9) return '极其重要';
        if (importance >= 0.7) return '非常重要';
        if (importance >= 0.5) return '较为重要';
        if (importance >= 0.3) return '一般重要';
        return '不太重要';
    }

    /**
     * 批量格式化记忆
     * @param {Array} memories - 记忆数组
     * @param {Object} options - 格式化选项
     * @returns {Promise<Array>} 格式化后的记忆数组
     */
    async batchFormatMemories(memories, options = {}) {
        try {
            console.log(`[RAGMemoryFormatter] 📦 开始批量格式化 ${memories.length} 条记忆...`);

            const formatted = [];
            for (const memory of memories) {
                const formattedMemory = await this.formatMemoryForRAG(memory, options);
                formatted.push(formattedMemory);
            }

            console.log('[RAGMemoryFormatter] ✅ 批量格式化完成');
            return formatted;

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 批量格式化失败:', error);
            return memories;
        }
    }

    /**
     * 验证格式化结果
     */
    validateFormattedMemory(formattedMemory) {
        try {
            const issues = [];

            // 检查块大小
            if (formattedMemory.chunkSize < this.settings.minChunkSize) {
                issues.push(`块大小过小: ${formattedMemory.chunkSize} < ${this.settings.minChunkSize}`);
            }
            if (formattedMemory.chunkSize > this.settings.maxChunkSize) {
                issues.push(`块大小过大: ${formattedMemory.chunkSize} > ${this.settings.maxChunkSize}`);
            }

            // 检查必要字段
            if (!formattedMemory.content) {
                issues.push('缺少内容字段');
            }
            if (!formattedMemory.metadata?.ragFormatted) {
                issues.push('未标记为RAG格式化');
            }

            return {
                valid: issues.length === 0,
                issues: issues
            };

        } catch (error) {
            console.error('[RAGMemoryFormatter] ❌ 验证格式化结果失败:', error);
            return { valid: false, issues: ['验证过程出错'] };
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.formattedCache.size,
            grammarCacheSize: this.grammarCache.size
        };
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.formattedCache.clear();
        this.grammarCache.clear();
        console.log('[RAGMemoryFormatter] 🧹 缓存已清理');
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[RAGMemoryFormatter] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('rag-memory-formatter:error', {
                error: error,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.settings.enabled,
            stats: this.getStats(),
            errorCount: this.errorCount
        };
    }
}

