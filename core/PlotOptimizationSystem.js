/**
 * 剧情优化系统
 *
 * 核心功能：
 * - 拦截用户消息发送
 * - 调用自定义API获取剧情优化建议
 * - 将建议注入到主API提示词
 * - 主API根据建议生成更优质的剧情内容
 *
 * 工作流程：
 * 1. 监听用户消息发送事件
 * 2. 调用自定义API（剧情优化编辑）
 * 3. 获取剧情建议
 * 4. 将建议注入到主API提示词
 * 5. 主API生成内容
 *
 * @class PlotOptimizationSystem
 */

export class PlotOptimizationSystem {
    constructor(dependencies = {}) {
        console.log('[PlotOptimizationSystem] 📖 剧情优化系统初始化开始');

        // 🔧 依赖注入
        this.unifiedDataCore = dependencies.unifiedDataCore || window.InfoBarData;
        this.eventSystem = dependencies.eventSystem || window.SillyTavernInfobar?.eventSource;
        this.configManager = dependencies.configManager || window.SillyTavernInfobar?.modules?.configManager;
        this.apiIntegration = dependencies.apiIntegration || window.SillyTavernInfobar?.modules?.apiIntegration;
        // 🔧 修复：infoBarSettings在modules中注册为settings
        this.infoBarSettings = dependencies.infoBarSettings || window.SillyTavernInfobar?.modules?.settings;
        this.context = dependencies.context || window.SillyTavern?.getContext?.();

        // 🚀 配置
        this.config = {
            enabled: false,                         // 默认禁用（在设置中开启）
            useInterceptor: true,                   // 默认启用拦截器模式；启用后不再绑定 GENERATION_STARTED 事件
            maxContextMessages: 10,                 // 最大上下文消息数
            promptTemplate: '',                     // 提示词模板（内置）
            injectionPosition: 'system',            // 注入位置：system/user/assistant
            injectionPriority: 100,                 // 注入优先级
            // 📖 新增：剧情优化参数
            storyTheme: '',                         // 故事主题
            storyType: '',                          // 故事类型
            referenceWorks: '',                     // 参考作品
            wordCountRequirement: '',               // 字数要求
            plotProgressIntensity: 5,               // 剧情推进强度 (1-10)
            plotConflictIntensity: 5,               // 剧情冲突强度 (1-10)
            plotSuspenseIntensity: 5,               // 剧情悬念强度 (1-10)
            plotTwistIntensity: 5,                  // 剧情反转强度 (1-10)
            plotClimaxIntensity: 5,                 // 剧情高潮强度 (1-10)
            plotLowIntensity: 5,                    // 剧情低谷强度 (1-10)
            plotTurnIntensity: 5                    // 剧情转折强度 (1-10)
        };

        // 📊 状态
        this.initialized = false;
        this.isProcessing = false;
        this.errorCount = 0;
        this.lastOptimizationTime = 0;

        // 🔧 跟踪聊天状态（用于判断是否是新消息）
        this.lastProcessedChatLength = 0;
        this.lastProcessedMessageId = null;

        // 🔧 新增：存储剧情优化建议（按消息ID存储）
        this.plotSuggestions = new Map(); // messageId -> { suggestion, timestamp, floorNumber }

        // 📈 统计
        this.stats = {
            totalOptimizations: 0,
            successCount: 0,
            failureCount: 0,
            averageProcessingTime: 0
        };
    }

    /**
     * 初始化剧情优化系统
     */
    async init() {
        try {
            console.log('[PlotOptimizationSystem] 📊 开始初始化剧情优化系统...');

            // 加载配置
            await this.loadConfig();

            // 加载提示词模板
            await this.loadPromptTemplate();

            // 🔧 只有在启用时才绑定事件监听器
            if (this.config.enabled) {
                if (this.config.useInterceptor !== false) {
                    console.log('[PlotOptimizationSystem] ✅ 剧情优化系统已启用（拦截器模式），跳过事件绑定');
                } else {
                    console.log('[PlotOptimizationSystem] ✅ 剧情优化系统已启用，绑定事件监听器...');
                    this.bindEventListeners();
                }
                // 无论是否使用拦截器，都已在 bindEventListeners 内绑定 GENERATION_ENDED 自动重试监听
            } else {
                console.log('[PlotOptimizationSystem] ⏸️ 剧情优化系统已初始化但未启用');
            }

            this.initialized = true;
            console.log('[PlotOptimizationSystem] ✅ 剧情优化系统初始化完成');

            // 🔧 新增：初始化lastProcessedChatLength为当前聊天长度，防止页面刷新时触发优化
            const chat = this.context?.chat;
            if (chat && chat.length > 0) {
                this.lastProcessedChatLength = chat.length;
                console.log('[PlotOptimizationSystem] 📊 初始化lastProcessedChatLength:', this.lastProcessedChatLength);
            }

            // 🔄 监听聊天切换事件，在聊天加载完成后恢复建议
            if (this.context?.eventSource && this.context?.event_types) {
                this.context.eventSource.on(this.context.event_types.CHAT_CHANGED, async () => {
                    console.log('[PlotOptimizationSystem] 📡 检测到聊天切换，清空旧数据并恢复新聊天的建议...');
                    try {
                        // 🔧 修复：先清空旧聊天的建议数据
                        this.plotSuggestions.clear();
                        console.log('[PlotOptimizationSystem] 🧹 已清空旧聊天的建议数据');

                        // 恢复新聊天的持久化建议
                        await this.restoreSuggestionsFromChat();
                    } catch (e) {
                        console.warn('[PlotOptimizationSystem] ⚠️ 恢复持久化建议失败:', e);
                    }
                });

                // 🔧 新增：监听消息删除事件（SillyTavern官方事件）
                this.context.eventSource.on(this.context.event_types.MESSAGE_DELETED, async (messageIndex) => {
                    await this.handleSillyTavernMessageDeleted(messageIndex);
                });

                // 🔧 新增：监听消息编辑事件（SillyTavern官方事件）
                this.context.eventSource.on(this.context.event_types.MESSAGE_EDITED, async (messageIndex) => {
                    await this.handleSillyTavernMessageEdited(messageIndex);
                });

                console.log('[PlotOptimizationSystem] 🔗 已绑定CHAT_CHANGED、MESSAGE_DELETED、MESSAGE_EDITED事件监听器');
            }

            // 🔄 延迟恢复建议（等待聊天数据加载完成）
            setTimeout(async () => {
                try {
                    console.log('[PlotOptimizationSystem] ⏰ 延迟恢复建议（1秒后）...');
                    await this.restoreSuggestionsFromChat();
                } catch (e) {
                    console.warn('[PlotOptimizationSystem] ⚠️ 延迟恢复持久化建议失败:', e);
                }
            }, 1000);

            // 触发初始化完成事件
            this.eventSystem?.emit('plotOptimization:initialized', {
                timestamp: Date.now(),
                config: this.config
            });

        } catch (error) {
            this.errorCount++;
            console.error('[PlotOptimizationSystem] ❌ 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无法获取SillyTavern上下文');
                return;
            }

            const extensionSettings = context.extensionSettings;
            const configs = extensionSettings['Information bar integration tool'] || {};
            const plotOptimizationConfig = configs.plotOptimization || {};

            // 合并配置
            this.config = {
                ...this.config,
                ...plotOptimizationConfig
            };

            console.log('[PlotOptimizationSystem] ✅ 配置加载完成:', this.config);

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无法获取SillyTavern上下文');
                return;
            }

