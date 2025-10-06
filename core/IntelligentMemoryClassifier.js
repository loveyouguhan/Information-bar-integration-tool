/**
 * 智能记忆分类器
 * 
 * AI驱动的记忆分类系统，提供：
 * - 多模态智能分类（文本、向量、上下文）
 * - 机器学习驱动的分类决策
 * - 自适应学习和用户反馈集成
 * - 分类质量保证和验证
 * - 语义聚类和模式识别
 * 
 * 核心功能：
 * - 智能分类决策引擎
 * - 语义聚类分析
 * - 时序模式识别
 * - 重要性预测模型
 * - 关联性网络分析
 * - 分类质量评估
 * 
 * @class IntelligentMemoryClassifier
 */

export class IntelligentMemoryClassifier {
    constructor(unifiedDataCore, eventSystem, vectorizedMemoryRetrieval, deepMemoryManager) {
        console.log('[IntelligentMemoryClassifier] 🧠 智能记忆分类器初始化开始');
        
        this.unifiedDataCore = unifiedDataCore;
        this.eventSystem = eventSystem;
        this.vectorizedMemoryRetrieval = vectorizedMemoryRetrieval;
        this.deepMemoryManager = deepMemoryManager;
        
        // 智能分类设置
        this.settings = {
            enabled: false,                        // 是否启用智能分类
            aiDrivenClassification: true,          // AI驱动分类
            semanticClustering: true,              // 语义聚类
            temporalPatternRecognition: true,      // 时序模式识别
            importancePrediction: true,            // 重要性预测
            relationshipAnalysis: true,            // 关联性分析
            
            // 分类阈值
            classificationConfidenceThreshold: 0.7,  // 分类置信度阈值
            semanticSimilarityThreshold: 0.8,        // 语义相似度阈值
            temporalPatternThreshold: 0.6,           // 时序模式阈值
            importancePredictionThreshold: 0.75,     // 重要性预测阈值
            
            // 学习参数
            learningRate: 0.01,                      // 学习率
            adaptationEnabled: true,                 // 自适应学习
            userFeedbackWeight: 0.3,                 // 用户反馈权重
            qualityAssuranceEnabled: true,           // 质量保证
            
            // 分类类别权重
            categoryWeights: {
                episodic: 1.0,      // 情节记忆
                semantic: 1.0,      // 语义记忆
                procedural: 1.0,    // 程序记忆
                emotional: 1.2,     // 情感记忆（权重更高）
                contextual: 0.8     // 上下文记忆
            }
        };
        
        // 智能分类引擎
        this.classificationEngines = {
            semanticClassifier: null,              // 语义分类器
            temporalClassifier: null,              // 时序分类器
            importancePredictor: null,             // 重要性预测器
            relationshipAnalyzer: null,            // 关联性分析器
            qualityAssurance: null                 // 质量保证系统
        };
        
        // 分类模型和数据
        this.classificationModels = {
            semanticClusters: new Map(),           // 语义聚类
            temporalPatterns: new Map(),           // 时序模式
            importanceFeatures: new Map(),         // 重要性特征
            relationshipGraph: new Map(),          // 关联关系图
            userPreferences: new Map()             // 用户偏好
        };
        
        // 分类历史和统计
        this.classificationHistory = [];          // 分类历史
        this.classificationStats = {
            totalClassifications: 0,               // 总分类数
            correctClassifications: 0,             // 正确分类数
            userCorrections: 0,                    // 用户纠正数
            averageConfidence: 0,                  // 平均置信度
            categoryDistribution: {},              // 类别分布
            lastTrainingTime: 0                    // 最后训练时间
        };
        
        // 质量保证系统
        this.qualityAssurance = {
            validationRules: [],                   // 验证规则
            conflictDetector: null,                // 冲突检测器
            qualityMetrics: {},                    // 质量指标
            improvementSuggestions: []             // 改进建议
        };
        
        // 初始化状态
        this.initialized = false;
        this.isTraining = false;
        this.isClassifying = false;
        this.errorCount = 0;
        
        console.log('[IntelligentMemoryClassifier] 🏗️ 构造函数完成');
    }

