/**
 * 向量API适配器
 * 
 * 负责与SillyTavern原生向量API交互：
 * - 向量数据插入
 * - 向量数据查询
 * - 向量数据管理
 * - 集合管理
 * 
 * @class VectorAPIAdapter
 */

export class VectorAPIAdapter {
    constructor(dependencies = {}) {
        console.log('[VectorAPIAdapter] 🔌 向量API适配器初始化开始');
        
        this.context = dependencies.context || window.SillyTavern?.getContext?.();
        this.unifiedDataCore = dependencies.unifiedDataCore;
        this.characterId = null;
        
        // 统计信息
        this.stats = {
            insertCount: 0,
            queryCount: 0,
            errorCount: 0
        };
        
        console.log('[VectorAPIAdapter] ✅ 向量API适配器初始化完成');
    }

    /**
     * 获取角色稳定ID
     */
    async getCharacterStableId() {
        try {
            if (this.characterId) {
                return this.characterId;
            }

            const context = this.context;
            if (!context) {
                console.warn('[VectorAPIAdapter] ⚠️ 无法获取SillyTavern上下文');
                return 'default';
            }

            // 尝试多种方式获取角色ID
            let characterId = null;

            // 方式1: 从context.characterId获取
            if (context.characterId) {
                characterId = context.characterId;
            }
            // 方式2: 从当前角色获取
            else if (context.characters && context.this_chid !== undefined) {
                const character = context.characters[context.this_chid];
                if (character?.avatar) {
                    characterId = character.avatar.replace(/\.[^/.]+$/, ''); // 移除扩展名
                }
            }
            // 方式3: 从聊天元数据获取
            else if (context.chat_metadata?.character_id) {
                characterId = context.chat_metadata.character_id;
            }

            // 如果仍然没有，使用默认值
            if (!characterId) {
                console.warn('[VectorAPIAdapter] ⚠️ 无法获取角色ID，使用默认值');
                characterId = 'default';
            }

            this.characterId = characterId;
            console.log('[VectorAPIAdapter] 📝 角色ID:', characterId);
            
            return characterId;

        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 获取角色ID失败:', error);
            return 'default';
        }
    }

    /**
     * 获取集合ID
     * @param {string} knowledgeBaseId - 知识库ID
     * @returns {Promise<string>} 集合ID
     */
    async getCollectionId(knowledgeBaseId = 'default') {
        try {
            const characterId = await this.getCharacterStableId();
            const collectionId = `${characterId}_infobar_${knowledgeBaseId}`;
            console.log('[VectorAPIAdapter] 📦 集合ID:', collectionId);
            return collectionId;
        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 获取集合ID失败:', error);
            return 'default_infobar_default';
        }
    }

