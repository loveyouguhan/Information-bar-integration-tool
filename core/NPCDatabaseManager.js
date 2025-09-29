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

                // 保存当前聊天的数据
                if (this.currentChatId) {
                    await this.save();
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
            'person_name', 'personName'
        ];
        return nameFields.includes(field.toLowerCase()) || nameFields.includes(field);
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

    // 处理 data:updated 事件，从 interaction 面板提取NPC并更新数据库
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

            const npcs = this.extractNpcsFromPanels(panelsData.interaction || {});
            if (npcs.length === 0) return;

            console.log('[NPCDB] 📝 处理NPC数据更新，当前聊天:', currentChatId);

            let updated = 0;
            npcs.forEach(n => {
                const npc = this.ensureNpc(n.name);
                const before = JSON.stringify(npc.fields);
                npc.fields = this.mergeFields(npc.fields, n.fields);
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

    // 从 interaction 面板数据中提取 NPCs
    extractNpcsFromPanels(interactionPanel = {}) {
        console.log('[NPCDB] 🔍 开始提取NPC数据，数据类型:', Array.isArray(interactionPanel) ? '数组' : '对象');
        console.log('[NPCDB] 🔍 数据内容:', interactionPanel);

        // 🚀 新增：首先检测是否是数组格式（真实的多行数据格式）
        if (Array.isArray(interactionPanel)) {
            console.log('[NPCDB] ✅ 检测到数组格式的多行数据，开始解析...');
            return this.parseArrayFormat(interactionPanel);
        }

        const groups = new Map(); // npc0 -> { name, fields }
        const globalFields = {}; // 存储没有前缀的字段

        // 🚀 检测是否是对象格式的新多行数据格式
        const newFormatResult = this.parseNewMultiRowFormat(interactionPanel);
        if (newFormatResult && newFormatResult.length > 0) {
            console.log('[NPCDB] ✅ 检测到对象格式的多行数据，成功解析', newFormatResult.length, '个NPC');
            return newFormatResult;
        }

        // 第一遍：分离带前缀的字段和全局字段
        Object.entries(interactionPanel).forEach(([key, value]) => {
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

                    // 查找名称字段（通常是col_1或第一个字段）
                    let npcName = '';

                    // 优先查找col_1字段（根据真实数据格式）
                    if (npcData.col_1) {
                        npcName = String(npcData.col_1).trim();
                    } else if (keys.length > 0) {
                        // 如果没有col_1，使用第一个字段
                        npcName = String(npcData[keys[0]]).trim();
                    }

                    // 如果没有找到有效名称，使用索引
                    if (!npcName || npcName === '') {
                        npcName = `NPC${index}`;
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
     * 🚀 新增：将数组格式字段映射为标准字段（支持数字键和col_x格式）
     */
    mapArrayFieldsToStandard(npcData, index) {
        // 🔧 修复：自动检测字段键的格式（数字键 vs col_x格式）
        const hasNumericKeys = Object.keys(npcData).some(key => /^\d+$/.test(key));
        const hasColKeys = Object.keys(npcData).some(key => /^col_\d+$/.test(key));

        console.log(`[NPCDB] 🔍 字段格式检测: 数字键=${hasNumericKeys}, col_x键=${hasColKeys}`);

        // 🔧 修复：根据实际数据格式选择正确的键名
        const getFieldValue = (fieldIndex) => {
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

        const mappedFields = {
            // 基础信息
            index: index,
            source: 'array_format',

            // 🎯 标准字段映射（使用动态键访问）
            '1': getFieldValue(1),  // 通常是NPC名称
            '2': getFieldValue(2),  // 对象类型
            '3': getFieldValue(3),  // 当前状态
            '4': getFieldValue(4),  // 关系类型
            '5': getFieldValue(5),  // 亲密度
            '6': getFieldValue(6),  // 背景/描述
            '7': getFieldValue(7),  // 外貌特征
            '8': getFieldValue(8),  // 服装/装备
            '9': getFieldValue(9),  // 备注

            // 保留原始数据用于调试
            _原始数据: npcData,
            _解析时间: new Date().toISOString()
        };

        // 🔧 清理空值字段（除了元数据字段）
        Object.keys(mappedFields).forEach(key => {
            const value = mappedFields[key];
            if ((value === '' || value === null || value === undefined) && !key.startsWith('_') && key !== 'index' && key !== 'source') {
                delete mappedFields[key];
            }
        });

        const npcName = getFieldValue(1) || 'Unknown';
        console.log(`[NPCDB] 🗂️ 字段映射完成 ${npcName}:`, Object.keys(mappedFields).filter(k => !k.startsWith('_') && k !== 'index' && k !== 'source'));
        return mappedFields;
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

