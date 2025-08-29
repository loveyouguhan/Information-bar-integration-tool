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

        this.DB_KEY = 'npcDatabase';
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
    }

    async init() {
        try {
            await this.load();

            // 监听数据更新事件（包含 messageId 与按面板数据）
            if (this.eventSystem) {
                this.eventSystem.on('data:updated', async (payload) => {
                    try { await this.handleDataUpdated(payload); } catch (e) { console.error('[NPCDB] 处理data:updated失败', e); }
                });
            }

            this.initialized = true;
            console.log('[NPCDB] ✅ NPC数据库管理器初始化完成，NPC数量:', Object.keys(this.db.npcs).length);
        } catch (error) {
            console.error('[NPCDB] ❌ 初始化失败:', error);
            this.errorCount++;
        }
    }

    async load() {
        try {
            if (!this.dataCore) return;
            const loaded = await this.dataCore.getData(this.DB_KEY, 'global');
            if (loaded && typeof loaded === 'object') {
                // 兼容旧结构
                this.db = {
                    version: 1,
                    nextId: loaded.nextId || 0,
                    nameToId: loaded.nameToId || {},
                    npcs: loaded.npcs || {}
                };
            }
            // 反向构建 nameToId，确保一致性
            Object.values(this.db.npcs).forEach((npc) => {
                if (npc?.name && !this.db.nameToId[npc.name]) this.db.nameToId[npc.name] = npc.id;
            });
            console.log('[NPCDB] 📥 已加载数据库: ', Object.keys(this.db.npcs).length, '个NPC');
        } catch (error) {
            console.error('[NPCDB] ❌ 加载数据库失败:', error);
            this.errorCount++;
        }
    }

    async save() {
        try {
            if (!this.dataCore) return;
            await this.dataCore.setData(this.DB_KEY, this.db, 'global');
            // 广播事件
            this.eventSystem?.emit('npc:db:saved', { count: Object.keys(this.db.npcs).length, timestamp: Date.now() });
        } catch (error) {
            console.error('[NPCDB] ❌ 保存数据库失败:', error);
            this.errorCount++;
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
        if (!id) {
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
            const chatId = payload?.chatId || this.dataCore?.getCurrentChatId?.();
            const messageId = payload?.dataEntry?.messageId || payload?.dataEntry?.index || null;
            const panelsData = payload?.dataEntry?.data || payload?.panelFields || payload?.data || {};
            if (!panelsData || typeof panelsData !== 'object') return;

            const npcs = this.extractNpcsFromPanels(panelsData.interaction || {});
            if (npcs.length === 0) return;

            let updated = 0;
            npcs.forEach(n => {
                const npc = this.ensureNpc(n.name);
                const before = JSON.stringify(npc.fields);
                npc.fields = this.mergeFields(npc.fields, n.fields);
                npc.appearCount = (npc.appearCount || 0) + 1;
                npc.lastSeen = Date.now();
                npc.lastMessageId = messageId;
                npc.lastChatId = chatId;
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
        console.log('[NPCDB] 🔍 开始提取NPC数据，原始字段:', Object.keys(interactionPanel));

        const groups = new Map(); // npc0 -> { name, fields }
        const globalFields = {}; // 存储没有前缀的字段

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

        // 🚨 严格格式验证：拒绝处理没有NPC前缀的全局字段
        if (Object.keys(globalFields).length > 0) {
            console.error('[NPCDB] ❌ 检测到错误的AI输出格式！');
            console.error('[NPCDB] ❌ AI输出了没有NPC前缀的字段:', Object.keys(globalFields));
            console.error('[NPCDB] ❌ 正确格式应该是: npc0.姓名="NPC名称", npc0.关系="关系", npc0.态度="态度"');
            console.error('[NPCDB] ❌ 错误格式: 姓名="NPC名称", 关系="关系", 态度="态度"');
            console.error('[NPCDB] 🚨 系统拒绝处理错误格式的数据，请确保AI输出正确的NPC前缀格式！');

            // 🚨 重要：不再兼容错误格式，直接拒绝处理
            // 这将强制AI学习正确的输出格式，而不是依赖系统的错误兼容
            console.warn('[NPCDB] ⚠️ 由于格式错误，跳过所有全局字段的处理');
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
    search({ q = '', sortBy = 'lastSeen', order = 'desc' } = {}) {
        const term = (q || '').trim();
        const arr = Object.values(this.db.npcs);
        let filtered = arr;
        if (term) {
            filtered = arr.filter(n => (n.name || '').includes(term));
        }
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
}

