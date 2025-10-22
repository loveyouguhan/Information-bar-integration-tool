/**
 * 📚 NovelAnalyzer - 小说智能分析模块
 * 
 * 功能：
 * - 剧情梗概提取
 * - 文风特征分析
 * - 时间线提取
 * - 关键场景标记
 * - 角色信息提取
 */

export class NovelAnalyzer {
    constructor(dependencies = {}) {
        // 依赖注入
        this.customAPI = dependencies.customAPI || window.SillyTavernInfobar?.modules?.customAPIManager;
        this.eventSource = dependencies.eventSource || window.SillyTavernInfobar?.eventSource;
        
        // 初始化状态
        this.initialized = false;
        this.analyzing = false;
        
        console.log('[NovelAnalyzer] 📚 小说分析模块初始化');
        this.init();
    }

    async init() {
        try {
            this.initialized = true;
            console.log('[NovelAnalyzer] ✅ 小说分析模块初始化完成');
        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 初始化失败:', error);
        }
    }

    /**
     * 🔍 分析小说内容
     * @param {string} content - 小说文本内容
     * @param {Object} options - 分析选项
     * @returns {Object} 分析结果
     */
    async analyzeNovel(content, options = {}) {
        try {
            console.log('[NovelAnalyzer] 🔍 开始分析小说内容...');
            console.log('[NovelAnalyzer] 📊 内容长度:', content.length, '字符');
            console.log('[NovelAnalyzer] ⚙️ 分析选项:', options);

            this.analyzing = true;
            const results = {};

            // 1. 提取剧情梗概
            if (options.extractPlotSummary) {
                console.log('[NovelAnalyzer] 📖 提取剧情梗概...');
                results.plotSummary = await this.extractPlotSummary(content);
            }

            // 2. 分析文风特征
            if (options.analyzeWritingStyle) {
                console.log('[NovelAnalyzer] ✍️ 分析文风特征...');
                results.writingStyle = await this.analyzeWritingStyle(content);
            }

            // 3. 提取时间线
            if (options.extractTimeline) {
                console.log('[NovelAnalyzer] ⏰ 提取时间线...');
                results.timeline = await this.extractTimeline(content);
            }

            // 4. 标记关键场景
            if (options.markKeyScenes) {
                console.log('[NovelAnalyzer] 🎬 标记关键场景...');
                results.keyScenes = await this.markKeyScenes(content);
            }

            // 5. 提取角色信息
            if (options.extractCharacters) {
                console.log('[NovelAnalyzer] 👥 提取角色信息...');
                results.characters = await this.extractCharacters(content);
            }

            this.analyzing = false;
            console.log('[NovelAnalyzer] ✅ 分析完成');
            return results;

        } catch (error) {
            this.analyzing = false;
            console.error('[NovelAnalyzer] ❌ 分析失败:', error);
            throw error;
        }
    }

    /**
     * 📖 提取剧情梗概
     */
    async extractPlotSummary(content) {
        try {
            // 使用AI生成剧情梗概
            const prompt = `请分析以下小说内容，提取剧情梗概。要求：
1. 概括主要情节和故事线
2. 提取核心冲突和转折点
3. 总结故事的开端、发展、高潮和结局
4. 保持简洁，不超过500字

小说内容：
${content.substring(0, 10000)}${content.length > 10000 ? '...(内容过长，已截断)' : ''}

请以JSON格式返回：
{
    "summary": "整体梗概",
    "mainPlot": "主要情节",
    "conflicts": ["冲突1", "冲突2"],
    "turningPoints": ["转折点1", "转折点2"],
    "structure": {
        "beginning": "开端",
        "development": "发展",
        "climax": "高潮",
        "ending": "结局"
    }
}`;

            const result = await this.callAI(prompt);
            return this.parseJSONResponse(result);

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 提取剧情梗概失败:', error);
            return {
                summary: '分析失败',
                mainPlot: '',
                conflicts: [],
                turningPoints: [],
                structure: {}
            };
        }
    }

