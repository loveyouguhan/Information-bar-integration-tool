/**
 * 📚 NovelChunkAnalyzer - 小说分块智能分析器
 * 
 * 功能：
 * 1. 智能分章检测
 * 2. 逐章AI分析（提取角色、时间线、世界观、剧情事件）
 * 3. 全局上下文累积
 * 4. 生成富metadata的向量块
 * 
 * 解决问题：
 * - 角色提前出现 → spoilerLevel控制
 * - 时间线模糊 → timeline metadata
 * - 角色关系不明 → relationships metadata
 * - 世界观不明确 → worldBuilding metadata
 */

export class NovelChunkAnalyzer {
    constructor(dependencies = {}) {
        this.aiAnalyzer = dependencies.aiAnalyzer;
        this.maxChunkSize = 2000;  // 每块最大字符数
        this.overlapSize = 200;    // 重叠部分

        // 🔧 新增：NovelAnalyzer实例（用于AI分析）
        this.novelAnalyzer = null;
        this._initPromise = null;  // 初始化Promise
        this._initialized = false;  // 初始化标志

        // 全局上下文
        this.globalContext = {
            novelId: null,
            characters: new Map(),      // 角色档案
            worldBuilding: {
                locations: new Map(),
                factions: new Map(),
                items: new Map(),
                cultivationSystem: {
                    realms: [],
                    techniques: []
                }
            },
            timeline: [],               // 时间线
            plotTime: 0                 // 剧情时间累计（天数）
        };

        console.log('[NovelChunkAnalyzer] 📚 小说分块分析器已初始化');

        // 🔧 修复：保存初始化Promise，供后续等待
        this._initPromise = this.init();
    }

    /**
     * 初始化
     */
    async init() {
        if (this._initialized) {
            return;
        }

        try {
            // 动态导入NovelAnalyzer（使用相对路径）
            const { NovelAnalyzer } = await import('./NovelAnalyzer.js');
            this.novelAnalyzer = new NovelAnalyzer();
            this._initialized = true;
            console.log('[NovelChunkAnalyzer] ✅ NovelAnalyzer已加载');
        } catch (error) {
            console.warn('[NovelChunkAnalyzer] ⚠️ NovelAnalyzer加载失败，将使用基础分析:', error);
            this._initialized = true;  // 标记为已初始化，即使失败
        }
    }

    /**
     * 🔧 新增：确保初始化完成
     */
    async ensureInitialized() {
        if (this._initPromise) {
            await this._initPromise;
        }
    }
    
    /**
     * 分析整本小说
     */
    async analyzeNovel(novelText, novelId, options = {}, progressCallback) {
        try {
            console.log('[NovelChunkAnalyzer] 🚀 开始分析小说...');

            // 🔧 修复：确保初始化完成
            await this.ensureInitialized();

            this.globalContext.novelId = novelId;
            
            // 1. 智能分章
            progressCallback?.(5, '📖 正在智能分章...', '检测章节结构');
            const chapters = this.splitIntoChapters(novelText);
            console.log(`[NovelChunkAnalyzer] 📚 检测到 ${chapters.length} 章`);
            
            // 2. 批量分析章节（优化API调用）
            const allChunks = [];

            if (options.enableSmartAnalysis) {
                // 🔧 批量处理：将章节分组，每组不超过20000字符（确保API稳定性）
                const batchSize = 20000;  // 🔧 修复：降低到20000字符，避免API超时和错误
                const chapterBatches = this.groupChaptersBySize(chapters, batchSize);

                console.log(`[NovelChunkAnalyzer] 📦 将 ${chapters.length} 章分为 ${chapterBatches.length} 批处理`);

                for (let batchIndex = 0; batchIndex < chapterBatches.length; batchIndex++) {
                    const batch = chapterBatches[batchIndex];

                    progressCallback?.(
                        10 + (batchIndex / chapterBatches.length) * 40,
                        `🧠 正在分析第 ${batchIndex + 1}/${chapterBatches.length} 批章节...`,
                        `包含 ${batch.length} 章`
                    );

                    // 批量AI分析
                    const batchAnalyses = await this.analyzeBatchChapters(batch);

                    // 为每章生成chunks
                    for (let i = 0; i < batch.length; i++) {
                        const chapter = batch[i];
                        const analysis = batchAnalyses[i];
                        const chunks = this.chunkChapter(chapter, chapter.index, analysis);
                        allChunks.push(...chunks);
                    }
                }
            } else {
                // 不启用AI分析，只做基础分块
                for (let i = 0; i < chapters.length; i++) {
                    const chapter = chapters[i];

                    progressCallback?.(
                        10 + (i / chapters.length) * 40,
                        `✂️ 正在分块第 ${i + 1}/${chapters.length} 章...`,
                        chapter.title
                    );

                    const chunks = this.chunkChapterBasic(chapter, i);
                    allChunks.push(...chunks);
                }
            }
            
            console.log(`[NovelChunkAnalyzer] ✅ 分析完成，生成 ${allChunks.length} 个向量块`);
            return allChunks;
            
        } catch (error) {
            console.error('[NovelChunkAnalyzer] ❌ 分析失败:', error);
            throw error;
        }
    }
    
