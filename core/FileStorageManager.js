/**
 * 文件存储管理器
 * 专门用于存储大型数据（如AI记忆、向量缓存等），避免存储到settings.json中
 */

export class FileStorageManager {
    constructor(eventSystem = null) {
        this.eventSystem = eventSystem;
        this.MODULE_NAME = 'information_bar_integration_tool';
        
        // 存储路径配置
        this.storagePaths = {
            memory: 'data/default-user/extensions/information_bar_memory.json',
            cache: 'data/default-user/extensions/information_bar_cache.json',
            vectors: 'data/default-user/extensions/information_bar_vectors.json',
            backups: 'data/default-user/extensions/information_bar_backups/'
        };
        
        // 内存缓存
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存超时
        
        // 写入队列（防止频繁写入）
        this.writeQueue = new Map();
        this.writeDelay = 1000; // 1秒延迟写入
        
        console.log('[FileStorageManager] 📁 文件存储管理器初始化完成');
    }

    /**
     * 初始化存储目录
     */
    async init() {
        try {
            console.log('[FileStorageManager] 🔧 初始化存储目录...');
            
            // 检查是否在Node.js环境中（SillyTavern服务端）
            if (typeof window === 'undefined' && typeof require !== 'undefined') {
                const fs = require('fs').promises;
                const path = require('path');
                
                // 创建扩展数据目录
                const extensionDir = path.dirname(this.storagePaths.memory);
                try {
                    await fs.mkdir(extensionDir, { recursive: true });
                    console.log('[FileStorageManager] ✅ 扩展数据目录已创建:', extensionDir);
                } catch (error) {
                    if (error.code !== 'EEXIST') {
                        throw error;
                    }
                }
                
                // 创建备份目录
                try {
                    await fs.mkdir(this.storagePaths.backups, { recursive: true });
                    console.log('[FileStorageManager] ✅ 备份目录已创建:', this.storagePaths.backups);
                } catch (error) {
                    if (error.code !== 'EEXIST') {
                        throw error;
                    }
                }
            }
            
            console.log('[FileStorageManager] ✅ 存储目录初始化完成');
            
        } catch (error) {
            console.error('[FileStorageManager] ❌ 初始化存储目录失败:', error);
        }
    }

