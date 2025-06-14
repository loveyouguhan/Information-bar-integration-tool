/**
 * Advanced InfoBar System for SillyTavern v2.2.0
 * 高级信息栏系统 - 智能细节补充版本
 */

(() => {
    'use strict';

    // 扩展配置
    const EXTENSION_NAME = 'advanced-infobar-system';
    const EXTENSION_VERSION = '2.2.0';

    // 全局变量
    let context = null;
    let extensionSettings = null;
    let isInitialized = false;
    let currentInfoBarData = { npcs: {} };
    let latestChangeset = new Set();
    let selectedNpcId = null;
    let panelConfigManager = null;

    // 正则表达式
    const AI_DATA_BLOCK_REGEX = /<infobar_data>([\s\S]*?)<\/infobar_data>/si;
    const AI_THINK_PROCESS_REGEX = /<aiThinkProcess>[\s\S]*?<\/aiThinkProcess>/si;

    // 默认设置
    const DEFAULT_SETTINGS = {
        enabled: true,
        renderInfoBarInChat: true,
        defaultCollapsed: false,
        theme: 'modern-dark',
        autoRenderCheck: true,
        memoryAssistEnabled: true,
        debugMode: false,
        forceLevel: 'medium',
        updateFrequency: 'every',
        enabledPanels: {
            personal: true,
            interaction: true,
            tasks: true,
            world: true,
            company: false,
            internet: false,
            inventory: true,
            abilities: true,
            story: true
        },
        panelItems: {}
    };

    // 备用面板配置（当文件加载失败时使用）
    const FALLBACK_PANEL_CONFIG = {
        personal: {
            id: 'personal',
            label: '个人面板',
            icon: 'fa-user-circle',
            description: '角色自身的基础信息',
            items: [
                { id: 'name', label: '姓名', defaultValue: true, category: 'basic' },
                { id: 'age', label: '年龄', defaultValue: true, category: 'basic' },
                { id: 'mood', label: '情绪', defaultValue: true, category: 'status' }
            ]
        },
        interaction: {
            id: 'interaction',
            label: '交互对象',
            icon: 'fa-users',
            description: '当前场景中的NPC信息',
            items: [
                { id: 'name', label: '姓名', defaultValue: true, category: 'basic' },
                { id: 'mood', label: '情绪', defaultValue: true, category: 'status' },
                { id: 'affection', label: '好感度', defaultValue: true, category: 'relationship' }
            ]
        },
        tasks: {
            id: 'tasks',
            label: '任务系统',
            icon: 'fa-tasks',
            description: '当前任务和目标',
            items: [
                { id: 'mainQuest', label: '主线任务', defaultValue: true, category: 'type' },
                { id: 'currentObjective', label: '当前目标', defaultValue: true, category: 'display' }
            ]
        },
        world: {
            id: 'world',
            label: '世界面板',
            icon: 'fa-globe-americas',
            description: '世界环境信息',
            items: [
                { id: 'time', label: '时间', defaultValue: true, category: 'environment' },
                { id: 'location', label: '地点', defaultValue: true, category: 'environment' },
                { id: 'weather', label: '天气', defaultValue: true, category: 'environment' }
            ]
        },
        company: {
            id: 'company',
            label: '组织信息',
            icon: 'fa-building',
            description: '组织和公司信息',
            items: [
                { id: 'name', label: '组织名称', defaultValue: true, category: 'basic' },
                { id: 'position', label: '职位', defaultValue: true, category: 'basic' }
            ]
        },
        internet: {
            id: 'internet',
            label: '资讯内容',
            icon: 'fa-newspaper',
            description: '网络和媒体信息',
            items: [
                { id: 'socialMediaFeed', label: '社交媒体', defaultValue: true, category: 'social' },
                { id: 'newsHeadlines', label: '新闻', defaultValue: false, category: 'news' }
            ]
        },
        inventory: {
            id: 'inventory',
            label: '背包仓库',
            icon: 'fa-box',
            description: '物品和资源管理',
            items: [
                { id: 'inventoryItems', label: '背包物品', defaultValue: true, category: 'items' },
                { id: 'currency', label: '货币', defaultValue: true, category: 'resources' }
            ]
        },
        abilities: {
            id: 'abilities',
            label: '能力系统',
            icon: 'fa-magic',
            description: '技能和能力',
            items: [
                { id: 'specialAbilities', label: '特殊能力', defaultValue: true, category: 'abilities' },
                { id: 'learnedSkills', label: '技能', defaultValue: true, category: 'skills' }
            ]
        },
        story: {
            id: 'story',
            label: '剧情面板',
            icon: 'fa-book',
            description: '剧情进展和事件',
            items: [
                { id: 'currentChapter', label: '当前章节', defaultValue: true, category: 'progress' },
                { id: 'keyEvents', label: '关键事件', defaultValue: true, category: 'events' }
            ]
        }
    };

    // 主题配置
    const THEMES = {
        'modern-dark': {
            name: '现代深色',
            variables: {
                '--infobar-bg': '#2d3748',
                '--infobar-text': '#e2e8f0',
                '--infobar-border': '#4a5568',
                '--infobar-hover': '#374151',
                '--infobar-primary': '#4299e1',
                '--infobar-text-muted': '#a0aec0'
            }
        },
        'light': {
            name: '浅色模式',
            variables: {
                '--infobar-bg': '#ffffff',
                '--infobar-text': '#2d3748',
                '--infobar-border': '#e2e8f0',
                '--infobar-hover': '#f7fafc',
                '--infobar-primary': '#3182ce',
                '--infobar-text-muted': '#718096'
            }
        },
        'cyberpunk': {
            name: '赛博朋克',
            variables: {
                '--infobar-bg': '#0a0f21',
                '--infobar-text': '#00f0c0',
                '--infobar-border': '#301b49',
                '--infobar-hover': '#101830',
                '--infobar-primary': '#ff007f',
                '--infobar-text-muted': '#60c0a0'
            }
        },
        'steampunk': {
            name: '蒸汽朋克',
            variables: {
                '--infobar-bg': '#4a3b2a',
                '--infobar-text': '#e0d0b0',
                '--infobar-border': '#6a503a',
                '--infobar-hover': '#3a2b1a',
                '--infobar-primary': '#d4a017',
                '--infobar-text-muted': '#c0b090'
            }
        },
        'nature': {
            name: '护眼绿',
            variables: {
                '--infobar-bg': '#f0f8f0',
                '--infobar-text': '#364e36',
                '--infobar-border': '#a9c4a9',
                '--infobar-hover': '#e0f0e0',
                '--infobar-primary': '#4caf50',
                '--infobar-text-muted': '#6a8a6a'
            }
        },
        'ocean': {
            name: '海洋蓝',
            variables: {
                '--infobar-bg': '#0f2027',
                '--infobar-text': '#b8d4e3',
                '--infobar-border': '#2c5f69',
                '--infobar-hover': '#1a3a47',
                '--infobar-primary': '#00d4ff',
                '--infobar-text-muted': '#7fb8d1'
            }
        }
    };

    /**
     * 面板配置管理器 - 从文件加载配置
     */
    class PanelConfigManager {
        constructor() {
            this.configs = {};
            this.isLoaded = false;
            // 修复：使用正确的扩展路径，URL编码空格
            this.extensionPath = '/scripts/extensions/third-party/Information%20Integration%20Tool';
        }

        /**
         * 加载所有面板配置
         */
        async loadAllConfigs() {
            const panelFiles = [
                'personal', 'interaction', 'tasks', 'world', 
                'company', 'internet', 'inventory', 'abilities', 'story'
            ];

            console.log('[InfoBar System] 开始加载面板配置文件...');
            console.log('[InfoBar System] 扩展路径:', this.extensionPath);
            
            const loadPromises = panelFiles.map(panelId => this.loadPanelConfig(panelId));
            
            try {
                await Promise.all(loadPromises);
                this.isLoaded = true;
                console.log('[InfoBar System] 所有面板配置加载完成');
            } catch (error) {
                console.error('[InfoBar System] 面板配置加载失败:', error);
                this.loadFallbackConfigs();
            }
        }

        /**
         * 加载单个面板配置
         */
        async loadPanelConfig(panelId) {
            const url = `${this.extensionPath}/panels/${panelId}.json`;
            
            try {
                console.log(`[InfoBar System] 正在加载: ${url}`);
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const config = await response.json();
                
                // 验证配置格式
                if (this.validatePanelConfig(config)) {
                    this.configs[panelId] = config;
                    console.log(`[InfoBar System] ✓ 加载面板配置: ${config.label}`);
                } else {
                    throw new Error('配置格式验证失败');
                }
            } catch (error) {
                console.warn(`[InfoBar System] ✗ 无法加载 ${panelId} 配置: ${error.message}, 使用备用配置`);
                // 加载备用配置
                this.configs[panelId] = this.getFallbackConfig(panelId);
            }
        }

        /**
         * 验证面板配置格式
         */
        validatePanelConfig(config) {
            const requiredFields = ['id', 'label', 'icon', 'description', 'items'];
            const isValid = requiredFields.every(field => config.hasOwnProperty(field));
            
            if (!isValid) {
                console.error('[InfoBar System] 配置验证失败，缺少必要字段');
                return false;
            }
            
            if (!Array.isArray(config.items)) {
                console.error('[InfoBar System] items 字段必须是数组');
                return false;
            }
            
            return true;
        }

        /**
         * 获取备用配置
         */
        getFallbackConfig(panelId) {
            return FALLBACK_PANEL_CONFIG[panelId] || {
                id: panelId,
                label: panelId.charAt(0).toUpperCase() + panelId.slice(1),
                icon: 'fa-cog',
                description: `${panelId} 面板配置`,
                category: 'panel',
                defaultEnabled: false,
                priority: 999,
                items: []
            };
        }

        /**
         * 加载备用配置
         */
        loadFallbackConfigs() {
            this.configs = structuredClone(FALLBACK_PANEL_CONFIG);
            this.isLoaded = true;
            console.warn('[InfoBar System] 使用内置备用配置');
        }

        /**
         * 获取面板配置
         */
        getConfig(panelId) {
            return this.configs[panelId];
        }

        /**
         * 获取所有配置
         */
        getAllConfigs() {
            return this.configs;
        }

        /**
         * 生成智能AI提示
         */
        generateSmartAIPrompt(enabledPanels, settings) {
            let exampleData = '';
            let fieldRequirements = '';
            
            enabledPanels.forEach(panelId => {
                const config = this.configs[panelId];
                if (!config) return;
                
                const enabledItems = Object.keys(settings.panelItems[panelId] || {})
                    .filter(itemId => settings.panelItems[panelId][itemId]);
                
                if (enabledItems.length === 0) return;
                
                // 构建示例数据
                const examples = [];
                enabledItems.forEach(itemId => {
                    const item = config.items.find(i => i.id === itemId);
                    if (item && item.example) {
                        examples.push(`${itemId}: "${item.example}"`);
                    }
                });
                
                if (examples.length > 0) {
                    exampleData += `${panelId} ${examples.join(' ')}\n`;
                }
                
                // 构建字段要求
                fieldRequirements += `${panelId}: ${enabledItems.join(' ')} `;
            });
            
            return { exampleData, fieldRequirements };
        }

        /**
         * 生成AI提示指令
         */
        generateAIPrompt(enabledPanels) {
            let prompt = '';
            
            for (const panelId of enabledPanels) {
                const config = this.configs[panelId];
                if (!config) continue;
                
                prompt += `\n${panelId}: ${config.label}\n`;
                prompt += `说明: ${config.aiPromptHint || config.description}\n`;
                
                if (config.exampleData) {
                    prompt += `示例格式: ${JSON.stringify(config.exampleData)}\n`;
                }
                
                prompt += '字段说明:\n';
                if (config.items && config.items.length > 0) {
                    config.items.forEach(item => {
                        if (item.defaultValue) {
                            prompt += `- ${item.id}: ${item.aiHint || item.description}`;
                            if (item.example) {
                                prompt += ` (示例: ${item.example})`;
                            }
                            prompt += '\n';
                        }
                    });
                }
                prompt += '\n';
            }
            
            return prompt;
        }

        /**
         * 获取面板项目配置
         */
        getPanelItems(panelId) {
            const config = this.configs[panelId];
            return config ? config.items : [];
        }

        /**
         * 检查是否已加载
         */
        isReady() {
            return this.isLoaded;
        }
    }

    /**
     * 扩展初始化
     */
    async function initializeExtension() {
        if (isInitialized) return;

        try {
            console.log(`[InfoBar System v${EXTENSION_VERSION}] 开始初始化...`);

            // 获取SillyTavern上下文
            context = SillyTavern.getContext();
            extensionSettings = context.extensionSettings;

            // 初始化面板配置管理器
            panelConfigManager = new PanelConfigManager();
            await panelConfigManager.loadAllConfigs();

            // 初始化设置
            initializeSettings();

            // 注册生成拦截器（关键功能）
            registerGenerateInterceptor();

            // 注册事件监听器
            registerEventListeners();

            // 注册斜杠命令
            registerSlashCommands();

            // 注册UI界面
            registerUI();

            // 执行初始数据同步
            await performInitialSync();

            isInitialized = true;
            console.log(`[InfoBar System v${EXTENSION_VERSION}] 初始化完成！`);
            
            showNotification('高级信息栏系统已成功加载！', 'success');

        } catch (error) {
            console.error(`[InfoBar System v${EXTENSION_VERSION}] 初始化失败:`, error);
            showNotification('信息栏系统初始化失败: ' + error.message, 'error');
        }
    }

    /**
     * 初始化设置
     */
    function initializeSettings() {
        if (!extensionSettings[EXTENSION_NAME]) {
            extensionSettings[EXTENSION_NAME] = structuredClone(DEFAULT_SETTINGS);
        }

        // 确保所有默认键都存在
        const settings = extensionSettings[EXTENSION_NAME];
        for (const key in DEFAULT_SETTINGS) {
            if (settings[key] === undefined) {
                settings[key] = DEFAULT_SETTINGS[key];
            }
        }

        // 初始化面板子项设置
        if (!settings.panelItems) {
            settings.panelItems = {};
        }

        // 等待配置管理器加载完成后初始化面板项
        if (panelConfigManager && panelConfigManager.isReady()) {
            initializePanelItems(settings);
        }

        console.log('[InfoBar System] 设置已初始化');
    }

    /**
     * 初始化面板子项设置
     */
    function initializePanelItems(settings) {
        const allConfigs = panelConfigManager.getAllConfigs();
        
        for (const [panelId, panelConfig] of Object.entries(allConfigs)) {
            if (!settings.panelItems[panelId]) {
                settings.panelItems[panelId] = {};
            }
            
            if (panelConfig.items) {
                panelConfig.items.forEach(item => {
                    if (settings.panelItems[panelId][item.id] === undefined) {
                        settings.panelItems[panelId][item.id] = item.defaultValue;
                    }
                });
            }
        }
    }

    /**
     * 获取设置
     */
    function getSettings() {
        return extensionSettings[EXTENSION_NAME] || structuredClone(DEFAULT_SETTINGS);
    }

    /**
     * 保存设置
     */
    function saveSettings() {
        context.saveSettingsDebounced();
        console.log('[InfoBar System] 设置已保存');
    }

    /**
     * 🎯 核心功能：注册生成拦截器
     */
    function registerGenerateInterceptor() {
        // 注册全局拦截器函数
        globalThis.advancedInfoBarInterceptor = async (chat) => {
            try {
                console.log('[InfoBar System] 生成拦截器触发');
                
                const settings = getSettings();
                if (!settings.enabled) {
                    return chat;
                }

                // 构建强制指令
                const forceInstruction = buildForceInstruction();
                
                // 创建系统消息并插入到对话开头
                const systemMessage = {
                    name: 'system',
                    role: 'system',
                    content: forceInstruction,
                    is_system: true
                };

                // 将指令插入到聊天历史的开头
                chat.unshift(systemMessage);
                
                console.log('[InfoBar System] 已注入强制指令到聊天历史');
                return chat;
                
            } catch (error) {
                console.error('[InfoBar System] 生成拦截器错误:', error);
                return chat;
            }
        };
        
        console.log('[InfoBar System] 生成拦截器已注册为全局函数');
    }

    /**
     * 构建强制指令 - 增强版，带细节补充功能
     */
    function buildForceInstruction() {
        const settings = getSettings();
        const enabledPanels = Object.keys(settings.enabledPanels)
            .filter(key => settings.enabledPanels[key]);

        // 获取智能提示数据
        const { exampleData, fieldRequirements } = panelConfigManager ? 
            panelConfigManager.generateSmartAIPrompt(enabledPanels, settings) : 
            { exampleData: '', fieldRequirements: '' };
        
        const forceLevel = settings.forceLevel || 'medium';
        let intensity = '';
        
        switch (forceLevel) {
            case 'low':
                intensity = '请尽量';
                break;
            case 'high':
                intensity = '【严格要求】【绝对必须】';
                break;
            default:
                intensity = '【必须】';
        }

        // 生成细节补充提示
        let detailHints = generateDetailHints(enabledPanels);

        return `[🚨 SYSTEM CRITICAL OVERRIDE - 信息栏系统 v${EXTENSION_VERSION} 🚨]

【核心规则】
你的每一次回复都${intensity}严格遵循以下三部分输出格式：

1. 【第一部分】：完整的剧情正文内容
2. 【第二部分】：思考过程，${intensity}包裹在 <aiThinkProcess>...</aiThinkProcess> 标签内
3. 【第三部分】：数据块，${intensity}包裹在 <infobar_data>...</infobar_data> 标签内

【智能细节补充要求】
${detailHints}

【思考过程格式】
<aiThinkProcess>
[剧情发展分析]
- 核心事件：{描述本次的主要剧情}
- 场景转换：{从哪里到哪里，环境如何变化}
- 人物动态：{出现了谁，做了什么}

[细节补充计划]
- NPC细节：{补充新出现NPC的外貌、衣着、性格特征}
- 环境细节：{补充时间推移、天气变化、氛围营造}
- 情感细节：{补充角色们的情绪变化、内心活动}

[数据更新清单]
- {列出每个需要更新的面板及原因}
</aiThinkProcess>

【数据块格式 - 紧凑型】
<infobar_data>
${fieldRequirements}
</infobar_data>

【示例数据（参考你启用的字段）】
${exampleData}

【重要提醒】
- 即使用户没有明确描述，也要主动补充合理的细节信息
- 每个面板数据写在一行，字段间用空格分隔
- 值需要用引号包裹，支持中文
- NPC使用 npc0.field npc1.field 格式

${forceLevel === 'high' ? '【绝对禁止】省略任何标签！违反此规则将导致系统功能完全失效！' : ''}

---`;
    }

    /**
     * 生成细节补充提示
     */
    function generateDetailHints(enabledPanels) {
        let hints = '作为一个优秀的故事讲述者，你需要主动补充以下细节：\n\n';
        
        if (enabledPanels.includes('interaction')) {
            hints += '✦ NPC细节补充：\n';
            hints += '  - 外貌特征：发型、发色、眼睛颜色、身高体型\n';
            hints += '  - 衣着打扮：服装款式、颜色、饰品配件\n';
            hints += '  - 性格特点：说话语气、习惯动作、个性特征\n';
            hints += '  - 表情神态：当前的表情、肢体语言\n\n';
        }
        
        if (enabledPanels.includes('world')) {
            hints += '✦ 环境细节补充：\n';
            hints += '  - 时间细节：具体时刻、时间流逝\n';
            hints += '  - 天气状况：晴雨、温度、风力\n';
            hints += '  - 环境氛围：光线、声音、气味、整体感觉\n';
            hints += '  - 场景特点：建筑风格、装饰细节\n\n';
        }
        
        if (enabledPanels.includes('personal')) {
            hints += '✦ 角色状态补充：\n';
            hints += '  - 内心想法：当前的思考、担忧或期待\n';
            hints += '  - 身体感受：疲劳、饥饿、疼痛等\n';
            hints += '  - 情绪层次：表面情绪和深层感受\n\n';
        }
        
        if (enabledPanels.includes('story')) {
            hints += '✦ 剧情要素补充：\n';
            hints += '  - 伏笔暗示：可能的未来发展\n';
            hints += '  - 氛围营造：紧张、轻松、神秘等\n';
            hints += '  - 关键转折：剧情的重要变化点\n\n';
        }
        
        hints += '记住：好的细节让故事生动，让读者身临其境！';
        
        return hints;
    }

    /**
     * 注册事件监听器
     */
    function registerEventListeners() {
        const eventSource = context.eventSource;

        // 监听消息接收事件
        eventSource.on('message_received', handleMessageReceived);

        // 监听消息渲染事件
        eventSource.on('message_rendered', handleMessageRendered);

        // 监听消息删除事件
        eventSource.on('message_deleted', handleMessageDeleted);

        // 监听聊天切换事件
        eventSource.on('chat_changed', handleChatChanged);

        console.log('[InfoBar System] 事件监听器已注册');
    }

    /**
     * 处理消息接收事件
     */
    async function handleMessageReceived(data) {
        if (!data || data.is_user) return;

        try {
            const settings = getSettings();
            if (!settings.enabled) return;

            // 保存原始消息用于调试
            const originalMessage = data.message;

            // 解析AI回复中的数据
            const parseResult = parseAIMessage(data.message);
            
            if (parseResult) {
                // 更新数据状态
                await updateDataState(parseResult);
                
                // 清理消息中的标签
                data.message = cleanMessage(data.message);
                
                if (settings.debugMode) {
                    console.log('[InfoBar System] 原始数据块:', originalMessage.match(AI_DATA_BLOCK_REGEX)?.[1]);
                    console.log('[InfoBar System] 解析结果:', parseResult);
                }
            }
        } catch (error) {
            console.error('[InfoBar System] 处理消息接收时出错:', error);
        }
    }

    /**
     * 处理消息渲染事件
     */
    async function handleMessageRendered(data) {
        if (!data || data.is_user) return;

        try {
            const settings = getSettings();
            if (!settings.enabled || !settings.renderInfoBarInChat) return;

            // 渲染信息栏
            const infoBarHtml = renderInfoBar(currentInfoBarData, data.messageId);
            
            if (infoBarHtml) {
                insertInfoBarToMessage(data.messageId, infoBarHtml);
                console.log('[InfoBar System] 信息栏渲染完成');
            } else if (settings.autoRenderCheck) {
                // 检查是否有数据但没有渲染
                checkForMissingRender();
            }
        } catch (error) {
            console.error('[InfoBar System] 处理消息渲染时出错:', error);
        }
    }

    /**
     * 解析AI消息
     */
    function parseAIMessage(message) {
        if (!message) return null;

        const dataBlockMatch = message.match(AI_DATA_BLOCK_REGEX);
        if (!dataBlockMatch || !dataBlockMatch[1]) {
            console.log('[InfoBar System] 未找到数据块');
            return null;
        }

        const dataContent = dataBlockMatch[1].trim();
        return parseDataBlock(dataContent);
    }

    /**
     * 解析数据块 - 优化版，支持紧凑格式
     */
    function parseDataBlock(dataString) {
        if (!dataString) return null;

        try {
            const result = { npcs: {}, panels: {} };
            
            // 分割成行
            const lines = dataString.trim().split('\n');
            
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                
                // 解析面板名称
                const panelMatch = line.match(/^(\w+)\s+(.+)$/);
                if (!panelMatch) return;
                
                const [, panelName, content] = panelMatch;
                
                if (panelName === 'interaction') {
                    // 解析NPC数据
                    const npcData = parseInteractionLine(content);
                    Object.assign(result.npcs, npcData);
                } else {
                    // 解析其他面板数据
                    const panelData = parsePanelLine(content);
                    result.panels[panelName] = panelData;
                }
            });
            
            return result;
        } catch (error) {
            console.error('[InfoBar System] 解析数据块时出错:', error);
            return null;
        }
    }

    /**
     * 解析单行面板数据
     */
    function parsePanelLine(content) {
        const data = {};
        
        // 改进的正则，支持多种格式
        const regex = /(\w+):\s*"([^"]*)"|\s*(\w+):\s*'([^']*)'|\s*(\w+):\s*(\{[^}]*\})|\s*(\w+):\s*(\[[^\]]*\])|\s*(\w+):\s*([^\s]+)/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            if (match[1] && match[2]) {
                // 双引号值
                data[match[1]] = match[2];
            } else if (match[3] && match[4]) {
                // 单引号值
                data[match[3]] = match[4];
            } else if (match[5] && match[6]) {
                // 对象值
                try {
                    data[match[5]] = JSON.parse(match[6]);
                } catch (e) {
                    data[match[5]] = match[6];
                }
            } else if (match[7] && match[8]) {
                // 数组值
                try {
                    data[match[7]] = JSON.parse(match[8]);
                } catch (e) {
                    data[match[7]] = match[8];
                }
            } else if (match[9] && match[10]) {
                // 无引号值
                data[match[9]] = match[10];
            }
        }
        
        return data;
    }

    /**
     * 解析交互面板数据（支持多个NPC）
     */
    function parseInteractionLine(content) {
        const npcs = {};
        
        // 匹配格式: npc0.key: "value"
        const regex = /npc(\d+)\.(\w+):\s*"([^"]*)"/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            const [, npcId, property, value] = match;
            
            if (!npcs[npcId]) {
                npcs[npcId] = {};
            }
            
            npcs[npcId][property] = value;
        }
        
        return npcs;
    }

    /**
     * 清理消息
     */
    function cleanMessage(message) {
        if (!message) return message;
        
        return message
            .replace(AI_THINK_PROCESS_REGEX, '')
            .replace(AI_DATA_BLOCK_REGEX, '')
            .trim();
    }

    /**
     * 更新数据状态
     */
    async function updateDataState(parseResult) {
        const oldData = structuredClone(currentInfoBarData);
        
        // 合并新数据
        if (parseResult.npcs) {
            Object.assign(currentInfoBarData.npcs, parseResult.npcs);
        }
        
        if (parseResult.panels) {
            Object.assign(currentInfoBarData, parseResult.panels);
        }

        // 生成变更集
        latestChangeset = generateChangeset(oldData, currentInfoBarData);
        
        console.log('[InfoBar System] 数据状态已更新');
    }

    /**
     * 生成变更集
     */
    function generateChangeset(oldData, newData) {
        const changes = new Set();
        
        function checkDiff(old, neu, path = '') {
            if (typeof old !== typeof neu) {
                changes.add(path);
                return;
            }
            
            if (typeof neu === 'object' && neu !== null) {
                for (const key in neu) {
                    const newPath = path ? `${path}.${key}` : key;
                    checkDiff(old?.[key], neu[key], newPath);
                }
            } else if (old !== neu) {
                changes.add(path);
            }
        }
        
        checkDiff(oldData, newData);
        return changes;
    }

    /**
     * 渲染信息栏 - 优化版，只显示有数据的内容
     */
    function renderInfoBar(data, messageId) {
        if (!data || (!data.panels && !data.npcs)) {
            return '';
        }

        const settings = getSettings();
        const allConfigs = panelConfigManager ? panelConfigManager.getAllConfigs() : FALLBACK_PANEL_CONFIG;
        
        let html = `<div class="advanced-infobar-container" data-message-id="${messageId}">`;
        
        // 按优先级排序面板
        const sortedPanels = Object.entries(allConfigs)
            .filter(([panelId, config]) => settings.enabledPanels[panelId])
            .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));
        
        // 渲染各个面板
        sortedPanels.forEach(([panelId, panelConfig]) => {
            let panelHtml = '';
            
            if (panelId === 'interaction' && data.npcs && Object.keys(data.npcs).length > 0) {
                // 只渲染有数据的NPC面板
                panelHtml = renderNpcPanel(data.npcs, messageId, panelConfig);
            } else if (data.panels && data.panels[panelId]) {
                // 只渲染有数据的普通面板
                panelHtml = renderGenericPanel(panelId, data.panels[panelId], panelConfig);
            }
            
            if (panelHtml) {
                html += panelHtml;
            }
        });

        html += '</div>';
        
        // 如果没有任何数据，返回空
        return html === `<div class="advanced-infobar-container" data-message-id="${messageId}"></div>` ? '' : html;
    }

    /**
     * 渲染NPC面板
     */
    function renderNpcPanel(npcsData, messageId, panelConfig) {
        const npcList = Object.entries(npcsData);
        if (npcList.length === 0) return '';

        const settings = getSettings();
        const defaultCollapsed = settings.defaultCollapsed;
        const contentClass = defaultCollapsed ? '' : 'expanded';
        const iconClass = defaultCollapsed ? 'fa-chevron-down collapsed' : 'fa-chevron-up';

        let html = `
            <div class="infobar-panel">
                <div class="infobar-panel-header" data-panel="interaction">
                    <span class="infobar-panel-title">
                        <i class="fa-solid fa-users"></i> 交互对象
                    </span>
                    <i class="fa-solid ${iconClass} infobar-panel-toggle"></i>
                </div>
                <div class="infobar-panel-content ${contentClass}" style="display: ${defaultCollapsed ? 'none' : 'block'};">
        `;

        // NPC选择器
        if (npcList.length > 1) {
            html += '<div class="infobar-npc-selector-wrapper">';
            html += '<select class="infobar-npc-selector">';
            
            npcList.forEach(([npcId, npcData]) => {
                const npcName = npcData.name || `NPC ${npcId}`;
                html += `<option value="${npcId}">${escapeHtml(npcName)}</option>`;
            });
            
            html += '</select></div>';
        }

        // NPC详情
        html += '<div class="infobar-npc-details">';
        const [firstNpcId, firstNpcData] = npcList[0];
        html += renderNpcDetails(firstNpcData);
        html += '</div>';

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 渲染NPC详情
     */
    function renderNpcDetails(npcData) {
        const settings = getSettings();
        const panelItems = settings.panelItems.interaction || {};
        const panelConfig = panelConfigManager ? panelConfigManager.getConfig('interaction') : FALLBACK_PANEL_CONFIG.interaction;
        
        let html = '';
        
        if (panelConfig && panelConfig.items) {
            panelConfig.items.forEach(item => {
                if (panelItems[item.id] && npcData[item.id]) {
                    html += `
                        <div class="infobar-item">
                            <span class="infobar-label">${item.label}:</span>
                            <span class="infobar-value">${escapeHtml(String(npcData[item.id]))}</span>
                        </div>
                    `;
                }
            });
        }

        return html || '<div class="infobar-item">此NPC暂无详细信息</div>';
    }

    /**
     * 渲染通用面板
     */
    function renderGenericPanel(panelId, panelData, panelConfig) {
        const settings = getSettings();
        const defaultCollapsed = settings.defaultCollapsed;
        const contentClass = defaultCollapsed ? '' : 'expanded';
        const iconClass = defaultCollapsed ? 'fa-chevron-down collapsed' : 'fa-chevron-up';

        let html = `
            <div class="infobar-panel">
                <div class="infobar-panel-header" data-panel="${panelId}">
                    <span class="infobar-panel-title">
                        <i class="fa-solid ${panelConfig.icon}"></i> ${panelConfig.label}
                    </span>
                    <i class="fa-solid ${iconClass} infobar-panel-toggle"></i>
                </div>
                <div class="infobar-panel-content ${contentClass}" style="display: ${defaultCollapsed ? 'none' : 'block'};">
        `;

        if (panelId === 'tasks') {
            html += renderTasksContent(panelData);
        } else {
            html += renderGenericContent(panelId, panelData);
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 渲染任务内容
     */
    function renderTasksContent(tasksData) {
        let html = '';
        
        if (tasksData.mainQuest) {
            html += renderTaskCard(tasksData.mainQuest, '主线任务');
        }
        
        if (tasksData.sideQuests && Array.isArray(tasksData.sideQuests)) {
            tasksData.sideQuests.forEach(quest => {
                html += renderTaskCard(quest, '支线任务');
            });
        }
        
        if (tasksData.currentObjective) {
            html += `
                <div class="infobar-item">
                    <span class="infobar-label">当前目标:</span>
                    <span class="infobar-value">${escapeHtml(String(tasksData.currentObjective))}</span>
                </div>
            `;
        }

        return html || '<div class="infobar-item">暂无任务信息</div>';
    }

    /**
     * 渲染任务卡片
     */
    function renderTaskCard(taskData, type) {
        if (typeof taskData === 'string') {
            taskData = { name: taskData };
        }
        
        if (!taskData.name) return '';

        return `
            <div class="infobar-task-card">
                <div class="infobar-task-header">
                    <span class="infobar-task-title">${escapeHtml(taskData.name)}</span>
                    ${taskData.status ? `<span class="infobar-task-status">${escapeHtml(taskData.status)}</span>` : ''}
                </div>
                ${taskData.description ? `<div class="infobar-task-description">${escapeHtml(taskData.description)}</div>` : ''}
                ${taskData.progress ? `<div class="infobar-task-progress">进度: ${escapeHtml(taskData.progress)}</div>` : ''}
            </div>
        `;
    }

    /**
     * 渲染通用内容 - 优化版，只显示有数据的字段
     */
    function renderGenericContent(panelId, data) {
        const settings = getSettings();
        const panelItems = settings.panelItems[panelId] || {};
        const panelConfig = panelConfigManager ? panelConfigManager.getConfig(panelId) : FALLBACK_PANEL_CONFIG[panelId];
        
        let html = '';
        
        if (panelConfig && panelConfig.items) {
            panelConfig.items.forEach(item => {
                // 只渲染：1.用户启用的 2.有数据的 字段
                if (panelItems[item.id] && data[item.id]) {
                    html += `
                        <div class="infobar-item">
                            <span class="infobar-label">${item.label}:</span>
                            <span class="infobar-value">${escapeHtml(String(data[item.id]))}</span>
                        </div>
                    `;
                }
            });
        }

        return html || '<div class="infobar-item">暂无信息</div>';
    }

    /**
     * 插入信息栏到消息中
     */
    function insertInfoBarToMessage(messageId, infoBarHtml) {
        const messageElement = document.querySelector(`[mesid="${messageId}"]`);
        if (!messageElement) return;

        // 移除旧的信息栏
        const oldInfoBar = messageElement.querySelector('.advanced-infobar-container');
        if (oldInfoBar) {
            oldInfoBar.remove();
        }

        // 插入新的信息栏
        const mesText = messageElement.querySelector('.mes_text');
        if (mesText) {
            mesText.insertAdjacentHTML('beforeend', infoBarHtml);
            bindInfoBarEvents(mesText);
        }
    }

    /**
     * 绑定信息栏事件
     */
    function bindInfoBarEvents(container) {
        // 面板折叠/展开
        const panelHeaders = container.querySelectorAll('.infobar-panel-header');
        panelHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const toggle = header.querySelector('.infobar-panel-toggle');
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    content.classList.add('expanded');
                    toggle.classList.remove('fa-chevron-down', 'collapsed');
                    toggle.classList.add('fa-chevron-up');
                } else {
                    content.style.display = 'none';
                    content.classList.remove('expanded');
                    toggle.classList.remove('fa-chevron-up');
                    toggle.classList.add('fa-chevron-down', 'collapsed');
                }
            });
        });

        // NPC选择器
        const npcSelectors = container.querySelectorAll('.infobar-npc-selector');
        npcSelectors.forEach(selector => {
            selector.addEventListener('change', (e) => {
                const npcId = e.target.value;
                const detailsContainer = container.querySelector('.infobar-npc-details');
                
                if (currentInfoBarData.npcs[npcId] && detailsContainer) {
                    detailsContainer.innerHTML = renderNpcDetails(currentInfoBarData.npcs[npcId]);
                }
            });
        });
    }

    /**
     * 注册斜杠命令
     */
    function registerSlashCommands() {
        if (typeof SlashCommandParser !== 'undefined') {
            SlashCommandParser.addCommandObject({
                name: 'infobar',
                callback: handleSlashCommand,
                returns: 'string',
                namedArgumentList: [
                    {
                        name: 'action',
                        description: '操作类型：settings|reset|export|status|debug|reload',
                        typeList: ['string'],
                        defaultValue: 'status',
                        enumList: ['settings', 'reset', 'export', 'status', 'debug', 'reload']
                    }
                ],
                helpString: '信息栏系统控制命令',
                aliases: ['info']
            });
            
            console.log('[InfoBar System] 斜杠命令已注册');
        }
    }

    /**
     * 处理斜杠命令
     */
    function handleSlashCommand(namedArgs, unnamedArgs) {
        const action = namedArgs.action || 'status';

        switch (action) {
            case 'settings':
                showAdvancedSettingsPanel();
                return '设置面板已打开';
            
            case 'reset':
                resetAllData();
                return '所有数据已重置';
            
            case 'export':
                exportData();
                return '数据已导出';
            
            case 'reload':
                if (panelConfigManager) {
                    panelConfigManager.loadAllConfigs().then(() => {
                        showNotification('面板配置已重新加载', 'success');
                    });
                }
                return '正在重新加载面板配置...';
            
            case 'debug':
                const settings = getSettings();
                const configStatus = panelConfigManager ? panelConfigManager.isReady() : false;
                return `调试信息：
启用: ${settings.enabled}
渲染: ${settings.renderInfoBarInChat}
配置状态: ${configStatus ? '已加载' : '未加载'}
扩展路径: ${panelConfigManager ? panelConfigManager.extensionPath : '未知'}
当前数据: ${JSON.stringify(currentInfoBarData, null, 2)}`;
            
            case 'status':
                const status = getSettings();
                const configLoaded = panelConfigManager ? panelConfigManager.isReady() : false;
                return `信息栏系统状态：
系统: ${status.enabled ? '已启用' : '已禁用'}
版本: ${EXTENSION_VERSION}
配置: ${configLoaded ? '已加载' : '未加载'}`;
            
            default:
                return '未知操作，可用操作：settings|reset|export|status|debug|reload';
        }
    }

    /**
     * 注册UI界面
     */
    function registerUI() {
        // 在扩展菜单中添加设置按钮
        const extensionsMenu = document.getElementById('extensionsMenu');
        if (extensionsMenu) {
            const settingsButton = document.createElement('div');
            settingsButton.className = 'list-group-item flex-container flexGap5 interactable';
            settingsButton.innerHTML = `
                <i class="fa-solid fa-chart-bar"></i>
                <span>信息栏设置</span>
            `;
            settingsButton.addEventListener('click', showAdvancedSettingsPanel);
            extensionsMenu.appendChild(settingsButton);
            
            console.log('[InfoBar System] UI界面已注册');
        }
    }

    /**
     * 显示高级设置面板
     */
    function showAdvancedSettingsPanel() {
        const settings = getSettings();
        
        // 创建设置界面HTML
        const settingsHtml = createAdvancedSettingsHTML(settings);
        
        // 插入到页面
        document.body.insertAdjacentHTML('beforeend', settingsHtml);
        
        // 绑定事件
        bindAdvancedSettingsEvents();
    }

    /**
     * 创建高级设置HTML
     */
    function createAdvancedSettingsHTML(settings) {
        // 构建左侧导航
        const allConfigs = panelConfigManager ? panelConfigManager.getAllConfigs() : FALLBACK_PANEL_CONFIG;
        
        const navItems = [
            { id: 'general', icon: 'fa-cog', label: '基础设置' },
            ...Object.values(allConfigs).map(panel => ({
                id: panel.id,
                icon: panel.icon,
                label: panel.label
            })),
            { id: 'themes', icon: 'fa-palette', label: '主题外观' },
            { id: 'data', icon: 'fa-database', label: '数据管理' },
            { id: 'advanced', icon: 'fa-tools', label: '高级选项' }
        ];

        const navHtml = navItems.map((item, index) => `
            <div class="settings-nav-item ${index === 0 ? 'active' : ''}" data-tab="${item.id}">
                <i class="fa-solid ${item.icon}"></i> ${item.label}
            </div>
        `).join('');

        return `
            <div class="advanced-infobar-settings-overlay"></div>
            <div class="advanced-infobar-settings-popup">
                <div class="settings-header">
                    <h2>高级信息栏系统设置 v${EXTENSION_VERSION}</h2>
                    <button class="settings-close-btn">&times;</button>
                </div>
                
                <div class="settings-container">
                    <!-- 左侧导航 -->
                    <div class="settings-nav">
                        ${navHtml}
                    </div>
                    
                    <!-- 右侧内容 -->
                    <div class="settings-content">
                        ${createAllTabContents(settings)}
                    </div>
                </div>
                
                <!-- 底部按钮 -->
                <div class="settings-footer">
                    <button id="settings-reset" class="btn btn-danger">重置所有设置</button>
                    <div class="settings-footer-right">
                        <button id="settings-cancel" class="btn btn-secondary">取消</button>
                        <button id="settings-save" class="btn btn-primary">保存设置</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建所有标签页内容
     */
    function createAllTabContents(settings) {
        let html = '';
        const allConfigs = panelConfigManager ? panelConfigManager.getAllConfigs() : FALLBACK_PANEL_CONFIG;

        // 基础设置
        html += `
            <div class="settings-tab-content active" data-tab="general">
                <h3>基础功能设置</h3>
                <div class="settings-section">
                    ${createGeneralSettingsHTML(settings)}
                </div>
            </div>
        `;

        // 各个面板设置
        for (const [panelId, panelConfig] of Object.entries(allConfigs)) {
            html += `
                <div class="settings-tab-content" data-tab="${panelId}">
                    <h3>${panelConfig.label}配置</h3>
                    <div class="settings-section">
                        ${createPanelConfigHTML(panelId, panelConfig, settings)}
                    </div>
                </div>
            `;
        }

        // 主题外观
        html += `
            <div class="settings-tab-content" data-tab="themes">
                <h3>主题与外观</h3>
                <div class="settings-section">
                    ${createThemeSettingsHTML(settings)}
                </div>
            </div>
        `;

        // 数据管理
        html += `
            <div class="settings-tab-content" data-tab="data">
                <h3>数据管理与备份</h3>
                <div class="settings-section">
                    ${createDataManagementHTML()}
                </div>
            </div>
        `;

        // 高级选项
        html += `
            <div class="settings-tab-content" data-tab="advanced">
                <h3>高级选项</h3>
                <div class="settings-section">
                    ${createAdvancedOptionsHTML(settings)}
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 创建基础设置HTML
     */
    function createGeneralSettingsHTML(settings) {
        return `
            <div class="settings-item">
                <label class="settings-label">
                    <input type="checkbox" id="setting-enabled" ${settings.enabled ? 'checked' : ''}>
                    <span class="settings-text">启用信息栏系统</span>
                </label>
                <div class="settings-description">关闭后整个信息栏系统将停止工作</div>
            </div>
            
            <div class="settings-item">
                <label class="settings-label">
                    <input type="checkbox" id="setting-render" ${settings.renderInfoBarInChat ? 'checked' : ''}>
                    <span class="settings-text">在聊天中显示信息栏</span>
                </label>
                <div class="settings-description">关闭后仍会在后台记录数据，但不显示界面</div>
            </div>
            
            <div class="settings-item">
                <label class="settings-label">
                    <input type="checkbox" id="setting-memory" ${settings.memoryAssistEnabled ? 'checked' : ''}>
                    <span class="settings-text">启用记忆辅助</span>
                </label>
                <div class="settings-description">将实时数据注入AI上下文，提升连续性</div>
            </div>
            
            <div class="settings-item">
                <label class="settings-label">
                    <input type="checkbox" id="setting-collapsed" ${settings.defaultCollapsed ? 'checked' : ''}>
                    <span class="settings-text">信息栏默认折叠</span>
                </label>
                <div class="settings-description">新消息的信息栏面板默认为折叠状态</div>
            </div>
            
            <div class="settings-item">
                <label class="settings-label">
                    <input type="checkbox" id="setting-autocheck" ${settings.autoRenderCheck ? 'checked' : ''}>
                    <span class="settings-text">启用自动渲染检测</span>
                </label>
                <div class="settings-description">当AI提供了数据但信息栏未渲染时，发出通知</div>
            </div>
        `;
    }

    /**
     * 创建面板配置HTML
     */
    function createPanelConfigHTML(panelId, panelConfig, settings) {
        const isEnabled = settings.enabledPanels[panelId] || false;
        const enabledItemsCount = panelConfig.items ? 
            panelConfig.items.filter(item => settings.panelItems?.[panelId]?.[item.id] ?? item.defaultValue).length 
            : 0;
        const totalItemsCount = panelConfig.items ? panelConfig.items.length : 0;

        let html = `
            <div class="panel-main-config">
                <div class="panel-enable-section">
                    <div class="panel-enable-header">
                        <div class="panel-enable-info">
                            <div class="panel-enable-icon">
                                <i class="fa-solid ${panelConfig.icon}"></i>
                            </div>
                            <div class="panel-enable-details">
                                <h4>${panelConfig.label}</h4>
                                <p>${panelConfig.description}</p>
                                <div class="panel-status-info">
                                    <span class="panel-status ${isEnabled ? 'status-enabled' : 'status-disabled'}">
                                        ${isEnabled ? '已启用' : '已禁用'}
                                    </span>
                                    ${totalItemsCount > 0 ? `<span class="panel-items-count">${enabledItemsCount}/${totalItemsCount} 项已启用</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="panel-enable-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" id="panel-enable-${panelId}" ${isEnabled ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="panel-items-config ${isEnabled ? '' : 'disabled'}">
                    ${createPanelItemsHTML(panelId, panelConfig, settings)}
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 创建面板子项HTML
     */
    function createPanelItemsHTML(panelId, panelConfig, settings) {
        if (!panelConfig.items || panelConfig.items.length === 0) {
            return `
                <div class="panel-config-empty">
                    <i class="fa-solid fa-info-circle"></i>
                    <p>此面板没有可配置的子项</p>
                    <small>该面板将按默认设置显示所有可用信息</small>
                </div>
            `;
        }

        let html = `
            <div class="panel-items-header">
                <h5>子项配置</h5>
                <div class="panel-items-actions">
                    <button class="btn btn-sm btn-outline select-all-items" data-panel="${panelId}">全选</button>
                    <button class="btn btn-sm btn-outline select-none-items" data-panel="${panelId}">全不选</button>
                    <button class="btn btn-sm btn-outline reset-items" data-panel="${panelId}">重置默认</button>
                </div>
            </div>
            
            <div class="panel-items-grid">
        `;

        // 按类别分组显示
        const categorizedItems = categorizePanelItems(panelConfig.items);
        
        for (const [category, items] of Object.entries(categorizedItems)) {
            if (category !== 'default' && items.length > 0) {
                html += `
                    <div class="panel-items-category">
                        <h6>${getCategoryLabel(category)}</h6>
                    </div>
                `;
            }
            
            items.forEach(item => {
                const isEnabled = settings.panelItems?.[panelId]?.[item.id] ?? item.defaultValue;
                
                html += `
                    <div class="panel-item-config">
                        <div class="panel-item-header">
                            <label class="panel-item-label">
                                <input type="checkbox" 
                                       data-panel="${panelId}" 
                                       data-item="${item.id}" 
                                       ${isEnabled ? 'checked' : ''}
                                       class="panel-item-checkbox">
                                <span class="panel-item-name">${item.label}</span>
                                ${item.defaultValue ? '<span class="recommended-badge">推荐</span>' : ''}
                            </label>
                        </div>
                        ${item.description ? `<div class="panel-item-desc">${item.description}</div>` : ''}
                        ${item.example ? `<div class="panel-item-example">示例: ${item.example}</div>` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        return html;
    }

    /**
     * 分类面板项目
     */
    function categorizePanelItems(items) {
        const categories = {
            basic: [],
            appearance: [],
            status: [],
            relationship: [],
            display: [],
            type: [],
            environment: [],
            events: [],
            resources: [],
            equipment: [],
            abilities: [],
            skills: [],
            combat: [],
            magic: [],
            stats: [],
            progress: [],
            development: [],
            summary: [],
            choices: [],
            social: [],
            news: [],
            business: [],
            forum: [],
            items: [],
            projects: [],
            advanced: [],
            default: []
        };
        
        items.forEach(item => {
            const category = item.category || 'default';
            if (categories[category]) {
                categories[category].push(item);
            } else {
                categories.default.push(item);
            }
        });
        
        // 移除空分类
        return Object.fromEntries(
            Object.entries(categories).filter(([key, value]) => value.length > 0)
        );
    }

    /**
     * 获取分类标签
     */
    function getCategoryLabel(category) {
        const labels = {
            basic: '基础信息',
            appearance: '外貌特征',
            status: '状态属性',
            relationship: '关系系统',
            display: '显示选项',
            type: '任务类型',
            environment: '环境信息',
            events: '事件系统',
            resources: '资源管理',
            equipment: '装备系统',
            abilities: '特殊能力',
            skills: '技能系统',
            combat: '战斗相关',
            magic: '魔法系统',
            stats: '数值属性',
            progress: '进度跟踪',
            development: '发展变化',
            summary: '摘要信息',
            choices: '选择系统',
            social: '社交媒体',
            news: '新闻资讯',
            business: '商业信息',
            forum: '论坛讨论',
            items: '物品管理',
            projects: '项目管理',
            advanced: '高级选项'
        };
        return labels[category] || category;
    }

    /**
     * 创建主题设置HTML
     */
    function createThemeSettingsHTML(settings) {
        const currentTheme = settings.theme || 'modern-dark';
        
        let html = '<div class="theme-selector">';
        
        for (const [themeId, themeData] of Object.entries(THEMES)) {
            html += `
                <div class="theme-option ${currentTheme === themeId ? 'selected' : ''}" data-theme="${themeId}">
                    <div class="theme-preview" style="background: ${themeData.variables['--infobar-bg']}; color: ${themeData.variables['--infobar-text']}; border-color: ${themeData.variables['--infobar-border']};">
                        <div class="theme-preview-header" style="background: ${themeData.variables['--infobar-primary']};">
                            ${themeData.name}
                        </div>
                        <div class="theme-preview-content">
                            示例内容
                        </div>
                    </div>
                    <div class="theme-name">${themeData.name}</div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * 创建数据管理HTML
     */
    function createDataManagementHTML() {
        return `
            <div class="data-management-section">
                <div class="data-item">
                    <h4>当前聊天数据</h4>
                    <p>管理当前聊天的信息栏数据</p>
                    <div class="data-buttons">
                        <button id="data-view-current" class="btn btn-info">查看当前数据</button>
                        <button id="data-clear-current" class="btn btn-warning">清除当前数据</button>
                    </div>
                </div>
                
                <div class="data-item">
                    <h4>配置管理</h4>
                    <p>导入和导出信息栏配置</p>
                    <div class="data-buttons">
                        <button id="data-export-config" class="btn btn-success">导出配置</button>
                        <button id="data-reload-panels" class="btn btn-primary">重新加载面板</button>
                    </div>
                </div>
                
                <div class="data-item">
                    <h4>完整数据备份</h4>
                    <p>包含所有数据和设置的完整备份</p>
                    <div class="data-buttons">
                        <button id="data-export-all" class="btn btn-success">导出完整备份</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建高级选项HTML
     */
    function createAdvancedOptionsHTML(settings) {
        const configStatus = panelConfigManager ? panelConfigManager.isReady() : false;
        const extensionPath = panelConfigManager ? panelConfigManager.extensionPath : '未知';
        
        return `
            <div class="advanced-options">
                <div class="settings-item">
                    <label class="settings-label">
                        调试模式
                        <input type="checkbox" id="setting-debug" ${settings.debugMode ? 'checked' : ''}>
                    </label>
                    <div class="settings-description">启用详细的控制台日志输出</div>
                </div>
                
                <div class="settings-item">
                    <label class="settings-label">
                        强制指令强度
                        <select id="setting-force-level">
                            <option value="low" ${settings.forceLevel === 'low' ? 'selected' : ''}>低 (温和提醒)</option>
                            <option value="medium" ${settings.forceLevel === 'medium' ? 'selected' : ''}>中 (标准强制)</option>
                            <option value="high" ${settings.forceLevel === 'high' ? 'selected' : ''}>高 (严格要求)</option>
                        </select>
                    </label>
                    <div class="settings-description">控制AI生成信息栏数据的强制程度</div>
                </div>
                
                <div class="settings-item">
                    <label class="settings-label">
                        数据更新频率
                        <select id="setting-update-frequency">
                            <option value="every" ${settings.updateFrequency === 'every' ? 'selected' : ''}>每条消息</option>
                            <option value="changed" ${settings.updateFrequency === 'changed' ? 'selected' : ''}>仅当有变化时</option>
                            <option value="manual" ${settings.updateFrequency === 'manual' ? 'selected' : ''}>手动触发</option>
                        </select>
                    </label>
                    <div class="settings-description">控制信息栏数据的更新频率</div>
                </div>
                
                <div class="settings-item">
                    <h4>扩展信息</h4>
                    <div class="extension-info">
                        <p><strong>版本:</strong> ${EXTENSION_VERSION}</p>
                        <p><strong>作者:</strong> loveyouguhan</p>
                        <p><strong>GitHub:</strong> <a href="https://github.com/loveyouguhan/Information-integration-tool" target="_blank">项目地址</a></p>
                        <p><strong>当前状态:</strong> ${isInitialized ? '✅ 已初始化' : '❌ 未初始化'}</p>
                        <p><strong>配置状态:</strong> ${configStatus ? '✅ 已加载' : '❌ 未加载'}</p>
                        <p><strong>扩展路径:</strong> <code>${extensionPath}</code></p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定高级设置事件
     */
    function bindAdvancedSettingsEvents() {
        const popup = document.querySelector('.advanced-infobar-settings-popup');
        const overlay = document.querySelector('.advanced-infobar-settings-overlay');
        
        // 关闭设置面板
        const closeSettings = () => {
            popup.remove();
            overlay.remove();
        };
        
        popup.querySelector('.settings-close-btn').addEventListener('click', closeSettings);
        overlay.addEventListener('click', closeSettings);
        popup.querySelector('#settings-cancel').addEventListener('click', closeSettings);
        
        // 标签页切换
        const navItems = popup.querySelectorAll('.settings-nav-item');
        const tabContents = popup.querySelectorAll('.settings-tab-content');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                
                // 更新导航状态
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // 更新内容显示
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.dataset.tab === tabId) {
                        content.classList.add('active');
                    }
                });
            });
        });
        
        // 面板启用切换
        popup.querySelectorAll('input[id^="panel-enable-"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const panelId = e.target.id.replace('panel-enable-', '');
                const configSection = popup.querySelector(`[data-tab="${panelId}"] .panel-items-config`);
                
                if (configSection) {
                    configSection.classList.toggle('disabled', !e.target.checked);
                }
                
                updatePanelStatus(panelId, e.target.checked, popup);
            });
        });
        
        // 主题选择
        popup.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                popup.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // 绑定面板管理事件
        bindPanelManagementEvents(popup);
        
        // 数据管理按钮
        bindDataManagementEvents(popup);
        
        // 保存设置
        popup.querySelector('#settings-save').addEventListener('click', () => {
            saveAdvancedSettings(popup);
            closeSettings();
        });
        
        // 重置设置
        popup.querySelector('#settings-reset').addEventListener('click', () => {
            if (confirm('确定要重置所有设置吗？这将清除所有配置和数据！')) {
                resetAllSettings();
                closeSettings();
                showNotification('设置已重置', 'info');
            }
        });
    }

    function bindPanelManagementEvents(popup) {
        // 面板子项操作按钮
        popup.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-all-items')) {
                const panelId = e.target.dataset.panel;
                toggleAllPanelItems(panelId, true, popup);
            } else if (e.target.classList.contains('select-none-items')) {
                const panelId = e.target.dataset.panel;
                toggleAllPanelItems(panelId, false, popup);
            } else if (e.target.classList.contains('reset-items')) {
                const panelId = e.target.dataset.panel;
                resetPanelItemsToDefault(panelId, popup);
            }
        });
        
        // 子项复选框变化事件
        popup.querySelectorAll('.panel-item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const panelId = checkbox.dataset.panel;
                updatePanelItemCount(panelId, popup);
            });
        });
    }

    function updatePanelStatus(panelId, isEnabled, popup) {
        const statusElement = popup.querySelector(`[data-tab="${panelId}"] .panel-status`);
        if (statusElement) {
            statusElement.textContent = isEnabled ? '已启用' : '已禁用';
            statusElement.className = `panel-status ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
        }
    }

    function toggleAllPanelItems(panelId, enabled, popup) {
        const checkboxes = popup.querySelectorAll(`input[data-panel="${panelId}"][data-item]`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = enabled;
        });
        updatePanelItemCount(panelId, popup);
    }

    function resetPanelItemsToDefault(panelId, popup) {
        const panelConfig = panelConfigManager ? panelConfigManager.getConfig(panelId) : FALLBACK_PANEL_CONFIG[panelId];
        if (!panelConfig || !panelConfig.items) return;
        
        panelConfig.items.forEach(item => {
            const checkbox = popup.querySelector(`input[data-panel="${panelId}"][data-item="${item.id}"]`);
            if (checkbox) {
                checkbox.checked = item.defaultValue;
            }
        });
        
        updatePanelItemCount(panelId, popup);
        showNotification(`${panelConfig.label} 的子项已重置为默认值`, 'info');
    }

    function updatePanelItemCount(panelId, popup) {
        const enabledCount = popup.querySelectorAll(`input[data-panel="${panelId}"][data-item]:checked`).length;
        const totalCount = popup.querySelectorAll(`input[data-panel="${panelId}"][data-item]`).length;
        
        const countElement = popup.querySelector(`[data-tab="${panelId}"] .panel-items-count`);
        if (countElement) {
            countElement.textContent = `${enabledCount}/${totalCount} 项已启用`;
        }
    }

    function bindDataManagementEvents(popup) {
        // 查看当前数据
        popup.querySelector('#data-view-current')?.addEventListener('click', () => {
            const data = JSON.stringify(currentInfoBarData, null, 2);
            alert(`当前聊天数据：\n\n${data}`);
        });
        
        // 清除当前数据
        popup.querySelector('#data-clear-current')?.addEventListener('click', () => {
            if (confirm('确定要清除当前聊天的所有信息栏数据吗？')) {
                resetAllData();
                showNotification('当前数据已清除', 'info');
            }
        });
        
        // 导出配置
        popup.querySelector('#data-export-config')?.addEventListener('click', () => {
            const config = getSettings();
            exportJsonData(config, 'infobar-config');
        });
        
        // 重新加载面板
        popup.querySelector('#data-reload-panels')?.addEventListener('click', () => {
            if (panelConfigManager) {
                panelConfigManager.loadAllConfigs().then(() => {
                    showNotification('面板配置已重新加载', 'success');
                    // 可选：重新渲染设置界面
                });
            }
        });
        
        // 导出完整备份
        popup.querySelector('#data-export-all')?.addEventListener('click', () => {
            exportData();
        });
    }

    function saveAdvancedSettings(popup) {
        const settings = getSettings();
        
        // 基础设置
        settings.enabled = popup.querySelector('#setting-enabled').checked;
        settings.renderInfoBarInChat = popup.querySelector('#setting-render').checked;
        settings.memoryAssistEnabled = popup.querySelector('#setting-memory').checked;
        settings.defaultCollapsed = popup.querySelector('#setting-collapsed').checked;
        settings.autoRenderCheck = popup.querySelector('#setting-autocheck').checked;
        
        // 面板启用设置
        popup.querySelectorAll('input[id^="panel-enable-"]').forEach(checkbox => {
            const panelId = checkbox.id.replace('panel-enable-', '');
            settings.enabledPanels[panelId] = checkbox.checked;
        });
        
        // 面板子项设置
        popup.querySelectorAll('input[data-panel][data-item]').forEach(checkbox => {
            const panelId = checkbox.dataset.panel;
            const itemId = checkbox.dataset.item;
            
            if (!settings.panelItems[panelId]) {
                settings.panelItems[panelId] = {};
            }
            settings.panelItems[panelId][itemId] = checkbox.checked;
        });
        
        // 主题设置
        const selectedTheme = popup.querySelector('.theme-option.selected');
        if (selectedTheme) {
            settings.theme = selectedTheme.dataset.theme;
            applyTheme(settings.theme);
        }
        
        // 高级选项
        settings.debugMode = popup.querySelector('#setting-debug')?.checked || false;
        settings.forceLevel = popup.querySelector('#setting-force-level')?.value || 'medium';
        settings.updateFrequency = popup.querySelector('#setting-update-frequency')?.value || 'every';
        
        // 保存到扩展设置
        extensionSettings[EXTENSION_NAME] = settings;
        saveSettings();
        
        showNotification('设置已保存', 'success');
    }

    function applyTheme(themeId) {
        const theme = THEMES[themeId];
        
        if (theme && theme.variables) {
            // 移除旧的主题样式
            const oldStyle = document.getElementById('infobar-theme-styles');
            if (oldStyle) oldStyle.remove();
            
            // 创建新的主题样式
            const style = document.createElement('style');
            style.id = 'infobar-theme-styles';
            style.textContent = `:root { ${Object.entries(theme.variables).map(([key, value]) => `${key}: ${value}`).join('; ')}; }`;
            document.head.appendChild(style);
            
            console.log(`[InfoBar System] 已应用主题: ${theme.name}`);
        }
    }

    // 其他辅助函数
    function handleMessageDeleted(data) {
        console.log('[InfoBar System] 处理消息删除事件');
    }

    function handleChatChanged() {
        resetAllData();
        console.log('[InfoBar System] 聊天切换，数据已重置');
    }

    async function performInitialSync() {
        // 应用当前主题
        const settings = getSettings();
        if (settings.theme) {
            applyTheme(settings.theme);
        }
        
        console.log('[InfoBar System] 初始数据同步完成');
    }

    function checkForMissingRender() {
        if (Object.keys(currentInfoBarData).length > 1 || Object.keys(currentInfoBarData.npcs).length > 0) {
            showNotification('AI已提供信息栏数据，但可能因设置问题未显示', 'warning');
        }
    }

    function resetAllData() {
        currentInfoBarData = { npcs: {} };
        latestChangeset.clear();
        selectedNpcId = null;
        
        // 移除所有渲染的信息栏
        document.querySelectorAll('.advanced-infobar-container').forEach(el => el.remove());
        
        console.log('[InfoBar System] 所有数据已重置');
    }

    function exportData() {
        const data = {
            version: EXTENSION_VERSION,
            timestamp: new Date().toISOString(),
            currentData: currentInfoBarData,
            settings: getSettings()
        };
        
        exportJsonData(data, 'infobar-data');
    }

    function exportJsonData(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function resetAllSettings() {
        extensionSettings[EXTENSION_NAME] = structuredClone(DEFAULT_SETTINGS);
        saveSettings();
        resetAllData();
    }

    function getFieldLabel(field) {
        const labels = {
            name: '姓名', age: '年龄', gender: '性别', identity: '身份',
            mood: '情绪', currentState: '当前状态', affection: '好感度',
            relationship: '关系', thoughts: '当前想法', occupation: '职业',
            currentLocation: '当前位置'
        };
        return labels[field] || field;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type = 'info') {
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            console.log(`[InfoBar System] ${type.toUpperCase()}: ${message}`);
        }
    }

    // 扩展入口点
    jQuery(async () => {
        // 等待SillyTavern完全加载
        if (typeof SillyTavern === 'undefined') {
            setTimeout(() => jQuery(arguments.callee), 100);
            return;
        }
        
        try {
            await initializeExtension();
        } catch (error) {
            console.error('[InfoBar System] 扩展启动失败:', error);
        }
    });

    // 导出全局访问接口
    window.AdvancedInfoBarSystem = {
        version: EXTENSION_VERSION,
        getSettings,
        resetAllData,
        exportData,
        reloadPanelConfigs: () => panelConfigManager ? panelConfigManager.loadAllConfigs() : Promise.resolve(),
        isInitialized: () => isInitialized
    };

})();