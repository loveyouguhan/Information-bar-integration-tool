/**
 * AI 数据暴露模块
 * 
 * 功能：
 * - 为 AI 提供统一的信息栏数据访问接口
 * - 暴露变量数据、规则信息和状态数据
 * - 支持智能提示词集成
 * - 提供事件监听和数据同步机制
 * 
 * @class AIDataExposure
 */

export class AIDataExposure {
    constructor(dependencies = {}) {
        console.log('[AIDataExposure] 🤖 AI数据暴露模块初始化开始');
        
        // 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.fieldRuleManager = dependencies.fieldRuleManager || window.SillyTavernInfobar?.modules?.fieldRuleManager;
        this.panelRuleManager = dependencies.panelRuleManager || window.SillyTavernInfobar?.modules?.panelRuleManager;
        this.stScriptDataSync = dependencies.stScriptDataSync || window.SillyTavernInfobar?.modules?.stScriptDataSync;
        
        // 状态管理
        this.initialized = false;
        this.errorCount = 0;
        this.lastUpdateTime = 0;
        
        // 数据缓存
        this.dataCache = new Map();
        this.ruleCache = new Map();
        
        // AI 访问统计
        this.accessStats = {
            totalRequests: 0,
            lastAccessTime: 0,
            popularFields: new Map()
        };
        
        this.init();
    }
    
