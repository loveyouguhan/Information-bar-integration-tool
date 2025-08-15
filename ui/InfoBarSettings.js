/**
 * 信息栏设置界面
 * 
 * 负责管理信息栏的设置界面：
 * - 基础设置面板
 * - API配置面板
 * - 主题设置面板
 * - 面板管理界面
 * - 设置导入导出功能
 * 
 * @class InfoBarSettings
 */

export class InfoBarSettings {
    constructor(configManager, apiIntegration, eventSystem) {
        console.log('[InfoBarSettings] 🔧 信息栏设置界面初始化开始');
        
        this.configManager = configManager;
        this.apiIntegration = apiIntegration;
        this.eventSystem = eventSystem;
        
        // UI元素引用
        this.container = null;
        this.modal = null;
        this.currentTab = 'basic';
        
        // 设置面板
        this.panels = {
            basic: null,
            api: null,
            theme: null,
            panels: null,
            advanced: null,
            personal: null,
            interaction: null,
            tasks: null,
            world: null,
            organization: null,
            news: null,
            inventory: null,
            abilities: null,
            plot: null,
            cultivation: null,
            fantasy: null,
            modern: null,
            historical: null,
            magic: null,
            training: null
        };
        
        // 表单数据
        this.formData = {};
        
        // 初始化状态
        this.initialized = false;
        this.visible = false;
        this.errorCount = 0;
        this.settingsLoaded = false;
        this.needsSettingsRefresh = false;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.createUI = this.createUI.bind(this);
        this.loadSettings = this.loadSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        
        // 绑定聊天切换事件监听器
        this.bindChatSwitchListener();
        
        // 🔧 新增：立即应用保存的日志级别设置，无需等待UI界面
        // 异步调用，不阻塞构造函数
        this.applyEarlyLogLevel().catch(error => {
            console.error('[InfoBarSettings] ❌ 早期日志级别设置异常:', error);
        });
    }

    /**
     * 🔧 新增：在扩展加载早期立即应用保存的日志级别设置
     * 无需等待UI界面加载，直接从配置中读取并应用
     */
    async applyEarlyLogLevel() {
        try {
            console.log('[InfoBarSettings] 🔧 开始应用早期日志级别设置...');
            
            // 使用 SillyTavern 标准存储机制读取配置
            const context = SillyTavern.getContext();
            if (!context || !context.extensionSettings) {
                console.log('[InfoBarSettings] ⚠️ SillyTavern上下文未就绪，跳过早期日志级别设置');
                return;
            }
            
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            
            // 读取调试配置
            const debugEnabled = configs.debug?.enabled || false;
            const logLevel = configs.debug?.logLevel || 'info';
            
            console.log('[InfoBarSettings] 📊 从配置读取日志设置:', { 
                enabled: debugEnabled, 
                level: logLevel 
            });
            
            // 立即应用日志级别
            const effectiveLevel = debugEnabled ? logLevel : 'none';
            this.applyConsoleLogLevel(effectiveLevel);
            
            console.log('[InfoBarSettings] ✅ 早期日志级别设置完成');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用早期日志级别失败:', error);
        }
    }

    /**
     * 绑定聊天切换事件监听器
     */
    bindChatSwitchListener() {
        try {
            if (this.eventSystem) {
                // 监听聊天切换事件，清理总结显示状态并刷新历史列表
                this.eventSystem.on('summary:chat:changed', (data) => {
                    if (data.action === 'chat_switched') {
                        console.log('[InfoBarSettings] 🔄 收到聊天切换事件，清理总结显示状态并刷新历史列表');
                        this.hideSummaryContent();
                        this.refreshSummaryHistoryOnChatSwitch();
                    }
                });
                
                console.log('[InfoBarSettings] ✅ 聊天切换事件监听器已绑定');
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 绑定聊天切换事件监听器失败:', error);
        }
    }

    /**
     * 聊天切换时刷新总结历史
     */
    async refreshSummaryHistoryOnChatSwitch() {
        try {
            console.log('[InfoBarSettings] 🔄 聊天切换，刷新总结历史列表');
            
            // 检查总结面板是否存在
            const summaryHistorySelect = this.modal?.querySelector('#content-summary-history-select');
            if (!summaryHistorySelect) {
                console.log('[InfoBarSettings] ℹ️ 总结历史选择框不存在，跳过刷新');
                return;
            }
            
            // 获取总结管理器
            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;
            
            if (!summaryManager) {
                console.warn('[InfoBarSettings] ⚠️ 总结管理器未找到');
                return;
            }
            
            // 获取当前聊天的总结历史
            const summaryHistory = await summaryManager.getSummaryHistory();
            
            // 重新渲染总结历史选择框
            this.renderSummaryHistory(summaryHistory);
            
            console.log('[InfoBarSettings] ✅ 总结历史列表已刷新，当前聊天总结数量:', summaryHistory.length);
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新总结历史失败:', error);
        }
    }

    /**
     * 打开错误日志窗口（仅临时显示，不持久化）
     */
    openErrorLogModal() {
        try {
            const modal = document.createElement('div');
            modal.className = 'error-log-modal';
            modal.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 600px; max-height: 500px; background: #1a1a1a; border: 2px solid #333;
                border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 20000;
                color: #e0e0e0; font-family: monospace;
            `;
            
            modal.innerHTML = `
                <div class="error-log-header" style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: #ff6b6b;">📋 程序日志</h4>
                        <div style="margin-top: 5px;">
                            <label style="margin-right: 10px; font-size: 12px;">过滤级别:</label>
                            <select id="log-level-filter" style="background: #333; color: #e0e0e0; border: 1px solid #555; padding: 2px 5px;">
                                <option value="all">全部</option>
                                <option value="error">错误</option>
                                <option value="warn">警告</option>
                                <option value="info">信息</option>
                                <option value="debug">调试</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn btn-small" data-action="close-error-log" style="background: #ff6b6b; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">关闭</button>
                </div>
                <div class="error-log-body" style="padding: 15px; max-height: 350px; overflow: auto;">
                    <pre id="error-log-content" style="white-space: pre-wrap; margin: 0; font-size: 12px; line-height: 1.4;"></pre>
                </div>
            `;
            document.body.appendChild(modal);

            const updateLogs = () => {
                const filter = modal.querySelector('#log-level-filter').value;
                const logs = (window.SillyTavernInfobar?.runtimeLogs || [])
                    .filter(item => filter === 'all' || item.level === filter)
                    .map(item => {
                        const time = new Date(item.time).toLocaleString();
                        const levelIcon = {
                            error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔧'
                        }[item.level] || '📝';
                        return `[${time}] ${levelIcon} ${item.message}`;
                    })
                    .join('\n');
                modal.querySelector('#error-log-content').textContent = logs || '暂无日志记录';
            };

            // 初始加载
            updateLogs();

            // 绑定过滤器变化
            modal.querySelector('#log-level-filter').addEventListener('change', updateLogs);

            // 绑定关闭事件
            modal.querySelector('[data-action="close-error-log"]').onclick = () => {
                if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
            };
        } catch (error) {
            const original = window.__InfobarConsoleOriginal;
            if (original) {
                original.error('[InfoBarSettings] ❌ 打开错误日志窗口失败:', error);
            }
        }
    }

    /**
     * 打开项目地址
     */
    openProjectLink() {
        try {
            window.open('https://github.com/loveyouguhan/Information-bar-integration-tool.git', '_blank');
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 打开项目地址失败:', error);
        }
    }

    /**
     * 应用控制台日志级别过滤
     * level: 'none' | 'error' | 'warn' | 'info' | 'debug'
     */
    applyConsoleLogLevel(level) {
        try {
            // 使用全局门禁系统
            const original = window.__InfobarConsoleOriginal;
            if (!original) {
                console.warn('[InfoBarSettings] ⚠️ 控制台门禁未初始化');
                return;
            }

            const rt = window.SillyTavernInfobar.runtimeLogs;
            const push = (logLevel, args) => {
                try {
                    const message = Array.from(args).map(v => 
                        typeof v === 'string' ? v : 
                        typeof v === 'object' ? JSON.stringify(v) : String(v)
                    ).join(' ');
                    rt.push({ level: logLevel, time: Date.now(), message });
                    if (rt.length > 500) rt.shift();
                } catch {}
            };

            // 根据级别设置过滤器
            const allows = {
                none: { error: false, warn: false, info: false, debug: false },
                error: { error: true, warn: false, info: false, debug: false },
                warn: { error: true, warn: true, info: false, debug: false },
                info: { error: true, warn: true, info: true, debug: false },
                debug: { error: true, warn: true, info: true, debug: true }
            }[level] || { error: true, warn: true, info: true, debug: true };

            // 重新绑定console方法：既收集又按级别输出
            console.log = (...args) => { 
                push('debug', args); 
                if (allows.debug) original.log(...args); 
            };
            console.info = (...args) => { 
                push('info', args); 
                if (allows.info) original.info(...args); 
            };
            console.warn = (...args) => { 
                push('warn', args); 
                if (allows.warn) original.warn(...args); 
            };
            console.error = (...args) => { 
                push('error', args); 
                if (allows.error) original.error(...args); 
            };

            // 使用原生console输出设置确认
            if (level !== 'none') {
                original.info('[InfoBarSettings] 📊 日志级别已设置为:', level);
            }
        } catch (error) {
            const original = window.__InfobarConsoleOriginal;
            if (original) {
                original.error('[InfoBarSettings] ❌ 设置日志级别失败:', error);
            }
        }
    }

    /**
     * 保存当前配置为命名配置
     */
    async saveSettingsProfile() {
        try {
            const nameInput = this.modal.querySelector('#config-profile-name');
            const name = (nameInput?.value || '').trim();
            if (!name) { this.showMessage('请输入配置名称', 'error'); return; }
            const configs = await this.configManager.getAllConfigs();
            const profiles = (await this.configManager.getConfig('profiles')) || {};
            profiles[name] = configs;
            await this.configManager.setConfig('profiles', profiles, false);
            this.showMessage(`已保存配置: ${name}`, 'success');
            this.refreshProfilesSelect();
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存配置失败:', error);
            this.showMessage('保存配置失败: ' + error.message, 'error');
        }
    }

    async loadSettingsProfile() {
        try {
            const select = this.modal.querySelector('#config-profile-select');
            const name = select?.value;
            if (!name) { this.showMessage('请选择要加载的配置', 'error'); return; }
            const profiles = (await this.configManager.getConfig('profiles')) || {};
            const profile = profiles[name];
            if (!profile) { this.showMessage('未找到配置: ' + name, 'error'); return; }
            await this.configManager.setConfigs(profile);
            await this.loadSettings();
            this.showMessage(`已加载配置: ${name}`, 'success');
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载配置失败:', error);
            this.showMessage('加载配置失败: ' + error.message, 'error');
        }
    }

    async deleteSettingsProfile() {
        try {
            const select = this.modal.querySelector('#config-profile-select');
            const name = select?.value;
            if (!name) { this.showMessage('请选择要删除的配置', 'error'); return; }
            const profiles = (await this.configManager.getConfig('profiles')) || {};
            if (!profiles[name]) { this.showMessage('未找到配置: ' + name, 'error'); return; }
            delete profiles[name];
            await this.configManager.setConfig('profiles', profiles, false);
            this.showMessage(`已删除配置: ${name}`, 'success');
            this.refreshProfilesSelect();
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 删除配置失败:', error);
            this.showMessage('删除配置失败: ' + error.message, 'error');
        }
    }

    async refreshProfilesSelect() {
        try {
            const select = this.modal.querySelector('#config-profile-select');
            if (!select) return;
            const profiles = (await this.configManager.getConfig('profiles')) || {};
            const current = select.value;
            select.innerHTML = '<option value="">请选择一个配置</option>' + Object.keys(profiles).map(name => `<option value="${name}">${name}</option>`).join('');
            if (profiles[current]) select.value = current;
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新配置列表失败:', error);
        }
    }
    /**
     * 初始化设置界面
     */
    async init() {
        try {
            console.log('[InfoBarSettings] 📊 开始初始化设置界面...');
            
            if (!this.configManager) {
                throw new Error('配置管理器未初始化');
            }
            
            // 创建UI
            this.createUI();
            
            // 🔧 迁移时间戳ID面板到键名ID（确保设计一致性）
            this.migrateTimestampIdPanels();

            // 加载当前设置
            await this.loadSettings();

            // 注意：事件绑定已在createUI()中的bindNewEvents()完成，避免重复绑定
            
            this.initialized = true;
            console.log('[InfoBarSettings] ✅ 设置界面初始化完成');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 创建UI界面
     */
    createUI() {
        try {
            // 创建模态框容器
            this.modal = document.createElement('div');
            this.modal.id = 'info-bar-settings-modal';
            this.modal.className = 'info-bar-settings-modal infobar-modal-new';
            this.modal.style.display = 'none';
            
            this.modal.innerHTML = `
                <div class="modal-overlay" onclick="this.closest('.info-bar-settings-modal').style.display='none'"></div>
                <div class="modal-container">
                    <!-- 顶部标题栏 -->
                    <div class="modal-header">
                        <div class="header-left">
                            <h2>信息栏设置</h2>
                        </div>
                        <div class="header-right">
                            <div class="success-notification" style="display: block;">
                                <span class="success-text">信息栏系统已成功加载！</span>
                            </div>
                            <button class="modal-close" onclick="this.closest('.info-bar-settings-modal').style.display='none'">×</button>
                        </div>
                    </div>

                    <!-- 主体内容区域 -->
                    <div class="modal-body">
                        <!-- 左侧导航栏 -->
                        <div class="sidebar-nav">
                            <div class="nav-item active" data-nav="basic">
                                基础设置
                            </div>
                            <div class="nav-item" data-nav="api">
                                自定义API
                            </div>
                            <div class="nav-item" data-nav="panelManagement">
                                面板管理
                            </div>
                            <div class="nav-item" data-nav="summary">
                                总结面板
                            </div>
                            <div class="nav-item" data-nav="personal">
                                个人信息
                            </div>
                            <div class="nav-item" data-nav="interaction">
                                交互对象
                            </div>
                            <div class="nav-item" data-nav="tasks">
                                任务系统
                            </div>
                            <div class="nav-item" data-nav="world">
                                世界信息
                            </div>
                            <div class="nav-item" data-nav="organization">
                                组织信息
                            </div>
                            <div class="nav-item" data-nav="news">
                                资讯内容
                            </div>
                            <div class="nav-item" data-nav="inventory">
                                背包仓库
                            </div>
                            <div class="nav-item" data-nav="abilities">
                                能力系统
                            </div>
                            <div class="nav-item" data-nav="plot">
                                剧情面板
                            </div>
                            <div class="nav-item" data-nav="cultivation">
                                修仙世界
                            </div>
                            <div class="nav-item" data-nav="fantasy">
                                玄幻世界
                            </div>
                            <div class="nav-item" data-nav="modern">
                                都市现代
                            </div>
                            <div class="nav-item" data-nav="historical">
                                历史古代
                            </div>
                            <div class="nav-item" data-nav="magic">
                                魔法能力
                            </div>
                            <div class="nav-item" data-nav="training">
                                调教系统
                            </div>
                            <div class="nav-item" data-nav="theme">
                                主题设置
                            </div>
                            <div class="nav-item" data-nav="frontend-display">
                                前端显示
                            </div>
                            <div class="nav-item" data-nav="advanced">
                                高级设置
                            </div>

                            <!-- 底部操作按钮 -->
                            <div class="nav-bottom">
                                <button class="btn-reset" data-action="reset">恢复所有设置</button>
                            </div>
                        </div>

                        <!-- 右侧内容区域 -->
                        <div class="content-area">
                            <div class="content-panel active" data-content="basic">
                                ${this.createBasicPanelNew()}
                            </div>
                            <div class="content-panel" data-content="api">
                                ${this.createAPIPanel()}
                            </div>
                            <div class="content-panel" data-content="panelManagement">
                                ${this.createPanelManagementPanel()}
                            </div>
                            <div class="content-panel" data-content="summary">
                                ${this.createSummaryPanel()}
                            </div>
                            <div class="content-panel" data-content="personal">
                                ${this.createPersonalPanel()}
                            </div>
                            <div class="content-panel" data-content="interaction">
                                ${this.createInteractionPanel()}
                            </div>
                            <div class="content-panel" data-content="tasks">
                                ${this.createTasksPanel()}
                            </div>
                            <div class="content-panel" data-content="world">
                                ${this.createWorldPanel()}
                            </div>
                            <div class="content-panel" data-content="organization">
                                ${this.createOrganizationPanel()}
                            </div>
                            <div class="content-panel" data-content="news">
                                ${this.createNewsPanel()}
                            </div>
                            <div class="content-panel" data-content="inventory">
                                ${this.createInventoryPanel()}
                            </div>
                            <div class="content-panel" data-content="abilities">
                                ${this.createAbilitiesPanel()}
                            </div>
                            <div class="content-panel" data-content="plot">
                                ${this.createPlotPanel()}
                            </div>
                            <div class="content-panel" data-content="cultivation">
                                ${this.createCultivationPanel()}
                            </div>
                            <div class="content-panel" data-content="fantasy">
                                ${this.createFantasyPanel()}
                            </div>
                            <div class="content-panel" data-content="modern">
                                ${this.createModernPanel()}
                            </div>
                            <div class="content-panel" data-content="historical">
                                ${this.createHistoricalPanel()}
                            </div>
                            <div class="content-panel" data-content="magic">
                                ${this.createMagicPanel()}
                            </div>
                            <div class="content-panel" data-content="training">
                                ${this.createTrainingPanel()}
                            </div>
                            <div class="content-panel" data-content="theme">
                                ${this.createThemePanel()}
                            </div>
                            <div class="content-panel" data-content="frontend-display">
                                ${this.createFrontendDisplayPanel()}
                            </div>
                            <div class="content-panel" data-content="advanced">
                                ${this.createAdvancedPanel()}
                            </div>
                        </div>
                    </div>

                    <!-- 底部操作栏 -->
                    <div class="modal-footer">
                        <div class="footer-left">
                            <span class="status-text">就绪</span>
                        </div>
                        <div class="footer-right">
                            <button class="btn-cancel" data-action="close">取消</button>
                            <button class="btn-save" data-action="save">保存设置</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到页面
            document.body.appendChild(this.modal);

            // 绑定新的事件
            this.bindNewEvents();

            console.log('[InfoBarSettings] 🎨 新UI界面创建完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 创建UI失败:', error);
            throw error;
        }
    }
    /**
     * 创建新的基础设置面板 - 垂直布局
     */
    createBasicPanelNew() {
        return `
            <div class="content-header">
                <h3>基础功能配置</h3>
            </div>

            <div class="content-body">


                <!-- 垂直布局的功能配置 -->
                <div class="basic-settings-vertical">
                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="integration-system-checkbox" name="basic.integrationSystem.enabled" checked />
                            <label for="integration-system-checkbox" class="checkbox-label">启用集成系统</label>
                        </div>
                        <div class="setting-desc">启用信息栏与SillyTavern的深度集成</div>
                    </div>

                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="render-in-chat-checkbox" name="basic.renderInChat.enabled" checked />
                            <label for="render-in-chat-checkbox" class="checkbox-label">在聊天中渲染信息栏</label>
                        </div>
                        <div class="setting-desc">在聊天界面中显示信息栏内容</div>
                    </div>

                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="table-records-checkbox" name="basic.tableRecords.enabled" />
                            <label for="table-records-checkbox" class="checkbox-label">启用表格记录</label>
                        </div>
                        <div class="setting-desc">启用数据表格记录和管理功能</div>
                    </div>

                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="memory-assist-checkbox" name="basic.memoryAssist.enabled" checked />
                            <label for="memory-assist-checkbox" class="checkbox-label">启用记忆辅助</label>
                        </div>
                        <div class="setting-desc">AI记忆辅助和上下文管理</div>
                    </div>

                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="default-collapsed-checkbox" name="basic.defaultCollapsed.enabled" />
                            <label for="default-collapsed-checkbox" class="checkbox-label">信息栏默认折叠</label>
                        </div>
                        <div class="setting-desc">启动时信息栏默认为折叠状态</div>
                    </div>

                    <div class="setting-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="error-logging-checkbox" name="basic.errorLogging.enabled" checked />
                            <label for="error-logging-checkbox" class="checkbox-label">错误日志</label>
                        </div>
                        <div class="setting-desc">启用详细的错误日志记录</div>
                    </div>
                </div>
            </div>
        `;
        // 追加轻量样式，确保选择框与删除按钮同排且不遮挡
        const style = document.createElement('style');
        style.id = 'info-bar-settings-summary-inline-style';
        if (!document.getElementById(style.id)) {
            style.textContent = `
                .history-selector-group .history-select-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .history-selector-group .summary-history-select {
                    flex: 1 1 auto;
                    min-width: 0;
                    max-width: calc(100% - 90px);
                }
                #content-delete-summary-btn {
                    flex: 0 0 auto;
                    white-space: nowrap;
                }
                /* 调试与配置行布局优化 */
                .debug-actions-row { display: flex; gap: 8px; }
                .config-primary-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                .config-row { display: flex; align-items: center; gap: 8px; }
                .config-row .setting-select { flex: 1 1 auto; min-width: 0; }
                .config-row-actions { display: flex; gap: 6px; }

                /* 数据管理功能区域样式 */
                .data-management-actions {
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 12px !important;
                    margin-top: 8px !important;
                    width: 100% !important;
                }
                .data-export-btn, .data-import-btn {
                    flex: 1 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    padding: 10px 16px !important;
                    border: none !important;
                    border-radius: 6px !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    min-height: 40px !important;
                    white-space: nowrap !important;
                }
                .data-export-btn {
                    background: var(--theme-primary-color, #ff6b35) !important;
                    color: white !important;
                }
                .data-export-btn:hover {
                    background: var(--theme-primary-hover, #e55a2b) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
                }
                .data-import-btn {
                    background: var(--theme-bg-secondary, #4a5568) !important;
                    color: white !important;
                    border: 1px solid var(--theme-border-color, #666) !important;
                }
                .data-import-btn:hover {
                    background: var(--theme-primary-color, #ff6b35) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2) !important;
                }
                .data-management-hint {
                    color: var(--theme-text-secondary, #a0a0a0) !important;
                    font-size: 13px !important;
                    line-height: 1.4 !important;
                    margin-top: 8px !important;
                    padding: 8px 12px !important;
                    background: var(--theme-bg-secondary, rgba(107, 114, 128, 0.1)) !important;
                    border-radius: 4px !important;
                    border-left: 3px solid var(--theme-primary-color, #ff6b35) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 绑定新的事件处理
     */
    bindNewEvents() {
        try {
            // 导航切换事件
            this.modal.addEventListener('click', (e) => {
                if (e.target.closest('.nav-item')) {
                    const navItem = e.target.closest('.nav-item');
                    const navType = navItem.dataset.nav;
                    this.switchToContent(navType);
                }
            });

            // 按钮点击事件  
            this.modal.addEventListener('click', (e) => {
                // 🔧 修复：使用closest查找具有data-action属性的父元素，解决按钮内子元素点击问题
                const actionElement = e.target.closest('[data-action]');
                const action = actionElement?.dataset?.action;
                if (action) {
                    this.handleAction(action, e);
                }

                // API配置相关按钮
                if (e.target.id === 'load-models-btn') {
                    this.loadModelList();
                }
                if (e.target.id === 'test-connection-btn') {
                    this.testConnection();
                }

                // 主题预览卡片点击事件
                const themeCard = e.target.closest('.theme-preview-card');
                if (themeCard) {
                    const themeId = themeCard.dataset.theme;
                    if (themeId) {
                        this.selectTheme(themeId);
                    }
                }

                // 信息栏风格预览卡片点击事件
                const styleCard = e.target.closest('.style-preview-card');
                if (styleCard) {
                    const styleId = styleCard.dataset.style;
                    if (styleId) {
                        this.selectStyle(styleId);
                    }
                }

                // 面板管理相关事件
                this.handlePanelManagementEvents(e);

                // 前端显示相关事件
                this.handleFrontendDisplayEvents(e);
            });

            // 下拉框变更事件
            this.modal.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    this.handleCheckboxChange(e);
                }

                // 前端显示设置变更
                if (e.target.name && e.target.name.startsWith('frontendDisplay.')) {
                    this.handleFrontendDisplayChange(e);
                }

                // API启用开关变更
                if (e.target.id === 'api-enabled') {
                    this.handleAPIEnabledChange(e.target.checked);
                }

                // API提供商变更
                if (e.target.id === 'api-provider') {
                    this.handleProviderChange(e.target.value);
                }

                // 接口类型变更
                if (e.target.id === 'interface-type') {
                    this.handleInterfaceTypeChange(e.target.value);
                }

                // 字体大小和信息栏高度关联
                if (e.target.name === 'theme.fontSize') {
                    this.handleFontSizeChange(e.target.value);
                }
                if (e.target.name === 'infobar.height') {
                    this.handleInfobarHeightChange(e.target.value);
                }
            });

            // 范围输入实时更新
            this.modal.addEventListener('input', (e) => {
                if (e.target.type === 'range') {
                    const valueSpan = e.target.nextElementSibling;
                    if (valueSpan && valueSpan.classList.contains('range-value')) {
                        valueSpan.textContent = e.target.value;
                    }
                }
            });

            console.log('[InfoBarSettings] 🔗 新事件绑定完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 绑定新事件失败:', error);
            throw error;
        }
    }

    /**
     * 处理面板管理相关事件
     */
    handlePanelManagementEvents(e) {
        try {
            // 面板分类标签切换（简化：只有全部面板，无需切换）
            const categoryTab = e.target.closest('.category-tab');
            if (categoryTab) {
                // 只有全部面板分类，无需切换逻辑
                return;
            }

            // 面板列表项选择
            const panelListItem = e.target.closest('.panel-list-item');
            if (panelListItem) {
                const panelId = panelListItem.dataset.panelId;
                const panelType = panelListItem.dataset.panelType;
                this.selectPanelForEdit(panelId, panelType);
                return;
            }

            // 面板管理按钮事件
            const action = e.target.dataset.action;
            const panelId = e.target.dataset.panelId;

            switch (action) {
                case 'add-custom-panel':
                    this.addCustomPanel();
                    break;
                case 'refresh-panels':
                    this.refreshPanelList();
                    break;
                case 'edit-panel':
                    this.editPanel(panelId);
                    break;
                case 'view-panel':
                    this.viewPanel(panelId);
                    break;
                case 'duplicate-panel':
                    this.duplicatePanel(panelId);
                    break;
                case 'toggle-panel':
                    this.togglePanel(panelId);
                    break;
                case 'save-panel-properties':
                    this.savePanelProperties();
                    break;
                case 'delete-panel':
                    this.deletePanel();
                    break;
                case 'add-sub-item':
                    this.addSubItem();
                    break;
                case 'remove-sub-item':
                    this.removeSubItem(event?.target?.closest('[data-action="remove-sub-item"]') || event?.target);
                    break;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理面板管理事件失败:', error);
        }
    }

    /**
     * 处理前端显示相关事件
     */
    handleFrontendDisplayEvents(e) {
        try {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'test-panel-popup':
                    this.testPanelPopup();
                    break;
                case 'test-add-panel':
                    // 移除预览示例入口：转为真正调用 FrontendDisplayManager 的添加逻辑
                    try {
                        const infoBarTool = window.SillyTavernInfobar;
                        const fdm = infoBarTool?.modules?.frontendDisplayManager;
                        if (fdm) {
                            // 模拟在当前最后一条AI消息上打开添加菜单
                            const lastAi = [...document.querySelectorAll('.mes[data-is-user="false"]')].pop();
                            if (lastAi) {
                                fdm.wrapAIMessage(lastAi);
                                const wrapper = fdm.wrappers.get(lastAi.id);
                                const anySlot = wrapper?.querySelector('.add-slot') || wrapper;
                                fdm.showAddPanelMenu('top-1', anySlot, lastAi);
                            }
                        }
                    } catch (_) {}
                    break;
                case 'clear-preview':
                    this.clearPreviewContent();
                    break;
            }

            // 处理添加槽位点击
            const addSlot = e.target.closest('.add-slot');
            if (addSlot) {
                const position = addSlot.dataset.position;
                this.showAddPanelMenu(position, addSlot);
                return;
            }

            // 处理演示面板按钮点击
            const panelButton = e.target.closest('.panel-button.demo');
            if (panelButton) {
                const panelType = panelButton.dataset.panel;
                this.showDemoPanelPopup(panelType);
                return;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理前端显示事件失败:', error);
        }
    }

    /**
     * 处理前端显示设置变更
     */
    handleFrontendDisplayChange(e) {
        try {
            const name = e.target.name;
            const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
            
            console.log(`[InfoBarSettings] 🖥️ 前端显示设置变更: ${name} = ${value}`);
            
            // 根据设置名称处理不同的变更
            switch (name) {
                case 'frontendDisplay.enabled':
                    this.toggleFrontendDisplaySections(value);
                    this.enableFrontendDisplay(value);
                    break;
                case 'frontendDisplay.position':
                    this.updatePreviewPosition(value);
                    break;
                case 'frontendDisplay.style':
                    this.updatePreviewStyle(value);
                    break;
                case 'frontendDisplay.showAddButtons':
                    this.toggleAddButtons(value);
                    break;
                case 'frontendDisplay.animationEnabled':
                    this.toggleAnimations(value);
                    break;
                default:
                    console.log(`[InfoBarSettings] 📝 保存前端显示设置: ${name}`);
                    break;
            }

            // 保存设置到配置中
            this.saveFrontendDisplaySetting(name, value);
            
            // 更新前端显示管理器的设置
            this.updateFrontendDisplayManagerSettings();

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理前端显示设置变更失败:', error);
        }
    }

    /**
     * 保存前端显示设置到配置中
     */
    async saveFrontendDisplaySetting(name, value) {
        try {
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (!fdm) {
                console.error('[InfoBarSettings] ❌ 未找到前端显示管理器');
                return;
            }

            // 读取当前配置
            const currentConfig = await fdm.getSavedFrontendDisplayConfig();
            
            // 更新对应的设置项
            const settingKey = name.replace('frontendDisplay.', '');
            currentConfig[settingKey] = value;
            
            // 保存配置
            await fdm.saveFrontendDisplayConfig(currentConfig);
            
            console.log(`[InfoBarSettings] 💾 已保存前端显示设置: ${settingKey} = ${value}`);
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存前端显示设置失败:', error);
        }
    }

    /**
     * 启用/禁用前端显示功能
     */
    enableFrontendDisplay(enabled) {
        try {
            console.log(`[InfoBarSettings] 🔄 ${enabled ? '启用' : '禁用'}前端显示功能`);

            // 获取前端显示管理器
            const infoBarTool = window.SillyTavernInfobar;
            const frontendDisplayManager = infoBarTool?.modules?.frontendDisplayManager;

            if (frontendDisplayManager) {
                frontendDisplayManager.setEnabled(enabled);
                console.log(`[InfoBarSettings] ✅ 前端显示功能${enabled ? '已启用' : '已禁用'}`);
                
                // 如果禁用，还需要恢复原有信息栏渲染
                if (!enabled) {
                    this.restoreOriginalInfoBarRendering();
                } else {
                    this.disableOriginalInfoBarRendering();
                }
            } else {
                console.error('[InfoBarSettings] ❌ 未找到前端显示管理器');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 启用/禁用前端显示功能失败:', error);
        }
    }

    /**
     * 更新前端显示管理器设置
     */
    updateFrontendDisplayManagerSettings() {
        try {
            const infoBarTool = window.SillyTavernInfobar;
            const frontendDisplayManager = infoBarTool?.modules?.frontendDisplayManager;

            if (frontendDisplayManager) {
                // 收集当前设置
                const settings = this.collectFrontendDisplaySettings();
                frontendDisplayManager.updateSettings(settings);
                console.log('[InfoBarSettings] ⚙️ 前端显示设置已更新');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新前端显示管理器设置失败:', error);
        }
    }

    /**
     * 收集前端显示设置
     */
    collectFrontendDisplaySettings() {
        const settings = {};
        
        try {
            const modal = this.modal;
            if (modal) {
                const inputs = modal.querySelectorAll('[name^="frontendDisplay."]');
                inputs.forEach(input => {
                    const key = input.name.replace('frontendDisplay.', '');
                    settings[key] = input.type === 'checkbox' ? input.checked : input.value;
                });
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 收集前端显示设置失败:', error);
        }

        return settings;
    }

    /**
     * 禁用原有信息栏渲染
     */
    disableOriginalInfoBarRendering() {
        try {
            console.log('[InfoBarSettings] 🚫 禁用原有信息栏渲染');
            
            const infoBarTool = window.SillyTavernInfobar;
            const messageInfoBarRenderer = infoBarTool?.modules?.messageInfoBarRenderer;
            
            if (messageInfoBarRenderer) {
                // 临时禁用信息栏渲染器
                messageInfoBarRenderer.frontendDisplayMode = true;
                console.log('[InfoBarSettings] ✅ 原有信息栏渲染已禁用');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 禁用原有信息栏渲染失败:', error);
        }
    }

    /**
     * 恢复原有信息栏渲染
     */
    restoreOriginalInfoBarRendering() {
        try {
            console.log('[InfoBarSettings] 🔄 恢复原有信息栏渲染');
            
            const infoBarTool = window.SillyTavernInfobar;
            const messageInfoBarRenderer = infoBarTool?.modules?.messageInfoBarRenderer;
            
            if (messageInfoBarRenderer) {
                messageInfoBarRenderer.frontendDisplayMode = false;
                console.log('[InfoBarSettings] ✅ 原有信息栏渲染已恢复');
            }

            // 显示被隐藏的信息栏
            const hiddenInfoBars = document.querySelectorAll('.message-infobar[style*="display: none"], .infobar-panel[style*="display: none"]');
            hiddenInfoBars.forEach(infoBar => {
                infoBar.style.display = '';
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 恢复原有信息栏渲染失败:', error);
        }
    }

    /**
     * 切换前端显示相关设置区域的显示状态
     */
    toggleFrontendDisplaySections(enabled) {
        try {
            const configSection = this.modal.querySelector('.frontend-display-config');
            const previewSection = this.modal.querySelector('.frontend-display-preview');
            const advancedSection = this.modal.querySelector('.frontend-display-advanced');

            if (configSection) {
                configSection.style.display = enabled ? 'block' : 'none';
            }
            if (previewSection) {
                previewSection.style.display = enabled ? 'block' : 'none';
            }
            if (advancedSection) {
                advancedSection.style.display = enabled ? 'block' : 'none';
            }

            console.log(`[InfoBarSettings] 🖥️ 前端显示区域切换: ${enabled ? '显示' : '隐藏'}`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换前端显示区域失败:', error);
        }
    }

    /**
     * 测试面板弹窗
     */
    testPanelPopup() {
        try {
            console.log('[InfoBarSettings] 🧪 测试面板弹窗');
            
            // 创建模拟的面板弹窗
            const popup = document.createElement('div');
            popup.className = 'demo-panel-popup';
            popup.style.setProperty('position', 'fixed', 'important');
            popup.style.setProperty('top', '0', 'important');
            popup.style.setProperty('left', '0', 'important');
            popup.style.setProperty('right', '0', 'important');
            popup.style.setProperty('bottom', '0', 'important');
            popup.style.setProperty('width', '100vw', 'important');
            popup.style.setProperty('height', '100vh', 'important');
            popup.style.setProperty('display', 'flex', 'important');
            popup.style.setProperty('align-items', 'center', 'important');
            popup.style.setProperty('justify-content', 'center', 'important');
            popup.style.setProperty('z-index', '10000', 'important');
            popup.style.setProperty('background', 'rgba(0,0,0,0.5)', 'important');
            
            popup.innerHTML = `
                <div class="demo-popup-content" style="
                    background: var(--theme-bg-primary, #2a2a2a);
                    color: var(--theme-text-primary, #ffffff);
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                    border-radius: 12px;
                    padding: 0;
                    min-width: 300px;
                    max-width: 90vw;
                    min-height: 200px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    position: relative;
                    margin: 0;
                ">
                    <div class="demo-popup-header">
                        <h3>👤 个人信息</h3>
                        <button class="demo-close-btn">×</button>
                    </div>
                    <div class="demo-popup-body">
                        <div class="demo-field">
                            <span class="field-label">姓名:</span>
                            <span class="field-value">张三</span>
                        </div>
                        <div class="demo-field">
                            <span class="field-label">年龄:</span>
                            <span class="field-value">25</span>
                        </div>
                        <div class="demo-field">
                            <span class="field-label">职业:</span>
                            <span class="field-value">程序员</span>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(popup);
            
            // 3秒后自动关闭
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 3000);
            
            // 点击关闭按钮
            popup.querySelector('.demo-close-btn').addEventListener('click', () => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 测试面板弹窗失败:', error);
        }
    }

    /**
     * 测试添加面板
     */
    testAddPanel() {
        try {
            console.log('[InfoBarSettings] 🧪 测试添加面板');
            
            // 创建添加面板的选择菜单
            const menu = document.createElement('div');
            menu.className = 'demo-add-panel-menu';
            menu.innerHTML = `
                <div class="demo-menu-content">
                    <div class="menu-header">
                        <h3>添加到${area === 'top' ? '顶部' : '底部'}区域</h3>
                        <button class="menu-close-btn">&times;</button>
                    </div>
                    <div class="menu-body">
                        <div class="menu-layout">
                            <!-- 左侧面板导航 -->
                            <div class="panel-navigation">
                                <h4>📋 启用的面板 (${Object.keys(enabledPanels).length})</h4>
                                <div class="panel-list">
                                    ${panelListHtml}
                                </div>
                            </div>
                            
                            <!-- 右侧子项列表 -->
                            <div class="subitem-list">
                                ${subitemListHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 定位菜单（移动端全屏遮罩，桌面端居中）
            const isMobile = window.innerWidth <= 768;
            menu.style.position = 'fixed';
            menu.style.zIndex = '10000';
            if (isMobile) {
                // 全屏遮罩
                menu.style.left = '0';
                menu.style.top = '0';
                menu.style.width = '100vw';
                menu.style.height = '100vh';
                menu.style.background = 'rgba(0, 0, 0, 0.5)';
                menu.style.backdropFilter = 'blur(4px)';
                menu.style.display = 'flex';
                menu.style.alignItems = 'center';
                menu.style.justifyContent = 'center';

                // 内容容器限制尺寸并居中
                const menuContent = menu.querySelector('.demo-menu-content');
                if (menuContent) {
                    menuContent.style.width = '90vw';
                    menuContent.style.maxWidth = '360px';
                    menuContent.style.maxHeight = '80vh';
                    menuContent.style.overflow = 'auto';
                    menuContent.style.borderRadius = '12px';
                }
            } else {
                // 桌面居中
                menu.style.left = '50%';
                menu.style.top = '50%';
                menu.style.transform = 'translate(-50%, -50%)';
            }

            // 添加到页面
            document.body.appendChild(menu);

            // 点击遮罩关闭（仅移动端全屏时）
            if (isMobile) {
                menu.addEventListener('click', (evt) => {
                    const content = menu.querySelector('.demo-menu-content');
                    if (content && !content.contains(evt.target)) {
                        menu.remove();
                    }
                });
            }

            // 绑定关闭按钮
            const closeBtn = menu.querySelector('.menu-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    menu.remove();
                });
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 测试添加面板失败:', error);
        }
    }
    /**
     * 切换面板分类（简化版：只有全部面板）
     */
    switchPanelCategory(category) {
        try {
            // 简化：只有全部面板分类，无需切换逻辑
            console.log(`[InfoBarSettings] 📑 面板分类已简化，只显示全部面板`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换面板分类失败:', error);
        }
    }

    /**
     * 选择面板进行编辑
     */
    selectPanelForEdit(panelId, panelType) {
        try {
            // 🔧 修复：切换面板前自动保存当前正在编辑的面板，避免勾选状态丢失
            if (this.currentEditingPanel && this.modal?.querySelector('.panel-properties-form')) {
                try {
                    // 仅在表单可见时尝试保存，且不打断用户
                    const propertiesForm = this.modal.querySelector('.panel-properties-form');
                    if (propertiesForm && propertiesForm.style.display !== 'none') {
                        this.savePanelProperties();
                    }
                } catch (e) {
                    console.warn('[InfoBarSettings] ⚠️ 自动保存当前面板失败，将继续切换:', e);
                }
            }
            // 更新面板列表项选中状态
            this.modal.querySelectorAll('.panel-list-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.panelId === panelId);
            });

            // 显示面板属性表单
            this.showPanelProperties(panelId, panelType);

            console.log(`[InfoBarSettings] 📝 选择面板进行编辑: ${panelId} (${panelType})`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 选择面板失败:', error);
        }
    }

    /**
     * 显示面板属性
     */
    showPanelProperties(panelId, panelType) {
        try {
            const noSelectionMessage = this.modal.querySelector('.no-selection-message');
            const propertiesForm = this.modal.querySelector('.panel-properties-form');
            const saveBtn = this.modal.querySelector('[data-action="save-panel-properties"]');
            const deleteBtn = this.modal.querySelector('[data-action="delete-panel"]');

            // 🔧 修复：在显示面板属性前，预防性清理子项容器，防止UI污染
            const container = this.modal.querySelector('.sub-items-container');
            if (container) {
                container.querySelectorAll('.sub-item-form').forEach(item => item.remove());
                console.log(`[InfoBarSettings] 🧹 预防性清理子项容器，准备显示面板: ${panelId} (${panelType})`);
            }

            // 隐藏无选择消息，显示属性表单
            noSelectionMessage.style.display = 'none';
            propertiesForm.style.display = 'block';

            // 启用/禁用按钮
            saveBtn.disabled = false;
            deleteBtn.disabled = panelType === 'basic'; // 基础面板不能删除

            // 加载面板数据到表单
            this.loadPanelDataToForm(panelId, panelType);

            // 存储当前编辑的面板信息
            this.currentEditingPanel = { id: panelId, type: panelType };

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示面板属性失败:', error);
        }
    }

    /**
     * 添加自定义面板
     */
    async addCustomPanel() {
        try {
            // 获取现有自定义面板，生成唯一的键名
            const customPanels = this.getCustomPanels();
            const newKey = this.generateUniqueKey(customPanels);

            console.log('[InfoBarSettings] 📊 当前自定义面板数量:', Object.keys(customPanels).length, '新键名:', newKey);

            // 🔧 修复：创建新的自定义面板，使用键名作为ID
            const newPanel = {
                id: newKey,  // 🔧 修复：使用键名作为ID，确保与信息栏系统设计一致
                name: '新建面板',
                key: newKey,
                description: '这是一个自定义面板',
                icon: '🎨',
                type: 'custom',
                required: false,
                memoryInject: false,
    
                prompts: {
                    init: '',
                    insert: '',
                    update: '',
                    delete: ''
                },
                subItems: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // 保存到自定义面板配置
            await this.saveCustomPanel(newPanel);

            // 刷新面板列表
            this.refreshPanelList();

            // 刷新导航栏（添加自定义面板到导航）
            this.refreshNavigation();

            // 自动选择新建的面板
            this.selectPanelForEdit(newPanel.id, 'custom');

            console.log('[InfoBarSettings] ✅ 添加自定义面板:', newPanel.id, '键名:', newPanel.key);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 添加自定义面板失败:', error);
        }
    }

    /**
     * 刷新面板列表
     */
    refreshPanelList() {
        try {
            // 检查modal是否存在
            if (!this.modal) {
                console.log('[InfoBarSettings] ⚠️ Modal不存在，跳过刷新面板列表');
                return;
            }

            // 重新生成面板列表
            const panelListContainers = this.modal.querySelectorAll('.panel-list');

            panelListContainers.forEach(container => {
                const category = container.dataset.category;
                container.innerHTML = this.createPanelListItems(category);
            });

            // 更新面板数量
            this.updatePanelCountsDisplay();

            console.log('[InfoBarSettings] 🔄 面板列表已刷新');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新面板列表失败:', error);
        }
    }

    /**
     * 更新面板数量显示
     */
    updatePanelCountsDisplay() {
        try {
            const totalCount = this.getTotalPanelCount();

            // 只更新全部面板的计数
            const allCategoryCount = this.modal.querySelector('[data-category="all"] .category-count');
            if (allCategoryCount) {
                allCategoryCount.textContent = totalCount;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新面板数量失败:', error);
        }
    }

    /**
     * 更新基础设置面板配置计数显示
     */
    updateBasicPanelCount() {
        try {
            const countElement = this.modal.querySelector('#basic-settings-count');
            if (!countElement) return;

            // 获取基础设置面板的复选框
            const allCheckboxes = this.modal.querySelectorAll('.basic-settings-vertical input[type="checkbox"][name]');
            const enabledCheckboxes = this.modal.querySelectorAll('.basic-settings-vertical input[type="checkbox"][name]:checked');

            const totalCount = allCheckboxes.length;
            const enabledCount = enabledCheckboxes.length;

            countElement.textContent = `${enabledCount}/${totalCount} 项已配置`;

            console.log(`[InfoBarSettings] 📊 基础设置面板配置计数更新: ${enabledCount}/${totalCount}`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新基础设置面板配置计数失败:', error);
        }
    }

    /**
     * 更新指定面板的配置计数显示和状态标签
     */
    updatePanelConfigCount(panelName) {
        try {
            const countElement = this.modal.querySelector(`[data-content="${panelName}"] .status-count`);
            const statusBadge = this.modal.querySelector(`[data-content="${panelName}"] .status-badge`);
            if (!countElement) return;

            // 获取该面板的复选框
            const panelContainer = this.modal.querySelector(`[data-content="${panelName}"]`);
            if (!panelContainer) return;

            // 🔧 修复：排除面板主启用复选框，只计算子项复选框
            // 面板主启用复选框的name格式为 "panelName.enabled"
            const allCheckboxes = panelContainer.querySelectorAll(`input[type="checkbox"][name]:not([name="${panelName}.enabled"])`);
            const enabledCheckboxes = panelContainer.querySelectorAll(`input[type="checkbox"][name]:checked:not([name="${panelName}.enabled"])`);

            const totalCount = allCheckboxes.length;
            const enabledCount = enabledCheckboxes.length;

            countElement.textContent = `${enabledCount}/${totalCount} 项已配置`;

            // 🔧 修复：更新状态标签，根据面板主启用复选框状态
            if (statusBadge) {
                const panelToggle = panelContainer.querySelector(`input[name="${panelName}.enabled"]`);
                if (panelToggle) {
                    const isEnabled = panelToggle.checked;
                    statusBadge.textContent = isEnabled ? '已启用' : '未启用';
                    statusBadge.className = `status-badge ${isEnabled ? 'enabled' : 'disabled'}`;
                }
            }

            console.log(`[InfoBarSettings] 📊 ${panelName}面板配置计数更新: ${enabledCount}/${totalCount}`);

        } catch (error) {
            console.error(`[InfoBarSettings] ❌ 更新${panelName}面板配置计数失败:`, error);
        }
    }

    /**
     * 根据复选框所在面板更新对应的计数
     */
    updatePanelCounts(checkbox) {
        try {
            // 找到复选框所在的面板
            const panelContainer = checkbox.closest('[data-content]');
            if (!panelContainer) return;

            const panelName = panelContainer.getAttribute('data-content');

            // 根据面板类型更新对应的计数
            if (panelName === 'basic') {
                this.updateBasicPanelCount();
            } else {
                // 检查是否是自定义面板
                const customPanels = this.getCustomPanels();
                const customPanel = customPanels[panelName];

                if (customPanel) {
                    // 自定义面板
                    this.updateCustomPanelCount(panelName, customPanel);
                } else {
                    // 基础面板
                    this.updatePanelConfigCount(panelName);
                }
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新面板计数失败:', error);
        }
    }

    /**
     * 更新自定义面板的配置计数显示
     */
    updateCustomPanelCount(panelId, panel) {
        try {
            const countElement = this.modal.querySelector(`#${panelId}-panel-count`);
            if (!countElement) {
                console.warn(`[InfoBarSettings] ⚠️ 未找到自定义面板计数元素: ${panelId}-panel-count`);
                return;
            }

            // 获取当前面板的所有复选框
            const subItems = panel.subItems || [];
            const enabledSubItems = subItems.filter(subItem => {
                const fieldName = subItem.name || subItem.key || subItem.id;
                const checkbox = this.modal.querySelector(`input[name="${fieldName}"]`);
                return checkbox && checkbox.checked;
            });

            const totalCount = subItems.length;
            const enabledCount = enabledSubItems.length;

            countElement.textContent = `${enabledCount}/${totalCount} 项已配置`;

            console.log(`[InfoBarSettings] 📊 自定义面板${panel.name}配置计数更新: ${enabledCount}/${totalCount}`);

        } catch (error) {
            console.error(`[InfoBarSettings] ❌ 更新自定义面板配置计数失败:`, error);
        }
    }

    /**
     * 更新所有面板的配置计数
     */
    updateAllPanelCounts() {
        try {
            // 更新基础设置面板计数
            this.updateBasicPanelCount();

            // 更新所有基础面板计数
            const basicPanels = ['personal', 'interaction', 'tasks', 'world', 'organization',
                               'news', 'inventory', 'abilities', 'plot', 'cultivation',
                               'fantasy', 'modern', 'historical', 'magic', 'training'];

            basicPanels.forEach(panelName => {
                this.updatePanelConfigCount(panelName);
            });

            // 更新所有自定义面板计数
            const customPanels = this.getCustomPanels();
            for (const [panelId, panel] of Object.entries(customPanels)) {
                this.updateCustomPanelCount(panelId, panel);
            }

            console.log('[InfoBarSettings] 📊 所有面板配置计数已更新');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新所有面板计数失败:', error);
        }
    }

    /**
     * 保存自定义面板
     */
    async saveCustomPanel(panel) {
        try {
            // 🔧 参数验证：确保面板数据完整性
            if (!panel) {
                console.error('[InfoBarSettings] ❌ 面板数据为空');
                return false;
            }

            if (!panel.id || panel.id === 'undefined') {
                console.error('[InfoBarSettings] ❌ 面板ID无效:', panel.id);
                return false;
            }

            if (!panel.name || panel.name === 'undefined') {
                console.error('[InfoBarSettings] ❌ 面板名称无效:', panel.name);
                return false;
            }

            if (!panel.type || panel.type === 'undefined') {
                console.error('[InfoBarSettings] ❌ 面板类型无效:', panel.type);
                return false;
            }

            console.log('[InfoBarSettings] 📊 保存面板数据验证通过:', panel.id, panel.name);

            // 获取现有自定义面板
            const customPanels = this.getCustomPanels();

            // 🔧 修复：使用键名作为存储键，确保与信息栏系统设计一致
            customPanels[panel.key] = panel;

            // 保存到全局配置（保持兼容性）
            window.InfoBarCustomPanels = customPanels;

            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 保存自定义面板数据
            extensionSettings['Information bar integration tool'].customPanels = customPanels;

            // 触发 SillyTavern 保存设置
            context.saveSettingsDebounced();

            console.log('[InfoBarSettings] ✅ 自定义面板已保存:', panel.id);
            return true;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存自定义面板失败:', error);
            return false;
        }
    }

    /**
     * 编辑面板
     */
    editPanel(panelId) {
        // 选择面板进行编辑（与点击面板项相同）
        const panelItem = this.modal.querySelector(`[data-panel-id="${panelId}"]`);
        if (panelItem) {
            const panelType = panelItem.dataset.panelType;
            this.selectPanelForEdit(panelId, panelType);
        }
    }

    /**
     * 查看面板
     */
    viewPanel(panelId) {
        // 基础面板只能查看，不能编辑
        this.editPanel(panelId);
    }

    /**
     * 复制面板
     */
    async duplicatePanel(panelId) {
        try {
            const customPanels = this.getCustomPanels();
            const originalPanel = customPanels[panelId];

            if (!originalPanel) {
                console.error('[InfoBarSettings] ❌ 未找到要复制的面板:', panelId);
                return;
            }

            // 🔧 修复：创建副本，使用键名作为ID
            const newKey = `${originalPanel.key}_copy_${Date.now()}`;
            const duplicatedPanel = {
                ...originalPanel,
                id: newKey,  // 🔧 修复：使用键名作为ID
                name: `${originalPanel.name} - 副本`,
                key: newKey,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // 保存副本
            await this.saveCustomPanel(duplicatedPanel);

            // 刷新列表
            this.refreshPanelList();

            console.log('[InfoBarSettings] 📋 面板复制完成:', duplicatedPanel.id);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 复制面板失败:', error);
        }
    }

    /**
     * 切换面板启用状态
     */
    async togglePanel(panelId) {
        try {
            // 对于基础面板，切换导航显示状态
            // 对于自定义面板，切换启用状态
            const panelItem = this.modal.querySelector(`[data-panel-id="${panelId}"]`);
            const panelType = panelItem?.dataset.panelType;

            if (panelType === 'custom') {
                const customPanels = this.getCustomPanels();
                const panel = customPanels[panelId];

                if (panel) {
                    panel.enabled = !panel.enabled;
                    panel.updatedAt = Date.now();
                    await this.saveCustomPanel(panel);
                }
            }

            // 刷新面板列表
            this.refreshPanelList();

            console.log('[InfoBarSettings] 🔄 切换面板状态:', panelId);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换面板状态失败:', error);
        }
    }

    /**
     * 保存面板属性
     */
    async savePanelProperties() {
        try {
            if (!this.currentEditingPanel) {
                console.error('[InfoBarSettings] ❌ 没有正在编辑的面板');
                return;
            }

            const { id, type } = this.currentEditingPanel;

            if (type === 'basic') {
                // 🔧 修复：基础面板也需要保存功能
                console.log('[InfoBarSettings] 💾 保存基础面板属性:', id);

                // 🔧 修复：基础面板单独收集表单数据，不包含子项
            // 读取当前勾选状态，避免因DOM重绘造成状态丢失
            const form = this.modal.querySelector('.panel-properties-form');
            const memoryInjectChecked = !!form?.querySelector('#panel-memory-inject')?.checked;
            const requiredChecked = !!form?.querySelector('#panel-required')?.checked;

            const formData = this.collectBasicPanelFormData();
            // 覆盖关键布尔位，以当前UI为准
            formData.memoryInject = memoryInjectChecked;
            formData.required = requiredChecked;

                // 保存到extensionSettings
                const context = SillyTavern.getContext();
                const extensionSettings = context.extensionSettings;

                if (!extensionSettings['Information bar integration tool']) {
                    extensionSettings['Information bar integration tool'] = {};
                }

                if (!extensionSettings['Information bar integration tool'][id]) {
                    extensionSettings['Information bar integration tool'][id] = {};
                }

                // 更新基础面板配置
                Object.assign(extensionSettings['Information bar integration tool'][id], formData);

                // 🔧 修复：基础面板现在允许保存用户添加的子项数据
                // 不再删除子项数据，允许用户为基础面板添加自定义子项
                console.log('[InfoBarSettings] 💾 基础面板子项数据已保存:', formData.subItems?.length || 0, '个');

                // 保存设置
                context.saveSettingsDebounced();

                // 🔧 修复：刷新对应的基础面板内容，确保新增的子项在基础设置中显示
                this.refreshBasicPanelContent(id);
                console.log(`[InfoBarSettings] 🔄 已刷新基础面板 ${id} 的设置页面内容`);

                console.log('[InfoBarSettings] ✅ 基础面板属性保存成功:', id);
                this.showMessage('基础面板保存成功', 'success');

                return;
            }

            // 收集表单数据
            const formData = this.collectPanelFormData();

            // 收集子项数据
            const subItemsData = this.collectSubItemsData();
            formData.subItems = subItemsData;

            console.log('[InfoBarSettings] 📊 收集到的表单数据:', formData);
            console.log('[InfoBarSettings] 📊 收集到的子项数据:', subItemsData);

            // 更新面板配置
            const customPanels = this.getCustomPanels();
            const panel = customPanels[id];

            if (panel) {
                Object.assign(panel, formData, { updatedAt: Date.now() });
                await this.saveCustomPanel(panel);

                // 刷新面板列表
                this.refreshPanelList();

                // 刷新导航栏（更新自定义面板内容）
                this.refreshNavigation();

                // 如果当前正在查看这个面板的内容，也需要更新右侧内容区域
                const activeNavItem = this.modal.querySelector('.nav-item.active');
                if (activeNavItem && activeNavItem.dataset.nav === id) {
                    // 更新右侧内容面板
                    const contentPanel = this.modal.querySelector(`.content-panel[data-content="${id}"]`);
                    if (contentPanel) {
                        contentPanel.innerHTML = this.createCustomPanelContent(panel);
                        console.log('[InfoBarSettings] 🔄 已更新右侧内容面板显示');
                    }
                }

                console.log('[InfoBarSettings] ✅ 面板属性保存成功:', id, '包含', subItemsData.length, '个子项');

                // 显示保存成功提示
                this.showMessage('面板保存成功', 'success');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存面板属性失败:', error);
            this.showMessage('面板保存失败: ' + error.message, 'error');
        }
    }

    /**
     * 删除面板
     */
    async deletePanel() {
        try {
            if (!this.currentEditingPanel) {
                console.error('[InfoBarSettings] ❌ 没有正在编辑的面板');
                return;
            }

            const { id, type } = this.currentEditingPanel;

            if (type === 'basic') {
                console.error('[InfoBarSettings] ❌ 不能删除基础面板');
                return;
            }

            // 确认删除
            if (!confirm(`确定要删除面板"${id}"吗？此操作不可撤销。`)) {
                return;
            }

            // 从自定义面板中删除
            const customPanels = this.getCustomPanels();
            delete customPanels[id];

            // 保存配置
            window.InfoBarCustomPanels = customPanels;

            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 保存自定义面板数据
            extensionSettings['Information bar integration tool'].customPanels = customPanels;

            // 触发 SillyTavern 保存设置
            context.saveSettingsDebounced();

            // 清空属性表单
            this.clearPanelProperties();

            // 刷新面板列表
            this.refreshPanelList();

            // 刷新导航栏（移除自定义面板从导航）
            this.refreshNavigation();

            console.log('[InfoBarSettings] 🗑️ 面板删除成功:', id);

            // 显示删除成功提示
            this.showMessage('面板删除成功', 'success');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 删除面板失败:', error);
            this.showMessage('面板删除失败: ' + error.message, 'error');
        }
    }
    /**
     * 添加子项
     */
    addSubItem() {
        try {
            // 检查是否有正在编辑的面板
            if (!this.currentEditingPanel) {
                console.error('[InfoBarSettings] ❌ 没有正在编辑的面板，无法添加子项');
                return;
            }

            console.log('[InfoBarSettings] 📝 当前编辑面板:', this.currentEditingPanel);

            // 创建新的子项（简化版本：只需要名称）
            const newSubItem = {
                id: `sub_${Date.now()}`,
                name: '新建子项',
                key: `sub_item_${Date.now()}` // 名称就是键名
            };

            // 添加到子项容器（UI显示）
            this.addSubItemToContainer(newSubItem);

            console.log('[InfoBarSettings] ➕ 添加子项到面板:', this.currentEditingPanel.id, '子项:', newSubItem.id);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 添加子项失败:', error);
        }
    }

    /**
     * 删除子项
     */
    removeSubItem(buttonElement) {
        try {
            // 找到子项表单元素
            const subItemForm = buttonElement.closest('.sub-item-form');
            if (!subItemForm) {
                console.error('[InfoBarSettings] ❌ 未找到子项表单');
                return;
            }

            const subItemId = subItemForm.dataset.subItemId;

            // 移除子项表单
            subItemForm.remove();

            // 检查是否还有子项，如果没有则显示空状态消息
            const container = this.modal.querySelector('.sub-items-container');
            const remainingSubItems = container.querySelectorAll('.sub-item-form');
            const emptyMessage = container.querySelector('.empty-sub-items');

            if (remainingSubItems.length === 0 && emptyMessage) {
                emptyMessage.style.display = 'block';
            }

            console.log('[InfoBarSettings] 🗑️ 删除子项:', subItemId);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 删除子项失败:', error);
        }
    }

    /**
     * 刷新基础面板内容，显示用户添加的子项
     */
    refreshBasicPanelContent(panelId) {
        try {
            if (!this.modal) {
                console.log('[InfoBarSettings] ⚠️ Modal不存在，跳过刷新基础面板内容');
                return;
            }

            // 🔧 修复：检查modal是否已经在DOM中并且可见
            if (!document.body.contains(this.modal) || this.modal.style.display === 'none') {
                console.log(`[InfoBarSettings] ⚠️ Modal未显示或不在DOM中，跳过刷新基础面板 ${panelId} 内容`);
                return;
            }

            // 获取对应的内容面板
            const contentPanel = this.modal.querySelector(`[data-content="${panelId}"]`);
            if (!contentPanel) {
                console.log(`[InfoBarSettings] ⚠️ 未找到基础面板 ${panelId} 的内容面板`);
                return;
            }

            // 获取基础面板数据，包含用户添加的子项
            const panelData = this.getBasicPanelData(panelId);
            if (!panelData || !panelData.subItems || panelData.subItems.length === 0) {
                console.log(`[InfoBarSettings] ℹ️ 基础面板 ${panelId} 没有自定义子项，跳过刷新`);
                return;
            }

            // 查找子项容器
            let subItemsContainer = contentPanel.querySelector('.sub-items');
            if (!subItemsContainer) {
                console.log(`[InfoBarSettings] ⚠️ 基础面板 ${panelId} 没有子项容器`);
                return;
            }

            // 创建自定义子项的HTML
            let customSubItemsHTML = '';
            panelData.subItems.forEach((subItem, index) => {
                const checkboxId = `${panelId}-custom-${index}`;
                const fieldName = `${panelId}.${subItem.key || subItem.name.toLowerCase().replace(/\s+/g, '_')}.enabled`;
                
                customSubItemsHTML += `
                    <div class="sub-item">
                        <div class="checkbox-wrapper">
                            <input type="checkbox" 
                                   id="${checkboxId}" 
                                   name="${fieldName}" 
                                   ${subItem.enabled !== false ? 'checked' : ''} />
                            <label for="${checkboxId}" class="checkbox-label">${subItem.displayName || subItem.name}</label>
                        </div>
                    </div>
                `;
            });

            if (customSubItemsHTML) {
                // 如果已经存在自定义子项区域，先删除
                const existingCustomArea = contentPanel.querySelector('.custom-sub-items-area');
                if (existingCustomArea) {
                    existingCustomArea.remove();
                }

                // 创建自定义子项区域
                const customArea = document.createElement('div');
                customArea.className = 'custom-sub-items-area';
                customArea.innerHTML = `
                    <div class="sub-item-section">
                        <h4 class="section-title">🔧 自定义子项</h4>
                        <div class="sub-item-row">
                            ${customSubItemsHTML}
                        </div>
                    </div>
                `;

                // 插入到子项容器的末尾
                subItemsContainer.appendChild(customArea);

                // 🔧 修复：应用当前主题样式到自定义子项区域
                this.applyThemeToCustomSubItems(customArea, panelId);

                console.log(`[InfoBarSettings] ✅ 已为基础面板 ${panelId} 添加 ${panelData.subItems.length} 个自定义子项`);

                // 更新面板计数
                this.updatePanelConfigCount(panelId);
            }

        } catch (error) {
            console.error(`[InfoBarSettings] ❌ 刷新基础面板 ${panelId} 内容失败:`, error);
        }
    }

    /**
     * 刷新导航栏（添加/移除自定义面板）
     */
    refreshNavigation() {
        try {
            // 检查modal是否存在
            if (!this.modal) {
                console.log('[InfoBarSettings] ⚠️ Modal不存在，跳过刷新导航栏');
                return;
            }

            const sidebar = this.modal.querySelector('.sidebar-nav');
            const contentArea = this.modal.querySelector('.content-area');
            if (!sidebar || !contentArea) {
                console.error('[InfoBarSettings] ❌ 未找到导航栏或内容区域');
                console.log('[InfoBarSettings] 🔍 模态框结构:', this.modal ? '存在' : '不存在');
                if (this.modal) {
                    console.log('[InfoBarSettings] 🔍 查找 .sidebar-nav:', !!this.modal.querySelector('.sidebar-nav'));
                    console.log('[InfoBarSettings] 🔍 查找 .content-area:', !!this.modal.querySelector('.content-area'));
                }
                return;
            }

            // 🔧 修复：移除现有的自定义面板导航项和内容面板（包括新旧格式）
            const existingCustomNavs = sidebar.querySelectorAll('.nav-item[data-nav^="custom_"], .nav-item[data-nav^="Custom"]');
            const existingCustomPanels = contentArea.querySelectorAll('.content-panel[data-content^="custom_"], .content-panel[data-content^="Custom"]');

            console.log(`[InfoBarSettings] 🧹 清理现有导航项: ${existingCustomNavs.length} 个`);
            console.log(`[InfoBarSettings] 🧹 清理现有内容面板: ${existingCustomPanels.length} 个`);

            existingCustomNavs.forEach(nav => {
                console.log(`[InfoBarSettings] 🗑️ 移除导航项: ${nav.dataset.nav}`);
                nav.remove();
            });
            existingCustomPanels.forEach(panel => {
                console.log(`[InfoBarSettings] 🗑️ 移除内容面板: ${panel.dataset.content}`);
                panel.remove();
            });

            // 获取自定义面板
            const customPanels = this.getCustomPanels();
            const customPanelArray = Object.values(customPanels);

            console.log('[InfoBarSettings] 📊 获取到的自定义面板数据:', customPanels);
            console.log('[InfoBarSettings] 📊 转换后的数组长度:', customPanelArray.length);

            // 找到主题设置导航项，在它之前插入自定义面板
            const themeNavItem = sidebar.querySelector('.nav-item[data-nav="theme"]');

            // 为每个自定义面板创建导航项和内容面板
            console.log('[InfoBarSettings] 🔧 开始创建自定义面板导航，数组长度:', customPanelArray.length);

            customPanelArray.forEach((panel, index) => {
                console.log(`[InfoBarSettings] 🔧 创建第${index + 1}个自定义面板:`, panel.id, panel.name);

                // 创建导航项
                const navItem = document.createElement('div');
                navItem.className = 'nav-item';
                navItem.dataset.nav = panel.id;
                navItem.innerHTML = `

                    <span class="nav-text">${panel.name}</span>
                `;

                // 在主题设置之前插入导航项
                if (themeNavItem) {
                    sidebar.insertBefore(navItem, themeNavItem);
                } else {
                    sidebar.appendChild(navItem);
                }

                // 创建内容面板
                const contentPanel = document.createElement('div');
                contentPanel.className = 'content-panel';
                contentPanel.dataset.content = panel.id;
                contentPanel.innerHTML = this.createCustomPanelContent(panel);

                // 添加到内容区域
                contentArea.appendChild(contentPanel);

                console.log(`[InfoBarSettings] ✅ 第${index + 1}个自定义面板创建完成`);
            });

            // 应用当前主题到新创建的自定义面板
            this.applyCurrentThemeToCustomPanels();

            console.log('[InfoBarSettings] 🔄 导航栏已刷新，添加了', customPanelArray.length, '个自定义面板');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新导航栏失败:', error);
        }
    }

    /**
     * 应用当前主题样式到自定义子项区域
     */
    applyThemeToCustomSubItems(customArea, panelId) {
        try {
            if (!customArea) return;

            // 获取当前主题配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const currentTheme = configs.theme?.current || 'neon-blue';

            // 应用主题样式到自定义子项区域
            const subItemSection = customArea.querySelector('.sub-item-section');
            if (subItemSection) {
                subItemSection.setAttribute('data-theme', currentTheme);
                
                // 应用主题到所有复选框
                const checkboxes = customArea.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.setAttribute('data-theme', currentTheme);
                    
                    // 🔧 修复：为每个自定义子项复选框绑定变更事件，同步数据表格
                    checkbox.addEventListener('change', (e) => {
                        this.handleCustomSubItemChange(e, panelId);
                    });
                });

                // 应用主题到标签
                const labels = customArea.querySelectorAll('.checkbox-label');
                labels.forEach(label => {
                    label.setAttribute('data-theme', currentTheme);
                });

                console.log(`[InfoBarSettings] 🎨 已应用主题 ${currentTheme} 到自定义子项区域`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用主题到自定义子项失败:', error);
        }
    }

    /**
     * 处理自定义子项复选框变更事件，同步数据表格
     */
    handleCustomSubItemChange(event, panelId) {
        try {
            const checkbox = event.target;
            const fieldName = checkbox.name;
            const isEnabled = checkbox.checked;
            
            console.log(`[InfoBarSettings] 🔄 基础面板 ${panelId} 自定义子项变更: ${fieldName} = ${isEnabled}`);

            // 触发面板配置变更事件，通知数据表格更新
            if (this.eventSystem) {
                this.eventSystem.emit('panel:config:changed', {
                    panelId: panelId,
                    panelType: 'basic',
                    subItemChanged: true,
                    fieldName: fieldName,
                    enabled: isEnabled,
                    timestamp: Date.now()
                });
                console.log('[InfoBarSettings] 📋 已触发面板配置变更事件，通知数据表格更新');
            }

            // 立即保存变更到配置中
            this.saveCustomSubItemState(panelId, fieldName, isEnabled);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理自定义子项变更失败:', error);
        }
    }

    /**
     * 保存自定义子项状态到配置
     */
    saveCustomSubItemState(panelId, fieldName, isEnabled) {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            
            // 确保扩展设置存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }
            
            // 获取基础面板配置
            const panelConfig = extensionSettings['Information bar integration tool'][panelId];
            if (panelConfig && panelConfig.subItems) {
                // 查找对应的子项并更新状态
                const subItemKey = fieldName.split('.')[1]; // 从 'panelId.key.enabled' 中提取 key
                const subItem = panelConfig.subItems.find(item => 
                    item.key === subItemKey || 
                    item.name.toLowerCase().replace(/\s+/g, '_') === subItemKey
                );
                
                if (subItem) {
                    subItem.enabled = isEnabled;
                    console.log(`[InfoBarSettings] 💾 已保存自定义子项状态: ${subItem.name} = ${isEnabled}`);
                    
                    // 保存到 SillyTavern
                    context.saveSettingsDebounced();
                }
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存自定义子项状态失败:', error);
        }
    }

    /**
     * 应用当前主题到自定义面板
     */
    applyCurrentThemeToCustomPanels() {
        try {
            // 获取当前主题
            const activeThemeCard = this.modal.querySelector('.theme-preview-card.active');
            if (!activeThemeCard) {
                console.log('[InfoBarSettings] 🎨 未找到激活的主题，跳过自定义面板主题应用');
                return;
            }

            const themeId = activeThemeCard.getAttribute('data-theme');
            const theme = this.getThemeById(themeId);
            if (!theme) {
                console.log('[InfoBarSettings] 🎨 未找到主题配置，跳过自定义面板主题应用');
                return;
            }

            // 🔧 修复：查找所有自定义面板导航项（使用键名ID格式）
            const customNavItems = this.modal.querySelectorAll('.nav-item[data-nav^="Custom"]');
            const customContentPanels = this.modal.querySelectorAll('.content-panel[data-content^="Custom"]');

            console.log('[InfoBarSettings] 🎨 应用主题到', customNavItems.length, '个自定义导航项');

            // 应用主题到自定义导航项
            customNavItems.forEach(navItem => {
                navItem.style.backgroundColor = theme.colors.bg;
                navItem.style.color = theme.colors.text;
                navItem.style.borderColor = theme.colors.border;
            });

            // 应用主题到自定义内容面板
            customContentPanels.forEach(contentPanel => {
                contentPanel.style.backgroundColor = theme.colors.bg;
                contentPanel.style.color = theme.colors.text;
                contentPanel.style.borderColor = theme.colors.border;
            });

            console.log('[InfoBarSettings] ✅ 自定义面板主题应用完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用自定义面板主题失败:', error);
        }
    }

    /**
     * 创建自定义面板内容
     */
    createCustomPanelContent(panel) {
        // 计算子项配置状态
        const subItems = panel.subItems || [];
        const enabledSubItems = subItems.filter(item => item.enabled !== false);
        const statusText = `${enabledSubItems.length}/${subItems.length} 项已配置`;

        return `
            <div class="content-header">
                <h3>${panel.name}</h3>
            </div>

            <div class="content-body">
                <!-- 自定义面板卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">📄</div>
                            <div class="card-text">
                                <div class="card-title">${panel.name}</div>
                                <div class="card-subtitle">${panel.description}</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" name="${panel.key}.enabled" id="${panel.id}-enabled" ${panel.enabled ? 'checked' : ''} />
                                <label for="${panel.id}-enabled" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count" id="${panel.id}-panel-count">${statusText}</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items" style="${panel.enabled ? '' : 'display: none;'}">
                    ${this.createCustomPanelSubItems(panel.subItems || [])}
                </div>
            </div>
        `;
    }

    /**
     * 创建自定义面板子项（与基础面板一致的两列布局）
     */
    createCustomPanelSubItems(subItems) {
        if (!subItems || subItems.length === 0) {
            return `
                <div class="empty-sub-items">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">暂无子项配置</div>
                </div>
            `;
        }

        // 将子项按两个一组分组，实现两列布局
        const rows = [];
        for (let i = 0; i < subItems.length; i += 2) {
            const leftItem = subItems[i];
            const rightItem = subItems[i + 1];

            const leftItemHtml = this.createSubItemHtml(leftItem);
            const rightItemHtml = rightItem ? this.createSubItemHtml(rightItem) : '<div class="sub-item"></div>'; // 空占位符

            rows.push(`
                <div class="sub-item-row">
                    ${leftItemHtml}
                    ${rightItemHtml}
                </div>
            `);
        }

        return rows.join('');
    }

    /**
     * 创建单个子项HTML
     */
    createSubItemHtml(subItem) {
        if (!subItem) return '<div class="sub-item"></div>';

        // 确保子项有enabled属性，默认为true
        const isEnabled = subItem.enabled !== false;
        // 使用子项的name作为表单字段名，确保能被collectFormData收集
        const fieldName = subItem.name || subItem.key || subItem.id;

        return `
            <div class="sub-item">
                <div class="checkbox-wrapper">
                    <input type="checkbox"
                           id="${subItem.id}"
                           name="${fieldName}"
                           ${isEnabled ? 'checked' : ''} />
                    <label for="${subItem.id}" class="checkbox-label">${subItem.name}</label>
                </div>
            </div>
        `;
    }

    /**
     * 收集基础面板表单数据（不包含子项）
     */
    collectBasicPanelFormData() {
        try {
            const form = this.modal.querySelector('.panel-properties-form');
            const formData = {};

            // 基本信息（基础面板的name和key不保存，使用默认值）
            // formData.name = form.querySelector('#panel-name')?.value || '';  // 基础面板名称不可修改
            // formData.key = form.querySelector('#panel-key')?.value || '';    // 基础面板键名不可修改
            formData.description = form.querySelector('#panel-description')?.value || '';
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // formData.icon = form.querySelector('#panel-icon')?.value || '🎨';

            // 配置选项
            formData.required = form.querySelector('#panel-required')?.checked || false;
            formData.memoryInject = form.querySelector('#panel-memory-inject')?.checked || false;
    

            // 提示词配置
            formData.prompts = {
                init: form.querySelector('#panel-prompt-init')?.value || '',
                insert: form.querySelector('#panel-prompt-insert')?.value || '',
                update: form.querySelector('#panel-prompt-update')?.value || '',
                delete: form.querySelector('#panel-prompt-delete')?.value || ''
            };

            // 🔧 修复：基础面板也需要保存用户添加的子项数据
            formData.subItems = this.collectSubItemsData();

            console.log('[InfoBarSettings] 📊 基础面板表单数据（含子项）:', formData);
            return formData;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 收集基础面板表单数据失败:', error);
            return {};
        }
    }

    /**
     * 收集面板表单数据
     */
    collectPanelFormData() {
        try {
            const form = this.modal.querySelector('.panel-properties-form');
            const formData = {};

            // 基本信息
            formData.name = form.querySelector('#panel-name')?.value || '';
            formData.key = form.querySelector('#panel-key')?.value || '';
            formData.description = form.querySelector('#panel-description')?.value || '';
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // formData.icon = form.querySelector('#panel-icon')?.value || '🎨';

            // 配置选项
            formData.required = form.querySelector('#panel-required')?.checked || false;
            formData.memoryInject = form.querySelector('#panel-memory-inject')?.checked || false;
    

            // 提示词配置
            formData.prompts = {
                init: form.querySelector('#panel-prompt-init')?.value || '',
                insert: form.querySelector('#panel-prompt-insert')?.value || '',
                update: form.querySelector('#panel-prompt-update')?.value || '',
                delete: form.querySelector('#panel-prompt-delete')?.value || ''
            };

            // 子项配置（从子项容器收集）
            formData.subItems = this.collectSubItemsData();

            return formData;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 收集面板表单数据失败:', error);
            return {};
        }
    }

    /**
     * 收集子项数据（简化版本）
     */
    collectSubItemsData() {
        try {
            const subItems = [];
            const subItemElements = this.modal.querySelectorAll('.sub-item-form');

            subItemElements.forEach(element => {
                const name = element.querySelector('.sub-item-name')?.value || '';
                if (name.trim()) { // 只有名称不为空才添加
                    const subItem = {
                        id: element.dataset.subItemId,
                        name: name.trim(),
                        key: name.trim().toLowerCase().replace(/\s+/g, '_'), // 名称转换为键名
                        displayName: name.trim(), // 🔧 修复：添加displayName字段，保存用户输入的显示名称
        
                    };
                    subItems.push(subItem);
                }
            });

            console.log('[InfoBarSettings] 📊 收集到的子项数据详情:', subItems);
            return subItems;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 收集子项数据失败:', error);
            return [];
        }
    }

    /**
     * 获取子项默认值
     */
    getSubItemDefaultValue(element) {
        const type = element.querySelector('.sub-item-type')?.value;
        const defaultInput = element.querySelector('.sub-item-default');

        switch (type) {
            case 'checkbox':
                return defaultInput?.checked || false;
            case 'number':
                return parseFloat(defaultInput?.value) || 0;
            default:
                return defaultInput?.value || '';
        }
    }
    /**
     * 获取子项选项（用于select类型）
     */
    getSubItemOptions(element) {
        try {
            const optionsContainer = element.querySelector('.sub-item-options');
            const optionInputs = optionsContainer?.querySelectorAll('.option-input');
            const options = [];

            optionInputs?.forEach(input => {
                const value = input.value.trim();
                if (value) {
                    options.push(value);
                }
            });

            return options;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取子项选项失败:', error);
            return [];
        }
    }

    /**
     * 加载面板数据到表单
     */
    loadPanelDataToForm(panelId, panelType) {
        try {
            let panelData = null;

            if (panelType === 'basic') {
                // 获取基础面板数据
                panelData = this.getBasicPanelData(panelId);
            } else {
                // 获取自定义面板数据
                const customPanels = this.getCustomPanels();
                panelData = customPanels[panelId];
            }

            if (!panelData) {
                console.error('[InfoBarSettings] ❌ 未找到面板数据:', panelId);
                return;
            }

            // 填充基本信息
            this.fillBasicPanelInfo(panelData, panelType);

            // 填充提示词配置
            this.fillPanelPrompts(panelData, panelType);

            // 填充子项配置
            this.fillSubItems(panelData.subItems || []);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载面板数据失败:', error);
        }
    }

    /**
     * 获取基础面板数据
     */
    getBasicPanelData(panelId) {
        // 默认基础面板数据
        const defaultBasicPanelsData = {
            // 移除基础设置面板，它是系统设置，不是面板
            personal: { name: '个人信息', key: 'personal', description: '个人相关信息配置', icon: '👤', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            interaction: { name: '交互对象', key: 'interaction', description: '交互对象相关配置', icon: '👥', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            tasks: { name: '任务系统', key: 'tasks', description: '任务系统相关配置', icon: '📋', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            world: { name: '世界设定', key: 'world', description: '世界设定相关配置', icon: '🌍', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            organization: { name: '组织架构', key: 'organization', description: '组织架构相关配置', icon: '🏢', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            news: { name: '新闻事件', key: 'news', description: '新闻事件相关配置', icon: '📰', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            inventory: { name: '物品清单', key: 'inventory', description: '物品清单相关配置', icon: '🎒', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            abilities: { name: '能力技能', key: 'abilities', description: '能力技能相关配置', icon: '⚡', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            plot: { name: '剧情发展', key: 'plot', description: '剧情发展相关配置', icon: '📖', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            cultivation: { name: '修炼系统', key: 'cultivation', description: '修炼系统相关配置', icon: '🧘', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            fantasy: { name: '玄幻世界', key: 'fantasy', description: '玄幻世界相关配置', icon: '🔮', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            modern: { name: '现代都市', key: 'modern', description: '现代都市相关配置', icon: '🏙️', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            historical: { name: '历史古代', key: 'historical', description: '历史古代相关配置', icon: '🏛️', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            magic: { name: '魔法能力', key: 'magic', description: '魔法能力相关配置', icon: '🪄', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] },
            training: { name: '调教系统', key: 'training', description: '调教系统相关配置', icon: '🎯', prompts: { init: '', insert: '', update: '', delete: '' }, subItems: [] }
        };

        // 🔧 修复：获取默认数据
        const defaultPanelData = defaultBasicPanelsData[panelId];
        if (!defaultPanelData) {
            return null;
        }

        try {
            // 🔧 修复：从 extensionSettings 读取已保存的基础面板配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const savedConfig = extensionSettings['Information bar integration tool']?.[panelId];

            if (savedConfig) {
                console.log('[InfoBarSettings] 📊 从配置读取基础面板数据:', panelId);
                
                // 合并默认数据和已保存的配置，确保所有必需字段都存在
                const mergedData = {
                    ...defaultPanelData, // 默认结构
                    ...savedConfig, // 用户保存的配置覆盖默认值
                    name: defaultPanelData.name, // 基础面板名称不能修改
                    key: defaultPanelData.key, // 基础面板键名不能修改
                    subItems: savedConfig.subItems || [], // 🔧 修复：从配置中读取用户添加的子项
                    prompts: {
                        ...defaultPanelData.prompts, // 默认提示词结构
                        ...savedConfig.prompts // 用户的提示词配置
                    }
                };
                
                return mergedData;
            } else {
                console.log('[InfoBarSettings] 📊 使用默认基础面板数据:', panelId);
                return defaultPanelData;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取基础面板配置失败，使用默认数据:', error);
            return defaultPanelData;
        }
    }

    /**
     * 填充基本面板信息
     */
    fillBasicPanelInfo(panelData, panelType) {
        const form = this.modal.querySelector('.panel-properties-form');

        form.querySelector('#panel-name').value = panelData.name || '';
        form.querySelector('#panel-key').value = panelData.key || '';
        form.querySelector('#panel-description').value = panelData.description || '';
        // 🔧 修复：删除图标字段引用，因为已从表单中移除
        // form.querySelector('#panel-icon').value = panelData.icon || '🎨';

        form.querySelector('#panel-required').checked = !!panelData.required;
        form.querySelector('#panel-memory-inject').checked = !!panelData.memoryInject;


        // 基础面板只限制名称和键名不可修改
        const isBasicPanel = panelType === 'basic';
        if (isBasicPanel) {
            // 只限制名称和键名
            form.querySelector('#panel-name').readOnly = true;
            form.querySelector('#panel-key').readOnly = true;

            // 其他字段可以编辑
            form.querySelector('#panel-description').readOnly = false;
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // form.querySelector('#panel-icon').readOnly = false;
            form.querySelector('#panel-required').disabled = false;
            form.querySelector('#panel-memory-inject').disabled = false;

            // 为只读输入框添加样式类
            form.querySelector('#panel-name').classList.add('readonly-input');
            form.querySelector('#panel-key').classList.add('readonly-input');

            // 移除其他字段的只读样式
            form.querySelector('#panel-description').classList.remove('readonly-input');
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // form.querySelector('#panel-icon').classList.remove('readonly-input');
        } else {
            // 自定义面板移除只读状态
            form.querySelector('#panel-name').readOnly = false;
            form.querySelector('#panel-key').readOnly = false;
            form.querySelector('#panel-description').readOnly = false;
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // form.querySelector('#panel-icon').readOnly = false;
            form.querySelector('#panel-required').disabled = false;
            form.querySelector('#panel-memory-inject').disabled = false;

            // 移除只读样式类
            form.querySelector('#panel-name').classList.remove('readonly-input');
            form.querySelector('#panel-key').classList.remove('readonly-input');
            form.querySelector('#panel-description').classList.remove('readonly-input');
            // 🔧 修复：删除图标字段引用，因为已从表单中移除
            // form.querySelector('#panel-icon').classList.remove('readonly-input');
        }
    }

    /**
     * 填充提示词配置
     */
    fillPanelPrompts(panelData, panelType) {
        const form = this.modal.querySelector('.panel-properties-form');
        const prompts = panelData.prompts || {};

        const initInput = form.querySelector('#panel-prompt-init');
        const insertInput = form.querySelector('#panel-prompt-insert');
        const updateInput = form.querySelector('#panel-prompt-update');
        const deleteInput = form.querySelector('#panel-prompt-delete');

        if (initInput) initInput.value = prompts.init || '';
        if (insertInput) insertInput.value = prompts.insert || '';
        if (updateInput) updateInput.value = prompts.update || '';
        if (deleteInput) deleteInput.value = prompts.delete || '';

        // 基础面板的提示词可以编辑（移除只读限制）
        const isBasicPanel = panelType === 'basic';
        if (isBasicPanel) {
            // 基础面板的提示词也可以编辑
            if (initInput) {
                initInput.readOnly = false;
                initInput.classList.remove('readonly-input');
            }
            if (insertInput) {
                insertInput.readOnly = false;
                insertInput.classList.remove('readonly-input');
            }
            if (updateInput) {
                updateInput.readOnly = false;
                updateInput.classList.remove('readonly-input');
            }
            if (deleteInput) {
                deleteInput.readOnly = false;
                deleteInput.classList.remove('readonly-input');
            }
        } else {
            // 自定义面板移除只读状态
            if (initInput) {
                initInput.readOnly = false;
                initInput.classList.remove('readonly-input');
            }
            if (insertInput) {
                insertInput.readOnly = false;
                insertInput.classList.remove('readonly-input');
            }
            if (updateInput) {
                updateInput.readOnly = false;
                updateInput.classList.remove('readonly-input');
            }
            if (deleteInput) {
                deleteInput.readOnly = false;
                deleteInput.classList.remove('readonly-input');
            }
        }
    }

    /**
     * 填充子项配置
     */
    fillSubItems(subItems) {
        try {
            const container = this.modal.querySelector('.sub-items-container');
            const emptyMessage = container.querySelector('.empty-sub-items');

            // 🔧 修复：无论是否有子项，都先清空现有子项，防止UI污染
            container.querySelectorAll('.sub-item-form').forEach(item => item.remove());

            if (subItems.length === 0) {
                emptyMessage.style.display = 'block';
                console.log('[InfoBarSettings] 🧹 子项容器已清理，显示空消息');
                return;
            }

            emptyMessage.style.display = 'none';

            // 添加子项
            subItems.forEach(subItem => {
                this.addSubItemToContainer(subItem);
            });

            console.log(`[InfoBarSettings] 📊 已填充 ${subItems.length} 个子项到容器`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 填充子项配置失败:', error);
        }
    }

    /**
     * 添加子项到容器
     */
    addSubItemToContainer(subItem) {
        try {
            const container = this.modal.querySelector('.sub-items-container');
            const emptyMessage = container.querySelector('.empty-sub-items');

            // 隐藏空消息
            emptyMessage.style.display = 'none';

            // 创建子项表单
            const subItemForm = this.createSubItemForm(subItem);
            container.appendChild(subItemForm);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 添加子项到容器失败:', error);
        }
    }

    /**
     * 创建子项表单（简化版本）
     */
    createSubItemForm(subItem) {
        const formElement = document.createElement('div');
        formElement.className = 'sub-item-form simplified';
        formElement.dataset.subItemId = subItem.id;

        formElement.innerHTML = `
            <div class="sub-item-simple">
                <div class="sub-item-input-group">
                    <input type="text" class="sub-item-name" value="${subItem.name || ''}" placeholder="子项名称" />
                </div>
                <button type="button" class="btn-icon btn-remove-sub-item" data-action="remove-sub-item" title="删除子项">
                    <span style="pointer-events: none;">🗑️</span>
                </button>
            </div>
        `;

        return formElement;
    }

    /**
     * 创建子项默认值输入
     */
    createSubItemDefaultInput(subItem) {
        switch (subItem.type) {
            case 'checkbox':
                return `<input type="checkbox" class="sub-item-default" ${subItem.defaultValue ? 'checked' : ''} />`;
            case 'number':
                return `<input type="number" class="sub-item-default" value="${subItem.defaultValue || 0}" />`;
            case 'textarea':
                return `<textarea class="sub-item-default" rows="3">${subItem.defaultValue || ''}</textarea>`;
            default:
                return `<input type="text" class="sub-item-default" value="${subItem.defaultValue || ''}" />`;
        }
    }

    /**
     * 创建子项选项区域（用于select类型）
     */
    createSubItemOptionsSection(options) {
        const optionsHtml = options.map((option, index) => `
            <div class="option-item">
                <input type="text" class="option-input" value="${option}" placeholder="选项${index + 1}" />
                <button type="button" class="btn-icon btn-remove-option">🗑️</button>
            </div>
        `).join('');

        return `
            <div class="form-group sub-item-options-section">
                <label>选项配置</label>
                <div class="sub-item-options">
                    ${optionsHtml}
                </div>
                <button type="button" class="btn-small btn-add-option">添加选项</button>
            </div>
        `;
    }

    /**
     * 清空面板属性
     */
    clearPanelProperties() {
        try {
            // 检查modal是否存在
            if (!this.modal) {
                console.log('[InfoBarSettings] ⚠️ Modal不存在，跳过清空面板属性');
                return;
            }

            const noSelectionMessage = this.modal.querySelector('.no-selection-message');
            const propertiesForm = this.modal.querySelector('.panel-properties-form');
            const saveBtn = this.modal.querySelector('[data-action="save-panel-properties"]');
            const deleteBtn = this.modal.querySelector('[data-action="delete-panel"]');

            // 显示无选择消息，隐藏属性表单
            if (noSelectionMessage) noSelectionMessage.style.display = 'block';
            if (propertiesForm) propertiesForm.style.display = 'none';

            // 禁用按钮
            if (saveBtn) saveBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;

            // 清空当前编辑面板信息
            this.currentEditingPanel = null;

            // 清除面板列表选中状态
            this.modal.querySelectorAll('.panel-list-item').forEach(item => {
                item.classList.remove('selected');
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 清空面板属性失败:', error);
        }
    }

    /**
     * 切换内容面板
     */
    switchToContent(contentType) {
        try {
            // 更新导航状态
            this.modal.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            this.modal.querySelector(`[data-nav="${contentType}"]`).classList.add('active');

            // 更新内容面板
            this.modal.querySelectorAll('.content-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            this.modal.querySelector(`[data-content="${contentType}"]`).classList.add('active');

            // 🔧 新增：总结面板特殊处理
            if (contentType === 'summary') {
                this.initSummaryPanelContent();
            }

            console.log(`[InfoBarSettings] 📑 切换到内容: ${contentType}`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换内容失败:', error);
        }
    }

    /**
     * 初始化总结面板内容
     */
    initSummaryPanelContent() {
        try {
            console.log('[InfoBarSettings] 📊 初始化总结面板内容...');

            // 获取总结管理器实例
            const infoBarTool = window.SillyTavernInfobar;
            if (!infoBarTool || !infoBarTool.modules || !infoBarTool.modules.summaryManager) {
                console.error('[InfoBarSettings] ❌ 总结管理器未初始化');
                this.showMessage('总结管理器未初始化', 'error');
                return;
            }

            const summaryManager = infoBarTool.modules.summaryManager;

            // 加载当前设置
            this.loadSummarySettings();

            // 加载总结历史
            this.loadSummaryHistory();

            // 绑定总结面板事件
            this.bindSummaryPanelEvents();

            console.log('[InfoBarSettings] ✅ 总结面板内容初始化完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 初始化总结面板内容失败:', error);
            this.showMessage('初始化总结面板失败', 'error');
        }
    }

    /**
     * 处理操作按钮
     */
    handleAction(action, event = null) {
        try {
            switch (action) {
                case 'close':
                    this.hide();
                    break;
                case 'save':
                    this.saveSettings();
                    break;
                case 'reset':
                    this.resetSettings();
                    break;
                case 'clear-cache':
                    this.clearAllCaches();
                    break;
                case 'reset-all':
                    this.resetAllSettings();
                    break;
                case 'export':
                    this.exportSettings();
                    break;
                case 'import':
                    this.importSettings();
                    break;
                case 'open-error-log':
                    this.openErrorLogModal();
                    break;
                case 'open-project-link':
                    this.openProjectLink();
                    break;
                case 'save-profile':
                    this.saveSettingsProfile();
                    break;
                case 'load-profile':
                    this.loadSettingsProfile();
                    break;
                case 'delete-profile':
                    this.deleteSettingsProfile();
                    break;
                case 'export-data':
                    console.log('[InfoBarSettings] 🚀 开始执行导出数据...');
                    this.exportData().catch(error => {
                        console.error('[InfoBarSettings] ❌ 导出数据事件处理失败:', error);
                        this.showMessage('导出数据失败: ' + error.message, 'error');
                    });
                    break;
                case 'import-data':
                    console.log('[InfoBarSettings] 🚀 开始执行导入数据...');
                    this.importData().catch(error => {
                        console.error('[InfoBarSettings] ❌ 导入数据事件处理失败:', error);
                        this.showMessage('导入数据失败: ' + error.message, 'error');
                    });
                    break;
                default:
                    console.log(`[InfoBarSettings] 🔘 处理操作: ${action}`);
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理操作失败:', error);
        }
    }

    /**
     * 处理复选框变更
     */
    handleCheckboxChange(e) {
        try {
            const name = e.target.name;
            const checked = e.target.checked;

            console.log(`[InfoBarSettings] ☑️ 复选框变更: ${name} = ${checked}`);

            // 特殊处理API配置开关
            if (name === 'apiConfig.enabled') {
                const apiConfigContent = this.modal.querySelector('.api-config-content');
                if (apiConfigContent) {
                    apiConfigContent.style.display = checked ? 'block' : 'none';
                    console.log(`[InfoBarSettings] 🔌 API配置区域${checked ? '显示' : '隐藏'}`);
                }
            }

            // 如果是主开关，控制相关子项
            if (name && name.includes('.enabled')) {
                const baseName = name.replace('.enabled', '');
                const relatedInputs = this.modal.querySelectorAll(`[name^="${baseName}."]`);
                relatedInputs.forEach(input => {
                    if (input !== e.target) {
                        input.disabled = !checked;
                    }
                });
            }

            // 更新对应面板的配置计数
            this.updatePanelCounts(e.target);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理复选框变更失败:', error);
        }
    }
    /**
     * 创建API配置面板
     */
    createAPIPanel() {
        return `
            <div class="content-header">
                <h3>🔌 自定义API配置</h3>
                <div class="toggle-switch">
                    <input type="checkbox" id="api-enabled" name="apiConfig.enabled" />
                    <label for="api-enabled" class="switch-slider"></label>
                </div>
            </div>

            <div class="content-body">


                <!-- API提供商选择 -->
                <div class="settings-group">
                    <h4>1. 选择API提供商</h4>
                    <div class="form-group">
                        <label>API提供商</label>
                        <select id="api-provider" name="apiConfig.provider">
                            <option value="">请选择提供商</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="custom">自定义API</option>
                        </select>
                        <small>选择您要使用的AI模型提供商</small>
                    </div>
                </div>

                <!-- 接口类型选择 -->
                <div class="settings-group">
                    <h4>2. 选择接口类型</h4>
                    <div class="form-group">
                        <label>接口类型</label>
                        <select id="interface-type" name="apiConfig.format">
                            <option value="">请先选择提供商</option>
                        </select>
                        <small>选择API接口的调用方式</small>
                    </div>
                </div>

                <!-- 基础URL配置 -->
                <div class="settings-group">
                    <h4>3. 基础URL</h4>
                    <div class="form-group">
                        <label>API基础URL</label>
                        <input type="url" id="api-base-url" name="apiConfig.baseUrl" placeholder="https://api.example.com" />
                        <small>API服务的基础地址</small>
                    </div>
                </div>

                <!-- API密钥配置 -->
                <div class="settings-group">
                    <h4>4. API密钥</h4>
                    <div class="form-group">
                        <label>API密钥</label>
                        <input type="password" id="api-key" name="apiConfig.apiKey" placeholder="输入您的API密钥" />
                        <small>从API提供商获取的访问密钥</small>
                    </div>
                </div>

                <!-- 模型选择 -->
                <div class="settings-group">
                    <h4>5. 模型选择</h4>
                    <div class="form-group">
                        <label>AI模型</label>
                        <select id="api-model" name="apiConfig.model">
                            <option value="">请先加载模型列表</option>
                        </select>
                        <small>选择要使用的AI模型</small>
                    </div>
                </div>

                <!-- 加载模型列表按钮 -->
                <div class="settings-group">
                    <h4>6. 加载模型列表</h4>
                    <div class="form-group">
                        <button type="button" id="load-models-btn" class="btn btn-primary">📋 加载模型列表</button>
                        <small>点击加载可用的模型列表</small>
                    </div>
                </div>

                <!-- 测试连接按钮 -->
                <div class="settings-group">
                    <h4>7. 测试连接</h4>
                    <div class="form-group">
                        <button type="button" id="test-connection-btn" class="btn btn-secondary">🔍 测试连接</button>
                        <small>测试API连接是否正常</small>
                    </div>
                </div>

                <!-- 模型参数配置 -->
                <div class="settings-group">
                    <h4>8. 模型参数</h4>
                    <div class="form-group">
                        <label>温度 (0-2)</label>
                        <input type="range" name="apiConfig.temperature" min="0" max="2" step="0.1" value="0.7" />
                        <span class="range-value">0.7</span>
                        <small>控制生成文本的随机性，值越高越随机</small>
                    </div>
                    <div class="form-group">
                        <label>最大令牌数</label>
                        <input type="number" name="apiConfig.maxTokens" min="1" max="100000" step="100" value="2048" />
                        <small>生成文本的最大长度</small>
                    </div>
                </div>

                <!-- 连接设置 -->
                <div class="settings-group">
                    <h4>9. 连接设置</h4>
                    <div class="form-group">
                        <label>请求超时 (秒)</label>
                        <input type="number" name="apiConfig.timeout" min="5" max="300" step="5" value="30" />
                        <small>API请求的超时时间</small>
                    </div>
                    <div class="form-group">
                        <label>重试次数</label>
                        <input type="number" name="apiConfig.retryCount" min="0" max="10" step="1" value="3" />
                        <small>请求失败时的重试次数</small>
                    </div>
                </div>

                <!-- 连接状态显示 -->
                <div class="settings-group">
                    <h4>10. 连接状态</h4>
                    <div class="form-group">
                        <div id="connection-status" class="connection-status">
                            ⏳ 未测试连接
                        </div>
                        <small>显示API连接和模型加载状态</small>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建主题设置面板
     */
    createThemePanel() {
        return `
            <div class="settings-group">
                <h3>🎨 主题预览选择</h3>
                <p class="theme-description">选择您喜欢的主题风格，点击预览图即可应用</p>

                <div class="theme-gallery">
                    ${this.createThemePreviewGrid()}
                </div>
            </div>

            <div class="settings-group">
                <h3>🎭 信息栏风格选择</h3>
                <p class="style-description">选择信息栏的显示方式和布局风格</p>

                <div class="style-gallery">
                    ${this.createStylePreviewGrid()}
                </div>
            </div>



            <div class="settings-group custom-theme-group" style="display: none;">
                <h3>自定义主题</h3>
                <div class="color-picker-group">
                    <div class="form-group">
                        <label>主色调</label>
                        <input type="color" name="theme.custom.primary" value="#007bff" />
                    </div>
                    <div class="form-group">
                        <label>背景色</label>
                        <input type="color" name="theme.custom.background" value="#1a1a1a" />
                    </div>
                    <div class="form-group">
                        <label>文字色</label>
                        <input type="color" name="theme.custom.text" value="#ffffff" />
                    </div>
                    <div class="form-group">
                        <label>边框色</label>
                        <input type="color" name="theme.custom.border" value="#333333" />
                    </div>
                </div>

                <div class="theme-preview">
                    <h4>实时预览</h4>
                    <div class="preview-box custom-preview">
                        <div class="preview-header">示例标题</div>
                        <div class="preview-content">示例内容文字</div>
                        <div class="preview-button">示例按钮</div>
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <h3>字体设置</h3>
                <div class="form-group">
                    <label>字体大小</label>
                    <select name="theme.fontSize" data-linked="infobar.height">
                        <option value="small">小 (12px)</option>
                        <option value="medium" selected>中 (14px)</option>
                        <option value="large">大 (16px)</option>
                        <option value="xlarge">特大 (18px)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>信息栏高度</label>
                    <select name="infobar.height" data-linked="theme.fontSize">
                        <option value="auto">自动 (根据字体)</option>
                        <option value="compact">紧凑 (24px)</option>
                        <option value="normal" selected>标准 (32px)</option>
                        <option value="comfortable">舒适 (40px)</option>
                        <option value="spacious">宽松 (48px)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>字体族</label>
                    <select name="theme.fontFamily">
                        <option value="system" selected>系统默认</option>
                        <option value="serif">衬线字体</option>
                        <option value="sans-serif">无衬线字体</option>
                        <option value="monospace">等宽字体</option>
                        <option value="custom">自定义字体</option>
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * 创建面板管理面板
     */
    createPanelManagementPanel() {
        return `
            <div class="content-header">
                <h3>面板管理</h3>
                <div class="header-actions">
                    <button class="btn-action btn-add" data-action="add-custom-panel">
                        添加自定义面板
                    </button>
                    <button class="btn-action btn-refresh" data-action="refresh-panels">
                        刷新
                    </button>
                </div>
            </div>

            <div class="content-body">
                <!-- 面板管理主体 -->
                <div class="panel-management-container">
                    <!-- 左侧面板列表 -->
                    <div class="panel-list-section">
                        <!-- 面板分类标签 -->
                        <div class="panel-categories">
                            <div class="category-tab active" data-category="all">
                                <span class="category-text">全部面板</span>
                                <span class="category-count">${this.getTotalPanelCount()}</span>
                            </div>
                        </div>

                        <!-- 面板列表 -->
                        <div class="panel-list-container">
                            <div class="panel-list" data-category="all">
                                ${this.createPanelListItems('all')}
                            </div>
                        </div>
                    </div>

                    <!-- 右侧面板属性 -->
                    <div class="panel-properties-section">
                        <div class="properties-header">
                            <h4>面板属性</h4>
                            <div class="properties-actions">
                                <button class="btn-small btn-save" data-action="save-panel-properties" disabled>
                                    <span class="btn-icon">💾</span>
                                    <span class="btn-text">保存</span>
                                </button>
                                <button class="btn-small btn-delete" data-action="delete-panel" disabled>
                                    <span class="btn-icon">🗑️</span>
                                    <span class="btn-text">删除</span>
                                </button>
                            </div>
                        </div>

                        <div class="properties-content">
                            <div class="no-selection-message">
                                <div class="message-icon">🎛️</div>
                                <div class="message-text">请选择一个面板来查看和编辑属性</div>
                            </div>

                            <!-- 面板属性表单（动态生成） -->
                            <div class="panel-properties-form" style="display: none;">
                                ${this.createPanelPropertiesForm()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建总结面板
     */
    createSummaryPanel() {
        return `
            <div class="content-header">
                <h3>📊 总结面板</h3>
                <div class="header-actions">
                    <button class="btn-action btn-manual-summary" id="header-manual-summary-btn">
                        <span class="btn-icon">🖊️</span>
                        <span class="btn-text">手动总结</span>
                    </button>
                    <button class="btn-action btn-refresh" id="header-refresh-summary-btn">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">刷新</span>
                    </button>
                </div>
            </div>

            <div class="content-body">
                <!-- 总结设置区域 -->
                <div class="summary-settings-container">
                    <div class="settings-section">
                        <h4>⚙️ 总结设置</h4>

                        <div class="setting-row">
                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="content-auto-summary-enabled" />
                                    <span class="checkbox-text">启用自动总结</span>
                                </label>
                                <div class="setting-hint">达到设定楼层数后自动生成总结</div>
                            </div>
                        </div>

                        <div class="setting-row">
                            <div class="setting-group">
                                <label class="setting-label">
                                    <input type="checkbox" id="content-inject-summary-enabled" />
                                    <span class="checkbox-text">启用总结注入</span>
                                </label>
                                <div class="setting-hint">将总结内容作为记忆注入给主API，帮助AI保持剧情连贯性</div>
                            </div>
                        </div>

                        <div class="setting-row">
                            <div class="setting-group">
                                <label class="setting-label" for="content-summary-floor-count">总结楼层数</label>
                                <div class="input-group">
                                    <input type="number" id="content-summary-floor-count" min="5" max="100" value="20" />
                                    <span class="input-unit">条消息</span>
                                </div>
                                <div class="setting-hint">每隔多少条消息进行一次总结</div>
                            </div>
                        </div>

                        <div class="setting-row">
                            <div class="setting-group">
                                <label class="setting-label" for="content-summary-type">总结类型</label>
                                <select id="content-summary-type" class="setting-select">
                                    <option value="small">小总结 (约150字)</option>
                                    <option value="large">大总结 (约400字)</option>
                                    <option value="custom">自定义字数</option>
                                </select>
                            </div>
                        </div>

                        <div class="setting-row" id="content-custom-word-count-row" style="display: none;">
                            <div class="setting-group">
                                <label class="setting-label" for="content-summary-word-count">总结字数</label>
                                <div class="input-group">
                                    <input type="number" id="content-summary-word-count" min="50" max="1000" value="300" />
                                    <span class="input-unit">字</span>
                                </div>
                                <div class="setting-hint">自定义总结的字数范围</div>
                            </div>
                        </div>

                        <div class="setting-actions">
                            <button class="btn-primary" id="content-save-settings-btn">
                                <span class="btn-icon">💾</span>
                                <span class="btn-text">保存设置</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 总结历史区域 -->
                <div class="summary-history-container">
                    <div class="history-section">
                        <h4>📚 总结历史</h4>
                        <div class="history-selector-group">
                            <label class="setting-label" for="content-summary-history-select">选择总结记录</label>
                            <div class="history-select-row">
                                <select id="content-summary-history-select" class="setting-select summary-history-select">
                                    <option value="">请选择要查看的总结记录</option>
                                </select>
                                <button id="content-delete-summary-btn" class="btn btn-small" title="删除当前选择的总结">🗑️ 删除</button>
                            </div>
                            <div class="setting-hint">选择总结记录后，下方将显示详细内容</div>
                        </div>
                    </div>
                </div>

                <!-- 总结内容查看区域 -->
                <div class="summary-content-container" id="content-summary-content-section" style="display: none;">
                    <div class="content-section">
                        <div class="content-header-info">
                            <h4>📄 总结内容</h4>
                            <div class="content-meta">
                                <span class="content-title" id="content-summary-title"></span>
                                <span class="content-date" id="content-summary-date"></span>
                            </div>
                        </div>
                        <div class="content-body-text" id="content-summary-content-body"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 获取面板总数
     */
    getTotalPanelCount() {
        return this.getBasicPanelCount() + this.getCustomPanelCount();
    }

    /**
     * 获取基础面板数量
     */
    getBasicPanelCount() {
        const basicPanels = [
            // 移除基础设置面板，它是系统设置，不是面板
            'personal', 'interaction', 'tasks', 'world', 'organization',
            'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy',
            'modern', 'historical', 'magic', 'training'
        ];
        return basicPanels.length;
    }

    /**
     * 获取自定义面板数量
     */
    getCustomPanelCount() {
        // 从配置中获取自定义面板数量
        const customPanels = this.getCustomPanels();
        return Object.keys(customPanels).length;
    }

    /**
     * 获取自定义面板配置
     */
    getCustomPanels() {
        try {
            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 获取自定义面板数据
            const customPanels = extensionSettings['Information bar integration tool'].customPanels || {};

            // 同步到全局变量（保持兼容性）
            window.InfoBarCustomPanels = customPanels;

            console.log('[InfoBarSettings] 📊 获取自定义面板配置:', customPanels);
            return customPanels;
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取自定义面板配置失败:', error);
            return window.InfoBarCustomPanels || {};
        }
    }

    /**
     * 生成唯一的面板键名
     */
    generateUniqueKey(customPanels) {
        try {
            // 获取所有现有的键名
            const existingKeys = Object.values(customPanels).map(panel => panel.key).filter(key => key);

            console.log('[InfoBarSettings] 🔍 现有键名:', existingKeys);

            // 如果没有自定义面板，返回 'Custom'
            if (existingKeys.length === 0) {
                return 'Custom';
            }

            // 检查 'Custom' 是否已存在
            if (!existingKeys.includes('Custom')) {
                return 'Custom';
            }

            // 查找下一个可用的数字后缀
            let counter = 1;
            let newKey;
            do {
                newKey = `Custom${counter}`;
                counter++;
            } while (existingKeys.includes(newKey));

            console.log('[InfoBarSettings] ✅ 生成唯一键名:', newKey);
            return newKey;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 生成唯一键名失败:', error);
            // 备用方案：使用时间戳
            return `Custom_${Date.now()}`;
        }
    }

    /**
     * 🔧 迁移时间戳ID面板到键名ID
     */
    migrateTimestampIdPanels() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const customPanels = configs.customPanels || {};

            console.log('[InfoBarSettings] 🔄 开始迁移时间戳ID面板到键名ID');

            const migratedPanels = {};
            let migratedCount = 0;

            Object.entries(customPanels).forEach(([panelId, panel]) => {
                // 检查是否是时间戳ID格式（custom_数字）
                if (panelId.startsWith('custom_') && /^custom_\d+$/.test(panelId)) {
                    console.log(`[InfoBarSettings] 🔄 迁移面板: ${panelId} -> ${panel.key}`);

                    // 更新面板的ID为键名
                    panel.id = panel.key;

                    // 使用键名作为存储键
                    migratedPanels[panel.key] = panel;
                    migratedCount++;
                } else {
                    // 保持现有的面板
                    migratedPanels[panelId] = panel;
                }
            });

            if (migratedCount > 0) {
                // 更新配置
                extensionSettings['Information bar integration tool'].customPanels = migratedPanels;

                // 保存配置
                context.saveSettingsDebounced();

                console.log(`[InfoBarSettings] ✅ 成功迁移 ${migratedCount} 个面板到键名ID`);
                return migratedCount;
            } else {
                console.log('[InfoBarSettings] ℹ️ 没有需要迁移的时间戳ID面板');
                return 0;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 迁移时间戳ID面板失败:', error);
            return 0;
        }
    }

    /**
     * 修复重复键名问题
     */
    async fixDuplicateKeys() {
        try {
            console.log('[InfoBarSettings] 🔧 开始修复重复键名问题...');

            const customPanels = this.getCustomPanels();
            const keyCount = {};
            const duplicateKeys = [];

            // 统计键名使用次数
            for (const [panelId, panel] of Object.entries(customPanels)) {
                const key = panel.key;
                if (key) {
                    keyCount[key] = (keyCount[key] || 0) + 1;
                    if (keyCount[key] > 1) {
                        duplicateKeys.push(key);
                    }
                }
            }

            console.log('[InfoBarSettings] 📊 键名统计:', keyCount);
            console.log('[InfoBarSettings] ⚠️ 重复键名:', duplicateKeys);

            if (duplicateKeys.length === 0) {
                console.log('[InfoBarSettings] ✅ 没有发现重复键名');
                return;
            }

            // 修复重复键名
            let fixedCount = 0;
            for (const [panelId, panel] of Object.entries(customPanels)) {
                const key = panel.key;
                if (duplicateKeys.includes(key)) {
                    // 为重复的键名生成新的唯一键名
                    const newKey = this.generateUniqueKey(customPanels);
                    panel.key = newKey;
                    customPanels[panelId] = panel;
                    fixedCount++;

                    console.log(`[InfoBarSettings] 🔧 修复面板 ${panelId}: ${key} -> ${newKey}`);

                    // 更新customPanels以避免后续冲突
                    break; // 一次只修复一个，然后重新检查
                }
            }

            if (fixedCount > 0) {
                // 保存修复后的配置
                await this.saveAllCustomPanels(customPanels);
                console.log(`[InfoBarSettings] ✅ 已修复 ${fixedCount} 个重复键名`);

                // 递归修复剩余的重复键名
                await this.fixDuplicateKeys();
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 修复重复键名失败:', error);
        }
    }
    /**
     * 保存所有自定义面板配置
     */
    async saveAllCustomPanels(customPanels) {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            extensionSettings['Information bar integration tool'].customPanels = customPanels;

            // 保存到SillyTavern
            await context.saveSettingsDebounced();

            // 同步到全局变量
            window.InfoBarCustomPanels = customPanels;

            console.log('[InfoBarSettings] ✅ 所有自定义面板配置已保存');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存所有自定义面板配置失败:', error);
            throw error;
        }
    }

    /**
     * 创建面板列表项
     */
    createPanelListItems(category) {
        let panels = [];

        if (category === 'all' || category === 'basic') {
            panels = panels.concat(this.getBasicPanelItems());
        }

        if (category === 'all' || category === 'custom') {
            panels = panels.concat(this.getCustomPanelItems());
        }

        if (panels.length === 0) {
            return `
                <div class="empty-panel-list">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">暂无${category === 'custom' ? '自定义' : ''}面板</div>
                </div>
            `;
        }

        return panels.map(panel => this.createPanelListItem(panel)).join('');
    }

    /**
     * 获取基础面板项
     */
    getBasicPanelItems() {
        const basicPanels = [
            // 移除基础设置面板，它是系统设置，不是面板
                    { id: 'personal', name: '个人信息', icon: '👤', type: 'basic' },
        { id: 'interaction', name: '交互对象', icon: '👥', type: 'basic' },
        { id: 'tasks', name: '任务系统', icon: '📋', type: 'basic' },
        { id: 'world', name: '世界设定', icon: '🌍', type: 'basic' },
        { id: 'organization', name: '组织架构', icon: '🏢', type: 'basic' },
        { id: 'news', name: '新闻事件', icon: '📰', type: 'basic' },
        { id: 'inventory', name: '物品清单', icon: '🎒', type: 'basic' },
        { id: 'abilities', name: '能力技能', icon: '⚡', type: 'basic' },
        { id: 'plot', name: '剧情发展', icon: '📖', type: 'basic' },
        { id: 'cultivation', name: '修炼系统', icon: '🧘', type: 'basic' },
        { id: 'fantasy', name: '玄幻世界', icon: '🔮', type: 'basic' },
        { id: 'modern', name: '现代都市', icon: '🏙️', type: 'basic' },
        { id: 'historical', name: '历史古代', icon: '🏛️', type: 'basic' },
        { id: 'magic', name: '魔法能力', icon: '🪄', type: 'basic' },
        { id: 'training', name: '调教系统', icon: '🎯', type: 'basic' }
        ];

        return basicPanels;
    }

    /**
     * 获取自定义面板项
     */
    getCustomPanelItems() {
        const customPanels = this.getCustomPanels();
        return Object.values(customPanels).map(panel => ({
            ...panel,
            type: 'custom'
        }));
    }

    /**
     * 创建单个面板列表项
     */
    createPanelListItem(panel) {
        const typeClass = panel.type === 'custom' ? 'custom-panel' : 'basic-panel';

        return `
            <div class="panel-list-item ${typeClass}" data-panel-id="${panel.id}" data-panel-type="${panel.type}">
                <div class="panel-item-info">
                    <div class="panel-item-name">${panel.name}</div>
                    <div class="panel-item-meta">
                        <span class="panel-type">（${panel.type === 'custom' ? '自定义' : '基础'}）</span>
                    </div>
                </div>
                <div class="panel-item-actions">
                    ${panel.type === 'custom' ? `
                        <button class="btn-icon" data-action="edit-panel" data-panel-id="${panel.id}" title="编辑">
                            编辑
                        </button>
                        <button class="btn-icon" data-action="duplicate-panel" data-panel-id="${panel.id}" title="复制">
                            复制
                        </button>
                    ` : `
                        <button class="btn-icon" data-action="view-panel" data-panel-id="${panel.id}" title="查看">
                            查看
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * 创建面板属性表单
     */
    createPanelPropertiesForm() {
        return `
            <div class="properties-form">
                <!-- 基本信息 -->
                <div class="form-section">
                    <h5>基本信息</h5>
                    <div class="form-group">
                        <label for="panel-name">面板名称</label>
                        <input type="text" id="panel-name" name="panel.name" placeholder="请输入面板名称" />
                    </div>
                    <div class="form-group">
                        <label for="panel-key">键名</label>
                        <input type="text" id="panel-key" name="panel.key" placeholder="请输入键名（用于配置存储）" />
                        <div class="form-hint">键名用于配置存储，建议使用英文和下划线</div>
                    </div>
                    <div class="form-group">
                        <label for="panel-description">面板说明</label>
                        <textarea id="panel-description" name="panel.description" rows="3" placeholder="请输入面板说明"></textarea>
                    </div>
                </div>

                <!-- 配置选项 -->
                <div class="form-section">
                    <h5>配置选项</h5>
                    <div class="form-group checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="panel-required" name="panel.required" />
                            <span>是否必填</span>
                        </label>
                    </div>
                    <div class="form-group checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="panel-memory-inject" name="panel.memoryInject" />
                            <span>是否注入记忆</span>
                        </label>
                    </div>

                </div>

                <!-- 提示词配置 -->
                <div class="form-section">
                    <h5>提示词配置</h5>
                    <div class="form-group">
                        <label for="panel-prompt-init">初始化提示词</label>
                        <textarea id="panel-prompt-init" name="panel.prompts.init" rows="3" placeholder="面板初始化时使用的提示词"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="panel-prompt-insert">插入提示词</label>
                        <textarea id="panel-prompt-insert" name="panel.prompts.insert" rows="3" placeholder="插入数据时使用的提示词"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="panel-prompt-update">更新提示词</label>
                        <textarea id="panel-prompt-update" name="panel.prompts.update" rows="3" placeholder="更新数据时使用的提示词"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="panel-prompt-delete">删除提示词</label>
                        <textarea id="panel-prompt-delete" name="panel.prompts.delete" rows="3" placeholder="删除数据时使用的提示词"></textarea>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="form-section">
                    <h5>子项配置</h5>
                    <div class="sub-items-header">
                        <span>子项列表</span>
                        <button type="button" class="btn-small btn-add-sub-item" data-action="add-sub-item">
                            <span class="btn-icon" style="pointer-events: none;">➕</span>
                            <span class="btn-text" style="pointer-events: none;">新增子项</span>
                        </button>
                    </div>
                    <div class="sub-items-container">
                        <div class="empty-sub-items">
                            <div class="empty-icon">📝</div>
                            <div class="empty-text">暂无子项，点击"新增子项"添加</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建前端显示面板
     */
    createFrontendDisplayPanel() {
        return `
            <div class="settings-group">
                <h3>🖥️ 前端显示设置</h3>
                <p class="frontend-description">启用前端显示后，AI消息将包裹在信息栏框架中，提供交互式的面板和子项显示</p>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="frontendDisplay.enabled" />
                        <span>启用前端显示</span>
                    </label>
                    <p class="help-text">启用后，AI消息区域将显示交互式的信息栏预览界面</p>
                </div>
            </div>

            <div class="settings-group frontend-display-config" style="display: none;">
                <h3>📊 显示配置</h3>
                
                <div class="form-group">
                    <label>显示样式</label>
                    <select name="frontendDisplay.style">
                        <option value="left">左对齐</option>
                        <option value="center">居中显示</option>
                        <option value="right">右对齐</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="frontendDisplay.showAddButtons" checked />
                        <span>显示添加按钮</span>
                    </label>
                    <p class="help-text">在预览窗口上下方显示可点击的添加框框</p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="frontendDisplay.animationEnabled" checked />
                        <span>启用动画效果</span>
                    </label>
                </div>
            </div>

            <div class="settings-group frontend-display-preview" style="display: none;">
                <h3>🎮 交互预览</h3>
                <p class="preview-description">预览前端显示的交互效果</p>
                
                <div class="frontend-preview-container">
                    <!-- 顶部预览区域 -->
                    <div class="preview-section">
                        <h4>🔝 顶部预览内容</h4>
                        <div class="ai-message-wrapper top-preview">
                            <div class="add-panel-slots top-slots">
                                <div class="add-slot" data-position="top-1" data-area="top">+</div>
                                <div class="add-slot" data-position="top-2" data-area="top">+</div>
                                <div class="add-slot" data-position="top-3" data-area="top">+</div>
                            </div>
                            
                            <div class="embedded-panels top-embedded-panels">
                                <!-- 用户添加的顶部面板和子项将显示在这里 -->
                            </div>
                        </div>
                    </div>

                    <!-- AI消息内容 -->
                    <div class="ai-message-preview">
                        <div class="message-content">
                            <p>这是AI消息的预览内容...</p>
                        </div>
                    </div>

                    <!-- 底部预览区域 -->
                    <div class="preview-section">
                        <h4>🔽 底部预览内容</h4>
                        <div class="ai-message-wrapper bottom-preview">
                            <div class="embedded-panels bottom-embedded-panels">
                                <!-- 用户添加的底部面板和子项将显示在这里 -->
                            </div>
                            
                            <div class="add-panel-slots bottom-slots">
                                <div class="add-slot" data-position="bottom-1" data-area="bottom">+</div>
                                <div class="add-slot" data-position="bottom-2" data-area="bottom">+</div>
                                <div class="add-slot" data-position="bottom-3" data-area="bottom">+</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                                    <div class="preview-actions">
                        <button class="btn" data-action="test-panel-popup">测试面板弹窗</button>
                        <button class="btn" data-action="test-add-panel">测试添加面板</button>
                        <button class="btn" data-action="clear-preview">清空预览</button>
                    </div>
            </div>


        `;
    }

    /**
     * 创建高级设置面板
     */
    createAdvancedPanel() {
        return `
            <div class="settings-group">
                <h3>调试设置</h3>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="debug.enabled" />
                        <span>启用调试模式</span>
                    </label>
                </div>
                <div class="form-group">
                    <label>日志级别</label>
                    <select name="debug.logLevel">
                        <option value="error">错误</option>
                        <option value="warn">警告</option>
                        <option value="info">信息</option>
                        <option value="debug">调试</option>
                    </select>
                </div>
                <div class="form-group debug-actions-row">
                    <button class="btn" data-action="open-error-log">错误日志</button>
                    <button class="btn" data-action="open-project-link">项目地址</button>
                </div>
            </div>
            
            <div class="settings-group">
                <h3>配置管理</h3>
                <div class="form-group">
                    <label>保存为配置名称</label>
                    <input type="text" id="config-profile-name" placeholder="输入配置名称" />
                </div>
                <div class="form-group config-primary-actions">
                    <button class="btn" data-action="save-profile">保存配置</button>
                    <button class="btn" data-action="export">导出配置</button>
                    <button class="btn" data-action="import">导入配置</button>
                </div>
                <div class="form-group">
                    <label>已保存的配置</label>
                    <div class="config-row">
                        <select id="config-profile-select" class="setting-select">
                            <option value="">请选择一个配置</option>
                        </select>
                        <div class="config-row-actions">
                            <button class="btn btn-small" data-action="load-profile">加载配置</button>
                            <button class="btn btn-small" data-action="delete-profile">删除配置</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-group">
                <h3>数据管理</h3>
                <div class="form-group">
                    <label>数据范围</label>
                    <select id="data-scope-select" name="dataManagement.scope">
                        <option value="current">当前聊天</option>
                        <option value="all">所有聊天</option>
                    </select>
                    <small>选择要导出或导入的数据范围</small>
                </div>
                <div class="form-group">
                    <label>数据格式</label>
                    <select id="data-format-select" name="dataManagement.format">
                        <option value="json">JSON格式</option>
                        <option value="csv">CSV格式</option>
                        <option value="xml">XML格式</option>
                    </select>
                    <small>选择导出或导入的数据格式</small>
                </div>
                <div class="form-group">
                    <div class="data-management-actions">
                        <button class="btn btn-primary data-export-btn" data-action="export-data">
                            📤 导出数据
                        </button>
                        <button class="btn btn-secondary data-import-btn" data-action="import-data">
                            📥 导入数据
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <small class="data-management-hint">
                        💡 导出功能将包含聊天信息、消息记录和信息栏数据。导入前请确保数据格式正确。
                    </small>
                </div>
            </div>

            <div class="settings-group danger-zone">
                <h3>危险操作</h3>
                <div class="form-group">
                    <button class="btn btn-danger" data-action="clear-cache">清除所有缓存</button>
                    <button class="btn btn-danger" data-action="reset-all">重置所有设置</button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        try {
            // 模态框事件
            this.modal.addEventListener('click', (e) => {
                const actionEl = e.target.closest('[data-action]');
                const action = actionEl?.dataset?.action;

                if (action) {
                    console.log('[InfoBarSettings] 🔘 处理操作:', action, '元素:', actionEl);
                    console.log('[InfoBarSettings] 🔍 Switch语句即将处理action:', action);
                }

                switch (action) {
                    case 'close':
                    case 'cancel':
                        this.hide();
                        break;
                    case 'save':
                        this.saveSettings();
                        break;
                    case 'reset':
                        this.resetSettings();
                        break;
                    case 'export':
                        this.exportSettings();
                        break;
                    case 'import':
                        this.importSettings();
                        break;
                    case 'test-api':
                        this.testAPIConnection();
                        break;
                    case 'load-models':
                        this.loadAPIModels();
                        break;
                    case 'open-error-log':
                        this.openErrorLogModal();
                        break;
                    case 'open-project-link':
                        this.openProjectLink();
                        break;
                    case 'save-profile':
                        this.saveSettingsProfile();
                        break;
                    case 'load-profile':
                        this.loadSettingsProfile();
                        break;
                    case 'delete-profile':
                        this.deleteSettingsProfile();
                        break;
                    case 'export-data':
                        console.log('[InfoBarSettings] 🚀 开始执行导出数据...');
                        this.exportData().catch(error => {
                            console.error('[InfoBarSettings] ❌ 导出数据事件处理失败:', error);
                            this.showMessage('导出数据失败: ' + error.message, 'error');
                        });
                        break;
                    case 'import-data':
                        console.log('[InfoBarSettings] 🚀 开始执行导入数据...');
                        this.importData().catch(error => {
                            console.error('[InfoBarSettings] ❌ 导入数据事件处理失败:', error);
                            this.showMessage('导入数据失败: ' + error.message, 'error');
                        });
                        break;
                    default:
                        if (action) {
                            console.log('[InfoBarSettings] ⚠️ 未处理的操作:', action);
                        }
                        break;
                }
            });
            
            // 标签页切换
            this.modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-btn')) {
                    this.switchTab(e.target.dataset.tab);
                }
            });
            
            // 表单变更事件
            this.modal.addEventListener('change', (e) => {
                this.handleFormChange(e);
            });
            
            // 范围输入实时更新
            this.modal.addEventListener('input', (e) => {
                if (e.target.type === 'range') {
                    const valueSpan = e.target.nextElementSibling;
                    if (valueSpan && valueSpan.classList.contains('range-value')) {
                        valueSpan.textContent = e.target.value;
                    }
                }
            });
            
            console.log('[InfoBarSettings] 🔗 事件绑定完成');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 绑定事件失败:', error);
            throw error;
        }
    }

    /**
     * 初始化所有基础面板的自定义子项显示
     */
    initAllBasicPanelCustomSubItems() {
        try {
            const basicPanelIds = ['personal', 'interaction', 'tasks', 'world', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];
            
            basicPanelIds.forEach(panelId => {
                const panelData = this.getBasicPanelData(panelId);
                if (panelData && panelData.subItems && panelData.subItems.length > 0) {
                    this.refreshBasicPanelContent(panelId);
                    console.log(`[InfoBarSettings] 🔄 已初始化基础面板 ${panelId} 的自定义子项显示`);
                }
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 初始化基础面板自定义子项失败:', error);
        }
    }

    /**
     * 显示设置界面
     */
    async show() {
        try {
            if (!this.initialized) {
                await this.init();
            }

            // 只在首次显示或明确需要刷新时加载设置
            if (!this.settingsLoaded || this.needsSettingsRefresh) {
                console.log('[InfoBarSettings] 📥 加载最新设置...');
                await this.loadSettings();
                this.settingsLoaded = true;
                this.needsSettingsRefresh = false;
            } else {
                console.log('[InfoBarSettings] 📋 使用已缓存的设置');
            }

            // 确保数据管理样式已加载
            this.ensureDataManagementStyles();

            // 显示模态框
            this.modal.style.display = 'flex';
            this.visible = true;

            // 🔧 修复：延迟初始化基础面板自定义子项，确保DOM已准备好
            setTimeout(() => {
                this.initAllBasicPanelCustomSubItems();
                // 刷新已保存配置下拉
                this.refreshProfilesSelect();
                // 应用调试级别到控制台
                const enabled = this.modal.querySelector('[name="debug.enabled"]')?.checked;
                const level = this.modal.querySelector('[name="debug.logLevel"]').value || 'info';
                this.applyConsoleLogLevel(enabled ? level : 'none');
            }, 100); // 100ms延迟确保DOM渲染完成

            // 触发显示事件
            if (this.eventSystem) {
                this.eventSystem.emit('ui:show', {
                    component: 'InfoBarSettings',
                    timestamp: Date.now()
                });
            }

            console.log('[InfoBarSettings] 👁️ 设置界面已显示');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示界面失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 隐藏设置界面
     */
    hide() {
        try {
            this.modal.style.display = 'none';
            this.visible = false;
            
            // 触发隐藏事件
            if (this.eventSystem) {
                this.eventSystem.emit('ui:hide', {
                    component: 'InfoBarSettings',
                    timestamp: Date.now()
                });
            }
            
            console.log('[InfoBarSettings] 👁️ 设置界面已隐藏');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 隐藏界面失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 切换标签页
     */
    switchTab(tabName) {
        try {
            // 更新标签按钮状态
            this.modal.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
            
            // 更新面板显示状态
            this.modal.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.panel === tabName);
            });
            
            this.currentTab = tabName;
            
            console.log(`[InfoBarSettings] 📑 切换到标签页: ${tabName}`);
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换标签页失败:', error);
            this.handleError(error);
        }
    }
    /**
     * 加载设置到表单
     */
    async loadSettings() {
        try {
            console.log('[InfoBarSettings] 📥 开始加载设置...');

            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            const configs = extensionSettings['Information bar integration tool'];

            // 特别处理前端显示配置，确保从FrontendDisplayManager读取最新状态
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
                            if (fdm) {
                const frontendDisplayConfig = await fdm.getSavedFrontendDisplayConfig();
                if (frontendDisplayConfig) {
                    configs.frontendDisplay = frontendDisplayConfig;
                    console.log('[InfoBarSettings] 📱 已加载前端显示配置:', frontendDisplayConfig);
                    
                    // 🔧 修复：重新渲染预览内容
                    this.renderFrontendDisplayPreview(frontendDisplayConfig);
                }
            }

            // 填充表单 - 递归处理嵌套对象
            this.loadNestedConfigs(configs);

            // 根据加载的前端显示启用状态，设置UI区域的显示/隐藏
            if (configs.frontendDisplay && typeof configs.frontendDisplay.enabled === 'boolean') {
                this.toggleFrontendDisplaySections(configs.frontendDisplay.enabled);
                console.log('[InfoBarSettings] 🖥️ 前端显示区域状态已设置:', configs.frontendDisplay.enabled);
            }

            // 特别处理自定义面板配置，确保设置到全局变量
            if (configs.customPanels && typeof configs.customPanels === 'object') {
                window.InfoBarCustomPanels = configs.customPanels;
                console.log('[InfoBarSettings] 📊 已加载自定义面板配置:', Object.keys(configs.customPanels).length, '个面板');

                // 打印详细的面板信息用于调试
                for (const [panelId, panel] of Object.entries(configs.customPanels)) {
                    console.log(`[InfoBarSettings] 📋 面板 ${panelId}:`, panel.name, panel.enabled ? '(启用)' : '(禁用)');
                }

                // 设置自定义面板子项的勾选状态
                this.loadCustomPanelSubItemStates(configs.customPanels);
            } else {
                // 如果没有自定义面板配置，初始化为空对象
                window.InfoBarCustomPanels = {};
                console.log('[InfoBarSettings] 📊 初始化空的自定义面板配置');
            }

            // 🔧 新增：加载基础面板子项的勾选状态
            this.loadBasicPanelSubItemStates(configs);

            // 特别处理主题配置
            if (configs.theme && configs.theme.current) {
                const themeId = configs.theme.current;
                console.log('[InfoBarSettings] 🎨 加载主题配置:', themeId);

                // 更新主题卡片状态
                this.updateThemeCardStates(themeId);

                // 应用主题
                const theme = this.getThemeById(themeId);
                if (theme) {
                    this.applyTheme(theme);
                    this.updateCurrentThemeInfo(theme);
                }
            }

            // 特别处理风格配置
            if (configs.style && configs.style.current) {
                const styleId = configs.style.current;
                console.log('[InfoBarSettings] 🎭 加载风格配置:', styleId);

                // 更新风格卡片状态
                this.updateStyleCardStates(styleId);

                // 应用风格
                const style = this.getStyleById(styleId);
                if (style) {
                    this.applyStyle(style);
                    this.updateCurrentStyleInfo(style);
                }
            }

            // 更新API状态
            if (this.apiIntegration) {
                this.updateAPIStatus();
            }

            // 特别处理API模型配置 - 如果有保存的模型配置，自动加载模型列表
            if (configs.apiConfig && configs.apiConfig.model && configs.apiConfig.provider && configs.apiConfig.apiKey) {
                console.log('[InfoBarSettings] 🔄 检测到保存的模型配置，自动加载模型列表...');
                console.log('[InfoBarSettings] 📋 保存的模型:', configs.apiConfig.model);
                console.log('[InfoBarSettings] 🏢 提供商:', configs.apiConfig.provider);

                // 延迟执行，确保UI已完全渲染
                setTimeout(async () => {
                    try {
                        await this.loadModelList();
                        // 加载完成后，恢复保存的模型选择
                        const modelSelect = this.modal.querySelector('#api-model');
                        if (modelSelect && configs.apiConfig.model) {
                            modelSelect.value = configs.apiConfig.model;
                            console.log('[InfoBarSettings] ✅ 已恢复保存的模型选择:', configs.apiConfig.model);
                        }
                    } catch (error) {
                        console.error('[InfoBarSettings] ❌ 自动加载模型列表失败:', error);
                    }
                }, 500);
            }

            // 刷新导航栏（加载自定义面板）
            this.refreshNavigation();

            // 更新所有面板的配置计数
            this.updateAllPanelCounts();

            console.log('[InfoBarSettings] ✅ 设置加载完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载设置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 递归加载嵌套配置
     */
    loadNestedConfigs(configs, prefix = '') {
        try {
            for (const [key, value] of Object.entries(configs)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // 递归处理嵌套对象
                    this.loadNestedConfigs(value, fullKey);
                } else {
                    // 设置表单值
                    this.setFormValue(fullKey, value);
                }
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载嵌套配置失败:', error);
        }
    }

    /**
     * 设置表单值
     */
    setFormValue(name, value) {
        try {
            const element = this.modal.querySelector(`[name="${name}"]`);

            if (!element) {
                return;
            }

            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'range') {
                element.value = value;
                const valueSpan = element.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    valueSpan.textContent = value;
                }
            } else {
                // 特殊处理接口类型选择器
                if (name === 'apiConfig.format' && element.id === 'interface-type') {
                    // 如果是接口类型选择器，需要先触发提供商变更来生成选项
                    const providerElement = this.modal.querySelector('[name="apiConfig.provider"]');
                    if (providerElement && providerElement.value) {
                        this.handleProviderChange(providerElement.value);
                        // 延迟设置值，等待选项生成
                        setTimeout(() => {
                            element.value = value || '';
                        }, 100);
                    } else {
                        element.value = value || '';
                    }
                } else {
                    element.value = value || '';
                }
            }

        } catch (error) {
            console.error(`[InfoBarSettings] ❌ 设置表单值失败 (${name}):`, error);
        }
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            console.log('[InfoBarSettings] 💾 开始保存设置...');

            // 收集表单数据
            const formData = this.collectFormData();

            // 确保自定义面板数据包含在保存的配置中，并更新子项勾选状态
            const customPanels = this.getCustomPanels();
            if (customPanels && Object.keys(customPanels).length > 0) {
                // 更新自定义面板子项的勾选状态
                this.updateCustomPanelSubItemStates(customPanels, formData);
                formData.customPanels = customPanels;
                console.log('[InfoBarSettings] 📊 包含自定义面板数据:', Object.keys(customPanels).length, '个面板');
            }

            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 🔧 修复：完全保护基础面板属性配置，避免被基础设置页面覆盖
            // 基础面板的属性配置（description、icon、required、memoryInject、prompts等）
            // 应该只通过面板管理页面修改，不应该被基础设置页面的表单数据覆盖
            const basicPanelIds = ['personal', 'interaction', 'tasks', 'world', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];
            const preservedBasicPanelConfigs = {};
            
            // 完整备份所有基础面板配置
            basicPanelIds.forEach(panelId => {
                const existingConfig = extensionSettings['Information bar integration tool'][panelId];
                if (existingConfig) {
                    preservedBasicPanelConfigs[panelId] = { ...existingConfig };
                    console.log(`[InfoBarSettings] 🛡️ 保护基础面板 ${panelId} 的完整属性配置`);
                }
            });

            // 保存基础设置表单数据（不包含基础面板属性）
            Object.assign(extensionSettings['Information bar integration tool'], formData);
            
            // 🔧 修复：智能恢复基础面板属性配置，保留子项启用状态
            Object.keys(preservedBasicPanelConfigs).forEach(panelId => {
                const currentConfig = extensionSettings['Information bar integration tool'][panelId];
                const preservedConfig = preservedBasicPanelConfigs[panelId];
                
                // 合并配置：保留新的子项启用状态和面板启用状态，恢复其他属性
                if (currentConfig && preservedConfig) {
                    // 备份当前的子项启用状态和面板启用状态（来自formData）
                    const currentSubItemStates = {};
                    const currentPanelEnabled = currentConfig.enabled; // 保留面板的enabled状态

                    if (currentConfig && typeof currentConfig === 'object') {
                        Object.keys(currentConfig).forEach(key => {
                            if (key !== 'enabled' && typeof currentConfig[key] === 'object' &&
                                currentConfig[key] && typeof currentConfig[key].enabled === 'boolean') {
                                currentSubItemStates[key] = currentConfig[key];
                            }
                        });
                    }

                    // 恢复基础面板属性配置
                    extensionSettings['Information bar integration tool'][panelId] = { ...preservedConfig };

                    // 🔧 修复：重新应用面板的enabled状态
                    if (typeof currentPanelEnabled === 'boolean') {
                        extensionSettings['Information bar integration tool'][panelId].enabled = currentPanelEnabled;
                    }

                    // 重新应用子项启用状态
                    Object.keys(currentSubItemStates).forEach(subItemKey => {
                        const existingSubItem = extensionSettings['Information bar integration tool'][panelId][subItemKey];
                        if (!existingSubItem || typeof existingSubItem !== 'object' || Array.isArray(existingSubItem)) {
                            extensionSettings['Information bar integration tool'][panelId][subItemKey] = {};
                        }
                        extensionSettings['Information bar integration tool'][panelId][subItemKey].enabled = currentSubItemStates[subItemKey].enabled;
                    });

                    console.log(`[InfoBarSettings] 🔄 智能恢复基础面板 ${panelId} 的属性配置，保留面板启用状态: ${currentPanelEnabled}，保留 ${Object.keys(currentSubItemStates).length} 个子项状态`);
                } else {
                    // 如果没有当前配置，直接恢复旧配置
                    extensionSettings['Information bar integration tool'][panelId] = preservedBasicPanelConfigs[panelId];
                    console.log(`[InfoBarSettings] 🔄 完全恢复基础面板 ${panelId} 的属性配置`);
                }
            });

            // 触发 SillyTavern 保存设置
            context.saveSettingsDebounced();

            // 触发面板配置变更事件，通知数据表格更新
            if (this.eventSystem) {
                this.eventSystem.emit('panel:config:changed', {
                    timestamp: Date.now(),
                    formData: formData
                });
                console.log('[InfoBarSettings] 📋 已触发面板配置变更事件');
            }

            // 如果API配置有变化，更新API集成
            if (this.hasAPIConfigChanged(formData)) {
                await this.apiIntegration.updateConfig(formData.apiConfig || {});
            }

            // 标记需要刷新设置
            this.needsSettingsRefresh = true;

            // 立即隐藏界面
            this.hide();

            // 显示成功消息
            this.showMessage('设置保存成功', 'success');
            
            // 🔧 修复：只有在前端显示功能启用时才检查并重新包装AI消息
            setTimeout(() => {
                // 检查前端显示功能是否启用
                const configManager = window.SillyTavernInfobar?.modules?.configManager;
                if (configManager) {
                    const frontendConfig = configManager.getFrontendDisplayConfig();
                    if (frontendConfig && frontendConfig.enabled) {
                        console.log('[InfoBarSettings] 🔄 前端显示功能已启用，检查AI消息包装状态');
                        this.ensureAIMessagesWrapped();
                    } else {
                        console.log('[InfoBarSettings] ⏹️ 前端显示功能已禁用，跳过AI消息包装检查');
                    }
                } else {
                    console.warn('[InfoBarSettings] ⚠️ 未找到配置管理器，跳过AI消息包装检查');
                }
            }, 500);

            console.log('[InfoBarSettings] ✅ 设置保存完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存设置失败:', error);
            this.showMessage('保存设置失败: ' + error.message, 'error');
            this.handleError(error);
        }
    }

    /**
     * 收集表单数据
     */
    collectFormData() {
        const formData = {};

        // 获取所有表单元素
        const elements = this.modal.querySelectorAll('input, select, textarea');

        elements.forEach(element => {
            const name = element.name;
            if (!name) return;

            let value;
            if (element.type === 'checkbox') {
                value = element.checked;
            } else if (element.type === 'number' || element.type === 'range') {
                value = parseFloat(element.value) || 0;
            } else {
                value = element.value;
            }

            // 处理嵌套属性
            if (name.includes('.')) {
                this.setNestedProperty(formData, name, value);
            } else {
                formData[name] = value;
            }
        });

        // 收集当前选中的主题
        const activeThemeCard = this.modal.querySelector('.theme-preview-card.active');
        if (activeThemeCard) {
            const themeId = activeThemeCard.getAttribute('data-theme');
            if (themeId) {
                formData.theme = {
                    current: themeId,
                    lastUpdated: new Date().toISOString()
                };
                console.log('[InfoBarSettings] 📊 收集到主题数据:', themeId);
            }
        }

        // 收集当前选中的风格
        const activeStyleCard = this.modal.querySelector('.style-preview-card.active');
        if (activeStyleCard) {
            const styleId = activeStyleCard.getAttribute('data-style');
            if (styleId) {
                formData.style = {
                    current: styleId,
                    lastUpdated: new Date().toISOString()
                };
                console.log('[InfoBarSettings] 📊 收集到风格数据:', styleId);
            }
        }

        // 处理基础面板配置，转换为DataTable期望的格式
        this.processBasicPanelsConfig(formData);

        console.log('[InfoBarSettings] 📊 表单数据收集完成，包含', Object.keys(formData).length, '个配置项');
        return formData;
    }

    /**
     * 加载自定义面板子项的勾选状态到表单
     */
    loadCustomPanelSubItemStates(customPanels) {
        try {
            // 遍历所有自定义面板
            for (const [panelId, panel] of Object.entries(customPanels)) {
                if (panel.subItems && Array.isArray(panel.subItems)) {
                    // 设置每个子项的勾选状态
                    panel.subItems.forEach(subItem => {
                        const fieldName = subItem.name || subItem.key || subItem.id;
                        const checkbox = this.modal.querySelector(`input[name="${fieldName}"]`);
                        if (checkbox && checkbox.type === 'checkbox') {
                            checkbox.checked = subItem.enabled !== false;
                            console.log(`[InfoBarSettings] 📊 设置子项勾选状态: ${fieldName} = ${checkbox.checked}`);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载自定义面板子项状态失败:', error);
        }
    }

    /**
     * 加载基础面板子项的勾选状态到表单
     */
    loadBasicPanelSubItemStates(configs) {
        try {
            const basicPanelIds = ['personal', 'interaction', 'tasks', 'world', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];
            
            // 遍历所有基础面板
            basicPanelIds.forEach(panelId => {
                const panelConfig = configs[panelId];
                if (panelConfig && typeof panelConfig === 'object') {
                    console.log(`[InfoBarSettings] 📊 加载基础面板 ${panelId} 的子项状态`);
                    
                    // 遍历面板的所有子项
                    Object.keys(panelConfig).forEach(subItemKey => {
                        if (subItemKey !== 'enabled' && typeof panelConfig[subItemKey] === 'object' && 
                            panelConfig[subItemKey] && typeof panelConfig[subItemKey].enabled === 'boolean') {
                            
                            const fieldName = `${panelId}.${subItemKey}.enabled`;
                            const checkbox = this.modal.querySelector(`input[name="${fieldName}"]`);
                            
                            if (checkbox && checkbox.type === 'checkbox') {
                                checkbox.checked = panelConfig[subItemKey].enabled;
                                console.log(`[InfoBarSettings] 📊 设置基础面板子项勾选状态: ${fieldName} = ${checkbox.checked}`);
                            }
                        }
                    });
                }
            });
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载基础面板子项状态失败:', error);
        }
    }

    /**
     * 更新自定义面板子项的勾选状态
     */
    updateCustomPanelSubItemStates(customPanels, formData) {
        try {
            // 遍历所有自定义面板
            for (const [panelId, panel] of Object.entries(customPanels)) {
                if (panel.subItems && Array.isArray(panel.subItems)) {
                    // 更新每个子项的enabled状态
                    panel.subItems.forEach(subItem => {
                        // 使用子项的name作为字段名查找勾选状态
                        const fieldName = subItem.name || subItem.key || subItem.id;
                        if (formData.hasOwnProperty(fieldName)) {
                            subItem.enabled = formData[fieldName];
                            console.log(`[InfoBarSettings] 📊 更新子项状态: ${fieldName} = ${subItem.enabled}`);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新自定义面板子项状态失败:', error);
        }
    }

    /**
     * 处理基础面板配置，转换为DataTable期望的格式
     */
    processBasicPanelsConfig(formData) {
        try {
            // 初始化basicPanels对象
            if (!formData.basicPanels) {
                formData.basicPanels = {};
            }

            // 定义所有基础面板ID列表
            const basicPanelIds = ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];

            // 循环处理所有基础面板
            basicPanelIds.forEach(panelId => {
                if (formData[panelId]) {
                    formData.basicPanels[panelId] = {
                        enabled: formData[panelId].enabled !== false,
                        subItems: []
                    };

                    // 转换子项配置
                    Object.keys(formData[panelId]).forEach(key => {
                        if (key !== 'enabled' && typeof formData[panelId][key] === 'object' && formData[panelId][key].enabled !== undefined) {
                            formData.basicPanels[panelId].subItems.push({
                                name: this.getSubItemDisplayName(panelId, key),
                                key: key,
                                enabled: formData[panelId][key].enabled,
                                value: this.getDefaultSubItemValue(panelId, key)
                            });
                        }
                    });

                    console.log(`[InfoBarSettings] 📊 处理${panelId}面板配置:`, formData.basicPanels[panelId].subItems.length, '个子项');
                }
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理基础面板配置失败:', error);
        }
    }

    /**
     * 获取子项显示名称
     */
    getSubItemDisplayName(panelType, key) {
        const displayNames = {
            personal: {
                name: '姓名', age: '年龄', gender: '性别', occupation: '职业',
                personality: '性格', hobbies: '爱好', height: '身高', weight: '体重',
                bloodType: '血型', birthplace: '出生地', nationality: '国籍',
                religion: '宗教信仰', politicalViews: '政治观点', values: '价值观',
                goals: '人生目标', fears: '恐惧', strengths: '优点', weaknesses: '缺点',
                mentalHealth: '心理健康', physicalHealth: '身体健康', appearance: '外貌',
                clothing: '穿着风格', accessories: '配饰', tattoos: '纹身',
                scars: '疤痕', voice: '声音', mannerisms: '习惯动作',
                familyBackground: '家庭背景', education: '教育经历', workExperience: '工作经历',
                income: '收入', socialStatus: '社会地位', relationships: '人际关系',
                loveStatus: '恋爱状态', maritalStatus: '婚姻状态', sports: '运动',
                music: '音乐', art: '艺术', reading: '阅读', gaming: '游戏',
                travel: '旅行', cooking: '烹饪', skills: '技能特长',
                languages: '语言能力', habits: '生活习惯', healthStatus: '健康状态'
            },
            world: {
                name: '世界名称', type: '世界类型', genre: '世界风格',
                description: '世界描述', geography: '地理环境', locations: '重要地点',
                time: '时间设定'
            },
            interaction: {
                name: '对象名称', type: '对象类型', status: '当前状态',
                location: '所在位置', activity: '当前活动', relationship: '关系类型',
                intimacy: '亲密度', history: '历史记录', autoRecord: '自动记录'
            },
            tasks: {
                title: '任务标题', description: '任务描述', priority: '优先级',
                status: '任务状态', deadline: '截止日期', assignee: '负责人',
                progress: '完成进度', category: '任务分类'
            },
            organization: {
                name: '组织名称', type: '组织类型', leader: '领导者',
                members: '成员数量', purpose: '组织目标', location: '总部位置',
                influence: '影响力', resources: '资源状况'
            },
            news: {
                title: '新闻标题', content: '新闻内容', source: '消息来源',
                date: '发布日期', importance: '重要程度', category: '新闻分类',
                impact: '影响范围'
            },
            inventory: {
                name: '物品名称', type: '物品类型', quantity: '数量',
                condition: '物品状态', value: '价值', location: '存放位置',
                description: '物品描述'
            },
            abilities: {
                name: '能力名称', type: '能力类型', level: '能力等级',
                description: '能力描述', cooldown: '冷却时间', cost: '消耗',
                effect: '效果描述'
            },
            plot: {
                title: '剧情标题', description: '剧情描述', stage: '当前阶段',
                characters: '相关角色', location: '发生地点', importance: '重要程度',
                outcome: '结果影响'
            },
            cultivation: {
                realm: '修炼境界', technique: '修炼功法', progress: '修炼进度',
                qi: '灵气值', foundation: '根基', breakthrough: '突破条件',
                resources: '修炼资源'
            },
            fantasy: {
                race: '种族', class: '职业', level: '等级',
                hp: '生命值', mp: '魔法值', strength: '力量',
                agility: '敏捷', intelligence: '智力', equipment: '装备'
            },
            modern: {
                job: '工作', income: '收入', education: '学历',
                skills: '技能', social: '社交圈', lifestyle: '生活方式',
                goals: '人生目标'
            },
            historical: {
                era: '历史时期', position: '社会地位', family: '家族背景',
                achievements: '成就', reputation: '声望', allies: '盟友',
                enemies: '敌人'
            },
            magic: {
                school: '魔法学派', spells: '法术列表', mana: '魔力值',
                focus: '施法焦点', components: '法术材料', familiar: '魔宠',
                research: '研究项目'
            },
            training: {
                skill: '训练技能', instructor: '指导者', progress: '训练进度',
                schedule: '训练计划', equipment: '训练器材', goals: '训练目标',
                achievements: '训练成果'
            }
        };

        return displayNames[panelType]?.[key] || key;
    }

    /**
     * 获取子项默认值
     */
    getDefaultSubItemValue(panelType, key) {
        const defaultValues = {
            personal: {
                name: '林天', age: '25', gender: '男', occupation: '软件工程师',
                personality: '开朗、友善', hobbies: '编程、阅读、音乐', height: '175cm',
                weight: '70kg', bloodType: 'O型'
            },
            world: {
                name: '现代都市', type: '现实世界', genre: '都市生活',
                description: '繁华的现代都市环境', geography: '沿海城市', locations: '市中心、商业区',
                time: '2024年现代'
            },
            interaction: {
                name: '小雅', type: '朋友', status: '在线',
                location: '咖啡厅', activity: '聊天', relationship: '好友',
                intimacy: '友好', history: '认识3年', autoRecord: '开启'
            }
        };

        return defaultValues[panelType]?.[key] || '';
    }

    /**
     * 设置嵌套属性
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * 检查API配置是否有变化
     */
    hasAPIConfigChanged(formData) {
        return Object.keys(formData).some(key => key.startsWith('apiConfig.'));
    }

    /**
     * 测试API连接
     */
    async testAPIConnection() {
        try {
            console.log('[InfoBarSettings] 🔍 开始测试API连接...');
            
            // 显示测试中状态
            this.updateConnectionStatus('testing', '测试中...');
            
            const result = await this.apiIntegration.testConnection();
            
            if (result.success) {
                this.updateConnectionStatus('success', '连接成功');
                this.showMessage('API连接测试成功', 'success');
            } else {
                this.updateConnectionStatus('error', '连接失败');
                this.showMessage('API连接测试失败: ' + result.error, 'error');
            }
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 测试API连接失败:', error);
            this.updateConnectionStatus('error', '测试异常');
            this.showMessage('API连接测试异常: ' + error.message, 'error');
        }
    }

    /**
     * 加载API模型
     */
    async loadAPIModels() {
        try {
            console.log('[InfoBarSettings] 📋 开始加载API模型...');
            
            const models = await this.apiIntegration.loadModels();
            const modelSelect = this.modal.querySelector('[name="apiConfig.model"]');
            
            // 清空现有选项
            modelSelect.innerHTML = '<option value="">选择模型...</option>';
            
            // 添加模型选项
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.title = model.description;
                modelSelect.appendChild(option);
            });
            
            this.showMessage(`成功加载 ${models.length} 个模型`, 'success');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载API模型失败:', error);
            this.showMessage('加载模型失败: ' + error.message, 'error');
        }
    }

    /**
     * 更新连接状态显示
     */
    updateConnectionStatus(status, message) {
        const statusElement = this.modal.querySelector('[data-status="connection"]');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-value status-${status}`;
        }
    }

    /**
     * 更新API状态
     */
    updateAPIStatus() {
        if (!this.apiIntegration) return;
        
        const stats = this.apiIntegration.getStats();
        const statsElement = this.modal.querySelector('[data-status="stats"]');
        
        if (statsElement) {
            statsElement.textContent = `${stats.success}/${stats.total} (${stats.successRate})`;
        }
    }
    /**
     * 显示顶部提示消息
     */
    showMessage(message, type = 'info') {
        try {
            // 移除已存在的提示
            const existingToast = document.querySelector('.toast-notification');
            if (existingToast) {
                existingToast.remove();
            }

            // 创建顶部提示
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;

            // 根据类型设置样式
            let bgColor = 'var(--theme-bg-secondary, #2d3748)';
            let borderColor = 'var(--theme-border-color, #4a5568)';
            let textColor = 'var(--theme-text-primary, #ffffff)';
            let icon = 'ℹ️';

            if (type === 'success') {
                bgColor = 'var(--theme-primary-color, #4299e1)';
                borderColor = 'var(--theme-primary-color, #4299e1)';
                textColor = '#ffffff';
                icon = '✅';
            } else if (type === 'error') {
                bgColor = '#f56565';
                borderColor = '#f56565';
                textColor = '#ffffff';
                icon = '❌';
            } else if (type === 'warning') {
                bgColor = '#ed8936';
                borderColor = '#ed8936';
                textColor = '#ffffff';
                icon = '⚠️';
            }

            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100%);
                background: ${bgColor};
                color: ${textColor};
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 500;
                min-width: 200px;
                max-width: 400px;
                transition: transform 0.3s ease;
                border: 1px solid ${borderColor};
            `;

            toast.innerHTML = `
                <span class="toast-icon">${icon}</span>
                <span class="toast-text">${message}</span>
            `;

            // 添加到页面
            document.body.appendChild(toast);

            // 触发进入动画
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
            }, 10);

            // 自动关闭
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.style.transform = 'translateX(-50%) translateY(-100%)';
                    setTimeout(() => {
                        if (toast && toast.parentNode) {
                            toast.remove();
                        }
                    }, 300);
                }
            }, 3000);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示消息失败:', error);
            // 降级到浏览器原生提示
            alert(message);
        }
    }

    /**
     * 重置设置
     */
    async resetSettings() {
        try {
            if (!confirm('确定要重置所有设置到默认值吗？此操作不可撤销。')) {
                return;
            }
            
            await this.configManager.resetConfig();
            await this.loadSettings();
            
            this.showMessage('设置已重置到默认值', 'success');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 重置设置失败:', error);
            this.showMessage('重置设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 清除所有缓存（全局与聊天范围）
     */
    async clearAllCaches() {
        try {
            if (!confirm('确定要清除所有缓存数据吗？此操作不可撤销，将删除全局与聊天范围的缓存。')) {
                return;
            }

            const configManager = this.configManager || window.SillyTavernInfobar?.modules?.configManager;
            if (configManager && configManager.dataCore) {
                // 清空全局与聊天数据
                await configManager.dataCore.clearAllData('all');
                // 重新加载配置缓存
                await configManager.loadAllConfigs?.();
            }

            this.showMessage('所有缓存已清除', 'success');
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 清除缓存失败:', error);
            this.showMessage('清除缓存失败: ' + error.message, 'error');
        }
    }

    /**
     * 重置所有设置（按规则默认值）并清除缓存
     */
    async resetAllSettings() {
        try {
            if (!confirm('确定要重置所有设置并清除缓存吗？此操作不可撤销。')) {
                return;
            }

            const configManager = this.configManager || window.SillyTavernInfobar?.modules?.configManager;
            if (configManager) {
                await configManager.resetConfig();
                await configManager.clearAllData?.();
                await configManager.loadAllConfigs?.();
            }

            await this.loadSettings?.();
            this.showMessage('已重置所有设置并清除缓存', 'success');
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 重置所有设置失败:', error);
            this.showMessage('重置所有设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 导出设置
     */
    async exportSettings() {
        try {
            // 优先使用配置管理器导出
            const exportData = await this.configManager.exportConfigs();

            // 兜底增强：确保包含基础面板的自定义子项、自定义面板定义，以及前端显示配置
            try {
                const context = SillyTavern.getContext();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'] || {};

                // 自定义面板（含子项）
                if (extensionSettings.customPanels && !exportData.configs.customPanels) {
                    exportData.configs.customPanels = extensionSettings.customPanels;
                }

                // 基础面板配置（含subItems/prompts等）
                const basicPanelIds = ['personal','world','interaction','tasks','organization','news','inventory','abilities','plot','cultivation','fantasy','modern','historical','magic','training'];
                basicPanelIds.forEach(id => {
                    if (extensionSettings[id] && !exportData.configs[id]) {
                        exportData.configs[id] = extensionSettings[id];
                    }
                });

                // 前端显示配置（如果未被收集）
                if (!exportData.configs.frontendDisplay) {
                    const fd = await this.configManager.getFrontendDisplayConfig();
                    exportData.configs.frontendDisplay = fd;
                }
            } catch (e) {
                console.warn('[InfoBarSettings] ⚠️ 导出增强合并过程中出现非致命错误:', e);
            }
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `info-bar-settings-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showMessage('设置导出成功', 'success');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 导出设置失败:', error);
            this.showMessage('导出设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 导入设置
     */
    async importSettings() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const importData = JSON.parse(text);
                    
                    await this.configManager.importConfigs(importData);
                    await this.loadSettings();
                    
                    this.showMessage('设置导入成功', 'success');
                    
                } catch (error) {
                    console.error('[InfoBarSettings] ❌ 导入设置失败:', error);
                    this.showMessage('导入设置失败: ' + error.message, 'error');
                }
            };
            
            input.click();
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 导入设置失败:', error);
            this.showMessage('导入设置失败: ' + error.message, 'error');
        }
    }

    /**
     * 处理表单变更
     */
    handleFormChange(e) {
        try {
            // 调试设置变更：根据日志级别动态设置控制台过滤
            if (e.target.name === 'debug.enabled' || e.target.name === 'debug.logLevel') {
                const enabled = this.modal.querySelector('[name="debug.enabled"]')?.checked;
                const level = this.modal.querySelector('[name="debug.logLevel"]').value || 'info';
                this.applyConsoleLogLevel(enabled ? level : 'none');
            }
            // 主题切换特殊处理
            if (e.target.name === 'theme.current') {
                const customGroup = this.modal.querySelector('.custom-theme-group');
                if (customGroup) {
                    customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            }
            
            // 实时预览主题变化
            if (e.target.name && e.target.name.startsWith('theme.custom.')) {
                this.updateThemePreview();
            }
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理表单变更失败:', error);
        }
    }

    /**
     * 更新主题预览
     */
    updateThemePreview() {
        try {
            const previewBox = this.modal.querySelector('.preview-box');
            if (!previewBox) return;
            
            const customColors = {
                primary: this.modal.querySelector('[name="theme.custom.primary"]')?.value,
                background: this.modal.querySelector('[name="theme.custom.background"]')?.value,
                text: this.modal.querySelector('[name="theme.custom.text"]')?.value,
                border: this.modal.querySelector('[name="theme.custom.border"]')?.value
            };
            
            // 应用预览样式
            previewBox.style.backgroundColor = customColors.background;
            previewBox.style.color = customColors.text;
            previewBox.style.borderColor = customColors.border;
            
            const previewButton = previewBox.querySelector('.preview-button');
            if (previewButton) {
                previewButton.style.backgroundColor = customColors.primary;
            }
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新主题预览失败:', error);
        }
    }

    /**
     * 创建个人信息面板
     */
    createPersonalPanel() {
        return `
            <div class="content-header">
                <h3>个人信息配置</h3>
            </div>

            <div class="content-body">
                <!-- 个人信息卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">👤</div>
                            <div class="card-text">
                                <div class="card-title">个人信息</div>
                                <div class="card-subtitle">角色自身的基础信息</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="personal-info-toggle" name="personal.enabled" checked />
                                <label for="personal-info-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count" id="personal-panel-count">0/0 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础信息 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="name-checkbox" name="personal.name.enabled" checked />
                                <label for="name-checkbox" class="checkbox-label">姓名</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="age-checkbox" name="personal.age.enabled" checked />
                                <label for="age-checkbox" class="checkbox-label">年龄</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="gender-checkbox" name="personal.gender.enabled" checked />
                                <label for="gender-checkbox" class="checkbox-label">性别</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="occupation-checkbox" name="personal.occupation.enabled" checked />
                                <label for="occupation-checkbox" class="checkbox-label">职业</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="height-checkbox" name="personal.height.enabled" />
                                <label for="height-checkbox" class="checkbox-label">身高</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="weight-checkbox" name="personal.weight.enabled" />
                                <label for="weight-checkbox" class="checkbox-label">体重</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="blood-type-checkbox" name="personal.bloodType.enabled" />
                                <label for="blood-type-checkbox" class="checkbox-label">血型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="zodiac-checkbox" name="personal.zodiac.enabled" />
                                <label for="zodiac-checkbox" class="checkbox-label">星座</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="birthday-checkbox" name="personal.birthday.enabled" />
                                <label for="birthday-checkbox" class="checkbox-label">生日</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="birthplace-checkbox" name="personal.birthplace.enabled" />
                                <label for="birthplace-checkbox" class="checkbox-label">出生地</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="nationality-checkbox" name="personal.nationality.enabled" />
                                <label for="nationality-checkbox" class="checkbox-label">国籍</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="ethnicity-checkbox" name="personal.ethnicity.enabled" />
                                <label for="ethnicity-checkbox" class="checkbox-label">民族</label>
                            </div>
                        </div>
                    </div>

                    <!-- 外观特征 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="hair-color-checkbox" name="personal.hairColor.enabled" />
                                <label for="hair-color-checkbox" class="checkbox-label">发色</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="hair-style-checkbox" name="personal.hairStyle.enabled" />
                                <label for="hair-style-checkbox" class="checkbox-label">发型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="eye-color-checkbox" name="personal.eyeColor.enabled" />
                                <label for="eye-color-checkbox" class="checkbox-label">眼色</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="skin-color-checkbox" name="personal.skinColor.enabled" />
                                <label for="skin-color-checkbox" class="checkbox-label">肤色</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="body-type-checkbox" name="personal.bodyType.enabled" />
                                <label for="body-type-checkbox" class="checkbox-label">体型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="facial-features-checkbox" name="personal.facialFeatures.enabled" />
                                <label for="facial-features-checkbox" class="checkbox-label">面部特征</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="scars-checkbox" name="personal.scars.enabled" />
                                <label for="scars-checkbox" class="checkbox-label">疤痕</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tattoos-checkbox" name="personal.tattoos.enabled" />
                                <label for="tattoos-checkbox" class="checkbox-label">纹身</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="accessories-checkbox" name="personal.accessories.enabled" />
                                <label for="accessories-checkbox" class="checkbox-label">饰品</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="clothing-style-checkbox" name="personal.clothingStyle.enabled" />
                                <label for="clothing-style-checkbox" class="checkbox-label">服装风格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="appearance-checkbox" name="personal.appearance.enabled" checked />
                                <label for="appearance-checkbox" class="checkbox-label">外观描述</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="voice-checkbox" name="personal.voice.enabled" />
                                <label for="voice-checkbox" class="checkbox-label">声音特征</label>
                            </div>
                        </div>
                    </div>

                    <!-- 性格特质 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="personality-checkbox" name="personal.personality.enabled" checked />
                                <label for="personality-checkbox" class="checkbox-label">性格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="temperament-checkbox" name="personal.temperament.enabled" />
                                <label for="temperament-checkbox" class="checkbox-label">气质</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="attitude-checkbox" name="personal.attitude.enabled" />
                                <label for="attitude-checkbox" class="checkbox-label">态度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="values-checkbox" name="personal.values.enabled" />
                                <label for="values-checkbox" class="checkbox-label">价值观</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="beliefs-checkbox" name="personal.beliefs.enabled" />
                                <label for="beliefs-checkbox" class="checkbox-label">信仰</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fears-checkbox" name="personal.fears.enabled" />
                                <label for="fears-checkbox" class="checkbox-label">恐惧</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="dreams-checkbox" name="personal.dreams.enabled" />
                                <label for="dreams-checkbox" class="checkbox-label">梦想</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="goals-checkbox" name="personal.goals.enabled" />
                                <label for="goals-checkbox" class="checkbox-label">目标</label>
                            </div>
                        </div>
                    </div>

                    <!-- 能力属性 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="intelligence-checkbox" name="personal.intelligence.enabled" />
                                <label for="intelligence-checkbox" class="checkbox-label">智力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="strength-checkbox" name="personal.strength.enabled" />
                                <label for="strength-checkbox" class="checkbox-label">体力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="charisma-checkbox" name="personal.charisma.enabled" />
                                <label for="charisma-checkbox" class="checkbox-label">魅力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="luck-checkbox" name="personal.luck.enabled" />
                                <label for="luck-checkbox" class="checkbox-label">运气</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="perception-checkbox" name="personal.perception.enabled" />
                                <label for="perception-checkbox" class="checkbox-label">感知</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="willpower-checkbox" name="personal.willpower.enabled" />
                                <label for="willpower-checkbox" class="checkbox-label">意志力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="reaction-speed-checkbox" name="personal.reactionSpeed.enabled" />
                                <label for="reaction-speed-checkbox" class="checkbox-label">反应速度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="learning-ability-checkbox" name="personal.learningAbility.enabled" />
                                <label for="learning-ability-checkbox" class="checkbox-label">学习能力</label>
                            </div>
                        </div>
                    </div>

                    <!-- 社会关系 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="family-background-checkbox" name="personal.familyBackground.enabled" />
                                <label for="family-background-checkbox" class="checkbox-label">家庭背景</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="education-checkbox" name="personal.education.enabled" />
                                <label for="education-checkbox" class="checkbox-label">教育经历</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="work-experience-checkbox" name="personal.workExperience.enabled" />
                                <label for="work-experience-checkbox" class="checkbox-label">工作经历</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="income-checkbox" name="personal.income.enabled" />
                                <label for="income-checkbox" class="checkbox-label">收入</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="social-status-checkbox" name="personal.socialStatus.enabled" />
                                <label for="social-status-checkbox" class="checkbox-label">社会地位</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="relationships-checkbox" name="personal.relationships.enabled" />
                                <label for="relationships-checkbox" class="checkbox-label">人际关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="love-status-checkbox" name="personal.loveStatus.enabled" />
                                <label for="love-status-checkbox" class="checkbox-label">恋爱状态</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="marital-status-checkbox" name="personal.maritalStatus.enabled" />
                                <label for="marital-status-checkbox" class="checkbox-label">婚姻状态</label>
                            </div>
                        </div>
                    </div>
                    <!-- 兴趣爱好 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="hobbies-checkbox" name="personal.hobbies.enabled" />
                                <label for="hobbies-checkbox" class="checkbox-label">兴趣爱好</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="sports-checkbox" name="personal.sports.enabled" />
                                <label for="sports-checkbox" class="checkbox-label">运动</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="music-checkbox" name="personal.music.enabled" />
                                <label for="music-checkbox" class="checkbox-label">音乐</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="art-checkbox" name="personal.art.enabled" />
                                <label for="art-checkbox" class="checkbox-label">艺术</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="reading-checkbox" name="personal.reading.enabled" />
                                <label for="reading-checkbox" class="checkbox-label">阅读</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="gaming-checkbox" name="personal.gaming.enabled" />
                                <label for="gaming-checkbox" class="checkbox-label">游戏</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="travel-checkbox" name="personal.travel.enabled" />
                                <label for="travel-checkbox" class="checkbox-label">旅行</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cooking-checkbox" name="personal.cooking.enabled" />
                                <label for="cooking-checkbox" class="checkbox-label">烹饪</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="skills-checkbox" name="personal.skills.enabled" />
                                <label for="skills-checkbox" class="checkbox-label">技能特长</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="languages-checkbox" name="personal.languages.enabled" />
                                <label for="languages-checkbox" class="checkbox-label">语言能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="habits-checkbox" name="personal.habits.enabled" />
                                <label for="habits-checkbox" class="checkbox-label">生活习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="health-status-checkbox" name="personal.healthStatus.enabled" />
                                <label for="health-status-checkbox" class="checkbox-label">健康状态</label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 操作按钮区域 -->
                <div class="action-buttons">
                    <button class="btn-action btn-all">全选</button>
                    <button class="btn-action btn-none">全不选</button>
                    <button class="btn-action btn-basic">基础信息</button>
                </div>
            </div>
        `;
    }

    /**
     * 创建交互对象面板
     */
    createInteractionPanel() {
        return `
            <div class="content-header">
                <h3>交互对象配置</h3>
            </div>

            <div class="content-body">
                <!-- 交互对象卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">👥</div>
                            <div class="card-text">
                                <div class="card-title">交互对象</div>
                                <div class="card-subtitle">角色交互和关系管理</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="interaction-toggle" name="interaction.enabled" checked />
                                <label for="interaction-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count" id="interaction-panel-count">0/0 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础信息 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-name-checkbox" name="interaction.name.enabled" checked />
                                <label for="interaction-name-checkbox" class="checkbox-label">对象名称</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-type-checkbox" name="interaction.type.enabled" checked />
                                <label for="interaction-type-checkbox" class="checkbox-label">对象类型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-status-checkbox" name="interaction.status.enabled" checked />
                                <label for="interaction-status-checkbox" class="checkbox-label">在线状态</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-location-checkbox" name="interaction.location.enabled" />
                                <label for="interaction-location-checkbox" class="checkbox-label">所在位置</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-mood-checkbox" name="interaction.mood.enabled" />
                                <label for="interaction-mood-checkbox" class="checkbox-label">情绪状态</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-activity-checkbox" name="interaction.activity.enabled" />
                                <label for="interaction-activity-checkbox" class="checkbox-label">当前活动</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-availability-checkbox" name="interaction.availability.enabled" />
                                <label for="interaction-availability-checkbox" class="checkbox-label">可用性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-priority-checkbox" name="interaction.priority.enabled" />
                                <label for="interaction-priority-checkbox" class="checkbox-label">优先级</label>
                            </div>
                        </div>
                    </div>

                    <!-- 关系信息 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-relationship-checkbox" name="interaction.relationship.enabled" checked />
                                <label for="interaction-relationship-checkbox" class="checkbox-label">关系类型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-intimacy-checkbox" name="interaction.intimacy.enabled" checked />
                                <label for="interaction-intimacy-checkbox" class="checkbox-label">亲密度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-trust-checkbox" name="interaction.trust.enabled" />
                                <label for="interaction-trust-checkbox" class="checkbox-label">信任度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-friendship-checkbox" name="interaction.friendship.enabled" />
                                <label for="interaction-friendship-checkbox" class="checkbox-label">友好度</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-romance-checkbox" name="interaction.romance.enabled" />
                                <label for="interaction-romance-checkbox" class="checkbox-label">浪漫度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-respect-checkbox" name="interaction.respect.enabled" />
                                <label for="interaction-respect-checkbox" class="checkbox-label">尊重度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-dependency-checkbox" name="interaction.dependency.enabled" />
                                <label for="interaction-dependency-checkbox" class="checkbox-label">依赖度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-conflict-checkbox" name="interaction.conflict.enabled" />
                                <label for="interaction-conflict-checkbox" class="checkbox-label">冲突度</label>
                            </div>
                        </div>
                    </div>

                    <!-- 交互历史 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-history-checkbox" name="interaction.history.enabled" checked />
                                <label for="interaction-history-checkbox" class="checkbox-label">交互历史</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-frequency-checkbox" name="interaction.frequency.enabled" />
                                <label for="interaction-frequency-checkbox" class="checkbox-label">交互频率</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-duration-checkbox" name="interaction.duration.enabled" />
                                <label for="interaction-duration-checkbox" class="checkbox-label">交互时长</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-quality-checkbox" name="interaction.quality.enabled" />
                                <label for="interaction-quality-checkbox" class="checkbox-label">交互质量</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-topics-checkbox" name="interaction.topics.enabled" />
                                <label for="interaction-topics-checkbox" class="checkbox-label">话题记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-emotions-checkbox" name="interaction.emotions.enabled" />
                                <label for="interaction-emotions-checkbox" class="checkbox-label">情感变化</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-milestones-checkbox" name="interaction.milestones.enabled" />
                                <label for="interaction-milestones-checkbox" class="checkbox-label">重要节点</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-memories-checkbox" name="interaction.memories.enabled" />
                                <label for="interaction-memories-checkbox" class="checkbox-label">共同回忆</label>
                            </div>
                        </div>
                    </div>

                    <!-- 交互设置 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-auto-record-checkbox" name="interaction.autoRecord.enabled" checked />
                                <label for="interaction-auto-record-checkbox" class="checkbox-label">自动记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-notifications-checkbox" name="interaction.notifications.enabled" />
                                <label for="interaction-notifications-checkbox" class="checkbox-label">交互通知</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-analysis-checkbox" name="interaction.analysis.enabled" />
                                <label for="interaction-analysis-checkbox" class="checkbox-label">行为分析</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-suggestions-checkbox" name="interaction.suggestions.enabled" />
                                <label for="interaction-suggestions-checkbox" class="checkbox-label">建议提示</label>
                            </div>
                        </div>
                    </div>

                    <!-- 社交网络 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-network-checkbox" name="interaction.network.enabled" />
                                <label for="interaction-network-checkbox" class="checkbox-label">社交网络</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-groups-checkbox" name="interaction.groups.enabled" />
                                <label for="interaction-groups-checkbox" class="checkbox-label">群组关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-influence-checkbox" name="interaction.influence.enabled" />
                                <label for="interaction-influence-checkbox" class="checkbox-label">影响力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-reputation-checkbox" name="interaction.reputation.enabled" />
                                <label for="interaction-reputation-checkbox" class="checkbox-label">声誉</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-alliances-checkbox" name="interaction.alliances.enabled" />
                                <label for="interaction-alliances-checkbox" class="checkbox-label">联盟关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-rivalries-checkbox" name="interaction.rivalries.enabled" />
                                <label for="interaction-rivalries-checkbox" class="checkbox-label">竞争关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-mentorship-checkbox" name="interaction.mentorship.enabled" />
                                <label for="interaction-mentorship-checkbox" class="checkbox-label">师徒关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-hierarchy-checkbox" name="interaction.hierarchy.enabled" />
                                <label for="interaction-hierarchy-checkbox" class="checkbox-label">等级关系</label>
                            </div>
                        </div>
                    </div>

                    <!-- 交互偏好 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-communication-style-checkbox" name="interaction.communicationStyle.enabled" />
                                <label for="interaction-communication-style-checkbox" class="checkbox-label">沟通风格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-preferred-topics-checkbox" name="interaction.preferredTopics.enabled" />
                                <label for="interaction-preferred-topics-checkbox" class="checkbox-label">偏好话题</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-avoided-topics-checkbox" name="interaction.avoidedTopics.enabled" />
                                <label for="interaction-avoided-topics-checkbox" class="checkbox-label">避免话题</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-boundaries-checkbox" name="interaction.boundaries.enabled" />
                                <label for="interaction-boundaries-checkbox" class="checkbox-label">交互边界</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-comfort-level-checkbox" name="interaction.comfortLevel.enabled" />
                                <label for="interaction-comfort-level-checkbox" class="checkbox-label">舒适度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-energy-level-checkbox" name="interaction.energyLevel.enabled" />
                                <label for="interaction-energy-level-checkbox" class="checkbox-label">活跃度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-response-time-checkbox" name="interaction.responseTime.enabled" />
                                <label for="interaction-response-time-checkbox" class="checkbox-label">响应时间</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-engagement-checkbox" name="interaction.engagement.enabled" />
                                <label for="interaction-engagement-checkbox" class="checkbox-label">参与度</label>
                            </div>
                        </div>
                    </div>

                    <!-- 特殊状态 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-special-events-checkbox" name="interaction.specialEvents.enabled" />
                                <label for="interaction-special-events-checkbox" class="checkbox-label">特殊事件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-achievements-checkbox" name="interaction.achievements.enabled" />
                                <label for="interaction-achievements-checkbox" class="checkbox-label">成就记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-challenges-checkbox" name="interaction.challenges.enabled" />
                                <label for="interaction-challenges-checkbox" class="checkbox-label">挑战记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="interaction-growth-checkbox" name="interaction.growth.enabled" />
                                <label for="interaction-growth-checkbox" class="checkbox-label">成长轨迹</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建任务系统面板
     */
    createTasksPanel() {
        return `
            <div class="content-header">
                <h3>任务系统配置</h3>
            </div>

            <div class="content-body">
                <!-- 任务系统卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">📋</div>
                            <div class="card-text">
                                <div class="card-title">任务系统</div>
                                <div class="card-subtitle">任务管理和进度跟踪</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="tasks-toggle" name="tasks.enabled" checked />
                                <label for="tasks-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">15/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 任务基础 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-creation-checkbox" name="tasks.creation.enabled" checked />
                                <label for="tasks-creation-checkbox" class="checkbox-label">任务创建</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-editing-checkbox" name="tasks.editing.enabled" checked />
                                <label for="tasks-editing-checkbox" class="checkbox-label">任务编辑</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-deletion-checkbox" name="tasks.deletion.enabled" checked />
                                <label for="tasks-deletion-checkbox" class="checkbox-label">任务删除</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-completion-checkbox" name="tasks.completion.enabled" checked />
                                <label for="tasks-completion-checkbox" class="checkbox-label">任务完成</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-priority-checkbox" name="tasks.priority.enabled" />
                                <label for="tasks-priority-checkbox" class="checkbox-label">优先级设置</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-deadline-checkbox" name="tasks.deadline.enabled" />
                                <label for="tasks-deadline-checkbox" class="checkbox-label">截止时间</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-progress-checkbox" name="tasks.progress.enabled" />
                                <label for="tasks-progress-checkbox" class="checkbox-label">进度跟踪</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-status-checkbox" name="tasks.status.enabled" />
                                <label for="tasks-status-checkbox" class="checkbox-label">状态管理</label>
                            </div>
                        </div>
                    </div>

                    <!-- 任务分类 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-categories-checkbox" name="tasks.categories.enabled" />
                                <label for="tasks-categories-checkbox" class="checkbox-label">任务分类</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-tags-checkbox" name="tasks.tags.enabled" />
                                <label for="tasks-tags-checkbox" class="checkbox-label">标签系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-projects-checkbox" name="tasks.projects.enabled" />
                                <label for="tasks-projects-checkbox" class="checkbox-label">项目分组</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-milestones-checkbox" name="tasks.milestones.enabled" />
                                <label for="tasks-milestones-checkbox" class="checkbox-label">里程碑</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-subtasks-checkbox" name="tasks.subtasks.enabled" />
                                <label for="tasks-subtasks-checkbox" class="checkbox-label">子任务</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-dependencies-checkbox" name="tasks.dependencies.enabled" />
                                <label for="tasks-dependencies-checkbox" class="checkbox-label">任务依赖</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-templates-checkbox" name="tasks.templates.enabled" />
                                <label for="tasks-templates-checkbox" class="checkbox-label">任务模板</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-recurring-checkbox" name="tasks.recurring.enabled" />
                                <label for="tasks-recurring-checkbox" class="checkbox-label">重复任务</label>
                            </div>
                        </div>
                    </div>

                    <!-- 通知提醒 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-notifications-checkbox" name="tasks.notifications.enabled" checked />
                                <label for="tasks-notifications-checkbox" class="checkbox-label">任务通知</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-reminders-checkbox" name="tasks.reminders.enabled" />
                                <label for="tasks-reminders-checkbox" class="checkbox-label">提醒设置</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-alerts-checkbox" name="tasks.alerts.enabled" />
                                <label for="tasks-alerts-checkbox" class="checkbox-label">逾期警告</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-daily-summary-checkbox" name="tasks.dailySummary.enabled" />
                                <label for="tasks-daily-summary-checkbox" class="checkbox-label">每日总结</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-weekly-review-checkbox" name="tasks.weeklyReview.enabled" />
                                <label for="tasks-weekly-review-checkbox" class="checkbox-label">周度回顾</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-achievement-badges-checkbox" name="tasks.achievementBadges.enabled" />
                                <label for="tasks-achievement-badges-checkbox" class="checkbox-label">成就徽章</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-productivity-stats-checkbox" name="tasks.productivityStats.enabled" />
                                <label for="tasks-productivity-stats-checkbox" class="checkbox-label">效率统计</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-time-tracking-checkbox" name="tasks.timeTracking.enabled" />
                                <label for="tasks-time-tracking-checkbox" class="checkbox-label">时间跟踪</label>
                            </div>
                        </div>
                    </div>

                    <!-- 协作功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-assignment-checkbox" name="tasks.assignment.enabled" />
                                <label for="tasks-assignment-checkbox" class="checkbox-label">任务分配</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-collaboration-checkbox" name="tasks.collaboration.enabled" />
                                <label for="tasks-collaboration-checkbox" class="checkbox-label">协作功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-comments-checkbox" name="tasks.comments.enabled" />
                                <label for="tasks-comments-checkbox" class="checkbox-label">任务评论</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-attachments-checkbox" name="tasks.attachments.enabled" />
                                <label for="tasks-attachments-checkbox" class="checkbox-label">文件附件</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-sharing-checkbox" name="tasks.sharing.enabled" />
                                <label for="tasks-sharing-checkbox" class="checkbox-label">任务分享</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-permissions-checkbox" name="tasks.permissions.enabled" />
                                <label for="tasks-permissions-checkbox" class="checkbox-label">权限管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-approval-checkbox" name="tasks.approval.enabled" />
                                <label for="tasks-approval-checkbox" class="checkbox-label">审批流程</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-delegation-checkbox" name="tasks.delegation.enabled" />
                                <label for="tasks-delegation-checkbox" class="checkbox-label">任务委派</label>
                            </div>
                        </div>
                    </div>

                    <!-- 视图和排序 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-list-view-checkbox" name="tasks.listView.enabled" checked />
                                <label for="tasks-list-view-checkbox" class="checkbox-label">列表视图</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-kanban-view-checkbox" name="tasks.kanbanView.enabled" />
                                <label for="tasks-kanban-view-checkbox" class="checkbox-label">看板视图</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-calendar-view-checkbox" name="tasks.calendarView.enabled" />
                                <label for="tasks-calendar-view-checkbox" class="checkbox-label">日历视图</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-gantt-view-checkbox" name="tasks.ganttView.enabled" />
                                <label for="tasks-gantt-view-checkbox" class="checkbox-label">甘特图</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-sorting-checkbox" name="tasks.sorting.enabled" checked />
                                <label for="tasks-sorting-checkbox" class="checkbox-label">排序功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-filtering-checkbox" name="tasks.filtering.enabled" />
                                <label for="tasks-filtering-checkbox" class="checkbox-label">筛选功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-search-checkbox" name="tasks.search.enabled" />
                                <label for="tasks-search-checkbox" class="checkbox-label">搜索功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-grouping-checkbox" name="tasks.grouping.enabled" />
                                <label for="tasks-grouping-checkbox" class="checkbox-label">分组显示</label>
                            </div>
                        </div>
                    </div>

                    <!-- 数据管理 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-backup-checkbox" name="tasks.backup.enabled" />
                                <label for="tasks-backup-checkbox" class="checkbox-label">数据备份</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-export-checkbox" name="tasks.export.enabled" />
                                <label for="tasks-export-checkbox" class="checkbox-label">数据导出</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-import-checkbox" name="tasks.import.enabled" />
                                <label for="tasks-import-checkbox" class="checkbox-label">数据导入</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-sync-checkbox" name="tasks.sync.enabled" />
                                <label for="tasks-sync-checkbox" class="checkbox-label">云端同步</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-archive-checkbox" name="tasks.archive.enabled" />
                                <label for="tasks-archive-checkbox" class="checkbox-label">任务归档</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-history-checkbox" name="tasks.history.enabled" />
                                <label for="tasks-history-checkbox" class="checkbox-label">历史记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-versioning-checkbox" name="tasks.versioning.enabled" />
                                <label for="tasks-versioning-checkbox" class="checkbox-label">版本控制</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="tasks-recovery-checkbox" name="tasks.recovery.enabled" />
                                <label for="tasks-recovery-checkbox" class="checkbox-label">数据恢复</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建世界信息面板
     */
    createWorldPanel() {
        return `
            <div class="content-header">
                <h3>世界信息配置</h3>
            </div>

            <div class="content-body">
                <!-- 世界信息卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🌍</div>
                            <div class="card-text">
                                <div class="card-title">世界信息</div>
                                <div class="card-subtitle">世界设定和环境管理</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="world-toggle" name="world.enabled" checked />
                                <label for="world-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">18/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础设定 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-name-checkbox" name="world.name.enabled" checked />
                                <label for="world-name-checkbox" class="checkbox-label">世界名称</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-type-checkbox" name="world.type.enabled" checked />
                                <label for="world-type-checkbox" class="checkbox-label">世界类型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-genre-checkbox" name="world.genre.enabled" checked />
                                <label for="world-genre-checkbox" class="checkbox-label">世界风格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-theme-checkbox" name="world.theme.enabled" />
                                <label for="world-theme-checkbox" class="checkbox-label">主题设定</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-description-checkbox" name="world.description.enabled" checked />
                                <label for="world-description-checkbox" class="checkbox-label">世界描述</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-history-checkbox" name="world.history.enabled" />
                                <label for="world-history-checkbox" class="checkbox-label">历史背景</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-mythology-checkbox" name="world.mythology.enabled" />
                                <label for="world-mythology-checkbox" class="checkbox-label">神话传说</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-lore-checkbox" name="world.lore.enabled" />
                                <label for="world-lore-checkbox" class="checkbox-label">世界观设定</label>
                            </div>
                        </div>
                    </div>

                    <!-- 地理环境 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-geography-checkbox" name="world.geography.enabled" checked />
                                <label for="world-geography-checkbox" class="checkbox-label">地理环境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-climate-checkbox" name="world.climate.enabled" />
                                <label for="world-climate-checkbox" class="checkbox-label">气候条件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-terrain-checkbox" name="world.terrain.enabled" />
                                <label for="world-terrain-checkbox" class="checkbox-label">地形地貌</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-biomes-checkbox" name="world.biomes.enabled" />
                                <label for="world-biomes-checkbox" class="checkbox-label">生态群落</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-locations-checkbox" name="world.locations.enabled" checked />
                                <label for="world-locations-checkbox" class="checkbox-label">重要地点</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-landmarks-checkbox" name="world.landmarks.enabled" />
                                <label for="world-landmarks-checkbox" class="checkbox-label">地标建筑</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-cities-checkbox" name="world.cities.enabled" />
                                <label for="world-cities-checkbox" class="checkbox-label">城市聚落</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-dungeons-checkbox" name="world.dungeons.enabled" />
                                <label for="world-dungeons-checkbox" class="checkbox-label">地下城</label>
                            </div>
                        </div>
                    </div>

                    <!-- 时间系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-time-checkbox" name="world.time.enabled" checked />
                                <label for="world-time-checkbox" class="checkbox-label">时间系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-calendar-checkbox" name="world.calendar.enabled" />
                                <label for="world-calendar-checkbox" class="checkbox-label">历法系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-seasons-checkbox" name="world.seasons.enabled" />
                                <label for="world-seasons-checkbox" class="checkbox-label">季节变化</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-day-night-checkbox" name="world.dayNight.enabled" />
                                <label for="world-day-night-checkbox" class="checkbox-label">昼夜循环</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-weather-checkbox" name="world.weather.enabled" />
                                <label for="world-weather-checkbox" class="checkbox-label">天气系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-events-checkbox" name="world.events.enabled" />
                                <label for="world-events-checkbox" class="checkbox-label">世界事件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-festivals-checkbox" name="world.festivals.enabled" />
                                <label for="world-festivals-checkbox" class="checkbox-label">节日庆典</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-disasters-checkbox" name="world.disasters.enabled" />
                                <label for="world-disasters-checkbox" class="checkbox-label">自然灾害</label>
                            </div>
                        </div>
                    </div>

                    <!-- 社会文化 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-cultures-checkbox" name="world.cultures.enabled" />
                                <label for="world-cultures-checkbox" class="checkbox-label">文化体系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-languages-checkbox" name="world.languages.enabled" />
                                <label for="world-languages-checkbox" class="checkbox-label">语言系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-religions-checkbox" name="world.religions.enabled" />
                                <label for="world-religions-checkbox" class="checkbox-label">宗教信仰</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-customs-checkbox" name="world.customs.enabled" />
                                <label for="world-customs-checkbox" class="checkbox-label">风俗习惯</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-politics-checkbox" name="world.politics.enabled" />
                                <label for="world-politics-checkbox" class="checkbox-label">政治制度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-economy-checkbox" name="world.economy.enabled" />
                                <label for="world-economy-checkbox" class="checkbox-label">经济体系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-technology-checkbox" name="world.technology.enabled" />
                                <label for="world-technology-checkbox" class="checkbox-label">科技水平</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-magic-checkbox" name="world.magic.enabled" />
                                <label for="world-magic-checkbox" class="checkbox-label">魔法体系</label>
                            </div>
                        </div>
                    </div>

                    <!-- 生物种族 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-races-checkbox" name="world.races.enabled" />
                                <label for="world-races-checkbox" class="checkbox-label">种族设定</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-creatures-checkbox" name="world.creatures.enabled" />
                                <label for="world-creatures-checkbox" class="checkbox-label">生物群体</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-monsters-checkbox" name="world.monsters.enabled" />
                                <label for="world-monsters-checkbox" class="checkbox-label">怪物设定</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-npcs-checkbox" name="world.npcs.enabled" />
                                <label for="world-npcs-checkbox" class="checkbox-label">NPC管理</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-factions-checkbox" name="world.factions.enabled" />
                                <label for="world-factions-checkbox" class="checkbox-label">势力阵营</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-conflicts-checkbox" name="world.conflicts.enabled" />
                                <label for="world-conflicts-checkbox" class="checkbox-label">冲突矛盾</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-alliances-checkbox" name="world.alliances.enabled" />
                                <label for="world-alliances-checkbox" class="checkbox-label">联盟关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-wars-checkbox" name="world.wars.enabled" />
                                <label for="world-wars-checkbox" class="checkbox-label">战争历史</label>
                            </div>
                        </div>
                    </div>

                    <!-- 资源物品 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-resources-checkbox" name="world.resources.enabled" />
                                <label for="world-resources-checkbox" class="checkbox-label">自然资源</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-materials-checkbox" name="world.materials.enabled" />
                                <label for="world-materials-checkbox" class="checkbox-label">材料物品</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-artifacts-checkbox" name="world.artifacts.enabled" />
                                <label for="world-artifacts-checkbox" class="checkbox-label">神器宝物</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-currency-checkbox" name="world.currency.enabled" />
                                <label for="world-currency-checkbox" class="checkbox-label">货币系统</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-trade-checkbox" name="world.trade.enabled" />
                                <label for="world-trade-checkbox" class="checkbox-label">贸易体系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-markets-checkbox" name="world.markets.enabled" />
                                <label for="world-markets-checkbox" class="checkbox-label">市场商店</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-guilds-checkbox" name="world.guilds.enabled" />
                                <label for="world-guilds-checkbox" class="checkbox-label">公会组织</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="world-transportation-checkbox" name="world.transportation.enabled" />
                                <label for="world-transportation-checkbox" class="checkbox-label">交通运输</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建组织信息面板
     */
    createOrganizationPanel() {
        return `
            <div class="content-header">
                <h3>组织信息配置</h3>
            </div>

            <div class="content-body">
                <!-- 组织信息卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🏛️</div>
                            <div class="card-text">
                                <div class="card-title">组织信息</div>
                                <div class="card-subtitle">组织管理和成员关系</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="organization-toggle" name="organization.enabled" checked />
                                <label for="organization-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">16/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础信息 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-name-checkbox" name="organization.name.enabled" checked />
                                <label for="org-name-checkbox" class="checkbox-label">组织名称</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-type-checkbox" name="organization.type.enabled" checked />
                                <label for="org-type-checkbox" class="checkbox-label">组织类型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-description-checkbox" name="organization.description.enabled" checked />
                                <label for="org-description-checkbox" class="checkbox-label">组织描述</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-purpose-checkbox" name="organization.purpose.enabled" />
                                <label for="org-purpose-checkbox" class="checkbox-label">组织目标</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-history-checkbox" name="organization.history.enabled" />
                                <label for="org-history-checkbox" class="checkbox-label">组织历史</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-founding-checkbox" name="organization.founding.enabled" />
                                <label for="org-founding-checkbox" class="checkbox-label">成立背景</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-motto-checkbox" name="organization.motto.enabled" />
                                <label for="org-motto-checkbox" class="checkbox-label">组织格言</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-values-checkbox" name="organization.values.enabled" />
                                <label for="org-values-checkbox" class="checkbox-label">核心价值</label>
                            </div>
                        </div>
                    </div>

                    <!-- 组织结构 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-hierarchy-checkbox" name="organization.hierarchy.enabled" checked />
                                <label for="org-hierarchy-checkbox" class="checkbox-label">等级制度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-departments-checkbox" name="organization.departments.enabled" />
                                <label for="org-departments-checkbox" class="checkbox-label">部门分工</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-leadership-checkbox" name="organization.leadership.enabled" />
                                <label for="org-leadership-checkbox" class="checkbox-label">领导层</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-council-checkbox" name="organization.council.enabled" />
                                <label for="org-council-checkbox" class="checkbox-label">议事会</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-positions-checkbox" name="organization.positions.enabled" checked />
                                <label for="org-positions-checkbox" class="checkbox-label">职位体系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-ranks-checkbox" name="organization.ranks.enabled" />
                                <label for="org-ranks-checkbox" class="checkbox-label">等级划分</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-promotion-checkbox" name="organization.promotion.enabled" />
                                <label for="org-promotion-checkbox" class="checkbox-label">晋升制度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-authority-checkbox" name="organization.authority.enabled" />
                                <label for="org-authority-checkbox" class="checkbox-label">权限管理</label>
                            </div>
                        </div>
                    </div>

                    <!-- 成员管理 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-members-checkbox" name="organization.members.enabled" checked />
                                <label for="org-members-checkbox" class="checkbox-label">成员名单</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-recruitment-checkbox" name="organization.recruitment.enabled" />
                                <label for="org-recruitment-checkbox" class="checkbox-label">招募制度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-training-checkbox" name="organization.training.enabled" />
                                <label for="org-training-checkbox" class="checkbox-label">培训体系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-evaluation-checkbox" name="organization.evaluation.enabled" />
                                <label for="org-evaluation-checkbox" class="checkbox-label">考核评估</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-rewards-checkbox" name="organization.rewards.enabled" />
                                <label for="org-rewards-checkbox" class="checkbox-label">奖励机制</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-punishment-checkbox" name="organization.punishment.enabled" />
                                <label for="org-punishment-checkbox" class="checkbox-label">惩罚制度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-benefits-checkbox" name="organization.benefits.enabled" />
                                <label for="org-benefits-checkbox" class="checkbox-label">福利待遇</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-retirement-checkbox" name="organization.retirement.enabled" />
                                <label for="org-retirement-checkbox" class="checkbox-label">退休制度</label>
                            </div>
                        </div>
                    </div>

                    <!-- 规章制度 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-rules-checkbox" name="organization.rules.enabled" />
                                <label for="org-rules-checkbox" class="checkbox-label">组织规章</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-code-checkbox" name="organization.code.enabled" />
                                <label for="org-code-checkbox" class="checkbox-label">行为准则</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-ethics-checkbox" name="organization.ethics.enabled" />
                                <label for="org-ethics-checkbox" class="checkbox-label">道德标准</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-discipline-checkbox" name="organization.discipline.enabled" />
                                <label for="org-discipline-checkbox" class="checkbox-label">纪律要求</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-procedures-checkbox" name="organization.procedures.enabled" />
                                <label for="org-procedures-checkbox" class="checkbox-label">工作流程</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-protocols-checkbox" name="organization.protocols.enabled" />
                                <label for="org-protocols-checkbox" class="checkbox-label">操作规程</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-standards-checkbox" name="organization.standards.enabled" />
                                <label for="org-standards-checkbox" class="checkbox-label">质量标准</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-compliance-checkbox" name="organization.compliance.enabled" />
                                <label for="org-compliance-checkbox" class="checkbox-label">合规要求</label>
                            </div>
                        </div>
                    </div>

                    <!-- 对外关系 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-allies-checkbox" name="organization.allies.enabled" />
                                <label for="org-allies-checkbox" class="checkbox-label">盟友组织</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-enemies-checkbox" name="organization.enemies.enabled" />
                                <label for="org-enemies-checkbox" class="checkbox-label">敌对势力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-neutral-checkbox" name="organization.neutral.enabled" />
                                <label for="org-neutral-checkbox" class="checkbox-label">中立关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-partnerships-checkbox" name="organization.partnerships.enabled" />
                                <label for="org-partnerships-checkbox" class="checkbox-label">合作伙伴</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-reputation-checkbox" name="organization.reputation.enabled" />
                                <label for="org-reputation-checkbox" class="checkbox-label">声誉影响</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-influence-checkbox" name="organization.influence.enabled" />
                                <label for="org-influence-checkbox" class="checkbox-label">势力范围</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-diplomacy-checkbox" name="organization.diplomacy.enabled" />
                                <label for="org-diplomacy-checkbox" class="checkbox-label">外交政策</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-treaties-checkbox" name="organization.treaties.enabled" />
                                <label for="org-treaties-checkbox" class="checkbox-label">条约协议</label>
                            </div>
                        </div>
                    </div>

                    <!-- 资源管理 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-finances-checkbox" name="organization.finances.enabled" />
                                <label for="org-finances-checkbox" class="checkbox-label">财务管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-assets-checkbox" name="organization.assets.enabled" />
                                <label for="org-assets-checkbox" class="checkbox-label">资产清单</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-facilities-checkbox" name="organization.facilities.enabled" />
                                <label for="org-facilities-checkbox" class="checkbox-label">设施场所</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-equipment-checkbox" name="organization.equipment.enabled" />
                                <label for="org-equipment-checkbox" class="checkbox-label">装备器材</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-technology-checkbox" name="organization.technology.enabled" />
                                <label for="org-technology-checkbox" class="checkbox-label">技术资源</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-knowledge-checkbox" name="organization.knowledge.enabled" />
                                <label for="org-knowledge-checkbox" class="checkbox-label">知识库</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-archives-checkbox" name="organization.archives.enabled" />
                                <label for="org-archives-checkbox" class="checkbox-label">档案记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="org-secrets-checkbox" name="organization.secrets.enabled" />
                                <label for="org-secrets-checkbox" class="checkbox-label">机密信息</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建资讯内容面板
     */
    createNewsPanel() {
        return `
            <div class="content-header">
                <h3>资讯内容配置</h3>
            </div>

            <div class="content-body">
                <!-- 资讯内容卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">📰</div>
                            <div class="card-text">
                                <div class="card-title">资讯内容</div>
                                <div class="card-subtitle">信息管理和内容分发</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="news-toggle" name="news.enabled" checked />
                                <label for="news-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">20/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 内容类型 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-breaking-checkbox" name="news.breaking.enabled" checked />
                                <label for="news-breaking-checkbox" class="checkbox-label">突发新闻</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-politics-checkbox" name="news.politics.enabled" checked />
                                <label for="news-politics-checkbox" class="checkbox-label">政治新闻</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-economy-checkbox" name="news.economy.enabled" checked />
                                <label for="news-economy-checkbox" class="checkbox-label">经济资讯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-social-checkbox" name="news.social.enabled" />
                                <label for="news-social-checkbox" class="checkbox-label">社会新闻</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-military-checkbox" name="news.military.enabled" />
                                <label for="news-military-checkbox" class="checkbox-label">军事动态</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-technology-checkbox" name="news.technology.enabled" />
                                <label for="news-technology-checkbox" class="checkbox-label">科技资讯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-culture-checkbox" name="news.culture.enabled" />
                                <label for="news-culture-checkbox" class="checkbox-label">文化艺术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-sports-checkbox" name="news.sports.enabled" />
                                <label for="news-sports-checkbox" class="checkbox-label">体育赛事</label>
                            </div>
                        </div>
                    </div>

                    <!-- 信息来源 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-official-checkbox" name="news.official.enabled" checked />
                                <label for="news-official-checkbox" class="checkbox-label">官方消息</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-media-checkbox" name="news.media.enabled" />
                                <label for="news-media-checkbox" class="checkbox-label">媒体报道</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-rumors-checkbox" name="news.rumors.enabled" />
                                <label for="news-rumors-checkbox" class="checkbox-label">传言消息</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-insider-checkbox" name="news.insider.enabled" />
                                <label for="news-insider-checkbox" class="checkbox-label">内部消息</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-witness-checkbox" name="news.witness.enabled" />
                                <label for="news-witness-checkbox" class="checkbox-label">目击报告</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-intelligence-checkbox" name="news.intelligence.enabled" />
                                <label for="news-intelligence-checkbox" class="checkbox-label">情报信息</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-leaked-checkbox" name="news.leaked.enabled" />
                                <label for="news-leaked-checkbox" class="checkbox-label">泄露文件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-anonymous-checkbox" name="news.anonymous.enabled" />
                                <label for="news-anonymous-checkbox" class="checkbox-label">匿名爆料</label>
                            </div>
                        </div>
                    </div>

                    <!-- 内容管理 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-creation-checkbox" name="news.creation.enabled" checked />
                                <label for="news-creation-checkbox" class="checkbox-label">内容创建</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-editing-checkbox" name="news.editing.enabled" />
                                <label for="news-editing-checkbox" class="checkbox-label">内容编辑</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-review-checkbox" name="news.review.enabled" />
                                <label for="news-review-checkbox" class="checkbox-label">内容审核</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-publishing-checkbox" name="news.publishing.enabled" />
                                <label for="news-publishing-checkbox" class="checkbox-label">内容发布</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-archiving-checkbox" name="news.archiving.enabled" />
                                <label for="news-archiving-checkbox" class="checkbox-label">内容归档</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-deletion-checkbox" name="news.deletion.enabled" />
                                <label for="news-deletion-checkbox" class="checkbox-label">内容删除</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-backup-checkbox" name="news.backup.enabled" />
                                <label for="news-backup-checkbox" class="checkbox-label">内容备份</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-versioning-checkbox" name="news.versioning.enabled" />
                                <label for="news-versioning-checkbox" class="checkbox-label">版本控制</label>
                            </div>
                        </div>
                    </div>

                    <!-- 分发渠道 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-broadcast-checkbox" name="news.broadcast.enabled" />
                                <label for="news-broadcast-checkbox" class="checkbox-label">广播发布</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-newsletter-checkbox" name="news.newsletter.enabled" />
                                <label for="news-newsletter-checkbox" class="checkbox-label">新闻简报</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-alerts-checkbox" name="news.alerts.enabled" />
                                <label for="news-alerts-checkbox" class="checkbox-label">紧急通知</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-digest-checkbox" name="news.digest.enabled" />
                                <label for="news-digest-checkbox" class="checkbox-label">新闻摘要</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-social-media-checkbox" name="news.socialMedia.enabled" />
                                <label for="news-social-media-checkbox" class="checkbox-label">社交媒体</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-forums-checkbox" name="news.forums.enabled" />
                                <label for="news-forums-checkbox" class="checkbox-label">论坛发布</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-messaging-checkbox" name="news.messaging.enabled" />
                                <label for="news-messaging-checkbox" class="checkbox-label">消息推送</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-email-checkbox" name="news.email.enabled" />
                                <label for="news-email-checkbox" class="checkbox-label">邮件通知</label>
                            </div>
                        </div>
                    </div>

                    <!-- 互动功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-comments-checkbox" name="news.comments.enabled" />
                                <label for="news-comments-checkbox" class="checkbox-label">评论功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-likes-checkbox" name="news.likes.enabled" />
                                <label for="news-likes-checkbox" class="checkbox-label">点赞功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-sharing-checkbox" name="news.sharing.enabled" />
                                <label for="news-sharing-checkbox" class="checkbox-label">分享功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-bookmarks-checkbox" name="news.bookmarks.enabled" />
                                <label for="news-bookmarks-checkbox" class="checkbox-label">收藏功能</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-ratings-checkbox" name="news.ratings.enabled" />
                                <label for="news-ratings-checkbox" class="checkbox-label">评分系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-polls-checkbox" name="news.polls.enabled" />
                                <label for="news-polls-checkbox" class="checkbox-label">投票调查</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-discussions-checkbox" name="news.discussions.enabled" />
                                <label for="news-discussions-checkbox" class="checkbox-label">讨论区</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-feedback-checkbox" name="news.feedback.enabled" />
                                <label for="news-feedback-checkbox" class="checkbox-label">反馈系统</label>
                            </div>
                        </div>
                    </div>

                    <!-- 数据分析 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-analytics-checkbox" name="news.analytics.enabled" />
                                <label for="news-analytics-checkbox" class="checkbox-label">数据分析</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-metrics-checkbox" name="news.metrics.enabled" />
                                <label for="news-metrics-checkbox" class="checkbox-label">指标统计</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-trends-checkbox" name="news.trends.enabled" />
                                <label for="news-trends-checkbox" class="checkbox-label">趋势分析</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-reports-checkbox" name="news.reports.enabled" />
                                <label for="news-reports-checkbox" class="checkbox-label">报告生成</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-monitoring-checkbox" name="news.monitoring.enabled" />
                                <label for="news-monitoring-checkbox" class="checkbox-label">监控系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-alerts-system-checkbox" name="news.alertsSystem.enabled" />
                                <label for="news-alerts-system-checkbox" class="checkbox-label">预警系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-automation-checkbox" name="news.automation.enabled" />
                                <label for="news-automation-checkbox" class="checkbox-label">自动化处理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="news-ai-analysis-checkbox" name="news.aiAnalysis.enabled" />
                                <label for="news-ai-analysis-checkbox" class="checkbox-label">AI分析</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建背包仓库面板
     */
    createInventoryPanel() {
        return `
            <div class="content-header">
                <h3>背包仓库配置</h3>
            </div>

            <div class="content-body">
                <!-- 背包仓库卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🎒</div>
                            <div class="card-text">
                                <div class="card-title">背包仓库</div>
                                <div class="card-subtitle">物品管理和存储系统</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="inventory-toggle" name="inventory.enabled" checked />
                                <label for="inventory-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">22/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-storage-checkbox" name="inventory.storage.enabled" checked />
                                <label for="inventory-storage-checkbox" class="checkbox-label">物品存储</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-retrieval-checkbox" name="inventory.retrieval.enabled" checked />
                                <label for="inventory-retrieval-checkbox" class="checkbox-label">物品取出</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-organization-checkbox" name="inventory.organization.enabled" checked />
                                <label for="inventory-organization-checkbox" class="checkbox-label">物品整理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-search-checkbox" name="inventory.search.enabled" />
                                <label for="inventory-search-checkbox" class="checkbox-label">物品搜索</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-sorting-checkbox" name="inventory.sorting.enabled" />
                                <label for="inventory-sorting-checkbox" class="checkbox-label">自动排序</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-filtering-checkbox" name="inventory.filtering.enabled" />
                                <label for="inventory-filtering-checkbox" class="checkbox-label">物品筛选</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-categories-checkbox" name="inventory.categories.enabled" />
                                <label for="inventory-categories-checkbox" class="checkbox-label">分类管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-tags-checkbox" name="inventory.tags.enabled" />
                                <label for="inventory-tags-checkbox" class="checkbox-label">标签系统</label>
                            </div>
                        </div>
                    </div>

                    <!-- 物品类型 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-weapons-checkbox" name="inventory.weapons.enabled" checked />
                                <label for="inventory-weapons-checkbox" class="checkbox-label">武器装备</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-armor-checkbox" name="inventory.armor.enabled" checked />
                                <label for="inventory-armor-checkbox" class="checkbox-label">防具护甲</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-accessories-checkbox" name="inventory.accessories.enabled" />
                                <label for="inventory-accessories-checkbox" class="checkbox-label">饰品配件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-consumables-checkbox" name="inventory.consumables.enabled" />
                                <label for="inventory-consumables-checkbox" class="checkbox-label">消耗品</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-materials-checkbox" name="inventory.materials.enabled" />
                                <label for="inventory-materials-checkbox" class="checkbox-label">材料物品</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-tools-checkbox" name="inventory.tools.enabled" />
                                <label for="inventory-tools-checkbox" class="checkbox-label">工具器械</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-books-checkbox" name="inventory.books.enabled" />
                                <label for="inventory-books-checkbox" class="checkbox-label">书籍文献</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-treasures-checkbox" name="inventory.treasures.enabled" />
                                <label for="inventory-treasures-checkbox" class="checkbox-label">珍宝收藏</label>
                            </div>
                        </div>
                    </div>

                    <!-- 存储管理 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-capacity-checkbox" name="inventory.capacity.enabled" checked />
                                <label for="inventory-capacity-checkbox" class="checkbox-label">容量管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-weight-checkbox" name="inventory.weight.enabled" />
                                <label for="inventory-weight-checkbox" class="checkbox-label">重量限制</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-stacking-checkbox" name="inventory.stacking.enabled" />
                                <label for="inventory-stacking-checkbox" class="checkbox-label">物品堆叠</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-expansion-checkbox" name="inventory.expansion.enabled" />
                                <label for="inventory-expansion-checkbox" class="checkbox-label">容量扩展</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-compartments-checkbox" name="inventory.compartments.enabled" />
                                <label for="inventory-compartments-checkbox" class="checkbox-label">分隔区域</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-protection-checkbox" name="inventory.protection.enabled" />
                                <label for="inventory-protection-checkbox" class="checkbox-label">物品保护</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-durability-checkbox" name="inventory.durability.enabled" />
                                <label for="inventory-durability-checkbox" class="checkbox-label">耐久度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-repair-checkbox" name="inventory.repair.enabled" />
                                <label for="inventory-repair-checkbox" class="checkbox-label">修理系统</label>
                            </div>
                        </div>
                    </div>

                    <!-- 交易功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-trading-checkbox" name="inventory.trading.enabled" />
                                <label for="inventory-trading-checkbox" class="checkbox-label">物品交易</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-selling-checkbox" name="inventory.selling.enabled" />
                                <label for="inventory-selling-checkbox" class="checkbox-label">物品出售</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-buying-checkbox" name="inventory.buying.enabled" />
                                <label for="inventory-buying-checkbox" class="checkbox-label">物品购买</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-auction-checkbox" name="inventory.auction.enabled" />
                                <label for="inventory-auction-checkbox" class="checkbox-label">拍卖系统</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-gifting-checkbox" name="inventory.gifting.enabled" />
                                <label for="inventory-gifting-checkbox" class="checkbox-label">物品赠送</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-lending-checkbox" name="inventory.lending.enabled" />
                                <label for="inventory-lending-checkbox" class="checkbox-label">物品借贷</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-sharing-checkbox" name="inventory.sharing.enabled" />
                                <label for="inventory-sharing-checkbox" class="checkbox-label">物品共享</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-banking-checkbox" name="inventory.banking.enabled" />
                                <label for="inventory-banking-checkbox" class="checkbox-label">银行存储</label>
                            </div>
                        </div>
                    </div>

                    <!-- 制作系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-crafting-checkbox" name="inventory.crafting.enabled" />
                                <label for="inventory-crafting-checkbox" class="checkbox-label">物品制作</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-recipes-checkbox" name="inventory.recipes.enabled" />
                                <label for="inventory-recipes-checkbox" class="checkbox-label">配方管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-enhancement-checkbox" name="inventory.enhancement.enabled" />
                                <label for="inventory-enhancement-checkbox" class="checkbox-label">物品强化</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-enchanting-checkbox" name="inventory.enchanting.enabled" />
                                <label for="inventory-enchanting-checkbox" class="checkbox-label">附魔系统</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-upgrading-checkbox" name="inventory.upgrading.enabled" />
                                <label for="inventory-upgrading-checkbox" class="checkbox-label">物品升级</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-combining-checkbox" name="inventory.combining.enabled" />
                                <label for="inventory-combining-checkbox" class="checkbox-label">物品合成</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-dismantling-checkbox" name="inventory.dismantling.enabled" />
                                <label for="inventory-dismantling-checkbox" class="checkbox-label">物品分解</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-recycling-checkbox" name="inventory.recycling.enabled" />
                                <label for="inventory-recycling-checkbox" class="checkbox-label">回收利用</label>
                            </div>
                        </div>
                    </div>

                    <!-- 高级功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-automation-checkbox" name="inventory.automation.enabled" />
                                <label for="inventory-automation-checkbox" class="checkbox-label">自动化管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-ai-sorting-checkbox" name="inventory.aiSorting.enabled" />
                                <label for="inventory-ai-sorting-checkbox" class="checkbox-label">智能排序</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-recommendations-checkbox" name="inventory.recommendations.enabled" />
                                <label for="inventory-recommendations-checkbox" class="checkbox-label">推荐系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-analytics-checkbox" name="inventory.analytics.enabled" />
                                <label for="inventory-analytics-checkbox" class="checkbox-label">使用分析</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-backup-checkbox" name="inventory.backup.enabled" />
                                <label for="inventory-backup-checkbox" class="checkbox-label">数据备份</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-sync-checkbox" name="inventory.sync.enabled" />
                                <label for="inventory-sync-checkbox" class="checkbox-label">云端同步</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-security-checkbox" name="inventory.security.enabled" />
                                <label for="inventory-security-checkbox" class="checkbox-label">安全保护</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="inventory-history-checkbox" name="inventory.history.enabled" />
                                <label for="inventory-history-checkbox" class="checkbox-label">操作历史</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建能力系统面板
     */
    createAbilitiesPanel() {
        return `
            <div class="content-header">
                <h3>能力系统配置</h3>
            </div>

            <div class="content-body">
                <!-- 能力系统卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">⚡</div>
                            <div class="card-text">
                                <div class="card-title">能力系统</div>
                                <div class="card-subtitle">技能和属性管理系统</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="abilities-toggle" name="abilities.enabled" checked />
                                <label for="abilities-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">25/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 基础属性 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-strength-checkbox" name="abilities.strength.enabled" checked />
                                <label for="abilities-strength-checkbox" class="checkbox-label">力量属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-agility-checkbox" name="abilities.agility.enabled" checked />
                                <label for="abilities-agility-checkbox" class="checkbox-label">敏捷属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-intelligence-checkbox" name="abilities.intelligence.enabled" checked />
                                <label for="abilities-intelligence-checkbox" class="checkbox-label">智力属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-constitution-checkbox" name="abilities.constitution.enabled" />
                                <label for="abilities-constitution-checkbox" class="checkbox-label">体质属性</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-wisdom-checkbox" name="abilities.wisdom.enabled" />
                                <label for="abilities-wisdom-checkbox" class="checkbox-label">智慧属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-charisma-checkbox" name="abilities.charisma.enabled" />
                                <label for="abilities-charisma-checkbox" class="checkbox-label">魅力属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-luck-checkbox" name="abilities.luck.enabled" />
                                <label for="abilities-luck-checkbox" class="checkbox-label">幸运属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-perception-checkbox" name="abilities.perception.enabled" />
                                <label for="abilities-perception-checkbox" class="checkbox-label">感知属性</label>
                            </div>
                        </div>
                    </div>

                    <!-- 战斗技能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-swordsmanship-checkbox" name="abilities.swordsmanship.enabled" checked />
                                <label for="abilities-swordsmanship-checkbox" class="checkbox-label">剑术技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-archery-checkbox" name="abilities.archery.enabled" />
                                <label for="abilities-archery-checkbox" class="checkbox-label">弓箭技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-magic-checkbox" name="abilities.magic.enabled" checked />
                                <label for="abilities-magic-checkbox" class="checkbox-label">魔法技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-defense-checkbox" name="abilities.defense.enabled" />
                                <label for="abilities-defense-checkbox" class="checkbox-label">防御技能</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-martial-arts-checkbox" name="abilities.martialArts.enabled" />
                                <label for="abilities-martial-arts-checkbox" class="checkbox-label">武术技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-stealth-checkbox" name="abilities.stealth.enabled" />
                                <label for="abilities-stealth-checkbox" class="checkbox-label">潜行技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-tactics-checkbox" name="abilities.tactics.enabled" />
                                <label for="abilities-tactics-checkbox" class="checkbox-label">战术技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-healing-checkbox" name="abilities.healing.enabled" />
                                <label for="abilities-healing-checkbox" class="checkbox-label">治疗技能</label>
                            </div>
                        </div>
                    </div>

                    <!-- 生活技能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-crafting-checkbox" name="abilities.crafting.enabled" />
                                <label for="abilities-crafting-checkbox" class="checkbox-label">制作技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-cooking-checkbox" name="abilities.cooking.enabled" />
                                <label for="abilities-cooking-checkbox" class="checkbox-label">烹饪技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-farming-checkbox" name="abilities.farming.enabled" />
                                <label for="abilities-farming-checkbox" class="checkbox-label">农业技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-mining-checkbox" name="abilities.mining.enabled" />
                                <label for="abilities-mining-checkbox" class="checkbox-label">采矿技能</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-fishing-checkbox" name="abilities.fishing.enabled" />
                                <label for="abilities-fishing-checkbox" class="checkbox-label">钓鱼技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-hunting-checkbox" name="abilities.hunting.enabled" />
                                <label for="abilities-hunting-checkbox" class="checkbox-label">狩猎技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-trading-checkbox" name="abilities.trading.enabled" />
                                <label for="abilities-trading-checkbox" class="checkbox-label">交易技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-negotiation-checkbox" name="abilities.negotiation.enabled" />
                                <label for="abilities-negotiation-checkbox" class="checkbox-label">谈判技能</label>
                            </div>
                        </div>
                    </div>

                    <!-- 知识技能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-research-checkbox" name="abilities.research.enabled" />
                                <label for="abilities-research-checkbox" class="checkbox-label">研究技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-investigation-checkbox" name="abilities.investigation.enabled" />
                                <label for="abilities-investigation-checkbox" class="checkbox-label">调查技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-languages-checkbox" name="abilities.languages.enabled" />
                                <label for="abilities-languages-checkbox" class="checkbox-label">语言技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-history-checkbox" name="abilities.history.enabled" />
                                <label for="abilities-history-checkbox" class="checkbox-label">历史知识</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-medicine-checkbox" name="abilities.medicine.enabled" />
                                <label for="abilities-medicine-checkbox" class="checkbox-label">医学知识</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-alchemy-checkbox" name="abilities.alchemy.enabled" />
                                <label for="abilities-alchemy-checkbox" class="checkbox-label">炼金术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-engineering-checkbox" name="abilities.engineering.enabled" />
                                <label for="abilities-engineering-checkbox" class="checkbox-label">工程学</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-astronomy-checkbox" name="abilities.astronomy.enabled" />
                                <label for="abilities-astronomy-checkbox" class="checkbox-label">天文学</label>
                            </div>
                        </div>
                    </div>

                    <!-- 社交技能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-persuasion-checkbox" name="abilities.persuasion.enabled" />
                                <label for="abilities-persuasion-checkbox" class="checkbox-label">说服技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-deception-checkbox" name="abilities.deception.enabled" />
                                <label for="abilities-deception-checkbox" class="checkbox-label">欺骗技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-intimidation-checkbox" name="abilities.intimidation.enabled" />
                                <label for="abilities-intimidation-checkbox" class="checkbox-label">威吓技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-performance-checkbox" name="abilities.performance.enabled" />
                                <label for="abilities-performance-checkbox" class="checkbox-label">表演技能</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-leadership-checkbox" name="abilities.leadership.enabled" />
                                <label for="abilities-leadership-checkbox" class="checkbox-label">领导技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-empathy-checkbox" name="abilities.empathy.enabled" />
                                <label for="abilities-empathy-checkbox" class="checkbox-label">共情技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-insight-checkbox" name="abilities.insight.enabled" />
                                <label for="abilities-insight-checkbox" class="checkbox-label">洞察技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-networking-checkbox" name="abilities.networking.enabled" />
                                <label for="abilities-networking-checkbox" class="checkbox-label">人脉技能</label>
                            </div>
                        </div>
                    </div>

                    <!-- 特殊能力 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-telepathy-checkbox" name="abilities.telepathy.enabled" />
                                <label for="abilities-telepathy-checkbox" class="checkbox-label">心灵感应</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-telekinesis-checkbox" name="abilities.telekinesis.enabled" />
                                <label for="abilities-telekinesis-checkbox" class="checkbox-label">念力移物</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-precognition-checkbox" name="abilities.precognition.enabled" />
                                <label for="abilities-precognition-checkbox" class="checkbox-label">预知能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-shapeshifting-checkbox" name="abilities.shapeshifting.enabled" />
                                <label for="abilities-shapeshifting-checkbox" class="checkbox-label">变形能力</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-invisibility-checkbox" name="abilities.invisibility.enabled" />
                                <label for="abilities-invisibility-checkbox" class="checkbox-label">隐身能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-flight-checkbox" name="abilities.flight.enabled" />
                                <label for="abilities-flight-checkbox" class="checkbox-label">飞行能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-regeneration-checkbox" name="abilities.regeneration.enabled" />
                                <label for="abilities-regeneration-checkbox" class="checkbox-label">再生能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="abilities-immortality-checkbox" name="abilities.immortality.enabled" />
                                <label for="abilities-immortality-checkbox" class="checkbox-label">不朽能力</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建剧情面板
     */
    createPlotPanel() {
        return `
            <div class="content-header">
                <h3>剧情面板配置</h3>
            </div>

            <div class="content-body">
                <!-- 剧情面板卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">📖</div>
                            <div class="card-text">
                                <div class="card-title">剧情面板</div>
                                <div class="card-subtitle">故事情节和叙事管理</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="plot-toggle" name="plot.enabled" checked />
                                <label for="plot-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">18/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 剧情结构 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-main-story-checkbox" name="plot.mainStory.enabled" checked />
                                <label for="plot-main-story-checkbox" class="checkbox-label">主线剧情</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-side-quests-checkbox" name="plot.sideQuests.enabled" checked />
                                <label for="plot-side-quests-checkbox" class="checkbox-label">支线任务</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-subplots-checkbox" name="plot.subplots.enabled" checked />
                                <label for="plot-subplots-checkbox" class="checkbox-label">子情节</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-backstory-checkbox" name="plot.backstory.enabled" />
                                <label for="plot-backstory-checkbox" class="checkbox-label">背景故事</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-prologue-checkbox" name="plot.prologue.enabled" />
                                <label for="plot-prologue-checkbox" class="checkbox-label">序章</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-epilogue-checkbox" name="plot.epilogue.enabled" />
                                <label for="plot-epilogue-checkbox" class="checkbox-label">尾声</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-flashbacks-checkbox" name="plot.flashbacks.enabled" />
                                <label for="plot-flashbacks-checkbox" class="checkbox-label">回忆片段</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-foreshadowing-checkbox" name="plot.foreshadowing.enabled" />
                                <label for="plot-foreshadowing-checkbox" class="checkbox-label">伏笔铺垫</label>
                            </div>
                        </div>
                    </div>

                    <!-- 剧情阶段 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-exposition-checkbox" name="plot.exposition.enabled" checked />
                                <label for="plot-exposition-checkbox" class="checkbox-label">开端</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-rising-action-checkbox" name="plot.risingAction.enabled" />
                                <label for="plot-rising-action-checkbox" class="checkbox-label">发展</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-climax-checkbox" name="plot.climax.enabled" />
                                <label for="plot-climax-checkbox" class="checkbox-label">高潮</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-falling-action-checkbox" name="plot.fallingAction.enabled" />
                                <label for="plot-falling-action-checkbox" class="checkbox-label">下降</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-resolution-checkbox" name="plot.resolution.enabled" />
                                <label for="plot-resolution-checkbox" class="checkbox-label">结局</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-denouement-checkbox" name="plot.denouement.enabled" />
                                <label for="plot-denouement-checkbox" class="checkbox-label">收尾</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-cliffhanger-checkbox" name="plot.cliffhanger.enabled" />
                                <label for="plot-cliffhanger-checkbox" class="checkbox-label">悬念结尾</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-twist-checkbox" name="plot.twist.enabled" />
                                <label for="plot-twist-checkbox" class="checkbox-label">剧情转折</label>
                            </div>
                        </div>
                    </div>

                    <!-- 角色发展 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-character-arc-checkbox" name="plot.characterArc.enabled" />
                                <label for="plot-character-arc-checkbox" class="checkbox-label">角色成长</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-relationships-checkbox" name="plot.relationships.enabled" />
                                <label for="plot-relationships-checkbox" class="checkbox-label">关系发展</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-motivations-checkbox" name="plot.motivations.enabled" />
                                <label for="plot-motivations-checkbox" class="checkbox-label">动机驱动</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-conflicts-checkbox" name="plot.conflicts.enabled" />
                                <label for="plot-conflicts-checkbox" class="checkbox-label">冲突矛盾</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-internal-conflicts-checkbox" name="plot.internalConflicts.enabled" />
                                <label for="plot-internal-conflicts-checkbox" class="checkbox-label">内心冲突</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-external-conflicts-checkbox" name="plot.externalConflicts.enabled" />
                                <label for="plot-external-conflicts-checkbox" class="checkbox-label">外部冲突</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-moral-dilemmas-checkbox" name="plot.moralDilemmas.enabled" />
                                <label for="plot-moral-dilemmas-checkbox" class="checkbox-label">道德困境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-sacrifices-checkbox" name="plot.sacrifices.enabled" />
                                <label for="plot-sacrifices-checkbox" class="checkbox-label">牺牲选择</label>
                            </div>
                        </div>
                    </div>

                    <!-- 叙事技巧 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-dialogue-checkbox" name="plot.dialogue.enabled" />
                                <label for="plot-dialogue-checkbox" class="checkbox-label">对话系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-narration-checkbox" name="plot.narration.enabled" />
                                <label for="plot-narration-checkbox" class="checkbox-label">叙述描写</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-monologue-checkbox" name="plot.monologue.enabled" />
                                <label for="plot-monologue-checkbox" class="checkbox-label">内心独白</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-symbolism-checkbox" name="plot.symbolism.enabled" />
                                <label for="plot-symbolism-checkbox" class="checkbox-label">象征隐喻</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-themes-checkbox" name="plot.themes.enabled" />
                                <label for="plot-themes-checkbox" class="checkbox-label">主题表达</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-mood-checkbox" name="plot.mood.enabled" />
                                <label for="plot-mood-checkbox" class="checkbox-label">氛围营造</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-tone-checkbox" name="plot.tone.enabled" />
                                <label for="plot-tone-checkbox" class="checkbox-label">语调风格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-pacing-checkbox" name="plot.pacing.enabled" />
                                <label for="plot-pacing-checkbox" class="checkbox-label">节奏控制</label>
                            </div>
                        </div>
                    </div>

                    <!-- 互动元素 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-choices-checkbox" name="plot.choices.enabled" />
                                <label for="plot-choices-checkbox" class="checkbox-label">选择分支</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-consequences-checkbox" name="plot.consequences.enabled" />
                                <label for="plot-consequences-checkbox" class="checkbox-label">后果影响</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-branching-checkbox" name="plot.branching.enabled" />
                                <label for="plot-branching-checkbox" class="checkbox-label">分支剧情</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-multiple-endings-checkbox" name="plot.multipleEndings.enabled" />
                                <label for="plot-multiple-endings-checkbox" class="checkbox-label">多重结局</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-player-agency-checkbox" name="plot.playerAgency.enabled" />
                                <label for="plot-player-agency-checkbox" class="checkbox-label">玩家主导</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-emergent-narrative-checkbox" name="plot.emergentNarrative.enabled" />
                                <label for="plot-emergent-narrative-checkbox" class="checkbox-label">涌现叙事</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-procedural-generation-checkbox" name="plot.proceduralGeneration.enabled" />
                                <label for="plot-procedural-generation-checkbox" class="checkbox-label">程序生成</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-adaptive-storytelling-checkbox" name="plot.adaptiveStorytelling.enabled" />
                                <label for="plot-adaptive-storytelling-checkbox" class="checkbox-label">自适应叙事</label>
                            </div>
                        </div>
                    </div>

                    <!-- 管理功能 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-timeline-checkbox" name="plot.timeline.enabled" />
                                <label for="plot-timeline-checkbox" class="checkbox-label">时间线管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-notes-checkbox" name="plot.notes.enabled" />
                                <label for="plot-notes-checkbox" class="checkbox-label">剧情笔记</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-bookmarks-checkbox" name="plot.bookmarks.enabled" />
                                <label for="plot-bookmarks-checkbox" class="checkbox-label">重要节点</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-save-states-checkbox" name="plot.saveStates.enabled" />
                                <label for="plot-save-states-checkbox" class="checkbox-label">存档管理</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-auto-save-checkbox" name="plot.autoSave.enabled" />
                                <label for="plot-auto-save-checkbox" class="checkbox-label">自动保存</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-export-checkbox" name="plot.export.enabled" />
                                <label for="plot-export-checkbox" class="checkbox-label">导出功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-import-checkbox" name="plot.import.enabled" />
                                <label for="plot-import-checkbox" class="checkbox-label">导入功能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="plot-analytics-checkbox" name="plot.analytics.enabled" />
                                <label for="plot-analytics-checkbox" class="checkbox-label">剧情分析</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建修仙世界面板
     */
    createCultivationPanel() {
        return `
            <div class="content-header">
                <h3>修仙世界配置</h3>
            </div>

            <div class="content-body">
                <!-- 修仙世界卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">⚡</div>
                            <div class="card-text">
                                <div class="card-title">修仙世界</div>
                                <div class="card-subtitle">仙侠修炼体系设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="cultivation-toggle" name="cultivation.enabled" checked />
                                <label for="cultivation-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">22/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 修炼境界 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-qi-refining-checkbox" name="cultivation.qiRefining.enabled" checked />
                                <label for="cultivation-qi-refining-checkbox" class="checkbox-label">炼气期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-foundation-checkbox" name="cultivation.foundation.enabled" checked />
                                <label for="cultivation-foundation-checkbox" class="checkbox-label">筑基期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-golden-core-checkbox" name="cultivation.goldenCore.enabled" checked />
                                <label for="cultivation-golden-core-checkbox" class="checkbox-label">金丹期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-nascent-soul-checkbox" name="cultivation.nascentSoul.enabled" />
                                <label for="cultivation-nascent-soul-checkbox" class="checkbox-label">元婴期</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-soul-transformation-checkbox" name="cultivation.soulTransformation.enabled" />
                                <label for="cultivation-soul-transformation-checkbox" class="checkbox-label">化神期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-void-refinement-checkbox" name="cultivation.voidRefinement.enabled" />
                                <label for="cultivation-void-refinement-checkbox" class="checkbox-label">炼虚期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-body-integration-checkbox" name="cultivation.bodyIntegration.enabled" />
                                <label for="cultivation-body-integration-checkbox" class="checkbox-label">合体期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-mahayana-checkbox" name="cultivation.mahayana.enabled" />
                                <label for="cultivation-mahayana-checkbox" class="checkbox-label">大乘期</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-tribulation-checkbox" name="cultivation.tribulation.enabled" />
                                <label for="cultivation-tribulation-checkbox" class="checkbox-label">渡劫期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-immortal-checkbox" name="cultivation.immortal.enabled" />
                                <label for="cultivation-immortal-checkbox" class="checkbox-label">仙人境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-true-immortal-checkbox" name="cultivation.trueImmortal.enabled" />
                                <label for="cultivation-true-immortal-checkbox" class="checkbox-label">真仙境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-golden-immortal-checkbox" name="cultivation.goldenImmortal.enabled" />
                                <label for="cultivation-golden-immortal-checkbox" class="checkbox-label">金仙境</label>
                            </div>
                        </div>
                    </div>

                    <!-- 功法体系 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-breathing-technique-checkbox" name="cultivation.breathingTechnique.enabled" checked />
                                <label for="cultivation-breathing-technique-checkbox" class="checkbox-label">吐纳功法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-body-refining-checkbox" name="cultivation.bodyRefining.enabled" />
                                <label for="cultivation-body-refining-checkbox" class="checkbox-label">炼体功法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-soul-cultivation-checkbox" name="cultivation.soulCultivation.enabled" />
                                <label for="cultivation-soul-cultivation-checkbox" class="checkbox-label">神魂功法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-dual-cultivation-checkbox" name="cultivation.dualCultivation.enabled" />
                                <label for="cultivation-dual-cultivation-checkbox" class="checkbox-label">双修功法</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-sword-cultivation-checkbox" name="cultivation.swordCultivation.enabled" />
                                <label for="cultivation-sword-cultivation-checkbox" class="checkbox-label">剑修功法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-alchemy-checkbox" name="cultivation.alchemy.enabled" />
                                <label for="cultivation-alchemy-checkbox" class="checkbox-label">炼丹术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-formation-checkbox" name="cultivation.formation.enabled" />
                                <label for="cultivation-formation-checkbox" class="checkbox-label">阵法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-talisman-checkbox" name="cultivation.talisman.enabled" />
                                <label for="cultivation-talisman-checkbox" class="checkbox-label">符箓术</label>
                            </div>
                        </div>
                    </div>

                    <!-- 灵力系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spiritual-power-checkbox" name="cultivation.spiritualPower.enabled" checked />
                                <label for="cultivation-spiritual-power-checkbox" class="checkbox-label">灵力值</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spiritual-root-checkbox" name="cultivation.spiritualRoot.enabled" />
                                <label for="cultivation-spiritual-root-checkbox" class="checkbox-label">灵根资质</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-meridians-checkbox" name="cultivation.meridians.enabled" />
                                <label for="cultivation-meridians-checkbox" class="checkbox-label">经脉系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-dantian-checkbox" name="cultivation.dantian.enabled" />
                                <label for="cultivation-dantian-checkbox" class="checkbox-label">丹田气海</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-divine-sense-checkbox" name="cultivation.divineSense.enabled" />
                                <label for="cultivation-divine-sense-checkbox" class="checkbox-label">神识</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-life-span-checkbox" name="cultivation.lifeSpan.enabled" />
                                <label for="cultivation-life-span-checkbox" class="checkbox-label">寿元</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-karma-checkbox" name="cultivation.karma.enabled" />
                                <label for="cultivation-karma-checkbox" class="checkbox-label">因果业力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-heavenly-dao-checkbox" name="cultivation.heavenlyDao.enabled" />
                                <label for="cultivation-heavenly-dao-checkbox" class="checkbox-label">天道感悟</label>
                            </div>
                        </div>
                    </div>

                    <!-- 法宝装备 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-flying-sword-checkbox" name="cultivation.flyingSword.enabled" />
                                <label for="cultivation-flying-sword-checkbox" class="checkbox-label">飞剑</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-magic-treasure-checkbox" name="cultivation.magicTreasure.enabled" />
                                <label for="cultivation-magic-treasure-checkbox" class="checkbox-label">法宝</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spiritual-armor-checkbox" name="cultivation.spiritualArmor.enabled" />
                                <label for="cultivation-spiritual-armor-checkbox" class="checkbox-label">灵甲</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-storage-ring-checkbox" name="cultivation.storageRing.enabled" />
                                <label for="cultivation-storage-ring-checkbox" class="checkbox-label">储物戒</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spirit-beast-checkbox" name="cultivation.spiritBeast.enabled" />
                                <label for="cultivation-spirit-beast-checkbox" class="checkbox-label">灵兽</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-puppet-checkbox" name="cultivation.puppet.enabled" />
                                <label for="cultivation-puppet-checkbox" class="checkbox-label">傀儡</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-avatar-checkbox" name="cultivation.avatar.enabled" />
                                <label for="cultivation-avatar-checkbox" class="checkbox-label">化身</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-clone-checkbox" name="cultivation.clone.enabled" />
                                <label for="cultivation-clone-checkbox" class="checkbox-label">分身</label>
                            </div>
                        </div>
                    </div>

                    <!-- 修炼资源 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spirit-stone-checkbox" name="cultivation.spiritStone.enabled" />
                                <label for="cultivation-spirit-stone-checkbox" class="checkbox-label">灵石</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spirit-herb-checkbox" name="cultivation.spiritHerb.enabled" />
                                <label for="cultivation-spirit-herb-checkbox" class="checkbox-label">灵草</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-pill-checkbox" name="cultivation.pill.enabled" />
                                <label for="cultivation-pill-checkbox" class="checkbox-label">丹药</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-spirit-vein-checkbox" name="cultivation.spiritVein.enabled" />
                                <label for="cultivation-spirit-vein-checkbox" class="checkbox-label">灵脉</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-cave-mansion-checkbox" name="cultivation.caveMansion.enabled" />
                                <label for="cultivation-cave-mansion-checkbox" class="checkbox-label">洞府</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-secret-realm-checkbox" name="cultivation.secretRealm.enabled" />
                                <label for="cultivation-secret-realm-checkbox" class="checkbox-label">秘境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-inheritance-checkbox" name="cultivation.inheritance.enabled" />
                                <label for="cultivation-inheritance-checkbox" class="checkbox-label">传承</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-opportunity-checkbox" name="cultivation.opportunity.enabled" />
                                <label for="cultivation-opportunity-checkbox" class="checkbox-label">机缘</label>
                            </div>
                        </div>
                    </div>

                    <!-- 修炼活动 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-meditation-checkbox" name="cultivation.meditation.enabled" />
                                <label for="cultivation-meditation-checkbox" class="checkbox-label">打坐修炼</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-tribulation-crossing-checkbox" name="cultivation.tribulationCrossing.enabled" />
                                <label for="cultivation-tribulation-crossing-checkbox" class="checkbox-label">渡劫</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-enlightenment-checkbox" name="cultivation.enlightenment.enabled" />
                                <label for="cultivation-enlightenment-checkbox" class="checkbox-label">顿悟</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-breakthrough-checkbox" name="cultivation.breakthrough.enabled" />
                                <label for="cultivation-breakthrough-checkbox" class="checkbox-label">突破</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-sect-checkbox" name="cultivation.sect.enabled" />
                                <label for="cultivation-sect-checkbox" class="checkbox-label">宗门</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-master-disciple-checkbox" name="cultivation.masterDisciple.enabled" />
                                <label for="cultivation-master-disciple-checkbox" class="checkbox-label">师徒关系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-dao-companion-checkbox" name="cultivation.daoCompanion.enabled" />
                                <label for="cultivation-dao-companion-checkbox" class="checkbox-label">道侣</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="cultivation-immortal-ascension-checkbox" name="cultivation.immortalAscension.enabled" />
                                <label for="cultivation-immortal-ascension-checkbox" class="checkbox-label">飞升</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建玄幻世界面板
     */
    createFantasyPanel() {
        return `
            <div class="content-header">
                <h3>玄幻世界配置</h3>
            </div>

            <div class="content-body">
                <!-- 玄幻世界卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🐉</div>
                            <div class="card-text">
                                <div class="card-title">玄幻世界</div>
                                <div class="card-subtitle">奇幻魔法世界设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="fantasy-toggle" name="fantasy.enabled" checked />
                                <label for="fantasy-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">19/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <!-- 子项配置 -->
                <div class="sub-items">
                    <!-- 种族系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-human-checkbox" name="fantasy.human.enabled" checked />
                                <label for="fantasy-human-checkbox" class="checkbox-label">人类</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-elf-checkbox" name="fantasy.elf.enabled" checked />
                                <label for="fantasy-elf-checkbox" class="checkbox-label">精灵</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-dwarf-checkbox" name="fantasy.dwarf.enabled" checked />
                                <label for="fantasy-dwarf-checkbox" class="checkbox-label">矮人</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-orc-checkbox" name="fantasy.orc.enabled" />
                                <label for="fantasy-orc-checkbox" class="checkbox-label">兽人</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-dragon-checkbox" name="fantasy.dragon.enabled" />
                                <label for="fantasy-dragon-checkbox" class="checkbox-label">龙族</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-demon-checkbox" name="fantasy.demon.enabled" />
                                <label for="fantasy-demon-checkbox" class="checkbox-label">魔族</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-angel-checkbox" name="fantasy.angel.enabled" />
                                <label for="fantasy-angel-checkbox" class="checkbox-label">天使</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-undead-checkbox" name="fantasy.undead.enabled" />
                                <label for="fantasy-undead-checkbox" class="checkbox-label">不死族</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-halfling-checkbox" name="fantasy.halfling.enabled" />
                                <label for="fantasy-halfling-checkbox" class="checkbox-label">半身人</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-giant-checkbox" name="fantasy.giant.enabled" />
                                <label for="fantasy-giant-checkbox" class="checkbox-label">巨人</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-fairy-checkbox" name="fantasy.fairy.enabled" />
                                <label for="fantasy-fairy-checkbox" class="checkbox-label">妖精</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-vampire-checkbox" name="fantasy.vampire.enabled" />
                                <label for="fantasy-vampire-checkbox" class="checkbox-label">吸血鬼</label>
                            </div>
                        </div>
                    </div>

                    <!-- 魔法系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-fire-magic-checkbox" name="fantasy.fireMagic.enabled" checked />
                                <label for="fantasy-fire-magic-checkbox" class="checkbox-label">火系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-water-magic-checkbox" name="fantasy.waterMagic.enabled" />
                                <label for="fantasy-water-magic-checkbox" class="checkbox-label">水系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-earth-magic-checkbox" name="fantasy.earthMagic.enabled" />
                                <label for="fantasy-earth-magic-checkbox" class="checkbox-label">土系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-air-magic-checkbox" name="fantasy.airMagic.enabled" />
                                <label for="fantasy-air-magic-checkbox" class="checkbox-label">风系魔法</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-light-magic-checkbox" name="fantasy.lightMagic.enabled" />
                                <label for="fantasy-light-magic-checkbox" class="checkbox-label">光系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-dark-magic-checkbox" name="fantasy.darkMagic.enabled" />
                                <label for="fantasy-dark-magic-checkbox" class="checkbox-label">暗系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-nature-magic-checkbox" name="fantasy.natureMagic.enabled" />
                                <label for="fantasy-nature-magic-checkbox" class="checkbox-label">自然魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-space-magic-checkbox" name="fantasy.spaceMagic.enabled" />
                                <label for="fantasy-space-magic-checkbox" class="checkbox-label">空间魔法</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-time-magic-checkbox" name="fantasy.timeMagic.enabled" />
                                <label for="fantasy-time-magic-checkbox" class="checkbox-label">时间魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-necromancy-checkbox" name="fantasy.necromancy.enabled" />
                                <label for="fantasy-necromancy-checkbox" class="checkbox-label">死灵魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-illusion-magic-checkbox" name="fantasy.illusionMagic.enabled" />
                                <label for="fantasy-illusion-magic-checkbox" class="checkbox-label">幻术魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-enchantment-checkbox" name="fantasy.enchantment.enabled" />
                                <label for="fantasy-enchantment-checkbox" class="checkbox-label">附魔魔法</label>
                            </div>
                        </div>
                    </div>

                    <!-- 职业系统 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-warrior-checkbox" name="fantasy.warrior.enabled" />
                                <label for="fantasy-warrior-checkbox" class="checkbox-label">战士</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-mage-checkbox" name="fantasy.mage.enabled" />
                                <label for="fantasy-mage-checkbox" class="checkbox-label">法师</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-archer-checkbox" name="fantasy.archer.enabled" />
                                <label for="fantasy-archer-checkbox" class="checkbox-label">弓箭手</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-rogue-checkbox" name="fantasy.rogue.enabled" />
                                <label for="fantasy-rogue-checkbox" class="checkbox-label">盗贼</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-priest-checkbox" name="fantasy.priest.enabled" />
                                <label for="fantasy-priest-checkbox" class="checkbox-label">牧师</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-paladin-checkbox" name="fantasy.paladin.enabled" />
                                <label for="fantasy-paladin-checkbox" class="checkbox-label">圣骑士</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-druid-checkbox" name="fantasy.druid.enabled" />
                                <label for="fantasy-druid-checkbox" class="checkbox-label">德鲁伊</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-warlock-checkbox" name="fantasy.warlock.enabled" />
                                <label for="fantasy-warlock-checkbox" class="checkbox-label">术士</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-bard-checkbox" name="fantasy.bard.enabled" />
                                <label for="fantasy-bard-checkbox" class="checkbox-label">吟游诗人</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-monk-checkbox" name="fantasy.monk.enabled" />
                                <label for="fantasy-monk-checkbox" class="checkbox-label">武僧</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-ranger-checkbox" name="fantasy.ranger.enabled" />
                                <label for="fantasy-ranger-checkbox" class="checkbox-label">游侠</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-assassin-checkbox" name="fantasy.assassin.enabled" />
                                <label for="fantasy-assassin-checkbox" class="checkbox-label">刺客</label>
                            </div>
                        </div>
                    </div>

                    <!-- 神话生物 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-phoenix-checkbox" name="fantasy.phoenix.enabled" />
                                <label for="fantasy-phoenix-checkbox" class="checkbox-label">凤凰</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-unicorn-checkbox" name="fantasy.unicorn.enabled" />
                                <label for="fantasy-unicorn-checkbox" class="checkbox-label">独角兽</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-griffin-checkbox" name="fantasy.griffin.enabled" />
                                <label for="fantasy-griffin-checkbox" class="checkbox-label">狮鹫</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-pegasus-checkbox" name="fantasy.pegasus.enabled" />
                                <label for="fantasy-pegasus-checkbox" class="checkbox-label">飞马</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-kraken-checkbox" name="fantasy.kraken.enabled" />
                                <label for="fantasy-kraken-checkbox" class="checkbox-label">海妖</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-chimera-checkbox" name="fantasy.chimera.enabled" />
                                <label for="fantasy-chimera-checkbox" class="checkbox-label">奇美拉</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-basilisk-checkbox" name="fantasy.basilisk.enabled" />
                                <label for="fantasy-basilisk-checkbox" class="checkbox-label">蛇怪</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-hydra-checkbox" name="fantasy.hydra.enabled" />
                                <label for="fantasy-hydra-checkbox" class="checkbox-label">九头蛇</label>
                            </div>
                        </div>
                    </div>

                    <!-- 神器装备 -->
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-legendary-weapon-checkbox" name="fantasy.legendaryWeapon.enabled" />
                                <label for="fantasy-legendary-weapon-checkbox" class="checkbox-label">传说武器</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-magic-armor-checkbox" name="fantasy.magicArmor.enabled" />
                                <label for="fantasy-magic-armor-checkbox" class="checkbox-label">魔法护甲</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-artifact-checkbox" name="fantasy.artifact.enabled" />
                                <label for="fantasy-artifact-checkbox" class="checkbox-label">神器</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-relic-checkbox" name="fantasy.relic.enabled" />
                                <label for="fantasy-relic-checkbox" class="checkbox-label">圣遗物</label>
                            </div>
                        </div>
                    </div>

                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-magic-crystal-checkbox" name="fantasy.magicCrystal.enabled" />
                                <label for="fantasy-magic-crystal-checkbox" class="checkbox-label">魔法水晶</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-enchanted-item-checkbox" name="fantasy.enchantedItem.enabled" />
                                <label for="fantasy-enchanted-item-checkbox" class="checkbox-label">附魔物品</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-potion-checkbox" name="fantasy.potion.enabled" />
                                <label for="fantasy-potion-checkbox" class="checkbox-label">魔法药剂</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="fantasy-scroll-checkbox" name="fantasy.scroll.enabled" />
                                <label for="fantasy-scroll-checkbox" class="checkbox-label">魔法卷轴</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建都市现代面板
     */
    createModernPanel() {
        return `
            <div class="content-header">
                <h3>都市现代配置</h3>
            </div>

            <div class="content-body">
                <!-- 都市现代卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🏙️</div>
                            <div class="card-text">
                                <div class="card-title">都市现代</div>
                                <div class="card-subtitle">现代都市生活设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="modern-toggle" name="modern.enabled" checked />
                                <label for="modern-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">8/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h4>🏙️ 城市生活</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-city-checkbox" name="modern.city.enabled" checked />
                                <label for="modern-city-checkbox" class="checkbox-label">居住城市</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-district-checkbox" name="modern.district.enabled" checked />
                                <label for="modern-district-checkbox" class="checkbox-label">所在区域</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-housing-checkbox" name="modern.housing.enabled" />
                                <label for="modern-housing-checkbox" class="checkbox-label">住房类型</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-transport-checkbox" name="modern.transport.enabled" checked />
                                <label for="modern-transport-checkbox" class="checkbox-label">交通方式</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-neighborhood-checkbox" name="modern.neighborhood.enabled" />
                                <label for="modern-neighborhood-checkbox" class="checkbox-label">社区环境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-facilities-checkbox" name="modern.facilities.enabled" />
                                <label for="modern-facilities-checkbox" class="checkbox-label">周边设施</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-cost-checkbox" name="modern.cost.enabled" />
                                <label for="modern-cost-checkbox" class="checkbox-label">生活成本</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-safety-checkbox" name="modern.safety.enabled" />
                                <label for="modern-safety-checkbox" class="checkbox-label">安全指数</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-pollution-checkbox" name="modern.pollution.enabled" />
                                <label for="modern-pollution-checkbox" class="checkbox-label">环境质量</label>
                            </div>
                        </div>
                    </div>

                    <h4>💼 职业发展</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-job-checkbox" name="modern.job.enabled" checked />
                                <label for="modern-job-checkbox" class="checkbox-label">当前职业</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-company-checkbox" name="modern.company.enabled" />
                                <label for="modern-company-checkbox" class="checkbox-label">工作单位</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-position-checkbox" name="modern.position.enabled" />
                                <label for="modern-position-checkbox" class="checkbox-label">职位级别</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-income-checkbox" name="modern.income.enabled" checked />
                                <label for="modern-income-checkbox" class="checkbox-label">收入水平</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-worktime-checkbox" name="modern.worktime.enabled" />
                                <label for="modern-worktime-checkbox" class="checkbox-label">工作时间</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-benefits-checkbox" name="modern.benefits.enabled" />
                                <label for="modern-benefits-checkbox" class="checkbox-label">福利待遇</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-career-checkbox" name="modern.career.enabled" />
                                <label for="modern-career-checkbox" class="checkbox-label">职业规划</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-skills-checkbox" name="modern.skills.enabled" />
                                <label for="modern-skills-checkbox" class="checkbox-label">专业技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-education-checkbox" name="modern.education.enabled" />
                                <label for="modern-education-checkbox" class="checkbox-label">教育背景</label>
                            </div>
                        </div>
                    </div>

                    <h4>📱 科技生活</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-smartphone-checkbox" name="modern.smartphone.enabled" checked />
                                <label for="modern-smartphone-checkbox" class="checkbox-label">智能手机</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-computer-checkbox" name="modern.computer.enabled" />
                                <label for="modern-computer-checkbox" class="checkbox-label">电脑设备</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-internet-checkbox" name="modern.internet.enabled" />
                                <label for="modern-internet-checkbox" class="checkbox-label">网络使用</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-social-checkbox" name="modern.social.enabled" checked />
                                <label for="modern-social-checkbox" class="checkbox-label">社交媒体</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-gaming-checkbox" name="modern.gaming.enabled" />
                                <label for="modern-gaming-checkbox" class="checkbox-label">游戏娱乐</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-streaming-checkbox" name="modern.streaming.enabled" />
                                <label for="modern-streaming-checkbox" class="checkbox-label">视频平台</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-shopping-checkbox" name="modern.shopping.enabled" />
                                <label for="modern-shopping-checkbox" class="checkbox-label">在线购物</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-payment-checkbox" name="modern.payment.enabled" />
                                <label for="modern-payment-checkbox" class="checkbox-label">移动支付</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-ai-checkbox" name="modern.ai.enabled" />
                                <label for="modern-ai-checkbox" class="checkbox-label">AI助手</label>
                            </div>
                        </div>
                    </div>

                    <h4>🏥 健康管理</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-health-checkbox" name="modern.health.enabled" />
                                <label for="modern-health-checkbox" class="checkbox-label">健康状况</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-fitness-checkbox" name="modern.fitness.enabled" />
                                <label for="modern-fitness-checkbox" class="checkbox-label">健身习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-diet-checkbox" name="modern.diet.enabled" />
                                <label for="modern-diet-checkbox" class="checkbox-label">饮食习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-sleep-checkbox" name="modern.sleep.enabled" />
                                <label for="modern-sleep-checkbox" class="checkbox-label">睡眠质量</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-medical-checkbox" name="modern.medical.enabled" />
                                <label for="modern-medical-checkbox" class="checkbox-label">医疗保险</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-stress-checkbox" name="modern.stress.enabled" />
                                <label for="modern-stress-checkbox" class="checkbox-label">压力管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-mental-checkbox" name="modern.mental.enabled" />
                                <label for="modern-mental-checkbox" class="checkbox-label">心理健康</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-checkup-checkbox" name="modern.checkup.enabled" />
                                <label for="modern-checkup-checkbox" class="checkbox-label">定期体检</label>
                            </div>
                        </div>
                    </div>

                    <h4>🛍️ 消费习惯</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-budget-checkbox" name="modern.budget.enabled" />
                                <label for="modern-budget-checkbox" class="checkbox-label">消费预算</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-brands-checkbox" name="modern.brands.enabled" />
                                <label for="modern-brands-checkbox" class="checkbox-label">品牌偏好</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-fashion-checkbox" name="modern.fashion.enabled" />
                                <label for="modern-fashion-checkbox" class="checkbox-label">时尚风格</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-luxury-checkbox" name="modern.luxury.enabled" />
                                <label for="modern-luxury-checkbox" class="checkbox-label">奢侈品消费</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-investment-checkbox" name="modern.investment.enabled" />
                                <label for="modern-investment-checkbox" class="checkbox-label">投资理财</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-saving-checkbox" name="modern.saving.enabled" />
                                <label for="modern-saving-checkbox" class="checkbox-label">储蓄习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-credit-checkbox" name="modern.credit.enabled" />
                                <label for="modern-credit-checkbox" class="checkbox-label">信用记录</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-insurance-checkbox" name="modern.insurance.enabled" />
                                <label for="modern-insurance-checkbox" class="checkbox-label">保险配置</label>
                            </div>
                        </div>
                    </div>

                    <h4>🎭 娱乐休闲</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-movies-checkbox" name="modern.movies.enabled" />
                                <label for="modern-movies-checkbox" class="checkbox-label">电影偏好</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-music-checkbox" name="modern.music.enabled" />
                                <label for="modern-music-checkbox" class="checkbox-label">音乐品味</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-books-checkbox" name="modern.books.enabled" />
                                <label for="modern-books-checkbox" class="checkbox-label">阅读习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-travel-checkbox" name="modern.travel.enabled" />
                                <label for="modern-travel-checkbox" class="checkbox-label">旅行经历</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-sports-checkbox" name="modern.sports.enabled" />
                                <label for="modern-sports-checkbox" class="checkbox-label">运动爱好</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-hobbies-checkbox" name="modern.hobbies.enabled" />
                                <label for="modern-hobbies-checkbox" class="checkbox-label">兴趣爱好</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-clubs-checkbox" name="modern.clubs.enabled" />
                                <label for="modern-clubs-checkbox" class="checkbox-label">社团活动</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="modern-events-checkbox" name="modern.events.enabled" />
                                <label for="modern-events-checkbox" class="checkbox-label">活动参与</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建历史古代面板
     */
    createHistoricalPanel() {
        return `
            <div class="content-header">
                <h3>历史古代配置</h3>
            </div>

            <div class="content-body">
                <!-- 历史古代卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🏛️</div>
                            <div class="card-text">
                                <div class="card-title">历史古代</div>
                                <div class="card-subtitle">古代历史背景设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="historical-toggle" name="historical.enabled" checked />
                                <label for="historical-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">7/52 项已配置</span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h4>🏛️ 朝代背景</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-dynasty-checkbox" name="historical.dynasty.enabled" checked />
                                <label for="historical-dynasty-checkbox" class="checkbox-label">历史朝代</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-period-checkbox" name="historical.period.enabled" checked />
                                <label for="historical-period-checkbox" class="checkbox-label">历史时期</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-emperor-checkbox" name="historical.emperor.enabled" />
                                <label for="historical-emperor-checkbox" class="checkbox-label">在位皇帝</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-capital-checkbox" name="historical.capital.enabled" />
                                <label for="historical-capital-checkbox" class="checkbox-label">都城位置</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-region-checkbox" name="historical.region.enabled" />
                                <label for="historical-region-checkbox" class="checkbox-label">所在州府</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-events-checkbox" name="historical.events.enabled" />
                                <label for="historical-events-checkbox" class="checkbox-label">重大事件</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-wars-checkbox" name="historical.wars.enabled" />
                                <label for="historical-wars-checkbox" class="checkbox-label">战争背景</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-politics-checkbox" name="historical.politics.enabled" />
                                <label for="historical-politics-checkbox" class="checkbox-label">政治环境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-economy-checkbox" name="historical.economy.enabled" />
                                <label for="historical-economy-checkbox" class="checkbox-label">经济状况</label>
                            </div>
                        </div>
                    </div>

                    <h4>👑 社会地位</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-class-checkbox" name="historical.class.enabled" checked />
                                <label for="historical-class-checkbox" class="checkbox-label">社会阶层</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-title-checkbox" name="historical.title.enabled" />
                                <label for="historical-title-checkbox" class="checkbox-label">官职爵位</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-family-checkbox" name="historical.family.enabled" checked />
                                <label for="historical-family-checkbox" class="checkbox-label">家族背景</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-wealth-checkbox" name="historical.wealth.enabled" />
                                <label for="historical-wealth-checkbox" class="checkbox-label">财富状况</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-land-checkbox" name="historical.land.enabled" />
                                <label for="historical-land-checkbox" class="checkbox-label">土地财产</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-servants-checkbox" name="historical.servants.enabled" />
                                <label for="historical-servants-checkbox" class="checkbox-label">仆从随从</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-influence-checkbox" name="historical.influence.enabled" />
                                <label for="historical-influence-checkbox" class="checkbox-label">政治影响</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-reputation-checkbox" name="historical.reputation.enabled" />
                                <label for="historical-reputation-checkbox" class="checkbox-label">社会声望</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-connections-checkbox" name="historical.connections.enabled" />
                                <label for="historical-connections-checkbox" class="checkbox-label">人脉关系</label>
                            </div>
                        </div>
                    </div>

                    <h4>📚 文化修养</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-education-checkbox" name="historical.education.enabled" checked />
                                <label for="historical-education-checkbox" class="checkbox-label">教育程度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-poetry-checkbox" name="historical.poetry.enabled" />
                                <label for="historical-poetry-checkbox" class="checkbox-label">诗词歌赋</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-calligraphy-checkbox" name="historical.calligraphy.enabled" />
                                <label for="historical-calligraphy-checkbox" class="checkbox-label">书法绘画</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-music-checkbox" name="historical.music.enabled" />
                                <label for="historical-music-checkbox" class="checkbox-label">音律乐器</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-chess-checkbox" name="historical.chess.enabled" />
                                <label for="historical-chess-checkbox" class="checkbox-label">棋艺博弈</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-classics-checkbox" name="historical.classics.enabled" />
                                <label for="historical-classics-checkbox" class="checkbox-label">经史子集</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-philosophy-checkbox" name="historical.philosophy.enabled" />
                                <label for="historical-philosophy-checkbox" class="checkbox-label">哲学思想</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-etiquette-checkbox" name="historical.etiquette.enabled" />
                                <label for="historical-etiquette-checkbox" class="checkbox-label">礼仪规范</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-language-checkbox" name="historical.language.enabled" />
                                <label for="historical-language-checkbox" class="checkbox-label">语言文字</label>
                            </div>
                        </div>
                    </div>

                    <h4>⚔️ 武艺技能</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-martial-checkbox" name="historical.martial.enabled" checked />
                                <label for="historical-martial-checkbox" class="checkbox-label">武艺水平</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-weapons-checkbox" name="historical.weapons.enabled" />
                                <label for="historical-weapons-checkbox" class="checkbox-label">兵器使用</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-archery-checkbox" name="historical.archery.enabled" />
                                <label for="historical-archery-checkbox" class="checkbox-label">弓箭射术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-horsemanship-checkbox" name="historical.horsemanship.enabled" />
                                <label for="historical-horsemanship-checkbox" class="checkbox-label">骑术马术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-strategy-checkbox" name="historical.strategy.enabled" />
                                <label for="historical-strategy-checkbox" class="checkbox-label">兵法战略</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-bodyguard-checkbox" name="historical.bodyguard.enabled" />
                                <label for="historical-bodyguard-checkbox" class="checkbox-label">护卫技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-hunting-checkbox" name="historical.hunting.enabled" />
                                <label for="historical-hunting-checkbox" class="checkbox-label">狩猎技巧</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-survival-checkbox" name="historical.survival.enabled" />
                                <label for="historical-survival-checkbox" class="checkbox-label">野外生存</label>
                            </div>
                        </div>
                    </div>

                    <h4>🏠 生活方式</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-residence-checkbox" name="historical.residence.enabled" />
                                <label for="historical-residence-checkbox" class="checkbox-label">居住环境</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-clothing-checkbox" name="historical.clothing.enabled" checked />
                                <label for="historical-clothing-checkbox" class="checkbox-label">服饰穿着</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-food-checkbox" name="historical.food.enabled" />
                                <label for="historical-food-checkbox" class="checkbox-label">饮食习惯</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-transport-checkbox" name="historical.transport.enabled" />
                                <label for="historical-transport-checkbox" class="checkbox-label">出行方式</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-entertainment-checkbox" name="historical.entertainment.enabled" />
                                <label for="historical-entertainment-checkbox" class="checkbox-label">娱乐活动</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-festivals-checkbox" name="historical.festivals.enabled" />
                                <label for="historical-festivals-checkbox" class="checkbox-label">节庆习俗</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-religion-checkbox" name="historical.religion.enabled" />
                                <label for="historical-religion-checkbox" class="checkbox-label">宗教信仰</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-medicine-checkbox" name="historical.medicine.enabled" />
                                <label for="historical-medicine-checkbox" class="checkbox-label">医药知识</label>
                            </div>
                        </div>
                    </div>

                    <h4>💼 职业技能</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-profession-checkbox" name="historical.profession.enabled" checked />
                                <label for="historical-profession-checkbox" class="checkbox-label">职业身份</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-crafts-checkbox" name="historical.crafts.enabled" />
                                <label for="historical-crafts-checkbox" class="checkbox-label">手工技艺</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-trade-checkbox" name="historical.trade.enabled" />
                                <label for="historical-trade-checkbox" class="checkbox-label">商贸经营</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-farming-checkbox" name="historical.farming.enabled" />
                                <label for="historical-farming-checkbox" class="checkbox-label">农业种植</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-administration-checkbox" name="historical.administration.enabled" />
                                <label for="historical-administration-checkbox" class="checkbox-label">行政管理</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-teaching-checkbox" name="historical.teaching.enabled" />
                                <label for="historical-teaching-checkbox" class="checkbox-label">教学传授</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-healing-checkbox" name="historical.healing.enabled" />
                                <label for="historical-healing-checkbox" class="checkbox-label">医术治疗</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="historical-construction-checkbox" name="historical.construction.enabled" />
                                <label for="historical-construction-checkbox" class="checkbox-label">建筑营造</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建魔法能力面板
     */
    createMagicPanel() {
        return `
            <div class="content-header">
                <h3>魔法能力配置</h3>
            </div>

            <div class="content-body">
                <!-- 魔法能力卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🔮</div>
                            <div class="card-text">
                                <div class="card-title">魔法能力</div>
                                <div class="card-subtitle">魔法系统能力设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="magic-toggle" name="magic.enabled" checked />
                                <label for="magic-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">9/53 项已配置</span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h4>🔮 魔法学派</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-evocation-checkbox" name="magic.evocation.enabled" checked />
                                <label for="magic-evocation-checkbox" class="checkbox-label">塑能系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-illusion-checkbox" name="magic.illusion.enabled" checked />
                                <label for="magic-illusion-checkbox" class="checkbox-label">幻术系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-enchantment-checkbox" name="magic.enchantment.enabled" />
                                <label for="magic-enchantment-checkbox" class="checkbox-label">惑控系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-necromancy-checkbox" name="magic.necromancy.enabled" />
                                <label for="magic-necromancy-checkbox" class="checkbox-label">死灵系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-divination-checkbox" name="magic.divination.enabled" />
                                <label for="magic-divination-checkbox" class="checkbox-label">预言系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-transmutation-checkbox" name="magic.transmutation.enabled" />
                                <label for="magic-transmutation-checkbox" class="checkbox-label">变化系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-conjuration-checkbox" name="magic.conjuration.enabled" />
                                <label for="magic-conjuration-checkbox" class="checkbox-label">咒法系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-abjuration-checkbox" name="magic.abjuration.enabled" />
                                <label for="magic-abjuration-checkbox" class="checkbox-label">防护系</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-elemental-checkbox" name="magic.elemental.enabled" />
                                <label for="magic-elemental-checkbox" class="checkbox-label">元素系</label>
                            </div>
                        </div>
                    </div>

                    <h4>⚡ 法术等级</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-cantrip-checkbox" name="magic.cantrip.enabled" checked />
                                <label for="magic-cantrip-checkbox" class="checkbox-label">戏法(0环)</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level1-checkbox" name="magic.level1.enabled" checked />
                                <label for="magic-level1-checkbox" class="checkbox-label">1环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level2-checkbox" name="magic.level2.enabled" />
                                <label for="magic-level2-checkbox" class="checkbox-label">2环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level3-checkbox" name="magic.level3.enabled" />
                                <label for="magic-level3-checkbox" class="checkbox-label">3环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level4-checkbox" name="magic.level4.enabled" />
                                <label for="magic-level4-checkbox" class="checkbox-label">4环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level5-checkbox" name="magic.level5.enabled" />
                                <label for="magic-level5-checkbox" class="checkbox-label">5环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level6-checkbox" name="magic.level6.enabled" />
                                <label for="magic-level6-checkbox" class="checkbox-label">6环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level7-checkbox" name="magic.level7.enabled" />
                                <label for="magic-level7-checkbox" class="checkbox-label">7环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level8-checkbox" name="magic.level8.enabled" />
                                <label for="magic-level8-checkbox" class="checkbox-label">8环法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level9-checkbox" name="magic.level9.enabled" />
                                <label for="magic-level9-checkbox" class="checkbox-label">9环法术</label>
                            </div>
                        </div>
                    </div>

                    <h4>🧙 法师属性</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-level-checkbox" name="magic.level.enabled" checked />
                                <label for="magic-level-checkbox" class="checkbox-label">法师等级</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-mana-checkbox" name="magic.mana.enabled" checked />
                                <label for="magic-mana-checkbox" class="checkbox-label">法力值</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-intelligence-checkbox" name="magic.intelligence.enabled" />
                                <label for="magic-intelligence-checkbox" class="checkbox-label">智力属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-wisdom-checkbox" name="magic.wisdom.enabled" />
                                <label for="magic-wisdom-checkbox" class="checkbox-label">感知属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-charisma-checkbox" name="magic.charisma.enabled" />
                                <label for="magic-charisma-checkbox" class="checkbox-label">魅力属性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-concentration-checkbox" name="magic.concentration.enabled" />
                                <label for="magic-concentration-checkbox" class="checkbox-label">专注能力</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-spellpower-checkbox" name="magic.spellpower.enabled" />
                                <label for="magic-spellpower-checkbox" class="checkbox-label">法术强度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-resistance-checkbox" name="magic.resistance.enabled" />
                                <label for="magic-resistance-checkbox" class="checkbox-label">魔法抗性</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-regeneration-checkbox" name="magic.regeneration.enabled" />
                                <label for="magic-regeneration-checkbox" class="checkbox-label">法力回复</label>
                            </div>
                        </div>
                    </div>

                    <h4>📚 法术书库</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-spellbook-checkbox" name="magic.spellbook.enabled" checked />
                                <label for="magic-spellbook-checkbox" class="checkbox-label">法术书</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-known-checkbox" name="magic.known.enabled" />
                                <label for="magic-known-checkbox" class="checkbox-label">已知法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-prepared-checkbox" name="magic.prepared.enabled" />
                                <label for="magic-prepared-checkbox" class="checkbox-label">准备法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-slots-checkbox" name="magic.slots.enabled" />
                                <label for="magic-slots-checkbox" class="checkbox-label">法术位</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-components-checkbox" name="magic.components.enabled" />
                                <label for="magic-components-checkbox" class="checkbox-label">法术材料</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-rituals-checkbox" name="magic.rituals.enabled" />
                                <label for="magic-rituals-checkbox" class="checkbox-label">仪式法术</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-metamagic-checkbox" name="magic.metamagic.enabled" />
                                <label for="magic-metamagic-checkbox" class="checkbox-label">超魔专长</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-scrolls-checkbox" name="magic.scrolls.enabled" />
                                <label for="magic-scrolls-checkbox" class="checkbox-label">法术卷轴</label>
                            </div>
                        </div>
                    </div>

                    <h4>🔥 元素魔法</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-fire-checkbox" name="magic.fire.enabled" checked />
                                <label for="magic-fire-checkbox" class="checkbox-label">火系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-water-checkbox" name="magic.water.enabled" />
                                <label for="magic-water-checkbox" class="checkbox-label">水系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-earth-checkbox" name="magic.earth.enabled" />
                                <label for="magic-earth-checkbox" class="checkbox-label">土系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-air-checkbox" name="magic.air.enabled" />
                                <label for="magic-air-checkbox" class="checkbox-label">风系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-lightning-checkbox" name="magic.lightning.enabled" />
                                <label for="magic-lightning-checkbox" class="checkbox-label">雷系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-ice-checkbox" name="magic.ice.enabled" />
                                <label for="magic-ice-checkbox" class="checkbox-label">冰系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-light-checkbox" name="magic.light.enabled" />
                                <label for="magic-light-checkbox" class="checkbox-label">光系魔法</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-dark-checkbox" name="magic.dark.enabled" />
                                <label for="magic-dark-checkbox" class="checkbox-label">暗系魔法</label>
                            </div>
                        </div>
                    </div>

                    <h4>🛡️ 魔法装备</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-staff-checkbox" name="magic.staff.enabled" />
                                <label for="magic-staff-checkbox" class="checkbox-label">法杖</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-wand-checkbox" name="magic.wand.enabled" />
                                <label for="magic-wand-checkbox" class="checkbox-label">魔杖</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-orb-checkbox" name="magic.orb.enabled" />
                                <label for="magic-orb-checkbox" class="checkbox-label">法球</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-robe-checkbox" name="magic.robe.enabled" />
                                <label for="magic-robe-checkbox" class="checkbox-label">法袍</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-amulet-checkbox" name="magic.amulet.enabled" />
                                <label for="magic-amulet-checkbox" class="checkbox-label">护身符</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-ring-checkbox" name="magic.ring.enabled" />
                                <label for="magic-ring-checkbox" class="checkbox-label">魔法戒指</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-crystal-checkbox" name="magic.crystal.enabled" />
                                <label for="magic-crystal-checkbox" class="checkbox-label">魔法水晶</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="magic-tome-checkbox" name="magic.tome.enabled" />
                                <label for="magic-tome-checkbox" class="checkbox-label">魔法典籍</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    /**
     * 创建调教系统面板
     */
    createTrainingPanel() {
        return `
            <div class="content-header">
                <h3>调教系统配置</h3>
            </div>

            <div class="content-body">
                <!-- 调教系统卡片 -->
                <div class="info-card">
                    <div class="card-header">
                        <div class="card-info-left">
                            <div class="card-icon">🎯</div>
                            <div class="card-text">
                                <div class="card-title">调教系统</div>
                                <div class="card-subtitle">训练系统功能设定</div>
                            </div>
                        </div>
                        <div class="card-toggle">
                            <div class="toggle-switch">
                                <input type="checkbox" id="training-toggle" name="training.enabled" checked />
                                <label for="training-toggle" class="switch-slider"></label>
                            </div>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="card-status">
                            <span class="status-badge enabled">已启用</span>
                            <span class="status-count">6/51 项已配置</span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h4>📚 基础训练</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-obedience-checkbox" name="training.obedience.enabled" checked />
                                <label for="training-obedience-checkbox" class="checkbox-label">服从训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-discipline-checkbox" name="training.discipline.enabled" checked />
                                <label for="training-discipline-checkbox" class="checkbox-label">纪律训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-etiquette-checkbox" name="training.etiquette.enabled" />
                                <label for="training-etiquette-checkbox" class="checkbox-label">礼仪训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-posture-checkbox" name="training.posture.enabled" />
                                <label for="training-posture-checkbox" class="checkbox-label">姿态训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-speech-checkbox" name="training.speech.enabled" />
                                <label for="training-speech-checkbox" class="checkbox-label">言语训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-behavior-checkbox" name="training.behavior.enabled" />
                                <label for="training-behavior-checkbox" class="checkbox-label">行为规范</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-attention-checkbox" name="training.attention.enabled" />
                                <label for="training-attention-checkbox" class="checkbox-label">注意力训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-patience-checkbox" name="training.patience.enabled" />
                                <label for="training-patience-checkbox" class="checkbox-label">耐心训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-focus-checkbox" name="training.focus.enabled" />
                                <label for="training-focus-checkbox" class="checkbox-label">专注训练</label>
                            </div>
                        </div>
                    </div>

                    <h4>🎯 技能训练</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-service-checkbox" name="training.service.enabled" checked />
                                <label for="training-service-checkbox" class="checkbox-label">服务技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-cooking-checkbox" name="training.cooking.enabled" />
                                <label for="training-cooking-checkbox" class="checkbox-label">烹饪技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-cleaning-checkbox" name="training.cleaning.enabled" />
                                <label for="training-cleaning-checkbox" class="checkbox-label">清洁技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-massage-checkbox" name="training.massage.enabled" />
                                <label for="training-massage-checkbox" class="checkbox-label">按摩技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-entertainment-checkbox" name="training.entertainment.enabled" />
                                <label for="training-entertainment-checkbox" class="checkbox-label">娱乐技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-music-checkbox" name="training.music.enabled" />
                                <label for="training-music-checkbox" class="checkbox-label">音乐技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-dance-checkbox" name="training.dance.enabled" />
                                <label for="training-dance-checkbox" class="checkbox-label">舞蹈技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-art-checkbox" name="training.art.enabled" />
                                <label for="training-art-checkbox" class="checkbox-label">艺术技能</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-language-checkbox" name="training.language.enabled" />
                                <label for="training-language-checkbox" class="checkbox-label">语言技能</label>
                            </div>
                        </div>
                    </div>

                    <h4>💪 体能训练</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-strength-checkbox" name="training.strength.enabled" />
                                <label for="training-strength-checkbox" class="checkbox-label">力量训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-endurance-checkbox" name="training.endurance.enabled" />
                                <label for="training-endurance-checkbox" class="checkbox-label">耐力训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-flexibility-checkbox" name="training.flexibility.enabled" />
                                <label for="training-flexibility-checkbox" class="checkbox-label">柔韧训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-balance-checkbox" name="training.balance.enabled" />
                                <label for="training-balance-checkbox" class="checkbox-label">平衡训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-coordination-checkbox" name="training.coordination.enabled" />
                                <label for="training-coordination-checkbox" class="checkbox-label">协调训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-agility-checkbox" name="training.agility.enabled" />
                                <label for="training-agility-checkbox" class="checkbox-label">敏捷训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-stamina-checkbox" name="training.stamina.enabled" />
                                <label for="training-stamina-checkbox" class="checkbox-label">体力训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-recovery-checkbox" name="training.recovery.enabled" />
                                <label for="training-recovery-checkbox" class="checkbox-label">恢复训练</label>
                            </div>
                        </div>
                    </div>

                    <h4>🧠 心理训练</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-confidence-checkbox" name="training.confidence.enabled" checked />
                                <label for="training-confidence-checkbox" class="checkbox-label">自信训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-stress-checkbox" name="training.stress.enabled" />
                                <label for="training-stress-checkbox" class="checkbox-label">抗压训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-emotion-checkbox" name="training.emotion.enabled" />
                                <label for="training-emotion-checkbox" class="checkbox-label">情绪控制</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-memory-checkbox" name="training.memory.enabled" />
                                <label for="training-memory-checkbox" class="checkbox-label">记忆训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-logic-checkbox" name="training.logic.enabled" />
                                <label for="training-logic-checkbox" class="checkbox-label">逻辑训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-creativity-checkbox" name="training.creativity.enabled" />
                                <label for="training-creativity-checkbox" class="checkbox-label">创造力训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-meditation-checkbox" name="training.meditation.enabled" />
                                <label for="training-meditation-checkbox" class="checkbox-label">冥想训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-mindfulness-checkbox" name="training.mindfulness.enabled" />
                                <label for="training-mindfulness-checkbox" class="checkbox-label">正念训练</label>
                            </div>
                        </div>
                    </div>

                    <h4>⚙️ 训练设置</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-intensity-checkbox" name="training.intensity.enabled" checked />
                                <label for="training-intensity-checkbox" class="checkbox-label">训练强度</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-duration-checkbox" name="training.duration.enabled" />
                                <label for="training-duration-checkbox" class="checkbox-label">训练时长</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-frequency-checkbox" name="training.frequency.enabled" />
                                <label for="training-frequency-checkbox" class="checkbox-label">训练频率</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-progress-checkbox" name="training.progress.enabled" />
                                <label for="training-progress-checkbox" class="checkbox-label">进度跟踪</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-rewards-checkbox" name="training.rewards.enabled" />
                                <label for="training-rewards-checkbox" class="checkbox-label">奖励系统</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-punishment-checkbox" name="training.punishment.enabled" />
                                <label for="training-punishment-checkbox" class="checkbox-label">惩罚机制</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-schedule-checkbox" name="training.schedule.enabled" />
                                <label for="training-schedule-checkbox" class="checkbox-label">训练计划</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-evaluation-checkbox" name="training.evaluation.enabled" />
                                <label for="training-evaluation-checkbox" class="checkbox-label">效果评估</label>
                            </div>
                        </div>
                    </div>

                    <h4>📊 高级功能</h4>
                    <div class="sub-item-row">
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-auto-checkbox" name="training.auto.enabled" checked />
                                <label for="training-auto-checkbox" class="checkbox-label">自动训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-adaptive-checkbox" name="training.adaptive.enabled" />
                                <label for="training-adaptive-checkbox" class="checkbox-label">自适应训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-ai-checkbox" name="training.ai.enabled" />
                                <label for="training-ai-checkbox" class="checkbox-label">AI辅助训练</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-analytics-checkbox" name="training.analytics.enabled" />
                                <label for="training-analytics-checkbox" class="checkbox-label">数据分析</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-reports-checkbox" name="training.reports.enabled" />
                                <label for="training-reports-checkbox" class="checkbox-label">训练报告</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-export-checkbox" name="training.export.enabled" />
                                <label for="training-export-checkbox" class="checkbox-label">数据导出</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-backup-checkbox" name="training.backup.enabled" />
                                <label for="training-backup-checkbox" class="checkbox-label">数据备份</label>
                            </div>
                        </div>
                        <div class="sub-item">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="training-sync-checkbox" name="training.sync.enabled" />
                                <label for="training-sync-checkbox" class="checkbox-label">云端同步</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error(`[InfoBarSettings] ❌ 错误 #${this.errorCount}:`, error);
    }

    /**
     * 创建主题预览网格
     */
    createThemePreviewGrid() {
        const themes = [
            {
                id: 'default-dark',
                name: '默认深色',
                description: '经典深色主题，护眼舒适',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            },
            {
                id: 'default-light',
                name: '默认浅色',
                description: '清新浅色主题，简洁明亮',
                colors: { bg: '#ffffff', text: '#333333', primary: '#007bff', border: '#dee2e6' }
            },
            {
                id: 'ocean-blue',
                name: '海洋蓝',
                description: '深邃海洋风格，宁静专注',
                colors: { bg: '#0f1419', text: '#e6fffa', primary: '#00d4aa', border: '#1e3a8a' }
            },
            {
                id: 'forest-green',
                name: '森林绿',
                description: '自然森林风格，清新护眼',
                colors: { bg: '#0d1b0d', text: '#e8f5e8', primary: '#22c55e', border: '#166534' }
            },
            {
                id: 'sunset-orange',
                name: '夕阳橙',
                description: '温暖夕阳风格，活力四射',
                colors: { bg: '#1a0f0a', text: '#fff7ed', primary: '#f97316', border: '#c2410c' }
            },
            {
                id: 'purple-night',
                name: '紫夜',
                description: '神秘紫色风格，优雅高贵',
                colors: { bg: '#1a0f1a', text: '#f3e8ff', primary: '#a855f7', border: '#7c3aed' }
            },
            {
                id: 'cherry-blossom',
                name: '樱花粉',
                description: '浪漫樱花风格，温柔甜美',
                colors: { bg: '#fdf2f8', text: '#831843', primary: '#ec4899', border: '#f9a8d4' }
            },
            {
                id: 'golden-sand',
                name: '金沙',
                description: '奢华金色风格，典雅大气',
                colors: { bg: '#1a1611', text: '#fef3c7', primary: '#f59e0b', border: '#d97706' }
            },
            {
                id: 'ice-blue',
                name: '冰蓝',
                description: '清冷冰蓝风格，冷静理性',
                colors: { bg: '#0f1419', text: '#e0f2fe', primary: '#0ea5e9', border: '#0284c7' }
            },
            {
                id: 'rose-red',
                name: '玫瑰红',
                description: '热情玫瑰风格，浪漫激情',
                colors: { bg: '#1a0a0a', text: '#ffe4e6', primary: '#e11d48', border: '#be123c' }
            },
            {
                id: 'mint-green',
                name: '薄荷绿',
                description: '清新薄荷风格，舒缓放松',
                colors: { bg: '#f0fdf4', text: '#14532d', primary: '#10b981', border: '#a7f3d0' }
            },
            {
                id: 'lavender',
                name: '薰衣草',
                description: '淡雅薰衣草风格，宁静安详',
                colors: { bg: '#faf5ff', text: '#581c87', primary: '#8b5cf6', border: '#c4b5fd' }
            },
            {
                id: 'coffee-brown',
                name: '咖啡棕',
                description: '温暖咖啡风格，沉稳内敛',
                colors: { bg: '#1c1917', text: '#fef7ed', primary: '#a16207', border: '#78716c' }
            },
            {
                id: 'slate-gray',
                name: '石板灰',
                description: '现代石板风格，简约专业',
                colors: { bg: '#0f172a', text: '#f1f5f9', primary: '#64748b', border: '#475569' }
            },
            {
                id: 'custom',
                name: '自定义',
                description: '创建您的专属主题',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            }
        ];

        return themes.map(theme => {
            const isActive = theme.id === 'default-dark' ? 'active' : '';
            const isCustom = theme.id === 'custom';
            const currentBadge = theme.id === 'default-dark' ? '<div class="current-badge">当前</div>' : '';

            return `
                <div class="theme-preview-card ${isActive}"
                     data-theme="${theme.id}"
                     data-custom="${isCustom}">
                    <div class="theme-preview-mini" style="background: ${theme.colors.bg}; border: 1px solid ${theme.colors.border};">
                        <div class="preview-header-mini" style="background: ${theme.colors.primary}; color: ${theme.colors.bg};">标题</div>
                        <div class="preview-content-mini" style="color: ${theme.colors.text};">内容</div>
                        <div class="preview-button-mini" style="background: ${theme.colors.primary}; color: ${theme.colors.bg};">按钮</div>
                    </div>
                    <div class="theme-info">
                        <h4>${theme.name}</h4>
                        <p>${theme.description}</p>
                    </div>
                    ${currentBadge}
                </div>
            `;
        }).join('');
    }

    /**
     * 创建信息栏风格预览网格
     */
    createStylePreviewGrid() {
        const styles = [
            {
                id: 'end-generated',
                name: '结尾生成式',
                description: '在对话结尾显示信息栏，不干扰对话流程',
                icon: '📝',
                preview: {
                    layout: 'end',
                    position: 'bottom',
                    integration: 'separate'
                }
            },
            {
                id: 'conversation-wrapped',
                name: '对话包裹式',
                description: '将整个对话内容包裹在信息栏框架中',
                icon: '🎁',
                preview: {
                    layout: 'wrapped',
                    position: 'around',
                    integration: 'integrated'
                }
            },
            {
                id: 'sidebar',
                name: '侧边栏式',
                description: '在对话侧边显示固定的信息栏',
                icon: '📋',
                preview: {
                    layout: 'sidebar',
                    position: 'side',
                    integration: 'parallel'
                }
            },
            {
                id: 'floating',
                name: '浮动式',
                description: '悬浮显示的可拖拽信息栏',
                icon: '🎈',
                preview: {
                    layout: 'floating',
                    position: 'overlay',
                    integration: 'independent'
                }
            },
            {
                id: 'embedded',
                name: '内嵌式',
                description: '嵌入到对话内容中的信息栏',
                icon: '🔗',
                preview: {
                    layout: 'embedded',
                    position: 'inline',
                    integration: 'merged'
                }
            },
            {
                id: 'interactive',
                name: '前端交互式',
                description: '功能丰富的交互式信息栏界面，包含按钮、输入框、标签页等',
                icon: '🎛️',
                preview: {
                    layout: 'interactive',
                    position: 'overlay',
                    integration: 'advanced'
                }
            }
        ];

        return styles.map(style => {
            const isActive = style.id === 'end-generated' ? 'active' : '';
            const currentBadge = style.id === 'end-generated' ? '<div class="current-badge">当前</div>' : '';

            return `
                <div class="style-preview-card ${isActive}"
                     data-style="${style.id}">
                    <div class="style-preview-mini">
                        <div class="style-icon">${style.icon}</div>
                        <div class="style-layout-demo">
                            ${this.createStyleLayoutDemo(style.preview)}
                        </div>
                    </div>
                    <div class="style-info">
                        <h4>${style.name}</h4>
                        <p>${style.description}</p>
                    </div>
                    ${currentBadge}
                </div>
            `;
        }).join('');
    }

    /**
     * 创建风格布局演示
     * @param {Object} preview - 预览配置
     */
    createStyleLayoutDemo(preview) {
        switch (preview.layout) {
            case 'end':
                return `
                    <div class="demo-chat">💬</div>
                    <div class="demo-infobar">📊</div>
                `;
            case 'wrapped':
                return `
                    <div class="demo-wrapper">
                        <div class="demo-chat">💬</div>
                        <div class="demo-frame">📊</div>
                    </div>
                `;
            case 'sidebar':
                return `
                    <div class="demo-layout">
                        <div class="demo-chat">💬</div>
                        <div class="demo-sidebar">📊</div>
                    </div>
                `;
            case 'floating':
                return `
                    <div class="demo-base">💬</div>
                    <div class="demo-float">📊</div>
                `;
            case 'embedded':
                return `
                    <div class="demo-merged">
                        💬📊
                    </div>
                `;
            default:
                return `<div class="demo-default">📊</div>`;
        }
    }
    /**
     * 选择主题
     * @param {string} themeId - 主题ID
     */
    async selectTheme(themeId) {
        try {
            console.log('[InfoBarSettings] 🎨 选择主题:', themeId);

            // 获取主题配置
            const theme = this.getThemeById(themeId);
            if (!theme) {
                console.error('[InfoBarSettings] ❌ 未找到主题:', themeId);
                return;
            }

            // 应用主题
            this.applyTheme(theme);

            // 更新主题卡片状态
            this.updateThemeCardStates(themeId);

            // 更新当前主题信息
            this.updateCurrentThemeInfo(theme);

            // 保存主题配置
            await this.saveThemeConfig(themeId);

            console.log('[InfoBarSettings] ✅ 主题切换完成:', theme.name);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 选择主题失败:', error);
        }
    }

    /**
     * 选择信息栏风格
     * @param {string} styleId - 风格ID
     */
    async selectStyle(styleId) {
        try {
            console.log('[InfoBarSettings] 🎭 选择信息栏风格:', styleId);

            // 获取风格配置
            const style = this.getStyleById(styleId);
            if (!style) {
                console.error('[InfoBarSettings] ❌ 未找到风格:', styleId);
                return;
            }

            // 应用风格
            this.applyStyle(style);

            // 更新风格卡片状态
            this.updateStyleCardStates(styleId);

            // 更新当前风格信息
            this.updateCurrentStyleInfo(style);

            // 保存风格配置
            await this.saveStyleConfig(styleId);

            // 刷新所有已渲染的信息栏
            await this.refreshAllInfoBars();

            console.log('[InfoBarSettings] ✅ 风格切换完成:', style.name);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 选择风格失败:', error);
        }
    }

    /**
     * 刷新所有已渲染的信息栏
     */
    async refreshAllInfoBars() {
        try {
            console.log('[InfoBarSettings] 🔄 开始刷新所有信息栏');

            // 获取MessageInfoBarRenderer实例
            const renderer = window.SillyTavernInfobar?.modules?.messageInfoBarRenderer;
            if (renderer && typeof renderer.refreshAllInfoBars === 'function') {
                await renderer.refreshAllInfoBars();
                console.log('[InfoBarSettings] ✅ 信息栏刷新完成');
            } else {
                console.log('[InfoBarSettings] ⚠️ MessageInfoBarRenderer未找到或不支持刷新');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新信息栏失败:', error);
        }
    }

    /**
     * 根据ID获取风格配置
     * @param {string} styleId - 风格ID
     * @returns {Object|null} 风格配置对象
     */
    getStyleById(styleId) {
        const styles = [
            {
                id: 'end-generated',
                name: '结尾生成式',
                description: '在对话结尾显示信息栏，不干扰对话流程',
                config: {
                    position: 'end',
                    layout: 'bottom',
                    integration: 'separate',
                    animation: 'slideUp',
                    autoHide: false,
                    collapsible: true
                }
            },
            {
                id: 'conversation-wrapped',
                name: '对话包裹式',
                description: '将整个对话内容包裹在信息栏框架中',
                config: {
                    position: 'wrapper',
                    layout: 'frame',
                    integration: 'integrated',
                    animation: 'fadeIn',
                    autoHide: false,
                    collapsible: false
                }
            },
            {
                id: 'sidebar',
                name: '侧边栏式',
                description: '在对话侧边显示固定的信息栏',
                config: {
                    position: 'side',
                    layout: 'vertical',
                    integration: 'parallel',
                    animation: 'slideLeft',
                    autoHide: false,
                    collapsible: true
                }
            },
            {
                id: 'floating',
                name: '浮动式',
                description: '悬浮显示的可拖拽信息栏',
                config: {
                    position: 'overlay',
                    layout: 'floating',
                    integration: 'independent',
                    animation: 'bounce',
                    autoHide: true,
                    collapsible: true,
                    draggable: true
                }
            },
            {
                id: 'embedded',
                name: '内嵌式',
                description: '嵌入到对话内容中的信息栏',
                config: {
                    position: 'inline',
                    layout: 'embedded',
                    integration: 'merged',
                    animation: 'expand',
                    autoHide: false,
                    collapsible: false
                }
            },
            {
                id: 'interactive',
                name: '前端交互式',
                description: '功能丰富的交互式信息栏界面，包含按钮、输入框、标签页等',
                config: {
                    position: 'overlay',
                    layout: 'interactive',
                    integration: 'advanced',
                    animation: 'slideIn',
                    autoHide: false,
                    collapsible: true,
                    draggable: true,
                    resizable: true,
                    tabbed: true,
                    interactive: true
                }
            }
        ];

        return styles.find(style => style.id === styleId) || null;
    }

    /**
     * 应用信息栏风格
     * @param {Object} style - 风格配置对象
     */
    applyStyle(style) {
        try {
            console.log('[InfoBarSettings] 🎭 应用信息栏风格:', style.name);

            // 更新全局风格配置
            window.InfoBarStyleConfig = {
                currentStyle: style.id,
                config: style.config,
                timestamp: Date.now()
            };

            // 通过事件系统通知其他模块风格变更
            if (this.eventSystem) {
                this.eventSystem.emit('style:changed', {
                    styleId: style.id,
                    config: style.config,
                    name: style.name
                });
            }

            console.log('[InfoBarSettings] ✅ 信息栏风格应用完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用信息栏风格失败:', error);
        }
    }

    /**
     * 更新风格卡片状态
     * @param {string} activeStyleId - 激活的风格ID
     */
    updateStyleCardStates(activeStyleId) {
        try {
            const styleCards = this.modal.querySelectorAll('.style-preview-card');
            styleCards.forEach(card => {
                const styleId = card.dataset.style;
                const isActive = styleId === activeStyleId;

                // 更新激活状态
                card.classList.toggle('active', isActive);

                // 更新当前标签
                const currentBadge = card.querySelector('.current-badge');
                if (isActive && !currentBadge) {
                    card.insertAdjacentHTML('beforeend', '<div class="current-badge">当前</div>');
                } else if (!isActive && currentBadge) {
                    currentBadge.remove();
                }
            });
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新风格卡片状态失败:', error);
        }
    }

    /**
     * 更新当前风格信息
     * @param {Object} style - 风格配置对象
     */
    updateCurrentStyleInfo(style) {
        try {
            const currentStyleInput = this.modal.querySelector('input[name="style.current"]');
            const styleDescTextarea = this.modal.querySelector('textarea[name="style.description"]');

            if (currentStyleInput) {
                currentStyleInput.value = style.name;
            }

            if (styleDescTextarea) {
                styleDescTextarea.value = style.description;
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新当前风格信息失败:', error);
        }
    }

    /**
     * 保存风格配置
     * @param {string} styleId - 风格ID
     */
    async saveStyleConfig(styleId) {
        try {
            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 保存风格配置
            extensionSettings['Information bar integration tool'].style = {
                current: styleId,
                lastUpdated: new Date().toISOString()
            };

            // 使用 SillyTavern 的持久化方法
            context.saveSettingsDebounced();

            console.log('[InfoBarSettings] 💾 风格配置已保存到 extensionSettings:', styleId);
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存风格配置失败:', error);
        }
    }

    /**
     * 根据ID获取主题配置
     * @param {string} themeId - 主题ID
     * @returns {Object|null} 主题配置对象
     */
    getThemeById(themeId) {
        const themes = [
            {
                id: 'default-dark',
                name: '默认深色',
                description: '经典深色主题，护眼舒适',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            },
            {
                id: 'default-light',
                name: '默认浅色',
                description: '清新浅色主题，简洁明亮',
                colors: { bg: '#ffffff', text: '#333333', primary: '#007bff', border: '#dee2e6' }
            },
            {
                id: 'ocean-blue',
                name: '海洋蓝',
                description: '深邃海洋风格，宁静专注',
                colors: { bg: '#0f1419', text: '#e6fffa', primary: '#00d4aa', border: '#1e3a8a' }
            },
            {
                id: 'forest-green',
                name: '森林绿',
                description: '自然森林风格，清新护眼',
                colors: { bg: '#0d1b0d', text: '#e8f5e8', primary: '#22c55e', border: '#166534' }
            },
            {
                id: 'sunset-orange',
                name: '夕阳橙',
                description: '温暖夕阳风格，活力四射',
                colors: { bg: '#1a0f0a', text: '#fff4e6', primary: '#ff8c00', border: '#cc4400' }
            },
            {
                id: 'purple-night',
                name: '紫夜',
                description: '神秘紫色风格，优雅高贵',
                colors: { bg: '#1a0d1a', text: '#f0e6ff', primary: '#9d4edd', border: '#6a1b9a' }
            },
            {
                id: 'cherry-blossom',
                name: '樱花粉',
                description: '浪漫樱花风格，温柔甜美',
                colors: { bg: '#1a1014', text: '#ffe6f0', primary: '#ff69b4', border: '#d1477a' }
            },
            {
                id: 'golden-sand',
                name: '金沙',
                description: '奢华金色风格，尊贵典雅',
                colors: { bg: '#1a1610', text: '#fff8dc', primary: '#ffd700', border: '#b8860b' }
            },
            {
                id: 'ice-blue',
                name: '冰蓝',
                description: '清冷冰蓝风格，纯净清新',
                colors: { bg: '#0a1419', text: '#e6f7ff', primary: '#00bfff', border: '#0080cc' }
            },
            {
                id: 'rose-red',
                name: '玫瑰红',
                description: '热情玫瑰风格，浪漫激情',
                colors: { bg: '#1a0a0f', text: '#ffe6eb', primary: '#dc143c', border: '#a0102a' }
            },
            {
                id: 'mint-green',
                name: '薄荷绿',
                description: '清新薄荷风格，自然舒缓',
                colors: { bg: '#0a1a14', text: '#e6fff2', primary: '#00fa9a', border: '#00cc7a' }
            },
            {
                id: 'lavender',
                name: '薰衣草',
                description: '淡雅薰衣草风格，宁静安详',
                colors: { bg: '#14141a', text: '#f0f0ff', primary: '#9370db', border: '#7b68ee' }
            },
            {
                id: 'coffee-brown',
                name: '咖啡棕',
                description: '温暖咖啡风格，沉稳内敛',
                colors: { bg: '#1a1410', text: '#f5f0e6', primary: '#8b4513', border: '#654321' }
            },
            {
                id: 'slate-gray',
                name: '石板灰',
                description: '现代石板风格，简约专业',
                colors: { bg: '#1a1a1a', text: '#e6e6e6', primary: '#708090', border: '#556b7d' }
            },
            {
                id: 'custom',
                name: '自定义',
                description: '创建您的专属主题',
                colors: { bg: '#1a1a1a', text: '#ffffff', primary: '#007bff', border: '#333' }
            }
        ];

        return themes.find(theme => theme.id === themeId) || null;
    }

    /**
     * 应用主题
     * @param {Object} theme - 主题配置对象
     */
    applyTheme(theme) {
        try {
            console.log('[InfoBarSettings] 🎨 应用主题:', theme.name);

            // 计算衍生颜色
            const bgSecondary = this.adjustColor(theme.colors.bg, 10);
            const textSecondary = this.adjustColor(theme.colors.text, -20);
            const primaryHover = this.adjustColor(theme.colors.primary, -10);

            // 更新CSS变量
            const root = document.documentElement;
            root.style.setProperty('--theme-bg-primary', theme.colors.bg);
            root.style.setProperty('--theme-bg-secondary', bgSecondary);
            root.style.setProperty('--theme-text-primary', theme.colors.text);
            root.style.setProperty('--theme-text-secondary', textSecondary);
            root.style.setProperty('--theme-primary-color', theme.colors.primary);
            root.style.setProperty('--theme-primary-hover', primaryHover);
            root.style.setProperty('--theme-border-color', theme.colors.border);

            // 应用到信息栏设置界面
            this.applyThemeToInfoBarSettings(theme);

            // 应用到数据表格界面
            this.applyThemeToDataTable(theme);

            console.log('[InfoBarSettings] ✅ 主题应用完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用主题失败:', error);
        }
    }

    /**
     * 更新主题卡片状态
     * @param {string} activeThemeId - 激活的主题ID
     */
    updateThemeCardStates(activeThemeId) {
        try {
            const themeCards = this.modal.querySelectorAll('.theme-preview-card');
            themeCards.forEach(card => {
                const themeId = card.dataset.theme;
                const currentBadge = card.querySelector('.current-badge');

                if (themeId === activeThemeId) {
                    card.classList.add('active');
                    if (!currentBadge) {
                        const badge = document.createElement('div');
                        badge.className = 'current-badge';
                        badge.textContent = '当前';
                        card.appendChild(badge);
                    }
                } else {
                    card.classList.remove('active');
                    if (currentBadge) {
                        currentBadge.remove();
                    }
                }
            });
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新主题卡片状态失败:', error);
        }
    }

    /**
     * 更新当前主题信息
     * @param {Object} theme - 主题配置对象
     */
    updateCurrentThemeInfo(theme) {
        try {
            const currentThemeInput = this.modal.querySelector('[name="theme.current"]');
            const themeDescriptionTextarea = this.modal.querySelector('[name="theme.description"]');

            if (currentThemeInput) {
                currentThemeInput.value = theme.name;
            }

            if (themeDescriptionTextarea) {
                themeDescriptionTextarea.value = theme.description;
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新当前主题信息失败:', error);
        }
    }

    /**
     * 保存主题配置
     * @param {string} themeId - 主题ID
     */
    async saveThemeConfig(themeId) {
        try {
            // 使用 SillyTavern 标准存储机制
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;

            // 确保扩展设置对象存在
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            // 保存主题配置
            extensionSettings['Information bar integration tool'].theme = {
                current: themeId,
                lastUpdated: new Date().toISOString()
            };

            // 使用 SillyTavern 的持久化方法
            context.saveSettingsDebounced();

            console.log('[InfoBarSettings] ✅ 主题配置已保存到 extensionSettings:', themeId);
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存主题配置失败:', error);
        }
    }

    /**
     * 应用主题到信息栏设置界面
     * @param {Object} theme - 主题配置对象
     */
    applyThemeToInfoBarSettings(theme) {
        try {
            if (!this.modal) return;

            // 应用到模态框
            this.modal.style.backgroundColor = theme.colors.bg;
            this.modal.style.color = theme.colors.text;
            this.modal.style.borderColor = theme.colors.border;

            // 应用到所有相关元素
            const elements = this.modal.querySelectorAll('.modal-header, .modal-body, .modal-footer, .nav-item, .content-panel');
            elements.forEach(element => {
                element.style.backgroundColor = theme.colors.bg;
                element.style.color = theme.colors.text;
                element.style.borderColor = theme.colors.border;
            });

            // 🔧 修复：应用主题到总结面板特定元素
            this.applySummaryPanelTheme(theme);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用主题到信息栏设置失败:', error);
        }
    }

    /**
     * 应用主题到总结面板元素
     * @param {Object} theme - 主题配置对象
     */
    applySummaryPanelTheme(theme) {
        try {
            if (!this.modal) return;

            // 总结面板容器
            const summaryContainers = this.modal.querySelectorAll('.summary-settings-container, .summary-history-container, .summary-content-container');
            summaryContainers.forEach(container => {
                container.style.backgroundColor = theme.colors.bg;
                container.style.color = theme.colors.text;
                container.style.borderColor = theme.colors.border;
            });

            // 设置区域
            const settingSections = this.modal.querySelectorAll('.settings-section, .history-section, .content-section');
            settingSections.forEach(section => {
                section.style.backgroundColor = this.adjustColor(theme.colors.bg, 5);
                section.style.color = theme.colors.text;
                section.style.borderColor = theme.colors.border;
            });

            // 输入框和选择框
            const inputs = this.modal.querySelectorAll('#content-auto-summary-enabled, #content-summary-floor-count, #content-summary-type, #content-summary-word-count, #content-summary-history-select');
            inputs.forEach(input => {
                input.style.backgroundColor = theme.colors.bg;
                input.style.color = theme.colors.text;
                input.style.borderColor = theme.colors.border;
            });

            // 删除按钮
            const deleteBtn = this.modal.querySelector('#content-delete-summary-btn');
            if (deleteBtn) {
                deleteBtn.style.backgroundColor = theme.colors.primary;
                deleteBtn.style.color = theme.colors.bg;
                deleteBtn.style.borderColor = theme.colors.primary;
            }

            // 按钮
            const buttons = this.modal.querySelectorAll('#header-manual-summary-btn, #header-refresh-summary-btn, #content-save-settings-btn, #content-delete-summary-btn, [data-action="open-error-log"], [data-action="open-project-link"], [data-action="save-profile"], [data-action="load-profile"], [data-action="delete-profile"], [data-action="export"], [data-action="import"]');
            buttons.forEach(button => {
                button.style.backgroundColor = theme.colors.primary;
                button.style.color = theme.colors.bg;
                button.style.borderColor = theme.colors.primary;
            });

            // 标签和提示文本
            const labels = this.modal.querySelectorAll('.setting-label, .setting-hint, .content-meta');
            labels.forEach(label => {
                label.style.color = this.adjustColor(theme.colors.text, -20);
            });

            // 内容显示区域
            const contentBody = this.modal.querySelector('#content-summary-content-body');
            if (contentBody) {
                contentBody.style.backgroundColor = this.adjustColor(theme.colors.bg, 3);
                contentBody.style.color = theme.colors.text;
                contentBody.style.borderColor = theme.colors.border;
            }

            console.log('[InfoBarSettings] ✅ 总结面板主题应用完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用总结面板主题失败:', error);
        }
    }

    /**
     * 应用主题到数据表格界面
     * @param {Object} theme - 主题配置对象
     */
    applyThemeToDataTable(theme) {
        try {
            console.log('[InfoBarSettings] 🎨 应用主题到数据表格:', theme.name || theme.id);
            
            // 通过事件系统通知数据表格更新主题
            if (this.eventSystem) {
                this.eventSystem.emit('theme:changed', {
                    themeId: theme.id,
                    colors: theme.colors
                });
            }
            
            // 🔧 新增：直接更新数据表格标题的主题样式
            this.updateDataTableHeaderTheme(theme);
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 应用主题到数据表格失败:', error);
        }
    }
    /**
     * 更新数据表格标题的主题样式
     * @param {Object} theme - 主题配置对象
     */
    updateDataTableHeaderTheme(theme) {
        try {
            // 查找数据表格模态框
            const dataTableModal = document.querySelector('.data-table-modal, .datatable-modal-new');
            if (!dataTableModal) {
                console.log('[InfoBarSettings] ℹ️ 数据表格界面未打开，跳过标题主题更新');
                return;
            }
            
            // 更新模态框标题
            const modalHeader = dataTableModal.querySelector('.modal-header');
            const modalTitle = dataTableModal.querySelector('.modal-title, h2');
            
            if (modalHeader && theme.colors) {
                // 应用主题背景色
                if (theme.colors.headerBg) {
                    modalHeader.style.background = theme.colors.headerBg;
                }
                if (theme.colors.headerBorder) {
                    modalHeader.style.borderBottomColor = theme.colors.headerBorder;
                }
            }
            
            if (modalTitle && theme.colors) {
                // 应用主题文字色
                if (theme.colors.headerText) {
                    modalTitle.style.color = theme.colors.headerText;
                }
            }
            
            // 更新表格标题行
            const tableHeader = dataTableModal.querySelector('.table-header');
            if (tableHeader && theme.colors) {
                if (theme.colors.tableBg) {
                    tableHeader.style.backgroundColor = theme.colors.tableBg;
                }
                if (theme.colors.tableText) {
                    tableHeader.style.color = theme.colors.tableText;
                }
                if (theme.colors.tableBorder) {
                    tableHeader.style.borderBottomColor = theme.colors.tableBorder;
                }
            }
            
            console.log('[InfoBarSettings] ✅ 数据表格标题主题已更新');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新数据表格标题主题失败:', error);
        }
    }

    /**
     * 调整颜色亮度
     * @param {string} color - 十六进制颜色值
     * @param {number} amount - 调整量（-100到100）
     * @returns {string} 调整后的颜色值
     */
    adjustColor(color, amount) {
        try {
            const num = parseInt(color.replace('#', ''), 16);
            const r = Math.max(0, Math.min(255, (num >> 16) + amount));
            const g = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amount));
            const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
            return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 调整颜色失败:', error);
            return color;
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            visible: this.visible,
            currentTab: this.currentTab,
            errorCount: this.errorCount
        };
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        
        this.initialized = false;
        console.log('[InfoBarSettings] 💥 设置界面已销毁');
    }

    /**
     * 加载模型列表
     */
    async loadModelList() {
        console.log('[InfoBarSettings] 开始加载模型列表');
        const loadModelsBtn = document.getElementById('load-models-btn');
        const modelSelect = document.getElementById('api-model');
        const connectionStatus = document.getElementById('connection-status');

        if (loadModelsBtn) {
            loadModelsBtn.textContent = '🔄 加载中...';
            loadModelsBtn.disabled = true;
        }

        try {
            // 获取当前配置
            const provider = document.getElementById('api-provider')?.value;
            const interfaceType = document.getElementById('interface-type')?.value;
            const baseUrl = document.getElementById('api-base-url')?.value;
            const apiKey = document.getElementById('api-key')?.value;

            if (!provider || !interfaceType || !baseUrl || !apiKey) {
                throw new Error('请先完成API配置（提供商、接口类型、基础URL、API密钥）');
            }

            let models = [];

            if (provider === 'gemini' && interfaceType === 'native') {
                // Gemini原生接口
                models = await this.loadGeminiNativeModels(baseUrl, apiKey);
            } else if ((provider === 'gemini' && interfaceType === 'openai-compatible') ||
                       (provider === 'custom' && interfaceType === 'openai-compatible')) {
                // OpenAI兼容接口
                models = await this.loadOpenAICompatibleModels(baseUrl, apiKey, provider);
            }

            // 更新模型选择框
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">请选择模型</option>';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    option.title = model.description || model.name;
                    modelSelect.appendChild(option);
                });
            }

            if (connectionStatus) {
                connectionStatus.textContent = `✅ 成功加载 ${models.length} 个模型`;
                connectionStatus.style.color = '#10b981';
            }

            console.log(`[InfoBarSettings] ✅ 成功加载 ${models.length} 个模型:`, models);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载模型列表失败:', error);

            if (connectionStatus) {
                connectionStatus.textContent = `❌ 加载失败: ${error.message}`;
                connectionStatus.style.color = '#ef4444';
            }

            // 显示错误提示
            this.showNotification('加载模型失败: ' + error.message, 'error');
        } finally {
            if (loadModelsBtn) {
                loadModelsBtn.textContent = '📋 加载模型列表';
                loadModelsBtn.disabled = false;
            }
        }
    }

    /**
     * 加载Gemini原生接口模型
     */
    async loadGeminiNativeModels(baseUrl, apiKey) {
        console.log('[InfoBarSettings] 加载Gemini原生模型...');

        // 使用正确的Gemini API端点
        const modelsUrl = `${baseUrl}/v1beta/models?key=${apiKey}`;

        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API错误 (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // 解析Gemini API响应格式
        const models = data.models?.map(model => ({
            id: model.name.replace('models/', ''), // 移除 "models/" 前缀
            name: model.displayName || model.name.replace('models/', ''),
            description: model.description || `Gemini模型: ${model.name}`
        })) || [];

        // 过滤出支持generateContent的模型
        const supportedModels = models.filter(model =>
            model.id.includes('gemini') &&
            !model.id.includes('embedding')
        );

        console.log(`[InfoBarSettings] Gemini原生接口加载了 ${supportedModels.length} 个模型`);
        return supportedModels;
    }

    /**
     * 加载OpenAI兼容接口模型
     */
    async loadOpenAICompatibleModels(baseUrl, apiKey, provider) {
        console.log('[InfoBarSettings] 加载OpenAI兼容模型...');

        let modelsUrl;
        let headers;

        if (provider === 'gemini') {
            // Gemini OpenAI兼容接口
            modelsUrl = `https://generativelanguage.googleapis.com/v1beta/openai/models`;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        } else {
            // 自定义OpenAI兼容接口
            modelsUrl = `${baseUrl}/models`;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        }

        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API错误 (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // 解析OpenAI格式响应
        const models = data.data?.map(model => ({
            id: model.id,
            name: model.id,
            description: model.description || `模型: ${model.id}`
        })) || [];

        console.log(`[InfoBarSettings] OpenAI兼容接口加载了 ${models.length} 个模型`);
        return models;
    }

    /**
     * 处理API启用状态变更
     */
    async handleAPIEnabledChange(enabled) {
        try {
            console.log('[InfoBarSettings] 🔄 API启用状态变更:', enabled);

            if (enabled) {
                // 启用自定义API
                console.log('[InfoBarSettings] ✅ 启用自定义API模式');

                // 🔧 修复：设置主API限制规则，禁止输出冲突标签
                await this.setupMainAPIRestrictions();

                // 初始化自定义API处理
                await this.initCustomAPIHandling();

                // 显示成功消息
                this.showNotification('✅ 自定义API已启用，主API Hook已清理', 'success');

            } else {
                // 禁用自定义API
                console.log('[InfoBarSettings] ⏸️ 禁用自定义API模式');

                // 🔧 修复：移除主API限制规则
                await this.removeMainAPIRestrictions();

                // 清理自定义API处理
                await this.clearCustomAPIHandling();

                // 显示成功消息
                this.showNotification('⏸️ 自定义API已禁用，主API Hook已恢复', 'info');
            }

            // 更新配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }
            if (!extensionSettings['Information bar integration tool'].apiConfig) {
                extensionSettings['Information bar integration tool'].apiConfig = {};
            }

            extensionSettings['Information bar integration tool'].apiConfig.enabled = enabled;
            context.saveSettingsDebounced();

            console.log('[InfoBarSettings] ✅ API启用状态已更新');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理API启用状态变更失败:', error);
            this.showNotification('❌ API状态变更失败: ' + error.message, 'error');
        }
    }

    /**
     * 处理API提供商变更
     */
    handleProviderChange(provider) {
        console.log('[InfoBarSettings] API提供商变更:', provider);

        const interfaceTypeSelect = document.getElementById('interface-type');
        const baseUrlInput = document.getElementById('api-base-url');

        if (!interfaceTypeSelect || !baseUrlInput) return;

        // 确保name属性正确
        interfaceTypeSelect.name = 'apiConfig.format';

        // 清空接口类型选项
        interfaceTypeSelect.innerHTML = '<option value="">请选择接口类型</option>';
        baseUrlInput.value = '';

        if (provider === 'gemini') {
            // Gemini提供商的接口类型
            interfaceTypeSelect.innerHTML = `
                <option value="">请选择接口类型</option>
                <option value="native">Gemini原生接口</option>
                <option value="openai-compatible">OpenAI兼容接口</option>
            `;
        } else if (provider === 'custom') {
            // 自定义提供商的接口类型
            interfaceTypeSelect.innerHTML = `
                <option value="">请选择接口类型</option>
                <option value="openai-compatible">OpenAI兼容接口</option>
            `;
        }
    }

    /**
     * 处理接口类型变更
     */
    handleInterfaceTypeChange(interfaceType) {
        console.log('[InfoBarSettings] 接口类型变更:', interfaceType);

        const provider = document.getElementById('api-provider')?.value;
        const baseUrlInput = document.getElementById('api-base-url');

        if (!baseUrlInput) return;

        // 根据提供商和接口类型设置默认URL
        if (provider === 'gemini') {
            if (interfaceType === 'native') {
                baseUrlInput.value = 'https://generativelanguage.googleapis.com';
            } else if (interfaceType === 'openai-compatible') {
                baseUrlInput.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
            }
        } else if (provider === 'custom') {
            if (interfaceType === 'openai-compatible') {
                baseUrlInput.value = '';
                baseUrlInput.placeholder = 'https://your-api.com/v1';
            }
        }
    }

    /**
     * 测试API连接
     */
    async testConnection() {
        console.log('[InfoBarSettings] 开始测试API连接');

        const testBtn = document.getElementById('test-connection-btn');
        const connectionStatus = document.getElementById('connection-status');

        if (testBtn) {
            testBtn.textContent = '🔄 测试中...';
            testBtn.disabled = true;
        }

        try {
            // 获取配置
            const provider = document.getElementById('api-provider')?.value;
            const interfaceType = document.getElementById('interface-type')?.value;
            const baseUrl = document.getElementById('api-base-url')?.value;
            const apiKey = document.getElementById('api-key')?.value;

            if (!provider || !interfaceType || !baseUrl || !apiKey) {
                throw new Error('请完成所有必填配置项');
            }

            // 执行连接测试
            let testUrl;
            let headers;

            if (provider === 'gemini' && interfaceType === 'native') {
                testUrl = `${baseUrl}/v1beta/models?key=${apiKey}`;
                headers = { 'Content-Type': 'application/json' };
            } else {
                testUrl = `${baseUrl}/models`;
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                };
            }

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: headers,
                timeout: 10000
            });

            if (response.ok) {
                if (connectionStatus) {
                    connectionStatus.textContent = '✅ 连接成功';
                    connectionStatus.style.color = '#10b981';
                }
                this.showNotification('API连接测试成功！', 'success');
            } else {
                throw new Error(`连接失败: ${response.status} ${response.statusText}`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] API连接测试失败:', error);

            if (connectionStatus) {
                connectionStatus.textContent = `❌ 连接失败: ${error.message}`;
                connectionStatus.style.color = '#ef4444';
            }

            this.showNotification('API连接测试失败: ' + error.message, 'error');
        } finally {
            if (testBtn) {
                testBtn.textContent = '🔍 测试连接';
                testBtn.disabled = false;
            }
        }
    }

    /**
     * 设置主API限制规则，禁止输出特定标签
     */
    async setupMainAPIRestrictions() {
        try {
            console.log('[InfoBarSettings] 🚫 设置主API限制规则，禁止输出冲突标签...');

            // 🔧 修复：发送限制规则提示词给主API，而不是拦截
            await this.injectRestrictionPromptToMainAPI();

            // 🔧 保留：拦截主API对消息内容的访问，隐藏infobar_data
            await this.setupMessageContentFilter();

            console.log('[InfoBarSettings] ✅ 主API限制规则设置完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 设置主API限制规则失败:', error);
            throw error;
        }
    }

    /**
     * 向主API注入限制规则提示词
     */
    async injectRestrictionPromptToMainAPI() {
        try {
            console.log('[InfoBarSettings] 📝 向主API注入限制规则提示词...');

            // 创建限制规则提示词
            const restrictionPrompt = this.createRestrictionPrompt();

            // 使用SillyTavern的扩展提示词机制
            const context = SillyTavern.getContext();
            if (context && context.setExtensionPrompt) {
                context.setExtensionPrompt(
                    'Information bar integration tool - Restrictions',
                    restrictionPrompt,
                    1, // 高优先级
                    false // 不禁用
                );
                console.log('[InfoBarSettings] ✅ 限制规则提示词已注入到主API');
                console.log('[InfoBarSettings] 📝 提示词长度:', restrictionPrompt.length);
            } else {
                console.warn('[InfoBarSettings] ⚠️ 无法使用SillyTavern扩展提示词机制');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 注入限制规则提示词失败:', error);
        }
    }

    /**
     * 创建限制规则提示词
     */
    createRestrictionPrompt() {
        return `【重要技术性限制 - 禁止输出特定标签】
⚠️ 严格禁止在回复中包含以下技术性标签：

🚫 禁止输出的XML标签：
- <aiThinkProcess>...</aiThinkProcess>
- <infobar_data>...</infobar_data>



📋 说明：
这些是纯技术性限制，用于避免与专用信息栏系统产生冲突。
这些限制不影响你的正常创作和表达能力。

---`;
    }

    /**
     * 初始化自定义API处理
     */
    async initCustomAPIHandling() {
        try {
            console.log('[InfoBarSettings] 🔧 初始化自定义API处理...');

            // 注册消息接收事件监听器
            const context = SillyTavern.getContext();
            if (context && context.eventSource) {
                // 移除可能存在的旧监听器
                context.eventSource.removeListener('message_received', this.handleMessageReceived);
                context.eventSource.removeListener('generation_ended', this.handleGenerationEnded);

                // 添加生成结束事件监听器（确保主API完成后才处理）
                context.eventSource.on('generation_ended', this.handleGenerationEnded.bind(this));

                console.log('[InfoBarSettings] ✅ 自定义API生成结束监听器已注册');
            }

            console.log('[InfoBarSettings] ✅ 自定义API处理初始化完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 初始化自定义API处理失败:', error);
            throw error;
        }
    }

    /**
     * 处理生成结束事件（确保主API完成后才处理）
     * 🔧 修复：增加AI消息验证，避免处理旧消息
     */
    async handleGenerationEnded() {
        try {
            console.log('[InfoBarSettings] 🏁 收到生成结束事件...');

            // 检查API是否启用
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            if (!configs.apiConfig || !configs.apiConfig.enabled) {
                console.log('[InfoBarSettings] ℹ️ 自定义API未启用，跳过处理');
                return;
            }

            // 获取最新的AI消息
            const latestAIMessage = this.getLatestAIMessage();
            if (!latestAIMessage) {
                console.log('[InfoBarSettings] ℹ️ 没有找到AI消息，跳过处理');
                return;
            }

            // 🔧 修复：验证AI消息是否为真正新生成的消息
            const isValidMessage = this.validateAIMessageIsNew(latestAIMessage);
            if (!isValidMessage) {
                console.log('[InfoBarSettings] ⚠️ 检测到的AI消息不是新生成的消息，可能是AI生成失败，跳过处理');
                console.log('[InfoBarSettings] 📝 这避免了使用上一条AI消息的剧情内容调用自定义API的错误');
                
                // 调用失败处理函数
                this.handleAIGenerationFailure('AI消息验证失败：获取到的是旧消息，可能AI生成未成功');
                return;
            }

            console.log('[InfoBarSettings] ✅ 验证通过：这是一条新生成的AI消息');

            // 在双API协作模式下，主API不应该包含infobar_data
            // 如果包含了，说明主API Hook没有生效，需要清理
            if (latestAIMessage.mes && latestAIMessage.mes.includes('<infobar_data>')) {
                console.log('[InfoBarSettings] ⚠️ 检测到主API返回了infobar_data，清理并重新处理...');

                // 清理主API返回的infobar_data
                const cleanedMessage = latestAIMessage.mes.replace(/<infobar_data>[\s\S]*?<\/infobar_data>/g, '').trim();
                latestAIMessage.mes = cleanedMessage;

                console.log('[InfoBarSettings] 🧹 已清理主API返回的infobar_data');
            }

            console.log('[InfoBarSettings] 🤖 主API生成完成，开始处理信息栏数据...');

            // 使用自定义API处理剧情内容
            await this.processWithCustomAPI(latestAIMessage.mes);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理生成结束事件失败:', error);
        }
    }

    /**
     * 设置消息内容过滤器，在自定义API模式下隐藏infobar_data
     */
    async setupMessageContentFilter() {
        try {
            console.log('[InfoBarSettings] 🔧 设置消息内容过滤器...');

            const context = SillyTavern.getContext();
            if (!context || !context.chat) {
                console.warn('[InfoBarSettings] ⚠️ 无法获取聊天上下文');
                return;
            }

            // 保存原始的chat数组（如果还没有保存）
            if (!context._originalChat) {
                // 创建原始数组的副本，避免循环引用
                context._originalChat = [...context.chat];
                console.log('[InfoBarSettings] 💾 已保存原始聊天数组引用，长度:', context._originalChat.length);
            }

            // 创建一个代理数组，动态过滤infobar_data内容
            const filteredChat = new Proxy(context._originalChat, {
                get: (target, prop) => {
                    // 如果访问的是数组索引
                    if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                        const index = parseInt(prop);
                        const message = target[index];

                        if (message && message.mes && typeof message.mes === 'string') {
                            // 检查是否启用了自定义API模式
                            const currentContext = SillyTavern.getContext();
                            const extensionSettings = currentContext.extensionSettings['Information bar integration tool'] || {};
                            const apiConfig = extensionSettings.apiConfig || {};

                            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                                // 在自定义API模式下，过滤掉infobar_data内容
                                const filteredMessage = { ...message };
                                const originalMes = message.mes;
                                filteredMessage.mes = originalMes.replace(/<infobar_data>[\s\S]*?<\/infobar_data>/gi, '').trim();

                                // 如果过滤后内容发生变化，记录日志
                                if (filteredMessage.mes !== originalMes) {
                                    console.log('[InfoBarSettings] 🔍 已过滤消息中的infobar_data内容，消息索引:', index);
                                    console.log('[InfoBarSettings] 📏 原始长度:', originalMes.length, '过滤后长度:', filteredMessage.mes.length);
                                }

                                return filteredMessage;
                            }
                        }

                        return message;
                    }

                    // 对于其他属性（如length, push, pop等），直接返回原始值
                    const value = target[prop];
                    if (typeof value === 'function') {
                        return value.bind(target);
                    }
                    return value;
                }
            });

            // 替换context.chat为过滤后的代理数组
            context.chat = filteredChat;
            console.log('[InfoBarSettings] ✅ 消息内容过滤器已设置');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 设置消息内容过滤器失败:', error);
            throw error;
        }
    }

    /**
     * 移除主API限制规则
     */
    async removeMainAPIRestrictions() {
        try {
            console.log('[InfoBarSettings] 🔄 移除主API限制规则...');

            // 🔧 修复：移除限制规则提示词
            await this.removeRestrictionPromptFromMainAPI();

            // 🔧 保留：恢复原始的聊天数组
            const context = SillyTavern.getContext();
            if (context && context._originalChat) {
                context.chat = context._originalChat;
                delete context._originalChat;
                console.log('[InfoBarSettings] ✅ 原始聊天数组已恢复');
            }

            console.log('[InfoBarSettings] ✅ 主API限制规则移除完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 移除主API限制规则失败:', error);
            throw error;
        }
    }

    /**
     * 从主API移除限制规则提示词
     */
    async removeRestrictionPromptFromMainAPI() {
        try {
            console.log('[InfoBarSettings] 🗑️ 从主API移除限制规则提示词...');

            // 使用SillyTavern的扩展提示词机制移除限制规则
            const context = SillyTavern.getContext();
            if (context && context.setExtensionPrompt) {
                context.setExtensionPrompt(
                    'Information bar integration tool - Restrictions',
                    '', // 空提示词表示移除
                    1,
                    true // 禁用
                );
                console.log('[InfoBarSettings] ✅ 限制规则提示词已从主API移除');
            } else {
                console.warn('[InfoBarSettings] ⚠️ 无法使用SillyTavern扩展提示词机制移除限制规则');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 移除限制规则提示词失败:', error);
        }
    }

    /**
     * 清理自定义API处理
     */
    async clearCustomAPIHandling() {
        try {
            console.log('[InfoBarSettings] 🧹 清理自定义API处理...');

            // 移除事件监听器
            const context = SillyTavern.getContext();
            if (context && context.eventSource) {
                context.eventSource.removeListener('message_received', this.handleMessageReceived);
                context.eventSource.removeListener('generation_ended', this.handleGenerationEnded);
                console.log('[InfoBarSettings] ✅ 自定义API事件监听器已移除');
            }

            console.log('[InfoBarSettings] ✅ 自定义API处理清理完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 清理自定义API处理失败:', error);
            throw error;
        }
    }

    /**
     * 处理消息接收事件（自定义API模式）
     * 🔧 修复：增加AI消息验证，避免处理旧消息
     */
    async handleMessageReceived() {
        try {
            console.log('[InfoBarSettings] 📨 收到消息接收事件...');

            // 检查API是否启用
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            if (!configs.apiConfig || !configs.apiConfig.enabled) {
                console.log('[InfoBarSettings] ℹ️ 自定义API未启用，跳过处理');
                return;
            }

            // 获取最新的AI消息
            const latestAIMessage = this.getLatestAIMessage();
            if (!latestAIMessage) {
                console.log('[InfoBarSettings] ℹ️ 没有找到AI消息，跳过处理');
                return;
            }

            // 🔧 修复：验证AI消息是否为真正新生成的消息
            const isValidMessage = this.validateAIMessageIsNew(latestAIMessage);
            if (!isValidMessage) {
                console.log('[InfoBarSettings] ⚠️ 检测到的AI消息不是新生成的消息，跳过处理');
                return;
            }

            // 检查消息是否已经包含infobar_data
            if (latestAIMessage.mes && latestAIMessage.mes.includes('<infobar_data>')) {
                console.log('[InfoBarSettings] ℹ️ 消息已包含infobar_data，跳过处理');
                return;
            }

            console.log('[InfoBarSettings] 🤖 检测到新的AI消息，准备处理...');

            // 使用自定义API处理剧情内容
            await this.processWithCustomAPI(latestAIMessage.mes);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 获取最新的AI消息
     * 🔧 修复：增加消息验证，确保获取的是真正新生成的AI消息
     */
    getLatestAIMessage() {
        try {
            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                return null;
            }

            // 从后往前查找最新的AI消息
            for (let i = context.chat.length - 1; i >= 0; i--) {
                const message = context.chat[i];
                if (message && !message.is_user) {
                    console.log('[InfoBarSettings] 🔍 找到AI消息:', {
                        index: i,
                        messageId: message.mes_id || 'unknown',
                        sendDate: message.send_date || 'unknown',
                        contentLength: message.mes ? message.mes.length : 0,
                        hasInfobarData: message.mes ? message.mes.includes('<infobar_data>') : false
                    });
                    return message;
                }
            }

            return null;
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取最新AI消息失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：验证AI消息是否为真正新生成的消息
     */
    validateAIMessageIsNew(aiMessage) {
        try {
            if (!aiMessage) {
                console.log('[InfoBarSettings] ⚠️ AI消息为空，验证失败');
                return false;
            }

            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                console.log('[InfoBarSettings] ⚠️ 聊天上下文无效，验证失败');
                return false;
            }

            // 获取最后一条用户消息的索引
            let lastUserMessageIndex = -1;
            for (let i = context.chat.length - 1; i >= 0; i--) {
                const message = context.chat[i];
                if (message && message.is_user) {
                    lastUserMessageIndex = i;
                    break;
                }
            }

            if (lastUserMessageIndex === -1) {
                console.log('[InfoBarSettings] ⚠️ 未找到用户消息，跳过验证');
                return true; // 如果没有用户消息，可能是特殊情况，允许处理
            }

            // 获取AI消息在聊天记录中的索引
            let aiMessageIndex = -1;
            for (let i = 0; i < context.chat.length; i++) {
                const message = context.chat[i];
                if (message === aiMessage) {
                    aiMessageIndex = i;
                    break;
                }
            }

            if (aiMessageIndex === -1) {
                console.log('[InfoBarSettings] ⚠️ 无法在聊天记录中找到AI消息，验证失败');
                return false;
            }

            // AI消息应该在最后一条用户消息之后
            const isAfterLastUser = aiMessageIndex > lastUserMessageIndex;
            
            console.log('[InfoBarSettings] 🔍 AI消息验证结果:', {
                aiMessageIndex: aiMessageIndex,
                lastUserMessageIndex: lastUserMessageIndex,
                isAfterLastUser: isAfterLastUser,
                aiMessageTime: aiMessage.send_date || 'unknown'
            });

            return isAfterLastUser;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 验证AI消息失败:', error);
            return false; // 验证失败时默认不处理，避免错误
        }
    }

    /**
     * 🔧 新增：处理AI生成失败的情况
     */
    handleAIGenerationFailure(reason = 'unknown') {
        try {
            console.log('[InfoBarSettings] ⚠️ 处理AI生成失败:', reason);
            
            // 记录失败统计
            if (!window.InfoBarGenerationStats) {
                window.InfoBarGenerationStats = {
                    failures: 0,
                    lastFailureTime: null,
                    lastFailureReason: null
                };
            }

            window.InfoBarGenerationStats.failures++;
            window.InfoBarGenerationStats.lastFailureTime = new Date().toISOString();
            window.InfoBarGenerationStats.lastFailureReason = reason;

            console.log('[InfoBarSettings] 📊 生成失败统计已更新:', {
                totalFailures: window.InfoBarGenerationStats.failures,
                lastFailure: window.InfoBarGenerationStats.lastFailureTime,
                reason: reason
            });

            // 通知事件系统AI生成失败
            if (this.eventSystem) {
                this.eventSystem.emit('ai:generation:failed', {
                    reason: reason,
                    timestamp: Date.now(),
                    context: 'custom_api_processing'
                });
            }

            // 如果设置界面可见，显示状态提示
            if (this.visible && this.modal) {
                this.showMessage(`AI生成失败: ${reason}`, 'warning');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理AI生成失败逻辑出错:', error);
        }
    }

    /**
     * 使用自定义API处理剧情内容
     */
    async processWithCustomAPI(plotContent) {
        try {
            console.log('[InfoBarSettings] 🚀 开始使用自定义API处理剧情内容...');

            // 🔧 新增：显示自定义API生成中提示
            this.showCustomAPIStatus('generating');

            // 验证剧情内容
            if (!plotContent || typeof plotContent !== 'string') {
                console.warn('[InfoBarSettings] ⚠️ 剧情内容无效:', typeof plotContent);
                this.showCustomAPIStatus('error', '剧情内容无效');
                return;
            }

            console.log('[InfoBarSettings] 📝 剧情内容长度:', plotContent.length);

            // 使用完整的SmartPromptSystem生成智能提示词
            let smartPrompt = '';
            try {
                const infoBarExtension = window.SillyTavernInfobar;
                if (infoBarExtension && infoBarExtension.smartPromptSystem) {
                    console.log('[InfoBarSettings] 🔄 使用SmartPromptSystem生成自定义API智能提示词');

                    // 直接调用SmartPromptSystem的generateSmartPrompt方法
                    // 由于我们只拦截了注入流程，生成功能仍然完整
                    smartPrompt = await infoBarExtension.smartPromptSystem.generateSmartPrompt();

                    if (smartPrompt) {
                        console.log('[InfoBarSettings] ✅ 自定义API智能提示词生成完成，长度:', smartPrompt.length);
                    }
                }
            } catch (error) {
                console.warn('[InfoBarSettings] ⚠️ 生成智能提示词失败，使用备用方案:', error);
            }

            // 如果智能提示词生成失败，使用备用系统提示词
            if (!smartPrompt) {
                console.log('[InfoBarSettings] 📝 使用备用系统提示词');
                smartPrompt = this.getBackupSystemPrompt();
            }

            // 准备API请求
            console.log('[InfoBarSettings] 📡 准备发送自定义API请求...');
            const messages = [
                {
                    role: 'system',
                    content: smartPrompt
                },
                {
                    role: 'user',
                    content: `请根据以下剧情内容生成信息栏数据：\n\n${plotContent}`
                }
            ];

            console.log('[InfoBarSettings] 📊 请求详情:', {
                messagesCount: messages.length,
                systemPromptLength: smartPrompt.length,
                userPromptLength: plotContent.length,
                apiProvider: this.getAPIProvider(),
                apiModel: this.getAPIModel()
            });

            // 发送自定义API请求（增加重试逻辑）
            const context = SillyTavern.getContext();
            const cfg = context.extensionSettings['Information bar integration tool']?.apiConfig || {};
            const maxRetry = Number(cfg.retryCount ?? 3);
            const retryDelayMs = 1500;

            let attempt = 0;
            let lastError = null;
            while (attempt <= maxRetry) {
                attempt++;
                const result = await this.sendCustomAPIRequest(messages);
                if (result && result.success && typeof result.text === 'string' && result.text.trim().length > 0) {
                    console.log('[InfoBarSettings] ✅ 自定义API返回结果，长度:', result.text.length, ' 尝试次数:', attempt);
                    await this.processAPIResult(result.text);
                    // 🔧 新增：显示自定义API生成完成提示
                    this.showCustomAPIStatus('success');
                    break;
                } else {
                    lastError = result?.error || '空响应或格式无效';
                    console.warn(`[InfoBarSettings] ⚠️ API结果为空或无效，准备重试 (${attempt}/${maxRetry}) ...`);
                    if (attempt > maxRetry) {
                        console.error('[InfoBarSettings] ❌ 重试达上限，放弃。本次错误:', lastError);
                        this.showCustomAPIStatus('error', '重试失败: ' + lastError);
                        break;
                    }
                    await new Promise(r=>setTimeout(r, retryDelayMs));
                }
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 使用自定义API处理失败:', error);
            // 🔧 新增：显示自定义API错误提示
            this.showCustomAPIStatus('error', error.message);
        }
    }

    /**
     * 显示自定义API状态提示
     */
    showCustomAPIStatus(status, message = '') {
        try {
            // 移除现有的状态提示
            const existingToast = document.querySelector('.custom-api-status-toast');
            if (existingToast) {
                existingToast.remove();
            }

            let toastContent = '';
            let toastClass = 'custom-api-status-toast';
            let autoHide = false;

            switch (status) {
                case 'generating':
                    toastContent = '🤖 自定义API生成中...';
                    toastClass += ' generating';
                    break;
                case 'success':
                    toastContent = '✅ 自定义API已生成';
                    toastClass += ' success';
                    autoHide = true;
                    break;
                case 'error':
                    toastContent = `❌ 自定义API生成失败${message ? ': ' + message : ''}`;
                    toastClass += ' error';
                    autoHide = true;
                    break;
            }

            // 创建提示元素
            const toast = document.createElement('div');
            toast.className = toastClass;
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="toast-text">${toastContent}</span>
                    <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
            `;

            // 添加样式
            if (!document.getElementById('custom-api-status-styles')) {
                const style = document.createElement('style');
                style.id = 'custom-api-status-styles';
                style.textContent = `
                    .custom-api-status-toast {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 10000;
                        min-width: 300px;
                        max-width: 500px;
                        padding: 0;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        animation: slideInRight 0.3s ease-out;
                    }
                    .custom-api-status-toast.generating {
                        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                        color: white;
                    }
                    .custom-api-status-toast.success {
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                    }
                    .custom-api-status-toast.error {
                        background: linear-gradient(135deg, #ef4444, #dc2626);
                        color: white;
                    }
                    .toast-content {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px 16px;
                    }
                    .toast-text {
                        flex: 1;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .toast-close {
                        background: none;
                        border: none;
                        color: inherit;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: pointer;
                        padding: 0;
                        margin-left: 12px;
                        opacity: 0.8;
                        transition: opacity 0.2s;
                    }
                    .toast-close:hover {
                        opacity: 1;
                    }
                    @keyframes slideInRight {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOutRight {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }

            // 添加到页面
            document.body.appendChild(toast);

            // 自动隐藏
            if (autoHide) {
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.style.animation = 'slideOutRight 0.3s ease-in';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }
                }, 3000);
            }

            console.log('[InfoBarSettings] 📢 自定义API状态提示已显示:', status, message);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示自定义API状态提示失败:', error);
        }
    }

    /**
     * 导出数据功能
     */
    async exportData() {
        try {
            console.log('[InfoBarSettings] 📤 开始导出数据...');

            // 获取用户选择的范围和格式
            const scopeSelect = this.modal.querySelector('#data-scope-select');
            const formatSelect = this.modal.querySelector('#data-format-select');

            if (!scopeSelect || !formatSelect) {
                this.showMessage('❌ 无法获取导出设置', 'error');
                return;
            }

            const scope = scopeSelect.value; // 'current' 或 'all'
            const format = formatSelect.value; // 'json', 'csv', 或 'xml'

            console.log('[InfoBarSettings] 📊 导出设置:', { scope, format });

            // 显示导出进度提示
            this.showMessage('🔄 正在收集数据...', 'info');

            // 收集数据
            const exportData = await this.collectExportData(scope);

            if (!exportData || Object.keys(exportData).length === 0) {
                this.showMessage('⚠️ 没有找到可导出的数据', 'warning');
                return;
            }

            console.log('[InfoBarSettings] 📊 收集到的数据:', {
                chats: exportData.chats?.length || 0,
                totalMessages: exportData.chats?.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0) || 0,
                infobarDataEntries: Object.keys(exportData.infobarData || {}).length
            });

            // 转换为指定格式
            let exportContent;
            let fileName;
            let mimeType;

            switch (format) {
                case 'json':
                    exportContent = JSON.stringify(exportData, null, 2);
                    fileName = `infobar_data_${this.getTimestamp()}.json`;
                    mimeType = 'application/json';
                    break;
                case 'csv':
                    exportContent = this.convertToCSV(exportData);
                    fileName = `infobar_data_${this.getTimestamp()}.csv`;
                    mimeType = 'text/csv';
                    break;
                case 'xml':
                    exportContent = this.convertToXML(exportData);
                    fileName = `infobar_data_${this.getTimestamp()}.xml`;
                    mimeType = 'application/xml';
                    break;
                default:
                    throw new Error('不支持的导出格式: ' + format);
            }

            // 触发下载
            this.downloadFile(exportContent, fileName, mimeType);

            this.showMessage(`✅ 数据已导出为 ${fileName}`, 'success');
            console.log('[InfoBarSettings] ✅ 数据导出完成:', fileName);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 导出数据失败:', error);
            this.showMessage('❌ 导出数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 收集导出数据
     */
    async collectExportData(scope) {
        try {
            const exportData = {
                metadata: {
                    exportTime: new Date().toISOString(),
                    scope: scope,
                    version: '1.0.0',
                    source: 'Information bar integration tool'
                },
                chats: [],
                infobarData: {},
                settings: {}
            };

            // 获取SillyTavern上下文
            const context = SillyTavern.getContext();
            if (!context) {
                throw new Error('无法获取SillyTavern上下文');
            }

            // 收集聊天数据
            if (scope === 'current') {
                // 当前聊天
                const currentChatId = context.chatId;
                if (currentChatId && context.chat) {
                    const chatData = {
                        chatId: currentChatId,
                        chatName: context.name2 || 'Unknown',
                        character: context.name2 || 'Unknown',
                        messages: context.chat || [],
                        timestamp: new Date().toISOString()
                    };
                    exportData.chats.push(chatData);

                    // 收集当前聊天的信息栏数据
                    if (this.unifiedDataCore) {
                        const chatInfobarData = this.unifiedDataCore.getChatData(currentChatId);
                        if (chatInfobarData) {
                            exportData.infobarData[currentChatId] = chatInfobarData;
                        }
                    }
                }
            } else {
                // 所有聊天
                const allChats = context.characters || [];
                for (const character of allChats) {
                    if (character.chat) {
                        const chatData = {
                            chatId: character.filename || character.name,
                            chatName: character.name,
                            character: character.name,
                            messages: character.chat,
                            timestamp: new Date().toISOString()
                        };
                        exportData.chats.push(chatData);

                        // 收集该聊天的信息栏数据
                        if (this.unifiedDataCore) {
                            const chatInfobarData = this.unifiedDataCore.getChatData(character.filename || character.name);
                            if (chatInfobarData) {
                                exportData.infobarData[character.filename || character.name] = chatInfobarData;
                            }
                        }
                    }
                }
            }

            // 收集扩展设置
            const extensionSettings = context.extensionSettings;
            if (extensionSettings && extensionSettings['Information bar integration tool']) {
                exportData.settings = extensionSettings['Information bar integration tool'];
            }

            console.log('[InfoBarSettings] 📊 数据收集完成:', {
                chats: exportData.chats.length,
                infobarDataKeys: Object.keys(exportData.infobarData).length,
                hasSettings: !!exportData.settings
            });

            return exportData;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 收集导出数据失败:', error);
            throw error;
        }
    }

    /**
     * 转换数据为CSV格式
     */
    convertToCSV(data) {
        try {
            let csvContent = '';

            // CSV头部信息
            csvContent += '# Information Bar Integration Tool Data Export\n';
            csvContent += `# Export Time: ${data.metadata.exportTime}\n`;
            csvContent += `# Scope: ${data.metadata.scope}\n`;
            csvContent += '\n';

            // 聊天数据表
            if (data.chats && data.chats.length > 0) {
                csvContent += 'Chat Data\n';
                csvContent += 'Chat ID,Chat Name,Character,Message Count,Last Message Time\n';

                data.chats.forEach(chat => {
                    const messageCount = chat.messages ? chat.messages.length : 0;
                    const lastMessageTime = chat.messages && chat.messages.length > 0
                        ? (chat.messages[chat.messages.length - 1].send_date || 'Unknown')
                        : 'No messages';

                    csvContent += `"${chat.chatId}","${chat.chatName}","${chat.character}",${messageCount},"${lastMessageTime}"\n`;
                });
                csvContent += '\n';
            }

            // 信息栏数据表
            if (data.infobarData && Object.keys(data.infobarData).length > 0) {
                csvContent += 'InfoBar Data\n';
                csvContent += 'Chat ID,Message ID,Panel Type,Data Key,Data Value\n';

                Object.entries(data.infobarData).forEach(([chatId, chatData]) => {
                    Object.entries(chatData).forEach(([messageId, messageData]) => {
                        Object.entries(messageData).forEach(([panelType, panelData]) => {
                            if (typeof panelData === 'object') {
                                Object.entries(panelData).forEach(([key, value]) => {
                                    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                                    csvContent += `"${chatId}","${messageId}","${panelType}","${key}","${valueStr}"\n`;
                                });
                            }
                        });
                    });
                });
            }

            return csvContent;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 转换CSV格式失败:', error);
            throw new Error('CSV格式转换失败: ' + error.message);
        }
    }

    /**
     * 转换数据为XML格式
     */
    convertToXML(data) {
        try {
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += '<InfoBarExport>\n';

            // 元数据
            xmlContent += '  <Metadata>\n';
            xmlContent += `    <ExportTime>${this.escapeXML(data.metadata.exportTime)}</ExportTime>\n`;
            xmlContent += `    <Scope>${this.escapeXML(data.metadata.scope)}</Scope>\n`;
            xmlContent += `    <Version>${this.escapeXML(data.metadata.version)}</Version>\n`;
            xmlContent += `    <Source>${this.escapeXML(data.metadata.source)}</Source>\n`;
            xmlContent += '  </Metadata>\n';

            // 聊天数据
            if (data.chats && data.chats.length > 0) {
                xmlContent += '  <Chats>\n';
                data.chats.forEach(chat => {
                    xmlContent += '    <Chat>\n';
                    xmlContent += `      <ChatId>${this.escapeXML(chat.chatId)}</ChatId>\n`;
                    xmlContent += `      <ChatName>${this.escapeXML(chat.chatName)}</ChatName>\n`;
                    xmlContent += `      <Character>${this.escapeXML(chat.character)}</Character>\n`;
                    xmlContent += `      <MessageCount>${chat.messages ? chat.messages.length : 0}</MessageCount>\n`;
                    xmlContent += `      <Timestamp>${this.escapeXML(chat.timestamp)}</Timestamp>\n`;
                    xmlContent += '    </Chat>\n';
                });
                xmlContent += '  </Chats>\n';
            }

            // 信息栏数据
            if (data.infobarData && Object.keys(data.infobarData).length > 0) {
                xmlContent += '  <InfoBarData>\n';
                Object.entries(data.infobarData).forEach(([chatId, chatData]) => {
                    xmlContent += `    <ChatData chatId="${this.escapeXML(chatId)}">\n`;
                    Object.entries(chatData).forEach(([messageId, messageData]) => {
                        xmlContent += `      <MessageData messageId="${this.escapeXML(messageId)}">\n`;
                        Object.entries(messageData).forEach(([panelType, panelData]) => {
                            xmlContent += `        <Panel type="${this.escapeXML(panelType)}">\n`;
                            if (typeof panelData === 'object') {
                                Object.entries(panelData).forEach(([key, value]) => {
                                    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                                    xmlContent += `          <Data key="${this.escapeXML(key)}">${this.escapeXML(valueStr)}</Data>\n`;
                                });
                            }
                            xmlContent += '        </Panel>\n';
                        });
                        xmlContent += '      </MessageData>\n';
                    });
                    xmlContent += '    </ChatData>\n';
                });
                xmlContent += '  </InfoBarData>\n';
            }

            xmlContent += '</InfoBarExport>';
            return xmlContent;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 转换XML格式失败:', error);
            throw new Error('XML格式转换失败: ' + error.message);
        }
    }

    /**
     * XML转义函数
     */
    escapeXML(str) {
        if (typeof str !== 'string') {
            str = String(str);
        }
        return str.replace(/[<>&'"]/g, (char) => {
            switch (char) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return char;
            }
        });
    }

    /**
     * 获取时间戳字符串
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    /**
     * 下载文件
     */
    downloadFile(content, fileName, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 清理URL对象
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            console.log('[InfoBarSettings] 📁 文件下载触发:', fileName);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 下载文件失败:', error);
            throw new Error('文件下载失败: ' + error.message);
        }
    }

    /**
     * 导入数据功能
     */
    async importData() {
        try {
            console.log('[InfoBarSettings] 📥 开始导入数据...');

            // 创建文件选择器
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,.csv,.xml';
            fileInput.style.display = 'none';

            // 监听文件选择
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }

                try {
                    this.showMessage('🔄 正在读取文件...', 'info');

                    // 读取文件内容
                    const content = await this.readFileContent(file);

                    // 解析数据
                    const importData = await this.parseImportData(content, file.name);

                    // 显示确认对话框
                    const confirmed = await this.showImportConfirmDialog(importData);

                    if (confirmed) {
                        // 执行导入
                        await this.executeImport(importData);
                        this.showMessage('✅ 数据导入成功', 'success');
                    } else {
                        this.showMessage('ℹ️ 导入已取消', 'info');
                    }

                } catch (error) {
                    console.error('[InfoBarSettings] ❌ 导入数据失败:', error);
                    this.showMessage('❌ 导入数据失败: ' + error.message, 'error');
                } finally {
                    // 清理文件输入
                    if (fileInput.parentNode) {
                        fileInput.parentNode.removeChild(fileInput);
                    }
                }
            });

            // 触发文件选择
            document.body.appendChild(fileInput);
            fileInput.click();

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 导入数据失败:', error);
            this.showMessage('❌ 导入数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 读取文件内容
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * 解析导入数据
     */
    async parseImportData(content, fileName) {
        try {
            const fileExtension = fileName.split('.').pop().toLowerCase();
            let parsedData;

            switch (fileExtension) {
                case 'json':
                    parsedData = JSON.parse(content);
                    break;
                case 'csv':
                    parsedData = this.parseCSVData(content);
                    break;
                case 'xml':
                    parsedData = this.parseXMLData(content);
                    break;
                default:
                    throw new Error('不支持的文件格式: ' + fileExtension);
            }

            // 验证数据结构
            this.validateImportData(parsedData);

            return parsedData;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 解析导入数据失败:', error);
            throw new Error('数据解析失败: ' + error.message);
        }
    }

    /**
     * 解析CSV数据（简化版本）
     */
    parseCSVData(content) {
        // 这里实现一个简化的CSV解析
        // 实际项目中可能需要更复杂的CSV解析逻辑
        throw new Error('CSV导入功能暂未实现，请使用JSON格式');
    }

    /**
     * 解析XML数据（简化版本）
     */
    parseXMLData(content) {
        // 这里实现一个简化的XML解析
        // 实际项目中可能需要更复杂的XML解析逻辑
        throw new Error('XML导入功能暂未实现，请使用JSON格式');
    }

    /**
     * 验证导入数据结构
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }

        if (!data.metadata) {
            throw new Error('缺少元数据信息');
        }

        if (!data.metadata.source || data.metadata.source !== 'Information bar integration tool') {
            throw new Error('数据来源不匹配，请确保是本工具导出的数据');
        }

        console.log('[InfoBarSettings] ✅ 数据验证通过');
    }

    /**
     * 显示导入确认对话框
     */
    showImportConfirmDialog(importData) {
        return new Promise((resolve) => {
            try {
                // 统计导入数据
                const stats = {
                    chats: importData.chats ? importData.chats.length : 0,
                    totalMessages: importData.chats ? importData.chats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0) : 0,
                    infobarDataEntries: importData.infobarData ? Object.keys(importData.infobarData).length : 0,
                    hasSettings: !!importData.settings
                };

                // 创建确认对话框
                const dialog = document.createElement('div');
                dialog.className = 'import-confirm-dialog';
                dialog.innerHTML = `
                    <div class="dialog-overlay">
                        <div class="dialog-content">
                            <h3>确认导入数据</h3>
                            <div class="import-stats">
                                <p><strong>导入数据统计：</strong></p>
                                <ul>
                                    <li>聊天数量: ${stats.chats}</li>
                                    <li>消息总数: ${stats.totalMessages}</li>
                                    <li>信息栏数据条目: ${stats.infobarDataEntries}</li>
                                    <li>包含设置: ${stats.hasSettings ? '是' : '否'}</li>
                                </ul>
                                <p><strong>导出时间:</strong> ${importData.metadata.exportTime}</p>
                                <p><strong>数据范围:</strong> ${importData.metadata.scope === 'current' ? '当前聊天' : '所有聊天'}</p>
                            </div>
                            <div class="import-warning">
                                <p>⚠️ <strong>注意：</strong></p>
                                <ul>
                                    <li>导入操作将覆盖现有的信息栏数据</li>
                                    <li>建议在导入前先导出当前数据作为备份</li>
                                    <li>此操作无法撤销</li>
                                </ul>
                            </div>
                            <div class="dialog-actions">
                                <button class="btn btn-danger" data-action="confirm">确认导入</button>
                                <button class="btn btn-secondary" data-action="cancel">取消</button>
                            </div>
                        </div>
                    </div>
                `;

                // 添加样式
                if (!document.getElementById('import-dialog-styles')) {
                    const style = document.createElement('style');
                    style.id = 'import-dialog-styles';
                    style.textContent = `
                        .import-confirm-dialog {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 10001;
                        }
                        .dialog-overlay {
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .dialog-content {
                            background: white;
                            border-radius: 8px;
                            padding: 24px;
                            max-width: 500px;
                            max-height: 80vh;
                            overflow-y: auto;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        }
                        .dialog-content h3 {
                            margin: 0 0 16px 0;
                            color: #333;
                        }
                        .import-stats {
                            background: #f8f9fa;
                            padding: 16px;
                            border-radius: 6px;
                            margin: 16px 0;
                        }
                        .import-stats ul {
                            margin: 8px 0;
                            padding-left: 20px;
                        }
                        .import-warning {
                            background: #fff3cd;
                            border: 1px solid #ffeaa7;
                            padding: 16px;
                            border-radius: 6px;
                            margin: 16px 0;
                        }
                        .import-warning ul {
                            margin: 8px 0;
                            padding-left: 20px;
                        }
                        .dialog-actions {
                            display: flex;
                            gap: 12px;
                            justify-content: flex-end;
                            margin-top: 24px;
                        }
                        .dialog-actions .btn {
                            padding: 8px 16px;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        }
                        .dialog-actions .btn-danger {
                            background: #dc3545;
                            color: white;
                        }
                        .dialog-actions .btn-secondary {
                            background: #6c757d;
                            color: white;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // 事件处理
                dialog.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (action === 'confirm') {
                        dialog.remove();
                        resolve(true);
                    } else if (action === 'cancel' || e.target === dialog.querySelector('.dialog-overlay')) {
                        dialog.remove();
                        resolve(false);
                    }
                });

                // 显示对话框
                document.body.appendChild(dialog);

            } catch (error) {
                console.error('[InfoBarSettings] ❌ 显示导入确认对话框失败:', error);
                resolve(false);
            }
        });
    }

    /**
     * 执行导入操作
     */
    async executeImport(importData) {
        try {
            console.log('[InfoBarSettings] 🔄 开始执行导入操作...');

            let importedCount = 0;

            // 导入信息栏数据到统一数据核心
            if (importData.infobarData && this.unifiedDataCore) {
                Object.entries(importData.infobarData).forEach(([chatId, chatData]) => {
                    Object.entries(chatData).forEach(([messageId, messageData]) => {
                        // 将数据写入统一数据核心
                        this.unifiedDataCore.setMessageData(chatId, messageId, messageData);
                        importedCount++;
                    });
                });
                console.log('[InfoBarSettings] 📊 已导入信息栏数据条目:', importedCount);
            }

            // 导入设置（可选）
            if (importData.settings) {
                const context = SillyTavern.getContext();
                if (context && context.extensionSettings) {
                    // 备份当前设置
                    const currentSettings = context.extensionSettings['Information bar integration tool'] || {};

                    // 合并设置（保留当前的API配置等敏感信息）
                    const mergedSettings = {
                        ...importData.settings,
                        // 保留当前的API配置
                        apiConfig: currentSettings.apiConfig || importData.settings.apiConfig
                    };

                    context.extensionSettings['Information bar integration tool'] = mergedSettings;

                    // 保存设置
                    await this.saveExtensionSettings();
                    console.log('[InfoBarSettings] ⚙️ 已导入扩展设置');
                }
            }

            // 触发数据更新事件
            if (this.eventSource) {
                this.eventSource.emit('dataImported', {
                    importedCount,
                    source: importData.metadata.source,
                    timestamp: new Date().toISOString()
                });
            }

            console.log('[InfoBarSettings] ✅ 导入操作完成，共导入', importedCount, '条数据');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 执行导入操作失败:', error);
            throw new Error('导入执行失败: ' + error.message);
        }
    }

    /**
     * 保存扩展设置到SillyTavern
     */
    async saveExtensionSettings() {
        try {
            const context = SillyTavern.getContext();
            if (context && context.saveSettingsDebounced) {
                await context.saveSettingsDebounced();
                console.log('[InfoBarSettings] 💾 扩展设置已保存');
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存扩展设置失败:', error);
        }
    }

    /**
     * 确保数据管理样式已加载
     */
    ensureDataManagementStyles() {
        try {
            if (document.getElementById('data-management-styles')) {
                return; // 样式已存在
            }

            const style = document.createElement('style');
            style.id = 'data-management-styles';
            style.textContent = `
                /* 数据管理功能区域样式 */
                .data-management-actions {
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 12px !important;
                    margin-top: 8px !important;
                    width: 100% !important;
                }
                .data-export-btn, .data-import-btn {
                    flex: 1 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    padding: 10px 16px !important;
                    border: none !important;
                    border-radius: 6px !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    min-height: 40px !important;
                    white-space: nowrap !important;
                }
                .data-export-btn {
                    background: var(--theme-primary-color, #ff6b35) !important;
                    color: white !important;
                }
                .data-export-btn:hover {
                    background: var(--theme-primary-hover, #e55a2b) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3) !important;
                }
                .data-import-btn {
                    background: var(--theme-bg-secondary, #4a5568) !important;
                    color: white !important;
                    border: 1px solid var(--theme-border-color, #666) !important;
                }
                .data-import-btn:hover {
                    background: var(--theme-primary-color, #ff6b35) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2) !important;
                }
                .data-management-hint {
                    color: var(--theme-text-secondary, #a0a0a0) !important;
                    font-size: 13px !important;
                    line-height: 1.4 !important;
                    margin-top: 8px !important;
                    padding: 8px 12px !important;
                    background: var(--theme-bg-secondary, rgba(107, 114, 128, 0.1)) !important;
                    border-radius: 4px !important;
                    border-left: 3px solid var(--theme-primary-color, #ff6b35) !important;
                }
            `;
            document.head.appendChild(style);
            console.log('[InfoBarSettings] ✅ 数据管理样式已加载');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载数据管理样式失败:', error);
        }
    }

    /**
     * 获取备用系统提示词
     */
    getBackupSystemPrompt() {
        return `你是一个专业的信息栏数据生成助手。请根据用户提供的剧情内容，生成结构化的信息栏数据。
请严格按照以下格式输出：

<infobar_data>
<!--
personal: name="角色名", age="年龄", gender="性别", occupation="职业", status="状态", emotion="情绪"
world: time="时间", location="地点", weather="天气", season="季节"
interaction: target="交互对象", relationship="关系", mood="心情", action="行动"
-->
</infobar_data>

要求：
1. 必须使用 <infobar_data> 标签包围
2. 内容必须在 <!-- --> 注释中
3. 每个字段都要填写具体内容，不能为空
4. 基于剧情合理推断信息`;
    }

    /**
     * 发送自定义API请求
     */
    async sendCustomAPIRequest(messages) {
        try {
            console.log('[InfoBarSettings] 📡 发送自定义API请求...');

            // 获取API配置
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const apiConfig = extensionSettings['Information bar integration tool']?.apiConfig || {};

            if (!apiConfig.provider || !apiConfig.model || !apiConfig.apiKey) {
                throw new Error('API配置不完整');
            }

            // 根据提供商和接口类型发送请求
            if (apiConfig.provider === 'gemini' && apiConfig.format === 'native') {
                return await this.sendGeminiNativeRequest(messages, apiConfig);
            } else {
                return await this.sendOpenAICompatibleRequest(messages, apiConfig);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 发送自定义API请求失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 发送Gemini原生API请求
     */
    async sendGeminiNativeRequest(messages, apiConfig) {
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessage = messages.find(m => m.role === 'user');

        const prompt = systemMessage ? `${systemMessage.content}\n\n${userMessage.content}` : userMessage.content;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: apiConfig.temperature || 0.7,
                maxOutputTokens: apiConfig.maxTokens || 2000
            }
        };

        const response = await fetch(
            `${apiConfig.baseUrl}/v1beta/models/${apiConfig.model}:generateContent?key=${apiConfig.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            usage: data.usageMetadata
        };
    }

    /**
     * 发送OpenAI兼容API请求
     */
    async sendOpenAICompatibleRequest(messages, apiConfig) {
        const requestBody = {
            model: apiConfig.model,
            messages: messages,
            temperature: apiConfig.temperature || 0.7,
            max_tokens: apiConfig.maxTokens || 2000
        };

        const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            text: data.choices?.[0]?.message?.content || '',
            usage: data.usage
        };
    }

    /**
     * 处理API结果
     */
    async processAPIResult(resultText) {
        try {
            console.log('[InfoBarSettings] 🔍 开始处理API结果...');
            console.log('[InfoBarSettings] 📝 结果前500字符:', resultText.substring(0, 500));

            // 第一步：将infobar_data合并到最新的AI消息中
            const success = await this.appendInfobarDataToLatestMessage(resultText);
            if (!success) {
                console.warn('[InfoBarSettings] ⚠️ 无法将infobar_data合并到消息中');
                return;
            }

            // 第二步：触发消息接收事件，让EventSystem处理
            const context = SillyTavern.getContext();
            if (context && context.eventSource && context.chat && context.chat.length > 0) {
                const lastMessage = context.chat[context.chat.length - 1];
                if (lastMessage && !lastMessage.is_user) {
                    console.log('[InfoBarSettings] 📡 触发消息接收事件进行数据解析...');
                    context.eventSource.emit('message_received', lastMessage);
                }
            }

            console.log('[InfoBarSettings] ✅ API结果处理完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理API结果失败:', error);
        }
    }

    /**
     * 将infobar_data追加到最新的AI消息中
     */
    async appendInfobarDataToLatestMessage(infobarData) {
        try {
            console.log('[InfoBarSettings] 📝 将infobar_data追加到最新消息...');

            const context = SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                console.warn('[InfoBarSettings] ⚠️ 没有可用的聊天消息');
                return false;
            }

            // 获取最新的AI消息
            const lastMessage = context.chat[context.chat.length - 1];
            if (!lastMessage || lastMessage.is_user) {
                console.warn('[InfoBarSettings] ⚠️ 最新消息不是AI消息');
                return false;
            }

            // 检查消息是否已经包含自定义API数据标签，如果有则替换
            if (lastMessage.mes && (lastMessage.mes.includes('<infobar_data>') || lastMessage.mes.includes('<aiThinkProcess>'))) {
                console.log('[InfoBarSettings] ℹ️ 消息已包含API数据标签，替换现有内容');
                // 移除现有的API数据标签内容
                lastMessage.mes = lastMessage.mes
                    .replace(/<infobar_data>[\s\S]*?<\/infobar_data>/gi, '')
                    .replace(/<aiThinkProcess>[\s\S]*?<\/aiThinkProcess>/gi, '')
                    .trim();
            }

            // 🔧 修复：直接将完整的API返回数据追加到消息中，不进行拆分
            // 自定义API返回的是一条完整的响应，包含 <aiThinkProcess> 和 <infobar_data>
            // 应该保持数据的完整性和语义连贯性
            if (infobarData && infobarData.trim()) {
                console.log('[InfoBarSettings] 📝 追加完整的API返回数据到消息');
                lastMessage.mes = lastMessage.mes.trim() + '\n\n' + infobarData.trim();
            } else {
                console.warn('[InfoBarSettings] ⚠️ API返回数据为空');
                return false;
            }

            // 保存聊天数据
            if (context.saveChat) {
                await context.saveChat();
                console.log('[InfoBarSettings] 💾 聊天数据已保存');
            }

            console.log('[InfoBarSettings] ✅ infobar_data已成功追加到消息');
            return true;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 追加infobar_data到消息失败:', error);
            return false;
        }
    }

    // 注释：extractAndMergeAPIResult 函数已移除
    // 原因：自定义API返回的是完整响应数据，不应该人为拆分 <aiThinkProcess> 和 <infobar_data>
    // 新的处理逻辑直接将完整数据追加到消息中，保持数据的完整性和语义连贯性

    /**
     * 获取API提供商
     */
    getAPIProvider() {
        const context = SillyTavern.getContext();
        const extensionSettings = context.extensionSettings;
        return extensionSettings['Information bar integration tool']?.apiConfig?.provider || 'unknown';
    }

    /**
     * 获取API模型
     */
    getAPIModel() {
        const context = SillyTavern.getContext();
        const extensionSettings = context.extensionSettings;
        return extensionSettings['Information bar integration tool']?.apiConfig?.model || 'unknown';
    }

    /**
     * 显示通知消息
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
            <span class="notification-text">${message}</span>
        `;

        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#dbeafe'};
            color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb'};
            border: 1px solid ${type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#bfdbfe'};
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
        `;

        // 添加到页面
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 加载总结设置
     */
    async loadSummarySettings() {
        try {
            console.log('[InfoBarSettings] 📥 加载总结设置...');

            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;

            if (!summaryManager) {
                console.warn('[InfoBarSettings] ⚠️ 总结管理器未找到');
                return;
            }

            const settings = summaryManager.settings;

            // 应用设置到UI
            const autoSummaryEnabled = this.modal.querySelector('#content-auto-summary-enabled');
            if (autoSummaryEnabled) {
                autoSummaryEnabled.checked = settings.autoSummaryEnabled || false;
            }

            // 🔧 新增：注入总结设置
            const injectSummaryEnabled = this.modal.querySelector('#content-inject-summary-enabled');
            if (injectSummaryEnabled) {
                injectSummaryEnabled.checked = settings.injectSummaryEnabled || false;
            }

            const summaryFloorCount = this.modal.querySelector('#content-summary-floor-count');
            if (summaryFloorCount) {
                summaryFloorCount.value = settings.summaryFloorCount || 20;
            }

            const summaryType = this.modal.querySelector('#content-summary-type');
            if (summaryType) {
                summaryType.value = settings.summaryType || 'small';
                this.handleSummaryTypeChange(summaryType.value);
            }

            const summaryWordCount = this.modal.querySelector('#content-summary-word-count');
            if (summaryWordCount) {
                summaryWordCount.value = settings.summaryWordCount || 300;
            }

            console.log('[InfoBarSettings] ✅ 总结设置加载完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载总结设置失败:', error);
        }
    }

    /**
     * 加载总结历史
     */
    async loadSummaryHistory() {
        try {
            console.log('[InfoBarSettings] 📚 加载总结历史...');

            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;

            if (!summaryManager) {
                console.warn('[InfoBarSettings] ⚠️ 总结管理器未找到');
                return;
            }

            const summaryHistory = await summaryManager.getSummaryHistory();
            this.renderSummaryHistory(summaryHistory);

            console.log('[InfoBarSettings] ✅ 总结历史加载完成，共', summaryHistory.length, '条记录');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 加载总结历史失败:', error);
        }
    }

    /**
     * 渲染总结历史
     */
    renderSummaryHistory(summaryHistory) {
        try {
            const historySelect = this.modal.querySelector('#content-summary-history-select');
            if (!historySelect) return;

            // 清空现有选项，保留默认选项
            historySelect.innerHTML = '<option value="">请选择要查看的总结记录</option>';

            if (!summaryHistory || summaryHistory.length === 0) {
                // 添加空状态选项
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '暂无总结记录，请先生成总结';
                emptyOption.disabled = true;
                historySelect.appendChild(emptyOption);
                return;
            }

            // 添加总结记录选项
            summaryHistory.forEach(summary => {
                const option = document.createElement('option');
                option.value = summary.id;
                option.textContent = this.formatSummarySelectOption(summary);
                historySelect.appendChild(option);
            });

            console.log('[InfoBarSettings] ✅ 总结历史选择框渲染完成，共', summaryHistory.length, '条记录');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 渲染总结历史失败:', error);
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
     * 格式化总结选择框选项
     * 格式：[总结类型] 总结标题 (楼层X-Y) - 时间
     */
    formatSummarySelectOption(summary) {
        try {
            // 总结类型
            const typeMap = {
                'small': '小总结',
                'large': '大总结',
                'manual': '手动总结',
                'auto': '自动总结'
            };
            const typeText = typeMap[summary.type] || '总结';

            // 总结标题（使用内容的前20个字符作为标题）
            let title = '无标题';
            if (summary.content && summary.content.trim()) {
                title = summary.content.trim().substring(0, 20);
                if (summary.content.length > 20) {
                    title += '...';
                }
            }

            // 楼层信息
            let floorInfo = '';
            if (summary.messageRange) {
                const start = summary.messageRange.start + 1; // 转换为1基索引
                const end = summary.messageRange.end + 1;
                floorInfo = ` (楼层${start}-${end})`;
            }

            // 时间信息
            const timeText = this.formatShortDate(summary.timestamp);

            // 组合格式：[总结类型] 总结标题 (楼层X-Y) - 时间
            return `[${typeText}] ${title}${floorInfo} - ${timeText}`;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 格式化总结选择框选项失败:', error);
            return '总结记录';
        }
    }

    /**
     * 格式化总结预览
     */
    formatSummaryPreview(content) {
        if (!content) return '暂无内容';
        return content.length > 100 ? content.substring(0, 100) + '...' : content;
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
     * 格式化短日期（用于选择框）
     */
    formatShortDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (targetDate.getTime() === today.getTime()) {
            // 今天，只显示时间
            return date.toLocaleString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            // 其他日期，显示月日和时间
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * 显示总结内容
     */
    async showSummaryContent(summaryId) {
        try {
            console.log('[InfoBarSettings] 📄 显示总结内容:', summaryId);

            if (!summaryId) {
                // 隐藏内容区域
                this.hideSummaryContent();
                return;
            }

            // 获取总结历史
            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;

            if (!summaryManager) {
                console.warn('[InfoBarSettings] ⚠️ 总结管理器未找到');
                return;
            }

            const summaryHistory = await summaryManager.getSummaryHistory();
            const summary = summaryHistory.find(s => s.id === summaryId);

            if (!summary) {
                console.warn('[InfoBarSettings] ⚠️ 未找到总结记录:', summaryId, '当前聊天总结数量:', summaryHistory.length);
                // 隐藏内容区域，因为该总结不属于当前聊天
                this.hideSummaryContent();
                return;
            }

            // 显示内容区域
            const contentSection = this.modal.querySelector('#content-summary-content-section');
            const titleElement = this.modal.querySelector('#content-summary-title');
            const dateElement = this.modal.querySelector('#content-summary-date');
            const bodyElement = this.modal.querySelector('#content-summary-content-body');

            if (contentSection && titleElement && dateElement && bodyElement) {
                titleElement.textContent = this.formatSummaryTitle(summary);
                dateElement.textContent = this.formatDate(summary.timestamp);
                bodyElement.textContent = summary.content || '暂无内容';

                contentSection.style.display = 'block';

                console.log('[InfoBarSettings] ✅ 总结内容已显示');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示总结内容失败:', error);
        }
    }
    /**
     * 绑定总结面板事件
     */
    bindSummaryPanelEvents() {
        try {
            console.log('[InfoBarSettings] 🔗 绑定总结面板事件...');

            // 总结类型变化事件
            const summaryTypeSelect = this.modal.querySelector('#content-summary-type');
            if (summaryTypeSelect) {
                summaryTypeSelect.addEventListener('change', (e) => {
                    this.handleSummaryTypeChange(e.target.value);
                });
            }

            // 手动总结按钮事件
            const manualSummaryBtn = this.modal.querySelector('#header-manual-summary-btn');
            if (manualSummaryBtn) {
                manualSummaryBtn.addEventListener('click', () => {
                    this.triggerManualSummary();
                });
            }

            // 保存设置按钮事件
            const saveSettingsBtn = this.modal.querySelector('#content-save-settings-btn');
            if (saveSettingsBtn) {
                saveSettingsBtn.addEventListener('click', () => {
                    this.saveSummarySettings();
                });
            }

            // 刷新按钮事件
            const refreshBtn = this.modal.querySelector('#header-refresh-summary-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.loadSummaryHistory();
                });
            }

            // 总结历史选择框事件
            const historySelect = this.modal.querySelector('#content-summary-history-select');
            if (historySelect) {
                historySelect.addEventListener('change', (e) => {
                    const summaryId = e.target.value;
                    this.showSummaryContent(summaryId);
                });
            }

            // 删除当前选择的总结
            const deleteBtn = this.modal.querySelector('#content-delete-summary-btn');
            if (deleteBtn && historySelect) {
                deleteBtn.addEventListener('click', async () => {
                    try {
                        const summaryId = historySelect.value;
                        if (!summaryId) {
                            this.showNotification('请先在选择框中选择一条总结记录', 'info');
                            return;
                        }
                        const infoBarTool = window.SillyTavernInfobar;
                        const summaryManager = infoBarTool?.modules?.summaryManager;
                        if (!summaryManager) return;
                        const ok = await summaryManager.deleteSummaryRecord(summaryId);
                        if (ok) {
                            this.showNotification('✅ 已删除该总结', 'success');
                            // 刷新历史
                            await this.loadSummaryHistory();
                            // 清空选择与内容
                            historySelect.value = '';
                            this.hideSummaryContent();
                        } else {
                            this.showNotification('❌ 删除失败', 'error');
                        }
                    } catch (err) {
                        console.error('[InfoBarSettings] ❌ 删除总结失败:', err);
                        this.showNotification('❌ 删除失败', 'error');
                    }
                });
            }

            console.log('[InfoBarSettings] ✅ 总结面板事件绑定完成');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 绑定总结面板事件失败:', error);
        }
    }

    /**
     * 处理总结类型变化
     */
    handleSummaryTypeChange(summaryType) {
        try {
            console.log('[InfoBarSettings] 🔄 总结类型变化:', summaryType);

            const customWordCountRow = this.modal.querySelector('#content-custom-word-count-row');
            if (customWordCountRow) {
                if (summaryType === 'custom') {
                    customWordCountRow.style.display = 'block';
                } else {
                    customWordCountRow.style.display = 'none';
                }
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 处理总结类型变化失败:', error);
        }
    }

    /**
     * 触发手动总结
     */
    async triggerManualSummary() {
        try {
            console.log('[InfoBarSettings] 🖊️ 触发手动总结...');

            const manualSummaryBtn = this.modal.querySelector('#header-manual-summary-btn');
            if (manualSummaryBtn) {
                manualSummaryBtn.disabled = true;
                manualSummaryBtn.innerHTML = `
                    <span class="btn-icon">⏳</span>
                    <span class="btn-text">总结中...</span>
                `;
            }

            // 获取总结管理器
            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;

            if (!summaryManager) {
                throw new Error('总结管理器未初始化');
            }

            // 获取当前设置
            const settings = this.getCurrentSummarySettings();

            // 调用总结管理器进行总结
            const result = await summaryManager.generateSummary({
                type: 'manual',
                ...settings
            });

            if (result.success) {
                console.log('[InfoBarSettings] ✅ 手动总结完成');
                this.showMessage('✅ 总结生成成功', 'success');

                // 刷新总结历史
                this.loadSummaryHistory();
            } else {
                console.error('[InfoBarSettings] ❌ 手动总结失败:', result.error);
                this.showMessage('❌ 总结生成失败: ' + result.error, 'error');
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 触发手动总结失败:', error);
            this.showMessage('❌ 总结生成失败', 'error');
        } finally {
            // 恢复按钮状态
            const manualSummaryBtn = this.modal.querySelector('#header-manual-summary-btn');
            if (manualSummaryBtn) {
                manualSummaryBtn.disabled = false;
                manualSummaryBtn.innerHTML = `
                    <span class="btn-icon">🖊️</span>
                    <span class="btn-text">手动总结</span>
                `;
            }
        }
    }

    /**
     * 保存总结设置
     */
    async saveSummarySettings() {
        try {
            console.log('[InfoBarSettings] 💾 保存总结设置...');

            const settings = this.getCurrentSummarySettings();

            // 获取总结管理器
            const infoBarTool = window.SillyTavernInfobar;
            const summaryManager = infoBarTool?.modules?.summaryManager;

            if (!summaryManager) {
                throw new Error('总结管理器未初始化');
            }

            // 更新设置
            summaryManager.updateSettings(settings);

            // 保存到数据核心
            const unifiedDataCore = infoBarTool?.modules?.dataCore;
            if (unifiedDataCore) {
                await unifiedDataCore.setData('summary_settings', settings);
            }

            console.log('[InfoBarSettings] ✅ 总结设置已保存');
            this.showMessage('✅ 设置已保存', 'success');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存总结设置失败:', error);
            this.showMessage('❌ 保存设置失败', 'error');
        }
    }

    /**
     * 获取当前总结设置
     */
    getCurrentSummarySettings() {
        const settings = {
            autoSummaryEnabled: false,
            summaryFloorCount: 20,
            summaryType: 'small',
            summaryWordCount: 300,
            injectSummaryEnabled: false  // 🔧 新增：注入总结设置
        };

        try {
            const autoSummaryEnabled = this.modal.querySelector('#content-auto-summary-enabled');
            if (autoSummaryEnabled) {
                settings.autoSummaryEnabled = autoSummaryEnabled.checked;
            }

            const summaryFloorCount = this.modal.querySelector('#content-summary-floor-count');
            if (summaryFloorCount) {
                settings.summaryFloorCount = parseInt(summaryFloorCount.value) || 20;
            }

            const summaryType = this.modal.querySelector('#content-summary-type');
            if (summaryType) {
                settings.summaryType = summaryType.value;
            }

            const summaryWordCount = this.modal.querySelector('#content-summary-word-count');
            if (summaryWordCount) {
                settings.summaryWordCount = parseInt(summaryWordCount.value) || 300;
            }

            // 🔧 新增：获取注入总结设置
            const injectSummaryEnabled = this.modal.querySelector('#content-inject-summary-enabled');
            if (injectSummaryEnabled) {
                settings.injectSummaryEnabled = injectSummaryEnabled.checked;
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取当前总结设置失败:', error);
        }

        return settings;
    }

    /**
     * 隐藏总结内容
     */
    hideSummaryContent() {
        // 🔧 修复：检查modal是否存在，避免在未初始化时调用
        if (!this.modal) {
            console.log('[InfoBarSettings] ⚠️ 设置界面未初始化，跳过隐藏总结内容');
            return;
        }
        
        const contentSection = this.modal.querySelector('#content-summary-content-section');
        if (contentSection) {
            contentSection.style.display = 'none';
        }
    }

    /**
     * 处理字体大小变更
     */
    handleFontSizeChange(fontSize) {
        const heightSelect = this.modal.querySelector('select[name="infobar.height"]');
        if (!heightSelect) return;

        // 字体大小与高度的推荐关联
        const fontHeightMap = {
            'small': 'compact',     // 12px -> 24px
            'medium': 'normal',     // 14px -> 32px
            'large': 'comfortable', // 16px -> 40px
            'xlarge': 'spacious'    // 18px -> 48px
        };

        const recommendedHeight = fontHeightMap[fontSize];
        if (recommendedHeight && heightSelect.value === 'auto') {
            heightSelect.value = recommendedHeight;
            console.log(`[InfoBarSettings] 🔗 字体大小 ${fontSize} 自动关联高度 ${recommendedHeight}`);
        }

        // 触发高度变更事件
        this.handleInfobarHeightChange(heightSelect.value);
    }

    /**
     * 处理信息栏高度变更
     */
    handleInfobarHeightChange(height) {
        // 应用CSS变量到信息栏
        const heightMap = {
            'auto': 'auto',
            'compact': '24px',
            'normal': '32px',
            'comfortable': '40px',
            'spacious': '48px'
        };

        const heightValue = heightMap[height] || '32px';
        
        // 应用到CSS变量（如果存在信息栏元素）
        const infobarElements = document.querySelectorAll('.info-bar, .infobar-container');
        infobarElements.forEach(element => {
            element.style.setProperty('--infobar-height', heightValue);
            if (heightValue !== 'auto') {
                element.style.minHeight = heightValue;
            }
        });

        console.log(`[InfoBarSettings] 📏 信息栏高度设置为 ${heightValue}`);

        // 保存设置
        this.saveThemeSettings();
    }

    /**
     * 保存主题设置
     */
    saveThemeSettings() {
        try {
            const settings = {
                fontSize: this.modal.querySelector('select[name="theme.fontSize"]')?.value || 'medium',
                fontFamily: this.modal.querySelector('select[name="theme.fontFamily"]')?.value || 'system',
                infobarHeight: this.modal.querySelector('select[name="infobar.height"]')?.value || 'normal'
            };

            // 保存到扩展设置
            const extensionSettings = window.SillyTavernInfobar?.config || {};
            extensionSettings.theme = extensionSettings.theme || {};
            Object.assign(extensionSettings.theme, settings);

            console.log('[InfoBarSettings] 💾 主题设置已保存:', settings);
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 保存主题设置失败:', error);
        }
    }

    /**
     * 显示演示添加面板菜单
     */
    showAddPanelMenu(position, slotElement) {
        try {
            console.log('[InfoBarSettings] 🎭 显示演示添加面板菜单');

            // 移除现有菜单
            const existingMenu = document.querySelector('.demo-add-panel-menu');
            if (existingMenu) {
                existingMenu.remove();
            }

            // 获取区域信息
            const area = slotElement.dataset.area || 'top';
            console.log(`[InfoBarSettings] 📍 添加到区域: ${area}, 位置: ${position}`);

            // 动态获取用户启用的面板配置
            const enabledPanels = this.getEnabledPanels();
            console.log('[InfoBarSettings] 📊 获取到用户启用的面板:', Object.keys(enabledPanels));

            if (Object.keys(enabledPanels).length === 0) {
                console.warn('[InfoBarSettings] ⚠️ 没有启用的面板，无法显示添加菜单');
                return;
            }

            // 创建演示菜单
            const menu = document.createElement('div');
            menu.className = 'demo-add-panel-menu';
            // 生成面板列表HTML
            const panelListHtml = this.generatePanelListHtml(enabledPanels);
            
            // 获取第一个面板用于初始化右侧子项列表
            const firstPanelId = Object.keys(enabledPanels)[0];
            const firstPanelConfig = enabledPanels[firstPanelId];
            const subitemListHtml = this.generateSubitemListHtml(firstPanelId, firstPanelConfig);

            menu.innerHTML = `
                <div class="demo-menu-content">
                    <div class="menu-header">
                        <h3>添加到${area === 'top' ? '顶部' : '底部'}区域</h3>
                        <button class="menu-close-btn">&times;</button>
                    </div>
                    <div class="menu-body">
                        <div class="menu-layout">
                            <!-- 左侧面板导航 -->
                            <div class="panel-navigation">
                                <h4>📋 启用的面板 (${Object.keys(enabledPanels).length})</h4>
                                <div class="panel-list">
                                    ${panelListHtml}
                                </div>
                            </div>
                            
                            <!-- 右侧子项列表 -->
                            <div class="subitem-list">
                                ${subitemListHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 定位菜单（移动端全屏遮罩，桌面端居中）
            const isMobile = window.innerWidth <= 768;
            menu.style.position = 'fixed';
            menu.style.zIndex = '10000';
            if (isMobile) {
                // 全屏遮罩
                menu.style.left = '0';
                menu.style.top = '0';
                menu.style.width = '100vw';
                menu.style.height = '100vh';
                menu.style.background = 'rgba(0, 0, 0, 0.5)';
                menu.style.backdropFilter = 'blur(4px)';
                menu.style.display = 'flex';
                menu.style.alignItems = 'center';
                menu.style.justifyContent = 'center';

                // 内容容器限制尺寸并居中
                const menuContent = menu.querySelector('.demo-menu-content');
                if (menuContent) {
                    menuContent.style.width = '90vw';
                    menuContent.style.maxWidth = '360px';
                    menuContent.style.maxHeight = '80vh';
                    menuContent.style.overflow = 'auto';
                    menuContent.style.borderRadius = '12px';
                }
            } else {
                // 桌面居中
                menu.style.left = '50%';
                menu.style.top = '50%';
                menu.style.transform = 'translate(-50%, -50%)';
            }

            // 添加到页面
            document.body.appendChild(menu);

            // 点击遮罩关闭（仅移动端全屏时）
            if (isMobile) {
                menu.addEventListener('click', (evt) => {
                    const content = menu.querySelector('.demo-menu-content');
                    if (content && !content.contains(evt.target)) {
                        menu.remove();
                    }
                });
            }

            // 绑定关闭按钮
            const closeBtn = menu.querySelector('.menu-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    menu.remove();
                });
            }

            // 绑定面板导航事件
            const panelNavItems = menu.querySelectorAll('.panel-nav-item');
            panelNavItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('add-panel-btn')) return; // 忽略添加按钮点击
                    
                    // 切换激活状态
                    panelNavItems.forEach(navItem => navItem.classList.remove('active'));
                    item.classList.add('active');
                    
                    // 更新右侧子项列表
                    const panelType = item.dataset.panel;
                    this.updateSubitemList(menu, panelType);
                });
            });

            // 绑定添加面板按钮事件
            const addPanelBtns = menu.querySelectorAll('.add-panel-btn');
            addPanelBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const panelType = btn.closest('.panel-nav-item').dataset.panel;
                    console.log(`[InfoBarSettings] 🎭 添加面板: ${panelType} 到 ${area}`);
                    this.addPanelToPreview(panelType, area, position);
                    menu.remove();
                });
            });

            // 绑定添加子项按钮事件
            const addSubitemBtns = menu.querySelectorAll('.add-subitem-btn');
            addSubitemBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fieldType = btn.closest('.subitem-item').dataset.field;
                    console.log(`[InfoBarSettings] 🔧 添加子项: ${fieldType} 到 ${area}`);
                    this.addSubitemToPreview(fieldType, area, position);
                    menu.remove();
                });
            });

            // 点击外部关闭
            setTimeout(() => {
                const clickOutside = (e) => {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', clickOutside);
                    }
                };
                document.addEventListener('click', clickOutside);
            }, 100);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示演示添加面板菜单失败:', error);
        }
    }

    /**
     * 显示演示面板弹窗
     */
    showDemoPanelPopup(panelType, panelData = {}) {
        try {
            console.log('[InfoBarSettings] 🎭 显示演示面板弹窗:', panelType);

            // 移除现有弹窗
            const existingPopup = document.querySelector('.demo-panel-popup');
            if (existingPopup) {
                existingPopup.remove();
            }

            // 演示数据
            const demoData = {
                personal: {
                    '姓名': '张三',
                    '年龄': '25岁',
                    '性别': '男',
                    '职业': '冒险者',
                    '等级': 'Lv.15',
                    '经验值': '2847/3000'
                },
                inventory: {
                    '金币': '1,247枚',
                    '银剑': '1把 (装备中)',
                    '生命药水': '3瓶',
                    '魔法石': '5颗',
                    '面包': '7个',
                    '钥匙': '神秘钥匙 x1'
                }
            };

            const data = demoData[panelType] || panelData;

            // 创建弹窗
            const popup = document.createElement('div');
            popup.className = 'demo-panel-popup';
            popup.style.setProperty('position', 'fixed', 'important');
            popup.style.setProperty('top', '0', 'important');
            popup.style.setProperty('left', '0', 'important');
            popup.style.setProperty('right', '0', 'important');
            popup.style.setProperty('bottom', '0', 'important');
            popup.style.setProperty('width', '100vw', 'important');
            popup.style.setProperty('height', '100vh', 'important');
            popup.style.setProperty('display', 'flex', 'important');
            popup.style.setProperty('align-items', 'center', 'important');
            popup.style.setProperty('justify-content', 'center', 'important');
            popup.style.setProperty('z-index', '10000', 'important');
            popup.style.setProperty('background', 'rgba(0,0,0,0.5)', 'important');
            
            const dataHtml = Object.entries(data)
                .map(([key, value]) => `
                    <div class="data-field">
                        <span class="field-name">${key}:</span>
                        <span class="field-value">${value}</span>
                    </div>
                `).join('');

            popup.innerHTML = `
                <div class="demo-popup-content" style="
                    background: var(--theme-bg-primary, #2a2a2a);
                    color: var(--theme-text-primary, #ffffff);
                    border: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));
                    border-radius: 12px;
                    padding: 0;
                    min-width: 300px;
                    max-width: 90vw;
                    min-height: 200px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    position: relative;
                    margin: 0;
                ">
                    <div class="popup-header">
                        <h3>${panelType === 'personal' ? '👤 个人信息' : 
                             panelType === 'inventory' ? '🎒 背包信息' : '📊 面板信息'}</h3>
                        <button class="popup-close-btn">&times;</button>
                    </div>
                    <div class="popup-body">
                        ${dataHtml}
                    </div>
                </div>
            `;

            // 添加到页面
            document.body.appendChild(popup);

            // 绑定关闭事件
            const closeBtn = popup.querySelector('.popup-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    popup.remove();
                });
            }

            // 点击外部关闭
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.remove();
                }
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 显示演示面板弹窗失败:', error);
        }
    }

    /**
     * 更新预览位置
     */
    updatePreviewPosition(position) {
        try {
            console.log(`[InfoBarSettings] 📍 更新预览位置: ${position}`);
            
            const previewContainer = this.modal?.querySelector('.frontend-preview-container');
            if (previewContainer) {
                previewContainer.setAttribute('data-position', position);
                console.log(`[InfoBarSettings] ✅ 预览位置已更新为: ${position}`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新预览位置失败:', error);
        }
    }

    /**
     * 更新预览样式
     */
    updatePreviewStyle(style) {
        try {
            console.log(`[InfoBarSettings] 🎨 更新预览样式: ${style}`);
            
            const messageWrapper = this.modal?.querySelector('.ai-message-wrapper');
            if (messageWrapper) {
                // 移除现有样式类
                messageWrapper.classList.remove('compact', 'comfortable', 'spacious');
                // 添加新样式类
                messageWrapper.classList.add(style);
                console.log(`[InfoBarSettings] ✅ 预览样式已更新为: ${style}`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新预览样式失败:', error);
        }
    }

    /**
     * 切换添加按钮显示
     */
    toggleAddButtons(show) {
        try {
            console.log(`[InfoBarSettings] ➕ 切换添加按钮: ${show ? '显示' : '隐藏'}`);
            
            const addSlots = this.modal?.querySelectorAll('.add-panel-slots');
            if (addSlots) {
                addSlots.forEach(slot => {
                    slot.style.display = show ? 'flex' : 'none';
                });
                console.log(`[InfoBarSettings] ✅ 添加按钮已${show ? '显示' : '隐藏'}`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换添加按钮失败:', error);
        }
    }

    /**
     * 切换动画效果
     */
    toggleAnimations(enabled) {
        try {
            console.log(`[InfoBarSettings] 🎬 切换动画效果: ${enabled ? '启用' : '禁用'}`);
            
            const previewContainer = this.modal?.querySelector('.frontend-preview-container');
            if (previewContainer) {
                previewContainer.setAttribute('data-animations', enabled);
                console.log(`[InfoBarSettings] ✅ 动画效果已${enabled ? '启用' : '禁用'}`);
            }

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 切换动画效果失败:', error);
        }
    }
    /**
     * 获取启用的面板配置
     */
    getEnabledPanels() {
        try {
            const context = SillyTavern.getContext();
            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};

            const enabledPanels = {};

            // 基础面板
            const basicPanelIds = [
                'personal', 'world', 'interaction', 'tasks', 'organization',
                'news', 'inventory', 'abilities', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            basicPanelIds.forEach(panelId => {
                if (configs[panelId]) {
                    const panel = configs[panelId];
                    // 默认为true，除非明确设置为false
                    const isEnabled = panel.enabled !== false;

                    if (isEnabled) {
                        enabledPanels[panelId] = panel;
                    }
                }
            });

            // 自定义面板
            if (configs.customPanels) {
                Object.entries(configs.customPanels).forEach(([panelId, panelConfig]) => {
                    if (panelConfig && panelConfig.enabled) {
                        enabledPanels[panelId] = panelConfig;
                    }
                });
            }

            return enabledPanels;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取启用面板失败:', error);
            return {};
        }
    }

    /**
     * 生成面板列表HTML
     */
    generatePanelListHtml(enabledPanels) {
        try {
            const panelItems = [];
            let isFirst = true;

            for (const [panelId, panelConfig] of Object.entries(enabledPanels)) {
                // 获取面板显示信息
                const panelInfo = this.getPanelDisplayInfo(panelId, panelConfig);
                
                panelItems.push(`
                    <div class="panel-nav-item ${isFirst ? 'active' : ''}" data-panel="${panelId}">
                        <span class="panel-name">${panelInfo.name}</span>
                        <button class="add-panel-btn" title="添加面板">➕</button>
                    </div>
                `);
                
                isFirst = false;
            }

            return panelItems.join('');

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 生成面板列表HTML失败:', error);
            return '';
        }
    }

    /**
     * 生成子项列表HTML
     */
    generateSubitemListHtml(panelId, panelConfig) {
        try {
            const panelInfo = this.getPanelDisplayInfo(panelId, panelConfig);
            const subItems = this.getEnabledSubItems(panelId, panelConfig);

            const subItemsHtml = subItems.map(subItem => `
                <div class="subitem-item" data-field="${subItem.key}">
                    <span class="subitem-label">${subItem.displayName}</span>
                    <button class="add-subitem-btn" title="添加子项">➕</button>
                </div>
            `).join('');

            return `
                <h4>🔧 ${panelInfo.name} - 启用的子项 (${subItems.length})</h4>
                <div class="subitem-content">
                    ${subItemsHtml || '<div class="no-subitems">该面板没有启用的子项</div>'}
                </div>
            `;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 生成子项列表HTML失败:', error);
            return '<h4>错误：无法加载子项</h4><div class="subitem-content"></div>';
        }
    }

    /**
     * 获取面板显示信息（图标和名称）
     */
    getPanelDisplayInfo(panelId, panelConfig) {
        // 基础面板的默认配置
        const basicPanelInfo = {
            personal: { icon: '👤', name: '个人信息' },
            world: { icon: '🌍', name: '世界信息' },
            interaction: { icon: '🤝', name: '交互对象' },
            tasks: { icon: '📋', name: '任务信息' },
            organization: { icon: '🏢', name: '组织信息' },
            news: { icon: '📰', name: '新闻事件' },
            inventory: { icon: '🎒', name: '背包物品' },
            abilities: { icon: '⚡', name: '能力技能' },
            plot: { icon: '📖', name: '剧情信息' },
            cultivation: { icon: '🧘', name: '修炼信息' },
            fantasy: { icon: '🐉', name: '奇幻设定' },
            modern: { icon: '🏙️', name: '现代设定' },
            historical: { icon: '🏛️', name: '历史设定' },
            magic: { icon: '🔮', name: '魔法系统' },
            training: { icon: '🎯', name: '训练信息' }
        };

        // 如果是基础面板，使用预设信息
        if (basicPanelInfo[panelId]) {
            return basicPanelInfo[panelId];
        }

        // 自定义面板使用配置中的信息
        return {
            icon: panelConfig.icon || '📄',
            name: panelConfig.name || panelId
        };
    }

    /**
     * 获取面板的启用子项
     */
    getEnabledSubItems(panelId, panelConfig) {
        try {
            const subItems = [];

            // 判断是否为基础面板
            const basicPanelIds = [
                'personal', 'world', 'interaction', 'tasks', 'organization',
                'news', 'inventory', 'abilities', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            if (basicPanelIds.includes(panelId)) {
                // 基础面板：处理基础设置中的复选框配置（panel[key].enabled格式）
                const subItemKeys = Object.keys(panelConfig).filter(key => 
                    key !== 'enabled' && 
                    key !== 'subItems' &&     // 排除自定义子项数组
                    key !== 'description' &&  // 排除面板属性
                    key !== 'icon' && 
                    key !== 'required' && 
                    key !== 'memoryInject' && 
                    key !== 'prompts' && 
                    typeof panelConfig[key] === 'object' && 
                    panelConfig[key].enabled !== undefined
                );

                const enabledSubItems = subItemKeys.filter(key => panelConfig[key].enabled === true);

                // 添加基础设置的子项
                enabledSubItems.forEach(key => {
                    subItems.push({
                        key: key,
                        displayName: panelConfig[key].name || this.getBasicSubItemDisplayName(panelId, key),
                        source: 'basicSettings'
                    });
                });

                // 处理基础面板的自定义子项（从面板管理添加的）
                if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                    panelConfig.subItems.forEach(subItem => {
                        if (subItem.enabled !== false) {
                            subItems.push({
                                key: subItem.key,
                                displayName: subItem.displayName || subItem.name,
                                source: 'panelManagement'
                            });
                        }
                    });
                }
            } else {
                // 自定义面板：处理自定义面板的子项
                if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                    panelConfig.subItems.forEach(subItem => {
                        if (subItem.enabled !== false) {
                            subItems.push({
                                key: subItem.key,
                                displayName: subItem.displayName || subItem.name || subItem.key,
                                source: 'customPanel'
                            });
                        }
                    });
                }
            }

            console.log(`[InfoBarSettings] 📊 面板 ${panelId}: ${subItems.length} 个启用的子项`, subItems.map(s => `${s.displayName}(${s.source})`));
            return subItems;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取启用子项失败:', error);
            return [];
        }
    }

    /**
     * 获取基础子项显示名称 - 与数据表格完全一致的完整映射
     */
    getBasicSubItemDisplayName(panelId, key) {
        // 与DataTable.js完全一致的完整中文映射表
        return this.getDataTableDisplayName(panelId, key);
    }

    /**
     * 获取数据表格显示名称 - 完整的中文映射实现
     */
    getDataTableDisplayName(panelType, key) {
        const displayNames = this.getCompleteDisplayNameMapping();
        return displayNames[panelType]?.[key] || key;
    }

    /**
     * 获取完整的显示名称映射表 - 与DataTable.js完全一致的完整版本
     */
    getCompleteDisplayNameMapping() {
        return {
            personal: {
                name: '姓名', age: '年龄', gender: '性别', occupation: '职业',
                height: '身高', weight: '体重', bloodType: '血型', zodiac: '星座',
                birthday: '生日', birthplace: '出生地', nationality: '国籍', ethnicity: '民族',
                hairColor: '发色', hairStyle: '发型', eyeColor: '眼色', skinColor: '肤色',
                bodyType: '体型', facialFeatures: '面部特征', scars: '疤痕', tattoos: '纹身',
                accessories: '配饰', clothingStyle: '穿着风格', appearance: '外貌', voice: '声音',
                personality: '性格', temperament: '性情', attitude: '态度', values: '价值观',
                beliefs: '信念', fears: '恐惧', dreams: '梦想', goals: '人生目标',
                intelligence: '智力', strength: '力量', charisma: '魅力', luck: '运气',
                perception: '感知', willpower: '意志力', reactionSpeed: '反应速度', learningAbility: '学习能力',
                familyBackground: '家庭背景', education: '教育经历', workExperience: '工作经历', income: '收入',
                socialStatus: '社会地位', relationships: '人际关系', loveStatus: '恋爱状态', maritalStatus: '婚姻状态',
                hobbies: '爱好', sports: '运动', music: '音乐', art: '艺术',
                reading: '阅读', gaming: '游戏', travel: '旅行', cooking: '烹饪',
                skills: '技能特长', languages: '语言能力', habits: '生活习惯', healthStatus: '健康状态',
                race: '种族', class: '职业'
            },
            world: {
                name: '世界名称', type: '世界类型', genre: '世界风格', theme: '世界主题',
                description: '世界描述', history: '世界历史', mythology: '神话传说', lore: '世界设定',
                geography: '地理环境', climate: '气候条件', terrain: '地形地貌', biomes: '生物群落',
                locations: '重要地点', landmarks: '地标建筑', cities: '城市设定', dungeons: '地下城',
                time: '时间设定', calendar: '历法系统', seasons: '季节变化', dayNight: '昼夜循环',
                weather: '天气系统', events: '世界事件', festivals: '节日庆典', disasters: '自然灾害',
                cultures: '文化设定', languages: '语言系统', religions: '宗教信仰', customs: '风俗习惯',
                politics: '政治体系', economy: '经济系统', technology: '科技水平', magic: '魔法系统',
                races: '种族设定', creatures: '生物设定', monsters: '怪物设定', npcs: 'NPC设定',
                factions: '势力组织', conflicts: '冲突矛盾', alliances: '联盟关系', wars: '战争历史',
                resources: '资源分布', materials: '材料设定', artifacts: '神器文物', currency: '货币系统',
                trade: '贸易体系', markets: '市场设定', guilds: '公会组织', transportation: '交通运输',
                location: '位置', environment: '环境', atmosphere: '氛围', season: '季节',
                culture: '文化'
            },
            interaction: {
                name: '对象名称', type: '对象类型', status: '当前状态', location: '所在位置',
                mood: '情绪状态', activity: '当前活动', availability: '可用性', priority: '优先级',
                relationship: '关系类型', intimacy: '亲密度', trust: '信任度', friendship: '友谊度',
                romance: '浪漫度', respect: '尊重度', dependency: '依赖度', conflict: '冲突度',
                history: '历史记录', frequency: '互动频率', duration: '互动时长', quality: '互动质量',
                topics: '话题偏好', emotions: '情感状态', milestones: '重要节点', memories: '共同回忆',
                autoRecord: '自动记录', notifications: '通知设置', analysis: '关系分析', suggestions: '建议提示',
                network: '社交网络', groups: '群体关系', influence: '影响力', reputation: '声誉度',
                alliances: '联盟关系', rivalries: '竞争关系', mentorship: '师徒关系', hierarchy: '等级关系',
                communicationStyle: '沟通风格', preferredTopics: '偏好话题', avoidedTopics: '回避话题', boundaries: '边界设定',
                comfortLevel: '舒适度', energyLevel: '活跃度', responseTime: '响应时间', engagement: '参与度',
                specialEvents: '特殊事件', achievements: '成就记录', challenges: '挑战任务', growth: '成长轨迹',
                npc_name: 'NPC姓名', npc_personality: 'NPC性格', npc_status: 'NPC状态',
                attitude: '态度', conversation_topic: '对话主题', interaction_history: '交互历史',
                favorability: '好感度', social_context: '社交背景'
            },
            tasks: {
                creation: '任务创建', editing: '任务编辑', deletion: '任务删除', completion: '任务完成',
                priority: '优先级', deadline: '截止日期', progress: '进度跟踪', status: '状态管理',
                categories: '分类管理', tags: '标签系统', projects: '项目管理', milestones: '里程碑',
                subtasks: '子任务', dependencies: '依赖关系', templates: '任务模板', recurring: '重复任务',
                notifications: '通知提醒', reminders: '提醒设置', alerts: '警报通知', dailySummary: '每日总结',
                weeklyReview: '周报回顾', achievementBadges: '成就徽章', productivityStats: '生产力统计', timeTracking: '时间跟踪',
                assignment: '任务分配', collaboration: '协作功能', comments: '评论系统', attachments: '附件管理',
                sharing: '共享功能', permissions: '权限管理', approval: '审批流程', delegation: '任务委派',
                listView: '列表视图', kanbanView: '看板视图', calendarView: '日历视图', ganttView: '甘特图',
                sorting: '排序功能', filtering: '筛选功能', search: '搜索功能', grouping: '分组功能',
                backup: '备份功能', export: '导出功能', import: '导入功能', sync: '同步功能',
                archive: '归档管理', history: '历史记录', versioning: '版本控制', recovery: '恢复功能'
            },
            organization: {
                name: '组织名称', type: '组织类型', description: '组织描述', purpose: '组织目标',
                history: '组织历史', founding: '成立背景', motto: '组织格言', values: '核心价值',
                hierarchy: '层级结构', departments: '部门设置', leadership: '领导层', council: '理事会',
                positions: '职位设置', ranks: '等级制度', promotion: '晋升机制', authority: '权限分配',
                members: '成员管理', recruitment: '招募制度', training: '培训体系', evaluation: '考核评估',
                rewards: '奖励机制', punishment: '惩罚制度', benefits: '福利待遇', retirement: '退休制度',
                rules: '组织规则', code: '行为准则', ethics: '道德规范', discipline: '纪律制度',
                procedures: '操作流程', protocols: '协议规范', standards: '标准制度', compliance: '合规管理',
                allies: '盟友关系', enemies: '敌对关系', neutral: '中立关系', partnerships: '合作伙伴',
                reputation: '组织声誉', influence: '影响力', diplomacy: '外交关系', treaties: '条约协议',
                finances: '财务状况', assets: '资产管理', facilities: '设施设备', equipment: '装备器材',
                technology: '技术资源', knowledge: '知识库', archives: '档案管理', secrets: '机密信息'
            },
            news: {
                breaking: '突发新闻', politics: '政治新闻', economy: '经济新闻', social: '社会新闻',
                military: '军事新闻', technology: '科技新闻', culture: '文化新闻', sports: '体育新闻',
                official: '官方公告', media: '媒体报道', rumors: '传言消息', insider: '内幕消息',
                witness: '目击报告', intelligence: '情报信息', leaked: '泄露消息', anonymous: '匿名爆料',
                creation: '新闻创建', editing: '新闻编辑', review: '新闻审核', publishing: '新闻发布',
                archiving: '新闻归档', deletion: '新闻删除', backup: '备份管理', versioning: '版本控制',
                broadcast: '广播发布', newsletter: '新闻简报', alerts: '新闻警报', digest: '新闻摘要',
                socialMedia: '社交媒体', forums: '论坛讨论', messaging: '消息推送', email: '邮件通知',
                comments: '评论系统', likes: '点赞功能', sharing: '分享功能', bookmarks: '收藏功能',
                ratings: '评分系统', polls: '投票调查', discussions: '讨论区', feedback: '反馈系统',
                analytics: '数据分析', metrics: '指标统计', trends: '趋势分析', reports: '报告生成',
                monitoring: '监控系统', alertsSystem: '警报系统', automation: '自动化', aiAnalysis: 'AI分析',
                events: '事件'
            },
            inventory: {
                storage: '物品存储', retrieval: '物品取出', organization: '物品整理', search: '物品搜索',
                sorting: '排序功能', filtering: '筛选功能', categories: '分类管理', tags: '标签系统',
                weapons: '武器装备', armor: '防具装备', accessories: '饰品配件', consumables: '消耗品',
                materials: '材料物品', tools: '工具器械', books: '书籍文献', treasures: '珍宝收藏',
                capacity: '容量管理', weight: '重量限制', stacking: '堆叠功能', expansion: '扩容升级',
                compartments: '分隔管理', protection: '保护功能', durability: '耐久度', repair: '修理维护',
                trading: '交易功能', selling: '出售功能', buying: '购买功能', auction: '拍卖系统',
                gifting: '赠送功能', lending: '借用功能', sharing: '共享功能', banking: '银行存储',
                crafting: '制作功能', recipes: '配方管理', enhancement: '强化功能', enchanting: '附魔功能',
                upgrading: '升级功能', combining: '合成功能', dismantling: '拆解功能', recycling: '回收功能',
                automation: '自动化', aiSorting: 'AI整理', recommendations: '推荐系统', analytics: '数据分析',
                backup: '备份功能', sync: '同步功能', security: '安全保护', history: '历史记录',
                gold: '金币', weapon: '武器', armor: '护甲', items: '道具'
            },
            abilities: {
                strength: '力量属性', agility: '敏捷属性', intelligence: '智力属性', constitution: '体质属性',
                wisdom: '智慧属性', charisma: '魅力属性', luck: '幸运属性', perception: '感知属性',
                swordsmanship: '剑术技能', archery: '射箭技能', magic: '魔法技能', defense: '防御技能',
                martialArts: '武术技能', stealth: '潜行技能', tactics: '战术技能', healing: '治疗技能',
                crafting: '制作技能', cooking: '烹饪技能', farming: '农业技能', mining: '采矿技能',
                fishing: '钓鱼技能', hunting: '狩猎技能', trading: '贸易技能', negotiation: '谈判技能',
                research: '研究技能', investigation: '调查技能', languages: '语言技能', history: '历史知识',
                medicine: '医学知识', alchemy: '炼金术', engineering: '工程学', astronomy: '天文学',
                persuasion: '说服技能', deception: '欺骗技能', intimidation: '威吓技能', performance: '表演技能',
                leadership: '领导能力', empathy: '共情能力', insight: '洞察能力', networking: '社交能力',
                telepathy: '心灵感应', telekinesis: '念动力', precognition: '预知能力', shapeshifting: '变形能力',
                invisibility: '隐身能力', flight: '飞行能力', regeneration: '再生能力', immortality: '不朽能力'
            },
            plot: {
                mainStory: '主线剧情', sideQuests: '支线任务', subplots: '子剧情', backstory: '背景故事',
                prologue: '序章', epilogue: '尾声', flashbacks: '回忆片段', foreshadowing: '伏笔铺垫',
                exposition: '背景说明', risingAction: '情节发展', climax: '高潮部分', fallingAction: '情节回落',
                resolution: '问题解决', denouement: '结局收尾', cliffhanger: '悬念结尾', twist: '剧情转折',
                characterArc: '角色成长', relationships: '人物关系', motivations: '动机驱动', conflicts: '冲突矛盾',
                internalConflicts: '内心冲突', externalConflicts: '外部冲突', moralDilemmas: '道德困境', sacrifices: '牺牲选择',
                dialogue: '对话系统', narration: '叙述描写', monologue: '独白表达', symbolism: '象征意义',
                themes: '主题思想', mood: '情绪氛围', tone: '语调风格', pacing: '节奏控制',
                choices: '选择分支', consequences: '后果影响', branching: '分支剧情', multipleEndings: '多重结局',
                playerAgency: '玩家主导', emergentNarrative: '涌现叙事', proceduralGeneration: '程序生成', adaptiveStorytelling: '自适应叙事',
                timeline: '时间线', notes: '剧情笔记', bookmarks: '书签标记', saveStates: '存档状态',
                autoSave: '自动保存', export: '导出功能', import: '导入功能', analytics: '数据分析'
            },
            cultivation: {
                qiRefining: '炼气期', foundation: '筑基期', goldenCore: '金丹期', nascentSoul: '元婴期',
                soulTransformation: '化神期', voidRefinement: '炼虚期', bodyIntegration: '合体期', mahayana: '大乘期',
                tribulation: '渡劫期', immortal: '真仙', trueImmortal: '天仙', goldenImmortal: '金仙',
                breathingTechnique: '呼吸法', bodyRefining: '炼体术', soulCultivation: '神魂修炼', dualCultivation: '双修功法',
                swordCultivation: '剑修之道', alchemy: '炼丹术', formation: '阵法', talisman: '符箓',
                spiritualPower: '灵力值', spiritualRoot: '灵根', meridians: '经脉', dantian: '丹田',
                divineSense: '神识', lifeSpan: '寿命', karma: '因果', heavenlyDao: '天道',
                flyingSword: '飞剑', magicTreasure: '法宝', spiritualArmor: '灵甲', storageRing: '储物戒',
                spiritBeast: '灵兽', puppet: '傀儡', avatar: '化身', clone: '分身',
                spiritStone: '灵石', spiritHerb: '灵草', pill: '丹药', spiritVein: '灵脉',
                caveMansion: '洞府', secretRealm: '秘境', inheritance: '传承', opportunity: '机缘',
                meditation: '打坐', tribulationCrossing: '渡劫', enlightenment: '顿悟', breakthrough: '突破',
                sect: '宗门', masterDisciple: '师徒', daoCompanion: '道侣', immortalAscension: '飞升'
            },
            fantasy: {
                human: '人类种族', elf: '精灵种族', dwarf: '矮人种族', orc: '兽人种族',
                dragon: '龙族', demon: '恶魔', angel: '天使', undead: '不死族',
                halfling: '半身人', giant: '巨人族', fairy: '仙灵', vampire: '吸血鬼',
                fireMagic: '火系魔法', waterMagic: '水系魔法', earthMagic: '土系魔法', airMagic: '风系魔法',
                lightMagic: '光系魔法', darkMagic: '暗系魔法', natureMagic: '自然魔法', spaceMagic: '空间魔法',
                timeMagic: '时间魔法', necromancy: '死灵法术', illusionMagic: '幻术魔法', enchantment: '附魔术',
                warrior: '战士职业', mage: '法师职业', archer: '弓箭手', rogue: '盗贼职业',
                priest: '牧师职业', paladin: '圣骑士', druid: '德鲁伊', warlock: '术士职业',
                bard: '吟游诗人', monk: '武僧职业', ranger: '游侠职业', assassin: '刺客职业',
                phoenix: '凤凰', unicorn: '独角兽', griffin: '狮鹫', pegasus: '飞马',
                kraken: '海怪', chimera: '奇美拉', basilisk: '蛇怪', hydra: '九头蛇',
                legendaryWeapon: '传说武器', magicArmor: '魔法护甲', artifact: '神器', relic: '圣物',
                magicCrystal: '魔法水晶', enchantedItem: '附魔物品', potion: '魔法药水', scroll: '魔法卷轴'
            },
            modern: {
                city: '城市环境', district: '区域设定', housing: '住房情况', transport: '交通工具',
                neighborhood: '社区环境', facilities: '设施配套', cost: '生活成本', safety: '安全状况',
                pollution: '环境污染', job: '职业工作', company: '公司企业', position: '职位等级',
                income: '收入水平', worktime: '工作时间', benefits: '福利待遇', career: '职业发展',
                skills: '技能要求', education: '教育背景', smartphone: '智能手机', computer: '电脑设备',
                internet: '网络连接', social: '社交媒体', gaming: '游戏娱乐', streaming: '流媒体',
                shopping: '购物消费', payment: '支付方式', ai: '人工智能', health: '健康管理',
                fitness: '健身运动', diet: '饮食习惯', sleep: '睡眠质量', medical: '医疗保健',
                stress: '压力管理', mental: '心理健康', checkup: '体检检查', budget: '预算管理',
                brands: '品牌偏好', fashion: '时尚潮流', luxury: '奢侈消费', investment: '投资理财',
                saving: '储蓄计划', credit: '信用记录', insurance: '保险保障', movies: '电影娱乐',
                music: '音乐欣赏', books: '阅读习惯', travel: '旅游出行', sports: '体育运动',
                hobbies: '兴趣爱好', clubs: '俱乐部', events: '活动参与'
            },
            historical: {
                dynasty: '朝代背景', period: '历史时期', emperor: '皇帝君主', capital: '都城首府',
                region: '地域分布', events: '历史事件', wars: '战争冲突', politics: '政治制度',
                economy: '经济状况', class: '社会阶层', title: '爵位头衔', family: '家族背景',
                wealth: '财富状况', land: '土地财产', servants: '仆从随从', influence: '影响力',
                reputation: '名声声誉', connections: '人脉关系', education: '教育程度', poetry: '诗词文学',
                calligraphy: '书法艺术', music: '音乐才艺', chess: '棋艺技巧', classics: '经典学问',
                philosophy: '哲学思想', etiquette: '礼仪规范', language: '语言文字', martial: '武艺修为',
                weapons: '兵器使用', archery: '射箭技艺', horsemanship: '骑术技能', strategy: '兵法谋略',
                bodyguard: '护卫随从', hunting: '狩猎技能', survival: '生存技能', residence: '居住环境',
                clothing: '服饰风格', food: '饮食习惯', transport: '出行方式', entertainment: '娱乐活动',
                festivals: '节庆活动', religion: '宗教信仰', medicine: '医学知识', profession: '职业身份',
                crafts: '手工技艺', trade: '商贸活动', farming: '农业生产', administration: '行政管理',
                teaching: '教学传授', healing: '医疗救治', construction: '建筑营造'
            },
            magic: {
                evocation: '塑能系', illusion: '幻术系', enchantment: '惑控系', necromancy: '死灵系',
                divination: '预言系', transmutation: '变化系', conjuration: '咒法系', abjuration: '防护系',
                elemental: '元素法术', cantrip: '戏法法术', level1: '一环法术', level2: '二环法术',
                level3: '三环法术', level4: '四环法术', level5: '五环法术', level6: '六环法术',
                level7: '七环法术', level8: '八环法术', level9: '九环法术', level: '法术等级',
                mana: '法力值', intelligence: '智力属性', wisdom: '感知属性', charisma: '魅力属性',
                concentration: '专注能力', spellpower: '法术强度', resistance: '魔法抗性', regeneration: '法力回复',
                spellbook: '法术书', known: '已知法术', prepared: '准备法术', slots: '法术位',
                components: '施法材料', rituals: '仪式法术', metamagic: '超魔专长', scrolls: '法术卷轴',
                fire: '火元素', water: '水元素', earth: '土元素', air: '风元素',
                lightning: '雷电', ice: '冰霜', light: '光明', dark: '黑暗',
                staff: '法杖', wand: '魔杖', orb: '法球', robe: '法袍',
                amulet: '护符', ring: '魔法戒指', crystal: '魔法水晶', tome: '魔法典籍'
            },
            training: {
                obedience: '服从训练', discipline: '纪律训练', etiquette: '礼仪训练', posture: '姿态训练',
                speech: '言语训练', behavior: '行为训练', attention: '注意力训练', patience: '耐心训练',
                focus: '专注训练', service: '服务训练', cooking: '烹饪训练', cleaning: '清洁训练',
                massage: '按摩训练', entertainment: '娱乐训练', music: '音乐训练', dance: '舞蹈训练',
                art: '艺术训练', language: '语言训练', strength: '力量训练', endurance: '耐力训练',
                flexibility: '柔韧训练', balance: '平衡训练', coordination: '协调训练', agility: '敏捷训练',
                stamina: '体能训练', recovery: '恢复训练', confidence: '自信训练', stress: '抗压训练',
                emotion: '情绪训练', memory: '记忆训练', logic: '逻辑训练', creativity: '创造训练',
                meditation: '冥想训练', mindfulness: '正念训练', intensity: '强度设置', duration: '持续时间',
                frequency: '训练频率', progress: '进度跟踪', rewards: '奖励机制', punishment: '惩罚机制',
                schedule: '训练计划', evaluation: '评估系统', auto: '自动训练', adaptive: '自适应训练',
                ai: 'AI辅助', analytics: '数据分析', reports: '训练报告', export: '导出功能',
                backup: '备份功能', sync: '同步功能'
            }
        };
    }

    /**
     * 更新子项列表
     */
    updateSubitemList(menu, panelType) {
        try {
            console.log(`[InfoBarSettings] 🔄 更新子项列表: ${panelType}`);
            
            const subitemList = menu.querySelector('.subitem-list');
            if (!subitemList) return;

            // 动态获取面板配置
            const enabledPanels = this.getEnabledPanels();
            const panelConfig = enabledPanels[panelType];
            
            if (!panelConfig) {
                console.warn(`[InfoBarSettings] ⚠️ 未找到面板配置: ${panelType}`);
                return;
            }

            // 生成新的子项列表HTML
            const newSubitemListHtml = this.generateSubitemListHtml(panelType, panelConfig);
            subitemList.innerHTML = newSubitemListHtml;

            // 重新绑定子项按钮事件
            const newAddSubitemBtns = subitemList.querySelectorAll('.add-subitem-btn');
            newAddSubitemBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fieldType = btn.closest('.subitem-item').dataset.field;
                    const area = menu.querySelector('.menu-header h3').textContent.includes('顶部') ? 'top' : 'bottom';
                    console.log(`[InfoBarSettings] 🔧 添加子项: ${fieldType} 到 ${area}`);
                    this.addSubitemToPreview(fieldType, area, 'new');
                    menu.remove();
                });
            });

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 更新子项列表失败:', error);
        }
    }

    /**
     * 添加面板到预览
     */
    addPanelToPreview(panelType, area, position) {
        try {
            console.log(`[InfoBarSettings] 🎭 添加面板到预览: ${panelType} (区域: ${area}, 位置: ${position})`);
            
            // 根据区域选择正确的容器
            const containerClass = area === 'top' ? '.top-embedded-panels' : '.bottom-embedded-panels';
            const embeddedPanels = this.modal?.querySelector(containerClass);
            if (!embeddedPanels) {
                console.error(`[InfoBarSettings] ❌ 未找到${area}区域的嵌入面板容器`);
                return;
            }

            // 动态获取面板配置
            const enabledPanels = this.getEnabledPanels();
            const panelConfig = enabledPanels[panelType];
            
            if (!panelConfig) {
                console.error(`[InfoBarSettings] ❌ 未找到面板配置: ${panelType}`);
                return;
            }

            // 🔧 修复：使用预览元素创建面板，保持一致性
            const panelButton = this.createPreviewPanelElement(panelType, 'panel');
            if (!panelButton) {
                console.error(`[InfoBarSettings] ❌ 创建面板预览元素失败: ${panelType}`);
                return;
            }
            
            // 绑定点击事件（如果需要的话）
            panelButton.addEventListener('click', () => {
                this.showDemoPanelPopup(panelType);
            });

            // 根据位置插入
            if (position === 'top') {
                embeddedPanels.insertBefore(panelButton, embeddedPanels.firstChild);
            } else {
                embeddedPanels.appendChild(panelButton);
            }

            // 将添加的面板写入配置布局
            this.persistFrontendLayout({ type: 'panel', id: panelType }, area);

            // 获取面板名称用于日志
            const config = this.getPanelDisplayInfo(panelType, panelConfig);
            console.log(`[InfoBarSettings] ✅ 面板 ${config.name} 已添加到预览`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 添加面板到预览失败:', error);
        }
    }

    /**
     * 添加子项到预览
     */
    addSubitemToPreview(fieldType, area, position) {
        try {
            console.log(`[InfoBarSettings] 🔧 添加子项到预览: ${fieldType} (区域: ${area}, 位置: ${position})`);
            
            // 根据区域选择正确的容器
            const containerClass = area === 'top' ? '.top-embedded-panels' : '.bottom-embedded-panels';
            const embeddedPanels = this.modal?.querySelector(containerClass);
            if (!embeddedPanels) {
                console.error(`[InfoBarSettings] ❌ 未找到${area}区域的嵌入面板容器`);
                return;
            }

            // 动态获取子项显示名称
            const displayName = this.getSubitemDisplayName(fieldType);
            const config = { 
                field: displayName, 
                value: this.getSubitemDemoValue(fieldType, displayName) 
            };

            // 🔧 修复：使用预览元素创建子项，保持一致性
            const subitemDisplay = this.createPreviewPanelElement(fieldType, 'subitem');
            if (!subitemDisplay) {
                console.error(`[InfoBarSettings] ❌ 创建子项预览元素失败: ${fieldType}`);
                return;
            }

            // 根据位置插入
            if (position === 'top') {
                embeddedPanels.insertBefore(subitemDisplay, embeddedPanels.firstChild);
            } else {
                embeddedPanels.appendChild(subitemDisplay);
            }

            // 将添加的子项写入配置布局
            const resolvedId = this.resolveFieldQualifiedId(fieldType);
            this.persistFrontendLayout({ type: 'subitem', id: resolvedId }, area);

            console.log(`[InfoBarSettings] ✅ 子项 ${config.field} 已添加到预览`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 添加子项到预览失败:', error);
        }
    }
    /**
     * 获取子项显示名称
     */
    getSubitemDisplayName(fieldKey) {
        try {
            // 🔧 修复：处理完整ID格式（panel.field）和简单字段名
            let targetPanelId = null;
            let targetFieldKey = fieldKey;
            
            if (fieldKey.includes('.')) {
                [targetPanelId, targetFieldKey] = fieldKey.split('.');
            }
            
            const enabledPanels = this.getEnabledPanels();
            
            // 如果指定了面板ID，只在该面板中查找
            if (targetPanelId && enabledPanels[targetPanelId]) {
                const subItems = this.getEnabledSubItems(targetPanelId, enabledPanels[targetPanelId]);
                const foundSubItem = subItems.find(item => item.key === targetFieldKey);
                
                if (foundSubItem) {
                    return foundSubItem.displayName;
                }
                
                // 如果在指定面板中没找到，尝试从完整映射中获取
                const completeMapping = this.getCompleteDisplayNameMapping();
                if (completeMapping[targetPanelId] && completeMapping[targetPanelId][targetFieldKey]) {
                    return completeMapping[targetPanelId][targetFieldKey];
                }
            } else {
                // 如果没有指定面板ID，在所有面板中查找
                for (const [panelId, panelConfig] of Object.entries(enabledPanels)) {
                    const subItems = this.getEnabledSubItems(panelId, panelConfig);
                    const foundSubItem = subItems.find(item => item.key === targetFieldKey);
                    
                    if (foundSubItem) {
                        return foundSubItem.displayName;
                    }
                }
            }

            // 如果没找到，返回字段键名
            return targetFieldKey;

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 获取子项显示名称失败:', error);
            return fieldKey;
        }
    }

    /**
     * 获取子项演示值
     */
    getSubitemDemoValue(fieldKey, displayName) {
        // 根据字段类型返回合适的演示值
        const demoValues = {
            // 个人信息相关
            'name': '张三',
            'age': '25岁', 
            'gender': '男',
            'occupation': '冒险者',
            'level': 'Lv.15',
            'experience': '2847/3000',
            'health': '良好',
            'mood': '愉快',
            
            // 交互对象相关
            'npc_name': '艾莉丝',
            'relationship': '朋友',
            'attitude': '友好',
            'favorability': '70/100',
            'emotion': '高兴',
            
            // 世界信息相关
            'location': '艾尔登城',
            'time': '上午10点',
            'weather': '晴朗',
            'environment': '城市街道',
            'atmosphere': '繁忙',
            
            // 背包相关
            'gold': '1,247枚',
            'weapon': '银剑',
            'armor': '皮甲',
            'items': '生命药水 x3',
            'consumables': '面包 x5'
        };

        // 如果有预设值，使用预设值
        if (demoValues[fieldKey]) {
            return demoValues[fieldKey];
        }

        // 根据显示名称推测合适的值
        if (displayName.includes('名称') || displayName.includes('姓名')) {
            return '示例名称';
        } else if (displayName.includes('等级') || displayName.includes('级别')) {
            return 'Lv.1';
        } else if (displayName.includes('数量')) {
            return '5';
        } else if (displayName.includes('状态')) {
            return '正常';
        } else {
            return '示例值';
        }
    }

    /**
     * 清空预览内容
     */
    clearPreviewContent() {
        try {
            console.log('[InfoBarSettings] 🧹 清空预览内容');
            
            let totalCleared = 0;
            
            // 清空顶部区域
            const topEmbeddedPanels = this.modal?.querySelector('.top-embedded-panels');
            if (topEmbeddedPanels) {
                const topDynamicElements = topEmbeddedPanels.querySelectorAll('.panel-button:not(.demo), .subitem-display:not(.demo)');
                topDynamicElements.forEach(element => element.remove());
                totalCleared += topDynamicElements.length;
                console.log(`[InfoBarSettings] 🔝 已清空顶部区域 ${topDynamicElements.length} 个动态元素`);
            }

            // 清空底部区域
            const bottomEmbeddedPanels = this.modal?.querySelector('.bottom-embedded-panels');
            if (bottomEmbeddedPanels) {
                const bottomDynamicElements = bottomEmbeddedPanels.querySelectorAll('.panel-button:not(.demo), .subitem-display:not(.demo)');
                bottomDynamicElements.forEach(element => element.remove());
                totalCleared += bottomDynamicElements.length;
                console.log(`[InfoBarSettings] 🔽 已清空底部区域 ${bottomDynamicElements.length} 个动态元素`);
            }

            console.log(`[InfoBarSettings] ✅ 总共清空 ${totalCleared} 个动态元素`);

        } catch (error) {
            console.error('[InfoBarSettings] ❌ 清空预览内容失败:', error);
        }
    }

    /**
     * 将添加的面板/子项持久化到前端显示配置
     */
    async persistFrontendLayout(item, area) {
        try {
            console.log(`[InfoBarSettings] 💾 持久化前端布局: ${item.type} ${item.id} 到 ${area}`);
            
            // 使用FrontendDisplayManager的标准读取和保存方法，确保配置一致性
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (!fdm) {
                console.error('[InfoBarSettings] ❌ 未找到前端显示管理器');
                return;
            }

            // 读取当前配置
            const currentConfig = await fdm.getSavedFrontendDisplayConfig();
            console.log('[InfoBarSettings] 📋 当前配置:', currentConfig);

            // 🔧 修复：清理所有数组中的重复项，然后添加新项
            const cleanArray = (arr) => [...new Set(arr || [])];
            
            // 根据类型添加到相应数组
            if (item.type === 'panel') {
                const targetKey = area === 'top' ? 'topPanels' : 'bottomPanels';
                let targetArray = cleanArray(currentConfig[targetKey]);
                if (!targetArray.includes(item.id)) {
                    targetArray.push(item.id);
                    console.log(`[InfoBarSettings] ➕ 添加面板 ${item.id} 到 ${targetKey}`);
                } else {
                    console.log(`[InfoBarSettings] ℹ️ 面板 ${item.id} 已存在于 ${targetKey}，跳过添加`);
                }
                currentConfig[targetKey] = targetArray;
            } else if (item.type === 'subitem') {
                const targetKey = area === 'top' ? 'topSubitems' : 'bottomSubitems';
                let targetArray = cleanArray(currentConfig[targetKey]);
                if (!targetArray.includes(item.id)) {
                    targetArray.push(item.id);
                    console.log(`[InfoBarSettings] ➕ 添加子项 ${item.id} 到 ${targetKey}`);
                } else {
                    console.log(`[InfoBarSettings] ℹ️ 子项 ${item.id} 已存在于 ${targetKey}，跳过添加`);
                }
                currentConfig[targetKey] = targetArray;
            }
 
            // 🔧 修复：清理所有配置数组中的重复项
            currentConfig.topPanels = cleanArray(currentConfig.topPanels);
            currentConfig.bottomPanels = cleanArray(currentConfig.bottomPanels);
            currentConfig.topSubitems = cleanArray(currentConfig.topSubitems);
            currentConfig.bottomSubitems = cleanArray(currentConfig.bottomSubitems);

            // 确保启用状态
            currentConfig.enabled = true;

            // 保存完整配置
            await fdm.saveFrontendDisplayConfig(currentConfig);
            
            console.log('[InfoBarSettings] 💾 已保存前端显示配置:', {
                topPanels: currentConfig.topPanels,
                bottomPanels: currentConfig.bottomPanels,
                topSubitems: currentConfig.topSubitems,
                bottomSubitems: currentConfig.bottomSubitems,
                enabled: currentConfig.enabled
            });

            // 立即更新前端显示
            this.updateFrontendDisplayManagerSettings();
            this.refreshFrontendDisplay();
            
            // 🔧 修复：重新渲染预览
            this.renderFrontendDisplayPreview(currentConfig);
            
        } catch (e) {
            console.error('[InfoBarSettings] ❌ 保存前端显示配置失败:', e);
        }
    }

    /**
     * 刷新前端显示
     */
    refreshFrontendDisplay() {
        try {
            // 获取前端显示管理器
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (fdm) {
                // 检查是否有包装的消息
                const wrappedMessages = document.querySelectorAll('.frontend-message-wrapper');
                if (wrappedMessages.length > 0) {
                    // 只重新渲染最后一个包装的消息
                    const lastWrapper = wrappedMessages[wrappedMessages.length - 1];
                    const messageElement = lastWrapper.querySelector('.ai-message-container .mes');
                    if (messageElement) {
                        fdm.renderLayoutForMessage(messageElement);
                        console.log('[InfoBarSettings] 🔄 已刷新前端显示 (仅渲染布局)');
                    }
                } else {
                    // 如果没有包装的消息，但前端显示已启用，则初始化前端显示
                    if (fdm.enabled) {
                        console.log('[InfoBarSettings] 🔄 没有包装消息，重新初始化前端显示');
                        fdm.initializeFrontendDisplay();
                    } else {
                        console.log('[InfoBarSettings] ⚠️ 前端显示未启用，跳过刷新');
                    }
                }
            }
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 刷新前端显示失败:', error);
        }
    }

    /**
     * 将基础字段键补全为 panel.key 形式
     */
    resolveFieldQualifiedId(fieldKey) {
        try {
            if (fieldKey.includes('.')) return fieldKey;
            
            // 🔧 修复：智能匹配字段到正确的面板
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (fdm) {
                const availableSubItems = fdm.getAvailableSubItems();
                
                // 查找完全匹配的字段
                const exactMatch = availableSubItems.find(item => 
                    item.id.endsWith(`.${fieldKey}`)
                );
                
                if (exactMatch) {
                    console.log(`[InfoBarSettings] 🎯 字段 ${fieldKey} 匹配到: ${exactMatch.id}`);
                    return exactMatch.id;
                }
                
                // 如果没有完全匹配，尝试根据字段名推断面板
                const fieldToPanelMap = {
                    'time': 'world',
                    'listView': 'tasks',
                    'kanbanView': 'tasks',
                    'calendarView': 'tasks',
                    'name': 'personal',
                    '姓名': 'personal',
                    '对象名称': 'interaction',
                    'location': 'world',
                    'mood': 'interaction'
                };
                
                const inferredPanel = fieldToPanelMap[fieldKey];
                if (inferredPanel) {
                    const inferredId = `${inferredPanel}.${fieldKey}`;
                    console.log(`[InfoBarSettings] 🎯 字段 ${fieldKey} 推断为: ${inferredId}`);
                    return inferredId;
                }
            }
            
            // 兜底：尝试从模态框标题获取面板ID（保持原有逻辑）
            const title = this.modal?.querySelector('.subitem-list h4')?.textContent || '';
            const map = [
                { key: '个人信息', id: 'personal' },
                { key: '世界信息', id: 'world' },
                { key: '交互对象', id: 'interaction' },
                { key: '任务', id: 'tasks' },
                { key: '组织', id: 'organization' },
                { key: '新闻', id: 'news' },
                { key: '背包', id: 'inventory' },
                { key: '能力', id: 'abilities' },
                { key: '剧情', id: 'plot' },
                { key: '修炼', id: 'cultivation' },
                { key: '奇幻', id: 'fantasy' },
                { key: '现代', id: 'modern' },
                { key: '历史', id: 'historical' },
                { key: '魔法', id: 'magic' },
                { key: '训练', id: 'training' }
            ];
            const found = map.find(m => title.includes(m.key));
            const result = found ? `${found.id}.${fieldKey}` : fieldKey;
            
            console.log(`[InfoBarSettings] 🎯 字段 ${fieldKey} 通过标题解析为: ${result}`);
            return result;
        } catch (e) {
            console.warn(`[InfoBarSettings] ⚠️ 解析字段ID失败: ${fieldKey}`, e);
            return fieldKey;
        }
    }

    /**
     * 🔧 新增：渲染前端显示预览内容
     * 根据配置重新渲染预览区域的面板和子项
     */
    renderFrontendDisplayPreview(config) {
        try {
            console.log('[InfoBarSettings] 🎨 渲染前端显示预览:', config);
            
            if (!config) {
                console.warn('[InfoBarSettings] ⚠️ 配置为空，跳过预览渲染');
                return;
            }
            
            // 获取预览容器
            const topContainer = this.modal?.querySelector('.top-embedded-panels');
            const bottomContainer = this.modal?.querySelector('.bottom-embedded-panels');
            
            if (!topContainer || !bottomContainer) {
                console.warn('[InfoBarSettings] ⚠️ 未找到预览容器');
                return;
            }
            
            // 清空现有预览内容
            topContainer.innerHTML = '';
            bottomContainer.innerHTML = '';
            
            // 渲染顶部面板
            if (config.topPanels && Array.isArray(config.topPanels)) {
                config.topPanels.forEach(panelId => {
                    const panelElement = this.createPreviewPanelElement(panelId, 'panel');
                    if (panelElement) {
                        topContainer.appendChild(panelElement);
                    }
                });
            }
            
            // 🔧 修复：限制顶部子项显示数量，避免预览过于拥挤
            if (config.topSubitems && Array.isArray(config.topSubitems)) {
                // 只显示前3个子项，其余用省略号表示
                const maxSubitems = 3;
                const subitems = config.topSubitems.slice(0, maxSubitems);
                
                subitems.forEach(subitemId => {
                    const subitemElement = this.createPreviewPanelElement(subitemId, 'subitem');
                    if (subitemElement) {
                        topContainer.appendChild(subitemElement);
                    }
                });
                
                // 如果有更多子项，显示省略提示
                if (config.topSubitems.length > maxSubitems) {
                    const moreElement = document.createElement('div');
                    moreElement.className = 'preview-more-indicator';
                    moreElement.innerHTML = `
                        <span class="preview-item-name">⋯ 还有${config.topSubitems.length - maxSubitems}个子项</span>
                    `;
                    topContainer.appendChild(moreElement);
                }
            }
            
            // 渲染底部面板
            if (config.bottomPanels && Array.isArray(config.bottomPanels)) {
                config.bottomPanels.forEach(panelId => {
                    const panelElement = this.createPreviewPanelElement(panelId, 'panel');
                    if (panelElement) {
                        bottomContainer.appendChild(panelElement);
                    }
                });
            }
            
            // 🔧 修复：限制底部子项显示数量，避免预览过于拥挤
            if (config.bottomSubitems && Array.isArray(config.bottomSubitems)) {
                // 只显示前3个子项，其余用省略号表示
                const maxSubitems = 3;
                const subitems = config.bottomSubitems.slice(0, maxSubitems);
                
                subitems.forEach(subitemId => {
                    const subitemElement = this.createPreviewPanelElement(subitemId, 'subitem');
                    if (subitemElement) {
                        bottomContainer.appendChild(subitemElement);
                    }
                });
                
                // 如果有更多子项，显示省略提示
                if (config.bottomSubitems.length > maxSubitems) {
                    const moreElement = document.createElement('div');
                    moreElement.className = 'preview-more-indicator';
                    moreElement.innerHTML = `
                        <span class="preview-item-name">⋯ 还有${config.bottomSubitems.length - maxSubitems}个子项</span>
                    `;
                    bottomContainer.appendChild(moreElement);
                }
            }
            
            console.log('[InfoBarSettings] ✅ 前端显示预览渲染完成');
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 渲染前端显示预览失败:', error);
        }
    }

    /**
     * 🔧 新增：创建预览面板元素
     * 为预览区域创建面板或子项的显示元素
     */
    createPreviewPanelElement(id, type) {
        try {
            const element = document.createElement('div');
            element.className = type === 'panel' ? 'preview-panel' : 'preview-subitem';
            element.dataset.id = id;
            element.dataset.type = type;
            
            // 获取显示名称（不使用图标，因为前端是按钮UI）
            let displayName = id;
            
            try {
                if (type === 'panel') {
                    // 🔧 修复：面板使用正确的getPanelDisplayInfo函数获取名称
                    const enabledPanels = this.getEnabledPanels();
                    const panelConfig = enabledPanels[id];
                    const panelInfo = this.getPanelDisplayInfo(id, panelConfig);
                    
                    displayName = panelInfo.name || id;
                    
                    console.log(`[InfoBarSettings] 🎨 面板预览元素: ${id} -> ${displayName}`);
                } else {
                    // 🔧 修复：子项需要通过面板映射来获取正确的中文名称
                    displayName = this.getSubitemDisplayName(id) || id;
                    
                    console.log(`[InfoBarSettings] 🎨 子项预览元素: ${id} -> ${displayName}`);
                }
            } catch (error) {
                console.warn('[InfoBarSettings] ⚠️ 获取显示名称失败，使用原始ID:', error);
                displayName = id;
            }
            
            // 🔧 修复：使用按钮样式的预览，模拟真实前端显示
            element.innerHTML = `
                <span class="preview-item-name">${displayName}</span>
                <button class="remove-preview-item" data-id="${id}" data-type="${type}" title="移除">×</button>
            `;
            
            // 添加移除事件
            const removeButton = element.querySelector('.remove-preview-item');
            if (removeButton) {
                removeButton.addEventListener('click', () => {
                    this.removePreviewItem(id, type);
                });
            }
            
            return element;
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 创建预览元素失败:', error);
            return null;
        }
    }

    /**
     * 🔧 新增：移除预览项
     * 从配置和预览中移除指定的面板或子项
     */
    async removePreviewItem(id, type) {
        try {
            console.log(`[InfoBarSettings] 🗑️ 移除预览项: ${type} ${id}`);
            
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (!fdm) {
                console.error('[InfoBarSettings] ❌ 未找到前端显示管理器');
                return;
            }
            
            // 获取当前配置
            const currentConfig = await fdm.getSavedFrontendDisplayConfig();
            
            // 从相应数组中移除项目
            if (type === 'panel') {
                if (currentConfig.topPanels) {
                    currentConfig.topPanels = currentConfig.topPanels.filter(item => item !== id);
                }
                if (currentConfig.bottomPanels) {
                    currentConfig.bottomPanels = currentConfig.bottomPanels.filter(item => item !== id);
                }
            } else if (type === 'subitem') {
                if (currentConfig.topSubitems) {
                    currentConfig.topSubitems = currentConfig.topSubitems.filter(item => item !== id);
                }
                if (currentConfig.bottomSubitems) {
                    currentConfig.bottomSubitems = currentConfig.bottomSubitems.filter(item => item !== id);
                }
            }
            
            // 保存配置
            await fdm.saveFrontendDisplayConfig(currentConfig);
            
            // 重新渲染预览
            this.renderFrontendDisplayPreview(currentConfig);
            
            // 立即更新前端显示
            this.updateFrontendDisplayManagerSettings();
            this.refreshFrontendDisplay();
            
            console.log(`[InfoBarSettings] ✅ 已移除预览项: ${type} ${id}`);
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 移除预览项失败:', error);
        }
    }

    /**
     * 🔧 新增：确保AI消息被包装
     * 检查并触发AI消息包装，用于设置保存后的修复
     */
    ensureAIMessagesWrapped() {
        try {
            console.log('[InfoBarSettings] 🔍 检查AI消息包装状态...');
            
            const fdm = window.SillyTavernInfobar?.modules?.frontendDisplayManager;
            if (!fdm) {
                console.warn('[InfoBarSettings] ⚠️ 未找到前端显示管理器');
                return;
            }
            
            // 检查是否有AI消息
            const aiMessages = document.querySelectorAll('.mes[is_user="false"]');
            console.log(`[InfoBarSettings] 📋 找到 ${aiMessages.length} 条AI消息`);
            
            if (aiMessages.length === 0) {
                console.log('[InfoBarSettings] ℹ️ 没有AI消息需要包装');
                return;
            }
            
            // 检查最后一条AI消息是否已包装
            const lastMessage = aiMessages[aiMessages.length - 1];
            const existingWrapper = lastMessage.previousElementSibling;
            
            if (existingWrapper && existingWrapper.classList.contains('frontend-message-wrapper')) {
                console.log('[InfoBarSettings] ✅ AI消息已正确包装');
                return;
            }
            
            // 没有包装，触发包装
            console.log('[InfoBarSettings] 🔧 AI消息未包装，触发重新包装...');
            
            if (fdm.wrapExistingMessagesWithRetry) {
                fdm.wrapExistingMessagesWithRetry(0);
            } else if (fdm.wrapExistingMessages) {
                fdm.wrapExistingMessages();
            } else {
                console.warn('[InfoBarSettings] ⚠️ 前端显示管理器缺少包装方法');
            }
            
        } catch (error) {
            console.error('[InfoBarSettings] ❌ 检查AI消息包装失败:', error);
        }
    }
}