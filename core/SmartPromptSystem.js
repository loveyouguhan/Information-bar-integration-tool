/**
 * 智能提示词系统
 * 
 * 负责智能提示词的生成、注入和数据解析：
 * - 动态面板识别和提示词生成
 * - API提示词注入
 * - AI返回数据解析
 * - 增量/全量更新策略
 * 
 * @class SmartPromptSystem
 */

export class SmartPromptSystem {
    constructor(configManager, eventSystem, dataCore, fieldRuleManager = null) {
        console.log('[SmartPromptSystem] 🚀 智能提示词系统初始化开始');

        this.configManager = configManager;
        this.eventSystem = eventSystem;
        this.dataCore = dataCore;
        this.fieldRuleManager = fieldRuleManager;
        
        // SillyTavern上下文
        this.context = null;
        
        // 提示词模板
        this.promptTemplate = null;
        
        // 数据解析器
        this.dataParser = null;
        
        // API注入状态
        this.injectionActive = false;
        this.lastInjectionTime = 0;
        
        // 更新策略
        this.updateStrategy = 'incremental'; // 'incremental' | 'full'
        this.lastDataSnapshot = null;
        
        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;
        
        console.log('[SmartPromptSystem] 🏗️ 构造函数完成');
    }

    /**
     * 初始化智能提示词系统
     */
    async init() {
        try {
            console.log('[SmartPromptSystem] 📊 开始初始化智能提示词系统...');
            
            // 获取SillyTavern上下文
            this.context = SillyTavern.getContext();
            
            if (!this.context) {
                throw new Error('无法获取SillyTavern上下文');
            }
            
            // 初始化提示词模板
            await this.initPromptTemplate();
            
            // 初始化数据解析器
            await this.initDataParser();
            
            // 注册API注入钩子
            await this.registerAPIInjection();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            this.initialized = true;
            console.log('[SmartPromptSystem] ✅ 智能提示词系统初始化完成');
            
            // 触发初始化完成事件
            if (this.eventSystem) {
                this.eventSystem.emit('smart-prompt:initialized', {
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 初始化失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 初始化提示词模板
     */
    async initPromptTemplate() {
        console.log('[SmartPromptSystem] 📝 初始化提示词模板...');
        
        // 从提示词文件读取模板
        try {
            const response = await fetch('./scripts/extensions/third-party/Information bar integration tool/提示词');
            if (response.ok) {
                this.promptTemplate = await response.text();
                console.log('[SmartPromptSystem] ✅ 提示词模板加载成功');
            } else {
                throw new Error('无法加载提示词文件');
            }
        } catch (error) {
            console.warn('[SmartPromptSystem] ⚠️ 使用内置提示词模板:', error);
            this.promptTemplate = this.getDefaultPromptTemplate();
        }
    }

    /**
     * 获取默认提示词模板
     */
    getDefaultPromptTemplate() {
        return `🚨【信息栏数据格式规范】🚨

📋 数据格式要求：
在正常的角色扮演和剧情发展之外，请同时提供结构化的信息栏数据：

🚨 **严格输出顺序要求** 🚨
**必须按照以下顺序输出，严禁颠倒：**
1. **先输出** <aiThinkProcess><!--五步分析思考--></aiThinkProcess>
2. **再输出** <infobar_data><!--完整面板数据--></infobar_data>

🚨 **强制注释包裹要求** 🚨
**所有内容必须被注释符号包裹：**
- ✅ 正确格式：<aiThinkProcess><!--内容在这里--></aiThinkProcess>
- ✅ 正确格式：<infobar_data><!--内容在这里--></infobar_data>
- ❌ 错误格式：<aiThinkProcess>内容在这里</aiThinkProcess>（缺少注释符号）
- ❌ 错误格式：<!--内容在这里--><aiThinkProcess></aiThinkProcess>（注释符号位置错误）

⚠️ **严禁先生成infobar_data再生成aiThinkProcess**
⚠️ **严禁内容不被注释符号包裹**
⚠️ 这些标签用于数据解析，不会影响你的正常创作

📋 规则2: XML紧凑格式规范
<infobar_data>内容必须使用XML紧凑格式，示例：
✅ 正确格式：personal: name="张三", age="25", occupation="程序员"
✅ 正确格式：world: name="现代都市", type="都市", time="2024年"
✅ 正确格式：tasks: creation="新任务创建", editing="任务编辑中"
❌ 错误格式：<personal><name>张三</name><age>25</age></personal>
❌ 错误格式：{"personal": {"name": "张三", "age": "25"}}

📋 数据范围约束：
只为已启用的面板生成数据：
✅ 只能生成下方模板中列出的已启用面板数据
❌ 不要生成未在模板中出现的面板数据
❌ 不要添加、创建或推测新的面板类型

【🎭 角色识别核心规则】
在生成面板数据时，必须严格区分以下两个角色身份：

🙋 个人信息面板 = 用户角色(User)
- 指代：对话中的用户本人，即玩家操纵的主角
- 人称识别：
  * 第一人称："我"、"我的" = 用户角色
  * 第二人称："你"、"你的" = 当AI对用户说话时，指用户角色
  * 第三人称：明确提到的用户角色名称
- 数据来源：用户的行为、状态、属性、经历

🎭 交互对象面板 = NPC角色
- 指代：与用户交互的其他角色，包括对话中的NPC、敌人、伙伴等
- 人称识别：
  * 第一人称：当NPC自称时的"我" = NPC角色  
  * 第二人称：当用户对NPC说"你"时 = NPC角色
  * 第三人称：明确提到的NPC名称或称谓
- 数据来源：NPC的行为、状态、属性、关系

⚠️ 关键识别要点：
- 在对话中，要根据语境判断"我"和"你"具体指代谁
- 用户设置的User信息 ≠ 交互对象NPC信息
- 个人信息面板只记录用户角色的信息
- 交互对象面板只记录NPC角色的信息
- 绝不能将NPC信息错误地填入个人信息面板
- 绝不能将用户信息错误地填入交互对象面板

【数据面板要求】
您需要为所有启用的面板生成完整数据。以下指引说明每个面板的数据要求：
✓ 所有启用面板都必须生成对应数据
✓ 每个字段都应填充具体内容，避免空值占位符
✓ 基于剧情合理推断未明确提及的信息
✓ 保持数据逻辑一致性和连续性
✓ 严格区分用户角色和NPC角色的数据归属

⚠️ 【字段使用指南】⚠️
⚠️ 请只使用下方模板中明确列出的字段，不要添加额外字段
⚠️ 请使用中文字段名，避免英文字段名（如items、newItem0.name等）
⚠️ 请避免使用"未知"、"N/A"、"待补全"等占位符
⚠️ 请使用模板中的确切字段名和中文显示名称
⚠️ 正确格式是将注释符号<!--和-->放在标签内部，而不是外部
⚠️ NPC数据格式请使用npc索引和紧凑格式：npc0.姓名="NPC1", npc0.关系="关系", npc0.态度="态度", npc0.情绪="情绪"

🚨 **必须严格按照以下顺序输出** 🚨

**第一步：先输出五步思考分析（内容必须被<!--和-->包裹）**
<aiThinkProcess>
<!--
[输出模式: {{OUTPUT_MODE}}]

五步分析过程：
0. 更新策略:全量/增量更新
1. 剧情分析：当前发生什么事件？角色在哪里？在做什么？
2. 数据变化识别：哪些信息发生了变化？哪些是新信息？
3. 更新策略判断：需要新增哪些字段？需要更新哪些字段？哪些保持不变？
4. 数据完整性检查：确保所有启用面板都有完整数据
5. 质量验证：确认数据逻辑一致性和合理性
-->
</aiThinkProcess>

**第二步：再输出面板数据（内容必须被<!--和-->包裹，必须严格遵循上述五步思考的分析结果）**
<infobar_data>
<!--
{PANEL_DATA_TEMPLATE}
-->
</infobar_data>

**⚠️ 严禁使用以下错误格式：**
<aiThinkProcess>
五步分析过程：（内容没有被注释符号包裹）
0. 更新策略:全量更新
1. 剧情分析：...
</aiThinkProcess>

<infobar_data>
personal: name="张三"（内容没有被注释符号包裹）
world: name="现代都市"
</infobar_data>

🚨【重要提醒】🚨

请在正常的角色扮演和剧情发展之后，**严格按照以下顺序**添加数据标签：

**🚨 强制输出顺序 🚨**
1. **第一步：必须先输出** <aiThinkProcess><!--五步分析思考--></aiThinkProcess>
2. **第二步：必须后输出** <infobar_data><!--完整面板数据--></infobar_data>

**🚨 强制注释包裹格式 🚨**
- ✅ **正确格式**：<aiThinkProcess><!--内容必须在注释符号内--></aiThinkProcess>
- ✅ **正确格式**：<infobar_data><!--内容必须在注释符号内--></infobar_data>
- ❌ **错误格式**：<aiThinkProcess>内容直接写在这里</aiThinkProcess>
- ❌ **错误格式**：<infobar_data>内容直接写在这里</infobar_data>

**⚠️ 严禁颠倒顺序！严禁先输出infobar_data！**
**⚠️ 严禁内容不被<!--和-->包裹！**
位置：建议放在回复的最后部分，不影响正常的剧情叙述
**infobar_data的内容必须严格遵循aiThinkProcess中五步思考的分析结果**

【⚠️ XML紧凑格式详细示例 ⚠️】

❌ 错误格式示例1 - 缺少注释包装：
<infobar_data>
personal: name="张三", age="25"
world: name="现代都市"
</infobar_data>

❌ 错误格式示例2 - 使用了错误标签名：
<content><!--数据内容--></content>

❌ 错误格式示例3 - 使用了XML嵌套格式：
<infobar_data>
<!--
<personal>
  <name>张三</name>
  <age>25</age>
</personal>
-->
</infobar_data>

❌ 错误格式示例4 - 使用了JSON格式：
<infobar_data>
<!--
{"personal": {"name": "张三", "age": "25"}}
-->
</infobar_data>

❌ 错误格式示例5 - 生成了未启用的面板：
<infobar_data>
<!--
personal: name="张三", age="25"
未启用面板: data="不应该出现"
-->
</infobar_data>

✅ 正确格式示例 - 严格遵守输出顺序和注释包裹格式：

**第一步：必须先输出五步思考（注意：内容必须被<!--和-->包裹）**
<aiThinkProcess>
<!--
五步分析过程：
0. 更新策略:增量更新
1. 剧情分析：张三正在现代都市的办公室里工作，处理编程任务
2. 数据变化识别：位置从家里变为办公室，状态从休息变为工作，新增了任务信息
3. 更新策略判断：需要更新location为"办公室"，occupation保持"程序员"，新增tasks相关字段
4. 数据完整性检查：personal、world、tasks面板都有完整数据
5. 质量验证：数据与当前剧情一致，张三作为程序员在办公室工作符合逻辑
-->
</aiThinkProcess>

**第二步：基于上述分析输出面板数据（注意：内容必须被<!--和-->包裹）**
<infobar_data>
<!--
personal: name="张三", age="25", occupation="程序员"
world: name="现代都市", type="都市", time="2024年"
tasks: creation="新任务创建", editing="任务编辑中"
-->
</infobar_data>

❌ **错误格式示例（严禁使用）**：
<aiThinkProcess>
五步分析过程：（内容没有被注释符号包裹）
0. 更新策略:增量更新
1. 剧情分析：...
</aiThinkProcess>

<infobar_data>
personal: name="张三", age="25"（内容没有被注释符号包裹）
world: name="现代都市", type="都市"
</infobar_data>

【⚠️ 数据格式要求】
✅ **输出顺序**：必须先输出 <aiThinkProcess>，再输出 <infobar_data>
✅ **注释包裹**：所有内容必须被<!--和-->包裹
✅ **标签名称**：使用 <aiThinkProcess> 和 <infobar_data>
✅ **格式要求**：XML紧凑格式（面板名: 字段="值", 字段="值"）
✅ **数据范围**：只为下方模板列出的已启用面板生成数据
✅ **数据一致性**：infobar_data必须严格遵循aiThinkProcess中的五步分析结果
❌ **避免**：使用其他标签名、JSON格式、XML嵌套格式
❌ **避免**：生成未启用面板数据或添加额外字段
❌ **严禁**：先输出infobar_data再输出aiThinkProcess
❌ **严禁**：内容不被注释符号<!--和-->包裹

⭐ 重要：这些要求只适用于数据标签部分，不影响你的正常角色扮演和剧情创作`;
    }

    /**
     * 初始化数据解析器
     */
    async initDataParser() {
        console.log('[SmartPromptSystem] 🔍 初始化数据解析器...');
        
        this.dataParser = {
            // 解析AI返回的数据
            parseAIResponse: (message) => {
                return this.parseInfobarData(message);
            },
            
            // 提取infobar_data标签内容
            extractInfobarData: (content) => {
                // 🔧 修复：支持多种格式的infobar_data标签

                // 优先匹配带注释的格式：<infobar_data><!--内容--></infobar_data>
                let regex = /<infobar_data>\s*<!--\s*([\s\S]*?)\s*-->\s*<\/infobar_data>/i;
                let match = content.match(regex);
                if (match && match[1]) {
                    console.log('[SmartPromptSystem] ✅ 找到带注释的infobar_data格式');
                    return match[1].trim();
                }

                // 备用匹配：直接内容格式：<infobar_data>内容</infobar_data>
                regex = /<infobar_data>\s*([\s\S]*?)\s*<\/infobar_data>/i;
                match = content.match(regex);
                if (match && match[1]) {
                    const extractedContent = match[1].trim();
                    // 检查是否是注释格式但没有被正确识别
                    if (extractedContent.startsWith('<!--') && extractedContent.endsWith('-->')) {
                        console.log('[SmartPromptSystem] ✅ 找到注释格式的infobar_data内容');
                        return extractedContent.slice(4, -3).trim(); // 移除注释符号
                    } else {
                        console.log('[SmartPromptSystem] ✅ 找到直接内容格式的infobar_data');
                        return extractedContent;
                    }
                }

                console.log('[SmartPromptSystem] ⚠️ 未找到任何格式的infobar_data标签');
                return null;
            },
            
            // 解析扁平格式数据
            parseFlatFormat: (dataContent) => {
                return this.parseFlatFormatData(dataContent);
            }
        };
        
        console.log('[SmartPromptSystem] ✅ 数据解析器初始化完成');
    }

    /**
     * 注册API注入钩子
     */
    async registerAPIInjection() {
        console.log('[SmartPromptSystem] 🔗 注册API注入钩子...');
        
        try {
            // 获取SillyTavern的事件源
            const eventSource = this.context.eventSource;
            
            if (eventSource) {
                // 监听生成开始事件
                eventSource.on('generation_started', async (data) => {
                    await this.handleGenerationStarted(data);
                });
                
                // 监听消息接收事件
                eventSource.on('message_received', async (data) => {
                    await this.handleMessageReceived(data);
                });
                
                console.log('[SmartPromptSystem] ✅ API注入钩子注册成功');
            } else {
                console.warn('[SmartPromptSystem] ⚠️ 无法获取事件源，使用备用注入方式');
                this.registerFallbackInjection();
            }
            
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注册API注入钩子失败:', error);
            this.registerFallbackInjection();
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        console.log('[SmartPromptSystem] 🔗 绑定事件监听器...');
        
        if (this.eventSystem) {
            // 监听面板配置变更
            this.eventSystem.on('panel:config:changed', (data) => {
                this.handlePanelConfigChanged(data);
            });
            
            // 监听设置变更
            this.eventSystem.on('config:changed', (data) => {
                this.handleConfigChanged(data);
            });
        }
        
        console.log('[SmartPromptSystem] ✅ 事件监听器绑定完成');
    }

    /**
     * 处理错误
     */
    handleError(error) {
        this.errorCount++;
        console.error('[SmartPromptSystem] ❌ 错误:', error);
        
        if (this.eventSystem) {
            this.eventSystem.emit('smart-prompt:error', {
                error: error.message,
                timestamp: Date.now(),
                errorCount: this.errorCount
            });
        }
    }

    /**
     * 生成智能提示词
     */
    async generateSmartPrompt() {
        try {
            console.log('[SmartPromptSystem] 🔍 开始生成智能提示词...');

            // 获取启用的面板配置
            const enabledPanels = await this.getEnabledPanels();

            if (enabledPanels.length === 0) {
                console.log('[SmartPromptSystem] ℹ️ 没有启用的面板，跳过提示词生成');
                return '';
            }

            // 🔧 新增：获取当前数据核心中的面板数据
            const currentPanelData = await this.getCurrentPanelData(enabledPanels);

            // 🔧 新增：智能分析更新策略
            const updateStrategy = await this.analyzeUpdateStrategy(enabledPanels, currentPanelData);

            // 检测是否有新启用的子项需要补充数据
            const missingDataFields = await this.detectMissingDataFields(enabledPanels);

            // 🔧 优化：增量更新模式下跳过面板数据模板生成，但保持交互面板多NPC逻辑
            let panelDataTemplate = '';
            if (updateStrategy.type === 'incremental') {
                // 增量模式：只为交互面板生成多NPC模板，其他面板跳过模板生成（有现有数据对照）
                const interactionPanel = enabledPanels.find(p => p.id === 'interaction');
                if (interactionPanel) {
                    const panelKey = interactionPanel.type === 'custom' && interactionPanel.key ? interactionPanel.key : interactionPanel.id;
                    const interactionTemplate = this.generateInteractionPanelTemplate(interactionPanel, panelKey);
                    if (interactionTemplate) {
                        panelDataTemplate = `增量更新模式 - 仅交互面板需要特殊处理多NPC:\n${interactionTemplate}`;
                        console.log('[SmartPromptSystem] 📊 增量模式：仅生成交互面板多NPC模板');
                    } else {
                        panelDataTemplate = '增量更新模式 - 基于现有数据对照，无需数据模板';
                        console.log('[SmartPromptSystem] 📊 增量模式：跳过所有面板数据模板生成');
                    }
                } else {
                    panelDataTemplate = '增量更新模式 - 基于现有数据对照，无需数据模板';
                    console.log('[SmartPromptSystem] 📊 增量模式：跳过所有面板数据模板生成');
                }
            } else {
                // 完整模式：生成所有面板的数据模板
                panelDataTemplate = this.generatePanelDataTemplate(enabledPanels);
                console.log('[SmartPromptSystem] 📊 完整模式：生成所有面板数据模板');
            }

            // 🔧 新增：生成当前数据对照信息
            const currentDataInfo = await this.generateCurrentDataInfo(currentPanelData, updateStrategy);

            // 检测输出模式
            const outputMode = this.getOutputMode();

            // 替换模板中的占位符
            let prompt = this.promptTemplate.replace('{PANEL_DATA_TEMPLATE}', panelDataTemplate);

            // 🔧 新增：添加当前数据对照信息
            prompt = this.addCurrentDataInfo(prompt, currentDataInfo);

            // 增量策略：优先添加"只输出变化字段"的通用约束，再追加"缺失数据强制补充"以覆盖通用约束
            if (updateStrategy.type === 'incremental') {
                // 先给出通用增量约束
                prompt = this.addIncrementalOnlyChangedRules(prompt, currentPanelData, enabledPanels);
                // 再以更高优先级追加强制补充要求（覆盖上面的通用规则）
                if (missingDataFields.length > 0) {
                    prompt = this.addIncrementalDataInstructions(prompt, missingDataFields);
                    // 🔧 新增：在提示词最末尾添加终极验证提醒
                    prompt = this.addFinalValidationReminder(prompt, missingDataFields);
                }
            }

            // 🔧 修复：先替换更新策略信息，再替换输出模式标识
            prompt = this.addUpdateStrategyInfo(prompt, updateStrategy);
            
            // 替换输出模式标识
            prompt = prompt.replace('{{OUTPUT_MODE}}', outputMode);

            // 添加严格的字段约束说明
            prompt = this.addFieldConstraints(prompt, enabledPanels, updateStrategy);

            console.log('[SmartPromptSystem] 🔍 模板替换结果:');
            console.log('原始模板长度:', this.promptTemplate.length);
            if (updateStrategy.type === 'incremental') {
                console.log('增量模式面板模板:', panelDataTemplate.substring(0, 100) + (panelDataTemplate.length > 100 ? '...' : ''));
            } else {
                console.log('完整模式面板模板长度:', panelDataTemplate.length);
            }
            console.log('当前数据信息长度:', currentDataInfo.length);
            console.log('更新策略:', updateStrategy.type, `(数据覆盖率: ${updateStrategy.dataPercentage}%)`);
            console.log('最终提示词长度:', prompt.length);

            console.log(`[SmartPromptSystem] ✅ 智能提示词生成完成，包含 ${enabledPanels.length} 个面板`);

            return prompt;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成智能提示词失败:', error);
            this.handleError(error);
            return '';
        }
    }

    /**
     * 检测当前输出模式（主API/自定义API）
     */
    getOutputMode() {
        try {
            // 检查是否启用了自定义API
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            const apiConfig = extensionSettings.apiConfig || {};

            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                return '自定义API';
            } else {
                return '主API';
            }
        } catch (error) {
            console.warn('[SmartPromptSystem] ⚠️ 检测输出模式失败，默认为主API:', error);
            return '主API';
        }
    }

    /**
     * 🔧 新增：获取当前数据核心中的面板数据
     */
    async getCurrentPanelData(enabledPanels) {
        try {
            console.log('[SmartPromptSystem] 📊 获取当前数据核心中的面板数据（与DataTable一致）...');

            const currentData = {};
            const currentChatId = this.dataCore.getCurrentChatId?.();
            const chatData = currentChatId ? await this.dataCore.getChatData(currentChatId) : null;

            const panels = this.extractPanelsFromChatData(chatData);
            if (!panels) {
                console.log('[SmartPromptSystem] 📊 未从chatData提取到panels');
                return {};
            }

            // 仅保留已启用面板，并按启用字段过滤数据
            for (const panel of enabledPanels) {
                const panelId = panel.id;
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const sourceData = panels[panelKey] || panels[panelId];
                if (sourceData && Object.keys(sourceData).length > 0) {
                    // 🔧 修复：使用启用字段过滤，避免跨面板数据污染在提示词中出现
                    const filteredPanelData = this.filterByEnabledFields(panelId, sourceData, panel);
                    if (Object.keys(filteredPanelData).length > 0) {
                        currentData[panelKey] = filteredPanelData;
                        console.log(`[SmartPromptSystem] 📊 面板 ${panelId}(${panelKey}): 过滤后保留 ${Object.keys(filteredPanelData).length} 个启用字段`);
                    }
                }
            }

            console.log(`[SmartPromptSystem] 📊 当前数据获取完成，包含 ${Object.keys(currentData).length} 个面板的数据`);
            return currentData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取当前面板数据失败:', error);
            return {};
        }
    }

    /**
     * 🔧 新增：按启用字段过滤面板数据，避免提示词中出现错误字段
     * @param {string} panelId - 面板ID
     * @param {Object} panelData - 原始面板数据
     * @param {Object} panelConfig - 面板配置（包含启用的子项）
     * @returns {Object} 过滤后的面板数据
     */
    filterByEnabledFields(panelId, panelData, panelConfig) {
        try {
            const filteredData = {};
            
            // 收集启用字段的key列表
            const enabledFieldKeys = new Set();
            if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                panelConfig.subItems.forEach(subItem => {
                    if (subItem.key) {
                        enabledFieldKeys.add(subItem.key);
                    }
                });
            }

            // 只保留启用字段的数据，过滤掉跨面板污染字段
            Object.keys(panelData).forEach(key => {
                // 排除系统字段
                if (['lastUpdated', 'source'].includes(key)) {
                    return;
                }
                
                // 交互对象面板：支持动态NPC字段，例如 npc0.name
                if (panelId === 'interaction') {
                    // 提取基础字段名：匹配 npc<number>.<field>
                    const match = key.match(/^npc\d+\.(.+)$/);
                    const baseField = match ? match[1] : key;
                    if (enabledFieldKeys.has(baseField)) {
                        filteredData[key] = panelData[key];
                        return;
                    }
                }

                // 其他面板：只保留精确匹配的启用字段
                if (enabledFieldKeys.has(key)) {
                    filteredData[key] = panelData[key];
                    return;
                }

                console.log(`[SmartPromptSystem] 🧹 过滤掉面板 ${panelId} 的非启用字段: ${key}`);
            });

            console.log(`[SmartPromptSystem] 🔍 面板 ${panelId} 字段过滤: ${Object.keys(panelData).length} -> ${Object.keys(filteredData).length}`);
            return filteredData;

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 过滤面板 ${panelId} 字段失败:`, error);
            return {}; // 出错时返回空对象，避免污染数据继续传播
        }
    }

    /**
     * 从聊天数据中提取面板数据（与DataTable一致的规则）
     */
    extractPanelsFromChatData(chatData) {
        try {
            if (!chatData) return null;
            if (Array.isArray(chatData)) {
                // 优先使用附加在数组对象上的 infobar_data
                if (chatData.infobar_data?.panels) return chatData.infobar_data.panels;
                for (const item of chatData) {
                    if (item?.panels) return item.panels;
                    if (item?.infobar_data?.panels) return item.infobar_data.panels;
                }
                return null;
            } else if (chatData.infobar_data?.panels) {
                return chatData.infobar_data.panels;
            }
            return null;
        } catch (e) {
            console.warn('[SmartPromptSystem] ⚠️ 提取panels失败:', e);
            return null;
        }
    }

    /**
     * 🔧 新增：智能分析更新策略
     */
    async analyzeUpdateStrategy(enabledPanels, currentPanelData) {
        try {
            console.log('[SmartPromptSystem] 🧠 开始智能分析更新策略...');

            // 🔧 修复：更准确地计算总字段数和已有数据字段数
            let totalFields = 0;
            let existingFields = 0;

            for (const panel of enabledPanels) {
                const panelData = currentPanelData[panel.id];
                
                if (panelData) {
                    // 实际存在的字段数
                    const actualFields = Object.keys(panelData);
                    const validFields = Object.values(panelData).filter(value =>
                        value !== null && value !== undefined && value !== ''
                    );
                    
                    // 使用实际字段数和配置字段数的最大值，防止覆盖率超过100%
                    const configuredFieldCount = panel.subItems ? panel.subItems.length : 0;
                    const actualFieldCount = actualFields.length;
                    const maxFieldCount = Math.max(configuredFieldCount, actualFieldCount);
                    
                    totalFields += maxFieldCount;
                    existingFields += validFields.length;
                } else {
                    // 没有数据的面板，使用配置的字段数
                    const configuredFieldCount = panel.subItems ? panel.subItems.length : 0;
                    totalFields += configuredFieldCount;
                    // existingFields += 0 (已有数据为0)
                }
            }

            // 计算数据覆盖率，确保不超过100%
            const dataPercentage = totalFields > 0 ? Math.min(100, Math.round((existingFields / totalFields) * 100)) : 0;

            // 🔧 修复：智能判断更新策略（调试模式：记录详细信息）
            let strategyType;
            let reason;

            console.log(`[SmartPromptSystem] 🔍 策略分析详情: 覆盖率=${dataPercentage}%, 总字段=${totalFields}, 现有字段=${existingFields}`);

            if (dataPercentage < 20) {
                strategyType = 'full';
                reason = '数据覆盖率低于20%，采用全量更新策略';
                console.log(`[SmartPromptSystem] 📋 选择全量更新: ${reason}`);
            } else if (dataPercentage > 60) {
                strategyType = 'incremental';
                reason = '数据覆盖率高于60%，采用增量更新策略';
                console.log(`[SmartPromptSystem] 🔄 选择增量更新: ${reason}`);
            } else {
                // 20%-60%之间，根据具体情况智能判断
                const missingPanels = enabledPanels.filter(panel => !currentPanelData[panel.id]);
                console.log(`[SmartPromptSystem] 🔍 缺失面板数量: ${missingPanels.length}/${enabledPanels.length}`);
                
                if (missingPanels.length > enabledPanels.length / 2) {
                    strategyType = 'full';
                    reason = '缺失面板数量过多，采用全量更新策略';
                    console.log(`[SmartPromptSystem] 📋 选择全量更新: ${reason}`);
                } else {
                    strategyType = 'incremental';
                    reason = '数据覆盖率适中，采用增量更新策略';
                    console.log(`[SmartPromptSystem] 🔄 选择增量更新: ${reason}`);
                }
            }

            const strategy = {
                type: strategyType,
                dataPercentage,
                totalFields,
                existingFields,
                reason
            };

            console.log(`[SmartPromptSystem] 🧠 更新策略分析完成: ${strategyType} (${dataPercentage}%) - ${reason}`);
            return strategy;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 分析更新策略失败:', error);
            return { type: 'full', dataPercentage: 0, reason: '分析失败，默认全量更新' };
        }
    }

    /**
     * 获取启用的面板 - 修复：与DataTable.js保持一致的数据读取逻辑
     */
    async getEnabledPanels() {
        try {
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            // 修复：直接从extensionSettings读取，而不是从configs子对象
            const configs = extensionSettings;

            const enabledPanels = [];

            // 检查基础面板 - 修复：基础面板直接存储在configs根级别
            const basicPanelIds = [
                'personal', 'world', 'interaction', 'tasks', 'organization',
                'news', 'inventory', 'abilities', 'plot', 'cultivation',
                'fantasy', 'modern', 'historical', 'magic', 'training'
            ];

            for (const panelId of basicPanelIds) {
                if (configs[panelId]) {
                    const panel = configs[panelId];
                    const isEnabled = panel.enabled !== false; // 默认为true，除非明确设置为false

                    if (isEnabled) {
                        // 🔧 修复：同时处理基础设置复选框和面板管理自定义子项
                        const allSubItems = [];

                        // 1. 处理基础设置中的复选框配置（panel[key].enabled格式）
                        const subItemKeys = Object.keys(panel).filter(key => 
                            key !== 'enabled' && 
                            key !== 'subItems' &&     // 排除自定义子项数组
                            key !== 'description' &&  // 排除面板属性
                            key !== 'icon' && 
                            key !== 'required' && 
                            key !== 'memoryInject' && 
                            key !== 'prompts' && 
                            typeof panel[key] === 'object' && 
                            panel[key].enabled !== undefined
                        );
                        const enabledSubItems = subItemKeys.filter(key => panel[key].enabled === true);

                        // 添加基础设置的子项
                        enabledSubItems.forEach(key => {
                            allSubItems.push({
                                key: key,
                                name: panel[key].name || key,
                                enabled: true,
                                value: panel[key].value || '',
                                source: 'basicSettings' // 标记来源
                            });
                        });

                        // 2. 处理面板管理中的自定义子项（panel.subItems数组格式）
                        let enabledCustomSubItems = [];
                        if (panel.subItems && Array.isArray(panel.subItems)) {
                            enabledCustomSubItems = panel.subItems.filter(subItem => subItem.enabled !== false);
                            
                            // 🔧 修复：创建键名集合，避免重复添加
                            const existingKeys = new Set(allSubItems.map(item => item.key));
                            
                            enabledCustomSubItems.forEach(subItem => {
                                const key = subItem.key || subItem.name.toLowerCase().replace(/\s+/g, '_');
                                
                                // 🔧 修复：检查是否已存在，避免重复
                                if (!existingKeys.has(key)) {
                                    allSubItems.push({
                                        key: key,
                                        name: subItem.displayName || subItem.name,
                                        enabled: true,
                                        value: subItem.value || '',
                                        source: 'panelManagement' // 标记来源
                                    });
                                    existingKeys.add(key);
                                } else {
                                    console.log(`[SmartPromptSystem] ⚠️ 跳过重复的自定义子项: ${key} (基础面板 ${panelId} 已存在该键)`);
                                }
                            });
                        }

                        if (allSubItems.length > 0) {
                            enabledPanels.push({
                                id: panelId,
                                type: 'basic',
                                name: this.getBasicPanelDisplayName(panelId),
                                subItems: allSubItems
                            });

                            console.log(`[SmartPromptSystem] 📊 基础面板 ${panelId}: ${allSubItems.length} 个子项 (基础设置: ${enabledSubItems.length}, 自定义: ${enabledCustomSubItems.length})`);
                        }
                    }
                }
            }

            // 检查自定义面板 - 修复：使用与DataTable.js相同的读取逻辑
            if (configs.customPanels) {
                for (const [panelId, panelConfig] of Object.entries(configs.customPanels)) {
                    console.log(`[SmartPromptSystem] 🔍 检查自定义面板: ${panelId}`, panelConfig);
                    if (panelConfig && panelConfig.enabled !== false) { // 默认启用，除非明确设置为false
                        const subItems = panelConfig.subItems || [];
                        console.log(`[SmartPromptSystem] 📊 自定义面板 ${panelId} 子项:`, subItems);
                        
                        // 🔧 修复：即使子项为空也应该包含面板，因为可能在其他地方有子项配置
                        const processedSubItems = subItems.map(subItem => {
                            // 处理不同的子项格式
                            if (typeof subItem === 'string') {
                                return {
                                    key: subItem,
                                    name: subItem,
                                    enabled: true,
                                    value: ''
                                };
                            } else if (subItem && typeof subItem === 'object') {
                                return {
                                    key: subItem.key || subItem.name || subItem.id,
                                    name: subItem.name || subItem.displayName || subItem.key || subItem.id,
                                    enabled: subItem.enabled !== false,
                                    value: subItem.value || ''
                                };
                            }
                            return null;
                        }).filter(Boolean);

                        enabledPanels.push({
                            id: panelId,
                            key: panelConfig.key || panelId, // 添加key属性
                            type: 'custom',
                            name: panelConfig.name || '未命名面板',
                            subItems: processedSubItems
                        });
                        
                        console.log(`[SmartPromptSystem] ✅ 添加自定义面板: ${panelId}, 子项数量: ${processedSubItems.length}`);
                    }
                }
            }

            console.log(`[SmartPromptSystem] 📋 找到 ${enabledPanels.length} 个启用的面板`);
            console.log(`[SmartPromptSystem] 📊 面板详情:`, enabledPanels.map(p => `${p.name}(${p.subItems.length}项)`));

            return enabledPanels;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取启用面板失败:', error);
            return [];
        }
    }

    /**
     * 获取基础面板显示名称
     */
    getBasicPanelDisplayName(panelId) {
        const panelNames = {
            'personal': '个人信息',
            'world': '世界状态',
            'interaction': '交互对象',
            'tasks': '任务状态',
            'organization': '组织关系',
            'news': '新闻事件',
            'inventory': '物品清单',
            'abilities': '能力属性',
            'plot': '剧情进展',
            'cultivation': '修炼境界',
            'fantasy': '奇幻设定',
            'modern': '现代背景',
            'historical': '历史背景',
            'magic': '魔法系统',
            'training': '训练记录'
        };
        return panelNames[panelId] || panelId;
    }

    /**
     * 🔧 修复：生成当前数据对照信息 - 显示所有启用面板状态
     */
    async generateCurrentDataInfo(currentPanelData, updateStrategy) {
        try {
            console.log('[SmartPromptSystem] 📋 生成当前数据对照信息...');

            // 获取所有启用的面板列表
            const enabledPanels = await this.getEnabledPanels();

            if (enabledPanels.length === 0) {
                return '【当前数据状态】\n没有启用的面板。';
            }

            const dataInfoParts = ['【当前数据状态】'];
            dataInfoParts.push(`数据覆盖率: ${updateStrategy.dataPercentage}% (${updateStrategy.existingFields}/${updateStrategy.totalFields}个字段)`);
            dataInfoParts.push(`更新策略: ${updateStrategy.type === 'full' ? '全量更新' : '增量更新'} - ${updateStrategy.reason}`);
            dataInfoParts.push(`启用面板数量: ${enabledPanels.length}个`);
            dataInfoParts.push('');

            // 🔧 修复：显示所有启用面板的状态，无论是否有现有数据
            for (const panel of enabledPanels) {
                const panelId = panel.id;
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelName = this.getBasicPanelDisplayName(panelId);
                const panelData = currentPanelData[panelKey] || currentPanelData[panelId] || {};
                
                dataInfoParts.push(`【${panelName}面板 (${panelId}) - ${Object.keys(panelData).length > 0 ? '现有数据' : '待生成数据'}】`);

                const dataEntries = Object.entries(panelData);
                if (dataEntries.length > 0) {
                    // 显示现有数据（限制显示长度）
                    dataEntries.forEach(([key, value]) => {
                        const displayValue = this.formatDataValue(value);
                        dataInfoParts.push(`${key}: ${displayValue}`);
                    });
                } else {
                    dataInfoParts.push(`(无现有数据，需要根据剧情生成${panel.subItems.length}个字段)`);
                }
                dataInfoParts.push('');
            }

            // 添加更新指导
            if (updateStrategy.type === 'incremental') {
                dataInfoParts.push('【更新指导】');
                dataInfoParts.push('- 保持现有数据不变，只更新有变化或新增的字段');
                dataInfoParts.push('- 如果现有数据准确，请在输出中保持原值');
                dataInfoParts.push('- 只有确实需要修改的字段才输出新值');
            } else {
                dataInfoParts.push('【更新指导】');
                dataInfoParts.push('- 生成所有启用面板的完整数据');
                dataInfoParts.push('- 可以参考现有数据，但需要输出完整的面板数据');
            }

            const result = dataInfoParts.join('\n');
            console.log(`[SmartPromptSystem] 📋 当前数据对照信息生成完成，长度: ${result.length}`);
            return result;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成当前数据对照信息失败:', error);
            return '【当前数据状态】\n数据获取失败，建议进行全量更新。';
        }
    }

    /**
     * 🔧 新增：格式化数据值用于显示
     */
    formatDataValue(value) {
        if (value === null || value === undefined) {
            return '(空)';
        }

        const strValue = String(value);
        if (strValue.length > 50) {
            return strValue.substring(0, 47) + '...';
        }

        return strValue;
    }

    /**
     * 🔧 新增：添加当前数据对照信息到提示词
     */
    addCurrentDataInfo(prompt, currentDataInfo) {
        try {
            // 在面板数据模板之后插入当前数据信息
            const insertPosition = prompt.indexOf('【数据面板要求】');
            if (insertPosition !== -1) {
                const beforePart = prompt.substring(0, insertPosition);
                const afterPart = prompt.substring(insertPosition);
                return beforePart + currentDataInfo + '\n\n' + afterPart;
            } else {
                // 如果找不到插入位置，添加到开头
                return currentDataInfo + '\n\n' + prompt;
            }
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 添加当前数据信息失败:', error);
            return prompt;
        }
    }

    /**
     * 生成面板数据模板
     */
    generatePanelDataTemplate(enabledPanels) {
        console.log('[SmartPromptSystem] 📝 生成面板数据模板，面板数量:', enabledPanels.length);
        console.log('[SmartPromptSystem] 🔍 面板列表:', enabledPanels.map(p => `${p.id}(${p.type})`));

        const templateParts = [];

        for (const panel of enabledPanels) {
            // 对于自定义面板，使用key；对于基础面板，使用id
            const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
            console.log(`[SmartPromptSystem] 处理面板: ${panel.id} (键名: ${panelKey}), 子项数量: ${panel.subItems.length}`);

            // 特殊处理交互对象面板 - 生成多NPC格式
            if (panel.id === 'interaction') {
                const interactionTemplate = this.generateInteractionPanelTemplate(panel, panelKey);
                if (interactionTemplate) {
                    templateParts.push(interactionTemplate);
                    console.log(`[SmartPromptSystem] 交互对象面板模板: ${interactionTemplate}`);
                }
            } else {
                // 其他面板使用原有逻辑
                console.log(`[SmartPromptSystem] 🔍 面板 ${panelKey} 子项详情:`, panel.subItems);
                const subItemTemplates = panel.subItems.map(subItem => {
                    // 🔧 修复：为personal面板提供正确的字段示例，不包含跨面板字段
                    if (panel.id === 'personal') {
                        // personal面板使用正确的字段示例，只包含实际启用的字段
                        const personalExamples = {
                            'name': 'name="张三"',
                            'age': 'age="25"',
                            'gender': 'gender="男"',
                            'occupation': 'occupation="程序员"',
                            'appearance': 'appearance="中等身材，黑发"',
                            'personality': 'personality="开朗，友善"'
                        };
                        return personalExamples[subItem.key] || `${subItem.key}="具体内容"`;
                    } else {
                        return `${subItem.key}="具体内容"`;
                    }
                });

                if (subItemTemplates.length > 0) {
                    const panelTemplate = `${panelKey}: ${subItemTemplates.join(', ')}`;
                    templateParts.push(panelTemplate);
                    console.log(`[SmartPromptSystem] 面板模板: ${panelTemplate}`);
                } else {
                    console.warn(`[SmartPromptSystem] ⚠️ 面板 ${panelKey} 没有有效的子项模板，跳过生成`);
                }
            }
        }

        console.log(`[SmartPromptSystem] 📋 模板部分数组长度: ${templateParts.length}`);
        console.log('[SmartPromptSystem] 📋 模板部分内容:', templateParts);
        
        const result = templateParts.join('\n');
        console.log('[SmartPromptSystem] 生成的面板数据模板:', result);

        return result;
    }

    /**
     * 生成交互对象面板模板 - 动态NPC格式说明
     */
    generateInteractionPanelTemplate(panel, panelKey) {
        console.log('[SmartPromptSystem] 🎭 生成交互对象面板动态NPC模板');

        // 🔧 修复：生成正确的字段列表，避免显示中文显示名称误导AI
        const availableFields = panel.subItems.map(subItem => {
            return `${subItem.key}="具体内容"`;
        });

        // 🔧 修复：生成正确的示例格式
        const exampleFields = panel.subItems.slice(0, 5).map(subItem => {
            const chineseDisplayName = this.getInteractionFieldDisplayName(subItem.key);
            return `npc0.${subItem.key}="具体${chineseDisplayName}内容"`;
        });

        // 🔥 强化交互对象面板的NPC前缀指令 + 严格限制只输出一个interaction面板
        const result = `${panelKey}: 🚨 **只能输出一个${panelKey}面板；所有NPC字段必须使用npcX.前缀** 🚨（X为0,1,2...）
**⚠️ 自定义子项同样必须带npc前缀：npc0.自定义字段**
可用字段: ${availableFields.join(', ')}
✅ 正确示例（单一面板，多个NPC在同一行内区分）: ${exampleFields.join(', ')}, npc1.name="另一个NPC", npc1.type="类型"
❌ 错误示例（多个面板）:
${panelKey}: npc0.name="NPC1"
${panelKey}: npc1.name="NPC2" ← 错误！${panelKey}面板只能出现一次！
❌ 错误示例（缺少前缀）: ${panel.subItems.slice(0, 2).map(subItem => `${subItem.key}="内容"`).join(', ')}
✅ 正确示例（包含前缀）: ${panel.subItems.slice(0, 2).map(subItem => `npc0.${subItem.key}="内容"`).join(', ')}`;

        console.log('[SmartPromptSystem] 🎭 交互对象动态NPC模板生成完成（已强化NPC前缀指令）');
        return result;
    }

    /**
     * 获取交互对象字段的中文显示名称
     */
    getInteractionFieldDisplayName(fieldKey) {
        const interactionFieldMapping = {
            'name': '姓名',
            'type': '类型',
            'status': '状态',
            'location': '位置',
            'mood': '心情',
            'activity': '活动',
            'availability': '可用性',
            'priority': '优先级',
            'relationship': '关系',
            'intimacy': '亲密度',
            'history': '历史',
            'autoRecord': '自动记录',
            'trust': '信任度',
            'friendship': '友谊',
            'romance': '浪漫',
            'respect': '尊重',
            'dependency': '依赖',
            'conflict': '冲突'
        };

        return interactionFieldMapping[fieldKey] || fieldKey;
    }

    /**
     * 获取子项显示名称 - 使用统一的完整映射表
     */
    getSubItemDisplayName(panelId, subItemKey) {
        try {
            // 🔧 修复：使用InfoBarSettings的完整映射表，确保所有字段都有正确的中文显示
            if (window.SillyTavernInfobar?.infoBarSettings) {
                const completeMapping = window.SillyTavernInfobar.infoBarSettings.getCompleteDisplayNameMapping();
                const panelMapping = completeMapping[panelId];
                if (panelMapping && panelMapping[subItemKey]) {
                    return panelMapping[subItemKey];
                }
            }

            // 如果没有映射，返回原始键名（保持原样，避免格式化错误）
            return subItemKey;
            
        } catch (error) {
            console.warn('[SmartPromptSystem] ⚠️ 获取子项显示名称失败:', error);
            return subItemKey;
        }
    }

    /**
     * 🔧 修改：添加更新策略信息（支持智能策略对象）
     */
    addUpdateStrategyInfo(prompt, updateStrategy = null) {
        // 🔧 修复：保持与旧版本完全一致的格式，包含[输出模式: {{OUTPUT_MODE}}]标识行
        let strategyInfo;

        if (updateStrategy && typeof updateStrategy === 'object') {
            strategyInfo = updateStrategy.type === 'incremental'
                ? `[输出模式: {{OUTPUT_MODE}}]\n\n五步分析过程：\n0. 更新策略:增量更新 - ${updateStrategy.reason} (数据覆盖率: ${updateStrategy.dataPercentage}%)`
                : `[输出模式: {{OUTPUT_MODE}}]\n\n五步分析过程：\n0. 更新策略:全量更新 - ${updateStrategy.reason} (数据覆盖率: ${updateStrategy.dataPercentage}%)`;
        } else {
            // 兼容原有逻辑
            strategyInfo = this.updateStrategy === 'incremental'
                ? '[输出模式: {{OUTPUT_MODE}}]\n\n五步分析过程：\n0. 更新策略:增量更新 - 只更新变化的字段，保持其他字段不变'
                : '[输出模式: {{OUTPUT_MODE}}]\n\n五步分析过程：\n0. 更新策略:全量更新 - 输出所有启用面板的完整数据';
        }

        // 🔧 替换整个五步分析模板块，正确匹配模板中的换行格式
        return prompt.replace(/\[输出模式: {{OUTPUT_MODE}}\]\s*\n\s*五步分析过程：\s*\n\s*0\. 更新策略:全量\/增量更新/g, strategyInfo);
    }

    /**
     * 添加严格的字段约束说明
     */
    addFieldConstraints(prompt, enabledPanels, updateStrategy = null) {
        console.log('[SmartPromptSystem] 📋 添加字段约束说明');

        // 🔧 新增：检查是否为增量更新模式
        const isIncrementalUpdate = updateStrategy && updateStrategy.type === 'incremental';
        
        if (isIncrementalUpdate) {
            // 增量更新模式：输出简化的约束说明
            console.log('[SmartPromptSystem] 🔄 增量更新模式，使用简化字段约束');
            
            const simplifiedConstraint = `

【📋 增量更新模式约束】
⚠️ **只输出发生变化的字段，保持现有字段名格式**
⚠️ **交互对象面板使用 npcX.字段名 格式（X为0,1,2...）**
⚠️ **严禁添加未启用的面板或字段**`;
            
            return prompt + simplifiedConstraint;
        }

        // 全量更新模式：保持原有的详细约束说明
        console.log('[SmartPromptSystem] 📊 全量更新模式，使用详细字段约束');

        // 收集所有允许的字段名
        const allowedFields = [];

        // 收集交互对象面板的字段（用于动态NPC格式说明）
        let interactionFields = [];

        for (const panel of enabledPanels) {
            if (panel.id === 'interaction') {
                // 交互对象面板：收集字段用于动态格式说明
                interactionFields = panel.subItems.map(subItem => {
                    return `${subItem.key}="具体内容"`;
                });
            } else {
                // 其他面板：使用原有格式
                for (const subItem of panel.subItems) {
                    const displayName = this.getSubItemDisplayName(panel.id, subItem.key);
                    allowedFields.push(`${subItem.key}="${displayName}"`);
                }
            }
        }

        // 🔧 修复：生成按面板分组的约束说明，避免AI混用字段
        let constraintText = `

【🚨 严格字段约束 - 按面板分组】
⚠️ **重要：每个面板只能使用其对应的启用字段，严禁跨面板使用或添加额外字段！**

📋 **启用面板及其允许字段：**`;

        // 按面板分组显示允许的字段
        for (const panel of enabledPanels) {
            const panelName = this.getBasicPanelDisplayName(panel.id);
            constraintText += `\n\n**✅ ${panelName}面板 (${panel.id})：**`;
            
            if (panel.id === 'interaction') {
                // 交互对象面板：特殊处理
                constraintText += `\n⚠️ 使用动态NPC格式：npcX.字段名="内容"（X为NPC编号0,1,2...）\n📋 可用字段：`;
                
                for (const subItem of panel.subItems) {
                    const displayName = this.getSubItemDisplayName(panel.id, subItem.key);
                    constraintText += `\n  - ${subItem.key}="${displayName}"`;
                }
            } else {
                // 其他面板：标准格式
                constraintText += `\n📋 可用字段（共${panel.subItems.length}个）：`;
                for (const subItem of panel.subItems) {
                    const displayName = this.getSubItemDisplayName(panel.id, subItem.key);
                    constraintText += `\n  - ${subItem.key}="${displayName}"`;
                }
            }
        }

        constraintText += `

**🔥 严格约束规则：**
❌ **严禁添加不在上述列表中的字段**（如：current_action、mood、activity等）
❌ **严禁跨面板使用字段**（如：不能在personal面板使用world面板的location字段）
❌ **严禁使用英文字段名或自创字段**
❌ **严禁使用占位符**（如："未知"、"N/A"、"待补全"）

**✅ 正确做法：**
- 每个面板严格按照上述列表输出字段
- 字段数量必须与用户启用的字段数量一致
- 使用确切的中文字段名和值`;

        // 如果有交互对象面板，添加动态NPC格式说明
        if (interactionFields.length > 0) {
            constraintText += `

【🎭 交互对象NPC格式规则】
⚠️ 重要：交互对象面板只记录NPC角色信息，绝不能填入用户角色信息！

🎭 NPC角色识别指南：
- 对话中的其他角色（非用户本人）
- 用户交互的对象（朋友、敌人、路人等）
- 剧情中出现的所有非玩家角色
- 当用户说"你"时指代的对象
- 当其他角色自称"我"时的角色

📋 数据格式：使用动态NPC格式：npcX.字段名="中文内容"
其中X为NPC编号(0,1,2,3...)，根据剧情中实际出现的NPC数量动态生成

可用字段: ${interactionFields.join(', ')}

✅ 正确示例（NPC角色信息）:
- npc0.name="奥兰多教授", npc0.relationship="导师", npc0.status="友善", npc0.type="教授"
- npc1.name="马尔科姆", npc1.relationship="同学", npc1.status="冷淡", npc1.type="学生"
- npc2.name="瓦里安血棘", npc2.relationship="敌人", npc2.status="敌对", npc2.type="战士"

❌ 错误示例（用户角色信息误填入交互对象）:
- npc0.name="用户角色名", npc0.relationship="自己" ← 这是错误的！
- npc0.name="我", npc0.status="自信" ← 用户信息不应出现在交互对象面板！

🔍 角色区分要点：
- 个人信息面板 = 用户角色数据（玩家自己）
- 交互对象面板 = NPC角色数据（其他角色）
- 严格按照角色身份填写对应面板`;
        }

        constraintText += `

❌ 请避免使用的字段示例：
- items: （英文字段名）
- newItem0.name: （未配置的字段）
- 物品存储: （未启用的字段）
- description: （英文字段名）

✅ 只能使用上述列表中的字段，使用确切的字段名和中文显示名称！`;

        // 在提示词末尾添加约束说明
        return prompt + constraintText;
    }

    /**
     * 处理生成开始事件
     */
    async handleGenerationStarted(data) {
        try {
            console.log('[SmartPromptSystem] 🚀 检测到生成开始，准备注入智能提示词...');

            // 🔧 修复：检查扩展是否启用，默认为启用状态
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            const isExtensionEnabled = extensionSettings.enabled !== false; // 默认为true，只有明确设置为false才禁用

            if (!isExtensionEnabled) {
                console.log('[SmartPromptSystem] ℹ️ 扩展已明确禁用，跳过提示词注入');
                return;
            }

            console.log('[SmartPromptSystem] ✅ 扩展已启用，继续提示词注入流程');

            // 🔧 新增：执行面板记忆注入（独立于API模式，始终执行）
            await this.injectPanelDataToMemory();

            // 🔧 修复：检查是否启用了自定义API模式，并清理错误的禁止规则
            const apiConfig = extensionSettings.apiConfig || {};
            const isCustomAPIEnabled = apiConfig.enabled && apiConfig.apiKey && apiConfig.model;
            
            if (isCustomAPIEnabled) {
                console.log('[SmartPromptSystem] 🚫 检测到自定义API模式已启用，注入主API技术性禁止规则');
                console.log('[SmartPromptSystem] 📊 自定义API提供商:', apiConfig.provider);
                console.log('[SmartPromptSystem] 📊 自定义API模型:', apiConfig.model);
                
                // 注入主API技术性禁止规则
                await this.injectMainAPIProhibitionRules();
                return;
            } else {
                // 🆕 自定义API未启用时，向主API注入必须输出标签的规则
                await this.injectMainAPIRequiredRules();
                console.log('[SmartPromptSystem] ✅ 自定义API未启用，已注入主API必须输出规则');
            }

            // 生成智能提示词
            const smartPrompt = await this.generateSmartPrompt();

            if (smartPrompt) {
                // 注入到API请求中
                await this.injectPromptToAPI(smartPrompt);
                this.lastInjectionTime = Date.now();
                this.injectionActive = true;

                console.log('[SmartPromptSystem] ✅ 智能提示词注入成功');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理生成开始事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 处理消息接收事件
     */
    async handleMessageReceived(data) {
        try {
            if (data && data.is_user === false && data.mes) {
                console.log('[SmartPromptSystem] 📨 检测到AI消息，开始解析数据...');

                // 解析AI返回的数据
                const parsedData = this.dataParser.parseAIResponse(data.mes);

                if (parsedData) {
                    // 更新数据到数据核心
                    await this.updateDataCore(parsedData);

                    // 触发数据更新事件
                    if (this.eventSystem) {
                        this.eventSystem.emit('smart-prompt:data-updated', {
                            data: parsedData,
                            timestamp: Date.now()
                        });
                    }

                    console.log('[SmartPromptSystem] ✅ 数据解析和更新完成');
                }

                this.injectionActive = false;
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理消息接收事件失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 注入提示词到API
     */
    async injectPromptToAPI(prompt) {
        try {
            // 🔧 新增：检查是否启用了自定义API模式
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            const apiConfig = extensionSettings.apiConfig || {};
            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                console.log('[SmartPromptSystem] 🚫 检测到自定义API模式已启用，跳过主API提示词注入');
                return;
            }

            // 获取当前的聊天上下文
            const chat = this.context.chat;
            if (!chat || chat.length === 0) {
                console.warn('[SmartPromptSystem] ⚠️ 没有聊天上下文，无法注入提示词');
                return;
            }

            // 🔧 新增：获取提示词位置配置
            const promptPosition = extensionSettings.promptPosition || { mode: 'afterCharacter', depth: 0 };
            const { mode, depth } = promptPosition;

            // 根据配置的位置模式注入提示词
            if (typeof this.context.setExtensionPrompt === 'function') {
                const injectionParams = this.getInjectionParameters(mode, depth);
                this.context.setExtensionPrompt(
                    injectionParams.identifier, 
                    prompt, 
                    injectionParams.priority, 
                    injectionParams.position
                );
                console.log(`[SmartPromptSystem] ✅ 使用SillyTavern内置机制注入提示词 (模式: ${mode}, 深度: ${depth})`);
            } else {
                // 备用方案：直接修改最后一条消息
                console.log('[SmartPromptSystem] ⚠️ 使用备用方案注入提示词');
                this.injectPromptFallback(prompt);
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注入提示词失败:', error);
            throw error;
        }
    }

    /**
     * 根据位置模式获取注入参数
     */
    getInjectionParameters(mode, depth) {
        const baseParams = {
            identifier: 'Information bar integration tool',
            priority: 1
        };

        switch (mode) {
            case 'beforeCharacter':
                return {
                    ...baseParams,
                    position: 0  // 在角色定义之前，位置为0
                };
            
            case 'afterCharacter':
                return {
                    ...baseParams,
                    position: false  // 在角色定义之后，使用默认位置
                };
            
            case 'atDepthSystem':
                return {
                    ...baseParams,
                    identifier: 'Information bar integration tool - System',
                    position: depth  // 系统角色消息，使用指定深度
                };
            
            case 'atDepthUser':
                return {
                    ...baseParams,
                    identifier: 'Information bar integration tool - User',
                    position: depth  // 用户角色消息，使用指定深度
                };
            
            case 'atDepthAssistant':
                return {
                    ...baseParams,
                    identifier: 'Information bar integration tool - Assistant',
                    position: depth  // 助手角色消息，使用指定深度
                };
            
            default:
                console.warn(`[SmartPromptSystem] ⚠️ 未知的位置模式: ${mode}，使用默认配置`);
                return {
                    ...baseParams,
                    position: false
                };
        }
    }

    /**
     * 备用提示词注入方案
     */
    injectPromptFallback(prompt) {
        try {
            // 🔧 新增：检查是否启用了自定义API模式
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            const apiConfig = extensionSettings.apiConfig || {};
            if (apiConfig.enabled && apiConfig.apiKey && apiConfig.model) {
                console.log('[SmartPromptSystem] 🚫 检测到自定义API模式已启用，跳过备用提示词注入');
                return;
            }

            // 这里可以实现备用的注入逻辑
            // 例如修改发送前的消息内容
            console.log('[SmartPromptSystem] 🔄 执行备用提示词注入...');

            // 将提示词存储到全局变量，供其他模块使用
            window.InfoBarSmartPrompt = prompt;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 备用提示词注入失败:', error);
        }
    }

    /**
     * 注册备用注入方式
     */
    registerFallbackInjection() {
        console.log('[SmartPromptSystem] 🔄 注册备用注入方式...');

        // 可以在这里实现其他注入方式
        // 例如监听DOM变化、拦截fetch请求等

        console.log('[SmartPromptSystem] ✅ 备用注入方式注册完成');
    }

    /**
     * 解析infobar_data标签内容
     */
    parseInfobarData(message) {
        try {
            console.log('[SmartPromptSystem] 🔍 开始解析infobar_data...');

            // 提取infobar_data标签内容
            const dataContent = this.dataParser.extractInfobarData(message);

            if (!dataContent) {
                console.log('[SmartPromptSystem] ℹ️ 未找到infobar_data标签');
                return null;
            }

            // 解析扁平格式数据
            const parsedData = this.dataParser.parseFlatFormat(dataContent);

            if (parsedData) {
                console.log('[SmartPromptSystem] ✅ infobar_data解析成功');
                return {
                    panels: parsedData.panels || {},
                    metadata: {
                        timestamp: Date.now(),
                        source: 'ai-message',
                        format: 'infobar_data'
                    }
                };
            }

            return null;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析infobar_data失败:', error);
            return null;
        }
    }

    /**
     * 解析扁平格式数据
     */
    parseFlatFormatData(dataContent) {
        try {
            const panels = {};
            const lines = dataContent.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue; // 跳过空行和注释
                }

                // 解析面板行格式：panelId: field1="value1", field2="value2"
                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex === -1) continue;

                const panelId = trimmedLine.substring(0, colonIndex).trim();
                const fieldsStr = trimmedLine.substring(colonIndex + 1).trim();

                if (!panels[panelId]) {
                    panels[panelId] = {};
                }

                // 解析字段
                this.parseFieldsString(fieldsStr, panels[panelId]);
            }

            console.log(`[SmartPromptSystem] ✅ 解析了 ${Object.keys(panels).length} 个面板的数据`);

            return { panels };

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析扁平格式数据失败:', error);
            return null;
        }
    }

    /**
     * 解析字段字符串
     */
    parseFieldsString(fieldsStr, panelData) {
        try {
            // 🔧 修复：改进正则表达式以正确处理带数字的子项名称
            // 支持格式：key="value", key1="value", 测试子项1="value", npc0.name="value"
            const fieldRegex = /([\u4e00-\u9fa5\w]+(?:\.[\u4e00-\u9fa5\w]+)?)="([^"]*?)"/g;
            let match;

            while ((match = fieldRegex.exec(fieldsStr)) !== null) {
                const [, key, value] = match;
                
                // 🔧 修复：验证key的有效性，确保不会将数字单独解析为key
                if (this.isValidFieldKey(key)) {
                    panelData[key] = value;
                    console.log(`[SmartPromptSystem] ✅ 解析字段: ${key} = "${value}"`);
                } else {
                    console.warn(`[SmartPromptSystem] ⚠️ 跳过无效字段key: ${key}`);
                }
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析字段字符串失败:', error);
        }
    }

    /**
     * 验证字段key的有效性
     * @param {string} key - 字段key
     * @returns {boolean} 是否为有效的字段key
     */
    isValidFieldKey(key) {
        // 🔧 修复：确保key不是纯数字，并且符合有效的字段命名规范
        
        // 排除纯数字的key
        if (/^\d+$/.test(key)) {
            return false;
        }
        
        // 排除空字符串或只包含特殊字符的key
        if (!key || key.trim().length === 0) {
            return false;
        }
        
        // 允许的key格式：
        // 1. 中文字符和数字组合：测试子项1, 物品1, 技能等级2
        // 2. 英文字符和数字组合：name, age, level1, item2
        // 3. NPC格式：npc0.name, npc1.status
        // 4. 嵌套格式：category.subcategory
        const validKeyPattern = /^[\u4e00-\u9fa5\w]+(\.[\u4e00-\u9fa5\w]+)*$/;
        
        return validKeyPattern.test(key);
    }

    /**
     * 更新数据到数据核心
     */
    async updateDataCore(parsedData) {
        try {
            console.log('[SmartPromptSystem] 💾 开始更新数据到数据核心...');

            if (!parsedData || !parsedData.panels) {
                console.warn('[SmartPromptSystem] ⚠️ 没有有效的面板数据');
                return;
            }

            // 获取当前角色ID（更稳健）：优先SillyTavern上下文，其次window.this_chid，最后default
            let characterId = this.context.characterId || window.this_chid || 'default';
            if (typeof characterId === 'number') characterId = String(characterId);
            if (!characterId || characterId === 'null' || characterId === 'undefined') {
                characterId = 'default';
            }

            // 更新每个面板的数据 - 修复：使用正确的scope参数
            for (const [panelId, panelData] of Object.entries(parsedData.panels)) {
                // 将面板数据存储到chat范围，包含角色ID信息
                const dataKey = `panels.${characterId}.${panelId}`;
                await this.dataCore.setData(dataKey, panelData, 'chat');
                console.log(`[SmartPromptSystem] ✅ 更新面板数据: ${panelId} (角色: ${characterId})`);
            }

            // 更新元数据
            if (parsedData.metadata) {
                await this.dataCore.setData('metadata.lastUpdate', parsedData.metadata, 'global');
            }

            console.log('[SmartPromptSystem] ✅ 数据核心更新完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 更新数据核心失败:', error);
            throw error;
        }
    }

    /**
     * 处理面板配置变更
     */
    handlePanelConfigChanged(data) {
        console.log('[SmartPromptSystem] 📋 面板配置已变更，重新生成提示词模板');

        // 清除缓存，下次生成时会重新获取配置
        this.lastDataSnapshot = null;

        // 触发提示词更新事件
        if (this.eventSystem) {
            this.eventSystem.emit('smart-prompt:template-updated', {
                timestamp: Date.now(),
                reason: 'panel-config-changed'
            });
        }
    }

    /**
     * 处理配置变更
     */
    handleConfigChanged(data) {
        console.log('[SmartPromptSystem] ⚙️ 配置已变更:', data.key);

        // 如果是更新策略变更
        if (data.key === 'updateStrategy') {
            this.updateStrategy = data.value;
            console.log(`[SmartPromptSystem] 📝 更新策略已变更为: ${this.updateStrategy}`);
        }
    }

    /**
     * 检测缺失的数据字段（新启用的子项）
     */
    async detectMissingDataFields(enabledPanels) {
        try {
            console.log('[SmartPromptSystem] 🔍 检测缺失的数据字段...');

            const missingFields = [];
            const dataCore = window.SillyTavernInfobar?.modules?.dataCore || window.SillyTavernInfobar?.modules?.unifiedDataCore;

            if (!dataCore) {
                console.log('[SmartPromptSystem] ⚠️ 数据核心未找到，跳过缺失字段检测');
                return missingFields;
            }

            // 与DataTable一致：从 chatData 的 infobar_data.panels 提取现有数据
            const currentChatId = dataCore.getCurrentChatId?.();
            const chatData = currentChatId ? await dataCore.getChatData(currentChatId) : null;
            const panels = this.extractPanelsFromChatData(chatData) || {};

            for (const panel of enabledPanels) {
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelData = panels[panelKey] || panels[panel.id];

                if (!panelData || Object.keys(panelData).length === 0) {
                    // 整个面板都缺失
                    missingFields.push({
                        panelId: panel.id,
                        panelKey: panelKey, // 🔧 修复：添加实际使用的panelKey，自定义面板使用key
                        panelName: panel.name,
                        missingSubItems: panel.subItems.map(subItem => ({
                            key: subItem.key,
                            displayName: subItem.name || this.getSubItemDisplayName(panel.id, subItem.key)
                        }))
                    });
                    continue;
                }

                // 检查子项是否缺失
                const missingSubItems = [];
                // 交互对象面板需要识别 npcX.<key> 形式
                let interactionBaseFields = null;
                if (panel.id === 'interaction') {
                    interactionBaseFields = new Set();
                    Object.keys(panelData).forEach(k => {
                        const m = k.match(/^npc\d+\.(.+)$/);
                        if (m && m[1]) interactionBaseFields.add(m[1]);
                    });
                }

                for (const subItem of panel.subItems) {
                    const key = subItem.key;
                    let present = false;
                    if (panel.id === 'interaction') {
                        // 只要任意 npcX.key 存在，就视为该字段已存在
                        present = interactionBaseFields && interactionBaseFields.has(key);
                    } else {
                        present = Object.prototype.hasOwnProperty.call(panelData, key);
                    }
                    if (!present) {
                        const displayName = subItem.name || this.getSubItemDisplayName(panel.id, key);
                        missingSubItems.push({ key, displayName });
                    }
                }

                if (missingSubItems.length > 0) {
                    missingFields.push({
                        panelId: panel.id,
                        panelKey: panelKey, // 🔧 修复：添加实际使用的panelKey，自定义面板使用key
                        panelName: panel.name,
                        missingSubItems
                    });
                }
            }

            if (missingFields.length > 0) {
                console.log(`[SmartPromptSystem] 🔍 检测到 ${missingFields.length} 个面板有缺失数据`);
            } else {
                console.log('[SmartPromptSystem] ✅ 所有启用字段都有数据');
            }

            return missingFields;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 检测缺失字段失败:', error);
            return [];
        }
    }

    /**
     * 添加增量数据补充指令
     */
    addIncrementalDataInstructions(prompt, missingFields) {
        console.log('[SmartPromptSystem] 📝 添加增量数据补充指令...');

        // 🔧 简化：以清晰业务语言列出需补充字段
        let incrementalInstructions = `

【🔄 增量数据补充 - 重要】
检测到以下新启用字段缺失，请为这些字段生成内容（必须出现在<infobar_data>中）：

`;

        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId; // 🔧 修复：使用正确的面板键
            incrementalInstructions += `📋 ${field.panelName} (${panelKey}):\n`;

            for (const subItem of field.missingSubItems) {
                // 交互对象面板：强制使用npc前缀
                if (panelKey === 'interaction') {
                    incrementalInstructions += `  - npc0.${subItem.key}="${subItem.displayName}": 请生成合适的内容（必须包含npcX.前缀）\n`;
                } else {
                    incrementalInstructions += `  - ${subItem.key}="${subItem.displayName}": 请生成合适的内容\n`;
                }
            }
            incrementalInstructions += '\n';
        }

        incrementalInstructions += `

⚠️ 规则：
1. 仅补充上述缺失字段，不修改已存在字段
2. 生成内容需与当前剧情一致，具体、可用
3. 这些字段属于“新增启用”，即使增量模式也必须输出
4. 交互对象面板字段必须使用npcX.前缀（例如：npc0.${missingFields?.[0]?.missingSubItems?.[0]?.key || 'name'}="...")

`;

        console.log(`[SmartPromptSystem] ✅ 增量补充指令已添加，涉及 ${missingFields.length} 个面板`);

        return prompt + incrementalInstructions;
    }

    /**
     * 🔥 生成强制面板模板（极端策略）
     */
    generateForcedPanelsForMainTemplate(missingFields) {
        let forcedPanelsText = '';
        
        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId;
            forcedPanelsText += `⚡ ${field.panelName} (${panelKey}): `;
            
            const subItemsList = field.missingSubItems.map(subItem => subItem.key).join(', ');
            forcedPanelsText += `${subItemsList}\n`;
        }
        
        if (forcedPanelsText) {
            forcedPanelsText = `
❌ MISSING CRITICAL PANELS ❌
${forcedPanelsText.trim()}

💀 **SYSTEM DIRECTIVE**: You MUST include ALL above panels in your <infobar_data> response.
💀 **FAILURE CONSEQUENCE**: System crash, data corruption, user experience failure.
💀 **OVERRIDE CODE**: FORCE_OUTPUT_MISSING_PANELS_NOW
`;
        }
        
        console.log('[SmartPromptSystem] 🔥 生成强制面板模板:', forcedPanelsText.length, '字符');
        return forcedPanelsText;
    }

    /**
     * 🔥 生成预填充的缺失面板模板（强制AI填写）
     */
    generatePrefilledMissingPanels(missingFields) {
        let prefilledTemplate = '';
        
        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId;
            prefilledTemplate += `${panelKey}: `;
            
            const subItemTemplates = [];
            for (const subItem of field.missingSubItems) {
                subItemTemplates.push(`${subItem.key}="【请填写${subItem.displayName}的具体内容】"`);
            }
            
            prefilledTemplate += subItemTemplates.join(', ') + '\n';
        }
        
        if (prefilledTemplate) {
            prefilledTemplate = `
🔥 **预设模板（您必须复制并填写具体内容）：**
\`\`\`
${prefilledTemplate.trim()}
\`\`\`

⚡ **使用说明**：请将上述模板复制到您的<infobar_data>中，并将【请填写...】替换为具体内容！
`;
        }
        
        console.log('[SmartPromptSystem] 🔥 生成预填充模板:', prefilledTemplate.length, '字符');
        return prefilledTemplate;
    }

    /**
     * 添加终极验证提醒（在提示词最末尾）
     */
    addFinalValidationReminder(prompt, missingFields) {
        let finalReminder = `

💥💥💥 **最终执行检查清单** 💥💥💥
在您完成<infobar_data>标签之前，请务必确认：

🔍 **强制输出验证**：
`;

        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId;
            finalReminder += `☑️ ${field.panelName} (${panelKey}) - 是否已包含在<infobar_data>中？\n`;
            for (const subItem of field.missingSubItems) {
                finalReminder += `   ☑️ ${subItem.key}="具体内容" - 是否已填写？\n`;
            }
        }

        finalReminder += `
⚡ **如果上述任何一项为"否"，请立即在<infobar_data>中补充！**
⚡ **系统已为您预设模板，请复制并填写具体内容！**
⚡ **这是系统的最后检查，错过将导致数据完全丢失！**

🎯 **重要提醒**：
- 即使是增量更新，这些缺失面板也必须无条件输出！
- 请使用上方提供的预设模板，将【请填写...】替换为具体内容！
- 不要跳过任何预设的面板或字段！

`;

        console.log('[SmartPromptSystem] 🔥 添加终极验证提醒');
        return prompt + finalReminder;
    }

    /**
     * 增量更新约束：基于"当前数据对照信息"，只输出变化字段
     */
    addIncrementalOnlyChangedRules(prompt, currentPanelData, enabledPanels) {
        try {
            const allowedPanels = enabledPanels.map(p => p.id);

            let rules = `

【🔁 增量更新模式 - 只输出变化数据】
请严格基于上文的"当前数据对照信息"进行对比，仅当你决定修改某个字段的内容时，才为该字段输出键值；若字段内容与当前数据保持一致，请不要输出该字段。

约束要求：
1. 仅输出以下已启用面板中的变化字段：${allowedPanels.join(', ')}。
2. 不要输出未变化、为空、未知或占位的字段值；不要重复输出同一字段。
3. 不要输出未启用面板；不要创建未定义的新字段键名（必须使用已定义的子项键）。
4. 仅包含发生变化的面板；没有变化的面板不要出现在输出中。
5. 输出格式保持为每行"面板名: 键="值", 键2="值2"的形式，且所有值为最终内容，不要解释说明。

示例（仅演示格式）：
interaction: npc0.name="小张", npc0.relationship="同事"
plot: exposition="剧情推进到清晨，……"

`;

            return prompt + rules;
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 添加增量变化约束失败:', error);
            return prompt;
        }
    }

    /**
     * 注入启用记忆功能的面板数据到主API上下文记忆
     */
    async injectPanelDataToMemory() {
        try {


            // 获取扩展配置
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};

            // 检查基础面板和自定义面板
            const memoryPanels = [];
            
            // 🔧 修复：基础面板配置直接存储在扩展设置根级别
            // 遍历可能的基础面板ID，并放宽启用判断（未显式关闭则视为启用）
            const basicPanelIds = ['personal', 'world', 'interaction', 'tasks', 'organization', 'news', 'inventory', 'abilities', 'plot', 'cultivation', 'fantasy', 'modern', 'historical', 'magic', 'training'];

            for (const panelId of basicPanelIds) {
                const panelConfig = extensionSettings[panelId];
                if (!panelConfig || typeof panelConfig !== 'object') continue;

                const isEnabled = panelConfig.enabled !== false; // 默认启用
                const injectEnabled = panelConfig.memoryInject === true || panelConfig.basicSettings?.memoryInject === true;

                if (isEnabled && injectEnabled) {
                    console.log(`[SmartPromptSystem] 🧠 发现启用记忆注入的基础面板: ${panelId}`);
                    memoryPanels.push({ id: panelId, type: 'basic', config: panelConfig });
                }
            }

            // 🔧 修复：自定义面板配置存储在 customPanels 属性下
            if (extensionSettings.customPanels) {
                for (const [panelId, panelConfig] of Object.entries(extensionSettings.customPanels)) {
                    if (!panelConfig || typeof panelConfig !== 'object') continue;
                    const isEnabled = panelConfig.enabled !== false; // 默认启用
                    const injectEnabled = panelConfig.memoryInject === true || panelConfig.basicSettings?.memoryInject === true;
                    if (isEnabled && injectEnabled) {
                        console.log(`[SmartPromptSystem] 🧠 发现启用记忆注入的自定义面板: ${panelId}`);
                        memoryPanels.push({ id: panelId, type: 'custom', config: panelConfig });
                    }
                }
            }

            // 兼容旧路径：如果存在 configs.customPanels 或 configs.* 结构，补充检查一次
            const legacyConfigs = extensionSettings.configs || {};
            if (legacyConfigs && typeof legacyConfigs === 'object') {
                // 基础面板（legacy）
                for (const panelId of basicPanelIds) {
                    const panelConfig = legacyConfigs[panelId];
                    if (!panelConfig) continue;
                    const isEnabled = panelConfig.enabled !== false;
                    const injectEnabled = panelConfig.memoryInject === true || panelConfig.basicSettings?.memoryInject === true;
                    if (isEnabled && injectEnabled && !memoryPanels.find(p => p.id === panelId)) {
                        console.log(`[SmartPromptSystem] 🧠 兼容路径发现启用记忆注入的基础面板: ${panelId}`);
                        memoryPanels.push({ id: panelId, type: 'basic', config: panelConfig });
                    }
                }
                if (legacyConfigs.customPanels) {
                    for (const [panelId, panelConfig] of Object.entries(legacyConfigs.customPanels)) {
                        const isEnabled = (panelConfig?.enabled) !== false;
                        const injectEnabled = panelConfig?.memoryInject === true || panelConfig?.basicSettings?.memoryInject === true;
                        if (isEnabled && injectEnabled && !memoryPanels.find(p => p.id === panelId)) {
                            console.log(`[SmartPromptSystem] 🧠 兼容路径发现启用记忆注入的自定义面板: ${panelId}`);
                            memoryPanels.push({ id: panelId, type: 'custom', config: panelConfig });
                        }
                    }
                }
            }

            if (memoryPanels.length === 0) {
                console.log('[SmartPromptSystem] ℹ️ 没有启用记忆注入的面板，跳过记忆注入');
                return;
            }

            console.log(`[SmartPromptSystem] 🧠 找到 ${memoryPanels.length} 个启用记忆注入的面板`);

            // 获取当前聊天数据
            const currentChatId = this.dataCore.getCurrentChatId();
            if (!currentChatId) {
                console.warn('[SmartPromptSystem] ⚠️ 没有当前聊天ID，跳过记忆注入');
                return;
            }

            // 🔧 修复：getChatData是异步函数，需要await
            const chatData = await this.dataCore.getChatData(currentChatId);
            console.log('[SmartPromptSystem] 🔍 获取聊天数据:', {
                chatId: currentChatId,
                hasChatData: !!chatData,
                hasInfobarData: !!(chatData?.infobar_data),
                hasPanels: !!(chatData?.infobar_data?.panels),
                panelCount: Object.keys(chatData?.infobar_data?.panels || {}).length,
                panelKeys: Object.keys(chatData?.infobar_data?.panels || {})
            });

            if (!chatData || !chatData.infobar_data || !chatData.infobar_data.panels) {
                console.log('[SmartPromptSystem] ℹ️ 没有面板数据，跳过记忆注入');
                console.log('[SmartPromptSystem] 🔍 详细诊断:', {
                    chatData: !!chatData,
                    infobarData: !!chatData?.infobar_data,
                    panels: !!chatData?.infobar_data?.panels,
                    chatDataStructure: chatData ? Object.keys(chatData) : 'null'
                });
                return;
            }

            // 提取记忆内容
            const memoryContent = await this.extractMemoryContent(memoryPanels, chatData.infobar_data.panels);
            
            if (memoryContent.trim()) {
                // 注入到context.memory
                await this.injectToContextMemory(memoryContent);
                console.log('[SmartPromptSystem] ✅ 面板记忆注入完成');
            } else {
                console.log('[SmartPromptSystem] ℹ️ 没有有效的记忆内容，跳过注入');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 面板记忆注入失败:', error);
        }
    }

    /**
     * 从启用记忆注入的面板中提取记忆内容
     */
    async extractMemoryContent(memoryPanels, panelData) {
        const memoryItems = [];

        for (const memoryPanel of memoryPanels) {
            const panelId = memoryPanel.id;
            const panelConfig = memoryPanel.config;
            
            // 获取面板显示名称
            const panelDisplayName = memoryPanel.type === 'basic' 
                ? this.getBasicPanelDisplayName(panelId)
                : panelConfig.name || panelId;

            // 获取面板的实际数据
            const actualPanelData = panelData[panelId];
            if (!actualPanelData) {
                console.log(`[SmartPromptSystem] ℹ️ 面板 ${panelId} 没有实际数据，跳过`);
                continue;
            }

            // 提取有效的数据项
            const dataItems = [];
            
            if (memoryPanel.type === 'basic') {
                // 基础面板：提取启用的子项数据
                for (const [fieldKey, fieldValue] of Object.entries(actualPanelData)) {
                    if (fieldKey !== 'enabled' && fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
                        const displayName = this.getSubItemDisplayName(panelId, fieldKey);
                        dataItems.push(`${displayName}: ${fieldValue.trim()}`);
                    }
                }
            } else {
                // 自定义面板：提取子项数据
                if (panelConfig.subItems && Array.isArray(panelConfig.subItems)) {
                    for (const subItem of panelConfig.subItems) {
                        const fieldKey = subItem.key || subItem.name;
                        const fieldValue = actualPanelData[fieldKey];
                        if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
                            const displayName = subItem.name || fieldKey;
                            dataItems.push(`${displayName}: ${fieldValue.trim()}`);
                        }
                    }
                }
            }

            if (dataItems.length > 0) {
                memoryItems.push(`【${panelDisplayName}】\n${dataItems.join('\n')}`);
                console.log(`[SmartPromptSystem] 🧠 从面板 ${panelDisplayName} 提取了 ${dataItems.length} 项数据`);
            }
        }

        if (memoryItems.length > 0) {
            const timestamp = new Date().toLocaleString('zh-CN');
            return `🧠 角色记忆更新 (${timestamp})\n\n${memoryItems.join('\n\n')}`;
        }

        return '';
    }

    /**
     * 注入内容到SillyTavern的context.memory
     */
    async injectToContextMemory(memoryContent) {
        try {
            // 检查是否有Memory系统
            if (this.context.memory !== undefined) {
                // 更新或设置记忆内容
                const existingMemory = this.context.memory || '';
                const separator = existingMemory ? '\n\n---\n\n' : '';
                this.context.memory = existingMemory + separator + memoryContent;

                console.log('[SmartPromptSystem] 🧠 已注入记忆内容到context.memory');
                console.log('[SmartPromptSystem] 📊 记忆内容长度:', memoryContent.length);
                console.log('[SmartPromptSystem] 📊 总记忆长度:', this.context.memory.length);

                // 尝试保存记忆
                if (this.context.saveMemory && typeof this.context.saveMemory === 'function') {
                    await this.context.saveMemory();
                    console.log('[SmartPromptSystem] 💾 记忆已保存');
                }

                return true;
            } else {
                console.log('[SmartPromptSystem] ⚠️ context.memory 不可用，尝试其他方式');
                // 备用方案：使用setExtensionPrompt注入
                if (typeof this.context.setExtensionPrompt === 'function') {
                    this.context.setExtensionPrompt(
                        'Information bar integration tool - Memory',
                        `\n\n${memoryContent}`,
                        2,  // 位置：在用户消息之后
                        false
                    );
                    console.log('[SmartPromptSystem] 🧠 已通过setExtensionPrompt注入记忆内容');
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注入记忆内容失败:', error);
            return false;
        }
    }

    /**
     * 在自定义API模式下向主API注入技术性禁止规则
     * 仅禁止特定XML标签的输出，不影响正常的创作表达
     */
    async injectMainAPIProhibitionRules() {
        try {
            console.log('[SmartPromptSystem] 🚫 开始注入主API技术性禁止规则...');

            // 构建禁止输出规则
            const prohibitionPrompt = `
**重要提醒：避免输出特定标签**

请遵守以下技术性限制：

1. **避免输出 infobar_data 标签**：
   - 请不要在回复中包含 <infobar_data> 标签
   - 不要输出以 infobar_data 开头的 XML 标签
   - 不要生成面板数据或结构化信息

2. **避免输出 aiThinkProcess 标签**：
   - 请不要在回复中包含 <aiThinkProcess> 标签
   - 不要输出思考过程或内部分析内容
   - 不要生成思维流程标记

**这些是纯技术性限制，不影响你的正常创作和表达。**
            `.trim();

            // 先清理可能存在的必须输出规则
            await this.clearMainAPIRequiredRules();

            // 使用SillyTavern的扩展提示词机制注入
            if (typeof this.context.setExtensionPrompt === 'function') {
                await this.context.setExtensionPrompt('Information bar integration tool - Prohibition Rules', prohibitionPrompt, 1, 0, false, '');
                console.log('[SmartPromptSystem] ✅ 主API技术性禁止规则已通过setExtensionPrompt注入');
            } else if (this.context.memory !== undefined) {
                // 备用方案：添加到memory
                const currentMemory = this.context.memory || '';
                const separator = currentMemory ? '\n\n---\n\n' : '';
                this.context.memory = currentMemory + separator + `[系统禁止规则]\n${prohibitionPrompt}`;
                console.log('[SmartPromptSystem] ✅ 主API技术性禁止规则已添加到memory');

                // 保存记忆
                if (typeof this.context.saveMemory === 'function') {
                    await this.context.saveMemory();
                }
            } else {
                console.log('[SmartPromptSystem] ⚠️ 无法找到合适的注入机制');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 主API技术性禁止规则注入失败:', error);
        }
    }

    /**
     * 🆕 向主API注入必须输出标签的规则
     * 当自定义API未启用时，要求主API必须输出 <infobar_data> 和 <aiThinkProcess> 标签
     */
    async injectMainAPIRequiredRules() {
        try {
            console.log('[SmartPromptSystem] ✅ 开始注入主API必须输出规则...');

            // 构建必须输出规则
            const requiredPrompt = `
**🚨【重要要求：必须输出特定标签并遵循格式规范】🚨**

请严格遵守以下输出要求：

**🚨 强制输出顺序要求 🚨**
**必须严格按照以下顺序输出，严禁颠倒：**

1. **第一步：必须先输出 aiThinkProcess 标签**：
   - 在每次回复的最后部分，必须首先包含 <aiThinkProcess> 标签
   - **强制注释包裹格式**：<aiThinkProcess><!--五步分析思考--></aiThinkProcess>
   - **严禁格式**：<aiThinkProcess>五步分析思考</aiThinkProcess>（缺少注释符号）
   - **必须包含完整的五步分析过程**：
     * 0. 更新策略：全量/增量更新
     * 1. 剧情分析：当前发生什么事件？角色在哪里？在做什么？
     * 2. 数据变化识别：哪些信息发生了变化？哪些是新信息？
     * 3. 更新策略判断：需要新增哪些字段？需要更新哪些字段？
     * 4. 数据完整性检查：确保所有启用面板都有完整数据
     * 5. 质量验证：确认数据逻辑一致性和合理性

2. **第二步：必须后输出 infobar_data 标签**：
   - 在aiThinkProcess标签之后，必须包含 <infobar_data> 标签
   - **强制注释包裹格式**：<infobar_data><!--面板数据--></infobar_data>
   - **严禁格式**：<infobar_data>面板数据</infobar_data>（缺少注释符号）
   - **必须根据【信息栏数据格式规范】生成具体内容**
   - **必须严格遵循上述aiThinkProcess中五步分析的结果**
   - 使用XML紧凑格式：面板名: 字段="值", 字段="值"
   - 示例：personal: name="张三", age="25", occupation="程序员"
   - **禁止只输出空标签或占位符**

**⚠️ 严禁先输出infobar_data再输出aiThinkProcess！**
**⚠️ 严禁内容不被<!--和-->注释符号包裹！**

3. **格式规范要求**：
   - **严格遵循【信息栏数据格式规范】**
   - 使用正确的XML紧凑格式，不要使用JSON或嵌套XML
   - 生成真实、具体的数据内容，避免"未知"、"N/A"等占位符
   - 确保数据与当前剧情和角色状态一致

4. **具体格式示例**：

   **第一步：aiThinkProcess标签示例（必须先输出，注意注释包裹）：**
   <aiThinkProcess>
   <!--
   0. 更新策略：增量更新
   1. 剧情分析：艾莉丝正在魔法学院图书馆研究古老的魔法书籍，寻找关于传送法术的信息
   2. 数据变化识别：位置从宿舍变更为图书馆，心情从疲惫变为专注，正在进行魔法研究活动
   3. 更新策略判断：需要更新location字段为"魔法学院图书馆"，mood字段为"专注"，添加当前活动信息
   4. 数据完整性检查：个人信息、状态、物品清单都已包含完整数据
   5. 质量验证：数据与当前剧情一致，艾莉丝作为魔法师在图书馆研究符合角色设定
   -->
   </aiThinkProcess>

   **第二步：infobar_data标签示例（必须后输出，基于上述分析，注意注释包裹）：**
   <infobar_data>
   <!--
   personal: name="艾莉丝", age="23", occupation="魔法师", appearance="红发，绿眼"
   world: name="魔法学院", locations="图书馆", type="奇幻"
   inventory: storage="法杖、魔法袍", retrieval="便捷", organization="有序", capacity="充足"
   -->
   </infobar_data>

   **❌ 错误格式示例（严禁使用）：**
   <aiThinkProcess>
   0. 更新策略：增量更新（内容没有被<!--和-->包裹）
   1. 剧情分析：艾莉丝正在图书馆...
   </aiThinkProcess>

   <infobar_data>
   personal: name="艾莉丝", age="23"（内容没有被<!--和-->包裹）
   world: time="上午", weather="晴朗"
   </infobar_data>

5. **🚨 关键输出位置要求 🚨**：
   - **必须在所有剧情内容和剧情标签之外输出**
   - **绝对不能在 content、message、response 等剧情标签内部输出**
   - **必须在回复的最末尾，所有其他内容完成后输出**
   - **正确位置**：在所有剧情标签结束后，作为独立的标签输出
   - **错误位置**：在任何剧情标签内部输出（会导致XML解析失败）
   - **输出顺序**：剧情内容 → 剧情标签结束 → aiThinkProcess标签 → infobar_data标签

**🚨 系统级强制要求 - 违反将导致系统故障 🚨**：
1. **强制要求：必须在每次回复中包含这些标签 - 不可跳过**
2. **强制要求：必须生成符合格式规范的具体内容，严禁输出空标签**
3. **强制要求：必须参考上述示例格式生成真实数据，严禁敷衍**
4. **🔥 关键：标签必须在所有剧情标签外部输出，绝对不能被content等标签包裹 🔥**
5. **🔥 如果标签被剧情标签包裹，会导致XML解析完全失败，数据无法提取，系统将崩溃 🔥**
6. **⚠️ 系统监控：如果您不输出这些标签，信息栏功能将完全失效**
7. **⚠️ 用户依赖：用户期望每条消息都包含这些数据，不输出会影响体验**

**正确的输出结构**：
[角色扮演内容和剧情发展]
[剧情标签结束]

aiThinkProcess标签（独立输出，必须先输出）
infobar_data标签（独立输出，必须后输出）
            `.trim();

            // 先清理可能存在的禁止规则
            await this.clearMainAPIProhibitionRules();

            // 使用SillyTavern的扩展提示词机制注入
            if (typeof this.context.setExtensionPrompt === 'function') {
                await this.context.setExtensionPrompt('Information bar integration tool - Required Rules', requiredPrompt, 1, 0, false, '');
                console.log('[SmartPromptSystem] ✅ 主API必须输出规则已通过setExtensionPrompt注入');
            } else if (this.context.memory !== undefined) {
                // 备用方案：添加到memory
                const currentMemory = this.context.memory || '';
                const separator = currentMemory ? '\n\n---\n\n' : '';
                this.context.memory = currentMemory + separator + `[系统必须输出规则]\n${requiredPrompt}`;
                console.log('[SmartPromptSystem] ✅ 主API必须输出规则已添加到memory');

                // 保存记忆
                if (typeof this.context.saveMemory === 'function') {
                    await this.context.saveMemory();
                }
            } else {
                console.log('[SmartPromptSystem] ⚠️ 无法找到合适的注入机制');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 主API必须输出规则注入失败:', error);
        }
    }

    /**
     * 🆕 清理主API必须输出规则
     * 清理可能存在的必须输出规则
     */
    async clearMainAPIRequiredRules() {
        try {
            console.log('[SmartPromptSystem] 🧹 开始清理主API必须输出规则...');

            // 使用SillyTavern的扩展提示词机制清理
            if (typeof this.context.setExtensionPrompt === 'function') {
                // 清空必须输出规则提示词
                await this.context.setExtensionPrompt('Information bar integration tool - Required Rules', '', 1, 0, false, '');
                console.log('[SmartPromptSystem] ✅ 已通过setExtensionPrompt清理主API必须输出规则');
            } else if (this.context.memory !== undefined) {
                // 备用方案：从memory中移除必须输出规则
                const currentMemory = this.context.memory || '';
                if (currentMemory.includes('[系统必须输出规则]')) {
                    // 移除必须输出规则相关内容
                    const cleanMemory = currentMemory
                        .replace(/\n\n---\n\n\[系统必须输出规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '')
                        .replace(/\[系统必须输出规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '')
                        .trim();

                    this.context.memory = cleanMemory;
                    console.log('[SmartPromptSystem] ✅ 已从memory中清理主API必须输出规则');

                    // 保存记忆
                    if (typeof this.context.saveMemory === 'function') {
                        await this.context.saveMemory();
                    }
                } else {
                    console.log('[SmartPromptSystem] ℹ️ memory中未找到必须输出规则，无需清理');
                }
            } else {
                console.log('[SmartPromptSystem] ⚠️ 无法找到合适的清理机制');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 主API必须输出规则清理失败:', error);
        }
    }

    /**
     * 🔧 清理主API规则（包括禁止规则和必须输出规则）
     * 清理所有可能存在的API注入规则
     */
    async clearMainAPIProhibitionRules() {
        try {
            console.log('[SmartPromptSystem] 🧹 开始清理主API规则...');

            // 使用SillyTavern的扩展提示词机制清理
            if (typeof this.context.setExtensionPrompt === 'function') {
                // 清空禁止规则提示词
                await this.context.setExtensionPrompt('Information bar integration tool - Prohibition Rules', '', 1, 0, false, '');
                // 清空必须输出规则提示词
                await this.context.setExtensionPrompt('Information bar integration tool - Required Rules', '', 1, 0, false, '');
                console.log('[SmartPromptSystem] ✅ 已通过setExtensionPrompt清理主API所有规则');
            } else if (this.context.memory !== undefined) {
                // 备用方案：从memory中移除所有规则
                const currentMemory = this.context.memory || '';
                let cleanMemory = currentMemory;

                // 移除禁止规则
                if (cleanMemory.includes('[系统禁止规则]')) {
                    cleanMemory = cleanMemory
                        .replace(/\n\n---\n\n\[系统禁止规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '')
                        .replace(/\[系统禁止规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '');
                    console.log('[SmartPromptSystem] ✅ 已从memory中清理禁止规则');
                }

                // 移除必须输出规则
                if (cleanMemory.includes('[系统必须输出规则]')) {
                    cleanMemory = cleanMemory
                        .replace(/\n\n---\n\n\[系统必须输出规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '')
                        .replace(/\[系统必须输出规则\][\s\S]*?(?=\n\n---|\n\n\[|$)/g, '');
                    console.log('[SmartPromptSystem] ✅ 已从memory中清理必须输出规则');
                }

                this.context.memory = cleanMemory.trim();

                // 保存记忆
                if (typeof this.context.saveMemory === 'function') {
                    await this.context.saveMemory();
                }

                if (currentMemory === cleanMemory) {
                    console.log('[SmartPromptSystem] ℹ️ memory中未找到需要清理的规则');
                }
            } else {
                console.log('[SmartPromptSystem] ⚠️ 无法找到合适的清理机制');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 主API规则清理失败:', error);
        }
    }





    /**
     * 获取系统状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            errorCount: this.errorCount,
            injectionActive: this.injectionActive,
            lastInjectionTime: this.lastInjectionTime,
            updateStrategy: this.updateStrategy,
            hasFieldRuleManager: !!this.fieldRuleManager
        };
    }
}
