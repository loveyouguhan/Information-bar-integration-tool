/**
 * RegexScriptPanel.js - 正则表达式脚本管理界面
 * 
 * 功能特性:
 * - 正则表达式脚本列表显示
 * - 脚本添加/编辑/删除界面
 * - 从SillyTavern导入脚本
 * - 从文件导入脚本
 * - 导出脚本到文件
 * - 脚本启用/禁用切换
 * - 拖拽调整执行顺序
 * 
 * @version 1.0.0
 * @author Information Bar Integration Tool Developer
 */

export class RegexScriptPanel {
    constructor(dependencies = {}) {
        console.log('[RegexScriptPanel] 🔧 正则表达式脚本面板初始化开始');
        
        // 🔧 依赖注入
        this.regexScriptManager = dependencies.regexScriptManager || window.SillyTavernInfobar?.modules?.regexScriptManager;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        
        // UI元素引用
        this.modal = null;
        this.overlay = null;
        this.scriptList = null;
        
        // 当前编辑的脚本
        this.editingScriptId = null;
        
        // 初始化状态
        this.initialized = false;
        this.visible = false;
        
        // 绑定方法
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.refreshScriptList = this.refreshScriptList.bind(this);
        
        // 初始化样式
        this.initStyles();
        
        console.log('[RegexScriptPanel] ✅ 正则表达式脚本面板构造完成');
    }
    