    /**
     * 保存数据到文件
     * @param {string} type - 数据类型 ('memory', 'cache', 'vectors')
     * @param {string} key - 数据键
     * @param {any} data - 数据
     */
    async saveToFile(type, key, data) {
        try {
            // 检查是否在浏览器环境中
            if (typeof window !== 'undefined') {
                console.log('[FileStorageManager] ⚠️ 浏览器环境，使用localStorage作为后备存储');
                return this.saveToLocalStorage(type, key, data);
            }
            
            const filePath = this.storagePaths[type];
            if (!filePath) {
                throw new Error(`未知的数据类型: ${type}`);
            }
            
            // 读取现有数据
            let existingData = {};
            try {
                const fs = require('fs').promises;
                const fileContent = await fs.readFile(filePath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('[FileStorageManager] ⚠️ 读取现有文件失败，将创建新文件:', error.message);
                }
            }
            
            // 更新数据
            existingData[key] = {
                data: data,
                timestamp: Date.now(),
                size: JSON.stringify(data).length
            };
            
            // 写入文件（使用队列防止频繁写入）
            await this.queueWrite(filePath, existingData);
            
            // 更新内存缓存
            this.memoryCache.set(`${type}:${key}`, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log(`[FileStorageManager] ✅ 数据已保存到文件: ${type}/${key}`);
            
        } catch (error) {
            console.error('[FileStorageManager] ❌ 保存数据到文件失败:', error);
            // 后备方案：使用localStorage
            return this.saveToLocalStorage(type, key, data);
        }
    }

    /**
     * 从文件读取数据
     * @param {string} type - 数据类型
     * @param {string} key - 数据键
     * @returns {any} 数据
     */
    async loadFromFile(type, key) {
        try {
            // 先检查内存缓存
            const cacheKey = `${type}:${key}`;
            const cached = this.memoryCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }
            
            // 检查是否在浏览器环境中
            if (typeof window !== 'undefined') {
                return this.loadFromLocalStorage(type, key);
            }
            
            const filePath = this.storagePaths[type];
            if (!filePath) {
                throw new Error(`未知的数据类型: ${type}`);
            }
            
            const fs = require('fs').promises;
            const fileContent = await fs.readFile(filePath, 'utf8');
            const fileData = JSON.parse(fileContent);
            
            if (fileData[key]) {
                const data = fileData[key].data;
                
                // 更新内存缓存
                this.memoryCache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                return data;
            }
            
            return null;
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('[FileStorageManager] ❌ 从文件读取数据失败:', error);
            }
            // 后备方案：使用localStorage
            return this.loadFromLocalStorage(type, key);
        }
    }

    /**
     * 删除文件中的数据
     * @param {string} type - 数据类型
     * @param {string} key - 数据键
     */
    async deleteFromFile(type, key) {
        try {
            // 从内存缓存中删除
            this.memoryCache.delete(`${type}:${key}`);
            
            // 检查是否在浏览器环境中
            if (typeof window !== 'undefined') {
                return this.deleteFromLocalStorage(type, key);
            }
            
            const filePath = this.storagePaths[type];
            if (!filePath) {
                throw new Error(`未知的数据类型: ${type}`);
            }
            
            // 读取现有数据
            const fs = require('fs').promises;
            let existingData = {};
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                existingData = JSON.parse(fileContent);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return; // 文件不存在，无需删除
                }
                throw error;
            }
            
            // 删除数据
            delete existingData[key];
            
            // 写入文件
            await this.queueWrite(filePath, existingData);
            
            console.log(`[FileStorageManager] ✅ 数据已从文件删除: ${type}/${key}`);
            
        } catch (error) {
            console.error('[FileStorageManager] ❌ 从文件删除数据失败:', error);
            // 后备方案：使用localStorage
            return this.deleteFromLocalStorage(type, key);
        }
    }

    /**
     * 队列写入（防止频繁写入）
     * @param {string} filePath - 文件路径
     * @param {Object} data - 数据
     */
    async queueWrite(filePath, data) {
        // 清除之前的写入定时器
        if (this.writeQueue.has(filePath)) {
            clearTimeout(this.writeQueue.get(filePath));
        }
        
        // 设置新的写入定时器
        const timer = setTimeout(async () => {
            try {
                const fs = require('fs').promises;
                await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
                this.writeQueue.delete(filePath);
                console.log(`[FileStorageManager] 💾 文件已写入: ${filePath}`);
            } catch (error) {
                console.error('[FileStorageManager] ❌ 写入文件失败:', error);
                this.writeQueue.delete(filePath);
            }
        }, this.writeDelay);
        
        this.writeQueue.set(filePath, timer);
    }

    /**
     * 后备方案：保存到localStorage
     */
    saveToLocalStorage(type, key, data) {
        try {
            const storageKey = `${this.MODULE_NAME}_file_${type}_${key}`;
            const storageData = {
                data: data,
                timestamp: Date.now(),
                size: JSON.stringify(data).length
            };
            localStorage.setItem(storageKey, JSON.stringify(storageData));
            console.log(`[FileStorageManager] 📦 数据已保存到localStorage: ${type}/${key}`);
        } catch (error) {
            console.error('[FileStorageManager] ❌ 保存到localStorage失败:', error);
        }
    }

    /**
     * 后备方案：从localStorage读取
     */
    loadFromLocalStorage(type, key) {
        try {
            const storageKey = `${this.MODULE_NAME}_file_${type}_${key}`;
            const storageData = localStorage.getItem(storageKey);
            if (storageData) {
                const parsed = JSON.parse(storageData);
                return parsed.data;
            }
            return null;
        } catch (error) {
            console.error('[FileStorageManager] ❌ 从localStorage读取失败:', error);
            return null;
        }
    }

    /**
     * 后备方案：从localStorage删除
     */
    deleteFromLocalStorage(type, key) {
        try {
            const storageKey = `${this.MODULE_NAME}_file_${type}_${key}`;
            localStorage.removeItem(storageKey);
            console.log(`[FileStorageManager] 🗑️ 数据已从localStorage删除: ${type}/${key}`);
        } catch (error) {
            console.error('[FileStorageManager] ❌ 从localStorage删除失败:', error);
        }
    }

    /**
     * 获取存储统计信息
     */
    async getStorageStats() {
        const stats = {
            memory: { count: 0, size: 0 },
            cache: { count: 0, size: 0 },
            vectors: { count: 0, size: 0 },
            total: { count: 0, size: 0 }
        };
        
        try {
            for (const [type, filePath] of Object.entries(this.storagePaths)) {
                if (type === 'backups') continue;
                
                if (typeof window !== 'undefined') {
                    // 浏览器环境：统计localStorage
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(`${this.MODULE_NAME}_file_${type}_`)) {
                            const data = localStorage.getItem(key);
                            if (data) {
                                stats[type].count++;
                                stats[type].size += data.length;
                            }
                        }
                    }
                } else {
                    // Node.js环境：统计文件
                    try {
                        const fs = require('fs').promises;
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        const fileData = JSON.parse(fileContent);
                        
                        stats[type].count = Object.keys(fileData).length;
                        stats[type].size = fileContent.length;
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.warn(`[FileStorageManager] ⚠️ 统计文件失败: ${filePath}`, error.message);
                        }
                    }
                }
                
                stats.total.count += stats[type].count;
                stats.total.size += stats[type].size;
            }
            
            // 转换为可读格式
            for (const [type, data] of Object.entries(stats)) {
                data.sizeFormatted = this.formatBytes(data.size);
            }
            
            return stats;
            
        } catch (error) {
            console.error('[FileStorageManager] ❌ 获取存储统计失败:', error);
            return stats;
        }
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 清理过期数据
     */
    async cleanupExpiredData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 默认7天
        try {
            console.log('[FileStorageManager] 🧹 开始清理过期数据...');

            const now = Date.now();
            let cleanedCount = 0;

            for (const [type, filePath] of Object.entries(this.storagePaths)) {
                if (type === 'backups') continue;

                if (typeof window !== 'undefined') {
                    // 浏览器环境：清理localStorage
                    const keysToDelete = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(`${this.MODULE_NAME}_file_${type}_`)) {
                            try {
                                const data = JSON.parse(localStorage.getItem(key));
                                if (data.timestamp && (now - data.timestamp) > maxAge) {
                                    keysToDelete.push(key);
                                }
                            } catch (error) {
                                // 损坏的数据，也删除
                                keysToDelete.push(key);
                            }
                        }
                    }

                    keysToDelete.forEach(key => {
                        localStorage.removeItem(key);
                        cleanedCount++;
                    });

                } else {
                    // Node.js环境：清理文件
                    try {
                        const fs = require('fs').promises;
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        const fileData = JSON.parse(fileContent);

                        let modified = false;
                        for (const [key, entry] of Object.entries(fileData)) {
                            if (entry.timestamp && (now - entry.timestamp) > maxAge) {
                                delete fileData[key];
                                cleanedCount++;
                                modified = true;
                            }
                        }

                        if (modified) {
                            await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
                        }

                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.warn(`[FileStorageManager] ⚠️ 清理文件失败: ${filePath}`, error.message);
                        }
                    }
                }
            }

            console.log(`[FileStorageManager] ✅ 清理完成，删除了 ${cleanedCount} 个过期数据项`);
            return cleanedCount;

        } catch (error) {
            console.error('[FileStorageManager] ❌ 清理过期数据失败:', error);
            return 0;
        }
    }

    /**
     * 🧹 清理多聊天记忆数据冗余
     * 清理不活跃聊天的记忆数据，只保留最近的几个聊天
     */
    async cleanupChatMemoryData(maxChatsToKeep = 5) {
        try {
            console.log('[FileStorageManager] 🧹 开始清理多聊天记忆数据...');

            // 获取所有记忆数据键
            const memoryKeys = [];

            if (typeof window !== 'undefined') {
                // 浏览器环境：从localStorage获取
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(`${this.MODULE_NAME}_file_memory_deep_memory_`)) {
                        const dataKey = key.replace(`${this.MODULE_NAME}_file_memory_`, '');
                        memoryKeys.push(dataKey);
                    }
                }
            } else {
                // Node.js环境：从文件获取
                try {
                    const fs = require('fs').promises;
                    const filePath = this.storagePaths.memory;
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const fileData = JSON.parse(fileContent);

                    memoryKeys.push(...Object.keys(fileData).filter(key => key.startsWith('deep_memory_')));
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn('[FileStorageManager] ⚠️ 读取记忆文件失败:', error.message);
                    }
                }
            }

            // 分析聊天ID和时间戳
            const chatIdPattern = /deep_memory_\w+_(.+)$/;
            const chatData = {};

            memoryKeys.forEach(key => {
                const match = key.match(chatIdPattern);
                if (match) {
                    const chatId = match[1];
                    if (!chatData[chatId]) {
                        chatData[chatId] = {
                            keys: [],
                            timestamp: 0
                        };
                    }
                    chatData[chatId].keys.push(key);

                    // 尝试从聊天ID中提取时间戳
                    const timeMatch = chatId.match(/(\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s)/);
                    if (timeMatch) {
                        const timeStr = timeMatch[1];
                        const timestamp = this.parseTimeString(timeStr);
                        if (timestamp > chatData[chatId].timestamp) {
                            chatData[chatId].timestamp = timestamp;
                        }
                    }
                }
            });

            // 按时间戳排序，保留最新的聊天
            const sortedChats = Object.entries(chatData)
                .sort(([, a], [, b]) => b.timestamp - a.timestamp);

            console.log(`[FileStorageManager] 📊 发现 ${sortedChats.length} 个聊天的记忆数据`);

            // 删除超出保留数量的聊天数据
            let cleanedCount = 0;
            const chatsToDelete = sortedChats.slice(maxChatsToKeep);

            for (const [chatId, data] of chatsToDelete) {
                console.log(`[FileStorageManager] 🗑️ 清理聊天记忆数据: ${chatId} (${data.keys.length} 个文件)`);

                for (const key of data.keys) {
                    try {
                        await this.deleteFromFile('memory', key);
                        cleanedCount++;
                    } catch (error) {
                        console.warn(`[FileStorageManager] ⚠️ 删除记忆数据失败: ${key}`, error.message);
                    }
                }
            }

            console.log(`[FileStorageManager] ✅ 聊天记忆数据清理完成，删除了 ${cleanedCount} 个数据项`);
            console.log(`[FileStorageManager] 📊 保留了最新的 ${Math.min(maxChatsToKeep, sortedChats.length)} 个聊天的记忆数据`);

            return {
                totalChats: sortedChats.length,
                deletedChats: chatsToDelete.length,
                deletedItems: cleanedCount,
                keptChats: Math.min(maxChatsToKeep, sortedChats.length)
            };

        } catch (error) {
            console.error('[FileStorageManager] ❌ 清理聊天记忆数据失败:', error);
            return { error: error.message };
        }
    }

    /**
     * 解析时间字符串为时间戳
     */
    parseTimeString(timeStr) {
        try {
            // 格式: 2025-09-28@08h59m29s
            const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
            if (match) {
                const [, year, month, day, hour, minute, second] = match;
                return new Date(year, month - 1, day, hour, minute, second).getTime();
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
}