    /**
     * 生成哈希值
     * @param {string} text - 文本
     * @returns {string} 哈希值
     */
    generateHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 插入向量
     * @param {Array} vectors - 向量数组 [{content, vector, metadata}]
     * @param {string} knowledgeBaseId - 知识库ID
     * @returns {Promise<Object>} 插入结果
     */
    async insertVectors(vectors, knowledgeBaseId = 'default') {
        try {
            if (!vectors || vectors.length === 0) {
                return { success: true, count: 0 };
            }

            console.log(`[VectorAPIAdapter] 📥 准备插入 ${vectors.length} 个向量到知识库: ${knowledgeBaseId}`);

            const collectionId = await this.getCollectionId(knowledgeBaseId);

            // 准备items
            const items = vectors.map((v, index) => ({
                hash: this.generateHash(v.content + Date.now() + index + Math.random()),
                text: v.content,
                metadata: v.metadata || {}
            }));

            // 准备embeddings
            const embeddings = vectors.reduce((acc, v) => {
                acc[v.content] = v.vector;
                return acc;
            }, {});

            // 调用API
            const response = await fetch('/api/vector/insert', {
                method: 'POST',
                headers: this.context.getRequestHeaders(),
                body: JSON.stringify({
                    collectionId: collectionId,
                    items: items,
                    source: 'infobar_memory',
                    embeddings: embeddings
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`向量插入失败 (${response.status}): ${errorText}`);
            }

            this.stats.insertCount += vectors.length;
            console.log(`[VectorAPIAdapter] ✅ 成功插入 ${vectors.length} 个向量`);

            return { success: true, count: vectors.length };

        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 插入向量失败:', error);
            this.stats.errorCount++;
            throw error;
        }
    }

    /**
     * 查询向量
     * @param {string} queryText - 查询文本
     * @param {Array} queryVector - 查询向量
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} 查询结果
     */
    async queryVectors(queryText, queryVector, options = {}) {
        try {
            const {
                knowledgeBaseId = 'default',
                topK = 10,
                threshold = 0.6
            } = options;

            console.log(`[VectorAPIAdapter] 🔍 查询向量，知识库: ${knowledgeBaseId}, topK: ${topK}`);

            const collectionId = await this.getCollectionId(knowledgeBaseId);

            const response = await fetch('/api/vector/query', {
                method: 'POST',
                headers: this.context.getRequestHeaders(),
                body: JSON.stringify({
                    collectionId: collectionId,
                    searchText: queryText,
                    topK: topK,
                    threshold: threshold,
                    source: 'infobar_memory',
                    embeddings: { [queryText]: queryVector }
                })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // 集合不存在，返回空结果
                    console.log(`[VectorAPIAdapter] ℹ️ 集合不存在: ${collectionId}`);
                    return [];
                }
                const errorText = await response.text();
                throw new Error(`向量查询失败 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const results = data.results || data.metadata || data || [];

            this.stats.queryCount++;
            console.log(`[VectorAPIAdapter] ✅ 查询完成，返回 ${results.length} 个结果`);

            return results;

        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 查询向量失败:', error);
            this.stats.errorCount++;
            return [];
        }
    }

    /**
     * 清空向量集合
     * @param {string} knowledgeBaseId - 知识库ID
     * @returns {Promise<boolean>} 是否成功
     */
    async purgeCollection(knowledgeBaseId = 'default') {
        try {
            console.log(`[VectorAPIAdapter] 🗑️ 清空集合: ${knowledgeBaseId}`);

            const collectionId = await this.getCollectionId(knowledgeBaseId);

            const response = await fetch('/api/vector/purge', {
                method: 'POST',
                headers: this.context.getRequestHeaders(),
                body: JSON.stringify({
                    collectionId: collectionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[VectorAPIAdapter] ❌ 清空集合失败: ${errorText}`);
                return false;
            }

            console.log(`[VectorAPIAdapter] ✅ 集合已清空: ${collectionId}`);
            return true;

        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 清空集合失败:', error);
            this.stats.errorCount++;
            return false;
        }
    }

    /**
     * 获取向量数量
     * @param {string} knowledgeBaseId - 知识库ID
     * @returns {Promise<number>} 向量数量
     */
    async getVectorCount(knowledgeBaseId = 'default') {
        try {
            const collectionId = await this.getCollectionId(knowledgeBaseId);

            const response = await fetch('/api/vector/list', {
                method: 'POST',
                headers: this.context.getRequestHeaders(),
                body: JSON.stringify({
                    collectionId: collectionId,
                    source: 'infobar_memory',
                    embeddings: {}
                })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return 0;
                }
                const errorText = await response.text();
                throw new Error(`获取向量数量失败 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const count = data.hashes?.length || 0;

            console.log(`[VectorAPIAdapter] 📊 集合 ${knowledgeBaseId} 包含 ${count} 个向量`);
            return count;

        } catch (error) {
            console.error('[VectorAPIAdapter] ❌ 获取向量数量失败:', error);
            return 0;
        }
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return { ...this.stats };
    }
}