    /**
     * 初始化样式
     */
    initStyles() {
        if (document.getElementById('regex-script-panel-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'regex-script-panel-styles';
        style.textContent = `
            /* 🎨 正则表达式脚本面板样式 */
            .regex-script-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 19999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .regex-script-modal {
                position: relative;
                width: 900px;
                max-width: 95vw;
                height: 90vh;
                max-height: 90vh;
                background: var(--theme-bg-primary, #1a1a1a);
                border: 2px solid var(--theme-border-color, #333);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                color: var(--theme-text-primary, #e0e0e0);
            }
            
            .regex-script-header {
                padding: 20px;
                border-bottom: 2px solid var(--theme-border-color, #333);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            
            .regex-script-header h3 {
                margin: 0;
                color: var(--theme-primary-color, #4CAF50);
                font-size: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .regex-script-header-actions {
                display: flex;
                gap: 10px;
            }
            
            .regex-script-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
                min-height: 0;
            }
            
            .regex-script-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--theme-border-color, #333);
                background: var(--theme-bg-primary, #1a1a1a);
                flex-shrink: 0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .regex-script-toolbar {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            
            .regex-script-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .regex-script-item {
                background: var(--theme-bg-secondary, #2a2a2a);
                border: 1px solid var(--theme-border-color, #333);
                border-radius: 8px;
                padding: 16px;
                transition: all 0.2s;
                cursor: move;
            }
            
            .regex-script-item:hover {
                border-color: var(--theme-primary-color, #4CAF50);
                box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
            }
            
            .regex-script-item.disabled {
                opacity: 0.6;
            }
            
            .regex-script-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .regex-script-item-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--theme-text-primary, #e0e0e0);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .regex-script-item-actions {
                display: flex;
                gap: 8px;
            }
            
            
            .regex-script-empty {
                text-align: center;
                padding: 60px 20px;
                color: var(--theme-text-secondary, #888);
            }
            
            .regex-script-empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            /* 🔧 按钮样式 */
            .regex-btn {
                padding: 8px 16px;
                background: var(--theme-bg-secondary, #333);
                color: var(--theme-text-primary, #fff);
                border: 1px solid var(--theme-border-color, #555);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .regex-btn:hover {
                background: var(--theme-bg-hover, #444);
                border-color: var(--theme-primary-color, #4CAF50);
            }
            
            .regex-btn-primary {
                background: var(--theme-primary-color, #4CAF50);
                color: white;
                border-color: var(--theme-primary-color, #4CAF50);
            }
            
            .regex-btn-primary:hover {
                background: #45a049;
            }
            
            .regex-btn-danger {
                background: #f44336;
                color: white;
                border-color: #f44336;
            }
            
            .regex-btn-danger:hover {
                background: #da190b;
            }
            
            .regex-btn-small {
                padding: 4px 12px;
                font-size: 13px;
            }
            
            /* 🔧 表单样式 */
            .regex-form-group {
                margin-bottom: 16px;
            }
            
            .regex-form-label {
                display: block;
                margin-bottom: 8px;
                color: var(--theme-text-primary, #e0e0e0);
                font-size: 14px;
                font-weight: 500;
            }
            
            .regex-form-input,
            .regex-form-textarea,
            .regex-form-select {
                width: 100%;
                padding: 10px 12px;
                background: var(--theme-bg-secondary, #2a2a2a);
                border: 1px solid var(--theme-border-color, #333);
                border-radius: 6px;
                color: var(--theme-text-primary, #e0e0e0);
                font-size: 14px;
                font-family: inherit;
                transition: all 0.2s;
            }
            
            .regex-form-input:focus,
            .regex-form-textarea:focus,
            .regex-form-select:focus {
                outline: none;
                border-color: var(--theme-primary-color, #4CAF50);
                box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
            }
            
            .regex-form-textarea {
                resize: vertical;
                min-height: 80px;
                font-family: 'Courier New', monospace;
            }
            
            .regex-form-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .regex-form-checkbox input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            
            /* 🔧 移动端适配 */
            @media (max-width: 768px) {
                .regex-script-overlay {
                    padding: 10px !important;
                    align-items: flex-start !important;
                    padding-top: 5vh !important;
                }
                
                .regex-script-modal {
                    width: 100% !important;
                    max-width: none !important;
                    max-height: 90vh !important;
                    margin: 0 !important;
                    border-radius: 12px !important;
                }
                
                .regex-script-header {
                    padding: 14px 16px !important;
                    position: sticky !important;
                    top: 0 !important;
                    z-index: 10 !important;
                    background: var(--theme-bg-primary, #1a1a1a) !important;
                    border-bottom: 2px solid var(--theme-border-color, #333) !important;
                }
                
                .regex-script-header h3 {
                    font-size: 17px !important;
                }
                
                .regex-script-header-actions .regex-btn {
                    min-height: 40px !important;
                    padding: 8px 16px !important;
                    font-size: 14px !important;
                }
                
                .regex-script-body {
                    padding: 16px !important;
                    max-height: calc(90vh - 70px) !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                
                .regex-script-toolbar {
                    flex-direction: column !important;
                    gap: 10px !important;
                }
                
                .regex-script-toolbar .regex-btn {
                    width: 100% !important;
                    min-height: 42px !important;
                    padding: 10px 14px !important;
                    font-size: 14px !important;
                    justify-content: center !important;
                }
                
                .regex-script-item {
                    padding: 10px 12px !important;
                    margin-bottom: 8px !important;
                }
                
                .regex-script-item-header {
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    gap: 10px !important;
                }
                
                .regex-script-item-title {
                    flex: 1 !important;
                    min-width: 0 !important;
                    gap: 8px !important;
                }
                
                .regex-script-item-title > span:first-child {
                    font-size: 16px !important;
                    flex-shrink: 0 !important;
                }
                
                .regex-script-item-title > div {
                    flex: 1 !important;
                    min-width: 0 !important;
                }
                
                .regex-script-item-title > div > span:first-child {
                    font-size: 14px !important;
                    display: block !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }
                
                /* 🔧 隐藏描述和应用位置标签（移动端不需要） */
                .regex-script-item-title > div > span:nth-child(2),
                .regex-script-item-title > div > div {
                    display: none !important;
                }
                
                .regex-script-item-actions {
                    flex-shrink: 0 !important;
                    display: flex !important;
                    gap: 4px !important;
                }
                
                .regex-script-item-actions .regex-btn-small {
                    width: auto !important;
                    min-width: 34px !important;
                    min-height: 34px !important;
                    padding: 6px !important;
                    font-size: 14px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .regex-script-empty {
                    padding: 40px 20px !important;
                }
                
                /* 🔧 表单移动端适配 */
                .regex-form-group {
                    margin-bottom: 14px !important;
                }
                
                .regex-form-label {
                    font-size: 14px !important;
                    margin-bottom: 8px !important;
                }
                
                .regex-form-input,
                .regex-form-textarea,
                .regex-form-select {
                    padding: 10px 12px !important;
                    font-size: 15px !important;
                    min-height: 44px !important;
                    border-radius: 6px !important;
                }
                
                .regex-form-textarea {
                    min-height: 90px !important;
                }
                
                .regex-form-checkbox {
                    padding: 10px !important;
                    background: rgba(0, 0, 0, 0.2) !important;
                    border-radius: 6px !important;
                    margin-bottom: 12px !important;
                }
                
                .regex-form-checkbox input[type="checkbox"] {
                    width: 20px !important;
                    height: 20px !important;
                }
                
                .regex-form-checkbox span {
                    font-size: 14px !important;
                }
                
                /* 🔧 按钮移动端适配 */
                .regex-btn {
                    min-height: 42px !important;
                    padding: 10px 16px !important;
                    font-size: 14px !important;
                    border-radius: 6px !important;
                    -webkit-tap-highlight-color: transparent !important;
                }
                
                .regex-btn-small {
                    min-height: 38px !important;
                    padding: 8px 12px !important;
                    font-size: 13px !important;
                }
                
                .regex-btn:active {
                    opacity: 0.8 !important;
                }
                
                /* 🔧 导入选择对话框移动端适配 */
                .import-selection-modal {
                    width: 100% !important;
                    max-height: 90vh !important;
                }
                
                .import-selection-modal .regex-script-body {
                    overflow-y: visible !important;
                    max-height: none !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                
                .import-script-item {
                    padding: 12px !important;
                    margin-bottom: 10px !important;
                }
                
                .import-script-item input[type="checkbox"] {
                    width: 20px !important;
                    height: 20px !important;
                    min-width: 20px !important;
                    margin-top: 2px !important;
                }
                
                /* 🔧 脚本编辑器移动端适配 */
                .script-editor-modal {
                    width: 100% !important;
                    max-height: 92vh !important;
                }
                
                .script-editor-modal .regex-script-body {
                    overflow-y: auto !important;
                    max-height: calc(92vh - 140px) !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                
                #script-editor-form {
                    max-height: none !important;
                    overflow-y: visible !important;
                }
                
                .script-editor-footer {
                    flex-direction: row !important;
                    gap: 10px !important;
                    padding: 12px 16px !important;
                }
                
                .script-editor-footer .regex-btn {
                    flex: 1 !important;
                    min-height: 44px !important;
                    font-size: 15px !important;
                }
                
                /* 🔧 导入选择对话框按钮适配 */
                .import-selection-buttons {
                    flex-direction: row !important;
                    gap: 10px !important;
                }
                
                .import-selection-buttons .regex-btn {
                    flex: 1 !important;
                    min-height: 40px !important;
                    font-size: 13px !important;
                }
                
                .import-selection-footer {
                    flex-direction: row !important;
                    gap: 10px !important;
                    padding: 12px 16px !important;
                }
                
                .import-selection-footer .regex-btn {
                    flex: 1 !important;
                    min-height: 44px !important;
                    font-size: 15px !important;
                }
                
                /* 🔧 导入脚本项移动端优化 */
                .import-script-item > div {
                    flex-direction: row !important;
                    align-items: flex-start !important;
                    gap: 10px !important;
                }
                
                .import-script-item input[type="checkbox"] {
                    flex-shrink: 0 !important;
                }
                
                .import-script-item > div > div:last-child {
                    flex: 1 !important;
                }
                
                .import-script-item > div > div:last-child > div:first-child {
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                    margin-bottom: 6px !important;
                }
                
                .import-script-item > div > div:last-child > div:first-child > span:first-child {
                    font-size: 15px !important;
                }
                
                .import-script-item > div > div:last-child > div:first-child > span:nth-child(2) {
                    font-size: 14px !important;
                }
                
                .import-script-item > div > div:last-child > div:first-child > span:last-child {
                    font-size: 11px !important;
                    padding: 3px 8px !important;
                }
                
                .import-script-item > div > div:last-child > div:last-child {
                    grid-template-columns: 1fr !important;
                    gap: 6px 10px !important;
                    font-size: 12px !important;
                }
                
                .import-script-item > div > div:last-child > div:last-child > div {
                    font-size: 12px !important;
                    padding: 6px 8px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 显示面板
     */
    async show() {
        try {
            console.log('[RegexScriptPanel] 📖 显示正则表达式脚本面板');
            
            if (!this.regexScriptManager) {
                throw new Error('RegexScriptManager未初始化');
            }
            
            // 创建UI
            this.createUI();
            
            // 刷新脚本列表
            await this.refreshScriptList();
            
            this.visible = true;
            
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 显示面板失败:', error);
            alert(`显示面板失败: ${error.message}`);
        }
    }
    
    /**
     * 隐藏面板
     */
    hide() {
        console.log('[RegexScriptPanel] 👋 隐藏正则表达式脚本面板');
        
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        this.overlay = null;
        this.modal = null;
        this.scriptList = null;
        this.visible = false;
    }
    
    /**
     * 创建UI
     */
    createUI() {
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'regex-script-overlay';
        
        // 创建模态窗口
        this.modal = document.createElement('div');
        this.modal.className = 'regex-script-modal';
        
        this.modal.innerHTML = `
            <div class="regex-script-header">
                <h3>
                    <span>📝</span>
                    <span>正则表达式脚本管理</span>
                </h3>
                <div class="regex-script-header-actions">
                    <button class="regex-btn regex-btn-small" data-action="close">关闭</button>
                </div>
            </div>
            
            <div class="regex-script-body">
                <div class="regex-script-toolbar">
                    <button class="regex-btn regex-btn-primary" data-action="add">
                        <span>➕</span>
                        <span>新建脚本</span>
                    </button>
                    <button class="regex-btn" data-action="import-from-sillytavern">
                        <span>📥</span>
                        <span>从SillyTavern导入</span>
                    </button>
                    <button class="regex-btn" data-action="import-from-file">
                        <span>📂</span>
                        <span>从文件导入</span>
                    </button>
                    <button class="regex-btn" data-action="export-all">
                        <span>📤</span>
                        <span>导出所有</span>
                    </button>
                </div>
                
                <div class="regex-script-list" id="regex-script-list">
                    <!-- 脚本列表将在这里渲染 -->
                </div>
            </div>
        `;
        
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
        
        // 获取脚本列表容器
        this.scriptList = this.modal.querySelector('#regex-script-list');
        
        // 绑定事件
        this.bindEvents();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 关闭按钮
        this.modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            this.hide();
        });
        
        // 点击遮罩层关闭
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
        
        // 新建脚本
        this.modal.querySelector('[data-action="add"]').addEventListener('click', () => {
            this.showScriptEditor();
        });
        
        // 从SillyTavern导入
        this.modal.querySelector('[data-action="import-from-sillytavern"]').addEventListener('click', async () => {
            await this.importFromSillyTavern();
        });
        
        // 从文件导入
        this.modal.querySelector('[data-action="import-from-file"]').addEventListener('click', () => {
            this.importFromFile();
        });
        
        // 导出所有
        this.modal.querySelector('[data-action="export-all"]').addEventListener('click', async () => {
            await this.exportAll();
        });
    }
    
    /**
     * 刷新脚本列表
     */
    async refreshScriptList() {
        try {
            const scripts = this.regexScriptManager.getAllScripts();
            
            if (scripts.length === 0) {
                this.scriptList.innerHTML = `
                    <div class="regex-script-empty">
                        <div class="regex-script-empty-icon">📝</div>
                        <div>暂无正则表达式脚本</div>
                        <div style="margin-top: 8px; font-size: 13px;">
                            点击"新建脚本"按钮添加第一个脚本
                        </div>
                    </div>
                `;
                return;
            }
            
            // 渲染脚本列表
            this.scriptList.innerHTML = scripts.map(script => this.renderScriptItem(script)).join('');
            
            // 绑定脚本项事件
            this.bindScriptItemEvents();
            
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 刷新脚本列表失败:', error);
        }
    }
    
    /**
     * 渲染脚本项（简化版，只显示名称和状态）
     */
    renderScriptItem(script) {
        // 生成placement显示文本
        const placementText = script.placement.join(', ');
        
        return `
            <div class="regex-script-item ${!script.enabled ? 'disabled' : ''}" data-script-id="${script.id}">
                <div class="regex-script-item-header">
                    <div class="regex-script-item-title">
                        <span style="font-size: 20px;">${script.enabled ? '✅' : '⏸️'}</span>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-size: 15px; font-weight: 600;">${this.escapeHtml(script.scriptName)}</span>
                            ${script.description ? `
                            <span style="font-size: 12px; color: var(--theme-text-secondary, #888);">
                                ${this.escapeHtml(script.description)}
                            </span>
                            ` : ''}
                            <div style="display: flex; gap: 8px; font-size: 11px; color: var(--theme-text-secondary, #888); margin-top: 2px;">
                                <span style="padding: 2px 6px; background: rgba(76, 175, 80, 0.15); border-radius: 3px;">
                                    ${placementText}
                                </span>
                                <span style="padding: 2px 6px; background: rgba(33, 150, 243, 0.15); border-radius: 3px;">
                                    ${script.run}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="regex-script-item-actions">
                        <button class="regex-btn regex-btn-small" data-action="toggle" title="${script.enabled ? '禁用' : '启用'}">
                            ${script.enabled ? '⏸️' : '▶️'}
                        </button>
                        <button class="regex-btn regex-btn-small" data-action="edit" title="编辑">
                            ✏️
                        </button>
                        <button class="regex-btn regex-btn-small" data-action="export" title="导出">
                            📤
                        </button>
                        <button class="regex-btn regex-btn-small regex-btn-danger" data-action="delete" title="删除">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 绑定脚本项事件
     */
    bindScriptItemEvents() {
        const scriptItems = this.scriptList.querySelectorAll('.regex-script-item');
        
        scriptItems.forEach(item => {
            const scriptId = item.dataset.scriptId;
            
            // 切换启用/禁用
            item.querySelector('[data-action="toggle"]').addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleScript(scriptId);
            });
            
            // 编辑
            item.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showScriptEditor(scriptId);
            });
            
            // 导出
            item.querySelector('[data-action="export"]').addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.exportScript(scriptId);
            });
            
