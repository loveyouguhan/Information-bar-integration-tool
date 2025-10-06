/**
 * 知识图谱管理系统
 * 
 * 核心功能：
 * - 实体-关系-实体三元组提取
 * - 知识图谱构建和存储
 * - 图谱查询和推理
 * - 聊天级别图谱隔离
 * 
 * 基于LangMem的知识图谱最佳实践：
 * - Triple数据模型 (Subject-Predicate-Object)
 * - 增量更新和删除机制
 * - 上下文信息保留
 * 
 * @class KnowledgeGraphManager
 */

export class KnowledgeGraphManager {
    constructor(unifiedDataCore, eventSystem, deepMemoryManager, userProfileManager) {
        console.log('[KnowledgeGraphManager] 🕸️ 知识图谱管理系统初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.deepMemoryManager = deepMemoryManager;
        this.userProfileManager = userProfileManager;
        
        // 图谱管理设置
        this.settings = {
            enabled: false,                         // 🔧 修复：默认禁用知识图谱
            
            // 提取策略
            autoExtract: true,                      // 自动提取三元组
            extractionFrequency: 3,                 // 每N条消息提取一次
            minConfidence: 0.6,                     // 最小置信度阈值
            
            // 存储策略
            maxTriples: 1000,                       // 最大三元组数量
            enablePruning: true,                    // 启用自动修剪
            pruningThreshold: 0.3,                  // 修剪阈值
            
            // 查询策略
            maxPathLength: 3,                       // 最大路径长度
            enableInference: true,                  // 启用推理
            
            // 隔离策略
            chatLevelIsolation: true                // 聊天级别隔离
        };
        
        // 知识图谱存储（聊天级别隔离）
        this.graphs = new Map();                    // chatId -> KnowledgeGraph
        this.currentChatId = null;                  // 当前聊天ID
        
        // 消息计数器（用于触发提取）
        this.messageCounters = new Map();           // chatId -> count
        
        // 实体和关系缓存
        this.entityCache = new Map();               // entity -> metadata
        this.relationCache = new Map();             // relation -> count
        
        // 统计信息
        this.stats = {
            totalTriples: 0,                        // 总三元组数
            totalEntities: 0,                       // 总实体数
            totalRelations: 0,                      // 总关系数
            totalExtractions: 0,                    // 总提取次数
            lastExtractionTime: 0                   // 最后提取时间
        };
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[KnowledgeGraphManager] 🏗️ 构造函数完成');
    }

    /**
     * 初始化知识图谱管理系统
     */
    async init() {
        try {
            console.log('[KnowledgeGraphManager] 📊 开始初始化知识图谱管理系统...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[KnowledgeGraphManager] ⏸️ 知识图谱管理系统已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 获取当前聊天ID
            this.currentChatId = this.unifiedDataCore?.getCurrentChatId?.();
            console.log('[KnowledgeGraphManager] 📍 当前聊天ID:', this.currentChatId);

            // 加载现有图谱
            await this.loadGraphs();

            // 绑定事件监听器
            this.bindEventListeners();

            this.initialized = true;
            console.log('[KnowledgeGraphManager] ✅ 知识图谱管理系统初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('knowledge-graph:initialized', {
                    timestamp: Date.now(),
                    currentChatId: this.currentChatId
                });
            }

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.enhancement?.knowledgeGraph !== undefined) {
                    this.settings.enabled = memoryEnhancement.enhancement.knowledgeGraph;
                    console.log('[KnowledgeGraphManager] 📥 从extensionSettings加载enabled:', this.settings.enabled);
                }
            } catch (error) {
                console.warn('[KnowledgeGraphManager] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('knowledge_graph_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[KnowledgeGraphManager] ✅ 设置已加载');
                }
            }

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 🔧 新增：更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[KnowledgeGraphManager] 🔄 更新设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };

            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('knowledge_graph_settings', this.settings);
            }

            console.log('[KnowledgeGraphManager] ✅ 设置更新完成');

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 加载现有图谱
     */
    async loadGraphs() {
        try {
            if (!this.unifiedDataCore) return;
            
            // 加载当前聊天的图谱
            if (this.currentChatId) {
                const graphKey = `knowledge_graph_${this.currentChatId}`;
                const graph = await this.unifiedDataCore.getData(graphKey);
                
                if (graph) {
                    this.graphs.set(this.currentChatId, graph);
                    this.updateStatsFromGraph(graph);
                    console.log('[KnowledgeGraphManager] 📥 已加载聊天图谱:', this.currentChatId);
                } else {
                    // 创建新图谱
                    const newGraph = this.createEmptyGraph(this.currentChatId);
                    this.graphs.set(this.currentChatId, newGraph);
                    console.log('[KnowledgeGraphManager] 🆕 创建新图谱:', this.currentChatId);
                }
            }
            
        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 加载图谱失败:', error);
        }
    }

    /**
     * 创建空图谱
     */
    createEmptyGraph(chatId) {
        return {
            chatId: chatId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            
            // 三元组存储
            triples: [],                            // Triple[]
            
            // 索引
            entityIndex: new Map(),                 // entity -> triple IDs
            relationIndex: new Map(),               // relation -> triple IDs
            
            // 统计
            stats: {
                tripleCount: 0,
                entityCount: 0,
                relationCount: 0
            }
        };
    }

    /**
     * 三元组数据结构
     */
    createTriple(subject, predicate, object, context = null) {
        return {
            id: this.generateTripleId(),
            subject: subject,                       // 主体（实体）
            predicate: predicate,                   // 谓词（关系）
            object: object,                         // 客体（实体/值）
            context: context,                       // 上下文信息
            confidence: 1.0,                        // 置信度
            timestamp: Date.now(),                  // 时间戳
            source: 'extraction'                    // 来源
        };
    }

    /**
     * 生成三元组ID
     */
    generateTripleId() {
        return `triple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[KnowledgeGraphManager] ⚠️ 事件系统未提供，跳过事件绑定');
                return;
            }
            
            // 监听聊天切换事件
            this.eventSystem.on('chat:changed', async (data) => {
                await this.handleChatSwitch(data);
            });
            
            // 监听消息接收事件（用于提取）
            this.eventSystem.on('message:received', async (data) => {
                await this.handleMessageReceived(data);
            });
            
            console.log('[KnowledgeGraphManager] 🔗 事件监听器已绑定');
            
        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理聊天切换事件
     */
    async handleChatSwitch(data) {
        try {
            console.log('[KnowledgeGraphManager] 🔄 处理聊天切换事件');
            
            if (!this.settings.enabled) return;
            
            // 获取新的聊天ID
            const newChatId = data?.chatId || this.unifiedDataCore?.getCurrentChatId?.();
            if (!newChatId || newChatId === this.currentChatId) {
                console.log('[KnowledgeGraphManager] ℹ️ 聊天ID未变化，跳过处理');
                return;
            }
            
            console.log('[KnowledgeGraphManager] 🔄 聊天切换:', this.currentChatId, '->', newChatId);
            
            // 保存当前聊天的图谱
            if (this.currentChatId) {
                await this.saveGraph(this.currentChatId);
            }
            
            // 更新当前聊天ID
            this.currentChatId = newChatId;
            
            // 加载新聊天的图谱
            await this.loadChatGraph(newChatId);
            
            console.log('[KnowledgeGraphManager] ✅ 聊天切换处理完成');
            
        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 处理聊天切换事件失败:', error);
        }
    }

    /**
     * 加载聊天图谱
     */
    async loadChatGraph(chatId) {
        try {
            if (!chatId) return;

            // 检查是否已在内存中
            if (this.graphs.has(chatId)) {
                console.log('[KnowledgeGraphManager] 📥 从内存加载图谱:', chatId);
                return this.graphs.get(chatId);
            }

            // 从存储加载
            const graphKey = `knowledge_graph_${chatId}`;
            const graph = await this.unifiedDataCore?.getData(graphKey);

            if (graph) {
                this.graphs.set(chatId, graph);
                this.updateStatsFromGraph(graph);
                console.log('[KnowledgeGraphManager] 📥 从存储加载图谱:', chatId);
                return graph;
            } else {
                // 创建新图谱
                const newGraph = this.createEmptyGraph(chatId);
                this.graphs.set(chatId, newGraph);
                console.log('[KnowledgeGraphManager] 🆕 创建新图谱:', chatId);
                return newGraph;
            }

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 加载聊天图谱失败:', error);
            return null;
        }
    }

    /**
     * 保存图谱
     */
    async saveGraph(chatId) {
        try {
            if (!chatId || !this.unifiedDataCore) return;

            const graph = this.graphs.get(chatId);
            if (!graph) return;

            const graphKey = `knowledge_graph_${chatId}`;
            await this.unifiedDataCore.setData(graphKey, graph);

            console.log('[KnowledgeGraphManager] 💾 图谱已保存:', chatId);

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 保存图谱失败:', error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            console.log('[KnowledgeGraphManager] 📝 处理消息接收事件', data);

            if (!this.settings.enabled || !this.settings.autoExtract) {
                console.log('[KnowledgeGraphManager] ⚠️ 功能未启用，跳过处理');
                return;
            }

            const chatId = this.currentChatId || data?.chatId;
            if (!chatId) {
                console.log('[KnowledgeGraphManager] ⚠️ 无聊天ID，跳过处理');
                return;
            }

            console.log('[KnowledgeGraphManager] 📍 处理聊天:', chatId);

            // 增加消息计数器
            const currentCount = (this.messageCounters.get(chatId) || 0) + 1;
            this.messageCounters.set(chatId, currentCount);

            // 检查是否需要提取三元组
            if (currentCount >= this.settings.extractionFrequency) {
                await this.extractTriplesFromMessage(chatId, data);
                this.messageCounters.set(chatId, 0);
            }

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 处理消息接收事件失败:', error);
        }
    }

    /**
     * 从消息中提取三元组
     */
    async extractTriplesFromMessage(chatId, messageData) {
        try {
            console.log('[KnowledgeGraphManager] 🔍 开始提取三元组...');

            const graph = this.graphs.get(chatId);
            if (!graph) {
                console.log('[KnowledgeGraphManager] ⚠️ 图谱不存在');
                return;
            }

            // 🔧 修复：支持多种消息格式
            let content = null;
            if (typeof messageData?.message === 'string') {
                content = messageData.message;
            } else if (messageData?.message?.mes) {
                content = messageData.message.mes;
            } else if (messageData?.content) {
                content = messageData.content;
            } else if (messageData?.mes) {
                content = messageData.mes;
            }

            if (!content) {
                console.log('[KnowledgeGraphManager] ⚠️ 无法提取消息内容');
                return;
            }

            console.log('[KnowledgeGraphManager] 📄 消息内容:', content.substring(0, 100) + '...');

            // 提取实体
            const entities = this.extractEntities(content);
            console.log('[KnowledgeGraphManager] 📦 提取到', entities.length, '个实体');

            // 提取关系和构建三元组
            const triples = this.extractRelations(content, entities);
            console.log('[KnowledgeGraphManager] 🔗 提取到', triples.length, '个三元组');

            // 添加三元组到图谱
            for (const triple of triples) {
                this.addTriple(graph, triple);
            }

            // 🔧 修复：更新全局统计数据
            this.stats.totalExtractions++;
            this.stats.lastExtractionTime = Date.now();
            this.stats.totalTriples = graph.stats.tripleCount;
            this.stats.totalEntities = graph.stats.entityCount;
            this.stats.totalRelations = graph.stats.relationCount;

            // 保存图谱
            await this.saveGraph(chatId);

            console.log('[KnowledgeGraphManager] ✅ 三元组提取完成，总三元组:', this.stats.totalTriples);

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 提取三元组失败:', error);
        }
    }

    /**
     * 提取实体
     */
    extractEntities(text) {
        try {
            const entities = [];

            // 简单的实体提取规则（可以后续使用NER模型）

            // 1. 提取人名（大写开头的词）
            const namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
            const names = text.match(namePattern) || [];
            for (const name of names) {
                if (name.length > 1 && !this.isCommonWord(name)) {
                    entities.push({ text: name, type: 'PERSON' });
                }
            }

            // 2. 提取中文人名/地名/组织
            const chineseEntityPattern = /([\u4e00-\u9fa5]{2,4}(?:公司|团队|项目|系统|平台|大学|学院))/g;
            const chineseEntities = text.match(chineseEntityPattern) || [];
            for (const entity of chineseEntities) {
                entities.push({ text: entity, type: 'ORGANIZATION' });
            }

            // 3. 提取技术术语
            const techTerms = ['JavaScript', 'Python', 'AI', '机器学习', '深度学习', '向量', '检索', '记忆', '数据库'];
            for (const term of techTerms) {
                if (text.includes(term)) {
                    entities.push({ text: term, type: 'TECHNOLOGY' });
                }
            }

            // 去重
            const uniqueEntities = [];
            const seen = new Set();
            for (const entity of entities) {
                if (!seen.has(entity.text)) {
                    seen.add(entity.text);
                    uniqueEntities.push(entity);
                }
            }

            return uniqueEntities;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 提取实体失败:', error);
            return [];
        }
    }

    /**
     * 检查是否为常见词
     */
    isCommonWord(word) {
        const commonWords = ['The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Who', 'Why', 'How'];
        return commonWords.includes(word);
    }

    /**
     * 提取关系并构建三元组
     */
    extractRelations(text, entities) {
        try {
            const triples = [];

            // 关系模式匹配
            const relationPatterns = [
                // 中文关系模式
                { pattern: /(.+?)是(.+?)的(.+)/g, relation: '是' },
                { pattern: /(.+?)有(.+)/g, relation: '有' },
                { pattern: /(.+?)在(.+)/g, relation: '在' },
                { pattern: /(.+?)做(.+)/g, relation: '做' },
                { pattern: /(.+?)喜欢(.+)/g, relation: '喜欢' },
                { pattern: /(.+?)学习(.+)/g, relation: '学习' },
                { pattern: /(.+?)使用(.+)/g, relation: '使用' },
                { pattern: /(.+?)管理(.+)/g, relation: '管理' },
                { pattern: /(.+?)领导(.+)/g, relation: '领导' },
                { pattern: /(.+?)参与(.+)/g, relation: '参与' },

                // 英文关系模式
                { pattern: /(.+?)\s+is\s+(.+)/gi, relation: 'is' },
                { pattern: /(.+?)\s+has\s+(.+)/gi, relation: 'has' },
                { pattern: /(.+?)\s+works\s+at\s+(.+)/gi, relation: 'works_at' },
                { pattern: /(.+?)\s+manages\s+(.+)/gi, relation: 'manages' },
                { pattern: /(.+?)\s+leads\s+(.+)/gi, relation: 'leads' }
            ];

            // 尝试匹配关系模式
            for (const { pattern, relation } of relationPatterns) {
                const matches = text.matchAll(pattern);
                for (const match of matches) {
                    if (match[1] && match[2]) {
                        const subject = match[1].trim();
                        const object = match[2].trim();

                        // 验证主体和客体
                        if (subject.length > 0 && object.length > 0 &&
                            subject.length < 50 && object.length < 50) {

                            const triple = this.createTriple(
                                subject,
                                relation,
                                object,
                                text.substring(0, 100) // 保留上下文
                            );

                            triples.push(triple);
                        }
                    }
                }
            }

            // 基于实体构建三元组
            for (let i = 0; i < entities.length - 1; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i];
                    const entity2 = entities[j];

                    // 检测实体间的关系
                    const relation = this.detectRelationBetweenEntities(text, entity1, entity2);
                    if (relation) {
                        const triple = this.createTriple(
                            entity1.text,
                            relation,
                            entity2.text,
                            text.substring(0, 100)
                        );
                        triples.push(triple);
                    }
                }
            }

            return triples;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 提取关系失败:', error);
            return [];
        }
    }

    /**
     * 检测实体间的关系
     */
    detectRelationBetweenEntities(text, entity1, entity2) {
        try {
            const e1Pos = text.indexOf(entity1.text);
            const e2Pos = text.indexOf(entity2.text);

            if (e1Pos === -1 || e2Pos === -1) return null;

            // 提取实体之间的文本
            const start = Math.min(e1Pos, e2Pos);
            const end = Math.max(e1Pos, e2Pos);
            const between = text.substring(start, end);

            // 检测关系词
            const relationKeywords = {
                '和': 'related_to',
                '与': 'related_to',
                '的': 'belongs_to',
                '在': 'located_in',
                '使用': 'uses',
                '学习': 'learns',
                '开发': 'develops'
            };

            for (const [keyword, relation] of Object.entries(relationKeywords)) {
                if (between.includes(keyword)) {
                    return relation;
                }
            }

            // 默认关系
            if (between.length < 20) {
                return 'related_to';
            }

            return null;

        } catch (error) {
            return null;
        }
    }

    /**
     * 添加三元组到图谱
     */
    addTriple(graph, triple) {
        try {
            // 检查是否已存在相似三元组
            const exists = graph.triples.some(t =>
                t.subject === triple.subject &&
                t.predicate === triple.predicate &&
                t.object === triple.object
            );

            if (exists) {
                console.log('[KnowledgeGraphManager] ℹ️ 三元组已存在，跳过');
                return false;
            }

            // 添加三元组
            graph.triples.push(triple);
            graph.stats.tripleCount++;

            // 更新实体索引
            if (!graph.entityIndex.has(triple.subject)) {
                graph.entityIndex.set(triple.subject, []);
                graph.stats.entityCount++;
            }
            graph.entityIndex.get(triple.subject).push(triple.id);

            if (!graph.entityIndex.has(triple.object)) {
                graph.entityIndex.set(triple.object, []);
                graph.stats.entityCount++;
            }
            graph.entityIndex.get(triple.object).push(triple.id);

            // 更新关系索引
            if (!graph.relationIndex.has(triple.predicate)) {
                graph.relationIndex.set(triple.predicate, []);
                graph.stats.relationCount++;
            }
            graph.relationIndex.get(triple.predicate).push(triple.id);

            // 更新时间戳
            graph.updatedAt = Date.now();

            console.log('[KnowledgeGraphManager] ✅ 三元组已添加:', triple.subject, '->', triple.predicate, '->', triple.object);

            return true;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 添加三元组失败:', error);
            return false;
        }
    }

    /**
     * 更新统计信息
     */
    updateStatsFromGraph(graph) {
        if (!graph) return;

        this.stats.totalTriples = graph.stats.tripleCount;
        this.stats.totalEntities = graph.stats.entityCount;
        this.stats.totalRelations = graph.stats.relationCount;
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[KnowledgeGraphManager] ❌ 错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('knowledge-graph:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 🔍 查询图谱 - 根据实体查找相关三元组
     */
    queryByEntity(entity, chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const graph = this.graphs.get(targetChatId);

            if (!graph) return [];

            const tripleIds = graph.entityIndex.get(entity) || [];
            const triples = graph.triples.filter(t => tripleIds.includes(t.id));

            console.log('[KnowledgeGraphManager] 🔍 查询实体:', entity, '找到', triples.length, '个三元组');

            return triples;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 查询实体失败:', error);
            return [];
        }
    }

    /**
     * 🔍 查询图谱 - 根据关系查找三元组
     */
    queryByRelation(relation, chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const graph = this.graphs.get(targetChatId);

            if (!graph) return [];

            const tripleIds = graph.relationIndex.get(relation) || [];
            const triples = graph.triples.filter(t => tripleIds.includes(t.id));

            console.log('[KnowledgeGraphManager] 🔍 查询关系:', relation, '找到', triples.length, '个三元组');

            return triples;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 查询关系失败:', error);
            return [];
        }
    }

    /**
     * 🔍 查询图谱 - 查找路径
     */
    findPath(startEntity, endEntity, maxDepth = 3, chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const graph = this.graphs.get(targetChatId);

            if (!graph) return [];

            console.log('[KnowledgeGraphManager] 🔍 查找路径:', startEntity, '->', endEntity);

            // BFS查找路径
            const queue = [[startEntity]];
            const visited = new Set([startEntity]);
            const paths = [];

            while (queue.length > 0 && paths.length < 10) {
                const path = queue.shift();
                const current = path[path.length - 1];

                // 检查是否到达目标
                if (current === endEntity) {
                    paths.push(path);
                    continue;
                }

                // 检查深度限制
                if (path.length >= maxDepth) {
                    continue;
                }

                // 获取当前实体的所有三元组
                const triples = this.queryByEntity(current, targetChatId);

                for (const triple of triples) {
                    // 找到下一个实体
                    const next = triple.subject === current ? triple.object : triple.subject;

                    if (!visited.has(next)) {
                        visited.add(next);
                        queue.push([...path, next]);
                    }
                }
            }

            console.log('[KnowledgeGraphManager] ✅ 找到', paths.length, '条路径');

            return paths;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 查找路径失败:', error);
            return [];
        }
    }

    /**
     * 🧠 推理 - 查找实体的所有属性
     */
    getEntityProperties(entity, chatId = null) {
        try {
            const triples = this.queryByEntity(entity, chatId);
            const properties = {};

            for (const triple of triples) {
                if (triple.subject === entity) {
                    if (!properties[triple.predicate]) {
                        properties[triple.predicate] = [];
                    }
                    properties[triple.predicate].push(triple.object);
                }
            }

            return properties;

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 获取实体属性失败:', error);
            return {};
        }
    }

    /**
     * 🧠 推理 - 查找相关实体
     */
    getRelatedEntities(entity, maxDepth = 2, chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const graph = this.graphs.get(targetChatId);

            if (!graph) return [];

            const related = new Set();
            const queue = [[entity, 0]];
            const visited = new Set([entity]);

            while (queue.length > 0) {
                const [current, depth] = queue.shift();

                if (depth >= maxDepth) continue;

                const triples = this.queryByEntity(current, targetChatId);

                for (const triple of triples) {
                    const next = triple.subject === current ? triple.object : triple.subject;

                    if (!visited.has(next)) {
                        visited.add(next);
                        related.add(next);
                        queue.push([next, depth + 1]);
                    }
                }
            }

            return Array.from(related);

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 获取相关实体失败:', error);
            return [];
        }
    }

    /**
     * 📊 获取图谱摘要
     */
    getGraphSummary(chatId = null) {
        try {
            const targetChatId = chatId || this.currentChatId;
            const graph = this.graphs.get(targetChatId);

            if (!graph) {
                return '暂无知识图谱数据';
            }

            const parts = [];

            parts.push(`知识图谱摘要 (聊天: ${targetChatId})`);
            parts.push(`三元组数量: ${graph.stats.tripleCount}`);
            parts.push(`实体数量: ${graph.stats.entityCount}`);
            parts.push(`关系数量: ${graph.stats.relationCount}`);
            parts.push(`创建时间: ${new Date(graph.createdAt).toLocaleString()}`);
            parts.push(`更新时间: ${new Date(graph.updatedAt).toLocaleString()}`);

            // 列出前5个三元组
            if (graph.triples.length > 0) {
                parts.push('\n前5个三元组:');
                graph.triples.slice(0, 5).forEach((t, i) => {
                    parts.push(`${i + 1}. ${t.subject} -> ${t.predicate} -> ${t.object}`);
                });
            }

            return parts.join('\n');

        } catch (error) {
            console.error('[KnowledgeGraphManager] ❌ 获取图谱摘要失败:', error);
            return '获取图谱摘要失败';
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.settings.enabled,
            currentChatId: this.currentChatId,
            graphsCount: this.graphs.size,
            currentGraph: this.graphs.get(this.currentChatId),
            stats: this.stats,
            errorCount: this.errorCount
        };
    }
}