    /**
     * ✍️ 分析文风特征
     */
    async analyzeWritingStyle(content) {
        try {
            const prompt = `请分析以下小说的写作风格和文风特征。要求：
1. 分析叙事视角（第一人称/第三人称等）
2. 识别语言风格（简洁/华丽/口语化等）
3. 提取常用词汇和表达方式
4. 分析句式特点
5. 识别修辞手法

小说内容：
${content.substring(0, 10000)}${content.length > 10000 ? '...(内容过长，已截断)' : ''}

请以JSON格式返回：
{
    "perspective": "叙事视角",
    "languageStyle": "语言风格",
    "commonPhrases": ["常用词汇1", "常用词汇2"],
    "sentencePatterns": ["句式特点1", "句式特点2"],
    "rhetoricalDevices": ["修辞手法1", "修辞手法2"],
    "tone": "整体基调",
    "characteristics": ["特征1", "特征2"]
}`;

            const result = await this.callAI(prompt);
            return this.parseJSONResponse(result);

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 分析文风特征失败:', error);
            return {
                perspective: '未知',
                languageStyle: '未知',
                commonPhrases: [],
                sentencePatterns: [],
                rhetoricalDevices: [],
                tone: '未知',
                characteristics: []
            };
        }
    }

    /**
     * ⏰ 提取时间线
     */
    async extractTimeline(content) {
        try {
            const prompt = `请分析以下小说内容，提取时间线和事件顺序。要求：
1. 识别时间标记（日期、时间、季节等）
2. 整理事件发生的先后顺序
3. 标注重要时间节点
4. 识别时间跨度

小说内容：
${content.substring(0, 10000)}${content.length > 10000 ? '...(内容过长，已截断)' : ''}

请以JSON格式返回：
{
    "timeSpan": "时间跨度",
    "events": [
        {
            "time": "时间点",
            "event": "事件描述",
            "importance": "high/medium/low"
        }
    ],
    "timeMarkers": ["时间标记1", "时间标记2"]
}`;

            const result = await this.callAI(prompt);
            return this.parseJSONResponse(result);

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 提取时间线失败:', error);
            return {
                timeSpan: '未知',
                events: [],
                timeMarkers: []
            };
        }
    }

    /**
     * 🎬 标记关键场景
     */
    async markKeyScenes(content) {
        try {
            const prompt = `请分析以下小说内容，标记关键场景和重要情节。要求：
1. 识别重要的剧情转折点
2. 标记高潮场景
3. 识别情感强烈的场景
4. 提取场景的位置和描述

小说内容：
${content.substring(0, 10000)}${content.length > 10000 ? '...(内容过长，已截断)' : ''}

请以JSON格式返回：
{
    "scenes": [
        {
            "type": "climax/turning_point/emotional",
            "description": "场景描述",
            "location": "场景位置",
            "characters": ["角色1", "角色2"],
            "importance": "high/medium/low"
        }
    ]
}`;

            const result = await this.callAI(prompt);
            return this.parseJSONResponse(result);

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 标记关键场景失败:', error);
            return {
                scenes: []
            };
        }
    }

    /**
     * 👥 提取角色信息
     */
    async extractCharacters(content) {
        try {
            const prompt = `请分析以下小说内容，提取角色信息。要求：
1. 识别主要角色和次要角色
2. 提取角色特征和性格
3. 分析角色关系
4. 识别角色发展弧线

小说内容：
${content.substring(0, 10000)}${content.length > 10000 ? '...(内容过长，已截断)' : ''}

请以JSON格式返回：
{
    "characters": [
        {
            "name": "角色名",
            "role": "main/supporting",
            "traits": ["特征1", "特征2"],
            "personality": "性格描述",
            "relationships": [
                {
                    "with": "其他角色",
                    "type": "关系类型"
                }
            ],
            "development": "角色发展"
        }
    ]
}`;

            const result = await this.callAI(prompt);
            return this.parseJSONResponse(result);

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ 提取角色信息失败:', error);
            return {
                characters: []
            };
        }
    }

