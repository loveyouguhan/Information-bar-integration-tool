/**
 * Transformers.js 轻量化实现
 * 
 * 专为 Information bar integration tool 向量化记忆检索系统设计
 * 提供基础的文本向量化和语义相似度计算功能
 * 
 * @version 1.0.0
 * @author Information bar integration tool
 */

(() => {
    'use strict';

    /**
     * 轻量化环境配置
     */
    const env = {
        allowLocalModels: true,
        allowRemoteModels: false,
        USE_REMOTE_MODELS: false,
        USE_LOCAL_MODELS: true
    };

    /**
     * 轻量化文本预处理器
     */
    class TextPreprocessor {
        constructor() {
            this.stopWords = new Set([
                '的', '是', '在', '有', '和', '了', '一', '个', '上', '我', '你', '他', '她', '它',
                'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were'
            ]);
        }

        /**
         * 文本标准化
         */
        normalize(text) {
            if (!text || typeof text !== 'string') return '';
            
            return text
                .toLowerCase()
                .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文字符和空格
                .replace(/\s+/g, ' ')
                .trim();
        }

        /**
         * 分词（简单空格分割）
         */
        tokenize(text) {
            const normalized = this.normalize(text);
            if (!normalized) return [];
            
            return normalized
                .split(' ')
                .filter(token => token.length > 1 && !this.stopWords.has(token));
        }
    }

    /**
     * 轻量化向量化器
     */
    class LiteVectorizer {
        constructor(dimensions = 384, options = {}) {
            this.dimensions = dimensions;
            this.preprocessor = new TextPreprocessor();
            this.vocabulary = new Map();
            this.idfWeights = new Map();
            this.documentCount = 0;
            
            // 🔧 新增：角色扮演优化功能
            this.roleplayMode = options.roleplayMode || false;
            this.panelContext = options.panelContext || null;
            this.vocabularyWeightCalculator = null;
            this.customWeights = new Map();
            
            // 加载角色扮演词汇表（如果启用）
            if (this.roleplayMode) {
                this.initializeRoleplayFeatures();
            }
        }

        /**
         * 🔧 新增：初始化角色扮演功能
         */
        initializeRoleplayFeatures() {
            try {
                // 检查是否有角色扮演词汇表
                if (typeof window !== 'undefined' && window.VocabularyWeightCalculator) {
                    this.vocabularyWeightCalculator = new window.VocabularyWeightCalculator();
                    console.log('[LiteVectorizer] ✅ 角色扮演词汇表系统已启用');
                } else {
                    console.warn('[LiteVectorizer] ⚠️ 角色扮演词汇表系统不可用');
                    this.roleplayMode = false;
                }
            } catch (error) {
                console.warn('[LiteVectorizer] ⚠️ 角色扮演功能初始化失败:', error.message);
                this.roleplayMode = false;
            }
        }

        /**
         * 🔧 新增：设置面板上下文
         */
        setPanelContext(panelType) {
            this.panelContext = panelType;
            if (this.vocabularyWeightCalculator) {
                this.vocabularyWeightCalculator.setPanelContext(panelType);
            }
        }

        /**
         * 构建词汇表和IDF权重
         */
        buildVocabulary(texts) {
            console.log('[TransformersLite] 🔧 构建词汇表和IDF权重...');
            
            // 🔧 新增：如果启用角色扮演模式，添加专用语料
            let allTexts = [...texts];
            if (this.roleplayMode && typeof window !== 'undefined' && window.RoleplayCorpus) {
                console.log('[TransformersLite] 🎭 添加角色扮演专用语料...');
                const roleplayTexts = this.getRoleplayCorpusTexts();
                allTexts = [...allTexts, ...roleplayTexts];
                console.log('[TransformersLite] ✅ 语料扩充完成，总文本数:', allTexts.length);
            }
            
            const documentTerms = [];
            const termDocumentCount = new Map();

            // 收集所有文档的词汇
            for (const text of allTexts) {
                const tokens = this.preprocessor.tokenize(text);
                const uniqueTokens = new Set(tokens);
                documentTerms.push(uniqueTokens);
                
                // 计算每个词汇出现在多少个文档中
                for (const token of uniqueTokens) {
                    termDocumentCount.set(token, (termDocumentCount.get(token) || 0) + 1);
                }
            }

            this.documentCount = allTexts.length;

            // 构建词汇表索引
            let index = 0;
            for (const [term, docCount] of termDocumentCount) {
                this.vocabulary.set(term, index++);
                
                // 🔧 修改：计算增强的IDF权重
                let idfWeight = Math.log(this.documentCount / docCount);
                
                // 应用角色扮演权重调整
                if (this.roleplayMode && this.vocabularyWeightCalculator) {
                    const customWeight = this.vocabularyWeightCalculator.getWordWeight(term);
                    idfWeight *= customWeight;
                }
                
                this.idfWeights.set(term, idfWeight);
            }

            console.log('[TransformersLite] ✅ 词汇表构建完成，词汇数量:', this.vocabulary.size);
        }

        /**
         * 🔧 新增：获取角色扮演语料文本
         */
        getRoleplayCorpusTexts() {
            const corpus = window.RoleplayCorpus;
            const texts = [];
            
            // 收集所有类别的文本
            Object.values(corpus).forEach(category => {
                if (Array.isArray(category)) {
                    texts.push(...category);
                } else if (typeof category === 'object') {
                    Object.values(category).forEach(subCategory => {
                        if (Array.isArray(subCategory)) {
                            texts.push(...subCategory);
                        }
                    });
                }
            });
            
            // 随机选择部分文本以避免过度拟合
            const maxTexts = Math.min(texts.length, 200);
            const selectedTexts = [];
            const usedIndices = new Set();
            
            while (selectedTexts.length < maxTexts && usedIndices.size < texts.length) {
                const randomIndex = Math.floor(Math.random() * texts.length);
                if (!usedIndices.has(randomIndex)) {
                    usedIndices.add(randomIndex);
                    selectedTexts.push(texts[randomIndex]);
                }
            }
            
            console.log('[TransformersLite] 📚 选择角色扮演语料文本:', selectedTexts.length, '条');
            return selectedTexts;
        }

        /**
         * 文本向量化（TF-IDF + 降维）
         */
        vectorize(text) {
            const tokens = this.preprocessor.tokenize(text);
            if (tokens.length === 0) {
                return new Array(this.dimensions).fill(0);
            }

            // 计算词频
            const termFreq = new Map();
            for (const token of tokens) {
                termFreq.set(token, (termFreq.get(token) || 0) + 1);
            }

            // 创建TF-IDF向量
            const tfidfVector = new Array(this.vocabulary.size).fill(0);
            for (const [term, freq] of termFreq) {
                const vocabIndex = this.vocabulary.get(term);
                if (vocabIndex !== undefined) {
                    const tf = freq / tokens.length; // 词频
                    const idf = this.idfWeights.get(term) || 0; // IDF权重
                    tfidfVector[vocabIndex] = tf * idf;
                }
            }

            // 如果词汇表为空或者没有匹配的词汇，使用字符级特征
            if (this.vocabulary.size === 0 || tfidfVector.every(v => v === 0)) {
                return this.generateCharacterFeatures(text);
            }

            // 降维到指定维度
            return this.reduceDimensions(tfidfVector, this.dimensions);
        }

        /**
         * 生成字符级特征（备用方法）
         */
        generateCharacterFeatures(text) {
            const features = new Array(this.dimensions).fill(0);
            const normalized = this.preprocessor.normalize(text);
            
            for (let i = 0; i < normalized.length; i++) {
                const charCode = normalized.charCodeAt(i);
                const index = charCode % this.dimensions;
                features[index] += 1;
            }

            // 归一化
            const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < features.length; i++) {
                    features[i] /= magnitude;
                }
            }

            return features;
        }

        /**
         * 降维（简单哈希投影）
         */
        reduceDimensions(vector, targetDim) {
            if (vector.length <= targetDim) {
                // 如果原向量维度小于等于目标维度，补零
                return [...vector, ...new Array(targetDim - vector.length).fill(0)];
            }

            const reduced = new Array(targetDim).fill(0);
            for (let i = 0; i < vector.length; i++) {
                const targetIndex = i % targetDim;
                reduced[targetIndex] += vector[i];
            }

            // 归一化
            const magnitude = Math.sqrt(reduced.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < reduced.length; i++) {
                    reduced[i] /= magnitude;
                }
            }

            return reduced;
        }
    }

    /**
     * 轻量化特征提取管道
     */
    class FeatureExtractionPipeline {
        constructor(modelName = 'lite-tfidf', options = {}) {
            console.log('[TransformersLite] 🚀 初始化特征提取管道:', modelName);
            
            this.modelName = modelName;
            this.dimensions = options.dimensions || 384;
            this.quantized = options.quantized || true;
            this.progressCallback = options.progress_callback;
            
            // 🔧 新增：角色扮演优化选项
            this.roleplayMode = options.roleplayMode || false;
            this.panelContext = options.panelContext || null;
            
            // 传递角色扮演选项给向量化器
            const vectorizerOptions = {
                roleplayMode: this.roleplayMode,
                panelContext: this.panelContext
            };
            
            this.vectorizer = new LiteVectorizer(this.dimensions, vectorizerOptions);
            this.initialized = false;
            this.trainingTexts = [];

            // 模拟进度回调
            if (this.progressCallback) {
                setTimeout(() => this.progressCallback({ 
                    progress: 100, 
                    status: 'ready',
                    roleplayMode: this.roleplayMode,
                    panelContext: this.panelContext
                }), 100);
            }
            
            console.log('[TransformersLite] 🎭 角色扮演模式:', this.roleplayMode ? '已启用' : '未启用');
        }

        /**
         * 🔧 新增：设置面板上下文
         */
        setPanelContext(panelType) {
            this.panelContext = panelType;
            this.vectorizer.setPanelContext(panelType);
            console.log('[TransformersLite] 🎯 面板上下文已设置:', panelType);
        }

        /**
         * 🔧 新增：启用角色扮演模式
         */
        enableRoleplayMode(panelType = null) {
            this.roleplayMode = true;
            if (panelType) {
                this.setPanelContext(panelType);
            }
            
            // 重新初始化向量化器的角色扮演功能
            this.vectorizer.roleplayMode = true;
            this.vectorizer.initializeRoleplayFeatures();
            
            console.log('[TransformersLite] 🎭 角色扮演模式已启用，上下文:', panelType || '无');
        }

        /**
         * 预训练（使用提供的文本构建词汇表）
         */
        async pretrain(texts) {
            console.log('[TransformersLite] 🔧 开始预训练...');
            
            if (texts && texts.length > 0) {
                this.trainingTexts = [...texts];
                this.vectorizer.buildVocabulary(texts);
            }
            
            this.initialized = true;
            console.log('[TransformersLite] ✅ 预训练完成');
        }

        /**
         * 文本向量化
         */
        async call(texts, options = {}) {
            // 如果尚未初始化，使用输入文本进行预训练
            if (!this.initialized) {
                const allTexts = Array.isArray(texts) ? texts : [texts];
                await this.pretrain(allTexts);
            }

            const inputTexts = Array.isArray(texts) ? texts : [texts];
            const vectors = [];

            for (const text of inputTexts) {
                const vector = this.vectorizer.vectorize(text);
                vectors.push(vector);
            }

            console.log('[TransformersLite] ✅ 向量化完成，输入数量:', inputTexts.length, '维度:', this.dimensions);
            
            return Array.isArray(texts) ? vectors : vectors[0];
        }

        /**
         * 批量处理
         */
        async batch(texts, options = {}) {
            return await this.call(texts, options);
        }
    }

    /**
     * 管道工厂函数
     */
    async function pipeline(task, model = null, options = {}) {
        console.log('[TransformersLite] 🔧 创建管道:', task, model);
        
        switch (task) {
            case 'feature-extraction':
                return new FeatureExtractionPipeline(model, options);
            default:
                throw new Error(`不支持的任务类型: ${task}`);
        }
    }

    /**
     * 相似度计算工具
     */
    const similarity = {
        /**
         * 余弦相似度
         */
        cosine(vector1, vector2) {
            if (!vector1 || !vector2 || vector1.length !== vector2.length) {
                return 0;
            }

            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let i = 0; i < vector1.length; i++) {
                dotProduct += vector1[i] * vector2[i];
                norm1 += vector1[i] * vector1[i];
                norm2 += vector2[i] * vector2[i];
            }

            const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
            return magnitude === 0 ? 0 : dotProduct / magnitude;
        },

        /**
         * 欧几里得距离
         */
        euclidean(vector1, vector2) {
            if (!vector1 || !vector2 || vector1.length !== vector2.length) {
                return Infinity;
            }

            let sum = 0;
            for (let i = 0; i < vector1.length; i++) {
                const diff = vector1[i] - vector2[i];
                sum += diff * diff;
            }

            return Math.sqrt(sum);
        }
    };

    // 导出到全局变量
    if (typeof window !== 'undefined') {
        window.Transformers = {
            pipeline,
            env,
            similarity,
            version: '1.0.0-lite'
        };
    }

    // 同时支持ES模块导出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            pipeline,
            env,
            similarity,
            version: '1.0.0-lite'
        };
    }

    console.log('[TransformersLite] ✅ 轻量化Transformers.js库加载完成');
})();
