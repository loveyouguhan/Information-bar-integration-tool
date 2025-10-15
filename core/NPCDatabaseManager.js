/**
 * NPCDatabaseManager
 * 
 * 负责：
 * - 唯一ID生成（npc_0000 样式）
 * - 名称到ID映射、别名支持
 * - 数据持久化（统一数据核心 UnifiedDataCore -> localStorage 范围 global）
 * - 智能合并：同名NPC出现时合并字段与统计
 * - 出现统计：出现次数、最后出现时间、最后对话ID、最后聊天ID
 * - 事件集成：监听 xml/data 解析结果与 data:updated 事件
 */

export class NPCDatabaseManager {
    constructor({ unifiedDataCore, eventSystem } = {}) {
        this.dataCore = unifiedDataCore || window.SillyTavernInfobar?.modules?.dataCore;
        this.eventSystem = eventSystem || window.SillyTavernInfobar?.eventSource;

        this.DB_KEY_PREFIX = 'npcDatabase';
        this.currentChatId = null; // 当前聊天ID
        this.db = {
            version: 1,
            nextId: 0,
            nameToId: {}, // { name -> id }
            npcs: {} // { id -> npcRecord }
        };

        this.initialized = false;
        this.errorCount = 0;

        this.init = this.init.bind(this);
        this.save = this.save.bind(this);
        this.load = this.load.bind(this);
        this.ensureNpc = this.ensureNpc.bind(this);
        this.handleDataUpdated = this.handleDataUpdated.bind(this);
        this.extractNpcsFromPanels = this.extractNpcsFromPanels.bind(this);
        this.search = this.search.bind(this);
        this.export = this.export.bind(this);
        this.import = this.import.bind(this);
        this.getCurrentChatId = this.getCurrentChatId.bind(this);
        this.getCurrentDbKey = this.getCurrentDbKey.bind(this);
        this.deleteNPC = this.deleteNPC.bind(this);
    }

