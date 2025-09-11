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
            
            // 提示词插入位置配置
            promptPosition: {
                mode: 'afterCharacter', // 'beforeCharacter' | 'afterCharacter' | 'atDepthSystem' | 'atDepthUser' | 'atDepthAssistant'
                depth: 0 // 用于 @D 模式的深度控制
            },
            
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
                extraPrompt: '',
                mergeMessages: true,
                includeWorldBook: false
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
            getAll: () => extensionSettings[this.MODULE_NAME] || {},
            // 🔧 新增：清空当前扩展命名空间下的所有全局数据
            clear: async () => {
                try {
                    extensionSettings[this.MODULE_NAME] = {};
                    this.context.saveSettingsDebounced();
                } catch (e) {
                    console.warn('[UnifiedDataCore] ⚠️ 清空全局数据时出现问题（已继续）:', e);
                }
            }
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
            },
            // 🔧 新增：清空当前扩展命名空间下的所有聊天数据
            clear: async () => {
                try {
                    const context = SillyTavern.getContext();
                    const metadata = context.chatMetadata;
                    if (metadata && metadata[this.MODULE_NAME]) {
                        // 仅清理本扩展命名空间，避免影响其他插件/系统
                        metadata[this.MODULE_NAME] = {};
                        await context.saveMetadata();
                    }
                } catch (e) {
                    console.warn('[UnifiedDataCore] ⚠️ 清空聊天数据时出现问题（已继续）:', e);
                }
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
     * 按启用字段合并面板数据 (增强版：支持多行插入)
     * @param {string} panelId - 面板ID
     * @param {Object} existingData - 现有数据
     * @param {Object} newData - 新数据
     * @returns {Object} 过滤后的合并数据
     */
    async mergeWithEnabledFields(panelId, existingData = {}, newData = {}) {
        try {
            // 从SillyTavern上下文读取启用字段配置
            const context = window.SillyTavern?.getContext?.();
            const configs = context?.extensionSettings?.['Information bar integration tool'] || {};
            // 同时支持根级自定义面板与 customPanels 下的配置
            const rootPanelConfig = configs?.[panelId];
            const customPanelConfig = configs?.customPanels?.[panelId];
            const panelConfig = rootPanelConfig || customPanelConfig;

            // 若无配置，只保留新数据（避免历史污染）
            if (!panelConfig) {
                console.warn(`[UnifiedDataCore] ⚠️ 面板 ${panelId} 无配置，只保留新数据`);
                return { ...newData };
            }

            // 🆕 获取多行数据配置
            const multiRowFields = this.getMultiRowFieldsConfig(panelId, panelConfig);

            // 收集启用字段键列表
            const enabledKeys = new Set();

            // 基础设置的子项（仅当对象且包含enabled时）
            Object.keys(panelConfig).forEach(key => {
                const val = panelConfig[key];
                if (
                    key !== 'enabled' &&
                    key !== 'subItems' &&
                    key !== 'description' &&
                    key !== 'icon' &&
                    key !== 'required' &&
                    key !== 'memoryInject' &&
                    key !== 'prompts' &&
                    typeof val === 'object' &&
                    val?.enabled === true
                ) {
                    enabledKeys.add(key);
                }
            });

            // 自定义子项
            if (Array.isArray(panelConfig.subItems)) {
                panelConfig.subItems.forEach(subItem => {
                    if (subItem && subItem.enabled !== false) {
                        const key = subItem.key || subItem.name || subItem.id || subItem.field || subItem?.toString?.();
                        // 规范化：空格转下划线
                        const normalized = typeof key === 'string' ? key.replace(/\s+/g, '_') : null;
                        if (normalized) enabledKeys.add(normalized);
                    }
                });
            }

            console.log(`[UnifiedDataCore] 🔍 面板 ${panelId} 启用字段:`, Array.from(enabledKeys));
            console.log(`[UnifiedDataCore] 📋 面板 ${panelId} 多行字段:`, Array.from(multiRowFields));

            // 若启用列表为空，但新数据存在字段，采取宽松策略：直接接受新数据，避免丢失（常见于自定义面板配置未及时写入）
            if (enabledKeys.size === 0 && newData && Object.keys(newData).length > 0) {
                console.warn(`[UnifiedDataCore] ⚠️ 面板 ${panelId} 启用字段为空，采用宽松策略：直接接受AI新数据 (${Object.keys(newData).length}项)`);
                return { ...existingData, ...newData };
            }

            // 构建过滤后的合并数据
            const result = {};
            
            // 1. 从现有数据中保留启用字段
            Object.keys(existingData).forEach(fieldKey => {
                let shouldInclude = false;
                
                if (panelId === 'interaction') {
                    // 🔧 特殊处理：交互对象面板的动态NPC字段格式 (npcX.fieldName)
                    const npcFieldMatch = fieldKey.match(/^npc\d+\.(.+)$/);
                    if (npcFieldMatch) {
                        const baseFieldName = npcFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                    } else {
                        shouldInclude = enabledKeys.has(fieldKey);
                    }
                } else if (panelId === 'organization') {
                    // 🔧 特殊处理：组织架构面板的动态组织字段格式 (orgX.fieldName)
                    const orgFieldMatch = fieldKey.match(/^org\d+\.(.+)$/);
                    if (orgFieldMatch) {
                        const baseFieldName = orgFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                    } else {
                        shouldInclude = enabledKeys.has(fieldKey);
                    }
                } else {
                    shouldInclude = enabledKeys.has(fieldKey);
                }
                
                if (shouldInclude) {
                    result[fieldKey] = existingData[fieldKey];
                }
            });
            
            // 2. 🆕 智能合并新数据（支持多行插入模式）
            Object.keys(newData).forEach(fieldKey => {
                let shouldInclude = false;
                let baseFieldName = fieldKey;
                
                if (panelId === 'interaction') {
                    // 🔧 特殊处理：交互对象面板的动态NPC字段格式 (npcX.fieldName)
                    const npcFieldMatch = fieldKey.match(/^npc\d+\.(.+)$/);
                    if (npcFieldMatch) {
                        baseFieldName = npcFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                        if (shouldInclude) {
                            console.log(`[UnifiedDataCore] ✅ 交互对象动态字段合并: ${fieldKey} -> ${baseFieldName}`);
                        }
                    } else {
                        shouldInclude = enabledKeys.has(fieldKey);
                    }
                } else if (panelId === 'organization') {
                    // 🔧 特殊处理：组织架构面板的动态组织字段格式 (orgX.fieldName)
                    const orgFieldMatch = fieldKey.match(/^org\d+\.(.+)$/);
                    if (orgFieldMatch) {
                        baseFieldName = orgFieldMatch[1];
                        shouldInclude = enabledKeys.has(baseFieldName);
                        if (shouldInclude) {
                            console.log(`[UnifiedDataCore] ✅ 组织架构动态字段合并: ${fieldKey} -> ${baseFieldName}`);
                        }
                    } else {
                        shouldInclude = enabledKeys.has(fieldKey);
                    }
                } else {
                    shouldInclude = enabledKeys.has(fieldKey);
                }
                
                if (shouldInclude) {
                    // 🆕 检查是否为多行数据字段
                    if (multiRowFields.has(baseFieldName)) {
                        result[fieldKey] = this.mergeMultiRowData(fieldKey, result[fieldKey], newData[fieldKey], panelId);
                    } else {
                        // 传统覆盖模式
                        result[fieldKey] = newData[fieldKey];
                    }
                }
            });

            console.log(`[UnifiedDataCore] ✅ 面板 ${panelId} 过滤合并: ${Object.keys(existingData).length} + ${Object.keys(newData).length} -> ${Object.keys(result).length}`);

            // 🧠 自动添加历史记录（用于AI记忆增强）
            await this.recordDataChangeForMemory(panelId, existingData, result, newData);

            return result;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 合并启用字段失败:', error);
            // 降级到只保留新数据
            return { ...newData };
        }
    }

    /**
     * 🆕 获取多行数据字段配置
     * @param {string} panelId - 面板ID
     * @param {Object} panelConfig - 面板配置
     * @returns {Set} 支持多行数据的字段集合
     */
    getMultiRowFieldsConfig(panelId, panelConfig) {
        const multiRowFields = new Set();
        
        try {
            // 🆕 默认多行数据字段配置
            const defaultMultiRowFields = {
                'personal': ['经历记录', 'experience_log', '重要事件', 'important_events'],
                'world': ['位置记录', 'locations', '事件记录', 'events_log'],
                'interaction': ['对话记录', 'conversation_log', '互动历史', 'interaction_history'],
                'tasks': ['任务记录', 'task_log', '完成记录', 'completion_log'],
                'news': ['新闻事件', 'news_events', '事件记录', 'event_log'],
                'plot': ['剧情发展', 'plot_development', '重要节点', 'key_moments'],
                'organization': ['成员记录', 'member_log', '活动记录', 'activity_log', '组织历史', 'organization_history', '重要决策', 'important_decisions']
            };

            // 添加面板默认的多行字段
            if (defaultMultiRowFields[panelId]) {
                defaultMultiRowFields[panelId].forEach(field => {
                    multiRowFields.add(field);
                });
            }

            // 🆕 从面板配置中检测多行字段（通过配置标识）
            if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                panelConfig.subItems.forEach(subItem => {
                    if (subItem && subItem.multiRow === true) {
                        const key = subItem.key || subItem.name || subItem.id;
                        if (key) {
                            multiRowFields.add(key);
                            console.log(`[UnifiedDataCore] 📋 从配置检测到多行字段: ${panelId}.${key}`);
                        }
                    }
                });
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取多行字段配置失败:', error);
        }

        return multiRowFields;
    }

    /**
     * 🆕 合并多行数据
     * @param {string} fieldKey - 字段键
     * @param {any} existingValue - 现有值
     * @param {any} newValue - 新值
     * @param {string} panelId - 面板ID
     * @returns {any} 合并后的值
     */
    mergeMultiRowData(fieldKey, existingValue, newValue, panelId) {
        try {
            console.log(`[UnifiedDataCore] 🔗 合并多行数据: ${panelId}.${fieldKey}`);
            
            // 如果新值为空，保持现有值
            if (!newValue || (typeof newValue === 'string' && newValue.trim() === '')) {
                console.log(`[UnifiedDataCore] ℹ️ 新值为空，保持现有值`);
                return existingValue;
            }

            // 🆕 智能检测是否为增量追加模式
            const isAppendMode = this.detectAppendMode(newValue);
            
            if (isAppendMode) {
                console.log(`[UnifiedDataCore] 📝 检测到增量追加模式`);
                return this.appendToMultiRowData(existingValue, newValue);
            } else {
                // 🆕 检查是否需要转换为数组格式
                if (!Array.isArray(existingValue) && existingValue) {
                    console.log(`[UnifiedDataCore] 🔄 转换现有数据为多行格式`);
                    const convertedExisting = this.convertToMultiRowArray(existingValue);
                    const convertedNew = this.convertToMultiRowArray(newValue);
                    return this.mergeMultiRowArrays(convertedExisting, convertedNew);
                }
                
                // 传统覆盖模式（向后兼容）
                console.log(`[UnifiedDataCore] 🔄 使用传统覆盖模式`);
                return newValue;
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 合并多行数据失败:', error);
            // 降级到传统覆盖模式
            return newValue;
        }
    }

    /**
     * 🆕 检测是否为增量追加模式
     * @param {any} newValue - 新值
     * @returns {boolean} 是否为追加模式
     */
    detectAppendMode(newValue) {
        if (typeof newValue !== 'string') return false;
        
        // 🆕 检测追加关键词和格式
        const appendIndicators = [
            /^\+\s*/, // 以"+"开头
            /^追加[:：]\s*/, // 以"追加:"开头
            /^新增[:：]\s*/, // 以"新增:"开头
            /^\d{1,2}[\.、]\s*/, // 以数字编号开头(1. 2、)
            /^[●○▪▫►‣]\s*/, // 以列表符号开头
            /^[-–—]\s*/, // 以破折号开头
        ];

        return appendIndicators.some(pattern => pattern.test(newValue.trim()));
    }

    /**
     * 🆕 追加到多行数据
     * @param {any} existingValue - 现有值
     * @param {string} newValue - 新值
     * @returns {Array} 追加后的数组
     */
    appendToMultiRowData(existingValue, newValue) {
        // 将现有数据转换为数组
        let existingArray = [];
        if (Array.isArray(existingValue)) {
            existingArray = [...existingValue];
        } else if (existingValue && typeof existingValue === 'string') {
            existingArray = this.convertToMultiRowArray(existingValue);
        }

        // 清理和格式化新值
        const cleanedNewValue = newValue.replace(/^[+追加新增][:：]?\s*/, '').trim();
        
        // 检查是否已存在相同内容（避免重复）
        const isDuplicate = existingArray.some(item => {
            const itemContent = typeof item === 'string' ? item : item.content || item;
            return itemContent.includes(cleanedNewValue) || cleanedNewValue.includes(itemContent);
        });
        
        if (!isDuplicate) {
            existingArray.push({
                content: cleanedNewValue,
                timestamp: Date.now(),
                source: 'AI_APPEND'
            });
            
            console.log(`[UnifiedDataCore] ✅ 已追加新内容:`, cleanedNewValue.substring(0, 50));
        } else {
            console.log(`[UnifiedDataCore] ℹ️ 内容已存在，跳过追加`);
        }

        return existingArray;
    }

    /**
     * 🆕 将字符串内容转换为多行数组
     * @param {string} value - 字符串值
     * @returns {Array} 转换后的数组
     */
    convertToMultiRowArray(value) {
        if (!value || typeof value !== 'string') return [];
        
        // 按行分割并清理
        const lines = value.split(/\n|；|;/).filter(line => line.trim());
        
        return lines.map(line => ({
            content: line.trim(),
            timestamp: Date.now(),
            source: 'LEGACY_CONVERSION'
        }));
    }

    /**
     * 🆕 合并多行数组数据
     * @param {Array} existingArray - 现有数组
     * @param {Array} newArray - 新数组
     * @returns {Array} 合并后的数组
     */
    mergeMultiRowArrays(existingArray, newArray) {
        if (!Array.isArray(existingArray)) existingArray = [];
        if (!Array.isArray(newArray)) newArray = [];
        
        const mergedArray = [...existingArray];
        
        newArray.forEach(newItem => {
            // 避免重复内容
            const isDuplicate = mergedArray.some(existing => 
                existing.content === newItem.content || 
                existing.content.includes(newItem.content) ||
                newItem.content.includes(existing.content)
            );
            
            if (!isDuplicate) {
                mergedArray.push({
                    ...newItem,
                    timestamp: Date.now(),
                    source: 'AI_MERGE'
                });
            }
        });
        
        return mergedArray;
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
                    
                    // 🔧 修复：使用启用字段过滤的合并，避免跨面板数据污染
                    const mergedPanelData = await this.mergeWithEnabledFields(panelId, existingPanelData, value);

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
                        // 🔧 修复：也对这里使用启用字段过滤的合并
                        const prevPanel = chatData.infobar_data.panels[panelId] || {};
                        const newPanel = await this.mergeWithEnabledFields(panelId, prevPanel, mergedPanelData);

                        // 🔧 分离系统字段：将系统元数据单独存储，避免与用户字段混合
                        const systemMetadata = {
                            lastUpdated: Date.now(),
                            source: value.source || 'AI_UPDATE',
                            fieldCount: Object.keys(newPanel).length
                        };
                        
                        // 🆕 记录字段级别的变更历史（AI更新）
                        await this.recordPanelFieldChanges(panelId, prevPanel, newPanel, systemMetadata.source);

                        chatData.infobar_data.panels[panelId] = newPanel;
                        chatData.infobar_data.lastUpdated = systemMetadata.lastUpdated;
                        
                        // 系统元数据存储到单独区域
                        if (!chatData.infobar_data.systemMetadata) {
                            chatData.infobar_data.systemMetadata = {};
                        }
                        chatData.infobar_data.systemMetadata[panelId] = systemMetadata;
                        
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
            
            // 🔧 修复：确保聊天数据是数组格式（兼容旧数据，但保留现有面板数据）
            if (!Array.isArray(chatData)) {
                console.log('[UnifiedDataCore] 🔧 转换旧数据格式为数组格式，保留现有面板数据');
                
                // 🔧 关键修复：保留现有的infobar_data.panels数据
                const existingPanels = (chatData && chatData.infobar_data && chatData.infobar_data.panels) ? 
                    chatData.infobar_data.panels : {};
                
                // 创建新的数组格式
                chatData = [];
                
                // 🔧 重要：将保留的面板数据附加到数组对象上
                chatData.infobar_data = {
                    panels: existingPanels,
                    history: [],
                    lastUpdated: Date.now()
                };
                
                this.chatDataCache.set(currentChatId, chatData);
                
                console.log(`[UnifiedDataCore] ✅ 数据格式转换完成，保留了 ${Object.keys(existingPanels).length} 个面板的数据`);
            }
            
            chatData.push(dataEntry);
            
            console.log('[UnifiedDataCore] 💾 数据已存储到聊天缓存');
            console.log('[UnifiedDataCore] 📋 当前聊天数据条目数量:', chatData.length);

            // 🔧 修复：将本次解析到的面板数据按启用字段合并到缓存数组的附加 infobar_data.panels 上
            if (!chatData.infobar_data) {
                chatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
            }
            if (!chatData.infobar_data.panels) {
                chatData.infobar_data.panels = {};
            }
            if (eventData.data && typeof eventData.data === 'object') {
                for (const [panelName, panelFields] of Object.entries(eventData.data)) {
                    const prev = chatData.infobar_data.panels[panelName] || {};
                    // 🔧 使用启用字段过滤的合并
                    chatData.infobar_data.panels[panelName] = await this.mergeWithEnabledFields(panelName, prev, panelFields);
                }
                chatData.infobar_data.lastUpdated = Date.now();
            }
            
            // 更新最近条目缓存（用于向后兼容，不再覆盖主数据存储Map）
            this.recentEntries = chatData;
            
            // 🔧 修复：将新数据按启用字段合并到 this.data Map 中
            if (eventData.data && typeof eventData.data === 'object') {
                for (const [panelName, panelData] of Object.entries(eventData.data)) {
                    if (panelData && typeof panelData === 'object') {
                        // 获取现有面板数据
                        const existingPanelData = this.data.get(panelName) || {};
                        
                        // 🔧 使用启用字段过滤的合并，避免跨面板数据污染
                        const mergedPanelData = await this.mergeWithEnabledFields(panelName, existingPanelData, panelData);
                        
                        // 更新到数据 Map
                        this.data.set(panelName, mergedPanelData);
                        
                        console.log(`[UnifiedDataCore] 🔄 已按启用字段合并面板数据: ${panelName}, 字段数: ${Object.keys(mergedPanelData).length}`);
                    }
                }
            }

            console.log('[UnifiedDataCore] 🎯 面板数据合并循环完成，准备触发事件...');

            // 触发数据更新事件
            console.log('[UnifiedDataCore] 🚀 准备触发data:updated事件...');
            if (this.eventSystem) {
                console.log('[UnifiedDataCore] 📡 触发data:updated事件，数据条目:', dataEntry.messageId);
                this.eventSystem.emit('data:updated', {
                    dataEntry: dataEntry,
                    totalCount: chatData.length,
                    timestamp: Date.now()
                });

                // 🔧 修复：同时触发data:changed事件以通知DataTable
                console.log('[UnifiedDataCore] 📡 触发data:changed事件');
                this.eventSystem.emit('data:changed', {
                    key: 'xml_parsed_data',
                    value: dataEntry,
                    timestamp: Date.now()
                });
                console.log('[UnifiedDataCore] ✅ 事件触发完成');
            } else {
                console.warn('[UnifiedDataCore] ⚠️ 事件系统不可用，无法触发data:updated事件');
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
     * 🧠 获取聊天历史记录（用于AI记忆增强）
     * @param {string} chatId - 聊天ID
     * @returns {Array} 历史记录数组
     */
    async getChatHistory(chatId) {
        try {
            if (!chatId) {
                console.warn('[UnifiedDataCore] ⚠️ 聊天ID为空');
                return [];
            }

            const chatData = await this.getChatData(chatId);
            if (!chatData || !chatData.infobar_data) {
                return [];
            }

            // 返回历史记录，如果没有则返回空数组
            return chatData.infobar_data.history || [];

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取聊天历史记录失败:', error);
            return [];
        }
    }

    /**
     * 🔒 获取持久化记忆数据（跨对话）
     * @returns {Object} 持久化记忆数据
     */
    async getPersistentMemory() {
        try {
            const persistentData = await this.getData('persistent_memory', 'global');
            return persistentData || {};
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取持久化记忆失败:', error);
            return {};
        }
    }

    /**
     * 🔒 设置持久化记忆数据（跨对话）
     * @param {Object} memoryData - 记忆数据
     */
    async setPersistentMemory(memoryData) {
        try {
            await this.setData('persistent_memory', memoryData, 'global');
            console.log('[UnifiedDataCore] 🔒 持久化记忆数据已保存');
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 保存持久化记忆失败:', error);
        }
    }

    /**
     * 📝 添加历史记录条目
     * @param {string} chatId - 聊天ID
     * @param {Object} historyEntry - 历史记录条目
     */
    async addHistoryEntry(chatId, historyEntry) {
        try {
            if (!chatId || !historyEntry) {
                return;
            }

            const chatData = await this.getChatData(chatId);
            if (!chatData.infobar_data) {
                chatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
            }

            if (!chatData.infobar_data.history) {
                chatData.infobar_data.history = [];
            }

            // 添加时间戳
            const entry = {
                ...historyEntry,
                timestamp: Date.now(),
                id: this.generateHistoryId()
            };

            // 添加到历史记录
            chatData.infobar_data.history.push(entry);

            // 限制历史记录数量（保留最近50条）
            if (chatData.infobar_data.history.length > 50) {
                chatData.infobar_data.history = chatData.infobar_data.history.slice(-50);
            }

            // 保存更新后的数据
            await this.setChatData(chatId, chatData);

            console.log(`[UnifiedDataCore] 📝 历史记录已添加: ${entry.id}`);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 添加历史记录失败:', error);
        }
    }

    /**
     * 🆔 生成历史记录ID
     */
    generateHistoryId() {
        return `hist_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * 🧠 记录数据变更用于AI记忆增强
     * @param {string} panelId - 面板ID
     * @param {Object} existingData - 原有数据
     * @param {Object} resultData - 合并后数据
     * @param {Object} newData - 新数据
     */
    async recordDataChangeForMemory(panelId, existingData, resultData, newData) {
        try {
            const currentChatId = this.getCurrentChatId();
            if (!currentChatId) {
                return;
            }

            // 检测是否有实际数据变更
            const hasChanges = this.detectDataChanges(existingData, resultData);
            if (!hasChanges) {
                return;
            }

            // 创建历史记录条目
            const historyEntry = {
                panelId: panelId,
                type: 'data_change',
                changes: this.calculateDataChanges(existingData, resultData),
                panels: {
                    [panelId]: resultData
                },
                source: newData.source || 'ai-message',
                importance: this.calculateChangeImportance(existingData, resultData),
                metadata: {
                    fieldCount: Object.keys(resultData).length,
                    changeCount: Object.keys(this.calculateDataChanges(existingData, resultData)).length,
                    chatId: currentChatId
                }
            };

            // 添加到历史记录
            await this.addHistoryEntry(currentChatId, historyEntry);

            // 更新持久化记忆（重要数据）
            if (historyEntry.importance > 0.7) {
                await this.updatePersistentMemory(panelId, resultData, historyEntry.importance);
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 记录数据变更失败:', error);
        }
    }

    /**
     * 🔍 检测数据变更
     */
    detectDataChanges(oldData, newData) {
        const oldKeys = Object.keys(oldData || {});
        const newKeys = Object.keys(newData || {});

        // 检查键数量变化
        if (oldKeys.length !== newKeys.length) {
            return true;
        }

        // 检查值变化
        for (const key of newKeys) {
            if (oldData[key] !== newData[key]) {
                return true;
            }
        }

        return false;
    }

    /**
     * 📊 计算数据变更详情
     */
    calculateDataChanges(oldData, newData) {
        const changes = {};
        const oldKeys = new Set(Object.keys(oldData || {}));
        const newKeys = new Set(Object.keys(newData || {}));

        // 新增字段
        for (const key of newKeys) {
            if (!oldKeys.has(key)) {
                changes[key] = { type: 'added', value: newData[key] };
            } else if (oldData[key] !== newData[key]) {
                changes[key] = { type: 'modified', oldValue: oldData[key], newValue: newData[key] };
            }
        }

        // 删除字段
        for (const key of oldKeys) {
            if (!newKeys.has(key)) {
                changes[key] = { type: 'removed', oldValue: oldData[key] };
            }
        }

        return changes;
    }

    /**
     * 📈 计算变更重要性
     */
    calculateChangeImportance(oldData, newData) {
        const changes = this.calculateDataChanges(oldData, newData);
        const changeCount = Object.keys(changes).length;
        const totalFields = Math.max(Object.keys(oldData || {}).length, Object.keys(newData || {}).length);

        if (totalFields === 0) return 0;

        // 基础重要性：变更字段比例
        let importance = changeCount / totalFields;

        // 新增字段权重更高
        const addedCount = Object.values(changes).filter(c => c.type === 'added').length;
        importance += addedCount * 0.2;

        // 限制在0-1范围内
        return Math.min(importance, 1.0);
    }

    /**
     * 🔒 更新持久化记忆
     */
    async updatePersistentMemory(panelId, data, importance) {
        try {
            const persistentMemory = await this.getPersistentMemory();

            if (!persistentMemory[panelId]) {
                persistentMemory[panelId] = {};
            }

            // 只保存重要字段到持久化记忆
            for (const [key, value] of Object.entries(data)) {
                if (this.isImportantField(key, value)) {
                    persistentMemory[panelId][key] = {
                        value: value,
                        importance: importance,
                        lastUpdated: Date.now(),
                        updateCount: (persistentMemory[panelId][key]?.updateCount || 0) + 1
                    };
                }
            }

            await this.setPersistentMemory(persistentMemory);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 更新持久化记忆失败:', error);
        }
    }

    /**
     * 🎯 判断是否为重要字段
     */
    isImportantField(key, value) {
        // 排除临时字段
        if (['lastUpdated', 'source', 'timestamp'].includes(key)) {
            return false;
        }

        // 排除空值
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            return false;
        }

        // 重要字段关键词
        const importantKeywords = ['name', 'status', 'health', 'mood', 'location', 'relationship', 'goal', 'personality'];
        const keyLower = key.toLowerCase();

        return importantKeywords.some(keyword => keyLower.includes(keyword));
    }

    /**
     * 🔍 语义搜索记忆数据（基础实现）
     * @param {string} query - 搜索查询
     * @param {Object} options - 搜索选项
     * @returns {Array} 搜索结果
     */
    async searchMemories(query, options = {}) {
        try {
            const {
                chatId = this.getCurrentChatId(),
                limit = 10,
                minRelevance = 0.3,
                includeHistorical = true,
                includePersistent = true
            } = options;

            console.log(`[UnifiedDataCore] 🔍 开始语义搜索: "${query}"`);

            const results = [];
            const queryLower = query.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);

            // 1. 搜索历史记忆
            if (includeHistorical && chatId) {
                const history = await this.getChatHistory(chatId);
                for (const entry of history) {
                    const relevance = this.calculateTextRelevance(query, entry, queryWords);
                    if (relevance >= minRelevance) {
                        results.push({
                            type: 'historical',
                            relevance: relevance,
                            timestamp: entry.timestamp,
                            data: entry,
                            source: 'chat_history'
                        });
                    }
                }
            }

            // 2. 搜索持久化记忆
            if (includePersistent) {
                const persistentMemory = await this.getPersistentMemory();
                for (const [panelId, panelData] of Object.entries(persistentMemory)) {
                    for (const [fieldKey, fieldData] of Object.entries(panelData)) {
                        const relevance = this.calculateFieldRelevance(query, fieldKey, fieldData, queryWords);
                        if (relevance >= minRelevance) {
                            results.push({
                                type: 'persistent',
                                relevance: relevance,
                                panelId: panelId,
                                fieldKey: fieldKey,
                                data: fieldData,
                                source: 'persistent_memory'
                            });
                        }
                    }
                }
            }

            // 3. 搜索当前数据
            const currentData = await this.getAllPanelData();
            for (const [panelId, panelData] of Object.entries(currentData)) {
                for (const [fieldKey, fieldValue] of Object.entries(panelData)) {
                    const relevance = this.calculateCurrentDataRelevance(query, fieldKey, fieldValue, queryWords);
                    if (relevance >= minRelevance) {
                        results.push({
                            type: 'current',
                            relevance: relevance,
                            panelId: panelId,
                            fieldKey: fieldKey,
                            value: fieldValue,
                            source: 'current_data'
                        });
                    }
                }
            }

            // 按相关性排序并限制结果数量
            const sortedResults = results
                .sort((a, b) => b.relevance - a.relevance)
                .slice(0, limit);

            console.log(`[UnifiedDataCore] 🔍 语义搜索完成: 找到 ${sortedResults.length} 个相关结果`);
            return sortedResults;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 语义搜索失败:', error);
            return [];
        }
    }

    /**
     * 📊 计算文本相关性（历史记录）
     */
    calculateTextRelevance(query, entry, queryWords) {
        let relevance = 0;
        const queryLower = query.toLowerCase();

        // 检查面板数据
        if (entry.panels) {
            for (const panelData of Object.values(entry.panels)) {
                for (const [key, value] of Object.entries(panelData)) {
                    const textContent = `${key} ${value}`.toLowerCase();

                    // 完全匹配加分
                    if (textContent.includes(queryLower)) {
                        relevance += 0.8;
                    }

                    // 关键词匹配
                    const matchedWords = queryWords.filter(word => textContent.includes(word));
                    relevance += (matchedWords.length / queryWords.length) * 0.6;
                }
            }
        }

        // 检查变更信息
        if (entry.changes) {
            for (const change of Object.values(entry.changes)) {
                const changeText = JSON.stringify(change).toLowerCase();
                if (changeText.includes(queryLower)) {
                    relevance += 0.5;
                }
            }
        }

        // 重要性加权
        if (entry.importance) {
            relevance *= (1 + entry.importance * 0.5);
        }

        return Math.min(relevance, 1.0);
    }

    /**
     * 📊 计算字段相关性（持久化记忆）
     */
    calculateFieldRelevance(query, fieldKey, fieldData, queryWords) {
        const queryLower = query.toLowerCase();
        const textContent = `${fieldKey} ${fieldData.value}`.toLowerCase();

        let relevance = 0;

        // 完全匹配
        if (textContent.includes(queryLower)) {
            relevance += 0.9;
        }

        // 关键词匹配
        const matchedWords = queryWords.filter(word => textContent.includes(word));
        relevance += (matchedWords.length / queryWords.length) * 0.7;

        // 重要性和更新频率加权
        if (fieldData.importance) {
            relevance *= (1 + fieldData.importance * 0.3);
        }

        if (fieldData.updateCount > 1) {
            relevance *= 1.2; // 经常更新的字段更重要
        }

        return Math.min(relevance, 1.0);
    }

    /**
     * 📊 计算当前数据相关性
     */
    calculateCurrentDataRelevance(query, fieldKey, fieldValue, queryWords) {
        const queryLower = query.toLowerCase();
        const textContent = `${fieldKey} ${fieldValue}`.toLowerCase();

        let relevance = 0;

        // 完全匹配
        if (textContent.includes(queryLower)) {
            relevance += 0.7;
        }

        // 关键词匹配
        const matchedWords = queryWords.filter(word => textContent.includes(word));
        relevance += (matchedWords.length / queryWords.length) * 0.5;

        // 重要字段加权
        if (this.isImportantField(fieldKey, fieldValue)) {
            relevance *= 1.3;
        }

        return Math.min(relevance, 1.0);
    }

    /**
     * 🧠 智能记忆检索（基于上下文）
     * @param {string} context - 当前上下文
     * @param {Object} options - 检索选项
     * @returns {Object} 检索结果
     */
    async intelligentMemoryRetrieval(context, options = {}) {
        try {
            const {
                maxResults = 5,
                includeRecentHistory = true,
                includePersistentMemory = true,
                contextWindow = 3
            } = options;

            console.log(`[UnifiedDataCore] 🧠 开始智能记忆检索...`);

            // 提取上下文关键词
            const contextKeywords = this.extractContextKeywords(context);

            const retrievalResults = {
                relevantMemories: [],
                contextKeywords: contextKeywords,
                retrievalStrategy: 'intelligent',
                timestamp: Date.now()
            };

            // 基于关键词搜索相关记忆
            for (const keyword of contextKeywords) {
                const searchResults = await this.searchMemories(keyword, {
                    limit: Math.ceil(maxResults / contextKeywords.length),
                    minRelevance: 0.4,
                    includeHistorical: includeRecentHistory,
                    includePersistent: includePersistentMemory
                });

                retrievalResults.relevantMemories.push(...searchResults);
            }

            // 去重并按相关性排序
            const uniqueMemories = this.deduplicateMemories(retrievalResults.relevantMemories);
            retrievalResults.relevantMemories = uniqueMemories
                .sort((a, b) => b.relevance - a.relevance)
                .slice(0, maxResults);

            console.log(`[UnifiedDataCore] 🧠 智能记忆检索完成: 找到 ${retrievalResults.relevantMemories.length} 个相关记忆`);
            return retrievalResults;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 智能记忆检索失败:', error);
            return {
                relevantMemories: [],
                contextKeywords: [],
                error: error.message
            };
        }
    }

    /**
     * 🔤 提取上下文关键词
     */
    extractContextKeywords(context) {
        if (!context || typeof context !== 'string') {
            return [];
        }

        // 简单的关键词提取（可以后续用更复杂的NLP算法替换）
        const words = context.toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文字符
            .split(/\s+/)
            .filter(word => word.length > 1);

        // 移除常见停用词
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', '的', '了', '在', '是', '我', '你', '他', '她', '它']);

        const keywords = words.filter(word => !stopWords.has(word));

        // 返回前5个最有意义的关键词
        return [...new Set(keywords)].slice(0, 5);
    }

    /**
     * 🔄 去重记忆结果
     */
    deduplicateMemories(memories) {
        const seen = new Set();
        return memories.filter(memory => {
            const key = `${memory.type}_${memory.panelId || ''}_${memory.fieldKey || ''}_${JSON.stringify(memory.data || memory.value)}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 设置指定聊天的数据
     * @param {string} chatId - 聊天ID
     * @param {Object} data - 聊天数据
     * @param {Object} options - 可选参数，包含source等标识
     */
    async setChatData(chatId, data, options = {}) {
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
                    timestamp: Date.now(),
                    source: options.source || 'normal',
                    operation: options.operation || 'update'
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
                console.log('[UnifiedDataCore] 📥 chatMetadata中无数据，保持空状态:', chatId);
                
                // 清空当前数据，不再回退到解析历史消息
                this.data.clear();
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
     * 🆕 更新多行面板的指定行字段值
     * @param {string} panelId
     * @param {number} rowIndex - 0-based 行索引
     * @param {string} fieldName
     * @param {any} newValue
     */
    async updatePanelRowField(panelId, rowIndex, fieldName, newValue) {
        try {
            if (rowIndex === undefined || rowIndex === null || isNaN(parseInt(rowIndex))) {
                return await this.updatePanelField(panelId, fieldName, newValue);
            }

            const chatId = this.getCurrentChatId();
            if (!chatId) throw new Error('无法获取当前聊天ID');

            // 字段名映射（支持中文）
            const englishFieldName = this.getEnglishFieldName(fieldName, panelId);
            const actualFieldName = englishFieldName || fieldName;

            // 读取现有面板数据
            let panelData = await this.getPanelData(panelId);
            if (!Array.isArray(panelData)) {
                // 兼容：将对象/空值转成数组结构
                if (panelData && typeof panelData === 'object') {
                    panelData = [panelData];
                } else {
                    panelData = [];
                }
            }

            // 确保数组长度
            while (panelData.length <= rowIndex) panelData.push({});

            const oldValue = panelData[rowIndex]?.[actualFieldName];
            if (!panelData[rowIndex]) panelData[rowIndex] = {};
            panelData[rowIndex][actualFieldName] = newValue;

            // 写回（跳过合并逻辑）
            await this.writePanelDataWithoutMerge(this.getCurrentChatId(), panelId, panelData);

            // 历史记录键：针对行的细化
            const historyKey = `panel:${panelId}:row${rowIndex}:${actualFieldName}`;
            await this.addFieldHistory(historyKey, {
                timestamp: Date.now(),
                oldValue,
                newValue,
                panelId,
                fieldName: actualFieldName,
                rowIndex,
                chatId,
                source: 'USER_EDIT',
                note: '用户手动编辑（多行）'
            });

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('panel_row_field_updated', {
                    panelId,
                    rowIndex,
                    fieldName,
                    oldValue,
                    newValue,
                    timestamp: Date.now()
                });
            }

            return true;
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 更新多行面板字段失败:', error);
            this.handleError(error);
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
     * 🔧 新增：删除面板字段
     * @param {string} panelId - 面板ID
     * @param {string} fieldKey - 字段键（可能包含前缀，如npc0.name或直接name）
     */
    async deletePanelField(panelId, fieldKey) {
        try {
            console.log('[UnifiedDataCore] 🗑️ 删除面板字段:', { panelId, fieldKey });

            // 获取当前聊天ID
            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('当前聊天ID未找到');
            }

            // 🔧 修复：处理字段名转换
            let actualFieldKey = fieldKey;
            
            // 如果fieldKey包含前缀（如npc0.中文字段名），需要分别处理
            const prefixMatch = fieldKey.match(/^((?:npc|org)\d+)\.(.+)$/);
            if (prefixMatch) {
                const [, prefix, fieldName] = prefixMatch;
                // 将中文字段名转换为英文字段名
                const englishFieldName = this.getEnglishFieldName(fieldName, panelId);
                actualFieldKey = englishFieldName ? `${prefix}.${englishFieldName}` : fieldKey;
                
                console.log('[UnifiedDataCore] 🔄 前缀字段名映射:', {
                    original: fieldKey,
                    prefix,
                    fieldName,
                    englishFieldName,
                    actual: actualFieldKey
                });
            } else {
                // 普通字段名转换
                const englishFieldName = this.getEnglishFieldName(fieldKey, panelId);
                actualFieldKey = englishFieldName || fieldKey;
                
                console.log('[UnifiedDataCore] 🔄 字段名映射:', {
                    original: fieldKey,
                    english: englishFieldName,
                    actual: actualFieldKey
                });
            }

            // 获取当前面板数据
            const panelData = await this.getPanelData(panelId) || {};
            
            // 🔧 添加详细调试信息
            console.log('[UnifiedDataCore] 🔍 面板数据获取结果:', {
                panelId,
                chatId,
                panelDataExists: !!panelData,
                panelDataKeys: Object.keys(panelData),
                panelDataSize: Object.keys(panelData).length,
                searchingFor: actualFieldKey
            });
            
            // 检查字段是否存在
            if (!(actualFieldKey in panelData)) {
                console.warn('[UnifiedDataCore] ⚠️ 字段不存在:', actualFieldKey);
                console.log('[UnifiedDataCore] 🔍 可用字段:', Object.keys(panelData));
                
                // 🔧 尝试从缓存数据中获取（作为备选方案）
                const cachedData = this.chatDataCache?.get(chatId);
                if (cachedData && cachedData.infobar_data && cachedData.infobar_data.panels) {
                    const cachedPanelData = cachedData.infobar_data.panels[panelId];
                    console.log('[UnifiedDataCore] 🔍 缓存中的面板数据:', {
                        exists: !!cachedPanelData,
                        keys: cachedPanelData ? Object.keys(cachedPanelData) : [],
                        hasTargetField: cachedPanelData ? (actualFieldKey in cachedPanelData) : false
                    });
                }
                
                return true; // 字段不存在视为删除成功
            }

            const oldValue = panelData[actualFieldKey];

            // 删除字段
            delete panelData[actualFieldKey];

            // 保存更新后的面板数据（删除操作需跳过合并，直接覆盖写回）
            await this.writePanelDataWithoutMerge(chatId, panelId, panelData);

            console.log('[UnifiedDataCore] ✅ 面板字段删除成功:', {
                panelId,
                originalFieldKey: fieldKey,
                actualFieldKey,
                oldValue
            });

            // 🚀 全面清理相关数据存储位置
            await this.comprehensiveDataCleanup(chatId, panelId, actualFieldKey, oldValue);

            // 触发数据更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:updated', {
                    panelId,
                    fieldKey: actualFieldKey,
                    originalFieldKey: fieldKey,
                    action: 'delete',
                    oldValue,
                    timestamp: Date.now()
                });
            }

            return true;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 删除面板字段失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🆕 删除多行面板的指定行
     * @param {string} panelId
     * @param {number} rowIndex - 0-based
     */
    async deletePanelRow(panelId, rowIndex) {
        try {
            const chatId = this.getCurrentChatId();
            if (!chatId) throw new Error('当前聊天ID未找到');

            let panelData = await this.getPanelData(panelId);
            if (!Array.isArray(panelData)) {
                // 兼容：对象型按数字键处理
                if (panelData && typeof panelData === 'object') {
                    const keys = Object.keys(panelData).filter(k => /^\d+$/.test(k)).sort((a,b)=>parseInt(a)-parseInt(b));
                    if (keys.length > 0) {
                        const arr = keys.map(k => panelData[k]);
                        panelData = arr;
                    } else {
                        // 单行：清空
                        await this.writePanelDataWithoutMerge(chatId, panelId, {});
                        return true;
                    }
                } else {
                    return true;
                }
            }

            if (rowIndex < 0 || rowIndex >= panelData.length) return true;

            // 删除该行
            panelData.splice(rowIndex, 1);

            // 写回
            await this.writePanelDataWithoutMerge(chatId, panelId, panelData);

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('panel_row_deleted', {
                    panelId,
                    rowIndex,
                    timestamp: Date.now()
                });
            }

            return true;
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 删除面板行失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🆕 删除多行面板指定行的字段
     */
    async deletePanelRowField(panelId, rowIndex, fieldName) {
        try {
            const chatId = this.getCurrentChatId();
            if (!chatId) throw new Error('当前聊天ID未找到');

            const englishFieldName = this.getEnglishFieldName(fieldName, panelId);
            const actualFieldName = englishFieldName || fieldName;

            let panelData = await this.getPanelData(panelId);
            if (!Array.isArray(panelData)) return true; // 非多行，交由 deletePanelField 处理

            if (!panelData[rowIndex]) return true;
            const oldValue = panelData[rowIndex][actualFieldName];
            if (oldValue === undefined) return true;

            delete panelData[rowIndex][actualFieldName];
            await this.writePanelDataWithoutMerge(chatId, panelId, panelData);

            if (this.eventSystem) {
                this.eventSystem.emit('panel_row_field_deleted', {
                    panelId,
                    rowIndex,
                    fieldName: actualFieldName,
                    timestamp: Date.now()
                });
            }

            return true;
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 删除多行面板字段失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🔧 新增：删除面板数据
     * @param {string} panelId - 面板ID
     */
    async deletePanelData(panelId) {
        try {
            console.log('[UnifiedDataCore] 🗂️ 删除面板数据:', panelId);

            // 获取当前聊天ID
            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('当前聊天ID未找到');
            }

            // 删除整个面板数据：直接覆盖为空对象，跳过合并
            await this.writePanelDataWithoutMerge(chatId, panelId, {});

            console.log('[UnifiedDataCore] ✅ 面板数据删除成功:', panelId);

            // 🚀 全面清理整个面板的相关数据存储位置
            await this.comprehensiveDataCleanup(chatId, panelId, null, null, 'panel');

            // 触发数据更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:updated', {
                    panelId,
                    action: 'clear',
                    timestamp: Date.now()
                });
            }

            return true;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 删除面板数据失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🛠️ 仅内部使用：直接写回面板数据，跳过合并流程（用于删除/清空等场景）
     * @param {string} chatId
     * @param {string} panelId
     * @param {Object} panelData
     */
    async writePanelDataWithoutMerge(chatId, panelId, panelData) {
        try {
            const panelKey = `panels.${chatId}.${panelId}`;

            // 1) 直接写回 chatMetadata 对应 panels.<chatId>.<panelId>
            await this.chatMetadata.set(panelKey, panelData);

            // 2) 同步更新内存 Map（保持与旧逻辑一致）
            if (this.data instanceof Map) {
                this.data.set(panelId, panelData);
            }

            // 3) 同步更新 chat_<chatId>.infobar_data.panels
            const chatDataKey = `chat_${chatId}`;
            const chatData = this.chatMetadata.get(chatDataKey) || {};
            if (!chatData.infobar_data) {
                chatData.infobar_data = { panels: {}, history: [], lastUpdated: 0 };
            }
            if (!chatData.infobar_data.panels) {
                chatData.infobar_data.panels = {};
            }
            chatData.infobar_data.panels[panelId] = panelData;
            chatData.infobar_data.lastUpdated = Date.now();
            await this.chatMetadata.set(chatDataKey, chatData);

            // 4) 刷新当前聊天缓存
            this.chatDataCache.set(chatId, chatData);

            console.log('[UnifiedDataCore] ✅ 面板数据已直接写回(无合并):', {
                panelId,
                keys: Object.keys(panelData),
                size: Object.keys(panelData).length
            });
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 直接写回面板数据失败:', error);
            throw error;
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

            // 🔧 修复：优先从缓存获取数据
            const cachedData = this.chatDataCache?.get(chatId);
            if (cachedData && cachedData.infobar_data && cachedData.infobar_data.panels) {
                const cachedPanelData = cachedData.infobar_data.panels[panelId];
                if (cachedPanelData && typeof cachedPanelData === 'object') {
                    console.log('[UnifiedDataCore] 📊 从缓存获取面板数据:', {
                        panelId,
                        keys: Object.keys(cachedPanelData),
                        size: Object.keys(cachedPanelData).length
                    });
                    return cachedPanelData;
                }
            }

            // 如果缓存中没有，从chatMetadata获取
            const panelKey = `panels.${chatId}.${panelId}`;
            const metadataData = await this.getData(panelKey, 'chat');
            
            console.log('[UnifiedDataCore] 📊 从chatMetadata获取面板数据:', {
                panelId,
                exists: !!metadataData,
                keys: metadataData ? Object.keys(metadataData) : [],
                size: metadataData ? Object.keys(metadataData).length : 0
            });
            
            return metadataData;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取面板数据失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：获取当前启用的面板列表
     * @returns {Array} 启用的面板ID列表
     */
    async getEnabledPanelsList() {
        try {
            // 获取配置管理器
            const infoBarTool = window.SillyTavernInfobar;
            const configManager = infoBarTool?.modules?.configManager;

            if (!configManager) {
                console.warn('[UnifiedDataCore] 配置管理器不可用，返回默认面板列表');
                // 返回默认的基础面板列表
                return ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];
            }

            // 基础面板列表
            const basePanels = ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];

            // 检查每个基础面板是否启用
            const enabledPanels = [];
            for (const panelId of basePanels) {
                try {
                    const panelConfig = await configManager.getConfig(panelId);
                    // 如果配置不存在或者enabled不是false，则认为是启用的
                    if (!panelConfig || panelConfig.enabled !== false) {
                        enabledPanels.push(panelId);
                    }
                } catch (error) {
                    // 如果获取配置失败，默认认为是启用的
                    enabledPanels.push(panelId);
                }
            }

            // 🔧 强制策略：总是尝试数据扫描检测自定义面板（无论配置是否可用）
            console.log('[UnifiedDataCore] 🔧 开始数据扫描策略检测自定义面板...');
            
            const chatId = this.getCurrentChatId();
            if (chatId) {
                try {
                    const allChatData = await this.getAllData('chat');
                    
                    // 🔧 修复：更强健的角色ID获取逻辑
                    let characterId = null;
                    try {
                        // 方式1: 直接访问全局变量
                        if (typeof window !== 'undefined' && window.this_chid !== undefined && window.this_chid !== null) {
                            characterId = String(window.this_chid);
                            console.log('[UnifiedDataCore] 🔍 通过this_chid获取角色ID:', characterId);
                        }
                    } catch (e) {
                        console.warn('[UnifiedDataCore] 无法通过this_chid获取角色ID:', e);
                    }
                    
                    // 方式2: 从数据键名中推断角色ID（更强健的模式匹配）
                    if (!characterId) {
                        const panelKeyPattern = /^panels\.(\d+)\./;
                        for (const key of Object.keys(allChatData)) {
                            const match = key.match(panelKeyPattern);
                            if (match) {
                                characterId = match[1];
                                console.log('[UnifiedDataCore] 🔍 通过数据键推断角色ID:', characterId, '来源键:', key);
                                break;
                            }
                        }
                    }
                    
                    const chatPrefix = `panels.${chatId}.`;
                    const characterPrefix = characterId !== null ? `panels.${characterId}.` : null;
                    
                    // 扫描所有面板数据，找到自定义面板
                    const detectedCustomPanels = [];
                    for (const [key, value] of Object.entries(allChatData)) {
                        let panelName = null;
                        
                        if (key.startsWith(chatPrefix)) {
                            panelName = key.substring(chatPrefix.length);
                        } else if (characterPrefix && key.startsWith(characterPrefix)) {
                            panelName = key.substring(characterPrefix.length);
                        }
                        
                        // 如果是非基础面板且有数据，认为是自定义面板
                        if (panelName && !panelName.includes('.') && !basePanels.includes(panelName) && 
                            value && typeof value === 'object' && Object.keys(value).length > 0) {
                            detectedCustomPanels.push(panelName);
                        }
                    }
                    
                    // 添加检测到的自定义面板
                    enabledPanels.push(...detectedCustomPanels);
                    console.log('[UnifiedDataCore] 🔍 通过数据扫描检测到自定义面板:', detectedCustomPanels);
                    
                } catch (error) {
                    console.warn('[UnifiedDataCore] 数据扫描检测自定义面板失败:', error);
                }
            }
            
            // 🔧 兜底策略：尝试传统配置获取（如果配置管理器可用）
            try {
                const customPanels = await configManager.getConfig('customPanels');
                if (customPanels && typeof customPanels === 'object') {
                    console.log('[UnifiedDataCore] 🔧 传统配置获取到自定义面板:', Object.keys(customPanels));
                    for (const [panelId, config] of Object.entries(customPanels)) {
                        if (config && config.enabled !== false && !enabledPanels.includes(panelId)) {
                            enabledPanels.push(panelId);
                        }
                    }
                }
            } catch (configError) {
                console.warn('[UnifiedDataCore] 传统配置获取失败，已通过数据扫描补偿:', configError.message);
            }

            console.log('[UnifiedDataCore] 📋 最终启用面板列表:', `(${enabledPanels.length})`, enabledPanels);
            return enabledPanels;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取启用面板列表失败:', error);
            // 返回默认的基础面板列表作为后备
            return ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];
        }
    }

    /**
     * 🆕 获取所有记忆数据（用于STScript同步）
     * @returns {Object} 所有面板的记忆数据
     */
    async getMemoryData() {
        try {
            const chatId = this.getCurrentChatId();
            if (!chatId) return {};

            // 🔧 修复：获取当前启用的面板列表，只返回启用面板的数据
            const enabledPanels = await this.getEnabledPanelsList();
            if (!enabledPanels || enabledPanels.length === 0) {
                console.log('[UnifiedDataCore] ℹ️ 没有启用的面板');
                return {};
            }

            // 获取所有聊天数据
            const allChatData = await this.getAllData('chat');
            const panelsData = {};

            // 查找所有面板数据 - 支持两种存储格式
            // 格式1: panels.chatId.panelName (旧格式)
            // 格式2: panels.characterId.panelName (新格式，从日志中发现)

            const chatPrefix = `panels.${chatId}.`;

            // 尝试获取当前角色ID - 支持多种方式
            let characterId = null;
            try {
                // 方式1: 直接访问全局变量
                if (typeof window !== 'undefined' && window.this_chid !== undefined) {
                    characterId = window.this_chid;
                }
                // 方式2: 从数据键名中推断角色ID
                else {
                    // 查找 panels.数字.xxx 格式的键名来推断角色ID
                    for (const key of Object.keys(allChatData)) {
                        const match = key.match(/^panels\.(\d+)\./);
                        if (match) {
                            characterId = match[1];
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('[UnifiedDataCore] 无法获取角色ID:', e.message);
            }

            const characterPrefix = characterId !== null ? `panels.${characterId}.` : null;

            for (const [key, value] of Object.entries(allChatData)) {
                let panelName = null;

                // 检查聊天ID格式
                if (key.startsWith(chatPrefix)) {
                    panelName = key.substring(chatPrefix.length);
                }
                // 检查角色ID格式
                else if (characterPrefix && key.startsWith(characterPrefix)) {
                    panelName = key.substring(characterPrefix.length);
                }

                // 🔧 修复：只包含启用的面板数据
                if (panelName && !panelName.includes('.') && enabledPanels.includes(panelName)) {
                    panelsData[panelName] = value;
                }
            }

            console.log('[UnifiedDataCore] 📊 获取记忆数据:', `(${Object.keys(panelsData).length})`, Object.keys(panelsData));
            console.log('[UnifiedDataCore] 🔍 使用的前缀:', { chatPrefix, characterPrefix });
            console.log('[UnifiedDataCore] 🔧 启用的面板:', `(${enabledPanels.length})`, enabledPanels);
            return panelsData;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取记忆数据失败:', error);
            return {};
        }
    }

    /**
     * 🆕 获取所有面板数据（别名方法，兼容性）
     * @returns {Object} 所有面板数据
     */
    async getAllPanelData() {
        return await this.getMemoryData();
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
     * 🔄 获取字段名（现在使用中文键名作为主键）
     * @param {string} fieldName - 字段名（中文或英文）
     * @param {string} panelId - 面板ID
     * @returns {string|null} 标准化的中文字段名
     */
    getChineseFieldName(fieldName, panelId) {
        try {
            // 获取完整的字段映射表
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (!infoBarSettings) {
                console.warn('[UnifiedDataCore] ⚠️ InfoBarSettings 不可用');
                return fieldName; // 直接返回原字段名
            }

            const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();

            // 首先在指定面板中查找
            if (panelId && completeMapping[panelId]) {
                // 如果字段名已经存在于映射中（作为键），直接返回
                if (completeMapping[panelId][fieldName]) {
                    return fieldName;
                }

                // 如果是英文字段名，尝试找到对应的中文名
                for (const [chineseName, displayName] of Object.entries(completeMapping[panelId])) {
                    if (displayName === fieldName) {
                        console.log('[UnifiedDataCore] 🎯 找到字段映射:', fieldName, '->', chineseName);
                        return chineseName;
                    }
                }
            }

            // 如果在指定面板中没找到，在所有面板中查找
            for (const [panelKey, panelMapping] of Object.entries(completeMapping)) {
                if (panelMapping && typeof panelMapping === 'object') {
                    // 检查是否已经是中文键名
                    if (panelMapping[fieldName]) {
                        return fieldName;
                    }

                    // 尝试从英文名找到中文名
                    for (const [chineseName, displayName] of Object.entries(panelMapping)) {
                        if (displayName === fieldName) {
                            console.log('[UnifiedDataCore] 🎯 在面板', panelKey, '中找到字段映射:', fieldName, '->', chineseName);
                            return chineseName;
                        }
                    }
                }
            }

            console.log('[UnifiedDataCore] ℹ️ 未找到字段映射，使用原字段名:', fieldName);
            return fieldName; // 如果找不到映射，返回原字段名

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取中文字段名失败:', error);
            return fieldName; // 出错时返回原字段名
        }
    }

    /**
     * 🔄 获取英文字段名（从中文字段名映射到英文键名）
     * @param {string} chineseDisplayName - 中文字段名
     * @param {string} panelId - 面板ID
     * @returns {string|null} 对应的英文字段键名
     */
    getEnglishFieldName(chineseDisplayName, panelId) {
        try {
            // 获取完整的字段映射表
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;
            if (!infoBarSettings) {
                console.warn('[UnifiedDataCore] ⚠️ InfoBarSettings 不可用');
                return chineseDisplayName; // 直接返回原字段名
            }

            const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();

            // 首先在指定面板中查找
            if (panelId && completeMapping[panelId]) {
                // 查找中文字段名对应的英文键名
                for (const [englishKey, chineseDisplayName_mapped] of Object.entries(completeMapping[panelId])) {
                    if (chineseDisplayName_mapped === chineseDisplayName) {
                        return englishKey; // 返回英文键名
                    }
                }
            }

            // 如果在指定面板中没找到，在所有面板中搜索
            for (const [panelKey, panelMapping] of Object.entries(completeMapping)) {
                if (panelMapping && typeof panelMapping === 'object') {
                    for (const [englishKey, chineseDisplayName_mapped] of Object.entries(panelMapping)) {
                        if (chineseDisplayName_mapped === chineseDisplayName) {
                            return englishKey; // 返回英文键名
                        }
                    }
                }
            }

            // 如果都没找到，检查是否已经是英文键名
            if (panelId && completeMapping[panelId] && completeMapping[panelId][chineseDisplayName]) {
                return chineseDisplayName; // 已经是英文键名
            }

            console.warn(`[UnifiedDataCore] ⚠️ 无法映射中文字段名到英文: ${panelId}.${chineseDisplayName}`);
            return null;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 获取英文字段名失败:', error);
            return chineseDisplayName; // 出错时返回原字段名
        }
    }

    /**
     * 🚀 全面数据清理：删除字段/面板时清理所有相关的数据存储位置
     * @param {string} chatId - 聊天ID
     * @param {string} panelId - 面板ID
     * @param {string} fieldKey - 字段键（可选，为null时清理整个面板）
     * @param {*} oldValue - 旧值（可选）
     * @param {string} scope - 清理范围：'field' | 'panel'
     */
    async comprehensiveDataCleanup(chatId, panelId, fieldKey = null, oldValue = null, scope = 'field') {
        try {
            console.log('[UnifiedDataCore] 🧹 开始全面数据清理:', { chatId, panelId, fieldKey, scope });

            // 1. 清理字段历史记录
            await this.cleanupFieldHistory(chatId, panelId, fieldKey, scope);

            // 2. 清理STScript变量缓存（智能提示词使用）
            await this.cleanupSTScriptVariables(chatId, panelId, fieldKey, scope);

            // 3. 清理AI数据暴露缓存
            await this.cleanupAIDataExposure(panelId, fieldKey, scope);

            // 4. 清理消息渲染缓存
            await this.cleanupMessageRendererCache(chatId, panelId, scope);

            // 5. 清理前端显示缓存
            await this.cleanupFrontendDisplayCache(chatId, panelId, scope);

            // 6. 清理模块缓存
            await this.cleanupModuleCaches(chatId, panelId, fieldKey, scope);

            console.log('[UnifiedDataCore] ✅ 全面数据清理完成:', { panelId, fieldKey, scope });

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 全面数据清理失败:', error);
            // 不抛出错误，避免影响主删除流程
        }
    }

    /**
     * 🧹 清理字段历史记录
     */
    async cleanupFieldHistory(chatId, panelId, fieldKey, scope) {
        try {
            if (scope === 'panel') {
                // 清理整个面板的历史记录
                const historyPattern = `${panelId}:`;
                if (this.fieldHistory) {
                    const keysToDelete = [];
                    for (const [key] of this.fieldHistory.entries()) {
                        if (key.startsWith(historyPattern)) {
                            keysToDelete.push(key);
                        }
                    }
                    keysToDelete.forEach(key => this.fieldHistory.delete(key));
                    console.log('[UnifiedDataCore] 🧹 已清理面板历史记录:', keysToDelete.length, '条');
                }
            } else if (fieldKey) {
                // 清理特定字段的历史记录
                const historyKey = `${panelId}:${fieldKey}`;
                if (this.fieldHistory && this.fieldHistory.has(historyKey)) {
                    this.fieldHistory.delete(historyKey);
                    console.log('[UnifiedDataCore] 🧹 已清理字段历史记录:', historyKey);
                }
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理字段历史记录失败:', error);
        }
    }

    /**
     * 🧹 清理STScript变量缓存（智能提示词使用）
     */
    async cleanupSTScriptVariables(chatId, panelId, fieldKey, scope) {
        try {
            // 清理全局infobar变量
            if (window.SillyTavernInfobar?.modules?.stScriptDataSync) {
                const stScript = window.SillyTavernInfobar.modules.stScriptDataSync;
                if (stScript.clearCache) {
                    await stScript.clearCache();
                    console.log('[UnifiedDataCore] 🧹 已清理STScript变量缓存');
                }
            }

            // 清理特定的变量缓存
            if (window.infobar_data) {
                if (scope === 'panel') {
                    delete window.infobar_data[panelId];
                } else if (fieldKey && window.infobar_data[panelId]) {
                    delete window.infobar_data[panelId][fieldKey];
                }
                console.log('[UnifiedDataCore] 🧹 已清理全局infobar_data变量');
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理STScript变量失败:', error);
        }
    }

    /**
     * 🧹 清理AI数据暴露缓存
     */
    async cleanupAIDataExposure(panelId, fieldKey, scope) {
        try {
            if (window.SillyTavernInfobar?.modules?.aiDataExposure) {
                const aiDataExposure = window.SillyTavernInfobar.modules.aiDataExposure;
                if (aiDataExposure.clearCache) {
                    await aiDataExposure.clearCache();
                    console.log('[UnifiedDataCore] 🧹 已清理AI数据暴露缓存');
                }
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理AI数据暴露缓存失败:', error);
        }
    }

    /**
     * 🧹 清理消息渲染缓存
     */
    async cleanupMessageRendererCache(chatId, panelId, scope) {
        try {
            if (window.SillyTavernInfobar?.modules?.messageInfoBarRenderer) {
                const renderer = window.SillyTavernInfobar.modules.messageInfoBarRenderer;
                if (renderer.clearCache) {
                    await renderer.clearCache();
                }
                console.log('[UnifiedDataCore] 🧹 已清理消息渲染缓存');
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理消息渲染缓存失败:', error);
        }
    }

    /**
     * 🧹 清理前端显示缓存
     */
    async cleanupFrontendDisplayCache(chatId, panelId, scope) {
        try {
            if (window.SillyTavernInfobar?.modules?.frontendDisplayManager) {
                const frontendManager = window.SillyTavernInfobar.modules.frontendDisplayManager;
                if (frontendManager.clearCache) {
                    await frontendManager.clearCache();
                }
                console.log('[UnifiedDataCore] 🧹 已清理前端显示缓存');
            }
        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理前端显示缓存失败:', error);
        }
    }

    /**
     * 🧹 清理模块缓存
     */
    async cleanupModuleCaches(chatId, panelId, fieldKey, scope) {
        try {
            // 清理智能提示词系统缓存
            if (window.SillyTavernInfobar?.modules?.smartPromptSystem) {
                const smartPrompt = window.SillyTavernInfobar.modules.smartPromptSystem;
                if (smartPrompt.clearCache) {
                    await smartPrompt.clearCache();
                }
                console.log('[UnifiedDataCore] 🧹 已清理智能提示词缓存');
            }

            // 清理数据表格缓存
            if (window.SillyTavernInfobar?.modules?.dataTable) {
                const dataTable = window.SillyTavernInfobar.modules.dataTable;
                if (dataTable.clearCache) {
                    await dataTable.clearCache();
                }
                console.log('[UnifiedDataCore] 🧹 已清理数据表格缓存');
            }

            // 清理HTML模板解析器缓存
            if (window.SillyTavernInfobar?.modules?.htmlTemplateParser) {
                const templateParser = window.SillyTavernInfobar.modules.htmlTemplateParser;
                if (templateParser.clearCache) {
                    await templateParser.clearCache();
                }
                console.log('[UnifiedDataCore] 🧹 已清理模板解析器缓存');
            }

            // 🔧 新增：清理AI记忆数据库和快照（修复数据一致性问题）
            await this.cleanupAIMemoryAndSnapshots(chatId, panelId, fieldKey, scope);

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理模块缓存失败:', error);
        }
    }

    /**
     * 🔧 新增：清理AI记忆数据和数据快照（修复数据一致性问题）
     */
    async cleanupAIMemoryAndSnapshots(chatId, panelId, fieldKey, scope) {
        try {
            console.log('[UnifiedDataCore] 🧠 开始清理AI记忆数据和快照...', { chatId, panelId, fieldKey, scope });

            // 1. 清理AI记忆数据库
            if (window.SillyTavernInfobar?.modules?.aiMemoryDatabaseInjector) {
                const aiMemoryDB = window.SillyTavernInfobar.modules.aiMemoryDatabaseInjector;
                if (scope === 'panel' && typeof aiMemoryDB.clearMemoryDatabase === 'function') {
                    // 面板级别清理：清空整个记忆数据库
                    const cleared = aiMemoryDB.clearMemoryDatabase();
                    console.log('[UnifiedDataCore] 🧠 已清理AI记忆数据库:', cleared ? '✅ 成功' : '❌ 失败');
                } else if (scope === 'field' && typeof aiMemoryDB.clearMemoryByField === 'function') {
                    // 字段级别清理：尝试清理特定字段相关记忆
                    await aiMemoryDB.clearMemoryByField(panelId, fieldKey);
                    console.log('[UnifiedDataCore] 🧠 已清理字段相关AI记忆');
                }
            }

            // 2. 清理AI总结缓存
            if (window.SillyTavernInfobar?.modules?.aiMemorySummarizer) {
                const aiSummarizer = window.SillyTavernInfobar.modules.aiMemorySummarizer;
                if (aiSummarizer.summaryCache && scope === 'panel') {
                    // 面板级别：清空总结缓存
                    aiSummarizer.summaryCache.clear();
                    console.log('[UnifiedDataCore] 🧠 已清理AI总结缓存');
                }
            }

            // 3. 清理向量化记忆检索索引
            if (window.SillyTavernInfobar?.modules?.vectorizedMemoryRetrieval) {
                const vectorRetrieval = window.SillyTavernInfobar.modules.vectorizedMemoryRetrieval;
                if (scope === 'panel') {
                    // 面板级别：重建索引
                    if (vectorRetrieval.vectorIndex) {
                        vectorRetrieval.vectorIndex = [];
                        console.log('[UnifiedDataCore] 🧠 已清理向量索引');
                    }
                    if (vectorRetrieval.memoryIndex) {
                        vectorRetrieval.memoryIndex.clear();
                        console.log('[UnifiedDataCore] 🧠 已清理记忆索引');
                    }
                    // 触发索引重建
                    if (typeof vectorRetrieval.buildMemoryIndex === 'function') {
                        setTimeout(() => {
                            vectorRetrieval.buildMemoryIndex().catch(err => {
                                console.warn('[UnifiedDataCore] ⚠️ 重建记忆索引失败:', err);
                            });
                        }, 1000);
                        console.log('[UnifiedDataCore] 🧠 已安排记忆索引重建');
                    }
                }
            }

            // 4. 清理深度记忆管理数据
            if (window.SillyTavernInfobar?.modules?.deepMemoryManager) {
                const deepMemory = window.SillyTavernInfobar.modules.deepMemoryManager;
                if (scope === 'panel' && typeof deepMemory.clearAllMemories === 'function') {
                    await deepMemory.clearAllMemories();
                    console.log('[UnifiedDataCore] 🧠 已清理深度记忆管理数据');
                } else if (scope === 'panel' && deepMemory.memoryCache) {
                    // 清理深度记忆缓存
                    deepMemory.memoryCache.clear();
                    console.log('[UnifiedDataCore] 🧠 已清理深度记忆缓存');
                }
            }

            // 5. 清理数据快照
            if (window.SillyTavernInfobar?.modules?.dataSnapshotManager) {
                const snapshotManager = window.SillyTavernInfobar.modules.dataSnapshotManager;
                if (scope === 'panel' && typeof snapshotManager.clearDataCore === 'function') {
                    await snapshotManager.clearDataCore(chatId);
                    console.log('[UnifiedDataCore] 📸 已清理数据快照');
                }
                // 清理快照缓存
                if (snapshotManager.snapshotCache) {
                    snapshotManager.snapshotCache.clear();
                    console.log('[UnifiedDataCore] 📸 已清理快照缓存');
                }
            }

            console.log('[UnifiedDataCore] ✅ AI记忆数据和快照清理完成');

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理AI记忆数据和快照失败:', error);
            // 不抛出错误，避免影响主流程
        }
    }

    /**
     * 🚀 删除NPC的所有数据：完整清理NPC在所有存储位置的数据
     * @param {string} panelId - 面板ID（通常是'interaction'）
     * @param {string} npcId - NPC ID（如'npc0'）
     */
    async deleteNpcCompletely(panelId, npcId) {
        try {
            console.log('[UnifiedDataCore] 🗑️ 开始完整删除NPC数据:', { panelId, npcId });

            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('当前聊天ID未找到');
            }

            // 获取面板数据
            const panelData = await this.getPanelData(panelId) || {};
            const keysToDelete = [];
            const deletedData = {};

            // 找到所有以npcId开头的键
            for (const key in panelData) {
                if (key.startsWith(npcId + '.')) {
                    keysToDelete.push(key);
                    deletedData[key] = panelData[key];
                    delete panelData[key];
                }
            }

            console.log('[UnifiedDataCore] 🔍 找到NPC相关字段:', keysToDelete);

            // 保存更新后的面板数据
            await this.writePanelDataWithoutMerge(chatId, panelId, panelData);

            // 🚀 全面清理NPC相关的所有数据存储位置
            for (const fieldKey of keysToDelete) {
                await this.comprehensiveDataCleanup(chatId, panelId, fieldKey, deletedData[fieldKey], 'field');
            }

            // 🚀 额外清理：移除NPC相关的特定缓存和变量
            await this.cleanupNpcSpecificData(chatId, npcId, deletedData);

            console.log('[UnifiedDataCore] ✅ NPC数据完整删除成功:', { npcId, deletedFields: keysToDelete.length });

            // 触发数据更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:updated', {
                    panelId,
                    action: 'delete_npc',
                    npcId,
                    deletedFields: keysToDelete,
                    timestamp: Date.now()
                });
            }

            return true;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 完整删除NPC数据失败:', error);
            throw error;
        }
    }

    /**
     * 🚀 删除组织的所有数据：完整清理组织在所有存储位置的数据
     * @param {string} panelId - 面板ID（通常是'organization'）
     * @param {string} orgId - 组织ID（如'org0'）
     */
    async deleteOrganizationCompletely(panelId, orgId) {
        try {
            console.log('[UnifiedDataCore] 🗑️ 开始完整删除组织数据:', { panelId, orgId });

            const chatId = this.getCurrentChatId();
            if (!chatId) {
                throw new Error('当前聊天ID未找到');
            }

            // 获取面板数据
            const panelData = await this.getPanelData(panelId) || {};
            const keysToDelete = [];
            const deletedData = {};

            // 找到所有以orgId开头的键
            for (const key in panelData) {
                if (key.startsWith(orgId + '.')) {
                    keysToDelete.push(key);
                    deletedData[key] = panelData[key];
                    delete panelData[key];
                }
            }

            console.log('[UnifiedDataCore] 🔍 找到组织相关字段:', keysToDelete);

            // 保存更新后的面板数据
            await this.writePanelDataWithoutMerge(chatId, panelId, panelData);

            // 🚀 全面清理组织相关的所有数据存储位置
            for (const fieldKey of keysToDelete) {
                await this.comprehensiveDataCleanup(chatId, panelId, fieldKey, deletedData[fieldKey], 'field');
            }

            // 🚀 额外清理：移除组织相关的特定缓存和变量
            await this.cleanupOrganizationSpecificData(chatId, orgId, deletedData);

            console.log('[UnifiedDataCore] ✅ 组织数据完整删除成功:', { orgId, deletedFields: keysToDelete.length });

            // 触发数据更新事件
            if (this.eventSystem) {
                this.eventSystem.emit('data:updated', {
                    panelId,
                    action: 'delete_organization',
                    orgId,
                    deletedFields: keysToDelete,
                    timestamp: Date.now()
                });
            }

            return true;

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 完整删除组织数据失败:', error);
            throw error;
        }
    }

    /**
     * 🧹 清理NPC特定的数据和缓存
     */
    async cleanupNpcSpecificData(chatId, npcId, deletedData) {
        try {
            // 清理NPC数据库模块的缓存
            if (window.SillyTavernInfobar?.modules?.npcDatabaseManager) {
                const npcDB = window.SillyTavernInfobar.modules.npcDatabaseManager;
                if (npcDB.removeNpc) {
                    await npcDB.removeNpc(npcId);
                    console.log('[UnifiedDataCore] 🧹 已从NPC数据库移除:', npcId);
                }
            }

            // 清理STScript中NPC相关的变量
            if (window.infobar_data?.interaction) {
                Object.keys(window.infobar_data.interaction).forEach(key => {
                    if (key.startsWith(npcId + '.')) {
                        delete window.infobar_data.interaction[key];
                    }
                });
                console.log('[UnifiedDataCore] 🧹 已清理STScript中的NPC变量');
            }

            // 清理消息渲染器中的NPC缓存
            if (window.SillyTavernInfobar?.modules?.messageInfoBarRenderer) {
                const renderer = window.SillyTavernInfobar.modules.messageInfoBarRenderer;
                if (renderer.clearNpcCache) {
                    await renderer.clearNpcCache(npcId);
                }
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理NPC特定数据失败:', error);
        }
    }

    /**
     * 🧹 清理组织特定的数据和缓存
     */
    async cleanupOrganizationSpecificData(chatId, orgId, deletedData) {
        try {
            // 清理STScript中组织相关的变量
            if (window.infobar_data?.organization) {
                Object.keys(window.infobar_data.organization).forEach(key => {
                    if (key.startsWith(orgId + '.')) {
                        delete window.infobar_data.organization[key];
                    }
                });
                console.log('[UnifiedDataCore] 🧹 已清理STScript中的组织变量');
            }

            // 清理消息渲染器中的组织缓存
            if (window.SillyTavernInfobar?.modules?.messageInfoBarRenderer) {
                const renderer = window.SillyTavernInfobar.modules.messageInfoBarRenderer;
                if (renderer.clearOrganizationCache) {
                    await renderer.clearOrganizationCache(orgId);
                }
            }

        } catch (error) {
            console.error('[UnifiedDataCore] ❌ 清理组织特定数据失败:', error);
        }
    }
}

