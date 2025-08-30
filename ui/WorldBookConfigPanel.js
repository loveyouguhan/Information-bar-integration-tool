/**
 * WorldBookConfigPanel
 * 
 * 世界书配置面板 - 在自定义API配置界面中提供世界书管理功能
 * 功能包括：
 * - 世界书来源选择（默认/手动）
 * - 世界书最大字符数配置
 * - 世界书选择和条目管理
 * - 实时字符数预览
 */

export class WorldBookConfigPanel {
    constructor(worldBookManager, configManager, eventSystem) {
        console.log('[WorldBookConfigPanel] 📚 世界书配置面板初始化开始');
        
        this.worldBookManager = worldBookManager;
        this.configManager = configManager;
        this.eventSystem = eventSystem;
        
        // UI状态
        this.container = null;
        this.visible = false;
        this.searchText = '';
        this.selectedBooks = new Set();
        this.enabledEntries = new Map();
        
        // 数据缓存
        this.worldBooks = [];
        this.currentEntries = [];
        this.characterCount = { total: 0, limit: 50000, percentage: 0, isOverLimit: false };
        
        // 绑定方法
        this.bindMethods();
        
        console.log('[WorldBookConfigPanel] ✅ 世界书配置面板初始化完成');
    }

    /**
     * 绑定方法到实例
     */
    bindMethods() {
        this.render = this.render.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.updateCharacterCount = this.updateCharacterCount.bind(this);
        this.handleSourceChange = this.handleSourceChange.bind(this);
        this.handleBookSelection = this.handleBookSelection.bind(this);
        this.handleEntryToggle = this.handleEntryToggle.bind(this);
        this.saveConfiguration = this.saveConfiguration.bind(this);
    }