    /**
     * 获取当前聊天ID
     * @returns {string|null} 当前聊天ID
     */
    getCurrentChatId() {
        try {
            // 实时获取SillyTavern上下文
            const context = SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[NPCDB] ⚠️ 无法获取SillyTavern上下文');
                return null;
            }

            const chatId = context.chatId;
            if (!chatId) {
                console.warn('[NPCDB] ⚠️ 当前没有活动聊天');
                return null;
            }

            return chatId;

        } catch (error) {
            console.error('[NPCDB] ❌ 获取当前聊天ID失败:', error);
            return null;
        }
    }

    /**
     * 获取当前聊天的数据库键
     * @returns {string} 数据库键
     */
    getCurrentDbKey() {
        const chatId = this.getCurrentChatId();
        if (!chatId) {
            // 如果没有聊天ID，使用默认键（向后兼容）
            return this.DB_KEY_PREFIX;
        }
        return `${this.DB_KEY_PREFIX}_${chatId}`;
    }

    async init() {
        try {
            await this.load();

            // 监听数据更新事件（包含 messageId 与按面板数据）
            if (this.eventSystem) {
                this.eventSystem.on('data:updated', async (payload) => {
                    try { await this.handleDataUpdated(payload); } catch (e) { console.error('[NPCDB] 处理data:updated失败', e); }
                });

                // 🔧 修复：监听聊天切换事件，同时监听多个可能的事件
                this.eventSystem.on('chat:changed', async (data) => {
                    try { await this.handleChatSwitch(data); } catch (e) { console.error('[NPCDB] 处理聊天切换失败', e); }
                });

                // 🔧 新增：直接监听SillyTavern的聊天切换事件作为备用
                const context = SillyTavern?.getContext?.();
                if (context?.eventSource && context?.event_types) {
                    context.eventSource.on(context.event_types.CHAT_CHANGED, async (data) => {
                        try {
                            console.log('[NPCDB] 🔄 直接收到SillyTavern聊天切换事件');
                            await this.handleChatSwitch(data);
                        } catch (e) {
                            console.error('[NPCDB] 处理SillyTavern聊天切换失败', e);
                        }
                    });
                    console.log('[NPCDB] 🔗 已绑定SillyTavern聊天切换事件');
                }
            }

            this.initialized = true;
            console.log('[NPCDB] ✅ NPC数据库管理器初始化完成，NPC数量:', Object.keys(this.db.npcs).length);

            // 🔧 修复：在初始化完成后再次确保事件监听器已注册
            this.ensureEventListeners();
        } catch (error) {
            console.error('[NPCDB] ❌ 初始化失败:', error);
            this.errorCount++;
        }
    }

    /**
     * 🔧 新增：确保事件监听器已注册
     */
    ensureEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[NPCDB] ⚠️ 事件系统不可用，无法注册事件监听器');
                return;
            }

            // 检查是否已经注册了聊天切换事件监听器
            const listeners = this.eventSystem._events?.['chat:changed'];
            const hasNpcListener = listeners?.some(listener =>
                listener.toString().includes('handleChatSwitch')
            );

            if (!hasNpcListener) {
                console.log('[NPCDB] 🔗 注册聊天切换事件监听器...');

                this.eventSystem.on('chat:changed', async (data) => {
                    try {
                        await this.handleChatSwitch(data);
                    } catch (e) {
                        console.error('[NPCDB] 处理聊天切换失败', e);
                    }
                });

                console.log('[NPCDB] ✅ 聊天切换事件监听器注册成功');
            } else {
                console.log('[NPCDB] ℹ️ 聊天切换事件监听器已存在');
            }

            // 同时注册SillyTavern的直接事件监听
            const context = SillyTavern?.getContext?.();
            if (context?.eventSource && context?.event_types) {
                const stListeners = context.eventSource._events?.[context.event_types.CHAT_CHANGED];
                const hasStListener = stListeners?.some(listener =>
                    listener.toString().includes('NPCDB')
                );

                if (!hasStListener) {
                    console.log('[NPCDB] 🔗 注册SillyTavern直接事件监听器...');

                    context.eventSource.on(context.event_types.CHAT_CHANGED, async (data) => {
                        try {
                            console.log('[NPCDB] 🔄 直接收到SillyTavern聊天切换事件');
                            await this.handleChatSwitch(data);
                        } catch (e) {
                            console.error('[NPCDB] 处理SillyTavern聊天切换失败', e);
                        }
                    });

                    console.log('[NPCDB] ✅ SillyTavern直接事件监听器注册成功');
                } else {
                    console.log('[NPCDB] ℹ️ SillyTavern直接事件监听器已存在');
                }
            }

        } catch (error) {
            console.error('[NPCDB] ❌ 确保事件监听器失败:', error);
        }
    }

    /**
     * 🔧 新增：处理聊天切换事件
     * @param {Object} data - 聊天切换事件数据
     */
    async handleChatSwitch(data) {
        try {
            const newChatId = this.getCurrentChatId();
            if (newChatId && newChatId !== this.currentChatId) {
                console.log('[NPCDB] 🔄 检测到聊天切换:', this.currentChatId, '->', newChatId);

                // 🔧 关键修复：保存旧聊天数据时，使用明确的旧chatId
                const oldChatId = this.currentChatId;
                if (oldChatId) {
                    const oldDbKey = `${this.DB_KEY_PREFIX}_${oldChatId}`;
                    console.log('[NPCDB] 💾 保存旧聊天数据:', oldDbKey, Object.keys(this.db.npcs).length, '个NPC');
                    await this.dataCore.setData(oldDbKey, this.db, 'chat');
                }

                // 切换到新聊天的数据
                this.currentChatId = newChatId;
                await this.load();

                console.log('[NPCDB] ✅ 已切换到新聊天的NPC数据库:', Object.keys(this.db.npcs).length, '个NPC');

                // 🚀 触发数据库重新加载事件，确保界面刷新
                if (this.eventSystem) {
                    this.eventSystem.emit('npc:db:reloaded', {
                        chatId: newChatId,
                        npcCount: Object.keys(this.db.npcs).length
                    });
                    
                    // 🚀 额外触发更新事件，确保所有监听器都能收到通知
                    this.eventSystem.emit('npc:db:updated', {
                        action: 'chat_switch',
                        chatId: newChatId,
                        npcCount: Object.keys(this.db.npcs).length
                    });
                }
            } else {
                console.log('[NPCDB] ℹ️ 聊天ID未变化，跳过切换');
            }
        } catch (error) {
            console.error('[NPCDB] ❌ 处理聊天切换失败:', error);
        }
    }

    async load() {
        try {
            if (!this.dataCore) return;

            // 🔧 修复：使用聊天隔离存储
            const currentChatId = this.getCurrentChatId();
            this.currentChatId = currentChatId;

            const dbKey = this.getCurrentDbKey();
            console.log('[NPCDB] 📥 加载聊天NPC数据库:', dbKey, '聊天ID:', currentChatId);

            // 从聊天范围加载数据
            const loaded = await this.dataCore.getData(dbKey, 'chat');

            if (loaded && typeof loaded === 'object') {
                // 加载现有数据
                this.db = {
                    version: 1,
                    nextId: loaded.nextId || 0,
                    nameToId: loaded.nameToId || {},
                    npcs: loaded.npcs || {}
                };
            } else {
                // 🔧 修复：不再从全局存储迁移数据，保持聊天隔离
                console.log('[NPCDB] 📝 当前聊天没有NPC数据，创建空数据库');
                this.db = {
                    version: 1,
                    nextId: 0,
                    nameToId: {},
                    npcs: {}
                };
                // 保存空数据库到当前聊天
                await this.save();
            }

            // 反向构建 nameToId，确保一致性
            Object.values(this.db.npcs).forEach((npc) => {
                if (npc?.name && !this.db.nameToId[npc.name]) this.db.nameToId[npc.name] = npc.id;
            });

            console.log('[NPCDB] ✅ 已加载聊天NPC数据库:', Object.keys(this.db.npcs).length, '个NPC');

        } catch (error) {
            console.error('[NPCDB] ❌ 加载数据库失败:', error);
            this.errorCount++;
        }
    }

    async save() {
        try {
            if (!this.dataCore) return;

            // 🔧 修复：使用聊天隔离存储
            const dbKey = this.getCurrentDbKey();
            await this.dataCore.setData(dbKey, this.db, 'chat');

            console.log('[NPCDB] 💾 已保存聊天NPC数据库:', dbKey, Object.keys(this.db.npcs).length, '个NPC');

            // 广播事件
            this.eventSystem?.emit('npc:db:saved', {
                chatId: this.currentChatId,
                count: Object.keys(this.db.npcs).length,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[NPCDB] ❌ 保存数据库失败:', error);
            this.errorCount++;
        }
    }

    /**
     * 🔧 数据迁移：从全局存储迁移到聊天隔离存储
     */
    async migrateFromGlobalStorage() {
        try {
            console.log('[NPCDB] 🔄 检查是否需要从全局存储迁移数据...');

            // 检查全局存储中是否有旧数据
            const globalData = await this.dataCore.getData(this.DB_KEY_PREFIX, 'global');

            if (globalData && typeof globalData === 'object' && Object.keys(globalData.npcs || {}).length > 0) {
                console.log('[NPCDB] 📦 发现全局存储中的旧数据，但为了保证聊天隔离，不进行自动迁移');
                console.log('[NPCDB] ℹ️ 如需迁移数据，请使用导入/导出功能手动操作');

                // 🔧 修复：不自动迁移全局数据，保持聊天隔离
                // 为当前聊天创建空的数据库
                this.db = {
                    version: 1,
                    nextId: 0,
                    nameToId: {},
                    npcs: {}
                };

                // 保存空数据库到当前聊天
                await this.save();

                console.log('[NPCDB] ✅ 数据迁移完成，已迁移', Object.keys(this.db.npcs).length, '个NPC到当前聊天');

                // 可选：清理全局存储中的旧数据（注释掉以保持向后兼容）
                // await this.dataCore.deleteData(this.DB_KEY_PREFIX, 'global');

            } else {
                console.log('[NPCDB] 📝 无需迁移，初始化空数据库');
                // 初始化空数据库
                this.db = {
                    version: 1,
                    nextId: 0,
                    nameToId: {},
                    npcs: {}
                };
            }

        } catch (error) {
            console.error('[NPCDB] ❌ 数据迁移失败:', error);
            // 迁移失败时初始化空数据库
            this.db = {
                version: 1,
                nextId: 0,
                nameToId: {},
                npcs: {}
            };
        }
    }

    // 生成唯一ID：npc_0000
    generateId() {
        const id = `npc_${String(this.db.nextId).padStart(4, '0')}`;
        this.db.nextId += 1;
        return id;
    }

    normalizeName(name) {
        return (name || '').trim();
    }

    // 🚀 新增：判断字段是否为名称字段
    isNameField(field) {
        const nameFields = [
            'name', '姓名', 'npc_name', 'npcName',
            '名字', '名称', '角色名', '角色名称',
            'character_name', 'characterName',
            'person_name', 'personName',
            '对象名称', 'object_name', 'objectName'
        ];
        // 不区分大小写匹配
        const fieldLower = String(field).toLowerCase();
        return nameFields.some(nf => nf.toLowerCase() === fieldLower || field === nf);
    }

    // 🎯 新增：根据索引获取现有NPC名称（用于增量更新）
    getNpcNameByIndex(index) {
        // 将索引字符串转换为数字 (npc0 -> 0, npc1 -> 1)
        const indexNum = parseInt(index.replace('npc', ''));

        // 获取按ID排序的NPC列表
        const npcList = Object.values(this.db.npcs).sort((a, b) => a.id.localeCompare(b.id));

        // 根据索引返回对应的NPC名称
        if (indexNum >= 0 && indexNum < npcList.length) {
            const targetNpc = npcList[indexNum];
            console.log(`[NPCDB] 🎯 索引匹配: ${index} -> ${targetNpc.name} (${targetNpc.id})`);
            return targetNpc.name;
        }

        console.warn(`[NPCDB] ⚠️ 索引 ${index} 超出范围，当前只有 ${npcList.length} 个NPC`);
        return null;
    }

    // 获取或创建NPC
    ensureNpc(name) {
        const normalized = this.normalizeName(name) || '未命名NPC';
        let id = this.db.nameToId[normalized];
        
        // 🔧 修复：如果找到ID但NPC对象不存在，重新创建NPC对象
        if (id && !this.db.npcs[id]) {
            console.warn(`[NPCDB] ⚠️ ID映射存在但NPC对象丢失: ${normalized} (${id})，重新创建...`);
            const now = Date.now();
            this.db.npcs[id] = {
                id,
                name: normalized,
                fields: {},
                appearCount: 0,
                lastSeen: 0,
                lastMessageId: null,
                lastChatId: null,
                createdAt: now,
                updatedAt: now
            };
        } else if (!id) {
            // 完全新的NPC，创建ID和对象
            id = this.generateId();
            const now = Date.now();
            this.db.nameToId[normalized] = id;
            this.db.npcs[id] = {
                id,
                name: normalized,
                fields: {},
                appearCount: 0,
                lastSeen: 0,
                lastMessageId: null,
                lastChatId: null,
                createdAt: now,
                updatedAt: now
            };
            this.eventSystem?.emit('npc:created', { id, name: normalized, timestamp: now });
        }
        
        return this.db.npcs[id];
    }

    // 智能合并字段：新值优先，忽略空值
    mergeFields(oldFields, newFields) {
        const merged = { ...(oldFields || {}) };
        Object.entries(newFields || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                merged[k] = v;
            }
        });
        return merged;
    }

    // 处理 data:updated 事件，从指定面板提取NPC并更新数据库
    async handleDataUpdated(payload) {
        try {
            // 🔧 修复：始终使用当前聊天ID，不信任payload中的chatId
            const currentChatId = this.getCurrentChatId();
            const messageId = payload?.dataEntry?.messageId || payload?.dataEntry?.index || null;
            const panelsData = payload?.dataEntry?.data || payload?.panelFields || payload?.data || {};

            if (!panelsData || typeof panelsData !== 'object') return;
            if (!currentChatId) {
                console.warn('[NPCDB] ⚠️ 无法获取当前聊天ID，跳过NPC数据更新');
                return;
            }

            // 🔧 修复：从NPCManagementPanel获取用户选择的数据源面板
            const npcPanel = window.SillyTavernInfobar?.modules?.npcManagementPanel;
            const sourcePanelId = npcPanel?.sourcePanelId || 'interaction';
            const panelData = panelsData[sourcePanelId] || {};

            console.log('[NPCDB] 🔍 使用数据源面板:', sourcePanelId, '可用面板:', Object.keys(panelsData));

            const npcs = this.extractNpcsFromPanels(panelData, sourcePanelId);
            if (npcs.length === 0) {
                console.log('[NPCDB] ℹ️ 未从面板提取到NPC数据，跳过更新');
                return;
            }

            console.log('[NPCDB] 📝 处理NPC数据更新，当前聊天:', currentChatId, '数据源:', sourcePanelId);

            let updated = 0;
            npcs.forEach(n => {
                const npc = this.ensureNpc(n.name);
                const before = JSON.stringify(npc.fields);

                // 🔧 修复：清理内部字段，避免泄漏到NPC数据库
                const cleanedFields = this.cleanInternalFields(n.fields);

                npc.fields = this.mergeFields(npc.fields, cleanedFields);
                npc.appearCount = (npc.appearCount || 0) + 1;
                npc.lastSeen = Date.now();
                npc.lastMessageId = messageId;
                npc.lastChatId = currentChatId; // 🔧 修复：使用当前聊天ID
                npc.updatedAt = Date.now();
                updated += (before !== JSON.stringify(npc.fields)) ? 1 : 0;
                this.eventSystem?.emit('npc:updated', { id: npc.id, npc });
            });

            // 保存
            await this.save();
            this.eventSystem?.emit('npc:db:updated', { count: npcs.length, timestamp: Date.now() });
        } catch (error) {
            console.error('[NPCDB] ❌ 处理数据更新失败:', error);
        }
    }

    // 从面板数据中提取 NPCs
    extractNpcsFromPanels(panelData = {}, sourcePanelId = 'interaction') {
        console.log('[NPCDB] 🔍 开始提取NPC数据，数据源面板:', sourcePanelId);
        console.log('[NPCDB] 🔍 数据类型:', Array.isArray(panelData) ? '数组' : '对象');
        console.log('[NPCDB] 🔍 数据内容:', panelData);

        // 🆕 保存当前数据源面板ID，供字段映射使用
        this.currentSourcePanelId = sourcePanelId;

        // 🚀 新增：首先检测是否是数组格式（真实的多行数据格式）
        if (Array.isArray(panelData)) {
            console.log('[NPCDB] ✅ 检测到数组格式的多行数据，开始解析...');
            return this.parseArrayFormat(panelData);
        }

        const groups = new Map(); // npc0 -> { name, fields }
        const globalFields = {}; // 存储没有前缀的字段

        // 🚀 检测是否是对象格式的新多行数据格式
        const newFormatResult = this.parseNewMultiRowFormat(panelData);
        if (newFormatResult && newFormatResult.length > 0) {
            console.log('[NPCDB] ✅ 检测到对象格式的多行数据，成功解析', newFormatResult.length, '个NPC');
            return newFormatResult;
        }

        // 第一遍：分离带前缀的字段和全局字段
        Object.entries(panelData).forEach(([key, value]) => {
            const m = key.match(/^(npc\d+)\.(.+)$/);
            if (m) {
                // 带前缀的字段：npc0.name, npc1.type 等
                const idx = m[1];
                const field = m[2];
                if (!groups.has(idx)) groups.set(idx, { name: '', fields: {} });
                // 🚀 增强：支持更多名称字段格式
                if (this.isNameField(field)) {
                    groups.get(idx).name = String(value).trim();
                } else {
                    groups.get(idx).fields[field] = value;
                }
                console.log(`[NPCDB] 📝 NPC字段: ${idx}.${field} = ${value}`);
            } else {
                // 没有前缀的字段：status, intimacy 等
                globalFields[key] = value;
                console.log(`[NPCDB] 🌐 全局字段: ${key} = ${value}`);
            }
        });

        // 🔧 修复：智能处理全局字段，支持多种格式
        if (Object.keys(globalFields).length > 0) {
            console.log('[NPCDB] 🔍 检测到没有NPC前缀的字段:', Object.keys(globalFields));

            // 🚀 尝试智能处理多行数据结构
            const smartParseResult = this.smartParseGlobalFields(globalFields);
            if (smartParseResult && smartParseResult.length > 0) {
                console.log('[NPCDB] ✅ 智能解析成功，识别出', smartParseResult.length, '个NPC');
                return smartParseResult;
            }

            // 🔄 降级处理：将全局字段归到npc0（兼容旧格式）
            console.log('[NPCDB] 🔄 降级处理：将全局字段归到npc0（兼容旧格式）');
            if (!groups.has('npc0')) groups.set('npc0', { name: '', fields: {} });

            Object.entries(globalFields).forEach(([key, value]) => {
                if (this.isNameField(key)) {
                    groups.get('npc0').name = String(value).trim();
                } else {
                    groups.get('npc0').fields[key] = value;
                }
                console.log(`[NPCDB] 📝 设置npc0字段: ${key} = ${value}`);
            });
        }

        // 组装最终结果
        const list = [];
        groups.forEach((obj, idx) => {
            // 🎯 智能处理：如果没有明确的NPC名称，尝试通过索引匹配现有NPC
            if (!obj.name || obj.name.trim() === '') {
                console.log(`[NPCDB] 🔍 检测到无名称的增量更新数据 ${idx}:`, obj.fields);

                // 尝试通过索引匹配现有NPC
                const existingName = this.getNpcNameByIndex(idx);
                if (existingName) {
                    obj.name = existingName;
                    console.log(`[NPCDB] ✅ 增量更新匹配成功: ${idx} -> ${existingName}`);
                } else {
                    console.warn(`[NPCDB] ⚠️ 无法匹配索引 ${idx}，跳过该数据:`, obj.fields);
                    return; // 无法匹配时跳过
                }
            }

            // 确保名称不是索引占位符格式 (npc0, npc1, etc.)
            if (/^npc\d+$/.test(obj.name.trim())) {
                console.warn(`[NPCDB] ⚠️ 跳过索引占位符格式的NPC名称 "${obj.name}":`, obj.fields);
                return; // 跳过索引占位符格式的名称
            }

            list.push(obj);
        });

        console.log(`[NPCDB] ✅ NPC提取完成，共 ${list.length} 个NPC:`, list.map(n => `${n.name}(${Object.keys(n.fields).length}字段)`));
        return list;
    }

    /**
     * 🚀 新增：解析数组格式的多行数据（真实格式）
     * 支持格式：[{col_1: "林浩", col_2: "初级主导者", ...}, {...}]
     */
    parseArrayFormat(interactionArray) {
        try {
            console.log('[NPCDB] 🔧 解析数组格式的多行数据...');
            console.log('[NPCDB] 📊 数组长度:', interactionArray.length);

            const npcs = [];

            interactionArray.forEach((npcData, index) => {
                if (typeof npcData === 'object' && npcData !== null) {
                    const keys = Object.keys(npcData);
                    console.log(`[NPCDB] 🔍 处理NPC ${index}，字段:`, keys);

                    // 🔧 修复：智能查找名称字段
                    let npcName = '';

                    // 策略1：查找明确的名称字段
                    for (const key of keys) {
                        if (this.isNameField(key)) {
                            npcName = String(npcData[key]).trim();
                            console.log(`[NPCDB] ✅ 找到名称字段 ${key}: ${npcName}`);
                            break;
                        }
                    }

                    // 策略2：按列号顺序查找（col_1 或 "1"）
                    if (!npcName) {
                        if (npcData.col_1) {
                            npcName = String(npcData.col_1).trim();
                            console.log(`[NPCDB] 📝 使用 col_1 作为名称: ${npcName}`);
                        } else if (npcData['1']) {
                            npcName = String(npcData['1']).trim();
                            console.log(`[NPCDB] 📝 使用 "1" 作为名称: ${npcName}`);
                        }
                    }

                    // 策略3：使用第一个有效的字段值
                    if (!npcName || npcName === '') {
                        const firstDataKey = keys.find(key => 
                            key !== 'col_0' && 
                            key !== '0' && 
                            npcData[key] && 
                            String(npcData[key]).trim() !== ''
                        );
                        if (firstDataKey) {
                            npcName = String(npcData[firstDataKey]).trim();
                            console.log(`[NPCDB] 📝 使用第一个有效字段 ${firstDataKey} 作为NPC名称: ${npcName}`);
                        }
                    }

                    // 策略4：使用默认名称
                    if (!npcName || npcName === '') {
                        npcName = `NPC${index + 1}`;
                        console.log(`[NPCDB] ⚠️ 未找到有效名称，使用默认: ${npcName}`);
                    }

                    // 创建NPC对象，使用清理后的字段映射
                    const cleanedFields = this.mapArrayFieldsToStandard(npcData, index);

                    const npcObj = {
                        name: npcName,
                        fields: cleanedFields
                    };

                    npcs.push(npcObj);
                    console.log(`[NPCDB] ✅ 解析NPC ${index}: ${npcName}`);
                    console.log(`[NPCDB] 📝 NPC详情:`, npcObj.fields);
                } else {
                    console.warn(`[NPCDB] ⚠️ 跳过无效的NPC数据 ${index}:`, npcData);
                }
            });

            console.log(`[NPCDB] ✅ 数组格式解析完成，共解析 ${npcs.length} 个NPC`);
            return npcs;

        } catch (error) {
            console.error('[NPCDB] ❌ 解析数组格式失败:', error);
            return [];
        }
    }

    /**
     * 🆕 清理内部字段（避免泄漏到NPC数据库）
     */
    cleanInternalFields(fields) {
        const cleanedFields = {};

        Object.entries(fields).forEach(([key, value]) => {
            // 跳过纯数字键
            if (/^\d+$/.test(key)) {
                console.log(`[NPCDB] 🧹 清理纯数字字段: ${key}`);
                return;
            }

            // 跳过col_x格式字段
            if (/^col_\d+$/.test(key)) {
                console.log(`[NPCDB] 🧹 清理col_x字段: ${key}`);
                return;
            }

            // 跳过内部字段
            if (key === 'index' || key === 'source' || key.startsWith('_')) {
                console.log(`[NPCDB] 🧹 清理内部字段: ${key}`);
                return;
            }

            // 保留有效字段
            cleanedFields[key] = value;
        });

        console.log(`[NPCDB] ✅ 字段清理完成: ${Object.keys(fields).length} -> ${Object.keys(cleanedFields).length}`);
        return cleanedFields;
    }

    /**
     * 🚀 新增：将数组格式字段映射为标准字段（支持数字键和col_x格式）
     * 🔧 修复：使用有意义的字段名存储，避免col_x格式泄漏到世界书
     * 🔧 修复：检测并跳过col_0索引列，避免字段错位
     */
    mapArrayFieldsToStandard(npcData, index) {
        // 🔧 修复：自动检测字段键的格式（数字键 vs col_x格式）
        const hasNumericKeys = Object.keys(npcData).some(key => /^\d+$/.test(key));
        const hasColKeys = Object.keys(npcData).some(key => /^col_\d+$/.test(key));

        console.log(`[NPCDB] 🔍 字段格式检测: 数字键=${hasNumericKeys}, col_x键=${hasColKeys}`);

        // 🔧 新增：检测是否存在col_0索引列
        const hasIndexColumn = npcData.hasOwnProperty('col_0') || npcData.hasOwnProperty('0');
        if (hasIndexColumn) {
            console.log(`[NPCDB] ⚠️ 检测到索引列（col_0），将自动跳过`);
            console.log(`[NPCDB] 📊 索引列值: ${npcData['col_0'] || npcData['0']}`);
        }

        // 🔧 修复：根据实际数据格式选择正确的键名
        // 如果存在col_0索引列，则从col_1开始映射到字段1
        // 如果不存在col_0，则从col_1开始映射到字段1（保持原有逻辑）
        const getFieldValue = (fieldIndex) => {
            // 🔧 关键修复：如果存在col_0索引列，需要调整索引
            // 字段映射: col_1 -> 字段1, col_2 -> 字段2, ...
            // 但如果存在col_0，则: col_1 -> 字段1, col_2 -> 字段2, ...（不变）

            // 优先使用数字键
            if (npcData[fieldIndex] !== undefined) {
                return npcData[fieldIndex];
            }
            // 回退到col_x格式
            if (npcData[`col_${fieldIndex}`] !== undefined) {
                return npcData[`col_${fieldIndex}`];
            }
            return '';
        };

        // 🔧 修复：获取字段显示名称映射
        const fieldMapping = this.getFieldDisplayNameMapping();

        const mappedFields = {
            // 基础信息
            index: index,
            source: 'array_format'
        };

        // 🔧 关键修复：动态获取实际的字段数量，而不是硬编码20
        // 1. 从npcData中获取所有数字键和col_x键
        const allKeys = Object.keys(npcData);
        const numericKeys = allKeys.filter(key => /^\d+$/.test(key)).map(Number);
        const colKeys = allKeys.filter(key => /^col_(\d+)$/.test(key)).map(key => {
            const match = key.match(/^col_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        });

        // 2. 获取最大索引
        const maxNumericIndex = numericKeys.length > 0 ? Math.max(...numericKeys) : 0;
        const maxColIndex = colKeys.length > 0 ? Math.max(...colKeys) : 0;
        const maxFieldIndex = Math.max(maxNumericIndex, maxColIndex);

        console.log(`[NPCDB] 📊 字段索引范围: 数字键最大=${maxNumericIndex}, col_x最大=${maxColIndex}, 实际最大=${maxFieldIndex}`);

        // 🔧 修复：使用有意义的字段名存储，避免col_x格式
        // 遍历所有实际存在的字段索引
        for (let i = 1; i <= maxFieldIndex; i++) {
            const value = getFieldValue(i);
            if (value !== '' && value !== null && value !== undefined) {
                // 🔧 关键修复：使用字段显示名称而不是col_x格式
                const displayName = fieldMapping[`col_${i}`] || fieldMapping[String(i)];

                if (displayName && !/^\d+$/.test(displayName)) {
                    // 使用有意义的字段名
                    mappedFields[displayName] = value;
                    console.log(`[NPCDB] 📝 映射字段 col_${i} -> ${displayName}: ${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}`);
                } else {
                    // 如果没有找到映射，记录警告但仍然保存（使用col_x格式）
                    console.warn(`[NPCDB] ⚠️ 字段 col_${i} 没有映射，值: ${String(value).substring(0, 50)}`);
                    mappedFields[`col_${i}`] = value; // 保存原始格式，避免数据丢失
                }
            }
        }

        // 保留原始数据用于调试
        mappedFields._原始数据 = npcData;
        mappedFields._解析时间 = new Date().toISOString();
        mappedFields._字段数量 = maxFieldIndex;

        const npcName = getFieldValue(1) || 'Unknown';
        const fieldCount = Object.keys(mappedFields).filter(k => !k.startsWith('_') && k !== 'index' && k !== 'source').length;
        console.log(`[NPCDB] 🗂️ 字段映射完成 ${npcName}: 共${fieldCount}个字段`, Object.keys(mappedFields).filter(k => !k.startsWith('_') && k !== 'index' && k !== 'source'));
        return mappedFields;
    }

    /**
     * 🆕 获取字段显示名称映射（从扩展配置动态构建）
     */
    getFieldDisplayNameMapping() {
        try {
            // 🔧 修复：使用当前数据源面板ID
            const sourcePanelId = this.currentSourcePanelId || 'interaction';
            console.log('[NPCDB] 🔍 开始构建动态字段映射，数据源面板:', sourcePanelId);

            // 🔧 关键修复：使用DataTable的getAllEnabledPanels()获取正确的面板配置
            const dataTable = window.SillyTavernInfobar?.modules?.dataTable;
            if (!dataTable || typeof dataTable.getAllEnabledPanels !== 'function') {
                console.warn('[NPCDB] ⚠️ DataTable模块不可用，使用降级方案');
                return this.getFallbackFieldMapping();
            }

            // 获取所有启用的面板配置
            const enabledPanels = dataTable.getAllEnabledPanels();
            const sourcePanel = enabledPanels.find(panel =>
                panel.key === sourcePanelId || panel.id === sourcePanelId
            );

            if (!sourcePanel) {
                console.warn('[NPCDB] ⚠️ 未找到数据源面板配置:', sourcePanelId);
                return this.getFallbackFieldMapping();
            }

            console.log('[NPCDB] ✅ 找到数据源面板配置:', sourcePanel);

            const fieldMapping = {};

            // 🎯 关键修复：直接使用subItems的顺序，这是用户界面的实际顺序
            if (sourcePanel.subItems && Array.isArray(sourcePanel.subItems)) {
                let validColumnIndex = 1; // 有效列号计数器

                sourcePanel.subItems.forEach((subItem, index) => {
                    if (subItem.enabled !== false) {
                        const displayName = subItem.displayName || subItem.name || subItem.key;
                        const fieldKey = subItem.key || displayName;

                        // 🔧 跳过无效字段（纯数字的key和name）
                        if (/^\d+$/.test(fieldKey) && /^\d+$/.test(displayName)) {
                            console.log(`[NPCDB] ⚠️ 跳过无效字段 [${index + 1}]: key="${fieldKey}", name="${displayName}"`);
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

                        console.log(`[NPCDB] 📝 字段映射 [有效列${validColumnIndex}]: ${fieldKey} => "${displayName}"`);
                        validColumnIndex++;
                    }
                });

                const validFieldCount = validColumnIndex - 1;
                console.log('[NPCDB] ✅ 动态字段映射构建完成，共', validFieldCount, '个有效字段');
                console.log('[NPCDB] 📊 完整映射表:', fieldMapping);
                return fieldMapping;
            } else {
                console.warn('[NPCDB] ⚠️ interaction面板没有subItems配置');
                return this.getFallbackFieldMapping();
            }

        } catch (error) {
            console.error('[NPCDB] ❌ 获取字段映射失败:', error);
            return this.getFallbackFieldMapping();
        }
    }

    /**
     * 🆕 回退字段映射表
     */
    getFallbackFieldMapping() {
        console.log('[NPCDB] ⚠️ 使用回退映射表');
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
     * 🚀 新增：解析新的多行数据格式
     * 支持格式：{"1": "林浩", "2": "张三"} 或 {"1.name": "林浩", "1.relationship": "朋友"}
     */
    parseNewMultiRowFormat(interactionPanel) {
        try {
            console.log('[NPCDB] 🔧 尝试解析新的多行数据格式...');

            const keys = Object.keys(interactionPanel);

            // 检测格式1：纯数字索引格式 {"1": "林浩", "2": "张三"}
            const numberIndexPattern = /^\d+$/;
            const numberIndexKeys = keys.filter(key => numberIndexPattern.test(key));

            if (numberIndexKeys.length > 0) {
                console.log('[NPCDB] 🎯 检测到数字索引格式:', numberIndexKeys);
                return this.parseNumberIndexFormat(interactionPanel, numberIndexKeys);
            }

            // 检测格式2：带字段的数字索引格式 {"1.name": "林浩", "1.relationship": "朋友"}
            const fieldIndexPattern = /^(\d+)\.(.+)$/;
            const fieldIndexKeys = keys.filter(key => fieldIndexPattern.test(key));

            if (fieldIndexKeys.length > 0) {
                console.log('[NPCDB] 🎯 检测到字段索引格式:', fieldIndexKeys);
                return this.parseFieldIndexFormat(interactionPanel, fieldIndexKeys);
            }

            // 检测格式3：混合格式（同时包含数字索引和字段索引）
            if (numberIndexKeys.length > 0 && fieldIndexKeys.length > 0) {
                console.log('[NPCDB] 🎯 检测到混合格式');
                return this.parseMixedIndexFormat(interactionPanel, numberIndexKeys, fieldIndexKeys);
            }

            console.log('[NPCDB] ℹ️ 未检测到新的多行数据格式特征');
            return null;

        } catch (error) {
            console.error('[NPCDB] ❌ 解析新多行数据格式失败:', error);
            return null;
        }
    }

    /**
     * 🚀 解析数字索引格式：{"1": "林浩", "2": "张三"}
     */
    parseNumberIndexFormat(interactionPanel, numberIndexKeys) {
        const npcs = [];

        numberIndexKeys.forEach(indexKey => {
            const npcName = String(interactionPanel[indexKey]).trim();
            if (npcName && npcName !== '未知' && npcName !== '暂无') {
                npcs.push({
                    name: npcName,
                    fields: {
                        index: indexKey,
                        source: 'number_index_format'
                    }
                });
                console.log(`[NPCDB] ✅ 数字索引NPC: ${indexKey} -> ${npcName}`);
            }
        });

        return npcs;
    }

    /**
     * 🚀 解析字段索引格式：{"1.name": "林浩", "1.relationship": "朋友"}
     */
    parseFieldIndexFormat(interactionPanel, fieldIndexKeys) {
        const groups = new Map();

        fieldIndexKeys.forEach(key => {
            const match = key.match(/^(\d+)\.(.+)$/);
            if (match) {
                const index = match[1];
                const field = match[2];
                const value = interactionPanel[key];

                if (!groups.has(index)) {
                    groups.set(index, { name: '', fields: {} });
                }

                if (this.isNameField(field)) {
                    groups.get(index).name = String(value).trim();
                } else {
                    groups.get(index).fields[field] = value;
                }

                console.log(`[NPCDB] ✅ 字段索引: ${index}.${field} = ${value}`);
            }
        });

        const npcs = [];
        groups.forEach((npcData, index) => {
            if (npcData.name || Object.keys(npcData.fields).length > 0) {
                // 如果没有名称，尝试从字段中推断
                if (!npcData.name) {
                    npcData.name = npcData.fields.name || npcData.fields.姓名 || `NPC${index}`;
                }

                npcData.fields.index = index;
                npcData.fields.source = 'field_index_format';
                npcs.push(npcData);

                console.log(`[NPCDB] ✅ 字段索引NPC: ${index} -> ${npcData.name} (${Object.keys(npcData.fields).length}字段)`);
            }
        });

        return npcs;
    }

    /**
     * 🚀 解析混合格式：同时包含数字索引和字段索引
     */
    parseMixedIndexFormat(interactionPanel, numberIndexKeys, fieldIndexKeys) {
        // 先解析字段索引格式
        const fieldNpcs = this.parseFieldIndexFormat(interactionPanel, fieldIndexKeys);
        const fieldIndexes = new Set(fieldIndexKeys.map(key => key.split('.')[0]));

        // 再处理纯数字索引，但跳过已经有字段的索引
        const remainingNumberKeys = numberIndexKeys.filter(key => !fieldIndexes.has(key));
        const numberNpcs = this.parseNumberIndexFormat(interactionPanel, remainingNumberKeys);

        console.log(`[NPCDB] ✅ 混合格式解析: ${fieldNpcs.length}个字段NPC + ${numberNpcs.length}个数字NPC`);
        return [...fieldNpcs, ...numberNpcs];
    }

    /**
     * 🚀 智能解析全局字段（兼容性处理）
     */
    smartParseGlobalFields(globalFields) {
        try {
            console.log('[NPCDB] 🔧 尝试智能处理多行数据结构...');
            console.log('[NPCDB] 🔍 分析多行数据结构:', globalFields);

            // 检查是否包含数字索引或类似模式
            const keys = Object.keys(globalFields);
            const hasNumberIndex = keys.some(key => /^\d+$/.test(key));
            const hasFieldIndex = keys.some(key => /^\d+\./.test(key));
            const hasNpcIndex = keys.some(key => /^npc\d+$/.test(key));

            if (hasNumberIndex || hasFieldIndex || hasNpcIndex) {
                console.log('[NPCDB] 🎯 检测到索引模式，尝试解析...');

                // 使用新格式解析器
                const result = this.parseNewMultiRowFormat(globalFields);
                if (result && result.length > 0) {
                    return result;
                }
            }

            console.log('[NPCDB] ℹ️ 未检测到多行数据结构特征');
            return null;

        } catch (error) {
            console.error('[NPCDB] ❌ 智能解析全局字段失败:', error);
            return null;
        }
    }

    // 🧹 新增：清理占位符NPC数据的工具方法
    cleanupPlaceholderNpcs() {
        const placeholderPattern = /^npc\d+$/;
        const toDelete = [];

        Object.entries(this.db.npcs).forEach(([id, npc]) => {
            if (placeholderPattern.test(npc.name)) {
                toDelete.push({ id, name: npc.name, fields: npc.fields });
            }
        });

        if (toDelete.length === 0) {
            console.log('[NPCDB] ✅ 没有发现占位符NPC数据');
            return { cleaned: 0, details: [] };
        }

        console.log(`[NPCDB] 🧹 发现 ${toDelete.length} 个占位符NPC，准备清理:`, toDelete);

        toDelete.forEach(({ id, name }) => {
            delete this.db.npcs[id];
            delete this.db.nameToId[name];
            console.log(`[NPCDB] 🗑️ 已删除占位符NPC: ${name} (${id})`);
        });

        return { cleaned: toDelete.length, details: toDelete };
    }

    // 查询与筛选
    search({ q = '', sortBy = 'lastSeen', order = 'desc', filterCurrentChat = true } = {}) {
        const term = (q || '').trim();
        const arr = Object.values(this.db.npcs);

        // 🔧 采用聊天隔离：数据库本身就是按聊天隔离的，直接使用所有NPC
        let filtered = arr;
        const currentChatId = this.getCurrentChatId();

        console.log(`[NPCDB] 🔍 搜索当前聊天(${currentChatId})的NPC: ${arr.length} 个`);

        // 搜索文本过滤
        if (term) {
            const beforeSearch = filtered.length;
            filtered = filtered.filter(n => (n.name || '').includes(term));
            console.log(`[NPCDB] 🔍 搜索过滤结果: ${filtered.length}/${beforeSearch} 个NPC匹配搜索词 "${term}"`);
        }
        
        // 排序
        const keyGet = {
            name: n => n.name || '',
            appearCount: n => n.appearCount || 0,
            lastSeen: n => n.lastSeen || 0
        }[sortBy] || (n => n.lastSeen || 0);
        filtered.sort((a, b) => {
            const va = keyGet(a); const vb = keyGet(b);
            return order === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
        
        return filtered;
    }

    // 导出/导入
    export() {
        return JSON.stringify(this.db, null, 2);
    }

    async import(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            if (!data || !data.npcs) throw new Error('无效的NPC数据库');
            this.db = {
                version: 1,
                nextId: data.nextId || 0,
                nameToId: data.nameToId || {},
                npcs: data.npcs || {}
            };
            await this.save();
            this.eventSystem?.emit('npc:db:reloaded', { count: Object.keys(this.db.npcs).length });
        } catch (error) {
            console.error('[NPCDB] ❌ 导入失败:', error);
            throw error;
        }
    }

    /**
     * 🔍 根据ID获取NPC
     * @param {string} npcId - NPC ID
     * @returns {Object|null} NPC对象或null
     */
    getNPCById(npcId) {
        try {
            if (!npcId || !this.db.npcs[npcId]) {
                return null;
            }
            return this.db.npcs[npcId];
        } catch (error) {
            console.error('[NPCDB] ❌ 获取NPC失败:', error);
            return null;
        }
    }

    /**
     * 🆕 删除NPC
     * @param {string} npcId - NPC ID
     * @returns {boolean} 是否删除成功
     */
    async deleteNPC(npcId) {
        try {
            if (!npcId || !this.db.npcs[npcId]) {
                console.warn('[NPCDB] ⚠️ NPC不存在:', npcId);
                return false;
            }

            const npc = this.db.npcs[npcId];
            const npcName = npc.name;

            console.log('[NPCDB] 🗑️ 开始删除NPC:', { npcId, npcName });

            // 🌍 新增：同步删除世界书中的相关条目
            try {
                const worldBookManager = window.SillyTavernInfobar?.modules?.worldBookManager;
                if (worldBookManager && typeof worldBookManager.deleteNPCWorldBookEntries === 'function') {
                    console.log('[NPCDB] 🌍 尝试删除世界书中的NPC条目...');
                    const deleteResult = await worldBookManager.deleteNPCWorldBookEntries(npcId, npcName);
                    
                    if (deleteResult.success && deleteResult.deletedCount > 0) {
                        console.log(`[NPCDB] ✅ 成功删除世界书中的 ${deleteResult.deletedCount} 个相关条目`);
                    } else if (deleteResult.success && deleteResult.deletedCount === 0) {
                        console.log('[NPCDB] ℹ️ 世界书中没有该NPC的相关条目');
                    } else {
                        console.warn('[NPCDB] ⚠️ 删除世界书条目时出错:', deleteResult.error);
                    }
                } else {
                    console.log('[NPCDB] ℹ️ 世界书管理器不可用，跳过世界书条目删除');
                }
            } catch (worldBookError) {
                // 世界书删除失败不应阻止NPC删除，只记录警告
                console.warn('[NPCDB] ⚠️ 删除世界书条目时发生错误:', worldBookError);
            }

            // 从数据库中删除NPC
            delete this.db.npcs[npcId];

            // 从名称映射中删除
            if (npcName && this.db.nameToId[npcName] === npcId) {
                delete this.db.nameToId[npcName];
            }

            // 保存数据库
            await this.save();

            console.log('[NPCDB] ✅ 已删除NPC:', npcId, npcName);

            // 触发事件
            this.eventSystem?.emit('npc:deleted', {
                id: npcId,
                name: npcName,
                chatId: this.currentChatId,
                timestamp: Date.now()
            });

            this.eventSystem?.emit('npc:db:updated', {
                action: 'delete',
                npcId: npcId,
                count: Object.keys(this.db.npcs).length,
                timestamp: Date.now()
            });

            return true;

        } catch (error) {
            console.error('[NPCDB] ❌ 删除NPC失败:', error);
            this.errorCount++;
            return false;
        }
    }

    /**
     * 🔒 获取当前聊天的NPC数据（聊天隔离）
     * 采用聊天隔离存储，直接返回当前聊天数据库中的所有NPC
     */
    async getCurrentChatNpcs() {
        try {
            // 确保当前数据库已加载且是当前聊天的数据
            const currentChatId = this.getCurrentChatId();
            if (!currentChatId) {
                console.warn('[NPCDB] ⚠️ 当前没有有效的聊天ID');
                return [];
            }

            if (this.currentChatId !== currentChatId) {
                console.log('[NPCDB] 🔄 聊天ID变化，重新加载数据库');
                await this.load();
            }

            const npcs = Object.values(this.db.npcs || {});

            console.log(`[NPCDB] 📋 获取当前聊天(${currentChatId})的NPC数据: ${npcs.length} 个NPC`);

            // 🔧 采用聊天隔离：直接返回当前聊天数据库中的所有NPC
            // 由于数据库本身就是按聊天隔离的，所以不需要额外过滤
            return npcs;
        } catch (error) {
            console.error('[NPCDB] ❌ 获取当前聊天NPC数据失败:', error);
            this.errorCount++;
            return [];
        }
    }

    /**
     * 🌍 获取当前聊天的所有NPC数据（用于世界书同步）
     * 🔒 严格聊天隔离：只返回当前聊天的NPC
     */
    async getAllNpcsForCurrentChat() {
        return await this.getCurrentChatNpcs();
    }
}

