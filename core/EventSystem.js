/**
 * 事件管理系统
 * 
 * 负责管理扩展内部事件和SillyTavern事件集成：
 * - 内部事件的注册、触发和监听
 * - SillyTavern事件的代理和转发
 * - 事件队列和异步处理
 * - 事件日志和调试支持
 * 
 * @class EventSystem
 */

export class EventSystem {
    constructor() {
        console.log('[EventSystem] 🔧 事件管理系统初始化开始');

        // 事件监听器映射
        this.listeners = new Map();

        // SillyTavern事件系统引用
        this.sillyTavernEventSource = null;
        this.sillyTavernEventTypes = null;

        // 事件队列
        this.eventQueue = [];
        this.processingQueue = false;

        // 🔧 优化：聊天切换状态管理
        this.chatSwitchInProgress = false;
        this.messagePollingInterval = null;
        this.lastMessageCount = 0;

        // 事件统计
        this.eventStats = {
            emitted: 0,
            processed: 0,
            errors: 0
        };
        
        // 调试模式
        this.debugMode = false;
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 预定义事件类型
        this.EVENT_TYPES = Object.freeze({
            // 系统事件
            SYSTEM_READY: 'system:ready',
            SYSTEM_ERROR: 'system:error',
            
            // 数据事件
            DATA_CHANGED: 'data:changed',
            DATA_DELETED: 'data:deleted',
            DATA_SYNCED: 'data:synced',
            DATA_BACKUP_CREATED: 'data:backup:created',
            
            // UI事件
            UI_SHOW: 'ui:show',
            UI_HIDE: 'ui:hide',
            UI_TOGGLE: 'ui:toggle',
            UI_REFRESH: 'ui:refresh',
            
            // API事件
            API_REQUEST: 'api:request',
            API_RESPONSE: 'api:response',
            API_ERROR: 'api:error',
            
            // 聊天事件
            CHAT_CHANGED: 'chat:changed',
            MESSAGE_RECEIVED: 'message:received',
            MESSAGE_SENT: 'message:sent',
            MESSAGE_DELETED: 'message:deleted',
            MESSAGE_REGENERATED: 'message:regenerated',
            
            // 配置事件
            CONFIG_CHANGED: 'config:changed',
            CONFIG_RESET: 'config:reset',
            
            // 面板事件
            PANEL_CREATED: 'panel:created',
            PANEL_UPDATED: 'panel:updated',
            PANEL_DELETED: 'panel:deleted'
        });
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
        this.emit = this.emit.bind(this);
        this.processEventQueue = this.processEventQueue.bind(this);
        
        // 自动初始化
        this.init();
    }

