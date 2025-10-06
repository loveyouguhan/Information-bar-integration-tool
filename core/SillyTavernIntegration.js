/**
 * SillyTavern深度集成模块
 * 
 * 核心功能：
 * - 将记忆增强功能深度集成到SillyTavern核心流程
 * - 自动记忆注入到提示词
 * - 消息流程集成
 * - 角色和聊天管理集成
 * - UI控制面板
 * 
 * @class SillyTavernIntegration
 */

export class SillyTavernIntegration {
    constructor(dependencies = {}) {
        console.log('[SillyTavernIntegration] 🔗 SillyTavern深度集成模块初始化开始');
        
        // 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore;
        this.eventSystem = dependencies.eventSystem;
        this.deepMemoryManager = dependencies.deepMemoryManager;
        this.contextualRetrieval = dependencies.contextualRetrieval;
        this.userProfileManager = dependencies.userProfileManager;
        this.knowledgeGraphManager = dependencies.knowledgeGraphManager;
        this.timeAwareMemoryManager = dependencies.timeAwareMemoryManager;
        this.memoryMaintenanceSystem = dependencies.memoryMaintenanceSystem;
        
        // SillyTavern上下文
        this.context = null;
        this.sillyTavernEventSource = null;
        this.sillyTavernEventTypes = null;
        
        // 集成设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用SillyTavern深度集成
            
            // 记忆注入设置
            autoInjectMemory: true,                 // 自动注入记忆
            memoryInjectionPosition: 'top',         // 注入位置：top/bottom
            maxMemoryTokens: 2000,                  // 最大记忆token数
            
            // 检索设置
            retrievalOnMessage: true,               // 消息时自动检索
            retrievalCount: 5,                      // 检索数量
            
            // UI设置
            showMemoryPanel: true,                  // 显示记忆面板
            showStats: true,                        // 显示统计信息
            
            // 性能设置
            enableCaching: true,                    // 启用缓存
            debounceDelay: 300                      // 防抖延迟（毫秒）
        };
        
        // 缓存
        this.memoryCache = new Map();               // 记忆缓存
        this.lastInjectionTime = 0;                 // 最后注入时间
        
        // 统计信息
        this.stats = {
            totalInjections: 0,                     // 总注入次数
            totalRetrievals: 0,                     // 总检索次数
            cacheHits: 0,                           // 缓存命中次数
            avgInjectionTime: 0                     // 平均注入时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[SillyTavernIntegration] 🏗️ 构造函数完成');
    }

