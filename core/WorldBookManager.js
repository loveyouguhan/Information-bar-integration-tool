/**
 * WorldBookManager
 * 
 * 世界书管理器 - 负责管理SillyTavern的世界书集成
 * 功能包括：
 * - 获取可用的世界书列表
 * - 管理世界书条目的启用/禁用状态
 * - 计算世界书内容的字符数
 * - 与API配置集成
 */

export class WorldBookManager {
    constructor(configManager, eventSystem, dataCore) {
        console.log('[WorldBookManager] 📚 世界书管理器初始化开始');
        
        this.configManager = configManager;
        this.eventSystem = eventSystem;
        this.dataCore = dataCore;
        
        // 状态管理
        this.initialized = false;
        this.errorCount = 0;
        
        // 世界书配置
        this.config = {
            source: 'default', // 'default' | 'manual'
            maxCharacters: 50000, // 最大字符数限制
            selectedBooks: [], // 手动选择的世界书列表
            enabledEntries: new Map(), // 启用的条目映射 bookId -> Set<entryId>
            autoUpdate: true // 自动更新配置
        };
        
        // 缓存
        this.worldBooksCache = new Map();
        this.entriesCache = new Map();
        this.lastCacheUpdate = 0;
        this.cacheTimeout = 30000; // 30秒缓存超时
        
        // 绑定方法
        this.bindMethods();
        
        console.log('[WorldBookManager] ✅ 世界书管理器初始化完成');
    }

    /**
     * 绑定方法到实例
     */
    bindMethods() {
        this.init = this.init.bind(this);
        this.loadConfig = this.loadConfig.bind(this);
        this.saveConfig = this.saveConfig.bind(this);
        this.getAvailableWorldBooks = this.getAvailableWorldBooks.bind(this);
        this.getWorldBookEntries = this.getWorldBookEntries.bind(this);
        this.calculateCharacterCount = this.calculateCharacterCount.bind(this);
        this.getSelectedWorldBookContent = this.getSelectedWorldBookContent.bind(this);
    }

    /**
     * 初始化世界书管理器
     */
    async init() {
        try {
            console.log('[WorldBookManager] 🚀 开始初始化世界书管理器...');
            
            // 加载配置
            await this.loadConfig();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 初始化缓存
            await this.refreshCache();
            
            this.initialized = true;
            console.log('[WorldBookManager] ✅ 世界书管理器初始化完成');
            
            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('worldbook:initialized', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        if (this.eventSystem) {
            // 监听配置变更事件
            this.eventSystem.on('config:changed', (data) => {
                if (data.key && data.key.startsWith('worldBook.')) {
                    this.handleConfigChange(data);
                }
            });
            
            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', () => {
                this.refreshCache();
            });
        }
    }