    async init() {
        try {
            // 等待依赖模块就绪
            await this.waitForDependencies();
            
            // 注册事件监听
            this.registerEventListeners();
            
            // 暴露全局接口
            this.exposeGlobalAPI();
            
            this.initialized = true;
            console.log('[AIDataExposure] ✅ AI数据暴露模块初始化完成');
            
        } catch (error) {
            console.error('[AIDataExposure] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }
    
    /**
     * 等待依赖模块就绪
     */
    async waitForDependencies() {
        const maxWait = 10000; // 10秒超时
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (this.unifiedDataCore && this.eventSystem) {
                console.log('[AIDataExposure] ✅ 依赖模块就绪');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('依赖模块未就绪，超时');
    }
    
    /**
     * 注册事件监听
     */
    registerEventListeners() {
        if (!this.eventSystem) return;
        
        // 监听数据变化事件
        this.eventSystem.on('data-changed', (data) => {
            this.onDataChanged(data);
        });
        
        // 🔧 修复：监听SmartPromptSystem的数据更新事件
        this.eventSystem.on('smart-prompt:data-updated', (data) => {
            console.log('[AIDataExposure] 📨 接收到AI数据更新事件');
            this.onDataChanged(data);
        });
        
        // 监听规则变化事件
        this.eventSystem.on('rules-changed', (data) => {
            this.onRulesChanged(data);
        });
        
        console.log('[AIDataExposure] 📡 事件监听器已注册');
    }
    
    /**
     * 暴露全局 API
     */
    exposeGlobalAPI() {
        const infobarAI = {
            // 数据访问接口
            getData: this.getData.bind(this),
            getAllData: this.getAllData.bind(this),
            getFieldData: this.getFieldData.bind(this),
            getPanelData: this.getPanelData.bind(this),
            
            // 规则访问接口
            getFieldRule: this.getFieldRule.bind(this),
            getPanelRule: this.getPanelRule.bind(this),
            getAllRules: this.getAllRules.bind(this),
            
            // 状态查询接口
            getStatus: this.getStatus.bind(this),
            getStats: this.getStats.bind(this),
            
            // 事件接口
            onDataUpdate: this.onDataUpdate.bind(this),
            offDataUpdate: this.offDataUpdate.bind(this),
            
            // 工具方法
            formatForAI: this.formatForAI.bind(this),
            generatePrompt: this.generatePrompt.bind(this)
        };
        
        // 暴露到全局
        if (typeof window !== 'undefined') {
            window.InfobarAI = infobarAI;
            
            // 同时暴露到父窗口（兼容 iframe 环境）
            if (window.parent && window.parent !== window) {
                window.parent.InfobarAI = infobarAI;
            }
            
            console.log('[AIDataExposure] 🌐 全局API已暴露: window.InfobarAI');
        }
    }
    
    /**
     * 获取指定字段的数据
     * @param {string} panelName - 面板名称
     * @param {string} fieldName - 字段名称
     * @param {Object} options - 选项
     * @returns {Object} 字段数据
     */
    async getData(panelName, fieldName, options = {}) {
        try {
            this.recordAccess(panelName, fieldName);
            
            const cacheKey = `${panelName}.${fieldName}`;
            
            // 检查缓存
            if (!options.skipCache && this.dataCache.has(cacheKey)) {
                const cached = this.dataCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 5000) { // 5秒缓存
                    return cached.data;
                }
            }
            
            // 从统一数据核心获取数据
            const panelData = await this.unifiedDataCore.getData(`panels.${panelName}`, 'chat');
            const fieldData = panelData?.[fieldName];
            
            if (!fieldData) {
                return null;
            }
            
            // 解析数据格式 [value, rule?]
            const result = {
                value: Array.isArray(fieldData) ? fieldData[0] : fieldData,
                rule: Array.isArray(fieldData) && fieldData.length > 1 ? fieldData[1] : null,
                panelName,
                fieldName,
                timestamp: Date.now()
            };
            
            // 缓存结果
            this.dataCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
            
        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取数据失败:', error);
            this.handleError(error);
            return null;
        }
    }
    
    /**
     * 获取所有数据（格式化为 AI 友好的结构）
     * @param {Object} options - 选项
     * @returns {Object} 所有数据
     */
    async getAllData(options = {}) {
        try {
            this.recordAccess('*', '*');
            
            // 从 STScript 同步模块获取完整的 infobar 结构
            const infobarData = await this.stScriptDataSync?.getInfobarStructure() || {};
            
            const result = {
                panels: {},
                summary: {
                    totalPanels: 0,
                    totalFields: 0,
                    lastUpdate: this.lastUpdateTime
                },
                metadata: {
                    timestamp: Date.now(),
                    source: 'InfobarAI'
                }
            };
            
            // 处理每个面板
            for (const [panelName, panelData] of Object.entries(infobarData)) {
                if (typeof panelData !== 'object' || panelData === null) continue;
                
                const panel = {
                    name: panelName,
                    fields: {},
                    rules: {}
                };
                
                // 处理面板规则
                if (panelData['Panel Rules']) {
                    panel.rules.panel = panelData['Panel Rules'];
                }
                
                // 处理字段数据
                for (const [fieldName, fieldData] of Object.entries(panelData)) {
                    if (fieldName === 'Panel Rules') continue;
                    
                    if (Array.isArray(fieldData)) {
                        panel.fields[fieldName] = {
                            value: fieldData[0],
                            rule: fieldData.length > 1 ? fieldData[1] : null
                        };
                    } else {
                        panel.fields[fieldName] = {
                            value: fieldData,
                            rule: null
                        };
                    }
                    
                    result.summary.totalFields++;
                }
                
                result.panels[panelName] = panel;
                result.summary.totalPanels++;
            }
            
            return result;
            
        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取所有数据失败:', error);
            this.handleError(error);
            return { panels: {}, summary: { totalPanels: 0, totalFields: 0 } };
        }
    }
    
    /**
     * 记录访问统计
     */
    recordAccess(panelName, fieldName) {
        this.accessStats.totalRequests++;
        this.accessStats.lastAccessTime = Date.now();
        
        const key = `${panelName}.${fieldName}`;
        const count = this.accessStats.popularFields.get(key) || 0;
        this.accessStats.popularFields.set(key, count + 1);
    }
    
    /**
     * 数据变化事件处理
     */
    onDataChanged(data) {
        // 清除相关缓存
        this.dataCache.clear();
        this.lastUpdateTime = Date.now();
        
        console.log('[AIDataExposure] 🔄 数据已更新，缓存已清除');
    }
    
    /**
     * 规则变化事件处理
     */
    onRulesChanged(data) {
        // 清除规则缓存
        this.ruleCache.clear();
        
        console.log('[AIDataExposure] 📋 规则已更新，缓存已清除');
    }
    
    /**
     * 获取面板数据
     * @param {string} panelName - 面板名称
     * @param {Object} options - 选项
     * @returns {Object} 面板数据
     */
    async getPanelData(panelName, options = {}) {
        try {
            this.recordAccess(panelName, '*');

            // 从 STScript 同步模块获取面板数据
            const infobarData = await this.stScriptDataSync?.getInfobarStructure() || {};
            const panelData = infobarData[panelName];

            if (!panelData) {
                return null;
            }

            const result = {
                name: panelName,
                fields: {},
                rules: {},
                metadata: {
                    timestamp: Date.now(),
                    fieldCount: 0
                }
            };

            // 处理面板规则
            if (panelData['Panel Rules']) {
                result.rules.panel = panelData['Panel Rules'];
            }

            // 处理字段数据
            for (const [fieldName, fieldData] of Object.entries(panelData)) {
                if (fieldName === 'Panel Rules') continue;

                if (Array.isArray(fieldData)) {
                    result.fields[fieldName] = {
                        value: fieldData[0],
                        rule: fieldData.length > 1 ? fieldData[1] : null
                    };
                } else {
                    result.fields[fieldName] = {
                        value: fieldData,
                        rule: null
                    };
                }

                result.metadata.fieldCount++;
            }

            return result;

        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取面板数据失败:', error);
            this.handleError(error);
            return null;
        }
    }

    /**
     * 获取字段数据（别名方法）
     * @param {string} panelName - 面板名称
     * @param {string} fieldName - 字段名称
     * @param {Object} options - 选项
     * @returns {Object} 字段数据
     */
    async getFieldData(panelName, fieldName, options = {}) {
        return await this.getData(panelName, fieldName, options);
    }

    /**
     * 获取字段规则
     * @param {string} panelName - 面板名称
     * @param {string} fieldName - 字段名称
     * @returns {string|null} 字段规则
     */
    async getFieldRule(panelName, fieldName) {
        try {
            // 直接从字段规则管理器获取（同步方法）
            if (this.fieldRuleManager) {
                const rule = this.fieldRuleManager.getFieldRule(panelName, fieldName);
                if (rule) {
                    // 提取规则描述文本
                    if (rule.rules && rule.rules.description) {
                        return rule.rules.description;
                    }
                    if (rule.content) {
                        return rule.content;
                    }
                    if (rule.rule) {
                        return rule.rule;
                    }
                    // 如果有examples，组合成描述
                    if (rule.examples && rule.examples.length > 0) {
                        return `示例格式: ${rule.examples.join(', ')}`;
                    }
                    // 如果有dynamicRules，提取描述
                    if (rule.dynamicRules && rule.dynamicRules.length > 0) {
                        const descriptions = rule.dynamicRules.map(dr => `${dr.type}: ${dr.pattern || dr.value}`);
                        return descriptions.join('; ');
                    }
                }
            }

            // 备用方案：从数据中获取
            const fieldData = await this.getData(panelName, fieldName);
            return fieldData?.rule || null;
        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取字段规则失败:', error);
            return null;
        }
    }

    /**
     * 获取面板规则
     * @param {string} panelName - 面板名称
     * @returns {string|null} 面板规则
     */
    async getPanelRule(panelName) {
        try {
            // 直接从面板规则管理器获取（同步方法）
            if (this.panelRuleManager) {
                const rule = this.panelRuleManager.getPanelRule(panelName);
                if (rule) {
                    // 提取规则描述文本
                    if (rule.description) {
                        return rule.description;
                    }
                    if (rule.content) {
                        return rule.content;
                    }
                    if (rule.rule) {
                        return rule.rule;
                    }
                    // 如果有conditions，组合成描述
                    if (rule.conditions && rule.conditions.length > 0) {
                        const descriptions = rule.conditions.map(c => `${c.type} ${c.operator} ${c.value}`);
                        return `条件: ${descriptions.join(', ')}`;
                    }
                    // 如果有filterType和filterValue，组合成描述
                    if (rule.filterType && rule.filterType !== 'none') {
                        return `过滤类型: ${rule.filterType}, 过滤值: ${rule.filterValue}`;
                    }
                }
            }

            // 备用方案：从数据中获取
            const panelData = await this.getPanelData(panelName);
            return panelData?.rules?.panel || null;
        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取面板规则失败:', error);
            return null;
        }
    }

    /**
     * 获取所有规则
     * @returns {Object} 所有规则
     */
    async getAllRules() {
        try {
            const rules = {
                panels: {},
                fields: {},
                summary: {
                    totalPanelRules: 0,
                    totalFieldRules: 0
                }
            };

            // 直接从规则管理器获取所有规则
            if (this.panelRuleManager && this.panelRuleManager.panelRules) {
                try {
                    // 获取所有面板规则（从内存中的 Map 对象）
                    for (const [panelName, ruleData] of this.panelRuleManager.panelRules.entries()) {
                        if (ruleData) {
                            // 提取规则描述文本
                            let ruleText = null;
                            if (ruleData.description) {
                                ruleText = ruleData.description;
                            } else if (ruleData.content) {
                                ruleText = ruleData.content;
                            } else if (ruleData.rule) {
                                ruleText = ruleData.rule;
                            } else if (ruleData.conditions && ruleData.conditions.length > 0) {
                                const descriptions = ruleData.conditions.map(c => `${c.type} ${c.operator} ${c.value}`);
                                ruleText = `条件: ${descriptions.join(', ')}`;
                            } else if (ruleData.filterType && ruleData.filterType !== 'none') {
                                ruleText = `过滤类型: ${ruleData.filterType}, 过滤值: ${ruleData.filterValue}`;
                            }

                            if (ruleText) {
                                rules.panels[panelName] = ruleText;
                                rules.summary.totalPanelRules++;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[AIDataExposure] ⚠️ 获取面板规则失败:', error);
                }
            }

            if (this.fieldRuleManager && this.fieldRuleManager.fieldRules) {
                try {
                    // 获取所有字段规则（从内存中的 Map 对象）
                    for (const [ruleKey, ruleData] of this.fieldRuleManager.fieldRules.entries()) {
                        if (ruleData) {
                            const [panelName, fieldName] = ruleKey.split('.');
                            if (panelName && fieldName) {
                                // 提取规则描述文本
                                let ruleText = null;
                                if (ruleData.rules && ruleData.rules.description) {
                                    ruleText = ruleData.rules.description;
                                } else if (ruleData.content) {
                                    ruleText = ruleData.content;
                                } else if (ruleData.rule) {
                                    ruleText = ruleData.rule;
                                } else if (ruleData.examples && ruleData.examples.length > 0) {
                                    ruleText = `示例格式: ${ruleData.examples.join(', ')}`;
                                } else if (ruleData.dynamicRules && ruleData.dynamicRules.length > 0) {
                                    const descriptions = ruleData.dynamicRules.map(dr => `${dr.type}: ${dr.pattern || dr.value}`);
                                    ruleText = descriptions.join('; ');
                                }

                                if (ruleText) {
                                    // 使用平铺结构：panelName.fieldName 作为键
                                    const fieldKey = `${panelName}.${fieldName}`;
                                    rules.fields[fieldKey] = {
                                        description: ruleText,
                                        format: ruleData.format,
                                        type: ruleData.type,
                                        range: ruleData.range,
                                        changeRate: ruleData.changeRate,
                                        examples: ruleData.examples,
                                        categories: ruleData.categories,
                                        intensity: ruleData.intensity,
                                        validation: ruleData.validation,
                                        dynamicRules: ruleData.dynamicRules,
                                        preferredUnit: ruleData.preferredUnit,  // 🔧 新增：优先单位
                                        units: ruleData.units                   // 🔧 新增：单位列表
                                    };
                                    rules.summary.totalFieldRules++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[AIDataExposure] ⚠️ 获取字段规则失败:', error);
                }
            }

            // 备用方案：从数据中获取规则
            if (rules.summary.totalPanelRules === 0 && rules.summary.totalFieldRules === 0) {
                const allData = await this.getAllData();
                for (const [panelName, panelData] of Object.entries(allData.panels || {})) {
                    // 面板规则
                    if (panelData.rules?.panel) {
                        rules.panels[panelName] = panelData.rules.panel;
                        rules.summary.totalPanelRules++;
                    }

                    // 字段规则
                    for (const [fieldName, fieldData] of Object.entries(panelData.fields || {})) {
                        if (fieldData.rule) {
                            if (!rules.fields[panelName]) {
                                rules.fields[panelName] = {};
                            }
                            rules.fields[panelName][fieldName] = fieldData.rule;
                            rules.summary.totalFieldRules++;
                        }
                    }
                }
            }

            return rules;

        } catch (error) {
            console.error('[AIDataExposure] ❌ 获取所有规则失败:', error);
            return { panels: {}, fields: {}, summary: { totalPanelRules: 0, totalFieldRules: 0 } };
        }
    }

    /**
     * 获取模块状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            lastUpdateTime: this.lastUpdateTime,
            cacheSize: {
                data: this.dataCache.size,
                rules: this.ruleCache.size
            },
            dependencies: {
                unifiedDataCore: !!this.unifiedDataCore,
                eventSystem: !!this.eventSystem,
                fieldRuleManager: !!this.fieldRuleManager,
                panelRuleManager: !!this.panelRuleManager,
                stScriptDataSync: !!this.stScriptDataSync
            }
        };
    }

    /**
     * 获取访问统计
     * @returns {Object} 统计信息
     */
    getStats() {
        const popularFields = Array.from(this.accessStats.popularFields.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([field, count]) => ({ field, count }));

        return {
            ...this.accessStats,
            popularFields
        };
    }

    /**
     * 事件监听器注册
     * @param {Function} callback - 回调函数
     */
    onDataUpdate(callback) {
        if (!this.eventSystem) return;

        this.eventSystem.on('data-changed', callback);
        console.log('[AIDataExposure] 📡 已注册数据更新监听器');
    }

    /**
     * 移除事件监听器
     * @param {Function} callback - 回调函数
     */
    offDataUpdate(callback) {
        if (!this.eventSystem) return;

        this.eventSystem.off('data-changed', callback);
        console.log('[AIDataExposure] 📡 已移除数据更新监听器');
    }

    /**
     * 格式化数据为 AI 友好的格式
     * @param {Object} data - 原始数据
     * @param {Object} options - 格式化选项
     * @returns {string} 格式化后的文本
     */
    formatForAI(data, options = {}) {
        try {
            const {
                includeRules = true,
                includeMetadata = false,
                format = 'structured' // 'structured' | 'natural' | 'json'
            } = options;

            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            }

            if (format === 'natural') {
                return this.formatAsNaturalLanguage(data, { includeRules });
            }

            // 默认结构化格式
            return this.formatAsStructured(data, { includeRules, includeMetadata });

        } catch (error) {
            console.error('[AIDataExposure] ❌ 格式化数据失败:', error);
            return '数据格式化失败';
        }
    }

    /**
     * 格式化为结构化文本
     */
    formatAsStructured(data, options) {
        let result = '';

        if (data.panels) {
            result += '=== 信息栏数据 ===\n\n';

            for (const [panelName, panelData] of Object.entries(data.panels)) {
                result += `【${panelName}】\n`;

                // 面板规则
                if (options.includeRules && panelData.rules?.panel) {
                    result += `  规则: ${panelData.rules.panel}\n`;
                }

                // 字段数据
                for (const [fieldName, fieldData] of Object.entries(panelData.fields)) {
                    // 🔧 修复：对交互面板字段进行格式规范化显示
                    let displayFieldName = fieldName;
                    if (panelName === 'interaction') {
                        if (!fieldName.match(/^npc\d+\./)) {
                            // 错误格式，规范化为 npc0 前缀
                            displayFieldName = `npc0.${fieldName} (已规范化)`;
                        }
                    }

                    result += `  ${displayFieldName}: ${fieldData.value}`;
                    if (options.includeRules && fieldData.rule) {
                        result += ` (规则: ${fieldData.rule})`;
                    }
                    result += '\n';
                }

                result += '\n';
            }
        } else if (data.value !== undefined) {
            // 单个字段数据
            result += `${data.fieldName}: ${data.value}`;
            if (options.includeRules && data.rule) {
                result += ` (规则: ${data.rule})`;
            }
        }

        return result;
    }

    /**
     * 格式化为自然语言
     */
    formatAsNaturalLanguage(data, options) {
        let result = '';

        if (data.panels) {
            const panelCount = Object.keys(data.panels).length;
            result += `当前信息栏包含 ${panelCount} 个面板：\n\n`;

            for (const [panelName, panelData] of Object.entries(data.panels)) {
                const fieldCount = Object.keys(panelData.fields).length;
                result += `${panelName}面板有 ${fieldCount} 个字段：`;

                const fieldDescriptions = [];
                for (const [fieldName, fieldData] of Object.entries(panelData.fields)) {
                    let desc = `${fieldName}为${fieldData.value}`;
                    if (options.includeRules && fieldData.rule) {
                        desc += `（${fieldData.rule}）`;
                    }
                    fieldDescriptions.push(desc);
                }

                result += fieldDescriptions.join('，') + '。\n\n';
            }
        }

        return result;
    }

    /**
     * 生成 AI 提示词
     * @param {Object} options - 生成选项
     * @returns {string} 提示词
     */
    async generatePrompt(options = {}) {
        try {
            const {
                includeCurrentData = true,
                includeRules = true,
                includeInstructions = true,
                customInstructions = ''
            } = options;

            let prompt = '';

            // 基础说明
            if (includeInstructions) {
                prompt += '# 信息栏系统说明\n\n';
                prompt += '你可以通过以下方式访问和更新角色信息栏数据：\n';
                prompt += '- 使用 InfobarAI.getData(面板名, 字段名) 获取特定字段数据\n';
                prompt += '- 使用 InfobarAI.getAllData() 获取所有数据\n';
                prompt += '- 数据更新会自动同步到信息栏显示\n\n';
            }

            // 当前数据
            if (includeCurrentData) {
                const currentData = await this.getAllData();
                prompt += '# 当前信息栏数据\n\n';
                prompt += this.formatForAI(currentData, {
                    includeRules,
                    format: 'structured'
                });
                prompt += '\n';
            }

            // 自定义指令
            if (customInstructions) {
                prompt += '# 特殊指令\n\n';
                prompt += customInstructions + '\n\n';
            }

            // 规则说明
            if (includeRules) {
                const rules = await this.getAllRules();
                if (rules.summary.totalFieldRules > 0 || rules.summary.totalPanelRules > 0) {
                    prompt += '# 数据更新规则\n\n';
                    prompt += '请严格按照以下规则更新数据：\n\n';

                    // 面板规则
                    for (const [panelName, panelRule] of Object.entries(rules.panels)) {
                        prompt += `【${panelName}面板规则】: ${panelRule}\n`;
                    }

                    // 字段规则
                    for (const [panelName, panelFields] of Object.entries(rules.fields)) {
                        for (const [fieldName, fieldRule] of Object.entries(panelFields)) {
                            prompt += `【${panelName}.${fieldName}规则】: ${fieldRule}\n`;
                        }
                    }

                    prompt += '\n';
                }
            }

            return prompt;

        } catch (error) {
            console.error('[AIDataExposure] ❌ 生成提示词失败:', error);
            return '# 信息栏数据\n\n数据获取失败，请检查系统状态。\n';
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[AIDataExposure] ❌ 错误:', error);

        // 如果错误过多，重置模块
        if (this.errorCount > 10) {
            console.warn('[AIDataExposure] ⚠️ 错误过多，重置模块');
            this.errorCount = 0;
            this.dataCache.clear();
            this.ruleCache.clear();
        }
    }
}