    /**
     * 初始化SillyTavern深度集成
     */
    async init() {
        try {
            console.log('[SillyTavernIntegration] 📊 开始初始化SillyTavern深度集成...');

            // 获取SillyTavern上下文
            this.context = window.SillyTavern?.getContext?.();
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }

            this.sillyTavernEventSource = this.context.eventSource;
            this.sillyTavernEventTypes = this.context.event_types;

            console.log('[SillyTavernIntegration] ✅ SillyTavern上下文已获取');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[SillyTavernIntegration] ⏸️ SillyTavern深度集成已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 绑定SillyTavern事件
            this.bindSillyTavernEvents();

            // 注册记忆注入钩子
            this.registerMemoryInjectionHook();

            // 初始化UI（如果启用）
            if (this.settings.showMemoryPanel) {
                await this.initializeUI();
            }

            this.initialized = true;
            console.log('[SillyTavernIntegration] ✅ SillyTavern深度集成初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('sillytavern-integration:initialized', {
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.enhancement?.stIntegration !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.stIntegration;
                    console.log('[SillyTavernIntegration] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[SillyTavernIntegration] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载
            if (!this.unifiedDataCore) return;

            const savedSettings = await this.unifiedDataCore.getData('sillytavern_integration_settings');
            if (savedSettings) {
                // extensionSettings优先级更高，只合并其他设置
                const { enabled: _, ...otherSettings } = savedSettings;
                this.settings = { ...this.settings, ...otherSettings };
                console.log('[SillyTavernIntegration] ✅ 设置已加载');
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[SillyTavernIntegration] 🔄 更新设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 如果启用状态改变，重新绑定/解绑事件
            if (newSettings.hasOwnProperty('enabled')) {
                if (newSettings.enabled) {
                    this.bindSillyTavernEvents();
                } else {
                    this.unbindSillyTavernEvents();
                }
            }

            // 保存设置到unifiedDataCore
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('sillytavern_integration_settings', this.settings);
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 🔧 新增：解绑SillyTavern事件
     */
    unbindSillyTavernEvents() {
        try {
            if (!this.sillyTavernEventSource) return;

            // 移除所有事件监听器
            const events = [
                'MESSAGE_SENT',
                'MESSAGE_RECEIVED',
                'CHAT_CHANGED',
                'CHARACTER_MESSAGE_RENDERED',
                'USER_MESSAGE_RENDERED'
            ];

            events.forEach(eventType => {
                if (this.sillyTavernEventTypes && this.sillyTavernEventTypes[eventType]) {
                    this.sillyTavernEventSource.removeListener(
                        this.sillyTavernEventTypes[eventType],
                        this[`handle${eventType}`]
                    );
                }
            });

            console.log('[SillyTavernIntegration] ✅ SillyTavern事件已解绑');

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 解绑SillyTavern事件失败:', error);
        }
    }

    /**
     * 绑定SillyTavern事件
     */
    bindSillyTavernEvents() {
        try {
            if (!this.sillyTavernEventSource || !this.sillyTavernEventTypes) {
                console.warn('[SillyTavernIntegration] ⚠️ SillyTavern事件系统未就绪');
                return;
            }
            
            // 监听生成开始事件（用于记忆注入）
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.GENERATION_STARTED, async (data) => {
                await this.handleGenerationStarted(data);
            });
            
            // 监听消息接收事件（用于记忆提取）
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.MESSAGE_RECEIVED, async (data) => {
                await this.handleMessageReceived(data);
            });
            
            // 监听消息发送事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.MESSAGE_SENT, async (data) => {
                await this.handleMessageSent(data);
            });
            
            // 监听聊天切换事件
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.CHAT_CHANGED, async (data) => {
                await this.handleChatChanged(data);
            });
            
            // 监听角色切换事件
            if (this.sillyTavernEventTypes.CHARACTER_SELECTED) {
                this.sillyTavernEventSource.on(this.sillyTavernEventTypes.CHARACTER_SELECTED, async (data) => {
                    await this.handleCharacterChanged(data);
                });
            }
            
            console.log('[SillyTavernIntegration] 🔗 SillyTavern事件已绑定');
            
        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 绑定SillyTavern事件失败:', error);
        }
    }

    /**
     * 注册记忆注入钩子
     */
    registerMemoryInjectionHook() {
        try {
            console.log('[SillyTavernIntegration] 🔗 注册记忆注入钩子...');
            
            // 监听生成开始事件，在此时注入记忆
            this.sillyTavernEventSource.on(this.sillyTavernEventTypes.GENERATION_STARTED, async () => {
                if (this.settings.autoInjectMemory) {
                    await this.injectMemoryToPrompt();
                }
            });
            
            console.log('[SillyTavernIntegration] ✅ 记忆注入钩子已注册');
            
        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 注册记忆注入钩子失败:', error);
        }
    }

    /**
     * 处理生成开始事件
     */
    async handleGenerationStarted(data) {
        try {
            console.log('[SillyTavernIntegration] 🚀 生成开始，准备注入记忆...');
            
            if (!this.settings.autoInjectMemory) {
                console.log('[SillyTavernIntegration] ℹ️ 自动注入已禁用');
                return;
            }
            
            // 注入记忆到提示词
            await this.injectMemoryToPrompt();
            
        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 处理生成开始事件失败:', error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[SillyTavernIntegration] 📨 收到消息，提取记忆...', data);

            // 🔧 修复：SillyTavern 传递的是消息索引，需要从聊天数组中获取消息
            let message;
            if (typeof data === 'number') {
                // data 是消息索引
                const chat = window.SillyTavern?.getContext?.()?.chat;
                if (chat && chat[data]) {
                    message = chat[data];
                }
            } else {
                // data 是消息对象
                message = data?.message || data;
            }

            if (!message || !message.mes) {
                console.warn('[SillyTavernIntegration] ⚠️ 无效的消息数据');
                return;
            }

            console.log('[SillyTavernIntegration] 📝 提取到消息:', message.mes.substring(0, 50) + '...');

            // 🔔 触发内部事件，通知其他模块（DeepMemoryManager会自动处理记忆添加）
            if (this.eventSystem) {
                this.eventSystem.emit('message:received', {
                    content: message.mes,
                    timestamp: Date.now(),
                    type: 'ai_message',
                    chatId: this.unifiedDataCore?.getCurrentChatId?.()
                });
                console.log('[SillyTavernIntegration] 🔔 已触发 message:received 事件');
            }

            // 更新统计
            this.stats.totalRetrievals++;

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 处理消息发送事件
     */
    async handleMessageSent(data) {
        try {
            console.log('[SillyTavernIntegration] 📤 发送消息，提取记忆...', data);

            // 🔧 修复：SillyTavern 传递的是消息索引，需要从聊天数组中获取消息
            let message;
            if (typeof data === 'number') {
                // data 是消息索引
                const chat = window.SillyTavern?.getContext?.()?.chat;
                if (chat && chat[data]) {
                    message = chat[data];
                }
            } else {
                // data 是消息对象
                message = data?.message || data;
            }

            if (!message || !message.mes) {
                console.warn('[SillyTavernIntegration] ⚠️ 无效的消息数据');
                return;
            }

            console.log('[SillyTavernIntegration] 📝 提取到消息:', message.mes.substring(0, 50) + '...');

            // 🔔 触发内部事件，通知其他模块（DeepMemoryManager会自动处理记忆添加）
            if (this.eventSystem) {
                this.eventSystem.emit('message:received', {
                    content: message.mes,
                    timestamp: Date.now(),
                    type: 'user_message',
                    chatId: this.unifiedDataCore?.getCurrentChatId?.()
                });
                console.log('[SillyTavernIntegration] 🔔 已触发 message:received 事件');
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 处理消息发送事件失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            console.log('[SillyTavernIntegration] 🔄 聊天切换，清理缓存...');
            
            // 清理缓存
            this.memoryCache.clear();
            
            // 触发内部事件
            if (this.eventSystem) {
                this.eventSystem.emit('chat:changed', data);
            }
            
        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 处理角色切换事件
     */
    async handleCharacterChanged(data) {
        try {
            console.log('[SillyTavernIntegration] 👤 角色切换，清理缓存...');
            
            // 清理缓存
            this.memoryCache.clear();
            
        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 处理角色切换事件失败:', error);
        }
    }

    /**
     * 💉 注入记忆到提示词
     */
    async injectMemoryToPrompt() {
        try {
            const startTime = Date.now();
            console.log('[SillyTavernIntegration] 💉 开始注入记忆到提示词...');

            // 检查缓存
            const cacheKey = `memory_injection_${Date.now()}`;
            if (this.settings.enableCaching && this.memoryCache.has(cacheKey)) {
                console.log('[SillyTavernIntegration] ✅ 使用缓存的记忆');
                this.stats.cacheHits++;
                return this.memoryCache.get(cacheKey);
            }

            // 获取当前聊天ID
            const chatId = this.unifiedDataCore?.getCurrentChatId?.();
            if (!chatId) {
                console.log('[SillyTavernIntegration] ⚠️ 无法获取当前聊天ID');
                return null;
            }

            // 获取最近的消息作为查询上下文
            const recentMessages = await this.getRecentMessages(3);
            const query = recentMessages.map(m => m.mes || m.content).join(' ');

            if (!query) {
                console.log('[SillyTavernIntegration] ⚠️ 无查询内容');
                return null;
            }

            // 使用上下文感知检索获取相关记忆
            let relevantMemories = [];
            if (this.contextualRetrieval) {
                const searchResult = await this.contextualRetrieval.hybridSearch(query, {
                    limit: this.settings.retrievalCount,
                    chatId: chatId
                });

                // 🔧 修复：hybridSearch返回的是对象，需要提取results数组
                relevantMemories = searchResult?.results || searchResult || [];
            }

            console.log('[SillyTavernIntegration] 📊 检索到', relevantMemories.length, '个相关记忆');

            // 构建记忆文本
            const memoryText = this.buildMemoryText(relevantMemories);

            // 注入到SillyTavern的提示词系统
            await this.injectToSillyTavernPrompt(memoryText);

            // 缓存结果
            if (this.settings.enableCaching) {
                this.memoryCache.set(cacheKey, memoryText);

                // 限制缓存大小
                if (this.memoryCache.size > 100) {
                    const firstKey = this.memoryCache.keys().next().value;
                    this.memoryCache.delete(firstKey);
                }
            }

            // 更新统计
            this.stats.totalInjections++;
            const injectionTime = Date.now() - startTime;
            this.stats.avgInjectionTime = (this.stats.avgInjectionTime * (this.stats.totalInjections - 1) + injectionTime) / this.stats.totalInjections;

            console.log('[SillyTavernIntegration] ✅ 记忆注入完成，耗时:', injectionTime, 'ms');

            return memoryText;

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 注入记忆失败:', error);
            return null;
        }
    }

    /**
     * 获取最近的消息
     */
    async getRecentMessages(count = 3) {
        try {
            const chat = this.context?.chat;
            if (!chat || !Array.isArray(chat)) return [];

            return chat.slice(-count);

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 获取最近消息失败:', error);
            return [];
        }
    }

    /**
     * 构建记忆文本
     */
    buildMemoryText(memories) {
        try {
            if (!memories || memories.length === 0) {
                return '';
            }

            const parts = [];
            parts.push('=== 相关记忆 ===');

            memories.forEach((memory, index) => {
                const content = memory.content || '';
                const importance = memory.metadata?.importance || 0;
                const timestamp = memory.timestamp ? new Date(memory.timestamp).toLocaleString() : '';

                parts.push(`${index + 1}. [重要性: ${importance.toFixed(2)}] ${content}`);
                if (timestamp) {
                    parts.push(`   时间: ${timestamp}`);
                }
            });

            parts.push('=== 记忆结束 ===\n');

            return parts.join('\n');

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 构建记忆文本失败:', error);
            return '';
        }
    }

    /**
     * 注入到SillyTavern提示词
     */
    async injectToSillyTavernPrompt(memoryText) {
        try {
            if (!memoryText) return;

            // 获取当前的系统提示词
            const context = this.context;
            if (!context) return;

            // 尝试注入到Author's Note或System Prompt
            // 这里使用SillyTavern的扩展槽位
            if (context.setExtensionPrompt) {
                context.setExtensionPrompt('MEMORY_ENHANCEMENT', memoryText, this.settings.memoryInjectionPosition === 'top' ? 0 : 999);
                console.log('[SillyTavernIntegration] ✅ 记忆已注入到扩展提示词槽位');
            } else {
                console.warn('[SillyTavernIntegration] ⚠️ 无法使用扩展提示词槽位，尝试其他方法');

                // 备用方案：直接添加到聊天历史
                if (context.chat && Array.isArray(context.chat)) {
                    // 在最后一条消息前插入记忆
                    const memoryMessage = {
                        name: 'System',
                        is_system: true,
                        mes: memoryText,
                        force_avatar: true
                    };

                    // 注意：这只是临时添加，不会保存到聊天历史
                    console.log('[SillyTavernIntegration] ℹ️ 使用备用注入方案');
                }
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 注入到SillyTavern提示词失败:', error);
        }
    }

    /**
     * 初始化UI
     */
    async initializeUI() {
        try {
            console.log('[SillyTavernIntegration] 🎨 初始化UI...');

            // 创建记忆面板按钮
            this.createMemoryPanelButton();

            // 创建记忆面板
            this.createMemoryPanel();

            console.log('[SillyTavernIntegration] ✅ UI初始化完成');

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 初始化UI失败:', error);
        }
    }

    /**
     * 创建记忆面板按钮
     */
    createMemoryPanelButton() {
        try {
            // 检查按钮是否已存在
            if (document.getElementById('memory-panel-button')) {
                return;
            }

            // 创建按钮
            const button = document.createElement('div');
            button.id = 'memory-panel-button';
            button.className = 'menu_button';
            button.title = '记忆增强面板';
            button.innerHTML = '<i class="fa-solid fa-brain"></i>';

            // 添加点击事件
            button.addEventListener('click', () => {
                this.toggleMemoryPanel();
            });

            // 添加到UI
            const topBar = document.getElementById('top-bar') || document.querySelector('.top-bar');
            if (topBar) {
                topBar.appendChild(button);
                console.log('[SillyTavernIntegration] ✅ 记忆面板按钮已创建');
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 创建记忆面板按钮失败:', error);
        }
    }

    /**
     * 创建记忆面板
     */
    createMemoryPanel() {
        try {
            // 检查面板是否已存在
            if (document.getElementById('memory-enhancement-panel')) {
                return;
            }

            // 创建面板
            const panel = document.createElement('div');
            panel.id = 'memory-enhancement-panel';
            panel.className = 'drawer-content';
            panel.style.display = 'none';
            panel.innerHTML = `
                <div class="drawer-header">
                    <h3>🧠 记忆增强系统</h3>
                    <div class="drawer-close" onclick="document.getElementById('memory-enhancement-panel').style.display='none'">×</div>
                </div>
                <div class="drawer-body">
                    <div id="memory-stats"></div>
                    <div id="memory-controls"></div>
                    <div id="memory-list"></div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(panel);

            // 更新面板内容
            this.updateMemoryPanel();

            console.log('[SillyTavernIntegration] ✅ 记忆面板已创建');

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 创建记忆面板失败:', error);
        }
    }

    /**
     * 切换记忆面板显示
     */
    toggleMemoryPanel() {
        try {
            const panel = document.getElementById('memory-enhancement-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';

                if (panel.style.display === 'block') {
                    this.updateMemoryPanel();
                }
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 切换记忆面板失败:', error);
        }
    }

    /**
     * 更新记忆面板
     */
    updateMemoryPanel() {
        try {
            // 更新统计信息
            const statsDiv = document.getElementById('memory-stats');
            if (statsDiv) {
                statsDiv.innerHTML = `
                    <h4>📊 统计信息</h4>
                    <p>总注入次数: ${this.stats.totalInjections}</p>
                    <p>总检索次数: ${this.stats.totalRetrievals}</p>
                    <p>缓存命中: ${this.stats.cacheHits}</p>
                    <p>平均注入时间: ${this.stats.avgInjectionTime.toFixed(2)}ms</p>
                `;
            }

            // 更新控制按钮
            const controlsDiv = document.getElementById('memory-controls');
            if (controlsDiv) {
                controlsDiv.innerHTML = `
                    <h4>⚙️ 控制</h4>
                    <button onclick="window.SillyTavernInfobar.modules.sillyTavernIntegration.clearCache()">清理缓存</button>
                    <button onclick="window.SillyTavernInfobar.modules.sillyTavernIntegration.refreshMemories()">刷新记忆</button>
                `;
            }

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 更新记忆面板失败:', error);
        }
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.memoryCache.clear();
        console.log('[SillyTavernIntegration] ✅ 缓存已清理');
        this.updateMemoryPanel();
    }

    /**
     * 刷新记忆
     */
    async refreshMemories() {
        try {
            console.log('[SillyTavernIntegration] 🔄 刷新记忆...');

            if (this.timeAwareMemoryManager) {
                await this.timeAwareMemoryManager.refreshMemories();
            }

            this.updateMemoryPanel();
            console.log('[SillyTavernIntegration] ✅ 记忆已刷新');

        } catch (error) {
            console.error('[SillyTavernIntegration] ❌ 刷新记忆失败:', error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[SillyTavernIntegration] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('sillytavern-integration:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.settings.enabled,
            stats: this.stats,
            cacheSize: this.memoryCache.size,
            errorCount: this.errorCount
        };
    }
}

