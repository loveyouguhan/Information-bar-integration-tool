/**
 * 总结面板UI组件
 * 
 * 负责总结功能的用户界面：
 * - 总结设置配置
 * - 总结触发控制
 * - 总结历史查看
 * - 总结内容显示
 * 
 * @class SummaryPanel
 */

export class SummaryPanel {
    constructor(unifiedDataCore, eventSystem, summaryManager) {
        console.log('[SummaryPanel] 🔧 总结面板初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.summaryManager = summaryManager;
        
        // UI元素
        this.panel = null;
        this.settingsSection = null;
        this.historySection = null;
        this.contentSection = null;
        
        // 状态
        this.visible = false;
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[SummaryPanel] 🏗️ 构造函数完成');
    }

    /**
     * 初始化总结面板
     */
    async init() {
        try {
            console.log('[SummaryPanel] 📊 开始初始化总结面板...');
            
            // 创建面板UI
            await this.createPanelUI();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 加载总结历史
            await this.loadSummaryHistory();
            
            this.initialized = true;
            console.log('[SummaryPanel] ✅ 总结面板初始化完成');
            
            // 🔧 新增：监听总结完成事件，触发自动隐藏检查
            if (this.eventSystem) {
                this.eventSystem.on('summary:completed', async (data) => {
                    console.log('[SummaryPanel] 📨 收到总结完成事件，检查自动隐藏');
                    await this.checkAndExecuteAutoHide();
                });
            }
            
            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('summary-panel:initialized', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 创建面板UI
     */
    async createPanelUI() {
        console.log('[SummaryPanel] 🎨 创建总结面板UI...');
        
        // 创建主面板容器
        this.panel = document.createElement('div');
        this.panel.className = 'summary-panel';
        this.panel.innerHTML = `
            <div class="summary-panel-header">
                <h3>📊 总结面板</h3>
                <button class="summary-panel-close" title="关闭面板">×</button>
            </div>
            
            <div class="summary-panel-content">
                <!-- 总结设置区域 -->
                <div class="summary-settings-section">
                    <h4>⚙️ 总结设置</h4>
                    
                    <div class="setting-group">
                        <label>
                            <input type="checkbox" id="auto-summary-enabled" />
                            启用自动总结
                        </label>
                    </div>
                    
                    <div class="setting-group">
                        <label for="summary-floor-count">总结楼层数：</label>
                        <input type="number" id="summary-floor-count" min="5" max="100" value="20" />
                        <span class="setting-hint">每隔多少条消息进行一次总结</span>
                    </div>
                    
                    <div class="setting-group">
                        <label for="summary-type">总结类型：</label>
                        <select id="summary-type">
                            <option value="small">小总结 (100-200字)</option>
                            <option value="large">大总结 (300-500字)</option>
                            <option value="custom">自定义字数</option>
                        </select>
                    </div>
                    
                    <div class="setting-group" id="custom-word-count-group" style="display: none;">
                        <label for="summary-word-count">总结字数：</label>
                        <input type="number" id="summary-word-count" min="50" max="1000" value="300" />
                        <span class="setting-hint">字</span>
                    </div>
                    
                    <!-- 🚀 新增：AI记忆总结设置 -->
                    <div class="setting-group ai-memory-section">
                        <h5>🧠 AI记忆总结</h5>
                        <label>
                            <input type="checkbox" id="ai-memory-enabled" />
                            启用AI记忆总结
                        </label>
                        <span class="setting-hint">使用AI智能分析和总结消息内容</span>
                    </div>

                    <div class="setting-group ai-memory-options" id="ai-memory-options" style="display: none;">
                        <label>
                            <input type="checkbox" id="ai-message-level-summary" />
                            消息级别总结
                        </label>
                        <span class="setting-hint">为每条重要消息生成智能总结</span>
                    </div>

                    <div class="setting-group ai-memory-options" style="display: none;">
                        <label for="ai-importance-threshold">重要性阈值：</label>
                        <input type="range" id="ai-importance-threshold" min="0.1" max="1.0" step="0.1" value="0.6" />
                        <span class="setting-value" id="ai-importance-value">60%</span>
                        <span class="setting-hint">只总结重要性超过此阈值的消息</span>
                    </div>

                    <!-- 🔧 新增：自动隐藏楼层设置 -->
                    <div class="setting-group">
                        <label>
                            <input type="checkbox" id="auto-hide-enabled" />
                            启用自动隐藏已总结楼层
                        </label>
                        <span class="setting-hint">自动隐藏已经总结过的楼层内容，减少界面混乱</span>
                    </div>

                    <div class="setting-group" id="auto-hide-threshold-group" style="display: none;">
                        <label for="auto-hide-threshold">保留最新楼层数：</label>
                        <input type="number" id="auto-hide-threshold" min="10" max="200" value="30" />
                        <span class="setting-hint">保留最新的N个楼层不隐藏</span>
                    </div>
                    
                    <div class="setting-actions">
                        <button id="manual-summary-btn" class="btn btn-primary">
                            🖊️ 手动总结
                        </button>
                        <button id="save-settings-btn" class="btn btn-secondary">
                            💾 保存设置
                        </button>
                    </div>
                </div>
                
                <!-- 总结历史区域 -->
                <div class="summary-history-section">
                    <h4>📚 总结历史</h4>

                    <!-- 🚀 新增：总结类型筛选 -->
                    <div class="summary-filter-tabs">
                        <button class="filter-tab active" data-filter="all">全部</button>
                        <button class="filter-tab" data-filter="traditional">传统总结</button>
                        <button class="filter-tab" data-filter="ai_memory">AI记忆</button>
                    </div>

                    <div class="summary-history-list" id="summary-history-list">
                        <div class="no-summaries">暂无总结记录</div>
                    </div>
                </div>
                
                <!-- 总结内容区域 -->
                <div class="summary-content-section" id="summary-content-section" style="display: none;">
                    <h4>📄 总结内容</h4>
                    <div class="summary-content-header">
                        <span class="summary-title" id="summary-title"></span>
                        <span class="summary-date" id="summary-date"></span>
                        <button class="btn btn-small" id="close-content-btn">关闭</button>
                    </div>
                    <div class="summary-content-body" id="summary-content-body"></div>
                </div>
            </div>
        `;
        
        // 添加样式
        this.addPanelStyles();
        
        // 获取关键元素引用
        this.settingsSection = this.panel.querySelector('.summary-settings-section');
        this.historySection = this.panel.querySelector('.summary-history-section');
        this.contentSection = this.panel.querySelector('.summary-content-section');
        
        console.log('[SummaryPanel] ✅ 面板UI创建完成');
    }

    /**
     * 添加面板样式
     */
    addPanelStyles() {
        const styleId = 'summary-panel-styles';
        if (document.getElementById(styleId)) {
            return; // 样式已存在
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .summary-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 600px;
                max-height: 80vh;
                background: var(--SmartThemeBodyColor, #1a1a1a);
                border: 2px solid var(--SmartThemeBorderColor, #333);
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                overflow: hidden;
                display: none;
            }
            
            .summary-panel-header {
                background: var(--SmartThemeQuoteColor, #2a2a2a);
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--SmartThemeBorderColor, #333);
            }
            
            .summary-panel-header h3 {
                margin: 0;
                color: var(--SmartThemeEmColor, #ff6b6b);
                font-size: 18px;
            }
            
            .summary-panel-close {
                background: none;
                border: none;
                color: var(--SmartThemeEmColor, #ff6b6b);
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .summary-panel-content {
                padding: 20px;
                max-height: calc(80vh - 80px);
                overflow-y: auto;
            }
            
            .summary-settings-section,
            .summary-history-section,
            .summary-content-section {
                margin-bottom: 25px;
                padding: 15px;
                background: var(--SmartThemeQuoteColor, #2a2a2a);
                border-radius: 8px;
                border: 1px solid var(--SmartThemeBorderColor, #333);
            }
            
            .summary-settings-section h4,
            .summary-history-section h4,
            .summary-content-section h4 {
                margin: 0 0 15px 0;
                color: var(--SmartThemeEmColor, #ff6b6b);
                font-size: 16px;
            }
            
            .setting-group {
                margin-bottom: 15px;
            }
            
            .setting-group label {
                display: block;
                margin-bottom: 5px;
                color: var(--SmartThemeBodyColor, #e0e0e0);
                font-weight: 500;
            }
            
            .setting-group input,
            .setting-group select {
                width: 100%;
                padding: 8px 12px;
                background: var(--SmartThemeBodyColor, #1a1a1a);
                border: 1px solid var(--SmartThemeBorderColor, #333);
                border-radius: 4px;
                color: var(--SmartThemeBodyColor, #e0e0e0);
                font-size: 14px;
            }
            
            .setting-group input[type="checkbox"] {
                width: auto;
                margin-right: 8px;
            }
            
            .setting-hint {
                font-size: 12px;
                color: var(--SmartThemeQuoteColor, #888);
                margin-left: 8px;
            }
            
            .setting-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: var(--SmartThemeEmColor, #ff6b6b);
                color: white;
            }
            
            .btn-secondary {
                background: var(--SmartThemeQuoteColor, #666);
                color: white;
            }
            
            .btn-small {
                padding: 4px 8px;
                font-size: 12px;
            }
            
            .btn:hover {
                opacity: 0.8;
            }
            
            .summary-history-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .summary-item {
                padding: 10px;
                margin-bottom: 8px;
                background: var(--SmartThemeBodyColor, #1a1a1a);
                border: 1px solid var(--SmartThemeBorderColor, #333);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .summary-item:hover {
                background: var(--SmartThemeQuoteColor, #2a2a2a);
            }
            
            .summary-item-title {
                font-weight: 500;
                color: var(--SmartThemeEmColor, #ff6b6b);
                margin-bottom: 4px;
            }
            
            .summary-item-date {
                font-size: 12px;
                color: var(--SmartThemeQuoteColor, #888);
            }
            
            .no-summaries {
                text-align: center;
                color: var(--SmartThemeQuoteColor, #888);
                padding: 20px;
                font-style: italic;
            }
            
            .summary-content-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--SmartThemeBorderColor, #333);
            }
            
            .summary-title {
                font-weight: 500;
                color: var(--SmartThemeEmColor, #ff6b6b);
            }
            /* 删除按钮样式，避免被标题或选择框挤压 */
            .delete-summary-btn {
                margin-left: 10px;
                padding: 4px 8px;
                font-size: 12px;
                background: var(--SmartThemeEmColor, #ff6b6b);
                color: #fff;
                border: 1px solid var(--SmartThemeBorderColor, #333);
                border-radius: 4px;
                cursor: pointer;
                flex-shrink: 0;
            }

            .delete-summary-btn:hover {
                opacity: 0.9;
            }
            
            .summary-date {
                font-size: 12px;
                color: var(--SmartThemeQuoteColor, #888);
            }
            
            .summary-content-body {
                line-height: 1.6;
                color: var(--SmartThemeBodyColor, #e0e0e0);
                white-space: pre-wrap;
            }

            /* 🚀 AI记忆总结样式 */
            .ai-memory-section h5 {
                margin: 0 0 10px 0;
                color: #4CAF50;
                font-size: 14px;
                font-weight: 600;
            }

            .ai-memory-options {
                margin-left: 20px;
                border-left: 2px solid #4CAF50;
                padding-left: 15px;
            }

            .summary-filter-tabs {
                display: flex;
                margin-bottom: 15px;
                border-bottom: 1px solid var(--SmartThemeBorderColor, #333);
            }

            .filter-tab {
                background: none;
                border: none;
                padding: 8px 16px;
                color: var(--SmartThemeQuoteColor, #888);
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            }

            .filter-tab.active {
                color: var(--SmartThemeEmColor, #ff6b6b);
                border-bottom-color: var(--SmartThemeEmColor, #ff6b6b);
            }

            .filter-tab:hover {
                color: var(--SmartThemeEmColor, #ff6b6b);
            }

            .summary-item.ai-memory {
                border-left: 4px solid #4CAF50;
            }

            .summary-item.traditional {
                border-left: 4px solid #2196F3;
            }

            .summary-item-type {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                margin-left: 8px;
            }

            .summary-item-type.ai-memory {
                background: #4CAF50;
                color: white;
            }

            .summary-item-type.traditional {
                background: #2196F3;
                color: white;
            }

            /* 🚀 增强的总结历史样式 */
            .summary-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }

            .summary-item-badge {
                flex-shrink: 0;
            }

            .badge {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .ai-memory-badge {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
            }

            .traditional-badge {
                background: linear-gradient(135deg, #2196F3, #1976D2);
                color: white;
                box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
            }

            .summary-item-preview {
                font-size: 12px;
                color: var(--SmartThemeQuoteColor, #888);
                margin-top: 5px;
                line-height: 1.4;
                max-height: 40px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }

            .ai-memory-item {
                border-left: 4px solid #4CAF50;
                background: linear-gradient(90deg, rgba(76, 175, 80, 0.05), transparent);
            }

            .traditional-item {
                border-left: 4px solid #2196F3;
                background: linear-gradient(90deg, rgba(33, 150, 243, 0.05), transparent);
            }

            .ai-memory-item:hover {
                background: linear-gradient(90deg, rgba(76, 175, 80, 0.1), transparent);
                border-left-color: #45a049;
            }

            .traditional-item:hover {
                background: linear-gradient(90deg, rgba(33, 150, 243, 0.1), transparent);
                border-left-color: #1976D2;
            }

            .setting-value {
                margin-left: 8px;
                color: var(--SmartThemeEmColor, #ff6b6b);
                font-weight: 600;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        console.log('[SummaryPanel] 🔗 绑定事件监听器...');
        
        if (!this.panel) return;
        
        // 关闭面板
        const closeBtn = this.panel.querySelector('.summary-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // 总结类型变化
        const summaryTypeSelect = this.panel.querySelector('#summary-type');
        if (summaryTypeSelect) {
            summaryTypeSelect.addEventListener('change', (e) => {
                this.handleSummaryTypeChange(e.target.value);
            });
        }
        
        // 手动总结按钮
        const manualSummaryBtn = this.panel.querySelector('#manual-summary-btn');
        if (manualSummaryBtn) {
            manualSummaryBtn.addEventListener('click', () => {
                this.triggerManualSummary();
            });
        }
        
        // 保存设置按钮
        const saveSettingsBtn = this.panel.querySelector('#save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }
        
        // 🚀 新增：AI记忆总结复选框
        const aiMemoryEnabledCheckbox = this.panel.querySelector('#ai-memory-enabled');
        if (aiMemoryEnabledCheckbox) {
            aiMemoryEnabledCheckbox.addEventListener('change', (e) => {
                this.handleAIMemoryEnabledChange(e.target.checked);
            });
        }

        // 🚀 新增：消息级别总结复选框
        const aiMessageLevelCheckbox = this.panel.querySelector('#ai-message-level-summary');
        if (aiMessageLevelCheckbox) {
            aiMessageLevelCheckbox.addEventListener('change', (e) => {
                this.handleAIMessageLevelChange(e.target.checked);
            });
        }

        // 🚀 新增：重要性阈值滑块
        const aiImportanceThreshold = this.panel.querySelector('#ai-importance-threshold');
        if (aiImportanceThreshold) {
            aiImportanceThreshold.addEventListener('input', (e) => {
                this.handleAIImportanceThresholdChange(e.target.value);
            });
        }

        // 🚀 新增：总结筛选标签
        const filterTabs = this.panel.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleFilterTabClick(e.target.dataset.filter);
            });
        });

        // 🔧 新增：自动隐藏楼层复选框
        const autoHideEnabledCheckbox = this.panel.querySelector('#auto-hide-enabled');
        if (autoHideEnabledCheckbox) {
            autoHideEnabledCheckbox.addEventListener('change', (e) => {
                this.handleAutoHideEnabledChange(e.target.checked);
            });
        }

        // 关闭内容区域
        const closeContentBtn = this.panel.querySelector('#close-content-btn');
        if (closeContentBtn) {
            closeContentBtn.addEventListener('click', () => {
                this.hideContentSection();
            });
        }
        
        console.log('[SummaryPanel] ✅ 事件监听器绑定完成');
        
        // 绑定事件系统监听器
        this.bindEventSystemListeners();
    }

    /**
     * 绑定事件系统监听器
     */
    bindEventSystemListeners() {
        try {
            console.log('[SummaryPanel] 🔗 绑定事件系统监听器...');
            
            if (!this.eventSystem) return;
            
            // 监听总结保存事件
            this.eventSystem.on('summary:saved', (data) => {
                this.handleSummarySaved(data);
            });
            
            // 监听总结删除事件
            this.eventSystem.on('summary:deleted', (data) => {
                this.handleSummaryDeleted(data);
            });
            
            // 监听聊天切换事件，刷新总结历史
            this.eventSystem.on('summary:chat:changed', (data) => {
                this.handleChatChanged(data);
            });
            
            // 也监听通用的聊天切换事件
            this.eventSystem.on('chat:changed', (data) => {
                this.handleChatChanged(data);
            });

            // 🚀 新增：监听AI总结创建事件
            this.eventSystem.on('ai-summary:created', (data) => {
                this.handleAISummaryCreated(data);
            });

            // 🚀 新增：监听AI记忆总结器初始化事件
            this.eventSystem.on('ai-memory-summarizer:initialized', (data) => {
                this.handleAIMemorySummarizerInitialized(data);
            });

            console.log('[SummaryPanel] ✅ 事件系统监听器绑定完成');
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 绑定事件系统监听器失败:', error);
        }
    }

    /**
     * 显示总结面板
     */
    show() {
        try {
            console.log('[SummaryPanel] 📱 显示总结面板');

            if (!this.panel) {
                console.warn('[SummaryPanel] ⚠️ 面板未初始化');
                return;
            }

            // 添加到页面
            if (!document.body.contains(this.panel)) {
                document.body.appendChild(this.panel);
            }

            // 显示面板
            this.panel.style.display = 'block';
            this.visible = true;

            // 加载当前设置
            this.loadCurrentSettings();

            // 刷新总结历史
            this.refreshSummaryHistory();

        } catch (error) {
            console.error('[SummaryPanel] ❌ 显示面板失败:', error);
        }
    }

    /**
     * 隐藏总结面板
     */
    hide() {
        try {
            console.log('[SummaryPanel] 📱 隐藏总结面板');

            if (this.panel) {
                this.panel.style.display = 'none';
                this.visible = false;
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 隐藏面板失败:', error);
        }
    }

    /**
     * 🔧 新增：处理自动隐藏启用状态变化
     */
    handleAutoHideEnabledChange(enabled) {
        try {
            console.log('[SummaryPanel] 🔄 自动隐藏楼层启用状态变化:', enabled);
            
            // 显示/隐藏阈值设置
            const thresholdGroup = this.panel.querySelector('#auto-hide-threshold-group');
            if (thresholdGroup) {
                thresholdGroup.style.display = enabled ? 'block' : 'none';
            }
            
            // 如果启用了自动隐藏，立即检查是否需要隐藏楼层
            if (enabled) {
                this.checkAndExecuteAutoHide();
            }
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理自动隐藏状态变化失败:', error);
        }
    }

    /**
     * 处理总结类型变化
     */
    handleSummaryTypeChange(summaryType) {
        try {
            console.log('[SummaryPanel] 🔄 总结类型变化:', summaryType);

            const customWordCountGroup = this.panel.querySelector('#custom-word-count-group');
            if (customWordCountGroup) {
                if (summaryType === 'custom') {
                    customWordCountGroup.style.display = 'block';
                } else {
                    customWordCountGroup.style.display = 'none';
                }
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理总结类型变化失败:', error);
        }
    }

    /**
     * 🔧 新增：检查并执行自动隐藏楼层
     */
    async checkAndExecuteAutoHide() {
        try {
            // 获取设置
            const autoHideEnabled = this.panel?.querySelector('#auto-hide-enabled')?.checked || false;
            const autoHideThreshold = parseInt(this.panel?.querySelector('#auto-hide-threshold')?.value) || 30;
            
            if (!autoHideEnabled) {
                console.log('[SummaryPanel] ⏸️ 自动隐藏未启用，跳过检查');
                return;
            }
            
            // 获取当前聊天消息数量
            const chatLength = this.getChatLength();
            if (chatLength <= autoHideThreshold) {
                console.log('[SummaryPanel] ℹ️ 聊天长度不足，无需隐藏楼层');
                return;
            }
            
            // 计算需要隐藏的范围：0到(总长度-阈值-1)
            const hideUntilIndex = chatLength - autoHideThreshold - 1;
            
            if (hideUntilIndex > 0) {
                console.log(`[SummaryPanel] 🔄 执行自动隐藏：隐藏楼层 0-${hideUntilIndex}`);
                await this.executeHideCommand(`/hide 0-${hideUntilIndex}`);
            }
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 自动隐藏楼层失败:', error);
        }
    }
    
    /**
     * 获取当前聊天的消息数量
     */
    getChatLength() {
        try {
            // 使用SillyTavern的getContext获取聊天数据
            if (typeof getContext === 'function') {
                const context = getContext();
                return context?.chat?.length || 0;
            }
            
            // 备用方法：通过DOM查询消息数量
            const messages = document.querySelectorAll('#chat .mes');
            return messages.length;
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 获取聊天长度失败:', error);
            return 0;
        }
    }
    
    /**
     * 执行隐藏命令
     */
    async executeHideCommand(command) {
        try {
            console.log('[SummaryPanel] 📋 执行隐藏命令:', command);
            
            // 方法1: 尝试使用SillyTavern的斜杠命令解析器
            if (typeof window.SlashCommandParser !== 'undefined') {
                const parser = new window.SlashCommandParser();
                const result = parser.parse(command, false);
                
                if (result && typeof result.execute === 'function') {
                    await result.execute();
                    console.log('[SummaryPanel] ✅ 隐藏命令执行成功 (方法1)');
                    return;
                }
            }
            
            // 方法2: 尝试直接在聊天输入框执行命令
            const chatTextarea = document.getElementById('send_textarea');
            if (chatTextarea) {
                console.log('[SummaryPanel] 🔄 尝试通过聊天输入框执行命令');
                const originalValue = chatTextarea.value;
                chatTextarea.value = command;
                
                // 触发输入事件
                chatTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                // 等待短暂时间后按回车
                setTimeout(() => {
                    chatTextarea.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        bubbles: true
                    }));
                    
                    // 恢复原始值
                    setTimeout(() => {
                        chatTextarea.value = originalValue;
                    }, 100);
                }, 100);
                
                console.log('[SummaryPanel] ✅ 隐藏命令已通过聊天输入框发送');
                return;
            }
            
            // 方法3: 尝试使用SillyTavern的全局命令执行器
            if (typeof window.executeSlashCommand === 'function') {
                await window.executeSlashCommand(command);
                console.log('[SummaryPanel] ✅ 隐藏命令执行成功 (方法3)');
                return;
            }
            
            console.warn('[SummaryPanel] ⚠️ 所有隐藏命令执行方法都失败');
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 执行隐藏命令失败:', error);
        }
    }

    /**
     * 触发手动总结
     */
    async triggerManualSummary() {
        try {
            console.log('[SummaryPanel] 🖊️ 触发手动总结...');

            const manualSummaryBtn = this.panel.querySelector('#manual-summary-btn');
            if (manualSummaryBtn) {
                manualSummaryBtn.disabled = true;
                manualSummaryBtn.textContent = '⏳ 总结中...';
            }

            // 获取当前设置
            const settings = this.getCurrentSettings();

            // 调用总结管理器进行总结
            if (this.summaryManager) {
                const result = await this.summaryManager.generateSummary({
                    type: 'manual',
                    ...settings
                });

                if (result.success) {
                    console.log('[SummaryPanel] ✅ 手动总结完成');
                    this.showNotification('✅ 总结生成成功', 'success');

                    // 刷新总结历史
                    this.refreshSummaryHistory();
                    
                    // 🔧 新增：手动总结完成后检查自动隐藏
                    await this.checkAndExecuteAutoHide();
                } else {
                    console.error('[SummaryPanel] ❌ 手动总结失败:', result.error);
                    this.showNotification('❌ 总结生成失败: ' + result.error, 'error');
                }
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 触发手动总结失败:', error);
            this.showNotification('❌ 总结生成失败', 'error');
        } finally {
            // 恢复按钮状态
            const manualSummaryBtn = this.panel.querySelector('#manual-summary-btn');
            if (manualSummaryBtn) {
                manualSummaryBtn.disabled = false;
                manualSummaryBtn.textContent = '🖊️ 手动总结';
            }
        }
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            console.log('[SummaryPanel] 💾 保存总结设置...');

            const settings = this.getCurrentSettings();

            // 保存到数据核心
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('summary_settings', settings);
                console.log('[SummaryPanel] ✅ 设置已保存');
                this.showNotification('✅ 设置已保存', 'success');

                // 通知总结管理器设置已更新
                if (this.summaryManager) {
                    this.summaryManager.updateSettings(settings);
                }
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 保存设置失败:', error);
            this.showNotification('❌ 保存设置失败', 'error');
        }
    }

    /**
     * 获取当前设置
     */
    getCurrentSettings() {
        const settings = {
            autoSummaryEnabled: false,
            summaryFloorCount: 20,
            summaryType: 'small',
            summaryWordCount: 300,
            // 🔧 新增：自动隐藏楼层设置
            autoHideEnabled: false,
            autoHideThreshold: 30
        };

        try {
            if (!this.panel) return settings;

            const autoSummaryEnabled = this.panel.querySelector('#auto-summary-enabled');
            if (autoSummaryEnabled) {
                settings.autoSummaryEnabled = autoSummaryEnabled.checked;
            }

            const summaryFloorCount = this.panel.querySelector('#summary-floor-count');
            if (summaryFloorCount) {
                settings.summaryFloorCount = parseInt(summaryFloorCount.value) || 20;
            }

            const summaryType = this.panel.querySelector('#summary-type');
            if (summaryType) {
                settings.summaryType = summaryType.value;
            }

            const summaryWordCount = this.panel.querySelector('#summary-word-count');
            if (summaryWordCount) {
                settings.summaryWordCount = parseInt(summaryWordCount.value) || 300;
            }
            
            // 🔧 新增：自动隐藏楼层设置
            const autoHideEnabled = this.panel.querySelector('#auto-hide-enabled');
            if (autoHideEnabled) {
                settings.autoHideEnabled = autoHideEnabled.checked;
            }
            
            const autoHideThreshold = this.panel.querySelector('#auto-hide-threshold');
            if (autoHideThreshold) {
                settings.autoHideThreshold = parseInt(autoHideThreshold.value) || 30;
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 获取当前设置失败:', error);
        }

        return settings;
    }

    /**
     * 加载当前设置
     */
    async loadCurrentSettings() {
        try {
            console.log('[SummaryPanel] 📥 加载当前设置...');

            if (!this.unifiedDataCore) return;

            const settings = await this.unifiedDataCore.getData('summary_settings');
            if (!settings) return;

            // 应用设置到UI
            const autoSummaryEnabled = this.panel.querySelector('#auto-summary-enabled');
            if (autoSummaryEnabled) {
                autoSummaryEnabled.checked = settings.autoSummaryEnabled || false;
            }

            const summaryFloorCount = this.panel.querySelector('#summary-floor-count');
            if (summaryFloorCount) {
                summaryFloorCount.value = settings.summaryFloorCount || 20;
            }

            const summaryType = this.panel.querySelector('#summary-type');
            if (summaryType) {
                summaryType.value = settings.summaryType || 'small';
                this.handleSummaryTypeChange(summaryType.value);
            }

            const summaryWordCount = this.panel.querySelector('#summary-word-count');
            if (summaryWordCount) {
                summaryWordCount.value = settings.summaryWordCount || 300;
            }
            
            // 🔧 新增：自动隐藏楼层设置
            const autoHideEnabled = this.panel.querySelector('#auto-hide-enabled');
            if (autoHideEnabled) {
                autoHideEnabled.checked = settings.autoHideEnabled || false;
                this.handleAutoHideEnabledChange(autoHideEnabled.checked);
            }
            
            const autoHideThreshold = this.panel.querySelector('#auto-hide-threshold');
            if (autoHideThreshold) {
                autoHideThreshold.value = settings.autoHideThreshold || 30;
            }

            console.log('[SummaryPanel] ✅ 设置加载完成');

        } catch (error) {
            console.error('[SummaryPanel] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 加载总结历史（聊天隔离版本）
     */
    async loadSummaryHistory(forceRefresh = false) {
        try {
            const currentChatId = this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[SummaryPanel] 📚 加载当前聊天的总结历史...', currentChatId);

            if (!this.summaryManager) {
                console.warn('[SummaryPanel] ⚠️ SummaryManager未初始化');
                // 如果没有总结管理器，清空显示
                const historyList = this.panel?.querySelector('#summary-history-list');
                if (historyList) {
                    historyList.innerHTML = '<div class="no-summaries">总结管理器未初始化</div>';
                }
                return;
            }

            // 使用 SummaryManager 的聊天隔离方法
            const summaryHistory = await this.summaryManager.getSummaryHistory();
            
            // 强制刷新UI
            this.renderSummaryHistory(summaryHistory);

            console.log('[SummaryPanel] ✅ 当前聊天总结历史加载完成，共', summaryHistory.length, '条记录');

        } catch (error) {
            console.error('[SummaryPanel] ❌ 加载总结历史失败:', error);
            // 出错时也要清空显示
            const historyList = this.panel?.querySelector('#summary-history-list');
            if (historyList) {
                historyList.innerHTML = '<div class="no-summaries">加载总结历史失败</div>';
            }
        }
    }

    /**
     * 刷新总结历史（加入去抖，避免短时间内频繁刷新）
     */
    async refreshSummaryHistory() {
        try {
            if (this._refreshTimer) {
                clearTimeout(this._refreshTimer);
            }
            this._refreshTimer = setTimeout(async () => {
                await this.loadSummaryHistory();
            }, 400);
        } catch (e) {
            console.error('[SummaryPanel] 刷新总结历史失败:', e);
            // 兜底直接加载一次
            await this.loadSummaryHistory();
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatChanged(data) {
        try {
            console.log('[SummaryPanel] 🔄 聊天切换，清理UI状态并刷新总结历史');
            
            // 清理当前显示的总结内容
            this.hideContentSection();
            
            // 强制刷新总结历史，无论面板是否可见
            // 这确保InfoBarSettings中的总结列表也能正确更新
            await this.loadSummaryHistory(true);
            
            console.log('[SummaryPanel] ✅ 聊天切换处理完成');
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理聊天切换失败:', error);
        }
    }

    /**
     * 处理总结保存事件
     */
    async handleSummarySaved(data) {
        try {
            console.log('[SummaryPanel] 💾 收到总结保存事件:', data.summaryId);
            
            // 如果面板可见，刷新总结历史
            if (this.visible) {
                await this.loadSummaryHistory();
            }
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理总结保存事件失败:', error);
        }
    }

    /**
     * 处理总结删除事件
     */
    async handleSummaryDeleted(data) {
        try {
            console.log('[SummaryPanel] 🗑️ 收到总结删除事件:', data.summaryId);
            
            // 如果面板可见，刷新总结历史
            if (this.visible) {
                await this.loadSummaryHistory();
            }
            
        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理总结删除事件失败:', error);
        }
    }

    /**
     * 渲染总结历史
     */
    renderSummaryHistory(summaryHistory) {
        try {
            const historyList = this.panel.querySelector('#summary-history-list');
            if (!historyList) return;

            if (!summaryHistory || summaryHistory.length === 0) {
                historyList.innerHTML = '<div class="no-summaries">暂无总结记录</div>';
                return;
            }

            // 按时间倒序排列
            const sortedHistory = summaryHistory.sort((a, b) => b.timestamp - a.timestamp);

            historyList.innerHTML = sortedHistory.map(summary => `
                <div class="summary-item" data-summary-id="${summary.id}">
                    <div class="summary-item-title">${this.formatSummaryTitle(summary)}</div>
                    <div class="summary-item-date">${this.formatDate(summary.timestamp)}</div>
                </div>
            `).join('');

            // 绑定点击事件
            historyList.querySelectorAll('.summary-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const summaryId = e.currentTarget.getAttribute('data-summary-id');
                    this.showSummaryContent(summaryId);
                });
            });

        } catch (error) {
            console.error('[SummaryPanel] ❌ 渲染总结历史失败:', error);
        }
    }

    /**
     * 格式化总结标题
     */
    formatSummaryTitle(summary) {
        const typeMap = {
            'small': '小总结',
            'large': '大总结',
            'manual': '手动总结',
            'auto': '自动总结'
        };

        const typeText = typeMap[summary.type] || '总结';
        const messageRange = summary.messageRange ?
            ` (${summary.messageRange.start}-${summary.messageRange.end})` : '';

        return `${typeText}${messageRange}`;
    }

    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 显示总结内容
     */
    async showSummaryContent(summaryId) {
        try {
            console.log('[SummaryPanel] 📄 显示总结内容:', summaryId);

            if (!this.summaryManager) {
                console.warn('[SummaryPanel] ⚠️ SummaryManager未初始化');
                return;
            }

            // 🔧 修复：使用增强的总结历史获取方法，支持AI记忆总结
            const allSummaries = await this.summaryManager.getEnhancedSummaryHistory();
            const summary = allSummaries.find(s => s.id === summaryId);

            if (!summary) {
                console.warn('[SummaryPanel] ⚠️ 未找到总结记录:', summaryId);
                return;
            }

            console.log('[SummaryPanel] 📋 找到总结记录:', {
                id: summary.id,
                type: summary.type,
                source: summary.source,
                hasContent: !!summary.content
            });

            // 显示内容区域
            const contentSection = this.panel.querySelector('#summary-content-section');
            const titleElement = this.panel.querySelector('#summary-title');
            const dateElement = this.panel.querySelector('#summary-date');
            const bodyElement = this.panel.querySelector('#summary-content-body');

            if (contentSection && titleElement && dateElement && bodyElement) {
                // 🔧 修复：使用增强的标题格式化方法
                titleElement.textContent = this.formatEnhancedSummaryTitle(summary);
                dateElement.textContent = this.formatDate(summary.timestamp);
                bodyElement.textContent = summary.content || '暂无内容';

                // 🔧 新增：添加总结类型徽章
                const badgeHtml = this.getSummaryTypeBadge(summary);
                titleElement.innerHTML = `${this.formatEnhancedSummaryTitle(summary)} ${badgeHtml}`;

                contentSection.style.display = 'block';

                console.log('[SummaryPanel] ✅ 总结内容已显示');

                // 滚动到内容区域
                contentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // 🔧 在标题区域旁边添加删除按钮（若不存在）
                let deleteBtn = this.panel.querySelector('#delete-summary-btn');
                if (!deleteBtn) {
                    deleteBtn = document.createElement('button');
                    deleteBtn.id = 'delete-summary-btn';
                    deleteBtn.className = 'delete-summary-btn';
                    deleteBtn.textContent = '🗑️ 删除该总结';

                    // 将按钮插入到标题行附近
                    const titleContainer = titleElement.parentElement;
                    if (titleContainer) {
                        titleContainer.appendChild(deleteBtn);
                    } else {
                        contentSection.insertBefore(deleteBtn, contentSection.firstChild);
                    }
                }

                // 绑定删除事件
                deleteBtn.onclick = async () => {
                    try {
                        if (!this.summaryManager) return;
                        const ok = await this.summaryManager.deleteSummaryRecord(summary.id);
                        if (ok) {
                            this.showNotification('✅ 已删除该总结', 'success');
                            // 清空当前显示
                            contentSection.style.display = 'none';
                            // 刷新历史列表
                            await this.refreshSummaryHistory();
                        } else {
                            this.showNotification('❌ 删除失败', 'error');
                        }
                    } catch (err) {
                        console.error('[SummaryPanel] ❌ 删除总结失败:', err);
                        this.showNotification('❌ 删除失败', 'error');
                    }
                };
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 显示总结内容失败:', error);
        }
    }

    /**
     * 隐藏内容区域
     */
    hideContentSection() {
        const contentSection = this.panel.querySelector('#summary-content-section');
        if (contentSection) {
            contentSection.style.display = 'none';
        }
    }

    /**
     * 显示通知消息
     */
    showNotification(message, type = 'info') {
        try {
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `summary-notification summary-notification-${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                font-size: 14px;
                max-width: 300px;
                word-wrap: break-word;
            `;

            document.body.appendChild(notification);

            // 3秒后自动移除
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);

        } catch (error) {
            console.error('[SummaryPanel] ❌ 显示通知失败:', error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[SummaryPanel] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('summary-panel:error', {
                error: error,
                errorCount: this.errorCount,
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
            visible: this.visible,
            errorCount: this.errorCount,
            panelExists: !!this.panel
        };
    }

    /**
     * 🚀 处理AI记忆总结启用状态变化
     */
    handleAIMemoryEnabledChange(enabled) {
        try {
            console.log('[SummaryPanel] 🧠 AI记忆总结启用状态变化:', enabled);

            // 显示/隐藏AI记忆选项
            const aiMemoryOptions = this.panel.querySelectorAll('.ai-memory-options');
            aiMemoryOptions.forEach(option => {
                option.style.display = enabled ? 'block' : 'none';
            });

            // 更新AI记忆总结器设置
            if (this.summaryManager && this.summaryManager.aiMemorySummarizer) {
                this.summaryManager.aiMemorySummarizer.updateSettings({
                    enabled: enabled
                });
            }

            this.showNotification(
                enabled ? '✅ AI记忆总结已启用' : '❌ AI记忆总结已禁用',
                enabled ? 'success' : 'info'
            );

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理AI记忆总结启用状态变化失败:', error);
        }
    }

    /**
     * 🚀 处理消息级别总结变化
     */
    handleAIMessageLevelChange(enabled) {
        try {
            console.log('[SummaryPanel] 📝 消息级别总结状态变化:', enabled);

            // 更新AI记忆总结器设置
            if (this.summaryManager && this.summaryManager.aiMemorySummarizer) {
                this.summaryManager.aiMemorySummarizer.updateSettings({
                    messageLevelSummary: enabled
                });
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理消息级别总结变化失败:', error);
        }
    }

    /**
     * 🚀 处理重要性阈值变化
     */
    handleAIImportanceThresholdChange(value) {
        try {
            console.log('[SummaryPanel] 🎯 重要性阈值变化:', value);

            // 更新显示值
            const valueDisplay = this.panel.querySelector('#ai-importance-value');
            if (valueDisplay) {
                valueDisplay.textContent = `${Math.round(value * 100)}%`;
            }

            // 更新AI记忆总结器设置
            if (this.summaryManager && this.summaryManager.aiMemorySummarizer) {
                this.summaryManager.aiMemorySummarizer.updateSettings({
                    importanceThreshold: parseFloat(value)
                });
            }

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理重要性阈值变化失败:', error);
        }
    }

    /**
     * 🚀 处理筛选标签点击
     */
    handleFilterTabClick(filter) {
        try {
            console.log('[SummaryPanel] 🔍 筛选标签点击:', filter);

            // 更新标签状态
            const filterTabs = this.panel.querySelectorAll('.filter-tab');
            filterTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filter === filter);
            });

            // 筛选总结历史
            this.filterSummaryHistory(filter);

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理筛选标签点击失败:', error);
        }
    }

    /**
     * 🚀 筛选总结历史
     */
    async filterSummaryHistory(filter) {
        try {
            console.log('[SummaryPanel] 🔍 筛选总结历史:', filter);

            if (!this.summaryManager) return;

            // 获取增强的总结历史
            const allSummaries = await this.summaryManager.getEnhancedSummaryHistory();

            // 根据筛选条件过滤
            let filteredSummaries = allSummaries;
            if (filter !== 'all') {
                filteredSummaries = allSummaries.filter(summary => {
                    // 根据不同的筛选条件进行过滤
                    switch (filter) {
                        case 'traditional':
                            return summary.source === 'traditional' || summary.type === 'small' || summary.type === 'large' || summary.type === 'manual' || summary.type === 'auto';
                        case 'ai_memory':
                            return summary.source === 'ai_memory_summarizer' || summary.type === 'ai_memory';
                        default:
                            return true;
                    }
                });
            }

            // 更新显示
            this.displaySummaryHistory(filteredSummaries);

        } catch (error) {
            console.error('[SummaryPanel] ❌ 筛选总结历史失败:', error);
        }
    }

    /**
     * 🚀 显示总结历史（支持筛选后的结果）
     */
    displaySummaryHistory(summaries) {
        try {
            console.log('[SummaryPanel] 📋 显示总结历史，共', summaries.length, '条记录');

            const historyList = this.panel.querySelector('#summary-history-list');
            if (!historyList) return;

            if (!summaries || summaries.length === 0) {
                historyList.innerHTML = '<div class="no-summaries">暂无符合条件的总结记录</div>';
                return;
            }

            // 按时间倒序排列
            const sortedSummaries = summaries.sort((a, b) => b.timestamp - a.timestamp);

            historyList.innerHTML = sortedSummaries.map(summary => `
                <div class="summary-item ${this.getSummaryItemClass(summary)}" data-summary-id="${summary.id}">
                    <div class="summary-item-header">
                        <div class="summary-item-title">${this.formatEnhancedSummaryTitle(summary)}</div>
                        <div class="summary-item-badge">${this.getSummaryTypeBadge(summary)}</div>
                    </div>
                    <div class="summary-item-date">${this.formatDate(summary.timestamp)}</div>
                    ${summary.preview ? `<div class="summary-item-preview">${summary.preview}</div>` : ''}
                </div>
            `).join('');

            // 绑定点击事件
            historyList.querySelectorAll('.summary-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const summaryId = e.currentTarget.getAttribute('data-summary-id');
                    this.showSummaryContent(summaryId);
                });
            });

        } catch (error) {
            console.error('[SummaryPanel] ❌ 显示总结历史失败:', error);
        }
    }

    /**
     * 🚀 获取总结项目的CSS类
     */
    getSummaryItemClass(summary) {
        const baseClass = 'summary-item';
        const sourceClass = summary.source === 'ai_memory_summarizer' ? 'ai-memory-item' : 'traditional-item';
        return `${baseClass} ${sourceClass}`;
    }

    /**
     * 🚀 格式化增强的总结标题
     */
    formatEnhancedSummaryTitle(summary) {
        // 如果是AI记忆总结
        if (summary.source === 'ai_memory_summarizer') {
            return summary.title || `AI记忆总结 (${summary.messageCount || 0}条消息)`;
        }

        // 传统总结
        const typeMap = {
            'small': '小总结',
            'large': '大总结',
            'manual': '手动总结',
            'auto': '自动总结'
        };

        const typeText = typeMap[summary.type] || '总结';
        const messageRange = summary.messageRange ?
            ` (${summary.messageRange.start}-${summary.messageRange.end})` : '';

        return `${typeText}${messageRange}`;
    }

    /**
     * 🚀 获取总结类型徽章
     */
    getSummaryTypeBadge(summary) {
        if (summary.source === 'ai_memory_summarizer') {
            return '<span class="badge ai-memory-badge">🧠 AI记忆</span>';
        } else {
            return '<span class="badge traditional-badge">📝 传统</span>';
        }
    }

    /**
     * 🚀 处理AI总结创建事件
     */
    handleAISummaryCreated(data) {
        try {
            console.log('[SummaryPanel] 🧠 AI总结创建事件:', data);

            this.showNotification('🧠 AI记忆总结已生成', 'success');

            // 刷新总结历史
            this.refreshSummaryHistory();

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理AI总结创建事件失败:', error);
        }
    }

    /**
     * 🚀 处理AI记忆总结器初始化事件
     */
    handleAIMemorySummarizerInitialized(data) {
        try {
            console.log('[SummaryPanel] 🧠 AI记忆总结器初始化完成:', data);

            // 加载AI记忆总结器的设置到UI
            this.loadAIMemorySettings();

        } catch (error) {
            console.error('[SummaryPanel] ❌ 处理AI记忆总结器初始化事件失败:', error);
        }
    }

    /**
     * 🚀 加载AI记忆设置到UI
     */
    async loadAIMemorySettings() {
        try {
            console.log('[SummaryPanel] 📥 加载AI记忆设置到UI...');

            if (!this.summaryManager || !this.summaryManager.aiMemorySummarizer) return;

            const aiMemorySummarizer = this.summaryManager.aiMemorySummarizer;
            const settings = aiMemorySummarizer.settings;

            // 设置AI记忆总结启用状态
            const aiMemoryEnabledCheckbox = this.panel.querySelector('#ai-memory-enabled');
            if (aiMemoryEnabledCheckbox) {
                aiMemoryEnabledCheckbox.checked = settings.enabled;
                this.handleAIMemoryEnabledChange(settings.enabled);
            }

            // 设置消息级别总结
            const aiMessageLevelCheckbox = this.panel.querySelector('#ai-message-level-summary');
            if (aiMessageLevelCheckbox) {
                aiMessageLevelCheckbox.checked = settings.messageLevelSummary;
            }

            // 设置重要性阈值
            const aiImportanceThreshold = this.panel.querySelector('#ai-importance-threshold');
            const aiImportanceValue = this.panel.querySelector('#ai-importance-value');
            if (aiImportanceThreshold && aiImportanceValue) {
                aiImportanceThreshold.value = settings.importanceThreshold;
                aiImportanceValue.textContent = `${Math.round(settings.importanceThreshold * 100)}%`;
            }

            console.log('[SummaryPanel] ✅ AI记忆设置加载完成');

        } catch (error) {
            console.error('[SummaryPanel] ❌ 加载AI记忆设置失败:', error);
        }
    }
}
