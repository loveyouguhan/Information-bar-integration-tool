/**
 * Information Bar Integration Tool - SillyTavern第三方扩展插件
 *
 * 功能特性:
 * - 信息栏设置界面
 * - 数据表格管理
 * - 自定义API配置
 * - 智能数据管理
 * - 界面定制功能
 *
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

// 导入核心模块
import { UnifiedDataCore } from './core/UnifiedDataCore.js';
import { EventSystem } from './core/EventSystem.js';
import { ConfigManager } from './core/ConfigManager.js';
import { APIIntegration } from './core/APIIntegration.js';
import { SmartPromptSystem } from './core/SmartPromptSystem.js';
import { XMLDataParser } from './core/XMLDataParser.js';
import { DataSnapshotManager } from './core/DataSnapshotManager.js';
import { FieldRuleManager } from './core/FieldRuleManager.js';
import { PanelRuleManager } from './core/PanelRuleManager.js';
import { AIDataExposure } from './core/AIDataExposure.js';
import { HTMLTemplateParser } from './core/HTMLTemplateParser.js';
import { AITemplateAssistant } from './core/AITemplateAssistant.js';
import { TemplateManager } from './core/TemplateManager.js';
import { VariableSystemPrompt } from './core/VariableSystemPrompt.js';
import { NPCDatabaseManager } from './core/NPCDatabaseManager.js';
import { NPCManagementPanel } from './ui/NPCManagementPanel.js';
import { WorldBookManager } from './core/WorldBookManager.js';
import { WorldBookConfigPanel } from './ui/WorldBookConfigPanel.js';
import { AIMemoryDatabaseInjector } from './core/AIMemoryDatabaseInjector.js';
import { ContentFilterManager } from './core/ContentFilterManager.js';
import { MessageFilterHook } from './core/MessageFilterHook.js';

// 导入UI组件
import { InfoBarSettings } from './ui/InfoBarSettings.js';
import { DataTable } from './ui/DataTable.js';
import { MessageInfoBarRenderer } from './ui/MessageInfoBarRenderer.js';
import { SummaryManager } from './core/SummaryManager.js';
import { AIMemorySummarizer } from './core/AIMemorySummarizer.js';
import { VectorizedMemoryRetrieval } from './core/VectorizedMemoryRetrieval.js';
import { DeepMemoryManager } from './core/DeepMemoryManager.js';
import { IntelligentMemoryClassifier } from './core/IntelligentMemoryClassifier.js';
import { MemoryMaintenanceSystem } from './core/MemoryMaintenanceSystem.js';
import { ContextualRetrieval } from './core/ContextualRetrieval.js';
import { UserProfileManager } from './core/UserProfileManager.js';
import { KnowledgeGraphManager } from './core/KnowledgeGraphManager.js';
import { TimeAwareMemoryManager } from './core/TimeAwareMemoryManager.js';
import { SillyTavernIntegration } from './core/SillyTavernIntegration.js';
import { FrontendDisplayManager } from './ui/FrontendDisplayManager.js';

// 提前初始化控制台门禁：默认不输出信息栏日志，直到调试模式应用级别
(function bootstrapInfobarConsoleGate() {
    try {
        if (window.__InfobarConsoleOriginal) return;

        const original = {
            log: console.log.bind(console),
            info: console.info?.bind(console) || console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };

        window.__InfobarConsoleOriginal = original;
        if (!window.SillyTavernInfobar) window.SillyTavernInfobar = {};
        const rt = (window.SillyTavernInfobar.runtimeLogs = window.SillyTavernInfobar.runtimeLogs || []);
        const push = (level, args) => {
            try {
                rt.push({ level, time: Date.now(), message: Array.from(args).map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ') });
                if (rt.length > 500) rt.shift();
            } catch {}
        };

        // 默认静默收集
        console.log = (...args) => { push('debug', args); };
        console.info = (...args) => { push('info', args); };
        console.warn = (...args) => { push('warn', args); };
        console.error = (...args) => { push('error', args); };

        window.__InfobarRestore = () => {
            console.log = original.log;
            console.info = original.info;
            console.warn = original.warn;
            console.error = original.error;
        };
    } catch {}
})();

// 功能模块将在后续版本中添加
// import { ContentManager } from './modules/ContentManager.js';
// import { PanelManager } from './modules/PanelManager.js';
// import { DataManager } from './modules/DataManager.js';

// 扩展主类
class InformationBarIntegrationTool {
    constructor() {
        console.log('[InfoBarTool] 🚀 Information Bar Integration Tool 初始化开始');

        // 扩展标识
        this.MODULE_NAME = 'information_bar_integration_tool';
        this.VERSION = '1.0.0';

        // 核心模块
        this.dataCore = null;
        this.eventSystem = null;
        this.configManager = null;
        this.apiIntegration = null;
        this.smartPromptSystem = null;
        this.xmlDataParser = null;
        this.dataSnapshotManager = null;
        this.stscriptDataSync = null;
        this.fieldRuleManager = null;
        this.panelRuleManager = null;
        this.htmlTemplateParser = null;
        this.aiTemplateAssistant = null;
        this.templateManager = null;
        this.variableSystemPrompt = null;
        this.contentFilterManager = null;
        this.messageFilterHook = null;

        // UI组件
        this.infoBarSettings = null;
        this.dataTable = null;

        // 总结功能
        this.summaryManager = null;

        // 🧠 AI记忆数据库注入器
        this.aiMemoryDatabaseInjector = null;

        // 前端显示功能
        this.frontendDisplayManager = null;

        // 功能模块 (将在后续版本中添加)
        // this.contentManager = null;
        // this.panelManager = null;
        // this.dataManager = null;

        // SillyTavern上下文
        this.context = null;

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        this.version = '1.0.0';

        // 绑定方法
        this.init = this.init.bind(this);
        this.onAppReady = this.onAppReady.bind(this);
        this.createUI = this.createUI.bind(this);
        this.handleError = this.handleError.bind(this);
    }

    /**
     * 初始化扩展
     */
    async init() {
        try {
        console.log('[InfoBarTool] 📊 开始初始化核心模块...');

            // 获取SillyTavern上下文
            this.context = SillyTavern.getContext();

            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }

            // 初始化核心模块
            await this.initCoreModules();

            // 初始化UI组件
            await this.initUIComponents();

            // 初始化功能模块
            await this.initFunctionModules();

            // 监听SillyTavern事件
            this.bindSillyTavernEvents();

            // 创建用户界面
            this.createUI();

            this.initialized = true;
            console.log('[InfoBarTool] ✅ Information Bar Integration Tool 初始化完成');

            // 🔧 修复：更新全局modules对象，确保所有模块都能被访问
            this.updateGlobalModules();

            // 触发初始化完成事件
            this.eventSystem.emit('tool:initialized', {
                version: this.VERSION,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[InfoBarTool] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 初始化核心模块
     */
    async initCoreModules() {
        console.log('[InfoBarTool] 🔧 初始化核心模块...');

        // 初始化事件系统
        this.eventSystem = new EventSystem();

        // 🔧 新增：初始化内容过滤管理器（需要在事件系统之后，用于过滤发送到主API的内容）
        this.contentFilterManager = new ContentFilterManager(this.eventSystem);
        console.log('[InfoBarTool] ✅ 内容过滤管理器初始化完成');

        // 🔧 新增：初始化消息过滤Hook（需要在内容过滤管理器之后）
        this.messageFilterHook = new MessageFilterHook(this.contentFilterManager);
        console.log('[InfoBarTool] ✅ 消息过滤Hook初始化完成');

        // 初始化数据核心
        this.dataCore = new UnifiedDataCore(this.eventSystem);
        await this.dataCore.init();

        // 🔧 修复：设置全局InfoBarData引用
        window.InfoBarData = this.dataCore;

        // 初始化配置管理器
        this.configManager = new ConfigManager(this.dataCore);
        await this.configManager.init();

        // 初始化API集成
        this.apiIntegration = new APIIntegration(this.configManager);
        await this.apiIntegration.init();

        // 初始化XML数据解析器
        this.xmlDataParser = new XMLDataParser(this.eventSystem);

        // 初始化数据快照管理器
        this.dataSnapshotManager = new DataSnapshotManager(this.dataCore, this.eventSystem);
        await this.dataSnapshotManager.init();

        // 初始化字段规则管理器
        this.fieldRuleManager = new FieldRuleManager(this.dataCore, this.eventSystem);
        await this.fieldRuleManager.init();

        // 初始化面板规则管理器
        this.panelRuleManager = new PanelRuleManager(this.dataCore, this.eventSystem);
        await this.panelRuleManager.init();

        // 初始化HTML模板解析器
        this.htmlTemplateParser = new HTMLTemplateParser({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager
        });
        await this.htmlTemplateParser.init();

        // 初始化AI模板助手
        this.aiTemplateAssistant = new AITemplateAssistant({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager,
            apiIntegration: this.apiIntegration,
            htmlTemplateParser: this.htmlTemplateParser
        });
        await this.aiTemplateAssistant.init();

        // 初始化模板管理器
        this.templateManager = new TemplateManager({
            configManager: this.configManager,
            eventSystem: this.eventSystem,
            htmlTemplateParser: this.htmlTemplateParser
        });
        await this.templateManager.init();

        // 初始化NPC数据库管理器
        this.npcDatabaseManager = new NPCDatabaseManager({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
        });
        await this.npcDatabaseManager.init();

        // 🆕 新增：初始化世界书管理器
        this.worldBookManager = new WorldBookManager(this.configManager, this.eventSystem, this.dataCore);
        await this.worldBookManager.init();

        // 🆕 新增：初始化世界书配置面板
        this.worldBookConfigPanel = new WorldBookConfigPanel(this.worldBookManager, this.configManager, this.eventSystem);

        // 初始化智能提示词系统（需要在fieldRuleManager和panelRuleManager之后）
        this.smartPromptSystem = new SmartPromptSystem(this.configManager, this.eventSystem, this.dataCore, this.fieldRuleManager, this.panelRuleManager);
        await this.smartPromptSystem.init();

        // 🔧 新增：初始化变量系统读取提示词（独立于智能提示词系统）
        this.variableSystemPrompt = new VariableSystemPrompt(this.eventSystem);
        await this.variableSystemPrompt.init();

        // 🔧 已删除：STScript数据同步系统不再需要
        this.stscriptDataSync = null;

        // 初始化AI数据暴露模块
        try {
            this.aiDataExposure = new AIDataExposure({
                unifiedDataCore: this.dataCore,
                eventSystem: this.eventSystem,
                fieldRuleManager: this.fieldRuleManager,
                panelRuleManager: this.panelRuleManager
            });
            await this.aiDataExposure.init();
            console.log('[InfoBarTool] ✅ AI数据暴露模块初始化完成');
        } catch (error) {
            console.warn('[InfoBarTool] ⚠️ AI数据暴露模块初始化失败:', error.message);
            this.aiDataExposure = null;
        }

        // 初始化消息监听器
        this.eventSystem.initMessageListener(this.xmlDataParser, this.dataCore);

        console.log('[InfoBarTool] ✅ 核心模块初始化完成');
    }

    /**
     * 初始化UI组件
     */
    async initUIComponents() {
        console.log('[InfoBarTool] 🎨 初始化UI组件...');

        // 初始化信息栏设置界面
        this.infoBarSettings = new InfoBarSettings(
            this.configManager,
            this.apiIntegration,
            this.eventSystem
        );

        // 🔧 修复：调用InfoBarSettings的init方法，确保CustomAPITaskQueue被正确初始化
        await this.infoBarSettings.init();

        // InfoBarSettings初始化完成后，检查并自动设置自定义API Hook
        await this.checkAndSetupCustomAPIHookAfterInit();

        // 初始化数据表格界面
        this.dataTable = new DataTable(
            this.dataCore,
            this.configManager,
            this.eventSystem
        );
        // 🔧 修复：立即初始化数据表格，确保UI界面在系统启动时就创建
        await this.dataTable.init();

        // 初始化消息信息栏渲染器
        this.messageInfoBarRenderer = new MessageInfoBarRenderer({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager,
            htmlTemplateParser: this.htmlTemplateParser
        });

        // 初始化总结管理器
        this.summaryManager = new SummaryManager(
            this.dataCore,
            this.eventSystem,
            this.infoBarSettings
        );
        await this.summaryManager.init();

        // 🚀 新增：初始化AI记忆总结器
        this.aiMemorySummarizer = new AIMemorySummarizer(
            this.dataCore,
            this.eventSystem,
            this.summaryManager,
            this.smartPromptSystem
        );
        await this.aiMemorySummarizer.init();

        // 🚀 设置AI记忆总结器到总结管理器
        this.summaryManager.setAIMemorySummarizer(this.aiMemorySummarizer);

        // 🔍 新增：初始化向量化记忆检索系统
        this.vectorizedMemoryRetrieval = new VectorizedMemoryRetrieval(
            this.dataCore,
            this.eventSystem,
            this.aiMemorySummarizer
        );
        await this.vectorizedMemoryRetrieval.init();

        // 🔍 设置向量化记忆检索系统到总结管理器
        this.summaryManager.setVectorizedMemoryRetrieval(this.vectorizedMemoryRetrieval);

        // 🧠 新增：初始化深度记忆管理器
        this.deepMemoryManager = new DeepMemoryManager(
            this.dataCore,
            this.eventSystem,
            this.aiMemorySummarizer,
            this.vectorizedMemoryRetrieval
        );
        await this.deepMemoryManager.init();

        // 🤖 新增：初始化智能记忆分类器
        this.intelligentMemoryClassifier = new IntelligentMemoryClassifier(
            this.dataCore,
            this.eventSystem,
            this.vectorizedMemoryRetrieval,
            this.deepMemoryManager
        );
        await this.intelligentMemoryClassifier.init();

        // 🔧 新增：初始化记忆自动维护系统
        this.memoryMaintenanceSystem = new MemoryMaintenanceSystem(
            this.dataCore,
            this.eventSystem,
            this.deepMemoryManager,
            this.vectorizedMemoryRetrieval
        );
        await this.memoryMaintenanceSystem.init();

        // 🔍 新增：初始化上下文感知检索系统
        this.contextualRetrieval = new ContextualRetrieval(
            this.dataCore,
            this.eventSystem,
            this.vectorizedMemoryRetrieval,
            this.deepMemoryManager
        );
        await this.contextualRetrieval.init();

        // 👤 新增：初始化用户画像管理系统
        this.userProfileManager = new UserProfileManager(
            this.dataCore,
            this.eventSystem,
            this.deepMemoryManager,
            this.contextualRetrieval
        );
        await this.userProfileManager.init();

        // 🕸️ 新增：初始化知识图谱管理系统
        this.knowledgeGraphManager = new KnowledgeGraphManager(
            this.dataCore,
            this.eventSystem,
            this.deepMemoryManager,
            this.userProfileManager
        );
        await this.knowledgeGraphManager.init();

        // ⏰ 新增：初始化时间感知记忆管理系统
        this.timeAwareMemoryManager = new TimeAwareMemoryManager(
            this.dataCore,
            this.eventSystem,
            this.deepMemoryManager
        );
        await this.timeAwareMemoryManager.init();

        // 🔗 新增：初始化SillyTavern深度集成
        this.sillyTavernIntegration = new SillyTavernIntegration({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
            deepMemoryManager: this.deepMemoryManager,
            contextualRetrieval: this.contextualRetrieval,
            userProfileManager: this.userProfileManager,
            knowledgeGraphManager: this.knowledgeGraphManager,
            timeAwareMemoryManager: this.timeAwareMemoryManager,
            memoryMaintenanceSystem: this.memoryMaintenanceSystem
        });
        await this.sillyTavernIntegration.init();

        // 🧠 新增：初始化AI记忆数据库注入器
        this.aiMemoryDatabaseInjector = new AIMemoryDatabaseInjector({
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager,
            summaryManager: this.summaryManager,
            aiMemorySummarizer: this.aiMemorySummarizer,
            vectorizedMemoryRetrieval: this.vectorizedMemoryRetrieval,
            deepMemoryManager: this.deepMemoryManager,
            intelligentMemoryClassifier: this.intelligentMemoryClassifier
        });
        await this.aiMemoryDatabaseInjector.init();

        // 🔧 修改：STScript同步系统已禁用，跳过SummaryManager设置

        // 初始化前端显示管理器
        this.frontendDisplayManager = new FrontendDisplayManager(
            this.configManager,
            this.eventSystem,
            this.dataCore
        );
        // 启动前端显示管理器
        await this.frontendDisplayManager.init();

        // 初始化NPC管理面板（懒显示）
        this.npcManagementPanel = new NPCManagementPanel({
            npcDatabaseManager: this.npcDatabaseManager,
            unifiedDataCore: this.dataCore,
            eventSystem: this.eventSystem,
        });


        // 🔧 新增：应用已保存主题到全局（无需打开设置界面）
        await this.applySavedThemeAtStartup();

        // 创建modules对象以便外部访问
        this.modules = {
            settings: this.infoBarSettings,
            dataTable: this.dataTable,
            dataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager,
            apiIntegration: this.apiIntegration,
            smartPromptSystem: this.smartPromptSystem,
            messageInfoBarRenderer: this.messageInfoBarRenderer,
            xmlDataParser: this.xmlDataParser,
            dataSnapshotManager: this.dataSnapshotManager,
            aiDataExposure: this.aiDataExposure,
            summaryManager: this.summaryManager,
            aiMemorySummarizer: this.aiMemorySummarizer,
            vectorizedMemoryRetrieval: this.vectorizedMemoryRetrieval,
            deepMemoryManager: this.deepMemoryManager,
            intelligentMemoryClassifier: this.intelligentMemoryClassifier,
            aiMemoryDatabaseInjector: this.aiMemoryDatabaseInjector,
            frontendDisplayManager: this.frontendDisplayManager,
            fieldRuleManager: this.fieldRuleManager,
            panelRuleManager: this.panelRuleManager,
            htmlTemplateParser: this.htmlTemplateParser,
            aiTemplateAssistant: this.aiTemplateAssistant,
            templateManager: this.templateManager,
            npcDatabaseManager: this.npcDatabaseManager,
            npcManagementPanel: this.npcManagementPanel
        };

        // 🔧 修复：更新全局对象以使用正确初始化的模块
        if (window.SillyTavernInfobar) {
            window.SillyTavernInfobar.modules = this.modules;
            console.log('[InfoBarTool] 🔧 已更新全局 modules 对象');
        }

        console.log('[InfoBarTool] ✅ UI组件初始化完成');
    }

    /**
     * 🔧 新增：在启动时应用已保存的主题并广播给相关模块
     * 说明：部分样式依赖 CSS 变量（--theme-*），否则包装器会显示为默认主题。
     */
    async applySavedThemeAtStartup() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context?.extensionSettings || {};
            const configs = extensionSettings['Information bar integration tool'] || {};

            const themeId = configs?.theme?.current;
            if (!this.infoBarSettings || !this.infoBarSettings.getThemeById) return;

            const theme = themeId ? this.infoBarSettings.getThemeById(themeId) : null;
            if (theme && typeof this.infoBarSettings.applyTheme === 'function') {
                // 设置根CSS变量；若未打开设置界面也可生效
                this.infoBarSettings.applyTheme(theme);
                // 广播一次主题变化，便于其他模块立即响应
                this.eventSystem?.emit('theme:changed', { themeId: theme.id, colors: theme.colors });
                console.log('[InfoBarTool] 🎨 已在启动时应用主题:', themeId);
            } else {
                console.log('[InfoBarTool] ℹ️ 未找到保存的主题或主题表，跳过启动主题应用');
            }
        } catch (error) {
            console.warn('[InfoBarTool] ⚠️ 启动时应用主题失败（可继续运行）:', error);
        }
    }

    /**
     * 初始化功能模块 (将在后续版本中实现)
     */
    async initFunctionModules() {
        console.log('[InfoBarTool] ⚙️ 功能模块将在后续版本中添加...');

        // 功能模块将在后续版本中实现
        // this.contentManager = new ContentManager(this.dataCore, this.eventSystem);
        // this.panelManager = new PanelManager(this.dataCore, this.eventSystem);
        // this.dataManager = new DataManager(this.dataCore, this.eventSystem);

        console.log('[InfoBarTool] ✅ 功能模块初始化跳过');
    }

    /**
     * 检查并自动设置自定义API Hook
     */
    async checkAndSetupCustomAPIHook() {
        try {
            console.log('[InfoBarTool] 🔍 检查自定义API配置...');

            // 获取扩展设置中的API配置
            const extensionSettings = this.context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const apiConfig = configs.apiConfig || {};

            // 检查自定义API是否已启用
            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                console.log('[InfoBarTool] ✅ 检测到自定义API已启用，自动设置Hook...');
                console.log('[InfoBarTool] 📊 API提供商:', apiConfig.provider);
                console.log('[InfoBarTool] 📊 API模型:', apiConfig.model);

                // 通过InfoBarSettings启用自定义API模式
                if (this.infoBarSettings && typeof this.infoBarSettings.enableCustomAPIMode === 'function') {
                    await this.infoBarSettings.enableCustomAPIMode();
                    console.log('[InfoBarTool] ✅ 自定义API Hook已自动设置');
                } else {
                    console.warn('[InfoBarTool] ⚠️ InfoBarSettings不可用，无法设置自定义API Hook');
                }
            } else {
                console.log('[InfoBarTool] ℹ️ 自定义API未启用或配置不完整，使用主API模式');
            }

        } catch (error) {
            console.error('[InfoBarTool] ❌ 检查自定义API配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * InfoBarSettings初始化完成后检查并自动设置自定义API Hook
     */
    async checkAndSetupCustomAPIHookAfterInit() {
        try {
            console.log('[InfoBarTool] 🔍 InfoBarSettings初始化完成，检查自定义API配置...');

            // 获取扩展设置中的API配置
            const extensionSettings = this.context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const apiConfig = configs.apiConfig || {};

            // 检查自定义API是否已启用
            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                console.log('[InfoBarTool] ✅ 检测到自定义API已启用，自动设置Hook...');
                console.log('[InfoBarTool] 📊 API提供商:', apiConfig.provider);
                console.log('[InfoBarTool] 📊 API模型:', apiConfig.model);

                // 通过InfoBarSettings启用自定义API模式
                if (this.infoBarSettings && typeof this.infoBarSettings.handleAPIEnabledChange === 'function') {
                    // 模拟API启用状态变更，触发自定义API Hook设置
                    await this.infoBarSettings.handleAPIEnabledChange(true);
                    console.log('[InfoBarTool] ✅ 自定义API Hook已自动设置');
                } else {
                    console.warn('[InfoBarTool] ⚠️ InfoBarSettings的handleAPIEnabledChange方法不可用');
                }
            } else {
                console.log('[InfoBarTool] ℹ️ 自定义API未启用或配置不完整，使用主API模式');
            }

        } catch (error) {
            console.error('[InfoBarTool] ❌ InfoBarSettings初始化后检查自定义API配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定SillyTavern事件
     */
    bindSillyTavernEvents() {
        const { eventSource, event_types } = this.context;

        // 监听应用就绪事件
        eventSource.on(event_types.APP_READY, this.onAppReady);

        // 监听聊天切换事件
        eventSource.on(event_types.CHAT_CHANGED, (data) => {
            this.eventSystem.emit('chat:changed', data);
        });

        // 🔧 修复：移除直接转发，让EventSystem完全负责消息事件处理
        // EventSystem已经在bindMessageEvents()中监听了这些事件并进行智能过滤
        // 直接转发会绕过EventSystem的过滤机制，导致时序问题

        console.log('[InfoBarTool] ℹ️ 消息事件由EventSystem统一处理，不再直接转发');

        console.log('[InfoBarTool] 🔗 SillyTavern事件绑定完成');
    }

    /**
     * 应用就绪事件处理
     */
    onAppReady() {
        console.log('[InfoBarTool] 🎯 SillyTavern应用就绪');
        this.eventSystem.emit('app:ready');
        
        // 🔧 新增：安装消息过滤Hook，在发送到主API之前应用正则表达式过滤
        if (this.messageFilterHook) {
            try {
                this.messageFilterHook.install();
                console.log('[InfoBarTool] ✅ 消息过滤Hook已安装');
            } catch (error) {
                console.error('[InfoBarTool] ❌ 安装消息过滤Hook失败:', error);
            }
        }
    }

    /**
     * 创建用户界面
     */
    createUI() {
        console.log('[InfoBarTool] 🖼️ 创建用户界面...');

        try {
            // 获取正确的扩展菜单按钮容器
            const extensionContainer = document.querySelector('#extensionsMenuButton');

            if (!extensionContainer) {
                throw new Error('找不到扩展菜单按钮容器 #extensionsMenuButton');
            }

            console.log('[InfoBarTool] 📍 使用扩展容器:', extensionContainer.id || extensionContainer.className);

            // 查找或创建扩展菜单下拉列表
            let extensionMenu = extensionContainer.nextElementSibling;
            if (!extensionMenu || !extensionMenu.classList.contains('dropdown-menu')) {
                // 如果没有找到下拉菜单，查找父级容器中的菜单
                const parentContainer = extensionContainer.parentElement;
                extensionMenu = parentContainer?.querySelector('.dropdown-menu') ||
                              parentContainer?.querySelector('#extensionsMenu') ||
                              document.querySelector('#extensionsMenu');
            }

            if (!extensionMenu) {
                // 如果仍然没有找到，创建一个简单的菜单容器
                extensionMenu = document.createElement('div');
                extensionMenu.className = 'dropdown-menu';
                extensionMenu.id = 'extensionsMenu';
                extensionContainer.parentElement.appendChild(extensionMenu);
            }

            // 创建"信息栏设置"菜单项
            const settingsMenuItem = document.createElement('a');
            settingsMenuItem.id = 'infobar-settings-menu-item';
            settingsMenuItem.className = 'dropdown-item';
            settingsMenuItem.href = '#';
            settingsMenuItem.innerHTML = '<i class="fa-solid fa-cog"></i> 信息栏设置';

            // 创建"数据表格"菜单项
            const tableMenuItem = document.createElement('a');
            tableMenuItem.id = 'infobar-table-menu-item';
            tableMenuItem.className = 'dropdown-item';
            tableMenuItem.href = '#';
            tableMenuItem.innerHTML = '<i class="fa-solid fa-table"></i> 数据表格';

            // 绑定菜单项事件
            settingsMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.infoBarSettings.show();
            });

            tableMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                this.dataTable.show();
            });

            // 添加分隔线（如果菜单中已有其他项目）
            if (extensionMenu.children.length > 0) {
                const separator = document.createElement('div');
                separator.className = 'dropdown-divider';
                extensionMenu.appendChild(separator);
            }

            // 添加菜单项到扩展菜单
            extensionMenu.appendChild(settingsMenuItem);
            extensionMenu.appendChild(tableMenuItem);

            console.log('[InfoBarTool] ✅ 用户界面创建完成');

        } catch (error) {
            console.error('[InfoBarTool] ❌ 创建用户界面失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[InfoBarTool] ❌ 错误 #${this.errorCount}:`, error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('tool:error', {
                error: error.message,
                count: this.errorCount,
                timestamp: Date.now()
            });
        }

        // 如果错误过多，禁用扩展
        if (this.errorCount >= 5) {
            console.error('[InfoBarTool] ⚠️ 错误过多，禁用扩展');
            this.disable();
        }
    }

    /**
     * 禁用扩展
     */
    disable() {
        this.initialized = false;
        console.log('[InfoBarTool] 🚫 扩展已禁用');
    }

    /**
     * 🔧 修复：更新全局modules对象
     */
    updateGlobalModules() {
        try {
            if (!window.SillyTavernInfobar) {
                window.SillyTavernInfobar = {};
            }

                    // 更新modules对象，包含所有初始化完成的模块
        window.SillyTavernInfobar.modules = {
            // 核心模块
            settings: this.infoBarSettings,
            dataTable: this.dataTable,
            dataCore: this.dataCore,
            eventSystem: this.eventSystem,
            configManager: this.configManager,
            apiIntegration: this.apiIntegration,
            smartPromptSystem: this.smartPromptSystem,
            messageInfoBarRenderer: this.messageInfoBarRenderer,
            xmlDataParser: this.xmlDataParser,
            aiDataExposure: this.aiDataExposure, // 🔧 添加：AI数据暴露模块
                dataSnapshotManager: this.dataSnapshotManager,
                summaryManager: this.summaryManager,
                aiMemorySummarizer: this.aiMemorySummarizer,
                vectorizedMemoryRetrieval: this.vectorizedMemoryRetrieval,
                deepMemoryManager: this.deepMemoryManager,
                intelligentMemoryClassifier: this.intelligentMemoryClassifier,
                memoryMaintenanceSystem: this.memoryMaintenanceSystem, // 🔧 新增：记忆自动维护系统
                contextualRetrieval: this.contextualRetrieval, // 🔍 新增：上下文感知检索系统
                userProfileManager: this.userProfileManager, // 👤 新增：用户画像管理系统
                knowledgeGraphManager: this.knowledgeGraphManager, // 🕸️ 新增：知识图谱管理系统
                timeAwareMemoryManager: this.timeAwareMemoryManager, // ⏰ 新增：时间感知记忆管理系统
                sillyTavernIntegration: this.sillyTavernIntegration, // 🔗 新增：SillyTavern深度集成
                aiMemoryDatabaseInjector: this.aiMemoryDatabaseInjector, // 🧠 添加：AI记忆数据库注入器
                frontendDisplayManager: this.frontendDisplayManager,
                fieldRuleManager: this.fieldRuleManager,
                panelRuleManager: this.panelRuleManager,
                htmlTemplateParser: this.htmlTemplateParser,
                aiTemplateAssistant: this.aiTemplateAssistant,
                templateManager: this.templateManager,
                variableSystemPrompt: this.variableSystemPrompt,
                npcDatabaseManager: this.npcDatabaseManager,
                npcManagementPanel: this.npcManagementPanel,
                worldBookManager: this.worldBookManager,
                worldBookConfigPanel: this.worldBookConfigPanel,
                contentFilterManager: this.contentFilterManager, // 🔧 新增：内容过滤管理器
                messageFilterHook: this.messageFilterHook, // 🔧 新增：消息过滤Hook
                // 🔧 修复：添加自定义API任务队列模块
                customAPITaskQueue: this.infoBarSettings?.customAPITaskQueue
            };

            // 确保eventSource也被设置
            window.SillyTavernInfobar.eventSource = this.eventSystem;

            console.log('[InfoBarTool] 🔧 全局modules对象已更新');

        } catch (error) {
            console.error('[InfoBarTool] ❌ 更新全局modules对象失败:', error);
        }
    }

    /**
     * 获取扩展状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            version: this.VERSION,
            modules: {
                dataCore: !!this.dataCore,
                eventSystem: !!this.eventSystem,
                configManager: !!this.configManager,
                apiIntegration: !!this.apiIntegration,
                smartPromptSystem: !!this.smartPromptSystem,
                infoBarSettings: !!this.infoBarSettings,
                dataTable: !!this.dataTable,
                messageInfoBarRenderer: !!this.messageInfoBarRenderer
            }
        };
    }
}

// 创建全局实例
const informationBarTool = new InformationBarIntegrationTool();

// 等待DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', informationBarTool.init);
} else {
    informationBarTool.init();
}

// 🔧 修复：先创建基本的全局对象结构，modules 将在初始化完成后更新
window.SillyTavernInfobar = {
    modules: {
        infoBarTool: informationBarTool,
        // 其他模块将在初始化完成后动态添加
        dataCore: informationBarTool.dataCore,
        eventSystem: informationBarTool.eventSystem,
        fieldRuleManager: informationBarTool.fieldRuleManager,
        panelRuleManager: informationBarTool.panelRuleManager
    },
    eventSource: informationBarTool.eventSystem
};
// 🔧 已移除：STScript数据同步功能已删除
// window.STScriptDataSync = STScriptDataSync;

// 🔧 修复：确保规则管理器在运行时始终可用的备用机制
setTimeout(() => {
    if (!window.SillyTavernInfobar.modules.fieldRuleManager && informationBarTool.fieldRuleManager) {
        window.SillyTavernInfobar.modules.fieldRuleManager = informationBarTool.fieldRuleManager;
        console.log('[InfoBarTool] 🔧 备用机制：fieldRuleManager 已添加到全局 modules');
    }

    if (!window.SillyTavernInfobar.modules.panelRuleManager && informationBarTool.panelRuleManager) {
        window.SillyTavernInfobar.modules.panelRuleManager = informationBarTool.panelRuleManager;
        console.log('[InfoBarTool] 🔧 备用机制：panelRuleManager 已添加到全局 modules');
    }
}, 1000);

console.log('[InfoBarTool] 📦 Information Bar Integration Tool 加载完成');
