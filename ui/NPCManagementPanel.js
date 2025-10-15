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

        // 🆕 新增：批量操作状态
        this.selectedNpcIds = new Set();
        this.batchDeleteInProgress = false;

        // 🌍 新增：世界书同步功能状态
        this.worldBookSyncEnabled = false;
        this.worldBookSyncInProgress = false;
        this.lastWorldBookSyncTime = null;

        // 🆕 新增：NPC数据源面板
        this.sourcePanelId = localStorage.getItem('npcPanel_sourcePanel') || 'interaction';

        // 🆕 新增：NPC目标世界书
        this.targetWorldBook = localStorage.getItem('npcPanel_targetWorldBook') || 'auto';

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
        
        // 🆕 新增：批量操作方法绑定
        this.toggleNpcSelection = this.toggleNpcSelection.bind(this);
        this.toggleSelectAll = this.toggleSelectAll.bind(this);
        this.batchDeleteNpcs = this.batchDeleteNpcs.bind(this);
        this.updateBatchOperationUI = this.updateBatchOperationUI.bind(this);
        
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

        // 🚀 新增：监听数据更新事件，实现自动同步
        this.setupAutoSyncListeners();

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
            // 🆕 批量操作：全选/取消全选
            const selectAllBtn = e.target.closest('[data-action="select-all"]');
            if (selectAllBtn) {
                this.toggleSelectAll();
                return;
            }
            // 🆕 批量操作：批量删除
            const batchDeleteBtn = e.target.closest('[data-action="batch-delete"]');
            if (batchDeleteBtn) {
                this.batchDeleteNpcs();
                return;
            }
            // 🆕 批量操作：复选框点击
            const checkbox = e.target.closest('.npc-checkbox');
            if (checkbox) {
                const npcId = checkbox.dataset.npcId;
                this.toggleNpcSelection(npcId);
                e.stopPropagation(); // 阻止触发行点击
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

                    <!-- 🆕 批量操作工具栏 -->
                    <div class="batch-toolbar" style="
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        padding: 6px 8px;
                        background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                        border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                        border-radius: 4px;
                    ">
                        <button 
                            data-action="select-all" 
                            class="select-all-btn"
                            style="
                                padding: 4px 8px;
                                font-size: 11px;
                                background: var(--theme-bg-primary, #333);
                                color: var(--theme-text-primary, #ddd);
                                border: 1px solid var(--theme-border-color, #555);
                                border-radius: 4px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            "
                            onmouseover="this.style.background='var(--theme-bg-hover, #444)'"
                            onmouseout="this.style.background='var(--theme-bg-primary, #333)'"
                        >
                            <span class="select-all-icon">☐</span> 全选
                        </button>
                        <div class="selected-count" style="
                            flex: 1;
                            font-size: 12px;
                            color: var(--theme-text-secondary, #999);
                        ">
                            已选中 <span class="count-number">0</span> 个
                        </div>
                        <button 
                            data-action="batch-delete" 
                            class="batch-delete-btn"
                            disabled
                            style="
                                padding: 4px 8px;
                                font-size: 11px;
                                background: var(--theme-bg-danger, #dc3545);
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                opacity: 0.5;
                            "
                        >
                            🗑️ 批量删除
                        </button>
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
                        <!-- 启用NPC数据库管理行 -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 12px; color: var(--theme-text-secondary, #999);">启用NPC数据库管理</span>
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
                                <span style="font-size: 12px; color: var(--theme-text-secondary, #999);">世界书同步</span>
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
        this.updateWorldBookSyncUI(); // 🌍 更新世界书同步UI
    });
    }

    /**
     * 🚀 新增：加载同步设置
     */
    loadSyncSettings() {
        try {
            // 加载数据同步设置
            const savedAutoSync = localStorage.getItem('npcPanel_autoSync');
            if (savedAutoSync !== null) {
                this.autoSyncEnabled = savedAutoSync === 'true';
                console.log('[NPCPanel] 📂 加载数据同步设置:', this.autoSyncEnabled ? '开启' : '关闭');
            }

            // 加载世界书同步设置
            const savedWorldBookSync = localStorage.getItem('npcPanel_worldBookSync');
            if (savedWorldBookSync !== null) {
                this.worldBookSyncEnabled = savedWorldBookSync === 'true';
                console.log('[NPCPanel] 📂 加载世界书同步设置:', this.worldBookSyncEnabled ? '开启' : '关闭');
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
     * 🚀 新增：设置自动同步监听器
     */
    setupAutoSyncListeners() {
        // 🔧 修复：延迟设置监听器，确保eventSystem完全准备好
        const trySetupListener = (attempt = 1, maxAttempts = 5) => {
            if (!this.eventSystem || typeof this.eventSystem.on !== 'function') {
                if (attempt < maxAttempts) {
                    console.log(`[NPCPanel] ⏳ 事件系统尚未准备好，${attempt}秒后重试 (${attempt}/${maxAttempts})`);
                    setTimeout(() => {
                        // 重新获取eventSystem引用
                        this.eventSystem = this.eventSystem || window.SillyTavernInfobar?.eventSource;
                        trySetupListener(attempt + 1, maxAttempts);
                    }, 1000 * attempt);
                } else {
                    console.error('[NPCPanel] ❌ 事件系统未能在规定时间内准备好，自动同步功能可能无法工作');
                }
                return;
            }

            // 🔧 修复：使用箭头函数确保this上下文正确
            const autoSyncHandler = async (payload) => {
                try {
                    // 🔧 修复：添加详细的调试日志
                    console.log('[NPCPanel] 📡 收到data:updated事件');

                    // 检查是否开启了数据同步
                    if (!this.autoSyncEnabled) {
                        console.log('[NPCPanel] ⏸️ 数据同步已关闭，跳过自动同步');
                        return;
                    }

                    // 🔧 修复：更全面的数据检查，使用用户选择的面板
                    const panelsData = payload?.dataEntry?.data || payload?.panelFields || payload?.data || {};
                    const sourcePanelId = this.sourcePanelId || 'interaction';
                    const panelData = panelsData[sourcePanelId];

                    console.log('[NPCPanel] 🔍 检查用户选择的面板数据:', {
                        sourcePanelId: sourcePanelId,
                        hasDataEntry: !!payload?.dataEntry,
                        hasData: !!panelsData,
                        hasPanelData: !!panelData,
                        panelKeys: panelData ? Object.keys(panelData).length : 0,
                        availablePanels: Object.keys(panelsData)
                    });

                    if (!panelData || Object.keys(panelData).length === 0) {
                        console.log(`[NPCPanel] ℹ️ 没有${sourcePanelId}面板数据更新，跳过自动同步`);
                        return;
                    }

                    console.log(`[NPCPanel] 🔄 检测到${sourcePanelId}面板数据更新，触发自动同步`);

                    // 🔧 修复：延迟执行同步，避免与NPCDatabaseManager冲突
                    setTimeout(async () => {
                        try {
                            // 执行数据同步
                            await this.syncNow();

                            // 如果开启了世界书同步，同步完成后执行世界书同步
                            if (this.worldBookSyncEnabled) {
                                console.log('[NPCPanel] 🌍 数据同步完成，触发自动世界书同步');
                                await this.syncToWorldBook();
                            }
                        } catch (syncError) {
                            console.error('[NPCPanel] ❌ 延迟同步执行失败:', syncError);
                        }
                    }, 500); // 延迟500ms，让NPCDatabaseManager先处理

                } catch (error) {
                    console.error('[NPCPanel] ❌ 自动同步处理失败:', error);
                }
            };

            // 监听data:updated事件，当AI返回更新interaction面板数据时触发
            this.eventSystem.on('data:updated', autoSyncHandler);

            // 🆕 保存监听器引用，以便后续管理
            this.autoSyncHandler = autoSyncHandler;

            console.log('[NPCPanel] ✅ 自动同步监听器已成功设置');
        };

        // 立即尝试设置，如果失败则延迟重试
        trySetupListener();
    }



    /**
     * 🚀 新增：切换自动同步功能
     */
    /**
     * 🆕 设置NPC数据源面板
     */
    setDataSourcePanel(panelId) {
        try {
            console.log('[NPCPanel] 🔄 设置NPC数据源面板:', panelId);
            this.sourcePanelId = panelId;
            
            // 保存到localStorage
            localStorage.setItem('npcPanel_sourcePanel', panelId);
            
            console.log('[NPCPanel] ✅ NPC数据源面板已更新为:', panelId);
        } catch (error) {
            console.error('[NPCPanel] ❌ 设置数据源面板失败:', error);
        }
    }

    /**
     * 🆕 设置NPC目标世界书
     */
    setTargetWorldBook(worldBookName) {
        try {
            console.log('[NPCPanel] 🔄 设置NPC目标世界书:', worldBookName);
            this.targetWorldBook = worldBookName;
            
            // 保存到localStorage
            localStorage.setItem('npcPanel_targetWorldBook', worldBookName);
            
            console.log('[NPCPanel] ✅ NPC目标世界书已更新为:', worldBookName);
        } catch (error) {
            console.error('[NPCPanel] ❌ 设置目标世界书失败:', error);
        }
    }

    toggleAutoSync() {
        this.autoSyncEnabled = !this.autoSyncEnabled;
        console.log('[NPCPanel] 🔄 自动同步状态:', this.autoSyncEnabled ? '开启' : '关闭');

        // 更新UI状态
        this.updateSyncUI();

        // 保存设置到本地存储
        localStorage.setItem('npcPanel_autoSync', this.autoSyncEnabled.toString());

        // 🔧 修复：如果开启自动同步，确保监听器正常工作
        if (this.autoSyncEnabled) {
            // 检查监听器是否已设置
            if (!this.autoSyncHandler || !this.eventSystem) {
                console.log('[NPCPanel] 🔄 重新设置自动同步监听器...');
                this.setupAutoSyncListeners();
            }
            
            // 立即执行一次同步
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

            // 🔧 修复：从指定的数据源面板获取数据
            const sourcePanelId = this.sourcePanelId || 'interaction';
            console.log('[NPCPanel] 📊 NPC数据源面板:', sourcePanelId);

            let panelData = null;
            if (unifiedDataCore.data && unifiedDataCore.data.has(sourcePanelId)) {
                panelData = unifiedDataCore.data.get(sourcePanelId);
            }

            if (!panelData) {
                throw new Error(`当前没有可同步的${sourcePanelId}面板数据`);
            }

            console.log('[NPCPanel] 📊 找到面板数据，类型:', Array.isArray(panelData) ? '数组' : '对象');
            console.log('[NPCPanel] 📊 数据长度:', Array.isArray(panelData) ? panelData.length : Object.keys(panelData).length);

            // 使用NPC数据库的提取方法
            if (!this.npcDB) {
                throw new Error('NPC数据库管理器不可用');
            }

            // 🔧 修复：传递数据源面板ID，让提取方法知道使用哪个面板的字段映射
            const extractedNpcs = this.npcDB.extractNpcsFromPanels(panelData, sourcePanelId);
            console.log('[NPCPanel] 🎯 从面板', sourcePanelId, '提取到', extractedNpcs.length, '个NPC');

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
     * 🚀 新增：清理和映射字段数据（使用动态字段配置）
     * 🔧 修复：保留所有有效字段，包括用户自定义字段
     */
    cleanAndMapFields(rawFields) {
        if (!rawFields || typeof rawFields !== 'object') {
            return {};
        }

        const cleanedFields = {};

        // 🔧 修复：动态获取interaction面板的字段配置
        const fieldDisplayNames = this.getInteractionFieldDisplayNames();

        // 处理所有字段
        Object.keys(rawFields).forEach(key => {
            const value = rawFields[key];

            // 跳过空值
            if (value === null || value === undefined || value === '') {
                return;
            }

            // 🔧 修复：跳过内部元数据字段
            if (key === 'index' || key === 'source' || key.startsWith('_')) {
                console.log(`[NPCPanel] 🔧 跳过内部字段: ${key}`);
                return;
            }

            // 🔧 新增：跳过纯数字键（这些是col_x格式的索引，不是真实字段名）
            if (/^\d+$/.test(key)) {
                console.log(`[NPCPanel] 🔧 跳过纯数字索引: ${key}`);
                return;
            }

            // 🔧 修复：使用动态字段映射获取显示名称
            let displayName = fieldDisplayNames[key];

            if (!displayName) {
                // 如果没有找到映射，尝试处理col_x格式
                if (key.startsWith('col_')) {
                    const colNum = parseInt(key.replace('col_', ''));
                    // 尝试从数字索引获取映射
                    displayName = fieldDisplayNames[colNum] || fieldDisplayNames[String(colNum)];
                }
            }

            // 🔧 新增：如果displayName是纯数字，跳过（这是col_x格式的索引，不是真实字段名）
            if (displayName && /^\d+$/.test(displayName)) {
                console.log(`[NPCPanel] 🔧 跳过纯数字显示名称: ${displayName} (来自 ${key})`);
                return;
            }

            // 🔧 修复：优先使用显示名称，如果没有映射且原始键名包含中文，则保留原始键名
            let fieldKey;
            if (displayName) {
                fieldKey = displayName;
            } else if (/[\u4e00-\u9fa5]/.test(key)) {
                // 原始键名包含中文，说明是用户自定义字段，直接使用
                fieldKey = key;
            } else {
                // 既没有映射，也不包含中文，跳过
                console.log(`[NPCPanel] 🔧 跳过未映射的非中文字段: ${key}`);
                return;
            }

            cleanedFields[fieldKey] = typeof value === 'string' ? value.trim() : value;
        });

        console.log('[NPCPanel] 🧹 字段清理完成:', Object.keys(cleanedFields));
        return cleanedFields;
    }

    /**
     * 🆕 获取interaction面板的字段显示名称映射（完全动态，无硬编码）
     */
    getInteractionFieldDisplayNames() {
        try {
            console.log('[NPCPanel] 🔍 开始构建动态字段映射...');

            // 🔧 修复：使用DataTable的getAllEnabledPanels()获取正确的面板配置
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (!dataTable || typeof dataTable.getAllEnabledPanels !== 'function') {
                console.warn('[NPCPanel] ⚠️ DataTable模块不可用，使用降级方案');
                return this.getFallbackFieldMapping();
            }

            // 获取所有启用的面板配置
            const enabledPanels = dataTable.getAllEnabledPanels();
            const interactionPanel = enabledPanels.find(panel =>
                panel.key === 'interaction' || panel.id === 'interaction'
            );

            if (!interactionPanel) {
                console.warn('[NPCPanel] ⚠️ 未找到interaction面板配置');
                return this.getFallbackFieldMapping();
            }

            console.log('[NPCPanel] ✅ 找到interaction面板配置:', interactionPanel);

            const fieldMapping = {};

            // 🎯 关键修复：直接使用subItems的顺序，这是用户界面的实际顺序
            if (interactionPanel.subItems && Array.isArray(interactionPanel.subItems)) {
                let validColumnIndex = 1; // 有效列号计数器

                interactionPanel.subItems.forEach((subItem, index) => {
                    if (subItem.enabled !== false) {
                        const displayName = subItem.displayName || subItem.name || subItem.key;
                        const fieldKey = subItem.key || displayName;

                        // 🔧 跳过无效字段（纯数字的key和name）
                        if (/^\d+$/.test(fieldKey) && /^\d+$/.test(displayName)) {
                            console.log(`[NPCPanel] ⚠️ 跳过无效字段 [${index + 1}]: key="${fieldKey}", name="${displayName}"`);
                            return;
                        }

                        // 🔧 创建多种格式的映射，确保兼容性
                        // 1. 字段键 -> 显示名称
                        if (fieldKey && !/^\d+$/.test(fieldKey)) {
                            fieldMapping[fieldKey] = displayName;
                        }

                        // 2. 数字索引 -> 显示名称（使用有效列号）
                        fieldMapping[String(validColumnIndex)] = displayName;

                        // 3. col_x格式 -> 显示名称（使用有效列号）
                        fieldMapping[`col_${validColumnIndex}`] = displayName;

                        // 4. 显示名称 -> 显示名称（自映射，用于查找）
                        if (displayName && !/^\d+$/.test(displayName)) {
                            fieldMapping[displayName] = displayName;
                        }

                        console.log(`[NPCPanel] 📝 字段映射 [有效列${validColumnIndex}]: ${fieldKey} => "${displayName}"`);
                        validColumnIndex++;
                    }
                });

                const validFieldCount = validColumnIndex - 1;
                console.log('[NPCPanel] ✅ 动态字段映射构建完成，共', validFieldCount, '个有效字段');
                console.log('[NPCPanel] 📊 完整映射表:', fieldMapping);
                return fieldMapping;
            } else {
                console.warn('[NPCPanel] ⚠️ interaction面板没有subItems配置');
                return this.getFallbackFieldMapping();
            }

        } catch (error) {
            console.error('[NPCPanel] ❌ 获取字段映射失败:', error);
            return this.getFallbackFieldMapping();
        }
    }

    /**
     * 🆕 回退字段映射表
     */
    getFallbackFieldMapping() {
        console.log('[NPCPanel] ⚠️ 使用回退映射表');
        return {
            'name': '对象名称', '1': '对象名称', 'col_1': '对象名称',
            'type': '对象类型', '2': '对象类型', 'col_2': '对象类型',
            'status': '当前状态', '3': '当前状态', 'col_3': '当前状态',
            'relationship': '关系类型', '4': '关系类型', 'col_4': '关系类型',
            'intimacy': '亲密度', '5': '亲密度', 'col_5': '亲密度',
            'description': '背景/描述', '6': '背景/描述', 'col_6': '背景/描述',
            'appearance': '外貌特征', '7': '外貌特征', 'col_7': '外貌特征',
            'outfit': '服装/装备', '8': '服装/装备', 'col_8': '服装/装备',
            'notes': '备注', '9': '备注', 'col_9': '备注'
        };
    }

    /**
     * 🆕 获取按照数据表格顺序排序的字段条目
     */
    getSortedFieldEntries(fields) {
        try {
            // 获取字段顺序映射
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (!dataTable || typeof dataTable.getAllEnabledPanels !== 'function') {
                console.warn('[NPCPanel] ⚠️ DataTable模块不可用，使用默认顺序');
                return Object.entries(fields);
            }

            // 获取interaction面板配置
            const enabledPanels = dataTable.getAllEnabledPanels();
            const interactionPanel = enabledPanels.find(panel =>
                panel.key === 'interaction' || panel.id === 'interaction'
            );

            if (!interactionPanel || !interactionPanel.subItems) {
                console.warn('[NPCPanel] ⚠️ 未找到interaction面板配置，使用默认顺序');
                return Object.entries(fields);
            }

            // 构建字段顺序映射：字段名 -> 顺序索引
            const fieldOrderMap = new Map();
            interactionPanel.subItems.forEach((subItem, index) => {
                if (subItem.enabled !== false) {
                    const displayName = subItem.displayName || subItem.name || subItem.key;
                    fieldOrderMap.set(displayName, index);

                    // 同时添加key的映射
                    if (subItem.key && subItem.key !== displayName) {
                        fieldOrderMap.set(subItem.key, index);
                    }
                }
            });

            console.log('[NPCPanel] 📊 字段顺序映射:', Array.from(fieldOrderMap.entries()));

            // 过滤并排序字段
            const sortedEntries = Object.entries(fields)
                // 过滤掉内部字段
                .filter(([key]) => {
                    return key !== 'index' &&
                           key !== 'source' &&
                           !key.startsWith('_');
                })
                // 按照配置顺序排序
                .sort(([keyA], [keyB]) => {
                    const orderA = fieldOrderMap.get(keyA);
                    const orderB = fieldOrderMap.get(keyB);

                    // 如果两个字段都在映射中，按照映射顺序排序
                    if (orderA !== undefined && orderB !== undefined) {
                        return orderA - orderB;
                    }

                    // 如果只有一个在映射中，有映射的排在前面
                    if (orderA !== undefined) return -1;
                    if (orderB !== undefined) return 1;

                    // 如果都不在映射中，保持原顺序（按字母排序）
                    return keyA.localeCompare(keyB);
                });

            console.log('[NPCPanel] ✅ 字段排序完成:', sortedEntries.map(([k]) => k));
            return sortedEntries;

        } catch (error) {
            console.error('[NPCPanel] ❌ 字段排序失败:', error);
            return Object.entries(fields);
        }
    }

    /**
     * 🆕 将英文字段名转换为中文显示名称
     */
    translateFieldDisplayName(displayName, fieldKey) {
        // 如果已经是中文，直接返回
        if (/[\u4e00-\u9fa5]/.test(displayName)) {
            return displayName;
        }

        // 🎯 interaction面板字段的中英文映射表
        const enToCnMapping = {
            // 基础字段
            'name': '对象名称',
            'type': '对象类型',
            'status': '当前状态',
            'location': '所在位置',
            'mood': '情绪状态',
            'activity': '当前活动',
            'availability': '可用性',
            'priority': '优先级',
            'relationship': '关系类型',
            'intimacy': '亲密度',
            'trust': '信任度',
            'friendship': '友谊度',
            'romance': '浪漫度',
            'respect': '尊重度',
            'dependency': '依赖度',
            'conflict': '冲突度',
            'lastContact': '最后联系',
            'frequency': '联系频率',
            'history': '互动历史',
            'notes': '备注',
            'goals': '目标',
            'secrets': '秘密',
            'autoRecord': '自动记录',
            'appearance': '外貌特征',
            'outfit': '服装/装备',
            'description': '背景/描述',
            'personality': '性格特征',
            'faction': '所属派系',
            'occupation': '职业/身份'
        };

        return enToCnMapping[displayName] || enToCnMapping[fieldKey] || displayName;
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
        list.innerHTML = npcs.map(n => {
            const isSelected = this.selectedNpcIds.has(n.id);
            return `
            <div class="npc-row ${isSelected ? 'selected' : ''}" data-id="${n.id}">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                    <div class="npc-checkbox" data-npc-id="${n.id}" style="
                        width: 18px;
                        height: 18px;
                        border: 2px solid var(--theme-border-color, #555);
                        border-radius: 3px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: ${isSelected ? 'var(--theme-accent-color, #007bff)' : 'transparent'};
                        transition: all 0.2s ease;
                        flex-shrink: 0;
                    " title="选择此NPC">
                        ${isSelected ? '<span style="color: white; font-size: 12px; font-weight: bold;">✓</span>' : ''}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div class="npc-name">${this.escape(n.name || '')}</div>
                        <div class="npc-meta">ID: ${n.id} · 出现次数: ${n.appearCount || 0} · 最近: ${this.formatTime(n.lastSeen)}</div>
                    </div>
                </div>
                <div>
                    <span class="badge">${(n.fields?.type || n.fields?.类型 || n.fields?.npc_type || '未知类型')}</span>
                </div>
            </div>
            `;
        }).join('');
        
        // 🆕 更新批量操作UI
        this.updateBatchOperationUI();
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

            // 🔧 修复：按照数据表格的字段顺序显示
            const fieldsHTML = Object.keys(fields).length ? `
                <div class="kv">
                    ${this.getSortedFieldEntries(fields).map(([k,v]) => `
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
        
        // 保存设置到本地存储
        localStorage.setItem('npcPanel_worldBookSync', this.worldBookSyncEnabled.toString());
        
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

            // 🔧 修复：获取或创建目标世界书（使用用户选择的世界书）
            const targetWorldBook = this.targetWorldBook || 'auto';
            console.log('[NPCPanel] 🌍 目标世界书设置:', targetWorldBook);

            let worldBookName, worldBookData, isNewWorldBook;

            if (targetWorldBook === 'auto') {
                // 使用角色链接的主要世界书
                const worldBookResult = await worldBookManager.getOrCreateTargetWorldBook(true);
                if (!worldBookResult.success) {
                    throw new Error(`获取目标世界书失败: ${worldBookResult.error}`);
                }
                worldBookName = worldBookResult.worldBookName;
                worldBookData = worldBookResult.worldBookData;
                isNewWorldBook = worldBookResult.isNewWorldBook;
            } else {
                // 🔧 修复：直接使用用户指定的世界书名称
                worldBookName = targetWorldBook;
                
                // 获取SillyTavern上下文
                const context = window.SillyTavern?.getContext?.();
                if (!context) {
                    throw new Error('无法获取SillyTavern上下文');
                }
                
                // 尝试加载指定的世界书
                if (typeof context.loadWorldInfo === 'function') {
                    worldBookData = await context.loadWorldInfo(worldBookName);
                    isNewWorldBook = false;
                    console.log('[NPCPanel] ✅ 成功加载指定世界书:', worldBookName);
                } else {
                    throw new Error('loadWorldInfo方法不可用');
                }
            }

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

            // 同步完成后立即执行一次去重：
            try {
                await worldBookManager.deduplicateWorldBookEntries(worldBookName, worldBookData);
            } catch (e) {
                console.warn('[NPCPanel] ⚠️ 去重失败（忽略）:', e);
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

            // 🔧 修复：改进字段过滤逻辑，保留所有有效字段（包括自定义字段）
            Object.entries(npc.fields).forEach(([fieldName, value]) => {
                // 🔧 跳过内部元数据字段
                if (fieldName === 'index' || fieldName === 'source' || fieldName.startsWith('_')) {
                    console.log(`[NPCPanel] 🔧 跳过内部字段（世界书）: ${fieldName}`);
                    return;
                }

                // 跳过空值
                if (!value || value.toString().trim() === '') {
                    return;
                }

                // 🔧 修复：获取字段显示名称
                const displayName = this.getFieldDisplayName(fieldName);

                // 🔧 修复：如果获取到了有效的显示名称，就使用它
                // 否则，检查原始字段名是否包含中文（用户自定义字段）
                if (displayName && displayName !== fieldName) {
                    // 找到了映射，使用显示名称
                    content += `**${displayName}**: ${value}\n`;
                } else if (/[\u4e00-\u9fa5]/.test(fieldName)) {
                    // 原始字段名包含中文，说明是用户自定义字段，直接使用
                    content += `**${fieldName}**: ${value}\n`;
                } else {
                    // 既没有映射，也不包含中文，跳过
                    console.log(`[NPCPanel] 🔧 跳过未映射的非中文字段（世界书）: ${fieldName}`);
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
     * 🎯 获取字段显示名称（使用动态字段配置）
     */
    getFieldDisplayName(fieldName) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings;

            if (infoBarSettings && infoBarSettings.getCompleteDisplayNameMapping) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();

                // 优先从interaction面板映射中查找
                if (completeMapping.interaction && completeMapping.interaction[fieldName]) {
                    return completeMapping.interaction[fieldName];
                }

                // 否则在所有面板映射中查找
                for (const [panelId, panelMapping] of Object.entries(completeMapping)) {
                    if (panelMapping[fieldName]) {
                        return panelMapping[fieldName];
                    }
                }
            }

            // 🔧 备用方案：硬编码映射表（用于降级）
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

            if (fieldNameMap[fieldName]) {
                return fieldNameMap[fieldName];
            }

            // 🔧 最后的降级方案：格式化字段名
            return fieldName.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

        } catch (error) {
            console.error('[NPCPanel] ❌ 获取字段显示名称失败:', error);
            return fieldName;
        }
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
            
            .npc-row.selected {
                background: var(--theme-bg-selected, rgba(0,123,255,0.1)) !important;
            }
            
            .npc-checkbox:hover {
                border-color: var(--theme-accent-color, #007bff) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 🆕 切换单个NPC的选中状态
     */
    toggleNpcSelection(npcId) {
        if (this.selectedNpcIds.has(npcId)) {
            this.selectedNpcIds.delete(npcId);
            console.log('[NPCPanel] ☑️ 取消选中NPC:', npcId);
        } else {
            this.selectedNpcIds.add(npcId);
            console.log('[NPCPanel] ✅ 选中NPC:', npcId);
        }
        
        // 更新UI
        this.renderList();
    }

    /**
     * 🆕 全选/取消全选
     */
    toggleSelectAll() {
        const npcs = this.npcDB.search({ q: this.searchText, sortBy: this.sortBy, order: this.order });
        
        // 检查当前是否全选
        const allSelected = npcs.length > 0 && npcs.every(npc => this.selectedNpcIds.has(npc.id));
        
        if (allSelected) {
            // 取消全选
            npcs.forEach(npc => this.selectedNpcIds.delete(npc.id));
            console.log('[NPCPanel] ☐ 取消全选');
        } else {
            // 全选
            npcs.forEach(npc => this.selectedNpcIds.add(npc.id));
            console.log('[NPCPanel] ☑️ 已全选', npcs.length, '个NPC');
        }
        
        // 更新UI
        this.renderList();
    }

    /**
     * 🆕 批量删除NPC
     */
    async batchDeleteNpcs() {
        try {
            if (this.selectedNpcIds.size === 0) {
                this.toast('请先选择要删除的NPC');
                return;
            }

            if (this.batchDeleteInProgress) {
                this.toast('批量删除正在进行中...');
                return;
            }

            // 获取选中的NPC信息
            const selectedNpcs = Array.from(this.selectedNpcIds).map(id => {
                return {
                    id,
                    npc: this.npcDB.db.npcs[id]
                };
            }).filter(item => item.npc);

            if (selectedNpcs.length === 0) {
                this.toast('未找到有效的NPC');
                this.selectedNpcIds.clear();
                this.renderList();
                return;
            }

            // 显示确认对话框
            const confirmed = await this.showBatchDeleteConfirmDialog(selectedNpcs);
            if (!confirmed) {
                console.log('[NPCPanel] ℹ️ 用户取消批量删除操作');
                return;
            }

            // 开始批量删除
            this.batchDeleteInProgress = true;
            this.updateBatchOperationUI();

            console.log('[NPCPanel] 🗑️ 开始批量删除', selectedNpcs.length, '个NPC...');

            let successCount = 0;
            let failCount = 0;

            // 逐个删除NPC
            for (const { id, npc } of selectedNpcs) {
                try {
                    const success = await this.npcDB.deleteNPC(id);
                    if (success) {
                        successCount++;
                        console.log(`[NPCPanel] ✅ 删除成功: ${npc.name} (${id})`);
                    } else {
                        failCount++;
                        console.warn(`[NPCPanel] ⚠️ 删除失败: ${npc.name} (${id})`);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`[NPCPanel] ❌ 删除出错: ${npc.name} (${id})`, error);
                }
            }

            // 清空选中状态
            this.selectedNpcIds.clear();

            // 刷新列表
            this.renderList();
            this.renderDetails(null);

            // 显示结果
            const message = `批量删除完成！成功: ${successCount} 个，失败: ${failCount} 个`;
            console.log('[NPCPanel] ✅', message);
            this.toast(message);

        } catch (error) {
            console.error('[NPCPanel] ❌ 批量删除失败:', error);
            this.toast('批量删除失败: ' + error.message);
        } finally {
            this.batchDeleteInProgress = false;
            this.updateBatchOperationUI();
        }
    }

    /**
     * 🆕 显示批量删除确认对话框
     */
    async showBatchDeleteConfirmDialog(selectedNpcs) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'batch-delete-confirm-dialog';
            dialog.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 1000000;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const npcNames = selectedNpcs.slice(0, 5).map(item => this.escape(item.npc.name)).join('、');
            const moreText = selectedNpcs.length > 5 ? ` 等 ${selectedNpcs.length} 个` : '';

            dialog.innerHTML = `
                <div style="
                    background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                    border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 500px;
                    width: 90%;
                    color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                ">
                    <h3 style="margin: 0 0 16px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                        批量删除确认
                    </h3>
                    <p style="margin: 0 0 20px 0; line-height: 1.5;">
                        您确定要删除以下 <strong>${selectedNpcs.length}</strong> 个NPC吗？
                        <br><br>
                        <span style="color: var(--theme-text-secondary, #999);">
                            ${npcNames}${moreText}
                        </span>
                        <br><br>
                        <span style="color: var(--theme-text-warning, #ffc107); font-size: 14px;">
                            ⚠️ 此操作不可撤销，将永久删除这些NPC及其在世界书中的相关条目。
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

            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    cleanup();
                    resolve(false);
                }
            });

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

    /**
     * 🆕 更新批量操作UI状态
     */
    updateBatchOperationUI() {
        if (!this.container) return;

        const selectedCount = this.selectedNpcIds.size;
        const countElement = this.container.querySelector('.count-number');
        const batchDeleteBtn = this.container.querySelector('.batch-delete-btn');
        const selectAllBtn = this.container.querySelector('.select-all-btn');
        const selectAllIcon = this.container.querySelector('.select-all-icon');

        // 更新选中数量
        if (countElement) {
            countElement.textContent = selectedCount;
        }

        // 更新批量删除按钮状态
        if (batchDeleteBtn) {
            if (selectedCount > 0 && !this.batchDeleteInProgress) {
                batchDeleteBtn.disabled = false;
                batchDeleteBtn.style.opacity = '1';
                batchDeleteBtn.style.cursor = 'pointer';
            } else {
                batchDeleteBtn.disabled = true;
                batchDeleteBtn.style.opacity = '0.5';
                batchDeleteBtn.style.cursor = 'not-allowed';
            }

            if (this.batchDeleteInProgress) {
                batchDeleteBtn.innerHTML = '⏳ 删除中...';
            } else {
                batchDeleteBtn.innerHTML = '🗑️ 批量删除';
            }
        }

        // 更新全选按钮状态
        if (selectAllBtn && selectAllIcon) {
            const npcs = this.npcDB?.search({ q: this.searchText, sortBy: this.sortBy, order: this.order }) || [];
            const allSelected = npcs.length > 0 && npcs.every(npc => this.selectedNpcIds.has(npc.id));
            
            if (allSelected) {
                selectAllIcon.textContent = '☑';
                selectAllBtn.innerHTML = '<span class="select-all-icon">☑</span> 取消全选';
            } else {
                selectAllIcon.textContent = '☐';
                selectAllBtn.innerHTML = '<span class="select-all-icon">☐</span> 全选';
            }
        }
    }
}

