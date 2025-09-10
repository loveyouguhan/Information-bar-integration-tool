/**
 * NPCManagementPanel
 * 
 * 可视化NPC数据库管理界面：
 * - 列表、搜索、排序
 * - 详细信息与统计
 * - 导入 / 导出
 * - 主题同步（使用信息栏CSS变量）
 */

export class NPCManagementPanel {
    constructor({ npcDatabaseManager, unifiedDataCore, eventSystem } = {}) {
        this.npcDB = npcDatabaseManager || window.SillyTavernInfobar?.modules?.npcDatabaseManager;
        this.dataCore = unifiedDataCore || window.SillyTavernInfobar?.modules?.dataCore;
        this.eventSystem = eventSystem || window.SillyTavernInfobar?.eventSource;

        this.container = null;
        this.visible = false;

        // 状态
        this.searchText = '';
        this.sortBy = 'lastSeen';
        this.order = 'desc';

        // 🚀 新增：同步功能状态
        this.autoSyncEnabled = false;
        this.syncInProgress = false;
        this.lastSyncTime = null;

        // 🌍 新增：世界书同步功能状态
        this.worldBookSyncEnabled = false;
        this.worldBookSyncInProgress = false;
        this.lastWorldBookSyncTime = null;

        // 绑定
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.toggle = this.toggle.bind(this);
        this.render = this.render.bind(this);
        this.renderList = this.renderList.bind(this);
        this.onSearchInput = this.onSearchInput.bind(this);
        this.onSortChange = this.onSortChange.bind(this);
        this.onOrderChange = this.onOrderChange.bind(this);
        this.renderDetails = this.renderDetails.bind(this);
        this.exportDB = this.exportDB.bind(this);
        this.importDB = this.importDB.bind(this);
        
        // 🌍 新增：世界书同步相关方法绑定
        this.syncToWorldBook = this.syncToWorldBook.bind(this);
        this.toggleWorldBookSync = this.toggleWorldBookSync.bind(this);
        this.updateWorldBookSyncUI = this.updateWorldBookSyncUI.bind(this);

        try { this.init(); } catch (e) { console.error('[NPCPanel] 初始化失败', e); }
        
        // 🌍 CSS动画样式注入
        this.injectAnimationStyles();
    }

    init() {
        // 创建容器
        const div = document.createElement('div');
        div.className = 'npc-management-modal';
        div.style.display = 'none';
        div.innerHTML = this.buildHTML();
        document.body.appendChild(div);
        this.container = div;

        // 注册全局模块引用
        if (!window.SillyTavernInfobar) window.SillyTavernInfobar = {};
        if (!window.SillyTavernInfobar.modules) window.SillyTavernInfobar.modules = {};
        window.SillyTavernInfobar.modules.npcManagementPanel = this;

        // 🚀 新增：加载同步设置
        this.loadSyncSettings();

        // 事件绑定
        this.container.addEventListener('click', (e) => {
            const close = e.target.closest('[data-action="close"]');
            if (close) { this.hide(); return; }
            const exportBtn = e.target.closest('[data-action="export"]');
            if (exportBtn) { this.exportDB(); return; }
            const importBtn = e.target.closest('[data-action="import"]');
            if (importBtn) { this.importDB(); return; }
            // 🚀 新增：同步功能按钮
            const toggleSyncBtn = e.target.closest('[data-action="toggle-sync"]');
            if (toggleSyncBtn) { this.toggleAutoSync(); return; }
            const syncNowBtn = e.target.closest('[data-action="sync-now"]');
            if (syncNowBtn) { this.syncNow(); return; }
            // 🌍 新增：世界书同步功能按钮
            const toggleWorldBookSyncBtn = e.target.closest('[data-action="toggle-worldbook-sync"]');
            if (toggleWorldBookSyncBtn) { this.toggleWorldBookSync(); return; }
              const worldBookSyncNowBtn = e.target.closest('[data-action="worldbook-sync-now"]');
              if (worldBookSyncNowBtn) { this.syncToWorldBook(); return; }
              const worldBookCleanupBtn = e.target.closest('[data-action="worldbook-cleanup"]');
              if (worldBookCleanupBtn) { this.cleanupDuplicateWorldBookEntries(); return; }
              // 🆕 删除NPC按钮
              const deleteBtn = e.target.closest('[data-action="delete-npc"]');
            if (deleteBtn) {
                const npcId = deleteBtn.dataset.npcId;
                this.deleteNpc(npcId);
                return;
            }
            const row = e.target.closest('.npc-row');
            if (row) {
                const id = row.dataset.id;
                this.renderDetails(id);
                return;
            }
        });
        this.container.addEventListener('input', (e) => {
            if (e.target.matches('[data-field="search"]')) this.onSearchInput(e);
        });
        this.container.addEventListener('change', (e) => {
            if (e.target.matches('[data-field="sortBy"]')) this.onSortChange(e);
            if (e.target.matches('[data-field="order"]')) this.onOrderChange(e);
        });

        // 主题样式
        this.injectStyles();

        // 监听数据库事件自动刷新
        this.eventSystem?.on?.('npc:db:updated', () => this.renderList());
        this.eventSystem?.on?.('npc:db:saved', () => this.renderList());
        this.eventSystem?.on?.('npc:updated', () => this.renderList());

        // 🔧 修复：监听聊天切换事件，确保数据隔离
        this.eventSystem?.on?.('chat:changed', () => {
            console.log('[NPCPanel] 🔄 检测到聊天切换，刷新NPC列表');
            // 🔧 修复：总是刷新数据，无论界面是否可见
            setTimeout(async () => {
                if (this.visible) {
                    this.render(); // 重新渲染整个界面
                }
                // 🚀 强制刷新列表数据以确保下次打开时显示正确
                await this.forceRefreshData();
            }, 100); // 小延迟确保数据库已经切换完成
        });

        // 🔧 修复：监听NPC数据库重新加载事件
        this.eventSystem?.on?.('npc:db:reloaded', () => {
            console.log('[NPCPanel] 🔄 NPC数据库已重新加载，刷新界面');
            if (this.visible) {
                this.render();
            }
        });

        // 🔧 修复：监听NPC数据库保存事件，确保实时同步
        this.eventSystem?.on?.('npc:db:saved', () => {
            console.log('[NPCPanel] 💾 NPC数据库已保存，刷新显示');
            if (this.visible) {
                this.renderList();
            }
        });
    }