    /**
     * 加载世界书配置
     */
    async loadConfig() {
        try {
            console.log('[WorldBookManager] 📥 加载世界书配置...');
            
            if (this.configManager) {
                this.config.source = await this.configManager.getConfig('worldBook.source') || 'default';
                this.config.maxCharacters = await this.configManager.getConfig('worldBook.maxCharacters') || 50000;
                this.config.selectedBooks = await this.configManager.getConfig('worldBook.selectedBooks') || [];
                this.config.autoUpdate = await this.configManager.getConfig('worldBook.autoUpdate') !== false;
                
                // 加载启用的条目配置
                const enabledEntriesData = await this.configManager.getConfig('worldBook.enabledEntries') || {};
                this.config.enabledEntries = new Map();
                
                for (const [bookId, entryIds] of Object.entries(enabledEntriesData)) {
                    this.config.enabledEntries.set(bookId, new Set(entryIds));
                }
                
                console.log('[WorldBookManager] ✅ 世界书配置加载完成:', this.config);
            }
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 加载配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 保存世界书配置
     */
    async saveConfig() {
        try {
            console.log('[WorldBookManager] 💾 保存世界书配置...');
            
            if (this.configManager) {
                await this.configManager.setConfig('worldBook.source', this.config.source);
                await this.configManager.setConfig('worldBook.maxCharacters', this.config.maxCharacters);
                await this.configManager.setConfig('worldBook.selectedBooks', this.config.selectedBooks);
                await this.configManager.setConfig('worldBook.autoUpdate', this.config.autoUpdate);
                
                // 保存启用的条目配置
                const enabledEntriesData = {};
                for (const [bookId, entryIds] of this.config.enabledEntries.entries()) {
                    enabledEntriesData[bookId] = Array.from(entryIds);
                }
                await this.configManager.setConfig('worldBook.enabledEntries', enabledEntriesData);
                
                console.log('[WorldBookManager] ✅ 世界书配置保存完成');
                
                // 触发配置保存事件
                if (this.eventSystem) {
                    this.eventSystem.emit('worldbook:config:saved', {
                        config: this.config,
                        timestamp: Date.now()
                    });
                }
            }
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 保存配置失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 获取可用的世界书列表
     */
    async getAvailableWorldBooks() {
        try {
            // 检查缓存
            if (this.worldBooksCache.has('all') &&
                Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
                return this.worldBooksCache.get('all');
            }

            console.log('[WorldBookManager] 📚 获取可用世界书列表...');

            const worldBooks = [];

            // 获取SillyTavern上下文
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[WorldBookManager] ⚠️ 无法获取SillyTavern上下文');
                return worldBooks;
            }

            // 🔧 修复：使用正确的SillyTavern世界书API
            // 首先更新世界书列表
            if (typeof context.updateWorldInfoList === 'function') {
                await context.updateWorldInfoList();
            }

            // 🔧 修复：从DOM元素获取世界书列表
            const worldInfoSelect = document.querySelector('#world_info');
            const worldNames = [];
            const selectedWorldInfo = [];

            if (worldInfoSelect) {
                const options = Array.from(worldInfoSelect.options);
                options.forEach(option => {
                    if (option.value && option.text && option.text !== '--- 选择以编辑 ---') {
                        worldNames.push(option.text);
                        if (option.selected) {
                            selectedWorldInfo.push(option.text);
                        }
                    }
                });
            }

            console.log('[WorldBookManager] 📋 找到世界书文件:', worldNames);
            console.log('[WorldBookManager] 📋 当前选中的世界书:', selectedWorldInfo);

            // 遍历所有世界书文件
            for (let i = 0; i < worldNames.length; i++) {
                const worldName = worldNames[i];
                const isSelected = selectedWorldInfo.includes(worldName);

                try {
                    // 加载世界书数据
                    let worldData = null;
                    if (typeof context.loadWorldInfo === 'function') {
                        worldData = await context.loadWorldInfo(worldName);
                    }

                    // 🔧 修复：正确计算条目数
                    let entryCount = 0;
                    if (worldData?.entries) {
                        if (Array.isArray(worldData.entries)) {
                            entryCount = worldData.entries.length;
                        } else if (typeof worldData.entries === 'object') {
                            entryCount = Object.keys(worldData.entries).length;
                        }
                    }

                    const worldBook = {
                        id: `world_${i}`,
                        name: worldName,
                        description: worldData?.description || `世界书文件: ${worldName}`,
                        entries: worldData?.entries || [],
                        entryCount: entryCount,
                        source: 'file',
                        isDefault: isSelected,
                        fileName: worldName,
                        data: worldData
                    };

                    worldBooks.push(worldBook);

                } catch (error) {
                    console.warn(`[WorldBookManager] ⚠️ 加载世界书失败: ${worldName}`, error);

                    // 即使加载失败，也添加基本信息
                    worldBooks.push({
                        id: `world_${i}`,
                        name: worldName,
                        description: `世界书文件: ${worldName} (加载失败)`,
                        entries: [],
                        entryCount: 0,
                        source: 'file',
                        isDefault: isSelected,
                        fileName: worldName,
                        error: error.message
                    });
                }
            }

            // 🔧 修复：不再将当前会话条目作为独立世界书
            // 当前激活的条目应该通过真正的世界书文件来管理

            // 缓存结果
            this.worldBooksCache.set('all', worldBooks);
            this.lastCacheUpdate = Date.now();

            console.log(`[WorldBookManager] ✅ 找到 ${worldBooks.length} 个世界书`);
            return worldBooks;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取世界书列表失败:', error);
            this.handleError(error);
            return [];
        }
    }

    /**
     * 获取指定世界书的条目列表
     */
    async getWorldBookEntries(bookId) {
        try {
            // 检查缓存
            if (this.entriesCache.has(bookId) &&
                Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
                return this.entriesCache.get(bookId);
            }

            console.log(`[WorldBookManager] 📖 获取世界书条目: ${bookId}`);

            const worldBooks = await this.getAvailableWorldBooks();
            const book = worldBooks.find(b => b.id === bookId);

            if (!book) {
                console.warn(`[WorldBookManager] ⚠️ 未找到世界书: ${bookId}`);
                return [];
            }

            // 🔧 修复：正确处理不同来源的世界书条目
            let rawEntries = book.entries || [];

            // 如果是文件来源的世界书，确保数据格式正确
            if (book.source === 'file' && book.data && book.data.entries) {
                rawEntries = book.data.entries;
            }

            // 🔧 修复：处理对象格式的条目数据
            let entriesArray = [];
            if (Array.isArray(rawEntries)) {
                entriesArray = rawEntries;
            } else if (typeof rawEntries === 'object' && rawEntries !== null) {
                // 将对象转换为数组
                entriesArray = Object.values(rawEntries);
                console.log(`[WorldBookManager] 📖 将对象格式的条目转换为数组: ${entriesArray.length} 个条目`);
            } else {
                console.warn(`[WorldBookManager] ⚠️ 未知的条目数据格式: ${bookId}`, rawEntries);
                entriesArray = [];
            }

            const entries = entriesArray.map((entry, index) => {
                // 处理关键词字段
                let keys = '';
                if (Array.isArray(entry.key)) {
                    keys = entry.key.join(', ');
                } else if (Array.isArray(entry.keys)) {
                    keys = entry.keys.join(', ');
                } else if (typeof entry.key === 'string') {
                    keys = entry.key;
                } else if (typeof entry.keys === 'string') {
                    keys = entry.keys;
                }

                // 处理内容字段
                const content = entry.content || entry.text || '';

                return {
                    id: entry.uid || entry.id || `${bookId}_entry_${index}`,
                    key: keys,
                    content: content,
                    comment: entry.comment || entry.memo || '',
                    selective: entry.selective || false,
                    constant: entry.constant || false,
                    order: entry.order || entry.priority || 0,
                    position: entry.position || 0,
                    disable: entry.disable || entry.disabled || false,
                    characterCount: content.length,
                    preview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                    // 额外的SillyTavern特有属性
                    depth: entry.depth || 0,
                    probability: entry.probability || 100,
                    useProbability: entry.useProbability || false,
                    excludeRecursion: entry.excludeRecursion || false,
                    preventRecursion: entry.preventRecursion || false,
                    delayUntilRecursion: entry.delayUntilRecursion || false
                };
            });

            // 缓存结果
            this.entriesCache.set(bookId, entries);

            console.log(`[WorldBookManager] ✅ 获取到 ${entries.length} 个条目`);
            return entries;

        } catch (error) {
            console.error(`[WorldBookManager] ❌ 获取世界书条目失败 (${bookId}):`, error);
            this.handleError(error);
            return [];
        }
    }

    /**
     * 获取启用的世界书内容（供自定义API使用）
     */
    async getEnabledWorldBookContent() {
        try {
            console.log('[WorldBookManager] 📖 获取启用的世界书内容...');

            const enabledEntries = [];
            let totalCharacters = 0;

            if (this.config.source === 'default') {
                // 默认模式：使用角色绑定的世界书
                const worldBooks = await this.getAvailableWorldBooks();
                const defaultBook = worldBooks.find(book => book.isDefault);

                if (defaultBook) {
                    console.log(`[WorldBookManager] 📖 使用默认世界书: ${defaultBook.name}`);
                    const entries = await this.getWorldBookEntries(defaultBook.id);

                    for (const entry of entries) {
                        if (!entry.disable) {
                            enabledEntries.push({
                                id: entry.id,
                                key: entry.key,
                                content: entry.content,
                                characterCount: entry.characterCount || 0,
                                source: defaultBook.name,
                                worldBookId: defaultBook.id
                            });
                            totalCharacters += entry.characterCount || 0;
                        }
                    }
                }

            } else {
                // 手动模式：获取选中的世界书和条目
                console.log(`[WorldBookManager] 📖 手动模式，处理 ${this.config.selectedBooks.size} 个世界书`);

                for (const bookId of this.config.selectedBooks) {
                    const worldBooks = await this.getAvailableWorldBooks();
                    const book = worldBooks.find(b => b.id === bookId);

                    if (book) {
                        const entries = await this.getWorldBookEntries(bookId);
                        const enabledEntryIds = this.config.enabledEntries.get(bookId) || new Set();

                        console.log(`[WorldBookManager] 📖 处理世界书 ${book.name}: ${entries.length} 个条目, ${enabledEntryIds.size} 个启用`);

                        for (const entry of entries) {
                            // 如果没有特别指定启用的条目，则默认所有条目都启用
                            const isEnabled = enabledEntryIds.size === 0 || enabledEntryIds.has(entry.id);

                            if (!entry.disable && isEnabled) {
                                enabledEntries.push({
                                    id: entry.id,
                                    key: entry.key,
                                    content: entry.content,
                                    characterCount: entry.characterCount || 0,
                                    source: book.name,
                                    worldBookId: book.id
                                });
                                totalCharacters += entry.characterCount || 0;
                            }
                        }
                    }
                }
            }

            // 检查字符数限制
            const isOverLimit = totalCharacters > this.config.maxCharacters;
            if (isOverLimit) {
                console.warn(`[WorldBookManager] ⚠️ 世界书内容超出限制: ${totalCharacters}/${this.config.maxCharacters} 字符`);

                // 截断内容以符合限制
                let currentCharacters = 0;
                const truncatedEntries = [];

                for (const entry of enabledEntries) {
                    if (currentCharacters + entry.characterCount <= this.config.maxCharacters) {
                        truncatedEntries.push(entry);
                        currentCharacters += entry.characterCount;
                    } else {
                        // 部分截断最后一个条目
                        const remainingChars = this.config.maxCharacters - currentCharacters;
                        if (remainingChars > 0) {
                            truncatedEntries.push({
                                ...entry,
                                content: entry.content.substring(0, remainingChars),
                                characterCount: remainingChars,
                                truncated: true
                            });
                        }
                        break;
                    }
                }

                console.log(`[WorldBookManager] ✂️ 内容已截断: ${truncatedEntries.length}/${enabledEntries.length} 个条目`);

                return {
                    entries: truncatedEntries,
                    totalCharacters: Math.min(totalCharacters, this.config.maxCharacters),
                    originalCharacters: totalCharacters,
                    isOverLimit: true,
                    truncated: true
                };
            }

            console.log(`[WorldBookManager] ✅ 获取到 ${enabledEntries.length} 个启用的世界书条目, 总计 ${totalCharacters} 字符`);

            return {
                entries: enabledEntries,
                totalCharacters: totalCharacters,
                originalCharacters: totalCharacters,
                isOverLimit: false,
                truncated: false
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取启用的世界书内容失败:', error);
            this.handleError(error);
            return {
                entries: [],
                totalCharacters: 0,
                originalCharacters: 0,
                isOverLimit: false,
                truncated: false,
                error: error.message
            };
        }
    }

    /**
     * 计算当前配置的字符数
     */
    async calculateCharacterCount() {
        try {
            let totalCharacters = 0;

            console.log('[WorldBookManager] 📊 计算字符数，配置:', {
                source: this.config.source,
                selectedBooks: Array.from(this.config.selectedBooks),
                enabledEntries: Object.fromEntries(this.config.enabledEntries)
            });

            if (this.config.source === 'default') {
                // 默认模式：使用角色绑定的世界书
                const worldBooks = await this.getAvailableWorldBooks();
                const defaultBook = worldBooks.find(book => book.isDefault);

                if (defaultBook) {
                    console.log('[WorldBookManager] 📊 使用默认世界书:', defaultBook.name);
                    const entries = await this.getWorldBookEntries(defaultBook.id);
                    totalCharacters = entries
                        .filter(entry => !entry.disable)
                        .reduce((sum, entry) => sum + (entry.characterCount || 0), 0);
                    console.log('[WorldBookManager] 📊 默认模式字符数:', totalCharacters);
                }

            } else {
                // 手动模式：计算选中的世界书和条目
                console.log('[WorldBookManager] 📊 手动模式，选中的世界书:', this.config.selectedBooks);

                for (const bookId of this.config.selectedBooks) {
                    const entries = await this.getWorldBookEntries(bookId);
                    const enabledEntries = this.config.enabledEntries.get(bookId) || new Set();

                    console.log(`[WorldBookManager] 📊 世界书 ${bookId}:`, {
                        totalEntries: entries.length,
                        enabledEntriesCount: enabledEntries.size
                    });

                    for (const entry of entries) {
                        // 如果没有特别指定启用的条目，则默认所有条目都启用
                        const isEnabled = enabledEntries.size === 0 || enabledEntries.has(entry.id);

                        if (!entry.disable && isEnabled) {
                            const entryChars = entry.characterCount || 0;
                            totalCharacters += entryChars;
                            console.log(`[WorldBookManager] 📊 条目 ${entry.id}: ${entryChars} 字符`);
                        }
                    }
                }

                console.log('[WorldBookManager] 📊 手动模式总字符数:', totalCharacters);
            }

            const result = {
                total: totalCharacters,
                limit: this.config.maxCharacters,
                percentage: Math.round((totalCharacters / this.config.maxCharacters) * 100),
                isOverLimit: totalCharacters > this.config.maxCharacters
            };

            console.log('[WorldBookManager] 📊 字符数计算结果:', result);
            return result;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 计算字符数失败:', error);
            this.handleError(error);
            return { total: 0, limit: this.config.maxCharacters, percentage: 0, isOverLimit: false };
        }
    }

    /**
     * 获取选中的世界书内容（用于API注入）
     */
    async getSelectedWorldBookContent() {
        try {
            const content = [];
            
            if (this.config.source === 'default') {
                // 默认模式：使用角色绑定的世界书
                const worldBooks = await this.getAvailableWorldBooks();
                const defaultBook = worldBooks.find(book => book.isDefault);
                
                if (defaultBook) {
                    const entries = await this.getWorldBookEntries(defaultBook.id);
                    entries
                        .filter(entry => !entry.disable)
                        .sort((a, b) => a.order - b.order)
                        .forEach(entry => {
                            if (entry.content.trim()) {
                                content.push({
                                    key: entry.key,
                                    content: entry.content,
                                    source: defaultBook.name
                                });
                            }
                        });
                }
                
            } else {
                // 手动模式：获取选中的世界书和条目
                for (const bookId of this.config.selectedBooks) {
                    const worldBooks = await this.getAvailableWorldBooks();
                    const book = worldBooks.find(b => b.id === bookId);
                    
                    if (book) {
                        const entries = await this.getWorldBookEntries(bookId);
                        const enabledEntries = this.config.enabledEntries.get(bookId) || new Set();
                        
                        entries
                            .filter(entry => !entry.disable && (enabledEntries.size === 0 || enabledEntries.has(entry.id)))
                            .sort((a, b) => a.order - b.order)
                            .forEach(entry => {
                                if (entry.content.trim()) {
                                    content.push({
                                        key: entry.key,
                                        content: entry.content,
                                        source: book.name
                                    });
                                }
                            });
                    }
                }
            }
            
            // 应用字符数限制
            let totalCharacters = 0;
            const limitedContent = [];
            
            for (const item of content) {
                const itemLength = item.content.length;
                if (totalCharacters + itemLength <= this.config.maxCharacters) {
                    limitedContent.push(item);
                    totalCharacters += itemLength;
                } else {
                    // 如果超出限制，截断最后一个条目
                    const remainingChars = this.config.maxCharacters - totalCharacters;
                    if (remainingChars > 0) {
                        limitedContent.push({
                            ...item,
                            content: item.content.substring(0, remainingChars) + '...[截断]'
                        });
                    }
                    break;
                }
            }
            
            return {
                entries: limitedContent,
                totalCharacters,
                truncated: content.length > limitedContent.length
            };
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取世界书内容失败:', error);
            this.handleError(error);
            return { entries: [], totalCharacters: 0, truncated: false };
        }
    }

    /**
     * 刷新缓存
     */
    async refreshCache() {
        try {
            console.log('[WorldBookManager] 🔄 刷新世界书缓存...');
            
            this.worldBooksCache.clear();
            this.entriesCache.clear();
            this.lastCacheUpdate = 0;
            
            // 预加载世界书列表
            await this.getAvailableWorldBooks();
            
            console.log('[WorldBookManager] ✅ 世界书缓存刷新完成');
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 刷新缓存失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理配置变更
     */
    handleConfigChange(data) {
        try {
            console.log('[WorldBookManager] 🔧 处理配置变更:', data.key);
            
            // 重新加载配置
            this.loadConfig();
            
            // 刷新缓存
            this.refreshCache();
            
        } catch (error) {
            console.error('[WorldBookManager] ❌ 处理配置变更失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[WorldBookManager] ❌ 错误计数:', this.errorCount);
        
        if (this.eventSystem) {
            this.eventSystem.emit('worldbook:error', {
                error: error.message,
                count: this.errorCount,
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
            errorCount: this.errorCount,
            config: this.config,
            cacheSize: {
                worldBooks: this.worldBooksCache.size,
                entries: this.entriesCache.size
            },
            lastCacheUpdate: this.lastCacheUpdate
        };
    }
}
