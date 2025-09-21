/**
 * AI记忆总结器
 * 
 * 负责AI驱动的智能记忆总结：
 * - 消息级别的智能总结
 * - 记忆重要性评估
 * - 防重复总结机制
 * - 记忆分类和标记
 * - 与SummaryManager深度集成
 * 
 * @class AIMemorySummarizer
 */

export class AIMemorySummarizer {
    constructor(unifiedDataCore, eventSystem, summaryManager, smartPromptSystem) {
        console.log('[AIMemorySummarizer] 🧠 AI记忆总结器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.summaryManager = summaryManager;
        this.smartPromptSystem = smartPromptSystem;
        
        // AI总结设置
        this.settings = {
            enabled: false,                    // 🔧 修复：默认关闭AI总结，避免自动开启
            // 🔧 修改：启用消息级别处理，不再跟随楼层触发
            followSummaryFloor: false,         // ❌ 不跟随楼层，改为消息级别触发
            messageLevelSummary: true,         // ✅ 启用消息级别总结，每条重要消息都会触发
            batchSize: 3,                      // 🔧 减小批量处理大小，提高响应速度
            importanceThreshold: 0.5,          // 🔧 降低重要性阈值，处理更多消息
            summaryCache: true,                // 启用总结缓存
            preventDuplication: true,          // 防重复机制
            memoryClassification: true,        // 记忆分类
            autoTagging: true,                 // 自动标记
            maxSummaryLength: 200,             // 最大总结长度
            minSummaryLength: 30,              // 🔧 降低最小总结长度
            immediateProcessing: true          // 🔧 新增：立即处理模式
        };
        
        // 缓存和状态管理
        this.summaryCache = new Map();         // 总结缓存
        this.processingQueue = [];             // 处理队列
        this.lastProcessedMessageId = 0;       // 最后处理的消息ID
        this.isProcessing = false;             // 是否正在处理
        
        // 记忆分类标签
        this.memoryTags = {
            PLOT_DEVELOPMENT: '剧情发展',
            CHARACTER_INTERACTION: '角色互动',
            EMOTIONAL_CHANGE: '情感变化',
            WORLD_BUILDING: '世界构建',
            DIALOGUE_IMPORTANT: '重要对话',
            ACTION_SEQUENCE: '动作场景',
            RELATIONSHIP_CHANGE: '关系变化',
            SETTING_CHANGE: '场景变化'
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[AIMemorySummarizer] 🏗️ 构造函数完成');
    }

    /**
     * 初始化AI记忆总结器
     */
    async init() {
        try {
            console.log('[AIMemorySummarizer] 📊 开始初始化AI记忆总结器...');

            // 加载设置
            await this.loadSettings();

            // 🔧 新增：与SummaryManager设置同步
            await this.syncWithSummaryManager();

            // 绑定事件监听器
            this.bindEventListeners();

            // 初始化缓存
            await this.initializeCache();

            this.initialized = true;
            console.log('[AIMemorySummarizer] ✅ AI记忆总结器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('ai-memory-summarizer:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            console.log('[AIMemorySummarizer] 📥 加载AI总结设置...');

            if (!this.unifiedDataCore) return;

            // 🔧 修复：优先从扩展设置中加载，然后从UnifiedDataCore加载
            let settingsLoaded = false;

            // 1. 尝试从SillyTavern扩展设置中加载
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancementSettings = extensionSettings?.memoryEnhancement?.ai;

                if (memoryEnhancementSettings && typeof memoryEnhancementSettings === 'object') {
                    this.settings = { ...this.settings, ...memoryEnhancementSettings };
                    console.log('[AIMemorySummarizer] ✅ 从扩展设置加载AI总结设置:', this.settings);
                    settingsLoaded = true;
                }
            } catch (extensionError) {
                console.warn('[AIMemorySummarizer] ⚠️ 从扩展设置加载失败:', extensionError);
            }

            // 2. 如果扩展设置没有加载成功，从UnifiedDataCore加载
            if (!settingsLoaded) {
                const savedSettings = await this.unifiedDataCore.getData('ai_memory_summarizer_settings');
                if (savedSettings) {
                    this.settings = { ...this.settings, ...savedSettings };
                    console.log('[AIMemorySummarizer] ✅ 从UnifiedDataCore加载AI总结设置:', this.settings);
                }
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[AIMemorySummarizer] 🔄 更新AI总结设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 🔧 修复：同时保存到UnifiedDataCore和扩展设置
            // 1. 保存到UnifiedDataCore
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('ai_memory_summarizer_settings', this.settings);
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

                    context.extensionSettings['Information bar integration tool'].memoryEnhancement.ai = {
                        enabled: this.settings.enabled,
                        messageLevelSummary: this.settings.messageLevelSummary,
                        importanceThreshold: this.settings.importanceThreshold
                    };

                    console.log('[AIMemorySummarizer] ✅ 设置已同步到扩展设置');
                }
            } catch (extensionError) {
                console.warn('[AIMemorySummarizer] ⚠️ 同步到扩展设置失败:', extensionError);
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[AIMemorySummarizer] 🔗 绑定事件监听器...');

            if (!this.eventSystem) return;

            // 监听消息接收事件
            this.eventSystem.on('message:received', (data) => {
                this.handleMessageReceived(data);
            });

            // 监听总结完成事件
            this.eventSystem.on('summary:created', (data) => {
                this.handleSummaryCreated(data);
            });

            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });

            // 🔧 新增：监听SummaryManager设置变化事件
            this.eventSystem.on('summary-settings:changed', (data) => {
                this.handleSummarySettingsChanged(data);
            });

            console.log('[AIMemorySummarizer] ✅ 事件监听器绑定完成');

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 初始化缓存
     */
    async initializeCache() {
        try {
            console.log('[AIMemorySummarizer] 🗄️ 初始化总结缓存...');
            
            if (!this.settings.summaryCache) return;
            
            // 从存储中恢复缓存
            const cachedData = await this.unifiedDataCore?.getData('ai_summary_cache', 'chat');
            if (cachedData && typeof cachedData === 'object') {
                this.summaryCache = new Map(Object.entries(cachedData));
                console.log('[AIMemorySummarizer] 📊 缓存恢复完成，条目数:', this.summaryCache.size);
            }
            
        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 初始化缓存失败:', error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            if (!this.settings.enabled) {
                console.log('[AIMemorySummarizer] ⚠️ AI记忆总结已禁用');
                return;
            }

            if (!this.settings.messageLevelSummary) {
                console.log('[AIMemorySummarizer] ⚠️ 消息级别总结已禁用');
                return;
            }

            // 🔧 修改：移除楼层跟随限制，启用消息级别处理
            console.log('[AIMemorySummarizer] 📝 接收到新消息，准备处理AI总结...');

            // 🔧 新增：立即处理模式
            if (this.settings.immediateProcessing && !this.isProcessing) {
                console.log('[AIMemorySummarizer] ⚡ 立即处理模式：直接处理当前消息');
                await this.processMessageSummary(data);
                return;
            }

            if (this.isProcessing) {
                // 添加到处理队列
                this.processingQueue.push(data);
                console.log('[AIMemorySummarizer] 📋 消息已添加到处理队列，队列长度:', this.processingQueue.length);
                return;
            }

            console.log('[AIMemorySummarizer] 📝 开始处理新消息的AI总结...');
            await this.processMessageSummary(data);

            // 处理队列中的消息
            await this.processQueue();

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 处理消息总结
     */
    async processMessageSummary(messageData) {
        try {
            this.isProcessing = true;

            const context = SillyTavern.getContext();
            if (!context || !context.chat) {
                console.log('[AIMemorySummarizer] ⚠️ 无法获取聊天上下文');
                return;
            }

            const currentMessageCount = context.chat.length;

            // 🔧 修改：优化消息处理逻辑
            let messagesToProcess;
            if (this.settings.immediateProcessing && messageData) {
                // 立即处理模式：只处理最新的几条消息
                const startIndex = Math.max(0, currentMessageCount - this.settings.batchSize);
                messagesToProcess = context.chat.slice(startIndex);
                console.log('[AIMemorySummarizer] ⚡ 立即处理模式：处理最新', messagesToProcess.length, '条消息');
            } else {
                // 批量处理模式：处理所有未处理的消息
                messagesToProcess = context.chat.slice(this.lastProcessedMessageId);
                console.log('[AIMemorySummarizer] 📦 批量处理模式：处理', messagesToProcess.length, '条新消息');
            }

            if (messagesToProcess.length === 0) {
                console.log('[AIMemorySummarizer] ℹ️ 没有新消息需要处理');
                return;
            }

            console.log('[AIMemorySummarizer] 🔍 开始分析消息:', messagesToProcess.length, '条');

            // 批量处理消息
            const batches = this.createMessageBatches(messagesToProcess);

            for (const batch of batches) {
                await this.processBatchSummary(batch);
            }

            // 🔧 修改：更新处理进度
            if (!this.settings.immediateProcessing) {
                this.lastProcessedMessageId = currentMessageCount;
            }

            console.log('[AIMemorySummarizer] ✅ 消息总结处理完成');

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理消息总结失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 创建消息批次
     */
    createMessageBatches(messages) {
        const batches = [];
        const batchSize = this.settings.batchSize;
        
        for (let i = 0; i < messages.length; i += batchSize) {
            batches.push(messages.slice(i, i + batchSize));
        }
        
        return batches;
    }

    /**
     * 处理批次总结
     */
    async processBatchSummary(messageBatch) {
        try {
            console.log('[AIMemorySummarizer] 📦 处理消息批次:', messageBatch.length, '条消息');
            
            // 检查是否已有缓存
            const batchKey = this.generateBatchKey(messageBatch);
            if (this.settings.summaryCache && this.summaryCache.has(batchKey)) {
                console.log('[AIMemorySummarizer] 💾 使用缓存的总结');
                return this.summaryCache.get(batchKey);
            }
            
            // 评估消息重要性
            const importanceScores = await this.evaluateMessageImportance(messageBatch);
            
            // 过滤重要消息
            const importantMessages = messageBatch.filter((msg, index) => 
                importanceScores[index] >= this.settings.importanceThreshold
            );
            
            if (importantMessages.length === 0) {
                console.log('[AIMemorySummarizer] ℹ️ 批次中没有重要消息，跳过总结');
                return null;
            }
            
            // 生成AI总结
            const summary = await this.generateAISummary(importantMessages, importanceScores);
            
            // 分类和标记
            const classifiedSummary = await this.classifyAndTagSummary(summary, importantMessages);
            
            // 缓存结果
            if (this.settings.summaryCache) {
                this.summaryCache.set(batchKey, classifiedSummary);
                await this.saveCacheToStorage();
            }
            
            // 触发总结完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('ai-summary:created', {
                    summary: classifiedSummary,
                    messageCount: messageBatch.length,
                    importantCount: importantMessages.length,
                    timestamp: Date.now()
                });
            }
            
            return classifiedSummary;
            
        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理批次总结失败:', error);
            return null;
        }
    }

    /**
     * 生成批次键
     */
    generateBatchKey(messageBatch) {
        const messageIds = messageBatch.map(msg => msg.send_date || Date.now()).join('-');
        return `batch_${messageIds.slice(0, 50)}`; // 限制长度
    }

    /**
     * 评估消息重要性
     */
    async evaluateMessageImportance(messages) {
        try {
            console.log('[AIMemorySummarizer] 🎯 评估消息重要性...');
            
            const importanceScores = [];
            
            for (const message of messages) {
                let score = 0.5; // 基础分数
                
                // 消息长度权重
                const messageLength = (message.mes || '').length;
                if (messageLength > 100) score += 0.1;
                if (messageLength > 300) score += 0.1;
                
                // 关键词检测
                const content = (message.mes || '').toLowerCase();
                const keywords = ['重要', '关键', '决定', '改变', '发现', '秘密', '计划', '危险'];
                const keywordCount = keywords.filter(keyword => content.includes(keyword)).length;
                score += keywordCount * 0.05;
                
                // 角色互动权重
                if (message.is_user !== undefined) {
                    score += 0.1; // 用户消息通常更重要
                }
                
                // 情感强度检测
                const emotionalWords = ['爱', '恨', '愤怒', '高兴', '悲伤', '惊讶', '恐惧'];
                const emotionalCount = emotionalWords.filter(word => content.includes(word)).length;
                score += emotionalCount * 0.03;
                
                // 限制分数范围
                score = Math.max(0, Math.min(1, score));
                importanceScores.push(score);
            }
            
            console.log('[AIMemorySummarizer] 📊 重要性评估完成，平均分数:', 
                importanceScores.reduce((a, b) => a + b, 0) / importanceScores.length);
            
            return importanceScores;
            
        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 评估消息重要性失败:', error);
            return messages.map(() => 0.5); // 返回默认分数
        }
    }

    /**
     * 生成AI总结
     */
    async generateAISummary(messages, importanceScores) {
        try {
            console.log('[AIMemorySummarizer] 🤖 生成AI总结...');

            if (!this.summaryManager) {
                throw new Error('SummaryManager未初始化');
            }

            // 构建总结提示词
            const summaryPrompt = this.createAISummaryPrompt(messages, importanceScores);

            // 调用SummaryManager的API
            const summaryContent = await this.summaryManager.callSummaryAPI(summaryPrompt);

            // 验证总结长度
            if (summaryContent.length < this.settings.minSummaryLength) {
                console.warn('[AIMemorySummarizer] ⚠️ 总结过短，可能质量不佳');
            }

            if (summaryContent.length > this.settings.maxSummaryLength) {
                console.warn('[AIMemorySummarizer] ⚠️ 总结过长，进行截断');
                return summaryContent.substring(0, this.settings.maxSummaryLength) + '...';
            }

            console.log('[AIMemorySummarizer] ✅ AI总结生成完成，长度:', summaryContent.length);
            return summaryContent;

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 生成AI总结失败:', error);
            throw error;
        }
    }

    /**
     * 创建AI总结提示词
     */
    createAISummaryPrompt(messages, importanceScores) {
        try {
            console.log('[AIMemorySummarizer] 📝 创建AI总结提示词...');

            // 构建消息内容
            const messageContent = messages.map((msg, index) => {
                const speaker = msg.is_user ? '用户' : (msg.name || 'AI');
                const content = msg.mes.replace(/<[^>]*>/g, '').trim(); // 移除HTML标签
                const importance = importanceScores[index] ? `(重要性: ${(importanceScores[index] * 100).toFixed(0)}%)` : '';
                return `${speaker}: ${content} ${importance}`;
            }).join('\n\n');

            // 创建专门的AI记忆总结提示词
            const summaryPrompt = `【AI记忆总结任务】

请对以下对话内容进行智能记忆总结，要求：

📊 总结要求：
- 总结长度：${this.settings.minSummaryLength}-${this.settings.maxSummaryLength}字
- 重点关注高重要性的内容
- 保持客观中性的叙述风格
- 突出关键的剧情发展和角色互动

📝 记忆总结内容要求：
1. 提取核心剧情要点
2. 记录重要的角色行为和对话
3. 突出情感变化和关系发展
4. 保留关键的场景和环境描述
5. 识别重要的决定和转折点

🎯 输出格式：
直接输出简洁的记忆总结，不需要任何标签或格式化标记。

📚 需要总结的对话内容：

${messageContent}

请开始智能记忆总结：`;

            console.log('[AIMemorySummarizer] ✅ AI总结提示词创建完成，长度:', summaryPrompt.length);
            return summaryPrompt;

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 创建AI总结提示词失败:', error);
            throw error;
        }
    }

    /**
     * 分类和标记总结
     */
    async classifyAndTagSummary(summary, messages) {
        try {
            console.log('[AIMemorySummarizer] 🏷️ 分类和标记总结...');

            if (!this.settings.memoryClassification) {
                return {
                    content: summary,
                    tags: [],
                    classification: 'general',
                    timestamp: Date.now()
                };
            }

            const tags = [];
            const content = summary.toLowerCase();

            // 自动标记逻辑
            if (this.settings.autoTagging) {
                // 剧情发展检测
                if (content.includes('发生') || content.includes('事件') || content.includes('情节')) {
                    tags.push(this.memoryTags.PLOT_DEVELOPMENT);
                }

                // 角色互动检测
                if (content.includes('对话') || content.includes('交流') || content.includes('互动')) {
                    tags.push(this.memoryTags.CHARACTER_INTERACTION);
                }

                // 情感变化检测
                if (content.includes('情感') || content.includes('感情') || content.includes('心情')) {
                    tags.push(this.memoryTags.EMOTIONAL_CHANGE);
                }

                // 关系变化检测
                if (content.includes('关系') || content.includes('友谊') || content.includes('爱情')) {
                    tags.push(this.memoryTags.RELATIONSHIP_CHANGE);
                }

                // 场景变化检测
                if (content.includes('地点') || content.includes('场景') || content.includes('环境')) {
                    tags.push(this.memoryTags.SETTING_CHANGE);
                }
            }

            // 确定主要分类
            let classification = 'general';
            if (tags.length > 0) {
                classification = tags[0]; // 使用第一个标签作为主分类
            }

            const classifiedSummary = {
                content: summary,
                tags: tags,
                classification: classification,
                messageCount: messages.length,
                timestamp: Date.now(),
                id: `ai_summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            console.log('[AIMemorySummarizer] ✅ 总结分类完成:', classification, '标签:', tags.length);
            return classifiedSummary;

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 分类和标记总结失败:', error);
            return {
                content: summary,
                tags: [],
                classification: 'general',
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 处理队列
     */
    async processQueue() {
        try {
            if (this.processingQueue.length === 0 || this.isProcessing) {
                return;
            }

            console.log('[AIMemorySummarizer] 📋 处理队列中的消息:', this.processingQueue.length);

            while (this.processingQueue.length > 0) {
                const messageData = this.processingQueue.shift();
                await this.processMessageSummary(messageData);
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理队列失败:', error);
        }
    }

    /**
     * 保存缓存到存储
     */
    async saveCacheToStorage() {
        try {
            if (!this.settings.summaryCache || !this.unifiedDataCore) return;

            const cacheObject = Object.fromEntries(this.summaryCache);
            await this.unifiedDataCore.setData('ai_summary_cache', cacheObject, 'chat');

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 保存缓存失败:', error);
        }
    }

    /**
     * 处理总结创建事件
     */
    async handleSummaryCreated(data) {
        try {
            console.log('[AIMemorySummarizer] 📝 处理总结创建事件...');

            // 可以在这里添加与传统总结的集成逻辑
            // 例如：将AI总结与传统总结进行对比或合并

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理总结创建事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            console.log('[AIMemorySummarizer] 🔄 聊天切换，重置AI总结状态');

            // 重置状态
            this.lastProcessedMessageId = 0;
            this.processingQueue = [];
            this.isProcessing = false;

            // 清空缓存（如果需要）
            if (!this.settings.summaryCache) {
                this.summaryCache.clear();
            } else {
                // 重新加载当前聊天的缓存
                await this.initializeCache();
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 🔧 修复：处理SummaryManager设置变化事件（移除强制同步）
     */
    async handleSummarySettingsChanged(data) {
        try {
            console.log('[AIMemorySummarizer] 🔄 SummaryManager设置变化事件接收');

            // 🔧 修复：不再强制同步enabled状态
            // AI记忆总结应该保持独立的启用状态，不被SummaryManager的autoSummaryEnabled影响

            if (data && data.newSettings) {
                console.log('[AIMemorySummarizer] 📊 SummaryManager新设置:', data.newSettings);
                console.log('[AIMemorySummarizer] ✅ AI记忆总结保持独立设置，当前状态:', this.settings.enabled);

                // 可以在这里处理其他需要同步的设置，但不包括enabled状态
                // 例如：总结字数限制、重要性阈值等
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 处理SummaryManager设置变化失败:', error);
        }
    }

    /**
     * 🔧 修复：与SummaryManager设置同步（移除强制同步enabled状态）
     */
    async syncWithSummaryManager() {
        try {
            console.log('[AIMemorySummarizer] 🔄 与SummaryManager设置同步...');

            if (this.summaryManager && this.summaryManager.settings) {
                const summarySettings = this.summaryManager.settings;

                // 🔧 修复：不再强制同步enabled状态，AI记忆总结应该保持独立设置
                // AI记忆总结的启用状态应该由用户在记忆增强面板中独立控制
                // 而不是被SummaryManager的autoSummaryEnabled覆盖

                console.log('[AIMemorySummarizer] ✅ 保持AI记忆总结独立设置，不被SummaryManager覆盖');
                console.log('[AIMemorySummarizer] 📊 当前AI记忆总结状态:', this.settings.enabled);
                console.log('[AIMemorySummarizer] 📊 SummaryManager自动总结状态:', summarySettings.autoSummaryEnabled);
            }

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 与SummaryManager设置同步失败:', error);
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

            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};
            const aiSummaryHistory = chatData.ai_summary_history || [];

            return aiSummaryHistory.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 获取AI总结历史失败:', error);
            return [];
        }
    }

    /**
     * 保存AI总结到历史
     */
    async saveAISummaryToHistory(summaryData) {
        try {
            if (!this.unifiedDataCore) return;

            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) return;

            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};

            if (!chatData.ai_summary_history) {
                chatData.ai_summary_history = [];
            }

            chatData.ai_summary_history.push(summaryData);

            // 限制历史记录数量
            if (chatData.ai_summary_history.length > 100) {
                chatData.ai_summary_history = chatData.ai_summary_history.slice(-100);
            }

            await this.unifiedDataCore.setChatData(currentChatId, chatData);

        } catch (error) {
            console.error('[AIMemorySummarizer] ❌ 保存AI总结到历史失败:', error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[AIMemorySummarizer] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('ai-memory-summarizer:error', {
                error: error,
                errorCount: this.errorCount,
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
            settings: this.settings,
            cacheSize: this.summaryCache.size,
            queueLength: this.processingQueue.length,
            lastProcessedMessageId: this.lastProcessedMessageId,
            isProcessing: this.isProcessing,
            errorCount: this.errorCount
        };
    }
}