    buildHTML() {
        return `
        <div class="modal-overlay" data-action="close"></div>
        <div class="modal-container" style="background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e)); border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
            <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));">
                <div style="display:flex;gap:8px;align-items:center;">
                    <span style="font-weight:700;">NPC 数据库管理</span>
                    <span class="count" style="opacity:.7;font-size:12px;"></span>
                </div>
                <button class="close-btn" data-action="close" style="background:transparent;border:none;color:inherit;font-size:18px;cursor:pointer;">×</button>
            </div>
            <div class="modal-body" style="display:flex;gap:12px;padding:12px;">
                <div class="left" style="flex: 0 0 360px; display:flex; flex-direction:column; gap:8px;">
                    <div class="toolbar" style="display:flex; gap:8px; align-items:center;">
                        <input data-field="search" placeholder="搜索NPC名称..." style="flex:1; padding:6px 8px; background: var(--SmartThemeSurfaceColor, #111); color: var(--SmartThemeTextColor, #ddd); border: 1px solid var(--SmartThemeBorderColor, #333); border-radius: 4px;" />
                        <select data-field="sortBy" style="padding:6px 8px; background: var(--SmartThemeSurfaceColor, #111); color: var(--SmartThemeTextColor, #ddd); border: 1px solid var(--SmartThemeBorderColor, #333); border-radius: 4px;">
                            <option value="lastSeen">最近出现</option>
                            <option value="appearCount">出现次数</option>
                            <option value="name">名称</option>
                        </select>
                        <select data-field="order" style="padding:6px 8px; background: var(--SmartThemeSurfaceColor, #111); color: var(--SmartThemeTextColor, #ddd); border: 1px solid var(--SmartThemeBorderColor, #333); border-radius: 4px;">
                            <option value="desc">降序</option>
                            <option value="asc">升序</option>
                        </select>
                    </div>

                    <!-- 🚀 新增：同步数据滑动块 -->
                    <div class="sync-panel" style="
                        background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                        border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                        border-radius: 6px;
                        padding: 8px;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        transition: all 0.3s ease;
                    ">
                        <!-- 数据同步行 -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 12px; color: var(--theme-text-secondary, #999);">数据同步</span>
                            <div class="sync-toggle" style="
                                position: relative;
                                width: 40px;
                                height: 20px;
                                background: var(--theme-bg-primary, #333);
                                border-radius: 10px;
                                cursor: pointer;
                                transition: background-color 0.3s ease;
                                border: 1px solid var(--theme-border-color, #555);
                            " data-action="toggle-sync">
                                <div class="sync-slider" style="
                                    position: absolute;
                                    top: 1px;
                                    left: 1px;
                                    width: 16px;
                                    height: 16px;
                                    background: var(--theme-text-primary, #ddd);
                                    border-radius: 50%;
                                    transition: transform 0.3s ease;
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                                "></div>
                            </div>
                            <span class="sync-status" style="font-size: 11px; color: var(--theme-text-secondary, #999);">关闭</span>
                        </div>
                        <button class="sync-now-btn" data-action="sync-now" style="
                            padding: 4px 8px;
                            font-size: 11px;
                            background: var(--theme-accent-color, #007bff);
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            opacity: 0.8;
                        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                            <span class="sync-icon">🔄</span> 立即同步
                        </button>
                        </div>
                        
                        <!-- 🌍 新增：世界书同步行 -->
                        <div style="display: flex; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px solid var(--theme-border-color, rgba(255,255,255,0.1));">
                            <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 12px; color: var(--theme-text-secondary, #999);">同步世界书</span>
                                <div class="worldbook-sync-toggle" style="
                                    position: relative;
                                    width: 40px;
                                    height: 20px;
                                    background: var(--theme-bg-primary, #333);
                                    border-radius: 10px;
                                    cursor: pointer;
                                    transition: background-color 0.3s ease;
                                    border: 1px solid var(--theme-border-color, #555);
                                " data-action="toggle-worldbook-sync">
                                    <div class="worldbook-sync-slider" style="
                                        position: absolute;
                                        top: 1px;
                                        left: 1px;
                                        width: 16px;
                                        height: 16px;
                                        background: var(--theme-text-primary, #ddd);
                                        border-radius: 50%;
                                        transition: transform 0.3s ease;
                                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                                    "></div>
                                </div>
                                <span class="worldbook-sync-status" style="font-size: 11px; color: var(--theme-text-secondary, #999);">关闭</span>
                            </div>
                             <button class="worldbook-sync-now-btn" data-action="worldbook-sync-now" style="
                                 padding: 4px 8px;
                                 font-size: 11px;
                                 background: var(--theme-accent-color, #28a745);
                                 color: white;
                                 border: none;
                                 border-radius: 4px;
                                 cursor: pointer;
                                 transition: all 0.2s ease;
                                 opacity: 0.8;
                                 margin-right: 4px;
                             " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                                 <span class="worldbook-sync-icon">📚</span> 同步到世界书
                             </button>
                             <button class="worldbook-cleanup-btn" data-action="worldbook-cleanup" style="
                                 padding: 4px 8px;
                                 font-size: 11px;
                                 background: var(--theme-warning-color, #ff6b35);
                                 color: white;
                                 border: none;
                                 border-radius: 4px;
                                 cursor: pointer;
                                 transition: all 0.2s ease;
                                 opacity: 0.8;
                             " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="清理重复的世界书条目">
                                 <span class="worldbook-cleanup-icon">🧹</span> 清理重复
                             </button>
                        </div>
                    </div>

                    <div class="list" style="background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); border-radius:6px;"></div>
                </div>
                <div class="right" style="flex:1; border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); border-radius: 6px; min-height: 240px; max-height: 60vh; padding: 8px; background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); overflow-y: auto; display: flex; flex-direction: column;">
                    <div class="detail-placeholder" style="opacity:.7; font-size:12px; padding: 10px; color: var(--SmartThemeTextColor, #ddd); flex: 1; display: flex; align-items: center; justify-content: center;">选择左侧NPC以查看详情</div>
                    <div class="details" style="display:none; color: var(--SmartThemeTextColor, #ddd); overflow-y: auto;"></div>
                </div>
            </div>
            <div class="modal-footer" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-top:1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                <div style="display:flex; gap:8px;">
                    <button data-action="export" class="btn" style="padding:6px 10px;border:1px solid var(--theme-border-color, var(--SmartThemeBorderColor,#333));background:var(--theme-bg-secondary, var(--SmartThemeSurfaceColor,#111));color:var(--theme-text-primary, var(--SmartThemeTextColor,#ddd));border-radius:4px;">导出</button>
                    <button data-action="import" class="btn" style="padding:6px 10px;border:1px solid var(--theme-border-color, var(--SmartThemeBorderColor,#333));background:var(--theme-bg-secondary, var(--SmartThemeSurfaceColor,#111));color:var(--theme-text-primary, var(--SmartThemeTextColor,#ddd));border-radius:4px;">导入</button>
                </div>
                <textarea class="import-area" placeholder="在此粘贴导入的JSON..." style="flex:1; margin-left:8px; min-height:36px; max-height:120px; background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); border-radius: 4px;"></textarea>
            </div>
        </div>`;
    }

