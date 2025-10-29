/**
 * 🔄 数据迁移工具
 * 用于将col_X格式的数据迁移到中文字段名格式
 * 
 * 迁移策略：
 * 1. 读取所有聊天的面板数据
 * 2. 将col_X格式的键转换为中文字段名
 * 3. 保留原数据作为备份
 * 4. 支持回滚
 */

export class DataMigrationTool {
    constructor(dependencies = {}) {
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.infoBarSettings = dependencies.infoBarSettings || window.SillyTavernInfobar?.modules?.settings;
        
        console.log('[DataMigrationTool] 🔧 数据迁移工具初始化');
    }

    /**
     * 🚀 执行完整的数据迁移
     * @returns {Object} 迁移结果统计
     */
    async migrateAllData() {
        try {
            console.log('[DataMigrationTool] 🔄 ========== 开始数据迁移 ==========');
            
            const stats = {
                totalChats: 0,
                migratedChats: 0,
                totalPanels: 0,
                migratedPanels: 0,
                totalFields: 0,
                migratedFields: 0,
                errors: []
            };

            // 1. 创建备份
            console.log('[DataMigrationTool] 💾 创建数据备份...');
            await this.createBackup();

            // 2. 获取所有聊天数据
            const allChatData = await this.getAllChatData();
            stats.totalChats = Object.keys(allChatData).length;
            console.log(`[DataMigrationTool] 📊 发现 ${stats.totalChats} 个聊天`);

            // 3. 遍历每个聊天进行迁移
            for (const [chatId, chatData] of Object.entries(allChatData)) {
                try {
                    const chatStats = await this.migrateChatData(chatId, chatData);
                    stats.migratedChats++;
                    stats.totalPanels += chatStats.totalPanels;
                    stats.migratedPanels += chatStats.migratedPanels;
                    stats.totalFields += chatStats.totalFields;
                    stats.migratedFields += chatStats.migratedFields;
                } catch (error) {
                    console.error(`[DataMigrationTool] ❌ 迁移聊天 ${chatId} 失败:`, error);
                    stats.errors.push({ chatId, error: error.message });
                }
            }

            // 4. 保存迁移标记
            await this.unifiedDataCore.setData('data_migration_completed', {
                timestamp: Date.now(),
                version: '2.0.0',
                stats
            }, 'global');

            console.log('[DataMigrationTool] ✅ ========== 数据迁移完成 ==========');
            console.log('[DataMigrationTool] 📊 迁移统计:', stats);

            return stats;

        } catch (error) {
            console.error('[DataMigrationTool] ❌ 数据迁移失败:', error);
            throw error;
        }
    }

    /**
     * 🔄 迁移单个聊天的数据
     */
    async migrateChatData(chatId, chatData) {
        const stats = {
            totalPanels: 0,
            migratedPanels: 0,
            totalFields: 0,
            migratedFields: 0
        };

        console.log(`[DataMigrationTool] 🔄 迁移聊天: ${chatId}`);

        // 检查是否有infobar_data
        if (!chatData.infobar_data || !chatData.infobar_data.panels) {
            console.log(`[DataMigrationTool] ⏭️ 聊天 ${chatId} 没有面板数据，跳过`);
            return stats;
        }

        const panels = chatData.infobar_data.panels;
        stats.totalPanels = Object.keys(panels).length;

        // 遍历每个面板
        for (const [panelId, panelData] of Object.entries(panels)) {
            try {
                const migratedData = await this.migratePanelData(panelId, panelData);
                
                if (migratedData.migrated) {
                    // 保存迁移后的数据
                    panels[panelId] = migratedData.data;
                    stats.migratedPanels++;
                    stats.totalFields += migratedData.totalFields;
                    stats.migratedFields += migratedData.migratedFields;
                }
            } catch (error) {
                console.error(`[DataMigrationTool] ❌ 迁移面板 ${panelId} 失败:`, error);
            }
        }

        // 保存更新后的聊天数据
        if (stats.migratedPanels > 0) {
            await this.saveChatData(chatId, chatData);
            console.log(`[DataMigrationTool] ✅ 聊天 ${chatId} 迁移完成: ${stats.migratedPanels}/${stats.totalPanels} 个面板`);
        }

        return stats;
    }

    /**
     * 🔄 迁移单个面板的数据
     */
    async migratePanelData(panelId, panelData) {
        const result = {
            migrated: false,
            data: panelData,
            totalFields: 0,
            migratedFields: 0
        };

        // 获取面板的字段映射（col_X -> 中文字段名）
        const fieldMapping = this.getFieldMapping(panelId);
        if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
            console.log(`[DataMigrationTool] ⏭️ 面板 ${panelId} 没有字段映射，跳过`);
            return result;
        }

        // 检查数据格式
        if (Array.isArray(panelData)) {
            // 多行数据格式
            result.data = panelData.map(row => this.migrateRowData(row, fieldMapping, result));
            result.migrated = result.migratedFields > 0;
        } else if (typeof panelData === 'object' && panelData !== null) {
            // 单行数据格式
            result.data = this.migrateRowData(panelData, fieldMapping, result);
            result.migrated = result.migratedFields > 0;
        }

