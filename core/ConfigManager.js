/**
 * 配置管理器
 * 
 * 负责管理扩展的所有配置：
 * - 基础设置管理
 * - API配置管理
 * - 面板配置管理
 * - 配置验证和默认值处理
 * - 配置变更通知
 * 
 * @class ConfigManager
 */

export class ConfigManager {
    constructor(dataCore) {
        console.log('[ConfigManager] 🔧 配置管理器初始化开始');
        
        this.dataCore = dataCore;
        
        // 配置缓存
        this.configCache = new Map();
        
        // 配置验证规则
        this.validationRules = {
            // 基础设置验证
            enabled: { type: 'boolean', default: true },
            renderInChat: { type: 'boolean', default: true },
            enableTableRecord: { type: 'boolean', default: true },
            enableMemoryAssist: { type: 'boolean', default: true },
            defaultCollapsed: { type: 'boolean', default: false },
            
            // 提示词插入位置配置验证
            'promptPosition.mode': { 
                type: 'string', 
                enum: ['beforeCharacter', 'afterCharacter', 'atDepthSystem', 'atDepthUser', 'atDepthAssistant'], 
                default: 'afterCharacter' 
            },
            'promptPosition.depth': { type: 'number', min: 0, max: 10, default: 0 },
            
            // API配置验证
            'apiConfig.enabled': { type: 'boolean', default: false },
            'apiConfig.provider': { type: 'string', enum: ['gemini', 'openai', 'localproxy'], default: 'gemini' },
            'apiConfig.format': { type: 'string', enum: ['native', 'compatible'], default: 'native' },
            'apiConfig.endpoint': { type: 'string', default: '' },
            'apiConfig.apiKey': { type: 'string', default: '' },
            'apiConfig.model': { type: 'string', default: '' },
            'apiConfig.temperature': { type: 'number', min: 0, max: 2, default: 0.7 },
            'apiConfig.maxTokens': { type: 'number', min: 1, max: 100000, default: 2000 },
            'apiConfig.retryCount': { type: 'number', min: 0, max: 10, default: 3 },
            'apiConfig.extraPrompt': { type: 'string', default: '' },
            'apiConfig.mergeMessages': { type: 'boolean', default: true },
            'apiConfig.includeWorldBook': { type: 'boolean', default: false },

            // 🆕 世界书配置验证
            'worldBook.source': { type: 'string', enum: ['default', 'manual'], default: 'default' },
            'worldBook.maxCharacters': { type: 'number', min: 0, max: 200000, default: 50000 },
            'worldBook.selectedBooks': { type: 'array', default: [] },
            'worldBook.enabledEntries': { type: 'object', default: {} },
            'worldBook.autoUpdate': { type: 'boolean', default: true },

            // 主题配置验证
            'theme.current': { type: 'string', default: 'default' },
            'theme.custom': { type: 'object', default: {} },
            
            // 前端显示配置验证
            // 默认关闭前端显示（首次安装时为关闭状态）
            'frontendDisplay.enabled': { type: 'boolean', default: false },
            'frontendDisplay.style': { type: 'string', enum: ['left', 'center', 'right'], default: 'center' },
            'frontendDisplay.showAddButtons': { type: 'boolean', default: true },
            'frontendDisplay.animationEnabled': { type: 'boolean', default: true },
            'frontendDisplay.topPanels': { type: 'array', default: [] },
            'frontendDisplay.bottomPanels': { type: 'array', default: [] },
            'frontendDisplay.topSubitems': { type: 'array', default: [] },
            'frontendDisplay.bottomSubitems': { type: 'array', default: [] }
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.getConfig = this.getConfig.bind(this);
        this.setConfig = this.setConfig.bind(this);
    }

    /**
     * 初始化配置管理器
     */
    async init() {
        try {
            console.log('[ConfigManager] 📊 开始初始化配置管理器...');
            
            if (!this.dataCore) {
                throw new Error('数据核心未初始化');
            }
            
            // 加载所有配置到缓存
            await this.loadAllConfigs();
            
            // 验证配置完整性
            await this.validateAllConfigs();
            
            // 🔧 新增：迁移前端显示配置
            await this.migrateFrontendDisplayConfig();

            // 🔧 重要修复：只在第一次使用时初始化预设面板
            // 之后完全由用户控制，不再自动检查和恢复
            await this.ensurePresetPanelsOnce();

            // 🔧 新增：迁移基础面板到自定义面板（会覆盖预设的默认字段）
            await this.migrateBasicPanelsToCustom();

            // 🔧 新增：迁移面板字段的英文key到中文key
            await this.migratePanelFieldKeys();

        // 🔧 新增：迁移用户数据的英文key到中文key
        await this.migrateUserDataKeys();

            this.initialized = true;
            console.log('[ConfigManager] ✅ 配置管理器初始化完成');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载所有配置到缓存
     */
    async loadAllConfigs() {
        try {
            const globalData = await this.dataCore.getAllData('global');
            
            // 将配置加载到缓存
            for (const [key, value] of Object.entries(globalData)) {
                this.configCache.set(key, value);
            }
            
            console.log(`[ConfigManager] 📥 加载了 ${this.configCache.size} 个配置项`);
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 加载配置失败:', error);
            throw error;
        }
    }

    /**
     * 验证所有配置
     */
    async validateAllConfigs() {
        try {
            let fixedCount = 0;
            
            for (const [key, rule] of Object.entries(this.validationRules)) {
                const currentValue = await this.getConfig(key);
                const validatedValue = this.validateSingleConfig(key, currentValue, rule);
                
                if (validatedValue !== currentValue) {
                    await this.setConfig(key, validatedValue);
                    fixedCount++;
                }
            }
            
            if (fixedCount > 0) {
                console.log(`[ConfigManager] 🔧 修复了 ${fixedCount} 个配置项`);
            }
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 验证配置失败:', error);
            throw error;
        }
    }

    /**
     * 验证单个配置项
     */
    validateSingleConfig(key, value, rule) {
        try {
            // 如果值为undefined或null，使用默认值
            if (value === undefined || value === null) {
                return rule.default;
            }
            
            // 类型验证
            if (rule.type) {
                if (rule.type === 'array' && !Array.isArray(value)) {
                    console.warn(`[ConfigManager] ⚠️ 配置项 ${key} 应为数组类型，使用默认值`);
                    return rule.default;
                } else if (rule.type !== 'array' && typeof value !== rule.type) {
                    console.warn(`[ConfigManager] ⚠️ 配置项 ${key} 类型错误，使用默认值`);
                    return rule.default;
                }
            }
            
            // 枚举验证
            if (rule.enum && !rule.enum.includes(value)) {
                console.warn(`[ConfigManager] ⚠️ 配置项 ${key} 值不在允许范围内，使用默认值`);
                return rule.default;
            }
            
            // 数值范围验证
            if (rule.type === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    console.warn(`[ConfigManager] ⚠️ 配置项 ${key} 值过小，使用最小值`);
                    return rule.min;
                }
                if (rule.max !== undefined && value > rule.max) {
                    console.warn(`[ConfigManager] ⚠️ 配置项 ${key} 值过大，使用最大值`);
                    return rule.max;
                }
            }
            
            return value;
            
        } catch (error) {
            console.error(`[ConfigManager] ❌ 验证配置项失败 (${key}):`, error);
            return rule.default;
        }
    }

    /**
     * 获取配置值
     * @param {string} key - 配置键，支持点号分隔的嵌套键
     * @returns {any} 配置值
     */
    async getConfig(key) {
        try {
            // 先检查缓存
            if (this.configCache.has(key)) {
                return this.configCache.get(key);
            }
            
            // 处理嵌套键
            if (key.includes('.')) {
                return await this.getNestedConfig(key);
            }
            
            // 从数据核心获取
            const value = await this.dataCore.getData(key, 'global');
            
            // 更新缓存
            if (value !== undefined) {
                this.configCache.set(key, value);
            }
            
            return value;
            
        } catch (error) {
            console.error(`[ConfigManager] ❌ 获取配置失败 (${key}):`, error);
            this.handleError(error);
            
            // 返回默认值
            const rule = this.validationRules[key];
            return rule ? rule.default : undefined;
        }
    }

    /**
     * 获取嵌套配置
     */
    async getNestedConfig(key) {
        const keys = key.split('.');
        const rootKey = keys[0];
        
        // 获取根对象
        let rootValue = this.configCache.get(rootKey);
        if (!rootValue) {
            rootValue = await this.dataCore.getData(rootKey, 'global');
            if (rootValue) {
                this.configCache.set(rootKey, rootValue);
            }
        }
        
        if (!rootValue || typeof rootValue !== 'object') {
            return undefined;
        }
        
        // 遍历嵌套路径
        let current = rootValue;
        for (let i = 1; i < keys.length; i++) {
            if (current && typeof current === 'object' && keys[i] in current) {
                current = current[keys[i]];
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    /**
     * 设置配置值
     * @param {string} key - 配置键
     * @param {any} value - 配置值
     * @param {boolean} validate - 是否验证配置
     */
    async setConfig(key, value, validate = true) {
        try {
            // 验证配置
            if (validate && this.validationRules[key]) {
                value = this.validateSingleConfig(key, value, this.validationRules[key]);
            }
            
            // 处理嵌套键
            if (key.includes('.')) {
                await this.setNestedConfig(key, value);
            } else {
                // 直接设置
                await this.dataCore.setData(key, value, 'global');
                this.configCache.set(key, value);
            }
            
            // 触发配置变更事件
            if (this.dataCore.eventSystem) {
                this.dataCore.eventSystem.emit('config:changed', {
                    key,
                    value,
                    timestamp: Date.now()
                });
            }
            
            console.log(`[ConfigManager] ✅ 配置已更新: ${key}`);
            
        } catch (error) {
            console.error(`[ConfigManager] ❌ 设置配置失败 (${key}):`, error);
            this.handleError(error);
        }
    }

    /**
     * 设置嵌套配置
     */
    async setNestedConfig(key, value) {
        const keys = key.split('.');
        const rootKey = keys[0];
        
        // 获取根对象
        let rootValue = this.configCache.get(rootKey);
        if (!rootValue) {
            rootValue = await this.dataCore.getData(rootKey, 'global');
        }
        
        // 如果根对象不存在，创建一个
        if (!rootValue || typeof rootValue !== 'object') {
            rootValue = {};
        }
        
        // 深拷贝根对象以避免引用问题
        rootValue = JSON.parse(JSON.stringify(rootValue));
        
        // 遍历并设置嵌套值
        let current = rootValue;
        for (let i = 1; i < keys.length - 1; i++) {
            if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // 设置最终值
        current[keys[keys.length - 1]] = value;
        
        // 保存根对象
        await this.dataCore.setData(rootKey, rootValue, 'global');
        this.configCache.set(rootKey, rootValue);
    }

    /**
     * 删除配置
     * @param {string} key - 配置键
     */
    async deleteConfig(key) {
        try {
            await this.dataCore.deleteData(key, 'global');
            this.configCache.delete(key);
            
            // 触发配置删除事件
            if (this.dataCore.eventSystem) {
                this.dataCore.eventSystem.emit('config:deleted', {
                    key,
                    timestamp: Date.now()
                });
            }
            
            console.log(`[ConfigManager] 🗑️ 配置已删除: ${key}`);
            
        } catch (error) {
            console.error(`[ConfigManager] ❌ 删除配置失败 (${key}):`, error);
            this.handleError(error);
        }
    }

    /**
     * 重置配置到默认值
     * @param {string} key - 配置键，如果为空则重置所有配置
     */
    async resetConfig(key = null) {
        try {
            if (key) {
                // 重置单个配置
                const rule = this.validationRules[key];
                if (rule) {
                    await this.setConfig(key, rule.default, false);
                    console.log(`[ConfigManager] 🔄 配置已重置: ${key}`);
                }
            } else {
                // 重置所有配置
                let resetCount = 0;
                for (const [configKey, rule] of Object.entries(this.validationRules)) {
                    await this.setConfig(configKey, rule.default, false);
                    resetCount++;
                }
                console.log(`[ConfigManager] 🔄 已重置 ${resetCount} 个配置项`);
            }
            
            // 触发配置重置事件
            if (this.dataCore.eventSystem) {
                this.dataCore.eventSystem.emit('config:reset', {
                    key,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 重置配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取所有配置
     */
    async getAllConfigs() {
        try {
            const configs = {};
            
            for (const key of this.configCache.keys()) {
                configs[key] = this.configCache.get(key);
            }
            
            return configs;
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 获取所有配置失败:', error);
            this.handleError(error);
            return {};
        }
    }

    /**
     * 批量设置配置
     * @param {Object} configs - 配置对象
     */
    async setConfigs(configs) {
        try {
            let updateCount = 0;
            
            for (const [key, value] of Object.entries(configs)) {
                await this.setConfig(key, value);
                updateCount++;
            }
            
            console.log(`[ConfigManager] ✅ 批量更新了 ${updateCount} 个配置项`);
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 批量设置配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 导出配置（仅配置信息，不包含业务数据）
     */
    async exportConfigs() {
        try {
            const allConfigs = await this.getAllConfigs();
            const configsOnly = this.filterConfigurationData(allConfigs);
            
            console.log('[ConfigManager] 📤 导出配置项数量:', Object.keys(configsOnly).length);
            
            return {
                timestamp: Date.now(),
                version: '1.0.0',
                type: 'configuration_only',
                configs: configsOnly
            };
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 导出配置失败:', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * 导出全部数据（包含配置和业务数据）
     */
    async exportAllData() {
        try {
            const allConfigs = await this.getAllConfigs();
            
            console.log('[ConfigManager] 📤 导出全部数据项数量:', Object.keys(allConfigs).length);
            
            return {
                timestamp: Date.now(),
                version: '1.0.0',
                type: 'full_data',
                configs: allConfigs
            };
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 导出全部数据失败:', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * 🔧 智能筛选配置数据，排除业务数据
     */
    filterConfigurationData(allData) {
        try {
            const configData = {};
            
            // 配置项的匹配模式
            const configPatterns = [
                /^enabled$/,                    // 主启用开关
                /^renderInChat$/,               // 渲染设置
                /^enableTableRecord$/,          // 表格记录设置
                /^enableMemoryAssist$/,         // 记忆辅助设置
                /^defaultCollapsed$/,           // 默认折叠设置
                // /^apiConfig\./,              // API配置 - 已移除，不导出敏感信息
                /^theme\./,                     // 主题配置
                /^style\./,                     // 样式配置
                /^frontendDisplay\./,           // 前端显示配置（新增：导出全部前端显示相关键）
                /^.*\.enabled$/,                // 各种启用状态
                /^.*\.config$/,                 // 各种配置项
                /^.*\.settings$/,               // 各种设置项
                /^panel_.*$/,                   // 面板配置
                /^field_rules$/,                // 字段规则
                /^panel_rules$/,                // 面板规则
                /^custom_.*$/,                  // 自定义配置
                /^settings_.*$/,                // 基础设置
                /^.*_enabled$/,                 // 启用状态
                /^.*_config$/,                  // 配置项
                /^.*_settings$/,                // 设置项
                /^.*_rules$/                    // 规则配置
            ];
            
            // 排除业务数据和敏感信息的模式
            const dataPatterns = [
                /_data$/,                       // 业务数据
                /_history$/,                    // 历史记录
                /_cache$/,                      // 缓存数据
                /_temp$/,                       // 临时数据
                /_backup$/,                     // 备份数据
                /^data_/,                       // 数据前缀
                /^cache_/,                      // 缓存前缀
                /^temp_/,                       // 临时前缀
                /^backup_/,                     // 备份前缀
                /^apiConfig$/,                  // API配置（敏感信息）
                /summary_settings$/,            // 总结设置（这是配置，不应排除）
                /summary_history$/,             // 总结历史（这是数据，应排除）
                /^.*\.data$/,                   // 数据字段
                /^.*\.history$/,                // 历史字段
                /^.*\.cache$/                   // 缓存字段
            ];
            
            for (const [key, value] of Object.entries(allData)) {
                // 检查是否是数据类型（应排除）
                const isDataType = dataPatterns.some(pattern => pattern.test(key));
                if (isDataType && key !== 'summary_settings') {
                    continue; // 跳过数据类型，但保留总结设置
                }
                
                // 检查是否是配置类型（应保留）
                const isConfigType = configPatterns.some(pattern => pattern.test(key));
                if (isConfigType) {
                    configData[key] = value;
                    continue;
                }
                
                // 特殊处理：复合对象类型的配置
                if (typeof value === 'object' && value !== null) {
                    // 检查对象内容是否包含配置特征
                    const hasConfigFeatures = this.hasConfigurationFeatures(value);
                    if (hasConfigFeatures) {
                        configData[key] = value;
                        continue;
                    }

                    // 深入检查可能的面板配置对象（基础面板 + 自定义面板）
                    // 这些通常存放于根级 `personal/world/interaction/...` 或 `customPanels`
                    if (key === 'customPanels' && typeof value === 'object') {
                        // 直接保留所有自定义面板定义（含子项）
                        configData[key] = value;
                        continue;
                    }

                    // 基础面板：如果对象中包含 subItems 或 prompts 等配置特征，也应导出
                    const maybePanelKeys = ['personal','world','interaction','tasks','organization','news','inventory','abilities','plot','cultivation','fantasy','modern','historical','magic','training'];
                    if (maybePanelKeys.includes(key)) {
                        const panelObj = value || {};
                        if (panelObj && (panelObj.subItems || panelObj.prompts || panelObj.required !== undefined || panelObj.memoryInject !== undefined)) {
                            configData[key] = panelObj;
                            continue;
                        }
                    }
                }
            }
            
            console.log('[ConfigManager] 🔍 配置筛选结果:', {
                totalItems: Object.keys(allData).length,
                configItems: Object.keys(configData).length,
                filteredKeys: Object.keys(configData)
            });
            
            return configData;
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 筛选配置数据失败:', error);
            return allData; // 出错时返回全部数据，确保功能可用
        }
    }

    /**
     * 🔧 检查对象是否包含配置特征
     */
    hasConfigurationFeatures(obj) {
        if (typeof obj !== 'object' || obj === null) return false;
        
        const configKeys = ['enabled', 'config', 'settings', 'apiConfig', 'theme', 'subItems', 'prompts', 'required', 'memoryInject'];
        const keys = Object.keys(obj);
        
        // 如果包含典型的配置键，则认为是配置对象
        return configKeys.some(configKey => 
            keys.some(key => key.includes(configKey))
        );
    }

    /**
     * 导入配置
     * @param {Object} exportData - 导出的配置数据
     */
    async importConfigs(exportData) {
        try {
            if (!exportData || !exportData.configs) {
                throw new Error('无效的配置数据');
            }
            
            await this.setConfigs(exportData.configs);
            
            console.log('[ConfigManager] 📥 配置导入完成');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 导入配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 🔧 导入全部数据（包含配置和业务数据）
     * @param {Object} exportData - 导出的数据
     */
    async importAllData(exportData) {
        try {
            if (!exportData || !exportData.configs) {
                throw new Error('无效的数据文件');
            }
            
            console.log('[ConfigManager] 📥 开始导入全部数据...');
            
            // 导入到本地缓存
            this.configCache.clear();
            for (const [key, value] of Object.entries(exportData.configs)) {
                this.configCache.set(key, value);
            }
            
            // 同步到数据核心
            if (this.dataCore) {
                await this.dataCore.clearAllData('global');
                for (const [key, value] of Object.entries(exportData.configs)) {
                    await this.dataCore.setData(key, value, 'global');
                }
            }
            
            console.log('[ConfigManager] ✅ 全部数据导入完成，共导入', Object.keys(exportData.configs).length, '项');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 导入全部数据失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🔧 清空全部数据
     */
    async clearAllData() {
        try {
            console.log('[ConfigManager] 🗑️ 开始清空全部数据...');
            
            // 清空本地缓存
            const beforeCount = this.configCache.size;
            this.configCache.clear();
            
            // 清空数据核心的全局数据
            if (this.dataCore) {
                await this.dataCore.clearAllData('global');
            }
            
            console.log('[ConfigManager] ✅ 全部数据清空完成，已清空', beforeCount, '项数据');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 清空全部数据失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🔧 新增：获取前端显示配置
     * 提供统一的前端显示配置访问接口
     */
    async getFrontendDisplayConfig() {
        try {
            const config = {
                enabled: await this.getConfig('frontendDisplay.enabled'),
                position: await this.getConfig('frontendDisplay.position'),
                style: await this.getConfig('frontendDisplay.style'),
                showAddButtons: await this.getConfig('frontendDisplay.showAddButtons'),
                animationEnabled: await this.getConfig('frontendDisplay.animationEnabled'),
                maxPanels: await this.getConfig('frontendDisplay.maxPanels'),
                buttonSize: await this.getConfig('frontendDisplay.buttonSize'),
                autoHide: await this.getConfig('frontendDisplay.autoHide'),
                showTooltips: await this.getConfig('frontendDisplay.showTooltips'),
                topPanels: await this.getConfig('frontendDisplay.topPanels'),
                bottomPanels: await this.getConfig('frontendDisplay.bottomPanels'),
                topSubitems: await this.getConfig('frontendDisplay.topSubitems'),
                bottomSubitems: await this.getConfig('frontendDisplay.bottomSubitems')
            };
            
            console.log('[ConfigManager] 📋 获取前端显示配置:', config);
            return config;
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 获取前端显示配置失败:', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * 🔧 新增：保存前端显示配置
     * 提供统一的前端显示配置保存接口
     */
    async saveFrontendDisplayConfig(config) {
        try {
            console.log('[ConfigManager] 💾 保存前端显示配置:', config);
            
            // 逐个保存配置项
            if (config.enabled !== undefined) {
                await this.setConfig('frontendDisplay.enabled', config.enabled);
            }
            if (config.position !== undefined) {
                await this.setConfig('frontendDisplay.position', config.position);
            }
            if (config.style !== undefined) {
                await this.setConfig('frontendDisplay.style', config.style);
            }
            if (config.showAddButtons !== undefined) {
                await this.setConfig('frontendDisplay.showAddButtons', config.showAddButtons);
            }
            if (config.animationEnabled !== undefined) {
                await this.setConfig('frontendDisplay.animationEnabled', config.animationEnabled);
            }
            if (config.maxPanels !== undefined) {
                await this.setConfig('frontendDisplay.maxPanels', config.maxPanels);
            }
            if (config.buttonSize !== undefined) {
                await this.setConfig('frontendDisplay.buttonSize', config.buttonSize);
            }
            if (config.autoHide !== undefined) {
                await this.setConfig('frontendDisplay.autoHide', config.autoHide);
            }
            if (config.showTooltips !== undefined) {
                await this.setConfig('frontendDisplay.showTooltips', config.showTooltips);
            }
            if (config.topPanels !== undefined) {
                await this.setConfig('frontendDisplay.topPanels', config.topPanels);
            }
            if (config.bottomPanels !== undefined) {
                await this.setConfig('frontendDisplay.bottomPanels', config.bottomPanels);
            }
            if (config.topSubitems !== undefined) {
                await this.setConfig('frontendDisplay.topSubitems', config.topSubitems);
            }
            if (config.bottomSubitems !== undefined) {
                await this.setConfig('frontendDisplay.bottomSubitems', config.bottomSubitems);
            }
            
            console.log('[ConfigManager] ✅ 前端显示配置保存完成');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 保存前端显示配置失败:', error);
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 🔧 新增：迁移前端显示配置
     * 将现有的前端显示配置从extensionSettings迁移到ConfigManager
     */
    async migrateFrontendDisplayConfig() {
        try {
            console.log('[ConfigManager] 🔄 开始迁移前端显示配置...');
            
            // 检查是否已经迁移过
            const existingConfig = await this.getConfig('frontendDisplay.enabled');
            if (existingConfig !== undefined) {
                console.log('[ConfigManager] ℹ️ 前端显示配置已存在，跳过迁移');
                return;
            }
            
            // 尝试从SillyTavern扩展设置中读取现有配置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.log('[ConfigManager] ℹ️ 无扩展设置，使用默认配置');
                return;
            }
            
            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            const frontendDisplayConfig = extensionSettings?.frontendDisplay;
            
            if (!frontendDisplayConfig) {
                console.log('[ConfigManager] ℹ️ 无现有前端显示配置，使用默认配置');
                return;
            }
            
            console.log('[ConfigManager] 📦 发现现有前端显示配置，开始迁移:', frontendDisplayConfig);
            
            // 迁移配置到ConfigManager
            await this.saveFrontendDisplayConfig(frontendDisplayConfig);
            
            console.log('[ConfigManager] ✅ 前端显示配置迁移完成');
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 迁移前端显示配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 🔧 获取英文key到中文key的字段映射
     * @param {string} panelKey - 面板key
     * @returns {Map} 英文key到中文key的映射
     */
    getEnglishToChineseFieldMapping(panelKey) {
        // 硬编码的映射表（从DataTable.mapDisplayNameToLegacyField提取）
        const mappings = {
            personal: {
                name: '姓名', age: '年龄', gender: '性别', occupation: '职业',
                height: '身高', weight: '体重', bloodType: '血型', zodiac: '星座',
                birthday: '生日', birthplace: '出生地', nationality: '国籍', ethnicity: '民族',
                hairColor: '发色', hairstyle: '发型', eyeColor: '眼色', skinTone: '肤色',
                bodyType: '体型', facialFeatures: '面部特征', scars: '疤痕', tattoos: '纹身',
                accessories: '饰品', clothingStyle: '服装风格', appearance: '外观描述', voice: '声音特征',
                personality: '性格', temperament: '气质', attitude: '态度', values: '价值观',
                beliefs: '信仰', fears: '恐惧', dreams: '梦想', goals: '目标',
                intelligence: '智力', strength: '体力', charisma: '魅力', luck: '运气',
                perception: '感知', willpower: '意志力', reflexes: '反应速度', learning: '学习能力',
                family: '家庭背景', education: '教育经历', work: '工作经历', income: '收入',
                socialStatus: '社会地位', relationships: '人际关系', romance: '恋爱状态', marriage: '婚姻状态',
                hobbies: '兴趣爱好', sports: '运动', music: '音乐', art: '艺术',
                reading: '阅读', gaming: '游戏', travel: '旅行', cooking: '烹饪',
                skills: '技能特长', languages: '语言能力', lifestyle: '生活习惯', health: '健康状态'
            },
            world: {
                genre: '世界风格', theme: '世界主题', history: '历史', mythology: '神话传说',
                lore: '世界设定', geography: '地理环境', climate: '气候', terrain: '地形地貌',
                biomes: '生物群落', locations: '重要地点', landmarks: '地标建筑', cities: '城市设定',
                dungeons: '地下城', time: '时间', calendar: '历法系统', seasons: '季节变化',
                dayNight: '昼夜循环', weather: '天气', events: '世界事件', festivals: '节日庆典',
                disasters: '自然灾害', cultures: '文化设定', languages: '语言能力', religions: '宗教信仰',
                customs: '风俗习惯', politics: '政治体系', economy: '经济系统', technology: '科技水平',
                magic: '魔法系统', races: '种族设定', creatures: '生物设定', monsters: '怪物设定',
                npcs: 'NPC设定', factions: '势力组织', conflicts: '冲突矛盾', alliances: '联盟关系',
                wars: '战争历史', resources: '资源分布', materials: '材料设定', artifacts: '神器文物',
                currency: '货币系统', trade: '贸易体系', markets: '市场设定', guilds: '公会组织',
                transportation: '交通运输'
            },
            interaction: {
                status: '状态', location: '地理位置', mood: '心情', activity: '活动',
                availability: '可用性', priority: '优先级', relationship: '关系', intimacy: '亲密度',
                trust: '信任度', friendship: '友谊度', romance: '浪漫度', respect: '尊重度',
                dependency: '依赖度', conflict: '冲突度', history: '历史', frequency: '互动频率',
                duration: '互动时长', quality: '互动质量', topics: '话题偏好', emotions: '情感状态',
                milestones: '重要节点', memories: '共同回忆', autoRecord: '自动记录', notifications: '通知设置',
                analysis: '关系分析', suggestions: '建议提示', network: '社交网络', groups: '群体关系',
                influence: '影响力', reputation: '声誉度', alliances: '联盟关系', rivalries: '竞争关系',
                mentorship: '师徒关系', hierarchy: '等级关系', communicationStyle: '沟通风格', preferredTopics: '偏好话题',
                avoidedTopics: '回避话题', boundaries: '边界设定', comfortLevel: '舒适度', energyLevel: '活跃度',
                responseTime: '响应时间', engagement: '参与度', specialEvents: '特殊事件', achievements: '成就记录',
                challenges: '挑战任务', growth: '成长轨迹'
            }
        };

        const mapping = mappings[panelKey] || {};
        const result = new Map();
        for (const [englishKey, chineseKey] of Object.entries(mapping)) {
            result.set(englishKey, chineseKey);
        }
        return result;
    }

    /**
     * 🔧 新增：迁移用户数据的英文key到中文key
     * 将extensionSettings中的英文key数据迁移到中文key
     */
    async migrateUserDataKeys() {
        try {
            console.log('[ConfigManager] 🔄 开始迁移用户数据的英文key到中文key...');

            // 1. 动态导入PresetPanelsManager
            const { PresetPanelsManager } = await import('./PresetPanelsManager.js');
            const presets = PresetPanelsManager.getPresets();

            // 2. 获取用户配置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取扩展设置，跳过迁移');
                return { success: false, message: '无法获取扩展设置' };
            }

            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            if (!extensionSettings) {
                console.warn('[ConfigManager] ⚠️ extensionSettings不存在，跳过迁移');
                return { success: false, message: 'extensionSettings不存在' };
            }

            let totalMigratedKeys = 0;

            // 3. 遍历所有预设面板
            for (const [panelKey, preset] of Object.entries(presets)) {
                // 创建英文key到中文key的映射
                const englishToChinese = new Map();

                preset.subItems.forEach(subItem => {
                    // 检查是否有对应的英文key
                    // 我们需要从DataTable的mapDisplayNameToLegacyField方法中获取映射
                    // 但这里我们直接检查extensionSettings中是否有这个英文key
                    const chineseName = subItem.name;

                    // 尝试常见的英文key模式
                    const possibleEnglishKeys = this.generatePossibleEnglishKeys(chineseName);

                    possibleEnglishKeys.forEach(englishKey => {
                        if (extensionSettings[englishKey] !== undefined) {
                            englishToChinese.set(englishKey, chineseName);
                        }
                    });
                });

                // 4. 执行迁移
                for (const [englishKey, chineseName] of englishToChinese.entries()) {
                    const value = extensionSettings[englishKey];

                    // 将数据迁移到中文key
                    extensionSettings[chineseName] = value;

                    // 删除旧的英文key
                    delete extensionSettings[englishKey];

                    totalMigratedKeys++;
                    console.log(`[ConfigManager] 🔄 迁移数据key: ${englishKey} -> ${chineseName} = "${value}"`);
                }
            }

            // 5. 保存更新后的配置
            if (totalMigratedKeys > 0) {
                if (context.saveSettingsDebounced) {
                    context.saveSettingsDebounced();
                }
                console.log(`[ConfigManager] ✅ 数据key迁移完成: ${totalMigratedKeys}个字段`);
            } else {
                console.log('[ConfigManager] ℹ️ 没有需要迁移的数据key');
            }

            return {
                success: true,
                totalMigratedKeys,
                message: `成功迁移${totalMigratedKeys}个数据key`
            };

        } catch (error) {
            console.error('[ConfigManager] ❌ 迁移用户数据key失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🔧 新增：生成可能的英文key
     * 根据中文字段名生成可能的英文key列表
     * 包含所有15个预设面板的完整映射（623个字段）
     */
    generatePossibleEnglishKeys(chineseName) {
        // 完整的中文到英文映射表
        const mapping = {
            // ========== 1. 个人信息面板 (60个字段) ==========
            '姓名': ['name'],
            '年龄': ['age'],
            '性别': ['gender'],
            '职业': ['occupation'],
            '身高': ['height'],
            '体重': ['weight'],
            '血型': ['bloodType'],
            '星座': ['zodiac'],
            '生日': ['birthday'],
            '出生地': ['birthplace'],
            '国籍': ['nationality'],
            '民族': ['ethnicity'],
            '发色': ['hairColor'],
            '发型': ['hairstyle'],
            '眼色': ['eyeColor'],
            '肤色': ['skinColor'],
            '体型': ['bodyType'],
            '面部特征': ['facialFeatures'],
            '疤痕': ['scars'],
            '纹身': ['tattoos'],
            '饰品': ['accessories'],
            '服装风格': ['clothingStyle'],
            '外观描述': ['appearanceDescription'],
            '声音特征': ['voiceCharacteristics'],
            '性格': ['personality'],
            '气质': ['temperament'],
            '态度': ['attitude'],
            '价值观': ['values'],
            '信仰': ['beliefs'],
            '恐惧': ['fears'],
            '梦想': ['dreams'],
            '目标': ['goals'],
            '智力': ['intelligence'],
            '体力': ['stamina'],
            '魅力': ['charisma'],
            '运气': ['luck'],
            '感知': ['perception'],
            '意志力': ['willpower'],
            '反应速度': ['reactionSpeed'],
            '学习能力': ['learningAbility'],
            '家庭背景': ['familyBackground'],
            '教育经历': ['education'],
            '工作经历': ['workExperience'],
            '收入': ['income'],
            '社会地位': ['socialStatus'],
            '人际关系': ['relationships'],
            '恋爱状态': ['relationshipStatus'],
            '婚姻状态': ['maritalStatus'],
            '兴趣爱好': ['hobbies'],
            '运动': ['sports'],
            '音乐': ['music'],
            '艺术': ['art'],
            '阅读': ['reading'],
            '游戏': ['gaming'],
            '旅行': ['travel'],
            '烹饪': ['cooking'],
            '技能特长': ['skills'],
            '语言能力': ['languages'],
            '生活习惯': ['lifestyle'],
            '健康状态': ['health'],

            // ========== 2. 世界状态面板 (48个字段) ==========
            '世界名称': ['worldName'],
            '世界类型': ['worldType'],
            '世界风格': ['genre'],
            '世界主题': ['theme'],
            '世界历史': ['history'],
            '神话传说': ['mythology'],
            '世界传说': ['lore'],
            '地理环境': ['geography'],
            '气候条件': ['climate'],
            '地形地貌': ['terrain'],
            '生态系统': ['biomes'],
            '重要地点': ['locations'],
            '地标建筑': ['landmarks'],
            '城市城镇': ['cities'],
            '地下城': ['dungeons'],
            '时间设定': ['time'],
            '历法系统': ['calendar'],
            '季节变化': ['seasons'],
            '昼夜循环': ['dayNight'],
            '天气系统': ['weather'],
            '重大事件': ['events'],
            '节日庆典': ['festivals'],
            '灾难危机': ['disasters'],
            '文化体系': ['cultures'],
            '宗教信仰': ['religions'],
            '风俗习惯': ['customs'],
            '政治体系': ['politics'],
            '经济体系': ['economy'],
            '科技水平': ['technology'],
            '魔法体系': ['magic'],
            '种族设定': ['races'],
            '生物设定': ['creatures'],
            '怪物设定': ['monsters'],
            'NPC设定': ['npcs'],
            '势力组织': ['factions'],
            '冲突矛盾': ['conflicts'],
            '联盟关系': ['alliances'],
            '战争历史': ['wars'],
            '资源分布': ['resources'],
            '材料物品': ['materials'],
            '神器宝物': ['artifacts'],
            '货币系统': ['currency'],
            '贸易系统': ['trade'],
            '市场经济': ['markets'],
            '公会组织': ['guilds'],
            '交通运输': ['transportation'],
            '通讯方式': ['communication'],
            '法律制度': ['laws'],

            // ========== 3. 交互对象面板 (57个字段) ==========
            '对象名称': ['name'],
            '对象类型': ['type'],
            '对象状态': ['status'],
            '所在位置': ['location'],
            '当前心情': ['mood'],
            '当前活动': ['activity'],
            '可用性': ['availability'],
            '优先级': ['priority'],
            '关系类型': ['relationship'],
            '亲密度': ['intimacy'],
            '信任度': ['trust'],
            '友谊度': ['friendship'],
            '浪漫度': ['romance'],
            '尊重度': ['respect'],
            '依赖度': ['dependency'],
            '冲突度': ['conflict'],
            '互动频率': ['frequency'],
            '互动时长': ['duration'],
            '互动质量': ['quality'],
            '交流话题': ['topics'],
            '情感状态': ['emotions'],
            '重要里程碑': ['milestones'],
            '共同记忆': ['memories'],
            '自动记录': ['autoRecord'],
            '通知提醒': ['notifications'],
            '关系分析': ['analysis'],
            '互动建议': ['suggestions'],
            '社交网络': ['network'],
            '所属群组': ['groups'],
            '影响力': ['influence'],
            '声誉评价': ['reputation'],
            '竞争关系': ['rivalries'],
            '指导关系': ['mentorship'],
            '层级关系': ['hierarchy'],
            '沟通风格': ['communicationStyle'],
            '偏好话题': ['preferredTopics'],
            '回避话题': ['avoidedTopics'],
            '交往边界': ['boundaries'],
            '舒适度': ['comfortLevel'],
            '精力水平': ['energyLevel'],
            '响应时间': ['responseTime'],
            '参与度': ['engagement'],
            '特殊事件': ['specialEvents'],
            '成就记录': ['achievements'],
            '挑战任务': ['challenges'],
            '成长轨迹': ['growth'],
            '体内物品': ['internalItems'],
            '身体改造': ['bodyModifications'],
            '内衣': ['underwear'],
            '内裤': ['underpants'],
            '衣服': ['clothing'],
            '想法': ['thoughts'],
            '外貌描述': ['appearance'],
            '性格特点': ['personality'],
            '背景故事': ['background'],
            '技能能力': ['abilities'],
            '重要物品': ['items'],

            // ========== 4. 任务系统面板 (48个字段) ==========
            '任务创建': ['creation'],
            '任务编辑': ['editing'],
            '任务删除': ['deletion'],
            '任务完成': ['completion'],
            '截止日期': ['deadline'],
            '任务进度': ['progress'],
            '任务分类': ['categories'],
            '任务标签': ['tags'],
            '所属项目': ['projects'],
            '子任务': ['subtasks'],
            '依赖关系': ['dependencies'],
            '任务模板': ['templates'],
            '循环任务': ['recurring'],
            '提醒设置': ['reminders'],
            '警报通知': ['alerts'],
            '每日总结': ['dailySummary'],
            '每周回顾': ['weeklyReview'],
            '成就徽章': ['achievementBadges'],
            '生产力统计': ['productivityStats'],
            '时间追踪': ['timeTracking'],
            '任务分配': ['assignment'],
            '协作功能': ['collaboration'],
            '评论功能': ['comments'],
            '附件管理': ['attachments'],
            '共享功能': ['sharing'],
            '权限管理': ['permissions'],
            '审批流程': ['approval'],
            '委托功能': ['delegation'],
            '列表视图': ['listView'],
            '看板视图': ['kanbanView'],
            '日历视图': ['calendarView'],
            '甘特图': ['ganttView'],
            '排序功能': ['sorting'],
            '筛选功能': ['filtering'],
            '搜索功能': ['search'],
            '分组功能': ['grouping'],
            '备份功能': ['backup'],
            '导出功能': ['export'],
            '导入功能': ['import'],
            '同步功能': ['sync'],
            '归档功能': ['archive'],
            '版本控制': ['versioning'],
            '恢复功能': ['recovery'],
            '优先级设置': ['prioritySettings'],
            '状态管理': ['statusManagement'],
            '标签管理': ['tagManagement'],
            '分类管理': ['categoryManagement'],
            '模板管理': ['templateManagement'],

            // ========== 5. 组织架构面板 (48个字段) ==========
            '组织名称': ['name'],
            '组织类型': ['type'],
            '组织目的': ['purpose'],
            '成立时间': ['founding'],
            '组织座右铭': ['motto'],
            '部门设置': ['departments'],
            '领导层': ['leadership'],
            '议会': ['council'],
            '职位设置': ['positions'],
            '等级制度': ['ranks'],
            '晋升机制': ['promotion'],
            '权限分配': ['authority'],
            '成员管理': ['members'],
            '招募制度': ['recruitment'],
            '培训体系': ['training'],
            '评估机制': ['evaluation'],
            '奖励制度': ['rewards'],
            '惩罚制度': ['punishment'],
            '福利待遇': ['benefits'],
            '退休制度': ['retirement'],
            '组织规则': ['rules'],
            '行为准则': ['code'],
            '道德规范': ['ethics'],
            '纪律制度': ['discipline'],
            '工作流程': ['procedures'],
            '操作协议': ['protocols'],
            '标准规范': ['standards'],
            '合规要求': ['compliance'],
            '盟友关系': ['allies'],
            '敌对关系': ['enemies'],
            '中立关系': ['neutral'],
            '合作伙伴': ['partnerships'],
            '外交政策': ['diplomacy'],
            '条约协议': ['treaties'],
            '财务管理': ['finances'],
            '资产管理': ['assets'],
            '设施管理': ['facilities'],
            '装备管理': ['equipment'],
            '知识库': ['knowledge'],
            '档案管理': ['archives'],
            '机密信息': ['secrets'],
            '组织文化': ['culture'],
            '组织历史': ['organizationHistory'],
            '组织愿景': ['vision'],
            '组织使命': ['mission'],
            '战略规划': ['strategy'],
            '发展目标': ['developmentGoals'],
            '层级结构': ['hierarchy'],

            // ========== 6. 新闻资讯面板 (48个字段) ==========
            '突发新闻': ['breaking'],
            '社会新闻': ['social'],
            '军事新闻': ['military'],
            '文化新闻': ['culture'],
            '官方新闻': ['official'],
            '媒体报道': ['media'],
            '谣言传闻': ['rumors'],
            '内幕消息': ['insider'],
            '目击报告': ['witness'],
            '泄露信息': ['leaked'],
            '匿名爆料': ['anonymous'],
            '新闻审核': ['review'],
            '新闻发布': ['publishing'],
            '新闻归档': ['archiving'],
            '新闻广播': ['broadcast'],
            '新闻简报': ['newsletter'],
            '新闻摘要': ['digest'],
            '社交媒体': ['socialMedia'],
            '论坛讨论': ['forums'],
            '即时通讯': ['messaging'],
            '电子邮件': ['email'],
            '点赞收藏': ['likes'],
            '书签标记': ['bookmarks'],
            '评分系统': ['ratings'],
            '投票调查': ['polls'],
            '讨论区': ['discussions'],
            '反馈意见': ['feedback'],
            '数据分析': ['analytics'],
            '统计指标': ['metrics'],
            '趋势分析': ['trends'],
            '报告生成': ['reports'],
            '监控系统': ['monitoring'],
            '警报系统': ['alertsSystem'],
            '自动化': ['automation'],
            'AI分析': ['aiAnalysis'],
            '政治新闻': ['politics'],
            '经济新闻': ['economy'],
            '科技新闻': ['technology'],
            '娱乐新闻': ['entertainment'],
            '体育新闻': ['sports'],
            '健康新闻': ['health'],
            '教育新闻': ['education'],
            '环境新闻': ['environment'],
            '国际新闻': ['international'],
            '本地新闻': ['local'],
            '财经新闻': ['financial'],
            '房产新闻': ['realEstate'],
            '汽车新闻': ['automotive'],

            // ========== 7. 物品清单面板 (48个字段) ==========
            '物品名称': ['name'],
            '物品类型': ['type'],
            '物品数量': ['quantity'],
            '物品描述': ['description'],
            '物品存储': ['storage'],
            '物品检索': ['retrieval'],
            '武器装备': ['weapons'],
            '护甲防具': ['armor'],
            '消耗品': ['consumables'],
            '工具道具': ['tools'],
            '书籍文献': ['books'],
            '宝物珍品': ['treasures'],
            '容量限制': ['capacity'],
            '堆叠规则': ['stacking'],
            '扩展功能': ['expansion'],
            '分隔区域': ['compartments'],
            '保护措施': ['protection'],
            '耐久度': ['durability'],
            '修理功能': ['repair'],
            '交易功能': ['trading'],
            '出售功能': ['selling'],
            '购买功能': ['buying'],
            '拍卖功能': ['auction'],
            '赠送功能': ['gifting'],
            '借出功能': ['lending'],
            '银行存储': ['banking'],
            '制作功能': ['crafting'],
            '配方系统': ['recipes'],
            '强化功能': ['enhancement'],
            '附魔功能': ['enchanting'],
            '升级功能': ['upgrading'],
            '合成功能': ['combining'],
            '拆解功能': ['dismantling'],
            '回收功能': ['recycling'],
            'AI分类': ['aiSorting'],
            '推荐系统': ['recommendations'],
            '安全措施': ['security'],
            '物品整理': ['organization'],
            '快速访问': ['quickAccess'],
            '收藏夹': ['favorites'],
            '最近使用': ['recentlyUsed'],
            '物品标签': ['itemTags'],
            '物品分类': ['itemCategories'],
            '物品稀有度': ['rarity'],
            '物品价值': ['value'],
            '物品重量': ['weight'],
            '物品来源': ['source'],
            '获取方式': ['acquisitionMethod'],

            // ========== 8. 能力技能面板 (48个字段) ==========
            '力量': ['strength'],
            '敏捷': ['agility'],
            '体质': ['constitution'],
            '智慧': ['wisdom'],
            '剑术': ['swordsmanship'],
            '箭术': ['archery'],
            '防御': ['defense'],
            '武术': ['martialArts'],
            '潜行': ['stealth'],
            '战术': ['tactics'],
            '治疗': ['healing'],
            '农业': ['farming'],
            '采矿': ['mining'],
            '钓鱼': ['fishing'],
            '狩猎': ['hunting'],
            '谈判': ['negotiation'],
            '研究': ['research'],
            '调查': ['investigation'],
            '医学': ['medicine'],
            '炼金': ['alchemy'],
            '工程': ['engineering'],
            '天文': ['astronomy'],
            '说服': ['persuasion'],
            '欺骗': ['deception'],
            '威吓': ['intimidation'],
            '表演': ['performance'],
            '共情': ['empathy'],
            '洞察': ['insight'],
            '社交': ['networking'],
            '心灵感应': ['telepathy'],
            '念力': ['telekinesis'],
            '预知': ['precognition'],
            '变形': ['shapeshifting'],
            '隐身': ['invisibility'],
            '飞行': ['flight'],
            '再生': ['regeneration'],
            '不朽': ['immortality'],
            '魔法': ['magic'],
            '元素控制': ['elementalControl'],
            '时间操控': ['timeManipulation'],
            '空间操控': ['spaceManipulation'],
            '精神控制': ['mindControl'],
            '能量操控': ['energyManipulation'],
            '物质转化': ['matterTransformation'],
            '召唤术': ['summoning'],
            '驱魔': ['exorcism'],
            '祝福': ['blessing'],
            '诅咒': ['curse'],

            // ========== 9. 剧情发展面板 (48个字段) ==========
            '主线剧情': ['mainStory'],
            '支线任务': ['sideQuests'],
            '子情节': ['subplots'],
            '背景故事': ['backstory'],
            '序幕': ['prologue'],
            '尾声': ['epilogue'],
            '闪回': ['flashbacks'],
            '伏笔': ['foreshadowing'],
            '说明': ['exposition'],
            '上升动作': ['risingAction'],
            '高潮': ['climax'],
            '下降动作': ['fallingAction'],
            '结局': ['resolution'],
            '收尾': ['denouement'],
            '悬念': ['cliffhanger'],
            '转折': ['twist'],
            '角色弧': ['characterArc'],
            '动机': ['motivations'],
            '内部冲突': ['internalConflicts'],
            '外部冲突': ['externalConflicts'],
            '道德困境': ['moralDilemmas'],
            '牺牲': ['sacrifices'],
            '对话': ['dialogue'],
            '叙述': ['narration'],
            '独白': ['monologue'],
            '象征': ['symbolism'],
            '主题': ['themes'],
            '基调': ['tone'],
            '节奏': ['pacing'],
            '选择': ['choices'],
            '后果': ['consequences'],
            '分支': ['branching'],
            '多重结局': ['multipleEndings'],
            '玩家主导': ['playerAgency'],
            '涌现叙事': ['emergentNarrative'],
            '程序生成': ['proceduralGeneration'],
            '自适应叙事': ['adaptiveStorytelling'],
            '时间线': ['timeline'],
            '笔记': ['notes'],
            '存档点': ['saveStates'],
            '自动保存': ['autoSave'],
            '剧情触发': ['plotTriggers'],
            '事件系统': ['eventSystem'],
            '任务链': ['questChains'],
            '剧情分支': ['storyBranches'],
            '结局条件': ['endingConditions'],
            '隐藏剧情': ['hiddenPlots'],
            '彩蛋': ['easterEggs'],

            // ========== 10. 修炼体系面板 (27个字段) ==========
            '炼气期': ['qiRefining'],
            '筑基期': ['foundation'],
            '金丹期': ['goldenCore'],
            '元婴期': ['nascentSoul'],
            '化神期': ['soulTransformation'],
            '炼虚期': ['voidRefinement'],
            '合体期': ['bodyIntegration'],
            '大乘期': ['mahayana'],
            '渡劫期': ['tribulation'],
            '真仙': ['immortal'],
            '玄仙': ['trueImmortal'],
            '金仙': ['goldenImmortal'],
            '呼吸法': ['breathingTechnique'],
            '炼体': ['bodyRefining'],
            '炼魂': ['soulCultivation'],
            '双修': ['dualCultivation'],
            '剑修': ['swordCultivation'],
            '阵法': ['formation'],
            '符箓': ['talisman'],
            '灵力': ['spiritualPower'],
            '灵根': ['spiritualRoot'],
            '经脉': ['meridians'],
            '丹田': ['dantian'],
            '神识': ['divineSense'],
            '寿命': ['lifeSpan'],
            '因果': ['karma'],
            '天道': ['heavenlyDao'],

            // ========== 11. 奇幻设定面板 (48个字段) ==========
            '人类': ['human'],
            '精灵': ['elf'],
            '矮人': ['dwarf'],
            '兽人': ['orc'],
            '龙族': ['dragon'],
            '恶魔': ['demon'],
            '天使': ['angel'],
            '不死族': ['undead'],
            '半身人': ['halfling'],
            '巨人': ['giant'],
            '仙灵': ['fairy'],
            '吸血鬼': ['vampire'],
            '火魔法': ['fireMagic'],
            '水魔法': ['waterMagic'],
            '土魔法': ['earthMagic'],
            '风魔法': ['airMagic'],
            '光魔法': ['lightMagic'],
            '暗魔法': ['darkMagic'],
            '自然魔法': ['natureMagic'],
            '空间魔法': ['spaceMagic'],
            '时间魔法': ['timeMagic'],
            '死灵魔法': ['necromancy'],
            '幻象魔法': ['illusionMagic'],
            '附魔': ['enchantment'],
            '战士': ['warrior'],
            '法师': ['mage'],
            '弓箭手': ['archer'],
            '盗贼': ['rogue'],
            '牧师': ['priest'],
            '圣骑士': ['paladin'],
            '德鲁伊': ['druid'],
            '术士': ['warlock'],
            '吟游诗人': ['bard'],
            '武僧': ['monk'],
            '游侠': ['ranger'],
            '刺客': ['assassin'],
            '凤凰': ['phoenix'],
            '独角兽': ['unicorn'],
            '狮鹫': ['griffin'],
            '飞马': ['pegasus'],
            '海怪': ['kraken'],
            '奇美拉': ['chimera'],
            '蛇怪': ['basilisk'],
            '九头蛇': ['hydra'],
            '传奇武器': ['legendaryWeapon'],
            '魔法护甲': ['magicArmor'],
            '神器': ['artifact'],
            '圣物': ['relic'],

            // ========== 12. 现代设定面板 (48个字段) ==========
            '城市': ['city'],
            '区域': ['district'],
            '住房': ['housing'],
            '交通': ['transport'],
            '社区': ['neighborhood'],
            '生活成本': ['cost'],
            '安全': ['safety'],
            '污染': ['pollution'],
            '工作': ['job'],
            '公司': ['company'],
            '职位': ['position'],
            '工作时间': ['worktime'],
            '职业发展': ['career'],
            '智能手机': ['smartphone'],
            '电脑': ['computer'],
            '互联网': ['internet'],
            '流媒体': ['streaming'],
            '在线购物': ['shopping'],
            '支付方式': ['payment'],
            '人工智能': ['ai'],
            '健康': ['health'],
            '健身': ['fitness'],
            '饮食': ['diet'],
            '睡眠': ['sleep'],
            '医疗': ['medical'],
            '压力': ['stress'],
            '心理健康': ['mental'],
            '体检': ['checkup'],
            '预算': ['budget'],
            '品牌': ['brands'],
            '时尚': ['fashion'],
            '奢侈品': ['luxury'],
            '投资': ['investment'],
            '储蓄': ['saving'],
            '信用': ['credit'],
            '保险': ['insurance'],
            '电影': ['movies'],
            '俱乐部': ['clubs'],
            '餐厅': ['restaurants'],
            '咖啡馆': ['cafes'],
            '酒吧': ['bars'],
            '音乐会': ['concerts'],
            '展览': ['exhibitions'],
            '运动': ['sports'],
            '旅游': ['tourism'],
            '社交媒体': ['socialMedia'],
            '约会': ['dating'],

            // ========== 13. 历史设定面板 (48个字段) ==========
            '朝代': ['dynasty'],
            '历史时期': ['period'],
            '皇帝': ['emperor'],
            '首都': ['capital'],
            '地区': ['region'],
            '社会阶级': ['class'],
            '标题': ['title'],
            '家族': ['family'],
            '财富': ['wealth'],
            '土地': ['land'],
            '仆人': ['servants'],
            '人脉': ['connections'],
            '诗词': ['poetry'],
            '书法': ['calligraphy'],
            '棋艺': ['chess'],
            '经典': ['classics'],
            '哲学': ['philosophy'],
            '礼仪': ['etiquette'],
            '语言': ['language'],
            '武艺': ['martial'],
            '骑术': ['horsemanship'],
            '兵法': ['strategy'],
            '护卫': ['bodyguard'],
            '生存': ['survival'],
            '住所': ['residence'],
            '服饰': ['clothing'],
            '饮食': ['food'],
            '娱乐': ['entertainment'],
            '宗教': ['religion'],
            '职业': ['profession'],
            '手工艺': ['crafts'],
            '行政': ['administration'],
            '教学': ['teaching'],
            '建筑': ['construction'],
            '农业': ['agriculture'],
            '商业': ['commerce'],
            '军事': ['military'],
            '外交': ['diplomacy'],
            '法律': ['law'],
            '税收': ['taxation'],
            '货币': ['currency'],
            '贸易': ['trade'],
            '科技': ['technology'],
            '医学': ['medicine'],
            '艺术': ['art'],
            '文学': ['literature'],
            '音乐': ['music'],
            '戏剧': ['theater'],

            // ========== 14. 魔法系统面板 (40个字段) ==========
            '塑能系': ['evocation'],
            '幻术系': ['illusion'],
            '预言系': ['divination'],
            '变化系': ['transmutation'],
            '咒法系': ['conjuration'],
            '防护系': ['abjuration'],
            '元素系': ['elemental'],
            '戏法': ['cantrip'],
            '一环法术': ['level1'],
            '二环法术': ['level2'],
            '三环法术': ['level3'],
            '四环法术': ['level4'],
            '五环法术': ['level5'],
            '六环法术': ['level6'],
            '七环法术': ['level7'],
            '八环法术': ['level8'],
            '九环法术': ['level9'],
            '法术等级': ['level'],
            '法力值': ['mana'],
            '专注': ['concentration'],
            '法术强度': ['spellpower'],
            '魔法抗性': ['resistance'],
            '法术书': ['spellbook'],
            '已知法术': ['known'],
            '准备法术': ['prepared'],
            '法术位': ['slots'],
            '施法材料': ['components'],
            '仪式法术': ['rituals'],
            '超魔': ['metamagic'],
            '卷轴': ['scrolls'],
            '火系': ['fire'],
            '水系': ['water'],
            '土系': ['earth'],
            '风系': ['air'],
            '雷系': ['lightning'],
            '冰系': ['ice'],
            '光系': ['light'],
            '暗系': ['dark'],
            '法杖': ['staff'],
            '魔杖': ['wand'],

            // ========== 15. 训练系统面板 (39个字段) ==========
            '服从训练': ['obedience'],
            '姿势训练': ['posture'],
            '言语训练': ['speech'],
            '行为训练': ['behavior'],
            '注意力训练': ['attention'],
            '耐心训练': ['patience'],
            '专注训练': ['focus'],
            '服务训练': ['service'],
            '清洁训练': ['cleaning'],
            '按摩训练': ['massage'],
            '舞蹈训练': ['dance'],
            '耐力训练': ['endurance'],
            '柔韧性训练': ['flexibility'],
            '平衡训练': ['balance'],
            '协调训练': ['coordination'],
            '体能训练': ['stamina'],
            '自信训练': ['confidence'],
            '情绪训练': ['emotion'],
            '记忆训练': ['memory'],
            '逻辑训练': ['logic'],
            '创造力训练': ['creativity'],
            '正念训练': ['mindfulness'],
            '强度设置': ['intensity'],
            '训练计划': ['schedule'],
            '自动训练': ['auto'],
            '自适应训练': ['adaptive'],
            '进度追踪': ['progressTracking'],
            '成就系统': ['achievementSystem'],
            '奖励机制': ['rewardMechanism'],
            '惩罚机制': ['punishmentMechanism'],
            '训练日志': ['trainingLog'],
            '训练报告': ['trainingReport'],
            '训练目标': ['trainingGoals'],
            '训练效果': ['trainingEffects'],
            '训练难度': ['trainingDifficulty'],
            '训练时长': ['trainingDuration'],
            '训练频率': ['trainingFrequency'],
            '训练类型': ['trainingType'],
            '训练方法': ['trainingMethod']
        };

        return mapping[chineseName] || [];
    }

    /**
     * 🔧 新增：智能迁移面板字段（从PresetPanelsManager获取正确的字段定义）
     * 直接使用PresetPanelsManager中的正确字段定义替换用户配置中的英文字段
     */
    async migratePanelFieldKeys() {
        try {
            console.log('[ConfigManager] 🔄 开始智能迁移：从PresetPanelsManager获取正确的字段定义...');

            // 1. 动态导入PresetPanelsManager
            const { PresetPanelsManager } = await import('./PresetPanelsManager.js');
            const presets = PresetPanelsManager.getPresets();

            // 2. 获取用户配置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取扩展设置，跳过迁移');
                return { success: false, message: '无法获取扩展设置' };
            }

            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            if (!extensionSettings || !extensionSettings.customPanels) {
                console.warn('[ConfigManager] ⚠️ customPanels不存在，跳过迁移');
                return { success: false, message: 'customPanels不存在' };
            }

            const customPanels = extensionSettings.customPanels;
            let totalMigratedPanels = 0;
            let totalMigratedFields = 0;

            // 3. 遍历所有预设面板
            for (const [panelKey, preset] of Object.entries(presets)) {
                const userPanel = customPanels[panelKey];
                if (!userPanel || userPanel.type !== 'preset') {
                    continue;
                }

                // 4. 检查是否需要迁移
                let needsMigration = false;
                if (userPanel.subItems && Array.isArray(userPanel.subItems)) {
                    for (const subItem of userPanel.subItems) {
                        // 检查是否有英文key或英文name
                        if ((subItem.key && /^[a-zA-Z]+$/.test(subItem.key)) ||
                            (subItem.name && /^[a-zA-Z]+$/.test(subItem.name))) {
                            needsMigration = true;
                            break;
                        }
                    }
                }

                if (!needsMigration) {
                    console.log(`[ConfigManager] ⏭️ 面板 ${panelKey} 不需要迁移`);
                    continue;
                }

                // 5. 直接替换为PresetPanelsManager中的正确字段定义
                console.log(`[ConfigManager] 🔄 迁移面板 ${panelKey}...`);

                // 保留用户的enabled状态
                const userEnabledMap = new Map();
                if (userPanel.subItems && Array.isArray(userPanel.subItems)) {
                    userPanel.subItems.forEach(subItem => {
                        // 使用name作为key（因为name更稳定）
                        if (subItem.name) {
                            userEnabledMap.set(subItem.name, subItem.enabled);
                        }
                    });
                }

                // 使用PresetPanelsManager中的正确字段定义
                userPanel.subItems = JSON.parse(JSON.stringify(preset.subItems));

                // 恢复用户的enabled状态
                userPanel.subItems.forEach(subItem => {
                    if (userEnabledMap.has(subItem.name)) {
                        subItem.enabled = userEnabledMap.get(subItem.name);
                    }
                });

                totalMigratedPanels++;
                totalMigratedFields += userPanel.subItems.length;
                console.log(`[ConfigManager] ✅ 面板 ${panelKey} 迁移完成: ${userPanel.subItems.length}个字段`);
            }

            // 6. 保存更新后的配置
            if (totalMigratedPanels > 0) {
                if (context.saveSettingsDebounced) {
                    context.saveSettingsDebounced();
                }
                console.log(`[ConfigManager] ✅ 迁移完成: ${totalMigratedPanels}个面板，${totalMigratedFields}个字段`);
            } else {
                console.log('[ConfigManager] ℹ️ 没有需要迁移的面板');
            }

            return {
                success: true,
                totalMigratedPanels,
                totalMigratedFields,
                message: `成功迁移${totalMigratedPanels}个面板的${totalMigratedFields}个字段`
            };

        } catch (error) {
            console.error('[ConfigManager] ❌ 迁移面板字段失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔧 新增：迁移中文键名到英文键名
     * 将customPanels中的中文键名（如"个人信息"）迁移到英文键名（如"personal"）
     */
    async migrateChineseKeysToEnglish() {
        try {
            console.log('[ConfigManager] 🔄 开始迁移中文键名到英文键名...');

            // 1. 获取SillyTavern扩展设置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取扩展设置，跳过迁移');
                return { success: false, message: '无法获取扩展设置' };
            }

            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            if (!extensionSettings || !extensionSettings.customPanels) {
                console.warn('[ConfigManager] ⚠️ customPanels不存在，跳过迁移');
                return { success: false, message: 'customPanels不存在' };
            }

            // 2. 动态导入预设面板管理器
            const { PresetPanelsManager } = await import('./PresetPanelsManager.js');
            const nameMapping = PresetPanelsManager.getPanelNameMapping();

            // 3. 查找需要迁移的中文键名
            const customPanels = extensionSettings.customPanels;
            const chineseKeys = Object.keys(customPanels).filter(key => /[\u4e00-\u9fa5]/.test(key));

            if (chineseKeys.length === 0) {
                console.log('[ConfigManager] ✅ 没有需要迁移的中文键名');
                return { success: true, migratedCount: 0 };
            }

            console.log(`[ConfigManager] 📊 发现 ${chineseKeys.length} 个中文键名需要迁移:`, chineseKeys);

            // 4. 执行迁移
            let migratedCount = 0;
            for (const chineseKey of chineseKeys) {
                // 查找对应的英文键名
                const englishKey = PresetPanelsManager.getKeyByChineseName(chineseKey);

                if (!englishKey) {
                    console.warn(`[ConfigManager] ⚠️ 未找到中文键名 "${chineseKey}" 对应的英文键名，跳过`);
                    continue;
                }

                // 复制配置到英文键名
                const panelConfig = customPanels[chineseKey];
                customPanels[englishKey] = {
                    ...panelConfig,
                    key: englishKey,
                    id: englishKey
                };

                // 删除中文键名
                delete customPanels[chineseKey];

                console.log(`[ConfigManager] ✅ 迁移: "${chineseKey}" → "${englishKey}"`);
                migratedCount++;
            }

            // 5. 保存更新后的配置
            await this.saveExtensionSettings();

            console.log(`[ConfigManager] ✅ 中文键名迁移完成: ${migratedCount}个面板`);

            return {
                success: true,
                migratedCount,
                chineseKeys,
                message: `成功迁移${migratedCount}个面板`
            };

        } catch (error) {
            console.error('[ConfigManager] ❌ 迁移中文键名失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔧 增强版：迁移基础面板到自定义面板
     * 将15个旧的基础面板配置转换为新的customPanels格式
     *
     * 新增功能：
     * 1. 智能字段提取（支持两种旧版本格式）
     * 2. 用户自定义字段识别和保留
     * 3. 英文key到中文key的转换
     * 4. 字段去重
     * 5. 详细的迁移日志
     */
    async migrateBasicPanelsToCustom() {
        try {
            console.log('[ConfigManager] 🔄 ========== 开始迁移基础面板到自定义面板 ==========');

            // 0. 先执行中文键名到英文键名的迁移
            await this.migrateChineseKeysToEnglish();

            // 1. 检查是否已经迁移过
            const migrated = await this.getConfig('basicPanelsMigrated');

            // 🔧 重要修复：如果已经迁移过，直接跳过
            if (migrated === true) {
                console.log('[ConfigManager] ℹ️ 基础面板已迁移过，跳过迁移（完全由用户控制）');
                return {
                    success: true,
                    message: '基础面板已迁移，跳过',
                    migrated: true,
                    migratedCount: 0,
                    skippedCount: 0
                };
            }

            // 2. 动态导入预设面板管理器
            const { PresetPanelsManager } = await import('./PresetPanelsManager.js');
            const presets = PresetPanelsManager.getPresets();
            const nameMapping = PresetPanelsManager.getPanelNameMapping();

            // 3. 获取SillyTavern扩展设置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取扩展设置，跳过迁移');
                return {
                    success: false,
                    message: '无法获取扩展设置',
                    migrated: false
                };
            }

            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            if (!extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 扩展设置不存在，跳过迁移');
                return {
                    success: false,
                    message: '扩展设置不存在',
                    migrated: false
                };
            }

            // 4. 获取或创建customPanels对象
            let customPanels = extensionSettings.customPanels || {};

            // 🔧 新增：清理错误的面板键名（如preset_world等）
            const wrongKeys = Object.keys(customPanels).filter(key =>
                key.startsWith('preset_')
            );

            if (wrongKeys.length > 0) {
                console.log(`[ConfigManager] 🧹 清理 ${wrongKeys.length} 个错误的面板键名:`, wrongKeys);
                wrongKeys.forEach(key => {
                    delete customPanels[key];
                });
                // 清除迁移标记，强制重新迁移
                delete extensionSettings.basicPanelsMigrated;
                await this.deleteConfig('basicPanelsMigrated');
                console.log('[ConfigManager] 🔄 已清理错误面板，重置迁移标记');
            }

            // 5. 备份原始配置
            const backup = {
                timestamp: Date.now(),
                basicPanels: {},
                customPanels: JSON.parse(JSON.stringify(customPanels))
            };

            let migratedCount = 0;
            let skippedCount = 0;
            let totalPresetFields = 0;
            let totalCustomFields = 0;
            let totalConvertedFields = 0;

            // 6. 遍历英文键名，进行迁移
            // nameMapping: { personal: '个人信息', world: '世界状态', ... }
            for (const [englishKey, chineseName] of Object.entries(nameMapping)) {
                console.log(`[ConfigManager] 📋 ========== 处理面板: ${englishKey} (${chineseName}) ==========`);

                const oldConfig = extensionSettings[englishKey];  // 从旧的英文键名配置中读取

                if (!oldConfig) {
                    console.log(`[ConfigManager] ⏭️ 旧面板配置不存在，跳过: ${englishKey}`);
                    skippedCount++;
                    continue;
                }

                // 备份旧配置
                backup.basicPanels[englishKey] = JSON.parse(JSON.stringify(oldConfig));

                // 获取预设配置
                const preset = presets[englishKey];
                if (!preset) {
                    console.warn(`[ConfigManager] ⚠️ 预设配置不存在: ${englishKey}`);
                    skippedCount++;
                    continue;
                }

                // 🔧 步骤1：智能提取所有字段（支持两种旧版本格式）
                const extractedFields = this.extractSubItemsFromConfig(oldConfig, englishKey);
                console.log(`[ConfigManager] 📊 ${englishKey}: 提取到 ${extractedFields.length} 个字段`);

                // 🔧 步骤2：识别用户自定义字段
                const { presetFields, customFields } = this.identifyCustomFields(
                    extractedFields,
                    preset.subItems || [],
                    englishKey
                );
                totalPresetFields += presetFields.length;
                totalCustomFields += customFields.length;

                // 🔧 步骤3：转换英文key为中文key（包括预设字段和自定义字段）
                const convertedPresetFields = this.convertEnglishKeysToChineseKeys(presetFields, englishKey);
                const convertedCustomFields = this.convertEnglishKeysToChineseKeys(customFields, englishKey);
                totalConvertedFields += convertedPresetFields.length + convertedCustomFields.length;

                // 🔧 步骤4（修复）：以预设字段为基线进行合并，确保不会丢失任何预设字段
                // 4.1 深拷贝预设字段作为基线
                const basePresetFields = (preset.subItems || []).map(item => ({ ...item }));

                // 4.2 用提取到的（可能很少）预设字段来覆盖基线的启用状态/属性
                const mergedPresetFields = basePresetFields.map(item => {
                    const matched = convertedPresetFields.find(f => f.name === item.name || f.key === item.key);
                    if (matched) {
                        return {
                            ...item,
                            enabled: typeof matched.enabled === 'boolean' ? matched.enabled : item.enabled,
                            value: matched.value ?? item.value,
                            description: item.description || matched.description || ''
                        };
                    }
                    return item;
                });

                // 4.3 修复自定义字段的key（col_X → 字段名称），并去重（按name）
                const fixedCustomFields = convertedCustomFields.map(field => {
                    if (field.key && String(field.key).startsWith('col_')) {
                        return { ...field, key: field.name };
                    }
                    return field;
                }).filter(field => {
                    // 过滤掉与预设同名/同key的重复项
                    return !mergedPresetFields.some(p => p.name === field.name || p.key === field.key);
                });

                // 4.4 合并为最终字段
                const finalFields = [...mergedPresetFields, ...fixedCustomFields];
                console.log(`[ConfigManager] ✅ ${englishKey}: 最终字段数=${finalFields.length} (预设基线=${mergedPresetFields.length}, 自定义=${fixedCustomFields.length})`);

                // 7. 创建新的面板配置
                const existingPanel = customPanels[englishKey];
                const basePanel = existingPanel || preset;

                const newPanel = {
                    ...basePanel, // 基础配置
                    id: englishKey,
                    key: englishKey,
                    name: preset.name,  // 使用预设的标准名称
                    type: 'preset',
                    enabled: oldConfig.enabled !== false, // 保留用户的启用状态

                    // 🔧 使用最终合并的字段列表
                    subItems: finalFields.length > 0 ? finalFields : basePanel.subItems,

                    // 保留用户的提示词配置（如果有）
                    prompts: oldConfig.prompts || basePanel.prompts,

                    // 保留其他用户自定义的配置
                    description: oldConfig.description || basePanel.description,
                    icon: oldConfig.icon || basePanel.icon,

                    // 添加迁移标记
                    migratedFrom: englishKey,
                    migratedAt: Date.now(),
                    extractedFieldsCount: extractedFields.length,
                    presetFieldsCount: convertedPresetFields.length,
                    customFieldsCount: convertedCustomFields.length
                };

                // 8. 添加到customPanels
                customPanels[englishKey] = newPanel;
                migratedCount++;

                console.log(`[ConfigManager] ✅ 迁移面板完成: ${englishKey}`);

                // 9. 删除旧的基础面板配置（保留在备份中）
                delete extensionSettings[englishKey];
            }

            // 10. 保存备份
            await this.setConfig('basicPanelsMigrationBackup', backup, false);
            console.log('[ConfigManager] 💾 迁移备份已保存');

            // 11. 保存更新后的customPanels
            extensionSettings.customPanels = customPanels;

            // 12. 标记迁移完成
            await this.setConfig('basicPanelsMigrated', true, false);
            extensionSettings.basicPanelsMigrated = true;

            // 13. 触发SillyTavern保存设置
            if (context.saveSettingsDebounced) {
                context.saveSettingsDebounced();
            }

            const result = {
                success: true,
                message: `成功迁移 ${migratedCount} 个基础面板`,
                migrated: true,
                migratedCount,
                skippedCount,
                totalPresetFields,
                totalCustomFields,
                totalConvertedFields,
                backup: true
            };

            console.log('[ConfigManager] ✅ ========== 基础面板迁移完成 ==========');
            console.log('[ConfigManager] 📊 迁移统计:', {
                迁移面板数: migratedCount,
                跳过面板数: skippedCount,
                预设字段总数: totalPresetFields,
                自定义字段总数: totalCustomFields,
                转换字段总数: totalConvertedFields
            });

            return result;

        } catch (error) {
            console.error('[ConfigManager] ❌ 迁移基础面板失败:', error);
            this.handleError(error);

            return {
                success: false,
                message: `迁移失败: ${error.message}`,
                migrated: false,
                error: error
            };
        }
    }

    /**
     * 🔧 新增：只在第一次使用时初始化预设面板
     * 之后完全由用户控制，不再自动检查和恢复
     */
    async ensurePresetPanelsOnce() {
        try {
            console.log('[ConfigManager] 🔧 检查是否需要初始化预设面板...');
            
            // 1. 获取扩展设置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取扩展设置');
                return { success: false, message: '无法获取扩展设置' };
            }
            
            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            if (!extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 扩展设置不存在');
                return { success: false, message: '扩展设置不存在' };
            }
            
            // 2. 检查是否已经初始化过
            if (extensionSettings.presetPanelsInitialized === true) {
                console.log('[ConfigManager] ℹ️ 预设面板已初始化过，跳过自动添加（完全由用户控制）');
                return {
                    success: true,
                    message: '预设面板已初始化，跳过',
                    addedCount: 0,
                    totalCount: Object.keys(extensionSettings.customPanels || {}).length
                };
            }
            
            // 3. 动态导入预设面板管理器
            const { PresetPanelsManager } = await import('./PresetPanelsManager.js');
            
            // 4. 首次初始化：添加预设面板
            let customPanels = extensionSettings.customPanels || {};
            const beforeCount = Object.keys(customPanels).length;
            
            console.log('[ConfigManager] 🚀 首次使用，初始化15个预设面板...');
            customPanels = PresetPanelsManager.ensurePresetPanels(customPanels, []);
            
            // 5. 保存更新后的customPanels
            extensionSettings.customPanels = customPanels;
            
            // 6. 标记为已初始化
            extensionSettings.presetPanelsInitialized = true;
            
            const afterCount = Object.keys(customPanels).length;
            const addedCount = afterCount - beforeCount;
            
            // 7. 触发保存
            if (context.saveSettingsDebounced) {
                context.saveSettingsDebounced();
            }
            
            console.log(`[ConfigManager] ✅ 预设面板初始化完成，添加了 ${addedCount} 个面板`);
            console.log('[ConfigManager] 📝 已标记presetPanelsInitialized=true，后续完全由用户控制');
            
            return {
                success: true,
                message: `预设面板初始化完成，添加 ${addedCount} 个`,
                addedCount,
                totalCount: afterCount
            };
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 初始化预设面板失败:', error);
            this.handleError(error);
            
            return {
                success: false,
                message: `初始化预设面板失败: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * 🔧 增强版：从旧配置中提取所有子项字段
     * 支持两种旧版本格式：
     * 1. panel.fieldName.enabled 格式
     * 2. panel.subItems 数组格式
     * @param {Object} oldConfig - 旧的面板配置对象
     * @param {string} panelId - 面板ID
     * @returns {Array} 提取的子项数组
     */
    extractSubItemsFromConfig(oldConfig, panelId) {
        try {
            let subItems = [];

            if (!oldConfig || typeof oldConfig !== 'object') {
                console.log(`[ConfigManager] ⚠️ ${panelId}: 配置对象无效`);
                return subItems;
            }

            // 🔧 格式2：优先检查是否有 subItems 数组
            if (Array.isArray(oldConfig.subItems) && oldConfig.subItems.length > 0) {
                console.log(`[ConfigManager] 📋 ${panelId}: 发现 subItems 数组格式，包含 ${oldConfig.subItems.length} 个字段`);

                // 直接使用 subItems 数组，但需要确保每个字段都有必要的属性
                subItems = oldConfig.subItems.map(item => ({
                    key: item.key || item.name || '',
                    name: item.name || item.displayName || item.key || '',
                    displayName: item.displayName || item.name || item.key || '',
                    enabled: item.enabled !== false, // 保留启用状态
                    type: item.type || 'text',
                    value: item.value || '',
                    description: item.description || '',
                    // 保留其他可能的自定义属性
                    ...item
                }));

                console.log(`[ConfigManager] ✅ ${panelId}: 从 subItems 数组提取了 ${subItems.length} 个字段`);
                return subItems;
            }

            // 🔧 格式1：遍历配置对象的所有键，查找 fieldName.enabled 格式
            console.log(`[ConfigManager] 🔍 ${panelId}: 尝试从对象属性中提取字段...`);

            // 🔧 面板级别的属性列表（不包括字段名称）
            const panelLevelKeys = new Set([
                'enabled', 'subItems', 'description', 'icon', 'prompts',
                'required', 'memoryInject', 'key', 'type', 'id', 'order', 'collapsed'
            ]);

            for (const [key, value] of Object.entries(oldConfig)) {
                // 🔧 修复：只跳过真正的面板级别属性，不跳过字段名称
                // 如果key是面板级别属性，跳过
                if (panelLevelKeys.has(key)) {
                    continue;
                }

                // 🔧 特殊处理：如果key是'name'，但value是对象且有enabled属性，说明这是一个字段
                // 检查是否是字段配置对象 {enabled: true/false, name: ...}
                if (value && typeof value === 'object' && 'enabled' in value) {
                    // 获取字段的显示名称
                    const displayName = value.name || this.getFieldDisplayName(panelId, key);

                    subItems.push({
                        key: key,
                        name: displayName,
                        displayName: displayName,
                        enabled: value.enabled !== false, // 保留启用状态
                        type: value.type || 'text',
                        value: value.value || '',
                        description: value.description || '',
                        // 保留其他可能的自定义属性
                        ...value
                    });
                }
            }

            if (subItems.length > 0) {
                console.log(`[ConfigManager] ✅ ${panelId}: 从对象属性提取了 ${subItems.length} 个字段`);
            } else {
                console.log(`[ConfigManager] ⚠️ ${panelId}: 未找到任何字段配置`);
            }

            return subItems;

        } catch (error) {
            console.error(`[ConfigManager] ❌ 提取字段失败 (${panelId}):`, error);
            return [];
        }
    }

    /**
     * 🆕 从面板数据中提取字段信息
     */
    extractFieldsFromPanelData(panelData, panelKey) {
        const fields = [];

        try {
            // 检查数据格式
            if (Array.isArray(panelData)) {
                // 数组格式：取第一行数据
                if (panelData.length > 0) {
                    const firstRow = panelData[0];
                    return this.extractFieldsFromRowData(firstRow, panelKey);
                }
            } else if (typeof panelData === 'object') {
                // 对象格式：直接提取
                return this.extractFieldsFromRowData(panelData, panelKey);
            }

            return fields;

        } catch (error) {
            console.error(`[ConfigManager] ❌ 从面板数据提取字段失败:`, error);
            return [];
        }
    }

    /**
     * 🆕 从行数据中提取字段信息
     */
    extractFieldsFromRowData(rowData, panelKey) {
        const fields = [];

        try {
            // 获取预设面板配置
            const infoBarTool = window.SillyTavernInfobar;
            const PresetPanelsManager = infoBarTool?.PresetPanelsManager;
            const preset = PresetPanelsManager?.getPresets?.()?.[panelKey];

            if (!preset || !preset.subItems) {
                console.warn(`[ConfigManager] ⚠️ 无法获取面板 ${panelKey} 的预设配置`);
                return fields;
            }

            // 遍历数据中的所有字段
            for (const [key, value] of Object.entries(rowData)) {
                // 跳过元数据字段
                if (key === 'enabled' || key === 'lastUpdated' || key.startsWith('_')) {
                    continue;
                }

                // 尝试匹配预设字段
                let matchedField = null;

                // 1. 检查是否是数字索引（旧格式）
                if (/^\d+$/.test(key)) {
                    const index = parseInt(key) - 1;
                    if (index >= 0 && index < preset.subItems.length) {
                        matchedField = preset.subItems[index];
                    }
                }

                // 2. 检查是否是col_X格式
                else if (key.startsWith('col_')) {
                    const index = parseInt(key.replace('col_', '')) - 1;
                    if (index >= 0 && index < preset.subItems.length) {
                        matchedField = preset.subItems[index];
                    }
                }

                // 3. 检查是否是英文key
                else if (/^[a-zA-Z_]+$/.test(key)) {
                    // 使用映射表查找对应的中文字段
                    matchedField = preset.subItems.find(item => {
                        const possibleEnglishKeys = this.generatePossibleEnglishKeys(item.name);
                        return possibleEnglishKeys.includes(key);
                    });
                }

                // 4. 检查是否是中文key
                else {
                    matchedField = preset.subItems.find(item =>
                        item.key === key || item.name === key
                    );
                }

                // 如果匹配到预设字段，添加到结果中
                if (matchedField) {
                    fields.push({
                        key: matchedField.key || matchedField.name,
                        name: matchedField.name,
                        displayName: matchedField.displayName || matchedField.name,
                        enabled: true, // 如果数据中有值，说明字段是启用的
                        type: matchedField.type || 'text',
                        value: value || '',
                        description: matchedField.description || ''
                    });
                } else {
                    // 未匹配到预设字段，可能是自定义字段
                    fields.push({
                        key: key,
                        name: key,
                        displayName: key,
                        enabled: true,
                        type: 'text',
                        value: value || '',
                        description: '自定义字段'
                    });
                }
            }

            console.log(`[ConfigManager] 📊 从行数据提取到 ${fields.length} 个字段`);
            return fields;

        } catch (error) {
            console.error(`[ConfigManager] ❌ 从行数据提取字段失败:`, error);
            return [];
        }
    }

    /**
     * 🆕 从预设配置中恢复面板字段
     * 用于修复错误迁移导致的字段丢失问题
     */
    async recoverPanelFieldsFromPresets() {
        console.log('[ConfigManager] 🔄 ========== 开始从预设配置恢复面板字段 ==========');

        try {
            // 直接从extensionSettings获取配置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                console.warn('[ConfigManager] ⚠️ 无法获取extensionSettings');
                return { success: false, message: '无法获取extensionSettings' };
            }

            const settings = context.extensionSettings['Information bar integration tool'];
            if (!settings || !settings.customPanels) {
                console.warn('[ConfigManager] ⚠️ customPanels配置不存在');
                return { success: false, message: 'customPanels配置不存在' };
            }

            const customPanels = settings.customPanels;

            const infoBarTool = window.SillyTavernInfobar;
            const PresetPanelsManager = infoBarTool?.PresetPanelsManager;

            if (!PresetPanelsManager) {
                console.warn('[ConfigManager] ⚠️ PresetPanelsManager类未找到');
                return { success: false, message: 'PresetPanelsManager类未找到' };
            }

            const presets = PresetPanelsManager.getPresets();
            if (!presets) {
                console.warn('[ConfigManager] ⚠️ 无法获取预设配置');
                return { success: false, message: '无法获取预设配置' };
            }

            // 统计信息
            let recoveredPanels = 0;
            let recoveredFields = 0;

            // 遍历所有预设面板
            for (const [panelKey, preset] of Object.entries(presets)) {
                console.log(`[ConfigManager] 🔍 检查面板: ${panelKey}`);

                // 获取当前面板配置
                const currentPanel = customPanels[panelKey];
                if (!currentPanel) {
                    console.warn(`[ConfigManager] ⚠️ 面板 ${panelKey} 不存在于customPanels中`);
                    continue;
                }

                // 检查当前字段数
                const currentFieldCount = currentPanel.subItems?.length || 0;
                const presetFieldCount = preset.subItems?.length || 0;

                console.log(`[ConfigManager] 📊 面板 ${panelKey}: 当前字段数=${currentFieldCount}, 预设字段数=${presetFieldCount}`);

                // 如果当前字段数明显少于预设字段数，说明可能是错误迁移
                if (currentFieldCount < presetFieldCount * 0.5) {
                    console.log(`[ConfigManager] 🔧 面板 ${panelKey} 需要恢复字段: ${currentFieldCount} -> ${presetFieldCount}`);

                    // 保留当前的自定义字段（key不在预设中的字段）
                    const customFields = currentPanel.subItems?.filter(item => {
                        return !preset.subItems.some(presetItem =>
                            presetItem.key === item.key || presetItem.name === item.name
                        );
                    }) || [];

                    console.log(`[ConfigManager] 📊 保留 ${customFields.length} 个自定义字段`);

                    // 🔧 修复自定义字段的key：将col_X格式改为字段名称
                    const fixedCustomFields = customFields.map(item => {
                        // 如果key是col_X格式，改为字段名称
                        if (item.key && item.key.startsWith('col_')) {
                            console.log(`[ConfigManager] 🔧 修复自定义字段key: ${item.key} -> ${item.name}`);
                            return {
                                ...item,
                                key: item.name // 使用字段名称作为key
                            };
                        }
                        return item;
                    });

                    // 合并预设字段和自定义字段
                    currentPanel.subItems = [
                        ...preset.subItems.map(item => ({
                            ...item,
                            enabled: true // 默认启用所有预设字段
                        })),
                        ...fixedCustomFields
                    ];

                    recoveredPanels++;
                    recoveredFields += (presetFieldCount - currentFieldCount + fixedCustomFields.length);
                }
            }

            // 保存配置
            if (recoveredPanels > 0) {
                // 直接保存到extensionSettings
                settings.customPanels = customPanels;
                await context.saveSettingsDebounced();

                console.log(`[ConfigManager] ✅ 恢复完成: ${recoveredPanels} 个面板, ${recoveredFields} 个字段`);
                return {
                    success: true,
                    message: `成功恢复 ${recoveredPanels} 个面板的 ${recoveredFields} 个字段`,
                    recoveredPanels,
                    recoveredFields
                };
            } else {
                console.log('[ConfigManager] ℹ️ 没有需要恢复的字段');
                return { success: true, message: '没有需要恢复的字段' };
            }

        } catch (error) {
            console.error('[ConfigManager] ❌ 从预设配置恢复失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🆕 从聊天数据中恢复面板配置
     * 用于修复错误迁移导致的字段丢失问题
     */
    async recoverPanelConfigFromChatData() {
        console.log('[ConfigManager] 🔄 ========== 开始从聊天数据恢复面板配置 ==========');

        try {
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.chat) {
                console.warn('[ConfigManager] ⚠️ 无法获取聊天数据');
                return { success: false, message: '无法获取聊天数据' };
            }

            const chat = context.chat;
            const extensionSettings = context.extensionSettings[this.extensionName];

            // 查找包含infobar_data的消息
            const messagesWithData = chat.filter(msg => msg.extra?.infobar_data);

            if (messagesWithData.length === 0) {
                console.warn('[ConfigManager] ⚠️ 聊天中没有找到infobar_data');
                return { success: false, message: '聊天中没有找到数据' };
            }

            console.log(`[ConfigManager] 📊 找到 ${messagesWithData.length} 条包含数据的消息`);

            // 使用最新的数据
            const latestData = messagesWithData[messagesWithData.length - 1].extra.infobar_data;

            // 统计信息
            let recoveredPanels = 0;
            let recoveredFields = 0;

            // 遍历所有面板
            for (const [panelKey, panelData] of Object.entries(latestData)) {
                if (!panelData || typeof panelData !== 'object') continue;

                console.log(`[ConfigManager] 🔍 检查面板: ${panelKey}`);

                // 获取当前面板配置
                const currentPanel = extensionSettings.customPanels?.[panelKey];
                if (!currentPanel) {
                    console.warn(`[ConfigManager] ⚠️ 面板 ${panelKey} 不存在于customPanels中`);
                    continue;
                }

                // 检查是否只有少量字段（可能是错误迁移的结果）
                const currentFieldCount = currentPanel.subItems?.length || 0;
                console.log(`[ConfigManager] 📊 面板 ${panelKey} 当前字段数: ${currentFieldCount}`);

                // 从数据中提取字段信息
                const dataFields = this.extractFieldsFromPanelData(panelData, panelKey);
                console.log(`[ConfigManager] 📊 从数据中提取到 ${dataFields.length} 个字段`);

                if (dataFields.length > currentFieldCount) {
                    console.log(`[ConfigManager] 🔧 面板 ${panelKey} 需要恢复字段: ${currentFieldCount} -> ${dataFields.length}`);

                    // 恢复字段配置
                    currentPanel.subItems = dataFields;
                    recoveredPanels++;
                    recoveredFields += (dataFields.length - currentFieldCount);
                }
            }

            // 保存配置
            if (recoveredPanels > 0) {
                await this.setConfig('customPanels', extensionSettings.customPanels, false);
                console.log(`[ConfigManager] ✅ 恢复完成: ${recoveredPanels} 个面板, ${recoveredFields} 个字段`);
                return {
                    success: true,
                    message: `成功恢复 ${recoveredPanels} 个面板的 ${recoveredFields} 个字段`,
                    recoveredPanels,
                    recoveredFields
                };
            } else {
                console.log('[ConfigManager] ℹ️ 没有需要恢复的字段');
                return { success: true, message: '没有需要恢复的字段' };
            }

        } catch (error) {
            console.error('[ConfigManager] ❌ 从聊天数据恢复失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 🔧 新增：获取字段的显示名称
     * 提供常用字段的中文显示名称映射
     */
    getFieldDisplayName(panelId, fieldKey) {
        // 通用字段映射
        const commonFieldNames = {
            name: '姓名', age: '年龄', gender: '性别', occupation: '职业',
            height: '身高', weight: '体重', bloodType: '血型', zodiac: '星座',
            birthday: '生日', birthplace: '出生地', nationality: '国籍', ethnicity: '民族',
            hairColor: '发色', hairStyle: '发型', eyeColor: '眼色', skinColor: '肤色',
            bodyType: '体型', facialFeatures: '面部特征', scars: '疤痕', tattoos: '纹身',
            accessories: '饰品', clothingStyle: '服装风格', appearance: '外观描述', voice: '声音特征',
            personality: '性格', temperament: '气质', attitude: '态度', values: '价值观',
            beliefs: '信仰', fears: '恐惧', dreams: '梦想', goals: '目标',
            intelligence: '智力', strength: '体力', charisma: '魅力', luck: '运气',
            perception: '感知', willpower: '意志力', reactionSpeed: '反应速度', learningAbility: '学习能力',
            familyBackground: '家庭背景', education: '教育经历', workExperience: '工作经历', income: '收入',
            socialStatus: '社会地位', relationships: '人际关系', loveStatus: '恋爱状态', maritalStatus: '婚姻状态',
            hobbies: '兴趣爱好', sports: '运动', music: '音乐', art: '艺术',
            reading: '阅读', gaming: '游戏', travel: '旅行', cooking: '烹饪',
            skills: '技能特长', languages: '语言能力', habits: '生活习惯', healthStatus: '健康状态',

            // 世界状态
            worldName: '世界名称', era: '时代', location: '地理位置', climate: '气候',
            technology: '科技水平', society: '社会制度', culture: '文化', season: '季节',
            weather: '天气', time: '时间', environment: '环境', atmosphere: '氛围',

            // 交互对象
            type: '类型', status: '状态', mood: '心情', activity: '活动',
            relationship: '关系', intimacy: '亲密度', history: '历史', autoRecord: '自动记录',

            // 任务系统
            title: '标题', description: '描述', priority: '优先级', deadline: '截止日期',
            assignee: '负责人', progress: '进度', category: '分类',

            // 其他常用
            content: '内容', source: '来源', date: '日期', importance: '重要性',
            quantity: '数量', condition: '状态', value: '价值'
        };

        return commonFieldNames[fieldKey] || fieldKey;
    }

    /**
     * 🔧 新增：识别用户自定义字段
     * 对比预设字段列表，识别用户添加的自定义字段
     * @param {Array} extractedFields - 从旧配置提取的字段数组
     * @param {Array} presetFields - 预设面板的字段数组
     * @param {string} panelId - 面板ID
     * @returns {Object} { presetFields: [], customFields: [] }
     */
    identifyCustomFields(extractedFields, presetFields, panelId) {
        try {
            console.log(`[ConfigManager] 🔍 ${panelId}: 开始识别自定义字段...`);
            console.log(`[ConfigManager] 📊 ${panelId}: 提取字段数=${extractedFields.length}, 预设字段数=${presetFields.length}`);

            // 创建预设字段的key集合（包括英文key和中文key）
            const presetKeySet = new Set();
            const presetNameSet = new Set();

            presetFields.forEach(field => {
                if (field.key) presetKeySet.add(field.key);
                if (field.name) presetNameSet.add(field.name);

                // 🔧 添加可能的英文key
                const possibleEnglishKeys = this.generatePossibleEnglishKeys(field.name);
                possibleEnglishKeys.forEach(englishKey => presetKeySet.add(englishKey));
            });

            const result = {
                presetFields: [],
                customFields: []
            };

            // 遍历提取的字段，分类为预设字段和自定义字段
            extractedFields.forEach(field => {
                const isPresetField = presetKeySet.has(field.key) || presetNameSet.has(field.name);

                if (isPresetField) {
                    result.presetFields.push(field);
                } else {
                    result.customFields.push(field);
                    console.log(`[ConfigManager] 🆕 ${panelId}: 发现自定义字段: ${field.name} (key: ${field.key})`);
                }
            });

            console.log(`[ConfigManager] ✅ ${panelId}: 预设字段=${result.presetFields.length}, 自定义字段=${result.customFields.length}`);

            return result;

        } catch (error) {
            console.error(`[ConfigManager] ❌ 识别自定义字段失败 (${panelId}):`, error);
            return {
                presetFields: extractedFields,
                customFields: []
            };
        }
    }

    /**
     * 🔧 新增：转换英文key为中文key
     * 使用generatePossibleEnglishKeys()创建映射表，转换所有英文key字段为中文key
     * @param {Array} fields - 字段数组
     * @param {string} panelId - 面板ID
     * @returns {Array} 转换后的字段数组（已去重）
     */
    convertEnglishKeysToChineseKeys(fields, panelId) {
        try {
            console.log(`[ConfigManager] 🔄 ${panelId}: 开始转换英文key为中文key...`);

            const convertedFields = [];
            const seenKeys = new Set(); // 用于去重
            const seenNames = new Set(); // 用于去重

            fields.forEach(field => {
                let convertedField = { ...field };
                let converted = false;

                // 🔧 检查是否是英文key
                if (field.key && /^[a-zA-Z]/.test(field.key)) {
                    // 方法1：使用generatePossibleEnglishKeys的反向映射
                    const mapping = this.generatePossibleEnglishKeys(field.name);
                    if (mapping.includes(field.key)) {
                        // field.name 就是中文名称
                        convertedField.key = field.name;
                        converted = true;
                        console.log(`[ConfigManager] 🔄 ${panelId}: ${field.key} → ${field.name}`);
                    } else {
                        // 方法2：使用getFieldDisplayName获取中文名称
                        const chineseName = this.getFieldDisplayName(panelId, field.key);
                        if (chineseName !== field.key) {
                            convertedField.key = chineseName;
                            convertedField.name = chineseName;
                            convertedField.displayName = chineseName;
                            converted = true;
                            console.log(`[ConfigManager] 🔄 ${panelId}: ${field.key} → ${chineseName}`);
                        }
                    }
                }

                // 🔧 去重：如果已经存在相同key或name的字段，跳过
                if (seenKeys.has(convertedField.key) || seenNames.has(convertedField.name)) {
                    console.log(`[ConfigManager] 🔄 ${panelId}: 跳过重复字段: ${convertedField.name} (key: ${convertedField.key})`);
                    return;
                }

                seenKeys.add(convertedField.key);
                seenNames.add(convertedField.name);
                convertedFields.push(convertedField);

                if (converted) {
                    console.log(`[ConfigManager] ✅ ${panelId}: 转换成功: ${field.key} → ${convertedField.key}`);
                }
            });

            console.log(`[ConfigManager] ✅ ${panelId}: 转换完成，原始字段=${fields.length}, 转换后字段=${convertedFields.length}`);

            return convertedFields;

        } catch (error) {
            console.error(`[ConfigManager] ❌ 转换英文key失败 (${panelId}):`, error);
            return fields;
        }
    }

    /**
     * 🔧 新增：回滚基础面板迁移
     * 如果迁移出现问题，可以回滚到迁移前的状态
     */
    async rollbackBasicPanelsMigration() {
        try {
            console.log('[ConfigManager] 🔄 开始回滚基础面板迁移...');
            
            // 1. 获取备份
            const backup = await this.getConfig('basicPanelsMigrationBackup');
            if (!backup) {
                console.warn('[ConfigManager] ⚠️ 未找到迁移备份，无法回滚');
                return {
                    success: false,
                    message: '未找到迁移备份'
                };
            }
            
            // 2. 获取扩展设置
            const context = window.SillyTavern?.getContext?.() || SillyTavern?.getContext?.();
            if (!context || !context.extensionSettings) {
                return {
                    success: false,
                    message: '无法获取扩展设置'
                };
            }
            
            const extensionSettings = context.extensionSettings['Information bar integration tool'];
            
            // 3. 恢复旧的基础面板配置
            for (const [oldId, oldConfig] of Object.entries(backup.basicPanels)) {
                extensionSettings[oldId] = oldConfig;
                console.log(`[ConfigManager] ✅ 恢复基础面板: ${oldId}`);
            }
            
            // 4. 恢复customPanels
            extensionSettings.customPanels = backup.customPanels;
            
            // 5. 移除迁移标记
            await this.deleteConfig('basicPanelsMigrated');
            delete extensionSettings.basicPanelsMigrated;
            
            // 6. 保存设置
            if (context.saveSettingsDebounced) {
                context.saveSettingsDebounced();
            }
            
            console.log('[ConfigManager] ✅ 基础面板迁移已回滚');
            
            return {
                success: true,
                message: '成功回滚迁移',
                rolledBack: true
            };
            
        } catch (error) {
            console.error('[ConfigManager] ❌ 回滚迁移失败:', error);
            this.handleError(error);
            
            return {
                success: false,
                message: `回滚失败: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[ConfigManager] ❌ 错误 #${this.errorCount}:`, error);
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            cacheSize: this.configCache.size,
            validationRulesCount: Object.keys(this.validationRules).length
        };
    }
}