    /**
     * 渲染世界书配置面板
     */
    async render(parentContainer) {
        try {
            console.log('[WorldBookConfigPanel] 🎨 渲染世界书配置面板...');

            if (!parentContainer) {
                console.error('[WorldBookConfigPanel] ❌ 未提供父容器');
                return;
            }

            // 🔧 修复：检查是否已经渲染过，避免重复渲染
            if (this.container && this.container.parentNode === parentContainer) {
                console.log('[WorldBookConfigPanel] ⚠️ 面板已存在，跳过重复渲染');
                // 只更新数据和内容
                await this.loadData();
                this.container.innerHTML = await this.generateHTML();
                this.bindEvents();
                await this.updateCharacterCount();
                return;
            }

            // 🔧 修复：清理旧的容器
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }

            // 创建主容器
            this.container = document.createElement('div');
            this.container.className = 'worldbook-config-panel';
            this.container.style.cssText = `
                background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                border-radius: 8px;
                padding: 16px;
                margin: 12px 0;
                color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
            `;

            // 加载数据
            await this.loadData();

            // 渲染内容
            this.container.innerHTML = await this.generateHTML();

            // 绑定事件
            this.bindEvents();

            // 添加到父容器
            parentContainer.appendChild(this.container);

            // 初始更新
            await this.updateCharacterCount();

            console.log('[WorldBookConfigPanel] ✅ 世界书配置面板渲染完成');

        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 渲染失败:', error);
        }
    }

    /**
     * 加载数据
     */
    async loadData() {
        try {
            // 加载世界书列表
            this.worldBooks = await this.worldBookManager.getAvailableWorldBooks();

            // 加载当前配置
            const config = this.worldBookManager.config;

            // 🔧 修复：过滤掉不存在的世界书ID
            const validWorldBookIds = new Set(this.worldBooks.map(book => book.id));
            const validSelectedBooks = config.selectedBooks.filter(bookId => validWorldBookIds.has(bookId));
            this.selectedBooks = new Set(validSelectedBooks);

            // 🔧 修复：过滤掉不存在的世界书的条目配置
            const validEnabledEntries = new Map();
            for (const [bookId, entryIds] of config.enabledEntries.entries()) {
                if (validWorldBookIds.has(bookId)) {
                    validEnabledEntries.set(bookId, entryIds);
                }
            }
            this.enabledEntries = validEnabledEntries;

            console.log('[WorldBookConfigPanel] 📥 数据加载完成:', {
                worldBooks: this.worldBooks.length,
                selectedBooks: this.selectedBooks.size,
                validSelectedBooks: Array.from(this.selectedBooks),
                availableWorldBookIds: Array.from(validWorldBookIds)
            });

        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 数据加载失败:', error);
        }
    }

    /**
     * 生成HTML内容
     */
    async generateHTML() {
        const config = this.worldBookManager.config;
        
        return `
            <div class="worldbook-config-header">
                <h3 style="margin: 0 0 16px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                    📚 世界书管理配置
                </h3>
            </div>
            
            <!-- 世界书来源选择 -->
            <div class="worldbook-source-section" style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                    世界书来源
                </h4>
                <div class="source-options" style="display: flex; gap: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="worldbook-source" value="default" 
                               ${config.source === 'default' ? 'checked' : ''}
                               style="margin: 0;">
                        <span>默认（使用当前角色绑定的世界书）</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="worldbook-source" value="manual" 
                               ${config.source === 'manual' ? 'checked' : ''}
                               style="margin: 0;">
                        <span>手动选择</span>
                    </label>
                </div>
            </div>
            
            <!-- 字符数限制配置 -->
            <div class="worldbook-limit-section" style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                    字符数限制
                </h4>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="number" 
                           class="worldbook-max-chars" 
                           value="${config.maxCharacters}"
                           min="0" 
                           max="200000" 
                           step="1000"
                           style="
                               width: 120px;
                               padding: 6px 8px;
                               border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                               border-radius: 4px;
                               background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                               color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                           ">
                    <span>字符</span>
                    <div class="character-count-display" style="margin-left: auto;">
                        <span class="current-count">0</span> / <span class="max-count">${config.maxCharacters}</span>
                        (<span class="percentage">0%</span>)
                    </div>
                </div>
            </div>
            
            <!-- 手动选择区域 -->
            <div class="worldbook-manual-section" 
                 style="display: ${config.source === 'manual' ? 'block' : 'none'};">
                
                <!-- 世界书选择 -->
                <div class="worldbook-selection" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                        选择世界书
                    </h4>
                    <div class="worldbook-list" style="
                        max-height: 200px;
                        overflow-y: auto;
                        border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                        border-radius: 4px;
                        background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                    ">
                        ${this.generateWorldBookList()}
                    </div>
                    <div style="margin-top: 8px;">
                        <button class="select-all-books" style="
                            padding: 4px 8px;
                            margin-right: 8px;
                            border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                            border-radius: 4px;
                            background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                            color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                            cursor: pointer;
                            font-size: 12px;
                        ">全选</button>
                        <button class="deselect-all-books" style="
                            padding: 4px 8px;
                            border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                            border-radius: 4px;
                            background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                            color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                            cursor: pointer;
                            font-size: 12px;
                        ">取消全选</button>
                    </div>
                </div>
                
                <!-- 条目管理 -->
                <div class="worldbook-entries" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));">
                        启用的世界书条目
                    </h4>
                    <div class="entries-search" style="margin-bottom: 12px;">
                        <input type="text" 
                               class="entries-search-input" 
                               placeholder="搜索条目..."
                               style="
                                   width: 100%;
                                   padding: 6px 8px;
                                   border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                                   border-radius: 4px;
                                   background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                                   color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                               ">
                    </div>
                    <div class="entries-list" style="
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                        border-radius: 4px;
                        background: var(--theme-bg-primary, var(--SmartThemeBodyColor, #1e1e1e));
                    ">
                        <div class="entries-placeholder" style="
                            padding: 20px;
                            text-align: center;
                            color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));
                        ">
                            请先选择世界书
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 操作按钮 -->
            <div class="worldbook-actions" style="
                display: flex;
                gap: 12px;
                padding-top: 16px;
                border-top: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
            ">
                <button class="save-config" style="
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: var(--theme-bg-success, #28a745);
                    color: white;
                    cursor: pointer;
                    font-weight: 600;
                ">保存配置</button>
                <button class="reset-config" style="
                    padding: 8px 16px;
                    border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                    border-radius: 4px;
                    background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                    color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                    cursor: pointer;
                ">重置</button>
                <button class="refresh-data" style="
                    padding: 8px 16px;
                    border: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                    border-radius: 4px;
                    background: var(--theme-bg-secondary, var(--SmartThemeSurfaceColor, #111));
                    color: var(--theme-text-primary, var(--SmartThemeTextColor, #ddd));
                    cursor: pointer;
                ">刷新数据</button>
            </div>
        `;
    }

    /**
     * 生成世界书列表HTML
     */
    generateWorldBookList() {
        if (this.worldBooks.length === 0) {
            return `
                <div style="padding: 20px; text-align: center; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));">
                    未找到可用的世界书
                </div>
            `;
        }
        
        return this.worldBooks.map(book => {
            const isSelected = this.selectedBooks.has(book.id);
            const isDefault = book.isDefault;
            
            return `
                <div class="worldbook-item" data-book-id="${book.id}" style="
                    padding: 12px;
                    border-bottom: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                    cursor: pointer;
                    ${isSelected ? 'background: var(--theme-bg-hover, var(--SmartThemeQuoteColor, rgba(255,255,255,.03)));' : ''}
                ">
                    <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; width: 100%;">
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''}
                               style="margin: 2px 0 0 0; flex-shrink: 0;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; margin-bottom: 4px;">
                                ${this.escapeHtml(book.name)}
                                ${isDefault ? '<span style="color: var(--theme-text-success, #28a745); font-size: 12px; margin-left: 8px;">[默认]</span>' : ''}
                            </div>
                            <div style="font-size: 12px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa)); margin-bottom: 4px;">
                                ${book.description ? this.escapeHtml(book.description) : '无描述'}
                            </div>
                            <div style="font-size: 11px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));">
                                ${book.entryCount} 个条目 | 来源: ${book.source === 'character' ? '角色绑定' : '全局'}
                            </div>
                        </div>
                    </label>
                </div>
            `;
        }).join('');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        if (!this.container) return;
        
        // 世界书来源选择
        const sourceRadios = this.container.querySelectorAll('input[name="worldbook-source"]');
        sourceRadios.forEach(radio => {
            radio.addEventListener('change', this.handleSourceChange);
        });
        
        // 字符数限制输入
        const maxCharsInput = this.container.querySelector('.worldbook-max-chars');
        if (maxCharsInput) {
            maxCharsInput.addEventListener('input', (e) => {
                this.worldBookManager.config.maxCharacters = parseInt(e.target.value) || 50000;
                this.updateCharacterCount();
            });
        }
        
        // 世界书选择
        const worldBookItems = this.container.querySelectorAll('.worldbook-item input[type="checkbox"]');
        worldBookItems.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleBookSelection);
        });
        
        // 全选/取消全选按钮
        const selectAllBtn = this.container.querySelector('.select-all-books');
        const deselectAllBtn = this.container.querySelector('.deselect-all-books');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.worldBooks.forEach(book => this.selectedBooks.add(book.id));
                this.updateWorldBookSelection();
                this.updateEntriesList();
                this.updateCharacterCount();
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.selectedBooks.clear();
                this.updateWorldBookSelection();
                this.updateEntriesList();
                this.updateCharacterCount();
            });
        }
        
        // 条目搜索
        const searchInput = this.container.querySelector('.entries-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchText = e.target.value.toLowerCase();
                this.updateEntriesList();
            });
        }
        
        // 操作按钮
        const saveBtn = this.container.querySelector('.save-config');
        const resetBtn = this.container.querySelector('.reset-config');
        const refreshBtn = this.container.querySelector('.refresh-data');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', this.saveConfiguration);
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetConfiguration();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
    }

    /**
     * 处理世界书来源变更
     */
    async handleSourceChange(e) {
        try {
            const newSource = e.target.value;
            this.worldBookManager.config.source = newSource;
            
            // 显示/隐藏手动选择区域
            const manualSection = this.container.querySelector('.worldbook-manual-section');
            if (manualSection) {
                manualSection.style.display = newSource === 'manual' ? 'block' : 'none';
            }
            
            // 更新字符数统计
            await this.updateCharacterCount();
            
            console.log('[WorldBookConfigPanel] 📝 世界书来源已变更:', newSource);
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 处理来源变更失败:', error);
        }
    }

    /**
     * 处理世界书选择
     */
    async handleBookSelection(e) {
        try {
            const bookId = e.target.closest('.worldbook-item').dataset.bookId;
            
            if (e.target.checked) {
                this.selectedBooks.add(bookId);
            } else {
                this.selectedBooks.delete(bookId);
                this.enabledEntries.delete(bookId);
            }
            
            // 更新条目列表
            await this.updateEntriesList();
            
            // 更新字符数统计
            await this.updateCharacterCount();
            
            console.log('[WorldBookConfigPanel] 📚 世界书选择已更新:', Array.from(this.selectedBooks));
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 处理世界书选择失败:', error);
        }
    }

    /**
     * 处理条目启用/禁用
     */
    async handleEntryToggle(e) {
        try {
            const entryElement = e.target.closest('.entry-item');
            const bookId = entryElement.dataset.bookId;
            const entryId = entryElement.dataset.entryId;
            
            if (!this.enabledEntries.has(bookId)) {
                this.enabledEntries.set(bookId, new Set());
            }
            
            const bookEntries = this.enabledEntries.get(bookId);
            
            if (e.target.checked) {
                bookEntries.add(entryId);
            } else {
                bookEntries.delete(entryId);
            }
            
            // 更新字符数统计
            await this.updateCharacterCount();
            
            console.log(`[WorldBookConfigPanel] 📖 条目状态已更新: ${bookId}/${entryId}`);
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 处理条目切换失败:', error);
        }
    }

    /**
     * 更新字符数统计
     */
    async updateCharacterCount() {
        try {
            this.characterCount = await this.worldBookManager.calculateCharacterCount();
            
            // 更新显示
            const currentCountEl = this.container.querySelector('.current-count');
            const maxCountEl = this.container.querySelector('.max-count');
            const percentageEl = this.container.querySelector('.percentage');
            
            if (currentCountEl) currentCountEl.textContent = this.characterCount.total.toLocaleString();
            if (maxCountEl) maxCountEl.textContent = this.characterCount.limit.toLocaleString();
            if (percentageEl) {
                percentageEl.textContent = `${this.characterCount.percentage}%`;
                percentageEl.style.color = this.characterCount.isOverLimit ? 
                    'var(--theme-text-danger, #dc3545)' : 
                    'var(--theme-text-primary, var(--SmartThemeTextColor, #ddd))';
            }
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 更新字符数统计失败:', error);
        }
    }

    /**
     * 更新世界书选择状态
     */
    updateWorldBookSelection() {
        const checkboxes = this.container.querySelectorAll('.worldbook-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const bookId = checkbox.closest('.worldbook-item').dataset.bookId;
            checkbox.checked = this.selectedBooks.has(bookId);
            
            // 更新样式
            const item = checkbox.closest('.worldbook-item');
            if (checkbox.checked) {
                item.style.background = 'var(--theme-bg-hover, var(--SmartThemeQuoteColor, rgba(255,255,255,.03)))';
            } else {
                item.style.background = '';
            }
        });
    }

    /**
     * 更新条目列表
     */
    async updateEntriesList() {
        try {
            const entriesList = this.container.querySelector('.entries-list');
            if (!entriesList) return;
            
            if (this.selectedBooks.size === 0) {
                entriesList.innerHTML = `
                    <div class="entries-placeholder" style="
                        padding: 20px;
                        text-align: center;
                        color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));
                    ">
                        请先选择世界书
                    </div>
                `;
                return;
            }
            
            // 收集所有选中世界书的条目
            const allEntries = [];
            for (const bookId of this.selectedBooks) {
                const book = this.worldBooks.find(b => b.id === bookId);
                if (book) {
                    const entries = await this.worldBookManager.getWorldBookEntries(bookId);
                    entries.forEach(entry => {
                        entry.bookId = bookId;
                        entry.bookName = book.name;
                        allEntries.push(entry);
                    });
                }
            }
            
            // 应用搜索过滤
            const filteredEntries = allEntries.filter(entry => {
                if (!this.searchText) return true;
                return entry.key.toLowerCase().includes(this.searchText) ||
                       entry.content.toLowerCase().includes(this.searchText) ||
                       entry.comment.toLowerCase().includes(this.searchText);
            });
            
            if (filteredEntries.length === 0) {
                entriesList.innerHTML = `
                    <div class="entries-placeholder" style="
                        padding: 20px;
                        text-align: center;
                        color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));
                    ">
                        ${this.searchText ? '未找到匹配的条目' : '选中的世界书中没有条目'}
                    </div>
                `;
                return;
            }
            
            // 生成条目列表HTML
            entriesList.innerHTML = filteredEntries.map(entry => {
                const bookEntries = this.enabledEntries.get(entry.bookId) || new Set();
                const isEnabled = bookEntries.has(entry.id);
                
                return `
                    <div class="entry-item" 
                         data-book-id="${entry.bookId}" 
                         data-entry-id="${entry.id}"
                         style="
                             padding: 12px;
                             border-bottom: 1px solid var(--theme-border-color, var(--SmartThemeBorderColor, #333));
                         ">
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; width: 100%;">
                            <input type="checkbox" 
                                   ${isEnabled ? 'checked' : ''}
                                   style="margin: 2px 0 0 0; flex-shrink: 0;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; margin-bottom: 4px;">
                                    ${this.escapeHtml(entry.key || '无关键词')}
                                    <span style="color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa)); font-size: 12px; margin-left: 8px;">
                                        [${this.escapeHtml(entry.bookName)}]
                                    </span>
                                </div>
                                <div style="font-size: 12px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa)); margin-bottom: 4px;">
                                    ${this.escapeHtml(entry.preview)}
                                </div>
                                <div style="font-size: 11px; color: var(--theme-text-secondary, var(--SmartThemeTextSecondaryColor, #aaa));">
                                    ${entry.characterCount} 字符
                                    ${entry.selective ? ' | 选择性' : ''}
                                    ${entry.constant ? ' | 常驻' : ''}
                                    ${entry.disable ? ' | 已禁用' : ''}
                                </div>
                            </div>
                        </label>
                    </div>
                `;
            }).join('');
            
            // 绑定条目切换事件
            const entryCheckboxes = entriesList.querySelectorAll('.entry-item input[type="checkbox"]');
            entryCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', this.handleEntryToggle);
            });
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 更新条目列表失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfiguration() {
        try {
            console.log('[WorldBookConfigPanel] 💾 保存世界书配置...');
            
            // 更新配置
            this.worldBookManager.config.selectedBooks = Array.from(this.selectedBooks);
            this.worldBookManager.config.enabledEntries = this.enabledEntries;
            
            // 保存到配置管理器
            await this.worldBookManager.saveConfig();
            
            // 显示成功提示
            this.showToast('世界书配置已保存', 'success');
            
            console.log('[WorldBookConfigPanel] ✅ 世界书配置保存完成');
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 保存配置失败:', error);
            this.showToast('保存配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 重置配置
     */
    async resetConfiguration() {
        try {
            console.log('[WorldBookConfigPanel] 🔄 重置世界书配置...');
            
            // 重置为默认配置
            this.worldBookManager.config.source = 'default';
            this.worldBookManager.config.maxCharacters = 50000;
            this.worldBookManager.config.selectedBooks = [];
            this.worldBookManager.config.enabledEntries = new Map();
            
            this.selectedBooks.clear();
            this.enabledEntries.clear();
            
            // 重新渲染
            await this.render(this.container.parentNode);
            
            this.showToast('配置已重置', 'info');
            
            console.log('[WorldBookConfigPanel] ✅ 世界书配置重置完成');
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 重置配置失败:', error);
            this.showToast('重置配置失败: ' + error.message, 'error');
        }
    }

    /**
     * 刷新数据
     */
    async refreshData() {
        try {
            console.log('[WorldBookConfigPanel] 🔄 刷新世界书数据...');
            
            // 刷新世界书管理器缓存
            await this.worldBookManager.refreshCache();
            
            // 重新加载数据
            await this.loadData();
            
            // 重新渲染
            await this.render(this.container.parentNode);
            
            this.showToast('数据已刷新', 'success');
            
            console.log('[WorldBookConfigPanel] ✅ 世界书数据刷新完成');
            
        } catch (error) {
            console.error('[WorldBookConfigPanel] ❌ 刷新数据失败:', error);
            this.showToast('刷新数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 显示Toast消息
     */
    showToast(message, type = 'info') {
        // 这里可以集成现有的Toast系统
        console.log(`[WorldBookConfigPanel] 📢 ${type.toUpperCase()}: ${message}`);
        
        // 简单的临时提示实现
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            max-width: 300px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 显示面板
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
        }
    }

    /**
     * 隐藏面板
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.visible = false;
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            visible: this.visible,
            selectedBooks: Array.from(this.selectedBooks),
            enabledEntries: Object.fromEntries(
                Array.from(this.enabledEntries.entries()).map(([k, v]) => [k, Array.from(v)])
            ),
            characterCount: this.characterCount,
            searchText: this.searchText
        };
    }
}
