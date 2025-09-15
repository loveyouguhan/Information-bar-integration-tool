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
        
        // 🔧 优化缓存机制
        this.worldBooksCache = new Map();
        this.entriesCache = new Map();
        this.lastCacheUpdate = 0;
        this.cacheTimeout = 5000; // 5秒缓存超时，更及时响应变化
        this.forceRefreshFlag = false; // 强制刷新标志
        
        // 🚀 新增：世界书读取状态管理
        this.readingState = {
            isReading: false,           // 是否正在读取
            lastReadTime: 0,            // 上次读取时间
            readingQueue: new Set(),    // 读取队列，避免重复请求
            failureCount: 0,            // 连续失败次数
            lastError: null             // 最后的错误信息
        };
        
        // 🔄 重试机制配置
        this.retryConfig = {
            maxRetries: 3,              // 最大重试次数
            retryDelay: 1000,           // 重试延迟（毫秒）
            backoffMultiplier: 2        // 退避乘数
        };
        
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
     * 🚀 获取可用的世界书列表（优化版）
     */
    async getAvailableWorldBooks() {
        const cacheKey = 'all';
        
        try {
            // 检查是否正在读取中，避免重复请求
            if (this.readingState.isReading && this.readingState.readingQueue.has(cacheKey)) {
                console.log('[WorldBookManager] 🔄 世界书列表正在读取中，等待完成...');
                return await this.waitForCurrentReading(cacheKey);
            }
            
            // 检查缓存（除非强制刷新）
            if (!this.forceRefreshFlag && 
                this.worldBooksCache.has(cacheKey) &&
                Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
                console.log('[WorldBookManager] 📋 使用缓存的世界书列表');
                return this.worldBooksCache.get(cacheKey);
            }

            // 标记开始读取
            this.readingState.isReading = true;
            this.readingState.readingQueue.add(cacheKey);
            this.readingState.lastReadTime = Date.now();

            console.log('[WorldBookManager] 📚 获取可用世界书列表...');

            // 🔧 优化：使用重试机制读取世界书
            const worldBooks = await this.executeWithRetry(() => this.readWorldBooksFromSillyTavern(), 'getAvailableWorldBooks');
            
            // 缓存结果
            this.worldBooksCache.set(cacheKey, worldBooks);
            this.lastCacheUpdate = Date.now();
            this.forceRefreshFlag = false;
            this.readingState.failureCount = 0;
            this.readingState.lastError = null;

            console.log(`[WorldBookManager] ✅ 找到 ${worldBooks.length} 个世界书`);
            return worldBooks;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取世界书列表失败:', error);
            this.readingState.failureCount++;
            this.readingState.lastError = error.message;
            this.handleError(error);
            return [];
        } finally {
            // 清理读取状态
            this.readingState.isReading = false;
            this.readingState.readingQueue.delete(cacheKey);
        }
    }

    /**
     * 🔧 从SillyTavern读取世界书数据（核心逻辑）
     */
    async readWorldBooksFromSillyTavern() {
            const worldBooks = [];

        // 🎯 优先级读取策略：避免无效的HTTP请求，优先使用本地/上下文数据
        const readStrategies = [
            () => this.readWorldBooksFromContext(),
            () => this.readWorldBooksFromDOM(),
            () => this.readWorldBooksFromGlobal()
        ];

        // 仅当检测到可用的SillyTavern世界书API时，才尝试HTTP API
        try {
            const api = this.getSillyTavernWorldInfoAPI();
            if (api) {
                readStrategies.push(() => this.readWorldBooksFromAPI());
            } else {
                console.log('[WorldBookManager] ℹ️ 未检测到SillyTavern世界书API，跳过HTTP接口读取');
            }
        } catch (e) {
            console.log('[WorldBookManager] ℹ️ 世界书API检测失败，跳过HTTP接口读取');
        }
        
        let lastError = null;
        
        for (const strategy of readStrategies) {
            try {
                console.log('[WorldBookManager] 🔄 尝试读取策略...');
                const result = await strategy();
                if (result && result.length > 0) {
                    console.log(`[WorldBookManager] ✅ 读取成功，获得 ${result.length} 个世界书`);
                    return result;
                }
            } catch (error) {
                console.warn('[WorldBookManager] ⚠️ 读取策略失败，尝试下一个:', error.message);
                lastError = error;
                continue;
            }
        }
        
        // 如果所有策略都失败，返回空数组并记录错误
        if (lastError) {
            console.error('[WorldBookManager] ❌ 所有读取策略都失败，最后错误:', lastError);
        }
        
        return worldBooks;
    }

    /**
     * 📡 方法1：从API读取世界书
     */
    async readWorldBooksFromAPI() {
        try {
            console.log('[WorldBookManager] 📡 尝试从API读取世界书...');

            // 🚀 修复：检查SillyTavern的世界书API端点
            let apiEndpoint = '/api/worldinfo/list';

            // 检查SillyTavern是否有世界书API
            if (window.SillyTavern && window.SillyTavern.getContext) {
                const context = window.SillyTavern.getContext();
                if (context && context.worldInfoData) {
                    // 直接从SillyTavern上下文获取世界书数据
                    console.log('[WorldBookManager] ✅ 从SillyTavern上下文获取世界书数据');
                    return this.parseWorldBookData(context.worldInfoData);
                }
            }

            // 尝试API调用，但处理404错误
            const response = await fetch(apiEndpoint, {
                method: 'GET',
                headers: this.getRequestHeaders()
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('[WorldBookManager] ⚠️ 世界书API不可用，跳过API读取');
                    return [];
                }
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const worldBookNames = await response.json();
            const worldBooks = [];
            
            for (const name of worldBookNames) {
                try {
                    const dataResponse = await fetch(`/api/worldinfo/get`, {
                        method: 'POST',
                        headers: this.getRequestHeaders(),
                        body: JSON.stringify({ name: name })
                    });
                    
                    if (dataResponse.ok) {
                        const worldData = await dataResponse.json();
                        worldBooks.push(this.formatWorldBookData(name, worldData, 'api'));
                    }
                } catch (error) {
                    console.warn(`[WorldBookManager] ⚠️ API加载世界书失败: ${name}`, error);
                    worldBooks.push(this.createFallbackWorldBook(name, 'api', error.message));
                }
            }
            
            return worldBooks;
            
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ API读取失败:', error);
            throw error;
        }
    }

    /**
     * 🚀 新增：解析世界书数据
     */
    parseWorldBookData(worldInfoData) {
        try {
            if (!worldInfoData) {
                console.log('[WorldBookManager] ⚠️ 世界书数据为空');
                return [];
            }

            const worldBooks = [];

            // 处理不同格式的世界书数据
            if (Array.isArray(worldInfoData)) {
                // 如果是数组格式
                worldInfoData.forEach((item, index) => {
                    worldBooks.push(this.formatWorldBookData(`WorldBook_${index}`, item, 'context'));
                });
            } else if (typeof worldInfoData === 'object') {
                // 如果是对象格式
                Object.keys(worldInfoData).forEach(key => {
                    worldBooks.push(this.formatWorldBookData(key, worldInfoData[key], 'context'));
                });
            }

            console.log(`[WorldBookManager] ✅ 从上下文解析到 ${worldBooks.length} 个世界书`);
            return worldBooks;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 解析世界书数据失败:', error);
            return [];
        }
    }

    /**
     * 🌐 方法2：从SillyTavern上下文读取
     */
    async readWorldBooksFromContext() {
        try {
            console.log('[WorldBookManager] 🌐 尝试从上下文读取世界书...');
            
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                throw new Error('无法获取SillyTavern上下文');
            }

            // 更新世界书列表
            if (typeof context.updateWorldInfoList === 'function') {
                await context.updateWorldInfoList();
            }

            // 获取世界书列表
            const worldInfoList = context.worldInfo || [];
            const worldBooks = [];

            for (const worldInfo of worldInfoList) {
                try {
                    let worldData = null;
                    if (typeof context.loadWorldInfo === 'function') {
                        worldData = await context.loadWorldInfo(worldInfo.name);
                    }
                    
                    worldBooks.push(this.formatWorldBookData(worldInfo.name, worldData, 'context', worldInfo));
                } catch (error) {
                    console.warn(`[WorldBookManager] ⚠️ 上下文加载世界书失败: ${worldInfo.name}`, error);
                    worldBooks.push(this.createFallbackWorldBook(worldInfo.name, 'context', error.message));
                }
            }

            return worldBooks;
            
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 上下文读取失败:', error);
            throw error;
        }
    }

    /**
     * 🏗️ 方法3：从DOM读取世界书
     */
    async readWorldBooksFromDOM() {
        try {
            console.log('[WorldBookManager] 🏗️ 尝试从DOM读取世界书...');
            
            const worldInfoSelect = document.querySelector('#world_info');
            if (!worldInfoSelect) {
                throw new Error('未找到世界书选择元素');
            }

            const worldNames = [];
            const selectedWorldInfo = [];
                const options = Array.from(worldInfoSelect.options);
            
                options.forEach(option => {
                    if (option.value && option.text && option.text !== '--- 选择以编辑 ---') {
                        worldNames.push(option.text);
                        if (option.selected) {
                            selectedWorldInfo.push(option.text);
                        }
                    }
                });

            console.log('[WorldBookManager] 📋 DOM找到世界书文件:', worldNames);
            console.log('[WorldBookManager] 📋 当前选中的世界书:', selectedWorldInfo);

            const context = window.SillyTavern?.getContext?.();
            const worldBooks = [];

            for (let i = 0; i < worldNames.length; i++) {
                const worldName = worldNames[i];
                const isSelected = selectedWorldInfo.includes(worldName);

                try {
                    let worldData = null;
                    if (context && typeof context.loadWorldInfo === 'function') {
                        worldData = await context.loadWorldInfo(worldName);
                    }

                    worldBooks.push(this.formatWorldBookData(worldName, worldData, 'dom', { isSelected, index: i }));

                } catch (error) {
                    console.warn(`[WorldBookManager] ⚠️ DOM加载世界书失败: ${worldName}`, error);
                    worldBooks.push(this.createFallbackWorldBook(worldName, 'dom', error.message, { isSelected, index: i }));
                }
            }

            return worldBooks;
            
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ DOM读取失败:', error);
            throw error;
        }
    }

    /**
     * 🌍 方法4：从全局变量读取（备用）
     */
    async readWorldBooksFromGlobal() {
        try {
            console.log('[WorldBookManager] 🌍 尝试从全局变量读取世界书...');
            
            const worldBooks = [];
            
            // 检查全局世界书变量
            if (window.world_info && window.world_info.entries) {
                const entries = window.world_info.entries;
                const entryCount = Array.isArray(entries) ? entries.length : Object.keys(entries).length;
                
                worldBooks.push({
                    id: 'world_global',
                    name: '当前激活的世界书',
                    description: '从全局变量获取的世界书',
                    entries: entries,
                    entryCount: entryCount,
                    source: 'global',
                    isDefault: true,
                    fileName: 'global',
                    data: window.world_info
                });
            }
            
            // 检查是否有其他全局世界书数据
            if (window.worldInfoData && Array.isArray(window.worldInfoData)) {
                window.worldInfoData.forEach((worldData, index) => {
                    if (worldData && worldData.name) {
                        worldBooks.push(this.formatWorldBookData(worldData.name, worldData, 'global', { index }));
                    }
                });
            }

            return worldBooks;
            
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 全局变量读取失败:', error);
            throw error;
        }
    }

    /**
     * 🔄 执行带重试机制的操作
     */
    async executeWithRetry(operation, operationName = '操作') {
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                console.log(`[WorldBookManager] 🔄 执行 ${operationName}，尝试 ${attempt}/${this.retryConfig.maxRetries}`);
                const result = await operation();
                
                if (attempt > 1) {
                    console.log(`[WorldBookManager] ✅ ${operationName} 在第 ${attempt} 次尝试中成功`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.warn(`[WorldBookManager] ⚠️ ${operationName} 第 ${attempt} 次尝试失败:`, error.message);
                
                if (attempt < this.retryConfig.maxRetries) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
                    console.log(`[WorldBookManager] ⏳ 等待 ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`[WorldBookManager] ❌ ${operationName} 在 ${this.retryConfig.maxRetries} 次尝试后最终失败`);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * ⏳ 等待当前读取操作完成
     */
    async waitForCurrentReading(cacheKey, maxWaitTime = 10000) {
        const startTime = Date.now();
        
        while (this.readingState.isReading && this.readingState.readingQueue.has(cacheKey)) {
            if (Date.now() - startTime > maxWaitTime) {
                console.warn('[WorldBookManager] ⚠️ 等待读取操作超时');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 返回缓存的结果或空数组
        return this.worldBooksCache.get(cacheKey) || [];
    }

    /**
     * 📋 格式化世界书数据
     */
    formatWorldBookData(name, worldData, source, metadata = {}) {
        const { isSelected = false, index = 0 } = metadata;
        
                    let entryCount = 0;
                    if (worldData?.entries) {
                        if (Array.isArray(worldData.entries)) {
                            entryCount = worldData.entries.length;
                        } else if (typeof worldData.entries === 'object') {
                            entryCount = Object.keys(worldData.entries).length;
                        }
                    }

        return {
            id: `world_${source}_${index}`,
            name: name,
            description: worldData?.description || `世界书文件: ${name}`,
                        entries: worldData?.entries || [],
                        entryCount: entryCount,
            source: source,
                        isDefault: isSelected,
            fileName: name,
            data: worldData,
            readTime: Date.now(),
            ...metadata
        };
    }

    /**
     * 🚨 创建备用世界书对象（当加载失败时）
     */
    createFallbackWorldBook(name, source, errorMessage, metadata = {}) {
        const { isSelected = false, index = 0 } = metadata;
        
        return {
            id: `world_${source}_${index}_fallback`,
            name: name,
            description: `世界书文件: ${name} (${errorMessage})`,
                        entries: [],
                        entryCount: 0,
            source: source,
                        isDefault: isSelected,
            fileName: name,
            error: errorMessage,
            isFallback: true,
            readTime: Date.now(),
            ...metadata
        };
    }

    /**
     * 🔄 强制刷新世界书缓存
     */
    forceRefreshWorldBooks() {
        console.log('[WorldBookManager] 🔄 强制刷新世界书缓存...');
        this.forceRefreshFlag = true;
        this.worldBooksCache.clear();
        this.entriesCache.clear();
        this.lastCacheUpdate = 0;
        return this.getAvailableWorldBooks();
    }

    /**
     * 🚀 获取指定世界书的条目列表（优化版）
     */
    async getWorldBookEntries(bookId) {
        try {
            // 检查是否正在读取中
            if (this.readingState.isReading && this.readingState.readingQueue.has(bookId)) {
                console.log(`[WorldBookManager] 🔄 世界书条目 ${bookId} 正在读取中，等待完成...`);
                return await this.waitForCurrentReading(bookId);
            }
            
            // 检查缓存
            if (!this.forceRefreshFlag && 
                this.entriesCache.has(bookId) &&
                Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
                console.log(`[WorldBookManager] 📋 使用缓存的世界书条目: ${bookId}`);
                return this.entriesCache.get(bookId);
            }

            // 标记开始读取
            this.readingState.isReading = true;
            this.readingState.readingQueue.add(bookId);

            console.log(`[WorldBookManager] 📖 获取世界书条目: ${bookId}`);

            // 🔧 使用重试机制获取条目
            const entries = await this.executeWithRetry(() => this.readWorldBookEntries(bookId), `getWorldBookEntries(${bookId})`);

            // 缓存结果
            this.entriesCache.set(bookId, entries);

            console.log(`[WorldBookManager] ✅ 获取到 ${entries.length} 个条目`);
            return entries;

        } catch (error) {
            console.error(`[WorldBookManager] ❌ 获取世界书条目失败 (${bookId}):`, error);
            this.readingState.failureCount++;
            this.readingState.lastError = error.message;
            this.handleError(error);
            return [];
        } finally {
            // 清理读取状态
            this.readingState.isReading = false;
            this.readingState.readingQueue.delete(bookId);
        }
    }

    /**
     * 📖 读取世界书条目（核心逻辑）
     */
    async readWorldBookEntries(bookId) {
            const worldBooks = await this.getAvailableWorldBooks();
            const book = worldBooks.find(b => b.id === bookId);

            if (!book) {
            throw new Error(`未找到世界书: ${bookId}`);
        }

        // 🎯 多策略读取条目
        const readStrategies = [
            () => this.readEntriesFromData(book),
            () => this.readEntriesFromAPI(book.name),
            () => this.readEntriesFromGlobal(book.name)
        ];

        let lastError = null;
        
        for (const strategy of readStrategies) {
            try {
                const entries = await strategy();
                if (entries && entries.length >= 0) { // 允许空数组
                    return this.normalizeEntries(entries, bookId);
                }
            } catch (error) {
                console.warn(`[WorldBookManager] ⚠️ 条目读取策略失败: ${error.message}`);
                lastError = error;
                continue;
            }
        }

        if (lastError) {
            throw lastError;
        }

                return [];
            }

    /**
     * 📊 从世界书数据中读取条目
     */
    async readEntriesFromData(book) {
        console.log('[WorldBookManager] 📊 从世界书数据中读取条目...');
        
            let rawEntries = book.entries || [];

            // 如果是文件来源的世界书，确保数据格式正确
        if ((book.source === 'file' || book.source === 'dom') && book.data && book.data.entries) {
                rawEntries = book.data.entries;
            }

        // 🔧 处理不同格式的条目数据
            if (Array.isArray(rawEntries)) {
            return rawEntries;
            } else if (typeof rawEntries === 'object' && rawEntries !== null) {
                // 将对象转换为数组
            const entriesArray = Object.values(rawEntries);
            console.log(`[WorldBookManager] 📊 将对象格式转换为数组: ${entriesArray.length} 个条目`);
            return entriesArray;
            } else {
            console.warn(`[WorldBookManager] ⚠️ 未知的条目数据格式:`, typeof rawEntries);
            return [];
        }
    }

    /**
     * 📡 从API读取条目
     */
    async readEntriesFromAPI(worldBookName) {
        console.log('[WorldBookManager] 📡 从API读取条目...');
        
        try {
            const response = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({ name: worldBookName })
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const worldData = await response.json();
            return worldData.entries || [];
            
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ API读取条目失败:', error);
            throw error;
        }
    }

    /**
     * 🌍 从全局变量读取条目
     */
    async readEntriesFromGlobal(worldBookName) {
        console.log('[WorldBookManager] 🌍 从全局变量读取条目...');
        
        // 检查当前激活的世界书
        if (window.world_info && window.world_info.entries) {
            const entries = window.world_info.entries;
            return Array.isArray(entries) ? entries : Object.values(entries);
        }

        // 检查世界书数据数组
        if (window.worldInfoData && Array.isArray(window.worldInfoData)) {
            const worldData = window.worldInfoData.find(data => data.name === worldBookName);
            if (worldData && worldData.entries) {
                return Array.isArray(worldData.entries) ? worldData.entries : Object.values(worldData.entries);
            }
        }

        return [];
    }

    /**
     * 🔧 标准化条目数据格式
     */
    normalizeEntries(rawEntries, bookId) {
        if (!Array.isArray(rawEntries)) {
            console.warn('[WorldBookManager] ⚠️ 条目数据不是数组格式');
            return [];
        }

        return rawEntries.map((entry, index) => {
            // 🔧 处理关键词字段（支持多种格式）
                let keys = '';
            const keyFields = [entry.key, entry.keys, entry.keyword, entry.keywords];
            
            for (const keyField of keyFields) {
                if (Array.isArray(keyField)) {
                    keys = keyField.join(', ');
                    break;
                } else if (typeof keyField === 'string' && keyField.trim()) {
                    keys = keyField;
                    break;
                }
            }

            // 🔧 处理内容字段
            const content = entry.content || entry.text || entry.description || '';

            // 🔧 处理注释字段
            const comment = entry.comment || entry.memo || entry.title || entry.name || '';

                return {
                id: entry.uid || entry.id || `${bookId}_entry_${index}_${Date.now()}`,
                    key: keys,
                    content: content,
                comment: comment,
                selective: entry.selective !== false, // 默认为true
                    constant: entry.constant || false,
                order: entry.order || entry.priority || index,
                    position: entry.position || 0,
                    disable: entry.disable || entry.disabled || false,
                    characterCount: content.length,
                preview: content.length > 50 ? content.substring(0, 50) + '...' : content,
                // SillyTavern特有属性
                    depth: entry.depth || 0,
                    probability: entry.probability || 100,
                useProbability: entry.useProbability !== false, // 默认为true
                    excludeRecursion: entry.excludeRecursion || false,
                    preventRecursion: entry.preventRecursion || false,
                delayUntilRecursion: entry.delayUntilRecursion || false,
                // 额外属性
                keysecondary: entry.keysecondary || [],
                selectiveLogic: entry.selectiveLogic || 0,
                addMemo: entry.addMemo !== false, // 默认为true
                group: entry.group || '',
                groupOverride: entry.groupOverride || false,
                groupWeight: entry.groupWeight || 100,
                // 元数据
                sourceBook: bookId,
                lastUpdated: Date.now(),
                normalizedAt: Date.now()
                };
            });
    }

    /**
     * 🚀 获取启用的世界书内容（供自定义API使用）（优化版）
     */
    async getEnabledWorldBookContent() {
        try {
            console.log('[WorldBookManager] 📖 获取启用的世界书内容...');

            // 🔧 使用重试机制确保稳定性
            const result = await this.executeWithRetry(() => this.collectEnabledWorldBookContent(), 'getEnabledWorldBookContent');
            
            console.log(`[WorldBookManager] ✅ 获取到 ${result.entries.length} 个启用的世界书条目, 总计 ${result.totalCharacters} 字符`);
            return result;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取启用的世界书内容失败:', error);
            this.handleError(error);
            return {
                entries: [],
                totalCharacters: 0,
                originalCharacters: 0,
                isOverLimit: false,
                truncated: false,
                error: error.message,
                readTime: Date.now()
            };
        }
    }

    /**
     * 📚 收集启用的世界书内容（核心逻辑）
     */
    async collectEnabledWorldBookContent() {
            const enabledEntries = [];
            let totalCharacters = 0;
        const processingStartTime = Date.now();

            if (this.config.source === 'default') {
                // 默认模式：使用角色绑定的世界书
            const result = await this.collectDefaultWorldBookContent();
            enabledEntries.push(...result.entries);
            totalCharacters += result.totalCharacters;

        } else {
            // 手动模式：获取选中的世界书和条目
            const result = await this.collectManualWorldBookContent();
            enabledEntries.push(...result.entries);
            totalCharacters += result.totalCharacters;
        }

        // 🎯 应用优先级排序
        const sortedEntries = this.sortEntriesByPriority(enabledEntries);

        // 🔧 应用字符数限制和智能截断
        const limitResult = this.applyCharacterLimit(sortedEntries, totalCharacters);

        const processingTime = Date.now() - processingStartTime;
        console.log(`[WorldBookManager] ⏱️ 内容收集完成，耗时: ${processingTime}ms`);

        return {
            ...limitResult,
            processingTime: processingTime,
            readTime: Date.now(),
            config: {
                source: this.config.source,
                maxCharacters: this.config.maxCharacters
            }
        };
    }

    /**
     * 📖 收集默认世界书内容
     */
    async collectDefaultWorldBookContent() {
        console.log('[WorldBookManager] 📖 收集默认世界书内容...');
        
        const enabledEntries = [];
        let totalCharacters = 0;

        // 🎯 多策略获取默认世界书
        const defaultBook = await this.findDefaultWorldBook();

                if (defaultBook) {
                    console.log(`[WorldBookManager] 📖 使用默认世界书: ${defaultBook.name}`);
            
            try {
                    const entries = await this.getWorldBookEntries(defaultBook.id);
                console.log(`[WorldBookManager] 📖 默认世界书包含 ${entries.length} 个条目`);

                    for (const entry of entries) {
                    if (this.isEntryEnabled(entry)) {
                        const processedEntry = this.processWorldBookEntry(entry, defaultBook);
                        enabledEntries.push(processedEntry);
                        totalCharacters += processedEntry.characterCount;
                    }
                }
                
                console.log(`[WorldBookManager] ✅ 默认世界书处理完成: ${enabledEntries.length} 个条目，${totalCharacters} 字符`);
                
            } catch (error) {
                console.error(`[WorldBookManager] ❌ 处理默认世界书失败: ${defaultBook.name}`, error);
            }
            } else {
            console.log('[WorldBookManager] ℹ️ 未找到默认世界书');
        }

        return { entries: enabledEntries, totalCharacters };
    }

    /**
     * 📖 收集手动选择的世界书内容
     */
    async collectManualWorldBookContent() {
        console.log('[WorldBookManager] 📖 收集手动选择的世界书内容...');
        
        const enabledEntries = [];
        let totalCharacters = 0;

        console.log(`[WorldBookManager] 📖 手动模式，处理 ${this.config.selectedBooks.length} 个世界书`);

                    const worldBooks = await this.getAvailableWorldBooks();

        for (const bookId of this.config.selectedBooks) {
                    const book = worldBooks.find(b => b.id === bookId);

            if (!book) {
                console.warn(`[WorldBookManager] ⚠️ 未找到选中的世界书: ${bookId}`);
                continue;
            }

            try {
                        const entries = await this.getWorldBookEntries(bookId);
                        const enabledEntryIds = this.config.enabledEntries.get(bookId) || new Set();

                console.log(`[WorldBookManager] 📖 处理世界书 ${book.name}: ${entries.length} 个条目, ${enabledEntryIds.size} 个指定启用`);

                let bookEntryCount = 0;
                let bookCharacterCount = 0;

                        for (const entry of entries) {
                            // 如果没有特别指定启用的条目，则默认所有条目都启用
                    const isSpecificallyEnabled = enabledEntryIds.size === 0 || enabledEntryIds.has(entry.id);

                    if (this.isEntryEnabled(entry) && isSpecificallyEnabled) {
                        const processedEntry = this.processWorldBookEntry(entry, book);
                        enabledEntries.push(processedEntry);
                        totalCharacters += processedEntry.characterCount;
                        bookEntryCount++;
                        bookCharacterCount += processedEntry.characterCount;
                    }
                }

                console.log(`[WorldBookManager] ✅ 世界书 ${book.name} 处理完成: ${bookEntryCount} 个条目，${bookCharacterCount} 字符`);

            } catch (error) {
                console.error(`[WorldBookManager] ❌ 处理世界书失败: ${book.name}`, error);
            }
        }

        return { entries: enabledEntries, totalCharacters };
    }

    /**
     * 🔍 查找默认世界书
     */
    async findDefaultWorldBook() {
        const worldBooks = await this.getAvailableWorldBooks();
        
        // 策略1：查找明确标记为默认的世界书
        let defaultBook = worldBooks.find(book => book.isDefault);
        if (defaultBook) {
            console.log('[WorldBookManager] 🎯 找到明确标记的默认世界书:', defaultBook.name);
            return defaultBook;
        }

        // 策略2：查找当前绑定的chat lore
        try {
            const chatMetadata = window.chat_metadata;
            if (chatMetadata && chatMetadata.world_info) {
                defaultBook = worldBooks.find(book => book.name === chatMetadata.world_info);
                if (defaultBook) {
                    console.log('[WorldBookManager] 🎯 找到chat lore绑定的世界书:', defaultBook.name);
                    return defaultBook;
                }
            }
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 检查chat metadata失败:', error);
        }

        // 策略3：查找第一个可用的世界书
        if (worldBooks.length > 0) {
            defaultBook = worldBooks[0];
            console.log('[WorldBookManager] 🎯 使用第一个可用的世界书:', defaultBook.name);
            return defaultBook;
        }

        console.log('[WorldBookManager] ❌ 未找到任何可用的世界书');
        return null;
    }

    /**
     * ✅ 检查条目是否启用
     */
    isEntryEnabled(entry) {
        // 基础检查：条目未被禁用
        if (entry.disable || entry.disabled) {
            return false;
        }

        // 检查是否有有效内容
        if (!entry.content || entry.content.trim().length === 0) {
            return false;
        }

        // 检查是否有关键词（对于选择性条目）
        if (entry.selective && (!entry.key || entry.key.trim().length === 0)) {
            return false;
        }

        return true;
    }

    /**
     * 🔧 处理世界书条目
     */
    processWorldBookEntry(entry, book) {
        const characterCount = entry.characterCount || entry.content.length;
        
        return {
                                    id: entry.id,
                                    key: entry.key,
                                    content: entry.content,
            characterCount: characterCount,
                                    source: book.name,
            worldBookId: book.id,
            // 额外的元数据
            comment: entry.comment,
            order: entry.order || 0,
            priority: this.calculateEntryPriority(entry),
            constant: entry.constant || false,
            selective: entry.selective || false,
            probability: entry.probability || 100,
            // 处理时间戳
            processedAt: Date.now(),
            sourceType: book.source
        };
    }

    /**
     * 📊 计算条目优先级
     */
    calculateEntryPriority(entry) {
        let priority = entry.order || 0;
        
        // 常驻条目优先级更高
        if (entry.constant) {
            priority += 1000;
        }
        
        // 高概率条目优先级更高
        if (entry.probability && entry.probability > 80) {
            priority += 100;
        }
        
        // 较新的条目优先级稍高
        if (entry.lastUpdated) {
            const age = Date.now() - entry.lastUpdated;
            const daysPassed = age / (24 * 60 * 60 * 1000);
            priority += Math.max(0, 50 - daysPassed);
        }
        
        return priority;
    }

    /**
     * 📋 按优先级排序条目
     */
    sortEntriesByPriority(entries) {
        return entries.sort((a, b) => {
            // 首先按优先级排序（降序）
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            
            // 然后按order排序（升序）
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            
            // 最后按字符数排序（升序，优先选择较短的条目）
            return a.characterCount - b.characterCount;
        });
    }

    /**
     * ✂️ 应用字符数限制
     */
    applyCharacterLimit(entries, totalCharacters) {
        const maxCharacters = this.config.maxCharacters;
        
        if (totalCharacters <= maxCharacters) {
            return {
                entries: entries,
                totalCharacters: totalCharacters,
                originalCharacters: totalCharacters,
                isOverLimit: false,
                truncated: false
            };
        }

        console.warn(`[WorldBookManager] ⚠️ 世界书内容超出限制: ${totalCharacters}/${maxCharacters} 字符`);

                let currentCharacters = 0;
                const truncatedEntries = [];

        for (const entry of entries) {
            if (currentCharacters + entry.characterCount <= maxCharacters) {
                // 完整添加条目
                        truncatedEntries.push(entry);
                        currentCharacters += entry.characterCount;
                    } else {
                // 检查是否还有剩余空间进行部分截断
                const remainingChars = maxCharacters - currentCharacters;
                if (remainingChars > 100) { // 至少保留100字符才有意义
                    const truncatedContent = entry.content.substring(0, remainingChars - 10) + '...[截断]';
                            truncatedEntries.push({
                                ...entry,
                        content: truncatedContent,
                        characterCount: truncatedContent.length,
                        truncated: true,
                        originalCharacterCount: entry.characterCount
                    });
                    currentCharacters += truncatedContent.length;
                        }
                        break;
                    }
                }

        console.log(`[WorldBookManager] ✂️ 内容已截断: ${truncatedEntries.length}/${entries.length} 个条目，${currentCharacters}/${totalCharacters} 字符`);

                return {
                    entries: truncatedEntries,
            totalCharacters: currentCharacters,
                    originalCharacters: totalCharacters,
                    isOverLimit: true,
            truncated: true,
            truncatedCount: entries.length - truncatedEntries.length
        };
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
     * 🚀 上传总结到世界书
     * @param {Object} summaryData - 总结数据
     * @param {Object} options - 上传选项
     * @returns {Promise<Object>} 上传结果
     */
    async uploadSummaryToWorldBook(summaryData, options = {}) {
        try {
            console.log('[WorldBookManager] 📤 开始上传总结到世界书...', summaryData.id);

            const {
                autoCreateWorldBook = true,
                bindToChatLore = true,
                entryNameFormat = 'auto', // 'auto', 'custom', 'floor_range'
                customEntryName = null,
                addTimestamp = true,
                useContentTags = true
            } = options;

            // 1. 获取或创建目标世界书
            const worldBookResult = await this.getOrCreateTargetWorldBook(autoCreateWorldBook);
            if (!worldBookResult.success) {
                throw new Error(`获取目标世界书失败: ${worldBookResult.error}`);
            }

            const { worldBookName, worldBookData, isNewWorldBook } = worldBookResult;

            // 2. 格式化总结内容为世界书条目
            const entryData = await this.formatSummaryAsWorldBookEntry(summaryData, {
                entryNameFormat,
                customEntryName,
                addTimestamp,
                useContentTags,
                worldBookData
            });

            // 3. 创建世界书条目
            const entryResult = await this.createWorldBookEntry(worldBookName, worldBookData, entryData);
            if (!entryResult.success) {
                throw new Error(`创建世界书条目失败: ${entryResult.error}`);
            }

            // 4. 绑定世界书到当前聊天（如果需要）
            if (bindToChatLore && isNewWorldBook) {
                await this.bindWorldBookToChatLore(worldBookName);
            }

            // 5. 刷新缓存
            await this.refreshCache();

            // 6. 触发事件
            if (this.eventSystem) {
                this.eventSystem.emit('worldbook:summary-uploaded', {
                    summaryId: summaryData.id,
                    worldBookName: worldBookName,
                    entryId: entryResult.entryId,
                    isNewWorldBook: isNewWorldBook,
                    timestamp: Date.now()
                });
            }

            console.log('[WorldBookManager] ✅ 总结上传完成:', {
                summaryId: summaryData.id,
                worldBook: worldBookName,
                entryId: entryResult.entryId
            });

            return {
                success: true,
                worldBookName: worldBookName,
                entryId: entryResult.entryId,
                entryName: entryData.entryName,
                isNewWorldBook: isNewWorldBook,
                message: `总结已成功上传到世界书 "${worldBookName}"`
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 上传总结到世界书失败:', error);
            this.handleError(error);

            return {
                success: false,
                error: error.message,
                message: `上传失败: ${error.message}`
            };
        }
    }

    /**
     * 🔍 获取或创建目标世界书（优先使用角色绑定的主世界书）
     */
    async getOrCreateTargetWorldBook(autoCreate = true) {
        try {
            // 1. 优先获取当前角色绑定的主世界书
            const primaryWorldBook = await this.getPrimaryCharacterWorldBook();
            if (primaryWorldBook) {
                console.log('[WorldBookManager] 📚 使用角色主世界书:', primaryWorldBook.name);
                return {
                    success: true,
                    worldBookName: primaryWorldBook.name,
                    worldBookData: primaryWorldBook.data,
                    isNewWorldBook: false
                };
            }

            // 2. 尝试获取当前聊天绑定的世界书
            const chatWorldBook = await this.getCurrentCharacterWorldBook();
            if (chatWorldBook) {
                console.log('[WorldBookManager] 📚 使用聊天绑定的世界书:', chatWorldBook.name);
                return {
                    success: true,
                    worldBookName: chatWorldBook.name,
                    worldBookData: chatWorldBook.data,
                    isNewWorldBook: false
                };
            }

            // 3. 如果没有现有世界书且允许自动创建
            if (autoCreate) {
                const newWorldBook = await this.createCharacterWorldBook();
                return {
                    success: true,
                    worldBookName: newWorldBook.name,
                    worldBookData: newWorldBook.data,
                    isNewWorldBook: true
                };
            }

            // 4. 不允许自动创建时返回错误
            return {
                success: false,
                error: '当前角色没有绑定世界书，且未启用自动创建'
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取或创建目标世界书失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 📚 获取角色卡绑定的主世界书
     */
    async getPrimaryCharacterWorldBook() {
        try {
            // 获取SillyTavern上下文
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[WorldBookManager] ⚠️ 无法获取SillyTavern上下文');
                return null;
            }

            // 检查当前角色的世界书设置
            const character = context.characters?.[context.characterId];
            if (character && character.data && character.data.extensions) {
                // SillyTavern使用 world 字段存储角色绑定的世界书名称
                const worldInfo = character.data.extensions.world_info || character.data.extensions.world;
                if (worldInfo) {
                    console.log('[WorldBookManager] 📚 找到角色卡绑定的世界书:', worldInfo);
                    
                    try {
                        let worldData = null;
                        if (typeof context.loadWorldInfo === 'function') {
                            worldData = await context.loadWorldInfo(worldInfo);
                        }

                        return {
                            name: worldInfo,
                            data: worldData || { entries: {} },
                            source: 'character_card'
                        };
                    } catch (loadError) {
                        console.warn('[WorldBookManager] ⚠️ 加载角色世界书失败:', loadError);
                    }
                }
            }

            // 检查全局世界书设置中是否有角色专属世界书
            const worldInfoSelect = document.querySelector('#world_info');
            if (worldInfoSelect && context.name2) {
                const characterName = context.name2;
                const options = Array.from(worldInfoSelect.options);
                
                // 查找以角色名开头的世界书（角色专属世界书）
                const characterWorldBook = options.find(opt => 
                    opt.text && opt.text.toLowerCase().startsWith(characterName.toLowerCase()) && opt.selected
                );
                
                if (characterWorldBook) {
                    const worldBookName = characterWorldBook.text;
                    console.log('[WorldBookManager] 📚 找到角色专属世界书:', worldBookName);
                    
                    try {
                        let worldData = null;
                        if (typeof context.loadWorldInfo === 'function') {
                            worldData = await context.loadWorldInfo(worldBookName);
                        }

                        return {
                            name: worldBookName,
                            data: worldData || { entries: {} },
                            source: 'character_specific'
                        };
                    } catch (loadError) {
                        console.warn('[WorldBookManager] ⚠️ 加载角色专属世界书失败:', loadError);
                    }
                }
            }

            console.log('[WorldBookManager] 📚 未找到角色绑定的主世界书');
            return null;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取角色主世界书失败:', error);
            return null;
        }
    }

    /**
     * 📖 获取当前角色绑定的世界书
     */
    async getCurrentCharacterWorldBook() {
        try {
            // 获取SillyTavern上下文
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[WorldBookManager] ⚠️ 无法获取SillyTavern上下文');
                return null;
            }

            // 检查chat metadata中的世界书绑定
            const chatMetadata = window.chat_metadata;
            if (chatMetadata && chatMetadata.world_info) {
                const worldBookName = chatMetadata.world_info;
                console.log('[WorldBookManager] 📚 找到chat lore绑定的世界书:', worldBookName);

                // 尝试加载世界书数据
                try {
                    let worldData = null;
                    if (typeof context.loadWorldInfo === 'function') {
                        worldData = await context.loadWorldInfo(worldBookName);
                    }

                    return {
                        name: worldBookName,
                        data: worldData || { entries: {} },
                        source: 'chat_lore'
                    };
                } catch (loadError) {
                    console.warn('[WorldBookManager] ⚠️ 加载绑定的世界书失败:', loadError);
                }
            }

            // 检查当前选中的世界书
            const worldInfoSelect = document.querySelector('#world_info');
            if (worldInfoSelect) {
                const selectedOptions = Array.from(worldInfoSelect.options).filter(opt => opt.selected);
                if (selectedOptions.length > 0) {
                    const worldBookName = selectedOptions[0].text;
                    console.log('[WorldBookManager] 📚 找到选中的世界书:', worldBookName);

                    try {
                        let worldData = null;
                        if (typeof context.loadWorldInfo === 'function') {
                            worldData = await context.loadWorldInfo(worldBookName);
                        }

                        return {
                            name: worldBookName,
                            data: worldData || { entries: {} },
                            source: 'selected'
                        };
                    } catch (loadError) {
                        console.warn('[WorldBookManager] ⚠️ 加载选中的世界书失败:', loadError);
                    }
                }
            }

            console.log('[WorldBookManager] 📚 未找到当前角色绑定的世界书');
            return null;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取当前角色世界书失败:', error);
            return null;
        }
    }

    /**
     * 🆕 创建角色专属世界书
     */
    async createCharacterWorldBook() {
        try {
            console.log('[WorldBookManager] 🆕 创建角色专属世界书...');

            // 获取角色信息
            const characterInfo = await this.getCharacterInfo();
            const worldBookName = this.generateWorldBookName(characterInfo);

            console.log('[WorldBookManager] 📝 生成世界书名称:', worldBookName);

            // 创建世界书数据结构
            const worldBookData = {
                entries: {},
                description: `${characterInfo.characterName} 的剧情记忆世界书`,
                version: 1,
                created: Date.now(),
                source: 'information_bar_integration_tool'
            };

            // 保存世界书
            await this.saveWorldBook(worldBookName, worldBookData);

            console.log('[WorldBookManager] ✅ 角色世界书创建完成:', worldBookName);

            return {
                name: worldBookName,
                data: worldBookData
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 创建角色世界书失败:', error);
            throw error;
        }
    }

    /**
     * 📋 获取角色信息
     */
    async getCharacterInfo() {
        try {
            const context = window.SillyTavern?.getContext?.();
            let characterName = 'Unknown';
            let chatId = '';
            let formattedDate = '';

            if (context) {
                // 获取角色名称
                characterName = context.name2 || context.name || 'Unknown';
                chatId = context.chatId || '';

                // 从chatId解析时间信息
                if (chatId) {
                    try {
                        const parts = chatId.split(' - ');
                        const timestampString = parts.length > 1 ? parts[1] : parts[0];
                        const dateTimeMatch = timestampString.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*@?\s*(\d{1,2})h\s*(\d{1,2})m/);

                        if (dateTimeMatch) {
                            const [, yearFull, month, day, hours, minutes] = dateTimeMatch;
                            const year = yearFull.slice(2);
                            formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')} ${hours.padStart(2, '0')}${minutes.padStart(2, '0')}`;
                        }
                    } catch (e) {
                        console.warn('[WorldBookManager] ⚠️ 解析时间戳失败:', e);
                    }
                }
            }

            return {
                characterName,
                chatId,
                formattedDate,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取角色信息失败:', error);
            return {
                characterName: 'Unknown',
                chatId: '',
                formattedDate: '',
                timestamp: Date.now()
            };
        }
    }

    /**
     * 🏷️ 生成世界书名称（角色专属，不基于聊天ID）
     */
    generateWorldBookName(characterInfo) {
        const { characterName } = characterInfo;

        // 使用角色名作为世界书基础名称
        const baseName = characterName || 'Unknown';
        
        // 生成角色专属世界书名称（不包含时间戳，确保唯一性）
        return `${baseName} - InfoBar`;
    }

    /**
     * 💾 保存世界书
     */
    async saveWorldBook(worldBookName, worldBookData) {
        try {
            console.log('[WorldBookManager] 💾 保存世界书:', worldBookName);

            // 🧪 检测是否为测试环境
            if (this.isTestEnvironment()) {
                console.log('[WorldBookManager] 🧪 检测到测试环境，使用直接操作方式');
                return await this.saveWorldBookDirect(worldBookName, worldBookData);
            }

            // 使用SillyTavern的世界书保存API
            const response = await fetch('/api/worldinfo/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.getRequestHeaders ? this.getRequestHeaders() : {})
                },
                body: JSON.stringify({
                    name: worldBookName,
                    data: worldBookData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`保存世界书失败: ${response.status} ${errorText}`);
            }

            console.log('[WorldBookManager] ✅ 世界书保存成功');
            return true;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 保存世界书失败:', error);

            // 如果API保存失败，尝试直接操作
            console.log('[WorldBookManager] 🔄 API保存失败，尝试直接操作...');
            return await this.saveWorldBookDirect(worldBookName, worldBookData);
        }
    }

    /**
     * 🎯 直接操作SillyTavern世界书数据
     */
    async saveWorldBookDirect(worldBookName, worldBookData) {
        try {
            console.log('[WorldBookManager] 🎯 直接操作SillyTavern世界书数据:', worldBookName);

            // 1. 首先尝试使用SillyTavern的原生API
            const success = await this.useSillyTavernNativeAPI(worldBookName, worldBookData);
            if (success) {
                console.log('[WorldBookManager] ✅ 使用原生API成功');
                return true;
            }

            // 2. 如果原生API不可用，检查是否有新条目需要添加到DOM
            const newEntries = Object.values(worldBookData.entries || {}).filter(entry =>
                entry.createdBy === 'information_bar_integration_tool'
            );

            console.log(`[WorldBookManager] 📝 找到 ${newEntries.length} 个新条目需要添加`);

            if (newEntries.length > 0) {
                // 3. 直接添加到SillyTavern的世界书DOM
                await this.addEntriesToSillyTavernDOM(newEntries);

                // 4. 更新SillyTavern的世界书数据结构
                await this.updateSillyTavernWorldInfoData(newEntries);

                // 5. 触发界面刷新
                await this.refreshSillyTavernWorldInfoUI();
            }

            // 6. 模拟保存到localStorage（用于状态跟踪）
            await this.saveWorldBookMock(worldBookName, worldBookData);

            console.log('[WorldBookManager] ✅ 直接操作完成');
            return true;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 直接操作失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 使用SillyTavern原生API
     */
    async useSillyTavernNativeAPI(worldBookName, worldBookData) {
        try {
            console.log('[WorldBookManager] 🔧 尝试使用SillyTavern原生API...');

            // 检查是否有可用的世界书API函数
            const worldInfoAPI = this.getSillyTavernWorldInfoAPI();
            if (!worldInfoAPI) {
                console.log('[WorldBookManager] ⚠️ SillyTavern世界书API不可用');
                return false;
            }

            console.log('[WorldBookManager] ✅ 找到SillyTavern世界书API');

            // 加载当前世界书数据
            let currentWorldData = null;
            if (worldInfoAPI.loadWorldInfo) {
                try {
                    currentWorldData = await worldInfoAPI.loadWorldInfo(worldBookName);
                    console.log('[WorldBookManager] 📖 成功加载当前世界书数据');
                } catch (error) {
                    console.warn('[WorldBookManager] ⚠️ 加载世界书数据失败:', error);
                }
            }

            // 如果没有现有数据，创建新的结构
            if (!currentWorldData) {
                currentWorldData = {
                    entries: {},
                    description: worldBookData.description || `由Information Bar Integration Tool创建的世界书`
                };
            }

            // 获取要处理的条目
            const incomingEntries = worldBookData.entries || {};
            
            // 对每个传入条目执行智能UPSERT（创建或更新）
            for (const [entryId, entry] of Object.entries(incomingEntries)) {
                if (entry.createdBy !== 'information_bar_integration_tool') {
                    continue; // 跳过非插件创建的条目
                }

                // 🔍 查找现有条目 - 多重匹配策略
                let targetEntryId = null;
                let targetEntry = null;

                // 1. 首先尝试通过npcId精确匹配（最可靠）
                if (entry.summaryType === 'npc' && entry.npcId) {
                    for (const [existingId, existingEntry] of Object.entries(currentWorldData.entries)) {
                        if (existingEntry.npcId === entry.npcId) {
                            targetEntryId = existingId;
                            targetEntry = existingEntry;
                            console.log(`[WorldBookManager] 🎯 通过NPC ID "${entry.npcId}" 找到现有条目: ${existingId}`);
                            break;
                        }
                    }
                }

                // 2. 如果npcId匹配失败，尝试通过summaryId匹配
                if (!targetEntryId && entry.summaryId) {
                    for (const [existingId, existingEntry] of Object.entries(currentWorldData.entries)) {
                        if (existingEntry.summaryId === entry.summaryId) {
                            targetEntryId = existingId;
                            targetEntry = existingEntry;
                            console.log(`[WorldBookManager] 🎯 通过summaryId "${entry.summaryId}" 找到现有条目: ${existingId}`);
                            break;
                        }
                    }
                }

                // 3. 最后尝试通过名称和类型匹配（兜底策略）
                if (!targetEntryId && entry.summaryType === 'npc') {
                    const entryName = (entry.comment || '').toLowerCase().trim();
                    for (const [existingId, existingEntry] of Object.entries(currentWorldData.entries)) {
                        const existingName = (existingEntry.comment || '').toLowerCase().trim();
                        const isNpcEntry = existingEntry.summaryType === 'npc' || 
                                         (existingEntry.createdBy === 'information_bar_integration_tool' && !existingEntry.summaryType);
                        
                        if (isNpcEntry && entryName && existingName === entryName) {
                            targetEntryId = existingId;
                            targetEntry = existingEntry;
                            console.log(`[WorldBookManager] 🎯 通过名称 "${entryName}" 找到现有条目: ${existingId}`);
                            break;
                        }
                    }
                }

                if (targetEntryId && targetEntry) {
                    // 🔄 更新现有条目
                    console.log(`[WorldBookManager] 🔄 更新现有条目: ${targetEntryId}`);
                    
                    // 🔧 重要：构建关键词列表，确保包含NPC名称
                    const keywords = [];
                    const finalSummaryType = entry.summaryType || targetEntry.summaryType || 'npc';
                    const finalNpcName = entry.npcName || targetEntry.npcName;
                    
                    if (finalSummaryType === 'npc' && finalNpcName) {
                        keywords.push(finalNpcName); // 添加NPC名称作为主要关键词
                    }
                    
                    // 合并现有关键词和新关键词
                    const existingKeywords = targetEntry.key || [];
                    const newKeywords = entry.keywords || [];
                    [...existingKeywords, ...newKeywords].forEach(keyword => {
                        if (keyword && !keywords.includes(keyword)) {
                            keywords.push(keyword);
                        }
                    });
                    
                    const updatedEntry = {
                        ...targetEntry,
                        key: keywords.length > 0 ? keywords : (targetEntry.key || []),
                        comment: entry.comment || targetEntry.comment,
                        content: entry.content || targetEntry.content,
                        order: entry.order || targetEntry.order,
                        // 🔧 根据条目类型设置向量化：NPC条目使用关键词模式，总结条目使用向量化
                        vectorized: finalSummaryType === 'npc' ? false : true,
                        // 🔧 重要：更新自定义字段
                        summaryId: entry.summaryId || targetEntry.summaryId,
                        summaryType: finalSummaryType,
                        summarySource: entry.summarySource || targetEntry.summarySource,
                        npcId: entry.npcId || targetEntry.npcId,
                        npcName: finalNpcName,
                        sourceType: entry.sourceType || targetEntry.sourceType,
                        // 更新时间戳
                        updatedAt: Date.now(),
                        updatedBy: 'information_bar_integration_tool',
                        // 保留创建信息
                        createdAt: targetEntry.createdAt || entry.createdAt || Date.now(),
                        createdBy: targetEntry.createdBy || 'information_bar_integration_tool'
                    };

                    currentWorldData.entries[targetEntryId] = updatedEntry;

                } else {
                    // ➕ 创建新条目
                    const newEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    console.log(`[WorldBookManager] ➕ 创建新条目: ${newEntryId}`);

                // 使用createWorldInfoEntry创建条目
                let newEntry = null;
                if (worldInfoAPI.createWorldInfoEntry) {
                    try {
                        newEntry = worldInfoAPI.createWorldInfoEntry(worldBookName, currentWorldData);
                        console.log('[WorldBookManager] ✅ 使用createWorldInfoEntry创建条目');
                    } catch (error) {
                        console.warn('[WorldBookManager] ⚠️ createWorldInfoEntry失败:', error);
                    }
                }

                // 如果createWorldInfoEntry失败，手动创建条目
                if (!newEntry) {
                    newEntry = {
                            uid: newEntryId,
                        key: entry.keywords || [],
                        keysecondary: [],
                        comment: entry.comment || entry.title || '总结条目',
                        content: entry.content || '',
                        constant: false,
                        selective: true,
                        selectiveLogic: 0,
                        addMemo: true,
                        order: entry.order || 100,
                        position: entry.position || 0,
                        disable: false,
                        excludeRecursion: false,
                        delayUntilRecursion: false,
                        preventRecursion: false,
                        probability: 100,
                        useProbability: true,
                        depth: 4,
                        group: "",
                        groupOverride: false,
                        groupWeight: 100,
                        scanDepth: null,
                        caseSensitive: null,
                        matchWholeWords: null,
                        useGroupScoring: null,
                        automationId: "",
                        role: null,
                        vectorized: true,
                        sticky: 0,
                        cooldown: 0,
                        delay: 0,
                        displayIndex: entry.order || 100,
                        createdBy: 'information_bar_integration_tool'
                    };
                }

                    // 填充条目数据 - 保留所有自定义字段
                    // 🔧 重要：构建关键词列表，确保包含NPC名称
                    const keywords = [];
                    if (entry.summaryType === 'npc' && entry.npcName) {
                        keywords.push(entry.npcName); // 添加NPC名称作为主要关键词
                    }
                    if (entry.keywords && Array.isArray(entry.keywords)) {
                        entry.keywords.forEach(keyword => {
                            if (keyword && !keywords.includes(keyword)) {
                                keywords.push(keyword);
                            }
                        });
                    }
                    
                Object.assign(newEntry, {
                        key: keywords.length > 0 ? keywords : (entry.keywords || []),
                    comment: entry.comment || entry.title || '总结条目',
                    content: entry.content || '',
                        createdBy: 'information_bar_integration_tool',
                        // 🔧 根据条目类型设置向量化：NPC条目使用关键词模式，总结条目使用向量化
                        vectorized: entry.summaryType === 'npc' ? false : true,
                        // 🔧 重要：保留自定义NPC字段
                        summaryId: entry.summaryId,
                        summaryType: entry.summaryType,
                        summarySource: entry.summarySource,
                        npcId: entry.npcId,
                        npcName: entry.npcName,
                        sourceType: entry.sourceType,
                        // 保留时间戳
                        createdAt: entry.createdAt || Date.now(),
                        updatedAt: entry.updatedAt,
                        updatedBy: entry.updatedBy
                });

                // 添加到世界书数据
                    currentWorldData.entries[newEntryId] = newEntry;
                }
            }

            // 保存世界书数据
            if (worldInfoAPI.saveWorldInfo) {
                try {
                    await worldInfoAPI.saveWorldInfo(worldBookName, currentWorldData, true);
                    console.log('[WorldBookManager] 💾 使用saveWorldInfo保存成功');

                    // 刷新编辑器
                    if (worldInfoAPI.reloadEditor) {
                        try {
                            worldInfoAPI.reloadEditor(worldBookName);
                            console.log('[WorldBookManager] 🔄 编辑器刷新成功');
                        } catch (error) {
                            console.warn('[WorldBookManager] ⚠️ 编辑器刷新失败:', error);
                        }
                    }

                    return true;
                } catch (error) {
                    console.error('[WorldBookManager] ❌ saveWorldInfo失败:', error);
                    return false;
                }
            }

            console.log('[WorldBookManager] ⚠️ saveWorldInfo函数不可用');
            return false;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 使用原生API失败:', error);
            return false;
        }
    }

    /**
     * 🔍 获取SillyTavern世界书API
     */
    getSillyTavernWorldInfoAPI() {
        try {
            // 方法1: 检查全局导入的模块
            if (window.loadWorldInfo && window.saveWorldInfo && window.createWorldInfoEntry) {
                console.log('[WorldBookManager] 📚 找到全局世界书API函数');
                return {
                    loadWorldInfo: window.loadWorldInfo,
                    saveWorldInfo: window.saveWorldInfo,
                    createWorldInfoEntry: window.createWorldInfoEntry,
                    reloadEditor: window.reloadEditor
                };
            }

            // 方法2: 检查SillyTavern上下文
            const context = window.SillyTavern?.getContext?.();
            if (context && context.loadWorldInfo && context.saveWorldInfo) {
                console.log('[WorldBookManager] 📚 找到上下文世界书API函数');
                return {
                    loadWorldInfo: context.loadWorldInfo,
                    saveWorldInfo: context.saveWorldInfo,
                    createWorldInfoEntry: context.createWorldInfoEntry,
                    reloadEditor: context.reloadEditor
                };
            }

            // 方法3: 检查扩展系统
            if (window.extensions && window.extensions.worldInfo) {
                console.log('[WorldBookManager] 📚 找到扩展世界书API函数');
                return window.extensions.worldInfo;
            }

            // 方法4: 尝试动态导入
            try {
                const worldInfoModule = window.require?.('../../../world-info.js');
                if (worldInfoModule) {
                    console.log('[WorldBookManager] 📚 找到动态导入的世界书模块');
                    return worldInfoModule;
                }
            } catch (error) {
                // 忽略动态导入错误
            }

            console.log('[WorldBookManager] ❌ 未找到可用的世界书API');
            return null;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取世界书API失败:', error);
            return null;
        }
    }

    /**
     * 📝 添加条目到SillyTavern DOM
     */
    async addEntriesToSillyTavernDOM(entries) {
        try {
            console.log('[WorldBookManager] 📝 尝试添加条目到SillyTavern DOM...');

            // 首先尝试打开世界书界面
            const worldInfoOpened = await this.ensureWorldInfoInterfaceOpen();
            if (!worldInfoOpened) {
                console.log('[WorldBookManager] ⚠️ 无法打开世界书界面，跳过DOM操作');
                return;
            }

            const worldInfoContainer = document.querySelector('#world_info_entries');
            if (!worldInfoContainer) {
                console.log('[WorldBookManager] ⚠️ 未找到世界书条目容器，可能界面未完全加载');
                return;
            }

            for (const entry of entries) {
                // 生成新的UID
                const newUID = Date.now() + Math.floor(Math.random() * 1000);

                console.log(`[WorldBookManager] ➕ 添加条目: ${entry.comment} (UID: ${newUID})`);

                // 创建新的世界书条目DOM元素
                const entryHTML = this.createWorldInfoEntryHTML(entry, newUID);

                // 添加到容器
                worldInfoContainer.insertAdjacentHTML('beforeend', entryHTML);

                // 绑定事件监听器
                this.bindWorldInfoEntryEvents(newUID);
            }

            console.log('[WorldBookManager] ✅ DOM条目添加完成');

        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 添加DOM条目失败，但不影响数据保存:', error);
            // 不抛出错误，因为DOM操作失败不应该影响数据保存
        }
    }

    /**
     * 🔓 确保世界书界面打开
     */
    async ensureWorldInfoInterfaceOpen() {
        try {
            console.log('[WorldBookManager] 🔓 尝试打开世界书界面...');

            // 检查世界书界面是否已经可见
            const worldInfoEditor = document.querySelector('#world_info');
            if (worldInfoEditor && worldInfoEditor.offsetParent !== null) {
                console.log('[WorldBookManager] ✅ 世界书界面已经打开');
                return true;
            }

            // 尝试查找并点击世界书标签
            const worldInfoTabs = [
                'a[href="#world_info"]',
                '[data-tab="world_info"]',
                '.world_info_tab',
                '#world_info_tab',
                'button[onclick*="world"]',
                'a[onclick*="world"]'
            ];

            for (const selector of worldInfoTabs) {
                const tab = document.querySelector(selector);
                if (tab && tab.offsetParent !== null) {
                    console.log(`[WorldBookManager] 🖱️ 点击世界书标签: ${selector}`);
                    tab.click();

                    // 等待界面加载
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // 检查是否成功打开
                    const container = document.querySelector('#world_info_entries');
                    if (container) {
                        console.log('[WorldBookManager] ✅ 世界书界面已打开');
                        return true;
                    }
                }
            }

            // 尝试查找包含"world"或"世界书"文本的可点击元素
            const allClickable = document.querySelectorAll('a, button, [onclick], [role="tab"]');
            for (const element of allClickable) {
                const text = element.textContent?.toLowerCase() || '';
                if ((text.includes('world') || text.includes('世界书')) && element.offsetParent !== null) {
                    console.log(`[WorldBookManager] 🖱️ 尝试点击: "${element.textContent?.trim()}"`);
                    element.click();

                    // 等待界面加载
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // 检查是否成功打开
                    const container = document.querySelector('#world_info_entries');
                    if (container) {
                        console.log('[WorldBookManager] ✅ 世界书界面已打开');
                        return true;
                    }
                }
            }

            console.log('[WorldBookManager] ❌ 无法自动打开世界书界面');
            return false;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 打开世界书界面失败:', error);
            return false;
        }
    }

    /**
     * 🏗️ 创建世界书条目HTML
     */
    createWorldInfoEntryHTML(entry, uid) {
        const keys = Array.isArray(entry.key) ? entry.key.join(', ') : entry.key || '';
        const content = entry.content || '';
        const comment = entry.comment || '';

        return `
            <div class="world_entry" uid="${uid}">
                <form class="world_entry_form wi-card-entry">
                    <div class="inline-drawer wide100p">
                        <div class="inline-drawer-toggle inline-drawer-header">
                            <b class="world_entry_form_title">${comment}</b>
                            <div class="world_entry_form_control">
                                <a class="world_entry_delete" title="删除条目" uid="${uid}">🗑️</a>
                            </div>
                        </div>
                        <div class="inline-drawer-content">
                            <div class="world_entry_form_group">
                                <label>关键词</label>
                                <input class="text_pole world_entry_key" type="text" value="${keys}" placeholder="关键词，用逗号分隔">
                            </div>
                            <div class="world_entry_form_group">
                                <label>注释</label>
                                <input class="text_pole world_entry_comment" type="text" value="${comment}" placeholder="条目描述">
                            </div>
                            <div class="world_entry_form_group">
                                <label>内容</label>
                                <textarea class="text_pole world_entry_text" placeholder="条目内容">${content}</textarea>
                            </div>
                            <div class="world_entry_form_group">
                                <label>
                                    <input class="world_entry_disable" type="checkbox" ${entry.disable ? 'checked' : ''}>
                                    禁用此条目
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        `;
    }

    /**
     * 🔗 绑定世界书条目事件
     */
    bindWorldInfoEntryEvents(uid) {
        try {
            const entryElement = document.querySelector(`.world_entry[uid="${uid}"]`);
            if (!entryElement) return;

            // 绑定删除按钮事件
            const deleteBtn = entryElement.querySelector('.world_entry_delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (confirm('确定要删除这个世界书条目吗？')) {
                        entryElement.remove();
                        console.log(`[WorldBookManager] 🗑️ 删除条目 UID: ${uid}`);
                    }
                });
            }

            // 绑定输入框变化事件
            const inputs = entryElement.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    console.log(`[WorldBookManager] 📝 条目 ${uid} 内容已修改`);
                });
            });

        } catch (error) {
            console.error('[WorldBookManager] ❌ 绑定事件失败:', error);
        }
    }

    /**
     * 🔄 更新SillyTavern世界书数据结构
     */
    async updateSillyTavernWorldInfoData(entries) {
        try {
            console.log('[WorldBookManager] 🔄 更新SillyTavern世界书数据结构...');

            // 检查是否有全局的世界书数据数组
            if (window.world_info && Array.isArray(window.world_info.entries)) {
                console.log('[WorldBookManager] 📊 找到world_info.entries数组');

                for (const entry of entries) {
                    // 生成新的UID
                    const newUID = Date.now() + Math.floor(Math.random() * 1000);

                    // 转换为SillyTavern格式
                    const sillyTavernEntry = {
                        uid: newUID,
                        key: Array.isArray(entry.key) ? entry.key : [entry.key || ''],
                        keysecondary: entry.keysecondary || [],
                        comment: entry.comment || '',
                        content: entry.content || '',
                        constant: entry.constant || false,
                        selective: entry.selective !== false, // 默认为true
                        order: entry.order || 100,
                        position: entry.position || 1,
                        disable: entry.disable || false,
                        addMemo: entry.addMemo !== false, // 默认为true
                        probability: entry.probability || 100,
                        useProbability: entry.useProbability || true,
                        depth: entry.depth || 0,
                        excludeRecursion: entry.excludeRecursion || false,
                        preventRecursion: entry.preventRecursion || false,
                        delayUntilRecursion: entry.delayUntilRecursion || false
                    };

                    // 添加到数组
                    window.world_info.entries.push(sillyTavernEntry);
                    console.log(`[WorldBookManager] ➕ 添加到world_info.entries: ${entry.comment}`);
                }
            } else {
                console.log('[WorldBookManager] ⚠️ 未找到world_info.entries数组');
            }

            console.log('[WorldBookManager] ✅ 数据结构更新完成');

        } catch (error) {
            console.error('[WorldBookManager] ❌ 更新数据结构失败:', error);
            throw error;
        }
    }

    /**
     * 🔄 刷新SillyTavern世界书UI
     */
    async refreshSillyTavernWorldInfoUI() {
        try {
            console.log('[WorldBookManager] 🔄 刷新SillyTavern世界书UI...');

            // 1. 触发世界书选择框的change事件
            const worldInfoSelect = document.querySelector('#world_info');
            if (worldInfoSelect) {
                worldInfoSelect.dispatchEvent(new Event('change'));
                console.log('[WorldBookManager] 🔄 触发世界书选择框change事件');
            }

            // 2. 如果有jQuery，触发相关事件
            if (window.$ || window.jQuery) {
                const $ = window.$ || window.jQuery;
                $(document).trigger('world_info_updated');
                $('#world_info_entries').trigger('refresh');
                console.log('[WorldBookManager] 🔄 触发jQuery事件');
            }

            // 3. 滚动到底部显示新条目
            const worldInfoContainer = document.querySelector('#world_info_entries');
            if (worldInfoContainer) {
                setTimeout(() => {
                    worldInfoContainer.scrollTop = worldInfoContainer.scrollHeight;
                    console.log('[WorldBookManager] 📜 滚动到底部显示新条目');
                }, 500);
            }

            console.log('[WorldBookManager] ✅ UI刷新完成');

        } catch (error) {
            console.error('[WorldBookManager] ❌ UI刷新失败:', error);
            // 不抛出错误，UI刷新失败不应该影响主流程
        }
    }

    /**
     * 🧪 检测是否为测试环境
     */
    isTestEnvironment() {
        // 检测多个测试环境指标
        const indicators = [
            // 检查URL是否为本地测试地址
            window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost',
            // 检查端口是否为常见测试端口
            window.location.port === '8000' || window.location.port === '3000',
            // 检查是否缺少SillyTavern的关键API
            typeof window.saveMetadata !== 'function',
            // 检查是否缺少世界书相关的全局变量
            typeof window.world_info === 'undefined'
        ];

        // 如果有多个指标符合，认为是测试环境
        const matchCount = indicators.filter(Boolean).length;
        return matchCount >= 2;
    }

    /**
     * 🧪 模拟世界书保存API
     */
    async saveWorldBookMock(worldBookName, worldBookData) {
        try {
            console.log('[WorldBookManager] 🧪 模拟保存世界书:', worldBookName);

            // 模拟网络延迟
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

            // 将世界书数据保存到localStorage（模拟持久化）
            const mockWorldBooks = this.getMockWorldBooks();
            mockWorldBooks[worldBookName] = {
                ...worldBookData,
                savedAt: Date.now(),
                mockSave: true
            };

            localStorage.setItem('mock_world_books', JSON.stringify(mockWorldBooks));

            // 模拟绑定到当前聊天
            if (typeof window.chat_metadata === 'undefined') {
                window.chat_metadata = {};
            }
            window.chat_metadata['world_info'] = worldBookName;

            console.log('[WorldBookManager] ✅ 模拟世界书保存成功');
            console.log('[WorldBookManager] 📊 世界书数据:', {
                name: worldBookName,
                entriesCount: Object.keys(worldBookData.entries || {}).length,
                description: worldBookData.description
            });

            // 显示成功通知
            this.showMockSuccessNotification(worldBookName, worldBookData);

            return true;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 模拟保存世界书失败:', error);
            throw error;
        }
    }

    /**
     * 📚 获取模拟世界书数据
     */
    getMockWorldBooks() {
        try {
            const stored = localStorage.getItem('mock_world_books');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 获取模拟世界书数据失败:', error);
            return {};
        }
    }

    /**
     * 🎉 显示模拟成功通知
     */
    showMockSuccessNotification(worldBookName, worldBookData) {
        try {
            // 创建成功通知元素
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--SmartThemeAccentColor, #4a9eff);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                font-family: var(--mainFontFamily, 'Noto Sans', sans-serif);
                font-size: 14px;
                line-height: 1.4;
                animation: slideInRight 0.3s ease-out;
            `;

            const entriesCount = Object.keys(worldBookData.entries || {}).length;
            notification.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 18px; margin-right: 8px;">📚</span>
                    <strong>世界书上传成功！</strong>
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    <div>📖 世界书名称: ${worldBookName}</div>
                    <div>📝 条目数量: ${entriesCount}</div>
                    <div>🔗 已绑定为 Chat Lore</div>
                </div>
            `;

            // 添加动画样式
            if (!document.querySelector('#mock-notification-styles')) {
                const style = document.createElement('style');
                style.id = 'mock-notification-styles';
                style.textContent = `
                    @keyframes slideInRight {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOutRight {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(notification);

            // 3秒后自动消失
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);

            // 点击关闭
            notification.addEventListener('click', () => {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            });

        } catch (error) {
            console.warn('[WorldBookManager] ⚠️ 显示通知失败:', error);
        }
    }

    /**
     * 📝 格式化总结为世界书条目
     */
    async formatSummaryAsWorldBookEntry(summaryData, options = {}) {
        try {
            console.log('[WorldBookManager] 📝 格式化总结为世界书条目...', summaryData.id);

            const {
                entryNameFormat = 'auto',
                customEntryName = null,
                addTimestamp = true,
                useContentTags = true,
                worldBookData = {}
            } = options;

            // 1. 生成条目名称
            const entryName = await this.generateEntryName(summaryData, entryNameFormat, customEntryName, worldBookData);

            // 2. 格式化内容
            const formattedContent = this.formatSummaryContent(summaryData, useContentTags, addTimestamp);

            // 3. 生成关键词
            const keywords = this.generateSummaryKeywords(summaryData, entryName);

            // 4. 计算条目顺序
            const order = this.calculateEntryOrder(worldBookData);

            const entryData = {
                entryName: entryName,
                content: formattedContent,
                keywords: keywords,
                order: order,
                summaryId: summaryData.id,
                summaryType: summaryData.type || 'unknown',
                summarySource: summaryData.source || 'traditional'
            };

            console.log('[WorldBookManager] ✅ 条目格式化完成:', entryName);
            return entryData;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 格式化总结条目失败:', error);
            throw error;
        }
    }

    /**
     * 🏷️ 生成条目名称
     */
    async generateEntryName(summaryData, format, customName, worldBookData) {
        if (format === 'custom' && customName) {
            return customName;
        }

        // 获取现有条目数量用于编号
        const existingEntries = Object.values(worldBookData.entries || {});

        if (format === 'floor_range' && summaryData.messageRange) {
            const { start, end } = summaryData.messageRange;
            if (start === end) {
                return `楼层 #${start + 1}`;
            } else {
                return `楼层 #${start + 1}-${end + 1}`;
            }
        }

        // 自动格式：根据总结类型和来源生成名称
        if (summaryData.source === 'ai_memory_summarizer' || summaryData.type === 'ai_memory') {
            const aiMemoryCount = existingEntries.filter(entry =>
                entry.comment && entry.comment.includes('AI记忆')
            ).length;
            return `AI记忆 #${aiMemoryCount + 1}`;
        } else {
            const summaryCount = existingEntries.filter(entry =>
                entry.comment && entry.comment.includes('剧情总结')
            ).length;
            return `剧情总结 #${summaryCount + 1}`;
        }
    }

    /**
     * 📄 格式化总结内容
     */
    formatSummaryContent(summaryData, useContentTags, addTimestamp) {
        let content = summaryData.content || '';

        if (useContentTags) {
            // 根据总结类型添加不同的标签
            if (summaryData.source === 'ai_memory_summarizer' || summaryData.type === 'ai_memory') {
                const importance = summaryData.importance || 'medium';
                const tags = summaryData.tags ? summaryData.tags.join(',') : '';
                content = `<ai_memory importance="${importance}" tags="${tags}">${content}</ai_memory>`;
            } else {
                const summaryType = summaryData.type || 'manual';
                const range = summaryData.messageRange ?
                    `${summaryData.messageRange.start + 1}-${summaryData.messageRange.end + 1}` : '';
                content = `<plot_summary type="${summaryType}" range="${range}">${content}</plot_summary>`;
            }
        }

        if (addTimestamp) {
            const timeStr = new Date(summaryData.timestamp).toLocaleString('zh-CN');
            content = `<!-- 生成时间: ${timeStr} -->\n${content}`;
        }

        return content;
    }

    /**
     * 🔑 生成总结关键词
     */
    generateSummaryKeywords(summaryData, entryName) {
        const keywords = [entryName];

        // 基础关键词
        if (summaryData.source === 'ai_memory_summarizer' || summaryData.type === 'ai_memory') {
            keywords.push('AI记忆', '智能总结', '记忆片段');

            // 添加AI记忆的标签作为关键词
            if (summaryData.tags && Array.isArray(summaryData.tags)) {
                keywords.push(...summaryData.tags);
            }
        } else {
            keywords.push('剧情总结', '故事回顾', '情节记录');

            // 添加总结类型关键词
            const typeKeywords = {
                'small': '简要总结',
                'large': '详细总结',
                'manual': '手动总结',
                'auto': '自动总结'
            };

            if (summaryData.type && typeKeywords[summaryData.type]) {
                keywords.push(typeKeywords[summaryData.type]);
            }
        }

        // 添加楼层范围关键词
        if (summaryData.messageRange) {
            const { start, end } = summaryData.messageRange;
            keywords.push(`楼层${start + 1}-${end + 1}`);
        }

        // 去重并返回
        return [...new Set(keywords)];
    }

    /**
     * 📊 计算条目顺序
     */
    calculateEntryOrder(worldBookData) {
        const existingEntries = Object.values(worldBookData.entries || {});
        const maxOrder = existingEntries.reduce((max, entry) => {
            return Math.max(max, entry.order || 0);
        }, 0);
        return maxOrder + 1;
    }

    /**
     * 🔄 智能创建或更新世界书条目（防重复）
     */
    async createOrUpdateWorldBookEntry(worldBookName, worldBookData, entryData) {
        try {
            console.log('[WorldBookManager] 🔄 智能创建/更新世界书条目:', entryData.entryName);

            // 🔍 查找现有的条目（基于关键词和名称）
            const existingEntry = this.findExistingWorldBookEntry(worldBookData, entryData);
            
            if (existingEntry) {
                // 更新现有条目
                console.log('[WorldBookManager] 🔄 发现现有条目，执行更新:', existingEntry.entryId);
                return await this.updateWorldBookEntry(worldBookName, worldBookData, existingEntry.entryId, entryData);
            } else {
                // 创建新条目
                console.log('[WorldBookManager] ➕ 创建新的世界书条目');
                return await this.createWorldBookEntry(worldBookName, worldBookData, entryData);
            }

        } catch (error) {
            console.error('[WorldBookManager] ❌ 智能创建/更新世界书条目失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔍 查找现有的世界书条目（优化NPC匹配逻辑）
     */
    findExistingWorldBookEntry(worldBookData, entryData) {
        try {
            const entries = worldBookData.entries || {};
            const targetName = entryData.entryName?.toLowerCase().trim();
            const targetKeywords = Array.isArray(entryData.keywords) ? 
                entryData.keywords.map(k => k.toLowerCase().trim()) : 
                [entryData.keywords?.toLowerCase().trim()].filter(Boolean);

            for (const [entryId, entry] of Object.entries(entries)) {
                // 🎯 最高优先级：NPC ID精确匹配
                if (entryData.summaryType === 'npc' && 
                    entry.summaryType === 'npc' && 
                    entryData.npcId && entry.npcId && 
                    entryData.npcId === entry.npcId) {
                    console.log('[WorldBookManager] 🎯 通过NPC ID精确匹配找到现有条目:', entryData.npcId);
                    return { entryId, entry };
                }

                // 🎯 次优先级：summaryId匹配（用于其他类型的条目）
                if (entryData.summaryId && entry.summaryId && 
                    entryData.summaryId === entry.summaryId) {
                    console.log('[WorldBookManager] 🎯 通过summaryId匹配找到现有条目:', entryData.summaryId);
                    return { entryId, entry };
                }

                // 🎯 NPC特殊处理：当旧条目缺少自定义字段时退化到名称匹配
                if (entryData.summaryType === 'npc') {
                    const entryIsNpc = entry.summaryType === 'npc' || (!entry.summaryType && entry.createdBy === 'information_bar_integration_tool');
                    if (entryIsNpc) {
                        // 如果旧条目无 npcId，则用名称做一次兜底匹配
                        const entryNpcName = (entry.npcName || entry.comment || '').toLowerCase().trim();
                        if (entryNpcName && targetName && entryNpcName === targetName) {
                            console.log('[WorldBookManager] 🎯 通过NPC名称兜底匹配旧条目:', entryNpcName);
                            return { entryId, entry };
                        }
                    }
                }

                // 🎯 备用匹配：条目名称完全匹配
                const entryName = (entry.comment || '').toLowerCase().trim();
                if (entryName && targetName && entryName === targetName) {
                    // 额外检查：确保是同一类型的条目
                    if (entryData.summaryType === entry.summaryType || 
                        (!entryData.summaryType && !entry.summaryType)) {
                    console.log('[WorldBookManager] 🎯 通过名称匹配找到现有条目:', entryName);
                    return { entryId, entry };
                    }
                }

                // 🎯 关键词匹配（仅用于非NPC类型或作为最后手段）
                if (targetKeywords.length > 0 && entryData.summaryType !== 'npc') {
                    const entryKeywords = Array.isArray(entry.key) ? 
                        entry.key.map(k => k.toLowerCase().trim()) : 
                        [entry.key?.toLowerCase().trim()].filter(Boolean);

                    // 检查是否有关键词重叠
                    const hasOverlap = targetKeywords.some(tk => 
                        entryKeywords.some(ek => ek === tk)
                    );

                    if (hasOverlap) {
                        console.log('[WorldBookManager] 🎯 通过关键词匹配找到现有条目:', entryKeywords);
                        return { entryId, entry };
                    }
                }
            }

            return null;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 查找现有条目失败:', error);
            return null;
        }
    }

    /**
     * ✏️ 更新世界书条目
     */
    async updateWorldBookEntry(worldBookName, worldBookData, entryId, entryData) {
        try {
            console.log('[WorldBookManager] ✏️ 更新世界书条目:', entryId);

            const existingEntry = worldBookData.entries[entryId];
            if (!existingEntry) {
                throw new Error(`条目 ${entryId} 不存在`);
            }

            // 🔧 重要：构建关键词列表，确保包含NPC名称
            const keywords = [];
            const finalSummaryType = entryData.summaryType || existingEntry.summaryType;
            const finalNpcName = entryData.npcName || existingEntry.npcName;
            
            if (finalSummaryType === 'npc' && finalNpcName) {
                keywords.push(finalNpcName); // 添加NPC名称作为主要关键词
            }
            
            // 合并现有关键词和新关键词
            const existingKeywords = existingEntry.key || [];
            const newKeywords = entryData.keywords || [];
            [...existingKeywords, ...newKeywords].forEach(keyword => {
                if (keyword && !keywords.includes(keyword)) {
                    keywords.push(keyword);
                }
            });

            // 更新条目数据（保留原有的重要属性）
            const updatedEntry = {
                ...existingEntry,
                key: keywords.length > 0 ? keywords : (entryData.keywords || existingEntry.key || []),
                content: entryData.content,
                comment: entryData.entryName,
                order: entryData.order,
                // 🔧 根据条目类型设置向量化：NPC条目使用关键词模式，总结条目使用向量化
                vectorized: finalSummaryType === 'npc' ? false : true,
                // 更新自定义属性
                summaryId: entryData.summaryId,
                summaryType: finalSummaryType,
                summarySource: entryData.summarySource,
                // NPC专属字段
                npcId: entryData.npcId,
                npcName: finalNpcName,
                sourceType: entryData.sourceType,
                // 元数据
                updatedBy: 'information_bar_integration_tool',
                updatedAt: Date.now(),
                // 保留创建信息
                createdBy: existingEntry.createdBy || 'information_bar_integration_tool',
                createdAt: existingEntry.createdAt || Date.now()
            };

            // 兼容旧条目：若缺少summaryType则补齐
            if (!updatedEntry.summaryType && entryData.summaryType) {
                updatedEntry.summaryType = entryData.summaryType;
            }

            // 更新世界书数据
            worldBookData.entries[entryId] = updatedEntry;

            // 保存世界书
            await this.saveWorldBook(worldBookName, worldBookData);

            console.log('[WorldBookManager] ✅ 世界书条目更新完成:', entryId);

            return {
                success: true,
                action: 'updated',
                entryId: entryId,
                entry: updatedEntry
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 更新世界书条目失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ➕ 创建世界书条目
     */
    async createWorldBookEntry(worldBookName, worldBookData, entryData) {
        try {
            console.log('[WorldBookManager] ➕ 创建世界书条目:', entryData.entryName);

            // 生成唯一的条目ID
            const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 🔧 重要：构建关键词列表，确保包含NPC名称
            const keywords = [];
            if (entryData.summaryType === 'npc' && entryData.npcName) {
                keywords.push(entryData.npcName); // 添加NPC名称作为主要关键词
            }
            if (entryData.keywords && Array.isArray(entryData.keywords)) {
                entryData.keywords.forEach(keyword => {
                    if (keyword && !keywords.includes(keyword)) {
                        keywords.push(keyword);
                    }
                });
            }

            // 创建条目对象
            const newEntry = {
                uid: entryId,
                key: keywords.length > 0 ? keywords : (entryData.keywords || []),
                content: entryData.content,
                comment: entryData.entryName,
                constant: true,      // 非常驻
                selective: true,     // 选择性触发
                order: entryData.order,
                position: 1,         // 默认位置
                disable: false,      // 启用状态
                addMemo: true,       // 显示备注
                probability: 100,    // 触发概率
                useProbability: true,
                depth: 0,
                excludeRecursion: false,
                preventRecursion: false,
                delayUntilRecursion: false,
                // 🔧 根据条目类型设置向量化：NPC条目使用关键词模式，总结条目使用向量化
                vectorized: entryData.summaryType === 'npc' ? false : true,
                // 自定义属性
                summaryId: entryData.summaryId,
                summaryType: entryData.summaryType,
                summarySource: entryData.summarySource,
                // NPC专属字段
                npcId: entryData.npcId,
                npcName: entryData.npcName,
                sourceType: entryData.sourceType,
                // 元数据
                createdBy: 'information_bar_integration_tool',
                createdAt: Date.now()
            };

            // 添加到世界书数据
            worldBookData.entries[entryId] = newEntry;

            // 保存世界书
            await this.saveWorldBook(worldBookName, worldBookData);

            console.log('[WorldBookManager] ✅ 世界书条目创建完成:', entryId);

            return {
                success: true,
                action: 'created',
                entryId: entryId,
                entry: newEntry
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 创建世界书条目失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🧹 清理重复的世界书条目
     */
    async deduplicateWorldBookEntries(worldBookName, worldBookData) {
        try {
            console.log('[WorldBookManager] 🧹 开始清理重复的世界书条目...');

            const entries = worldBookData.entries || {};
            const npcGroups = new Map(); // npcId -> 条目数组
            const nameGroups = new Map(); // 名称 -> 条目数组
            let removedCount = 0;
            const removedEntries = [];

            // 🔍 分别按NPC ID和名称分组
            for (const [entryId, entry] of Object.entries(entries)) {
                if (entry.createdBy !== 'information_bar_integration_tool') continue;

                // NPC条目：按npcId分组
                if (entry.summaryType === 'npc' && entry.npcId) {
                    if (!npcGroups.has(entry.npcId)) {
                        npcGroups.set(entry.npcId, []);
                    }
                    npcGroups.get(entry.npcId).push({ entryId, entry });
                } else {
                    // 其他条目：按名称分组
                const entryName = (entry.comment || '').toLowerCase().trim();
                    if (entryName) {
                        if (!nameGroups.has(entryName)) {
                            nameGroups.set(entryName, []);
                        }
                        nameGroups.get(entryName).push({ entryId, entry });
                    }
                }
            }

            // 🗑️ 处理NPC重复项：按npcId去重
            for (const [npcId, group] of npcGroups.entries()) {
                if (group.length <= 1) continue; // 没有重复

                console.log(`[WorldBookManager] 🔍 发现重复NPC条目 (ID: ${npcId}): ${group.length} 个`);

                // 按创建/更新时间排序，保留最新的
                group.sort((a, b) => {
                    const timeA = a.entry.updatedAt || a.entry.createdAt || 0;
                    const timeB = b.entry.updatedAt || b.entry.createdAt || 0;
                    return timeB - timeA; // 最新的在前
                });

                // 保留第一个（最新的），删除其余的
                const toKeep = group[0];
                const toRemove = group.slice(1);

                console.log(`[WorldBookManager] 🗑️ 保留NPC条目: ${toKeep.entryId} (${toKeep.entry.npcName}), 删除: ${toRemove.length} 个重复项`);

                for (const item of toRemove) {
                    delete worldBookData.entries[item.entryId];
                    removedCount++;
                    removedEntries.push({
                        entryId: item.entryId,
                        entryName: item.entry.comment || item.entry.npcName,
                        npcId: item.entry.npcId,
                        createdAt: item.entry.createdAt
                    });
                }
            }

            // 🗑️ 处理其他重复项：按名称去重
            for (const [entryName, group] of nameGroups.entries()) {
                if (group.length <= 1) continue; // 没有重复

                console.log(`[WorldBookManager] 🔍 发现重复条目 "${entryName}": ${group.length} 个`);

                // 按创建/更新时间排序，保留最新的
                group.sort((a, b) => {
                    const timeA = a.entry.updatedAt || a.entry.createdAt || 0;
                    const timeB = b.entry.updatedAt || b.entry.createdAt || 0;
                    return timeB - timeA; // 最新的在前
                });

                // 保留第一个（最新的），删除其余的
                const toKeep = group[0];
                const toRemove = group.slice(1);

                console.log(`[WorldBookManager] 🗑️ 保留条目: ${toKeep.entryId}, 删除: ${toRemove.length} 个重复项`);

                for (const item of toRemove) {
                    delete worldBookData.entries[item.entryId];
                    removedCount++;
                    removedEntries.push({
                        entryId: item.entryId,
                        entryName: entryName,
                        createdAt: item.entry.createdAt
                    });
                }
            }

            if (removedCount > 0) {
                // 保存更新后的世界书
                await this.saveWorldBook(worldBookName, worldBookData);
                console.log(`[WorldBookManager] 🧹 ✅ 清理完成，删除了 ${removedCount} 个重复条目`);
            } else {
                console.log('[WorldBookManager] 🧹 ✅ 没有发现重复条目');
            }

            return {
                success: true,
                removedCount: removedCount,
                removedEntries: removedEntries,
                message: removedCount > 0 ? 
                    `成功删除 ${removedCount} 个重复条目` : 
                    '没有发现重复条目'
            };

        } catch (error) {
            console.error('[WorldBookManager] ❌ 清理重复条目失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 🔗 绑定世界书到当前聊天
     */
    async bindWorldBookToChatLore(worldBookName) {
        try {
            console.log('[WorldBookManager] 🔗 绑定世界书到chat lore:', worldBookName);

            // 🧪 测试环境处理
            if (this.isTestEnvironment()) {
                console.log('[WorldBookManager] 🧪 测试环境：模拟绑定世界书');

                // 确保chat_metadata存在
                if (typeof window.chat_metadata === 'undefined') {
                    window.chat_metadata = {};
                }

                // 设置chat metadata
                window.chat_metadata['world_info'] = worldBookName;

                // 模拟保存metadata
                localStorage.setItem('mock_chat_metadata', JSON.stringify(window.chat_metadata));

                console.log('[WorldBookManager] ✅ 测试环境：世界书已绑定为chat lore');
                return true;
            }

            // 检查必要的全局变量
            if (typeof window.chat_metadata === 'undefined' || typeof window.saveMetadata !== 'function') {
                console.warn('[WorldBookManager] ⚠️ chat_metadata或saveMetadata不可用');
                return false;
            }

            // 设置chat metadata
            window.chat_metadata['world_info'] = worldBookName;

            // 保存metadata
            await window.saveMetadata();

            // 更新UI按钮状态
            const chatLorebookButton = document.querySelector('.chat_lorebook_button');
            if (chatLorebookButton) {
                chatLorebookButton.classList.add('world_set');
            }

            console.log('[WorldBookManager] ✅ 世界书已绑定为chat lore');
            return true;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 绑定世界书失败:', error);
            return false;
        }
    }

    /**
     * 🔧 获取请求头（兼容性方法）
     */
    getRequestHeaders() {
        if (typeof window.getRequestHeaders === 'function') {
            return window.getRequestHeaders();
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * 🧪 获取模拟世界书状态（调试用）
     */
    getMockWorldBookStatus() {
        try {
            const mockWorldBooks = this.getMockWorldBooks();
            const chatMetadata = window.chat_metadata || {};

            return {
                isTestEnvironment: this.isTestEnvironment(),
                mockWorldBooksCount: Object.keys(mockWorldBooks).length,
                mockWorldBooks: Object.keys(mockWorldBooks),
                currentChatLore: chatMetadata.world_info || null,
                mockWorldBooksData: mockWorldBooks
            };
        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取模拟世界书状态失败:', error);
            return {
                isTestEnvironment: this.isTestEnvironment(),
                error: error.message
            };
        }
    }

    /**
     * 🧪 清除模拟世界书数据（调试用）
     */
    clearMockWorldBooks() {
        try {
            localStorage.removeItem('mock_world_books');
            localStorage.removeItem('mock_chat_metadata');
            console.log('[WorldBookManager] 🧹 模拟世界书数据已清除');
            return true;
        } catch (error) {
            console.error('[WorldBookManager] ❌ 清除模拟世界书数据失败:', error);
            return false;
        }
    }

    /**
     * 🔧 获取请求头（兼容性方法）
     */
    getRequestHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 尝试获取SillyTavern的标准请求头
        if (typeof window.getRequestHeaders === 'function') {
            try {
                const sillyHeaders = window.getRequestHeaders();
                return { ...headers, ...sillyHeaders };
            } catch (error) {
                console.warn('[WorldBookManager] ⚠️ 获取SillyTavern请求头失败:', error);
            }
        }
        
        // 尝试获取API密钥
        if (window.secret_state && window.secret_state.length > 0) {
            headers['Authorization'] = `Bearer ${window.secret_state}`;
        }
        
        return headers;
    }

    /**
     * 🧪 诊断世界书读取问题
     */
    async diagnoseWorldBookIssues() {
        console.log('[WorldBookManager] 🧪 开始诊断世界书读取问题...');
        
        const diagnosis = {
            timestamp: Date.now(),
            environment: {
                isSillyTavernContext: !!window.SillyTavern?.getContext,
                hasWorldInfoAPI: typeof window.loadWorldInfo === 'function',
                hasWorldInfoSelect: !!document.querySelector('#world_info'),
                hasGlobalWorldInfo: !!window.world_info,
                currentURL: window.location.href
            },
            manager: {
                initialized: this.initialized,
                errorCount: this.errorCount,
                cacheSize: {
                    worldBooks: this.worldBooksCache.size,
                    entries: this.entriesCache.size
                },
                lastCacheUpdate: this.lastCacheUpdate,
                readingState: { ...this.readingState },
                config: { ...this.config }
            },
            tests: {}
        };

        // 测试1：世界书列表读取
        try {
            const startTime = Date.now();
            const worldBooks = await this.getAvailableWorldBooks();
            diagnosis.tests.worldBooksList = {
                success: true,
                count: worldBooks.length,
                responseTime: Date.now() - startTime,
                books: worldBooks.map(book => ({
                    id: book.id,
                    name: book.name,
                    source: book.source,
                    entryCount: book.entryCount,
                    isDefault: book.isDefault,
                    hasError: !!book.error
                }))
            };
        } catch (error) {
            diagnosis.tests.worldBooksList = {
                success: false,
                error: error.message
            };
        }

        // 测试2：条目读取（如果有可用的世界书）
        if (diagnosis.tests.worldBooksList?.success && diagnosis.tests.worldBooksList.count > 0) {
            try {
                const firstBook = diagnosis.tests.worldBooksList.books[0];
                const startTime = Date.now();
                const entries = await this.getWorldBookEntries(firstBook.id);
                diagnosis.tests.entryReading = {
                    success: true,
                    bookId: firstBook.id,
                    bookName: firstBook.name,
                    entryCount: entries.length,
                    responseTime: Date.now() - startTime,
                    sampleEntries: entries.slice(0, 3).map(entry => ({
                        id: entry.id,
                        hasKey: !!entry.key,
                        hasContent: !!entry.content,
                        characterCount: entry.characterCount,
                        disabled: entry.disable
                    }))
                };
            } catch (error) {
                diagnosis.tests.entryReading = {
                    success: false,
                    error: error.message
                };
            }
        }

        // 测试3：启用内容获取
        try {
            const startTime = Date.now();
            const result = await this.getEnabledWorldBookContent();
            diagnosis.tests.enabledContent = {
                success: true,
                entryCount: result.entries.length,
                totalCharacters: result.totalCharacters,
                isOverLimit: result.isOverLimit,
                truncated: result.truncated,
                responseTime: Date.now() - startTime,
                hasError: !!result.error
            };
        } catch (error) {
            diagnosis.tests.enabledContent = {
                success: false,
                error: error.message
            };
        }

        console.log('[WorldBookManager] 🧪 诊断完成');
        console.table(diagnosis.tests);
        
        return diagnosis;
    }

    /**
     * 🔄 重置世界书管理器状态
     */
    resetWorldBookManager() {
        console.log('[WorldBookManager] 🔄 重置世界书管理器状态...');
        
        // 清理缓存
        this.worldBooksCache.clear();
        this.entriesCache.clear();
        this.lastCacheUpdate = 0;
        this.forceRefreshFlag = false;
        
        // 重置读取状态
        this.readingState = {
            isReading: false,
            lastReadTime: 0,
            readingQueue: new Set(),
            failureCount: 0,
            lastError: null
        };
        
        // 重置错误计数
        this.errorCount = 0;
        
        console.log('[WorldBookManager] ✅ 状态重置完成');
    }

    /**
     * 📊 获取世界书统计信息
     */
    async getWorldBookStatistics() {
        try {
            const stats = {
                timestamp: Date.now(),
                worldBooks: {
                    total: 0,
                    bySource: {},
                    withEntries: 0,
                    totalEntries: 0
                },
                content: {
                    totalCharacters: 0,
                    enabledCharacters: 0,
                    averageEntrySize: 0
                },
                performance: {
                    cacheHitRate: 0,
                    averageReadTime: 0,
                    errorRate: 0
                }
            };

            const worldBooks = await this.getAvailableWorldBooks();
            stats.worldBooks.total = worldBooks.length;

            for (const book of worldBooks) {
                // 统计来源
                stats.worldBooks.bySource[book.source] = (stats.worldBooks.bySource[book.source] || 0) + 1;
                
                if (book.entryCount > 0) {
                    stats.worldBooks.withEntries++;
                    stats.worldBooks.totalEntries += book.entryCount;
                }
            }

            // 获取启用内容统计
            const enabledContent = await this.getEnabledWorldBookContent();
            stats.content.enabledCharacters = enabledContent.totalCharacters;

            if (stats.worldBooks.totalEntries > 0) {
                stats.content.averageEntrySize = Math.round(stats.content.enabledCharacters / enabledContent.entries.length);
            }

            // 性能统计
            const totalOperations = this.readingState.lastReadTime > 0 ? 1 : 0;
            if (totalOperations > 0) {
                stats.performance.errorRate = this.readingState.failureCount / totalOperations;
            }

            return stats;

        } catch (error) {
            console.error('[WorldBookManager] ❌ 获取统计信息失败:', error);
            return {
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * 📋 获取状态信息（增强版）
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            config: this.config,
            cache: {
                worldBooks: this.worldBooksCache.size,
                entries: this.entriesCache.size,
                lastUpdate: this.lastCacheUpdate,
                timeout: this.cacheTimeout
            },
            readingState: {
                ...this.readingState,
                readingQueue: Array.from(this.readingState.readingQueue)
            },
            retryConfig: this.retryConfig,
            performance: {
                lastReadTime: this.readingState.lastReadTime,
                successfulReads: Math.max(0, this.readingState.lastReadTime - this.readingState.failureCount),
                failureCount: this.readingState.failureCount,
                lastError: this.readingState.lastError
            }
        };
    }
}