        if (result.migrated) {
            console.log(`[DataMigrationTool] ✅ 面板 ${panelId} 迁移: ${result.migratedFields}/${result.totalFields} 个字段`);
        }

        return result;
    }

    /**
     * 🔄 迁移单行数据
     */
    migrateRowData(rowData, fieldMapping, stats) {
        if (!rowData || typeof rowData !== 'object') {
            return rowData;
        }

        const migratedRow = {};
        let hasColXFields = false;

        // 遍历行数据的所有字段
        for (const [key, value] of Object.entries(rowData)) {
            stats.totalFields++;

            // 检查是否是col_X格式
            if (/^col_\d+$/.test(key)) {
                hasColXFields = true;
                
                // 查找对应的中文字段名
                const chineseFieldName = fieldMapping[key];
                
                if (chineseFieldName) {
                    // 使用中文字段名作为新键
                    migratedRow[chineseFieldName] = value;
                    stats.migratedFields++;
                    console.log(`[DataMigrationTool] 🔄 字段迁移: ${key} -> ${chineseFieldName} = "${value}"`);
                } else {
                    // 没有找到映射，保留原键
                    migratedRow[key] = value;
                    console.warn(`[DataMigrationTool] ⚠️ 未找到字段映射: ${key}`);
                }
            } else {
                // 不是col_X格式，直接保留
                migratedRow[key] = value;
            }
        }

        return hasColXFields ? migratedRow : rowData;
    }

    /**
     * 📋 获取面板的字段映射（col_X -> 中文字段名）
     */
    getFieldMapping(panelId) {
        try {
            if (!this.infoBarSettings) {
                console.warn('[DataMigrationTool] ⚠️ InfoBarSettings 不可用');
                return {};
            }

            // 获取面板配置
            const panelConfig = this.infoBarSettings.getPanelConfig(panelId);
            if (!panelConfig || !panelConfig.subItems) {
                return {};
            }

            // 构建映射表：col_X -> 中文字段名
            const mapping = {};
            panelConfig.subItems.forEach((item, index) => {
                const colKey = `col_${index + 1}`;
                const chineseFieldName = item.displayName || item.name || item.key;
                
                // 只有当字段名不是col_X格式时才添加映射
                if (chineseFieldName && !(/^col_\d+$/.test(chineseFieldName))) {
                    mapping[colKey] = chineseFieldName;
                }
            });

            return mapping;

        } catch (error) {
            console.error('[DataMigrationTool] ❌ 获取字段映射失败:', error);
            return {};
        }
    }

    /**
     * 💾 创建数据备份
     */
    async createBackup() {
        try {
            const allData = await this.unifiedDataCore.getAllData('all');
            const backup = {
                timestamp: Date.now(),
                version: '1.0.0',
                data: allData
            };

            await this.unifiedDataCore.setData('data_migration_backup', backup, 'global');
            console.log('[DataMigrationTool] ✅ 数据备份完成');

        } catch (error) {
            console.error('[DataMigrationTool] ❌ 创建备份失败:', error);
            throw error;
        }
    }

    /**
     * 📊 获取所有聊天数据
     */
    async getAllChatData() {
        try {
            const allData = await this.unifiedDataCore.getAllData('chat');
            const chatData = {};

            // 提取所有chat_开头的数据
            for (const [key, value] of Object.entries(allData)) {
                if (key.startsWith('chat_')) {
                    const chatId = key.replace('chat_', '');
                    chatData[chatId] = value;
                }
            }

            return chatData;

        } catch (error) {
            console.error('[DataMigrationTool] ❌ 获取聊天数据失败:', error);
            return {};
        }
    }

    /**
     * 💾 保存聊天数据
     */
    async saveChatData(chatId, chatData) {
        try {
            const chatDataKey = `chat_${chatId}`;
            await this.unifiedDataCore.chatMetadata.set(chatDataKey, chatData);
            console.log(`[DataMigrationTool] ✅ 保存聊天数据: ${chatId}`);

        } catch (error) {
            console.error(`[DataMigrationTool] ❌ 保存聊天数据失败: ${chatId}`, error);
            throw error;
        }
    }

    /**
     * 🔙 回滚迁移
     */
    async rollback() {
        try {
            console.log('[DataMigrationTool] 🔙 开始回滚数据迁移...');

            // 获取备份数据
            const backup = await this.unifiedDataCore.getData('data_migration_backup', 'global');
            if (!backup || !backup.data) {
                throw new Error('未找到备份数据');
            }

            // 恢复数据
            // 注意：这里需要实现完整的数据恢复逻辑
            console.log('[DataMigrationTool] ⚠️ 回滚功能需要手动实现');
            console.log('[DataMigrationTool] 💡 建议：重新导入备份数据');

            return { success: true, message: '请手动恢复备份数据' };

        } catch (error) {
            console.error('[DataMigrationTool] ❌ 回滚失败:', error);
            throw error;
        }
    }
}