    /**
     * 初始化智能记忆分类器
     */
    async init() {
        try {
            console.log('[IntelligentMemoryClassifier] 📊 开始初始化智能记忆分类器...');

            // 加载设置
            await this.loadSettings();

            // 🔧 修复：如果禁用，跳过初始化
            if (!this.settings.enabled) {
                console.log('[IntelligentMemoryClassifier] ⏸️ 智能记忆分类器已禁用，跳过初始化');
                this.initialized = true;
                return;
            }

            // 初始化分类引擎
            await this.initializeClassificationEngines();

            // 加载分类模型
            await this.loadClassificationModels();

            // 初始化质量保证系统
            await this.initializeQualityAssurance();

            // 绑定事件监听器
            this.bindEventListeners();

            // 启动自适应学习
            if (this.settings.adaptationEnabled) {
                this.startAdaptiveLearning();
            }

            this.initialized = true;
            console.log('[IntelligentMemoryClassifier] ✅ 智能记忆分类器初始化完成');

            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('intelligent-memory-classifier:initialized', {
                    timestamp: Date.now(),
                    enginesEnabled: Object.keys(this.classificationEngines),
                    totalModels: Object.keys(this.classificationModels).length
                });
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            console.log('[IntelligentMemoryClassifier] 📥 加载智能分类设置...');

            // 🔧 修复：优先从extensionSettings加载设置
            try {
                const context = SillyTavern?.getContext?.();
                const extensionSettings = context?.extensionSettings?.['Information bar integration tool'];
                const memoryEnhancement = extensionSettings?.memoryEnhancement;

                if (memoryEnhancement?.classifier) {
                    if (memoryEnhancement.classifier.enabled !== undefined) {
                        this.settings.enabled = memoryEnhancement.classifier.enabled;
                    }
                    if (memoryEnhancement.classifier.semanticClustering !== undefined) {
                        this.settings.semanticClustering = memoryEnhancement.classifier.semanticClustering;
                    }
                    if (memoryEnhancement.classifier.temporalPatternRecognition !== undefined) {
                        this.settings.temporalPatternRecognition = memoryEnhancement.classifier.temporalPatternRecognition;
                    }
                    if (memoryEnhancement.classifier.importancePrediction !== undefined) {
                        this.settings.importancePrediction = memoryEnhancement.classifier.importancePrediction;
                    }
                    if (memoryEnhancement.classifier.classificationConfidenceThreshold !== undefined) {
                        this.settings.classificationConfidenceThreshold = memoryEnhancement.classifier.classificationConfidenceThreshold;
                    }
                    if (memoryEnhancement.classifier.adaptiveLearning !== undefined) {
                        this.settings.adaptationEnabled = memoryEnhancement.classifier.adaptiveLearning;
                    }
                    console.log('[IntelligentMemoryClassifier] 📥 从extensionSettings加载设置成功');
                }
            } catch (error) {
                console.warn('[IntelligentMemoryClassifier] ⚠️ 从extensionSettings加载设置失败:', error);
            }

            // 向后兼容：从unifiedDataCore加载其他设置
            if (this.unifiedDataCore) {
                const savedSettings = await this.unifiedDataCore.getData('intelligent_classifier_settings');
                if (savedSettings) {
                    this.settings = { ...savedSettings, ...this.settings };
                    console.log('[IntelligentMemoryClassifier] ✅ 智能分类设置加载完成:', this.settings);
                }
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 加载设置失败:', error);
        }
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔄 更新智能分类设置:', newSettings);
            this.settings = { ...this.settings, ...newSettings };
            
            // 保存设置
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('intelligent_classifier_settings', this.settings);
            }
            
            // 如果启用状态改变，重新初始化
            if (newSettings.hasOwnProperty('enabled')) {
                if (newSettings.enabled && !this.initialized) {
                    await this.init();
                }
            }
            
        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 更新设置失败:', error);
        }
    }

    /**
     * 初始化分类引擎
     */
    async initializeClassificationEngines() {
        try {
            console.log('[IntelligentMemoryClassifier] 🤖 初始化分类引擎...');
            
            // 语义分类器
            this.classificationEngines.semanticClassifier = {
                classify: this.classifyBySemantics.bind(this),
                cluster: this.performSemanticClustering ? this.performSemanticClustering.bind(this) : null,
                similarity: this.calculateSemanticSimilarity ? this.calculateSemanticSimilarity.bind(this) : null
            };

            // 时序分类器
            this.classificationEngines.temporalClassifier = {
                analyze: this.analyzeTemporalPatterns.bind(this),
                predict: this.predictTemporalCategory ? this.predictTemporalCategory.bind(this) : null,
                pattern: this.identifyTemporalPattern ? this.identifyTemporalPattern.bind(this) : null
            };

            // 重要性预测器
            this.classificationEngines.importancePredictor = {
                predict: this.predictImportance.bind(this),
                train: this.trainImportanceModel ? this.trainImportanceModel.bind(this) : null,
                evaluate: this.evaluateImportancePrediction ? this.evaluateImportancePrediction.bind(this) : null
            };

            // 关联性分析器
            this.classificationEngines.relationshipAnalyzer = {
                analyze: this.analyzeRelationships.bind(this),
                graph: this.buildRelationshipGraph ? this.buildRelationshipGraph.bind(this) : null,
                strength: this.calculateRelationshipStrength.bind(this)
            };

            // 质量保证系统
            this.classificationEngines.qualityAssurance = {
                validate: this.validateClassification.bind(this),
                detect: this.detectClassificationConflicts.bind(this),
                improve: this.suggestImprovements ? this.suggestImprovements.bind(this) : null
            };
            
            console.log('[IntelligentMemoryClassifier] ✅ 分类引擎初始化完成');
            
        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 初始化分类引擎失败:', error);
        }
    }

    /**
     * 智能分类记忆
     */
    async classifyMemoryIntelligently(memory) {
        try {
            if (!this.settings.enabled || this.isClassifying) {
                return await this.fallbackClassification(memory);
            }
            
            this.isClassifying = true;
            console.log(`[IntelligentMemoryClassifier] 🧠 智能分类记忆: ${memory.id}`);
            
            // 多模态分类分析
            const classificationResults = {
                semantic: null,
                temporal: null,
                importance: null,
                relationships: null,
                confidence: 0,
                reasoning: []
            };
            
            // 1. 语义分类
            if (this.settings.semanticClustering) {
                classificationResults.semantic = await this.classifyBySemantics(memory);
                classificationResults.reasoning.push('语义分析');
            }
            
            // 2. 时序模式分析
            if (this.settings.temporalPatternRecognition) {
                classificationResults.temporal = await this.analyzeTemporalPatterns(memory);
                classificationResults.reasoning.push('时序分析');
            }
            
            // 3. 重要性预测
            if (this.settings.importancePrediction) {
                classificationResults.importance = await this.predictImportance(memory);
                classificationResults.reasoning.push('重要性预测');
            }
            
            // 4. 关联性分析
            if (this.settings.relationshipAnalysis) {
                classificationResults.relationships = await this.analyzeRelationships(memory);
                classificationResults.reasoning.push('关联性分析');
            }
            
            // 5. 综合决策
            const finalClassification = await this.makeFinalClassificationDecision(memory, classificationResults);
            
            // 6. 质量验证
            if (this.settings.qualityAssuranceEnabled) {
                const validationResult = await this.validateClassification(finalClassification, memory);
                if (!validationResult.isValid) {
                    console.warn('[IntelligentMemoryClassifier] ⚠️ 分类验证失败，使用降级分类');
                    return await this.fallbackClassification(memory);
                }
            }
            
            // 7. 记录分类历史
            await this.recordClassificationHistory(memory, finalClassification, classificationResults);
            
            // 8. 更新统计信息
            this.updateClassificationStats(finalClassification);
            
            this.isClassifying = false;
            console.log(`[IntelligentMemoryClassifier] ✅ 智能分类完成: ${finalClassification.category} (置信度: ${finalClassification.confidence.toFixed(3)})`);
            
            return finalClassification;
            
        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 智能分类失败:', error);
            this.isClassifying = false;
            return await this.fallbackClassification(memory);
        }
    }

    /**
     * 语义分类
     */
    async classifyBySemantics(memory) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔍 执行语义分类...');
            
            if (!this.vectorizedMemoryRetrieval) {
                return this.basicSemanticClassification(memory);
            }
            
            // 向量化记忆内容
            const memoryVector = await this.vectorizedMemoryRetrieval.vectorizeText(memory.content);
            if (!memoryVector) {
                return this.basicSemanticClassification(memory);
            }
            
            // 与现有语义聚类比较
            let bestMatch = null;
            let bestSimilarity = 0;
            
            for (const [category, cluster] of this.classificationModels.semanticClusters) {
                const similarity = this.vectorizedMemoryRetrieval.calculateCosineSimilarity(
                    memoryVector, 
                    cluster.centroid
                );
                
                if (similarity > bestSimilarity && similarity >= this.settings.semanticSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        category: category,
                        similarity: similarity,
                        confidence: similarity,
                        method: 'semantic_clustering'
                    };
                }
            }
            
            // 如果没有找到匹配的聚类，创建新的或使用基础分类
            if (!bestMatch) {
                const basicResult = this.basicSemanticClassification(memory);
                
                // 创建新的语义聚类
                await this.createNewSemanticCluster(basicResult.category, memoryVector, memory);
                
                return {
                    category: basicResult.category,
                    similarity: 0.5,
                    confidence: 0.6,
                    method: 'new_cluster_creation'
                };
            }
            
            return bestMatch;
            
        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 语义分类失败:', error);
            return this.basicSemanticClassification(memory);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[IntelligentMemoryClassifier] ❌ 错误处理:', error);

        // 触发错误事件
        if (this.eventSystem) {
            this.eventSystem.emit('intelligent-memory-classifier:error', {
                error: error,
                errorCount: this.errorCount,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 基础语义分类（降级方法）
     */
    basicSemanticClassification(memory) {
        try {
            // 🔧 修复：添加严格的输入验证
            if (!memory || !memory.content || typeof memory.content !== 'string') {
                console.warn('[IntelligentMemoryClassifier] ⚠️ 无效的记忆内容，使用默认分类');
                return { category: 'contextual', confidence: 0.3, method: 'invalid_input_fallback' };
            }

            const content = memory.content.toLowerCase();

            // 基于关键词的基础分类
            if (content.includes('发生') || content.includes('经历') || content.includes('事件') ||
                content.includes('happened') || content.includes('experience') || content.includes('event')) {
                return { category: 'episodic', confidence: 0.7, method: 'keyword_matching' };
            }

            if (content.includes('知识') || content.includes('事实') || content.includes('定义') ||
                content.includes('knowledge') || content.includes('fact') || content.includes('definition')) {
                return { category: 'semantic', confidence: 0.7, method: 'keyword_matching' };
            }

            if (content.includes('方法') || content.includes('步骤') || content.includes('技能') ||
                content.includes('method') || content.includes('step') || content.includes('skill')) {
                return { category: 'procedural', confidence: 0.7, method: 'keyword_matching' };
            }

            if (content.includes('感觉') || content.includes('情感') || content.includes('心情') ||
                content.includes('feel') || content.includes('emotion') || content.includes('mood')) {
                return { category: 'emotional', confidence: 0.8, method: 'keyword_matching' };
            }

            return { category: 'contextual', confidence: 0.5, method: 'default_classification' };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 基础语义分类失败:', error);
            return { category: 'contextual', confidence: 0.3, method: 'error_fallback' };
        }
    }

    /**
     * 创建新的语义聚类
     */
    async createNewSemanticCluster(category, vector, memory) {
        try {
            console.log(`[IntelligentMemoryClassifier] 🆕 创建新的语义聚类: ${category}`);

            if (!this.classificationModels.semanticClusters.has(category)) {
                this.classificationModels.semanticClusters.set(category, {
                    centroid: [...vector],
                    members: [],
                    count: 0,
                    lastUpdated: Date.now()
                });
            }

            const cluster = this.classificationModels.semanticClusters.get(category);
            cluster.members.push({
                id: memory.id,
                vector: vector,
                content: memory.content,
                timestamp: memory.timestamp
            });
            cluster.count++;

            // 更新聚类中心
            await this.updateClusterCentroid(category);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 创建新语义聚类失败:', error);
        }
    }

    /**
     * 更新聚类中心
     */
    async updateClusterCentroid(category) {
        try {
            const cluster = this.classificationModels.semanticClusters.get(category);
            if (!cluster || cluster.members.length === 0) return;

            const dimensions = cluster.centroid.length;
            const newCentroid = new Array(dimensions).fill(0);

            // 计算平均向量
            for (const member of cluster.members) {
                for (let i = 0; i < dimensions; i++) {
                    newCentroid[i] += member.vector[i];
                }
            }

            for (let i = 0; i < dimensions; i++) {
                newCentroid[i] /= cluster.members.length;
            }

            cluster.centroid = newCentroid;
            cluster.lastUpdated = Date.now();

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 更新聚类中心失败:', error);
        }
    }

    /**
     * 时序模式分析
     */
    async analyzeTemporalPatterns(memory) {
        try {
            console.log('[IntelligentMemoryClassifier] ⏰ 分析时序模式...');

            const now = Date.now();
            const memoryAge = now - memory.timestamp;

            // 基础时间分类
            let temporalCategory = 'historical';
            let confidence = 0.6;

            // 最近记忆 (1小时内)
            if (memoryAge < 60 * 60 * 1000) {
                temporalCategory = 'recent';
                confidence = 0.9;
            }
            // 当日记忆 (24小时内)
            else if (memoryAge < 24 * 60 * 60 * 1000) {
                temporalCategory = 'daily';
                confidence = 0.8;
            }
            // 本周记忆 (7天内)
            else if (memoryAge < 7 * 24 * 60 * 60 * 1000) {
                temporalCategory = 'weekly';
                confidence = 0.7;
            }

            // 检查周期性模式
            const periodicPattern = await this.detectPeriodicPattern(memory);
            if (periodicPattern.isPeriodic) {
                temporalCategory = 'periodic';
                confidence = Math.max(confidence, periodicPattern.confidence);
            }

            // 检查里程碑模式
            if (memory.importance && memory.importance >= 0.8) {
                temporalCategory = 'milestone';
                confidence = Math.max(confidence, 0.85);
            }

            return {
                category: temporalCategory,
                confidence: confidence,
                age: memoryAge,
                pattern: periodicPattern,
                method: 'temporal_analysis'
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 时序模式分析失败:', error);
            return {
                category: 'historical',
                confidence: 0.5,
                method: 'error_fallback'
            };
        }
    }

    /**
     * 检测周期性模式
     */
    async detectPeriodicPattern(memory) {
        try {
            // 查找相似的历史记忆
            const similarMemories = await this.findSimilarHistoricalMemories(memory);

            if (similarMemories.length < 3) {
                return { isPeriodic: false, confidence: 0 };
            }

            // 分析时间间隔
            const timeIntervals = [];
            for (let i = 1; i < similarMemories.length; i++) {
                const interval = similarMemories[i].timestamp - similarMemories[i-1].timestamp;
                timeIntervals.push(interval);
            }

            // 检查间隔的一致性
            const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
            const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
            const standardDeviation = Math.sqrt(variance);

            // 如果标准差相对较小，认为是周期性的
            const coefficientOfVariation = standardDeviation / avgInterval;
            const isPeriodic = coefficientOfVariation < 0.3; // 30%的变异系数阈值

            return {
                isPeriodic: isPeriodic,
                confidence: isPeriodic ? (1 - coefficientOfVariation) : 0,
                averageInterval: avgInterval,
                intervalCount: timeIntervals.length
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 检测周期性模式失败:', error);
            return { isPeriodic: false, confidence: 0 };
        }
    }

    /**
     * 重要性预测
     */
    async predictImportance(memory) {
        try {
            console.log('[IntelligentMemoryClassifier] 🎯 预测记忆重要性...');

            let predictedImportance = 0.5; // 基础重要性
            let confidence = 0.6;

            // 1. 基于内容特征的预测
            const contentFeatures = this.extractContentFeatures(memory.content);
            predictedImportance += contentFeatures.importance * 0.3;

            // 2. 基于历史模式的预测
            const historicalPattern = await this.analyzeHistoricalImportancePattern(memory);
            predictedImportance += historicalPattern.importance * 0.3;

            // 3. 基于上下文相关性的预测
            const contextualRelevance = await this.calculateContextualRelevance(memory);
            predictedImportance += contextualRelevance * 0.2;

            // 4. 基于用户偏好的预测
            const userPreference = await this.calculateUserPreference(memory);
            predictedImportance += userPreference * 0.2;

            // 限制在0-1范围内
            predictedImportance = Math.min(Math.max(predictedImportance, 0), 1);

            // 计算预测置信度
            confidence = this.calculatePredictionConfidence(contentFeatures, historicalPattern, contextualRelevance, userPreference);

            return {
                importance: predictedImportance,
                confidence: confidence,
                features: {
                    content: contentFeatures,
                    historical: historicalPattern,
                    contextual: contextualRelevance,
                    userPreference: userPreference
                },
                method: 'ml_prediction'
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 重要性预测失败:', error);
            return {
                importance: 0.5,
                confidence: 0.3,
                method: 'error_fallback'
            };
        }
    }

    /**
     * 提取内容特征
     */
    extractContentFeatures(content) {
        try {
            // 🔧 修复：添加严格的输入验证
            if (!content || typeof content !== 'string') {
                console.warn('[IntelligentMemoryClassifier] ⚠️ 无效的内容，返回默认特征');
                return { length: 0, wordCount: 0, uniqueWords: 0, importance: 0.3 };
            }

            const features = {
                length: content.length,
                wordCount: content.split(/\s+/).length,
                uniqueWords: new Set(content.toLowerCase().split(/\s+/)).size,
                importance: 0
            };

            // 长度特征
            features.importance += Math.min(features.length / 1000, 0.3);

            // 词汇多样性
            const diversity = features.uniqueWords / features.wordCount;
            features.importance += diversity * 0.2;

            // 关键词检测
            const importantKeywords = [
                '重要', '关键', '决定', '计划', '目标', '问题', '解决', '发现', '结论',
                'important', 'key', 'critical', 'decision', 'plan', 'goal', 'problem', 'solution'
            ];

            const keywordMatches = importantKeywords.filter(keyword =>
                content.toLowerCase().includes(keyword)
            ).length;

            features.importance += keywordMatches * 0.1;

            return features;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 提取内容特征失败:', error);
            return { length: 0, wordCount: 0, uniqueWords: 0, importance: 0.3 };
        }
    }

    /**
     * 分析历史重要性模式
     */
    async analyzeHistoricalImportancePattern(memory) {
        try {
            // 查找相似的历史记忆
            const similarMemories = await this.findSimilarHistoricalMemories(memory);

            if (similarMemories.length === 0) {
                return { importance: 0.5, confidence: 0.3 };
            }

            // 计算历史记忆的平均重要性
            const avgImportance = similarMemories.reduce((sum, mem) =>
                sum + (mem.importance || 0.5), 0) / similarMemories.length;

            // 计算重要性趋势
            const recentMemories = similarMemories.slice(-5); // 最近5个相似记忆
            const trend = this.calculateImportanceTrend(recentMemories);

            return {
                importance: avgImportance,
                trend: trend,
                sampleSize: similarMemories.length,
                confidence: Math.min(similarMemories.length / 10, 1) // 样本越多置信度越高
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 分析历史重要性模式失败:', error);
            return { importance: 0.5, confidence: 0.3 };
        }
    }

    /**
     * 计算上下文相关性
     */
    async calculateContextualRelevance(memory) {
        try {
            if (!this.deepMemoryManager) return 0.5;

            // 获取当前上下文
            const currentContext = await this.deepMemoryManager.getCurrentContext();
            if (!currentContext) return 0.5;

            // 计算与当前上下文的相似度
            const similarity = await this.deepMemoryManager.calculateSimilarity(
                memory.content,
                currentContext
            );

            return Math.min(Math.max(similarity, 0), 1);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算上下文相关性失败:', error);
            return 0.5;
        }
    }

    /**
     * 计算用户偏好
     */
    async calculateUserPreference(memory) {
        try {
            // 基于用户历史反馈计算偏好
            const userPreferences = this.classificationModels.userPreferences;

            if (userPreferences.size === 0) return 0.5;

            let preferenceScore = 0.5;
            let totalWeight = 0;

            // 基于内容类型的偏好
            const contentType = this.identifyContentType(memory.content);
            if (userPreferences.has(`type_${contentType}`)) {
                const typePreference = userPreferences.get(`type_${contentType}`);
                preferenceScore += typePreference.score * typePreference.weight;
                totalWeight += typePreference.weight;
            }

            // 基于关键词的偏好
            const keywords = this.extractKeywords(memory.content);
            for (const keyword of keywords) {
                if (userPreferences.has(`keyword_${keyword}`)) {
                    const keywordPreference = userPreferences.get(`keyword_${keyword}`);
                    preferenceScore += keywordPreference.score * keywordPreference.weight;
                    totalWeight += keywordPreference.weight;
                }
            }

            // 归一化
            if (totalWeight > 0) {
                preferenceScore /= totalWeight;
            }

            return Math.min(Math.max(preferenceScore, 0), 1);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算用户偏好失败:', error);
            return 0.5;
        }
    }

    /**
     * 综合分类决策
     */
    async makeFinalClassificationDecision(memory, classificationResults) {
        try {
            console.log('[IntelligentMemoryClassifier] 🎯 进行综合分类决策...');

            const decisions = [];

            // 收集各个分类器的结果
            if (classificationResults.semantic) {
                decisions.push({
                    category: classificationResults.semantic.category,
                    confidence: classificationResults.semantic.confidence,
                    weight: 0.4, // 语义分类权重最高
                    source: 'semantic'
                });
            }

            if (classificationResults.temporal) {
                decisions.push({
                    category: classificationResults.temporal.category,
                    confidence: classificationResults.temporal.confidence,
                    weight: 0.2,
                    source: 'temporal'
                });
            }

            if (classificationResults.importance) {
                // 基于重要性调整分类
                const importanceBonus = classificationResults.importance.importance > 0.7 ? 0.1 : 0;
                decisions.push({
                    category: 'high_importance',
                    confidence: classificationResults.importance.confidence + importanceBonus,
                    weight: 0.2,
                    source: 'importance'
                });
            }

            if (classificationResults.relationships) {
                decisions.push({
                    category: classificationResults.relationships.category,
                    confidence: classificationResults.relationships.confidence,
                    weight: 0.2,
                    source: 'relationships'
                });
            }

            // 加权投票决策
            const categoryScores = new Map();
            let totalWeight = 0;

            for (const decision of decisions) {
                const score = decision.confidence * decision.weight;
                const currentScore = categoryScores.get(decision.category) || 0;
                categoryScores.set(decision.category, currentScore + score);
                totalWeight += decision.weight;
            }

            // 找到最高分的类别
            let bestCategory = 'contextual';
            let bestScore = 0;

            for (const [category, score] of categoryScores) {
                if (score > bestScore) {
                    bestScore = score;
                    bestCategory = category;
                }
            }

            // 计算最终置信度
            const finalConfidence = totalWeight > 0 ? bestScore / totalWeight : 0.5;

            // 应用类别权重
            const categoryWeight = this.settings.categoryWeights[bestCategory] || 1.0;
            const adjustedConfidence = Math.min(finalConfidence * categoryWeight, 1.0);

            return {
                category: bestCategory,
                confidence: adjustedConfidence,
                decisions: decisions,
                reasoning: classificationResults.reasoning,
                timestamp: Date.now(),
                method: 'weighted_ensemble'
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 综合分类决策失败:', error);
            return await this.fallbackClassification(memory);
        }
    }

    /**
     * 降级分类方法
     */
    async fallbackClassification(memory) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔄 使用降级分类方法...');

            // 使用深度记忆管理器的基础分类
            if (this.deepMemoryManager) {
                const category = await this.deepMemoryManager.classifyMemoryCategory(memory);
                return {
                    category: category,
                    confidence: 0.6,
                    method: 'deep_memory_manager_fallback',
                    timestamp: Date.now()
                };
            }

            // 最基础的分类
            return {
                category: 'contextual',
                confidence: 0.5,
                method: 'basic_fallback',
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 降级分类失败:', error);
            return {
                category: 'contextual',
                confidence: 0.3,
                method: 'error_fallback',
                timestamp: Date.now()
            };
        }
    }

    /**
     * 查找相似的历史记忆
     */
    async findSimilarHistoricalMemories(memory) {
        try {
            if (!this.deepMemoryManager) return [];

            const similarMemories = await this.deepMemoryManager.findSimilarMemories(memory, 0.6);
            return similarMemories.slice(0, 10); // 限制返回数量

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 查找相似历史记忆失败:', error);
            return [];
        }
    }

    /**
     * 计算重要性趋势
     */
    calculateImportanceTrend(memories) {
        try {
            if (memories.length < 2) return 0;

            let trend = 0;
            for (let i = 1; i < memories.length; i++) {
                const current = memories[i].importance || 0.5;
                const previous = memories[i-1].importance || 0.5;
                trend += (current - previous);
            }

            return trend / (memories.length - 1);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算重要性趋势失败:', error);
            return 0;
        }
    }

    /**
     * 识别内容类型
     */
    identifyContentType(content) {
        try {
            const lowerContent = content.toLowerCase();

            if (lowerContent.includes('问题') || lowerContent.includes('question')) return 'question';
            if (lowerContent.includes('回答') || lowerContent.includes('answer')) return 'answer';
            if (lowerContent.includes('总结') || lowerContent.includes('summary')) return 'summary';
            if (lowerContent.includes('计划') || lowerContent.includes('plan')) return 'plan';
            if (lowerContent.includes('想法') || lowerContent.includes('idea')) return 'idea';

            return 'general';

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 识别内容类型失败:', error);
            return 'general';
        }
    }

    /**
     * 提取关键词
     */
    extractKeywords(content) {
        try {
            const words = content.toLowerCase()
                .replace(/[^\w\s\u4e00-\u9fff]/g, '') // 保留中英文字符
                .split(/\s+/)
                .filter(word => word.length > 2); // 过滤短词

            // 简单的关键词提取（基于词频）
            const wordCount = new Map();
            words.forEach(word => {
                wordCount.set(word, (wordCount.get(word) || 0) + 1);
            });

            // 返回出现频率最高的词
            return Array.from(wordCount.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(entry => entry[0]);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 提取关键词失败:', error);
            return [];
        }
    }

    /**
     * 计算预测置信度
     */
    calculatePredictionConfidence(contentFeatures, historicalPattern, contextualRelevance, userPreference) {
        try {
            let confidence = 0.5;

            // 基于特征质量的置信度
            if (contentFeatures.wordCount > 10) confidence += 0.1;
            if (contentFeatures.uniqueWords > 5) confidence += 0.1;

            // 基于历史数据的置信度
            if (historicalPattern.sampleSize > 3) confidence += 0.1;
            if (historicalPattern.confidence > 0.7) confidence += 0.1;

            // 基于上下文相关性的置信度
            if (contextualRelevance > 0.6) confidence += 0.1;

            // 基于用户偏好的置信度
            if (userPreference !== 0.5) confidence += 0.1; // 有明确偏好

            return Math.min(Math.max(confidence, 0.3), 1.0);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算预测置信度失败:', error);
            return 0.5;
        }
    }

    /**
     * 记录分类历史
     */
    async recordClassificationHistory(memory, classification, results) {
        try {
            const historyRecord = {
                memoryId: memory.id,
                classification: classification,
                results: results,
                timestamp: Date.now(),
                confidence: classification.confidence
            };

            this.classificationHistory.push(historyRecord);

            // 限制历史记录数量
            if (this.classificationHistory.length > 1000) {
                this.classificationHistory = this.classificationHistory.slice(-800);
            }

            // 保存到存储
            if (this.unifiedDataCore) {
                await this.unifiedDataCore.setData('classification_history', this.classificationHistory);
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 记录分类历史失败:', error);
        }
    }

    /**
     * 更新分类统计
     */
    updateClassificationStats(classification) {
        try {
            this.classificationStats.totalClassifications++;

            // 更新类别分布
            const category = classification.category;
            this.classificationStats.categoryDistribution[category] =
                (this.classificationStats.categoryDistribution[category] || 0) + 1;

            // 更新平均置信度
            const totalConfidence = this.classificationStats.averageConfidence *
                (this.classificationStats.totalClassifications - 1) + classification.confidence;
            this.classificationStats.averageConfidence =
                totalConfidence / this.classificationStats.totalClassifications;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 更新分类统计失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[IntelligentMemoryClassifier] 🔗 绑定事件监听器...');

            if (!this.eventSystem) return;

            // 监听深度记忆管理器的记忆添加事件
            this.eventSystem.on('deep-memory-manager:memory-added', (data) => {
                this.handleMemoryAdded(data);
            });

            // 监听用户反馈事件
            this.eventSystem.on('intelligent-classifier:user-feedback', (data) => {
                this.handleUserFeedback(data);
            });

            // 监听分类质量评估事件
            this.eventSystem.on('intelligent-classifier:quality-assessment', (data) => {
                this.handleQualityAssessment(data);
            });

            // 🔧 新增：监听消息删除事件
            this.eventSystem.on('MESSAGE_DELETED', (data) => {
                this.handleMessageDeleted(data);
            });

            // 🔧 新增：监听消息重新生成事件
            this.eventSystem.on('MESSAGE_REGENERATED', (data) => {
                this.handleMessageRegenerated(data);
            });

            console.log('[IntelligentMemoryClassifier] ✅ 事件监听器绑定完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理记忆添加事件
     */
    async handleMemoryAdded(data) {
        try {
            if (!this.settings.enabled || !data.memory) return;

            console.log('[IntelligentMemoryClassifier] 📝 处理新记忆分类...');

            // 自动分类新添加的记忆
            const classification = await this.classifyMemoryIntelligently(data.memory);

            // 更新记忆的分类信息
            if (classification && this.deepMemoryManager) {
                data.memory.intelligentClassification = classification;
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 处理记忆添加事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息删除事件
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[IntelligentMemoryClassifier] 🗑️ 处理消息删除事件');

            if (!this.settings.enabled) return;

            // 检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[IntelligentMemoryClassifier] ℹ️ 跳过分类数据回溯（删除的是用户消息）');
                return;
            }

            console.log('[IntelligentMemoryClassifier] 🔄 开始分类数据回溯...');

            // 清理最近的分类历史
            await this.clearRecentClassificationHistory();

            console.log('[IntelligentMemoryClassifier] ✅ 消息删除分类回溯完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息重新生成事件
     */
    async handleMessageRegenerated(data) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔄 处理消息重新生成事件');

            if (!this.settings.enabled) return;

            console.log('[IntelligentMemoryClassifier] 🔄 开始分类数据回溯（重新生成）...');

            // 清理最近的分类历史
            await this.clearRecentClassificationHistory();

            console.log('[IntelligentMemoryClassifier] ✅ 消息重新生成分类回溯完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 处理消息重新生成事件失败:', error);
        }
    }

    /**
     * 🔧 新增：清理最近的分类历史
     */
    async clearRecentClassificationHistory() {
        try {
            console.log('[IntelligentMemoryClassifier] 🧹 清理最近的分类历史...');

            // 清理最近的分类历史（保留重要的历史数据）
            const now = Date.now();
            const recentThreshold = 30 * 60 * 1000; // 30分钟内的分类

            const originalLength = this.classificationHistory.length;
            this.classificationHistory = this.classificationHistory.filter(history => {
                return now - history.timestamp > recentThreshold;
            });

            const removedCount = originalLength - this.classificationHistory.length;

            // 重置分类统计
            this.classificationStats.totalClassifications = this.classificationHistory.length;
            this.classificationStats.lastClassificationTime = this.classificationHistory.length > 0 ?
                this.classificationHistory[this.classificationHistory.length - 1].timestamp : 0;

            console.log(`[IntelligentMemoryClassifier] ✅ 已清理 ${removedCount} 个最近的分类记录`);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 清理分类历史失败:', error);
        }
    }

    /**
     * 加载分类模型
     */
    async loadClassificationModels() {
        try {
            console.log('[IntelligentMemoryClassifier] 📥 加载分类模型...');

            if (!this.unifiedDataCore) return;

            // 加载语义聚类
            const semanticClusters = await this.unifiedDataCore.getData('semantic_clusters');
            if (semanticClusters) {
                this.classificationModels.semanticClusters = new Map(Object.entries(semanticClusters));
            }

            // 加载时序模式
            const temporalPatterns = await this.unifiedDataCore.getData('temporal_patterns');
            if (temporalPatterns) {
                this.classificationModels.temporalPatterns = new Map(Object.entries(temporalPatterns));
            }

            // 加载重要性特征
            const importanceFeatures = await this.unifiedDataCore.getData('importance_features');
            if (importanceFeatures) {
                this.classificationModels.importanceFeatures = new Map(Object.entries(importanceFeatures));
            }

            // 加载关联关系图
            const relationshipGraph = await this.unifiedDataCore.getData('relationship_graph');
            if (relationshipGraph) {
                this.classificationModels.relationshipGraph = new Map(Object.entries(relationshipGraph));
            }

            // 加载用户偏好
            const userPreferences = await this.unifiedDataCore.getData('user_preferences');
            if (userPreferences) {
                this.classificationModels.userPreferences = new Map(Object.entries(userPreferences));
            }

            console.log('[IntelligentMemoryClassifier] ✅ 分类模型加载完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 加载分类模型失败:', error);
        }
    }

    /**
     * 初始化质量保证系统
     */
    async initializeQualityAssurance() {
        try {
            console.log('[IntelligentMemoryClassifier] 🔍 初始化质量保证系统...');

            // 初始化验证规则
            this.qualityAssurance.validationRules = [
                {
                    name: 'confidence_threshold',
                    check: (classification) => classification.confidence >= this.settings.classificationConfidenceThreshold,
                    message: '分类置信度过低'
                },
                {
                    name: 'category_validity',
                    check: (classification) => ['episodic', 'semantic', 'procedural', 'emotional', 'contextual'].includes(classification.category),
                    message: '分类类别无效'
                },
                {
                    name: 'method_validity',
                    check: (classification) => classification.method && classification.method.length > 0,
                    message: '分类方法缺失'
                }
            ];

            // 初始化冲突检测器
            this.qualityAssurance.conflictDetector = {
                detectConflicts: this.detectClassificationConflicts.bind(this),
                resolveConflicts: this.resolveClassificationConflicts.bind(this)
            };

            // 初始化质量指标
            this.qualityAssurance.qualityMetrics = {
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1Score: 0
            };

            console.log('[IntelligentMemoryClassifier] ✅ 质量保证系统初始化完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 初始化质量保证系统失败:', error);
        }
    }

    /**
     * 启动自适应学习
     */
    startAdaptiveLearning() {
        try {
            console.log('[IntelligentMemoryClassifier] 🧠 启动自适应学习...');

            // 每小时执行一次学习更新
            setInterval(() => {
                this.performAdaptiveLearning();
            }, 60 * 60 * 1000);

            console.log('[IntelligentMemoryClassifier] ✅ 自适应学习已启动');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 启动自适应学习失败:', error);
        }
    }

    /**
     * 执行自适应学习
     */
    async performAdaptiveLearning() {
        try {
            if (this.isTraining) return;

            this.isTraining = true;
            console.log('[IntelligentMemoryClassifier] 🧠 执行自适应学习...');

            // 分析分类历史
            await this.analyzeClassificationHistory();

            // 更新用户偏好
            await this.updateUserPreferences();

            // 优化分类模型
            await this.optimizeClassificationModels();

            this.isTraining = false;
            console.log('[IntelligentMemoryClassifier] ✅ 自适应学习完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 自适应学习失败:', error);
            this.isTraining = false;
        }
    }

    /**
     * 分析关联关系
     */
    async analyzeRelationships(memory) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔗 分析记忆关联关系...');

            // 查找相似记忆
            const similarMemories = await this.findSimilarHistoricalMemories(memory);

            if (similarMemories.length === 0) {
                return {
                    category: 'isolated',
                    confidence: 0.5,
                    relationshipCount: 0,
                    method: 'relationship_analysis'
                };
            }

            // 分析关联强度
            let totalStrength = 0;
            let strongRelationships = 0;

            for (const similarMemory of similarMemories) {
                const strength = await this.calculateRelationshipStrength(memory, similarMemory);
                totalStrength += strength;

                if (strength > 0.7) {
                    strongRelationships++;
                }
            }

            const avgStrength = totalStrength / similarMemories.length;

            // 基于关联强度确定类别
            let category = 'contextual';
            let confidence = avgStrength;

            if (strongRelationships >= 3) {
                category = 'highly_connected';
                confidence = Math.min(avgStrength + 0.2, 1.0);
            } else if (strongRelationships >= 1) {
                category = 'connected';
                confidence = avgStrength;
            }

            return {
                category: category,
                confidence: confidence,
                relationshipCount: similarMemories.length,
                strongRelationships: strongRelationships,
                averageStrength: avgStrength,
                method: 'relationship_analysis'
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 分析关联关系失败:', error);
            return {
                category: 'contextual',
                confidence: 0.5,
                method: 'error_fallback'
            };
        }
    }

    /**
     * 计算关联强度
     */
    async calculateRelationshipStrength(memory1, memory2) {
        try {
            let strength = 0;

            // 内容相似度
            const contentSimilarity = await this.deepMemoryManager?.calculateSimilarity(
                memory1.content,
                memory2.content
            ) || 0;
            strength += contentSimilarity * 0.4;

            // 时间相关性
            const timeDiff = Math.abs(memory1.timestamp - memory2.timestamp);
            const timeRelevance = Math.exp(-timeDiff / (24 * 60 * 60 * 1000)); // 24小时衰减
            strength += timeRelevance * 0.3;

            // 类型相关性
            const typeRelevance = memory1.type === memory2.type ? 1.0 : 0.5;
            strength += typeRelevance * 0.2;

            // 重要性相关性
            const importance1 = memory1.importance || 0.5;
            const importance2 = memory2.importance || 0.5;
            const importanceRelevance = 1 - Math.abs(importance1 - importance2);
            strength += importanceRelevance * 0.1;

            return Math.min(Math.max(strength, 0), 1);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算关联强度失败:', error);
            return 0.5;
        }
    }

    /**
     * 验证分类结果
     */
    async validateClassification(classification, memory) {
        try {
            const validationResult = {
                isValid: true,
                errors: [],
                warnings: []
            };

            // 执行验证规则
            for (const rule of this.qualityAssurance.validationRules) {
                if (!rule.check(classification)) {
                    validationResult.isValid = false;
                    validationResult.errors.push(rule.message);
                }
            }

            // 检查置信度
            if (classification.confidence < 0.3) {
                validationResult.warnings.push('分类置信度过低');
            }

            // 检查分类一致性
            if (memory.type && classification.category !== memory.type) {
                validationResult.warnings.push('分类与原始类型不一致');
            }

            return validationResult;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 验证分类结果失败:', error);
            return { isValid: false, errors: ['验证过程失败'], warnings: [] };
        }
    }

    /**
     * 检测分类冲突
     */
    async detectClassificationConflicts(classifications) {
        try {
            const conflicts = [];

            // 检查同一记忆的多个分类结果
            const memoryGroups = new Map();

            for (const classification of classifications) {
                const memoryId = classification.memoryId;
                if (!memoryGroups.has(memoryId)) {
                    memoryGroups.set(memoryId, []);
                }
                memoryGroups.get(memoryId).push(classification);
            }

            // 检测冲突
            for (const [memoryId, memoryClassifications] of memoryGroups) {
                if (memoryClassifications.length > 1) {
                    const categories = memoryClassifications.map(c => c.category);
                    const uniqueCategories = new Set(categories);

                    if (uniqueCategories.size > 1) {
                        conflicts.push({
                            memoryId: memoryId,
                            conflictingCategories: Array.from(uniqueCategories),
                            classifications: memoryClassifications
                        });
                    }
                }
            }

            return conflicts;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 检测分类冲突失败:', error);
            return [];
        }
    }

    /**
     * 解决分类冲突
     */
    async resolveClassificationConflicts(conflicts) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔧 解决分类冲突...');

            const resolutions = [];

            for (const conflict of conflicts) {
                // 选择置信度最高的分类
                const bestClassification = conflict.classifications.reduce((best, current) =>
                    current.confidence > best.confidence ? current : best
                );

                resolutions.push({
                    memoryId: conflict.memoryId,
                    resolvedCategory: bestClassification.category,
                    confidence: bestClassification.confidence,
                    method: 'highest_confidence'
                });
            }

            return resolutions;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 解决分类冲突失败:', error);
            return [];
        }
    }

    /**
     * 分析分类历史
     */
    async analyzeClassificationHistory() {
        try {
            console.log('[IntelligentMemoryClassifier] 📊 分析分类历史...');

            if (this.classificationHistory.length === 0) return;

            // 计算分类准确性
            const recentHistory = this.classificationHistory.slice(-100); // 最近100个分类
            const totalClassifications = recentHistory.length;
            const highConfidenceClassifications = recentHistory.filter(h => h.confidence > 0.7).length;

            this.classificationStats.averageConfidence =
                recentHistory.reduce((sum, h) => sum + h.confidence, 0) / totalClassifications;

            // 更新类别分布
            const categoryCount = {};
            recentHistory.forEach(h => {
                categoryCount[h.classification.category] = (categoryCount[h.classification.category] || 0) + 1;
            });

            this.classificationStats.categoryDistribution = categoryCount;

            console.log('[IntelligentMemoryClassifier] ✅ 分类历史分析完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 分析分类历史失败:', error);
        }
    }

    /**
     * 更新用户偏好
     */
    async updateUserPreferences() {
        try {
            console.log('[IntelligentMemoryClassifier] 👤 更新用户偏好...');

            // 基于分类历史更新用户偏好
            const recentHistory = this.classificationHistory.slice(-50);

            for (const historyItem of recentHistory) {
                const memory = historyItem.memory;
                const classification = historyItem.classification;

                // 更新内容类型偏好
                const contentType = this.identifyContentType(memory.content);
                const typeKey = `type_${contentType}`;

                if (!this.classificationModels.userPreferences.has(typeKey)) {
                    this.classificationModels.userPreferences.set(typeKey, {
                        score: 0.5,
                        weight: 1,
                        count: 0
                    });
                }

                const typePreference = this.classificationModels.userPreferences.get(typeKey);
                typePreference.count++;
                typePreference.score = (typePreference.score * (typePreference.count - 1) + classification.confidence) / typePreference.count;

                // 更新关键词偏好
                const keywords = this.extractKeywords(memory.content);
                for (const keyword of keywords.slice(0, 3)) { // 只取前3个关键词
                    const keywordKey = `keyword_${keyword}`;

                    if (!this.classificationModels.userPreferences.has(keywordKey)) {
                        this.classificationModels.userPreferences.set(keywordKey, {
                            score: 0.5,
                            weight: 0.5,
                            count: 0
                        });
                    }

                    const keywordPreference = this.classificationModels.userPreferences.get(keywordKey);
                    keywordPreference.count++;
                    keywordPreference.score = (keywordPreference.score * (keywordPreference.count - 1) + classification.confidence) / keywordPreference.count;
                }
            }

            console.log('[IntelligentMemoryClassifier] ✅ 用户偏好更新完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 更新用户偏好失败:', error);
        }
    }

    /**
     * 优化分类模型
     */
    async optimizeClassificationModels() {
        try {
            console.log('[IntelligentMemoryClassifier] ⚡ 优化分类模型...');

            // 优化语义聚类
            await this.optimizeSemanticClusters();

            // 清理过期的时序模式
            await this.cleanupTemporalPatterns();

            // 保存优化后的模型
            await this.saveClassificationModels();

            console.log('[IntelligentMemoryClassifier] ✅ 分类模型优化完成');

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 优化分类模型失败:', error);
        }
    }

    /**
     * 优化语义聚类
     */
    async optimizeSemanticClusters() {
        try {
            // 合并相似的聚类
            const clusters = Array.from(this.classificationModels.semanticClusters.entries());

            for (let i = 0; i < clusters.length; i++) {
                for (let j = i + 1; j < clusters.length; j++) {
                    const [category1, cluster1] = clusters[i];
                    const [category2, cluster2] = clusters[j];

                    if (category1 === category2) continue;

                    // 计算聚类中心的相似度
                    const similarity = this.vectorizedMemoryRetrieval?.calculateCosineSimilarity(
                        cluster1.centroid,
                        cluster2.centroid
                    ) || 0;

                    // 如果相似度很高，合并聚类
                    if (similarity > 0.9) {
                        // 合并到第一个聚类
                        cluster1.members.push(...cluster2.members);
                        cluster1.count += cluster2.count;

                        // 重新计算中心
                        await this.updateClusterCentroid(category1);

                        // 删除第二个聚类
                        this.classificationModels.semanticClusters.delete(category2);

                        console.log(`[IntelligentMemoryClassifier] 🔗 合并聚类: ${category2} -> ${category1}`);
                    }
                }
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 优化语义聚类失败:', error);
        }
    }

    /**
     * 清理时序模式
     */
    async cleanupTemporalPatterns() {
        try {
            const now = Date.now();
            const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

            // 删除过期的时序模式
            for (const [patternId, pattern] of this.classificationModels.temporalPatterns) {
                if (pattern.lastUpdated < oneWeekAgo) {
                    this.classificationModels.temporalPatterns.delete(patternId);
                }
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 清理时序模式失败:', error);
        }
    }

    /**
     * 保存分类模型
     */
    async saveClassificationModels() {
        try {
            if (!this.unifiedDataCore) return;

            // 保存语义聚类
            const semanticClusters = Object.fromEntries(this.classificationModels.semanticClusters);
            await this.unifiedDataCore.setData('semantic_clusters', semanticClusters);

            // 保存时序模式
            const temporalPatterns = Object.fromEntries(this.classificationModels.temporalPatterns);
            await this.unifiedDataCore.setData('temporal_patterns', temporalPatterns);

            // 保存用户偏好
            const userPreferences = Object.fromEntries(this.classificationModels.userPreferences);
            await this.unifiedDataCore.setData('user_preferences', userPreferences);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 保存分类模型失败:', error);
        }
    }

    /**
     * 执行语义聚类
     */
    async performSemanticClustering(memories) {
        try {
            console.log('[IntelligentMemoryClassifier] 🔍 执行语义聚类...');

            if (!this.vectorizedMemoryRetrieval || !memories || memories.length === 0) {
                return { clusters: [], method: 'no_data' };
            }

            const clusters = new Map();

            for (const memory of memories) {
                const vector = await this.vectorizedMemoryRetrieval.vectorizeText(memory.content);
                if (!vector) continue;

                // 查找最相似的聚类
                let bestCluster = null;
                let bestSimilarity = 0;

                for (const [clusterId, cluster] of clusters) {
                    const similarity = this.vectorizedMemoryRetrieval.calculateCosineSimilarity(
                        vector,
                        cluster.centroid
                    );

                    if (similarity > bestSimilarity && similarity >= this.settings.semanticSimilarityThreshold) {
                        bestSimilarity = similarity;
                        bestCluster = clusterId;
                    }
                }

                if (bestCluster) {
                    // 添加到现有聚类
                    clusters.get(bestCluster).members.push(memory);
                } else {
                    // 创建新聚类
                    const clusterId = `cluster_${clusters.size + 1}`;
                    clusters.set(clusterId, {
                        centroid: [...vector],
                        members: [memory],
                        category: memory.category || 'unknown'
                    });
                }
            }

            return { clusters: Array.from(clusters.values()), method: 'semantic_clustering' };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 语义聚类失败:', error);
            return { clusters: [], method: 'error_fallback' };
        }
    }

    /**
     * 计算语义相似度
     */
    async calculateSemanticSimilarity(text1, text2) {
        try {
            if (!this.vectorizedMemoryRetrieval) {
                return this.basicTextSimilarity(text1, text2);
            }

            const vector1 = await this.vectorizedMemoryRetrieval.vectorizeText(text1);
            const vector2 = await this.vectorizedMemoryRetrieval.vectorizeText(text2);

            if (vector1 && vector2) {
                return this.vectorizedMemoryRetrieval.calculateCosineSimilarity(vector1, vector2);
            }

            return this.basicTextSimilarity(text1, text2);

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 计算语义相似度失败:', error);
            return this.basicTextSimilarity(text1, text2);
        }
    }

    /**
     * 预测时序类别
     */
    async predictTemporalCategory(memory) {
        try {
            const now = Date.now();
            const memoryAge = now - memory.timestamp;

            // 基于时间的预测
            if (memoryAge < 60 * 60 * 1000) { // 1小时内
                return { category: 'immediate', confidence: 0.9 };
            } else if (memoryAge < 24 * 60 * 60 * 1000) { // 24小时内
                return { category: 'recent', confidence: 0.8 };
            } else if (memoryAge < 7 * 24 * 60 * 60 * 1000) { // 7天内
                return { category: 'short_term', confidence: 0.7 };
            } else {
                return { category: 'long_term', confidence: 0.6 };
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 预测时序类别失败:', error);
            return { category: 'unknown', confidence: 0.5 };
        }
    }

    /**
     * 识别时序模式
     */
    async identifyTemporalPattern(memory) {
        try {
            // 查找相似的历史记忆
            const similarMemories = await this.findSimilarHistoricalMemories(memory);

            if (similarMemories.length < 2) {
                return { pattern: 'isolated', confidence: 0.5 };
            }

            // 分析时间间隔
            const timeIntervals = [];
            similarMemories.sort((a, b) => a.timestamp - b.timestamp);

            for (let i = 1; i < similarMemories.length; i++) {
                const interval = similarMemories[i].timestamp - similarMemories[i-1].timestamp;
                timeIntervals.push(interval);
            }

            // 检查是否有规律性
            const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
            const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
            const standardDeviation = Math.sqrt(variance);
            const coefficientOfVariation = standardDeviation / avgInterval;

            if (coefficientOfVariation < 0.3) {
                return { pattern: 'periodic', confidence: 1 - coefficientOfVariation, interval: avgInterval };
            } else {
                return { pattern: 'irregular', confidence: 0.6 };
            }

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 识别时序模式失败:', error);
            return { pattern: 'unknown', confidence: 0.5 };
        }
    }

    /**
     * 训练重要性模型
     */
    async trainImportanceModel(trainingData) {
        try {
            console.log('[IntelligentMemoryClassifier] 🎯 训练重要性模型...');

            if (!trainingData || trainingData.length === 0) {
                console.warn('[IntelligentMemoryClassifier] ⚠️ 没有训练数据');
                return false;
            }

            // 简单的线性回归训练
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            const n = trainingData.length;

            for (const data of trainingData) {
                const features = this.extractContentFeatures(data.content);
                const x = features.importance;
                const y = data.actualImportance || data.importance || 0.5;

                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
            }

            // 计算回归系数
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            // 保存模型参数
            this.classificationModels.importanceFeatures.set('regression_model', {
                slope: slope,
                intercept: intercept,
                trainedAt: Date.now(),
                sampleSize: n
            });

            console.log('[IntelligentMemoryClassifier] ✅ 重要性模型训练完成');
            return true;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 训练重要性模型失败:', error);
            return false;
        }
    }

    /**
     * 评估重要性预测
     */
    async evaluateImportancePrediction(testData) {
        try {
            if (!testData || testData.length === 0) return { accuracy: 0, error: 'no_test_data' };

            let totalError = 0;
            let validPredictions = 0;

            for (const data of testData) {
                const predicted = await this.predictImportance(data);
                const actual = data.actualImportance || data.importance || 0.5;

                if (predicted && predicted.importance !== undefined) {
                    const error = Math.abs(predicted.importance - actual);
                    totalError += error;
                    validPredictions++;
                }
            }

            const averageError = validPredictions > 0 ? totalError / validPredictions : 1;
            const accuracy = Math.max(0, 1 - averageError);

            return {
                accuracy: accuracy,
                averageError: averageError,
                validPredictions: validPredictions,
                totalTests: testData.length
            };

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 评估重要性预测失败:', error);
            return { accuracy: 0, error: error.message };
        }
    }

    /**
     * 构建关联关系图
     */
    async buildRelationshipGraph(memories) {
        try {
            console.log('[IntelligentMemoryClassifier] 🕸️ 构建关联关系图...');

            const graph = new Map();

            for (let i = 0; i < memories.length; i++) {
                const memory1 = memories[i];
                graph.set(memory1.id, { memory: memory1, connections: [] });

                for (let j = i + 1; j < memories.length; j++) {
                    const memory2 = memories[j];
                    const strength = await this.calculateRelationshipStrength(memory1, memory2);

                    if (strength > 0.5) {
                        graph.get(memory1.id).connections.push({
                            targetId: memory2.id,
                            strength: strength,
                            type: 'semantic'
                        });

                        if (!graph.has(memory2.id)) {
                            graph.set(memory2.id, { memory: memory2, connections: [] });
                        }

                        graph.get(memory2.id).connections.push({
                            targetId: memory1.id,
                            strength: strength,
                            type: 'semantic'
                        });
                    }
                }
            }

            return graph;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 构建关联关系图失败:', error);
            return new Map();
        }
    }

    /**
     * 建议改进
     */
    async suggestImprovements() {
        try {
            const suggestions = [];

            // 基于统计信息提供建议
            if (this.classificationStats.averageConfidence < 0.6) {
                suggestions.push({
                    type: 'confidence',
                    message: '分类置信度较低，建议调整分类阈值或增加训练数据',
                    priority: 'high'
                });
            }

            if (this.classificationStats.totalClassifications < 10) {
                suggestions.push({
                    type: 'data',
                    message: '分类样本较少，建议增加更多记忆数据以提高分类准确性',
                    priority: 'medium'
                });
            }

            // 检查分类分布
            const categories = Object.keys(this.classificationStats.categoryDistribution);
            if (categories.length < 3) {
                suggestions.push({
                    type: 'diversity',
                    message: '记忆类别多样性不足，建议增加不同类型的记忆内容',
                    priority: 'medium'
                });
            }

            return suggestions;

        } catch (error) {
            console.error('[IntelligentMemoryClassifier] ❌ 建议改进失败:', error);
            return [];
        }
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            settings: this.settings,
            engines: Object.keys(this.classificationEngines),
            models: Object.keys(this.classificationModels),
            stats: this.classificationStats,
            isTraining: this.isTraining,
            isClassifying: this.isClassifying,
            errorCount: this.errorCount
        };
    }
}
