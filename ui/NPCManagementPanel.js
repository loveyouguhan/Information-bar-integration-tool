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
                    <div class="list" style="background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); border-radius:6px; overflow:auto; max-height: 60vh;"></div>
                </div>
                <div class="right" style="flex:1; border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); border-radius: 6px; min-height: 240px; padding: 8px; background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111)); color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                    <div class="detail-placeholder" style="opacity:.7; font-size:12px; padding: 10px; color: var(--SmartThemeTextColor, #ddd);">选择左侧NPC以查看详情</div>
                    <div class="details" style="display:none; color: var(--SmartThemeTextColor, #ddd);"></div>
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
        .npc-management-modal .modal-container { position: relative; width: 960px; max-width: 95vw; margin: 8vh auto; border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,.5); }
        .npc-management-modal .list .npc-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333)); cursor: pointer; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); }
        .npc-management-modal .list .npc-row:hover { background: var(--theme-bg-hover, var(--SmartThemeQuoteColor, rgba(255,255,255,.03))); }
        .npc-management-modal .list .npc-name { font-weight:600; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd)); }
        .npc-management-modal .list .npc-meta { opacity:.7; font-size: 12px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa)); }
        .npc-management-modal .kv { display:grid; grid-template-columns: 120px 1fr; gap: 6px 10px; }
        .npc-management-modal .badge { display:inline-block; padding: 2px 6px; border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor,#333)); border-radius: 10px; font-size: 11px; opacity:.8; color: var(--theme-text-primary, var(--SmartThemeTextColor,#ddd)); background: var(--theme-bg-primary, transparent); }
        `;
        document.head.appendChild(style);
    }

    show() {
        if (!this.container) return;
        this.visible = true;
        this.container.style.display = '';
        this.render();
    }

    hide() {
        if (!this.container) return;
        this.visible = false;
        this.container.style.display = 'none';
    }

    toggle() { this.visible ? this.hide() : this.show(); }

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
                    <div style="font-size:12px; opacity:.8;">最后出现: ${this.formatTime(npc.lastSeen)}</div>
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

