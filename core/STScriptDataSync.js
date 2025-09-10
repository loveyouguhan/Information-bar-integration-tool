/**
 * STScript数据同步模块
 * 
 * 负责将Information bar integration tool的记忆数据同步到SillyTavern的STScript变量系统
 * 支持双向同步、自定义宏系统和实时数据更新
 * 
 * @class STScriptDataSync
 */

export class STScriptDataSync {
    constructor(unifiedDataCore, eventSystem = null, summaryManager = null) {
        console.log('[STScript同步] 🔧 STScript数据同步模块初始化开始');

        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.summaryManager = summaryManager; // 🆕 添加总结管理器引用

        // SillyTavern上下文
        this.context = null;

        // 同步配置
        this.syncEnabled = true;
        this.syncQueue = [];
        this.syncInProgress = false;
        this.syncTimeout = null;

        // 🆕 总结同步配置
        this.summarySyncEnabled = true;
        this.summaryCache = new Map();
        this.lastSummarySyncTime = 0;

        // 宏系统
        this.macroCache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存
        this.macroProcessors = new Map();

        // 统计信息
        this.syncCount = 0;
        this.errorCount = 0;
        this.lastSyncTime = 0;
        this.summarySyncCount = 0; // 🆕 总结同步计数

        // 初始化状态
        this.initialized = false;
        this.isRollbackSyncing = false; // 🔧 优化：防止重复回溯同步
        this.lastDataChangeTime = 0; // 🔧 新增：防抖时间戳

        console.log('[STScript同步] 🏗️ 构造函数完成');
    }