    /**
     * 初始化事件系统
     */
    init() {
        try {
            console.log('[EventSystem] 📊 开始初始化事件系统...');
            
            // 获取SillyTavern事件系统
            this.bindSillyTavernEvents();
            
            // 启动事件队列处理
            this.startEventQueueProcessor();
            
            this.initialized = true;
            console.log('[EventSystem] ✅ 事件系统初始化完成');
            
            // 触发系统就绪事件
            this.emit(this.EVENT_TYPES.SYSTEM_READY, {
                timestamp: Date.now(),
                version: '1.0.0'
            });
            
        } catch (error) {
            console.error('[EventSystem] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定SillyTavern事件系统
     */
    bindSillyTavernEvents() {
        try {
            // 获取SillyTavern上下文
            const context = SillyTavern?.getContext?.();
            
            if (context) {
                this.sillyTavernEventSource = context.eventSource;
                // 🔧 修复：使用正确的事件类型属性名
                this.sillyTavernEventTypes = context.event_types || context.eventTypes;

                console.log('[EventSystem] 🔗 SillyTavern事件系统绑定成功');
                console.log('[EventSystem] 📋 可用事件类型:', this.sillyTavernEventTypes ? Object.keys(this.sillyTavernEventTypes) : '无');

                // 立即设置事件代理
                this.setupEventProxies();
                this.bindMessageEvents();
            } else {
                console.warn('[EventSystem] ⚠️ 无法获取SillyTavern事件系统，将在稍后重试');
                
                // 延迟重试
                setTimeout(() => {
                    this.bindSillyTavernEvents();
                }, 1000);
            }
        } catch (error) {
            console.error('[EventSystem] ❌ 绑定SillyTavern事件系统失败:', error);
        }
    }

    /**
     * 启动事件队列处理器
     */
    startEventQueueProcessor() {
        setInterval(() => {
            if (!this.processingQueue && this.eventQueue.length > 0) {
                this.processEventQueue();
            }
        }, 10); // 10ms间隔处理事件队列
    }

    /**
     * 处理事件队列
     */
    async processEventQueue() {
        if (this.processingQueue || this.eventQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        
        try {
            while (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift();
                await this.processEvent(event);
                this.eventStats.processed++;
            }
        } catch (error) {
            console.error('[EventSystem] ❌ 处理事件队列失败:', error);
            this.handleError(error);
        } finally {
            this.processingQueue = false;
        }
    }

    /**
     * 处理单个事件
     */
    async processEvent(event) {
        try {
            const { type, data, timestamp } = event;
            
            if (this.debugMode) {
                console.log(`[EventSystem] 🎯 处理事件: ${type}`, data);
            }
            
            // 获取事件监听器
            const listeners = this.listeners.get(type) || [];
            
            // 并行执行所有监听器
            const promises = listeners.map(async (listener) => {
                try {
                    if (typeof listener === 'function') {
                        await listener(data, { type, timestamp });
                    }
                } catch (error) {
                    console.error(`[EventSystem] ❌ 监听器执行失败 (${type}):`, error);
                    this.eventStats.errors++;
                }
            });
            
            await Promise.all(promises);
            
        } catch (error) {
            console.error('[EventSystem] ❌ 处理事件失败:', error);
            this.eventStats.errors++;
        }
    }

    /**
     * 注册事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    on(eventType, callback) {
        try {
            if (typeof eventType !== 'string') {
                throw new Error('事件类型必须是字符串');
            }
            
            if (typeof callback !== 'function') {
                throw new Error('回调函数必须是函数');
            }
            
            // 获取或创建监听器数组
            if (!this.listeners.has(eventType)) {
                this.listeners.set(eventType, []);
            }
            
            const listeners = this.listeners.get(eventType);
            listeners.push(callback);
            
            if (this.debugMode) {
                console.log(`[EventSystem] 📝 注册监听器: ${eventType} (总数: ${listeners.length})`);
            }
            
            // 返回取消监听的函数
            return () => {
                this.off(eventType, callback);
            };
            
        } catch (error) {
            console.error('[EventSystem] ❌ 注册监听器失败:', error);
            this.handleError(error);
            return () => {}; // 返回空函数避免错误
        }
    }

    /**
     * 取消事件监听器
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     */
    off(eventType, callback) {
        try {
            const listeners = this.listeners.get(eventType);
            
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                    
                    if (this.debugMode) {
                        console.log(`[EventSystem] 🗑️ 取消监听器: ${eventType} (剩余: ${listeners.length})`);
                    }
                    
                    // 如果没有监听器了，删除整个条目
                    if (listeners.length === 0) {
                        this.listeners.delete(eventType);
                    }
                }
            }
        } catch (error) {
            console.error('[EventSystem] ❌ 取消监听器失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 触发事件
     * @param {string} eventType - 事件类型
     * @param {any} data - 事件数据
     * @param {Object} options - 选项
     */
    async emit(eventType, data = null, options = {}) {
        try {
            if (typeof eventType !== 'string') {
                throw new Error('事件类型必须是字符串');
            }
            
            const event = {
                type: eventType,
                data,
                timestamp: Date.now(),
                ...options
            };
            
            this.eventStats.emitted++;
            
            if (this.debugMode) {
                console.log(`[EventSystem] 🚀 触发事件: ${eventType}`, data);
            }
            
            // 如果是同步模式，直接处理
            if (options.sync) {
                await this.processEvent(event);
            } else {
                // 否则加入队列异步处理
                this.eventQueue.push(event);
            }
            
        } catch (error) {
            console.error('[EventSystem] ❌ 触发事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 一次性监听器
     * @param {string} eventType - 事件类型
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    once(eventType, callback) {
        const wrappedCallback = (data, meta) => {
            callback(data, meta);
            this.off(eventType, wrappedCallback);
        };
        
        return this.on(eventType, wrappedCallback);
    }

    /**
     * 等待特定事件
     * @param {string} eventType - 事件类型
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise} Promise对象
     */
    waitFor(eventType, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(eventType, handler);
                reject(new Error(`等待事件超时: ${eventType}`));
            }, timeout);
            
            const handler = (data, meta) => {
                clearTimeout(timer);
                resolve({ data, meta });
            };
            
            this.once(eventType, handler);
        });
    }

    /**
     * 代理SillyTavern事件
     * @param {string} sillyTavernEventType - SillyTavern事件类型
     * @param {string} internalEventType - 内部事件类型
     */
    proxySillyTavernEvent(sillyTavernEventType, internalEventType) {
        if (!this.sillyTavernEventSource) {
            console.warn('[EventSystem] ⚠️ SillyTavern事件系统未就绪，无法代理事件');
            return;
        }
        
        try {
            this.sillyTavernEventSource.on(sillyTavernEventType, (data) => {
                this.emit(internalEventType, data);
            });
            
            console.log(`[EventSystem] 🔄 代理事件: ${sillyTavernEventType} -> ${internalEventType}`);
            
        } catch (error) {
            console.error('[EventSystem] ❌ 代理事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 批量注册事件代理
     */
    setupEventProxies() {
        if (!this.sillyTavernEventTypes) {
            console.warn('[EventSystem] ⚠️ SillyTavern事件类型未就绪');
            return;
        }
        
        const proxies = [
            [this.sillyTavernEventTypes.CHAT_CHANGED, this.EVENT_TYPES.CHAT_CHANGED],
            [this.sillyTavernEventTypes.MESSAGE_RECEIVED, this.EVENT_TYPES.MESSAGE_RECEIVED],
            [this.sillyTavernEventTypes.MESSAGE_SENT, this.EVENT_TYPES.MESSAGE_SENT]
        ];
        
        proxies.forEach(([stEvent, internalEvent]) => {
            this.proxySillyTavernEvent(stEvent, internalEvent);
        });
        
        console.log('[EventSystem] 🔗 事件代理设置完成');
    }

    /**
     * 获取事件统计信息
     */
    getStats() {
        return {
            ...this.eventStats,
            listenersCount: this.listeners.size,
            queueLength: this.eventQueue.length,
            processingQueue: this.processingQueue
        };
    }

    /**
     * 清理所有监听器
     */
    clearAllListeners() {
        this.listeners.clear();
        console.log('[EventSystem] 🧹 所有监听器已清理');
    }

    /**
     * 设置调试模式
     * @param {boolean} enabled - 是否启用调试模式
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[EventSystem] 🐛 调试模式: ${enabled ? '启用' : '禁用'}`);
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[EventSystem] ❌ 错误 #${this.errorCount}:`, error);
        
        // 触发系统错误事件
        if (this.initialized) {
            this.emit(this.EVENT_TYPES.SYSTEM_ERROR, {
                error: error.message,
                count: this.errorCount,
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
            debugMode: this.debugMode,
            stats: this.getStats(),
            sillyTavernBound: !!this.sillyTavernEventSource
        };
    }

    /**
     * 销毁事件系统
     */
    destroy() {
        this.clearAllListeners();
        this.eventQueue.length = 0;
        this.initialized = false;
        console.log('[EventSystem] 💥 事件系统已销毁');
    }

    // ==================== 消息监听和XML数据提取 ====================

    /**
     * 初始化消息监听器
     * @param {Object} xmlParser - XML解析器实例
     * @param {Object} dataCore - 数据核心实例
     */
    initMessageListener(xmlParser, dataCore) {
        try {
            console.log('[EventSystem] 🔄 初始化消息监听器...');

            if (!xmlParser || !dataCore) {
                console.error('[EventSystem] ❌ XML解析器或数据核心未提供');
                return;
            }

            this.xmlParser = xmlParser;
            this.dataCore = dataCore;

            // 绑定SillyTavern消息事件
            this.bindMessageEvents();

            console.log('[EventSystem] ✅ 消息监听器初始化完成');

        } catch (error) {
            console.error('[EventSystem] ❌ 初始化消息监听器失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定SillyTavern消息事件
     */
    bindMessageEvents() {
        try {
            if (!this.sillyTavernEventSource || !this.sillyTavernEventTypes) {
                console.warn('[EventSystem] ⚠️ SillyTavern事件系统未就绪，延迟绑定消息事件');
                setTimeout(() => this.bindMessageEvents(), 1000);
                return;
            }

            // 监听消息接收事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.MESSAGE_RECEIVED, (data) => {
                this.handleMessageReceived(data);
            });

            // 监听消息发送事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.MESSAGE_SENT, (data) => {
                this.handleMessageSent(data);
            });

            // 监听角色消息渲染事件（AI回复完成后）- 这是最可靠的事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.CHARACTER_MESSAGE_RENDERED, (data) => {
                console.log('[EventSystem] 📨 收到角色消息渲染事件');
                // 🔧 修复：延迟处理，确保消息完全渲染完成
                setTimeout(() => {
                    this.handleCharacterMessageRendered(data);
                }, 100);
            });

            // 监听用户消息渲染事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.USER_MESSAGE_RENDERED, (data) => {
                console.log('[EventSystem] 📤 收到用户消息渲染事件');
                this.handleMessageSent(data);
            });

            // 监听聊天切换事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.CHAT_CHANGED, (data) => {
                this.handleChatChanged(data);
            });

            // 监听消息删除事件
            if (this.sillyTavernEventTypes.MESSAGE_DELETED) {
                this.sillyTavernEventSource.on(this.sillyTavernEventTypes.MESSAGE_DELETED, (data) => {
                    this.handleMessageDeleted(data);
                });
            }

            // 监听消息重新生成事件
            if (this.sillyTavernEventTypes.MESSAGE_REGENERATED || this.sillyTavernEventTypes.MESSAGE_REGENERATE) {
                const eventType = this.sillyTavernEventTypes.MESSAGE_REGENERATED || this.sillyTavernEventTypes.MESSAGE_REGENERATE;
                this.sillyTavernEventSource.on(eventType, (data) => {
                    this.handleMessageRegenerated(data);
                });
            }

            // 添加轮询机制作为备用方案
            this.startMessagePolling();

            console.log('[EventSystem] 🔗 SillyTavern消息事件绑定完成');

        } catch (error) {
            console.error('[EventSystem] ❌ 绑定SillyTavern消息事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 启动消息轮询机制（备用方案）
     */
    startMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
        }

        // 🔧 优化：初始化时设置为当前消息数量，避免重新处理历史消息
        this.lastMessageCount = this.getCurrentMessageCount();

        this.messagePollingInterval = setInterval(() => {
            try {
                // 🔧 优化：如果正在进行聊天切换，暂停轮询
                if (this.chatSwitchInProgress) {
                    console.log('[EventSystem] ⏸️ 聊天切换中，暂停轮询');
                    return;
                }

                const context = SillyTavern.getContext();
                if (context && context.chat && Array.isArray(context.chat)) {
                    const currentMessageCount = context.chat.length;

                    // 检查是否有新消息
                    if (currentMessageCount > this.lastMessageCount) {
                        const newMessages = context.chat.slice(this.lastMessageCount);

                        newMessages.forEach(message => {
                            const mes = message && message.mes;
                            const hasCompleteInfobar = typeof mes === 'string' && /<infobar_data>[\s\S]*<\/infobar_data>/.test(mes);
                            if (hasCompleteInfobar) {
                                console.log('[EventSystem] 🔍 轮询发现包含infobar_data的消息');
                                this.handleMessageReceived(message);
                            }
                        });

                        this.lastMessageCount = currentMessageCount;
                    }
                }
            } catch (error) {
                console.error('[EventSystem] ❌ 消息轮询失败:', error);
            }
        }, 2000); // 每2秒检查一次

        console.log('[EventSystem] 🔄 消息轮询机制已启动，初始消息数量:', this.lastMessageCount);
    }

    /**
     * 获取当前消息数量
     */
    getCurrentMessageCount() {
        try {
            const context = SillyTavern.getContext();
            if (context && context.chat && Array.isArray(context.chat)) {
                return context.chat.length;
            }
            return 0;
        } catch (error) {
            console.error('[EventSystem] ❌ 获取当前消息数量失败:', error);
            return 0;
        }
    }

    /**
     * 重置轮询机制（聊天切换时调用）
     */
    resetMessagePolling() {
        try {
            console.log('[EventSystem] 🔄 重置消息轮询机制');

            // 🔧 关键修复：重置消息计数为当前消息数量，避免重新处理历史消息
            this.lastMessageCount = this.getCurrentMessageCount();
            console.log('[EventSystem] 📊 重置消息计数为:', this.lastMessageCount);

            // 标记聊天切换状态
            this.chatSwitchInProgress = true;

            // 延迟重置，给聊天切换时间完成
            setTimeout(() => {
                this.chatSwitchInProgress = false;
                console.log('[EventSystem] ✅ 聊天切换完成，恢复轮询');
            }, 3000); // 3秒后恢复轮询

        } catch (error) {
            console.error('[EventSystem] ❌ 重置轮询机制失败:', error);
        }
    }

    /**
     * 处理角色消息渲染事件（专门处理AI回复）
     * @param {Object} data - 事件数据
     */
    async handleCharacterMessageRendered(data) {
        try {
            console.log('[EventSystem] 🎭 处理角色消息渲染事件');

            // 🔧 修复：获取当前聊天的最后一条AI消息
            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                console.log('[EventSystem] ℹ️ 没有聊天数据，跳过处理');
                return;
            }

            // 找到最后一条非用户消息（AI消息）
            const lastAIMessage = [...context.chat].reverse().find(msg => !msg.is_user);
            if (!lastAIMessage) {
                console.log('[EventSystem] ℹ️ 没有找到AI消息，跳过处理');
                return;
            }

            // 检查消息是否包含infobar_data
            const messageContent = this.extractMessageContent(lastAIMessage);
            const hasInfobarData = messageContent && /<infobar_data>[\s\S]*<\/infobar_data>/.test(messageContent);

            if (!hasInfobarData) {
                console.log('[EventSystem] ℹ️ AI消息不包含infobar_data，跳过处理');
                return;
            }

            console.log('[EventSystem] 🎯 AI消息包含infobar_data，开始处理...');

            // 提取并解析infobar_data
            const didStore = await this.extractAndParseInfobarData(lastAIMessage, 'character_rendered');

            if (didStore) {
                console.log('[EventSystem] 🚀 AI消息infobar_data处理成功');
                this.emit(this.EVENT_TYPES.MESSAGE_RECEIVED, lastAIMessage);
            }

        } catch (error) {
            console.error('[EventSystem] ❌ 处理角色消息渲染事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息接收事件
     * @param {Object} data - 消息数据
     */
    async handleMessageReceived(data) {
        try {
            console.log('[EventSystem] 📨 收到消息接收事件');

            // 🔧 修复：先检查消息是否包含infobar_data，避免过早触发渲染
            const messageContent = this.extractMessageContent(data);
            const hasInfobarData = messageContent && /<infobar_data>[\s\S]*<\/infobar_data>/.test(messageContent);

            if (!hasInfobarData) {
                console.log('[EventSystem] ℹ️ 消息不包含infobar_data，跳过处理和事件转发');
                return;
            }

            console.log('[EventSystem] 🎯 检测到包含infobar_data的消息，开始处理...');

            // 提取并解析infobar_data
            const didStore = await this.extractAndParseInfobarData(data, 'received');

            // 🔧 修复：只有在成功处理infobar_data后才转发内部事件
            if (didStore) {
                console.log('[EventSystem] 🚀 转发infobar数据就绪事件');
                this.emit(this.EVENT_TYPES.MESSAGE_RECEIVED, data);
            }

        } catch (error) {
            console.error('[EventSystem] ❌ 处理消息接收事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息发送事件
     * @param {Object} data - 消息数据
     */
    async handleMessageSent(data) {
        try {
            console.log('[EventSystem] 📤 收到消息发送事件');

            // 🔧 修复：用户消息通常不包含infobar_data，跳过处理避免无意义的渲染触发
            const messageContent = this.extractMessageContent(data);
            const hasInfobarData = messageContent && messageContent.includes('<infobar_data>');

            if (!hasInfobarData) {
                console.log('[EventSystem] ℹ️ 用户消息不包含infobar_data，跳过处理');
                return;
            }

            console.log('[EventSystem] 🎯 用户消息包含infobar_data（罕见情况），开始处理...');

            // 提取并解析infobar_data（罕见情况）
            await this.extractAndParseInfobarData(data, 'sent');

            // 转发内部事件
            this.emit(this.EVENT_TYPES.MESSAGE_SENT, data);

        } catch (error) {
            console.error('[EventSystem] ❌ 处理消息发送事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理聊天切换事件
     * @param {Object} data - 聊天切换数据
     */
    async handleChatChanged(data) {
        try {
            console.log('[EventSystem] 🔄 收到聊天切换事件');

            // 🔧 优化：重置轮询机制，避免重新处理历史消息
            this.resetMessagePolling();

            // 转发内部事件
            this.emit(this.EVENT_TYPES.CHAT_CHANGED, data);

        } catch (error) {
            console.error('[EventSystem] ❌ 处理聊天切换事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息删除事件
     * @param {Object} data - 消息删除数据
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[EventSystem] 🗑️ 收到消息删除事件', data);
            console.log('[EventSystem] 🔍 调试：事件数据类型:', typeof data);
            console.log('[EventSystem] 🔍 调试：事件数据内容:', JSON.stringify(data, null, 2));

            // 获取当前聊天ID和聊天数据
            const context = SillyTavern.getContext();
            const chatId = context?.chatId || this.dataCore?.getCurrentChatId();
            const chat = context?.chat;

            console.log('[EventSystem] 🔍 调试：聊天上下文:', {
                chatId: chatId,
                chatLength: chat?.length,
                hasChatData: !!chat
            });

            if (!chat || !Array.isArray(chat)) {
                console.warn('[EventSystem] ⚠️ 无法获取聊天数据，跳过消息删除处理');
                return;
            }

            // 🔧 增强调试：检查被删除的消息类型
            let deletedMessageInfo = null;
            let detectionStrategy = 'unknown';
            
            // 策略1：data是数字（消息索引）
            if (typeof data === 'number') {
                detectionStrategy = 'number_index';
                const messageIndex = data;
                console.log('[EventSystem] 🔍 调试：策略1 - 数字索引:', messageIndex);
                
                if (messageIndex >= 0 && messageIndex < chat.length) {
                    const message = chat[messageIndex];
                    console.log('[EventSystem] 🔍 调试：找到消息:', {
                        index: messageIndex,
                        is_user: message?.is_user,
                        mes: message?.mes?.substring(0, 50) + '...'
                    });
                    
                    deletedMessageInfo = {
                        index: messageIndex,
                        isUser: message?.is_user || false,
                        message: message
                    };
                }
            } 
            // 策略2：data是对象
            else if (data && typeof data === 'object') {
                detectionStrategy = 'object_data';
                console.log('[EventSystem] 🔍 调试：策略2 - 对象数据');
                
                // 尝试不同的索引字段
                const possibleIndexFields = ['index', 'mesid', 'messageId', 'id'];
                let messageIndex = null;
                
                for (const field of possibleIndexFields) {
                    if (data[field] !== undefined) {
                        messageIndex = data[field];
                        console.log('[EventSystem] 🔍 调试：从字段', field, '获取索引:', messageIndex);
                        break;
                    }
                }
                
                if (typeof messageIndex === 'number' && messageIndex >= 0 && messageIndex < chat.length) {
                    const message = chat[messageIndex];
                    console.log('[EventSystem] 🔍 调试：找到消息:', {
                        index: messageIndex,
                        is_user: message?.is_user,
                        mes: message?.mes?.substring(0, 50) + '...'
                    });
                    
                    deletedMessageInfo = {
                        index: messageIndex,
                        isUser: message?.is_user || false,
                        message: message
                    };
                }
            }
            
            // 策略3：智能推断被删除的消息类型
            if (!deletedMessageInfo && chat.length > 0) {
                detectionStrategy = 'smart_inference';
                console.log('[EventSystem] 🔍 调试：策略3 - 智能推断，分析消息模式');

                // 检查最后几条消息的模式
                const recentMessages = [];
                for (let i = Math.max(0, chat.length - 5); i < chat.length; i++) {
                    const message = chat[i];
                    recentMessages.push({
                        index: i,
                        is_user: message?.is_user,
                        hasInfobar: message?.mes?.includes('<infobar_data>') || false,
                        preview: message?.mes?.substring(0, 30) + '...'
                    });
                    console.log('[EventSystem] 🔍 调试：检查消息', i, ':', {
                        is_user: message?.is_user,
                        hasInfobar: message?.mes?.includes('<infobar_data>') || false,
                        mes: message?.mes?.substring(0, 30) + '...'
                    });
                }

                // 🔧 修复：智能推断被删除消息的类型
                let inferredDeletedMessage = null;

                // 优先级1：如果最后一条是用户消息，很可能删除的是AI消息（重新生成场景）
                if (chat.length > 0) {
                    const lastMessage = chat[chat.length - 1];
                    if (lastMessage?.is_user) {
                        console.log('[EventSystem] 🧠 推断：最后一条是用户消息，可能删除的是AI消息（重新生成场景）');
                        inferredDeletedMessage = {
                            index: chat.length, // 被删除的AI消息原本应该在这个位置
                            isUser: false, // 推断为AI消息
                            message: null, // 已被删除，无法获取原消息
                            inference: 'ai_message_after_user'
                        };
                    } else {
                        console.log('[EventSystem] 🧠 推断：最后一条是AI消息，可能删除的也是AI消息（编辑/删除场景）');
                        inferredDeletedMessage = {
                            index: chat.length, // 被删除的消息原本在末尾
                            isUser: false, // 推断为AI消息
                            message: null,
                            inference: 'ai_message_deletion'
                        };
                    }
                }

                // 优先级2：查找最近的AI消息模式
                if (!inferredDeletedMessage) {
                    const lastAIMessageIndex = recentMessages.findLastIndex(msg => !msg.is_user);
                    if (lastAIMessageIndex !== -1) {
                        console.log('[EventSystem] 🧠 推断：基于最近的AI消息模式');
                        inferredDeletedMessage = {
                            index: recentMessages[lastAIMessageIndex].index,
                            isUser: false,
                            message: chat[recentMessages[lastAIMessageIndex].index],
                            inference: 'recent_ai_pattern'
                        };
                    }
                }

                // 优先级3：默认推断为AI消息（因为用户消息删除通常不需要数据回溯）
                if (!inferredDeletedMessage) {
                    console.log('[EventSystem] 🧠 推断：默认推断为AI消息删除');
                    inferredDeletedMessage = {
                        index: -1,
                        isUser: false, // 默认推断为AI消息
                        message: null,
                        inference: 'default_ai_assumption'
                    };
                }

                deletedMessageInfo = inferredDeletedMessage;
                console.log('[EventSystem] 🔍 调试：智能推断结果:', deletedMessageInfo);
            }

            console.log('[EventSystem] 🔍 调试：检测策略:', detectionStrategy);
            console.log('[EventSystem] 🔍 调试：最终识别结果:', deletedMessageInfo);

            if (!deletedMessageInfo) {
                console.warn('[EventSystem] ⚠️ 无法确定被删除消息的类型，将按默认策略处理');
                // 如果无法确定，为了安全起见，仍然触发回溯
                deletedMessageInfo = { isUser: false, index: -1, message: null };
            }

            console.log('[EventSystem] 📊 被删除消息信息:', {
                index: deletedMessageInfo.index,
                isUser: deletedMessageInfo.isUser,
                messageType: deletedMessageInfo.isUser ? '用户消息' : 'AI消息',
                detectionStrategy: detectionStrategy,
                inference: deletedMessageInfo.inference || 'none'
            });

            // 🔧 新增：只有在删除AI消息时才进行数据回溯
            if (deletedMessageInfo.isUser) {
                console.log('[EventSystem] ℹ️ 删除的是用户消息，不需要进行数据回溯');
                
                // 仍然发送删除事件（用于UI清理等），但标记为用户消息
                this.emit(this.EVENT_TYPES.MESSAGE_DELETED, {
                    ...data,
                    chatId: chatId,
                    timestamp: Date.now(),
                    isUser: true,
                    skipRollback: true,  // 明确标记跳过回溯
                    messageInfo: deletedMessageInfo
                });
                
                console.log('[EventSystem] ✅ 用户消息删除事件已转发（跳过回溯）');
                return;
            }

            console.log('[EventSystem] 🔄 删除的是AI消息，将进行数据回溯...');

            // 转发内部事件，包含聊天ID和消息类型信息
            this.emit(this.EVENT_TYPES.MESSAGE_DELETED, {
                ...data,
                chatId: chatId,
                timestamp: Date.now(),
                isUser: false,
                skipRollback: false,  // 明确标记需要回溯
                messageInfo: deletedMessageInfo
            });

            console.log('[EventSystem] ✅ AI消息删除事件已转发（将触发回溯）');

        } catch (error) {
            console.error('[EventSystem] ❌ 处理消息删除事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息重新生成事件
     * @param {Object} data - 消息重新生成数据
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[EventSystem] 🔄 收到消息重新生成事件', data);

            // 获取当前聊天ID
            const context = SillyTavern.getContext();
            const chatId = context?.chatId || this.dataCore?.getCurrentChatId();

            // 转发内部事件，包含聊天ID
            this.emit(this.EVENT_TYPES.MESSAGE_REGENERATED, {
                ...data,
                chatId: chatId,
                timestamp: Date.now()
            });

            console.log('[EventSystem] ✅ 消息重新生成事件已转发');

        } catch (error) {
            console.error('[EventSystem] ❌ 处理消息重新生成事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 提取并解析infobar_data
     * @param {Object} messageData - 消息数据
     * @param {string} type - 消息类型 ('received' 或 'sent')
     */
    async extractAndParseInfobarData(messageData, type) {
        try {
            if (!messageData || !this.xmlParser || !this.dataCore) {
                return;
            }

            // 🔧 新增：检查插件是否启用
            const context = window.SillyTavern?.getContext?.();
            const extensionSettings = context?.extensionSettings;
            const configs = extensionSettings?.['Information bar integration tool'] || {};
            const basicSettings = configs.basic || {};
            const integrationSystemSettings = basicSettings.integrationSystem || {};
            const isPluginEnabled = integrationSystemSettings.enabled !== false;

            if (!isPluginEnabled) {
                console.log('[EventSystem] ℹ️ 插件已禁用，跳过infobar数据解析');
                return;
            }

            // 调试：打印消息数据结构
            console.log('[EventSystem] 🔍 调试消息数据结构:', {
                type: type,
                messageDataKeys: Object.keys(messageData || {}),
                messageData: messageData
            });

            // 获取消息内容
            const messageContent = this.extractMessageContent(messageData);
            console.log('[EventSystem] 📄 提取的消息内容:', messageContent ? messageContent.substring(0, 200) + '...' : 'null');

            if (!messageContent) {
                console.log('[EventSystem] ⚠️ 未能提取到消息内容');
                return;
            }

            // 检查是否包含完整的infobar_data块
            if (!/<infobar_data>[\s\S]*<\/infobar_data>/.test(messageContent)) {
                console.log('[EventSystem] ℹ️ 消息不包含完整的infobar_data标签块');
                return false;
            }

            console.log('[EventSystem] 🔍 发现infobar_data，开始解析...');

            // 🔧 优化：获取消息ID用于缓存
            const messageId = this.extractMessageId(messageData);

            // 解析XML数据，启用缓存机制
            const parsedData = this.xmlParser.parseInfobarData(messageContent, {
                skipIfCached: true,
                messageId: messageId
            });
            if (!parsedData) {
                console.warn('[EventSystem] ⚠️ XML数据解析失败');
                console.log('[EventSystem] 🔒 保持现有数据不变，避免清空数据表格');
                
                // 🔧 修复：解析失败时，触发一个特殊事件通知其他组件保持现状
                this.emit('infobar_data_parse_failed', {
                    type: type,
                    messageId: messageId,
                    reason: 'XML解析失败',
                    timestamp: Date.now()
                });
                
                return false;
            }

            // 获取当前聊天ID
            const chatId = this.dataCore.getCurrentChatId();
            if (!chatId) {
        console.warn('[EventSystem] ⚠️ 无法获取当前聊天ID');
                return;
            }

            // 存储解析的数据到对应聊天
            await this.storeInfobarDataToChat(chatId, parsedData, type);

            console.log('[EventSystem] ✅ infobar_data处理完成');
            return true;

        } catch (error) {
            console.error('[EventSystem] ❌ 提取并解析infobar_data失败:', error);
            this.handleError(error);
            return false;
        }
    }

    /**
     * 提取消息内容
     * @param {Object} messageData - 消息数据
     * @returns {string|null} 消息内容
     */
    extractMessageContent(messageData) {
        try {
            // 尝试不同的消息内容字段
            const possibleFields = ['mes', 'message', 'content', 'text'];

            for (const field of possibleFields) {
                if (messageData[field] && typeof messageData[field] === 'string') {
                    return messageData[field];
                }
            }

            // 如果是嵌套对象，尝试深度提取
            if (messageData.data && typeof messageData.data === 'object') {
                for (const field of possibleFields) {
                    if (messageData.data[field] && typeof messageData.data[field] === 'string') {
                        return messageData.data[field];
                    }
                }
            }

            return null;

        } catch (error) {
            console.error('[EventSystem] ❌ 提取消息内容失败:', error);
            return null;
        }
    }

    /**
     * 提取消息ID
     * @param {Object} messageData - 消息数据
     * @returns {string|null} 消息ID
     */
    extractMessageId(messageData) {
        try {
            // 尝试多种可能的消息ID字段
            const possibleFields = ['id', 'messageId', 'msg_id', 'index'];

            for (const field of possibleFields) {
                if (messageData[field] !== undefined && messageData[field] !== null) {
                    return String(messageData[field]);
                }
            }

            // 如果没有找到ID，使用时间戳和内容哈希作为唯一标识
            const content = this.extractMessageContent(messageData);
            if (content) {
                const hash = this.simpleHash(content);
                return `msg_${Date.now()}_${hash}`;
            }

            return null;

        } catch (error) {
            console.error('[EventSystem] ❌ 提取消息ID失败:', error);
            return null;
        }
    }

    /**
     * 简单哈希函数
     * @param {string} str - 要哈希的字符串
     * @returns {string} 哈希值
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 存储infobar_data到聊天数据
     * @param {string} chatId - 聊天ID
     * @param {Object} parsedData - 解析的数据
     * @param {string} type - 消息类型
     */
    async storeInfobarDataToChat(chatId, parsedData, type) {
        try {
            console.log('[EventSystem] 💾 存储infobar_data到聊天:', chatId);

            // 获取当前聊天数据
            const chatData = await this.dataCore.getChatData(chatId);

            // 初始化infobar_data结构
            if (!chatData.infobar_data) {
                chatData.infobar_data = {
                    panels: {},
                    history: [],
                    lastUpdated: 0
                };
            }

            // ✅ 优先处理：如果是操作指令格式，委托 SmartPromptSystem 执行并直接更新面板数据
            const dataFormat = parsedData.__format || parsedData.format;
            const operations = parsedData.__operations || parsedData.operations;
            if (dataFormat === 'operation_commands' && Array.isArray(operations) && operations.length > 0) {
                try {
                    console.log('[EventSystem] 🚀 检测到操作指令格式，委托SmartPromptSystem执行操作并更新面板数据...');

                    // 获取SmartPromptSystem实例
                    const smartPromptSystem = window.SillyTavernInfobar?.modules?.smartPromptSystem;

                    // 获取当前角色ID（与原逻辑一致）
                    const context = SillyTavern.getContext?.();
                    const characterId = context?.characterId || 'default';

                    if (smartPromptSystem && typeof smartPromptSystem.executeOperationCommands === 'function') {
                        // 执行操作指令，内部会直接写回 chatData.infobar_data.panels 结构
                        await smartPromptSystem.executeOperationCommands(operations, characterId);

                        // 重新获取最新聊天数据并补充元信息
                        const updatedChatData = await this.dataCore.getChatData(chatId) || {};
                        if (!updatedChatData.infobar_data) {
                            updatedChatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
                        }
                        updatedChatData.infobar_data.lastUpdated = Date.now();
                        updatedChatData.infobar_data.history = updatedChatData.infobar_data.history || [];
                        updatedChatData.infobar_data.history.push({
                            timestamp: Date.now(),
                            type: type,
                            panelCount: Object.keys(updatedChatData.infobar_data.panels || {}).length,
                            panels: Object.keys(updatedChatData.infobar_data.panels || {})
                        });

                        // 保存（将触发 chat:data:changed）
                        await this.dataCore.setChatData(chatId, updatedChatData);

                        // 触发存储完成事件
                        this.emit('infobar:data:stored', {
                            chatId: chatId,
                            panelCount: Object.keys(updatedChatData.infobar_data.panels || {}).length,
                            panels: Object.keys(updatedChatData.infobar_data.panels || {}),
                            timestamp: Date.now()
                        });

                        console.log('[EventSystem] ✅ 操作指令执行并已存储到聊天数据');
                        return; // 提前结束：已完成存储
                    } else {
                        console.warn('[EventSystem] ⚠️ SmartPromptSystem不可用，回退为面板合并流程');
                    }
                } catch (opErr) {
                    console.error('[EventSystem] ❌ 执行操作指令并更新面板失败:', opErr);
                    // 回退到面板合并流程
                }
            }

            // 🔧 修复：只处理真正的面板数据，排除操作指令格式的元数据字段
            const actualPanelData = this.filterActualPanelData(parsedData);

            for (const [panelName, panelData] of Object.entries(actualPanelData)) {
                const existingPanel = chatData.infobar_data.panels[panelName] || {};

                // 使用数据核心的启用字段过滤合并
                if (this.dataCore && this.dataCore.mergeWithEnabledFields) {
                    chatData.infobar_data.panels[panelName] = await this.dataCore.mergeWithEnabledFields(panelName, existingPanel, panelData);
                } else {
                    // 降级处理：只保留新数据，避免历史污染
                    chatData.infobar_data.panels[panelName] = { ...panelData };
                }

                console.log(`[EventSystem] 🔄 已按启用字段更新面板: ${panelName}`);
            }

            // 🔧 分离系统元数据存储
            if (!chatData.infobar_data.systemMetadata) {
                chatData.infobar_data.systemMetadata = {};
            }
            Object.keys(actualPanelData).forEach(panelName => {
                chatData.infobar_data.systemMetadata[panelName] = {
                    lastUpdated: Date.now(),
                    source: type,
                    fieldCount: Object.keys(chatData.infobar_data.panels[panelName]).length
                };
            });

            // 🔧 修复：使用正确的数据核心API同步数据
            if (chatId === this.dataCore.currentChatId) {
                // 获取当前角色ID
                const context = SillyTavern.getContext();
                const characterId = context?.characterId || 'default';

                // 🔧 修复：只同步真正的面板数据，排除元数据字段
                for (const [panelName, panelData] of Object.entries(actualPanelData)) {
                    const dataKey = `panels.${characterId}.${panelName}`;
                    await this.dataCore.setData(dataKey, panelData, 'chat');
                }
                console.log('[EventSystem] 🔄 已同步数据到UnifiedDataCore，角色ID:', characterId);
            }

            // 添加到历史记录
            chatData.infobar_data.history.push({
                timestamp: Date.now(),
                type: type,
                panelCount: Object.keys(parsedData).length,
                panels: Object.keys(parsedData)
            });

            // 限制历史记录数量
            if (chatData.infobar_data.history.length > 100) {
                chatData.infobar_data.history = chatData.infobar_data.history.slice(-50);
            }

            // 更新最后更新时间
            chatData.infobar_data.lastUpdated = Date.now();

            // 保存聊天数据（这会触发 chat:data:changed 事件）
            await this.dataCore.setChatData(chatId, chatData);

            // 触发专门的infobar数据存储完成事件，用于快照创建
            this.emit('infobar:data:stored', {
                chatId: chatId,
                panelCount: Object.keys(parsedData).length,
                panels: Object.keys(parsedData),
                timestamp: Date.now()
            });

            // 不再触发额外的 infobar:data:updated 事件，避免重复事件
            // 因为 setChatData 已经会触发 chat:data:changed 事件

            console.log('[EventSystem] ✅ infobar_data已存储到聊天数据');

        } catch (error) {
            console.error('[EventSystem] ❌ 存储infobar_data到聊天数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        try {
            // 清理事件监听器
            if (this.sillyTavernEventSource) {
                this.sillyTavernEventSource.removeAllListeners();
            }

            // 停止消息轮询
            if (this.messagePollingInterval) {
                clearInterval(this.messagePollingInterval);
                this.messagePollingInterval = null;
            }

            // 重置状态
            this.initialized = false;
            this.sillyTavernBound = false;

            console.log('[EventSystem] 🧹 资源清理完成');

        } catch (error) {
            console.error('[EventSystem] ❌ 清理资源失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 🔧 过滤出真正的面板数据，排除操作指令格式的元数据字段
     * @param {Object} parsedData - 解析的数据
     * @returns {Object} 过滤后的面板数据
     */
    filterActualPanelData(parsedData) {
        try {
            // 操作指令格式的元数据字段列表
            const metadataFields = ['__format', '__operations', '__metadata', 'format', 'operations', 'metadata'];

            const actualPanelData = {};

            for (const [key, value] of Object.entries(parsedData)) {
                // 跳过元数据字段
                if (metadataFields.includes(key)) {
                    console.log(`[EventSystem] 🔧 跳过元数据字段: ${key}`);
                    continue;
                }

                // 只保留真正的面板数据
                actualPanelData[key] = value;
            }

            console.log(`[EventSystem] 🔧 过滤完成，原始字段: ${Object.keys(parsedData).length}, 面板字段: ${Object.keys(actualPanelData).length}`);

            return actualPanelData;

        } catch (error) {
            console.error('[EventSystem] ❌ 过滤面板数据失败:', error);
            return parsedData; // 降级处理：返回原始数据
        }
    }
}
