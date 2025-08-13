/**
 * 统一数据核心模块
 * 
 * 负责管理所有数据存储和同步，包括：
 * - localStorage（全局持久化数据）
 * - chatMetadata（角色/聊天相关数据）
 * - 数据同步和备份机制
 * - 数据验证和完整性检查
 * 
 * @class UnifiedDataCore
 */

export class UnifiedDataCore {
    constructor(eventSystem = null) {
        console.log('[UnifiedDataCore] 🔧 统一数据核心初始化开始');
        
        this.eventSystem = eventSystem;
        this.MODULE_NAME = 'information_bar_integration_tool';
        
        // SillyTavern上下文
        this.context = null;

        // 数据管理器
        this.localStorage = null;
        this.chatMetadata = null;

        // 数据缓存
        this.cache = new Map();
        this.data = new Map(); // 🔧 修复：初始化主数据存储（用于按面板聚合的结构）
        this.recentEntries = []; // 新增：最近的数据条目列表（数组格式，兼容旧逻辑）

        // 聊天上下文管理
        this.currentChatId = null;
        this.chatDataCache = new Map(); // 聊天数据缓存
        this.chatSwitchListeners = new Set(); // 聊天切换监听器
        
        // 同步状态
        this.syncInProgress = false;
        this.lastSyncTime = 0;
        this.syncInterval = 30000; // 30秒
        this.syncTimer = null; // 同步定时器

        // 备份管理
        this.backupInterval = 300000; // 5分钟
        this.maxBackups = 10;
        this.backupTimer = null; // 备份定时器
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 默认配置
        this.defaultSettings = Object.freeze({
            // 基础设置
            enabled: true,
            renderInChat: true,
            enableTableRecord: true,
            enableMemoryAssist: true,
            defaultCollapsed: false,
            
            // API配置
            apiConfig: {
                enabled: false,
                provider: 'gemini',
                format: 'native',
                endpoint: '',
                apiKey: '',
                model: '',
                temperature: 0.7,
                maxTokens: 2000,
                retryCount: 3,
                extraPrompt: ''
            },
            
            // 界面配置
            theme: {
                current: 'default',
                custom: {}
            },
            
            // 面板配置
            panels: {},
            
            // 数据管理配置
            dataManagement: {
                autoBackup: true,
                syncInterval: 30000,
                maxBackups: 10
            }
        });
        
        // 初始化完成
        console.log('[UnifiedDataCore] 🏗️ 构造函数完成');
    }

