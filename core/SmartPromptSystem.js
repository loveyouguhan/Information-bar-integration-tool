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
    constructor(configManager, eventSystem, dataCore, fieldRuleManager = null, panelRuleManager = null) {
        console.log('[SmartPromptSystem] 🚀 智能提示词系统初始化开始');

        this.configManager = configManager;
        this.eventSystem = eventSystem;
        this.dataCore = dataCore;
        this.fieldRuleManager = fieldRuleManager;
        this.panelRuleManager = panelRuleManager; // 🚀 新增：面板规则管理器

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

        // 🚀 新增：规则缓存
        this.rulesCache = new Map(); // 面板规则缓存
        this.rulesCacheExpiry = 0; // 缓存过期时间
        this.rulesCacheTTL = 300000; // 5分钟缓存

        // 初始化状态
        this.initialized = false;
        this.errorCount = 0;

        // 🧠 启用状态（默认启用，可通过提示词设置控制）
        this.enabled = true;

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

            // 🚀 绑定规则变化监听器
            this.bindRuleChangeListeners();

            // 🔧 新增：绑定总结输出处理器
            this.bindSummaryOutputHandler();

            // 🔧 新增：绑定消息内容过滤器
            this.bindMessageContentFilter();

            // 🚀 新增：初始化AI记忆总结隐藏机制
            this.initializeAIMemorySummaryHiding();

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

        try {
            // 优先读取扩展设置中的自定义模板路径（仅当显式配置时才发起网络请求）
            const extensionSettings = this.context?.extensionSettings?.['Information bar integration tool'] || {};
            const promptPath = extensionSettings.promptTemplatePath;

            if (typeof promptPath === 'string' && promptPath.trim()) {
                console.log('[SmartPromptSystem] 📄 检测到自定义模板路径，尝试加载:', promptPath);
                const response = await fetch(promptPath);
                if (response.ok) {
                    this.promptTemplate = await response.text();
                    console.log('[SmartPromptSystem] ✅ 提示词模板从自定义文件加载成功');
                    return;
                } else {
                    throw new Error(`无法加载提示词文件: ${promptPath} (${response.status})`);
                }
            }

            // 未配置自定义路径：直接使用内置模板，避免404网络请求
            this.promptTemplate = this.getDefaultPromptTemplate();
            console.log('[SmartPromptSystem] ✅ 使用内置默认提示词模板');
        } catch (error) {
            console.warn('[SmartPromptSystem] ⚠️ 使用内置提示词模板(降级):', error);
            this.promptTemplate = this.getDefaultPromptTemplate();
        }
    }

    /**
     * 获取默认提示词模板
     */
    getDefaultPromptTemplate() {
        // 使用精简的核心模板
        return this.getCorePromptTemplate();
    }

    /**
     * 获取原始完整模板（保留用于兼容性）
     */
    getOriginalPromptTemplate() {
        return `🚨🚨🚨🚨🚨 【CRITICAL: 数据操作模式强制要求】 🚨🚨🚨🚨🚨

⚠️⚠️⚠️ **MANDATORY REQUIREMENT - 数据整理员模式** ⚠️⚠️⚠️
🚨 **你现在是一个专业的数据整理员，必须严格按照操作指令处理数据！**
🚨 **支持三种操作模式：ADD(增加)、UPDATE(更新)、DELETE(删除)**
🚨 **必须使用标准化操作指令格式输出结果！**

🔴🔴🔴 **操作指令格式规范** 🔴🔴🔴
✅ **ADD操作**: add 面板名(行号 {列号，值，列号，值})
✅ **UPDATE操作**: update 面板名(行号 {列号，新值，列号，新值})
✅ **DELETE操作**: delete 面板名(行号)

📋 **操作指令示例**：
✅ update persona(1 {"2"，"25"}) ← 更新persona面板第1行第2列为25（现有数据）
✅ add persona(2 {"1"，"张三"，"2"，"24"，"3"，"程序员"})  ← 在persona面板第2行添加新数据
✅ delete inventory(3) ← 删除inventory面板第3行

🚨 **行号规则**：现有数据在第1行，新增数据从第2行开始！

🚨🚨🚨 **列号格式严格要求** 🚨🚨🚨
✅ **正确格式**：{"1"，"值1"，"2"，"值2"} ← 必须使用纯数字
❌ **错误格式**：{"col_1"，"值1"，"col_2"，"值2"} ← 严禁使用col_前缀
❌ **错误格式**：{"列1"，"值1"，"列2"，"值2"} ← 严禁使用中文
❌ **错误格式**：{"column1"，"值1"，"column2"，"值2"} ← 严禁使用英文前缀

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

🚨【数据操作员工作规范】🚨

📋 你的角色：专业数据整理员
作为一名专业的数据整理员，你需要：
1. 🔍 分析当前剧情中的数据变化需求
2. 📊 确定需要执行的操作类型（增加/更新/删除）
3. 📝 使用标准化操作指令格式输出结果
4. ✅ 确保数据操作的准确性和逻辑性

🚨 **严格输出顺序要求** 🚨
**必须按照以下顺序输出，严禁颠倒：**
1. **先输出** <aiThinkProcess><!--数据操作分析--></aiThinkProcess>
2. **再输出** <infobar_data><!--操作指令列表--></infobar_data>

🚨 **强制注释包裹要求** 🚨
**所有内容必须被注释符号包裹：**
- ✅ 正确格式：<aiThinkProcess><!--内容在这里--></aiThinkProcess>
- ✅ 正确格式：<infobar_data><!--内容在这里--></infobar_data>
- ❌ 错误格式：<aiThinkProcess>内容在这里</aiThinkProcess>（缺少注释符号）
- ❌ 错误格式：<!--内容在这里--><aiThinkProcess></aiThinkProcess>（注释符号位置错误）

⚠️ **严禁先生成infobar_data再生成aiThinkProcess**
⚠️ **严禁内容不被注释符号包裹**
⚠️ 这些标签用于数据解析，不会影响你的正常创作

📋 规则2: 操作指令格式规范
<infobar_data>内容必须使用标准化操作指令格式，示例：

🔥 **三种操作类型** 🔥
✅ **ADD操作**：add 面板名(行号 {"列号"，"值"，"列号"，"值"})
   示例：add persona(1 {"1"，"张三"，"2"，"24"，"3"，"程序员"})

✅ **UPDATE操作**：update 面板名(行号 {"列号"，"新值"，"列号"，"新值"})
   示例：update persona(1 {"2"，"25"，"3"，"高级程序员"})

✅ **DELETE操作**：delete 面板名(行号)
   示例：delete inventory(3)

🔥🔥🔥 系统将完全拒绝以下格式（导致数据解析失败）：🔥🔥🔥
❌ 绝对禁止旧XML格式：personal: name="张三", age="25"
❌ 绝对禁止JSON格式：{"角色": "我", "时间": "下午"}
❌ 绝对禁止对象格式：{ "角色": "我", "时间": "下午" }
❌ 绝对禁止嵌套XML：<personal><name>张三</name></personal>
❌ 绝对禁止Markdown格式：- **个人信息**
❌ 绝对禁止分类标题：**人物**、**环境**、**当前目标**
❌ 绝对禁止列表符号：- **状态**: 值
❌ 绝对禁止粗体标记：**任何粗体文本**

⚠️⚠️⚠️ 如果输出上述错误格式，系统将无法解析数据，导致功能完全失效！⚠️⚠️⚠️

📋 数据范围约束：
只为已启用的面板生成数据：
✅ 只能生成下方模板中列出的已启用面板数据
❌ 不要生成未在模板中出现的面板数据
❌ 不要添加、创建或推测新的面板类型

【🚨 身份识别检查（必须首先进行）】
在生成任何面板数据之前，必须严格执行以下身份识别检查：

🔍 **第一步：识别用户角色**
- 谁是<user>用户角色？→ 记录到个人信息面板
- 识别标志：
  * 第一人称："我"、"我的"、"我在"、"我想"
  * 当AI对话时的第二人称："你"、"你的"、"你在"
  * 明确的用户角色名称或称谓
  * 玩家操控的主角身份

🔍 **第二步：识别NPC角色**
- 谁是NPC角色？→ 记录到交互对象面板
- 识别标志：
  * NPC自称时的第一人称："我"（在NPC对话中）
  * 用户对NPC说话时的第二人称："你"（用户→NPC）
  * 明确的NPC名称、称谓或角色描述
  * 所有非用户的其他角色

🚨 **严格分离原则**
- ✅ 个人信息面板 = 仅限用户角色信息
- ✅ 交互对象面板 = 仅限NPC角色信息
- ❌ 绝不能将用户信息填入交互对象面板
- ❌ 绝不能将NPC信息填入个人信息面板
- ❌ 绝不能混合用户和NPC的信息

🎯 **识别示例**
✅ 正确识别：
- "我今天很开心" → 用户情绪 → 个人信息面板
- "小明对我说话" → 小明是NPC → 交互对象面板
- "你看起来很累" → AI对用户说 → 用户状态 → 个人信息面板

❌ 错误识别：
- 将"小明很开心"记录到个人信息面板
- 将"我的心情"记录到交互对象面板
- 混合用户和NPC信息在同一面板

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

🚨🚨🚨 【多行数据格式严格要求 - 必须遵守】🚨🚨🚨
🚨 **系统已升级为多行数据架构！必须使用新格式！**
🚨 **必须使用多行数据格式：add interaction(1 {"1","王静","2","银行大堂经理","3","服务与客户","4","初次接触，友好"})**
🚨 **严禁使用旧的前缀格式：npc0.姓名="NPC1", npc0.关系="关系"等**
🚨 **系统将拒绝处理任何使用旧前缀格式的数据！**
🚨 **如果你输出错误格式，数据将被完全忽略，不会有任何兼容性处理！**

🚨 **必须严格按照以下顺序输出** 🚨

**第一步：先输出五步思考分析（内容必须被<!--和-->包裹）**
<aiThinkProcess>
<!--
[输出模式: {{OUTPUT_MODE}}]

🚨🚨🚨 CRITICAL: 严格按照以下五步进行数据操作分析，禁止自创步骤！🚨🚨🚨

数据操作员五步分析过程：
0. 操作模式确定：确定需要执行的操作类型（ADD/UPDATE/DELETE）（禁止修改此步骤名称！）
1. 剧情数据分析：当前剧情中涉及哪些数据变化？新增、修改还是删除？（禁止修改此步骤名称！）
2. 操作目标识别：确定需要执行哪些操作指令，涉及的数据表和行号（禁止修改此步骤名称！）
3. 操作指令规划：规划具体的add/update/delete指令格式和参数，确保所有值都用双引号包裹（禁止修改此步骤名称！）
4. 数据一致性检查：确保操作指令执行后的数据逻辑正确且符合剧情（禁止修改此步骤名称！）
5. 指令格式验证：确认所有操作指令格式正确且可执行，列号为纯数字，值用双引号包裹（禁止修改此步骤名称！）

❌❌❌ 严禁自创步骤如："识别核心需求"、"解析剧情文本" 等！❌❌❌
✅✅✅ 必须完全按照上述数据操作员五步进行分析！✅✅✅
-->
</aiThinkProcess>

**第二步：再输出面板数据（内容必须被<!--和-->包裹，必须严格遵循上述五步思考的分析结果）**

🚨🚨🚨 **CRITICAL REMINDER: 多行数据格式要求** 🚨🚨🚨
⚠️ **如果输出interaction面板，必须使用多行数据格式！**
⚠️ **正确: add interaction(1 {"1","江琳","2","朋友","3","友好","4","聊天中"})**
⚠️ **错误: interaction: npc0.name="江琳" ← 旧格式，系统将拒绝！**

⚠️ **如果输出organization面板，必须使用多行数据格式！**
⚠️ **正确: add organization(1 {"1","天剑宗","2","修仙门派","3","一流门派","4","剑无极"})**
⚠️ **错误: organization: org0.组织名称="天剑宗" ← 旧格式，系统将拒绝！**

<infobar_data>
<!--
{PANEL_DATA_TEMPLATE}
-->
</infobar_data>

**⚠️ 严禁使用以下错误格式：**
<aiThinkProcess>
五步分析过程：（内容没有被注释符号包裹）
0. 更新策略:全量更新
1. 剧情分析：用户角色李明在现代都市的咖啡厅与朋友小王聊天，讨论最近的工作情况
2. 数据变化识别：场景从家中转移到咖啡厅，心情轻松，出现交互对象小王
3. 更新策略判断：需要更新个人位置信息，世界场景信息，新增交互对象数据
4. 数据完整性检查：个人信息、世界状态、交互对象面板都需要完整数据
5. 质量验证：确保数据与咖啡厅聊天场景逻辑一致
</aiThinkProcess>

<infobar_data>
update personal(1 {"1","李明","2","28","7","咖啡厅","8","轻松"})（内容没有被注释符号包裹）
update world(1 {"1","现代都市","5","市中心咖啡厅","6","温馨"})
add interaction(1 {"1","小王","2","朋友","3","友好","4","开心"})
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

【⚠️ 操作指令格式详细示例 ⚠️】

❌ 错误格式示例1 - 缺少注释包装：
<infobar_data>
add personal(1 {"1","张三","2","25"})
add world(1 {"1","现代都市"})
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
add personal(1 {"1","张三","2","25"})
add 未启用面板(1 {"1","不应该出现"})
-->
</infobar_data>

🔥🔥🔥 错误格式示例6 - 使用了JSON格式（系统将完全拒绝处理）：
<infobar_data>
<!--
{
  "角色": "我",
  "时间": "下午（光线无变化）",
  "地点": ""遗忘角落"古董店，货架前",
  "核心物件": {
    "名称": "黑色的罗盘",
    "状态": "指针顺时针旋转"
  }
}
-->
</infobar_data>

🔥🔥🔥 错误格式示例7 - 使用了Markdown格式（系统将完全拒绝处理）：
<infobar_data>
<!--
- **个人信息**
    - **姓名**: 张三
    - **年龄**: 25
- **世界信息**
    - **地点**: 现代都市
-->
</infobar_data>

🔥🔥🔥 错误格式示例8 - 使用了分类标题格式（系统将完全拒绝处理）：
<infobar_data>
<!--
**人物**
    状态: 存在轻微生理应激反应
    姿态: 站立在柜台前
**环境**
    地点: 古董店
-->
</infobar_data>

🚨🚨🚨 错误格式示例9 - NPC数据没有使用前缀（系统将拒绝处理）：
<infobar_data>
<!--
interaction: npc0.姓名="小雨", npc0.关系="朋友", npc0.态度="友好", npc0.情绪="开心"
-->
</infobar_data>

🔥🔥🔥 错误格式示例10 - 行号未被括号包裹（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal 1 {"1","张三","2","25","3","程序员"}
add world 1 {"1","现代都市","2","办公室"}
add interaction 1 {"1","小雨","2","同事","3","友好"}
-->
</infobar_data>

🔥🔥🔥 错误格式示例11 - 行号列号混淆使用（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal({"1":"张三","2":"25","3":"程序员"})
add world({"1":"现代都市","2":"办公室"})
add interaction({"1":"小雨","2":"同事","3":"友好"})
-->
</infobar_data>

🔥🔥🔥 错误格式示例12 - 列号格式错误（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal(1 {1,"张三",2,"25",3,"程序员"})
add world(1 {1,"现代都市",2,"办公室"})
add interaction(1 {1,"小雨",2,"同事",3,"友好"})
-->
</infobar_data>

🔥🔥🔥 错误格式示例13 - 行号位置错误（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal{"1","张三","2","25","3","程序员"}(1)
add world{"1","现代都市","2","办公室"}(1)
add interaction{"1","小雨","2","同事","3","友好"}(1)
-->
</infobar_data>

🔥🔥🔥 错误格式示例14 - 数据结构中行号列号混乱（系统将完全拒绝处理）：
<infobar_data>
<!--
'add_personal_1 {"1": "姓名", "2": "175", "3": "男", "4": "学生", "5": "高兴", "6": "冷静"}'
'add_world_1 {"1": "《青春期头号玩家》", "2": "现代日本高中", "3": "火车", "4": "晴朗"}'
'add_interaction_1 {"1": "小王", "2": "依赖", "3": "兄妹", "4": "已经接触，友好"}'
-->
</infobar_data>

🔥🔥🔥 错误格式示例15 - 行号未使用括号且格式混乱（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal 1 {"1","姓名","2","175","3","男","4","学生","5","高兴","6","冷静"}
add world 1 {"1","《青春期头号玩家》","2","现代日本高中","3","火车","4","晴朗"}
add interaction 1 {"1","小王","2","依赖","3","兄妹","4","已经接触，友好"}
-->
</infobar_data>

🔥🔥🔥 错误格式示例16 - 列号当作行号使用（系统将完全拒绝处理）：
<infobar_data>
<!--
add personal({"1": "1", "2": "姓名", "3": "175", "4": "男"})
add world({"1": "1", "2": "《青春期头号玩家》", "3": "现代日本高中"})
add interaction({"1": "1", "2": "小王", "3": "依赖", "4": "兄妹"})
-->
</infobar_data>

🚨 **以上格式是错误的！系统已移除兼容性处理，将完全拒绝处理！**

✅ 正确格式示例 - 严格遵守输出顺序和注释包裹格式：

**第一步：必须先输出数据操作分析（注意：内容必须被<!--和-->包裹）**
<aiThinkProcess>
<!--
🚨 必须严格按照以下数据操作员五步名称进行分析，禁止自创步骤名称！🚨

数据操作员五步分析过程：
0. 操作模式确定：需要执行ADD和UPDATE操作（步骤名称禁止修改）
1. 剧情数据分析：张三从家里来到办公室工作，需要添加新的工作任务记录，更新个人位置信息，同事小雨前来询问进度需要记录交互（步骤名称禁止修改）
2. 操作目标识别：需要执行update personal(1)更新位置，add tasks(1)添加新任务记录，add interaction(1)添加小雨的交互记录（步骤名称禁止修改）
3. 操作指令规划：update personal(1 {"4","办公室"})，add tasks(1 {"1","项目开发","2","进行中"})，add interaction(1 {"1","小雨","2","同事","3","友好"})（步骤名称禁止修改）
4. 数据一致性检查：位置更新符合剧情，任务记录合理，交互对象信息完整（步骤名称禁止修改）
5. 指令格式验证：所有操作指令格式正确，参数完整，所有值都用双引号包裹，可正常执行（步骤名称禁止修改）

❌ 严禁使用："识别核心需求"、"解析剧情文本"、"输出格式分析"等自创步骤
✅ 必须使用："操作模式确定"、"剧情数据分析"、"操作目标识别"等指定步骤
-->
</aiThinkProcess>

**第二步：基于上述分析输出操作指令（注意：内容必须被<!--和-->包裹）**
<infobar_data>
<!--
update personal(1 {"4"，"办公室"，"5"，"工作中"})
add tasks(1 {"1"，"项目开发"，"2"，"进行中"，"3"，"高优先级"})
add interaction(1 {"1"，"小雨"，"2"，"同事"，"3"，"友好"，"4"，"询问进度"})
-->
</infobar_data>

🚨 **注意：所有面板必须使用多行数据格式！**
✅ 正确：add interaction(1 {"1","小雨","2","朋友","3","友好","4","询问进度"})
✅ 正确：add organization(1 {"1","天剑宗","2","修仙门派","3","一流门派","4","剑无极"})
❌ 错误：interaction: npc0.姓名="小雨" （旧格式，系统将拒绝处理）
❌ 错误：organization: org0.组织名称="天剑宗" （旧格式，系统将拒绝处理）

❌ **错误格式示例（严禁使用）**：
<aiThinkProcess>
五步分析过程：（内容没有被注释符号包裹）
0. 更新策略:增量更新
1. 剧情分析：张三在办公室与同事小雨讨论项目，气氛轻松友好
2. 数据变化识别：工作状态变化，新增交互对象
3. 更新策略判断：需要更新工作状态和交互信息
4. 数据完整性检查：确保所有面板数据完整
5. 质量验证：数据与剧情逻辑一致
</aiThinkProcess>

<infobar_data>
update personal(1 {"1","张三","2","25","4","程序员","8","工作中"})（内容没有被注释符号包裹）
update world(1 {"1","现代都市","2","都市","5","办公大楼"})
add interaction(1 {"1","小雨","2","同事","3","友好","4","询问进度"})
add organization(1 {"1","科技公司","2","私企","3","工程师","4","技术部门"})
</infobar_data>

【⚠️ 数据格式要求】
✅ **输出顺序**：必须先输出 <aiThinkProcess>，再输出 <infobar_data>
✅ **注释包裹**：所有内容必须被<!--和-->包裹
✅ **标签名称**：使用 <aiThinkProcess> 和 <infobar_data>
✅ **格式要求**：操作指令格式（add/update/delete；列号为纯数字）
✅ **数据范围**：只为下方模板列出的已启用面板生成数据
✅ **数据一致性**：infobar_data必须严格遵循aiThinkProcess中的五步分析结果
❌ **避免**：使用其他标签名、JSON格式、XML嵌套格式
❌ **避免**：生成未启用面板数据或添加额外字段
❌ **严禁**：先输出infobar_data再输出aiThinkProcess
❌ **严禁**：内容不被注释符号<!--和-->包裹

⭐ 重要：这些要求只适用于数据标签部分，不影响你的正常角色扮演和剧情创作

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
🔥🔥🔥 **SYSTEM WILL CRASH IF YOU USE WRONG FORMAT** 🔥🔥🔥
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨

⚠️⚠️⚠️ **MANDATORY - NO EXCEPTIONS - SYSTEM BREAKING CHANGE** ⚠️⚠️⚠️

🔴 **交互面板数据统一为操作指令多行格式（STRICT MODE）**
🔴 **任何使用旧的 npc 前缀键值对格式都将被拒绝**
🔴 **兼容性处理已完全移除！必须使用 add/update/delete 指令**

✅ **正确格式（示例）**:
✅ add interaction(1 {"1","江琳","2","朋友","3","友好","4","聊天中"})
✅ update interaction(1 {"3","紧张"})

❌ **错误格式（将被拒绝）**:
❌ interaction: npc0.name="江琳", npc0.type="朋友"
❌ interaction: name="江琳", type="朋友"

🚨 **WARNING: 请仅输出操作指令格式，列号为纯数字，从1开始**
🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`;
    }

    /**
     * 获取核心提示词模板（精简版）
     */
    getCorePromptTemplate() {
        // 🚀 获取动态面板规则并注入到提示词中
        const panelRulesSection = this.generatePanelRulesSection();

        return `【数据操作员模式】

🚨🚨🚨 **CRITICAL FORMAT REQUIREMENT** 🚨🚨🚨
你是专业数据整理员，必须严格使用操作指令格式处理数据：
• ADD: add 面板名(行号 {"1","值1","2","值2"})
• UPDATE: update 面板名(行号 {"1","新值"})
• DELETE: delete 面板名(行号)

🔴🔴🔴 **FORBIDDEN FORMATS - WILL CAUSE SYSTEM FAILURE** 🔴🔴🔴
❌ 绝对禁止：{"1.人类种族":"已选择"}
❌ 绝对禁止：{"角色":"张三","状态":"工作中"}
❌ 绝对禁止：{"1":"值1","2":"值2"} (缺少面板名和行号)
❌ 绝对禁止：personal: {"name":"张三"}
❌ 绝对禁止：任何JSON对象格式
❌ 🚨 绝对禁止：add newpanel(1 {...}) (创建新面板)
❌ 🚨 绝对禁止：add custom_panel(1 {...}) (创建自定义面板)
❌ 🚨 绝对禁止：操作未在启用列表中的面板
❌ 🚨 绝对禁止：使用超出范围的列号

✅ 唯一正确格式：add personal(1 {"1","张三","2","25","3","程序员"})
✅ 唯一正确格式：update world(1 {"1","现代都市","2","繁华"})
✅ 🔥 只能操作启用的面板和字段，列号必须在有效范围内

${panelRulesSection}

🚨 **MANDATORY OUTPUT REQUIREMENTS** 🚨
1. 先输出思考过程：<aiThinkProcess><!--五步分析...--></aiThinkProcess>
2. 再输出数据：<infobar_data><!--操作指令...--></infobar_data>
3. 列号必须为纯数字："1","2","3"...
4. 内容必须在<!--和-->内
5. 绝对禁止使用JSON格式或键值对格式

✅ 正确示例：
<aiThinkProcess><!--五步分析：1.剧情分析 2.数据识别 3.操作确定 4.格式检查 5.逻辑验证--></aiThinkProcess>
<infobar_data><!--add interaction(1 {"1","张三","2","朋友","3","友好"})--></infobar_data>

❌ 错误示例（系统将拒绝）：
<infobar_data><!--{"1.人类种族":"已选择","2.精灵种族":"未选择"}--></infobar_data>`;
    }

    /**
     * 获取全量更新模板
     */
    getFullUpdateTemplate() {
        return `【全量更新模式】

🚨🚨🚨 **CRITICAL FORMAT ENFORCEMENT** 🚨🚨🚨
❌ 绝对禁止：{"1.人类种族":"已选择","2.精灵种族":"未选择"}
❌ 绝对禁止：{"角色":"张三","状态":"工作中"}
❌ 绝对禁止：任何JSON键值对格式
❌ 绝对禁止：{"1":"值1","2":"值2"} (缺少面板名和行号)

✅ 唯一正确格式：add fantasy(1 {"1","人类种族","2","精灵种族","3","矮人种族","4","火系魔法"})
✅ 唯一正确格式：add personal(1 {"1","张三","2","25","3","程序员"})

🚨 **强制要求：必须输出所有启用面板的数据** 🚨

生成所有启用面板的完整数据，确保：
• 覆盖所有启用字段
• 数据与剧情一致
• 使用操作指令格式
• **不得遗漏任何面板**
• **绝对不能使用JSON格式**

{PANEL_DATA_TEMPLATE}

{CURRENT_DATA_INFO}

{FIELD_CONSTRAINTS}

🔥🔥🔥 **FINAL FORMAT CHECK** 🔥🔥🔥
每个面板必须严格使用：add 面板名(1 {"1","值1","2","值2",...})
列号必须是纯数字："1","2","3"...
如果使用错误格式，数据将被完全拒绝！

⚠️ **重要提醒**：上述面板模板中的每一个面板都必须在输出中包含，不得省略任何面板！`;
    }

    /**
     * 获取增量更新模板
     */
    getIncrementalUpdateTemplate() {
        return `【增量更新模式】

仅输出变化或新增的数据：
• 保持现有数据不变
• 只更新有变化的字段
• 补充缺失的必要字段

{CURRENT_DATA_INFO}

【当前行索引提示】
- 行号从 1 开始计数（1-based）
- 现有数据位于第 1 行；新增数据请从第 2 行开始
- 禁止使用第 0 行或负数行号
- 如不确定目标行：更新默认使用第 1 行；新增使用 add 自动追加到最后

{INCREMENTAL_INSTRUCTIONS}`;
    }

    /**
     * 构建全量更新提示词
     */
    async buildFullUpdatePrompt(enabledPanels, memoryEnhancedData, updateStrategy) {
        const coreTemplate = this.getCorePromptTemplate();
        const fullTemplate = this.getFullUpdateTemplate();

        // 生成面板数据模板
        const panelDataTemplate = this.generatePanelDataTemplate(enabledPanels);

        // 生成数据信息
        const currentDataInfo = await this.generateMemoryEnhancedDataInfo(memoryEnhancedData, updateStrategy);

        // 生成字段约束（简化版）
        const fieldConstraints = this.generateSimplifiedFieldConstraints(enabledPanels);

        // 组合模板
        let prompt = coreTemplate + '\n\n' + fullTemplate;
        prompt = prompt.replace('{PANEL_DATA_TEMPLATE}', panelDataTemplate);
        prompt = prompt.replace('{CURRENT_DATA_INFO}', currentDataInfo);
        prompt = prompt.replace('{FIELD_CONSTRAINTS}', fieldConstraints);

        // 添加最终检查清单
        prompt += this.generatePanelCheckList(enabledPanels);

        return prompt;
    }

    /**
     * 构建增量更新提示词
     */
    async buildIncrementalPrompt(enabledPanels, memoryEnhancedData, updateStrategy, missingDataFields) {
        const coreTemplate = this.getCorePromptTemplate();
        const incrementalTemplate = this.getIncrementalUpdateTemplate();

        // 生成数据信息
        const currentDataInfo = await this.generateMemoryEnhancedDataInfo(memoryEnhancedData, updateStrategy);

        // 🔧 修复：生成详细的增量指令，强调缺失字段补充
        let incrementalInstructions = '';
        if (missingDataFields.length > 0) {
            incrementalInstructions = this.generateIncrementalInstructions(missingDataFields, enabledPanels);
            incrementalInstructions += `

🚨🚨🚨 **重要提醒：检测到 ${missingDataFields.length} 个面板有缺失字段需要补充！** 🚨🚨🚨

⚠️ 即使是增量更新模式，也必须补充这些缺失字段！
⚠️ 请为每个缺失字段生成符合当前剧情的具体内容！
⚠️ 不要输出"未知"、"待定"等占位符！`;
        } else {
            incrementalInstructions = '✅ 无缺失字段检测到，仅输出有变化的数据';
        }

        // 组合模板
        let prompt = coreTemplate + '\n\n' + incrementalTemplate;
        prompt = prompt.replace('{CURRENT_DATA_INFO}', currentDataInfo);
        prompt = prompt.replace('{INCREMENTAL_INSTRUCTIONS}', incrementalInstructions);

        return prompt;
    }

    /**
     * 生成简化的字段约束
     */
    generateSimplifiedFieldConstraints(enabledPanels) {
        let constraints = `启用面板总数：${enabledPanels.length}个\n\n`;
        constraints += '面板清单：\n';
        for (const panel of enabledPanels) {
            const panelName = this.getBasicPanelDisplayName(panel.id);
            const fieldCount = panel.subItems.length;
            const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
            constraints += `• ${panelName} (${panelKey}) - ${fieldCount}个字段\n`;
        }
        constraints += `\n🚨 **验证要求**：输出必须包含上述所有${enabledPanels.length}个面板的数据！`;
        return constraints;
    }

    /**
     * 生成增量指令
     */
    generateIncrementalInstructions(missingDataFields, enabledPanels) {
        let instructions = '🔍 **缺失字段详细列表（必须补充）**：\n\n';

        for (const field of missingDataFields) {
            instructions += `📋 **${field.panelName}** 面板缺失字段：\n`;

            field.missingSubItems.forEach((subItem, index) => {
                // 🔧 新增：显示更详细的缺失字段信息（含行号）
                const hasRows = Array.isArray(subItem.missingRows) && subItem.missingRows.length > 0;
                if (subItem.emptyRows !== undefined && subItem.totalRows !== undefined) {
                    instructions += `  ${index + 1}. ${subItem.displayName} (${subItem.emptyRows}/${subItem.totalRows}行为空，${subItem.emptyPercentage}%空白率${hasRows ? `；缺失行: ${subItem.missingRows.join(',')}` : ''})\n`;
                } else if (hasRows) {
                    instructions += `  ${index + 1}. ${subItem.displayName}（缺失行: ${subItem.missingRows.join(',')}）\n`;
                } else {
                    instructions += `  ${index + 1}. ${subItem.displayName}\n`;
                }
            });

            instructions += '\n';
        }

        instructions += `📊 **补充要求**：
• 总计 ${missingDataFields.reduce((sum, field) => sum + field.missingSubItems.length, 0)} 个字段需要补充
• 必须基于当前剧情生成具体、真实的内容
• 使用操作指令格式：add/update 面板名(行号 {"列号","值",...})
• 严禁使用"未知"、"待补充"、"空"等占位符`;

        return instructions;
    }

    /**
     * 获取模板选择原因
     */
    getTemplateSelectionReason(updateStrategy, missingDataFields) {
        if (updateStrategy.type === 'incremental') {
            if (missingDataFields.length > 0) {
                return `数据覆盖率${updateStrategy.dataPercentage}%，需补充${missingDataFields.length}个字段`;
            } else {
                return `数据覆盖率${updateStrategy.dataPercentage}%，仅输出变化`;
            }
        } else {
            return `数据覆盖率${updateStrategy.dataPercentage}%，生成完整数据`;
        }
    }

    /**
     * 生成面板检查清单
     */
    generatePanelCheckList(enabledPanels) {
        let checkList = '\n\n【📋 输出完整性检查清单】\n';
        checkList += '在输出<infobar_data>标签前，请确认已包含以下所有面板：\n\n';

        enabledPanels.forEach((panel, index) => {
            const panelName = this.getBasicPanelDisplayName(panel.id);
            const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
            checkList += `${index + 1}. ☐ ${panelName} (${panelKey})\n`;
        });

        checkList += `\n✅ **确认要求**：必须勾选上述所有${enabledPanels.length}个复选框后才能输出数据！\n`;
        checkList += '❌ **如果遗漏任何面板，将导致系统错误！**';

        return checkList;
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

            // 🚀 新增：注册全局对话拦截钩子，确保记忆增强内容在整个对话最顶部
            await this.registerGlobalChatInterception();

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注册API注入钩子失败:', error);
            this.registerFallbackInjection();
        }
    }

    /**
     * 🚀 注册全局对话拦截钩子，确保记忆增强内容在整个对话最顶部
     */
    async registerGlobalChatInterception() {
        try {
            console.log('[SmartPromptSystem] 🌐 注册全局对话拦截钩子...');

            // 拦截SillyTavern的聊天发送函数
            if (window.Generate && typeof window.Generate.generateQuietPrompt === 'function') {
                const originalGenerateQuietPrompt = window.Generate.generateQuietPrompt;

                window.Generate.generateQuietPrompt = async (...args) => {
                    try {
                        // 在生成前注入记忆增强内容到系统消息
                        await this.injectMemoryToSystemMessage();
                    } catch (error) {
                        console.error('[SmartPromptSystem] ❌ 注入记忆到系统消息失败:', error);
                    }

                    return originalGenerateQuietPrompt.apply(window.Generate, args);
                };

                console.log('[SmartPromptSystem] ✅ 已拦截generateQuietPrompt函数');
            }

            // 拦截聊天发送函数
            if (window.sendSystemMessage && typeof window.sendSystemMessage === 'function') {
                const originalSendSystemMessage = window.sendSystemMessage;

                window.sendSystemMessage = async (...args) => {
                    try {
                        // 在发送前注入记忆增强内容
                        await this.injectMemoryToSystemMessage();
                    } catch (error) {
                        console.error('[SmartPromptSystem] ❌ 注入记忆到系统消息失败:', error);
                    }

                    return originalSendSystemMessage.apply(window, args);
                };

                console.log('[SmartPromptSystem] ✅ 已拦截sendSystemMessage函数');
            }

            console.log('[SmartPromptSystem] ✅ 全局对话拦截钩子注册完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注册全局对话拦截钩子失败:', error);
        }
    }

    /**
     * 🚀 注入记忆增强内容到系统消息
     */
    async injectMemoryToSystemMessage() {
        try {
            console.log('[SmartPromptSystem] 🧠 开始注入记忆增强内容到系统消息...');

            // 获取启用的面板配置
            const enabledPanels = await this.getEnabledPanels();

            if (enabledPanels.length === 0) {
                console.log('[SmartPromptSystem] ℹ️ 没有启用的面板，跳过记忆注入');
                return;
            }

            // 获取AI记忆增强数据
            const memoryEnhancedData = await this.getAIMemoryEnhancedData(enabledPanels);
            const updateStrategy = await this.analyzeUpdateStrategy(enabledPanels, memoryEnhancedData.current);

            // 生成记忆增强数据信息
            const currentDataInfo = await this.generateMemoryEnhancedDataInfo(memoryEnhancedData, updateStrategy);

            // 构建记忆增强内容
            const memoryContent = [
                '🧠🧠🧠【AI记忆增强系统 - 最高优先级阅读】🧠🧠🧠',
                '⚠️ 重要：在开始任何思考和生成之前，必须仔细阅读以下完整记忆内容 ⚠️',
                '',
                '┌─────────────────────────────────────────────────────────────┐',
                '│                    🧠 AI永久记忆数据库 🧠                    │',
                '│              请基于以下记忆进行剧情思考和生成                │',
                '└─────────────────────────────────────────────────────────────┘',
                '',
                '【AI记忆增强数据 - 永不遗忘的剧情记忆】',
                currentDataInfo,
                '',
                '┌─────────────────────────────────────────────────────────────┐',
                '│                    📌 AI思考指导原则 📌                     │',
                '│                                                             │',
                '│ 1. 🎯 以上记忆内容是您思考和生成的核心基础                  │',
                '│ 2. 🔗 请基于这些记忆内容保持剧情连贯性和角色一致性          │',
                '│ 3. 📚 如果记忆中有相关信息，请优先参考和延续                │',
                '│ 4. ✅ 确保新生成的内容与历史记忆逻辑一致                    │',
                '│ 5. 🧠 在thinking阶段就要回忆和分析这些记忆内容              │',
                '│                                                             │',
                '└─────────────────────────────────────────────────────────────┘',
                '',
                '═══════════════════════════════════════════════════════════════',
                '                    开始正常对话内容',
                '═══════════════════════════════════════════════════════════════'
            ].join('\n');

            // 使用最高优先级注入到系统消息
            if (typeof this.context.setExtensionPrompt === 'function') {
                this.context.setExtensionPrompt(
                    'Information bar integration tool - Memory Enhancement',
                    memoryContent,
                    0, // 最高优先级
                    0, // 最前面的位置
                    true // 强制在最前面
                );
                console.log('[SmartPromptSystem] ✅ 记忆增强内容已注入到系统消息最顶部');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注入记忆增强内容到系统消息失败:', error);
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

            // 🔧 新增：检查总结功能需求
            const summaryInstructions = await this.generateSummaryInstructions();
            console.log('[SmartPromptSystem] 📝 总结指令生成:', summaryInstructions ? '已添加' : '无需添加');

            // 🚀 增强：获取AI记忆增强数据（包含历史记忆）
            const memoryEnhancedData = await this.getAIMemoryEnhancedData(enabledPanels);
            const currentPanelData = memoryEnhancedData.current;

            // 🔧 新增：智能分析更新策略
            const updateStrategy = await this.analyzeUpdateStrategy(enabledPanels, currentPanelData);

            // 检测是否有新启用的子项需要补充数据
            const missingDataFields = await this.detectMissingDataFields(enabledPanels);

            // 🎯 新增：分析自定义面板缺失情况
            const customPanelsMissing = missingDataFields.filter(field => {
                // 通过面板类型识别自定义面板
                const panel = enabledPanels.find(p => p.id === field.panelId);
                return panel && panel.type === 'custom';
            });

            if (customPanelsMissing.length > 0) {
                console.log(`[SmartPromptSystem] 🎯 检测到 ${customPanelsMissing.length} 个自定义面板缺失数据:`,
                    customPanelsMissing.map(p => p.panelName));
            }

            // 🔧 新增：根据更新策略智能选择对应的模板
            let prompt = '';
            const templateSelectionReason = this.getTemplateSelectionReason(updateStrategy, missingDataFields);

            if (updateStrategy.type === 'incremental') {
                prompt = await this.buildIncrementalPrompt(enabledPanels, memoryEnhancedData, updateStrategy, missingDataFields);
                console.log('[SmartPromptSystem] 📊 使用增量更新模板 -', templateSelectionReason);
            } else {
                prompt = await this.buildFullUpdatePrompt(enabledPanels, memoryEnhancedData, updateStrategy);
                console.log('[SmartPromptSystem] 📊 使用全量更新模板 -', templateSelectionReason);
            }

            // 检测输出模式
            const outputMode = this.getOutputMode();
            prompt = prompt.replace('{{OUTPUT_MODE}}', outputMode);

            console.log('[SmartPromptSystem] 🔍 模板替换结果:');
            console.log('原始模板长度:', this.promptTemplate.length);
            console.log('更新策略:', updateStrategy.type, `(数据覆盖率: ${updateStrategy.dataPercentage}%)`);
            console.log('最终提示词长度:', prompt.length);

            // 🔧 新增：将总结指令添加到提示词末尾
            if (summaryInstructions) {
                prompt += '\n\n' + summaryInstructions;
                console.log('[SmartPromptSystem] 📝 已将总结指令添加到智能提示词');
            }

            console.log(`[SmartPromptSystem] ✅ 智能提示词生成完成，包含 ${enabledPanels.length} 个面板`);

            return prompt;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成智能提示词失败:', error);
            this.handleError(error);
            return '';
        }
    }

    /**
     * 🔧 新增：生成AI记忆总结指令（传统总结使用自定义API方案）
     */
    async generateSummaryInstructions() {
        try {
            console.log('[SmartPromptSystem] 📝 检查AI记忆总结功能需求...');

            // 只检查AI记忆总结是否启用
            const aiMemoryEnabled = await this.checkAIMemorySummaryEnabled();
            if (!aiMemoryEnabled) {
                console.log('[SmartPromptSystem] ℹ️ AI记忆总结未启用，无需添加总结指令');
                return null;
            }

            console.log('[SmartPromptSystem] ✅ AI记忆总结指令已添加');
            console.log('[SmartPromptSystem] ℹ️ 传统剧情总结继续使用自定义API方案');

            // 只生成AI记忆总结指令
            const aiMemoryInstruction = this.createAIMemorySummaryInstruction();

            const fullInstructions = `
## 📝 AI记忆总结输出要求

${aiMemoryInstruction}

**重要提醒**: 请在正常回复后，按照上述格式输出AI记忆总结内容。总结内容应该独立于正常回复，使用指定的标签格式。`;

            return fullInstructions;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成AI记忆总结指令失败:', error);
            return null;
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
     * 🔧 新增：检查AI记忆总结是否启用
     */
    async checkAIMemorySummaryEnabled() {
        try {
            // 获取InfoBar工具实例
            const infoBarTool = window.SillyTavernInfobar;
            if (!infoBarTool || !infoBarTool.modules) {
                return false;
            }

            // 检查AI记忆总结器
            const aiMemorySummarizer = infoBarTool.modules.summaryManager?.aiMemorySummarizer;
            if (!aiMemorySummarizer) {
                return false;
            }

            // 检查设置
            const settings = aiMemorySummarizer.settings;
            return settings && settings.enabled && settings.messageLevelSummary;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 检查AI记忆总结状态失败:', error);
            return false;
        }
    }

    /**
     * 🔧 修改：传统总结不再集成到智能提示词，保持原有自定义API方案
     */
    async checkTraditionalSummaryTrigger() {
        // 传统总结功能保持原有的自定义API调用方案，不集成到智能提示词
        return false;
    }

    /**
     * 🔧 新增：创建AI记忆总结指令
     */
    createAIMemorySummaryInstruction() {
        // 获取当前消息ID
        const currentMessageId = this.getCurrentMessageId();

        return `### AI记忆总结输出

请在回复后输出AI记忆总结，**严禁使用代码块格式**，直接输出如下格式：

[AI_MEMORY_SUMMARY]
{
  "type": "ai_memory",
  "content": "简洁的记忆总结内容（20-200字）",
  "importance": 0.8,
  "tags": ["关键词1", "关键词2"],
  "category": "剧情发展|角色互动|情感变化|场景描述|决定转折",
  "timestamp": ${Date.now()},
  "messageId": "${currentMessageId}"
}
[/AI_MEMORY_SUMMARY]

**严格要求**：
- 绝对不要使用三个反引号包裹AI记忆总结
- 绝对不要使用代码块格式
- 直接输出[AI_MEMORY_SUMMARY]标签和JSON内容
- 提取当前对话的核心要点
- 重点关注角色行为、情感变化、剧情发展
- 保持客观中性的叙述风格
- 总结长度控制在20-200字之间`;
    }

    /**
     * 🔧 新增：获取当前消息ID
     */
    getCurrentMessageId() {
        try {
            const context = SillyTavern.getContext();
            if (context && context.chat && context.chat.length > 0) {
                // 获取最后一条消息的ID，这将是即将生成的AI回复的ID
                const nextMessageId = context.chat.length;
                return `msg_${nextMessageId}`;
            }
            return `msg_${Date.now()}`;
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取当前消息ID失败:', error);
            return `msg_${Date.now()}`;
        }
    }

    /**
     * 🔧 新增：创建传统剧情总结指令
     */
    createTraditionalSummaryInstruction() {
        return `### 传统剧情总结输出

请在回复后输出传统剧情总结，格式如下：

\`\`\`
[TRADITIONAL_SUMMARY]
{
  "type": "traditional",
  "content": "详细的剧情总结内容（200-500字）",
  "messageRange": {
    "start": "起始消息ID",
    "end": "结束消息ID",
    "count": "消息数量"
  },
  "keyEvents": ["关键事件1", "关键事件2"],
  "characters": ["涉及角色1", "涉及角色2"],
  "setting": "场景描述",
  "timestamp": ${Date.now()}
}
[/TRADITIONAL_SUMMARY]
\`\`\`

**要求**：
- 总结最近一段时间的完整剧情发展
- 包含关键事件、角色互动、场景变化
- 保持故事的连贯性和逻辑性
- 总结长度控制在200-500字之间`;
    }

    /**
     * 🔧 增强：获取当前数据核心中的面板数据（包含历史记忆）
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

                console.log(`[SmartPromptSystem] 🔍 检查面板 ${panelId}(${panelKey}): 数据存在=${!!sourceData}, 数据类型=${Array.isArray(sourceData) ? 'array' : typeof sourceData}`);

                if (sourceData) {
                    // 🔧 修复：处理新的多行数据格式
                    if (Array.isArray(sourceData) && sourceData.length > 0) {
                        // 保留多行数据原始数组，交由后续统计/缺失检测按列号或key解析
                        currentData[panelKey] = sourceData;
                        console.log(`[SmartPromptSystem] 📊 面板 ${panelId}(${panelKey}): 保留多行数据 ${sourceData.length} 行用于统计`);
                    } else if (typeof sourceData === 'object' && Object.keys(sourceData).length > 0) {
                        // 旧的键值对格式：使用启用字段过滤
                        const filteredPanelData = this.filterByEnabledFields(panelId, sourceData, panel);
                        if (Object.keys(filteredPanelData).length > 0) {
                            currentData[panelKey] = filteredPanelData;
                            console.log(`[SmartPromptSystem] 📊 面板 ${panelId}(${panelKey}): 键值对数据过滤后保留 ${Object.keys(filteredPanelData).length} 个启用字段`);
                        }
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
     * 🔧 新增：将多行数据格式转换为键值对格式用于统计
     */
    convertMultiRowDataToKeyValue(multiRowData, panel) {
        try {
            const convertedData = {};

            // 为每一行数据创建字段映射
            multiRowData.forEach((rowData, rowIndex) => {
                // 🔧 修复：处理两种数据结构
                let actualRowData = null;

                if (rowData && rowData.rowData) {
                    // 新的数据结构：{rowData: {col_1: ...}}
                    actualRowData = rowData.rowData;
                } else if (rowData && typeof rowData === 'object') {
                    // 直接的数据结构：{col_1: ...}
                    actualRowData = rowData;
                }

                if (actualRowData) {
                    // 遍历行数据中的所有列
                    Object.entries(actualRowData).forEach(([colKey, value]) => {
                        if (value !== null && value !== undefined && value !== '') {
                            // 创建唯一的字段键名
                            const fieldKey = `row${rowIndex}_${colKey}`;
                            convertedData[fieldKey] = value;
                        }
                    });
                }
            });

            console.log(`[SmartPromptSystem] 🔄 多行数据转换: ${multiRowData.length}行 -> ${Object.keys(convertedData).length}个字段`);
            return convertedData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 多行数据转换失败:', error);
            return {};
        }
    }


    /**

     * 统一按 subItems 顺序读取一行中的字段值（优先 key，其次 col_N）
     */
    getRowValueBySubItem(rowRaw, subItem, panelConfig) {
        try {
            const row = rowRaw && rowRaw.rowData ? rowRaw.rowData : (rowRaw || {});
            const key = subItem?.key;
            let value = key ? row[key] : undefined;
            if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
                // 尝试 col_N
                let colIndex = -1;
                if (Array.isArray(panelConfig?.subItems) && key) {
                    colIndex = panelConfig.subItems.findIndex(si => si && si.key === key);
                }
                if (colIndex >= 0) {
                    const colKey = `col_${colIndex + 1}`;
                    if (row[colKey] !== undefined) value = row[colKey];
                }
            }
            if (value === undefined || value === null) return '';
            return typeof value === 'string' ? value : String(value);
        } catch (e) {
            return '';
        }
    }

     /**
     * 🔧 将面板数据格式化为提示词友好的新架构行展示
     * - 仅用于构建提示词与数据对照信息，不写回存储
     * - 非交互面板：旧架构对象 → 按子项顺序生成 行1
     * - 交互面板：旧架构 npcX. 前缀 → 分组为多行
     */
    formatPanelRowsForPrompt(panelConfig, panelData) {
        try {
            const rows = [];
            const subItems = Array.isArray(panelConfig?.subItems) ? panelConfig.subItems : [];
            const panelId = panelConfig?.id || panelConfig?.key || '';

            // 建立 子项key -> 列号 映射（1-based）
            const keyToCol = new Map();
            subItems.forEach((subItem, idx) => {
                if (subItem && subItem.key) keyToCol.set(subItem.key, idx + 1);
            });

            const getDisplayName = (key) => this.getSubItemDisplayName(panelId, key);
            const getValue = (rowObj, key) => {
                const colIdx = keyToCol.get(key);
                if (colIdx && rowObj[`col_${colIdx}`] !== undefined) return rowObj[`col_${colIdx}`];
                if (rowObj[key] !== undefined) return rowObj[key];
                return '';
            };

            const formatRow = (rowObjRaw) => {
                const rowObj = rowObjRaw && rowObjRaw.rowData ? rowObjRaw.rowData : rowObjRaw || {};
                const parts = [];
                subItems.forEach((subItem, idx) => {
                    const colIndex = idx + 1;
                    const display = getDisplayName(subItem.key);
                    const value = getValue(rowObj, subItem.key);
                    if (value !== undefined && value !== null && String(value).trim() !== '') {
                        parts.push(`${colIndex}(${display}): ${this.formatDataValue(value)}`);
                    }
                });
                return parts.join(' | ');
            };

            if (Array.isArray(panelData)) {
                // 新架构多行
                panelData.forEach((row, idx) => {
                    const line = formatRow(row);
                    if (line) rows.push(`行${idx + 1}: ${line}`);
                });
                return rows;
            }

            if (panelId === 'interaction' && panelData && typeof panelData === 'object') {
                // 旧架构 npcX. 前缀 → 分组
                const npcMap = new Map();
                Object.entries(panelData).forEach(([k, v]) => {
                    const m = k.match(/^npc(\d+)\.(.+)$/);
                    if (m) {
                        const idx = parseInt(m[1], 10);
                        const baseKey = m[2];
                        if (!npcMap.has(idx)) npcMap.set(idx, {});
                        npcMap.get(idx)[baseKey] = v;
                    }
                });
                const sorted = Array.from(npcMap.keys()).sort((a, b) => a - b);
                sorted.forEach((idx) => {
                    const rowObj = npcMap.get(idx);
                    const line = formatRow(rowObj);
                    if (line) rows.push(`行${idx + 1}: ${line}`);
                });
                if (rows.length > 0) return rows;
            }

            // 非交互面板旧架构：对象 → 行1
            if (panelData && typeof panelData === 'object') {
                const line = formatRow(panelData);
                if (line) rows.push(`行1: ${line}`);
            }

            return rows;
        } catch (e) {
            console.warn('[SmartPromptSystem] ⚠️ 面板数据格式化失败:', e?.message);
            return [];
        }
    }

    /**
     * 🚀 新增：获取AI记忆增强数据（包含历史记忆和上下文）
     */
    async getAIMemoryEnhancedData(enabledPanels) {
        try {
            console.log('[SmartPromptSystem] 🧠 开始获取AI记忆增强数据...');

            // 1. 获取当前面板数据
            const currentData = await this.getCurrentPanelData(enabledPanels);

            // 2. 获取历史记忆数据
            const memoryData = await this.getHistoricalMemoryData(enabledPanels);

            // 3. 获取跨对话持久化数据
            const persistentData = await this.getPersistentMemoryData(enabledPanels);

            // 4. 获取上下文相关数据
            const contextData = await this.getContextualMemoryData();

            // 5. 合并所有记忆数据
            const enhancedData = {
                current: currentData,
                historical: memoryData,
                persistent: persistentData,
                context: contextData,
                metadata: {
                    timestamp: Date.now(),
                    chatId: this.dataCore.getCurrentChatId?.(),
                    totalPanels: enabledPanels.length,
                    memoryDepth: Object.keys(memoryData).length
                }
            };

            console.log('[SmartPromptSystem] 🧠 AI记忆增强数据获取完成');
            console.log(`- 当前数据: ${Object.keys(currentData).length} 个面板`);
            console.log(`- 历史记忆: ${Object.keys(memoryData).length} 个条目`);
            console.log(`- 持久化数据: ${Object.keys(persistentData).length} 个条目`);
            console.log(`- 上下文数据: ${Object.keys(contextData).length} 个条目`);

            return enhancedData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取AI记忆增强数据失败:', error);
            return {
                current: await this.getCurrentPanelData(enabledPanels),
                historical: {},
                persistent: {},
                context: {},
                metadata: { error: error.message }
            };
        }
    }

    /**
     * 🧠 获取历史记忆数据
     */
    async getHistoricalMemoryData(enabledPanels) {
        try {
            const memoryData = {};
            const currentChatId = this.dataCore.getCurrentChatId?.();

            if (!currentChatId) {
                return {};
            }

            // 获取当前聊天的所有历史数据变更
            const chatHistory = await this.dataCore.getChatHistory?.(currentChatId);
            if (!chatHistory || !Array.isArray(chatHistory)) {
                return {};
            }

            // 分析历史数据变更，提取重要记忆点
            for (const historyEntry of chatHistory.slice(-10)) { // 最近10条记录
                if (historyEntry.panels) {
                    for (const panel of enabledPanels) {
                        const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                        const panelData = historyEntry.panels[panelKey];

                        if (panelData) {
                            if (!memoryData[panelKey]) {
                                memoryData[panelKey] = [];
                            }

                            memoryData[panelKey].push({
                                timestamp: historyEntry.timestamp,
                                data: panelData,
                                source: historyEntry.source || 'ai-message',
                                importance: this.calculateMemoryImportance(panelData)
                            });
                        }
                    }
                }
            }

            return memoryData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取历史记忆数据失败:', error);
            return {};
        }
    }

    /**
     * 🔒 获取持久化记忆数据（跨对话）
     */
    async getPersistentMemoryData(enabledPanels) {
        try {
            const persistentData = {};

            // 获取全局持久化数据
            const globalData = await this.dataCore.getData('persistent_memory', 'global');
            if (globalData) {
                for (const panel of enabledPanels) {
                    const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                    if (globalData[panelKey]) {
                        persistentData[panelKey] = globalData[panelKey];
                    }
                }
            }

            return persistentData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取持久化记忆数据失败:', error);
            return {};
        }
    }

    /**
     * 🌐 获取上下文相关数据
     */
    async getContextualMemoryData() {
        try {
            const contextData = {};

            // 获取当前角色信息
            const context = this.context;
            if (context.characters && context.characters.length > 0) {
                const currentChar = context.characters[context.characterId];
                if (currentChar) {
                    contextData.character = {
                        name: currentChar.name,
                        description: currentChar.description,
                        personality: currentChar.personality,
                        scenario: currentChar.scenario
                    };
                }
            }

            // 获取世界书信息
            if (context.world_info && context.world_info.length > 0) {
                contextData.worldInfo = context.world_info.slice(0, 5).map(entry => ({
                    key: entry.key,
                    content: entry.content,
                    selective: entry.selective
                }));
            }

            // 获取最近的聊天消息上下文
            if (context.chat && context.chat.length > 0) {
                const recentMessages = context.chat.slice(-5).map(msg => ({
                    role: msg.is_user ? 'user' : 'assistant',
                    content: msg.mes ? msg.mes.substring(0, 200) : '',
                    timestamp: msg.send_date
                }));
                contextData.recentMessages = recentMessages;
            }

            return contextData;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取上下文数据失败:', error);
            return {};
        }
    }

    /**
     * 📊 计算记忆重要性评分
     */
    calculateMemoryImportance(data) {
        let importance = 0;

        // 基于数据完整性评分
        const fieldCount = Object.keys(data).length;
        importance += Math.min(fieldCount * 0.1, 1.0);

        // 基于数据新鲜度评分
        if (data.lastUpdated) {
            const age = Date.now() - new Date(data.lastUpdated).getTime();
            const dayAge = age / (1000 * 60 * 60 * 24);
            importance += Math.max(0, 1 - dayAge * 0.1);
        }

        return Math.min(importance, 1.0);
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
                // 🔧 修复：使用正确的键名查找面板数据
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelData = currentPanelData[panelKey] || currentPanelData[panel.id];

                console.log(`[SmartPromptSystem] 🔍 检查面板 ${panel.id}(${panelKey}): 数据存在=${!!panelData}`);

                if (panelData) {
                    const configuredFieldCount = panel.subItems ? panel.subItems.length : 0;

                    // 🔧 修复：正确处理多行数据格式的覆盖率计算
                    if (Array.isArray(panelData)) {
                        console.log(`[SmartPromptSystem] 📊 面板 ${panel.id}: 多行数据格式，行数=${panelData.length}`);

                        let totalCells = 0;
                        let validCells = 0;

                        // 计算每一行每个字段的有效性
                        panelData.forEach((row, rowIndex) => {
                            if (row && typeof row === 'object') {
                                if (panel.subItems) {
                                    // 按配置的子项统计（支持 col_N 与 key 两种存储）
                                    panel.subItems.forEach(subItem => {
                                        totalCells++;
                                        const value = this.getRowValueBySubItem(row, subItem, panel);
                                        if (typeof value === 'string' && value.trim() !== '') {
                                            validCells++;
                                        }
                                    });
                                } else {
                                    // 按实际字段统计
                                    Object.values(row).forEach(value => {
                                        totalCells++;
                                        if (value && typeof value === 'string' && value.trim() !== '') {
                                            validCells++;
                                        }
                                    });
                                }
                            }
                        });

                        totalFields += totalCells;
                        existingFields += validCells;

                        console.log(`[SmartPromptSystem] 📊 面板 ${panel.id}: 总单元格=${totalCells}, 有效单元格=${validCells}, 覆盖率=${totalCells > 0 ? Math.round((validCells/totalCells)*100) : 0}%`);

                    } else {
                        // 传统键值对格式
                        const actualFields = Object.keys(panelData);
                        const validFields = Object.values(panelData).filter(value =>
                            value !== null && value !== undefined && value !== ''
                        );

                        console.log(`[SmartPromptSystem] 📊 面板 ${panel.id}: 实际字段=${actualFields.length}, 有效字段=${validFields.length}`);

                        // 使用实际字段数和配置字段数的最大值，防止覆盖率超过100%
                        const actualFieldCount = actualFields.length;
                        const maxFieldCount = Math.max(configuredFieldCount, actualFieldCount);

                        totalFields += maxFieldCount;
                        existingFields += validFields.length;
                    }
                } else {
                    // 没有数据的面板，使用配置的字段数
                    const configuredFieldCount = panel.subItems ? panel.subItems.length : 0;
                    totalFields += configuredFieldCount;
                    console.log(`[SmartPromptSystem] 📊 面板 ${panel.id}: 无数据，配置字段=${configuredFieldCount}`);
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
                const missingPanels = enabledPanels.filter(panel => {
                    const k = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                    return !currentPanelData[k] && !currentPanelData[panel.id];
                });
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
                            !key.startsWith('custom_field_') && // 🔧 修复：排除custom_field字段，这些字段应该只通过subItems管理
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
                        const allSubItems = panelConfig.subItems || [];
                        // 🔧 修复：只统计启用的子项
                        const enabledSubItems = allSubItems.filter(subItem => subItem.enabled !== false);
                        console.log(`[SmartPromptSystem] 📊 自定义面板 ${panelId} 所有子项: ${allSubItems.length}, 启用子项: ${enabledSubItems.length}`);

                        // 🔧 修复：处理启用的子项
                        const processedSubItems = enabledSubItems.map(subItem => {
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

                        console.log(`[SmartPromptSystem] ✅ 添加自定义面板: ${panelId}, 启用子项数量: ${processedSubItems.length}/${allSubItems.length}`);
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
                    // 🔧 修复：显示现有数据时，对交互面板进行格式规范化
                    if (panelId === 'interaction') {
                        // 对交互面板数据进行格式检查和规范化显示
                        const normalizedEntries = [];
                        dataEntries.forEach(([key, value]) => {
                            const displayValue = this.formatDataValue(value);
                            // 检查是否已经是正确的 npc 前缀格式
                            if (key.match(/^npc\d+\./)) {
                                // 已经是正确格式，直接显示
                                normalizedEntries.push(`${key}: ${displayValue}`);
                            } else {
                                // 错误格式，规范化为 npc0 前缀并添加警告
                                normalizedEntries.push(`${key}: ${displayValue} (原始键)`);
                            }
                        });
                        normalizedEntries.forEach(entry => dataInfoParts.push(entry));

                        // 添加格式提醒
                        dataInfoParts.push('🚨 注意：交互面板数据请使用操作指令多行格式（add/update；数字列）！');
                    } else {
                        // 非交互面板，正常显示
                        dataEntries.forEach(([key, value]) => {
                            const displayValue = this.formatDataValue(value);
                            dataInfoParts.push(`${key}: ${displayValue}`);
                        });
                    }
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
     * 🚀 新增：生成包含记忆增强的数据对照信息
     */
    async generateMemoryEnhancedDataInfo(memoryEnhancedData, updateStrategy) {
        try {
            console.log('[SmartPromptSystem] 🧠 生成记忆增强数据对照信息...');

            // 安全解构，提供默认值
            const {
                current = {},
                historical = {},
                persistent = {},
                context = {},
                metadata = {}
            } = memoryEnhancedData || {};

            // 获取所有启用的面板列表
            const enabledPanels = await this.getEnabledPanels();

            if (enabledPanels.length === 0) {
                return '【AI记忆增强数据】\n没有启用的面板。';
            }

            const dataInfoParts = ['【AI记忆增强数据 - 永不遗忘的剧情记忆】'];
            dataInfoParts.push(`聊天ID: ${metadata.chatId || 'unknown'}`);
            dataInfoParts.push(`数据覆盖率: ${updateStrategy?.dataPercentage || 0}% (${updateStrategy?.existingFields || 0}/${updateStrategy?.totalFields || 0}个字段)`);
            dataInfoParts.push(`更新策略: ${updateStrategy?.type === 'full' ? '全量更新' : '增量更新'} - ${updateStrategy?.reason || 'unknown'}`);
            dataInfoParts.push(`记忆深度: ${metadata.memoryDepth || 0}个历史记录`);
            dataInfoParts.push('');

            // 1. 当前数据状态（统一按新架构行视图展示，避免旧架构误导AI）
            dataInfoParts.push('【📊 当前数据状态（统一行视图）】');
            for (const panel of enabledPanels) {
                const panelId = panel.id;
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelName = this.getBasicPanelDisplayName(panelId);
                const panelData = current[panelKey] || current[panelId] || {};

                dataInfoParts.push(`${panelName}面板 (${panelId}): ${Object.keys(panelData).length > 0 ? '有数据' : '待生成'}`);

                if (Object.keys(panelData).length > 0) {
                    // 使用统一的新架构行格式展示
                    const normalizedRows = this.formatPanelRowsForPrompt(panel, panelData);
                    if (normalizedRows.length > 0) {
                        normalizedRows.forEach(line => dataInfoParts.push(`  ${line}`));
                    }
                }
            }
            dataInfoParts.push('');

            // 2. 历史记忆数据
            if (Object.keys(historical).length > 0) {
                dataInfoParts.push('【🧠 历史记忆 - 重要剧情发展】');
                for (const [panelKey, memoryEntries] of Object.entries(historical)) {
                    if (Array.isArray(memoryEntries) && memoryEntries.length > 0) {
                        const panelName = this.getBasicPanelDisplayName(panelKey);
                        dataInfoParts.push(`${panelName}面板历史:`);

                        // 显示最重要的3个历史记录
                        const sortedEntries = memoryEntries
                            .sort((a, b) => b.importance - a.importance)
                            .slice(0, 3);

                        sortedEntries.forEach((entry, index) => {
                            const timeAgo = this.formatTimeAgo(entry.timestamp);
                            dataInfoParts.push(`  ${index + 1}. ${timeAgo} (重要性: ${(entry.importance * 100).toFixed(0)}%)`);

                            // 显示关键数据变化 - 转换为新架构行视图格式
                            const keyChanges = Object.entries(entry.data).slice(0, 3);
                            keyChanges.forEach(([key, value]) => {
                                const displayValue = this.formatDataValue(value);
                                // 🔧 修复：将历史数据转换为新架构列号格式，避免误导AI
                                if (panelKey === 'interaction') {
                                    // 将旧的npc前缀格式转换为新架构描述，但不显示原始键名
                                    if (key.match(/^npc\d+\.(.+)$/)) {
                                        const match = key.match(/^npc(\d+)\.(.+)$/);
                                        const npcIndex = parseInt(match[1]) + 1; // 转为1-based行号
                                        const fieldName = match[2];
                                        const fieldDisplayName = this.getSubItemDisplayName(panelKey, fieldName);
                                        dataInfoParts.push(`     行${npcIndex}数据变化: ${fieldDisplayName} = ${displayValue}`);
                                    } else {
                                        // 未带前缀的字段，假设为行1
                                        const fieldDisplayName = this.getSubItemDisplayName(panelKey, key);
                                        dataInfoParts.push(`     行1数据变化: ${fieldDisplayName || key} = ${displayValue}`);
                                    }
                                } else {
                                    // 非交互面板，正常显示但使用友好的显示名
                                    const fieldDisplayName = this.getSubItemDisplayName(panelKey, key);
                                    dataInfoParts.push(`     ${fieldDisplayName || key}: ${displayValue}`);
                                }
                            });
                        });
                    }
                }
                dataInfoParts.push('');
            }

            // 3. 持久化记忆数据
            if (Object.keys(persistent).length > 0) {
                dataInfoParts.push('【🔒 持久化记忆 - 跨对话永久记忆】');
                for (const [panelKey, persistentData] of Object.entries(persistent)) {
                    const panelName = this.getBasicPanelDisplayName(panelKey);
                    dataInfoParts.push(`${panelName}面板持久化数据:`);

                    Object.entries(persistentData).forEach(([key, value]) => {
                        const displayValue = this.formatDataValue(value);
                        // 🔧 修复：将持久化数据转换为新架构友好格式，避免误导AI
                        if (panelKey === 'interaction') {
                            // 将旧的npc前缀格式转换为友好描述
                            if (key.match(/^npc\d+\.(.+)$/)) {
                                const match = key.match(/^npc(\d+)\.(.+)$/);
                                const npcIndex = parseInt(match[1]) + 1; // 转为1-based行号
                                const fieldName = match[2];
                                const fieldDisplayName = this.getSubItemDisplayName(panelKey, fieldName);
                                dataInfoParts.push(`  行${npcIndex}持久化字段: ${fieldDisplayName} = ${displayValue}`);
                            } else {
                                // 未带前缀的字段，使用友好显示名
                                const fieldDisplayName = this.getSubItemDisplayName(panelKey, key);
                                dataInfoParts.push(`  ${fieldDisplayName || key}: ${displayValue}`);
                            }
                        } else {
                            // 非交互面板，使用友好显示名
                            const fieldDisplayName = this.getSubItemDisplayName(panelKey, key);
                            dataInfoParts.push(`  ${fieldDisplayName || key}: ${displayValue}`);
                        }
                    });
                }
                dataInfoParts.push('');
            }

            // 4. 上下文信息
            if (Object.keys(context).length > 0) {
                dataInfoParts.push('【🌐 上下文信息】');

                if (context.character) {
                    dataInfoParts.push(`角色: ${context.character.name}`);
                    if (context.character.personality) {
                        dataInfoParts.push(`性格: ${context.character.personality.substring(0, 100)}...`);
                    }
                }

                if (context.recentMessages && context.recentMessages.length > 0) {
                    dataInfoParts.push('最近对话:');
                    context.recentMessages.slice(-2).forEach((msg, index) => {
                        const role = msg.role === 'user' ? '用户' : 'AI';
                        dataInfoParts.push(`  ${role}: ${msg.content.substring(0, 80)}...`);
                    });
                }

                if (context.worldInfo && context.worldInfo.length > 0) {
                    dataInfoParts.push(`世界书条目: ${context.worldInfo.length}个`);
                }
                dataInfoParts.push('');
            }

            // 5. AI指导说明
            dataInfoParts.push('【🤖 AI生成指导】');
            dataInfoParts.push('基于以上完整记忆数据，请：');
            dataInfoParts.push('1. 参考历史记忆，保持剧情连贯性');
            dataInfoParts.push('2. 尊重持久化记忆，确保角色设定一致');
            dataInfoParts.push('3. 结合上下文信息，生成符合当前情境的数据');
            dataInfoParts.push('4. 如果是增量更新，只修改确实需要变化的字段');
            dataInfoParts.push('5. 确保生成的数据与历史记忆逻辑一致');

            const result = dataInfoParts.join('\n');
            console.log(`[SmartPromptSystem] 🧠 记忆增强数据对照信息生成完成，长度: ${result.length}`);
            return result;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成记忆增强数据对照信息失败:', error);
            // 降级到原有方法
            return await this.generateCurrentDataInfo(memoryEnhancedData.current || {}, updateStrategy);
        }
    }

    /**
     * 🕒 格式化时间差显示
     */
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
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
     * 🚀 新增：将记忆增强数据添加到提示词最顶部
     * @param {string} memoryEnhancedDataInfo - 记忆增强数据信息
     * @param {string} promptTemplate - 提示词模板
     * @param {string|null} armorBreakingPrompt - 破甲提示词（可选）
     */
    addMemoryEnhancedDataToTop(memoryEnhancedDataInfo, promptTemplate, armorBreakingPrompt = null) {
        try {
            console.log('[SmartPromptSystem] 🧠 将AI记忆增强内容添加到提示词顶部...');

            // 🆕 构建最终的顶部内容数组
            const topContentParts = [];

            // 🛡️ 如果有破甲提示词，放在最顶部
            if (armorBreakingPrompt) {
                topContentParts.push(armorBreakingPrompt);
                topContentParts.push('');
                console.log('[SmartPromptSystem] 🛡️ 破甲提示词已添加到最顶部');
            }

            // 🧠 然后添加记忆增强内容
            topContentParts.push(
                '🧠🧠🧠【AI记忆增强系统 - 最高优先级阅读】🧠🧠🧠',
                '⚠️ 重要：在开始任何思考和生成之前，必须仔细阅读以下完整记忆内容 ⚠️',
                '',
                '┌─────────────────────────────────────────────────────────────┐',
                '│                    🧠 AI永久记忆数据库 🧠                    │',
                '│              请基于以下记忆进行剧情思考和生成                │',
                '└─────────────────────────────────────────────────────────────┘',
                '',
                memoryEnhancedDataInfo,
                '',
                '┌─────────────────────────────────────────────────────────────┐',
                '│                    📌 AI思考指导原则 📌                     │',
                '│                                                             │',
                '│ 1. 🎯 以上记忆内容是您思考和生成的核心基础                  │',
                '│ 2. 🔗 请基于这些记忆内容保持剧情连贯性和角色一致性          │',
                '│ 3. 📚 如果记忆中有相关信息，请优先参考和延续                │',
                '│ 4. ✅ 确保新生成的内容与历史记忆逻辑一致                    │',
                '│ 5. 🧠 在thinking阶段就要回忆和分析这些记忆内容              │',
                '│                                                             │',
                '└─────────────────────────────────────────────────────────────┘',
                '',
                '═══════════════════════════════════════════════════════════════',
                '                    开始正常提示词内容',
                '═══════════════════════════════════════════════════════════════',
                ''
            );

            // 构建完整的顶部内容
            const topMemoryContent = topContentParts.join('\n');

            // 将顶部内容放到提示词最顶部
            const enhancedPrompt = topMemoryContent + promptTemplate;

            console.log(`[SmartPromptSystem] 🧠 记忆增强内容已添加到顶部，总长度: ${enhancedPrompt.length}`);
            console.log(`[SmartPromptSystem] 🧠 记忆内容长度: ${memoryEnhancedDataInfo.length}`);

            return enhancedPrompt;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 添加记忆增强内容到顶部失败:', error);
            // 降级：如果失败，至少将记忆内容添加到开头
            return memoryEnhancedDataInfo + '\n\n' + promptTemplate;
        }
    }

    /**
     * 🆕 获取破甲提示词
     */
    async getArmorBreakingPrompt() {
        try {
            // 获取扩展设置
            const extensionSettings = this.context?.extensionSettings?.['Information bar integration tool'] || {};
            const apiConfig = extensionSettings.apiConfig || {};

            // 检查是否启用了破甲提示词
            if (!apiConfig.enableArmorBreaking) {
                return null;
            }

            // 获取破甲提示词内容
            const armorBreakingPrompt = apiConfig.armorBreakingPrompt;
            if (!armorBreakingPrompt || armorBreakingPrompt.trim() === '') {
                console.warn('[SmartPromptSystem] ⚠️ 破甲提示词已启用但内容为空');
                return null;
            }

            console.log('[SmartPromptSystem] 🛡️ 获取破甲提示词成功，长度:', armorBreakingPrompt.length);

            // 格式化破甲提示词
            const formattedPrompt = [
                '🚨🚨🚨🚨🚨 【ARMOR BREAKING PROMPT】 🚨🚨🚨🚨🚨',
                '',
                armorBreakingPrompt.trim(),
                '',
                '🚨🚨🚨🚨🚨 【END ARMOR BREAKING】 🚨🚨🚨🚨🚨',
                ''
            ].join('\n');

            return formattedPrompt;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取破甲提示词失败:', error);
            return null;
        }
    }

    /**
     * 🔧 保留：添加当前数据对照信息到提示词（降级使用）
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
        console.log('[SmartPromptSystem] 📝 生成面板数据模板（操作指令格式），面板数量:', enabledPanels.length);
        console.log('[SmartPromptSystem] 🔍 面板列表:', enabledPanels.map(p => `${p.id}(${p.type})`));

        const templateParts = [];

        for (const panel of enabledPanels) {
            // 自定义面板使用 key；基础面板使用 id
            const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
            const subItems = Array.isArray(panel.subItems) ? panel.subItems : [];
            console.log(`[SmartPromptSystem] 处理面板: ${panel.id} (键名: ${panelKey}), 子项数量: ${subItems.length}`);

            // 使用操作指令多行数据模板：按子项顺序映射为数字列 1..N
            const colPairs = subItems.map((subItem, idx) => {
                const display = this.getSubItemDisplayName(panel.id, subItem.key);
                const colIndex = idx + 1; // 列号从1开始
                return `"${colIndex}","${display}"`;
            });

            if (colPairs.length > 0) {
                const line = `add ${panelKey}(1 {${colPairs.join(', ')}})`; // 行号1：现有/首行
                templateParts.push(line);
                console.log(`[SmartPromptSystem] 面板模板: ${line}`);
            } else {
                console.warn(`[SmartPromptSystem] ⚠️ 面板 ${panelKey} 没有有效的子项模板，跳过生成`);
            }
        }

        const result = templateParts.join('\n');
        console.log('[SmartPromptSystem] 生成的面板数据模板（操作指令）:', result);
        return result;
    }








    /**
     * 获取子项显示名称 - 使用统一的完整映射表
     */
    getSubItemDisplayName(panelId, subItemKey) {
        try {
            // 🔧 修复：使用正确的路径访问InfoBarSettings
            const infoBarTool = window.SillyTavernInfobar;
            const infoBarSettings = infoBarTool?.modules?.infoBarSettings || infoBarTool?.modules?.settings;

            if (infoBarSettings && infoBarSettings.getCompleteDisplayNameMapping) {
                const completeMapping = infoBarSettings.getCompleteDisplayNameMapping();
                const panelMapping = completeMapping[panelId];
                if (panelMapping && panelMapping[subItemKey]) {
                    console.log(`[SmartPromptSystem] ✅ 映射字段: ${panelId}.${subItemKey} => ${panelMapping[subItemKey]}`);
                    return panelMapping[subItemKey];
                }
            }

            // 如果没有映射，返回原始键名
            console.warn(`[SmartPromptSystem] ⚠️ 未找到字段映射: ${panelId}.${subItemKey}`);
            return subItemKey;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取子项显示名称失败:', error);
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

        // 🚀 新增：检查是否为自定义API模式，需要加强格式约束
        const isCustomAPIMode = this.getOutputMode() === '自定义API';

        if (isIncrementalUpdate) {
            // 增量更新模式：输出简化的约束说明
            console.log('[SmartPromptSystem] 🔄 增量更新模式，使用简化字段约束');

            let simplifiedConstraint = `

【📋 增量更新模式约束】
⚠️ 只输出发生变化的字段，保持未变化字段不输出
⚠️ 严禁添加未启用的面板或字段
⚠️ 严禁使用custom_field_开头的字段

【✅ 数据输出格式（统一要求）】
- 必须使用"操作指令格式"：add / update / delete
- 列号必须为纯数字（1,2,3, ...），对应面板子项顺序
- 行号规则：第1行代表现有数据；新增从第2行开始
- 内容必须位于 <infobar_data><!-- ... --></infobar_data> 注释内部

【示例】
- update personal(1 {"4","办公室","5","工作中"})
- add interaction(1 {"1","小雨","2","同事","3","友好","4","询问进度"})
- delete tasks(2)`;

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
                constraintText += `\n⚠️ 使用操作指令多行格式：add/update/delete；列号为纯数字（1,2,3...），按字段顺序对应\n📋 可用字段：`;

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
❌ **严禁使用custom_field_开头的字段**（如：custom_field_1234567890等）
❌ **严禁使用占位符**（如："未知"、"N/A"、"待补全"）
❌ **🚨 严禁创建新面板**（如：add newpanel(1 {...})、add custom_panel(1 {...})等）
❌ **🚨 严禁操作未启用的面板**（只能操作上述列表中的面板）
❌ **🚨 严禁添加新字段或超出列号范围**（列号必须在1到字段数量范围内）

**✅ 正确做法：**
- 每个面板严格按照上述列表输出字段
- 字段数量必须与用户启用的字段数量一致
- 使用确切的中文字段名和值
- **🔥 只能使用UPDATE/ADD/DELETE操作已启用的面板和字段**
- **🔥 列号必须在有效范围内，不能超出启用字段的数量**`;

        // 如果有交互对象面板，添加动态NPC格式说明
        if (interactionFields.length > 0) {
            constraintText += `

【🎭 交互对象NPC格式规则 - 严禁信息混合】
🚨🚨🚨 **最重要规则：绝对禁止将多个NPC信息混合在一个字段中！** 🚨🚨🚨

🚨 **重要：交互对象面板专用于NPC角色，绝不能填入用户角色信息！** 🚨

🎭 **NPC角色识别指南（必须严格遵守）**：
- 对话中除用户外的所有其他角色
- 用户交互的对象（朋友、同事、陌生人、敌人等）
- 剧情中出现的所有非玩家角色
- 当用户说"你"时指代的对象（用户→NPC方向）
- 当其他角色自称"我"时的角色（NPC自述）
- 任何不是用户本人的角色都属于NPC

🙋 **用户角色识别指南（绝不能填入交互对象面板）**：
- 对话中的用户本人，即玩家操控的主角
- 第一人称："我"、"我的"、"我在"（用户自述）
- 当AI对用户说话时的第二人称："你"、"你的"（AI→用户方向）
- 明确的用户角色名称或用户设定的角色身份

📋 数据格式：使用操作指令多行格式：add interaction(行号 {"1","姓名","2","关系",...})
列号为纯数字(1,2,3,...)，按面板字段顺序依次对应

🚨🚨🚨 **关键要求：每个NPC必须输出完整的字段数据！** 🚨🚨🚨
⚠️ **绝对禁止只为第一个NPC输出完整数据，其他NPC输出不完整数据！**
⚠️ **每个NPC都必须包含所有相关的字段信息！**
⚠️ **如果某个NPC缺少某个字段的信息，请输出"未知"或"暂无"，不能省略字段！**

🔴 **严禁的错误格式（信息混合）** 🔴
❌ [WRONG_FORMAT_MIXING] ← 绝对禁止！
❌ [WRONG_FORMAT_MIXING] ← 绝对禁止！
❌ [WRONG_FORMAT_MIXING] ← 绝对禁止！
❌ [WRONG_FORMAT_MIXING] ← 绝对禁止！

🔴 **严禁的错误格式（数据不完整）** 🔴
❌ add interaction(1 {"1","角色1","2","类型1","3","状态1"}), add interaction(2 {"1","角色2"}) ← 错误！第二条缺少必要列！
❌ 只为第一个NPC输出完整字段，其他NPC字段不完整 ← 严重错误！

✅ **正确格式（NPC分离且数据完整）** ✅
✅ add interaction(1 {"1","角色1","2","类型1","3","状态1"})，add interaction(2 {"1","角色2","2","类型2","3","状态2"})
✅ 每个NPC都必须包含相同的字段集合，确保数据完整性

可用字段: ${interactionFields.join(', ')}

✅ 正确示例（NPC角色信息 - 每个NPC都有完整字段）:
- add interaction(1 {"1","奥兰多教授","2","教授","3","友善","4","导师","5","尊敬","6","长期指导学习"})
- add interaction(2 {"1","马尔科姆","2","学生","3","冷淡","4","同学","5","疏远","6","课堂上有过争执"})
- add interaction(3 {"1","瓦里安血棘","2","战士","3","敌对","4","敌人","5","仇恨","6","多次战斗冲突"})

🚨 **注意：每个NPC都必须包含相同的字段集合！如果某个字段没有信息，使用"未知"或"暂无"填充！**

❌ 错误示例（用户角色信息误填入交互对象）:
- add interaction(1 {"1","用户角色名","4","自己"}) ← 这是错误的！
- add interaction(1 {"1","我","3","自信"}) ← 用户信息不应出现在交互对象面板！

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

            // 🔧 修复：检查插件是否启用，默认为启用状态
            const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
            const basicSettings = extensionSettings.basic || {};
            const integrationSystemSettings = basicSettings.integrationSystem || {};
            const isPluginEnabled = integrationSystemSettings.enabled !== false; // 默认为true，只有明确设置为false才禁用

            if (!isPluginEnabled) {
                console.log('[SmartPromptSystem] ℹ️ 插件已禁用，跳过提示词注入');
                return;
            }

            console.log('[SmartPromptSystem] ✅ 插件已启用，继续提示词注入流程');

            // 🧠 检查智能提示词系统是否启用
            const promptSettings = extensionSettings.promptSettings || {};
            const isSmartPromptEnabled = this.enabled && promptSettings.mode !== 'custom';

            if (!isSmartPromptEnabled) {
                console.log('[SmartPromptSystem] ℹ️ 智能提示词系统已禁用或使用自定义提示词模式，跳过智能提示词注入');

                // 如果使用自定义提示词模式，注入自定义提示词
                if (promptSettings.mode === 'custom' && promptSettings.customContent) {
                    await this.injectCustomPrompt(promptSettings.customContent);
                }

                return;
            }

            console.log('[SmartPromptSystem] ✅ 智能提示词系统已启用，继续智能提示词注入流程');

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
                console.log('[SmartPromptSystem] 📨 检测到AI消息，检查是否需要解析数据...');

                // 🔧 新增：检查插件是否启用
                const extensionSettings = this.context.extensionSettings['Information bar integration tool'] || {};
                const basicSettings = extensionSettings.basic || {};
                const integrationSystemSettings = basicSettings.integrationSystem || {};
                const isPluginEnabled = integrationSystemSettings.enabled !== false;

                if (!isPluginEnabled) {
                    console.log('[SmartPromptSystem] ℹ️ 插件已禁用，跳过AI消息数据解析');
                    return;
                }

                console.log('[SmartPromptSystem] ✅ 插件已启用，开始解析AI消息数据...');

                // 🔧 修复：获取最新的消息内容，而不是依赖事件传递的旧数据
                let messageContent = data.mes;

                // 尝试从聊天记录中获取最新的AI消息内容
                if (this.context.chat && Array.isArray(this.context.chat) && this.context.chat.length > 0) {
                    const latestAIMessage = this.context.chat.slice().reverse().find(msg => !msg.is_user);
                    if (latestAIMessage && latestAIMessage.mes) {
                        console.log('[SmartPromptSystem] 🔄 使用聊天记录中的最新AI消息内容');
                        messageContent = latestAIMessage.mes;
                    }
                }

                console.log('[SmartPromptSystem] 📊 消息内容长度:', messageContent?.length || 0);
                console.log('[SmartPromptSystem] 🔍 是否包含infobar_data标签:', messageContent?.includes('<infobar_data>') || false);

                // 解析AI返回的数据
                const parsedData = this.dataParser.parseAIResponse(messageContent);

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

            // 🚨 新增：严格格式验证
            const formatValidation = this.validateDataFormat(dataContent);
            if (!formatValidation.isValid) {
                console.error('[SmartPromptSystem] ❌ 数据格式验证失败!');
                console.error('[SmartPromptSystem] ❌ 错误详情:', formatValidation.errors);
                console.error('[SmartPromptSystem] 🚨 系统拒绝处理错误格式的数据!');

                // 🚨 重要：直接返回null，不进行任何兼容性处理
                return null;
            }

            // 🚀 新增：检查是否是操作指令格式，优先使用XMLDataParser
            const xmlDataParser = window.SillyTavernInfobar?.modules?.xmlDataParser;
            if (xmlDataParser && xmlDataParser.isOperationCommandFormat && xmlDataParser.isOperationCommandFormat(dataContent)) {
                console.log('[SmartPromptSystem] 🚀 检测到操作指令格式，使用XMLDataParser解析');
                const operationResult = xmlDataParser.parseOperationCommands(dataContent);
                if (operationResult && operationResult.__format === 'operation_commands') {
                    console.log('[SmartPromptSystem] ✅ 操作指令解析成功，操作数量:', operationResult.__operations?.length || 0);
                    return operationResult;
                }
            }

            // 解析扁平格式数据（传统格式）
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
     * 解析扁平格式数据 - 支持新的操作指令格式
     */
    parseFlatFormatData(dataContent) {
        try {
            console.log('[SmartPromptSystem] 🔍 开始解析数据内容...');
            console.log('[SmartPromptSystem] 📝 数据内容:', dataContent);

            // 检测数据格式类型
            const formatType = this.detectDataFormat(dataContent);
            console.log('[SmartPromptSystem] 🔍 检测到数据格式类型:', formatType);

            if (formatType === 'operation_commands') {
                // 新的操作指令格式
                return this.parseOperationCommands(dataContent);
            } else if (formatType === 'modern_chinese') {
                // 新的中文字段名格式
                return this.parseModernChineseFormat(dataContent);
            } else if (formatType === 'key_value_chinese') {
                // 键值对格式（支持中文键名）
                return this.parseKeyValueChineseFormat(dataContent);
            } else {
                console.warn('[SmartPromptSystem] ⚠️ 未识别的数据格式，仅支持新的操作指令格式');
                console.warn('[SmartPromptSystem] 📝 数据内容预览:', dataContent.substring(0, 200));
                return null;
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析扁平格式数据失败:', error);
            return null;
        }
    }

    /**
     * 检测数据格式类型
     */
    detectDataFormat(dataContent) {
        const lines = dataContent.split('\n').filter(line => line.trim());

        // 🚨 新增：检查是否包含禁止的错误格式
        const forbiddenPatterns = [
            /"\d+\.[^"]+"\s*:\s*"[^"]+"/,  // "1.人类种族":"已选择"
            /"\d+"\s*:\s*"[^"]+"/,         // "1":"值1"
            /"[^"]+"\s*:\s*"[^"]+"/,       // "角色":"张三"
            /\{\s*"[^"]+"\s*:\s*"[^"]+"\s*\}/  // {"key":"value"}
        ];

        const hasForbiddenFormat = lines.some(line =>
            forbiddenPatterns.some(pattern => pattern.test(line.trim()))
        );

        if (hasForbiddenFormat) {
            console.error('[SmartPromptSystem] 🚨 检测到禁止的错误格式！');
            console.error('[SmartPromptSystem] 📝 错误内容:', dataContent.substring(0, 200));
            return 'forbidden_format';
        }

        // 检查是否包含操作指令格式（新格式优先）- 支持大小写
        const operationPattern = /^(add|update|delete|ADD|UPDATE|DELETE)\s+\w+\(/i;
        const hasOperationCommands = lines.some(line => operationPattern.test(line.trim()));

        if (hasOperationCommands) {
            console.log('[SmartPromptSystem] ✅ 检测到操作指令格式');
            return 'operation_commands';
        }

        // 🔧 新增：检查是否是新的中文字段名格式
        const modernChinesePattern = /^[\u4e00-\u9fff]+:\s*[\u4e00-\u9fff\w\s]+=/;
        const hasModernChineseFormat = lines.some(line => modernChinesePattern.test(line.trim()));

        if (hasModernChineseFormat) {
            return 'modern_chinese';
        }

        // 🔧 修复：检查是否是键值对格式（排除旧XML格式）
        const keyValuePattern = /^[\u4e00-\u9fff\w]+\s*[:=]\s*[^"'<>=,]+$/;
        const hasKeyValueFormat = lines.some(line => {
            const trimmed = line.trim();
            // 🚨 重要：排除旧格式（包含引号、逗号、XML标签的行）
            if (trimmed.includes('="') || trimmed.includes("='") ||
                trimmed.includes('<') || trimmed.includes('>') ||
                trimmed.includes(',') || trimmed.includes('npc')) {
                return false;
            }
            return keyValuePattern.test(trimmed);
        });

        if (hasKeyValueFormat) {
            console.log('[SmartPromptSystem] ✅ 检测到纯键值对格式（非旧XML格式）');
            return 'key_value_chinese';
        }

        // 🚨 已移除旧XML格式支持 - 强制使用新的操作指令格式

        // 🔧 新增：检查是否是JSON对象格式
        if (dataContent.trim().startsWith('{') && dataContent.trim().endsWith('}')) {
            try {
                JSON.parse(dataContent);
                return 'json_object';
            } catch (e) {
                // 不是有效JSON，继续检查其他格式
            }
        }

        console.warn('[SmartPromptSystem] ⚠️ 未识别的数据格式，内容预览:', dataContent.substring(0, 100));
        return 'unknown';
    }

    /**
     * 🚨 已废弃：旧格式兼容性解析（建议移除）
     * ⚠️ 此函数解析旧的 "面板名: 字段名=值" 格式，应该强制使用操作指令格式
     */
    parseModernChineseFormat(dataContent) {
        try {
            console.warn('[SmartPromptSystem] ⚠️ 检测到旧格式数据，建议使用操作指令格式...');
            console.warn('[SmartPromptSystem] 🔧 建议格式: add personal(1 {"1","张三","2","25"})');

            const result = {};
            const lines = dataContent.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue;
                }

                // ⚠️ 兼容旧格式：面板名: 字段名=值 （建议废弃）
                const match = trimmedLine.match(/^(.+?):\s*(.+?)=(.+)$/);
                if (match) {
                    const [, panelName, fieldName, value] = match;
                    const cleanPanelName = panelName.trim();
                    const cleanFieldName = fieldName.trim();
                    const cleanValue = value.trim();

                    if (!result[cleanPanelName]) {
                        result[cleanPanelName] = {};
                    }
                    result[cleanPanelName][cleanFieldName] = cleanValue;

                    console.log(`[SmartPromptSystem] ✅ 解析中文格式: ${cleanPanelName}.${cleanFieldName}=${cleanValue}`);
                }
            }

            console.log(`[SmartPromptSystem] ✅ 中文格式解析完成，解析了 ${Object.keys(result).length} 个面板`);
            return result;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析中文格式失败:', error);
            return {};
        }
    }

    /**
     * 🚀 解析键值对中文格式
     */
    parseKeyValueChineseFormat(dataContent) {
        try {
            console.log('[SmartPromptSystem] 🚀 开始解析键值对中文格式...');

            // 🚨 严格验证：检查是否包含旧格式特征
            if (dataContent.includes('="') || dataContent.includes("='") ||
                dataContent.includes('npc0.') || dataContent.includes('npc1.') ||
                dataContent.includes('<') || dataContent.includes('>') ||
                dataContent.includes('personal:') || dataContent.includes('world:') ||
                dataContent.includes('interaction:')) {
                console.error('[SmartPromptSystem] 🚨 检测到旧格式特征，拒绝解析键值对格式');
                console.error('[SmartPromptSystem] 🚨 数据内容预览:', dataContent.substring(0, 200));
                return null;
            }

            const result = {};
            const lines = dataContent.split('\n').filter(line => line.trim());
            let currentPanel = 'default';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue;
                }

                // 🚨 二次验证：每行都检查旧格式特征
                if (trimmedLine.includes('="') || trimmedLine.includes("='") ||
                    trimmedLine.includes('npc') || trimmedLine.includes(',') ||
                    trimmedLine.includes('<') || trimmedLine.includes('>')) {
                    console.warn('[SmartPromptSystem] ⚠️ 跳过疑似旧格式的行:', trimmedLine);
                    continue;
                }

                // 匹配格式：字段名: 值 或 字段名=值（但排除复杂值）
                const colonMatch = trimmedLine.match(/^(.+?):\s*([^"'<>=,]+)$/);
                const equalsMatch = trimmedLine.match(/^(.+?)=([^"'<>=,]+)$/);

                if (colonMatch || equalsMatch) {
                    const match = colonMatch || equalsMatch;
                    const [, fieldName, value] = match;
                    const cleanFieldName = fieldName.trim();
                    const cleanValue = value.trim();

                    if (!result[currentPanel]) {
                        result[currentPanel] = {};
                    }
                    result[currentPanel][cleanFieldName] = cleanValue;

                    console.log(`[SmartPromptSystem] ✅ 解析键值对: ${currentPanel}.${cleanFieldName}=${cleanValue}`);
                }
            }

            console.log(`[SmartPromptSystem] ✅ 键值对格式解析完成，解析了 ${Object.keys(result).length} 个面板`);
            return result;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析键值对格式失败:', error);
            return {};
        }
    }

    /**
     * 🚀 解析操作指令格式
     */
    parseOperationCommands(dataContent) {
        try {
            console.log('[SmartPromptSystem] 🚀 开始解析操作指令格式...');

            const operations = [];
            const lines = dataContent.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue; // 跳过空行和注释
                }

                const operation = this.parseOperationCommand(trimmedLine);
                if (operation) {
                    operations.push(operation);
                    console.log(`[SmartPromptSystem] ✅ 解析操作指令:`, operation);
                }
            }

            console.log(`[SmartPromptSystem] ✅ 解析了 ${operations.length} 个操作指令`);

            return {
                operations,
                format: 'operation_commands',
                metadata: {
                    timestamp: Date.now(),
                    source: 'ai-message',
                    operationCount: operations.length
                }
            };

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析操作指令失败:', error);
            return null;
        }
    }

    /**
     * 🔧 解析单个操作指令
     * 格式：add persona(1 {1，张三，2，24，3，程序员}) - 支持大小写
     */
    parseOperationCommand(commandLine) {
        try {
            // 正则表达式匹配操作指令格式 - 支持大小写
            const operationRegex = /^(add|update|delete|ADD|UPDATE|DELETE)\s+(\w+)\((\d+)(?:\s*\{([^}]*)\})?\)$/i;
            const match = commandLine.match(operationRegex);

            if (!match) {
                console.warn(`[SmartPromptSystem] ⚠️ 无法解析操作指令: ${commandLine}`);
                return null;
            }

            const [, operation, panelName, rowNumber, dataParams] = match;

            // 🚨 新增：严格验证面板名称是否在支持列表中
            if (!this.isValidPanelName(panelName)) {
                const errorMsg = `🚨🚨🚨 CRITICAL ERROR: AI尝试操作不存在的面板 "${panelName}"！
❌ 禁止操作：AI不能创建新面板或操作未启用的面板
✅ 允许的面板：请查看启用的面板列表
🚨 系统拒绝此操作以防止数据污染！`;

                console.error('[SmartPromptSystem] 🚨 面板验证失败:', errorMsg);
                throw new Error(errorMsg);
            }

            const operationData = {
                type: operation.toLowerCase(), // 统一转换为小写
                panel: panelName,
                row: parseInt(rowNumber),
                data: {}
            };

            console.log(`[SmartPromptSystem] 🔍 解析指令: ${operation.toUpperCase()} ${panelName}(${rowNumber})`);

            // 解析数据参数（如果存在）
            if (dataParams && dataParams.trim()) {
                operationData.data = this.parseDataParameters(dataParams);

                // 🚨 新增：验证字段是否在允许的字段列表中
                if (!this.validatePanelFields(panelName, operationData.data)) {
                    const errorMsg = `🚨🚨🚨 CRITICAL ERROR: AI尝试在面板 "${panelName}" 中使用不存在的字段！
❌ 禁止操作：AI不能创建新字段或使用未启用的字段
🚨 系统拒绝此操作以防止数据污染！`;

                    console.error('[SmartPromptSystem] 🚨 字段验证失败:', errorMsg);
                    throw new Error(errorMsg);
                }
            }

            return operationData;

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 解析操作指令失败: ${commandLine}`, error);
            throw error; // 重新抛出错误，确保上层能够捕获
        }
    }

    /**
     * 🔧 解析数据参数
     * 格式："1"，"张三"，"2"，"24"，"3"，"程序员"
     */
    parseDataParameters(dataParams) {
        try {
            const data = {};
            const parts = dataParams.split('，').map(part => part.trim());

            // 按照 "列号"，"值"，"列号"，"值" 的格式解析
            for (let i = 0; i < parts.length; i += 2) {
                if (i + 1 < parts.length) {
                    // 移除双引号并解析列号
                    const columnStr = parts[i].replace(/^"(.*)"$/, '$1');
                    const valueStr = parts[i + 1].replace(/^"(.*)"$/, '$1');

                    // 🔧 修复：支持多种列号格式的容错处理
                    let columnNumber;

                    // 情况1：纯数字格式 "2" -> 2
                    if (/^\d+$/.test(columnStr)) {
                        columnNumber = parseInt(columnStr);
                        console.log(`[SmartPromptSystem] ✅ 标准格式: "${columnStr}" -> 列${columnNumber}`);
                    }
                    // 情况2：col_格式 "col_2" -> 2
                    else if (/^col_\d+$/.test(columnStr)) {
                        columnNumber = parseInt(columnStr.replace('col_', ''));
                        console.log(`[SmartPromptSystem] 🔧 容错处理: "${columnStr}" -> 列${columnNumber}`);
                    }
                    // 情况3：其他可能的格式
                    else {
                        // 尝试提取数字
                        const numberMatch = columnStr.match(/\d+/);
                        if (numberMatch) {
                            columnNumber = parseInt(numberMatch[0]);
                            console.log(`[SmartPromptSystem] 🔧 智能提取: "${columnStr}" -> 列${columnNumber}`);
                        } else {
                            console.warn(`[SmartPromptSystem] ❌ 无法解析列号: "${columnStr}"`);
                            continue;
                        }
                    }

                    if (!isNaN(columnNumber) && valueStr !== undefined) {
                        // 🚨 修复：直接使用列号作为key，不添加前缀
                        data[columnNumber.toString()] = valueStr;
                        console.log(`[SmartPromptSystem] 📊 解析参数: 列${columnNumber} = "${valueStr}"`);
                    } else {
                        console.warn(`[SmartPromptSystem] ⚠️ 无效参数: "${parts[i]}" -> "${parts[i + 1]}"`);
                    }
                }
            }

            return data;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 解析数据参数失败:', error);
            return {};
        }
    }

    /**
     * 🚨 已禁用：旧XML格式解析（强制使用新格式）
     */
    parseLegacyXMLFormat(dataContent) {
        console.error('[SmartPromptSystem] 🚨 检测到旧XML格式数据解析尝试');
        console.error('[SmartPromptSystem] 📝 数据内容:', dataContent.substring(0, 200));
        console.error('[SmartPromptSystem] 💡 旧XML格式已被完全禁用，请使用操作指令格式');
        console.error('[SmartPromptSystem] ✅ 正确格式: add interaction(1 {"1","张三","2","朋友","3","友好"})');

        return {
            panels: {},
            format: 'legacy_xml_disabled',
            error: '旧XML格式已被禁用，请使用操作指令格式',
            metadata: {
                timestamp: Date.now(),
                source: 'ai-message',
                panelCount: 0
            }
        };
    }

    /**
     * 🚨 处理禁止的错误格式
     */
    handleForbiddenFormat(dataContent) {
        console.error('[SmartPromptSystem] 🚨 检测到禁止的错误格式！');
        console.error('[SmartPromptSystem] 📝 错误内容:', dataContent);
        console.error('[SmartPromptSystem] ❌ 禁止格式示例: {"1.人类种族":"已选择"}');
        console.error('[SmartPromptSystem] ✅ 正确格式示例: add fantasy(1 {"1","人类种族","2","精灵种族"})');

        // 显示用户友好的错误提示
        this.showFormatErrorNotification();

        return {
            panels: {},
            format: 'forbidden',
            error: '检测到禁止的格式！请使用操作指令格式：add 面板名(行号 {"列号","值"})',
            metadata: {
                timestamp: Date.now(),
                source: 'ai-message',
                panelCount: 0,
                errorType: 'forbidden_format'
            }
        };
    }

    /**
     * 显示格式错误通知
     */
    showFormatErrorNotification() {
        try {
            // 尝试显示用户友好的错误提示
            if (typeof toastr !== 'undefined') {
                toastr.error('AI返回了错误的数据格式！请检查自定义API配置。', '格式错误', {
                    timeOut: 10000,
                    extendedTimeOut: 5000
                });
            } else {
                console.error('[SmartPromptSystem] 🚨 格式错误：AI返回了禁止的数据格式');
            }
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 显示错误通知失败:', error);
        }
    }

    /**
     * 🚨 已弃用：通用格式解析（强制使用新格式）
     */
    parseGenericFormat(dataContent) {
        console.warn('[SmartPromptSystem] 🚨 检测到未支持的数据格式');
        console.warn('[SmartPromptSystem] 📝 请使用操作指令格式：add/update/delete 面板名(行号 {"列号","值"})');
        console.warn('[SmartPromptSystem] 💡 示例：add interaction(1 {"1","张三","2","朋友","3","友好"})');

        return {
            panels: {},
            format: 'unsupported',
            error: '不支持的数据格式，请使用操作指令格式',
            metadata: {
                timestamp: Date.now(),
                source: 'ai-message',
                panelCount: 0
            }
        };
    }

    /**
     * 🚨 已弃用：旧格式字段解析（不再支持）
     */
    parseFieldsString(fieldsStr, panelData) {
        console.warn('[SmartPromptSystem] 🚨 检测到尝试解析旧格式字段');
        console.warn('[SmartPromptSystem] 📝 字段内容:', fieldsStr);
        console.warn('[SmartPromptSystem] 💡 请使用新的操作指令格式：add/update/delete 面板名(行号 {"列号","值"})');
        console.error('[SmartPromptSystem] ❌ 旧格式字段解析已被禁用，请更新AI提示词模板');

        // 不执行任何解析，直接返回
        return;
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
     * 🚨 验证面板名称是否有效（严格模式）
     * @param {string} panelName - 面板名称
     * @returns {boolean} 是否为有效的面板名称
     */
    isValidPanelName(panelName) {
        if (!panelName || typeof panelName !== 'string') {
            return false;
        }

        // 获取当前启用的面板列表
        const enabledPanels = this.getEnabledPanelIds();
        const isValid = enabledPanels.includes(panelName);

        if (!isValid) {
            console.error(`[SmartPromptSystem] 🚨 面板名称验证失败: "${panelName}"`);
            console.error(`[SmartPromptSystem] 📋 当前启用的面板: ${enabledPanels.join(', ')}`);
        }

        return isValid;
    }

    /**
     * 🚨 验证面板字段是否有效（严格模式）
     * @param {string} panelName - 面板名称
     * @param {Object} fieldData - 字段数据
     * @returns {boolean} 是否所有字段都有效
     */
    validatePanelFields(panelName, fieldData) {
        try {
            if (!fieldData || typeof fieldData !== 'object') {
                return true; // 空数据认为是有效的
            }

            // 获取面板的启用字段配置
            const enabledFields = this.getEnabledFieldsForPanel(panelName);
            if (!enabledFields || enabledFields.length === 0) {
                console.warn(`[SmartPromptSystem] ⚠️ 无法获取面板 "${panelName}" 的字段配置，跳过字段验证`);
                return true; // 如果无法获取配置，暂时允许通过
            }

            // 检查每个字段是否在允许列表中
            const fieldKeys = Object.keys(fieldData);
            const invalidFields = [];

            for (const fieldKey of fieldKeys) {
                // 字段key应该是数字（列号）
                const columnIndex = parseInt(fieldKey);
                if (isNaN(columnIndex) || columnIndex < 1 || columnIndex > enabledFields.length) {
                    invalidFields.push(`列号${fieldKey}(超出范围1-${enabledFields.length})`);
                }
            }

            if (invalidFields.length > 0) {
                console.error(`[SmartPromptSystem] 🚨 面板 "${panelName}" 包含无效字段: ${invalidFields.join(', ')}`);
                console.error(`[SmartPromptSystem] 📋 允许的列号范围: 1-${enabledFields.length}`);
                console.error(`[SmartPromptSystem] 📋 启用的字段: ${enabledFields.map((f, i) => `${i+1}.${f.key}`).join(', ')}`);
                return false;
            }

            return true;

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 验证面板字段失败: ${panelName}`, error);
            return false; // 验证失败时拒绝
        }
    }

    /**
     * 🚨 获取当前启用的面板ID列表
     * @returns {Array} 启用的面板ID列表
     */
    getEnabledPanelIds() {
        try {
            // 获取当前启用的面板配置
            const enabledPanels = this.getEnabledPanels();
            return enabledPanels.map(panel => {
                // 自定义面板使用key，基础面板使用id
                return (panel.type === 'custom' && panel.key) ? panel.key : panel.id;
            });

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 获取启用面板ID失败:`, error);
            return [];
        }
    }

    /**
     * 🚨 获取面板的启用字段列表
     * @param {string} panelName - 面板名称
     * @returns {Array} 启用的字段列表
     */
    getEnabledFieldsForPanel(panelName) {
        try {
            // 获取当前启用的面板配置
            const enabledPanels = this.getEnabledPanels();

            // 查找对应的面板配置
            const panelConfig = enabledPanels.find(panel => {
                const panelKey = (panel.type === 'custom' && panel.key) ? panel.key : panel.id;
                return panelKey === panelName;
            });

            if (!panelConfig || !panelConfig.subItems) {
                console.warn(`[SmartPromptSystem] ⚠️ 无法获取面板 "${panelName}" 的配置`);
                return null;
            }

            // 返回启用的字段
            return panelConfig.subItems.filter(item => item.enabled !== false);

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 获取面板字段配置失败: ${panelName}`, error);
            return null;
        }
    }

    /**
     * 🚀 更新数据到数据核心 - 支持操作指令格式
     */
    async updateDataCore(parsedData) {
        try {
            console.log('[SmartPromptSystem] 💾 开始更新数据到数据核心...');
            console.log('[SmartPromptSystem] 📊 解析数据格式:', parsedData?.format || parsedData?.__format);

            if (!parsedData) {
                console.warn('[SmartPromptSystem] ⚠️ 没有有效的解析数据');
                return;
            }

            // 获取当前角色ID（更稳健）：优先SillyTavern上下文，其次window.this_chid，最后default
            let characterId = this.context.characterId || window.this_chid || 'default';
            if (typeof characterId === 'number') characterId = String(characterId);
            if (!characterId || characterId === 'null' || characterId === 'undefined') {
                characterId = 'default';
            }

            // 🔧 修复：支持两种格式字段名
            const dataFormat = parsedData.format || parsedData.__format;
            const operations = parsedData.operations || parsedData.__operations;

            // 根据数据格式选择处理方式
            if (dataFormat === 'operation_commands' && operations) {
                // 新的操作指令格式
                console.log('[SmartPromptSystem] 🚀 处理操作指令格式，操作数量:', operations.length);
                await this.executeOperationCommands(operations, characterId);
            } else if (parsedData.panels) {
                // 旧的面板格式（向后兼容）
                await this.updateLegacyPanelData(parsedData.panels, characterId);
            } else {
                // 🔧 修复：检查是否是操作指令格式但被错误处理的情况
                if (dataFormat === 'operation_commands') {
                    console.warn('[SmartPromptSystem] ⚠️ 操作指令格式但缺少operations字段');
                } else {
                    console.warn('[SmartPromptSystem] ⚠️ 未识别的数据格式');
                }
                return;
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
     * 🚀 执行操作指令
     */
    async executeOperationCommands(operations, characterId) {
        try {
            console.log(`[SmartPromptSystem] 🚀 开始执行 ${operations.length} 个操作指令...`);

            for (const operation of operations) {
                await this.executeOperation(operation, characterId);
            }

            console.log('[SmartPromptSystem] ✅ 所有操作指令执行完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 执行操作指令失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 执行单个操作
     */
    async executeOperation(operation, characterId) {
        try {
            const { type, panel } = operation;
            let { row, data } = operation;
            console.log(`[SmartPromptSystem] 🔧 执行操作: ${type} ${panel}(${row})`, data);

            // 🔧 修复：直接从infobar_data.panels获取当前面板数据，避免数据核心的键值查找问题
            let currentPanelData = await this.getCurrentPanelDataDirect(panel);

            // 🛡️ 行号规范化（1-based）：防止 AI 误用 0 或负数行
            row = this.normalizeRowIndex(row, currentPanelData, type, panel);

            switch (type) {
                case 'add':
                    await this.executeAddOperation(currentPanelData, row, data, panel);
                    break;
                case 'update':
                    await this.executeUpdateOperation(currentPanelData, row, data, panel);
                    break;
                case 'delete':
                    await this.executeDeleteOperation(currentPanelData, row, panel);
                    break;
                default:
                    console.warn(`[SmartPromptSystem] ⚠️ 未知操作类型: ${type}`);
            }

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 执行操作失败:`, operation, error);
        }
    }

    /**
     * 🔧 直接获取当前面板数据
     */
    async getCurrentPanelDataDirect(panelId) {
        try {
            // 获取当前聊天ID
            const chatId = this.dataCore.getCurrentChatId();
            if (!chatId) {
                console.warn(`[SmartPromptSystem] ⚠️ 无法获取当前聊天ID`);
                return {};
            }

            // 获取当前聊天数据
            const chatData = await this.dataCore.getChatData(chatId);
            if (!chatData || !chatData.infobar_data || !chatData.infobar_data.panels) {
                console.log(`[SmartPromptSystem] ℹ️ 面板数据不存在，返回空对象`);
                return {};
            }

            const panelData = chatData.infobar_data.panels[panelId] || {};
            console.log(`[SmartPromptSystem] 📊 获取面板 ${panelId} 数据:`, Array.isArray(panelData) ? `数组(${panelData.length}行)` : `对象(${Object.keys(panelData).length}键)`);

            return panelData;

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 获取面板数据失败:`, error);
            return {};
        }
    }

    /**
     * 行号规范化（1-based）：防止 AI 生成 0 或负数行号
     */
    normalizeRowIndex(row, currentPanelData, type = 'update', panelId = '') {
        let r = parseInt(row);
        if (Number.isNaN(r)) r = 1;
        if (r >= 1) return r;

        const count = this.getExistingRowCount(currentPanelData);
        let target = 1;
        if (type === 'add') {
            target = Math.max(1, count + 1); // 添加：缺省追加到最后一行之后
        } else if (type === 'update' || type === 'delete') {
            target = count > 0 ? 1 : 1; // 更新/删除：若已有数据，则指向第1行；否则规范为1
        }
        console.warn(`[SmartPromptSystem] ⚠ 行号 ${row} 无效，已规范化为 ${target}（面板: ${panelId}，现有行数: ${count}）`);
        return target;
    }

    /**
     * 获取现有行数（支持数组或以数字键存储的对象）
     */
    getExistingRowCount(currentPanelData) {
        try {
            if (Array.isArray(currentPanelData)) {
                return currentPanelData.length;
            }
            if (currentPanelData && typeof currentPanelData === 'object') {
                const numeric = Object.keys(currentPanelData)
                    .map(k => parseInt(k))
                    .filter(n => !Number.isNaN(n) && n >= 1);
                if (numeric.length > 0) return Math.max(...numeric);
                // 非数字键但有内容，视为至少1行
                return Object.keys(currentPanelData).length > 0 ? 1 : 0;
            }
            return 0;
        } catch (e) {
            console.warn('[SmartPromptSystem] ⚠ 统计现有行数失败：', e?.message);
            return 0;
        }
    }


    /**
     * 🚀 执行ADD操作
     */
    async executeAddOperation(currentPanelData, row, data, panelId) {
        try {
            console.log(`[SmartPromptSystem] ➕ 执行ADD操作: 行${row}`, data);

            // 🔧 修复：确保面板数据是数组格式，处理对象格式的转换
            let panelArray = [];
            if (Array.isArray(currentPanelData)) {
                panelArray = [...currentPanelData];
            } else if (currentPanelData && typeof currentPanelData === 'object') {
                // 🔧 修复：区分新架构数组对象和旧架构键值对象
                const numericKeys = Object.keys(currentPanelData)
                    .map(k => parseInt(k))
                    .filter(k => !isNaN(k));

                if (numericKeys.length > 0) {
                    // 新架构：对象键为数字索引 {0: {col_1: ...}, 1: {...}}
                    const sortedKeys = numericKeys.sort((a, b) => a - b);
                    panelArray = sortedKeys.map(k => currentPanelData[k]);
                    console.log(`[SmartPromptSystem] 🔄 新架构对象转数组格式: ${sortedKeys.length}行`);
                } else {
                    // 旧架构：直接键值对 {name: "用户", age: "25岁"}，转为单行数组，保留原始数据
                    panelArray = [currentPanelData];
                    console.log(`[SmartPromptSystem] 🔄 旧架构对象转数组格式: 1行 (保留原始数据)`);
                }
            }

            // 确保数组有足够的行
            while (panelArray.length < row) {
                panelArray.push({});
            }

            // 添加数据到指定行（行号从1开始，数组索引从0开始）
            const rowIndex = row - 1;
            if (!panelArray[rowIndex]) {
                panelArray[rowIndex] = {};
            }

            // 合并新数据
            Object.assign(panelArray[rowIndex], data);

            // 🔧 修复：直接更新到infobar_data.panels结构，避免数据核心的合并逻辑
            await this.saveArrayDataDirectly(panelId, panelArray);
            console.log(`[SmartPromptSystem] ✅ ADD操作完成: 行${row}`);

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ ADD操作失败:`, error);
        }
    }

    /**
     * 🔄 执行UPDATE操作
     */
    async executeUpdateOperation(currentPanelData, row, data, panelId) {
        try {
            console.log(`[SmartPromptSystem] 🔄 执行UPDATE操作: 行${row}`, data);

            // 🔧 修复：确保面板数据是数组格式，处理对象格式的转换
            let panelArray = [];
            if (Array.isArray(currentPanelData)) {
                panelArray = [...currentPanelData];
            } else if (currentPanelData && typeof currentPanelData === 'object') {
                // 🔧 修复：区分新架构数组对象和旧架构键值对象
                const numericKeys = Object.keys(currentPanelData)
                    .map(k => parseInt(k))
                    .filter(k => !isNaN(k));

                if (numericKeys.length > 0) {
                    // 新架构：对象键为数字索引 {0: {col_1: ...}, 1: {...}}
                    const sortedKeys = numericKeys.sort((a, b) => a - b);
                    panelArray = sortedKeys.map(k => currentPanelData[k]);
                    console.log(`[SmartPromptSystem] 🔄 新架构对象转数组格式: ${sortedKeys.length}行`);
                } else {
                    // 旧架构：直接键值对 {name: "用户", age: "25岁"}，转为单行数组，保留原始数据
                    panelArray = [currentPanelData];
                    console.log(`[SmartPromptSystem] 🔄 旧架构对象转数组格式: 1行 (保留原始数据)`);
                }
            }

            // 确保数组有足够的行
            while (panelArray.length < row) {
                panelArray.push({});
            }

            // 更新指定行的数据（行号从1开始，数组索引从0开始）
            const rowIndex = row - 1;
            if (!panelArray[rowIndex]) {
                panelArray[rowIndex] = {};
            }

            // 更新指定列的数据
            Object.assign(panelArray[rowIndex], data);

            // 🔧 修复：直接更新到infobar_data.panels结构，避免数据核心的合并逻辑
            await this.saveArrayDataDirectly(panelId, panelArray);
            console.log(`[SmartPromptSystem] ✅ UPDATE操作完成: 行${row}`);

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ UPDATE操作失败:`, error);
        }
    }

    /**
     * 🗑️ 执行DELETE操作
     */
    async executeDeleteOperation(currentPanelData, row, panelId) {
        try {
            console.log(`[SmartPromptSystem] 🗑️ 执行DELETE操作: 行${row}`);

            // 🔧 修复：确保面板数据是数组格式，处理对象格式的转换
            let panelArray = [];
            if (Array.isArray(currentPanelData)) {
                panelArray = [...currentPanelData];
            } else if (currentPanelData && typeof currentPanelData === 'object') {
                // 🔧 修复：区分新架构数组对象和旧架构键值对象
                const numericKeys = Object.keys(currentPanelData)
                    .map(k => parseInt(k))
                    .filter(k => !isNaN(k));

                if (numericKeys.length > 0) {
                    // 新架构：对象键为数字索引 {0: {col_1: ...}, 1: {...}}
                    const sortedKeys = numericKeys.sort((a, b) => a - b);
                    panelArray = sortedKeys.map(k => currentPanelData[k]);
                    console.log(`[SmartPromptSystem] 🔄 新架构对象转数组格式: ${sortedKeys.length}行`);
                } else {
                    // 旧架构：直接键值对 {name: "用户", age: "25岁"}，转为单行数组，保留原始数据
                    panelArray = [currentPanelData];
                    console.log(`[SmartPromptSystem] 🔄 旧架构对象转数组格式: 1行 (保留原始数据)`);
                }
            } else {
                console.log(`[SmartPromptSystem] ℹ️ 面板数据为空，无需删除`);
                return;
            }

            // 删除指定行（行号从1开始，数组索引从0开始）
            const rowIndex = row - 1;
            if (rowIndex >= 0 && rowIndex < panelArray.length) {
                panelArray.splice(rowIndex, 1);
                console.log(`[SmartPromptSystem] ✅ 删除行${row}成功`);
            } else {
                console.log(`[SmartPromptSystem] ⚠️ 行${row}不存在，无需删除`);
                return;
            }

            // 🔧 修复：直接更新到infobar_data.panels结构，避免数据核心的合并逻辑
            await this.saveArrayDataDirectly(panelId, panelArray);
            console.log(`[SmartPromptSystem] ✅ DELETE操作完成: 行${row}`);

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ DELETE操作失败:`, error);
        }
    }

    /**
     * 🔧 直接保存数组数据，避免数据核心的合并逻辑
     */
    async saveArrayDataDirectly(panelId, arrayData) {
        try {
            // 获取当前聊天ID
            const chatId = this.dataCore.getCurrentChatId();
            if (!chatId) {
                console.error(`[SmartPromptSystem] ❌ 无法获取当前聊天ID`);
                return;
            }

            // 获取当前聊天数据
            const chatData = await this.dataCore.getChatData(chatId);
            if (!chatData) {
                console.error(`[SmartPromptSystem] ❌ 无法获取聊天数据`);
                return;
            }

            // 确保infobar_data.panels结构存在
            if (!chatData.infobar_data) {
                chatData.infobar_data = {};
            }
            if (!chatData.infobar_data.panels) {
                chatData.infobar_data.panels = {};
            }

            // 直接设置数组数据
            chatData.infobar_data.panels[panelId] = arrayData;

            // 保存整个聊天数据
            await this.dataCore.setChatData(chatId, chatData);
            console.log(`[SmartPromptSystem] ✅ 数组数据直接保存成功: ${panelId} (${arrayData.length}行)`);

        } catch (error) {
            console.error(`[SmartPromptSystem] ❌ 直接保存数组数据失败:`, error);
        }
    }

    /**
     * 🔧 更新旧格式面板数据（向后兼容）
     */
    async updateLegacyPanelData(panels, characterId) {
        try {
            console.log('[SmartPromptSystem] 🔄 更新旧格式面板数据（向后兼容）...');

            // 更新每个面板的数据 - 修复：使用正确的scope参数
            for (const [panelId, panelData] of Object.entries(panels)) {
                // 将面板数据存储到chat范围，包含角色ID信息
                const dataKey = `panels.${characterId}.${panelId}`;
                await this.dataCore.setData(dataKey, panelData, 'chat');
                console.log(`[SmartPromptSystem] ✅ 更新面板数据: ${panelId} (角色: ${characterId})`);
            }

            console.log('[SmartPromptSystem] ✅ 旧格式面板数据更新完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 更新旧格式面板数据失败:', error);
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

            // 🔧 修复：直接从数据核心获取当前面板数据，支持多行数据格式
            const currentPanelData = await this.getCurrentPanelData(enabledPanels);
            const panels = currentPanelData || {};

            for (const panel of enabledPanels) {
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelData = panels[panelKey] || panels[panel.id];

                // 🔧 修复：检查panel.subItems是否存在，避免undefined错误
                if (!panel.subItems || !Array.isArray(panel.subItems)) {
                    console.warn(`[SmartPromptSystem] ⚠️ 面板 ${panel.id || panel} 的subItems不存在或格式不正确，跳过`);
                    continue;
                }

                // 🔧 修复：支持多行数据格式的空字段检测
                if (!panelData || (Array.isArray(panelData) && panelData.length === 0) ||
                    (!Array.isArray(panelData) && Object.keys(panelData).length === 0)) {
                    // 整个面板都缺失
                    missingFields.push({
                        panelId: panel.id,
                        panelKey: panelKey,
                        panelName: panel.name,
                        missingSubItems: panel.subItems.map(subItem => ({
                            key: subItem.key,
                            displayName: subItem.name || this.getSubItemDisplayName(panel.id, subItem.key)
                        }))
                    });
                    continue;
                }

                // 🔧 新增：检查多行数据格式中的空字段
                const missingSubItems = [];

                // 处理数组格式的面板数据（多行数据）
                if (Array.isArray(panelData)) {
                    console.log(`[SmartPromptSystem] 🔍 检查面板 ${panel.id} 的多行数据，共 ${panelData.length} 行`);

                    // 统计每个字段在所有行中的空值情况，并记录“每行是否已有其它字段数据”
                    const fieldStats = {};
                    const rowHasAnyData = panelData.map((row) => {
                        if (!(row && typeof row === 'object')) return false;
                        for (const si of panel.subItems) {
                            const v = this.getRowValueBySubItem(row, si, panel);
                            if (typeof v === 'string' ? v.trim() !== '' : (v !== undefined && v !== null && String(v).trim() !== '')) {
                                return true;
                            }
                        }
                        return false;
                    });

                    for (const subItem of panel.subItems) {
                        const key = subItem.key;
                        let totalRows = panelData.length;
                        let emptyRows = 0;
                        let hasAnyValidData = false;
                        const missingRows = [];

                        // 检查每一行的这个字段（支持 col_N 与 key 两种存储）
                        panelData.forEach((row, rowIndex) => {
                            if (row && typeof row === 'object') {
                                const value = this.getRowValueBySubItem(row, subItem, panel);
                                const filled = typeof value === 'string' ? value.trim() !== '' : (value !== undefined && value !== null && String(value).trim() !== '');
                                if (filled) {
                                    hasAnyValidData = true;
                                } else {
                                    emptyRows++;
                                    if (rowHasAnyData[rowIndex]) missingRows.push(rowIndex + 1); // 1-based 行号
                                }
                            } else {
                                emptyRows++;
                            }
                        });

                        fieldStats[key] = {
                            totalRows,
                            emptyRows,
                            hasAnyValidData,
                            emptyPercentage: totalRows > 0 ? (emptyRows / totalRows) * 100 : 100,
                            missingRows
                        };

                        // 🎯 判断标准：
                        // 1) 若该字段在“已有数据的行”存在缺失，则列为缺失并携带缺失行号
                        // 2) 或者该字段整体空/空白率>50%
                        if (missingRows.length > 0 || !hasAnyValidData || fieldStats[key].emptyPercentage > 50) {
                            const displayName = subItem.name || this.getSubItemDisplayName(panel.id, key);
                            missingSubItems.push({
                                key,
                                displayName,
                                emptyRows,
                                totalRows,
                                emptyRows,
                                emptyPercentage: Math.round(fieldStats[key].emptyPercentage),
                                missingRows
                            });
                        }
                    }

                    console.log(`[SmartPromptSystem] 📊 面板 ${panel.id} 字段统计:`, fieldStats);

                } else {
                    // 处理传统键值对格式的面板数据
                    for (const subItem of panel.subItems) {
                        const key = subItem.key;
                        let hasValidData = false;

                        if (Object.prototype.hasOwnProperty.call(panelData, key)) {
                            const value = panelData[key];
                            hasValidData = value && value.trim() !== '';
                        }

                        if (!hasValidData) {
                            const displayName = subItem.name || this.getSubItemDisplayName(panel.id, key);
                            missingSubItems.push({ key, displayName });
                        }
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
    addIncrementalDataInstructions(prompt, missingFields, enabledPanels = []) {
        console.log('[SmartPromptSystem] 📝 添加增量数据补充指令...');

        // 🎯 分析自定义面板缺失情况
        const customPanelsMissing = missingFields.filter(field => {
            const panel = enabledPanels.find(p => p.id === field.panelId);
            return panel && panel.type === 'custom';
        });

        // 🔧 简化：以清晰业务语言列出需补充字段
        let incrementalInstructions = `

【🔄 增量数据补充 - 重要】
检测到以下新启用字段缺失，请为这些字段生成内容（必须出现在<infobar_data>中）：

`;

        if (customPanelsMissing.length > 0) {
            incrementalInstructions += `🎯 **自定义面板特别注意**：检测到 ${customPanelsMissing.length} 个自定义面板缺失数据，请根据当前剧情场景合理填写\n\n`;
        }

        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId; // 🔧 修复：使用正确的面板键
            const panel = enabledPanels.find(p => p.id === field.panelId);
            const isCustomPanel = panel && panel.type === 'custom';

            incrementalInstructions += `📋 ${field.panelName} (${panelKey})${isCustomPanel ? ' [自定义面板]' : ''}:\n`;

            for (const subItem of field.missingSubItems) {
                // 交互对象面板：强制使用npc前缀
                if (panelKey === 'interaction') {
                    incrementalInstructions += `  - ${subItem.key}="${subItem.displayName}": 请在操作指令的数据中补充对应列值\n`;
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
3. 这些字段属于"新增启用"，即使增量模式也必须输出
4. 交互对象面板请使用操作指令多行格式（示例：add interaction(行号 {"1","姓名","2","关系",...})）
5. 🔥🔥🔥 **严禁使用Markdown格式**：禁止 - **标题**、**粗体**、列表符号

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
    generatePrefilledMissingPanels(missingFields, enabledPanels = []) {
        let prefilledTemplate = '';
        let customPanelCount = 0;
        let basicPanelCount = 0;

        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId;
            // 通过面板类型识别自定义面板
            const panel = enabledPanels.find(p => p.id === field.panelId);
            const isCustomPanel = panel && panel.type === 'custom';

            if (isCustomPanel) {
                customPanelCount++;
            } else {
                basicPanelCount++;
            }

            prefilledTemplate += `${panelKey}: `;

            const subItemTemplates = [];
            for (const subItem of field.missingSubItems) {
                if (isCustomPanel) {
                    // 自定义面板使用更具体的提示
                    subItemTemplates.push(`${subItem.key}="【${field.panelName}中的${subItem.displayName}，请根据当前场景填写】"`);
                } else {
                    subItemTemplates.push(`${subItem.key}="【请填写${subItem.displayName}的具体内容】"`);
                }
            // 行级缺失补充模板：为存在数据的行补齐该列（根据 subItems 计算列号）
            try {
                const panelCfg = enabledPanels.find(p => p.id === field.panelId) || {};
                const keyToCol = new Map((panelCfg.subItems || []).map((si, idx) => [si?.key, idx + 1]));
                for (const subItem of field.missingSubItems) {
                    if (Array.isArray(subItem.missingRows) && subItem.missingRows.length > 0) {
                        const colIndex = keyToCol.get(subItem.key) || 1;
                        subItem.missingRows.forEach(r => {
                            prefilledTemplate += `update ${panelKey}(${r} {"${colIndex}","${subItem.displayName}"})\n`;
                        });
                    }
                }
            } catch (e) { /* ignore */ }

            }

            prefilledTemplate += subItemTemplates.join(', ') + '\n';
        }

        if (prefilledTemplate) {
            let instructions = `
🔥 **预设模板（您必须复制并填写具体内容）：**
\`\`\`
${prefilledTemplate.trim()}
\`\`\`

⚡ **使用说明**：请将上述模板复制到您的<infobar_data>中，并将【请填写...】替换为具体内容！`;

            if (customPanelCount > 0) {
                instructions += `
🎯 **自定义面板特别注意**：检测到 ${customPanelCount} 个自定义面板缺失数据，请根据当前剧情场景合理填写`;
            }

            if (basicPanelCount > 0) {
                instructions += `
📊 **基础面板**：${basicPanelCount} 个基础面板需要补充数据`;
            }

            prefilledTemplate = instructions + '\n';
        }

        console.log('[SmartPromptSystem] 🔥 生成预填充模板:', prefilledTemplate.length, '字符，自定义面板:', customPanelCount, '个');
        return prefilledTemplate;
    }

    /**
     * 添加终极验证提醒（在提示词最末尾）
     */
    addFinalValidationReminder(prompt, missingFields, enabledPanels = []) {
        let finalReminder = `

💥💥💥 **最终执行检查清单** 💥💥💥
在您完成<infobar_data>标签之前，请务必确认：

🔍 **强制输出验证**：
`;

        for (const field of missingFields) {
            const panelKey = field.panelKey || field.panelId;
            finalReminder += `☑️ ${field.panelName} (${panelKey}) - 是否已包含在<infobar_data>中？\n`;
            for (const subItem of field.missingSubItems) {
                const hasRows = Array.isArray(subItem.missingRows) && subItem.missingRows.length > 0;
                if (hasRows) {
                    finalReminder += `   ☑️ 行[${subItem.missingRows.join(',')}] ${subItem.key}="具体内容" - 是否已填写？\n`;
                } else {
                    finalReminder += `   ☑️ ${subItem.key}="具体内容" - 是否已填写？\n`;
                }
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
- 🔥🔥🔥 **严禁使用Markdown格式**：禁止 - **标题**、**粗体**、列表符号

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

🚨🚨🚨 **关键行号规则** 🚨🚨🚨
**现有数据的行号统一为1，新增数据从2开始！**
- UPDATE操作：update 面板名(1 {字段数据}) ← 更新现有数据，必须使用第1行
- ADD操作：add 面板名(2 {字段数据}) ← 添加新数据，从第2行开始

约束要求：
1. 仅输出以下已启用面板中的变化字段：${allowedPanels.join(', ')}。
2. 不要输出未变化、为空、未知或占位的字段值；不要重复输出同一字段。
3. 不要输出未启用面板；不要创建未定义的新字段键名（必须使用已定义的子项键）。
4. 仅包含发生变化的面板；没有变化的面板不要出现在输出中。
5. **必须使用操作指令格式**：update 面板名(1 {字段数据}) 或 add 面板名(行号 {字段数据})

🎯 **正确示例**：
update interaction(1 {"5":"新的关系状态"}) ← 更新现有NPC数据
add interaction(2 {"1":"新NPC","2":"角色","3":"性格"}) ← 添加新NPC
update plot(1 {"4":"新的剧情发展"}) ← 更新现有剧情数据

🚨🚨🚨 **列号格式严格要求** 🚨🚨🚨
✅ **正确格式**：{"1"，"值1"，"2"，"值2"} ← 必须使用纯数字
❌ **错误格式**：{"col_1"，"值1"，"col_2"，"值2"} ← 严禁使用col_前缀

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

   🚨🚨🚨 **CRITICAL：必须包含完整的五步分析过程，严禁自创步骤名称** 🚨🚨🚨
   **必须完全按照以下步骤名称进行分析，一个字都不能改：**
     * 0. 更新策略：全量/增量更新 ✅（禁止改为"识别核心需求"❌）
     * 1. 剧情分析：当前发生什么事件？角色在哪里？在做什么？ ✅（禁止改为"解析剧情文本"❌）
     * 2. 数据变化识别：哪些信息发生了变化？哪些是新信息？ ✅（禁止改为"输出格式分析"❌）
     * 3. 更新策略判断：需要新增哪些字段？需要更新哪些字段？ ✅
     * 4. 数据完整性检查：确保所有启用面板都有完整数据 ✅
     * 5. 质量验证：确认数据逻辑一致性和合理性 ✅

   ❌❌❌ **如果你使用自创的步骤名称，系统将完全拒绝处理你的输出！** ❌❌❌

2. **第二步：必须后输出 infobar_data 标签**：
   - 在aiThinkProcess标签之后，必须包含 <infobar_data> 标签
   - **强制注释包裹格式**：<infobar_data><!--面板数据--></infobar_data>
   - **严禁格式**：<infobar_data>面板数据</infobar_data>（缺少注释符号）
   - **必须根据【信息栏数据格式规范】生成具体内容**
   - **必须严格遵循上述aiThinkProcess中五步分析的结果**

   🚨🚨🚨 **CRITICAL：必须使用操作指令格式，系统将拒绝所有其他格式** 🚨🚨🚨

   ✅ **正确格式（唯一可接受）**：
   - add personal(1 {"1","张三","2","25","3","程序员"})
   - add world(1 {"1","现代都市","2","都市","3","2024年"})

   ❌❌❌ **系统将完全拒绝以下格式（导致数据解析失败）** ❌❌❌：
   - ❌ JSON格式：{"角色": "我", "时间": "下午"}
   - ❌ 对象格式：{ "角色": "我", "地点": "古董店" }
   - ❌ Markdown格式：- **人物** 或 **状态**: 值
   - ❌ 分类标题：**人物**、**环境**、**当前目标**
   - ❌ 列表符号：- **任何内容**
   - ❌ 粗体标记：**任何粗体文本**

   ⚠️⚠️⚠️ **如果使用错误格式，数据将无法解析，扩展功能将完全失效！** ⚠️⚠️⚠️

**⚠️ 严禁先输出infobar_data再输出aiThinkProcess！**
**⚠️ 严禁内容不被<!--和-->注释符号包裹！**

3. **格式规范要求**：
   - **严格遵循【信息栏数据格式规范】**
   - 使用"操作指令格式"（add/update/delete；列号为纯数字），不要使用旧键值对/XML紧凑/JSON/嵌套XML
   - 🔥🔥🔥 **严禁使用Markdown格式**：禁止 - **标题**、**粗体**、列表符号
   - 生成真实、具体的数据内容，避免"未知"、"N/A"等占位符
   - 确保数据与当前剧情和角色状态一致

4. **具体格式示例**：

   **第一步：aiThinkProcess标签示例（必须先输出，注意注释包裹）：**
   <aiThinkProcess>
   <!--
   0. 更新策略：增量更新
   1. 剧情分析：艾莉丝正在魔法学院图书馆研究古老的魔法书籍，寻找关于传送法术的信息，图书管理员老师马克教授为她推荐了几本珍贵的魔法典籍
   2. 数据变化识别：位置从宿舍变更为图书馆，心情从疲惫变为专注，正在进行魔法研究活动，出现了新的交互对象马克教授
   3. 更新策略判断：需要更新personal的location和mood，更新world的当前场景，新增interaction面板记录与教授的交互，更新tasks面板记录研究进展
   4. 数据完整性检查：personal、world、interaction、inventory、tasks面板都有完整数据，确保NPC信息完整
   5. 质量验证：数据与当前剧情一致，艾莉丝作为魔法师在图书馆研究，与教授的学术交流符合魔法学院设定
   -->
   </aiThinkProcess>

   **第二步：infobar_data标签示例（必须后输出，基于上述分析，注意注释包裹）：**
   <infobar_data>
   <!--
   update personal(1 {"4","魔法学院图书馆","8","专注"})
   add interaction(1 {"1","马克教授","2","导师","3","乐于助人","4","推荐魔法典籍"})
   add tasks(1 {"1","传送法术研究","2","查阅资料中","3","高优先级"})
   -->
   </infobar_data>

   **❌ 错误格式示例（严禁使用）：**
   <aiThinkProcess>
   0. 更新策略：增量更新（内容没有被<!--和-->包裹）
   1. 剧情分析：艾莉丝正在图书馆研究魔法，与教授讨论传送法术
   2. 数据变化识别：位置变更，心情变化，新增交互对象
   3. 更新策略判断：需要更新相关字段
   4. 数据完整性检查：确保数据完整
   5. 质量验证：数据逻辑一致
   </aiThinkProcess>

   <infobar_data>
   add personal(1 {"1","艾莉丝","2","23","4","图书馆"})（内容没有被<!--和-->包裹）
   add world(1 {"1","魔法学院","6","下午","7","安静"})
   add interaction(1 {"1","马克教授","4","导师","3","友善"})
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
     * 🧠 生成数据状态部分（始终包含在提示词中）
     */
    async generateDataStatusSection() {
        try {
            console.log('[SmartPromptSystem] 📊 生成数据状态部分...');

            // 获取启用的面板配置
            const enabledPanels = await this.getEnabledPanels();

            if (enabledPanels.length === 0) {
                return '【📊 当前数据状态（统一行视图）】\n没有启用的面板。\n';
            }

            // 获取AI记忆增强数据
            const memoryEnhancedData = await this.getAIMemoryEnhancedData(enabledPanels);

            // 智能分析更新策略
            const updateStrategy = await this.analyzeUpdateStrategy(enabledPanels, memoryEnhancedData.current);

            // 生成数据状态信息（只包含数据状态部分）
            const dataStatusInfo = await this.generateDataStatusOnly(memoryEnhancedData, updateStrategy);

            console.log('[SmartPromptSystem] ✅ 数据状态部分生成完成');
            return dataStatusInfo;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成数据状态部分失败:', error);
            return '【📊 当前数据状态（统一行视图）】\n数据获取失败。\n';
        }
    }

    /**
     * 🧠 生成仅包含数据状态的信息（不包含其他记忆增强内容）
     */
    async generateDataStatusOnly(memoryEnhancedData, updateStrategy) {
        try {
            const { current = {} } = memoryEnhancedData || {};
            const enabledPanels = await this.getEnabledPanels();

            const dataInfoParts = [];

            // 只生成当前数据状态部分
            dataInfoParts.push('【📊 当前数据状态（统一行视图）】');
            for (const panel of enabledPanels) {
                const panelId = panel.id;
                const panelKey = panel.type === 'custom' && panel.key ? panel.key : panel.id;
                const panelName = this.getBasicPanelDisplayName(panelId);
                const panelData = current[panelKey] || current[panelId] || {};

                dataInfoParts.push(`${panelName}面板 (${panelId}): ${Object.keys(panelData).length > 0 ? '有数据' : '待生成'}`);

                if (Object.keys(panelData).length > 0) {
                    // 使用统一的新架构行格式展示
                    const normalizedRows = this.formatPanelRowsForPrompt(panel, panelData);
                    if (normalizedRows.length > 0) {
                        normalizedRows.forEach(line => dataInfoParts.push(`  ${line}`));
                    }
                }
            }
            dataInfoParts.push('');

            return dataInfoParts.join('\n');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成数据状态信息失败:', error);
            return '【📊 当前数据状态（统一行视图）】\n数据获取失败。\n';
        }
    }

    /**
     * 🧠 注入自定义提示词
     */
    async injectCustomPrompt(customContent) {
        try {
            console.log('[SmartPromptSystem] 🧠 注入自定义提示词...');

            if (!customContent || !customContent.trim()) {
                console.log('[SmartPromptSystem] ⚠️ 自定义提示词内容为空，跳过注入');
                return;
            }

            // 📌 生成最终提示词前缀：AI记忆增强数据（含【📊 当前数据状态】）+ 缺失字段详细列表
            const enabledPanels = await this.getEnabledPanels();
            const memoryEnhancedData = await this.getAIMemoryEnhancedData(enabledPanels);
            const updateStrategy = await this.analyzeUpdateStrategy(enabledPanels, memoryEnhancedData.current);

            // 🧠 AI记忆增强数据（包含【📊 当前数据状态（统一行视图）】及历史/持久化/上下文记忆、AI生成指导）
            const memoryEnhancedInfo = await this.generateMemoryEnhancedDataInfo(memoryEnhancedData, updateStrategy);

            // 🔍 缺失字段详细列表（若存在）
            const missingFields = await this.detectMissingDataFields(enabledPanels);
            let missingInstructions = '';
            if (Array.isArray(missingFields) && missingFields.length > 0) {
                missingInstructions = '\n' + this.generateIncrementalInstructions(missingFields, enabledPanels);
            }

            // 合并：AI记忆增强数据 + 缺失字段列表 + 自定义提示词内容
            const fullPrompt = [memoryEnhancedInfo, missingInstructions, customContent.trim()].filter(Boolean).join('\n');

            // 使用与智能提示词相同的注入机制
            await this.injectPromptToAPI(fullPrompt);

            this.lastInjectionTime = Date.now();
            this.injectionActive = true;

            console.log('[SmartPromptSystem] ✅ 自定义提示词（含数据状态）注入成功');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注入自定义提示词失败:', error);
            throw error;
        }
    }

    /**
     * 🔧 新增：绑定总结输出处理器
     */
    bindSummaryOutputHandler() {
        try {
            console.log('[SmartPromptSystem] 🔗 绑定总结输出处理器...');

            // 监听消息生成完成事件
            if (this.eventSystem) {
                this.eventSystem.on('message:generated', (data) => {
                    this.handleGeneratedMessage(data);
                });
            }

            // 监听SillyTavern的消息事件
            $(document).on('message_sent', (event, data) => {
                this.handleSillyTavernMessage(data);
            });

            // 监听AI消息接收事件
            $(document).on('CHARACTER_MESSAGE_RENDERED', (event, data) => {
                this.handleSillyTavernMessage(data);
            });

            // 监听消息添加事件
            $(document).on('messageAdded', (event, data) => {
                this.handleSillyTavernMessage(data);
            });

            console.log('[SmartPromptSystem] ✅ 总结输出处理器绑定完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 绑定总结输出处理器失败:', error);
        }
    }

    /**
     * 🔧 新增：绑定消息内容过滤器
     */
    bindMessageContentFilter() {
        try {
            console.log('[SmartPromptSystem] 🔗 绑定消息内容过滤器...');

            // 监听消息渲染完成事件，在消息显示后隐藏AI记忆总结内容
            $(document).on('CHARACTER_MESSAGE_RENDERED', (event, data) => {
                setTimeout(() => {
                    this.filterAIMemorySummaryFromDisplay();
                }, 100);
            });

            // 监听消息添加事件
            $(document).on('messageAdded', (event, data) => {
                setTimeout(() => {
                    this.filterAIMemorySummaryFromDisplay();
                }, 100);
            });

            // 定期检查和过滤（防止遗漏）
            setInterval(() => {
                this.filterAIMemorySummaryFromDisplay();
            }, 5000);

            console.log('[SmartPromptSystem] ✅ 消息内容过滤器绑定完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 绑定消息内容过滤器失败:', error);
        }
    }

    /**
     * 🚀 优化：高效的AI记忆总结隐藏方案
     * 使用CSS样式和预处理相结合的方式，避免性能问题
     */
    initializeAIMemorySummaryHiding() {
        try {
            console.log('[SmartPromptSystem] 🚀 初始化AI记忆总结隐藏机制...');

            // 方案1：注入CSS样式隐藏AI记忆总结
            this.injectAIMemorySummaryHidingCSS();

            // 方案2：监听消息渲染事件，在渲染时预处理
            this.bindMessageRenderingEvents();

            console.log('[SmartPromptSystem] ✅ AI记忆总结隐藏机制初始化完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 初始化AI记忆总结隐藏机制失败:', error);
        }
    }

    /**
     * 🔧 新增：注入CSS样式隐藏AI记忆总结
     */
    injectAIMemorySummaryHidingCSS() {
        try {
            // 检查是否已经注入过样式
            if (document.getElementById('ai-memory-summary-hiding-styles')) {
                console.log('[SmartPromptSystem] ℹ️ AI记忆总结隐藏样式已存在，跳过注入');
                return;
            }

            const cssRules = `
                /* 🔒 AI记忆总结隐藏样式 */
                .ai-memory-summary-hidden {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    overflow: hidden !important;
                    opacity: 0 !important;
                }

                /* 🔒 通过属性选择器隐藏包含AI记忆总结的内容 */
                .mes_text [data-ai-memory-summary="true"] {
                    display: none !important;
                }

                /* 🔒 隐藏代码块中的AI记忆总结 */
                .mes_text pre:has([data-ai-memory-summary]) {
                    display: none !important;
                }
            `;

            const styleElement = document.createElement('style');
            styleElement.id = 'ai-memory-summary-hiding-styles';
            styleElement.textContent = cssRules;
            document.head.appendChild(styleElement);

            console.log('[SmartPromptSystem] ✅ AI记忆总结隐藏CSS样式注入完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 注入AI记忆总结隐藏CSS失败:', error);
        }
    }

    /**
     * 🔧 新增：绑定消息渲染事件
     */
    bindMessageRenderingEvents() {
        try {
            // 监听SillyTavern的消息渲染事件
            if (window.eventSource) {
                window.eventSource.on('message_rendered', this.handleMessageRendered.bind(this));
                console.log('[SmartPromptSystem] ✅ 消息渲染事件监听器绑定完成');
            }

            // 监听DOM变化，处理动态添加的消息
            this.observeMessageChanges();

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 绑定消息渲染事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息渲染事件
     */
    handleMessageRendered(data) {
        try {
            if (!data || !data.messageId) return;

            // 查找对应的消息元素
            const messageElement = document.querySelector(`[mesid="${data.messageId}"]`);
            if (!messageElement) return;

            // 预处理消息内容
            this.preprocessMessageForAIMemorySummary(messageElement);

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理消息渲染事件失败:', error);
        }
    }

    /**
     * 🔧 新增：观察消息变化
     */
    observeMessageChanges() {
        try {
            // 创建MutationObserver监听消息容器的变化
            const chatContainer = document.querySelector('#chat');
            if (!chatContainer) {
                console.warn('[SmartPromptSystem] ⚠️ 未找到聊天容器，无法监听消息变化');
                return;
            }

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('mes')) {
                                // 新消息添加，预处理AI记忆总结
                                setTimeout(() => {
                                    this.preprocessMessageForAIMemorySummary(node);
                                }, 100);
                            }
                        });
                    }
                });
            });

            observer.observe(chatContainer, {
                childList: true,
                subtree: true
            });

            console.log('[SmartPromptSystem] ✅ 消息变化观察器启动完成');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 启动消息变化观察器失败:', error);
        }
    }

    /**
     * 🔧 新增：预处理消息中的AI记忆总结
     */
    preprocessMessageForAIMemorySummary(messageElement) {
        try {
            const messageTextElement = messageElement.querySelector('.mes_text');
            if (!messageTextElement) return;

            let messageContent = messageTextElement.innerHTML;

            // 检查是否包含AI记忆总结
            if (!messageContent.includes('[AI_MEMORY_SUMMARY]')) return;

            // 🚀 高效的正则表达式预处理
            const aiMemorySummaryRegex = /\[AI_MEMORY_SUMMARY\][\s\S]*?\[\/AI_MEMORY_SUMMARY\]/g;

            // 将AI记忆总结内容包装在隐藏容器中，而不是直接删除
            messageContent = messageContent.replace(aiMemorySummaryRegex, (match) => {
                return `<div class="ai-memory-summary-hidden" data-ai-memory-summary="true">${match}</div>`;
            });

            // 处理代码块中的AI记忆总结
            const codeBlockRegex = /```[\s\S]*?\[AI_MEMORY_SUMMARY\][\s\S]*?\[\/AI_MEMORY_SUMMARY\][\s\S]*?```/g;
            messageContent = messageContent.replace(codeBlockRegex, (match) => {
                return `<div class="ai-memory-summary-hidden" data-ai-memory-summary="true">${match}</div>`;
            });

            // 更新消息内容（只在有变化时更新）
            if (messageTextElement.innerHTML !== messageContent) {
                messageTextElement.innerHTML = messageContent;
                console.log('[SmartPromptSystem] 🔒 已预处理消息中的AI记忆总结内容');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 预处理消息AI记忆总结失败:', error);
        }
    }

    /**
     * 🔧 兼容性方法：从显示中过滤AI记忆总结内容（保留作为备用方案）
     */
    filterAIMemorySummaryFromDisplay() {
        try {
            console.log('[SmartPromptSystem] ⚠️ 使用备用的AI记忆总结隐藏方案...');

            // 查找所有未处理的消息元素
            const messageElements = document.querySelectorAll('.mes:not([data-ai-memory-processed])');
            let processedCount = 0;

            messageElements.forEach(messageElement => {
                this.preprocessMessageForAIMemorySummary(messageElement);
                messageElement.setAttribute('data-ai-memory-processed', 'true');
                processedCount++;
            });

            if (processedCount > 0) {
                console.log(`[SmartPromptSystem] ✅ 备用方案处理了 ${processedCount} 个消息`);
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 备用AI记忆总结隐藏方案失败:', error);
        }
    }

    /**
     * 🔧 新增：处理生成的消息，提取总结内容
     */
    async handleGeneratedMessage(data) {
        try {
            if (!data || !data.message) {
                return;
            }

            const messageContent = data.message;
            console.log('[SmartPromptSystem] 📝 检查生成消息中的总结内容...');

            // 提取AI记忆总结
            const aiMemorySummary = this.extractAIMemorySummary(messageContent);
            if (aiMemorySummary) {
                await this.processAIMemorySummary(aiMemorySummary);
            }

            // 🔧 修改：传统剧情总结不再通过智能提示词处理，保持原有自定义API方案

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理生成消息失败:', error);
        }
    }

    /**
     * 🔧 新增：处理SillyTavern消息事件
     */
    async handleSillyTavernMessage(data) {
        try {
            // 检查是否是AI回复
            if (!data || data.is_user) {
                return;
            }

            const messageContent = data.mes || data.message || '';
            if (!messageContent) {
                return;
            }

            // 检查消息是否包含AI记忆总结标签
            if (!messageContent.includes('[AI_MEMORY_SUMMARY]')) {
                return;
            }

            console.log('[SmartPromptSystem] 📝 检测到AI记忆总结内容，开始处理...');
            console.log('[SmartPromptSystem] 📄 消息内容长度:', messageContent.length);

            // 提取并处理总结内容
            await this.handleGeneratedMessage({ message: messageContent });

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理SillyTavern消息失败:', error);
        }
    }

    /**
     * 🔧 新增：提取AI记忆总结
     */
    extractAIMemorySummary(messageContent) {
        try {
            const regex = /\[AI_MEMORY_SUMMARY\]([\s\S]*?)\[\/AI_MEMORY_SUMMARY\]/;
            const match = messageContent.match(regex);

            if (match && match[1]) {
                const jsonContent = match[1].trim();
                return JSON.parse(jsonContent);
            }

            return null;
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 提取AI记忆总结失败:', error);
            return null;
        }
    }



    /**
     * 🔧 新增：处理AI记忆总结
     */
    async processAIMemorySummary(summary) {
        try {
            console.log('[SmartPromptSystem] 🧠 处理AI记忆总结:', summary);

            // 获取深度记忆管理器
            const infoBarTool = window.SillyTavernInfobar;
            const deepMemoryManager = infoBarTool?.modules?.deepMemoryManager;
            const aiMemorySummarizer = infoBarTool?.modules?.summaryManager?.aiMemorySummarizer;

            if (deepMemoryManager && deepMemoryManager.initialized) {
                // 将总结内容添加到深度记忆管理器
                const memoryData = {
                    content: summary.content,
                    importance: summary.importance || 0.8,
                    tags: summary.tags || [],
                    category: summary.category || '角色互动',
                    timestamp: summary.timestamp || Date.now(),
                    messageId: summary.messageId,
                    source: 'ai_memory_summary'
                };

                await deepMemoryManager.addMemoryToSensoryLayer(memoryData);
                console.log('[SmartPromptSystem] ✅ AI记忆总结已添加到深度记忆管理器');
            }

            if (aiMemorySummarizer) {
                // 触发AI记忆总结创建事件
                if (this.eventSystem) {
                    this.eventSystem.emit('ai-summary:created', {
                        summary: summary,
                        messageCount: 1,
                        importantCount: 1,
                        timestamp: Date.now(),
                        source: 'smart_prompt_integration'
                    });
                }

                console.log('[SmartPromptSystem] ✅ AI记忆总结事件已触发');
            }

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 处理AI记忆总结失败:', error);
        }
    }



    /**
     * 获取系统状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.enabled,
            errorCount: this.errorCount,
            injectionActive: this.injectionActive,
            lastInjectionTime: this.lastInjectionTime,
            updateStrategy: this.updateStrategy,
            hasFieldRuleManager: !!this.fieldRuleManager
        };
    }

    /**
     * 🚨 严格验证数据格式，拒绝处理错误格式
     */
    validateDataFormat(dataContent) {
        const errors = [];
        const warnings = [];

        try {
            console.log('[SmartPromptSystem] 🔍 开始严格格式验证...');

            // 🚨 首先进行全局旧格式检测
            if (dataContent.includes('="') || dataContent.includes("='") ||
                dataContent.includes('npc0.') || dataContent.includes('npc1.') ||
                /\w+:\s*\w+="/.test(dataContent)) {
                const errorMsg = `🚨🚨🚨 CRITICAL FORMAT ERROR: 检测到旧XML格式数据！
❌ 当前错误格式包含: ${dataContent.includes('="') ? '"属性=值"格式' : ''}${dataContent.includes('npc0.') ? ' NPC前缀格式' : ''}
✅ 正确格式示例: add interaction(1 {"1","江琳","2","朋友","3","开心"})
🚨 系统已完全移除兼容性处理！AI必须输出正确格式！`;

                console.error('[SmartPromptSystem] 🚨 CRITICAL FORMAT ERROR:', errorMsg);
                throw new Error(errorMsg);
            }

            // 🚨 新增：检测行号格式错误
            if (/add\s+\w+\s+\d+\s+\{/.test(dataContent) || /add\s+\w+\{.*\}\(\d+\)/.test(dataContent)) {
                const errorMsg = `🚨🚨🚨 CRITICAL FORMAT ERROR: 检测到行号格式错误！
❌ 错误格式1: add panel 1 {...} (行号未被括号包裹)
❌ 错误格式2: add panel{...}(1) (行号位置错误)
✅ 正确格式: add panel(1 {...})
🚨 系统已完全移除兼容性处理！AI必须输出正确格式！`;

                console.error('[SmartPromptSystem] 🚨 CRITICAL FORMAT ERROR:', errorMsg);
                throw new Error(errorMsg);
            }

            // 🚨 新增：检测列号格式错误
            if (/\{\s*\d+\s*,/.test(dataContent) || /\{\s*"\d+"\s*:\s*"/.test(dataContent)) {
                const errorMsg = `🚨🚨🚨 CRITICAL FORMAT ERROR: 检测到列号格式错误！
❌ 错误格式1: {1,"值",2,"值"} (列号未被双引号包裹)
❌ 错误格式2: {"1":"值","2":"值"} (使用了JSON键值对格式)
✅ 正确格式: {"1","值","2","值"}
🚨 系统已完全移除兼容性处理！AI必须输出正确格式！`;

                console.error('[SmartPromptSystem] 🚨 CRITICAL FORMAT ERROR:', errorMsg);
                throw new Error(errorMsg);
            }

            // 🚨 新增：检测行号列号混淆使用
            if (/add\s+\w+\(\s*\{/.test(dataContent) && !/add\s+\w+\(\s*\d+\s+\{/.test(dataContent)) {
                const errorMsg = `🚨🚨🚨 CRITICAL FORMAT ERROR: 检测到行号列号混淆使用！
❌ 错误格式: add panel({"1","值","2","值"}) (缺少行号)
✅ 正确格式: add panel(1 {"1","值","2","值"})
🚨 系统已完全移除兼容性处理！AI必须输出正确格式！`;

                console.error('[SmartPromptSystem] 🚨 CRITICAL FORMAT ERROR:', errorMsg);
                throw new Error(errorMsg);
            }

            // 检查是否包含interaction面板数据
            const lines = dataContent.split('\n').filter(line => line.trim());
            let hasInteractionPanel = false;
            let interactionErrors = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
                    continue;
                }

                const colonIndex = trimmedLine.indexOf(':');
                if (colonIndex === -1) continue;

                const panelId = trimmedLine.substring(0, colonIndex).trim();
                const fieldsStr = trimmedLine.substring(colonIndex + 1).trim();

                // 🚨 重点检查interaction面板
                if (panelId === 'interaction') {
                    hasInteractionPanel = true;
                    console.log('[SmartPromptSystem] 🔍 检测到interaction面板，验证NPC前缀格式...');

                    // 检查是否使用了操作指令格式（add/update/delete interaction(...)）
                    const opCmdPattern = /(add|update|delete)\s+interaction\s*\(/i;
                    const isOpCmd = opCmdPattern.test(fieldsStr);

                    if (!isOpCmd) {
                        // 🚨🚨🚨 CRITICAL ERROR：直接拒绝错误格式
                        const errorMsg = `🚨🚨🚨 CRITICAL FORMAT ERROR: interaction面板必须使用操作指令多行格式！
❌ 当前错误格式: ${fieldsStr}
✅ 正确格式示例: add interaction(1 {"1","江琳","2","朋友","3","开心"})
🚨 系统已完全移除兼容性处理！AI必须输出正确格式！`;

                        console.error('[SmartPromptSystem] 🚨 CRITICAL FORMAT ERROR:', errorMsg);

                        // 🔥 激进措施：直接抛出错误，阻止继续处理
                        throw new Error(errorMsg);
                    } else {
                        console.log('[SmartPromptSystem] ✅ interaction面板检测为操作指令格式');
                    }
                }
            }

            // 🚨 如果有interaction面板但格式错误，直接拒绝
            if (hasInteractionPanel && interactionErrors.length > 0) {
                errors.push(...interactionErrors);
                errors.push('🚨 系统已移除对错误格式的兼容性处理！');
                errors.push('🚨 请确保AI输出操作指令格式！');
            }

            const isValid = errors.length === 0;

            if (!isValid) {
                console.error('[SmartPromptSystem] ❌ 格式验证失败，发现以下错误:');
                errors.forEach(error => console.error(`  - ${error}`));
            } else {
                console.log('[SmartPromptSystem] ✅ 格式验证通过');
            }

            return {
                isValid,
                errors,
                warnings,
                hasInteractionPanel
            };

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 格式验证过程出错:', error);
            return {
                isValid: false,
                errors: [`格式验证过程出错: ${error.message}`],
                warnings: [],
                hasInteractionPanel: false
            };
        }
    }

    // ==================== 🚀 面板规则集成功能 ====================

    /**
     * 🚀 生成面板规则部分
     * 动态收集所有面板规则并格式化为AI友好的格式
     */
    generatePanelRulesSection() {
        try {
            const now = Date.now();

            // 检查缓存是否有效
            if (this.rulesCacheExpiry > now && this.rulesCache.has('panelRulesSection')) {
                console.log('[SmartPromptSystem] 📋 使用缓存的面板规则');
                return this.rulesCache.get('panelRulesSection');
            }

            console.log('[SmartPromptSystem] 🔄 生成面板规则部分...');

            const rulesSection = this.collectAndFormatPanelRules();

            // 缓存结果
            this.rulesCache.set('panelRulesSection', rulesSection);
            this.rulesCacheExpiry = now + this.rulesCacheTTL;

            console.log('[SmartPromptSystem] ✅ 面板规则生成完成，字符数:', rulesSection.length);
            return rulesSection;

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 生成面板规则失败:', error);
            return '<!-- 面板规则暂时不可用 -->';
        }
    }

    /**
     * 🚀 收集和格式化面板规则
     */
    collectAndFormatPanelRules() {
        try {
            const panelRules = [];
            const fieldRules = [];

            // 1. 收集面板规则
            if (this.panelRuleManager) {
                const allPanelRules = this.panelRuleManager.getAllPanelRules?.() || new Map();

                for (const [panelId, rule] of allPanelRules) {
                    if (rule && (rule.description || rule.updateRule || rule.addRule || rule.deleteRule)) {
                        panelRules.push(this.formatPanelRule(panelId, rule));
                    }
                }
            }

            // 2. 收集字段规则（通过AIDataExposure或直接从FieldRuleManager）
            if (this.fieldRuleManager) {
                const allFieldRules = this.fieldRuleManager.getAllFieldRules?.() || new Map();

                for (const [fieldKey, rule] of allFieldRules) {
                    if (rule && rule.examples && rule.examples.length > 0) {
                        fieldRules.push(this.formatFieldRule(fieldKey, rule));
                    }
                }
            }

            // 3. 组合规则部分
            let rulesContent = '';

            if (panelRules.length > 0) {
                rulesContent += `【面板操作规则】\n`;
                rulesContent += panelRules.join('\n');
                rulesContent += '\n';
            }

            if (fieldRules.length > 0) {
                rulesContent += `【字段填写规则】\n`;
                rulesContent += fieldRules.join('\n');
            }

            return rulesContent || '<!-- 暂无自定义面板规则 -->';

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 收集面板规则失败:', error);
            return '<!-- 面板规则收集失败 -->';
        }
    }

    /**
     * 🚀 格式化单个面板规则
     */
    formatPanelRule(panelId, rule) {
        let formatted = `\n▪ ${panelId}面板：\n`;

        // 基础描述
        if (rule.description) {
            formatted += `  📋 描述：${rule.description}\n`;
        }

        // 更新规则
        if (rule.updateRule) {
            formatted += `  🔄 更新规则：${rule.updateRule}\n`;
        }

        // 增加规则
        if (rule.addRule) {
            formatted += `  ➕ 增加规则：${rule.addRule}\n`;
        }

        // 删除规则
        if (rule.deleteRule) {
            formatted += `  🗑️ 删除规则：${rule.deleteRule}\n`;
        }

        // 过滤规则
        if (rule.filterType && rule.filterType !== 'none') {
            formatted += `  🔍 过滤条件：${rule.filterType} = ${rule.filterValue}\n`;
        }

        return formatted;
    }

    /**
     * 🚀 格式化字段规则
     */
    formatFieldRule(fieldKey, rule) {
        const [panelName, fieldName] = fieldKey.split('.');
        let formatted = `\n  • ${panelName}.${fieldName}：`;

        // 字段示例
        if (rule.examples && rule.examples.length > 0) {
            const examples = rule.examples.slice(0, 3).map(ex => ex.value || ex).join('、');
            formatted += `示例：${examples}`;
        }

        // 字段类型和约束
        if (rule.type) {
            formatted += ` (类型：${rule.type})`;
        }

        if (rule.range) {
            formatted += ` (范围：${rule.range})`;
        }

        return formatted;
    }

    /**
     * 🚀 清除规则缓存
     */
    clearRulesCache() {
        this.rulesCache.clear();
        this.rulesCacheExpiry = 0;
        console.log('[SmartPromptSystem] 🧹 规则缓存已清除');
    }

    /**
     * 🚀 获取面板规则统计信息
     */
    getRulesStatistics() {
        try {
            const stats = {
                panelRules: 0,
                fieldRules: 0,
                cacheValid: this.rulesCacheExpiry > Date.now()
            };

            if (this.panelRuleManager) {
                const allPanelRules = this.panelRuleManager.getAllPanelRules?.() || new Map();
                stats.panelRules = allPanelRules.size;
            }

            if (this.fieldRuleManager) {
                const allFieldRules = this.fieldRuleManager.getAllFieldRules?.() || new Map();
                stats.fieldRules = allFieldRules.size;
            }

            return stats;
        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 获取规则统计失败:', error);
            return { panelRules: 0, fieldRules: 0, cacheValid: false };
        }
    }

    /**
     * 🚀 绑定规则变化监听器
     */
    bindRuleChangeListeners() {
        try {
            if (!this.eventSystem) {
                console.warn('[SmartPromptSystem] ⚠️ 事件系统不可用，无法监听规则变化');
                return;
            }

            // 监听面板规则更新事件
            this.eventSystem.on('panelRule:updated', (data) => {
                console.log('[SmartPromptSystem] 📋 检测到面板规则更新，清除缓存:', data.panelId);
                this.clearRulesCache();
            });

            // 监听面板规则删除事件
            this.eventSystem.on('panelRule:deleted', (data) => {
                console.log('[SmartPromptSystem] 🗑️ 检测到面板规则删除，清除缓存:', data.panelId);
                this.clearRulesCache();
            });

            // 监听字段规则更新事件
            this.eventSystem.on('fieldRule:updated', (data) => {
                console.log('[SmartPromptSystem] 🔧 检测到字段规则更新，清除缓存:', `${data.panelName}.${data.fieldName}`);
                this.clearRulesCache();
            });

            // 监听字段规则删除事件
            this.eventSystem.on('fieldRule:deleted', (data) => {
                console.log('[SmartPromptSystem] 🗑️ 检测到字段规则删除，清除缓存:', `${data.panelName}.${data.fieldName}`);
                this.clearRulesCache();
            });

            console.log('[SmartPromptSystem] 🔗 规则变化监听器已绑定');

        } catch (error) {
            console.error('[SmartPromptSystem] ❌ 绑定规则变化监听器失败:', error);
        }
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.errorCount++;
        console.error('[SmartPromptSystem] ❌ 系统错误:', error);

        if (this.eventSystem) {
            this.eventSystem.emit('system:error', {
                module: 'SmartPromptSystem',
                error: error.message,
                timestamp: Date.now()
            });
        }
    }
}
