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
        
        // 总结设置
        this.settings = {
            autoSummaryEnabled: false,
            summaryFloorCount: 20,
            summaryType: 'small',
            summaryWordCount: 300,
            injectSummaryEnabled: false  // 🔧 新增：总结注入功能开关
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
                console.log('[SummaryManager] 📊 当前消息数量:', this.lastMessageCount);
            }
            
        } catch (error) {
            console.error('[SummaryManager] ❌ 初始化消息计数失败:', error);
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

            console.log('[SummaryManager] ✅ 总结生成完成:', summaryRecord.id);

            return {
                success: true,
                summaryId: summaryRecord.id,
                content: summaryContent
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
                model: apiConfig.model
            });

            // 🔧 修复：使用正确的API调用方法
            // 构建消息格式
            const messages = [
                {
                    role: 'user',
                    content: summaryPrompt
                }
            ];

            // 调用InfoBarSettings的sendCustomAPIRequest方法
            const apiResult = await this.infoBarSettings.sendCustomAPIRequest(messages);

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
}