            // 删除
            item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteScript(scriptId);
            });
        });
    }
    
    /**
     * 显示脚本编辑器
     */
    showScriptEditor(scriptId = null) {
        const script = scriptId ? this.regexScriptManager.getScript(scriptId) : null;
        const isEdit = !!scriptId;
        
        const editorHTML = `
            <div class="regex-script-overlay script-editor-overlay" id="script-editor-overlay">
                <div class="regex-script-modal script-editor-modal" style="width: 700px; max-width: 95vw;">
                    <div class="regex-script-header">
                        <h3>${isEdit ? '✏️ 编辑脚本' : '➕ 新建脚本'}</h3>
                        <button class="regex-btn regex-btn-small" data-action="close-editor">关闭</button>
                    </div>
                    
                    <div class="regex-script-body">
                        <form id="script-editor-form">
                            <div class="regex-form-group">
                                <label class="regex-form-label">脚本名称 *</label>
                                <input type="text" class="regex-form-input" name="scriptName" 
                                       value="${this.escapeHtml(script?.scriptName || '')}" 
                                       placeholder="例如：隐藏特定标签" required />
                            </div>
                            
                            <div class="regex-form-group">
                                <label class="regex-form-label">描述</label>
                                <input type="text" class="regex-form-input" name="description" 
                                       value="${this.escapeHtml(script?.description || '')}" 
                                       placeholder="简要描述这个脚本的作用" />
                            </div>
                            
                            <div class="regex-form-group">
                                <label class="regex-form-label">查找正则表达式 *</label>
                                <textarea class="regex-form-textarea" name="findRegex" 
                                          placeholder="例如：<tag>[\\\\s\\\\S]*?</tag>" required>${this.escapeHtml(script?.findRegex || '')}</textarea>
                            </div>
                            
                            <div class="regex-form-group">
                                <label class="regex-form-label">替换为</label>
                                <textarea class="regex-form-textarea" name="replaceString" 
                                          placeholder="留空表示删除匹配内容">${this.escapeHtml(script?.replaceString || '')}</textarea>
                            </div>
                            
                            <div class="regex-form-group">
                                <label class="regex-form-label">应用位置</label>
                                <div class="regex-form-checkbox">
                                    <input type="checkbox" name="placement-input" 
                                           ${!script || script.placement.includes('INPUT') ? 'checked' : ''} />
                                    <span>INPUT - 应用于输入消息</span>
                                </div>
                                <div class="regex-form-checkbox">
                                    <input type="checkbox" name="placement-output" 
                                           ${script && script.placement.includes('OUTPUT') ? 'checked' : ''} />
                                    <span>OUTPUT - 应用于输出消息</span>
                                </div>
                            </div>
                            
                            <div class="regex-form-group">
                                <label class="regex-form-label">运行时机</label>
                                <select class="regex-form-select" name="run">
                                    <option value="AI_OUTPUT" ${!script || script.run === 'AI_OUTPUT' ? 'selected' : ''}>
                                        AI输出时
                                    </option>
                                    <option value="USER_INPUT" ${script && script.run === 'USER_INPUT' ? 'selected' : ''}>
                                        用户输入时
                                    </option>
                                </select>
                            </div>
                            
                            <div class="regex-form-group">
                                <div class="regex-form-checkbox">
                                    <input type="checkbox" name="substituteRegex" 
                                           ${!script || script.substituteRegex ? 'checked' : ''} />
                                    <span>使用正则替换（全局匹配）</span>
                                </div>
                                <div class="regex-form-checkbox">
                                    <input type="checkbox" name="trimStrings" 
                                           ${!script || script.trimStrings ? 'checked' : ''} />
                                    <span>清理前后空白</span>
                                </div>
                                <div class="regex-form-checkbox">
                                    <input type="checkbox" name="enabled" 
                                           ${!script || script.enabled ? 'checked' : ''} />
                                    <span>启用脚本</span>
                                </div>
                            </div>
                        </form>
                    </div>
                    
                    <div class="regex-script-footer script-editor-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--theme-border-color, #333); background: var(--theme-bg-primary, #1a1a1a);">
                        <button type="button" class="regex-btn" data-action="cancel-editor">取消</button>
                        <button type="submit" class="regex-btn regex-btn-primary" data-action="submit-editor">
                            ${isEdit ? '保存' : '创建'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加编辑器到页面
        const editorContainer = document.createElement('div');
        editorContainer.innerHTML = editorHTML;
        document.body.appendChild(editorContainer.firstElementChild);
        
        const editorOverlay = document.getElementById('script-editor-overlay');
        const form = document.getElementById('script-editor-form');
        
        // 关闭编辑器
        const closeEditor = () => {
            if (editorOverlay && editorOverlay.parentNode) {
                editorOverlay.parentNode.removeChild(editorOverlay);
            }
        };
        
        editorOverlay.querySelector('[data-action="close-editor"]').addEventListener('click', closeEditor);
        editorOverlay.querySelector('[data-action="cancel-editor"]').addEventListener('click', closeEditor);
        
        // 点击遮罩层关闭
        editorOverlay.addEventListener('click', (e) => {
            if (e.target === editorOverlay) {
                closeEditor();
            }
        });
        
        // 提交按钮（不在form内，需要手动触发提交）
        const submitHandler = async () => {
            try {
                // 收集表单数据
                const formData = new FormData(form);
                const placement = [];
                if (formData.get('placement-input') === 'on') placement.push('INPUT');
                if (formData.get('placement-output') === 'on') placement.push('OUTPUT');
                
                const scriptData = {
                    scriptName: formData.get('scriptName'),
                    description: formData.get('description'),
                    findRegex: formData.get('findRegex'),
                    replaceString: formData.get('replaceString'),
                    placement: placement.length > 0 ? placement : ['INPUT'],
                    run: formData.get('run'),
                    substituteRegex: formData.get('substituteRegex') === 'on',
                    trimStrings: formData.get('trimStrings') === 'on',
                    enabled: formData.get('enabled') === 'on'
                };
                
                // 验证必填字段
                if (!scriptData.scriptName || !scriptData.findRegex) {
                    alert('脚本名称和查找正则表达式为必填项');
                    return;
                }
                
                if (isEdit) {
                    await this.regexScriptManager.updateScript(scriptId, scriptData);
                    alert('脚本更新成功！');
                } else {
                    await this.regexScriptManager.addScript(scriptData);
                    alert('脚本创建成功！');
                }
                
                closeEditor();
                await this.refreshScriptList();
                
            } catch (error) {
                console.error('[RegexScriptPanel] ❌ 保存脚本失败:', error);
                alert(`保存失败: ${error.message}`);
            }
        };
        
        // 绑定提交按钮
        editorOverlay.querySelector('[data-action="submit-editor"]').addEventListener('click', submitHandler);
        
        // 也监听表单的submit事件（Enter键提交）
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitHandler();
        });
    }
    
    /**
     * 切换脚本启用状态
     */
    async toggleScript(scriptId) {
        try {
            const script = this.regexScriptManager.getScript(scriptId);
            await this.regexScriptManager.toggleScript(scriptId, !script.enabled);
            await this.refreshScriptList();
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 切换脚本状态失败:', error);
            alert(`操作失败: ${error.message}`);
        }
    }
    
    /**
     * 导出脚本
     */
    async exportScript(scriptId) {
        try {
            await this.regexScriptManager.exportToFile(scriptId);
            alert('导出成功！');
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 导出脚本失败:', error);
            alert(`导出失败: ${error.message}`);
        }
    }
    
    /**
     * 删除脚本
     */
    async deleteScript(scriptId) {
        try {
            const script = this.regexScriptManager.getScript(scriptId);
            if (!confirm(`确定要删除脚本"${script.scriptName}"吗？`)) {
                return;
            }
            
            await this.regexScriptManager.deleteScript(scriptId);
            await this.refreshScriptList();
            alert('删除成功！');
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 删除脚本失败:', error);
            alert(`删除失败: ${error.message}`);
        }
    }
    
    /**
     * 从SillyTavern导入
     */
    async importFromSillyTavern() {
        try {
            console.log('[RegexScriptPanel] 📥 准备从SillyTavern导入...');
            
            // 获取SillyTavern中的正则表达式脚本
            const sillyTavernScripts = await this.regexScriptManager.getSillyTavernRegexScripts();
            
            if (!sillyTavernScripts || sillyTavernScripts.length === 0) {
                alert('SillyTavern中没有可导入的正则表达式脚本\n\n💡 提示：\n1. 您可以先在SillyTavern中创建正则表达式\n2. 或者直接在本工具中创建新脚本\n3. 也可以从JSON文件导入现有脚本');
                return;
            }
            
            console.log('[RegexScriptPanel] 📊 找到', sillyTavernScripts.length, '个SillyTavern脚本');
            
            // 显示选择对话框
            const selectedScripts = await this.showImportSelectionDialog(sillyTavernScripts);
            
            if (!selectedScripts || selectedScripts.length === 0) {
                console.log('[RegexScriptPanel] ⏸️ 用户取消导入或未选择任何脚本');
                return;
            }
            
            console.log('[RegexScriptPanel] 📥 用户选择导入', selectedScripts.length, '个脚本');
            
            // 导入选中的脚本
            const importedIds = [];
            const failedScripts = [];
            
            for (const script of selectedScripts) {
                try {
                    // 转换格式
                    const convertedScript = this.regexScriptManager.convertSillyTavernScript(script);
                    
                    // 添加脚本
                    const scriptId = await this.regexScriptManager.addScript(convertedScript);
                    importedIds.push(scriptId);
                    console.log('[RegexScriptPanel] ✅ 导入成功:', script.scriptName);
                } catch (error) {
                    console.error('[RegexScriptPanel] ❌ 导入失败:', script.scriptName, error);
                    failedScripts.push({ script, error: error.message });
                }
            }
            
            // 刷新列表
            await this.refreshScriptList();
            
            // 显示结果
            let message = `✅ 成功导入 ${importedIds.length} 个脚本！`;
            if (failedScripts.length > 0) {
                message += `\n⚠️ ${failedScripts.length} 个脚本导入失败`;
            }
            alert(message);
            
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 从SillyTavern导入失败:', error);
            alert(`导入失败: ${error.message}\n\n💡 建议：\n1. 检查SillyTavern是否已启用正则表达式功能\n2. 或者直接在本工具中创建新脚本`);
        }
    }
    
    /**
     * 显示导入选择对话框
     */
    async showImportSelectionDialog(scripts) {
        return new Promise((resolve) => {
            console.log('[RegexScriptPanel] 💬 显示导入选择对话框');
            
            const dialogHTML = `
                <div class="regex-script-overlay import-selection-overlay" id="import-selection-overlay">
                    <div class="regex-script-modal import-selection-modal" style="width: 800px; max-height: 80vh;">
                        <div class="regex-script-header">
                            <h3>
                                <span>📥</span>
                                <span>选择要导入的正则表达式</span>
                            </h3>
                            <div class="regex-script-header-actions">
                                <button class="regex-btn regex-btn-small" data-action="close-selection">关闭</button>
                            </div>
                        </div>
                        
                        <div class="regex-script-body" style="display: flex; flex-direction: column;">
                            <div style="margin-bottom: 16px; padding: 12px; background: var(--theme-bg-secondary, #2a2a2a); border-radius: 6px; border-left: 3px solid var(--theme-primary-color, #4CAF50); flex-shrink: 0;">
                                <div style="font-size: 14px; margin-bottom: 8px;">
                                    📊 从SillyTavern中找到 <strong>${scripts.length}</strong> 个正则表达式脚本
                                </div>
                                <div style="font-size: 13px; color: var(--theme-text-secondary, #888);">
                                    请勾选您要导入的脚本，然后点击"导入选中项"按钮
                                </div>
                            </div>
                            
                            <div class="import-selection-buttons" style="margin-bottom: 16px; display: flex; gap: 10px; flex-shrink: 0;">
                                <button class="regex-btn regex-btn-small" data-action="select-all">全选</button>
                                <button class="regex-btn regex-btn-small" data-action="deselect-all">取消全选</button>
                            </div>
                            
                            <div class="import-script-list" style="flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;">
                                ${scripts.map((script, index) => this.renderImportScriptItem(script, index)).join('')}
                            </div>
                        </div>
                        
                        <div class="regex-script-footer import-selection-footer" style="display: flex; gap: 10px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--theme-border-color, #333); background: var(--theme-bg-primary, #1a1a1a);">
                            <button class="regex-btn" data-action="cancel-import">取消</button>
                            <button class="regex-btn regex-btn-primary" data-action="confirm-import">
                                <span>📥</span>
                                <span>导入选中项</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到页面
            const container = document.createElement('div');
            container.innerHTML = dialogHTML;
            document.body.appendChild(container.firstElementChild);
            
            const overlay = document.getElementById('import-selection-overlay');
            const scriptList = overlay.querySelector('.import-script-list');
            
            // 关闭对话框
            const closeDialog = (selectedScripts = null) => {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve(selectedScripts);
            };
            
            // 绑定事件
            overlay.querySelector('[data-action="close-selection"]').addEventListener('click', () => {
                closeDialog(null);
            });
            
            overlay.querySelector('[data-action="cancel-import"]').addEventListener('click', () => {
                closeDialog(null);
            });
            
            // 全选
            overlay.querySelector('[data-action="select-all"]').addEventListener('click', () => {
                scriptList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = true;
                });
            });
            
            // 取消全选
            overlay.querySelector('[data-action="deselect-all"]').addEventListener('click', () => {
                scriptList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                });
            });
            
            // 确认导入
            overlay.querySelector('[data-action="confirm-import"]').addEventListener('click', () => {
                const checkboxes = scriptList.querySelectorAll('input[type="checkbox"]:checked');
                const selectedScripts = Array.from(checkboxes).map(cb => {
                    const index = parseInt(cb.dataset.index);
                    return scripts[index];
                });
                
                console.log('[RegexScriptPanel] ✅ 用户选择了', selectedScripts.length, '个脚本');
                closeDialog(selectedScripts);
            });
            
            // 点击遮罩层关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeDialog(null);
                }
            });
        });
    }
    
    /**
     * 渲染导入脚本项（选择界面）
     */
    renderImportScriptItem(script, index) {
        // 转换placement数字为文本
        const placementMap = {
            0: 'INPUT (发送前)',
            1: 'OUTPUT (接收后)',
            2: 'BOTH (两者都应用)'
        };
        
        const placementText = Array.isArray(script.placement) 
            ? script.placement.map(p => placementMap[p] || p).join(', ')
            : 'INPUT';
        
        const isEnabled = !script.disabled;
        const statusIcon = isEnabled ? '✅' : '⏸️';
        const statusText = isEnabled ? '已启用' : '已禁用';
        
        // 处理正则表达式显示（如果是/regex/flags格式，提取regex部分）
        let displayRegex = script.findRegex;
        const regexMatch = displayRegex.match(/^\/(.+)\/([gimsuvy]*)$/);
        if (regexMatch) {
            displayRegex = regexMatch[1];
        }
        
        return `
            <div class="import-script-item" style="
                background: var(--theme-bg-secondary, #2a2a2a);
                border: 1px solid var(--theme-border-color, #333);
                border-radius: 8px;
                padding: 14px;
                margin-bottom: 10px;
                transition: all 0.2s;
            ">
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <input type="checkbox" 
                           data-index="${index}" 
                           ${isEnabled ? 'checked' : ''}
                           style="
                               width: 20px;
                               height: 20px;
                               margin-top: 2px;
                               cursor: pointer;
                           " />
                    
                    <div style="flex: 1;">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 8px;
                        ">
                            <span style="font-size: 16px;">${statusIcon}</span>
                            <span style="
                                font-size: 15px;
                                font-weight: 600;
                                color: var(--theme-text-primary, #e0e0e0);
                            ">${this.escapeHtml(script.scriptName)}</span>
                            <span style="
                                font-size: 12px;
                                padding: 2px 8px;
                                background: ${isEnabled ? 'rgba(76, 175, 80, 0.2)' : 'rgba(128, 128, 128, 0.2)'};
                                color: ${isEnabled ? '#4CAF50' : '#888'};
                                border-radius: 4px;
                            ">${statusText}</span>
                        </div>
                        
                        <div style="
                            display: grid;
                            grid-template-columns: auto 1fr;
                            gap: 8px 12px;
                            font-size: 13px;
                            color: var(--theme-text-secondary, #aaa);
                        ">
                            <div style="color: var(--theme-text-secondary, #888);">查找正则:</div>
                            <div style="
                                font-family: 'Courier New', monospace;
                                color: var(--theme-text-primary, #e0e0e0);
                                word-break: break-all;
                                background: rgba(0, 0, 0, 0.2);
                                padding: 4px 8px;
                                border-radius: 4px;
                            ">${this.escapeHtml(displayRegex)}</div>
                            
                            <div style="color: var(--theme-text-secondary, #888);">替换为:</div>
                            <div style="
                                font-family: 'Courier New', monospace;
                                color: var(--theme-text-primary, #e0e0e0);
                            ">${this.escapeHtml(script.replaceString || '(空)')}</div>
                            
                            <div style="color: var(--theme-text-secondary, #888);">应用位置:</div>
                            <div style="color: var(--theme-text-primary, #e0e0e0);">${placementText}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 从文件导入
     */
    importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = false;
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                await this.regexScriptManager.importFromFile(file);
                await this.refreshScriptList();
                alert('导入成功！');
            } catch (error) {
                console.error('[RegexScriptPanel] ❌ 从文件导入失败:', error);
                alert(`导入失败: ${error.message}`);
            }
        });
        
        input.click();
    }
    
    /**
     * 导出所有脚本
     */
    async exportAll() {
        try {
            await this.regexScriptManager.exportAllScripts();
            alert('导出成功！');
        } catch (error) {
            console.error('[RegexScriptPanel] ❌ 导出所有脚本失败:', error);
            alert(`导出失败: ${error.message}`);
        }
    }
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