    /**
     * 深度合并工具：将 source 合并到 target（仅对象与数组，其他类型直接替换）
     */
    static deepMerge(target, source) {
        if (target === source) return target;
        if (Array.isArray(target) && Array.isArray(source)) {
            // 数组合并：以 source 为准（保留旧数据意义不大），也可选择去重拼接
            return source.slice();
        }
        if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
            const result = { ...target };
            for (const [key, value] of Object.entries(source)) {
                if (typeof value === 'object' && value !== null && typeof result[key] === 'object' && result[key] !== null) {
                    result[key] = UnifiedDataCore.deepMerge(result[key], value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        }
        // 其他类型：直接替换
        return source;
    }

    /**
     * 初始化数据核心
     */
    async init() {
        try {
            console.log('[UnifiedDataCore] 📊 开始初始化数据核心...');
            
            // 获取SillyTavern上下文
            this.context = SillyTavern.getContext();
            
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }
            
            // 初始化存储管理器
            this.initStorageManagers();
            
            // 初始化默认设置
            await this.initDefaultSettings();
            
            // 启动自动同步
            this.startAutoSync();

            // 初始化聊天上下文管理
            await this.initChatContextManager();

            this.initialized = true;
            console.log('[UnifiedDataCore] ✅ 数据核心初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('dataCore:initialized');
            }

            // 页面加载后主动渲染最后一条AI消息的信息栏
            setTimeout(() => {
                this.triggerInfoBarRenderForLatestMessage();
            }, 2000); // 延迟2秒确保所有模块都已初始化
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 初始化存储管理器
     */
    initStorageManagers() {
        const { extensionSettings, chatMetadata } = this.context;
        
        // localStorage管理器
        this.localStorage = {
            get: (key) => extensionSettings[this.MODULE_NAME]?.[key],
            set: (key, value) => {
                if (!extensionSettings[this.MODULE_NAME]) {
                    extensionSettings[this.MODULE_NAME] = {};
                }
                extensionSettings[this.MODULE_NAME][key] = value;
                this.context.saveSettingsDebounced();
            },
            delete: (key) => {
                if (extensionSettings[this.MODULE_NAME]) {
                    delete extensionSettings[this.MODULE_NAME][key];
                    this.context.saveSettingsDebounced();
                }
            },
            getAll: () => extensionSettings[this.MODULE_NAME] || {}
        };
        
        // chatMetadata管理器 - 🔧 修复：每次都获取最新的context
        this.chatMetadata = {
            get: (key) => {
                const context = SillyTavern.getContext();
                const metadata = context.chatMetadata;
                return metadata?.[this.MODULE_NAME]?.[key];
            },
            set: async (key, value) => {
                const context = SillyTavern.getContext();
                const metadata = context.chatMetadata;
                if (!metadata[this.MODULE_NAME]) {
                    metadata[this.MODULE_NAME] = {};
                }
                metadata[this.MODULE_NAME][key] = value;
                await context.saveMetadata();
            },
            delete: async (key) => {
                const context = SillyTavern.getContext();
                const metadata = context.chatMetadata;
                if (metadata[this.MODULE_NAME]) {
                    delete metadata[this.MODULE_NAME][key];
                    await context.saveMetadata();
                }
            },
            getAll: () => {
                const context = SillyTavern.getContext();
                const metadata = context.chatMetadata;
                return metadata?.[this.MODULE_NAME] || {};
            }
        };
        
        console.log('[UnifiedDataCore] 🗄️ 存储管理器初始化完成');
    }

    /**
     * 初始化默认设置（优先从 chatMetadata 加载）
     */
    async initDefaultSettings() {
        console.log('[UnifiedDataCore] ⚙️ 初始化默认设置...');

        // 1. 先从 chatMetadata 加载数据（优先级最高）
        await this.loadFromChat();

        // 2. 获取当前 localStorage 设置
        const currentSettings = this.localStorage.getAll();

        // 3. 合并默认设置（只填充缺失的配置）
        const mergedSettings = this.mergeSettings(this.defaultSettings, currentSettings);

        // 4. 保存合并后的设置到 localStorage
        for (const [key, value] of Object.entries(mergedSettings)) {
            if (!currentSettings.hasOwnProperty(key)) {
                this.localStorage.set(key, value);
                console.log(`[UnifiedDataCore] 🔧 添加默认配置: ${key}`);
            }
        }

        console.log('[UnifiedDataCore] ✅ 默认设置初始化完成');
    }

    /**
     * 合并设置对象
     */
    mergeSettings(defaultSettings, currentSettings) {
        const merged = { ...defaultSettings };
        
        for (const [key, value] of Object.entries(currentSettings)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    /**
     * 获取数据
     * @param {string} key - 数据键
     * @param {string} scope - 数据范围 ('global' | 'chat')
     * @returns {any} 数据值
     */
    async getData(key, scope = 'global') {
        try {
            // 先检查缓存
            const cacheKey = `${scope}:${key}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            let value;
            
            if (scope === 'global') {
                value = this.localStorage.get(key);
            } else if (scope === 'chat') {
                value = this.chatMetadata.get(key);
            } else {
                throw new Error(`无效的数据范围: ${scope}`);
            }
            
            // 更新缓存
            if (value !== undefined) {
                this.cache.set(cacheKey, value);
            }
            
            return value;
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取数据失败:', error);
            this.handleError(error);
            return undefined;
        }
    }

    /**
     * 设置数据
     * @param {string} key - 数据键
     * @param {any} value - 数据值
     * @param {string} scope - 数据范围 ('global' | 'chat')
     */
    async setData(key, value, scope = 'global') {
        try {
            if (scope === 'global') {
                this.localStorage.set(key, value);
            } else if (scope === 'chat') {
                // 增量合并支持：当写入 panels.<characterId>.<panelId> 时，执行字段级合并
                if (typeof key === 'string' && key.startsWith('panels.')) {
                    const parts = key.split('.'); // ['panels', characterId, panelId]
                    const characterId = parts[1];
                    const panelId = parts[2];

                    // 获取当前聊天ID
                    const chatId = this.currentChatId || this.getCurrentChatId();

                    // 读取现有的面板数据（优先从内存Map），回退到chatMetadata键值
                    const existingPanelData = (this.data instanceof Map ? this.data.get(panelId) : undefined) || (await this.getData(key, 'chat')) || {};
                    const mergedPanelData = UnifiedDataCore.deepMerge(existingPanelData, value);

                    // 写回 chat 范围的键（保持原有键值可用）
                    await this.chatMetadata.set(key, mergedPanelData);

                    // 同步更新内存Map
                    if (this.data instanceof Map) {
                        this.data.set(panelId, mergedPanelData);
                    }

                    // 同步更新 chatMetadata 的 chat_<chatId>.infobar_data 结构，确保DataTable按面板总览可取到完整数据
                    if (chatId) {
                        const chatDataKey = `chat_${chatId}`;
                        const chatData = this.chatMetadata.get(chatDataKey) || {};
                        if (!chatData.infobar_data) {
                            chatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
                        }
                        if (!chatData.infobar_data.panels) {
                            chatData.infobar_data.panels = {};
                        }
                        // 以合并结果更新对应面板
                        const prevPanel = chatData.infobar_data.panels[panelId] || {};
                        const newPanel = UnifiedDataCore.deepMerge(prevPanel, mergedPanelData);

                        // 🆕 记录字段级别的变更历史（AI更新）
                        await this.recordPanelFieldChanges(panelId, prevPanel, newPanel, 'AI_UPDATE');

                        chatData.infobar_data.panels[panelId] = newPanel;
                        chatData.infobar_data.lastUpdated = Date.now();
                        await this.chatMetadata.set(chatDataKey, chatData);
                        // 刷新当前聊天缓存
                        this.chatDataCache.set(chatId, chatData);
                    }
                } else {
                    // 非panels路径，按原逻辑写入
                    await this.chatMetadata.set(key, value);
                }
            } else {
                throw new Error(`无效的数据范围: ${scope}`);
            }

            // 更新缓存
            const cacheKey = `${scope}:${key}`;
            this.cache.set(cacheKey, value);

            // 🔧 优化：如果是信息栏数据，同时保存到当前聊天的chatMetadata
            if (key.includes('infobar') && this.currentChatId) {
                await this.saveChatDataToMetadata(this.currentChatId);
            }

            // 触发数据变更事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:changed', {
                    key,
                    value,
                    scope,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 设置数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 删除数据
     * @param {string} key - 数据键
     * @param {string} scope - 数据范围 ('global' | 'chat')
     */
    async deleteData(key, scope = 'global') {
        try {
            if (scope === 'global') {
                this.localStorage.delete(key);
            } else if (scope === 'chat') {
                await this.chatMetadata.delete(key);
            } else {
                throw new Error(`无效的数据范围: ${scope}`);
            }
            
            // 清除缓存
            const cacheKey = `${scope}:${key}`;
            this.cache.delete(cacheKey);
            
            // 触发数据删除事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:deleted', {
                    key,
                    scope,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 删除数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取所有数据
     * @param {string} scope - 数据范围 ('global' | 'chat' | 'all')
     * @returns {Object} 所有数据
     */
    async getAllData(scope = 'all') {
        try {
            if (scope === 'global') {
                return this.localStorage.getAll();
            } else if (scope === 'chat') {
                return this.chatMetadata.getAll();
            } else if (scope === 'all') {
                return {
                    global: this.localStorage.getAll(),
                    chat: this.chatMetadata.getAll()
                };
            } else {
                throw new Error(`无效的数据范围: ${scope}`);
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取所有数据失败:', error);
            this.handleError(error);
            return {};
        }
    }

    /**
     * 启动事件驱动的数据管理（替代频繁同步）
     */
    startAutoSync() {
        console.log('[UnifiedDataCore] 🔄 启动事件驱动数据管理...');

        // 不再使用定时器，改为事件驱动
        // 监听数据变更事件，触发同步到 chatMetadata
        if (this.eventSystem) {
            this.eventSystem.on('settings:saved', async (data) => {
                console.log('[UnifiedDataCore] 📤 设置已保存，同步到 chatMetadata...');
                await this.syncToChat();
            });

            this.eventSystem.on('data:changed', async (data) => {
                // 如果是重要数据变更，立即同步到 chatMetadata
                if (this.isImportantData(data.key)) {
                    console.log('[UnifiedDataCore] 📤 重要数据变更，同步到 chatMetadata:', data.key);
                    await this.syncToChat();
                }
            });

            // 🔧 修复：监听XMLDataParser解析完成事件
            this.eventSystem.on('xml:data:parsed', async (eventData) => {
                await this.handleXMLDataParsed(eventData);
            });
        }

        // 保留备份定时器，但间隔更长（30分钟）
        this.backupTimer = setInterval(() => {
            this.createBackup();
        }, 1800000); // 30分钟

        console.log('[UnifiedDataCore] ✅ 事件驱动数据管理已启动');
    }

    /**
     * 处理XMLDataParser解析完成的数据
     * @param {Object} eventData - 事件数据
     */
    async handleXMLDataParsed(eventData) {
        try {
            console.log('[UnifiedDataCore] 📥 接收到XMLDataParser解析数据');
            console.log('[UnifiedDataCore] 📊 数据包含', eventData.panelCount, '个面板');
            
            if (!eventData.data || typeof eventData.data !== 'object') {
                console.warn('[UnifiedDataCore] ⚠️ 无效的解析数据');
                return;
            }
            
            // 获取当前聊天ID
            const currentChatId = this.getCurrentChatId();
            if (!currentChatId) {
            console.warn('[UnifiedDataCore] ⚠️ 无法获取当前聊天ID');
                return;
            }
            
            // 构造数据条目
            const dataEntry = {
                messageId: `parsed_${Date.now()}`,
                timestamp: eventData.timestamp || Date.now(),
                data: eventData.data,
                characterName: this.getCurrentCharacterName(),
                chatId: currentChatId
            };
            
            // 存储到聊天数据缓存
            if (!this.chatDataCache.has(currentChatId)) {
                this.chatDataCache.set(currentChatId, []);
            }
            
            let chatData = this.chatDataCache.get(currentChatId);
            
            // 🔧 修复：确保聊天数据是数组格式（兼容旧数据）
            if (!Array.isArray(chatData)) {
                console.log('[UnifiedDataCore] 🔧 转换旧数据格式为数组格式');
                chatData = [];
                this.chatDataCache.set(currentChatId, chatData);
            }
            
            chatData.push(dataEntry);
            
            console.log('[UnifiedDataCore] 💾 数据已存储到聊天缓存');
            console.log('[UnifiedDataCore] 📋 当前聊天数据条目数量:', chatData.length);

            // 🔧 新增：将本次解析到的面板数据合并到缓存数组的附加 infobar_data.panels 上
            if (!chatData.infobar_data) {
                chatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
            }
            if (!chatData.infobar_data.panels) {
                chatData.infobar_data.panels = {};
            }
            if (eventData.data && typeof eventData.data === 'object') {
                Object.entries(eventData.data).forEach(([panelName, panelFields]) => {
                    const prev = chatData.infobar_data.panels[panelName] || {};
                    chatData.infobar_data.panels[panelName] = UnifiedDataCore.deepMerge(prev, panelFields);
                });
                chatData.infobar_data.lastUpdated = Date.now();
            }
            
            // 更新最近条目缓存（用于向后兼容，不再覆盖主数据存储Map）
            this.recentEntries = chatData;
            
            // 触发数据更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:updated', {
                    dataEntry: dataEntry,
                    totalCount: chatData.length,
                    timestamp: Date.now()
                });
                
                // 🔧 修复：同时触发data:changed事件以通知DataTable
                this.eventSystem.emit('data:changed', {
                    key: 'xml_parsed_data',
                    value: dataEntry,
                    timestamp: Date.now()
                });
            }
            
            // 同步到聊天元数据（合并，不覆盖）
            try {
                const chatDataKey = `chat_${currentChatId}`;
                let storedChatData = this.chatMetadata.get(chatDataKey) || {};
                // 规范化：若历史以数组存储，转为对象结构，避免JSON序列化丢失自定义属性
                if (Array.isArray(storedChatData)) {
                    storedChatData = {
                        items: storedChatData.slice(),
                        infobar_data: storedChatData.infobar_data || { panels: {}, history: [], lastUpdated: 0 },
                    };
                }
                if (!storedChatData.infobar_data) {
                    storedChatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
                }
                if (!storedChatData.infobar_data.panels) {
                    storedChatData.infobar_data.panels = {};
                }
                if (eventData.data && typeof eventData.data === 'object') {
                    Object.entries(eventData.data).forEach(([panelName, panelFields]) => {
                        const prev = storedChatData.infobar_data.panels[panelName] || {};
                        storedChatData.infobar_data.panels[panelName] = UnifiedDataCore.deepMerge(prev, panelFields);
                    });
                    storedChatData.infobar_data.lastUpdated = Date.now();
                }
                await this.chatMetadata.set(chatDataKey, storedChatData);
                // 刷新当前聊天缓存（对象形式）
                // 保持运行期缓存为数组（兼容旧逻辑）；持久化采用对象，避免属性丢失
                this.chatDataCache.set(currentChatId, chatData);
            } catch (e) {
                console.warn('[UnifiedDataCore] ⚠️ 同步到chatMetadata时警告:', e);
            }
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 处理XMLDataParser数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取当前角色名称
     */
    getCurrentCharacterName() {
        try {
            const context = window.SillyTavern?.getContext?.();
            return context?.characters?.[context.characterId]?.name || 'Unknown';
        } catch (error) {
            console.warn('[UnifiedDataCore] ⚠️ 无法获取角色名称:', error);
            return 'Unknown';
        }
    }

    /**
     * 检查设置界面是否打开
     */
    isSettingsUIOpen() {
        try {
            // 检查InfoBarSettings是否可见
            const infoBarTool = window.SillyTavernInfobar;
            if (infoBarTool && infoBarTool.modules) {
                // 尝试多个可能的模块名称
                const settingsUI = infoBarTool.modules.infoBarSettings || infoBarTool.modules.settings;
                if (settingsUI) {
                    return settingsUI.visible === true;
                }
            }
            return false;
        } catch (error) {
            // 如果检查失败，默认认为界面未打开
            return false;
        }
    }

    /**
     * 停止自动同步
     */
    stopAutoSync() {
        console.log('[UnifiedDataCore] ⏹️ 停止自动同步...');

        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
        }

        console.log('[UnifiedDataCore] ✅ 自动同步已停止');
    }

    /**
     * 判断是否为重要数据（需要立即同步到 chatMetadata）
     */
    isImportantData(key) {
        const importantKeys = [
            'customPanels',
            'apiConfig',
            'theme',
            'enabled',
            'renderInChat'
        ];
        return importantKeys.includes(key);
    }

    /**
     * 同步 localStorage 数据到 chatMetadata
     */
    async syncToChat() {
        if (this.syncInProgress) {
            return;
        }

        try {
            this.syncInProgress = true;
            console.log('[UnifiedDataCore] 🔄 开始同步数据到 chatMetadata...');

            // 获取所有 localStorage 数据
            const globalData = this.localStorage.getAll();

            // 同步重要数据到 chatMetadata
            for (const [key, value] of Object.entries(globalData)) {
                if (this.isImportantData(key)) {
                    await this.chatMetadata.set(key, value);
                    console.log(`[UnifiedDataCore] 📤 已同步 ${key} 到 chatMetadata`);
                }
            }

            this.lastSyncTime = Date.now();

            // 触发同步完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:synced', {
                    timestamp: this.lastSyncTime
                });
            }

            console.log('[UnifiedDataCore] ✅ 数据同步到 chatMetadata 完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 同步数据到 chatMetadata 失败:', error);
            this.handleError(error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 从 chatMetadata 加载数据到 localStorage（初始化时使用）
     */
    async loadFromChat() {
        try {
            console.log('[UnifiedDataCore] 📥 从 chatMetadata 加载数据...');

            const chatData = this.chatMetadata.getAll();
            let loadedCount = 0;

            // 优先使用 chatMetadata 中的数据
            for (const [key, value] of Object.entries(chatData)) {
                if (value !== undefined && value !== null) {
                    this.localStorage.set(key, value);
                    this.cache.set(`global:${key}`, value);
                    loadedCount++;
                    console.log(`[UnifiedDataCore] 📥 从 chatMetadata 加载 ${key}`);
                }
            }

            console.log(`[UnifiedDataCore] ✅ 从 chatMetadata 加载了 ${loadedCount} 个配置项`);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 从 chatMetadata 加载数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 清理缓存
     */
    cleanCache() {
        // 清理超过1小时的缓存
        const maxAge = 60 * 60 * 1000; // 1小时
        const now = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp && (now - entry.timestamp) > maxAge) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 验证数据完整性
     */
    async validateDataIntegrity() {
        try {
            const globalData = this.localStorage.getAll();
            const chatData = this.chatMetadata.getAll();
            
            // 验证必要字段
            if (!globalData.enabled !== undefined) {
                await this.setData('enabled', this.defaultSettings.enabled, 'global');
            }
            
            console.log('[UnifiedDataCore] ✅ 数据完整性验证通过');
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 数据完整性验证失败:', error);
            throw error;
        }
    }

    /**
     * 创建备份
     */
    async createBackup() {
        try {
            console.log('[UnifiedDataCore] 💾 创建数据备份...');

            // 获取所有数据，但排除备份数据以避免循环引用
            const allData = await this.getAllData('all');
            const filteredData = {
                global: {},
                chat: allData.chat
            };

            // 过滤掉备份数据
            for (const [key, value] of Object.entries(allData.global)) {
                if (!key.startsWith('backup_')) {
                    filteredData.global[key] = value;
                }
            }

            const backup = {
                timestamp: Date.now(),
                version: '1.0.0',
                data: filteredData
            };

            const backupKey = `backup_${backup.timestamp}`;
            await this.setData(backupKey, backup, 'global');

            // 清理旧备份
            await this.cleanOldBackups();

            console.log('[UnifiedDataCore] ✅ 数据备份完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 创建备份失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 清理旧备份
     */
    async cleanOldBackups() {
        try {
            const allData = this.localStorage.getAll();
            const backupKeys = Object.keys(allData).filter(key => key.startsWith('backup_'));
            
            if (backupKeys.length > this.maxBackups) {
                // 按时间戳排序，删除最旧的备份
                backupKeys.sort((a, b) => {
                    const timestampA = parseInt(a.split('_')[1]);
                    const timestampB = parseInt(b.split('_')[1]);
                    return timestampA - timestampB;
                });
                
                const toDelete = backupKeys.slice(0, backupKeys.length - this.maxBackups);
                for (const key of toDelete) {
                    await this.deleteData(key, 'global');
                }
                
                console.log(`[UnifiedDataCore] 🗑️ 清理了 ${toDelete.length} 个旧备份`);
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理旧备份失败:', error);
        }
    }

    /**
     * 导出所有数据
     */
    async exportAll() {
        return await this.getAllData('all');
    }

    /**
     * 导入数据
     */
    async importData(data) {
        try {
            console.log('[UnifiedDataCore] 📥 开始导入数据...');
            
            if (data.global) {
                for (const [key, value] of Object.entries(data.global)) {
                    await this.setData(key, value, 'global');
                }
            }
            
            if (data.chat) {
                for (const [key, value] of Object.entries(data.chat)) {
                    await this.setData(key, value, 'chat');
                }
            }
            
            console.log('[UnifiedDataCore] ✅ 数据导入完成');
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 数据导入失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 页面加载后主动触发最后一条AI消息的信息栏渲染
     */
    async triggerInfoBarRenderForLatestMessage() {
        try {
            console.log('[UnifiedDataCore] 🎯 页面加载后主动触发信息栏渲染...');

            // 获取当前聊天的最后一条AI消息
            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                console.log('[UnifiedDataCore] ℹ️ 当前没有聊天消息');
                return;
            }

            // 从后往前查找最后一条AI消息
            let lastAIMessage = null;
            for (let i = context.chat.length - 1; i >= 0; i--) {
                const message = context.chat[i];
                if (!message.is_user) {
                    lastAIMessage = message;
                    break;
                }
            }

            if (!lastAIMessage) {
                console.log('[UnifiedDataCore] ℹ️ 没有找到AI消息');
                return;
            }

            // 获取当前聊天的信息栏数据
            const currentChatId = this.getCurrentChatId();
            if (!currentChatId) {
            console.info('[UnifiedDataCore] ℹ️ 无法获取当前聊天ID');
                return;
            }

            const chatData = await this.getChatData(currentChatId);
            if (!chatData || !chatData.infobar_data || !chatData.infobar_data.panels) {
            console.info('[UnifiedDataCore] ℹ️ 当前聊天没有信息栏数据');
                return;
            }

            console.log('[UnifiedDataCore] 🎯 找到最后一条AI消息，准备渲染信息栏');

            // 触发信息栏渲染事件
            if (this.eventSystem) {
                this.eventSystem.emit('infobar:render:request', {
                    messageId: lastAIMessage.mesid || lastAIMessage.index?.toString(),
                    chatId: currentChatId,
                    source: 'page-reload',
                    timestamp: Date.now()
                });
            }

            console.log('[UnifiedDataCore] ✅ 已发送信息栏渲染指令');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 触发信息栏渲染失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[UnifiedDataCore] ❌ 错误 #${this.errorCount}:`, error);

        if (this.eventSystem) {
            this.eventSystem.emit('dataCore:error', {
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
            cacheSize: this.cache.size,
            lastSyncTime: this.lastSyncTime,
            syncInProgress: this.syncInProgress,
            currentChatId: this.currentChatId,
            chatDataCacheSize: this.chatDataCache.size
        };
    }

    // ==================== 聊天上下文管理方法 ====================

    /**
     * 初始化聊天上下文管理器
     */
    async initChatContextManager() {
        try {
            console.log('[UnifiedDataCore] 🔄 初始化聊天上下文管理器...');

            // 获取当前聊天ID
            this.currentChatId = this.getCurrentChatId();
            console.log('[UnifiedDataCore] 📍 当前聊天ID:', this.currentChatId);

            // 绑定聊天切换事件
            if (this.eventSystem) {
                this.eventSystem.on('chat:changed', (data) => {
                    this.handleChatSwitch(data);
                });

                console.log('[UnifiedDataCore] 🔗 聊天切换事件监听器已绑定');
            }

            // 初始化当前聊天数据
            if (this.currentChatId) {
                await this.switchToChatData(this.currentChatId);
            }

            console.log('[UnifiedDataCore] ✅ 聊天上下文管理器初始化完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 初始化聊天上下文管理器失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取当前聊天ID
     * @returns {string|null} 当前聊天ID
     */
    getCurrentChatId() {
        try {
            // 实时获取SillyTavern上下文，因为chatId会动态变化
            const currentContext = SillyTavern?.getContext?.();
            if (!currentContext) {
                console.warn('[UnifiedDataCore] ⚠️ 无法获取SillyTavern上下文');
                return null;
            }

            const chatId = currentContext.chatId;
            if (!chatId) {
            console.warn('[UnifiedDataCore] ⚠️ 当前没有活动聊天');
                return null;
            }

            return chatId;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取当前聊天ID失败:', error);
            return null;
        }
    }

    /**
     * 切换到指定聊天的数据
     * @param {string} chatId - 聊天ID
     */
    async switchToChatData(chatId) {
        try {
            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 聊天ID为空，无法切换');
                return;
            }

            console.log('[UnifiedDataCore] 🔄 切换到聊天数据:', chatId);

            // 保存当前聊天数据到缓存
            if (this.currentChatId && this.currentChatId !== chatId) {
                await this.saveChatDataToCache(this.currentChatId);
            }

            // 更新当前聊天ID
            this.currentChatId = chatId;

            // 加载新聊天的数据
            await this.loadChatDataFromCache(chatId);

            // 通知聊天切换监听器
            this.notifyChatSwitchListeners(chatId);

            console.log('[UnifiedDataCore] ✅ 聊天数据切换完成:', chatId);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 切换聊天数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取指定聊天的数据
     * @param {string} chatId - 聊天ID
     * @returns {Object} 聊天数据
     */
    async getChatData(chatId) {
        try {
            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 聊天ID为空');
                return {};
            }

            // 先检查缓存
            if (this.chatDataCache.has(chatId)) {
                return this.chatDataCache.get(chatId);
            }

            // 从chatMetadata加载
            const chatData = this.chatMetadata.get(`chat_${chatId}`) || {};

            // 更新缓存
            this.chatDataCache.set(chatId, chatData);

            return chatData;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取聊天数据失败:', error);
            return {};
        }
    }

    /**
     * 设置指定聊天的数据
     * @param {string} chatId - 聊天ID
     * @param {Object} data - 聊天数据
     */
    async setChatData(chatId, data) {
        try {
            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 聊天ID为空');
                return;
            }

            // 更新缓存（运行期可继续使用数组以兼容旧逻辑）
            this.chatDataCache.set(chatId, data);

            // 规范化持久化结构：
            // - 若传入为数组，则持久化为对象 { items: [...], infobar_data }
            // - 确保 infobar_data.panels 合并不丢失
            const chatDataKey = `chat_${chatId}`;
            let toStore = data;
            if (Array.isArray(data)) {
                const existing = this.chatMetadata.get(chatDataKey) || {};
                const existingInfobar = existing.infobar_data || data.infobar_data || { panels: {}, history: [], lastUpdated: 0 };
                toStore = {
                    items: data.slice(),
                    infobar_data: existingInfobar
                };
            }
            await this.chatMetadata.set(chatDataKey, toStore);

            // 触发数据变更事件
            if (this.eventSystem) {
                this.eventSystem.emit('chat:data:changed', {
                    chatId,
                    data,
                    timestamp: Date.now()
                });
            }

            console.log('[UnifiedDataCore] 💾 聊天数据已保存:', chatId);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 设置聊天数据失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理聊天切换事件
     * @param {Object} data - 聊天切换事件数据
     */
    async handleChatSwitch(data) {
        try {
            console.log('[UnifiedDataCore] 🔄 检测到聊天切换事件:', data);

            const newChatId = this.getCurrentChatId();
            if (newChatId && newChatId !== this.currentChatId) {
                // 🔧 优化：直接从chatMetadata加载数据，避免重新解析历史消息
                await this.switchToChatDataOptimized(newChatId);
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 处理聊天切换事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 保存聊天数据到缓存
     * @param {string} chatId - 聊天ID
     */
    async saveChatDataToCache(chatId) {
        try {
            if (!chatId || !this.chatDataCache.has(chatId)) {
                return;
            }

            const chatData = this.chatDataCache.get(chatId);
            await this.chatMetadata.set(`chat_${chatId}`, chatData);

            console.log('[UnifiedDataCore] 💾 聊天数据已保存到缓存:', chatId);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 保存聊天数据到缓存失败:', error);
        }
    }

    /**
     * 优化的聊天切换方法 - 直接从chatMetadata加载，避免重新解析
     * @param {string} chatId - 聊天ID
     */
    async switchToChatDataOptimized(chatId) {
        try {
            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 聊天ID为空，无法切换');
                return;
            }

            console.log('[UnifiedDataCore] 🔄 优化切换到聊天数据:', chatId);

            // 保存当前聊天数据到chatMetadata
            if (this.currentChatId && this.currentChatId !== chatId) {
                await this.saveChatDataToMetadata(this.currentChatId);
            }

            // 更新当前聊天ID
            this.currentChatId = chatId;

            // 直接从chatMetadata加载数据，不重新解析历史消息
            await this.loadChatDataFromMetadataOptimized(chatId);

            // 通知聊天切换监听器
            this.notifyChatSwitchListeners(chatId);

            console.log('[UnifiedDataCore] ✅ 优化聊天数据切换完成:', chatId);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 优化聊天切换失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 从chatMetadata优化加载聊天数据
     * @param {string} chatId - 聊天ID
     */
    async loadChatDataFromMetadataOptimized(chatId) {
        try {
            if (!chatId) {
                return;
            }

            // 🔧 修复：使用正确的存储键加载数据
            const chatDataKey = `chat_${chatId}`;
            const storedChatData = this.chatMetadata.get(chatDataKey);

            if (storedChatData && storedChatData.infobar_data) {
                // 直接使用已存储的infobar_data，无需重新解析
                console.log('[UnifiedDataCore] 📥 从chatMetadata直接加载信息栏数据:', chatId, '面板数量:', Object.keys(storedChatData.infobar_data.panels || {}).length);

                // 更新当前数据 - 使用infobar_data.panels
                this.data.clear();
                if (storedChatData.infobar_data.panels) {
                    Object.entries(storedChatData.infobar_data.panels).forEach(([panelName, panelData]) => {
                        this.data.set(panelName, panelData);
                    });
                }

                // 更新缓存
                this.chatDataCache.set(chatId, storedChatData);
            } else {
                console.log('[UnifiedDataCore] 📥 chatMetadata中无数据，尝试解析历史消息:', chatId);

                // 🔧 新增：回退到解析历史消息
                await this.parseHistoryMessagesForChat(chatId);
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 从chatMetadata优化加载失败:', error);
        }
    }

    /**
     * 解析当前聊天的历史消息中的infobar_data
     * @param {string} chatId - 聊天ID
     */
    async parseHistoryMessagesForChat(chatId) {
        try {
            const context = SillyTavern.getContext();
            const chat = context.chat;

            if (!chat || !Array.isArray(chat)) {
                console.log('[UnifiedDataCore] 📥 当前聊天无消息，初始化空数据:', chatId);
                this.data.clear();
                this.chatDataCache.set(chatId, {});
                return;
            }

            // 查找包含infobar_data的消息
            const infobarMessages = chat.filter(msg =>
                msg && msg.mes && msg.mes.includes('<infobar_data>')
            );

            if (infobarMessages.length > 0) {
                console.log('[UnifiedDataCore] 🔍 发现历史infobar_data消息:', infobarMessages.length, '条');

                // 处理最后一条infobar_data消息
                const lastInfobarMsg = infobarMessages[infobarMessages.length - 1];

                // 通过EventSystem处理消息，确保数据被正确存储
                if (this.eventSystem) {
                    console.log('[UnifiedDataCore] 🔄 通过EventSystem处理历史消息');
                    await this.eventSystem.handleMessageReceived(lastInfobarMsg);
                } else {
                    console.log('[UnifiedDataCore] ⚠️ EventSystem不可用，初始化空数据');
                    this.data.clear();
                    this.chatDataCache.set(chatId, {});
                }
            } else {
                console.log('[UnifiedDataCore] 📥 历史消息中无infobar_data，初始化空数据:', chatId);
                this.data.clear();
                this.chatDataCache.set(chatId, {});
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 解析历史消息失败:', error);
            this.data.clear();
            this.chatDataCache.set(chatId, {});
        }
    }

    /**
     * 保存聊天数据到chatMetadata
     * @param {string} chatId - 聊天ID
     */
    async saveChatDataToMetadata(chatId) {
        try {
            if (!chatId) {
                return;
            }

            // 🔧 修复：使用正确的存储键和数据结构
            const chatDataKey = `chat_${chatId}`;

            // 获取当前聊天数据
            let chatData = this.chatMetadata.get(chatDataKey) || {};

            // 确保infobar_data结构存在
            if (!chatData.infobar_data) {
                chatData.infobar_data = {
                    panels: {},
                    history: [],
                    lastUpdated: 0
                };
            }

            // 更新面板数据（合并，不清空）。仅当this.data为Map且有内容时才写入对应面板
            if (this.data instanceof Map && this.data.size > 0) {
                this.data.forEach((value, key) => {
                    const prev = chatData.infobar_data.panels[key] || {};
                    chatData.infobar_data.panels[key] = UnifiedDataCore.deepMerge(prev, value);
                });
            } else {
                // 若当前无可写入的Map数据，保持现有panels不变，避免被清空
            }

            // 更新时间戳
            chatData.infobar_data.lastUpdated = Date.now();

            // 保存到chatMetadata
            await this.chatMetadata.set(chatDataKey, chatData);
            console.log('[UnifiedDataCore] 💾 保存信息栏数据到chatMetadata:', chatId, '面板数量:', Object.keys(chatData.infobar_data.panels).length);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 保存数据到chatMetadata失败:', error);
        }
    }

    /**
     * 从缓存加载聊天数据
     * @param {string} chatId - 聊天ID
     */
    async loadChatDataFromCache(chatId) {
        try {
            if (!chatId) {
                return;
            }

            // 如果缓存中没有，从chatMetadata加载
            if (!this.chatDataCache.has(chatId)) {
                const chatData = this.chatMetadata.get(`chat_${chatId}`) || {};
                this.chatDataCache.set(chatId, chatData);
                console.log('[UnifiedDataCore] 📥 从chatMetadata加载聊天数据:', chatId);
            } else {
                console.log('[UnifiedDataCore] 📥 从缓存加载聊天数据:', chatId);
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 从缓存加载聊天数据失败:', error);
        }
    }

    /**
     * 通知聊天切换监听器
     * @param {string} chatId - 聊天ID
     */
    notifyChatSwitchListeners(chatId) {
        try {
            this.chatSwitchListeners.forEach(listener => {
                if (typeof listener === 'function') {
                    listener(chatId);
                }
            });

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 通知聊天切换监听器失败:', error);
        }
    }

    /**
     * 添加聊天切换监听器
     * @param {Function} listener - 监听器函数
     */
    addChatSwitchListener(listener) {
        if (typeof listener === 'function') {
            this.chatSwitchListeners.add(listener);
            console.log('[UnifiedDataCore] 🔗 聊天切换监听器已添加');
        }
    }

    /**
     * 移除聊天切换监听器
     * @param {Function} listener - 监听器函数
     */
    removeChatSwitchListener(listener) {
        this.chatSwitchListeners.delete(listener);
        console.log('[UnifiedDataCore] 🗑️ 聊天切换监听器已移除');
    }

    /**
     * 清理聊天数据缓存
     * @param {number} maxSize - 最大缓存大小
     */
    cleanupChatDataCache(maxSize = 10) {
        try {
            if (this.chatDataCache.size <= maxSize) {
                return;
            }

            // 保留最近使用的聊天数据
            const entries = Array.from(this.chatDataCache.entries());
            const toKeep = entries.slice(-maxSize);

            this.chatDataCache.clear();
            toKeep.forEach(([chatId, data]) => {
                this.chatDataCache.set(chatId, data);
            });

            console.log('[UnifiedDataCore] 🧹 聊天数据缓存已清理，保留', maxSize, '个最近聊天');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理聊天数据缓存失败:', error);
        }
    }

    /**
     * 🔧 清空所有数据
     * @param {string} scope - 数据范围 ('global' | 'chat' | 'all')
     */
    async clearAllData(scope = 'all') {
        try {
            console.log('[UnifiedDataCore] 🗑️ 开始清空数据，范围:', scope);
            
            if (scope === 'global' || scope === 'all') {
                // 清空全局数据
                if (this.localStorage) {
                    await this.localStorage.clear();
                    console.log('[UnifiedDataCore] ✅ 全局数据已清空');
                }
                
                // 清空数据缓存
                this.cache.clear();
                this.data.clear();
                this.recentEntries.length = 0;
            }
            
            if (scope === 'chat' || scope === 'all') {
                // 清空聊天数据
                if (this.chatMetadata) {
                    await this.chatMetadata.clear();
                    console.log('[UnifiedDataCore] ✅ 聊天数据已清空');
                }
                
                // 清空聊天数据缓存
                this.chatDataCache.clear();
            }
            
            console.log('[UnifiedDataCore] ✅ 数据清空完成，范围:', scope);
            
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清空数据失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    // ========== 🆕 字段更新和历史记录功能 ==========

    /**
     * 🆕 更新面板字段
     * @param {string} panelId - 面板ID
     * @param {string} fieldName - 字段名（可能是中文显示名）
     * @param {any} newValue - 新值
     */
    async updatePanelField(panelId, fieldName, newValue) {
        try {
            console.log('[UnifiedDataCore] 📝 更新面板字段:', { panelId, fieldName, newValue });

            // 获取当前聊天ID
            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('无法获取当前聊天ID');
            }

            // 🆕 将中文字段名转换为英文字段名
            const englishFieldName = this.getEnglishFieldName(fieldName, panelId);
            const actualFieldName = englishFieldName || fieldName;

            console.log('[UnifiedDataCore] 🔄 字段名映射:', {
                original: fieldName,
                english: englishFieldName,
                actual: actualFieldName
            });

            // 获取当前面板数据
            const panelData = await this.getPanelData(panelId) || {};
            const oldValue = panelData[actualFieldName];

            // 更新字段值
            panelData[actualFieldName] = newValue;

            // 保存面板数据
            const panelKey = `panels.${chatId}.${panelId}`;
            await this.setData(panelKey, panelData, 'chat');

            // 记录历史（使用英文字段名作为键）
            const historyKey = `panel:${panelId}:${actualFieldName}`;
            await this.addFieldHistory(historyKey, {
                timestamp: Date.now(),
                oldValue,
                newValue,
                panelId,
                fieldName: actualFieldName, // 使用英文字段名
                displayName: fieldName, // 保存原始显示名
                chatId,
                source: 'USER_EDIT',
                note: '用户手动编辑'
            });

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('panel_field_updated', {
                    panelId,
                    fieldName,
                    oldValue,
                    newValue,
                    chatId
                });
            }

            console.log('[UnifiedDataCore] ✅ 面板字段更新完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 更新面板字段失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 更新NPC字段
     * @param {string} npcId - NPC ID
     * @param {string} fieldName - 字段名
     * @param {any} newValue - 新值
     */
    async updateNpcField(npcId, fieldName, newValue) {
        try {
            console.log('[UnifiedDataCore] 📝 更新NPC字段:', { npcId, fieldName, newValue });

            // 获取当前聊天ID
            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('无法获取当前聊天ID');
            }

            // 获取当前NPC数据
            const npcData = await this.getNpcData(npcId) || {};
            const oldValue = npcData[fieldName];

            // 更新字段值
            npcData[fieldName] = newValue;

            // 保存NPC数据
            const npcKey = `npcs.${chatId}.${npcId}`;
            await this.setData(npcKey, npcData, 'chat');

            // 记录历史
            const historyKey = `npc:${npcId}:${fieldName}`;
            await this.addFieldHistory(historyKey, {
                timestamp: Date.now(),
                oldValue,
                newValue,
                npcId,
                fieldName,
                chatId,
                source: 'USER_EDIT',
                note: '用户手动编辑'
            });

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('npc_field_updated', {
                    npcId,
                    fieldName,
                    oldValue,
                    newValue,
                    chatId
                });
            }

            console.log('[UnifiedDataCore] ✅ NPC字段更新完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 更新NPC字段失败:', error);
            throw error;
        }
    }

    /**
     * 🆕 添加字段修改历史记录
     * @param {string} historyKey - 历史记录键
     * @param {Object} record - 历史记录
     */
    async addFieldHistory(historyKey, record) {
        try {
            // 获取现有历史记录
            const historyData = await this.getData(`field_history.${historyKey}`, 'chat') || [];

            // 添加新记录
            historyData.push(record);

            // 限制历史记录数量（保留最近50条）
            if (historyData.length > 50) {
                historyData.splice(0, historyData.length - 50);
            }

            // 保存历史记录
            await this.setData(`field_history.${historyKey}`, historyData, 'chat');

            console.log('[UnifiedDataCore] 📝 字段历史记录已添加:', historyKey);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 添加字段历史记录失败:', error);
        }
    }

    /**
     * 🆕 获取字段修改历史记录
     * @param {string} historyKey - 历史记录键
     * @returns {Array} 历史记录数组
     */
    async getFieldHistory(historyKey) {
        try {
            const historyData = await this.getData(`field_history.${historyKey}`, 'chat') || [];

            // 按时间倒序排列（最新的在前）
            return historyData.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取字段历史记录失败:', error);
            return [];
        }
    }

    /**
     * 🆕 获取面板数据
     * @param {string} panelId - 面板ID
     * @returns {Object} 面板数据
     */
    async getPanelData(panelId) {
        try {
            const chatId = this.getCurrentChatId();
            if (!chatId) return null;

            const panelKey = `panels.${chatId}.${panelId}`;
            return await this.getData(panelKey, 'chat');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取面板数据失败:', error);
            return null;
        }
    }

    /**
     * 🆕 获取NPC数据
     * @param {string} npcId - NPC ID
     * @returns {Object} NPC数据
     */
    async getNpcData(npcId) {
        try {
            const chatId = this.getCurrentChatId();
            if (!chatId) return null;

            const npcKey = `npcs.${chatId}.${npcId}`;
            return await this.getData(npcKey, 'chat');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取NPC数据失败:', error);
            return null;
        }
    }

    /**
     * 🆕 记录面板字段变更历史（用于AI更新）
     * @param {string} panelId - 面板ID
     * @param {Object} oldPanel - 旧面板数据
     * @param {Object} newPanel - 新面板数据
     * @param {string} source - 更新源（'AI_UPDATE' | 'USER_EDIT'）
     */
    async recordPanelFieldChanges(panelId, oldPanel, newPanel, source = 'AI_UPDATE') {
        try {
            const timestamp = Date.now();
            const chatId = this.getCurrentChatId();

            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 无法获取聊天ID，跳过历史记录');
                return;
            }

            // 比较新旧数据，找出变更的字段
            const changes = this.compareObjects(oldPanel, newPanel);

            if (changes.length === 0) {
                console.log('[UnifiedDataCore] ℹ️ 没有字段变更，跳过历史记录');
                return;
            }

            console.log('[UnifiedDataCore] 📝 记录面板字段变更:', {
                panelId,
                source,
                changes: changes.length
            });

            // 为每个变更的字段记录历史
            for (const change of changes) {
                const historyKey = `panel:${panelId}:${change.field}`;
                const record = {
                    timestamp,
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                    panelId,
                    fieldName: change.field,
                    chatId,
                    source, // 'AI_UPDATE' 或 'USER_EDIT'
                    note: source === 'AI_UPDATE' ? 'AI自动更新' : '用户手动编辑'
                };

                await this.addFieldHistory(historyKey, record);
            }

            console.log('[UnifiedDataCore] ✅ 面板字段变更历史记录完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 记录面板字段变更失败:', error);
        }
    }

    /**
     * 🆕 比较两个对象，找出变更的字段
     * @param {Object} oldObj - 旧对象
     * @param {Object} newObj - 新对象
     * @returns {Array} 变更列表
     */
    compareObjects(oldObj, newObj) {
        const changes = [];
        const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

        for (const key of allKeys) {
            const oldValue = oldObj?.[key];
            const newValue = newObj?.[key];

            // 跳过特殊字段
            if (key === 'lastUpdated' || key === 'timestamp') {
                continue;
            }

            // 比较值是否发生变化
            if (this.isValueChanged(oldValue, newValue)) {
                changes.push({
                    field: key,
                    oldValue: oldValue || '',
                    newValue: newValue || ''
                });
            }
        }

        return changes;
    }

    /**
     * 🆕 判断值是否发生变化
     * @param {any} oldValue - 旧值
     * @param {any} newValue - 新值
     * @returns {boolean} 是否发生变化
     */
    isValueChanged(oldValue, newValue) {
        // 处理 null/undefined 情况
        if (oldValue == null && newValue == null) return false;
        if (oldValue == null || newValue == null) return true;

        // 转换为字符串比较（因为表格中都是字符串）
        const oldStr = String(oldValue).trim();
        const newStr = String(newValue).trim();

        return oldStr !== newStr;
    }

    /**
     * 🆕 获取英文字段名（中文显示名 -> 英文字段名）
     * @param {string} chineseDisplayName - 中文显示名
     * @param {string} panelId - 面板ID
     * @returns {string|null} 英文字段名
     */
    getEnglishFieldName(chineseDisplayName, panelId) {
        try {
            // 获取完整的字段映射表
            if (!window.SillyTavernInfobar?.infoBarSettings) {
                console.warn('[UnifiedDataCore] ⚠️ InfoBarSettings 不可用');
                return null;
            }

            const completeMapping = window.SillyTavernInfobar.infoBarSettings.getCompleteDisplayNameMapping();

            // 首先在指定面板中查找
            if (panelId && completeMapping[panelId]) {
                for (const [englishName, chineseName] of Object.entries(completeMapping[panelId])) {
                    if (chineseName === chineseDisplayName) {
                        console.log('[UnifiedDataCore] 🎯 找到字段映射:', chineseDisplayName, '->', englishName);
                        return englishName;
                    }
                }
            }

            // 如果在指定面板中没找到，在所有面板中查找
            for (const [panelKey, panelMapping] of Object.entries(completeMapping)) {
                if (panelMapping && typeof panelMapping === 'object') {
                    for (const [englishName, chineseName] of Object.entries(panelMapping)) {
                        if (chineseName === chineseDisplayName) {
                            console.log('[UnifiedDataCore] 🎯 在面板', panelKey, '中找到字段映射:', chineseDisplayName, '->', englishName);
                            return englishName;
                        }
                    }
                }
            }

            console.log('[UnifiedDataCore] ⚠️ 未找到字段映射:', chineseDisplayName);
            return null;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取英文字段名失败:', error);
            return null;
        }
    }
}

