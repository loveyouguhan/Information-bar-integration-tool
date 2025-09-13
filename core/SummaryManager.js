/**
 * 总结管理器
 * 
 * 负责剧情总结的核心逻辑：
 * - 监听消息数量变化
 * - 自动触发总结
 * - 调用自定义API生成总结
 * - 管理总结数据存储
 * 
 * @class SummaryManager
 */

export class SummaryManager {
    constructor(unifiedDataCore, eventSystem, infoBarSettings) {
        console.log('[SummaryManager] 🔧 总结管理器初始化开始');

        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.infoBarSettings = infoBarSettings;

        // 🚀 新增：AI记忆总结器引用
        this.aiMemorySummarizer = null;

        // 🔍 新增：向量化记忆检索系统引用
        this.vectorizedMemoryRetrieval = null;
        
        // 总结设置
        this.settings = {
            autoSummaryEnabled: true,  // 🔧 修复：启用自动总结功能以增加记忆数据积累
            summaryFloorCount: 20,
            summaryType: 'small',
            summaryWordCount: 300,
            injectSummaryEnabled: false,  // 🔧 新增：总结注入功能开关
            // 🔧 新增：自动隐藏楼层设置
            autoHideEnabled: false,
            autoHideThreshold: 30
        };
        
        // 状态管理
        this.lastMessageCount = 0;
        this.lastSummaryMessageId = 0;
        this.summaryInProgress = false;
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[SummaryManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化总结管理器
     */
    async init() {
        try {
            console.log('[SummaryManager] 📊 开始初始化总结管理器...');

            // 加载总结设置
            await this.loadSettings();

            // 绑定事件监听器
            this.bindEventListeners();

            // 初始化消息计数
            await this.initMessageCount();

            this.initialized = true;
            console.log('[SummaryManager] ✅ 总结管理器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary-manager:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[SummaryManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 🚀 设置AI记忆总结器
     */
    setAIMemorySummarizer(aiMemorySummarizer) {
        try {
            console.log('[SummaryManager] 🧠 设置AI记忆总结器...');
            this.aiMemorySummarizer = aiMemorySummarizer;
            console.log('[SummaryManager] ✅ AI记忆总结器设置完成');
        } catch (error) {
            console.error('[SummaryManager] ❌ 设置AI记忆总结器失败:', error);
        }
    }

    /**
     * 🔍 设置向量化记忆检索系统
     */
    setVectorizedMemoryRetrieval(vectorizedMemoryRetrieval) {
        try {
            console.log('[SummaryManager] 🔍 设置向量化记忆检索系统...');
            this.vectorizedMemoryRetrieval = vectorizedMemoryRetrieval;
            console.log('[SummaryManager] ✅ 向量化记忆检索系统设置完成');
        } catch (error) {
            console.error('[SummaryManager] ❌ 设置向量化记忆检索系统失败:', error);
        }
    }

    /**
     * 加载总结设置
     */
    async loadSettings() {
        try {
            console.log('[SummaryManager] 📥 加载总结设置...');
            
            if (!this.unifiedDataCore) return;
            
            const savedSettings = await this.unifiedDataCore.getData('summary_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
                console.log('[SummaryManager] ✅ 总结设置加载完成:', this.settings);
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    updateSettings(newSettings) {
        try {
            console.log('[SummaryManager] 🔄 更新总结设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };
        } catch (error) {
            console.error('[SummaryManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[SummaryManager] 🔗 绑定事件监听器...');
            
            if (!this.eventSystem) return;
            
            // 监听消息接收事件
            this.eventSystem.on('message:received', (data) => {
                this.handleMessageReceived(data);
            });
            
            // 监听聊天切换事件 - 使用正确的事件名
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });
            
            // 兼容旧事件名
            this.eventSystem.on('chat:switched', (data) => {
                this.handleChatChanged(data);
            });
            
            console.log('[SummaryManager] ✅ 事件监听器绑定完成');
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 初始化消息计数
     */
    async initMessageCount() {
        try {
            console.log('[SummaryManager] 🔢 初始化消息计数...');
            
            // 获取当前聊天的消息数量
            const context = SillyTavern.getContext();
            if (context && context.chat) {
                this.lastMessageCount = context.chat.length;
                
                // 🔧 修复：动态设置lastSummaryMessageId，处理中途安装插件的情况
                await this.initLastSummaryMessageId(context.chat.length);
                
                console.log('[SummaryManager] 📊 消息计数初始化完成:', {
                    currentMessageCount: this.lastMessageCount,
                    lastSummaryMessageId: this.lastSummaryMessageId,
                    messagesSinceLastSummary: this.lastMessageCount - this.lastSummaryMessageId
                });
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 初始化消息计数失败:', error);
        }
    }

    /**
     * 🔧 新增：初始化lastSummaryMessageId，处理中途安装插件的情况
     */
    async initLastSummaryMessageId(currentMessageCount) {
        try {
            console.log('[SummaryManager] 🎯 初始化最后总结消息ID...');
            
            // 检查是否有历史总结记录
            const summaryHistory = await this.getSummaryHistory();
            
            if (summaryHistory && summaryHistory.length > 0) {
                // 从总结历史中获取最后一次总结的消息ID
                const lastSummary = summaryHistory[summaryHistory.length - 1];
                if (lastSummary.messageRange && typeof lastSummary.messageRange.end === 'number') {
                    this.lastSummaryMessageId = lastSummary.messageRange.end + 1;
                    console.log('[SummaryManager] ✅ 从历史记录恢复lastSummaryMessageId:', this.lastSummaryMessageId);
                    return;
                }
            }
            
            // 如果没有历史记录，根据当前消息数量智能设置
            if (currentMessageCount > this.settings.summaryFloorCount) {
                // 如果当前消息数量超过一个总结周期，设置为适当的起始点
                // 避免第一次总结时处理过多历史消息
                this.lastSummaryMessageId = Math.max(0, currentMessageCount - this.settings.summaryFloorCount);
                console.log('[SummaryManager] 🎯 智能设置lastSummaryMessageId（避免处理过多历史）:', this.lastSummaryMessageId);
            } else {
                // 如果消息数量不多，从头开始
                this.lastSummaryMessageId = 0;
                console.log('[SummaryManager] 🎯 设置lastSummaryMessageId为0（消息数量较少）:', this.lastSummaryMessageId);
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 初始化lastSummaryMessageId失败:', error);
            // 如果出错，保持默认值0
            this.lastSummaryMessageId = 0;
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            if (!this.settings.autoSummaryEnabled) {
                return; // 自动总结未启用
            }
            
            if (this.summaryInProgress) {
                return; // 总结正在进行中
            }
            
            // 更新消息计数
            const context = SillyTavern.getContext();
            if (!context || !context.chat) return;
            
            const currentMessageCount = context.chat.length;
            const newMessages = currentMessageCount - this.lastMessageCount;
            
            console.log('[SummaryManager] 📊 消息计数更新:', {
                previous: this.lastMessageCount,
                current: currentMessageCount,
                new: newMessages
            });
            
            this.lastMessageCount = currentMessageCount;
            
            // 检查是否需要触发总结
            if (this.shouldTriggerSummary(currentMessageCount)) {
                console.log('[SummaryManager] 🎯 触发自动总结，当前消息数:', currentMessageCount);
                await this.generateSummary({
                    type: 'auto',
                    messageCount: currentMessageCount
                });
                
                // 🔧 新增：总结完成后触发自动隐藏检查
                this.eventSystem?.emit('summary:completed', {
                    type: 'auto',
                    messageCount: currentMessageCount,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            console.log('[SummaryManager] 🔄 聊天切换，重新初始化消息计数和总结数据');
            
            // 重置状态
            this.lastMessageCount = 0;
            this.lastSummaryMessageId = 0;
            this.summaryInProgress = false;
            
            // 重新初始化消息计数
            await this.initMessageCount();
            
            // 触发总结数据更新事件（供SummaryPanel和InfoBarSettings监听）
            if (this.eventSystem) {
                this.eventSystem.emit('summary:chat:changed', {
                    chatId: data?.chatId || this.unifiedDataCore?.getCurrentChatId?.(),
                    timestamp: Date.now(),
                    action: 'chat_switched' // 添加动作类型
                });
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件（兼容旧方法名）
     */
    async handleChatSwitched(data) {
        return await this.handleChatChanged(data);
    }

    /**
     * 判断是否应该触发总结
     */
    shouldTriggerSummary(currentMessageCount) {
        try {
            // 检查是否达到总结楼层数
            const messagesSinceLastSummary = currentMessageCount - this.lastSummaryMessageId;
            const shouldTrigger = messagesSinceLastSummary >= this.settings.summaryFloorCount;
            
            console.log('[SummaryManager] 🤔 总结触发检查:', {
                currentMessageCount,
                lastSummaryMessageId: this.lastSummaryMessageId,
                messagesSinceLastSummary,
                summaryFloorCount: this.settings.summaryFloorCount,
                shouldTrigger
            });
            
            return shouldTrigger;
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 判断总结触发失败:', error);
            return false;
        }
    }

    /**
     * 生成总结
     */
    async generateSummary(options = {}) {
        try {
            console.log('[SummaryManager] 📝 开始生成总结...', options);
            
            if (this.summaryInProgress) {
                console.log('[SummaryManager] ⏳ 总结正在进行中，跳过');
                return { success: false, error: '总结正在进行中' };
            }
            
            this.summaryInProgress = true;
            
            // 获取聊天消息
            const messages = await this.getChatMessages();
            if (!messages || messages.length === 0) {
                throw new Error('没有可总结的消息');
            }
            
            // 确定总结范围
            const summaryRange = this.determineSummaryRange(messages, options);
            
            // 生成总结提示词
            const summaryPrompt = this.createSummaryPrompt(messages, summaryRange, options);
            
            // 调用自定义API生成总结
            const summaryContent = await this.callSummaryAPI(summaryPrompt);
            
            // 保存总结记录
            const summaryRecord = await this.saveSummaryRecord({
                type: options.type || 'manual',
                content: summaryContent,
                messageRange: summaryRange,
                settings: { ...this.settings },
                timestamp: Date.now()
            });
            
            // 更新最后总结的消息ID：按窗口推进，避免下次重复
            if (options.type === 'auto') {
                this.lastSummaryMessageId = summaryRange.end + 1;
            }

            // 🔧 新增：如果启用了总结注入，则注入到主API上下文
            if (this.settings.injectSummaryEnabled) {
                await this.injectSummaryToMainAPI(summaryContent, summaryRecord);
            }

            // 🚀 新增：如果有AI记忆总结器，也生成AI记忆总结
            if (this.aiMemorySummarizer && this.aiMemorySummarizer.settings.enabled) {
                try {
                    console.log('[SummaryManager] 🧠 生成AI记忆总结...');
                    const aiSummaryData = await this.generateAIMemorySummary(messages, summaryRange, summaryRecord);
                    if (aiSummaryData) {
                        summaryRecord.aiMemorySummary = aiSummaryData;
                        console.log('[SummaryManager] ✅ AI记忆总结已添加到总结记录');
                    }
                } catch (aiError) {
                    console.error('[SummaryManager] ❌ 生成AI记忆总结失败:', aiError);
                    // 不影响主总结流程
                }
            }

            console.log('[SummaryManager] ✅ 总结生成完成:', summaryRecord.id);

            return {
                success: true,
                summaryId: summaryRecord.id,
                content: summaryContent,
                aiMemorySummary: summaryRecord.aiMemorySummary
            };
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 生成总结失败:', error);
            return {
                success: false,
                error: error.message || '总结生成失败'
            };
        } finally {
            this.summaryInProgress = false;
        }
    }

    /**
     * 获取聊天消息
     */
    async getChatMessages() {
        try {
            const context = SillyTavern.getContext();
            if (!context || !context.chat) {
                throw new Error('无法获取聊天上下文');
            }
            
            return context.chat.filter(msg => msg && msg.mes);
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 获取聊天消息失败:', error);
            throw error;
        }
    }

    /**
     * 确定总结范围
     */
    determineSummaryRange(messages, options) {
        try {
            const totalMessages = messages.length;
            
            if (options.type === 'manual') {
                // 手动总结：总结最近的楼层数消息
                const start = Math.max(0, totalMessages - this.settings.summaryFloorCount);
                return { start, end: totalMessages - 1 };
            } else {
                // 自动总结：每次只总结最近 summaryFloorCount 条消息，避免一次性覆盖过多楼层
                const end = totalMessages - 1;
                const start = Math.max(0, end - this.settings.summaryFloorCount + 1);
                return { start, end };
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 确定总结范围失败:', error);
            return { start: 0, end: messages.length - 1 };
        }
    }

    /**
     * 创建总结提示词
     */
    createSummaryPrompt(messages, summaryRange, options) {
        try {
            console.log('[SummaryManager] 📝 创建总结提示词...', summaryRange);

            // 获取需要总结的消息
            const messagesToSummarize = messages.slice(summaryRange.start, summaryRange.end + 1);

            // 确定总结字数
            let wordCount = this.settings.summaryWordCount;
            if (this.settings.summaryType === 'small') {
                wordCount = 150;
            } else if (this.settings.summaryType === 'large') {
                wordCount = 400;
            }

            // 构建消息内容
            const messageContent = messagesToSummarize.map((msg, index) => {
                const speaker = msg.is_user ? '用户' : (msg.name || 'AI');
                const content = msg.mes.replace(/<[^>]*>/g, '').trim(); // 移除HTML标签
                return `${summaryRange.start + index + 1}. ${speaker}: ${content}`;
            }).join('\n\n');

            // 创建总结提示词
            const summaryPrompt = `【剧情总结任务】

请对以下对话内容进行剧情总结，要求：

📊 总结要求：
- 总结字数：约${wordCount}字
- 总结类型：${this.getSummaryTypeDescription()}
- 保持客观中性的叙述风格
- 突出重要的剧情发展和角色互动

📝 总结内容要求：
1. 概括主要剧情发展
2. 记录重要的角色行为和对话
3. 突出情感变化和关系发展
4. 保留关键的场景和环境描述
5. 按时间顺序组织内容

🎯 输出格式：
直接输出总结内容，不需要任何标签或格式化标记。

📚 需要总结的对话内容（消息${summaryRange.start + 1}-${summaryRange.end + 1}）：

${messageContent}

请开始总结：`;

            console.log('[SummaryManager] ✅ 总结提示词创建完成，长度:', summaryPrompt.length);
            return summaryPrompt;

        } catch (error) {
            console.error('[SummaryManager] ❌ 创建总结提示词失败:', error);
            throw error;
        }
    }

    /**
     * 获取总结类型描述
     */
    getSummaryTypeDescription() {
        const typeMap = {
            'small': '简短总结，突出核心要点',
            'large': '详细总结，包含丰富细节',
            'manual': '手动总结，根据用户需求',
            'auto': '自动总结，定期剧情回顾'
        };

        return typeMap[this.settings.summaryType] || '标准总结';
    }

    /**
     * 调用自定义API生成总结
     */
    async callSummaryAPI(summaryPrompt) {
        try {
            console.log('[SummaryManager] 🤖 调用自定义API生成总结...');

            if (!this.infoBarSettings) {
                throw new Error('InfoBarSettings未初始化');
            }

            // 检查自定义API是否启用
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            const apiConfig = extensionSettings?.apiConfig;

            if (!apiConfig?.enabled || !apiConfig?.apiKey || !apiConfig?.model) {
                throw new Error('自定义API未启用或配置不完整');
            }

            console.log('[SummaryManager] 📡 使用API配置:', {
                provider: apiConfig.provider,
                model: apiConfig.model,
                baseUrl: apiConfig.baseUrl,      // 🔧 显示baseUrl配置
                endpoint: apiConfig.endpoint,    // 🔧 显示endpoint配置
                format: apiConfig.format,        // 🔧 显示接口格式
                maxTokens: apiConfig.maxTokens,  // 🔧 修复：显示用户实际设置的最大令牌数
                temperature: apiConfig.temperature,  // 🔧 修复：显示用户实际设置的温度
                defaultMaxTokens: apiConfig.maxTokens || 4000,  // 🔧 显示默认值处理
                defaultTemperature: apiConfig.temperature || 0.7  // 🔧 显示默认值处理
            });

            // 🔧 修复：使用正确的API调用方法
            // 构建消息格式
            const messages = [
                {
                    role: 'user',
                    content: summaryPrompt
                }
            ];

            // 调用InfoBarSettings的sendCustomAPIRequest方法，传递完整的API配置
            const apiResult = await this.infoBarSettings.sendCustomAPIRequest(messages, {
                skipSystemPrompt: true,  // 🔧 关键修复：总结请求不需要信息栏数据系统提示词
                // 🔧 关键修复：传递完整的API配置，确保使用用户设置的最大令牌数
                apiConfig: {
                    provider: apiConfig.provider,
                    model: apiConfig.model,
                    apiKey: apiConfig.apiKey,
                    endpoint: apiConfig.endpoint,
                    baseUrl: apiConfig.baseUrl || apiConfig.endpoint,  // 🔧 fallback到endpoint
                    format: apiConfig.format,    // 🔧 添加format配置
                    maxTokens: apiConfig.maxTokens || 4000,  // 🔧 修复：确保使用用户设置的最大令牌数
                    temperature: apiConfig.temperature || 0.7,
                    headers: apiConfig.headers,
                    // 🔧 确保传递完整配置
                    enabled: apiConfig.enabled,
                    retryCount: apiConfig.retryCount
                }
            });

            // 🔧 修复：处理API返回结果的格式
            let resultText = '';
            if (typeof apiResult === 'string') {
                resultText = apiResult;
            } else if (apiResult && typeof apiResult === 'object') {
                // 如果返回的是对象，尝试提取文本内容
                resultText = apiResult.content || apiResult.text || apiResult.message || JSON.stringify(apiResult);
            } else {
                resultText = String(apiResult || '');
            }

            if (!resultText || !resultText.trim()) {
                throw new Error('API返回空结果');
            }

            console.log('[SummaryManager] ✅ 总结生成完成，长度:', resultText.length);
            return resultText.trim();

        } catch (error) {
            console.error('[SummaryManager] ❌ 调用总结API失败:', error);
            throw error;
        }
    }

    /**
     * 保存总结记录（聊天隔离版本）
     */
    async saveSummaryRecord(summaryData) {
        try {
            console.log('[SummaryManager] 💾 保存总结记录到当前聊天...');

            if (!this.unifiedDataCore) {
                throw new Error('UnifiedDataCore未初始化');
            }

            // 获取当前聊天ID
            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) {
                throw new Error('无法获取当前聊天ID');
            }

            console.log('[SummaryManager] 📍 当前聊天ID:', currentChatId);

            // 生成唯一ID
            const summaryId = 'summary_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // 创建总结记录
            const summaryRecord = {
                id: summaryId,
                chatId: currentChatId, // 添加聊天ID标识
                ...summaryData
            };

            // 获取当前聊天的数据
            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};
            
            // 确保总结历史数组存在
            if (!chatData.summary_history) {
                chatData.summary_history = [];
            }

            // 添加新记录
            chatData.summary_history.push(summaryRecord);

            // 保存更新后的聊天数据
            await this.unifiedDataCore.setChatData(currentChatId, chatData);

            console.log('[SummaryManager] ✅ 总结记录已保存到聊天:', currentChatId, '记录ID:', summaryId);

            // 触发总结保存事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:created', {
                    summaryId: summaryId,
                    summaryData: summaryRecord,
                    chatId: currentChatId,
                    timestamp: Date.now()
                });
            }

            return summaryRecord;

        } catch (error) {
            console.error('[SummaryManager] ❌ 保存总结记录失败:', error);
            throw error;
        }
    }

    /**
     * 获取总结历史（聊天隔离版本）
     */
    async getSummaryHistory() {
        try {
            if (!this.unifiedDataCore) return [];

            // 获取当前聊天ID
            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) {
                console.warn('[SummaryManager] ⚠️ 无法获取当前聊天ID，返回空历史');
                return [];
            }

            console.log('[SummaryManager] 📍 获取聊天总结历史:', currentChatId);

            // 获取当前聊天的数据
            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};
            const summaryHistory = chatData.summary_history || [];

            console.log('[SummaryManager] 📊 当前聊天总结数量:', summaryHistory.length);

            return summaryHistory.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('[SummaryManager] ❌ 获取总结历史失败:', error);
            return [];
        }
    }

    /**
     * 删除总结记录（聊天隔离版本）
     */
    async deleteSummaryRecord(summaryId) {
        try {
            console.log('[SummaryManager] 🗑️ 删除当前聊天的总结记录:', summaryId);

            if (!this.unifiedDataCore) {
                throw new Error('UnifiedDataCore未初始化');
            }

            // 获取当前聊天ID
            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) {
                throw new Error('无法获取当前聊天ID');
            }

            console.log('[SummaryManager] 📍 在聊天中删除总结:', currentChatId);

            // 获取当前聊天的数据
            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};
            const summaryHistory = chatData.summary_history || [];

            // 过滤掉要删除的记录
            const updatedHistory = summaryHistory.filter(s => s.id !== summaryId);

            // 更新聊天数据
            chatData.summary_history = updatedHistory;
            await this.unifiedDataCore.setChatData(currentChatId, chatData);

            console.log('[SummaryManager] ✅ 总结记录已从聊天中删除');

            // 触发删除事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:deleted', {
                    summaryId: summaryId,
                    chatId: currentChatId,
                    timestamp: Date.now()
                });
            }

            return true;

        } catch (error) {
            console.error('[SummaryManager] ❌ 删除总结记录失败:', error);
            return false;
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[SummaryManager] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('summary-manager:error', {
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
            lastMessageCount: this.lastMessageCount,
            lastSummaryMessageId: this.lastSummaryMessageId,
            summaryInProgress: this.summaryInProgress,
            errorCount: this.errorCount
        };
    }

    /**
     * 将总结内容注入到主API上下文
     */
    async injectSummaryToMainAPI(summaryContent, summaryRecord) {
        try {
            console.log('[SummaryManager] 💉 开始注入总结到主API上下文...');

            // 格式化总结内容为记忆格式
            const memoryContent = this.formatSummaryAsMemory(summaryContent, summaryRecord);

            // 获取SillyTavern上下文
            const context = SillyTavern.getContext();
            if (!context) {
                throw new Error('无法获取SillyTavern上下文');
            }

            // 使用SillyTavern的记忆系统注入总结
            await this.injectToSillyTavernMemory(memoryContent, summaryRecord);

            console.log('[SummaryManager] ✅ 总结已成功注入到主API上下文');

            // 触发注入完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:injected', {
                    summaryId: summaryRecord.id,
                    memoryContent: memoryContent,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[SummaryManager] ❌ 注入总结到主API失败:', error);
            throw error;
        }
    }

    /**
     * 格式化总结内容为记忆格式
     */
    formatSummaryAsMemory(summaryContent, summaryRecord) {
        try {
            // 获取总结类型描述
            const typeMap = {
                'small': '简要总结',
                'large': '详细总结',
                'manual': '手动总结',
                'auto': '自动总结'
            };
            const typeText = typeMap[summaryRecord.type] || '剧情总结';

            // 获取楼层信息
            let floorInfo = '';
            if (summaryRecord.messageRange) {
                const start = summaryRecord.messageRange.start + 1;
                const end = summaryRecord.messageRange.end + 1;
                floorInfo = `（对话楼层${start}-${end}）`;
            }

            // 格式化时间
            const timeText = new Date(summaryRecord.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 构建记忆内容
            const memoryContent = `【剧情记忆 - ${typeText}】${floorInfo}
生成时间：${timeText}

剧情总结：
${summaryContent}

---
注意：这是系统自动生成的剧情总结，用于帮助你保持剧情连贯性和角色记忆。请参考此总结内容，确保后续对话与之前的剧情发展保持一致。`;

            console.log('[SummaryManager] 📝 总结记忆格式化完成，长度:', memoryContent.length);
            return memoryContent;

        } catch (error) {
            console.error('[SummaryManager] ❌ 格式化总结记忆失败:', error);
            return summaryContent; // 降级返回原始内容
        }
    }

    /**
     * 注入到SillyTavern记忆系统
     */
    async injectToSillyTavernMemory(memoryContent, summaryRecord) {
        try {
            console.log('[SummaryManager] 🧠 注入到SillyTavern记忆系统...');

            const context = SillyTavern.getContext();

            // 方法1：尝试使用Author's Note系统
            if (await this.injectToAuthorNote(memoryContent, context)) {
                console.log('[SummaryManager] ✅ 已注入到Author\'s Note');
                return;
            }

            // 方法2：尝试使用World Info系统
            if (await this.injectToWorldInfo(memoryContent, summaryRecord, context)) {
                console.log('[SummaryManager] ✅ 已注入到World Info');
                return;
            }

            // 方法3：尝试使用Memory系统
            if (await this.injectToMemorySystem(memoryContent, context)) {
                console.log('[SummaryManager] ✅ 已注入到Memory系统');
                return;
            }

            // 方法4：作为系统消息注入
            if (await this.injectAsSystemMessage(memoryContent, context)) {
                console.log('[SummaryManager] ✅ 已作为系统消息注入');
                return;
            }

            throw new Error('所有注入方法都失败');

        } catch (error) {
            console.error('[SummaryManager] ❌ 注入到SillyTavern记忆系统失败:', error);
            throw error;
        }
    }

    /**
     * 注入到Author's Note
     */
    async injectToAuthorNote(memoryContent, context) {
        try {
            // 检查是否有Author's Note功能
            if (context.setExtensionPrompt && typeof context.setExtensionPrompt === 'function') {
                // 使用扩展提示词系统注入
                context.setExtensionPrompt(
                    'Information bar integration tool - Summary Memory',
                    memoryContent,
                    1, // 高优先级
                    false // 不禁用
                );
                return true;
            }

            return false;

        } catch (error) {
            console.error('[SummaryManager] ❌ 注入到Author\'s Note失败:', error);
            return false;
        }
    }

    /**
     * 注入到World Info
     */
    async injectToWorldInfo(memoryContent, summaryRecord, context) {
        try {
            // 检查是否有World Info系统
            if (context.worldInfoData && Array.isArray(context.worldInfoData)) {
                // 查找是否已有总结相关的World Info条目
                const existingIndex = context.worldInfoData.findIndex(entry =>
                    entry.key && entry.key.includes('剧情总结') ||
                    entry.comment && entry.comment.includes('Information bar integration tool')
                );

                const worldInfoEntry = {
                    key: ['剧情总结', '剧情记忆', '故事总结'],
                    content: memoryContent,
                    comment: `Information bar integration tool - 自动生成的剧情总结 (${summaryRecord.id})`,
                    constant: true,
                    selective: false,
                    order: 100,
                    position: 0,
                    disable: false
                };

                if (existingIndex >= 0) {
                    // 更新现有条目
                    context.worldInfoData[existingIndex] = worldInfoEntry;
                    console.log('[SummaryManager] 🔄 已更新现有World Info条目');
                } else {
                    // 添加新条目
                    context.worldInfoData.push(worldInfoEntry);
                    console.log('[SummaryManager] ➕ 已添加新的World Info条目');
                }

                // 保存World Info数据
                if (context.saveWorldInfo && typeof context.saveWorldInfo === 'function') {
                    await context.saveWorldInfo();
                }

                return true;
            }

            return false;

        } catch (error) {
            console.error('[SummaryManager] ❌ 注入到World Info失败:', error);
            return false;
        }
    }

    /**
     * 注入到Memory系统
     */
    async injectToMemorySystem(memoryContent, context) {
        try {
            // 检查是否有Memory系统
            if (context.memory !== undefined) {
                // 更新或设置记忆内容
                const existingMemory = context.memory || '';
                const separator = existingMemory ? '\n\n---\n\n' : '';
                context.memory = existingMemory + separator + memoryContent;

                // 保存记忆
                if (context.saveMemory && typeof context.saveMemory === 'function') {
                    await context.saveMemory();
                }

                return true;
            }

            return false;

        } catch (error) {
            console.error('[SummaryManager] ❌ 注入到Memory系统失败:', error);
            return false;
        }
    }

    /**
     * 作为系统消息注入
     */
    async injectAsSystemMessage(memoryContent, context) {
        try {
            // 检查是否有聊天数组
            if (context.chat && Array.isArray(context.chat)) {
                // 查找是否已有总结系统消息
                const existingIndex = context.chat.findIndex(msg =>
                    msg.is_system && msg.mes && msg.mes.includes('【剧情记忆')
                );

                const systemMessage = {
                    name: 'System',
                    is_user: false,
                    is_system: true,
                    send_date: Date.now(),
                    mes: memoryContent,
                    extra: {
                        type: 'summary_memory',
                        source: 'Information bar integration tool'
                    }
                };

                if (existingIndex >= 0) {
                    // 更新现有系统消息
                    context.chat[existingIndex] = systemMessage;
                    console.log('[SummaryManager] 🔄 已更新现有系统消息');
                } else {
                    // 在聊天开始处插入系统消息
                    context.chat.unshift(systemMessage);
                    console.log('[SummaryManager] ➕ 已添加新的系统消息');
                }

                // 保存聊天数据
                if (context.saveChat && typeof context.saveChat === 'function') {
                    await context.saveChat();
                }

                return true;
            }

            return false;

        } catch (error) {
            console.error('[SummaryManager] ❌ 作为系统消息注入失败:', error);
            return false;
        }
    }

    /**
     * 🚀 生成AI记忆总结
     */
    async generateAIMemorySummary(messages, summaryRange, summaryRecord) {
        try {
            console.log('[SummaryManager] 🧠 开始生成AI记忆总结...');

            if (!this.aiMemorySummarizer) {
                throw new Error('AI记忆总结器未初始化');
            }

            // 获取需要总结的消息
            const messagesToSummarize = messages.slice(summaryRange.start, summaryRange.end + 1);

            // 评估消息重要性
            const importanceScores = await this.aiMemorySummarizer.evaluateMessageImportance(messagesToSummarize);

            // 生成AI总结
            const aiSummary = await this.aiMemorySummarizer.generateAISummary(messagesToSummarize, importanceScores);

            // 分类和标记
            const classifiedSummary = await this.aiMemorySummarizer.classifyAndTagSummary(aiSummary, messagesToSummarize);

            // 添加与传统总结的关联
            classifiedSummary.relatedSummaryId = summaryRecord.id;
            classifiedSummary.summaryType = 'ai_memory';
            classifiedSummary.messageRange = summaryRange;

            // 保存到AI总结历史
            await this.aiMemorySummarizer.saveAISummaryToHistory(classifiedSummary);

            console.log('[SummaryManager] ✅ AI记忆总结生成完成');
            return classifiedSummary;

        } catch (error) {
            console.error('[SummaryManager] ❌ 生成AI记忆总结失败:', error);
            return null;
        }
    }

    /**
     * 🚀 获取增强的总结历史（包含AI记忆总结）
     */
    async getEnhancedSummaryHistory() {
        try {
            console.log('[SummaryManager] 📚 获取增强的总结历史...');

            // 获取传统总结历史
            const traditionalSummaries = await this.getSummaryHistory();

            // 获取AI记忆总结历史
            let aiSummaries = [];
            if (this.aiMemorySummarizer) {
                aiSummaries = await this.aiMemorySummarizer.getAISummaryHistory();
            }

            // 合并和排序
            const allSummaries = [
                ...traditionalSummaries.map(s => ({ ...s, type: 'traditional' })),
                ...aiSummaries.map(s => ({ ...s, type: 'ai_memory' }))
            ].sort((a, b) => b.timestamp - a.timestamp);

            console.log('[SummaryManager] 📊 增强总结历史获取完成:', {
                traditional: traditionalSummaries.length,
                aiMemory: aiSummaries.length,
                total: allSummaries.length
            });

            return allSummaries;

        } catch (error) {
            console.error('[SummaryManager] ❌ 获取增强总结历史失败:', error);
            return await this.getSummaryHistory(); // 降级到传统总结
        }
    }

    /**
     * 🚀 智能总结推荐
     */
    async getSmartSummaryRecommendations() {
        try {
            console.log('[SummaryManager] 🎯 生成智能总结推荐...');

            if (!this.aiMemorySummarizer) {
                return {
                    shouldSummarize: false,
                    reason: 'AI记忆总结器未启用',
                    recommendations: []
                };
            }

            const context = SillyTavern.getContext();
            if (!context || !context.chat) {
                return {
                    shouldSummarize: false,
                    reason: '无法获取聊天上下文',
                    recommendations: []
                };
            }

            const currentMessageCount = context.chat.length;
            const messagesSinceLastSummary = currentMessageCount - this.lastSummaryMessageId;

            // 获取最近的消息进行分析
            const recentMessages = context.chat.slice(-10);
            const importanceScores = await this.aiMemorySummarizer.evaluateMessageImportance(recentMessages);

            // 计算平均重要性
            const avgImportance = importanceScores.reduce((a, b) => a + b, 0) / importanceScores.length;

            const recommendations = [];
            let shouldSummarize = false;

            // 基于消息数量的推荐
            if (messagesSinceLastSummary >= this.settings.summaryFloorCount) {
                shouldSummarize = true;
                recommendations.push({
                    type: 'message_count',
                    priority: 'high',
                    reason: `已达到设定的总结楼层数 (${this.settings.summaryFloorCount})`
                });
            }

            // 基于重要性的推荐
            if (avgImportance > 0.7) {
                shouldSummarize = true;
                recommendations.push({
                    type: 'importance',
                    priority: 'high',
                    reason: `最近消息重要性较高 (${(avgImportance * 100).toFixed(0)}%)`
                });
            }

            // 基于内容类型的推荐
            const hasImportantContent = recentMessages.some(msg => {
                const content = (msg.mes || '').toLowerCase();
                return content.includes('重要') || content.includes('决定') || content.includes('计划');
            });

            if (hasImportantContent) {
                recommendations.push({
                    type: 'content',
                    priority: 'medium',
                    reason: '检测到重要内容关键词'
                });
            }

            return {
                shouldSummarize,
                messagesSinceLastSummary,
                avgImportance,
                recommendations,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[SummaryManager] ❌ 生成智能总结推荐失败:', error);
            return {
                shouldSummarize: false,
                reason: '推荐生成失败',
                error: error.message,
                recommendations: []
            };
        }
    }

    /**
     * 🔍 语义搜索记忆
     */
    async semanticSearchMemories(query, options = {}) {
        try {
            console.log('[SummaryManager] 🔍 开始语义搜索记忆:', query);

            if (!this.vectorizedMemoryRetrieval) {
                console.warn('[SummaryManager] ⚠️ 向量化记忆检索系统未初始化，使用基础搜索');
                return await this.basicSearchMemories(query, options);
            }

            // 使用向量化记忆检索系统进行语义搜索
            const searchResults = await this.vectorizedMemoryRetrieval.semanticSearch(query, options);

            console.log(`[SummaryManager] ✅ 语义搜索完成，找到 ${searchResults.results.length} 个结果`);
            return searchResults;

        } catch (error) {
            console.error('[SummaryManager] ❌ 语义搜索失败:', error);
            // 降级到基础搜索
            return await this.basicSearchMemories(query, options);
        }
    }

    /**
     * 🔍 基础搜索记忆（降级方案）
     */
    async basicSearchMemories(query, options = {}) {
        try {
            console.log('[SummaryManager] 🔍 使用基础搜索记忆:', query);

            const {
                maxResults = 10,
                includeTraditional = true,
                includeAIMemory = true
            } = options;

            const results = [];
            const queryLower = query.toLowerCase();

            // 搜索传统总结
            if (includeTraditional) {
                const traditionalSummaries = await this.getSummaryHistory();
                for (const summary of traditionalSummaries) {
                    if (summary.content && summary.content.toLowerCase().includes(queryLower)) {
                        results.push({
                            id: summary.id,
                            content: summary.content,
                            type: 'traditional_summary',
                            timestamp: summary.timestamp,
                            similarity: 0.8 // 基础匹配分数
                        });
                    }
                }
            }

            // 搜索AI记忆总结
            if (includeAIMemory && this.aiMemorySummarizer) {
                const aiSummaries = await this.aiMemorySummarizer.getAISummaryHistory();
                for (const summary of aiSummaries) {
                    if (summary.content && summary.content.toLowerCase().includes(queryLower)) {
                        results.push({
                            id: summary.id,
                            content: summary.content,
                            type: 'ai_memory',
                            timestamp: summary.timestamp,
                            similarity: 0.8,
                            classification: summary.classification,
                            tags: summary.tags
                        });
                    }
                }
            }

            // 按时间戳排序并限制结果数量
            results.sort((a, b) => b.timestamp - a.timestamp);
            const finalResults = results.slice(0, maxResults);

            return {
                query: query,
                results: finalResults,
                totalResults: results.length,
                searchTime: 0,
                timestamp: Date.now(),
                searchType: 'basic'
            };

        } catch (error) {
            console.error('[SummaryManager] ❌ 基础搜索失败:', error);
            return {
                query: query,
                results: [],
                error: error.message,
                timestamp: Date.now(),
                searchType: 'basic'
            };
        }
    }

    /**
     * 🔍 获取相关记忆
     */
    async getRelatedMemories(context, options = {}) {
        try {
            console.log('[SummaryManager] 🧠 获取相关记忆...');

            if (!this.vectorizedMemoryRetrieval) {
                console.warn('[SummaryManager] ⚠️ 向量化记忆检索系统未初始化');
                return [];
            }

            const {
                maxResults = 5,
                similarityThreshold = 0.7,
                includeMetadata = true
            } = options;

            // 使用语义搜索获取相关记忆
            const searchResults = await this.vectorizedMemoryRetrieval.semanticSearch(context, {
                maxResults,
                similarityThreshold,
                includeMetadata
            });

            return searchResults.results || [];

        } catch (error) {
            console.error('[SummaryManager] ❌ 获取相关记忆失败:', error);
            return [];
        }
    }

    /**
     * 🔍 获取向量化记忆检索系统状态
     */
    getVectorizedMemoryRetrievalStatus() {
        try {
            if (!this.vectorizedMemoryRetrieval) {
                return {
                    available: false,
                    error: '向量化记忆检索系统未初始化'
                };
            }

            return {
                available: true,
                status: this.vectorizedMemoryRetrieval.getStatus()
            };

        } catch (error) {
            console.error('[SummaryManager] ❌ 获取向量化记忆检索系统状态失败:', error);
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * 🚀 上传总结到世界书
     * @param {string} summaryId - 总结ID
     * @param {Object} options - 上传选项
     * @returns {Promise<Object>} 上传结果
     */
    async uploadSummaryToWorldBook(summaryId, options = {}) {
        try {
            console.log('[SummaryManager] 📤 开始上传总结到世界书:', summaryId);

            // 1. 获取总结数据
            const summaryData = await this.getSummaryById(summaryId);
            if (!summaryData) {
                throw new Error(`未找到总结记录: ${summaryId}`);
            }

            // 2. 检查WorldBookManager是否可用
            const infoBarTool = window.SillyTavernInfobar;
            const worldBookManager = infoBarTool?.modules?.worldBookManager;

            if (!worldBookManager) {
                throw new Error('WorldBookManager未初始化，无法上传到世界书');
            }

            // 3. 调用WorldBookManager上传方法
            const uploadResult = await worldBookManager.uploadSummaryToWorldBook(summaryData, options);

            // 4. 更新总结记录，标记已上传
            if (uploadResult.success) {
                await this.markSummaryAsUploaded(summaryId, {
                    worldBookName: uploadResult.worldBookName,
                    entryId: uploadResult.entryId,
                    entryName: uploadResult.entryName,
                    uploadedAt: Date.now()
                });
            }

            // 5. 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:uploaded-to-worldbook', {
                    summaryId: summaryId,
                    uploadResult: uploadResult,
                    timestamp: Date.now()
                });
            }

            console.log('[SummaryManager] ✅ 总结上传完成:', uploadResult);
            return uploadResult;

        } catch (error) {
            console.error('[SummaryManager] ❌ 上传总结到世界书失败:', error);

            // 触发错误事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:upload-error', {
                    summaryId: summaryId,
                    error: error.message,
                    timestamp: Date.now()
                });
            }

            return {
                success: false,
                error: error.message,
                message: `上传失败: ${error.message}`
            };
        }
    }

    /**
     * 📋 根据ID获取总结数据
     */
    async getSummaryById(summaryId) {
        try {
            // 从增强的总结历史中查找
            const allSummaries = await this.getEnhancedSummaryHistory();
            const summary = allSummaries.find(s => s.id === summaryId);

            if (summary) {
                console.log('[SummaryManager] 📋 找到总结记录:', summaryId);
                return summary;
            }

            console.warn('[SummaryManager] ⚠️ 未找到总结记录:', summaryId);
            return null;

        } catch (error) {
            console.error('[SummaryManager] ❌ 获取总结数据失败:', error);
            return null;
        }
    }

    /**
     * 🏷️ 标记总结为已上传
     */
    async markSummaryAsUploaded(summaryId, uploadInfo) {
        try {
            console.log('[SummaryManager] 🏷️ 标记总结为已上传:', summaryId);

            if (!this.unifiedDataCore) {
                console.warn('[SummaryManager] ⚠️ UnifiedDataCore未初始化，无法标记上传状态');
                return false;
            }

            // 获取当前聊天ID
            const currentChatId = this.unifiedDataCore.getCurrentChatId();
            if (!currentChatId) {
                console.warn('[SummaryManager] ⚠️ 无法获取当前聊天ID');
                return false;
            }

            // 获取聊天数据
            const chatData = await this.unifiedDataCore.getChatData(currentChatId) || {};
            const summaryHistory = chatData.summary_history || [];

            // 查找并更新总结记录
            const summaryIndex = summaryHistory.findIndex(s => s.id === summaryId);
            if (summaryIndex !== -1) {
                summaryHistory[summaryIndex].worldBookUpload = uploadInfo;

                // 保存更新后的数据
                chatData.summary_history = summaryHistory;
                await this.unifiedDataCore.setChatData(currentChatId, chatData);

                console.log('[SummaryManager] ✅ 总结上传状态已更新');
                return true;
            }

            // 如果在传统总结中没找到，检查AI记忆总结
            if (this.aiMemorySummarizer) {
                const aiSummaryUpdated = await this.aiMemorySummarizer.markSummaryAsUploaded(summaryId, uploadInfo);
                if (aiSummaryUpdated) {
                    console.log('[SummaryManager] ✅ AI记忆总结上传状态已更新');
                    return true;
                }
            }

            console.warn('[SummaryManager] ⚠️ 未找到要更新的总结记录:', summaryId);
            return false;

        } catch (error) {
            console.error('[SummaryManager] ❌ 标记总结上传状态失败:', error);
            return false;
        }
    }

    /**
     * 📤 批量上传总结到世界书
     * @param {Array} summaryIds - 总结ID数组
     * @param {Object} options - 上传选项
     * @returns {Promise<Object>} 批量上传结果
     */
    async batchUploadSummariesToWorldBook(summaryIds, options = {}) {
        try {
            console.log('[SummaryManager] 📤 开始批量上传总结到世界书:', summaryIds.length);

            const results = {
                success: [],
                failed: [],
                total: summaryIds.length
            };

            // 逐个上传总结
            for (const summaryId of summaryIds) {
                try {
                    const uploadResult = await this.uploadSummaryToWorldBook(summaryId, options);

                    if (uploadResult.success) {
                        results.success.push({
                            summaryId: summaryId,
                            result: uploadResult
                        });
                    } else {
                        results.failed.push({
                            summaryId: summaryId,
                            error: uploadResult.error
                        });
                    }

                    // 添加延迟避免过快的连续请求
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    results.failed.push({
                        summaryId: summaryId,
                        error: error.message
                    });
                }
            }

            console.log('[SummaryManager] ✅ 批量上传完成:', {
                success: results.success.length,
                failed: results.failed.length,
                total: results.total
            });

            // 触发批量上传完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary:batch-upload-complete', {
                    results: results,
                    timestamp: Date.now()
                });
            }

            return {
                success: true,
                results: results,
                message: `批量上传完成: ${results.success.length}/${results.total} 成功`
            };

        } catch (error) {
            console.error('[SummaryManager] ❌ 批量上传总结失败:', error);
            return {
                success: false,
                error: error.message,
                message: `批量上传失败: ${error.message}`
            };
        }
    }

    /**
     * 🔍 检查总结是否已上传到世界书
     * @param {string} summaryId - 总结ID
     * @returns {Promise<Object>} 上传状态信息
     */
    async checkSummaryUploadStatus(summaryId) {
        try {
            const summaryData = await this.getSummaryById(summaryId);
            if (!summaryData) {
                return {
                    uploaded: false,
                    error: '总结记录不存在'
                };
            }

            const uploadInfo = summaryData.worldBookUpload;
            if (uploadInfo) {
                return {
                    uploaded: true,
                    worldBookName: uploadInfo.worldBookName,
                    entryId: uploadInfo.entryId,
                    entryName: uploadInfo.entryName,
                    uploadedAt: uploadInfo.uploadedAt
                };
            }

            return {
                uploaded: false
            };

        } catch (error) {
            console.error('[SummaryManager] ❌ 检查总结上传状态失败:', error);
            return {
                uploaded: false,
                error: error.message
            };
        }
    }
}
