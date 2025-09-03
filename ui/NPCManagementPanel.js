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

        try { this.init(); } catch (e) { console.error('[NPCPanel] 初始化失败', e); }
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

        // 事件绑定
        this.container.addEventListener('click', (e) => {
            const close = e.target.closest('[data-action="close"]');
            if (close) { this.hide(); return; }
            const exportBtn = e.target.closest('[data-action="export"]');
            if (exportBtn) { this.exportDB(); return; }
            const importBtn = e.target.closest('[data-action="import"]');
            if (importBtn) { this.importDB(); return; }
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
        }).catch(error => {
            console.error('[NPCPanel] ❌ 打开面板时刷新数据失败:', error);
            this.render(); // 即使刷新失败也要显示界面
        });
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
}

