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
            'apiConfig.provider': { type: 'string', enum: ['gemini', 'openai'], default: 'gemini' },
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