    injectStyles() {
        const id = 'npc-management-styles';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
        .npc-management-modal { position: fixed; inset: 0; z-index: 999999; }
        .npc-management-modal .modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.35); }
        .npc-management-modal .modal-container {
            position: relative;
            width: 960px;
            max-width: 95vw;
            max-height: 90vh;
            margin: 5vh auto;
            border-radius: 8px;
            box-shadow: 0 8px 40px rgba(0,0,0,.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .npc-management-modal .modal-body {
            flex: 1;
            overflow: hidden;
            display: flex;
            gap: 12px;
            padding: 12px;
            min-height: 0;
        }
        .npc-management-modal .left {
            flex: 0 0 360px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 0;
        }
        .npc-management-modal .list {
            flex: 1;
            overflow-y: auto;
            min-height: 200px;
        }
        .npc-management-modal .right {
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }
        .npc-management-modal .list .npc-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); cursor: pointer; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); }
        .npc-management-modal .list .npc-row:hover { background: var(--theme-bg-hover, var(--SmartThemeQuoteColor, rgba(255,255,255,.03))); }
        .npc-management-modal .list .npc-name { font-weight:600; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); }
        .npc-management-modal .list .npc-meta { opacity:.7; font-size: 12px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa)); }
        .npc-management-modal .kv { display:grid; grid-template-columns: 120px 1fr; gap: 6px 10px; }
        .npc-management-modal .badge { display:inline-block; padding: 2px 6px; border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor,#333)); border-radius: 10px; font-size: 11px; opacity:.8; color: var(--theme-text-primary, var(--SmartThemeTextColor,#ddd)); background: var(--theme-bg-primary, transparent); }

        /* 🔧 移动端适配 */
        @media (max-width: 768px) {
            .npc-management-modal .modal-container {
                width: 100vw;
                height: 100vh;
                margin: 0;
                border-radius: 0;
                max-height: 100vh;
            }
            .npc-management-modal .modal-body {
                flex-direction: column;
                gap: 8px;
                padding: 8px;
            }
            .npc-management-modal .left {
                flex: 0 0 auto;
                max-height: 40vh;
            }
            .npc-management-modal .right {
                flex: 1;
                min-height: 200px;
            }
        }
        `;
        document.head.appendChild(style);
    }

    show() {
        if (!this.container) return;
        this.visible = true;
        this.container.style.display = '';

        // 🔧 修复：显示时强制刷新数据，确保显示当前聊天的NPC
        console.log('[NPCPanel] 📂 面板打开，刷新当前聊天的NPC数据');

        // 🚀 异步刷新数据，不阻塞界面显示
        this.forceRefreshData().then(() => {
            this.render();
            // 🚀 新增：更新同步UI状态
            this.updateSyncUI();
        }).catch(error => {
            console.error('[NPCPanel] ❌ 打开面板时刷新数据失败:', error);
            this.render(); // 即使刷新失败也要显示界面
            this.updateSyncUI();
        });
    }

    /**
     * 🚀 新增：加载同步设置
     */
    loadSyncSettings() {
        try {
            const savedAutoSync = localStorage.getItem('npcPanel_autoSync');
            if (savedAutoSync !== null) {
                this.autoSyncEnabled = savedAutoSync === 'true';
                console.log('[NPCPanel] 📂 加载同步设置:', this.autoSyncEnabled ? '开启' : '关闭');
            }
        } catch (error) {
            console.error('[NPCPanel] ❌ 加载同步设置失败:', error);
        }
    }

    hide() {
        if (!this.container) return;
        this.visible = false;
        this.container.style.display = 'none';
    }

    toggle() { this.visible ? this.hide() : this.show(); }

    /**
     * 🔧 强制刷新数据 - 确保下次打开时显示正确的聊天数据
     */
    async forceRefreshData() {
        try {
            // 🚀 强制NPC数据库重新加载当前聊天的数据
            if (this.npcDB && typeof this.npcDB.load === 'function') {
                const currentChatId = this.npcDB.getCurrentChatId();
                console.log('[NPCPanel] 🔄 强制刷新数据，当前聊天ID:', currentChatId);

                // 🚀 重新加载数据库，确保获取当前聊天的最新数据
                await this.npcDB.load();

                console.log('[NPCPanel] ✅ NPC数据库已重新加载，NPC数量:', Object.keys(this.npcDB.db?.npcs || {}).length);

                // 如果界面当前可见，立即刷新列表
                if (this.visible) {
                    this.renderList();
                }
            }
        } catch (error) {
            console.error('[NPCPanel] ❌ 强制刷新数据失败:', error);
        }
    }

    /**
     * 🚀 新增：切换自动同步功能
     */
    toggleAutoSync() {
        this.autoSyncEnabled = !this.autoSyncEnabled;
        console.log('[NPCPanel] 🔄 自动同步状态:', this.autoSyncEnabled ? '开启' : '关闭');

        // 更新UI状态
        this.updateSyncUI();

        // 保存设置到本地存储
        localStorage.setItem('npcPanel_autoSync', this.autoSyncEnabled.toString());

        // 如果开启自动同步，立即执行一次同步
        if (this.autoSyncEnabled) {
            this.syncNow();
        }

        this.toast(this.autoSyncEnabled ? '自动同步已开启' : '自动同步已关闭');
    }

    /**
     * 🚀 新增：立即同步数据
     */
    async syncNow() {
        if (this.syncInProgress) {
            this.toast('同步正在进行中...');
            return;
        }

        try {
            this.syncInProgress = true;
            this.updateSyncUI();

            console.log('[NPCPanel] 🔄 开始同步NPC数据...');

            // 获取当前数据表格中的interaction数据
            const unifiedDataCore = this.dataCore || window.InfoBarData;
            if (!unifiedDataCore) {
                throw new Error('无法访问统一数据核心');
            }

            // 获取当前interaction数据
            let interactionData = null;
            if (unifiedDataCore.data && unifiedDataCore.data.has('interaction')) {
                interactionData = unifiedDataCore.data.get('interaction');
            }

            if (!interactionData) {
                throw new Error('当前没有可同步的interaction数据');
            }

            console.log('[NPCPanel] 📊 找到interaction数据，类型:', Array.isArray(interactionData) ? '数组' : '对象');
            console.log('[NPCPanel] 📊 数据长度:', Array.isArray(interactionData) ? interactionData.length : Object.keys(interactionData).length);

            // 使用NPC数据库的提取方法
            if (!this.npcDB) {
                throw new Error('NPC数据库管理器不可用');
            }

            const extractedNpcs = this.npcDB.extractNpcsFromPanels(interactionData);
            console.log('[NPCPanel] 🎯 提取到', extractedNpcs.length, '个NPC');

            if (extractedNpcs.length === 0) {
                throw new Error('没有提取到任何NPC数据');
            }

            // 更新NPC数据库
            let updatedCount = 0;
            const currentChatId = this.npcDB.getCurrentChatId();

            extractedNpcs.forEach(npcData => {
                try {
                    const npc = this.npcDB.ensureNpc(npcData.name);
                    const beforeFields = JSON.stringify(npc.fields);

                    // 🔧 修复：清理和优化字段数据
                    const cleanedFields = this.cleanAndMapFields(npcData.fields);

                    // 合并字段数据
                    npc.fields = this.npcDB.mergeFields(npc.fields, cleanedFields);

                    // 🔧 修复：只在真正有数据变化时才增加计数，避免重复计数
                    const afterFields = JSON.stringify(npc.fields);
                    if (beforeFields !== afterFields) {
                        npc.appearCount = (npc.appearCount || 0) + 1;
                        npc.lastSeen = Date.now();
                        npc.lastChatId = currentChatId;
                        npc.updatedAt = Date.now();
                        updatedCount++;
                        console.log('[NPCPanel] ✅ 同步NPC (有更新):', npcData.name);
                    } else {
                        console.log('[NPCPanel] ℹ️ 同步NPC (无变化):', npcData.name);
                    }

                } catch (error) {
                    console.error('[NPCPanel] ❌ 同步NPC失败:', npcData.name, error);
                }
            });

            // 保存数据库
            await this.npcDB.save();

            this.lastSyncTime = Date.now();

            // 刷新界面
            this.renderList();

            console.log('[NPCPanel] ✅ 同步完成，更新了', updatedCount, '个NPC');
            this.toast(`同步完成！更新了 ${updatedCount} 个NPC`);

        } catch (error) {
            console.error('[NPCPanel] ❌ 同步失败:', error);
            this.toast('同步失败: ' + error.message);
        } finally {
            this.syncInProgress = false;
            this.updateSyncUI();
        }
    }

    /**
     * 🚀 新增：清理和映射字段数据
     */
    cleanAndMapFields(rawFields) {
        if (!rawFields || typeof rawFields !== 'object') {
            return {};
        }

        const cleanedFields = {};

        // 🎯 字段映射表：将col_x格式映射为用户友好的中文字段名
        const fieldMapping = {
            'col_1': 'NPC名称',
            'col_2': '对象类型',
            'col_3': '当前状态',
            'col_4': '关系类型',
            'col_5': '亲密度',
            'col_6': '额外信息1',
            'col_7': '额外信息2',
            'col_8': '额外信息3'
        };

        // 处理所有字段
        Object.keys(rawFields).forEach(key => {
            const value = rawFields[key];

            // 跳过空值和无意义的字段
            if (value === null || value === undefined || value === '') {
                return;
            }

            // 跳过系统字段，但保留有用的元数据
            if (['index', 'source'].includes(key)) {
                return;
            }

            // 映射col_x字段为中文字段名
            if (fieldMapping[key]) {
                cleanedFields[fieldMapping[key]] = String(value).trim();
            } else if (key.startsWith('col_')) {
                // 对于未映射的col_x字段，使用通用名称
                const colNum = key.replace('col_', '');
                cleanedFields[`字段${colNum}`] = String(value).trim();
            } else {
                // 保留其他有意义的字段
                cleanedFields[key] = value;
            }
        });

        // 🔧 确保基本字段存在
        if (!cleanedFields['NPC名称'] && rawFields.col_1) {
            cleanedFields['NPC名称'] = String(rawFields.col_1).trim();
        }

        console.log('[NPCPanel] 🧹 字段清理完成:', Object.keys(cleanedFields));
        return cleanedFields;
    }

    /**
     * 🚀 新增：更新同步UI状态
     */
    updateSyncUI() {
        if (!this.container) return;

        const syncToggle = this.container.querySelector('.sync-toggle');
        const syncSlider = this.container.querySelector('.sync-slider');
        const syncStatus = this.container.querySelector('.sync-status');
        const syncBtn = this.container.querySelector('.sync-now-btn');
        const syncIcon = this.container.querySelector('.sync-icon');

        if (syncToggle && syncSlider && syncStatus) {
            // 更新切换开关状态
            if (this.autoSyncEnabled) {
                syncToggle.style.background = 'var(--theme-accent-color, #007bff)';
                syncSlider.style.transform = 'translateX(18px)';
                syncStatus.textContent = '开启';
            } else {
                syncToggle.style.background = 'var(--theme-bg-primary, #333)';
                syncSlider.style.transform = 'translateX(0)';
                syncStatus.textContent = '关闭';
            }
        }

        if (syncBtn && syncIcon) {
            // 更新同步按钮状态
            if (this.syncInProgress) {
                syncBtn.disabled = true;
                syncBtn.style.opacity = '0.6';
                syncIcon.style.animation = 'spin 1s linear infinite';
                syncBtn.innerHTML = '<span class="sync-icon" style="animation: spin 1s linear infinite;">🔄</span> 同步中...';
            } else {
                syncBtn.disabled = false;
                syncBtn.style.opacity = '0.8';
                syncIcon.style.animation = '';
                syncBtn.innerHTML = '<span class="sync-icon">🔄</span> 立即同步';
            }
        }

        // 添加旋转动画样式
        if (!document.querySelector('#npc-sync-styles')) {
            const style = document.createElement('style');
            style.id = 'npc-sync-styles';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    onSearchInput(e) {
        this.searchText = e.target.value || '';
        this.renderList();
    }

    onSortChange(e) {
        this.sortBy = e.target.value;
        this.renderList();
    }

    onOrderChange(e) {
        this.order = e.target.value;
        this.renderList();
    }

    render() {
        // 初始化控件状态
        const sortSel = this.container.querySelector('[data-field="sortBy"]');
        const orderSel = this.container.querySelector('[data-field="order"]');
        const searchInp = this.container.querySelector('[data-field="search"]');
        if (sortSel) sortSel.value = this.sortBy;
        if (orderSel) orderSel.value = this.order;
        if (searchInp) searchInp.value = this.searchText;

        this.renderList();
    }

    renderList() {
        const list = this.container.querySelector('.list');
        if (!list || !this.npcDB) return;
        const npcs = this.npcDB.search({ q: this.searchText, sortBy: this.sortBy, order: this.order });
        this.container.querySelector('.count').textContent = `共 ${npcs.length} 个`;
        if (!npcs.length) {
            list.innerHTML = `<div style="padding: 16px; opacity:.7; font-size: 12px;">暂无数据</div>`;
            this.renderDetails(null);
            return;
        }
        list.innerHTML = npcs.map(n => `
            <div class="npc-row" data-id="${n.id}">
                <div>
                    <div class="npc-name">${this.escape(n.name || '')}</div>
                    <div class="npc-meta">ID: ${n.id} · 出现次数: ${n.appearCount || 0} · 最近: ${this.formatTime(n.lastSeen)}</div>
                </div>
                <div>
                    <span class="badge">${(n.fields?.type || n.fields?.类型 || n.fields?.npc_type || '未知类型')}</span>
                </div>
            </div>
        `).join('');
    }

    renderDetails(id) {
        const placeholder = this.container.querySelector('.detail-placeholder');
        const panel = this.container.querySelector('.details');
        if (!id) {
            if (panel) panel.style.display = 'none';
            if (placeholder) placeholder.style.display = '';
            return;
        }
        const npc = this.npcDB?.db?.npcs?.[id];
        if (!npc) return;
        if (placeholder) placeholder.style.display = 'none';
        if (panel) {
            panel.style.display = '';
            const fields = npc.fields || {};
            const fieldsHTML = Object.keys(fields).length ? `
                <div class="kv">
                    ${Object.entries(fields).map(([k,v]) => `
                        <div style="opacity:.8;">${this.escape(k)}</div>
                        <div style="white-space: pre-wrap;">${this.escape(String(v))}</div>
                    `).join('')}
                </div>
            ` : `<div style="opacity:.7; font-size:12px;">无字段</div>`;

            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-weight:700;">${this.escape(npc.name)} <span class="badge" title="唯一ID">${npc.id}</span></div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <div style="font-size:12px; opacity:.8;">最后出现: ${this.formatTime(npc.lastSeen)}</div>
                        <button
                            data-action="delete-npc"
                            data-npc-id="${npc.id}"
                            class="delete-npc-btn"
                            style="
                                background: var(--theme-bg-danger, #dc3545);
                                color: white;
                                border: none;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 11px;
                                cursor: pointer;
                                opacity: 0.8;
                                transition: opacity 0.2s;
                            "
                            onmouseover="this.style.opacity='1'"
                            onmouseout="this.style.opacity='0.8'"
                            title="删除此NPC"
                        >删除</button>
                    </div>
                </div>
                <div style="display:flex; gap: 16px; margin-bottom: 10px;">
                    <div class="badge">出现次数 ${npc.appearCount || 0}</div>
                    <div class="badge">最后消息 ${npc.lastMessageId || '-'}</div>
                    <div class="badge">最后聊天 ${npc.lastChatId || '-'}</div>
                    <div class="badge">创建时间 ${this.formatTime(npc.createdAt)}</div>
                </div>
                <div>${fieldsHTML}</div>
            `;
        }
    }

    exportDB() {
        try {
            const json = this.npcDB?.export?.() || '{}';
            // 复制到剪贴板
            navigator.clipboard?.writeText(json).then(() => {
                this.toast('已复制到剪贴板');
            }).catch(() => {
                // 回退：填充到文本域
                const ta = this.container.querySelector('.import-area');
                if (ta) { ta.value = json; this.toast('已填充到下方文本框'); }
            });
        } catch (e) {
            console.error('[NPCPanel] 导出失败', e);
            this.toast('导出失败');
        }
    }

    async importDB() {
        try {
            const ta = this.container.querySelector('.import-area');
            if (!ta) return;
            const text = ta.value.trim();
            if (!text) { this.toast('请粘贴JSON'); return; }
            await this.npcDB.import(text);
            this.toast('导入成功');
            this.renderList();
        } catch (e) {
            console.error('[NPCPanel] 导入失败', e);
            this.toast('导入失败: ' + e.message);
        }
    }

    /**
     * 🆕 删除NPC
     * @param {string} npcId - NPC ID
     */
    async deleteNpc(npcId) {
        try {
            if (!npcId || !this.npcDB) {
                console.error('[NPCPanel] ❌ 无效的NPC ID或数据库管理器');
                return;
            }

            const npc = this.npcDB.db?.npcs?.[npcId];
            if (!npc) {
                console.error('[NPCPanel] ❌ NPC不存在:', npcId);
                return;
            }

            // 显示确认对话框
            const confirmed = await this.showDeleteConfirmDialog(npc);
            if (!confirmed) {
                console.log('[NPCPanel] ℹ️ 用户取消删除操作');
                return;
            }

            // 执行删除
            const success = await this.npcDB.deleteNpc(npcId);
            if (success) {
                console.log('[NPCPanel] ✅ NPC删除成功:', npcId);

                // 刷新界面
                this.renderList();
                this.renderDetails(null); // 清空详情面板

                // 显示成功提示
                this.toast(`NPC "${npc.name}" 已成功删除`);
            } else {
                console.error('[NPCPanel] ❌ NPC删除失败:', npcId);
                this.toast('删除失败，请重试');
            }

        } catch (error) {
            console.error('[NPCPanel] ❌ 删除NPC时发生错误:', error);
            this.toast('删除失败: ' + error.message);
        }
    }

    /**
     * 🆕 显示删除确认对话框
     * @param {Object} npc - NPC对象
     * @returns {Promise<boolean>} 用户是否确认删除
     */
    async showDeleteConfirmDialog(npc) {
        return new Promise((resolve) => {
            // 创建确认对话框
            const dialog = document.createElement('div');
            dialog.className = 'delete-confirm-dialog';
            dialog.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 1000000;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            dialog.innerHTML = `
                <div style="
                    background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                    border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 400px;
                    width: 90%;
                    color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                        确认删除NPC
                    </h3>
                    <p style="margin: 0 0 20px 0; line-height: 1.5;">
                        您确定要删除NPC "<strong>${this.escape(npc.name)}</strong>" (ID: ${npc.id}) 吗？
                        <br><br>
                        <span style="color: var(--theme-text-warning, #ffc107); font-size: 14px;">
                            ⚠️ 此操作不可撤销，将永久删除该NPC的所有数据。
                        </span>
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="cancel-btn" style="
                            background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                            color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                            border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            background: var(--theme-bg-danger, #dc3545);
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">确认删除</button>
                    </div>
                </div>
            `;

            // 事件处理
            const cleanup = () => {
                document.body.removeChild(dialog);
            };

            dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            dialog.querySelector('.confirm-btn').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            // 点击背景关闭
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    cleanup();
                    resolve(false);
                }
            });

            // ESC键关闭
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleKeyDown);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleKeyDown);

            document.body.appendChild(dialog);
        });
    }

    toast(msg) {
        try {
            const el = document.createElement('div');
            el.textContent = msg;
            el.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 10px;border-radius:4px;z-index:1000000;opacity:.95;font-size:12px;';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1500);
        } catch {}
    }

    formatTime(ts) {
        if (!ts) return '-';
        try { const d = new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; } catch { return '-'; }
    }

    escape(s) {
        return (s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    }

    /**
     * 🌍 新增：更新世界书同步UI状态
     */
    updateWorldBookSyncUI() {
        if (!this.container) return;

        const toggle = this.container.querySelector('.worldbook-sync-toggle');
        const slider = this.container.querySelector('.worldbook-sync-slider');
        const status = this.container.querySelector('.worldbook-sync-status');
        const syncBtn = this.container.querySelector('.worldbook-sync-now-btn');
        const syncIcon = this.container.querySelector('.worldbook-sync-icon');

        if (toggle && slider && status) {
            if (this.worldBookSyncEnabled) {
                toggle.style.background = 'var(--theme-accent-color, #28a745)';
                slider.style.transform = 'translateX(18px)';
                status.textContent = '开启';
            } else {
                toggle.style.background = 'var(--theme-bg-primary, #333)';
                slider.style.transform = 'translateX(0)';
                status.textContent = '关闭';
            }
        }

        if (syncBtn && syncIcon) {
            if (this.worldBookSyncInProgress) {
                syncBtn.disabled = true;
                syncBtn.style.opacity = '0.6';
                syncIcon.style.animation = 'spin 1s linear infinite';
                syncBtn.innerHTML = '<span class="worldbook-sync-icon" style="animation: spin 1s linear infinite;">📚</span> 同步中...';
            } else {
                syncBtn.disabled = false;
                syncBtn.style.opacity = '0.8';
                syncIcon.style.animation = '';
                syncBtn.innerHTML = '<span class="worldbook-sync-icon">📚</span> 同步到世界书';
            }
        }

        // 显示最后同步时间
        if (this.lastWorldBookSyncTime) {
            const timeStr = new Date(this.lastWorldBookSyncTime).toLocaleTimeString();
            status.title = `最后同步到世界书: ${timeStr}`;
        }
    }

    /**
     * 🌍 新增：切换世界书同步开关
     */
    toggleWorldBookSync() {
        this.worldBookSyncEnabled = !this.worldBookSyncEnabled;
        this.updateWorldBookSyncUI();
        
        console.log('[NPCPanel] 🌍 世界书同步开关:', this.worldBookSyncEnabled ? '开启' : '关闭');
        
        if (this.worldBookSyncEnabled) {
            this.toast('世界书同步已开启');
        } else {
            this.toast('世界书同步已关闭');
        }
    }

    /**
     * 🌍 新增：立即同步到世界书
     */
    async syncToWorldBook() {
        if (this.worldBookSyncInProgress) {
            console.log('[NPCPanel] 🌍 世界书同步正在进行中，跳过');
            return;
        }

        try {
            this.worldBookSyncInProgress = true;
            this.updateWorldBookSyncUI();

            console.log('[NPCPanel] 🌍 开始同步NPC数据到世界书...');

            // 获取世界书管理器
            const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
            if (!worldBookManager) {
                throw new Error('世界书管理器未找到，请确保插件已正确加载');
            }

            // 🔒 获取当前聊天的NPC数据（严格聊天隔离）
            const npcs = await this.npcDB.getAllNpcsForCurrentChat();
            if (!npcs || npcs.length === 0) {
                this.toast('当前没有NPC数据可同步');
                return;
            }

            console.log(`[NPCPanel] 🌍 找到 ${npcs.length} 个NPC，开始处理...`);

            // 获取或创建目标世界书
            const worldBookResult = await worldBookManager.getOrCreateTargetWorldBook(true);
            if (!worldBookResult.success) {
                throw new Error(`获取目标世界书失败: ${worldBookResult.error}`);
            }

            const { worldBookName, worldBookData, isNewWorldBook } = worldBookResult;
            console.log(`[NPCPanel] 🌍 使用世界书: ${worldBookName} (${isNewWorldBook ? '新创建' : '现有'})`);

            let syncedCount = 0;

            // 为每个NPC创建或更新世界书条目
            for (const npc of npcs) {
                try {
                    // 格式化NPC数据为世界书条目
                    const entryData = this.formatNPCAsWorldBookEntry(npc);
                    
                     // 🔄 智能创建或更新世界书条目（防重复）
                     const entryResult = await worldBookManager.createOrUpdateWorldBookEntry(worldBookName, worldBookData, entryData);
                     
                     if (entryResult.success) {
                         syncedCount++;
                         const action = entryResult.action === 'updated' ? '已更新' : '已创建';
                         console.log(`[NPCPanel] ✅ NPC "${npc.name}" ${action}到世界书 (ID: ${entryResult.entryId})`);
                     } else {
                         console.warn(`[NPCPanel] ⚠️ NPC "${npc.name}" 同步失败:`, entryResult.error);
                     }
                    
                } catch (error) {
                    console.error(`[NPCPanel] ❌ 处理NPC "${npc.name}" 失败:`, error);
                }
            }

            // 绑定世界书到当前聊天（如果是新创建的）
            if (isNewWorldBook) {
                await worldBookManager.bindWorldBookToChatLore(worldBookName);
            }

            // 刷新世界书缓存
            await worldBookManager.refreshCache();

            this.lastWorldBookSyncTime = Date.now();

            // 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('npc:worldbook-sync-completed', {
                    syncedCount: syncedCount,
                    totalCount: npcs.length,
                    worldBookName: worldBookName,
                    timestamp: Date.now()
                });
            }

            console.log(`[NPCPanel] 🌍 ✅ 世界书同步完成，成功同步 ${syncedCount}/${npcs.length} 个NPC`);
            this.toast(`世界书同步完成！同步了 ${syncedCount} 个NPC到 "${worldBookName}"`);

        } catch (error) {
            console.error('[NPCPanel] ❌ 世界书同步失败:', error);
            this.toast('世界书同步失败: ' + error.message);
        } finally {
            this.worldBookSyncInProgress = false;
            this.updateWorldBookSyncUI();
        }
    }

    /**
     * 🧹 清理重复的世界书条目
     */
    async cleanupDuplicateWorldBookEntries() {
        try {
            console.log('[NPCPanel] 🧹 开始清理重复的世界书条目...');

            // 获取世界书管理器
            const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
            if (!worldBookManager) {
                throw new Error('世界书管理器未找到，请确保插件已正确加载');
            }

            // 获取当前角色的世界书
            const worldBookData = await worldBookManager.getOrCreateTargetWorldBook(false);
            if (!worldBookData.success) {
                throw new Error('无法获取目标世界书: ' + worldBookData.error);
            }

            const { worldBookName, worldBookData: bookData } = worldBookData;

            // 显示确认对话框
            const confirmed = confirm(
                `确认要清理世界书 "${worldBookName}" 中的重复条目吗？\n\n` +
                `此操作将删除重复的NPC条目，只保留最新的版本。\n` +
                `建议在清理前备份重要数据。`
            );

            if (!confirmed) {
                console.log('[NPCPanel] 🚫 用户取消了清理操作');
                return;
            }

            // 显示加载状态
            this.toast('正在清理重复条目...');
            
            // 更新按钮状态
            const cleanupBtn = this.container.querySelector('.worldbook-cleanup-btn');
            if (cleanupBtn) {
                cleanupBtn.disabled = true;
                cleanupBtn.style.opacity = '0.5';
                cleanupBtn.innerHTML = '<span class="worldbook-cleanup-icon">⏳</span> 清理中...';
            }

            // 执行清理
            const cleanupResult = await worldBookManager.deduplicateWorldBookEntries(worldBookName, bookData);

            if (cleanupResult.success) {
                console.log('[NPCPanel] 🧹 ✅ 重复条目清理完成:', cleanupResult.message);
                
                if (cleanupResult.removedCount > 0) {
                    this.toast(`清理完成！删除了 ${cleanupResult.removedCount} 个重复条目`);
                } else {
                    this.toast('没有发现重复条目，无需清理');
                }

                // 触发事件
                this.eventSystem?.emit('npc:worldbook-cleanup-completed', {
                    worldBookName: worldBookName,
                    removedCount: cleanupResult.removedCount,
                    removedEntries: cleanupResult.removedEntries,
                    timestamp: Date.now()
                });

            } else {
                throw new Error(cleanupResult.error || '清理操作失败');
            }

        } catch (error) {
            console.error('[NPCPanel] ❌ 清理重复条目失败:', error);
            this.toast('清理失败: ' + error.message);
        } finally {
            // 恢复按钮状态
            const cleanupBtn = this.container.querySelector('.worldbook-cleanup-btn');
            if (cleanupBtn) {
                cleanupBtn.disabled = false;
                cleanupBtn.style.opacity = '0.8';
                cleanupBtn.innerHTML = '<span class="worldbook-cleanup-icon">🧹</span> 清理重复';
            }
        }
    }

    /**
     * 🌍 新增：格式化NPC数据为世界书条目
     */
    formatNPCAsWorldBookEntry(npc) {
        const entryName = npc.name;
        const keywords = [npc.name];
        
        // 添加可能的别名作为关键词
        if (npc.alias && npc.alias.length > 0) {
            keywords.push(...npc.alias);
        }
        
        // 格式化NPC字段数据为内容
        let content = `# ${npc.name}\n\n`;
        
        // 基础信息
        if (npc.appearCount) {
            content += `**出现次数**: ${npc.appearCount}\n`;
        }
        
        if (npc.lastSeen) {
            const lastSeenDate = new Date(npc.lastSeen).toLocaleString('zh-CN');
            content += `**最后出现**: ${lastSeenDate}\n`;
        }
        
        content += '\n';
        
        // NPC字段数据
        if (npc.fields && Object.keys(npc.fields).length > 0) {
            content += '## 角色信息\n\n';
            
            Object.entries(npc.fields).forEach(([fieldName, value]) => {
                if (value && value.toString().trim()) {
                    // 格式化字段名
                    const displayName = this.getFieldDisplayName(fieldName);
                    content += `**${displayName}**: ${value}\n`;
                }
            });
        }
        
        // 添加数据来源标记
        content += '\n---\n';
        content += `*数据来源: NPC数据库 | 最后更新: ${new Date().toLocaleString('zh-CN')}*`;
        
        return {
            entryName: entryName,
            content: content,
            keywords: keywords,
            order: 100, // 默认优先级
            // 🔧 重要：添加NPC标识信息用于去重匹配
            summaryId: `npc_${npc.id}`,
            summaryType: 'npc',
            summarySource: 'npc_database',
            npcId: npc.id,
            npcName: npc.name,
            sourceType: 'npc_database'
        };
    }

    /**
     * 🎯 获取字段显示名称
     */
    getFieldDisplayName(fieldName) {
        const fieldNameMap = {
            'name': '姓名',
            'age': '年龄', 
            'gender': '性别',
            'occupation': '职业',
            'personality': '性格',
            'appearance': '外貌',
            'background': '背景',
            'relationship': '关系',
            'status': '状态',
            'location': '位置',
            'description': '描述',
            'notes': '备注'
        };
        
        return fieldNameMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
    }

    /**
     * 🎨 注入CSS动画样式
     */
    injectAnimationStyles() {
        if (document.querySelector('#npc-worldbook-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'npc-worldbook-animations';
        style.textContent = `
            .worldbook-sync-now-btn:hover {
                background: var(--theme-accent-color, #218838) !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .worldbook-cleanup-btn:hover {
                background: var(--theme-warning-color, #ff4500) !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            
            .sync-now-btn:hover {
                background: var(--theme-accent-color, #0056b3) !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
        `;
        document.head.appendChild(style);
    }
}

