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

            // 执行初始同步
            await this.performInitialSync();

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
            // 1. 同步面板整体数据（JSON格式）
            const panelJson = JSON.stringify(panelData);
            await this.setSTScriptVariable(`infobar_${panelName}`, panelJson, 'chat');
            
            // 2. 同步面板中的关键字段（便于宏访问）
            let syncedFields = 0;
            for (const [fieldName, fieldValue] of Object.entries(panelData)) {
                if (this.isValidFieldValue(fieldValue)) {
                    const varName = `infobar_${panelName}_${fieldName}`;
                    await this.setSTScriptVariable(varName, String(fieldValue), 'chat');
                    syncedFields++;
                }
            }
            
            console.log(`[STScript同步] ✅ 面板 ${panelName} 同步完成，同步了 ${syncedFields} 个字段`);
            
        } catch (error) {
            console.error(`[STScript同步] ❌ 面板 ${panelName} 同步失败:`, error);
            throw error;
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

            return this.context.substituteParams(macro);

        } catch (error) {
            console.error(`[STScript同步] 变量读取失败 ${varName}:`, error);
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

                if (fieldName) {
                    // 访问具体字段：{{infobar:personal.name}}
                    const varName = `infobar_${panelName}_${fieldName}`;
                    result = this.getSTScriptVariable(varName, 'chat');
                } else {
                    // 访问整个面板：{{infobar:personal}}
                    const varName = `infobar_${panelName}`;
                    const jsonData = this.getSTScriptVariable(varName, 'chat');

                    if (jsonData) {
                        try {
                            const parsed = JSON.parse(jsonData);
                            result = this.formatPanelData(parsed);
                        } catch (e) {
                            result = jsonData;
                        }
                    }
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
            console.log('[STScript同步] 📡 检测到聊天数据变更，清理缓存');
            this.clearCache();
            this.queueFullSync();
        });

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
}