    /**
     * 🔧 新增：将章节按大小分组，确保每组不超过maxSize字符
     * 🔧 修复：默认值改为20000，确保API稳定性
     */
    groupChaptersBySize(chapters, maxSize = 20000) {
        const batches = [];
        let currentBatch = [];
        let currentSize = 0;

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            chapter.index = i;  // 保存原始索引
            const chapterSize = chapter.title.length + chapter.text.length;  // 🔧 修复：使用text而不是content

            // 如果单章就超过maxSize，单独成批
            if (chapterSize > maxSize) {
                if (currentBatch.length > 0) {
                    batches.push(currentBatch);
                    currentBatch = [];
                    currentSize = 0;
                }
                batches.push([chapter]);
                continue;
            }

            // 如果加入当前章节会超过maxSize，先保存当前批次
            if (currentSize + chapterSize > maxSize && currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch = [];
                currentSize = 0;
            }

            currentBatch.push(chapter);
            currentSize += chapterSize;
        }

        // 保存最后一批
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        return batches;
    }

    /**
     * 🔧 新增：批量分析多个章节（一次API调用）
     */
    async analyzeBatchChapters(chapters) {
        if (!this.novelAnalyzer) {
            console.warn('[NovelChunkAnalyzer] ⚠️ NovelAnalyzer未加载，使用基础分析');
            return chapters.map((chapter, i) => this.basicChapterAnalysis(chapter, i));
        }

        try {
            // 构建批量分析提示词
            const prompt = this.buildBatchAnalysisPrompt(chapters);

            console.log(`[NovelChunkAnalyzer] 🔄 批量分析 ${chapters.length} 章...`);
            console.log(`[NovelChunkAnalyzer] 📊 提示词长度: ${prompt.length} 字符`);

            // 调用AI分析
            const aiResponse = await this.novelAnalyzer.callAI(prompt);

            // 解析批量分析结果
            const analyses = this.parseBatchAnalysis(aiResponse, chapters.length);

            // 更新全局上下文
            for (let i = 0; i < analyses.length; i++) {
                this.updateGlobalContext(analyses[i], chapters[i].index);
            }

            console.log(`[NovelChunkAnalyzer] ✅ 批量分析完成`);
            return analyses;

        } catch (error) {
            console.error(`[NovelChunkAnalyzer] ❌ 批量分析失败:`, error);
            // 降级到基础分析
            return chapters.map((chapter, i) => this.basicChapterAnalysis(chapter, i));
        }
    }

    /**
     * 智能分章
     */
    splitIntoChapters(text) {
        const chapters = [];
        
        // 常见的章节标题模式
        const chapterPatterns = [
            /^第[零一二三四五六七八九十百千万\d]+章[：:\s]/gm,
            /^第[零一二三四五六七八九十百千万\d]+节[：:\s]/gm,
            /^Chapter\s+\d+/gmi,
            /^\d+\.\s/gm
        ];
        
        let matches = [];
        for (const pattern of chapterPatterns) {
            const found = [...text.matchAll(pattern)];
            if (found.length > 0) {
                matches = found;
                break;
            }
        }
        
        if (matches.length === 0) {
            // 没有检测到章节，按固定长度分割
            console.log('[NovelChunkAnalyzer] ⚠️ 未检测到章节标题，按固定长度分割');
            const chapterSize = 5000;
            for (let i = 0; i < text.length; i += chapterSize) {
                chapters.push({
                    index: chapters.length,
                    title: `第${chapters.length + 1}部分`,
                    text: text.substring(i, i + chapterSize),
                    startPos: i,
                    endPos: Math.min(i + chapterSize, text.length)
                });
            }
        } else {
            // 按检测到的章节分割
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const startPos = match.index;
                const endPos = i < matches.length - 1 ? matches[i + 1].index : text.length;
                
                chapters.push({
                    index: i,
                    title: match[0].trim(),
                    text: text.substring(startPos, endPos),
                    startPos: startPos,
                    endPos: endPos
                });
            }
        }
        
        return chapters;
    }
    
    /**
     * AI分析单个章节
     */
    async analyzeChapter(chapter, chapterIndex) {
        try {
            console.log(`[NovelChunkAnalyzer] 🧠 分析章节 ${chapterIndex + 1}: ${chapter.title}`);

            // 如果NovelAnalyzer未加载，返回基础分析
            if (!this.novelAnalyzer) {
                console.warn('[NovelChunkAnalyzer] ⚠️ NovelAnalyzer未加载，使用基础分析');
                return this.basicChapterAnalysis(chapter, chapterIndex);
            }

            // 构建AI分析提示词
            const prompt = this.buildChapterAnalysisPrompt(chapter, chapterIndex);

            // 调用AI分析
            const aiResponse = await this.novelAnalyzer.callAI(prompt);

            // 解析AI响应
            const analysis = this.parseChapterAnalysis(aiResponse);

            // 更新全局上下文
            this.updateGlobalContext(analysis, chapterIndex);

            console.log(`[NovelChunkAnalyzer] ✅ 章节 ${chapterIndex + 1} 分析完成`);
            return analysis;

        } catch (error) {
            console.error(`[NovelChunkAnalyzer] ❌ 章节 ${chapterIndex + 1} 分析失败:`, error);
            // 降级到基础分析
            return this.basicChapterAnalysis(chapter, chapterIndex);
        }
    }

    /**
     * 🔧 新增：构建批量章节分析提示词
     */
    buildBatchAnalysisPrompt(chapters) {
        // 获取全局上下文摘要
        const knownCharacters = Array.from(this.globalContext.characters.keys()).slice(0, 20).join(', ');
        const knownLocations = Array.from(this.globalContext.worldBuilding.locations.keys()).slice(0, 10).join(', ');
        const knownFactions = Array.from(this.globalContext.worldBuilding.factions.keys()).slice(0, 10).join(', ');

        // 构建章节列表
        const chaptersText = chapters.map((chapter, i) => {
            return `【章节${i + 1}】
标题: ${chapter.title}
内容: ${chapter.text}
`;
        }).join('\n---\n\n');

        return `你是一个专业的小说分析助手。请批量分析以下 ${chapters.length} 个章节，为每个章节提取结构化信息。

【全局上下文】
- 起始章节: 第${chapters[0].index + 1}章
- 已知角色: ${knownCharacters || '无'}
- 已知地点: ${knownLocations || '无'}
- 已知势力: ${knownFactions || '无'}
- 当前剧情时间: 第${this.globalContext.plotTime}天

【章节内容】
${chaptersText}

【分析任务】
请以JSON数组格式返回分析结果，数组中每个元素对应一个章节的分析：

[
    {
        "chapterIndex": 0,
        "timeline": {
            "timeSpan": <本章时间跨度（天数）>,
            "description": "<时间描述>",
            "season": "<季节/时辰，无则null>"
        },
        "characters": {
            "new": [
                {
                    "name": "<角色名>",
                    "aliases": ["<别名>"],
                    "role": "<main/supporting/minor>",
                    "powerLevel": "<修为/实力等级>",
                    "location": "<首次出现位置>",
                    "description": "<简短描述>"
                }
            ],
            "existing": [
                {
                    "name": "<已有角色名>",
                    "powerLevel": "<当前修为>",
                    "location": "<当前位置>",
                    "emotionalState": "<情绪状态>"
                }
            ]
        },
        "relationships": [
            {
                "character1": "<角色1>",
                "character2": "<角色2>",
                "type": "<friend/enemy/family/master-disciple/lover等>",
                "sentiment": "<positive/negative/neutral>",
                "description": "<关系描述>"
            }
        ],
        "worldBuilding": {
            "locations": [{"name": "<地点名>", "type": "<类型>", "description": "<描述>"}],
            "factions": [{"name": "<势力名>", "type": "<类型>", "description": "<描述>"}],
            "items": [{"name": "<物品名>", "type": "<类型>", "description": "<描述>"}],
            "cultivationInfo": {
                "realms": ["<境界1>", "<境界2>"],
                "techniques": ["<功法1>", "<功法2>"]
            }
        },
        "events": [
            {
                "type": "<combat/cultivation/exploration/social/turning_point等>",
                "description": "<事件描述>",
                "importance": "<high/medium/low>",
                "participants": ["<参与角色1>", "<参与角色2>"]
            }
        ],
        "importance": <0.0-1.0之间的数值>
    }
]

【注意事项】
1. 必须返回 ${chapters.length} 个章节的分析结果
2. 每个分析结果的chapterIndex从0开始递增
3. 只提取明确出现的信息，不要推测
4. 严格按照JSON数组格式返回，不要添加额外说明
5. 确保JSON格式完整，不要截断

请开始分析：`;
    }

    /**
     * 🔧 新增：解析批量分析结果
     */
    parseBatchAnalysis(aiResponse, expectedCount) {
        try {
            console.log('[NovelChunkAnalyzer] 📥 开始解析批量分析结果');
            console.log('[NovelChunkAnalyzer] 📊 原始响应长度:', aiResponse.length);
            console.log('[NovelChunkAnalyzer] 📄 响应前500字符:', aiResponse.substring(0, 500));

            // 清理响应文本
            let jsonText = aiResponse.trim();

            // 移除markdown代码块标记
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.substring(7);
                console.log('[NovelChunkAnalyzer] 🔧 移除```json标记');
            }
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.substring(3);
                console.log('[NovelChunkAnalyzer] 🔧 移除```标记');
            }
            if (jsonText.endsWith('```')) {
                jsonText = jsonText.substring(0, jsonText.length - 3);
                console.log('[NovelChunkAnalyzer] 🔧 移除结尾```标记');
            }

            jsonText = jsonText.trim();

            console.log('[NovelChunkAnalyzer] 📊 清理后JSON长度:', jsonText.length);
            console.log('[NovelChunkAnalyzer] 📄 清理后前500字符:', jsonText.substring(0, 500));
            console.log('[NovelChunkAnalyzer] 📄 清理后后500字符:', jsonText.substring(Math.max(0, jsonText.length - 500)));

            // 🔧 检查JSON是否完整
            const openBrackets = (jsonText.match(/\[/g) || []).length;
            const closeBrackets = (jsonText.match(/\]/g) || []).length;
            const openBraces = (jsonText.match(/\{/g) || []).length;
            const closeBraces = (jsonText.match(/\}/g) || []).length;

            console.log('[NovelChunkAnalyzer] 🔍 JSON结构检查:', {
                openBrackets, closeBrackets,
                openBraces, closeBraces,
                bracketsMatch: openBrackets === closeBrackets,
                bracesMatch: openBraces === closeBraces
            });

            // 解析JSON数组
            const analyses = JSON.parse(jsonText);

            if (!Array.isArray(analyses)) {
                throw new Error('AI返回的不是数组格式');
            }

            if (analyses.length !== expectedCount) {
                console.warn(`[NovelChunkAnalyzer] ⚠️ 期望 ${expectedCount} 个分析结果，实际得到 ${analyses.length} 个`);
            }

            console.log(`[NovelChunkAnalyzer] ✅ 成功解析 ${analyses.length} 个章节分析`);
            return analyses;

        } catch (error) {
            console.error('[NovelChunkAnalyzer] ❌ 批量分析JSON解析失败:', error);
            console.error('[NovelChunkAnalyzer] 📄 AI响应长度:', aiResponse.length);
            console.error('[NovelChunkAnalyzer] 📄 AI响应前1000字符:', aiResponse.substring(0, 1000));
            console.error('[NovelChunkAnalyzer] 📄 AI响应后1000字符:', aiResponse.substring(Math.max(0, aiResponse.length - 1000)));

            // 返回空分析结果
            return Array(expectedCount).fill(null).map((_, i) => ({
                timeline: { timeSpan: 1, description: '未知', season: null },
                characters: { new: [], existing: [] },
                relationships: [],
                worldBuilding: { locations: [], factions: [], items: [], cultivationInfo: { realms: [], techniques: [] } },
                events: [],
                importance: 0.5
            }));
        }
    }

    /**
     * 构建章节分析提示词
     */
    buildChapterAnalysisPrompt(chapter, chapterIndex) {
        // 获取全局上下文摘要
        const knownCharacters = Array.from(this.globalContext.characters.keys()).slice(0, 20).join(', ');
        const knownLocations = Array.from(this.globalContext.worldBuilding.locations.keys()).slice(0, 10).join(', ');
        const knownFactions = Array.from(this.globalContext.worldBuilding.factions.keys()).slice(0, 10).join(', ');

        return `你是一个专业的小说分析助手。请分析以下章节，提取结构化信息。

【全局上下文】
- 当前章节: 第${chapterIndex + 1}章
- 已知角色: ${knownCharacters || '无'}
- 已知地点: ${knownLocations || '无'}
- 已知势力: ${knownFactions || '无'}
- 当前剧情时间: 第${this.globalContext.plotTime}天

【章节内容】
标题: ${chapter.title}
内容: ${chapter.text.substring(0, 8000)}${chapter.text.length > 8000 ? '...(内容过长，已截断)' : ''}

【分析任务】
请以JSON格式返回以下信息：

{
    "timeline": {
        "timeSpan": <本章时间跨度（天数）>,
        "description": "<时间描述，如'三天后'、'同一天'等>",
        "season": "<季节/时辰，如'春季'、'夜晚'等，无则null>"
    },
    "characters": {
        "new": [
            {
                "name": "<角色名>",
                "aliases": ["<别名1>", "<别名2>"],
                "role": "<main/supporting/minor>",
                "powerLevel": "<修为/实力等级>",
                "location": "<首次出现位置>",
                "description": "<简短描述>"
            }
        ],
        "existing": [
            {
                "name": "<已有角色名>",
                "powerLevel": "<当前修为>",
                "location": "<当前位置>",
                "emotionalState": "<情绪状态>"
            }
        ]
    },
    "relationships": [
        {
            "character1": "<角色1>",
            "character2": "<角色2>",
            "type": "<friend/enemy/family/master-disciple/lover等>",
            "sentiment": "<positive/negative/neutral>",
            "description": "<关系描述>"
        }
    ],
    "worldBuilding": {
        "locations": [
            {
                "name": "<地点名>",
                "type": "<city/mountain/sect/realm等>",
                "description": "<描述>"
            }
        ],
        "factions": [
            {
                "name": "<势力名>",
                "type": "<sect/clan/empire等>",
                "description": "<描述>"
            }
        ],
        "items": [
            {
                "name": "<物品名>",
                "type": "<weapon/pill/treasure等>",
                "description": "<描述>"
            }
        ],
        "cultivationInfo": {
            "realms": ["<境界1>", "<境界2>"],
            "techniques": ["<功法1>", "<功法2>"]
        }
    },
    "events": [
        {
            "type": "<combat/cultivation/exploration/social/turning_point等>",
            "description": "<事件描述>",
            "importance": "<high/medium/low>",
            "participants": ["<参与角色1>", "<参与角色2>"]
        }
    ],
    "importance": <0.0-1.0之间的数值，表示本章重要性>
}

【注意事项】
1. 只提取明确出现的信息，不要推测
2. 角色名使用最常用的称呼
3. 时间跨度尽量准确，无法确定则估算
4. 重要性评分：转折点/高潮=0.9+，重要剧情=0.7+，日常=0.3-0.5
5. 严格按照JSON格式返回，不要添加额外说明

请开始分析：`;
    }

    /**
     * 解析章节分析结果
     */
    parseChapterAnalysis(aiResponse) {
        try {
            // 尝试解析JSON
            const parsed = this.novelAnalyzer.parseJSONResponse(aiResponse);

            // 验证并填充默认值
            return {
                timeline: parsed.timeline || {
                    timeSpan: 1,
                    description: "时间推进",
                    season: null
                },
                characters: parsed.characters || {
                    new: [],
                    existing: []
                },
                relationships: parsed.relationships || [],
                worldBuilding: parsed.worldBuilding || {
                    locations: [],
                    factions: [],
                    items: [],
                    cultivationInfo: {}
                },
                events: parsed.events || [],
                importance: parsed.importance || 0.5
            };
        } catch (error) {
            console.error('[NovelChunkAnalyzer] ❌ 解析AI响应失败:', error);
            return this.basicChapterAnalysis(null, 0).analysis;
        }
    }

    /**
     * 更新全局上下文
     */
    updateGlobalContext(analysis, chapterIndex) {
        try {
            // 更新剧情时间
            this.globalContext.plotTime += analysis.timeline.timeSpan || 0;

            // 添加新角色
            for (const char of analysis.characters.new || []) {
                if (!this.globalContext.characters.has(char.name)) {
                    this.globalContext.characters.set(char.name, {
                        ...char,
                        firstAppearance: chapterIndex,
                        developmentArc: [{
                            chapterRange: [chapterIndex, chapterIndex],
                            powerLevel: char.powerLevel,
                            location: char.location,
                            emotionalState: char.emotionalState || 'unknown'
                        }]
                    });
                }
            }

            // 更新已有角色
            for (const char of analysis.characters.existing || []) {
                if (this.globalContext.characters.has(char.name)) {
                    const profile = this.globalContext.characters.get(char.name);
                    profile.developmentArc.push({
                        chapterRange: [chapterIndex, chapterIndex],
                        powerLevel: char.powerLevel,
                        location: char.location,
                        emotionalState: char.emotionalState || 'unknown'
                    });
                }
            }

            // 更新世界观
            for (const loc of analysis.worldBuilding.locations || []) {
                if (!this.globalContext.worldBuilding.locations.has(loc.name)) {
                    this.globalContext.worldBuilding.locations.set(loc.name, {
                        ...loc,
                        firstMention: chapterIndex
                    });
                }
            }

            for (const faction of analysis.worldBuilding.factions || []) {
                if (!this.globalContext.worldBuilding.factions.has(faction.name)) {
                    this.globalContext.worldBuilding.factions.set(faction.name, {
                        ...faction,
                        firstMention: chapterIndex
                    });
                }
            }

            for (const item of analysis.worldBuilding.items || []) {
                if (!this.globalContext.worldBuilding.items.has(item.name)) {
                    this.globalContext.worldBuilding.items.set(item.name, {
                        ...item,
                        firstMention: chapterIndex
                    });
                }
            }

            // 更新修炼体系
            if (analysis.worldBuilding.cultivationInfo) {
                const realms = analysis.worldBuilding.cultivationInfo.realms || [];
                const techniques = analysis.worldBuilding.cultivationInfo.techniques || [];

                for (const realm of realms) {
                    if (!this.globalContext.worldBuilding.cultivationSystem.realms.includes(realm)) {
                        this.globalContext.worldBuilding.cultivationSystem.realms.push(realm);
                    }
                }

                for (const technique of techniques) {
                    if (!this.globalContext.worldBuilding.cultivationSystem.techniques.includes(technique)) {
                        this.globalContext.worldBuilding.cultivationSystem.techniques.push(technique);
                    }
                }
            }

            // 添加时间线事件
            for (const event of analysis.events || []) {
                this.globalContext.timeline.push({
                    chapterIndex: chapterIndex,
                    plotTime: this.globalContext.plotTime,
                    ...event
                });
            }

            console.log('[NovelChunkAnalyzer] ✅ 全局上下文已更新');
        } catch (error) {
            console.error('[NovelChunkAnalyzer] ❌ 更新全局上下文失败:', error);
        }
    }

    /**
     * 基础章节分析（降级方案）
     */
    basicChapterAnalysis(chapter, chapterIndex) {
        return {
            timeline: {
                timeSpan: 1,
                description: "时间推进",
                season: null
            },
            characters: {
                new: [],
                existing: []
            },
            relationships: [],
            worldBuilding: {
                locations: [],
                factions: [],
                items: [],
                cultivationInfo: {}
            },
            events: [],
            importance: 0.5
        };
    }
    
    /**
     * 分块章节（带AI分析metadata）
     */
    chunkChapter(chapter, chapterIndex, chapterAnalysis) {
        const chunks = [];
        const text = chapter.text;
        
        for (let i = 0; i < text.length; i += this.maxChunkSize - this.overlapSize) {
            const chunkText = text.substring(i, Math.min(i + this.maxChunkSize, text.length));
            
            // 生成富metadata
            const metadata = {
                // 基础信息
                novelId: this.globalContext.novelId,
                chapterIndex: chapterIndex,
                chapterTitle: chapter.title,
                chunkIndex: Math.floor(i / (this.maxChunkSize - this.overlapSize)),
                
                // 时间线信息
                timeline: {
                    plotTime: this.globalContext.plotTime,
                    timeDescription: chapterAnalysis.timeline.description,
                    season: chapterAnalysis.timeline.season
                },
                
                // 剧透等级（关键！用于时间线控制）
                spoilerLevel: chapterIndex,
                
                // 重要性
                importance: chapterAnalysis.importance,
                
                // 情节类型
                plotType: this.detectPlotType(chunkText),
                
                // 角色信息（简化版）
                characters: [],
                
                // 世界观信息（简化版）
                worldBuilding: {
                    locations: [],
                    factions: [],
                    items: []
                },
                
                // 事件
                events: []
            };
            
            chunks.push({
                text: chunkText,
                metadata: metadata
            });
        }
        
        // 更新全局时间线
        this.globalContext.plotTime += chapterAnalysis.timeline.timeSpan || 0;
        
        return chunks;
    }
    
    /**
     * 基础分块（不使用AI分析）
     */
    chunkChapterBasic(chapter, chapterIndex) {
        const chunks = [];
        const text = chapter.text;
        
        for (let i = 0; i < text.length; i += this.maxChunkSize - this.overlapSize) {
            const chunkText = text.substring(i, Math.min(i + this.maxChunkSize, text.length));
            
            // 基础metadata
            const metadata = {
                novelId: this.globalContext.novelId,
                chapterIndex: chapterIndex,
                chapterTitle: chapter.title,
                chunkIndex: Math.floor(i / (this.maxChunkSize - this.overlapSize)),
                spoilerLevel: chapterIndex,  // 关键：用于时间线控制
                importance: 0.5
            };
            
            chunks.push({
                text: chunkText,
                metadata: metadata
            });
        }
        
        return chunks;
    }
    
    /**
     * 检测情节类型
     */
    detectPlotType(text) {
        // 简单的关键词检测
        if (/战斗|打斗|厮杀|攻击|防御/.test(text)) {
            return 'combat';
        }
        if (/修炼|突破|境界|功法/.test(text)) {
            return 'cultivation';
        }
        if (/探索|发现|寻找/.test(text)) {
            return 'exploration';
        }
        return 'social';
    }
}