            const extensionSettings = context.extensionSettings;
            if (!extensionSettings['Information bar integration tool']) {
                extensionSettings['Information bar integration tool'] = {};
            }

            extensionSettings['Information bar integration tool'].plotOptimization = this.config;
            context.saveSettingsDebounced();

            console.log('[PlotOptimizationSystem] ✅ 配置保存完成');

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 保存配置失败:', error);
        }
    }

    /**
     * 加载提示词模板（内置）
     */
    async loadPromptTemplate() {
        try {
            // 🔧 修复：提示词内置到代码中，不再从外部文件加载
            this.config.promptTemplate = `你的职业是某知名小说平台编辑，名字是："Guhan 3号"，负责给小说作者的剧情内容提供故事节奏、人物塑造，还有剧情推进的建议，帮助小说作者提升作品质量。

【Guhan 3号在剧情优化的时候必须遵守的核心原则】

1. **身份定位**：
   - 作为编辑，Guhan 3号的职责是提供专业建议，而非替作者做决定
   - 所有建议都应使用第三人称表述（"作者可以..."、"建议作者..."、"读者会..."）
   - 绝对禁止使用第一人称（"我"、"我们"、"我认为"等）
   - 保持客观、专业的编辑视角

2. **参考作品学习**：
   - 仔细分析作者提供的参考作品（如有）
   - 学习参考作品的写作风格、叙事节奏、人物塑造手法
   - 将参考作品的优秀技巧融入建议中
   - 如果作者未提供参考作品，则根据故事类型提供通用建议

3. **建议表述规范**：
   ✅ 正确示例：
   - "建议作者在这一章节加强人物内心描写"
   - "作者可以考虑在此处设置一个悬念"
   - "读者在这里可能会期待更多的情感冲突"
   - "参考《三体》的叙事手法，作者可以尝试..."

   ❌ 错误示例：
   - "我认为应该加强人物描写"（使用了第一人称）
   - "我们可以在这里设置悬念"（使用了第一人称复数）
   - "让我们来分析一下"（使用了第一人称）

4. **剧情优化维度**：
   - **故事节奏**：分析当前章节的节奏是否合理，是否需要加快或放缓
   - **人物塑造**：评估人物行为是否符合性格设定，是否有成长空间
   - **剧情推进**：检查剧情是否有效推进，是否存在拖沓或跳跃
   - **冲突设计**：评估冲突强度是否符合预期，是否需要调整
   - **悬念营造**：分析悬念设置是否合理，是否能吸引读者继续阅读
   - **情感共鸣**：评估读者是否能与角色产生情感共鸣
   - **逻辑自洽**：检查剧情逻辑是否合理，是否存在漏洞

5. **🚨 八股文内容检查（必须严格执行）**：
   作为专业编辑，Guhan 3号必须严厉批评AI生成的陈词滥调和八股文式表达。以下是**绝对禁止**出现的内容类型：

   **❌ 禁止类型1：陈词滥调的比喻**
   - "话语像一颗石子，砸入平静的湖面"
   - "沉默如同一张网，笼罩着整个房间"
   - "时间仿佛静止了一般"
   - "空气中弥漫着紧张的气氛"
   - "心跳声在耳边回荡"

   **❌ 禁止类型2：乱码或无意义字符**
   - 任何藏文、梵文等非故事语言的字符（如"སེམས་འདི་"）
   - 随机符号或编码错误
   - 不明含义的特殊字符

   **❌ 禁止类型3：过度抽象的心理描写**
   - "只觉得，有什么东西，正一点点往下坠，抓不住，也喊不出来"
   - "心中涌起一股说不清道不明的情绪"
   - "仿佛有什么东西在胸口堵着"
   - "一种难以名状的感觉袭来"

   **❌ 禁止类型4：突兀的情绪转变**
   - 人物突然绝望（没有铺垫）
   - 眼神突然空洞（缺乏原因）
   - 瞬间崩溃（不符合人物性格）
   - 莫名其妙的情绪爆发

   **❌ 禁止类型5：过度使用的修辞手法**
   - 无意义的排比句堆砌
   - 过度夸张的形容词（"无比"、"极其"、"非常"连用）
   - 空洞的抒情段落
   - 为了押韵而牺牲逻辑的表达

   **❌ 禁止类型6：AI常见的套路表达**
   - "深吸一口气"（频繁出现）
   - "紧握双拳"（过度使用）
   - "咬紧牙关"（陈词滥调）
   - "眼中闪过一丝XX"（套路化）
   - "嘴角勾起一抹XX的笑容"（八股文）

   **✅ 检查方法**：
   1. 逐句检查AI生成的内容，识别上述禁止类型
   2. 对每一处八股文内容进行**严厉批评**
   3. 明确指出为什么这些表达是陈词滥调
   4. 提供具体的、有创意的替代方案
   5. 要求作者删除或重写这些内容

   **✅ 批评示例**：
   - "❌ 严重问题：'话语像一颗石子，砸入平静的湖面'是典型的陈词滥调，毫无新意。建议作者删除这种比喻，直接描写人物的反应和对话内容。"
   - "❌ 严重问题：出现了无意义的字符'སེམས་འདི་'，这是编码错误或AI幻觉，必须删除。"
   - "❌ 严重问题：'只觉得，有什么东西，正一点点往下坠'是过度抽象的心理描写，读者无法理解。建议作者用具体的生理反应或行为来表现人物的情绪，例如'他的手开始颤抖'。"
   - "❌ 严重问题：人物突然'眼神空洞'缺乏铺垫，不符合剧情逻辑。建议作者补充人物情绪变化的过程。"

6. **输出格式要求**：
   - 使用清晰的结构化格式
   - 每个建议都要有明确的理由和参考依据
   - 如果参考了优秀作品，需要明确指出参考点
   - 建议要具体、可操作，避免空泛的评价
   - **必须包含"八股文内容检查"部分**，即使没有发现问题也要说明

═══════════════════════════════════════════════════════════════
【当前剧情优化参数】
═══════════════════════════════════════════════════════════════

- 故事主题：未设置
- 故事类型：未设置
- 参考作品：未设置
- 字数要求：未设置
- 剧情推进强度：5/10
- 剧情冲突强度：5/10
- 剧情悬念强度：5/10
- 剧情反转强度：5/10
- 剧情高潮强度：5/10
- 剧情低谷强度：5/10
- 剧情转折强度：5/10

═══════════════════════════════════════════════════════════════
【输出格式模板】
═══════════════════════════════════════════════════════════════

请严格按照以下格式输出剧情优化建议：

---

**【编辑：Guhan 3号】剧情优化建议**

**一、整体评价**
[对当前章节的整体评价，使用第三人称表述]

**二、参考作品分析**（如果作者提供了参考作品）
[分析参考作品的写作特点，以及如何借鉴到当前剧情中]
- 参考作品：[作品名称]
- 可借鉴的技巧：[具体技巧]
- 应用建议：[如何应用到当前剧情]

**三、🚨 八股文内容检查（必须优先执行）**

**【重要说明】**：这是最重要的检查项目，必须放在所有优化建议之前！

请逐句检查AI生成的内容，识别以下禁止类型：

**1. 陈词滥调的比喻检查**
- **检查内容**：[列出所有发现的陈词滥调比喻]
- **严厉批评**：[对每一处进行严厉批评，说明为什么是陈词滥调]
- **替代方案**：[提供具体的、有创意的替代表达]

**2. 乱码或无意义字符检查**
- **检查内容**：[列出所有发现的乱码或无意义字符]
- **严厉批评**：[指出这是AI幻觉或编码错误]
- **处理建议**：[要求立即删除]

**3. 过度抽象的心理描写检查**
- **检查内容**：[列出所有过度抽象的心理描写]
- **严厉批评**：[说明为什么读者无法理解]
- **替代方案**：[提供具体的生理反应或行为描写]

**4. 突兀的情绪转变检查**
- **检查内容**：[列出所有突兀的情绪转变]
- **严厉批评**：[指出缺乏铺垫和逻辑]
- **修正建议**：[如何补充情绪变化的过程]

**5. 过度使用的修辞手法检查**
- **检查内容**：[列出所有过度使用的修辞]
- **严厉批评**：[说明为什么是空洞的表达]
- **替代方案**：[提供更有实质内容的表达]

**6. AI套路表达检查**
- **检查内容**：[列出所有AI套路表达，如"深吸一口气"、"紧握双拳"等]
- **严厉批评**：[指出这些是AI的常见套路，毫无新意]
- **替代方案**：[提供更有创意的动作描写]

**【检查结果总结】**
- 发现问题总数：[X个]
- 严重程度评级：[低/中/高/极高]
- 整改要求：[必须删除/必须重写/建议优化]

**四、具体优化建议**

**1. 故事节奏优化（当前强度：X/10）**
- **现状分析**：[客观分析当前节奏]
- **优化建议**：[具体建议，使用"建议作者..."、"作者可以..."等表述]
- **预期效果**：[说明优化后的预期效果]

**2. 人物塑造优化**
- **现状分析**：[分析人物塑造的优缺点]
- **优化建议**：[具体建议]
- **参考案例**：[如果有参考作品，说明参考作品是如何处理的]

**3. 剧情推进优化（当前强度：X/10）**
- **现状分析**：[分析剧情推进情况]
- **优化建议**：[具体建议]
- **注意事项**：[需要注意的问题]

**4. 冲突设计优化（当前强度：X/10）**
- **现状分析**：[分析冲突设计]
- **优化建议**：[具体建议]
- **强度调整**：[是否需要调整冲突强度]

**5. 悬念营造优化（当前强度：X/10）**
- **现状分析**：[分析悬念设置]
- **优化建议**：[具体建议]
- **读者预期**：[分析读者可能的预期]

**6. 情感共鸣优化**
- **现状分析**：[分析情感表达]
- **优化建议**：[具体建议]
- **共鸣点设计**：[如何设计情感共鸣点]

**7. 逻辑自洽检查**
- **潜在问题**：[指出可能的逻辑问题]
- **修正建议**：[如何修正]

**五、下一章节建议**
[对下一章节的方向性建议]
- 建议作者在下一章节重点关注：[具体方向]
- 可以考虑的剧情走向：[具体走向]
- **必须避免的八股文表达**：[列出下一章节需要避免的陈词滥调]

**六、总结**
[总结性评价，鼓励作者，使用第三人称]
- **八股文问题总结**：[再次强调发现的八股文问题及整改要求]

---

**🚨🚨🚨 重要提醒（必须严格遵守）🚨🚨🚨**：

**【核心要求】**
1. **八股文检查是第一优先级**：必须在所有优化建议之前完成八股文内容检查
2. **零容忍政策**：对陈词滥调、AI套路表达采取零容忍态度，必须严厉批评
3. **具体指出问题**：不能笼统地说"有些表达不够好"，必须具体指出哪一句是八股文
4. **提供替代方案**：每一处批评都必须提供具体的、有创意的替代表达

**【表述规范】**
5. 所有建议必须使用第三人称（"作者"、"读者"、"建议作者..."等）
6. 禁止使用第一人称（"我"、"我们"、"我认为"等）
7. 如果作者提供了参考作品，必须分析参考作品的写作特点
8. 建议要具体、可操作，避免空泛的评价
9. 保持客观、专业的编辑视角
10. 鼓励作者，但不要过度夸赞
11. 指出问题时要委婉，提供解决方案

**【八股文检查清单】**（每次都必须检查）
✅ 是否有陈词滥调的比喻？
✅ 是否有乱码或无意义字符？
✅ 是否有过度抽象的心理描写？
✅ 是否有突兀的情绪转变？
✅ 是否有过度使用的修辞手法？
✅ 是否有AI套路表达（深吸一口气、紧握双拳等）？

现在，请根据以上要求和格式，为作者提供专业的剧情优化建议。记住：

**🚨 最重要的要求（必须第一优先级执行）🚨**
1. **必须先进行八股文内容检查**，这是最重要的任务！
2. **对每一处八股文内容进行严厉批评**，不要手软！
3. **具体指出问题句子**，不能笼统地说"有些表达不够好"
4. **提供具体的替代方案**，帮助作者改进

**其他要求**
5. 必须使用第三人称
6. 如果有参考作品，必须分析其写作特点
7. 建议要具体、可操作
8. 保持客观、专业的编辑视角

**⚠️ 特别提醒**：如果AI生成的内容中出现以下任何一种情况，必须在"八股文内容检查"部分严厉批评：
- 陈词滥调的比喻（如"话语像一颗石子，砸入平静的湖面"）
- 乱码或无意义字符（如"སེམས་འདི་"）
- 过度抽象的心理描写（如"只觉得，有什么东西，正一点点往下坠"）
- 突兀的情绪转变（如人物突然绝望、眼神空洞）
- AI套路表达（如"深吸一口气"、"紧握双拳"、"眼中闪过一丝XX"）

**即使没有发现八股文问题，也必须在"八股文内容检查"部分明确说明"经检查，本章节未发现明显的八股文内容"。**`;

            console.log('[PlotOptimizationSystem] ✅ 提示词模板加载完成（内置）');
        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 加载提示词模板失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        try {
            console.log('[PlotOptimizationSystem] 🔗 绑定事件监听器...');

            // 🔧 修复：使用SillyTavern的事件类型常量，确保正确监听
            const globalEventSource = this.context?.eventSource;
            const eventTypes = this.context?.event_types;

            if (globalEventSource && eventTypes) {
                // 🔧 关键修复：使用event_types.GENERATION_STARTED常量
                // 这样可以确保与SillyTavern的事件系统正确对接
                globalEventSource.on(eventTypes.GENERATION_STARTED, async (data) => {
                    await this.handleGenerationStarted(data);
                });
                // 🔁 绑定生成结束事件：若主API未产生AI消息（可能是 5xx 网络错误），自动重试一次
                globalEventSource.on(eventTypes.GENERATION_ENDED, async () => {
                    try {
                        const pending = this.pendingRetry;
                        if (!pending) return;
                        const chat = this.context?.chat || [];
                        const generationSucceeded = chat.length > pending.chatLengthBefore;
                        if (generationSucceeded) {
                            this.pendingRetry = null;
                            return;
                        }
                        if (pending.attempted) {
                            this.pendingRetry = null;
                            return;
                        }
                        pending.attempted = true;
                        console.warn('[PlotOptimizationSystem] [AutoRetry] 检测到主API未生成内容，自动重试 1 次...');
                        await new Promise(r => setTimeout(r, 250));
                        const gen = this.context?.Generate;
                        if (typeof gen === 'function') {
                            gen('normal');
                        } else {
                            console.warn('[PlotOptimizationSystem] 未获取到 Generate 方法，无法自动重试');
                            this.pendingRetry = null;
                        }
                    } catch (e) {
                        console.error('[PlotOptimizationSystem] 自动重试处理失败:', e);
                        this.pendingRetry = null;
                    }
                });

                console.log('[PlotOptimizationSystem] ✅ 已绑定SillyTavern全局事件 (GENERATION_STARTED)');
            } else {
                console.warn('[PlotOptimizationSystem] ⚠️ SillyTavern全局eventSource或event_types不可用');
                console.warn('[PlotOptimizationSystem] 📊 eventSource:', !!globalEventSource, 'event_types:', !!eventTypes);
            }

            // 监听内部EventSystem的事件
            if (this.eventSystem) {
                // 监听配置变更事件
                this.eventSystem.on('config:changed', (data) => {
                    if (data.module === 'plotOptimization') {
                        this.handleConfigChanged(data);
                    }
                });

                // 🔧 新增：监听消息删除事件
                this.eventSystem.on('MESSAGE_DELETED', async (data) => {
                    await this.handleMessageDeleted(data);
    /**
     * 绑定“生成结束”监听器，用于在主API异常（如 5xx）时，对当前消息自动重试一次
     */
    /* bindRetryListener REMOVED START
        try {
            const globalEventSource = this.context?.eventSource;
            const eventTypes = this.context?.event_types;
            if (!globalEventSource || !eventTypes) return;

            if (this._retryListenerBound) return;
            this._retryListenerBound = true;

            globalEventSource.on(eventTypes.GENERATION_ENDED, async () => {
                try {
                    // 仅当存在挂起的重试对象时才处理
                    const pending = this.pendingRetry;
                    if (!pending) return;

                    const chat = this.context?.chat || [];
                    // 成功场景：应当新增了AI消息（长度+1），否则认为失败（如 5xx）
                    const generationSucceeded = chat.length > pending.chatLengthBefore;

                    if (generationSucceeded) {
                        // 成功则清理状态
                        this.pendingRetry = null;
                        return;
                    }

                    if (pending.attempted) {
                        // 已经重试过一次，则不再二次重试
                        this.pendingRetry = null;
                        return;
                    }

                    // 执行一次自动重试
                    pending.attempted = true;
                    console.warn('[PlotOptimizationSystem] [33m[1m[0m[33m[1m[0m[AutoRetry] 检测到主API未生成内容，自动重试 1 次...');
                    // 给UI一个极短的喘息时间，避免与上一次流程抢占状态
                    await new Promise(r => setTimeout(r, 250));

                    // 触发一次正常的生成；拦截器会再次运行，但因已存在同楼层建议会快速跳过
                    const gen = this.context?.Generate;
                    if (typeof gen === 'function') {
                        gen('normal');
                    } else {
                        console.warn('[PlotOptimizationSystem] [33m[1m[0m未获取到 Generate 方法，无法自动重试');
                        this.pendingRetry = null;
                    }
                } catch (e) {
                    console.error('[PlotOptimizationSystem] 自动重试处理失败:', e);
                    this.pendingRetry = null;
                }
            });

            console.log('[PlotOptimizationSystem] [32m[1m[0m已绑定 GENERATION_ENDED 自动重试监听器');
        } catch (error) {
            console.error('[PlotOptimizationSystem] 绑定自动重试监听器失败:', error);
        }
    */
    // [removed]

                });

                console.log('[PlotOptimizationSystem] ✅ 已绑定内部EventSystem事件');
            }

            console.log('[PlotOptimizationSystem] ✅ 所有事件监听器绑定完成');

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 绑定事件监听器失败:', error);
        }
    }

    /**
     * 处理生成开始事件
     */
    async handleGenerationStarted(data) {
        try {
            if (!this.config.enabled) {
                return;
            }

            if (this.isProcessing) {
                console.log('[PlotOptimizationSystem] ⏳ 正在处理中，跳过本次请求');
                return;
            }

            // 🔍 检查是否是真实的用户消息触发
            // 如果是dry run（预览）或者quiet模式，跳过优化
            if (data?.dryRun || data?.quiet) {
                console.log('[PlotOptimizationSystem] ⏸️ 检测到dry run或quiet模式，跳过优化');
                return;
            }

            // 🔍 检查聊天记录
            const chat = this.context?.chat;
            if (!chat || chat.length === 0) {
                console.log('[PlotOptimizationSystem] ⏸️ 聊天记录为空，跳过优化');
                return;
            }

            // 🔧 检查聊天长度是否增加（确保有新消息）
            if (chat.length <= this.lastProcessedChatLength) {
                console.log('[PlotOptimizationSystem] ⏸️ 聊天长度未增加，跳过优化（可能是页面加载或重复触发）');
                console.log('[PlotOptimizationSystem] 📊 当前聊天长度:', chat.length, '上次处理长度:', this.lastProcessedChatLength);
                return;
            }

            // 🔍 检查最后一条或倒数第二条消息是否是用户消息
            // 注意：generation_started触发时，SillyTavern可能已经在聊天记录中添加了AI消息的占位符
            // 所以我们需要检查最后一条或倒数第二条消息
            const lastMessage = chat[chat.length - 1];
            const secondLastMessage = chat.length > 1 ? chat[chat.length - 2] : null;

            let userMessage = null;
            let messageId = null;
            let userMessageIndex = -1; // 🔧 新增：记录用户消息在chat数组中的索引

            if (lastMessage?.is_user) {
                userMessage = lastMessage;
                messageId = lastMessage.send_date || lastMessage.mes;
                userMessageIndex = chat.length - 1; // 🔧 记录索引
            } else if (secondLastMessage?.is_user) {
                userMessage = secondLastMessage;
                messageId = secondLastMessage.send_date || secondLastMessage.mes;
                userMessageIndex = chat.length - 2; // 🔧 记录索引
            }

            if (!userMessage || userMessageIndex === -1) {
                console.log('[PlotOptimizationSystem] ⏸️ 最后两条消息都不是用户消息，跳过优化');
                console.log('[PlotOptimizationSystem] 📊 最后一条消息:', {
                    is_user: lastMessage?.is_user,
                    name: lastMessage?.name
                });
                console.log('[PlotOptimizationSystem] 📊 倒数第二条消息:', {
                    is_user: secondLastMessage?.is_user,
                    name: secondLastMessage?.name
                });
                return;
            }

            // 🔧 修复：直接使用索引计算楼层号（索引+1）
            const floorNumber = userMessageIndex + 1; // 楼层号从1开始

            console.log('[PlotOptimizationSystem] � 用户消息索引:', userMessageIndex);
            console.log('[PlotOptimizationSystem] 📊 用户消息楼层号:', floorNumber);
            console.log('[PlotOptimizationSystem] 📊 聊天记录总长度:', chat.length);

            // 🔧 修复：检查该楼层是否已经有剧情优化建议（防止重复生成）
            const existingSuggestion = this.plotSuggestions.get(messageId);
            if (existingSuggestion && existingSuggestion.floorNumber === floorNumber) {
                console.log('[PlotOptimizationSystem] ⏸️ 该楼层已有剧情优化建议，跳过重复生成');
                console.log('[PlotOptimizationSystem] 📊 现有建议:', {
                    floorNumber: existingSuggestion.floorNumber,
                    timestamp: new Date(existingSuggestion.timestamp).toLocaleString()
                });
                return;
            }

            // 🔧 检查消息ID是否已处理（防止重复处理同一条消息）
            if (messageId === this.lastProcessedMessageId) {
                console.log('[PlotOptimizationSystem] ⏸️ 该消息已处理过，跳过优化');
                return;
            }

            console.log('[PlotOptimizationSystem] ✅ 检测到用户消息，开始剧情优化');
            console.log('[PlotOptimizationSystem] 📊 用户消息:', userMessage.mes?.substring(0, 50));
            console.log('[PlotOptimizationSystem] 📊 消息ID:', messageId);
            console.log('[PlotOptimizationSystem] 📊 楼层号:', floorNumber);

            const startTime = Date.now();
            this.isProcessing = true;

            console.log('[PlotOptimizationSystem] 🎬 开始剧情优化处理...');

            // 获取当前聊天上下文
            const context = await this.getContextMessages();

            if (!context || context.length === 0) {
                console.log('[PlotOptimizationSystem] ⏸️ 没有足够的上下文，跳过优化');
                this.isProcessing = false;
                return;
            }

            // 调用自定义API获取剧情建议
            const suggestion = await this.getPlotSuggestion(context);

            // 🔧 修复：统一更新统计计数
            this.stats.totalOptimizations++;

            if (suggestion) {
                // 🔧 修复：传递消息ID和正确的楼层号
                await this.injectSuggestion(suggestion, messageId, floorNumber);

                // 更新统计
                this.stats.successCount++;
            } else {
                this.stats.failureCount++;
            }

            const processingTime = Date.now() - startTime;
            this.updateStats(processingTime);
            this.lastOptimizationTime = Date.now();

            // 🔧 更新处理状态
            if (chat) {
                this.lastProcessedChatLength = chat.length;
                this.lastProcessedMessageId = messageId;
            }

            console.log('[PlotOptimizationSystem] ✅ 剧情优化完成，耗时:', processingTime, 'ms');

        } catch (error) {
            this.errorCount++;
            this.stats.failureCount++;
            console.error('[PlotOptimizationSystem] ❌ 处理生成开始事件失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 获取上下文消息
     */
    async getContextMessages() {
        try {
            const chat = this.context?.chat;
            if (!chat || chat.length === 0) {
                return [];
            }

            // 获取最近的N条消息
            const recentMessages = chat.slice(-this.config.maxContextMessages);

            return recentMessages.map(msg => ({
                role: msg.is_user ? 'user' : 'assistant',
                content: msg.mes
            }));

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 获取上下文消息失败:', error);
            return [];
        }
    }

    /**
     * 调用自定义API获取剧情建议
     */
    async getPlotSuggestion(contextMessages) {
        try {
            console.log('[PlotOptimizationSystem] 🔍 调用自定义API获取剧情建议...');

            // 构建完整提示词
            const fullPrompt = this.buildPrompt(contextMessages);

            // 🔍 添加提示词调试信息
            console.log('[PlotOptimizationSystem] 📝 提示词长度:', fullPrompt?.length || 0);
            console.log('[PlotOptimizationSystem] 📝 提示词前100字符:', fullPrompt?.substring(0, 100) || '空');

            // 调用自定义API
            const response = await this.callCustomAPI(fullPrompt);

            // 🔍 检查响应内容是否有效
            if (response && response.content && typeof response.content === 'string' && response.content.trim().length > 0) {
                console.log('[PlotOptimizationSystem] ✅ 获取剧情建议成功，内容长度:', response.content.length);
                return response.content;
            }

            console.warn('[PlotOptimizationSystem] ⚠️ 未获取到有效的剧情建议');
            return null;

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 获取剧情建议失败:', error);
            return null;
        }
    }

    /**
     * 构建提示词
     */
    buildPrompt(contextMessages) {
        try {
            // 构建上下文
            const contextText = contextMessages.map((msg, index) => {
                const role = msg.role === 'user' ? '用户' : 'AI';
                return `[${index + 1}] ${role}: ${msg.content}`;
            }).join('\n\n');

            // 🔧 新增：获取最后一条用户消息（用户的剧情走向规划）
            const lastUserMessage = contextMessages.filter(msg => msg.role === 'user').pop();
            const userPlotDirection = lastUserMessage ? lastUserMessage.content : '未提供';

            // 替换提示词模板中的参数占位符
            let prompt = this.config.promptTemplate;

            // 替换剧情优化参数
            prompt = prompt.replace(/- 故事主题：.*$/m, `- 故事主题：${this.config.storyTheme || '未设置'}`);
            prompt = prompt.replace(/- 故事类型：.*$/m, `- 故事类型：${this.config.storyType || '未设置'}`);
            prompt = prompt.replace(/- 参考作品：.*$/m, `- 参考作品：${this.config.referenceWorks || '未设置'}`);
            prompt = prompt.replace(/- 字数要求：.*$/m, `- 字数要求：${this.config.wordCountRequirement || '未设置'}`);
            prompt = prompt.replace(/- 剧情推进强度：.*$/m, `- 剧情推进强度：${this.config.plotProgressIntensity}/10`);
            prompt = prompt.replace(/- 剧情冲突强度：.*$/m, `- 剧情冲突强度：${this.config.plotConflictIntensity}/10`);
            prompt = prompt.replace(/- 剧情悬念强度：.*$/m, `- 剧情悬念强度：${this.config.plotSuspenseIntensity}/10`);
            prompt = prompt.replace(/- 剧情反转强度：.*$/m, `- 剧情反转强度：${this.config.plotTwistIntensity}/10`);
            prompt = prompt.replace(/- 剧情高潮强度：.*$/m, `- 剧情高潮强度：${this.config.plotClimaxIntensity}/10`);
            prompt = prompt.replace(/- 剧情低谷强度：.*$/m, `- 剧情低谷强度：${this.config.plotLowIntensity}/10`);
            prompt = prompt.replace(/- 剧情转折强度：.*$/m, `- 剧情转折强度：${this.config.plotTurnIntensity}/10`);

            // 组合完整提示词
            const fullPrompt = `${prompt}\n\n═══════════════════════════════════════════════════════════════\n【当前剧情上下文】\n═══════════════════════════════════════════════════════════════\n\n${contextText}\n\n═══════════════════════════════════════════════════════════════\n【用户规划的剧情走向】\n═══════════════════════════════════════════════════════════════\n\n${userPlotDirection}\n\n⚠️ 重要提示：请根据用户规划的剧情走向进行优化建议，而不是自己规划剧情。你的职责是帮助用户优化他们的剧情构思，而不是替代用户创作。\n\n请根据以上剧情上下文、用户规划的剧情走向和剧情优化参数，提供下一章的剧情优化建议。`;

            return fullPrompt;

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 构建提示词失败:', error);
            return this.config.promptTemplate;
        }
    }

    /**
     * 调用通用API（使用InfoBarSettings的sendCustomAPIRequest方法）
     */
    async callCustomAPI(prompt) {
        try {
            console.log('[PlotOptimizationSystem] 📡 调用通用API...');

            // 🔧 从通用API配置中获取参数
            const apiConfig = this.context?.extensionSettings?.['Information bar integration tool']?.apiConfig;
            if (!apiConfig || !apiConfig.model || !apiConfig.apiKey) {
                throw new Error('通用API配置不完整，请先在API配置面板中完成配置');
            }

            console.log('[PlotOptimizationSystem] 📋 使用通用API配置:', {
                provider: apiConfig.provider,
                baseUrl: apiConfig.baseUrl || apiConfig.endpoint,
                model: apiConfig.model,
                maxTokens: apiConfig.maxTokens || 20000
            });

            // 🔧 使用InfoBarSettings的sendCustomAPIRequest方法
            // 这是正确的调用方式，支持所有提供商（gemini, openai, localproxy）
            if (!this.infoBarSettings || typeof this.infoBarSettings.sendCustomAPIRequest !== 'function') {
                throw new Error('InfoBarSettings未初始化或sendCustomAPIRequest方法不可用');
            }

            console.log('[PlotOptimizationSystem] 🔧 使用InfoBarSettings.sendCustomAPIRequest方法');

            // 构建消息数组
            const messages = [
                {
                    role: 'user',
                    content: prompt
                }
            ];

            // 调用InfoBarSettings的sendCustomAPIRequest方法
            const result = await this.infoBarSettings.sendCustomAPIRequest(messages, {
                skipSystemPrompt: true, // 跳过系统提示词，因为我们已经构建了完整的提示词
                apiConfig: {
                    provider: apiConfig.provider,
                    model: apiConfig.model,
                    apiKey: apiConfig.apiKey,
                    endpoint: apiConfig.endpoint,
                    baseUrl: apiConfig.baseUrl || apiConfig.endpoint,
                    format: apiConfig.format,
                    maxTokens: apiConfig.maxTokens || 20000,
                    temperature: apiConfig.temperature || 0.7,
                    headers: apiConfig.headers,
                    enabled: apiConfig.enabled,
                    retryCount: apiConfig.retryCount
                }
            });

            // 🔍 检查结果
            if (result && result.success && result.text) {
                console.log('[PlotOptimizationSystem] ✅ API调用成功，内容长度:', result.text.length);
                return { content: result.text };
            } else {
                console.warn('[PlotOptimizationSystem] ⚠️ API返回了空内容或失败');
                console.warn('[PlotOptimizationSystem] 📊 API结果:', result);
                return { content: null };
            }

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 调用API失败:', error);
            throw error;
        }
    }

    /**
     * 注入建议到主API提示词
     * @param {string} suggestion - 剧情优化建议
     * @param {string} messageId - 用户消息ID
     * @param {number} floorNumber - 消息楼层号
     */
    async injectSuggestion(suggestion, messageId, floorNumber) {
        try {
            console.log('[PlotOptimizationSystem] 💉 注入剧情建议到主API提示词...');
            console.log('[PlotOptimizationSystem] 📊 消息ID:', messageId, '楼层号:', floorNumber);

            const now = Date.now();
            // 🔧 保存剧情建议到内存Map
            this.plotSuggestions.set(messageId, {
                suggestion: suggestion,
                timestamp: now,
                floorNumber: floorNumber
            });

            // 🔧 同步持久化到对应的用户消息对象，刷新后可恢复
            try {
                const chat = this.context?.chat;
                const idx = Math.max(0, Number(floorNumber) - 1);
                const userMsg = Array.isArray(chat) ? chat[idx] : null;
                if (userMsg && userMsg.is_user) {
                    userMsg.infobar_plot_optimization = {
                        suggestion,
                        timestamp: now,
                        floorNumber,
                        messageId,
                        version: 1
                    };
                    if (typeof this.context?.saveChat === 'function') {
                        await this.context.saveChat();
                        console.log('[PlotOptimizationSystem] 💾 已持久化剧情建议到用户消息并保存聊天');
                    }
                } else {
                    console.warn('[PlotOptimizationSystem] ⚠️ 未找到对应的用户消息，跳过消息级持久化');
                }
            } catch (persistErr) {
                console.warn('[PlotOptimizationSystem] ⚠️ 持久化剧情建议到消息失败:', persistErr);
            }

            // 构建注入内容
            const injectionContent = `【剧情优化建议 - 来自编辑Guhan 3号】\n\n${suggestion}\n\n请参考以上建议，生成更优质的剧情内容。`;

            // 🔧 修复：使用正确的setExtensionPrompt参数
            // 参数顺序：(identifier, prompt, position, depth, scan, role)
            // position: 优先级（数字越小越靠前，0=最高优先级）
            // depth: 注入深度（0=system, 1=after_character, 2=before_examples, 4=chat_history）
            //
            // ✅ 正确用法：将建议注入到“聊天上下文”而不是“主提示词字符串”（IN_CHAT）
            // 这会以一条系统消息的形式插入到对话中，深度=1 表示在角色卡后、示例前。
            if (this.context?.setExtensionPrompt) {
                const position = 1;  // ✅ IN_CHAT（见 script.js extension_prompt_types）
                const depth = 1;     // ✅ after_character（聊天注入深度）

                this.context.setExtensionPrompt(
                    'information_bar_plot_optimization',  // identifier
                    injectionContent,                      // prompt
                    position,                              // position: 1=IN_CHAT
                    depth,                                 // depth: 1=after_character
                    false,                                 // scan: 是否扫描
                    0                                      // role: 0=system
                );

                console.log('[PlotOptimizationSystem] ✅ 剧情建议已注入到主API提示词(聊天注入)');
                console.log('[PlotOptimizationSystem] 📊 注入参数:', {
                    position: position,
                    depth: depth,
                    identifier: 'information_bar_plot_optimization'
                });
            } else {
                console.warn('[PlotOptimizationSystem] ⚠️ SillyTavern扩展提示词机制不可用');
            }

            // 触发事件
            this.eventSystem?.emit('plotOptimization:suggestionInjected', {
                suggestion,
                messageId,
                floorNumber,
                timestamp: now
            });

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 注入剧情建议失败:', error);
        }
    }

    /**
     * 🔧 新增：处理消息删除事件（内部EventSystem）
     */
    async handleMessageDeleted(data) {
        try {
            console.log('[PlotOptimizationSystem] 🗑️ 处理消息删除事件（内部EventSystem）');

            if (!this.config.enabled) {
                return;
            }

            // 🔧 关键：检查是否需要跳过回溯（用户消息删除）
            if (data && data.skipRollback === true) {
                console.log('[PlotOptimizationSystem] ℹ️ 删除的是用户消息，需要清理对应的剧情优化建议');

                // 🔧 获取删除的消息信息
                const messageInfo = data.messageInfo;
                if (messageInfo && messageInfo.index) {
                    // 🔧 修复：使用楼层号生成messageId
                    const messageId = `floor_${messageInfo.index}`;

                    // 删除对应的剧情优化建议
                    if (this.plotSuggestions.has(messageId)) {
                        this.plotSuggestions.delete(messageId);
                        console.log('[PlotOptimizationSystem] ✅ 已删除用户消息对应的剧情优化建议, messageId:', messageId);
                    } else {
                        console.log('[PlotOptimizationSystem] ℹ️ 未找到对应的剧情优化建议, messageId:', messageId);
                    }

                }

                return;
            }

            console.log('[PlotOptimizationSystem] ℹ️ 删除的是AI消息，保留剧情优化建议');

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 处理消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理SillyTavern消息删除事件
     */
    async handleSillyTavernMessageDeleted(eventData) {
        try {
            // 🔧 修复：支持两种参数格式
            // 1. 直接传递messageIndex（数字）
            // 2. 传递eventData对象（包含isUser和messageInfo）
            let messageIndex, isUserMessage, messageInfo;

            if (typeof eventData === 'number') {
                // 旧格式：直接传递messageIndex
                messageIndex = eventData;
                isUserMessage = null; // 需要推断
                console.log('[PlotOptimizationSystem] 🗑️ 处理SillyTavern消息删除事件（旧格式）, messageIndex:', messageIndex);
            } else if (typeof eventData === 'object' && eventData !== null) {
                // 新格式：传递eventData对象
                messageIndex = eventData.messageInfo?.index ?? eventData.index;
                isUserMessage = eventData.isUser;
                messageInfo = eventData.messageInfo;
                console.log('[PlotOptimizationSystem] 🗑️ 处理SillyTavern消息删除事件（新格式）, messageIndex:', messageIndex, ', isUser:', isUserMessage);
            } else {
                console.warn('[PlotOptimizationSystem] ⚠️ 无效的事件数据格式:', eventData);
                return;
            }

            if (!this.config.enabled) {
                return;
            }

            const chat = this.context?.chat;
            if (!chat || !Array.isArray(chat)) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无法获取聊天数据');
                return;
            }

            // 🔧 如果EventSystem已经提供了isUser信息，直接使用
            if (isUserMessage === null) {
                // 需要推断消息类型
                console.log('[PlotOptimizationSystem] 🔍 EventSystem未提供消息类型，开始推断...');

                // 策略：检查当前messageIndex位置的消息类型
                if (messageIndex >= chat.length) {
                    // 删除的是最后一条消息
                    const lastMessage = chat[chat.length - 1];
                    if (lastMessage) {
                        isUserMessage = !lastMessage.is_user;
                        console.log('[PlotOptimizationSystem] 🔍 推断策略: 删除最后一条消息，当前最后一条是', lastMessage.is_user ? '用户消息' : 'AI消息', '，推断删除的是', isUserMessage ? '用户消息' : 'AI消息');
                    }
                } else {
                    // 删除的不是最后一条消息
                    const currentMessage = chat[messageIndex];
                    if (currentMessage) {
                        isUserMessage = !currentMessage.is_user;
                        console.log('[PlotOptimizationSystem] 🔍 推断策略: 删除中间消息，当前位置是', currentMessage.is_user ? '用户消息' : 'AI消息', '，推断删除的是', isUserMessage ? '用户消息' : 'AI消息');
                    } else {
                        console.warn('[PlotOptimizationSystem] ⚠️ 无法推断被删除消息类型, messageIndex:', messageIndex, ', chatLength:', chat.length);
                        return;
                    }
                }
            }

            const floorNumber = messageIndex + 1; // 被删除消息的楼层号
            console.log('[PlotOptimizationSystem] 📊 删除消息分析: {messageIndex:', messageIndex, ', floorNumber:', floorNumber, ', isUserMessage:', isUserMessage, ', chatLength:', chat.length, ', messageType:', isUserMessage ? '用户消息' : 'AI消息', '}');

            // 🔧 如果删除的是用户消息，清理对应的剧情优化建议
            if (isUserMessage) {
                const messageId = `floor_${floorNumber}`;

                // 删除内存中的建议
                if (this.plotSuggestions.has(messageId)) {
                    this.plotSuggestions.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除用户消息对应的剧情优化建议（内存）, messageId:', messageId);
                }

                // 删除预优化结果
                if (this.preOptimizationResults && this.preOptimizationResults.has(messageId)) {
                    this.preOptimizationResults.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除预优化结果, messageId:', messageId);
                }

                // 删除预优化缓存
                if (this.preOptimizationCache && this.preOptimizationCache.has(messageId)) {
                    this.preOptimizationCache.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除预优化缓存, messageId:', messageId);
                }

                console.log('[PlotOptimizationSystem] ✅ 用户消息删除处理完成');
            } else {
                console.log('[PlotOptimizationSystem] ℹ️ 删除的是AI消息，保留剧情优化建议');
            }

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 处理SillyTavern消息删除事件失败:', error);
        }
    }

    /**
     * 🔧 新增：处理SillyTavern消息编辑事件
     */
    async handleSillyTavernMessageEdited(messageIndex) {
        try {
            console.log('[PlotOptimizationSystem] ✏️ 处理SillyTavern消息编辑事件, messageIndex:', messageIndex);

            if (!this.config.enabled) {
                return;
            }

            const chat = this.context?.chat;
            if (!chat || !Array.isArray(chat)) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无法获取聊天数据');
                return;
            }

            // 🔧 修复：确保messageIndex是数字
            const index = typeof messageIndex === 'string' ? parseInt(messageIndex, 10) : messageIndex;
            if (isNaN(index)) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无效的messageIndex:', messageIndex);
                return;
            }

            // 🔧 检查编辑的消息类型
            const editedMessage = chat[index];
            if (!editedMessage) {
                console.warn('[PlotOptimizationSystem] ⚠️ 无法获取编辑的消息, index:', index);
                return;
            }

            // 🔧 如果编辑的是用户消息，清理对应的剧情优化建议
            if (editedMessage.is_user) {
                const floorNumber = index + 1; // 楼层号从1开始
                const messageId = `floor_${floorNumber}`;

                console.log('[PlotOptimizationSystem] 📊 编辑的是用户消息, messageId:', messageId);

                // 删除内存中的建议
                if (this.plotSuggestions.has(messageId)) {
                    this.plotSuggestions.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除用户消息对应的剧情优化建议（内存）, messageId:', messageId);
                }

                // 删除预优化结果
                if (this.preOptimizationResults && this.preOptimizationResults.has(messageId)) {
                    this.preOptimizationResults.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除预优化结果, messageId:', messageId);
                }

                // 删除预优化缓存
                if (this.preOptimizationCache && this.preOptimizationCache.has(messageId)) {
                    this.preOptimizationCache.delete(messageId);
                    console.log('[PlotOptimizationSystem] ✅ 已删除预优化缓存, messageId:', messageId);
                }

                // 🔧 关键：删除用户消息对象上的持久化数据
                if (editedMessage.infobar_plot_optimization) {
                    delete editedMessage.infobar_plot_optimization;
                    console.log('[PlotOptimizationSystem] ✅ 已删除用户消息对象上的持久化数据');

                    // 保存聊天
                    try {
                        await this.context.saveChat();
                        console.log('[PlotOptimizationSystem] 💾 已保存聊天（删除持久化数据）');
                    } catch (e) {
                        console.warn('[PlotOptimizationSystem] ⚠️ 保存聊天失败:', e);
                    }
                }

                console.log('[PlotOptimizationSystem] ✅ 用户消息编辑处理完成，下次发送将重新生成剧情优化建议');
            } else {
                console.log('[PlotOptimizationSystem] ℹ️ 编辑的是AI消息，不影响剧情优化建议');
            }

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 处理SillyTavern消息编辑事件失败:', error);
        }
    }

    /**
     * 处理配置变更事件
     */
    handleConfigChanged(data) {
        try {
            console.log('[PlotOptimizationSystem] 🔄 配置已变更:', data);

            // 重新加载配置
            this.loadConfig();

            // 如果启用状态改变，重新绑定或解绑事件
            if (data.config?.enabled !== undefined) {
                if (data.config.enabled && !this.config.enabled) {
                    this.bindEventListeners();
                }
            }

        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 处理配置变更失败:', error);
        }
    }

    /**
     * 更新统计信息
     */
    updateStats(processingTime) {

        const totalTime = this.stats.averageProcessingTime * (this.stats.totalOptimizations - 1) + processingTime;
        this.stats.averageProcessingTime = Math.round(totalTime / this.stats.totalOptimizations);
    }

    /**
     * 启用/禁用剧情优化系统
     */
    async setEnabled(enabled) {
        const wasEnabled = this.config.enabled;
        this.config.enabled = enabled;
        await this.saveConfig();

        // 如果从禁用变为启用，需要绑定事件监听器
        if (!wasEnabled && enabled && this.initialized) {
            console.log('[PlotOptimizationSystem] 🔗 从禁用变为启用，重新绑定事件监听器...');
            this.bindEventListeners();
        }

        console.log(`[PlotOptimizationSystem] ${enabled ? '✅ 已启用' : '⏸️ 已禁用'}剧情优化系统`);

        this.eventSystem?.emit('plotOptimization:enabledChanged', { enabled });
    }

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            isProcessing: this.isProcessing,
            errorCount: this.errorCount,
            stats: { ...this.stats },
            lastOptimizationTime: this.lastOptimizationTime,
            config: {
                customApiUrl: this.config.customApiUrl ? '已配置' : '未配置',
                customApiKey: this.config.customApiKey ? '已配置' : '未配置',
                customApiModel: this.config.customApiModel || '未配置'
            }
        };
    }
    /**
     * 从现有聊天消息恢复持久化的剧情优化建议（用于刷新后恢复状态）
     */
    async restoreSuggestionsFromChat() {
        try {
            const chat = this.context?.chat || [];
            let restored = 0;
            let upgraded = 0;
            for (let i = 0; i < chat.length; i++) {
                const msg = chat[i];
                if (!msg || !msg.is_user) continue;
                const stored = msg.infobar_plot_optimization;
                if (stored && typeof stored.suggestion === 'string' && stored.suggestion.trim()) {
                    const floorNumber = i + 1;
                    const messageId = `floor_${floorNumber}`;

                    // 🔧 恢复到内存Map（使用统一的floor_N格式）
                    this.plotSuggestions.set(messageId, {
                        suggestion: stored.suggestion,
                        timestamp: stored.timestamp || Date.now(),
                        floorNumber,
                    });
                    restored++;

                    // 🔧 如果messageId是旧格式（非floor_N），升级为新格式并保存
                    if (stored.messageId && !stored.messageId.startsWith('floor_')) {
                        console.log(`[PlotOptimizationSystem] 🔄 升级旧格式messageId: ${stored.messageId} -> ${messageId}`);
                        msg.infobar_plot_optimization.messageId = messageId;
                        upgraded++;
                    }
                }
            }

            // 🔧 如果有升级，保存聊天文件
            if (upgraded > 0) {
                try {
                    if (typeof this.context?.saveChat === 'function') {
                        await this.context.saveChat();
                        console.log(`[PlotOptimizationSystem] 💾 已升级并保存 ${upgraded} 条旧格式建议`);
                    }
                } catch (saveErr) {
                    console.warn('[PlotOptimizationSystem] ⚠️ 保存升级后的建议失败:', saveErr);
                }
            }

            console.log('[PlotOptimizationSystem] ✅ 恢复建议数量:', restored, '(升级:', upgraded, ')');
        } catch (error) {
            console.error('[PlotOptimizationSystem] ❌ 恢复持久化建议失败:', error);
        }
    }


    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalOptimizations: 0,
            successCount: 0,
            failureCount: 0,
            averageProcessingTime: 0
        };
        this.errorCount = 0;
        console.log('[PlotOptimizationSystem] 🔄 统计信息已重置');
    }
}