    /**
     * 初始化STScript同步系统
     */
    async initialize() {
        try {
            console.log('[STScript同步] 🚀 开始初始化...');
            
            // 获取SillyTavern上下文
            this.context = SillyTavern?.getContext?.();
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }
            
            // 验证STScript功能可用性
            await this.validateSTScriptEnvironment();
            
            // 注册自定义STScript命令
            await this.registerCustomCommands();
            
            // 注册内置宏处理器
            this.registerBuiltinMacros();
            
            // 设置宏替换钩子
            this.setupMacroHooks();
            
            // 监听数据变更事件
            this.setupDataChangeListeners();

            // 🆕 监听总结事件
            this.setupSummaryEventListeners();

            // 🆕 监听规则更新事件
            this.setupRuleUpdateListeners();

            // 执行初始同步
            await this.performInitialSync();

            // 执行数据结构迁移
            await this.migrateToNestedStructure();

            this.initialized = true;
            console.log('[STScript同步] ✅ 初始化完成');
            
        } catch (error) {
            console.error('[STScript同步] ❌ 初始化失败:', error);
            this.errorCount++;
            throw error;
        }
    }

    /**
     * 验证STScript环境
     */
    async validateSTScriptEnvironment() {
        const requiredFunctions = [
            'substituteParams',
            'executeSlashCommands', 
            'registerSlashCommand'
        ];
        
        for (const funcName of requiredFunctions) {
            if (typeof this.context[funcName] !== 'function') {
                throw new Error(`STScript功能 ${funcName} 不可用`);
            }
        }
        
        // 测试基本功能
        const testResult = this.context.substituteParams('{{user}}');
        if (!testResult) {
            console.warn('[STScript同步] ⚠️ 宏替换功能可能有问题');
        }
        
        console.log('[STScript同步] ✅ STScript环境验证通过');
    }

    /**
     * 注册自定义STScript命令
     */
    async registerCustomCommands() {
        try {
            // 注册信息栏数据获取命令
            this.context.registerSlashCommand(
                'infobar-get',
                this.handleInfoBarGet.bind(this),
                ['获取信息栏数据'],
                '获取指定面板的信息栏数据: /infobar-get panel=personal field=name',
                true,
                true
            );
            
            // 注册信息栏数据设置命令  
            this.context.registerSlashCommand(
                'infobar-set',
                this.handleInfoBarSet.bind(this),
                ['设置信息栏数据'],
                '设置信息栏数据: /infobar-set panel=personal field=name value=张三',
                true,
                true
            );
            
            // 注册信息栏同步命令
            this.context.registerSlashCommand(
                'infobar-sync',
                this.handleInfoBarSync.bind(this),
                ['同步信息栏数据'],
                '手动同步信息栏数据到STScript变量',
                true,
                true
            );
            
            // 注册信息栏状态命令
            this.context.registerSlashCommand(
                'infobar-status',
                this.handleInfoBarStatus.bind(this),
                ['查看信息栏状态'],
                '查看信息栏同步状态和统计信息',
                true,
                true
            );

            // 🆕 注册总结同步命令
            this.context.registerSlashCommand(
                'summary-sync',
                this.handleSummarySync.bind(this),
                ['同步总结数据'],
                '手动同步总结数据到STScript变量',
                true,
                true
            );

            // 🆕 注册总结获取命令
            this.context.registerSlashCommand(
                'summary-get',
                this.handleSummaryGet.bind(this),
                ['获取总结数据'],
                '获取总结数据: /summary-get [latest|all|count|1|2|3]',
                true,
                true
            );

            // 🆕 注册总结状态命令
            this.context.registerSlashCommand(
                'summary-status',
                this.handleSummaryStatus.bind(this),
                ['查看总结状态'],
                '查看总结同步状态和统计信息',
                true,
                true
            );

            // 🆕 注册规则同步启用命令
            this.context.registerSlashCommand(
                'infobar-rules-enable',
                this.handleRulesEnable.bind(this),
                ['启用规则同步'],
                '启用信息栏规则同步功能',
                true,
                true
            );

            // 🆕 注册规则同步禁用命令
            this.context.registerSlashCommand(
                'infobar-rules-disable',
                this.handleRulesDisable.bind(this),
                ['禁用规则同步'],
                '禁用信息栏规则同步功能',
                true,
                true
            );

            // 🆕 注册规则同步状态命令
            this.context.registerSlashCommand(
                'infobar-rules-status',
                this.handleRulesStatus.bind(this),
                ['查看规则同步状态'],
                '查看信息栏规则同步状态',
                true,
                true
            );

            // 🆕 注册AI数据访问测试命令
            this.context.registerSlashCommand(
                'infobar-ai-test',
                this.handleAIDataTest.bind(this),
                ['测试AI数据访问'],
                '测试AI数据暴露功能: /infobar-ai-test [all|panel=面板名|field=面板名.字段名]',
                true,
                true
            );

            // 🆕 注册AI提示词生成命令
            this.context.registerSlashCommand(
                'infobar-ai-prompt',
                this.handleAIPromptGenerate.bind(this),
                ['生成AI提示词'],
                '生成包含信息栏数据的AI提示词: /infobar-ai-prompt [rules=true|false] [format=structured|natural]',
                true,
                true
            );

            console.log('[STScript同步] ✅ 自定义命令注册完成');
            
        } catch (error) {
            console.error('[STScript同步] ❌ 命令注册失败:', error);
            throw error;
        }
    }

    /**
     * 核心同步功能：将记忆数据同步到STScript变量
     */
    async syncMemoryDataToSTScript() {
        if (!this.syncEnabled || this.syncInProgress) {
            return;
        }
        
        try {
            this.syncInProgress = true;
            console.log('[STScript同步] 🔄 开始同步记忆数据...');
            
            // 获取所有记忆数据
            const memoryData = await this.unifiedDataCore.getMemoryData();
            
            if (!memoryData || Object.keys(memoryData).length === 0) {
                console.log('[STScript同步] ⚠️ 没有记忆数据需要同步');
                return;
            }
            
            // 同步每个面板的数据
            let syncedPanels = 0;
            for (const [panelName, panelData] of Object.entries(memoryData)) {
                if (panelData && typeof panelData === 'object') {
                    await this.syncPanelData(panelName, panelData);
                    syncedPanels++;
                }
            }
            
            // 更新统计信息
            this.syncCount++;
            this.lastSyncTime = Date.now();
            
            console.log(`[STScript同步] ✅ 记忆数据同步完成，同步了 ${syncedPanels} 个面板`);
            
            // 触发同步完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('stscriptSyncCompleted', {
                    syncedPanels,
                    timestamp: this.lastSyncTime
                });
            }
            
        } catch (error) {
            console.error('[STScript同步] ❌ 同步失败:', error);
            this.errorCount++;
            
            if (this.eventSystem) {
                this.eventSystem.emit('stscriptSyncError', { error: error.message });
            }
            
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 同步单个面板数据
     */
    async syncPanelData(panelName, panelData) {
        try {
            // 构建面板的嵌套结构
            const panelStructure = this.buildPanelStructure(panelName, panelData);

            // 更新主infobar变量的嵌套结构
            await this.updateInfobarStructure(panelName, panelStructure);

            console.log(`[STScript同步] ✅ 面板 ${panelName} 同步到嵌套结构完成`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 面板 ${panelName} 同步失败:`, error);
            throw error;
        }
    }

    /**
     * 构建面板的嵌套结构
     */
    buildPanelStructure(panelName, panelData) {
        try {
            // 构建新的面板结构：每个字段都是一个数组 [值, 字段规则(如果有)]
            const panelStructure = {};

            // 遍历面板数据，为每个字段创建数组结构
            for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                if (this.isValidFieldValue(fieldValue) && !this.isMetadataField(fieldName)) {
                    // 获取字段规则（只有用户设置了才返回）
                    const fieldRules = this.getFieldRules(panelName, fieldName);

                    if (fieldRules) {
                        // 有字段规则：创建字段数组 [值, 字段规则]
                        panelStructure[fieldName] = [String(fieldValue), fieldRules];
                    } else {
                        // 无字段规则：只存储值
                        panelStructure[fieldName] = [String(fieldValue)];
                    }
                }
            }

            // 添加面板级别的规则（只有用户设置了才添加）
            const panelRules = this.getPanelRules(panelName);
            if (panelRules) {
                panelStructure['Panel Rules'] = panelRules;
            }

            console.log(`[STScript同步] 🔧 构建面板结构 ${panelName}:`, {
                fieldsCount: Object.keys(panelStructure).length - (panelRules ? 1 : 0),
                hasPanelRules: !!panelRules
            });

            return panelStructure;

        } catch (error) {
            console.error(`[STScript同步] ❌ 构建面板结构失败:`, error);
            return {};
        }
    }

    /**
     * 获取字段规则（只有用户设置了才返回）
     */
    getFieldRules(panelName, fieldName) {
        try {
            // 检查是否启用了规则同步
            if (!this.shouldSyncRules()) {
                return null;
            }

            // 从字段规则管理器获取规则
            if (window.SillyTavernInfobar?.modules?.fieldRuleManager) {
                const ruleManager = window.SillyTavernInfobar.modules.fieldRuleManager;
                const fieldRules = ruleManager.getFieldRule(panelName, fieldName);
                // 只有当规则存在且不为空时才返回
                if (fieldRules && fieldRules.trim()) {
                    return fieldRules.trim();
                }
            }

            // 如果没有找到字段规则或规则为空，返回null
            return null;

        } catch (error) {
            console.error(`[STScript同步] ❌ 获取字段规则失败 ${panelName}.${fieldName}:`, error);
            return null;
        }
    }

    /**
     * 获取面板规则（只有用户设置了才返回）
     */
    getPanelRules(panelName) {
        try {
            // 检查是否启用了规则同步
            if (!this.shouldSyncRules()) {
                return null;
            }

            // 从面板规则管理器获取规则
            if (window.SillyTavernInfobar?.modules?.panelRuleManager) {
                const ruleManager = window.SillyTavernInfobar.modules.panelRuleManager;
                const panelRules = ruleManager.getPanelRule(panelName);
                // 只有当规则存在且不为空时才返回
                if (panelRules && panelRules.trim()) {
                    return panelRules.trim();
                }
            }

            // 如果没有找到面板规则或规则为空，返回null
            return null;

        } catch (error) {
            console.error(`[STScript同步] ❌ 获取面板规则失败 ${panelName}:`, error);
            return null;
        }
    }

    /**
     * 启用规则同步
     */
    async enableRulesSync() {
        try {
            await this.setSTScriptVariable('infobar_sync_rules', 'true', 'chat');
            console.log('[STScript同步] ✅ 规则同步已启用');
        } catch (error) {
            console.error('[STScript同步] ❌ 启用规则同步失败:', error);
        }
    }

    /**
     * 禁用规则同步
     */
    async disableRulesSync() {
        try {
            await this.setSTScriptVariable('infobar_sync_rules', 'false', 'chat');
            console.log('[STScript同步] ✅ 规则同步已禁用');
        } catch (error) {
            console.error('[STScript同步] ❌ 禁用规则同步失败:', error);
        }
    }

    /**
     * 检查是否应该同步规则
     */
    shouldSyncRules() {
        try {
            // 检查是否有规则同步标志
            const syncRulesFlag = this.getSTScriptVariableSync('infobar_sync_rules', 'chat');
            return syncRulesFlag === 'true' || syncRulesFlag === '1';
        } catch (error) {
            console.error('[STScript同步] ❌ 检查规则同步标志失败:', error);
            return false;
        }
    }

    /**
     * 提取面板的成员数组
     */
    extractPanelMembers(panelData) {
        try {
            const members = [];

            // 遍历面板数据，提取有效的字段值
            for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                if (this.isValidFieldValue(fieldValue)) {
                    // 跳过元数据字段
                    if (!this.isMetadataField(fieldName)) {
                        members.push(String(fieldValue));
                    }
                }
            }

            return members;

        } catch (error) {
            console.error(`[STScript同步] ❌ 提取面板成员失败:`, error);
            return [];
        }
    }

    /**
     * 检查是否为元数据字段
     */
    isMetadataField(fieldName) {
        const metadataFields = [
            'lastUpdated', 'source', 'timestamp', 'created', 'modified'
        ];
        return metadataFields.includes(fieldName);
    }



    /**
     * 更新主infobar变量的嵌套结构
     */
    async updateInfobarStructure(panelName, panelStructure) {
        try {
            // 获取当前的infobar结构
            let infobarData = await this.getInfobarStructure();

            // 读取已有面板数据，用于合并以保留用户设置的规则
            const existingPanel = infobarData[panelName] || {};
            const mergedPanel = {};

            // 先拷贝旧面板，作为基线（防止遗漏已有规则）
            for (const [field, value] of Object.entries(existingPanel)) {
                mergedPanel[field] = value;
            }

            // 合并新结构：值以新为准；规则若新缺失而旧存在则保留旧规则
            for (const [field, newData] of Object.entries(panelStructure)) {
                if (field === 'Panel Rules') {
                    // 若新结构包含面板规则则覆盖，否则保留旧有
                    if (newData && typeof newData === 'string' && newData.trim()) {
                        mergedPanel['Panel Rules'] = newData;
                    } else if (existingPanel['Panel Rules']) {
                        mergedPanel['Panel Rules'] = existingPanel['Panel Rules'];
                    }
                    continue;
                }

                // 字段数据：新格式应为数组 [value] 或 [value, rule]
                if (Array.isArray(newData)) {
                    const newValue = newData[0];
                    const newRule = newData.length > 1 ? newData[1] : undefined;
                    const oldData = existingPanel[field];

                    if (Array.isArray(oldData)) {
                        const oldRule = oldData.length > 1 ? oldData[1] : undefined;
                        // 如果新没有规则而旧有规则，则保留旧规则
                        const finalRule = (newRule && String(newRule).trim()) ? newRule : (oldRule && String(oldRule).trim()) ? oldRule : undefined;
                        mergedPanel[field] = finalRule !== undefined ? [String(newValue), String(finalRule)] : [String(newValue)];
                    } else {
                        mergedPanel[field] = newRule !== undefined ? [String(newValue), String(newRule)] : [String(newValue)];
                    }
                } else {
                    // 兼容旧格式，直接覆盖
                    mergedPanel[field] = newData;
                }
            }

            // 将合并结果写回
            infobarData[panelName] = mergedPanel;

            // 保存更新后的结构
            await this.setSTScriptVariable('infobar', JSON.stringify(infobarData), 'chat');

            console.log(`[STScript同步] 🔄 更新infobar结构（合并保留规则），面板: ${panelName}`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 更新infobar结构失败:`, error);
            throw error;
        }
    }

    /**
     * 获取当前的infobar结构
     */
    getInfobarStructure() {
        try {
            const infobarJson = this.getSTScriptVariableSync('infobar', 'chat');

            if (infobarJson && infobarJson !== '') {
                try {
                    const parsed = JSON.parse(infobarJson);
                    // 检查是否有有效数据
                    if (parsed && Object.keys(parsed).length > 0) {
                        return parsed;
                    }
                } catch (parseError) {
                    console.warn('[STScript同步] ⚠️ infobar数据解析失败，尝试重新同步');
                }
            }

            // 如果没有有效数据，尝试从内存数据创建结构
            console.log('[STScript同步] 📊 infobar变量为空，尝试执行完整同步...');

            // 执行一次完整同步来创建结构
            this.syncMemoryDataToSTScript().then(() => {
                console.log('[STScript同步] ✅ 完整同步完成');
            }).catch(error => {
                console.error('[STScript同步] ❌ 完整同步失败:', error);
            });

            // 返回空结构，让调用者稍后重试
            return {};

        } catch (error) {
            console.error(`[STScript同步] ❌ 获取infobar结构失败:`, error);
            return {};
        }
    }

    /**
     * 从内存数据创建infobar结构
     */
    createInfobarStructureFromMemory() {
        try {
            if (!this.unifiedDataCore) {
                console.warn('[STScript同步] ⚠️ 数据核心不可用，返回空结构');
                return {};
            }

            // 使用同步方法获取内存数据
            const memoryData = this.unifiedDataCore.getMemoryData();
            console.log('[STScript同步] 🔍 获取到的内存数据:', memoryData ? Object.keys(memoryData) : 'null');

            if (!memoryData || Object.keys(memoryData).length === 0) {
                console.log('[STScript同步] ℹ️ 内存数据为空，返回空结构');
                return {};
            }

            console.log('[STScript同步] 🔄 从内存数据创建infobar结构...');

            const infobarStructure = {};

            // 遍历所有面板数据
            for (const [panelName, panelData] of Object.entries(memoryData)) {
                if (panelData && typeof panelData === 'object') {
                    const panelStructure = {};

                    // 转换字段数据为新格式
                    for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                            // 检查是否有字段规则
                            const fieldRules = this.getFieldRules(panelName, fieldName);

                            if (fieldRules) {
                                // 有规则：[值, 规则]
                                panelStructure[fieldName] = [String(fieldValue), fieldRules];
                            } else {
                                // 无规则：[值]
                                panelStructure[fieldName] = [String(fieldValue)];
                            }
                        }
                    }

                    // 检查是否有面板规则
                    const panelRules = this.getPanelRules(panelName);
                    if (panelRules) {
                        panelStructure['Panel Rules'] = panelRules;
                    }

                    infobarStructure[panelName] = panelStructure;
                }
            }

            // 保存新创建的结构
            this.setSTScriptVariable('infobar', JSON.stringify(infobarStructure), 'chat');

            console.log('[STScript同步] ✅ infobar结构创建完成，面板数量:', Object.keys(infobarStructure).length);

            return infobarStructure;

        } catch (error) {
            console.error('[STScript同步] ❌ 创建infobar结构失败:', error);
            return {};
        }
    }

    /**
     * 检查字段值是否适合同步
     */
    isValidFieldValue(value) {
        return value !== null && 
               value !== undefined && 
               value !== '' &&
               (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
    }

    /**
     * 设置STScript变量的统一接口
     */
    async setSTScriptVariable(varName, value, scope = 'chat') {
        try {
            // 清理变量名（移除特殊字符）
            const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
            
            const command = scope === 'global' 
                ? `/setglobalvar key=${cleanVarName} ${value}`
                : `/setvar key=${cleanVarName} ${value}`;
                
            const result = await this.context.executeSlashCommands(command);
            
            if (result.isError) {
                throw new Error(`STScript命令执行失败: ${result.pipe}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`[STScript同步] 变量设置失败 ${varName}:`, error);
            throw error;
        }
    }

    /**
     * 读取STScript变量的统一接口
     */
    getSTScriptVariable(varName, scope = 'chat') {
        try {
            const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');

            const macro = scope === 'global'
                ? `{{getglobalvar::${cleanVarName}}}`
                : `{{getvar::${cleanVarName}}}`;

            const result = this.context.substituteParams(macro);

            // 如果返回的是Promise，等待结果
            if (result && typeof result.then === 'function') {
                return result;
            }

            return result;

        } catch (error) {
            console.error(`[STScript同步] 变量读取失败 ${varName}:`, error);
            return '';
        }
    }

    /**
     * 同步读取STScript变量
     */
    getSTScriptVariableSync(varName, scope = 'chat') {
        try {
            const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');

            const macro = scope === 'global'
                ? `{{getglobalvar::${cleanVarName}}}`
                : `{{getvar::${cleanVarName}}}`;

            return this.context.substituteParams(macro);

        } catch (error) {
            console.error(`[STScript同步] ❌ 同步读取变量失败 ${varName}:`, error);
            return '';
        }
    }

    /**
     * 自定义宏替换系统
     */
    replaceInfoBarMacros(text) {
        if (!text || typeof text !== 'string') return text;

        // 支持复杂的宏语法：{{infobar:panel.field}} 或 {{infobar:panel}}
        return text.replace(/\{\{infobar:([^}]+)\}\}/g, (match, path) => {
            try {
                const parts = path.split('.');
                const panelName = parts[0];
                const fieldName = parts[1];

                // 检查缓存
                const cacheKey = `infobar:${path}`;
                if (this.macroCache.has(cacheKey)) {
                    const cached = this.macroCache.get(cacheKey);
                    if (Date.now() - cached.timestamp < this.cacheTimeout) {
                        return cached.value;
                    }
                }

                let result = '';

                // 从新的嵌套结构获取数据
                result = this.getFromNestedStructure(panelName, fieldName);

                // 如果新结构没有数据，尝试从旧的分散变量获取（向后兼容）
                if (!result) {
                    result = this.getFromLegacyStructure(panelName, fieldName);
                }

                // 缓存结果
                this.macroCache.set(cacheKey, {
                    value: result,
                    timestamp: Date.now()
                });

                return result;

            } catch (error) {
                console.error('[STScript同步] 宏替换失败:', error);
                return match; // 返回原始宏，避免破坏文本
            }
        });
    }

    /**
     * 格式化面板数据为可读文本
     */
    formatPanelData(panelData) {
        if (typeof panelData !== 'object' || panelData === null) {
            return String(panelData);
        }

        return Object.entries(panelData)
            .filter(([key, value]) => this.isValidFieldValue(value))
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    /**
     * 注册内置宏处理器
     */
    registerBuiltinMacros() {
        // 获取面板摘要
        this.macroProcessors.set('summary', async (panelName) => {
            const panelData = await this.unifiedDataCore.getPanelData(panelName);
            if (!panelData) return `面板 ${panelName} 不存在`;

            return this.formatPanelData(panelData);
        });

        // 获取面板字段数量
        this.macroProcessors.set('count', async (panelName) => {
            const panelData = await this.unifiedDataCore.getPanelData(panelName);
            if (!panelData) return '0';

            return Object.keys(panelData).length.toString();
        });

        // 检查字段是否存在
        this.macroProcessors.set('exists', async (panelName, fieldName) => {
            const panelData = await this.unifiedDataCore.getPanelData(panelName);
            if (!panelData) return 'false';

            return (fieldName in panelData).toString();
        });

        console.log('[STScript同步] ✅ 内置宏处理器注册完成');
    }

    /**
     * 设置宏替换钩子
     */
    setupMacroHooks() {
        // Hook到SillyTavern的宏替换流程
        const originalSubstituteParams = this.context.substituteParams;

        this.context.substituteParams = (text) => {
            // 先执行我们的自定义宏替换
            let processedText = this.replaceInfoBarMacros(text);

            // 再执行SillyTavern的原生宏替换
            return originalSubstituteParams.call(this.context, processedText);
        };

        console.log('[STScript同步] ✅ 宏替换钩子已设置');
    }

    /**
     * 监听数据变更事件
     */
    setupDataChangeListeners() {
        if (!this.eventSystem) {
            console.warn('[STScript同步] ⚠️ 事件系统不可用，无法监听数据变更');
            return;
        }

        // 监听面板字段更新事件（UnifiedDataCore实际触发的事件）
        this.eventSystem.on('panel_field_updated', (data) => {
            console.log('[STScript同步] 📡 检测到面板字段更新:', data.panelId, data.fieldName);
            this.queueFieldSync(data.panelId, data.fieldName, data.newValue);
        });

        // 监听NPC字段更新事件
        this.eventSystem.on('npc_field_updated', (data) => {
            console.log('[STScript同步] 📡 检测到NPC字段更新:', data.npcId, data.fieldName);
            this.queueFieldSync('interaction', `${data.npcId}.${data.fieldName}`, data.newValue);
        });

        // 监听数据变更事件（通用）
        this.eventSystem.on('data:changed', (data) => {
            console.log('[STScript同步] 📡 检测到数据变更:', data.key);
            if (data.key === 'xml_parsed_data') {
                // XML数据解析完成，触发全量同步
                this.queueFullSync();
            }
        });

        // 监听聊天数据变更事件
        this.eventSystem.on('chat:data:changed', (data) => {
            // 🔧 修复：防循环机制 - 避免快照创建引起的循环
            if (data && data.source === 'snapshot') {
                console.log('[STScript同步] ⚠️ 跳过快照相关的数据变更事件，防止循环');
                return;
            }
            
            // 🔧 修复：防抖机制 - 避免频繁触发
            const now = Date.now();
            if (this.lastDataChangeTime && (now - this.lastDataChangeTime) < 1000) {
                console.log('[STScript同步] ⚠️ 防抖保护：跳过1秒内的重复数据变更事件');
                return;
            }
            this.lastDataChangeTime = now;
            
            console.log('[STScript同步] 📡 检测到聊天数据变更，清理缓存');
            this.clearCache();
            
            // 🔧 修复：延迟执行同步，避免立即循环
            setTimeout(() => {
                this.queueFullSync();
            }, 200);
        });

        // 🔧 集成回溯：监听快照回溯完成事件，延迟同步变量数据
        this.eventSystem.on('snapshot:rollback:completed', async (data) => {
            console.log('[STScript同步] 🔔 收到快照回溯完成事件:', data);
            console.log('[STScript同步] 📊 将在5秒后同步变量数据');
            await this.handleRollbackCompleted(data);
        });
        
        // 🔧 调试：验证事件监听器是否正确设置
        console.log('[STScript同步] 🔧 快照回溯完成事件监听器已设置');

        console.log('[STScript同步] ✅ 数据变更监听器已设置');
    }

    /**
     * 队列化同步（避免频繁同步）
     */
    queueFullSync() {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            this.syncMemoryDataToSTScript();
        }, 1000); // 1秒延迟，合并多个变更
    }

    /**
     * 队列化面板同步
     */
    queuePanelSync(panelId, panelData) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            this.syncPanelData(panelId, panelData);
        }, 500); // 0.5秒延迟
    }

    /**
     * 🔧 集成回溯：处理快照回溯完成事件，延迟同步变量数据
     * @param {Object} data - 回溯完成事件数据 {chatId, targetFloor, snapshotId, timestamp}
     */
    async handleRollbackCompleted(data) {
        try {
            console.log('[STScript同步] 🔄 处理数据回溯完成事件:', {
                chatId: data.chatId,
                targetFloor: data.targetFloor,
                snapshotId: data.snapshotId
            });

            // 🔧 修复：检查是否应该跳过STScript同步（根据用户要求）
            if (!this.syncEnabled || this.shouldSkipRollbackSync()) {
                console.log('[STScript同步] ⏸️ STScript回溯同步已被禁用，跳过处理');
                return;
            }

            // 🔧 优化：防止重复回溯同步
            if (this.isRollbackSyncing) {
                console.log('[STScript同步] ⚠️ 回溯同步正在进行中，跳过重复处理');
                return;
            }
            this.isRollbackSyncing = true;

            // 清理缓存，确保使用最新的数据状态
            this.clearCache();

            // 🔧 优化：减少延迟到1秒，避免性能占用过久
            setTimeout(async () => {
                try {
                    console.log('[STScript同步] 📊 数据回溯稳定期结束，开始基于数据核心当前状态同步变量...');
                    
                    // 验证数据核心状态
                    const currentChatId = this.unifiedDataCore.getCurrentChatId();
                    if (currentChatId !== data.chatId) {
                        console.warn('[STScript同步] ⚠️ 聊天ID不匹配，跳过变量同步:', {
                            expected: data.chatId,
                            current: currentChatId
                        });
                        return;
                    }

                    // 🔧 调试：记录同步前的数据状态
                    const memoryDataBefore = await this.unifiedDataCore.getMemoryData();
                    console.log('[STScript同步] 📊 同步前数据核心状态:', {
                        panelCount: Object.keys(memoryDataBefore || {}).length,
                        panels: Object.keys(memoryDataBefore || {})
                    });
                    
                    // 🔧 调试：显示具体的面板数据内容（前3个面板作为样本）
                    const samplePanels = ['personal', 'world', 'interaction'];
                    const beforeData = {};
                    for (const panelName of samplePanels) {
                        if (memoryDataBefore[panelName]) {
                            const panelData = memoryDataBefore[panelName];
                            const fieldCount = Object.keys(panelData).length;
                            const hasData = fieldCount > 0;
                            
                            // 保存回溯前的数据用于对比
                            beforeData[panelName] = {
                                fieldCount,
                                sampleFields: hasData ? Object.keys(panelData).slice(0, 3) : [],
                                sampleValues: hasData ? Object.keys(panelData).slice(0, 3).map(key => panelData[key]) : []
                            };
                            
                            console.log(`[STScript同步] 📋 面板 ${panelName} 内容检查:`, {
                                fieldCount,
                                hasData,
                                sampleFields: beforeData[panelName].sampleFields,
                                sampleValues: beforeData[panelName].sampleValues
                            });
                        } else {
                            console.log(`[STScript同步] ⚠️ 面板 ${panelName} 数据为空或不存在`);
                            beforeData[panelName] = { fieldCount: 0, sampleFields: [], sampleValues: [] };
                        }
                    }
                    
                    // 🔧 调试：验证数据是否在回溯后发生了变化
                    console.log('[STScript同步] 🔄 将要基于回溯后的数据进行同步，期望数据已回溯到楼层', data.targetFloor);

                    // 🔧 修复：检查是否应该跳过嵌套结构同步
                    if (this.shouldSkipNestedStructureSync()) {
                        console.log('[STScript同步] ⏸️ 回溯时跳过嵌套结构同步（根据新策略）');
                        this.isRollbackSyncing = false;
                        return;
                    }

                    // 🔧 回溯专用：正确获取回溯后的数据并模拟正常数据变更流程
                    console.log('[STScript同步] 🔄 开始回溯专用数据同步，模拟正常数据变更流程...');
                    
                    try {
                        // 🔧 修复：正确获取聊天ID和角色ID
                        const chatId = this.unifiedDataCore.getCurrentChatId();
                        let characterId = 'default';
                        
                        try {
                            const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext?.() : null;
                            characterId = context?.characterId || 'default';
                        } catch (contextError) {
                            console.warn('[STScript同步] ⚠️ 无法获取SillyTavern上下文，使用默认角色ID');
                        }
                        
                        console.log('[STScript同步] 📋 回溯同步目标:', { chatId, characterId });
                        
                        if (chatId) {
                            // 🔧 关键：从正确的路径获取回溯后的数据（通过数据核心的正确接口）
                            console.log('[STScript同步] 🔄 从数据核心获取回溯后的面板数据...');
                            
                            // 获取当前聊天的数据（这应该是回溯后的数据）
                            const chatData = await this.unifiedDataCore.getChatData(chatId);
                            let rollbackPanelData = null;
                            
                            if (chatData && chatData.infobar_data && chatData.infobar_data.panels) {
                                rollbackPanelData = chatData.infobar_data.panels;
                                console.log('[STScript同步] 📊 成功从chatData.infobar_data.panels获取回溯数据，面板数:', Object.keys(rollbackPanelData).length);
                            } else {
                                console.warn('[STScript同步] ⚠️ 无法从chatData获取面板数据，使用getMemoryData作为备选');
                                rollbackPanelData = await this.unifiedDataCore.getMemoryData();
                            }
                            
                            if (rollbackPanelData && Object.keys(rollbackPanelData).length > 0) {
                                // 🔧 关键：模拟正常数据流程，逐个面板触发过滤合并和数据变更事件
                                console.log('[STScript同步] 🔔 模拟正常数据变更流程，逐个面板触发事件...');
                                
                                for (const [panelName, panelData] of Object.entries(rollbackPanelData)) {
                                    if (panelData && Object.keys(panelData).length > 0) {
                                        console.log(`[STScript同步] 🔄 处理回溯面板: ${panelName}，字段数: ${Object.keys(panelData).length}`);
                                        
                                        // 🔧 方法1：通过UnifiedDataCore的setData方法存储，这会触发正确的事件链
                                        const dataKey = `panels.${characterId}.${panelName}`;
                                        await this.unifiedDataCore.setData(dataKey, panelData, 'chat');
                                        console.log(`[STScript同步] 📤 已通过setData存储回溯数据: ${dataKey}`);
                                        
                                        // 小延迟确保事件处理完成
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                }
                                
                                // 🔧 方法2：额外触发xml_parsed_data事件，确保完整同步
                                console.log('[STScript同步] 🔔 触发xml_parsed_data事件，确保完整同步...');
                                if (this.eventSystem) {
                                    this.eventSystem.emit('data:changed', {
                                        key: 'xml_parsed_data',
                                        value: { rollback: true, panels: Object.keys(rollbackPanelData) },
                                        scope: 'chat',
                                        timestamp: Date.now(),
                                        source: 'rollback_resync'
                                    });
                                }
                                
                                // 等待事件处理完成
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                
                                console.log('[STScript同步] ✅ 回溯数据重新同步完成');
                            } else {
                                console.warn('[STScript同步] ⚠️ 回溯后未获取到有效的面板数据');
                            }
                        } else {
                            console.warn('[STScript同步] ⚠️ 无法获取聊天ID，使用常规同步方式');
                            await this.syncMemoryDataToSTScript();
                        }
                    } catch (rollbackSyncError) {
                        console.error('[STScript同步] ❌ 回溯专用同步失败:', rollbackSyncError);
                        console.log('[STScript同步] 🔄 回退到常规同步方式...');
                        await this.syncMemoryDataToSTScript();
                    }
                    
                    // 重新同步总结数据
                    console.log('[STScript同步] 📋 开始同步总结数据...');
                    await this.syncSummaryDataToSTScript();
                    console.log('[STScript同步] ✅ 总结数据同步完成');
                    
                    // 🔧 调试：验证回溯同步的最终效果
                    try {
                        console.log('[STScript同步] 📊 回溯同步效果验证...');
                        
                        // 🔧 重新获取数据进行验证
                        const chatId = this.unifiedDataCore.getCurrentChatId();
                        if (chatId) {
                            const finalChatData = await this.unifiedDataCore.getChatData(chatId);
                            const finalPanelData = finalChatData?.infobar_data?.panels;
                            
                            if (finalPanelData) {
                                console.log('[STScript同步] 📊 最终数据核心状态:', {
                                    panelCount: Object.keys(finalPanelData).length,
                                    panels: Object.keys(finalPanelData)
                                });
                                
                                for (const panelName of samplePanels) {
                                    if (finalPanelData[panelName]) {
                                        const afterPanelData = finalPanelData[panelName];
                                        const afterFieldCount = Object.keys(afterPanelData).length;
                                        const afterSampleValues = afterFieldCount > 0 ? Object.keys(afterPanelData).slice(0, 3).map(key => afterPanelData[key]) : [];
                                        
                                        console.log(`[STScript同步] 📋 面板 ${panelName} 最终状态:`, {
                                            fieldCount: afterFieldCount,
                                            sampleFields: afterFieldCount > 0 ? Object.keys(afterPanelData).slice(0, 3) : [],
                                            sampleValues: afterSampleValues,
                                            hasData: afterFieldCount > 0 ? '✅ 有数据' : '❌ 无数据'
                                        });
                                        
                                        // 🔧 关键：对比回溯前后的数据，检查是否真的发生了变化
                                        if (beforeData[panelName]) {
                                            const beforeSampleValues = beforeData[panelName].sampleValues;
                                            const valuesChanged = JSON.stringify(afterSampleValues) !== JSON.stringify(beforeSampleValues);
                                            
                                            console.log(`[STScript同步] 🔍 面板 ${panelName} 数据变化检查:`, {
                                                before: beforeSampleValues,
                                                after: afterSampleValues,
                                                changed: valuesChanged ? '✅ 数据已变化' : '❌ 数据未变化（快照数据与当前数据相同）'
                                            });
                                        }
                                    } else {
                                        console.log(`[STScript同步] ⚠️ 最终面板 ${panelName} 数据为空`);
                                    }
                                }
                            } else {
                                console.warn('[STScript同步] ⚠️ 无法获取最终的面板数据进行验证');
                            }
                        }
                        
                        // 🔧 验证同步统计和事件触发情况
                        console.log(`[STScript同步] 📊 同步统计验证:`, {
                            syncCount: this.syncCount,
                            lastSyncTime: new Date(this.lastSyncTime).toISOString(),
                            cacheSize: this.macroCache.size,
                            rollbackCompleted: true
                        });
                        
                        // 🔧 检查是否成功触发了数据变更事件
                        console.log('[STScript同步] 🔔 回溯同步流程总结:', {
                            dataPathUsed: '通过chatData.infobar_data.panels获取回溯数据',
                            syncMethod: '模拟正常数据变更流程',
                            eventsTriggered: '逐个面板setData + xml_parsed_data事件',
                            expectedResult: '变量应已正确回溯更新'
                        });
                        
                    } catch (verifyError) {
                        console.error('[STScript同步] ❌ 回溯效果验证失败:', verifyError);
                    }
                    
                    // 🔧 调试：验证同步后的变量状态
                    try {
                        // 尝试多种方式访问变量系统
                        let getvarFunc = null;
                        let varAccessMethod = '';
                        
                        // 方法1：直接访问全局getvar
                        if (typeof getvar === 'function') {
                            getvarFunc = getvar;
                            varAccessMethod = 'global getvar';
                        }
                        // 方法2：通过window访问
                        else if (typeof window !== 'undefined' && typeof window.getvar === 'function') {
                            getvarFunc = window.getvar;
                            varAccessMethod = 'window.getvar';
                        }
                        // 方法3：通过SillyTavern context访问
                        else if (this.context && typeof this.context.getvar === 'function') {
                            getvarFunc = this.context.getvar;
                            varAccessMethod = 'context.getvar';
                        }
                        // 方法4：通过全局变量上下文访问
                        else if (typeof window !== 'undefined' && window.SillyTavernScript && typeof window.SillyTavernScript.getvar === 'function') {
                            getvarFunc = window.SillyTavernScript.getvar;
                            varAccessMethod = 'SillyTavernScript.getvar';
                        }

                        if (getvarFunc) {
                            console.log(`[STScript同步] 🔧 使用 ${varAccessMethod} 验证变量状态`);
                            
                            const infobarStructure = getvarFunc('infobar');
                            console.log('[STScript同步] 📊 同步后变量状态验证:', {
                                hasInfobarVar: !!infobarStructure,
                                structureKeys: infobarStructure ? Object.keys(infobarStructure) : null,
                                accessMethod: varAccessMethod
                            });
                            
                            // 验证具体面板的变量内容
                            if (infobarStructure) {
                                for (const panelName of samplePanels) {
                                    const panelVar = getvarFunc(`infobar.${panelName}`);
                                    if (panelVar && typeof panelVar === 'object') {
                                        const varFieldCount = Object.keys(panelVar).length;
                                        console.log(`[STScript同步] 📋 变量 infobar.${panelName} 内容:`, {
                                            fieldCount: varFieldCount,
                                            hasData: varFieldCount > 0,
                                            sampleFields: varFieldCount > 0 ? Object.keys(panelVar).slice(0, 3) : [],
                                            sampleValues: varFieldCount > 0 ? Object.keys(panelVar).slice(0, 3).map(key => panelVar[key]) : []
                                        });
                                    } else {
                                        console.log(`[STScript同步] ⚠️ 变量 infobar.${panelName} 为空或不存在`);
                                    }
                                }
                            }
                        } else {
                            console.log('[STScript同步] ⚠️ 所有方法都无法访问变量系统，尝试替代验证...');
                            
                            // 🔧 替代验证：检查我们自己设置的变量
                            if (typeof setVar === 'function') {
                                console.log('[STScript同步] 🔧 可以使用setVar，说明变量系统应该是可用的');
                                
                                // 尝试设置一个测试变量来验证同步是否工作
                                setVar('infobar_sync_test', 'test_value');
                                console.log('[STScript同步] 🧪 设置测试变量完成');
                            } else {
                                console.log('[STScript同步] ❌ setVar也不可用，变量系统可能有问题');
                            }
                            
                            // 🔧 最后尝试：通过我们自己的设置方法验证
                            try {
                                console.log('[STScript同步] 🔧 尝试通过内部方法验证变量同步状态...');
                                
                                // 检查我们的同步统计
                                console.log('[STScript同步] 📊 同步统计信息:', {
                                    syncCount: this.syncCount,
                                    lastSyncTime: this.lastSyncTime,
                                    syncEnabled: this.syncEnabled,
                                    cacheSize: this.macroCache.size
                                });
                                
                                // 验证我们的setSTScriptVariable方法是否可用
                                if (typeof this.setSTScriptVariable === 'function') {
                                    console.log('[STScript同步] ✅ setSTScriptVariable方法可用，变量同步应该已执行');
                                    
                                    // 设置一个测试变量来确认功能正常
                                    await this.setSTScriptVariable('infobar_rollback_test', `test_${Date.now()}`, 'chat');
                                    console.log('[STScript同步] 🧪 回溯验证变量已设置');
                                } else {
                                    console.log('[STScript同步] ❌ setSTScriptVariable方法不可用');
                                }
                            } catch (verifyError) {
                                console.error('[STScript同步] ❌ 内部验证失败:', verifyError);
                            }
                        }
                    } catch (e) {
                        console.error('[STScript同步] ❌ 验证变量状态时出错:', e);
                    }
                    
                    console.log('[STScript同步] ✅ 数据回溯后变量同步完成');
                    
                    // 触发同步完成事件
                    if (this.eventSystem) {
                        this.eventSystem.emit('stscript:rollback:sync:completed', {
                            chatId: data.chatId,
                            targetFloor: data.targetFloor,
                            timestamp: Date.now()
                        });
                    }

                } catch (error) {
                    console.error('[STScript同步] ❌ 数据回溯后变量同步失败:', error);
                    
                    // 触发同步错误事件
                    if (this.eventSystem) {
                        this.eventSystem.emit('stscript:rollback:sync:error', {
                            chatId: data.chatId,
                            targetFloor: data.targetFloor,
                            error: error.message,
                            timestamp: Date.now()
                        });
                    }
                } finally {
                    // 🔧 优化：重置回溯同步标志
                    this.isRollbackSyncing = false;
                    console.log('[STScript同步] 🔓 回溯同步标志已重置');
                }
            }, 1000); // 🔧 优化：减少到1秒延迟，提升回溯性能

        } catch (error) {
            console.error('[STScript同步] ❌ 处理数据回溯完成事件失败:', error);
        }
    }

    /**
     * 队列化字段同步
     */
    async queueFieldSync(panelId, fieldName, newValue) {
        try {
            if (this.isValidFieldValue(newValue)) {
                const varName = `infobar_${panelId}_${fieldName}`;
                await this.setSTScriptVariable(varName, String(newValue), 'chat');

                // 清理相关缓存
                const cacheKey = `infobar:${panelId}.${fieldName}`;
                this.macroCache.delete(cacheKey);

                console.log(`[STScript同步] ✅ 字段 ${panelId}.${fieldName} 快速同步完成`);
            }
        } catch (error) {
            console.error(`[STScript同步] ❌ 字段同步失败:`, error);
        }
    }

    /**
     * 执行初始同步
     */
    async performInitialSync() {
        console.log('[STScript同步] 🚀 执行初始数据同步...');

        // 同步面板数据
        await this.syncMemoryDataToSTScript();

        // 🆕 同步总结数据
        if (this.summaryManager) {
            await this.syncSummaryDataToSTScript();
        }
    }

    /**
     * 迁移到新的嵌套结构
     */
    async migrateToNestedStructure() {
        try {
            console.log('[STScript同步] 🔄 开始迁移到嵌套结构...');

            // 检查是否已经迁移过
            const infobarData = await this.getInfobarStructure();
            if (infobarData && Object.keys(infobarData).length > 0) {
                console.log('[STScript同步] ℹ️ 已存在嵌套结构，跳过迁移');
                return;
            }

            // 获取当前的内存数据
            const memoryData = await this.unifiedDataCore.getMemoryData();
            if (!memoryData || Object.keys(memoryData).length === 0) {
                console.log('[STScript同步] ℹ️ 没有数据需要迁移');
                return;
            }

            // 构建新的嵌套结构
            const newInfobarStructure = {};

            for (const [panelName, panelData] of Object.entries(memoryData)) {
                const panelStructure = this.buildPanelStructure(panelName, panelData);
                newInfobarStructure[panelName] = panelStructure;
            }

            // 保存新的嵌套结构
            await this.setSTScriptVariable('infobar', JSON.stringify(newInfobarStructure), 'chat');

            console.log(`[STScript同步] ✅ 迁移完成，创建了 ${Object.keys(newInfobarStructure).length} 个面板的嵌套结构`);

            // 可选：清理旧的分散变量（暂时保留以确保兼容性）
            // await this.cleanupLegacyVariables();

        } catch (error) {
            console.error('[STScript同步] ❌ 迁移到嵌套结构失败:', error);
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.macroCache.clear();
        console.log('[STScript同步] 🧹 宏缓存已清理');
    }

    // ==================== STScript命令处理器 ====================

    /**
     * 处理 /infobar-get 命令
     */
    async handleInfoBarGet(args) {
        try {
            const panel = args.panel || args._scope?.panel;
            const field = args.field || args._scope?.field;

            if (!panel) {
                return 'ERROR: 请指定面板名称 (panel=xxx)';
            }

            if (field) {
                // 获取具体字段
                const panelData = await this.unifiedDataCore.getPanelData(panel);
                if (!panelData) {
                    return `ERROR: 面板 ${panel} 不存在`;
                }

                const value = panelData[field];
                return value !== undefined ? String(value) : `ERROR: 字段 ${field} 不存在`;
            } else {
                // 获取整个面板
                const panelData = await this.unifiedDataCore.getPanelData(panel);
                if (!panelData) {
                    return `ERROR: 面板 ${panel} 不存在`;
                }

                return this.formatPanelData(panelData);
            }

        } catch (error) {
            console.error('[STScript同步] /infobar-get 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-set 命令
     */
    async handleInfoBarSet(args) {
        try {
            const panel = args.panel || args._scope?.panel;
            const field = args.field || args._scope?.field;
            const value = args.value || args._scope?.value;

            if (!panel || !field || value === undefined) {
                return 'ERROR: 请指定完整参数 (panel=xxx field=xxx value=xxx)';
            }

            // 更新UnifiedDataCore中的数据
            await this.unifiedDataCore.updatePanelField(panel, field, value);

            // 立即同步到STScript
            const varName = `infobar_${panel}_${field}`;
            await this.setSTScriptVariable(varName, String(value), 'chat');

            // 清理相关缓存
            const cacheKey = `infobar:${panel}.${field}`;
            this.macroCache.delete(cacheKey);

            return `✅ 已设置 ${panel}.${field} = ${value}`;

        } catch (error) {
            console.error('[STScript同步] /infobar-set 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-sync 命令
     */
    async handleInfoBarSync(args) {
        try {
            await this.syncMemoryDataToSTScript();
            return `✅ 信息栏数据同步完成 (同步次数: ${this.syncCount})`;

        } catch (error) {
            console.error('[STScript同步] /infobar-sync 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-status 命令
     */
    async handleInfoBarStatus(args) {
        try {
            const memoryData = await this.unifiedDataCore.getMemoryData();
            const panelCount = Object.keys(memoryData).length;

            let totalFields = 0;
            for (const panelData of Object.values(memoryData)) {
                if (panelData && typeof panelData === 'object') {
                    totalFields += Object.keys(panelData).length;
                }
            }

            const status = [
                `📊 信息栏STScript同步状态`,
                `• 同步状态: ${this.syncEnabled ? '启用' : '禁用'}`,
                `• 初始化状态: ${this.initialized ? '已完成' : '未完成'}`,
                `• 面板数量: ${panelCount}`,
                `• 字段总数: ${totalFields}`,
                `• 同步次数: ${this.syncCount}`,
                `• 错误次数: ${this.errorCount}`,
                `• 最后同步: ${this.lastSyncTime ? new Date(this.lastSyncTime).toLocaleString() : '从未同步'}`,
                `• 宏缓存: ${this.macroCache.size} 项`
            ];

            return status.join('\n');

        } catch (error) {
            console.error('[STScript同步] /infobar-status 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    // ==================== 🆕 总结命令处理方法 ====================

    /**
     * 处理 /summary-sync 命令
     */
    async handleSummarySync(args) {
        try {
            if (!this.summaryManager) {
                return `❌ 总结管理器未初始化`;
            }

            await this.syncSummaryDataToSTScript();
            return `✅ 总结数据同步完成 (同步次数: ${this.summarySyncCount})`;

        } catch (error) {
            console.error('[STScript同步] /summary-sync 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /summary-get 命令
     */
    async handleSummaryGet(args) {
        try {
            if (!this.summaryManager) {
                return `❌ 总结管理器未初始化`;
            }

            const param = (typeof args === 'string' ? args.trim() : String(args || '').trim()) || 'latest';

            switch (param) {
                case 'latest':
                    return this.getSTScriptVariable('summary_latest') || '暂无最新总结';

                case 'all':
                    return this.getSTScriptVariable('summary_all') || '暂无总结数据';

                case 'count':
                    return `总结数量: ${this.getSTScriptVariable('summary_count') || 0}`;

                case '1':
                case '2':
                case '3':
                    const summaryContent = this.getSTScriptVariable(`summary_${param}`) || '';
                    const summaryTime = this.getSTScriptVariable(`summary_${param}_timestamp`) || 0;
                    const summaryType = this.getSTScriptVariable(`summary_${param}_type`) || '';

                    if (!summaryContent) {
                        return `第${param}条总结不存在`;
                    }

                    const timeStr = summaryTime ? new Date(summaryTime).toLocaleString() : '未知时间';
                    return `[第${param}条总结] (${summaryType}, ${timeStr})\n${summaryContent}`;

                case 'timeline':
                    return this.getSTScriptVariable('summary_timeline') || '暂无总结时间线';

                default:
                    return `❌ 无效参数: ${param}。支持的参数: latest, all, count, 1, 2, 3, timeline`;
            }

        } catch (error) {
            console.error('[STScript同步] /summary-get 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /summary-status 命令
     */
    async handleSummaryStatus(args) {
        try {
            if (!this.summaryManager) {
                return `❌ 总结管理器未初始化`;
            }

            const summaryHistory = await this.summaryManager.getSummaryHistory();
            const summaryCount = summaryHistory.length;

            const status = [
                `📚 总结同步状态`,
                `• 总结数量: ${summaryCount}`,
                `• 同步次数: ${this.summarySyncCount}`,
                `• 最后同步: ${this.lastSummarySyncTime ? new Date(this.lastSummarySyncTime).toLocaleString() : '从未同步'}`,
                `• 同步状态: ${this.summarySyncEnabled ? '启用' : '禁用'}`,
                `• 缓存状态: ${this.summaryCache.size} 项`
            ];

            if (summaryCount > 0) {
                const latestSummary = summaryHistory[0];
                const latestTime = new Date(latestSummary.timestamp).toLocaleString();
                status.push(`• 最新总结: ${latestTime} (${latestSummary.type})`);
            }

            return status.join('\n');

        } catch (error) {
            console.error('[STScript同步] /summary-status 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-rules-enable 命令
     */
    async handleRulesEnable(args) {
        try {
            await this.enableRulesSync();
            // 重新同步数据以包含规则
            await this.migrateToNestedStructure();
            return `✅ 信息栏规则同步已启用，数据已重新同步`;
        } catch (error) {
            console.error('[STScript同步] /infobar-rules-enable 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-rules-disable 命令
     */
    async handleRulesDisable(args) {
        try {
            await this.disableRulesSync();
            // 重新同步数据以移除规则
            await this.migrateToNestedStructure();
            return `✅ 信息栏规则同步已禁用，数据已重新同步`;
        } catch (error) {
            console.error('[STScript同步] /infobar-rules-disable 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-rules-status 命令
     */
    async handleRulesStatus(args) {
        try {
            const isEnabled = this.shouldSyncRules();
            const infobarData = this.getInfobarStructure();

            let panelsWithRules = 0;
            let fieldsWithRules = 0;

            if (infobarData && Object.keys(infobarData).length > 0) {
                for (const [panelName, panelData] of Object.entries(infobarData)) {
                    // 检查面板规则
                    if (panelData['Panel Rules']) {
                        panelsWithRules++;
                    }

                    // 检查字段规则
                    for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                        if (fieldName !== 'Panel Rules' && Array.isArray(fieldValue) && fieldValue.length > 1) {
                            fieldsWithRules++;
                        }
                    }
                }
            }

            const status = [
                `📋 信息栏规则同步状态`,
                `• 规则同步: ${isEnabled ? '启用' : '禁用'}`,
                `• 面板总数: ${Object.keys(infobarData || {}).length}`,
                `• 有规则的面板: ${panelsWithRules}`,
                `• 有规则的字段: ${fieldsWithRules}`,
                ``,
                `💡 使用说明:`,
                `• 启用规则同步: /infobar-rules-enable`,
                `• 禁用规则同步: /infobar-rules-disable`,
                `• 规则同步启用后，用户设置的面板规则和字段规则会同步到变量中`
            ];

            return status.join('\n');

        } catch (error) {
            console.error('[STScript同步] /infobar-rules-status 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-ai-test 命令
     */
    async handleAIDataTest(args) {
        try {
            // 获取AI数据暴露模块
            const aiDataExposure = window.SillyTavernInfobar?.modules?.aiDataExposure;
            if (!aiDataExposure) {
                return `❌ AI数据暴露模块未初始化`;
            }

            // 处理参数 - 可能是字符串或对象
            let param = 'all';
            if (typeof args === 'string') {
                param = args.trim() || 'all';
            } else if (args && typeof args === 'object') {
                // 如果是对象，尝试获取第一个参数
                if (args.pipe) {
                    param = args.pipe.trim() || 'all';
                } else if (args.args) {
                    param = args.args.trim() || 'all';
                } else {
                    // 检查对象的属性
                    const keys = Object.keys(args);
                    if (keys.length > 0) {
                        param = String(args[keys[0]]).trim() || 'all';
                    }
                }
            }

            if (param === 'all') {
                // 测试获取所有数据
                const allData = await aiDataExposure.getAllData();
                const summary = allData.summary;

                return [
                    `🤖 AI数据访问测试 - 全部数据`,
                    `• 面板数量: ${summary.totalPanels}`,
                    `• 字段数量: ${summary.totalFields}`,
                    `• 最后更新: ${summary.lastUpdate ? new Date(summary.lastUpdate).toLocaleString() : '未知'}`,
                    `• 数据源: ${allData.metadata.source}`,
                    `• 测试时间: ${new Date().toLocaleString()}`
                ].join('\n');

            } else if (param.startsWith('panel=')) {
                // 测试获取面板数据
                const panelName = param.substring(6);
                const panelData = await aiDataExposure.getPanelData(panelName);

                if (!panelData) {
                    return `❌ 面板 "${panelName}" 不存在`;
                }

                return [
                    `🤖 AI数据访问测试 - 面板数据`,
                    `• 面板名称: ${panelData.name}`,
                    `• 字段数量: ${panelData.metadata.fieldCount}`,
                    `• 面板规则: ${panelData.rules.panel || '无'}`,
                    `• 字段列表: ${Object.keys(panelData.fields).join(', ')}`,
                    `• 测试时间: ${new Date().toLocaleString()}`
                ].join('\n');

            } else if (param.startsWith('field=')) {
                // 测试获取字段数据
                const fieldPath = param.substring(6);
                const [panelName, fieldName] = fieldPath.split('.');

                if (!panelName || !fieldName) {
                    return `❌ 字段路径格式错误，应为: panel.field`;
                }

                const fieldData = await aiDataExposure.getData(panelName, fieldName);

                if (!fieldData) {
                    return `❌ 字段 "${fieldPath}" 不存在`;
                }

                return [
                    `🤖 AI数据访问测试 - 字段数据`,
                    `• 字段路径: ${fieldPath}`,
                    `• 当前值: ${fieldData.value}`,
                    `• 字段规则: ${fieldData.rule || '无'}`,
                    `• 数据时间: ${new Date(fieldData.timestamp).toLocaleString()}`,
                    `• 测试时间: ${new Date().toLocaleString()}`
                ].join('\n');

            } else {
                return [
                    `❌ 无效参数: ${param}`,
                    `支持的参数:`,
                    `• all - 获取所有数据概览`,
                    `• panel=面板名 - 获取指定面板数据`,
                    `• field=面板名.字段名 - 获取指定字段数据`
                ].join('\n');
            }

        } catch (error) {
            console.error('[STScript同步] /infobar-ai-test 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 处理 /infobar-ai-prompt 命令
     */
    async handleAIPromptGenerate(args) {
        try {
            // 获取AI数据暴露模块
            const aiDataExposure = window.SillyTavernInfobar?.modules?.aiDataExposure;
            if (!aiDataExposure) {
                return `❌ AI数据暴露模块未初始化`;
            }

            // 解析参数 - 处理不同的参数格式
            let params = {};
            if (typeof args === 'string') {
                params = this.parseCommandArgs(args);
            } else if (args && typeof args === 'object') {
                if (args.pipe) {
                    params = this.parseCommandArgs(args.pipe);
                } else if (args.args) {
                    params = this.parseCommandArgs(args.args);
                } else {
                    // 直接使用对象属性
                    params = args;
                }
            }

            const includeRules = params.rules !== 'false';
            const format = params.format || 'structured';

            // 生成提示词
            const prompt = await aiDataExposure.generatePrompt({
                includeCurrentData: true,
                includeRules: includeRules,
                includeInstructions: true,
                customInstructions: params.instructions || ''
            });

            return [
                `🤖 AI提示词已生成 (格式: ${format}, 规则: ${includeRules ? '包含' : '不包含'})`,
                ``,
                `--- 提示词内容 ---`,
                prompt,
                `--- 提示词结束 ---`,
                ``,
                `生成时间: ${new Date().toLocaleString()}`
            ].join('\n');

        } catch (error) {
            console.error('[STScript同步] /infobar-ai-prompt 命令执行失败:', error);
            return `ERROR: ${error.message}`;
        }
    }

    /**
     * 解析命令参数
     */
    parseCommandArgs(args) {
        const params = {};
        if (!args) return params;

        const argString = typeof args === 'string' ? args : String(args);
        const pairs = argString.split(/\s+/);

        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                params[key] = value;
            }
        }

        return params;
    }

    // ==================== 公共接口 ====================

    /**
     * 🆕 设置总结管理器（用于延迟初始化）
     */
    setSummaryManager(summaryManager) {
        this.summaryManager = summaryManager;
        console.log('[STScript同步] 🔗 总结管理器已设置');

        // 如果已经初始化，重新设置总结事件监听器
        if (this.initialized) {
            this.setupSummaryEventListeners();
            // 执行初始总结同步
            this.queueSummarySync();
        }
    }

    /**
     * 启用同步
     */
    enableSync() {
        this.syncEnabled = true;
        console.log('[STScript同步] ✅ 同步已启用');
    }

    /**
     * 禁用同步
     */
    disableSync() {
        this.syncEnabled = false;
        console.log('[STScript同步] ⏸️ 同步已禁用');
    }

    /**
     * 获取同步状态
     */
    getStatus() {
        return {
            enabled: this.syncEnabled,
            initialized: this.initialized,
            syncCount: this.syncCount,
            errorCount: this.errorCount,
            lastSyncTime: this.lastSyncTime,
            cacheSize: this.macroCache.size
        };
    }

    // ==================== 🆕 规则自动同步功能 ====================

    /**
     * 设置规则更新事件监听器
     */
    setupRuleUpdateListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[STScript同步] ⚠️ 事件系统不可用，无法监听规则更新');
                return;
            }

            console.log('[STScript同步] 🔗 设置规则更新事件监听器...');

            // 监听面板规则更新事件
            this.eventSystem.on('panelRule:updated', async (eventData) => {
                console.log('[STScript同步] 📋 检测到面板规则更新:', eventData.panelId);
                await this.syncPanelRuleToVariable(eventData.panelId, eventData.rule);
            });

            // 监听面板规则删除事件
            this.eventSystem.on('panelRule:deleted', async (eventData) => {
                console.log('[STScript同步] 🗑️ 检测到面板规则删除:', eventData.panelId);
                await this.removePanelRuleFromVariable(eventData.panelId);
            });

            // 监听字段规则更新事件
            this.eventSystem.on('fieldRule:updated', async (eventData) => {
                console.log('[STScript同步] 🔧 检测到字段规则更新:', `${eventData.panelName}.${eventData.fieldName}`);
                await this.syncFieldRuleToVariable(eventData.panelName, eventData.fieldName, eventData.rule);
            });

            // 监听字段规则删除事件
            this.eventSystem.on('fieldRule:deleted', async (eventData) => {
                console.log('[STScript同步] 🗑️ 检测到字段规则删除:', `${eventData.panelName}.${eventData.fieldName}`);
                await this.removeFieldRuleFromVariable(eventData.panelName, eventData.fieldName);
            });

            console.log('[STScript同步] ✅ 规则更新事件监听器设置完成');

        } catch (error) {
            console.error('[STScript同步] ❌ 设置规则更新事件监听器失败:', error);
        }
    }

    /**
     * 同步面板规则到变量
     */
    async syncPanelRuleToVariable(panelId, rule) {
        try {
            console.log(`[STScript同步] 📋 同步面板规则到变量: ${panelId}`);

            // 获取当前的infobar结构
            const infobarData = this.getInfobarStructure();

            if (!infobarData[panelId]) {
                console.warn(`[STScript同步] ⚠️ 面板 ${panelId} 不存在，跳过规则同步`);
                this.showNotification('未找到变量结构，规则添加失败，请先点击生成变量', 'warning');
                return;
            }

            // 提取面板规则的描述内容（字符串格式）
            const ruleContent = this.extractPanelRuleContent(rule);
            if (!ruleContent) {
                console.warn(`[STScript同步] ⚠️ 面板规则内容为空，跳过同步: ${panelId}`);
                return;
            }

            // 更新面板规则（只存储描述内容）
            infobarData[panelId]['Panel Rules'] = ruleContent;

            // 保存到STScript变量
            await this.setSTScriptVariable('infobar', JSON.stringify(infobarData), 'chat');

            console.log(`[STScript同步] ✅ 面板规则同步完成: ${panelId}`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 同步面板规则失败:`, error);
        }
    }

    /**
     * 从变量中移除面板规则
     */
    async removePanelRuleFromVariable(panelId) {
        try {
            console.log(`[STScript同步] 🗑️ 从变量中移除面板规则: ${panelId}`);

            // 获取当前的infobar结构
            const infobarData = this.getInfobarStructure();

            if (!infobarData[panelId]) {
                console.warn(`[STScript同步] ⚠️ 面板 ${panelId} 不存在，跳过规则移除`);
                this.showNotification('未找到变量结构，规则移除失败，请先点击生成变量', 'warning');
                return;
            }

            // 删除面板规则
            delete infobarData[panelId]['Panel Rules'];

            // 保存到STScript变量
            await this.setSTScriptVariable('infobar', JSON.stringify(infobarData), 'chat');

            console.log(`[STScript同步] ✅ 面板规则移除完成: ${panelId}`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 移除面板规则失败:`, error);
        }
    }

    /**
     * 同步字段规则到变量
     */
    async syncFieldRuleToVariable(panelName, fieldName, rule) {
        try {
            console.log(`[STScript同步] 🔧 同步字段规则到变量: ${panelName}.${fieldName}`);

            // 将显示名映射为实际的字段键名
            const actualFieldName = this.mapFieldNameToKey(panelName, fieldName);
            if (!actualFieldName) {
                console.warn(`[STScript同步] ⚠️ 无法映射字段名 ${panelName}.${fieldName}，跳过规则同步`);
                return;
            }

            console.log(`[STScript同步] 🎯 字段名映射: ${fieldName} -> ${actualFieldName}`);

            // 获取当前的infobar结构
            const infobarData = this.getInfobarStructure();

            if (!infobarData[panelName] || !infobarData[panelName][actualFieldName]) {
                console.warn(`[STScript同步] ⚠️ 字段 ${panelName}.${actualFieldName} 不存在，跳过规则同步`);
                this.showNotification('未找到变量结构，规则添加失败，请先点击生成变量', 'warning');
                return;
            }

            const fieldData = infobarData[panelName][actualFieldName];

            // 确保字段是数组格式
            if (!Array.isArray(fieldData)) {
                console.warn(`[STScript同步] ⚠️ 字段 ${panelName}.${actualFieldName} 不是数组格式，跳过规则同步`);
                return;
            }

            // 提取并合并字段规则内容（字符串格式）
            const ruleContent = this.extractFieldRuleContent(rule);
            if (!ruleContent) {
                console.warn(`[STScript同步] ⚠️ 字段规则内容为空，跳过同步: ${panelName}.${actualFieldName}`);
                return;
            }

            // 更新字段规则（数组的第二个元素）
            if (fieldData.length === 1) {
                // 添加规则
                fieldData.push(ruleContent);
            } else {
                // 更新规则
                fieldData[1] = ruleContent;
            }

            // 保存到STScript变量
            await this.setSTScriptVariable('infobar', JSON.stringify(infobarData), 'chat');

            console.log(`[STScript同步] ✅ 字段规则同步完成: ${panelName}.${fieldName} -> ${actualFieldName}`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 同步字段规则失败:`, error);
        }
    }

    /**
     * 从变量中移除字段规则
     */
    async removeFieldRuleFromVariable(panelName, fieldName) {
        try {
            console.log(`[STScript同步] 🗑️ 从变量中移除字段规则: ${panelName}.${fieldName}`);

            // 将显示名映射为实际的字段键名
            const actualFieldName = this.mapFieldNameToKey(panelName, fieldName);
            if (!actualFieldName) {
                console.warn(`[STScript同步] ⚠️ 无法映射字段名 ${panelName}.${fieldName}，跳过规则移除`);
                return;
            }

            console.log(`[STScript同步] 🎯 字段名映射: ${fieldName} -> ${actualFieldName}`);

            // 获取当前的infobar结构
            const infobarData = this.getInfobarStructure();

            if (!infobarData[panelName] || !infobarData[panelName][actualFieldName]) {
                console.warn(`[STScript同步] ⚠️ 字段 ${panelName}.${actualFieldName} 不存在，跳过规则移除`);
                this.showNotification('未找到变量结构，规则移除失败，请先点击生成变量', 'warning');
                return;
            }

            const fieldData = infobarData[panelName][actualFieldName];

            // 确保字段是数组格式
            if (!Array.isArray(fieldData)) {
                console.warn(`[STScript同步] ⚠️ 字段 ${panelName}.${actualFieldName} 不是数组格式，跳过规则移除`);
                return;
            }

            // 移除字段规则（只保留值）
            if (fieldData.length > 1) {
                infobarData[panelName][actualFieldName] = [fieldData[0]];
            }

            // 保存到STScript变量
            await this.setSTScriptVariable('infobar', JSON.stringify(infobarData), 'chat');

            console.log(`[STScript同步] ✅ 字段规则移除完成: ${panelName}.${fieldName} -> ${actualFieldName}`);

        } catch (error) {
            console.error(`[STScript同步] ❌ 移除字段规则失败:`, error);
        }
    }

    /**
     * 显示用户通知弹窗
     */
    showNotification(message, type = 'warning') {
        try {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `stscript-sync-notification notification-${type}`;
            
            const colors = {
                'success': '#4CAF50',
                'info': '#2196F3', 
                'warning': '#ff9800',
                'error': '#f44336'
            };
            
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fa-solid ${type === 'warning' ? 'fa-exclamation-triangle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                    <span>${message}</span>
                </div>
            `;

            // 添加样式
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type] || colors.warning};
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                z-index: 10002;
                font-family: Arial, sans-serif;
                font-size: 14px;
                font-weight: 500;
                max-width: 400px;
                word-wrap: break-word;
                animation: slideInRight 0.3s ease-out;
                border-left: 4px solid ${colors[type] || colors.warning};
            `;

            // 添加CSS动画
            if (!document.querySelector('#stscript-notification-styles')) {
                const style = document.createElement('style');
                style.id = 'stscript-notification-styles';
                style.textContent = `
                    @keyframes slideInRight {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOutRight {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                    .stscript-sync-notification .notification-content {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .stscript-sync-notification .notification-content i {
                        font-size: 16px;
                    }
                `;
                document.head.appendChild(style);
            }

            // 添加到页面
            document.body.appendChild(notification);

            // 5秒后自动移除（比其他通知稍长一些，因为是重要提示）
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }
            }, 5000);

            console.log(`[STScript同步] 📢 显示用户通知: ${message}`);

        } catch (error) {
            console.error('[STScript同步] ❌ 显示通知失败:', error);
        }
    }

    /**
     * 将字段显示名映射为实际的字段键名
     */
    mapFieldNameToKey(panelName, fieldDisplayName) {
        try {
            // 使用数据核心的字段名映射功能
            if (this.unifiedDataCore && this.unifiedDataCore.getEnglishFieldName) {
                const actualFieldName = this.unifiedDataCore.getEnglishFieldName(fieldDisplayName, panelName);
                if (actualFieldName) {
                    return actualFieldName;
                }
            }

            // 如果映射失败，检查是否已经是英文键名
            const infobarData = this.getInfobarStructure();
            if (infobarData[panelName] && infobarData[panelName][fieldDisplayName]) {
                console.log(`[STScript同步] 🎯 字段名已是键名: ${fieldDisplayName}`);
                return fieldDisplayName;
            }

            console.warn(`[STScript同步] ⚠️ 无法映射字段名: ${panelName}.${fieldDisplayName}`);
            this.showNotification('未找到变量结构，规则添加失败，请先点击生成变量', 'warning');
            return null;

        } catch (error) {
            console.error(`[STScript同步] ❌ 字段名映射失败:`, error);
            return null;
        }
    }

    /**
     * 提取面板规则的描述内容
     */
    extractPanelRuleContent(rule) {
        try {
            if (!rule) {
                return null;
            }

            // 如果已经是字符串，直接返回
            if (typeof rule === 'string') {
                return rule.trim();
            }

            // 如果是对象，提取描述内容
            if (typeof rule === 'object') {
                // 优先使用description字段
                if (rule.description && rule.description.trim()) {
                    return rule.description.trim();
                }

                // 其次使用content字段
                if (rule.content && rule.content.trim()) {
                    return rule.content.trim();
                }

                // 最后使用rule字段
                if (rule.rule && rule.rule.trim()) {
                    return rule.rule.trim();
                }
            }

            return null;

        } catch (error) {
            console.error('[STScript同步] ❌ 提取面板规则内容失败:', error);
            return null;
        }
    }

    /**
     * 提取字段规则内容（简化版）
     */
    extractFieldRuleContent(rule) {
        try {
            if (!rule) {
                return null;
            }

            // 如果已经是字符串，直接返回
            if (typeof rule === 'string') {
                return rule.trim();
            }

            // 如果是对象，优先使用新的简化格式
            if (typeof rule === 'object') {
                // 新格式：直接使用content字段
                if (rule.content && rule.content.trim()) {
                    return rule.content.trim();
                }

                // 兼容旧格式：合并基础规则和动态规则
                const ruleParts = [];

                // 添加基础规则
                if (rule.rules && typeof rule.rules === 'object') {
                    if (rule.rules.description && rule.rules.description.trim()) {
                        ruleParts.push(rule.rules.description.trim());
                    }
                    if (rule.rules.content && rule.rules.content.trim()) {
                        ruleParts.push(rule.rules.content.trim());
                    }
                }

                // 添加动态规则
                if (rule.dynamicRules && Array.isArray(rule.dynamicRules)) {
                    rule.dynamicRules.forEach(dynamicRule => {
                        if (dynamicRule && typeof dynamicRule === 'object') {
                            if (dynamicRule.description && dynamicRule.description.trim()) {
                                ruleParts.push(dynamicRule.description.trim());
                            }
                            if (dynamicRule.content && dynamicRule.content.trim()) {
                                ruleParts.push(dynamicRule.content.trim());
                            }
                        } else if (typeof dynamicRule === 'string' && dynamicRule.trim()) {
                            ruleParts.push(dynamicRule.trim());
                        }
                    });
                }

                // 如果没有找到规则内容，尝试其他字段
                if (ruleParts.length === 0) {
                    if (rule.description && rule.description.trim()) {
                        ruleParts.push(rule.description.trim());
                    }
                }

                // 合并所有规则部分
                if (ruleParts.length > 0) {
                    return ruleParts.join('\n');
                }
            }

            return null;

        } catch (error) {
            console.error('[STScript同步] ❌ 提取字段规则内容失败:', error);
            return null;
        }
    }

    // ==================== 🆕 总结数据同步功能 ====================

    /**
     * 设置总结事件监听器
     */
    setupSummaryEventListeners() {
        if (!this.eventSystem) return;

        console.log('[STScript同步] 🔗 设置总结事件监听器...');

        // 监听总结创建事件
        this.eventSystem.on('summary:created', (data) => {
            console.log('[STScript同步] 📡 检测到总结创建事件');
            this.queueSummarySync();
        });

        // 监听总结更新事件
        this.eventSystem.on('summary:updated', (data) => {
            console.log('[STScript同步] 📡 检测到总结更新事件');
            this.queueSummarySync();
        });

        // 监听总结删除事件
        this.eventSystem.on('summary:deleted', (data) => {
            console.log('[STScript同步] 📡 检测到总结删除事件');
            this.queueSummarySync();
        });

        // 监听聊天切换事件（重新同步总结）
        this.eventSystem.on('summary:chat:changed', (data) => {
            console.log('[STScript同步] 📡 检测到聊天切换，重新同步总结');
            this.queueSummarySync();
        });

        console.log('[STScript同步] ✅ 总结事件监听器设置完成');
    }

    /**
     * 核心功能：将总结数据同步到STScript变量
     */
    async syncSummaryDataToSTScript() {
        if (!this.summarySyncEnabled || !this.summaryManager) {
            return;
        }

        try {
            console.log('[STScript同步] 📚 开始同步总结数据...');

            // 获取总结历史
            const summaryHistory = await this.summaryManager.getSummaryHistory();

            if (!summaryHistory || summaryHistory.length === 0) {
                console.log('[STScript同步] ℹ️ 没有总结数据需要同步');
                // 清空总结变量
                await this.clearSummaryVariables();
                return;
            }

            console.log('[STScript同步] 📊 找到 ' + summaryHistory.length + ' 条总结记录');

            // 同步总结数据
            await this.syncSummaryVariables(summaryHistory);

            this.summarySyncCount++;
            this.lastSummarySyncTime = Date.now();

            console.log('[STScript同步] ✅ 总结数据同步完成');

        } catch (error) {
            console.error('[STScript同步] ❌ 总结数据同步失败:', error);
            this.errorCount++;
        }
    }

    /**
     * 同步总结变量到STScript
     */
    async syncSummaryVariables(summaryHistory) {
        try {
            // 1. 同步总结总数
            await this.setSTScriptVariable('summary_count', summaryHistory.length);

            // 2. 同步最新总结
            const latestSummary = summaryHistory[0];
            if (latestSummary) {
                await this.setSTScriptVariable('summary_latest', latestSummary.content || '');
                await this.setSTScriptVariable('summary_latest_timestamp', latestSummary.timestamp || 0);
                await this.setSTScriptVariable('summary_latest_type', latestSummary.type || 'unknown');
            }

            // 3. 同步所有总结内容（合并）
            const allSummaries = summaryHistory
                .map((summary, index) => `[总结${index + 1}] ${summary.content || ''}`)
                .join('\n\n');
            await this.setSTScriptVariable('summary_all', allSummaries);

            // 4. 同步最近3条总结
            const recentSummaries = summaryHistory.slice(0, 3);
            for (let i = 0; i < 3; i++) {
                const summary = recentSummaries[i];
                if (summary) {
                    await this.setSTScriptVariable(`summary_${i + 1}`, summary.content || '');
                    await this.setSTScriptVariable(`summary_${i + 1}_timestamp`, summary.timestamp || 0);
                    await this.setSTScriptVariable(`summary_${i + 1}_type`, summary.type || 'unknown');
                } else {
                    // 清空不存在的总结
                    await this.setSTScriptVariable(`summary_${i + 1}`, '');
                    await this.setSTScriptVariable(`summary_${i + 1}_timestamp`, 0);
                    await this.setSTScriptVariable(`summary_${i + 1}_type`, '');
                }
            }

            // 5. 同步总结时间线（简化版）
            const timeline = summaryHistory
                .map(summary => {
                    const date = new Date(summary.timestamp).toLocaleString();
                    return `${date}: ${(summary.content || '').substring(0, 100)}...`;
                })
                .join('\n');
            await this.setSTScriptVariable('summary_timeline', timeline);

            console.log('[STScript同步] ✅ 总结变量同步完成，同步了 ' + summaryHistory.length + ' 条总结');

        } catch (error) {
            console.error('[STScript同步] ❌ 总结变量同步失败:', error);
            throw error;
        }
    }

    /**
     * 清空总结变量
     */
    async clearSummaryVariables() {
        try {
            console.log('[STScript同步] 🧹 清空总结变量...');

            const summaryVars = [
                'summary_count', 'summary_latest', 'summary_latest_timestamp', 'summary_latest_type',
                'summary_all', 'summary_timeline',
                'summary_1', 'summary_1_timestamp', 'summary_1_type',
                'summary_2', 'summary_2_timestamp', 'summary_2_type',
                'summary_3', 'summary_3_timestamp', 'summary_3_type'
            ];

            for (const varName of summaryVars) {
                await this.setSTScriptVariable(varName, '');
            }

            console.log('[STScript同步] ✅ 总结变量清空完成');

        } catch (error) {
            console.error('[STScript同步] ❌ 清空总结变量失败:', error);
        }
    }

    /**
     * 队列化总结同步（避免频繁同步）
     */
    queueSummarySync() {
        clearTimeout(this.summarySyncTimeout);
        this.summarySyncTimeout = setTimeout(() => {
            this.syncSummaryDataToSTScript();
        }, 2000); // 2秒延迟，合并多个变更
    }

    /**
     * 销毁同步系统
     */
    destroy() {
        // 清理定时器
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        if (this.summarySyncTimeout) {
            clearTimeout(this.summarySyncTimeout);
        }

        // 清理缓存
        this.clearCache();

        // 移除事件监听器
        if (this.eventSystem) {
            this.eventSystem.removeAllListeners('panelDataUpdated');
            this.eventSystem.removeAllListeners('fieldUpdated');
            this.eventSystem.removeAllListeners('chatChanged');
            // 🆕 移除总结事件监听器
            this.eventSystem.removeAllListeners('summary:created');
            this.eventSystem.removeAllListeners('summary:updated');
            this.eventSystem.removeAllListeners('summary:deleted');
            this.eventSystem.removeAllListeners('summary:chat:changed');
        }

        console.log('[STScript同步] 🗑️ 同步系统已销毁');
    }

    /**
     * 从新的嵌套结构获取数据
     */
    getFromNestedStructure(panelName, fieldName) {
        try {
            const infobarData = this.getInfobarStructure();

            if (!infobarData || !infobarData[panelName]) {
                return '';
            }

            const panelData = infobarData[panelName];

            if (fieldName) {
                // 访问具体字段：{{infobar:personal.name}}
                if (fieldName === 'Panel Rules') {
                    // 返回面板规则
                    return panelData['Panel Rules'] || '';
                } else if (panelData[fieldName]) {
                    // 新格式：字段是数组 [值] 或 [值, 字段规则]
                    if (Array.isArray(panelData[fieldName])) {
                        return panelData[fieldName][0] || ''; // 返回值部分
                    } else {
                        // 兼容旧格式
                        return String(panelData[fieldName]);
                    }
                } else {
                    // 字段不存在
                    return '';
                }
            } else {
                // 访问整个面板：{{infobar:personal}}
                return this.formatNestedPanelData(panelData);
            }

        } catch (error) {
            console.error('[STScript同步] 从嵌套结构获取数据失败:', error);
            return '';
        }
    }

    /**
     * 从旧的分散变量获取数据（向后兼容）
     */
    getFromLegacyStructure(panelName, fieldName) {
        try {
            if (fieldName) {
                // 访问具体字段：{{infobar:personal.name}}
                const varName = `infobar_${panelName}_${fieldName}`;
                return this.getSTScriptVariable(varName, 'chat');
            } else {
                // 访问整个面板：{{infobar:personal}}
                const varName = `infobar_${panelName}`;
                const jsonData = this.getSTScriptVariable(varName, 'chat');

                if (jsonData) {
                    try {
                        const parsed = JSON.parse(jsonData);
                        return this.formatPanelData(parsed);
                    } catch (e) {
                        return jsonData;
                    }
                }
            }

            return '';

        } catch (error) {
            console.error('[STScript同步] 从旧结构获取数据失败:', error);
            return '';
        }
    }

    /**
     * 在成员数组中查找匹配的项
     */
    findInMembers(members, fieldName) {
        try {
            if (!Array.isArray(members)) {
                return '';
            }

            // 简单的关键词匹配
            const matchingMember = members.find(member =>
                String(member).toLowerCase().includes(fieldName.toLowerCase())
            );

            return matchingMember || '';

        } catch (error) {
            console.error('[STScript同步] 在成员中查找失败:', error);
            return '';
        }
    }

    /**
     * 格式化嵌套面板数据
     */
    formatNestedPanelData(panelData) {
        try {
            if (!panelData) {
                return '';
            }

            const result = [];

            // 遍历面板数据，格式化每个字段
            for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                if (fieldName === 'Panel Rules') {
                    // 跳过面板规则字段，稍后单独处理
                    continue;
                }

                if (Array.isArray(fieldValue) && fieldValue.length > 0) {
                    // 新格式：[值] 或 [值, 字段规则]
                    result.push(`${fieldName}: ${fieldValue[0]}`);
                } else if (typeof fieldValue === 'string' && fieldValue.trim()) {
                    // 兼容旧格式或简单字符串
                    result.push(`${fieldName}: ${fieldValue}`);
                }
            }

            let formattedResult = result.join(', ');

            // 显示面板规则（如果有）
            if (panelData['Panel Rules'] && panelData['Panel Rules'].trim()) {
                formattedResult += formattedResult ? `\n面板规则: ${panelData['Panel Rules']}` : `面板规则: ${panelData['Panel Rules']}`;
            }

            return formattedResult;

        } catch (error) {
            console.error('[STScript同步] 格式化嵌套面板数据失败:', error);
            return '';
        }
    }

    /**
     * 清理旧的分散变量
     */
    async cleanupLegacyVariables() {
        try {
            console.log('[STScript同步] 🧹 开始清理旧的分散变量...');

            // 获取所有面板名称
            const memoryData = await this.unifiedDataCore.getMemoryData();
            const panelNames = Object.keys(memoryData || {});

            let cleanedCount = 0;

            for (const panelName of panelNames) {
                // 清理面板整体变量
                const panelVarName = `infobar_${panelName}`;
                await this.setSTScriptVariable(panelVarName, '', 'chat');
                cleanedCount++;

                // 清理面板字段变量（这里只能清理已知的常见字段）
                const commonFields = [
                    'name', 'appearance', 'posture', 'mood', 'room', 'environment', 'object',
                    'health', 'energy', 'consciousness', 'worn_items', 'equipped_items', 'held_items',
                    'valuable_items', 'time_of_day', 'weather', 'temperature', 'lastUpdated', 'source'
                ];

                for (const fieldName of commonFields) {
                    const fieldVarName = `infobar_${panelName}_${fieldName}`;
                    await this.setSTScriptVariable(fieldVarName, '', 'chat');
                    cleanedCount++;
                }
            }

            console.log(`[STScript同步] ✅ 清理完成，清理了 ${cleanedCount} 个旧变量`);

        } catch (error) {
            console.error('[STScript同步] ❌ 清理旧变量失败:', error);
        }
    }

    /**
     * 检查字段值是否有效
     */
    isValidFieldValue(value) {
        return value !== null &&
               value !== undefined &&
               value !== '' &&
               String(value).trim() !== '';
    }

    /**
     * 格式化面板数据为可读字符串
     */
    formatPanelData(panelData) {
        if (!panelData || typeof panelData !== 'object') {
            return String(panelData || '');
        }

        return Object.entries(panelData)
            .filter(([key, value]) => this.isValidFieldValue(value))
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    /**
     * 获取所有面板数据
     */
    getAllPanelsData() {
        try {
            // 优先从新的嵌套结构获取
            const infobarData = this.getInfobarStructure();
            if (infobarData && Object.keys(infobarData).length > 0) {
                return Object.entries(infobarData)
                    .map(([panelName, panelData]) => {
                        const formatted = this.formatNestedPanelData(panelData);
                        return formatted ? `${panelName}: ${formatted}` : '';
                    })
                    .filter(line => line)
                    .join('\n');
            }

            // 回退到旧的方式
            const memoryData = this.unifiedDataCore.getMemoryData();
            if (!memoryData) return '';

            return Object.entries(memoryData)
                .map(([panelName, panelData]) => {
                    const formatted = this.formatPanelData(panelData);
                    return formatted ? `${panelName}: ${formatted}` : '';
                })
                .filter(line => line)
                .join('\n');

        } catch (error) {
            console.error('[STScript同步] 获取所有面板数据失败:', error);
            return '';
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.macroCache.clear();
        console.log('[STScript同步] 🧹 宏缓存已清理');
    }

    /**
     * 🚀 检查是否应该跳过回溯同步
     */
    shouldSkipRollbackSync() {
        // 🔧 修复：根据用户要求，不再采用数据同步机制，特别是在回溯时
        const skipRollbackSync = true; // 用户明确要求跳过回溯同步
        
        if (skipRollbackSync) {
            console.log('[STScript同步] ⏸️ 根据新策略，回溯时跳过STScript数据同步');
            return true;
        }
        
        return false;
    }

    /**
     * 🚀 检查是否应该跳过嵌套结构同步
     */
    shouldSkipNestedStructureSync() {
        // 🔧 修复：用户明确指出不应该在回溯时操作同步嵌套结构
        const skipNestedSync = true; // 不采用同步嵌套结构的机制
        
        if (skipNestedSync) {
            console.log('[STScript同步] ⏸️ 根据新策略，不操作同步嵌套结构');
            return true;
        }
        
        return false;
    }

    /**
     * 🚀 禁用回溯时的同步功能
     */
    disableRollbackSync() {
        this.rollbackSyncEnabled = false;
        console.log('[STScript同步] ⏸️ 回溯同步功能已禁用');
    }

    /**
     * 🚀 启用回溯时的同步功能
     */
    enableRollbackSync() {
        this.rollbackSyncEnabled = true;
        console.log('[STScript同步] ✅ 回溯同步功能已启用');
    }

    /**
     * 获取同步状态
     */
    getStatus() {
        return {
            syncCount: this.syncCount,
            errorCount: this.errorCount,
            lastSyncTime: this.lastSyncTime,
            cacheSize: this.macroCache.size,
            isInitialized: this.initialized,
            rollbackSyncEnabled: this.rollbackSyncEnabled || false
        };
    }
}