    /**
     * 🤖 调用AI进行分析
     */
    async callAI(prompt) {
        try {
            // 🔧 修复：从通用API配置读取
            const context = SillyTavern.getContext();
            const extCfg = context?.extensionSettings?.['Information bar integration tool'] || {};

            // 读取通用API配置
            const apiConfig = extCfg.apiConfig || {};

            // 🔧 修复：支持baseUrl和endpoint两种配置方式
            const baseUrl = apiConfig.baseUrl || apiConfig.endpoint;

            console.log('[NovelAnalyzer] 📊 API配置:', {
                hasBaseUrl: !!baseUrl,
                hasApiKey: !!apiConfig.apiKey,
                hasModel: !!apiConfig.model,
                provider: apiConfig.provider,
                enabled: apiConfig.enabled
            });

            // 🔧 修复：检查baseUrl而不是endpoint，且不强制要求enabled为true
            if (!baseUrl) {
                throw new Error('未配置自定义API，请在"自定义API"面板中配置通用API的基础URL');
            }

            if (!apiConfig.apiKey) {
                throw new Error('未配置API密钥，请在"自定义API"面板中配置API Key');
            }

            if (!apiConfig.model) {
                throw new Error('未配置模型，请在"自定义API"面板中配置模型名称');
            }

            // 🔧 修复：根据provider类型决定是否使用SillyTavern代理
            let endpoint;
            let headers;
            let requestBody;

            if (apiConfig.provider === 'localproxy') {
                // 🔧 使用SillyTavern后端代理，避免CORS问题
                endpoint = '/api/backends/chat-completions/generate';

                // 🔧 修复：使用context.getRequestHeaders()获取正确的请求头（包含CSRF Token）
                headers = context.getRequestHeaders();

                // 🔧 构建SillyTavern后端代理的请求体格式
                requestBody = {
                    messages: [{ role: 'user', content: prompt }],
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    temperature: 0.7,
                    frequency_penalty: 0,
                    presence_penalty: 0.12,
                    top_p: 1.0,
                    max_tokens: 2000,
                    stream: false,
                    chat_completion_source: "openai",
                    group_names: [],
                    include_reasoning: false,
                    reasoning_effort: "medium",
                    enable_web_search: false,
                    request_images: false,
                    custom_prompt_post_processing: "strict",
                    reverse_proxy: baseUrl,
                    proxy_password: apiConfig.apiKey
                };

                console.log('[NovelAnalyzer] 🔧 使用SillyTavern后端代理');
            } else {
                // 🔧 直接调用外部API
                endpoint = baseUrl;

                // 🔧 修复：智能检测并添加正确的端点路径
                if (!endpoint.endsWith('/chat/completions')) {
                    // 检查是否已经包含/v1
                    const hasV1 = endpoint.includes('/v1');

                    if (hasV1) {
                        // 如果已经包含/v1，只添加/chat/completions
                        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
                    } else {
                        // 如果不包含/v1，根据provider类型决定
                        if (apiConfig.provider === 'openai' || apiConfig.provider === 'custom') {
                            endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
                        } else {
                            endpoint = endpoint.replace(/\/$/, '') + '/v1/chat/completions';
                        }
                    }
                }

                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey || ''}`
                };

                // 🔧 标准OpenAI格式的请求体
                requestBody = {
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                };

                console.log('[NovelAnalyzer] 🔧 使用外部API端点:', endpoint);
            }

            // 调用API
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[NovelAnalyzer] ❌ API响应错误:', errorText);
                throw new Error(`API调用失败: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // 🔧 修复：处理不同的响应格式
            let content = '';

            if (apiConfig.provider === 'localproxy') {
                // SillyTavern后端代理的响应格式
                // 可能的格式：{ choices: [...] } 或 { error: true, response: "..." }
                if (data.error) {
                    console.error('[NovelAnalyzer] ❌ SillyTavern后端代理返回错误:', data.response || data.status);
                    throw new Error(`SillyTavern后端代理错误: ${data.response || data.status}`);
                }

                // 尝试从不同的字段中提取内容
                content = data.choices?.[0]?.message?.content ||
                         data.choices?.[0]?.text ||
                         data.response ||
                         '';
            } else {
                // 标准OpenAI格式的响应
                content = data.choices?.[0]?.message?.content || '';
            }

            console.log('[NovelAnalyzer] ✅ AI响应成功');
            console.log('[NovelAnalyzer] 📊 响应内容长度:', content.length);

            return content;

        } catch (error) {
            console.error('[NovelAnalyzer] ❌ AI调用失败:', error);
            throw error;
        }
    }

    /**
     * 📝 解析JSON响应
     */
    parseJSONResponse(text) {
        try {
            // 尝试提取JSON内容
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch (error) {
            console.error('[NovelAnalyzer] ❌ JSON解析失败:', error);
            return {};
        }
    }
}

